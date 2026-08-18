import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {
    Prisma,
} from '../generated/prisma/client';

import {
    MatchFormat,
    MatchStatus,
    TournamentFormat,
    TournamentStatus,
} from '../generated/prisma/enums';

import {
    PrismaService,
} from '../prisma/prisma.service';

import {
    RecordGameResultDto,
} from './dto/record-game-result.dto';


/* ============================================================
   INTERNAL BRACKET SLOT
============================================================ */

type BracketSlot =
    | {
        kind: 'resolved';
        teamId: number;
    }
    | {
        kind: 'pending';
    }
    | null;


/* ============================================================
   SERVICE
============================================================ */

@Injectable()
export class MatchesService {

    constructor(
        private readonly prisma:
            PrismaService,
    ) { }


    /* ============================================================
       PUBLIC: GET ALL MATCHES
    ============================================================ */

    async findAll(
        tournamentId: number,
    ) {

        const tournament =
            await this.prisma
                .tournament
                .findUnique({

                    where: {
                        id:
                            tournamentId,
                    },

                    select: {
                        id:
                            true,
                    },

                });


        if (!tournament) {

            throw new NotFoundException(
                'Tournament not found',
            );

        }


        return this.prisma
            .match
            .findMany({

                where: {
                    tournamentId,
                },


                orderBy: [

                    {
                        roundNumber:
                            'asc',
                    },

                    {
                        matchNumber:
                            'asc',
                    },

                ],


                include: {

                    teamA:
                        true,

                    teamB:
                        true,

                    winnerTeam:
                        true,


                    games: {

                        orderBy: {
                            gameNumber:
                                'asc',
                        },


                        include: {

                            winnerTeam:
                                true,


                            mvpParticipant: {

                                include: {
                                    player:
                                        true,
                                },

                            },


                            svpParticipant: {

                                include: {
                                    player:
                                        true,
                                },

                            },

                        },

                    },

                },

            });

    }


    /* ============================================================
       PUBLIC: GET ONE MATCH
    ============================================================ */

    async findOne(
        tournamentId: number,
        matchId: number,
    ) {

        const match =
            await this.prisma
                .match
                .findFirst({

                    where: {

                        id:
                            matchId,

                        tournamentId,

                    },


                    include: {

                        teamA: {

                            include: {

                                members: {

                                    include: {

                                        participant: {

                                            include: {
                                                player:
                                                    true,
                                            },

                                        },

                                    },

                                },

                            },

                        },


                        teamB: {

                            include: {

                                members: {

                                    include: {

                                        participant: {

                                            include: {
                                                player:
                                                    true,
                                            },

                                        },

                                    },

                                },

                            },

                        },


                        winnerTeam:
                            true,


                        games: {

                            orderBy: {
                                gameNumber:
                                    'asc',
                            },


                            include: {

                                winnerTeam:
                                    true,


                                mvpParticipant: {

                                    include: {
                                        player:
                                            true,
                                    },

                                },


                                svpParticipant: {

                                    include: {
                                        player:
                                            true,
                                    },

                                },

                            },

                        },

                    },

                });


        if (!match) {

            throw new NotFoundException(
                'Match not found',
            );

        }


        return match;

    }


    /* ============================================================
       ADMIN: GENERATE SINGLE ELIMINATION BRACKET

       Supports:
       2 teams
       3 teams
       4 teams
       5 teams
       6 teams
       7 teams
       8 teams
       ...

       Non-power-of-two team counts automatically receive byes.

       Example 6 teams:

       Seed 1 ──────────────┐
                            ├─ SF1 ─┐
       Seed 4 ─┐            │       │
               ├─ R1 ──────┘       │
       Seed 5 ─┘                    │
                                    ├─ FINAL
       Seed 2 ──────────────┐       │
                            ├─ SF2 ─┘
       Seed 3 ─┐            │
               ├─ R1 ──────┘
       Seed 6 ─┘

    ============================================================ */

