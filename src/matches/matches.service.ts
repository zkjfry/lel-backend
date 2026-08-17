import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';

import {
    MatchFormat,
    MatchStatus,
    TournamentFormat,
    TournamentStatus,
} from '../generated/prisma/enums';

import { RecordGameResultDto } from './dto/record-game-result.dto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // ============================================================
    // PUBLIC: GET TOURNAMENT MATCHES
    // ============================================================

    async findAll(tournamentId: number) {
        const tournament =
            await this.prisma.tournament.findUnique({
                where: {
                    id: tournamentId,
                },

                select: {
                    id: true,
                    name: true,
                    status: true,
                    matchFormat: true,
                    tournamentFormat: true,
                },
            });

        if (!tournament) {
            throw new NotFoundException(
                'Tournament not found',
            );
        }

        const matches =
            await this.prisma.match.findMany({
                where: {
                    tournamentId,
                },

                orderBy: [
                    {
                        roundNumber: 'asc',
                    },
                    {
                        matchNumber: 'asc',
                    },
                ],

                include: {
                    teamA: {
                        select: {
                            id: true,
                            name: true,
                            shortName: true,
                            logoUrl: true,
                            seed: true,
                        },
                    },

                    teamB: {
                        select: {
                            id: true,
                            name: true,
                            shortName: true,
                            logoUrl: true,
                            seed: true,
                        },
                    },

                    winnerTeam: {
                        select: {
                            id: true,
                            name: true,
                            shortName: true,
                            logoUrl: true,
                        },
                    },

                    games: {
                        orderBy: {
                            gameNumber: 'asc',
                        },

                        include: {
                            winnerTeam: {
                                select: {
                                    id: true,
                                    name: true,
                                    shortName: true,
                                },
                            },

                            mvpParticipant: {
                                include: {
                                    player: {
                                        select: {
                                            id: true,
                                            displayName: true,
                                        },
                                    },
                                },
                            },

                            svpParticipant: {
                                include: {
                                    player: {
                                        select: {
                                            id: true,
                                            displayName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

        return {
            tournament,
            matches,
        };
    }

    // ============================================================
    // PUBLIC: GET ONE MATCH
    // ============================================================

    async findOne(
        tournamentId: number,
        matchId: number,
    ) {
        const match =
            await this.prisma.match.findFirst({
                where: {
                    id: matchId,
                    tournamentId,
                },

                include: {
                    tournament: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },

                    teamA: {
                        include: {
                            members: {
                                include: {
                                    participant: {
                                        include: {
                                            player: {
                                                include: {
                                                    user: {
                                                        select: {
                                                            id: true,
                                                            username: true,
                                                            avatarUrl: true,
                                                        },
                                                    },
                                                },
                                            },
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
                                            player: {
                                                include: {
                                                    user: {
                                                        select: {
                                                            id: true,
                                                            username: true,
                                                            avatarUrl: true,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },

                    winnerTeam: true,

                    games: {
                        orderBy: {
                            gameNumber: 'asc',
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

    // ============================================================
    // ADMIN: GENERATE V1 4-TEAM SINGLE-ELIMINATION BRACKET
    // ============================================================

    async generateBracket(
        tournamentId: number,
    ) {
        return this.prisma.$transaction(
            async (tx) => {
                const tournament =
                    await tx.tournament.findUnique({
                        where: {
                            id: tournamentId,
                        },
                    });

                if (!tournament) {
                    throw new NotFoundException(
                        'Tournament not found',
                    );
                }

                if (
                    tournament.status !==
                    TournamentStatus.ROSTER_LOCKED
                ) {
                    throw new BadRequestException(
                        'Tournament roster must be locked before generating matches',
                    );
                }

                if (
                    tournament.tournamentFormat !==
                    TournamentFormat.SINGLE_ELIMINATION
                ) {
                    throw new BadRequestException(
                        'V1 bracket generator only supports SINGLE_ELIMINATION',
                    );
                }

                if (
                    tournament.teamCount !== 4
                ) {
                    throw new BadRequestException(
                        'V1 bracket generator requires exactly 4 teams',
                    );
                }

                const existingMatches =
                    await tx.match.count({
                        where: {
                            tournamentId,
                        },
                    });

                if (existingMatches > 0) {
                    throw new ConflictException(
                        'Tournament matches have already been generated',
                    );
                }

                const teams =
                    await tx.tournamentTeam.findMany({
                        where: {
                            tournamentId,
                        },

                        orderBy: {
                            seed: 'asc',
                        },

                        include: {
                            members: true,
                        },
                    });

                if (teams.length !== 4) {
                    throw new BadRequestException(
                        'Exactly 4 tournament teams are required',
                    );
                }

                for (const team of teams) {
                    if (
                        team.members.length !==
                        tournament.playersPerTeam
                    ) {
                        throw new BadRequestException(
                            `Team ${team.name} does not have exactly ${tournament.playersPerTeam} players`,
                        );
                    }

                    if (team.seed === null) {
                        throw new BadRequestException(
                            `Team ${team.name} has no seed`,
                        );
                    }
                }

                const seed1 = teams[0];
                const seed2 = teams[1];
                const seed3 = teams[2];
                const seed4 = teams[3];

                if (
                    !seed1 ||
                    !seed2 ||
                    !seed3 ||
                    !seed4
                ) {
                    throw new BadRequestException(
                        'Invalid team seeding',
                    );
                }

                // --------------------------------------------------------
                // Semi Final 1: #1 vs #4
                // --------------------------------------------------------

                const semifinal1 =
                    await tx.match.create({
                        data: {
                            tournamentId,

                            roundNumber: 1,
                            matchNumber: 1,

                            label:
                                'Semifinal 1',

                            teamAId:
                                seed1.id,

                            teamBId:
                                seed4.id,

                            format:
                                tournament.matchFormat,

                            status:
                                MatchStatus.SCHEDULED,
                        },
                    });

                // --------------------------------------------------------
                // Semi Final 2: #2 vs #3
                // --------------------------------------------------------

                const semifinal2 =
                    await tx.match.create({
                        data: {
                            tournamentId,

                            roundNumber: 1,
                            matchNumber: 2,

                            label:
                                'Semifinal 2',

                            teamAId:
                                seed2.id,

                            teamBId:
                                seed3.id,

                            format:
                                tournament.matchFormat,

                            status:
                                MatchStatus.SCHEDULED,
                        },
                    });

                // --------------------------------------------------------
                // Final
                //
                // Team A / Team B 暂时为空。
                // 两场半决赛结束后自动填入 Winner。
                // --------------------------------------------------------

                const final =
                    await tx.match.create({
                        data: {
                            tournamentId,

                            roundNumber: 2,
                            matchNumber: 1,

                            label:
                                'Final',

                            teamAId: null,
                            teamBId: null,

                            format:
                                tournament.matchFormat,

                            status:
                                MatchStatus.SCHEDULED,
                        },
                    });

                await tx.tournament.update({
                    where: {
                        id: tournamentId,
                    },

                    data: {
                        status:
                            TournamentStatus.SCHEDULED,
                    },
                });

                return {
                    generated: true,

                    tournamentId,

                    status:
                        TournamentStatus.SCHEDULED,

                    matches: [
                        semifinal1,
                        semifinal2,
                        final,
                    ],
                };
            },
        );
    }

    // ============================================================
    // ADMIN: RECORD ONE GAME RESULT
    // ============================================================

    async recordGameResult(
        tournamentId: number,
        matchId: number,
        dto: RecordGameResultDto,
    ) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        const match =
                            await tx.match.findFirst({
                                where: {
                                    id: matchId,
                                    tournamentId,
                                },

                                include: {
                                    tournament: true,

                                    games: {
                                        orderBy: {
                                            gameNumber: 'asc',
                                        },
                                    },
                                },
                            });

                        if (!match) {
                            throw new NotFoundException(
                                'Match not found',
                            );
                        }

                        if (
                            match.status ===
                            MatchStatus.COMPLETED
                        ) {
                            throw new ConflictException(
                                'Match has already been completed',
                            );
                        }

                        if (
                            match.status ===
                            MatchStatus.CANCELLED
                        ) {
                            throw new BadRequestException(
                                'Cancelled match cannot receive results',
                            );
                        }

                        if (
                            !match.teamAId ||
                            !match.teamBId
                        ) {
                            throw new BadRequestException(
                                'Both teams must be determined before recording a game',
                            );
                        }

                        if (
                            dto.winnerTeamId !==
                            match.teamAId &&
                            dto.winnerTeamId !==
                            match.teamBId
                        ) {
                            throw new BadRequestException(
                                'Winner must be one of the teams in this match',
                            );
                        }

                        if (
                            dto.mvpParticipantId &&
                            dto.svpParticipantId &&
                            dto.mvpParticipantId ===
                            dto.svpParticipantId
                        ) {
                            throw new BadRequestException(
                                'MVP and SVP cannot be the same player',
                            );
                        }

                        const loserTeamId =
                            dto.winnerTeamId ===
                                match.teamAId
                                ? match.teamBId
                                : match.teamAId;

                        // ----------------------------------------------------
                        // Validate MVP / SVP
                        // ----------------------------------------------------

                        const awardParticipantIds = [
                            dto.mvpParticipantId,
                            dto.svpParticipantId,
                        ].filter(
                            (id): id is number =>
                                id !== undefined,
                        );

                        if (
                            awardParticipantIds.length > 0
                        ) {
                            const memberships =
                                await tx.teamMember.findMany({
                                    where: {
                                        participantId: {
                                            in: awardParticipantIds,
                                        },
                                    },
                                });

                            if (
                                memberships.length !==
                                awardParticipantIds.length
                            ) {
                                throw new BadRequestException(
                                    'Invalid MVP or SVP participant',
                                );
                            }

                            if (dto.mvpParticipantId) {
                                const mvpMembership =
                                    memberships.find(
                                        (membership) =>
                                            membership.participantId ===
                                            dto.mvpParticipantId,
                                    );

                                if (
                                    !mvpMembership ||
                                    mvpMembership.teamId !==
                                    dto.winnerTeamId
                                ) {
                                    throw new BadRequestException(
                                        'MVP must belong to the winning team',
                                    );
                                }
                            }

                            if (dto.svpParticipantId) {
                                const svpMembership =
                                    memberships.find(
                                        (membership) =>
                                            membership.participantId ===
                                            dto.svpParticipantId,
                                    );

                                if (
                                    !svpMembership ||
                                    svpMembership.teamId !==
                                    loserTeamId
                                ) {
                                    throw new BadRequestException(
                                        'SVP must belong to the losing team',
                                    );
                                }
                            }
                        }

                        const gameNumber =
                            match.games.length + 1;

                        const maxGames =
                            this.getMaxGames(
                                match.format,
                            );

                        if (
                            gameNumber > maxGames
                        ) {
                            throw new ConflictException(
                                'Maximum number of games has already been reached',
                            );
                        }

                        const game =
                            await tx.game.create({
                                data: {
                                    matchId:
                                        match.id,

                                    gameNumber,

                                    winnerTeamId:
                                        dto.winnerTeamId,

                                    mvpParticipantId:
                                        dto.mvpParticipantId,

                                    svpParticipantId:
                                        dto.svpParticipantId,

                                    resultImageUrl:
                                        dto.resultImageUrl?.trim(),

                                    startedAt:
                                        new Date(),

                                    completedAt:
                                        new Date(),
                                },
                            });

                        // ----------------------------------------------------
                        // Calculate score from Game records
                        // ----------------------------------------------------

                        const teamAWins =
                            match.games.filter(
                                (existingGame) =>
                                    existingGame.winnerTeamId ===
                                    match.teamAId,
                            ).length +
                            (
                                dto.winnerTeamId ===
                                    match.teamAId
                                    ? 1
                                    : 0
                            );

                        const teamBWins =
                            match.games.filter(
                                (existingGame) =>
                                    existingGame.winnerTeamId ===
                                    match.teamBId,
                            ).length +
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
                            winsRequired ||
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

                        await tx.match.update({
                            where: {
                                id: match.id,
                            },

                            data: {
                                teamAScore:
                                    teamAWins,

                                teamBScore:
                                    teamBWins,

                                status:
                                    matchCompleted
                                        ? MatchStatus.COMPLETED
                                        : MatchStatus.LIVE,

                                startedAt:
                                    match.startedAt ??
                                    new Date(),

                                completedAt:
                                    matchCompleted
                                        ? new Date()
                                        : null,

                                winnerTeamId:
                                    matchWinnerTeamId,
                            },
                        });

                        // 整个赛事第一局开始后，赛事进入 LIVE
                        if (
                            match.tournament.status ===
                            TournamentStatus.SCHEDULED
                        ) {
                            await tx.tournament.update({
                                where: {
                                    id: tournamentId,
                                },

                                data: {
                                    status:
                                        TournamentStatus.LIVE,
                                },
                            });
                        }

                        let advancedToFinal:
                            | {
                                finalMatchId: number;
                                slot: 'A' | 'B';
                                teamId: number;
                            }
                            | null = null;

                        // ====================================================
                        // SEMIFINAL COMPLETE → ADVANCE WINNER TO FINAL
                        // ====================================================

                        if (
                            matchCompleted &&
                            match.roundNumber === 1 &&
                            matchWinnerTeamId
                        ) {
                            const finalMatch =
                                await tx.match.findFirst({
                                    where: {
                                        tournamentId,
                                        roundNumber: 2,
                                        matchNumber: 1,
                                    },
                                });

                            if (!finalMatch) {
                                throw new NotFoundException(
                                    'Final match not found',
                                );
                            }

                            if (
                                match.matchNumber === 1
                            ) {
                                await tx.match.update({
                                    where: {
                                        id: finalMatch.id,
                                    },

                                    data: {
                                        teamAId:
                                            matchWinnerTeamId,
                                    },
                                });

                                advancedToFinal = {
                                    finalMatchId:
                                        finalMatch.id,

                                    slot: 'A',

                                    teamId:
                                        matchWinnerTeamId,
                                };
                            } else if (
                                match.matchNumber === 2
                            ) {
                                await tx.match.update({
                                    where: {
                                        id: finalMatch.id,
                                    },

                                    data: {
                                        teamBId:
                                            matchWinnerTeamId,
                                    },
                                });

                                advancedToFinal = {
                                    finalMatchId:
                                        finalMatch.id,

                                    slot: 'B',

                                    teamId:
                                        matchWinnerTeamId,
                                };
                            }
                        }

                        let tournamentCompleted =
                            false;

                        // ====================================================
                        // FINAL COMPLETE → COMPLETE TOURNAMENT
                        // ====================================================

                        if (
                            matchCompleted &&
                            match.roundNumber === 2 &&
                            matchWinnerTeamId
                        ) {
                            const runnerUpTeamId =
                                matchWinnerTeamId ===
                                    match.teamAId
                                    ? match.teamBId
                                    : match.teamAId;

                            const semifinals =
                                await tx.match.findMany({
                                    where: {
                                        tournamentId,

                                        roundNumber: 1,

                                        status:
                                            MatchStatus.COMPLETED,
                                    },

                                    orderBy: {
                                        matchNumber: 'asc',
                                    },
                                });

                            if (
                                semifinals.length !== 2
                            ) {
                                throw new BadRequestException(
                                    'Both semifinals must be completed before the tournament can finish',
                                );
                            }

                            const thirdPlaceTeamIds =
                                semifinals.map(
                                    (semifinal) => {
                                        if (
                                            !semifinal
                                                .winnerTeamId ||
                                            !semifinal
                                                .teamAId ||
                                            !semifinal
                                                .teamBId
                                        ) {
                                            throw new BadRequestException(
                                                'Invalid semifinal result',
                                            );
                                        }

                                        return semifinal
                                            .winnerTeamId ===
                                            semifinal.teamAId
                                            ? semifinal.teamBId
                                            : semifinal.teamAId;
                                    },
                                );

                            const existingResults =
                                await tx.tournamentResult.count({
                                    where: {
                                        tournamentId,
                                    },
                                });

                            if (
                                existingResults > 0
                            ) {
                                throw new ConflictException(
                                    'Tournament results already exist',
                                );
                            }

                            await tx.tournamentResult.createMany({
                                data: [
                                    {
                                        tournamentId,
                                        teamId:
                                            matchWinnerTeamId,

                                        placement: 1,
                                        isChampion: true,
                                    },

                                    {
                                        tournamentId,
                                        teamId:
                                            runnerUpTeamId,

                                        placement: 2,
                                        isChampion: false,
                                    },

                                    ...thirdPlaceTeamIds.map(
                                        (teamId) => ({
                                            tournamentId,
                                            teamId,

                                            placement: 3,
                                            isChampion: false,
                                        }),
                                    ),
                                ],
                            });

                            await tx.tournament.update({
                                where: {
                                    id: tournamentId,
                                },

                                data: {
                                    status:
                                        TournamentStatus.COMPLETED,
                                },
                            });

                            tournamentCompleted =
                                true;
                        }

                        const updatedMatch =
                            await tx.match.findUnique({
                                where: {
                                    id: match.id,
                                },

                                include: {
                                    teamA: true,
                                    teamB: true,
                                    winnerTeam: true,

                                    games: {
                                        orderBy: {
                                            gameNumber:
                                                'asc',
                                        },

                                        include: {
                                            winnerTeam: true,

                                            mvpParticipant: {
                                                include: {
                                                    player: true,
                                                },
                                            },

                                            svpParticipant: {
                                                include: {
                                                    player: true,
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

                            advancedToFinal,

                            tournamentCompleted,
                        };
                    },

                    {
                        isolationLevel:
                            Prisma
                                .TransactionIsolationLevel
                                .Serializable,

                        timeout: 10000,
                    },
                );
            } catch (error) {
                if (
                    this.isTransactionConflict(
                        error,
                    ) &&
                    attempt < 3
                ) {
                    continue;
                }

                if (
                    this.isUniqueConflict(
                        error,
                    )
                ) {
                    throw new ConflictException(
                        'This game result has already been submitted',
                    );
                }

                throw error;
            }
        }
    }
    private getWinsRequired(
            format: MatchFormat,
        ) {
        switch (format) {
            case MatchFormat.BO1:
                return 1;

            case MatchFormat.BO3:
                return 2;

            case MatchFormat.BO5:
                return 3;

            default:
                throw new BadRequestException(
                    'Unsupported match format',
                );
        }
    }

    private getMaxGames(
        format: MatchFormat,
    ) {
        switch (format) {
            case MatchFormat.BO1:
                return 1;

            case MatchFormat.BO3:
                return 3;

            case MatchFormat.BO5:
                return 5;

            default:
                throw new BadRequestException(
                    'Unsupported match format',
                );
        }
    }

    private isTransactionConflict(
        error: unknown,
    ) {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string })
                .code === 'P2034'
        );
    }

    private isUniqueConflict(
        error: unknown,
    ) {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string })
                .code === 'P2002'
        );
    }
}