    async generateBracket(
        tournamentId: number,
    ) {

        return this.prisma.$transaction(

            async (tx) => {

                /* ====================================================
                   TOURNAMENT
                ==================================================== */

                const tournament =
                    await tx
                        .tournament
                        .findUnique({

                            where: {
                                id:
                                    tournamentId,
                            },

                        });


                if (!tournament) {

                    throw new NotFoundException(
                        'Tournament not found',
                    );

                }


                if (
                    tournament.status !==
                    TournamentStatus
                        .ROSTER_LOCKED
                ) {

                    throw new BadRequestException(
                        'Tournament roster must be locked before generating matches',
                    );

                }


                if (
                    tournament.tournamentFormat !==
                    TournamentFormat
                        .SINGLE_ELIMINATION
                ) {

                    throw new BadRequestException(
                        'Bracket generator currently supports SINGLE_ELIMINATION only',
                    );

                }


                if (
                    tournament.teamCount <
                    2
                ) {

                    throw new BadRequestException(
                        'At least 2 teams are required',
                    );

                }


                /* ====================================================
                   PREVENT DUPLICATE GENERATION
                ==================================================== */

                const existingMatches =
                    await tx
                        .match
                        .count({

                            where: {
                                tournamentId,
                            },

                        });


                if (
                    existingMatches >
                    0
                ) {

                    throw new ConflictException(
                        'Tournament matches have already been generated',
                    );

                }


                /* ====================================================
                   TEAMS
                ==================================================== */

                const teams =
                    await tx
                        .tournamentTeam
                        .findMany({

                            where: {
                                tournamentId,
                            },


                            orderBy: {
                                seed:
                                    'asc',
                            },


                            include: {
                                members:
                                    true,
                            },

                        });


                if (
                    teams.length !==
                    tournament.teamCount
                ) {

                    throw new BadRequestException(
                        `Expected ${tournament.teamCount} tournament teams, found ${teams.length}`,
                    );

                }


                /* ====================================================
                   VALIDATE ROSTERS + SEEDS
                ==================================================== */

                const seenSeeds =
                    new Set<number>();


                for (
                    const team
                    of teams
                ) {

                    if (
                        team.members.length !==
                        tournament.playersPerTeam
                    ) {

                        throw new BadRequestException(
                            `Team ${team.name} does not have exactly ${tournament.playersPerTeam} players`,
                        );

                    }


                    if (
                        team.seed ===
                        null
                    ) {

                        throw new BadRequestException(
                            `Team ${team.name} has no seed`,
                        );

                    }


                    if (
                        team.seed <
                        1
                        ||
                        team.seed >
                        teams.length
                    ) {

                        throw new BadRequestException(
                            `Team ${team.name} has invalid seed ${team.seed}`,
                        );

                    }


                    if (
                        seenSeeds.has(
                            team.seed,
                        )
                    ) {

                        throw new BadRequestException(
                            `Duplicate tournament seed ${team.seed}`,
                        );

                    }


                    seenSeeds.add(
                        team.seed,
                    );

                }


                /* ====================================================
                   ENSURE SEEDS 1..N EXIST
                ==================================================== */

                for (
                    let seed = 1;
                    seed <= teams.length;
                    seed++
                ) {

                    if (
                        !seenSeeds.has(
                            seed,
                        )
                    ) {

                        throw new BadRequestException(
                            `Missing tournament seed ${seed}`,
                        );

                    }

                }


                const teamBySeed =
                    new Map<
                        number,
                        (typeof teams)[number]
                    >();


                for (
                    const team
                    of teams
                ) {

                    teamBySeed.set(
                        team.seed!,
                        team,
                    );

                }


                /* ====================================================
                   BRACKET SIZE

                   2  -> 2
                   3  -> 4
                   4  -> 4
                   6  -> 8
                   8  -> 8
                   10 -> 16
                ==================================================== */

                const bracketSize =
                    this.nextPowerOfTwo(
                        teams.length,
                    );


                const totalRounds =
                    Math.log2(
                        bracketSize,
                    );


                const seedOrder =
                    this.buildSeedOrder(
                        bracketSize,
                    );


                /* ====================================================
                   INITIAL BRACKET POSITIONS
                ==================================================== */

                let currentSlots:
                    BracketSlot[] =
                    seedOrder.map(
                        (
                            seed,
                        ) => {

                            const team =
                                teamBySeed.get(
                                    seed,
                                );


                            if (!team) {

                                /*
                                 * Missing seed means a bye.
                                 */
                                return null;

                            }


                            return {
                                kind:
                                    'resolved',

                                teamId:
                                    team.id,
                            };

                        },
                    );


                const generatedMatches: Array<
                    Awaited<
                        ReturnType<
                            typeof tx.match.create
                        >
                    >
                > = [];


                /* ====================================================
                   BUILD ROUND BY ROUND
                ==================================================== */

                for (
                    let roundNumber = 1;
                    roundNumber <= totalRounds;
                    roundNumber++
                ) {

                    const nextSlots:
                        BracketSlot[] =
                        [];


                    for (
                        let index = 0;
                        index < currentSlots.length;
                        index += 2
                    ) {

                        const left =
                            currentSlots[
                            index
                            ]
                            ??
                            null;


                        const right =
                            currentSlots[
                            index + 1
                            ]
                            ??
                            null;


                        const matchNumber =
                            Math.floor(
                                index / 2,
                            )
                            +
                            1;


                        /* ============================================
                           EMPTY SUBTREE
                        ============================================ */

                        if (
                            !left
                            &&
                            !right
                        ) {

                            nextSlots.push(
                                null,
                            );

                            continue;

                        }


                        /* ============================================
                           BYE

                           Only one side exists and that side is
                           already known, so that team advances
                           without creating a fake match.
                        ============================================ */

                        if (
                            !left
                            ||
                            !right
                        ) {

                            const existing =
                                left
                                ??
                                right;


                            if (
                                existing?.kind !==
                                'resolved'
                            ) {

                                throw new BadRequestException(
                                    'Invalid bracket state while resolving bye',
                                );

                            }


                            nextSlots.push(
                                existing,
                            );

                            continue;

                        }


                        /* ============================================
                           REAL MATCH

                           Either side can already be known, or can
                           be waiting for a previous-round winner.
                        ============================================ */

                        const teamAId =
                            left.kind ===
                                'resolved'
                                ? left.teamId
                                : null;


                        const teamBId =
                            right.kind ===
                                'resolved'
                                ? right.teamId
                                : null;


                        const created =
                            await tx
                                .match
                                .create({

                                    data: {

                                        tournamentId,

                                        roundNumber,

                                        matchNumber,


                                        label:
                                            this.getRoundLabel(
                                                roundNumber,
                                                totalRounds,
                                                matchNumber,
                                            ),


                                        teamAId,

                                        teamBId,


                                        format:
                                            tournament.matchFormat,


                                        status:
                                            MatchStatus
                                                .SCHEDULED,

                                    },

                                });


                        generatedMatches.push(
                            created,
                        );


                        /*
                         * Parent slot waits for this match winner.
                         */
                        nextSlots.push({
                            kind:
                                'pending',
                        });

                    }


                    currentSlots =
                        nextSlots;

                }


                /* ====================================================
                   SANITY CHECK
                ==================================================== */

                if (
                    currentSlots.length !==
                    1
                    ||
                    generatedMatches.length ===
                    0
                ) {

                    throw new BadRequestException(
                        'Failed to generate tournament bracket',
                    );

                }


                /* ====================================================
                   TOURNAMENT → SCHEDULED
                ==================================================== */

                await tx
                    .tournament
                    .update({

                        where: {
                            id:
                                tournamentId,
                        },


                        data: {
                            status:
                                TournamentStatus
                                    .SCHEDULED,
                        },

                    });


                return {

                    generated:
                        true,

                    tournamentId,

                    status:
                        TournamentStatus
                            .SCHEDULED,

                    bracketSize,

                    totalRounds,

                    matches:
                        generatedMatches,

                };

            },


            {
                isolationLevel:
                    Prisma
                        .TransactionIsolationLevel
                        .Serializable,
            },

        );

    }


    /* ============================================================
       ADMIN: RECORD ONE GAME RESULT
    ============================================================ */

    async recordGameResult(
        tournamentId: number,
        matchId: number,
        dto: RecordGameResultDto,
    ) {

        return this.prisma.$transaction(

            async (tx) => {

                /* ====================================================
                   MATCH
                ==================================================== */

                const match =
                    await tx
                        .match
                        .findFirst({

                            where: {

                                id:
                                    matchId,

                                tournamentId,

                            },


                            include: {

                                tournament:
                                    true,

                                games: {

                                    orderBy: {
                                        gameNumber:
                                            'asc',
                                    },

                                },

                            },

                        });


                if (!match) {

                    throw new NotFoundException(
                        'Match not found',
                    );

                }


                /* ====================================================
                   MATCH STATE
                ==================================================== */

                if (
                    match.status ===
                    MatchStatus
                        .COMPLETED
                ) {

                    throw new ConflictException(
                        'Match has already been completed',
                    );

                }


                if (
                    match.tournament.status !==
                    TournamentStatus
                        .SCHEDULED
                    &&
                    match.tournament.status !==
                    TournamentStatus
                        .LIVE
                ) {

                    throw new BadRequestException(
                        'Tournament is not in a playable stage',
                    );

                }


                /* ====================================================
                   BOTH TEAMS MUST BE KNOWN

                   Later-round matches may exist before previous-round
                   winners have filled both slots.
                ==================================================== */

                if (
                    !match.teamAId
                    ||
                    !match.teamBId
                ) {

                    throw new BadRequestException(
                        'Both match teams must be determined before recording a game',
                    );

                }


                /* ====================================================
                   WINNER MUST BE TEAM A OR TEAM B
                ==================================================== */

                if (
                    dto.winnerTeamId !==
                    match.teamAId
                    &&
                    dto.winnerTeamId !==
                    match.teamBId
                ) {

                    throw new BadRequestException(
                        'winnerTeamId must be one of the teams in this match',
                    );

                }


                const loserTeamId =
                    dto.winnerTeamId ===
                        match.teamAId
                        ? match.teamBId
                        : match.teamAId;


                /* ====================================================
                   GAME COUNT
                ==================================================== */

                const maxGames =
                    this.getMaxGames(
                        match.format,
                    );


                if (
                    match.games.length >=
                    maxGames
                ) {

                    throw new ConflictException(
                        `This ${match.format} series cannot have more than ${maxGames} games`,
                    );

                }


                const gameNumber =
                    match.games.length
                    +
                    1;


                /* ====================================================
                   MVP / SVP VALIDATION
                ==================================================== */

                const assertParticipantTeam =
                    async (
                        participantId:
                            number,

                        expectedTeamId:
                            number,

                        fieldName:
                            string,
                    ) => {

                        const participant =
                            await tx
                                .tournamentParticipant
                                .findFirst({

                                    where: {

                                        id:
                                            participantId,

                                        tournamentId,

                                    },


                                    include: {
                                        teamMembership:
                                            true,
                                    },

                                });


                        if (!participant) {

                            throw new BadRequestException(
                                `${fieldName} participant not found in tournament`,
                            );

                        }


                        if (
                            !participant
                                .teamMembership
                            ||
                            participant
                                .teamMembership
                                .teamId !==
                            expectedTeamId
                        ) {

                            throw new BadRequestException(
                                `${fieldName} must belong to the expected team`,
                            );

                        }

                    };


                /*
                 * MVP should be from winning team.
                 */
                if (
                    dto.mvpParticipantId
                ) {

                    await assertParticipantTeam(
                        dto.mvpParticipantId,
                        dto.winnerTeamId,
                        'MVP',
                    );

                }


                /*
                 * SVP should be from losing team.
                 */
                if (
                    dto.svpParticipantId
                ) {

                    await assertParticipantTeam(
                        dto.svpParticipantId,
                        loserTeamId,
                        'SVP',
                    );

                }


                /* ====================================================
                   CREATE GAME
                ==================================================== */

                const game =
                    await tx
                        .game
                        .create({

                            data: {

                                matchId:
                                    match.id,

                                gameNumber,

                                winnerTeamId:
                                    dto.winnerTeamId,


                                mvpParticipantId:
                                    dto.mvpParticipantId
                                    ??
                                    null,


                                svpParticipantId:
                                    dto.svpParticipantId
                                    ??
                                    null,


                                resultImageUrl:
                                    dto.resultImageUrl
                                        ?.trim()
                                    ||
                                    null,


                                completedAt:
                                    new Date(),

                            },


                            include: {

                                winnerTeam:
                                    true,


                                mvpParticipant: {

                                    include: {
                                        player:
                                            true,
                                    },

                                },


                                svpParticipant: {

                                    include: {
                                        player:
                                            true,
                                    },

                                },

                            },

                        });


                /* ====================================================
                   SERIES SCORE
                ==================================================== */

                const teamAWins =
                    match.games.filter(
                        (
                            existingGame,
                        ) =>
                            existingGame
                                .winnerTeamId ===
                            match.teamAId,
                    ).length
                    +
                    (
                        dto.winnerTeamId ===
                            match.teamAId
                            ? 1
                            : 0
                    );


                const teamBWins =
                    match.games.filter(
                        (
                            existingGame,
                        ) =>
                            existingGame
                                .winnerTeamId ===
                            match.teamBId,
                    ).length
                    +
                    (
                        dto.winnerTeamId ===
                            match.teamBId
                            ? 1
                            : 0
                    );


                const winsRequired =
                    this.getWinsRequired(
                        match.format,
                    );


                const matchCompleted =
                    teamAWins >=
                    winsRequired
                    ||
                    teamBWins >=
                    winsRequired;


                const matchWinnerTeamId =
                    matchCompleted
                        ? (
                            teamAWins >
                                teamBWins
                                ? match.teamAId
                                : match.teamBId
                        )
                        : null;


                /* ====================================================
                   UPDATE MATCH
                ==================================================== */

                await tx
                    .match
                    .update({

                        where: {
                            id:
                                match.id,
                        },


                        data: {

                            teamAScore:
                                teamAWins,

                            teamBScore:
                                teamBWins,


                            status:
                                matchCompleted
                                    ? MatchStatus
                                        .COMPLETED
                                    : MatchStatus
                                        .LIVE,


                            startedAt:
                                match.startedAt
                                ??
                                new Date(),


                            completedAt:
                                matchCompleted
                                    ? new Date()
                                    : null,


                            winnerTeamId:
                                matchWinnerTeamId,

                        },

                    });


                /* ====================================================
                   FIRST GAME → TOURNAMENT LIVE
                ==================================================== */

                if (
                    match.tournament.status ===
                    TournamentStatus
                        .SCHEDULED
                ) {

                    await tx
                        .tournament
                        .update({

                            where: {
                                id:
                                    tournamentId,
                            },


                            data: {
                                status:
                                    TournamentStatus
                                        .LIVE,
                            },

                        });

                }


                /* ====================================================
                   FIND FINAL ROUND
                ==================================================== */

                const roundAggregate =
                    await tx
                        .match
                        .aggregate({

                            where: {
                                tournamentId,
                            },


                            _max: {
                                roundNumber:
                                    true,
                            },

                        });


                const finalRound =
                    roundAggregate
                        ._max
                        .roundNumber;


                if (!finalRound) {

                    throw new BadRequestException(
                        'Tournament bracket is invalid',
                    );

                }


                /* ====================================================
                   GENERIC ADVANCEMENT
                ==================================================== */

                let advancedToNextMatch:
                    | {
                        nextMatchId:
                        number;

                        roundNumber:
                        number;

                        matchNumber:
                        number;

                        slot:
                        'A'
                        |
                        'B';

                        teamId:
                        number;
                    }
                    | null =
                    null;


                /*
                 * Keep this old field for API compatibility.
                 */
                let advancedToFinal:
                    | {
                        finalMatchId:
                        number;

                        slot:
                        'A'
                        |
                        'B';

                        teamId:
                        number;
                    }
                    | null =
                    null;


                if (
                    matchCompleted
                    &&
                    matchWinnerTeamId
                    &&
                    match.roundNumber <
                    finalRound
                ) {

                    const nextRoundNumber =
                        match.roundNumber
                        +
                        1;


                    const nextMatchNumber =
                        Math.ceil(
                            match.matchNumber
                            /
                            2,
                        );


                    /*
                     * Odd source match → slot A
                     * Even source match → slot B
                     */
                    const slot:
                        'A' | 'B' =
                        match.matchNumber %
                            2 ===
                            1
                            ? 'A'
                            : 'B';


                    const nextMatch =
                        await tx
                            .match
                            .findFirst({

                                where: {

                                    tournamentId,

                                    roundNumber:
                                        nextRoundNumber,

                                    matchNumber:
                                        nextMatchNumber,

                                },

                            });


                    if (!nextMatch) {

                        throw new NotFoundException(
                            `Next bracket match not found: round ${nextRoundNumber}, match ${nextMatchNumber}`,
                        );

                    }


                    const existingSlotTeamId =
                        slot ===
                            'A'
                            ? nextMatch.teamAId
                            : nextMatch.teamBId;


                    /*
                     * Avoid silently overwriting an already-resolved slot.
                     */
                    if (
                        existingSlotTeamId
                        &&
                        existingSlotTeamId !==
                        matchWinnerTeamId
                    ) {

                        throw new ConflictException(
                            'Next bracket slot is already occupied by another team',
                        );

                    }


                    if (
                        !existingSlotTeamId
                    ) {

                        await tx
                            .match
                            .update({

                                where: {
                                    id:
                                        nextMatch.id,
                                },


                                data:
                                    slot ===
                                        'A'
                                        ? {
                                            teamAId:
                                                matchWinnerTeamId,
                                        }
                                        : {
                                            teamBId:
                                                matchWinnerTeamId,
                                        },

                            });

                    }


                    advancedToNextMatch = {

                        nextMatchId:
                            nextMatch.id,

                        roundNumber:
                            nextRoundNumber,

                        matchNumber:
                            nextMatchNumber,

                        slot,

                        teamId:
                            matchWinnerTeamId,

                    };


                    if (
                        nextRoundNumber ===
                        finalRound
                    ) {

                        advancedToFinal = {

                            finalMatchId:
                                nextMatch.id,

                            slot,

                            teamId:
                                matchWinnerTeamId,

                        };

                    }

                }


                /* ====================================================
                   FINAL COMPLETED → TOURNAMENT COMPLETED
                ==================================================== */

                let tournamentCompleted =
                    false;


                if (
                    matchCompleted
                    &&
                    matchWinnerTeamId
                    &&
                    match.roundNumber ===
                    finalRound
                ) {

                    /* ================================================
                       PREVENT DUPLICATE RESULTS
                    ================================================ */

                    const existingResults =
                        await tx
                            .tournamentResult
                            .count({

                                where: {
                                    tournamentId,
                                },

                            });


                    if (
                        existingResults >
                        0
                    ) {

                        throw new ConflictException(
                            'Tournament results already exist',
                        );

                    }


                    /* ================================================
                       READ ALL COMPLETED MATCHES

                       Every losing team appears exactly once in a
                       single-elimination tournament.
                    ================================================ */

                    const completedMatches =
                        await tx
                            .match
                            .findMany({

                                where: {

                                    tournamentId,

                                    status:
                                        MatchStatus
                                            .COMPLETED,

                                },


                                orderBy: [

                                    {
                                        roundNumber:
                                            'asc',
                                    },

                                    {
                                        matchNumber:
                                            'asc',
                                    },

                                ],

                            });


                    const loserPlacements =
                        new Map<
                            number,
                            number
                        >();


                    for (
                        const completedMatch
                        of completedMatches
                    ) {

                        if (
                            !completedMatch
                                .teamAId
                            ||
                            !completedMatch
                                .teamBId
                            ||
                            !completedMatch
                                .winnerTeamId
                        ) {

                            throw new BadRequestException(
                                'Completed bracket contains an invalid match result',
                            );

                        }


                        const loserTeamId =
                            completedMatch
                                .winnerTeamId ===
                                completedMatch
                                    .teamAId
                                ? completedMatch
                                    .teamBId
                                : completedMatch
                                    .teamAId;


                        /*
                         * Standard single-elimination placements:
                         *
                         * Final loser      → 2
                         * Semifinal loser  → 3
                         * Quarterfinal     → 5
                         * Round of 16      → 9
                         *
                         * Formula:
                         *
                         * 2^(finalRound - eliminatedRound) + 1
                         */
                        const placement =
                            Math.pow(
                                2,
                                finalRound
                                -
                                completedMatch
                                    .roundNumber,
                            )
                            +
                            1;


                        loserPlacements.set(
                            loserTeamId,
                            placement,
                        );

                    }


                    /* ================================================
                       MUST ACCOUNT FOR EVERY TEAM

                       Champion + every eliminated team.
                    ================================================ */

                    if (
                        loserPlacements.size
                        +
                        1
                        !==
                        match.tournament.teamCount
                    ) {

                        throw new BadRequestException(
                            'Bracket is incomplete: not every team has a final placement',
                        );

                    }


                    /* ================================================
                       CREATE RESULTS
                    ================================================ */

                    const resultData = [

                        {
                            tournamentId,

                            teamId:
                                matchWinnerTeamId,

                            placement:
                                1,

                            isChampion:
                                true,
                        },


                        ...Array.from(
                            loserPlacements.entries(),
                        ).map(
                            (
                                [
                                    teamId,
                                    placement,
                                ],
                            ) => ({

                                tournamentId,

                                teamId,

                                placement,

                                isChampion:
                                    false,

                            }),
                        ),

                    ];


                    await tx
                        .tournamentResult
                        .createMany({

                            data:
                                resultData,

                        });


                    /* ================================================
                       TOURNAMENT → COMPLETED
                    ================================================ */

                    await tx
                        .tournament
                        .update({

                            where: {
                                id:
                                    tournamentId,
                            },


                            data: {
                                status:
                                    TournamentStatus
                                        .COMPLETED,
                            },

                        });


                    tournamentCompleted =
                        true;

                }


                /* ====================================================
                   RETURN UPDATED MATCH
                ==================================================== */

                const updatedMatch =
                    await tx
                        .match
                        .findUnique({

                            where: {
                                id:
                                    match.id,
                            },


                            include: {

                                teamA:
                                    true,

                                teamB:
                                    true,

                                winnerTeam:
                                    true,


                                games: {

                                    orderBy: {
                                        gameNumber:
                                            'asc',
                                    },


                                    include: {

                                        winnerTeam:
                                            true,


                                        mvpParticipant: {

                                            include: {
                                                player:
                                                    true,
                                            },

                                        },


                                        svpParticipant: {

                                            include: {
                                                player:
                                                    true,
                                            },

                                        },

                                    },

                                },

                            },

                        });


                return {

                    game,

                    match:
                        updatedMatch,

                    matchCompleted,

                    advancedToNextMatch,

                    /*
                     * Retained for compatibility with old frontend /
                     * tests that may still inspect this field.
                     */
                    advancedToFinal,

                    tournamentCompleted,

                };

            },


            {
                isolationLevel:
                    Prisma
                        .TransactionIsolationLevel
                        .Serializable,
            },

        );

    }


    /* ============================================================
       HELPER: WINS REQUIRED
    ============================================================ */

    private getWinsRequired(
        format: MatchFormat,
    ) {

        switch (
        format
        ) {

            case MatchFormat.BO1:
                return 1;


            case MatchFormat.BO3:
                return 2;


            case MatchFormat.BO5:
                return 3;


            default:

                throw new BadRequestException(
                    `Unsupported match format: ${format}`,
                );

        }

    }


    /* ============================================================
       HELPER: MAX GAMES
    ============================================================ */

    private getMaxGames(
        format: MatchFormat,
    ) {

        switch (
        format
        ) {

            case MatchFormat.BO1:
                return 1;


            case MatchFormat.BO3:
                return 3;


            case MatchFormat.BO5:
                return 5;


            default:

                throw new BadRequestException(
                    `Unsupported match format: ${format}`,
                );

        }

    }


    /* ============================================================
       HELPER: NEXT POWER OF TWO

       2  -> 2
       3  -> 4
       6  -> 8
       10 -> 16
    ============================================================ */

    private nextPowerOfTwo(
        value: number,
    ) {

        if (
            value <=
            1
        ) {
            return 1;
        }


        return Math.pow(
            2,
            Math.ceil(
                Math.log2(
                    value,
                ),
            ),
        );

    }


    /* ============================================================
       HELPER: STANDARD SEED ORDER

       2:
       1,2

       4:
       1,4,2,3

       8:
       1,8,4,5,2,7,3,6

       16:
       1,16,8,9,4,13,5,12,
       2,15,7,10,3,14,6,11
    ============================================================ */

    private buildSeedOrder(
        bracketSize: number,
    ) {

        if (
            bracketSize ===
            2
        ) {

            return [
                1,
                2,
            ];

        }


        let order = [
            1,
            2,
        ];


        while (
            order.length <
            bracketSize
        ) {

            const nextSize =
                order.length
                *
                2;


            const next:
                number[] =
                [];


            for (
                const seed
                of order
            ) {

                next.push(
                    seed,
                );


                next.push(
                    nextSize
                    +
                    1
                    -
                    seed,
                );

            }


            order =
                next;

        }


        return order;

    }


    /* ============================================================
       HELPER: ROUND LABEL
    ============================================================ */

    private getRoundLabel(
        roundNumber: number,
        totalRounds: number,
        matchNumber: number,
    ) {

        const roundsFromFinal =
            totalRounds
            -
            roundNumber;


        /* ---------------------------------------------------------
           FINAL
        --------------------------------------------------------- */

        if (
            roundsFromFinal ===
            0
        ) {

            return 'Final';

        }


        /* ---------------------------------------------------------
           SEMIFINAL
        --------------------------------------------------------- */

        if (
            roundsFromFinal ===
            1
        ) {

            return `Semifinal ${matchNumber}`;

        }


        /* ---------------------------------------------------------
           QUARTERFINAL
        --------------------------------------------------------- */

        if (
            roundsFromFinal ===
            2
        ) {

            return `Quarterfinal ${matchNumber}`;

        }


        /* ---------------------------------------------------------
           EARLIER ROUNDS
        --------------------------------------------------------- */

        const teamsInRound =
            Math.pow(
                2,
                roundsFromFinal
                +
                1,
            );


        return `Round of ${teamsInRound} · Match ${matchNumber}`;

    }

}