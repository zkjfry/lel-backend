import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';

import {
    MatchStatus,
    PlayerRole,
    PointEventType,
    TournamentStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

interface PlayerAdjustment {
    playerId: number;

    tournamentsPlayed: number;
    seriesPlayed: number;
    gamesPlayed: number;

    wins: number;
    losses: number;

    championships: number;

    mvpCount: number;
    svpCount: number;

    role: PlayerRole | null;

    roleGamesPlayed: number;
    roleWins: number;
    roleLosses: number;
    roleRatingDelta: number;

    events: {
        type: PointEventType;
        gameId?: number;
        amount: number;
        reason: string;
    }[];
}

@Injectable()
export class SettlementService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async settleTournament(
        tournamentId: number,
    ) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        // ==================================================
                        // 1. Tournament validation
                        // ==================================================

                        const tournament =
                            await tx.tournament.findUnique({
                                where: {
                                    id: tournamentId,
                                },

                                include: {
                                    registrations: {
                                        select: {
                                            playerId: true,
                                            primaryRole: true,
                                        },
                                    },
                                    participants: {
                                        where: {
                                            status: 'ACTIVE',
                                        },

                                        include: {
                                            player: true,

                                            teamMembership: {
                                                include: {
                                                    team: true,
                                                },
                                            },
                                        },
                                    },

                                    matches: {
                                        orderBy: [
                                            {
                                                roundNumber: 'asc',
                                            },
                                            {
                                                matchNumber: 'asc',
                                            },
                                        ],

                                        include: {
                                            games: {
                                                orderBy: {
                                                    gameNumber: 'asc',
                                                },
                                            },
                                        },
                                    },

                                    results: true,
                                },
                            });

                        if (!tournament) {
                            throw new NotFoundException(
                                'Tournament not found',
                            );
                        }

                        if (
                            tournament.status !==
                            TournamentStatus.COMPLETED
                        ) {
                            throw new BadRequestException(
                                'Tournament must be COMPLETED before settlement',
                            );
                        }

                        if (tournament.settledAt) {
                            throw new ConflictException(
                                'Tournament has already been settled',
                            );
                        }

                        if (tournament.results.length !== 4) {
                            throw new BadRequestException(
                                'Tournament results are incomplete',
                            );
                        }

                        if (
                            tournament.matches.some(
                                (match) =>
                                    match.status !== MatchStatus.COMPLETED,
                            )
                        ) {
                            throw new BadRequestException(
                                'All matches must be completed before settlement',
                            );
                        }

                        // ==================================================
                        // 2. Load scoring rules
                        // ==================================================

                        const scoringRules =
                            await tx.scoringRule.findMany({
                                where: {
                                    enabled: true,
                                },
                            });

                        const ruleMap = new Map<
                            PointEventType,
                            number
                        >();

                        for (const rule of scoringRules) {
                            ruleMap.set(
                                rule.type,
                                rule.points,
                            );
                        }

                        const getPoints = (
                            type: PointEventType,
                        ) => {
                            return (
                                ruleMap.get(type) ?? 0
                            );
                        };

                        const playerRoleMap =
                            new Map<number, PlayerRole>();

                        for (
                            const registration of
                            tournament.registrations
                        ) {
                            if (registration.primaryRole) {
                                playerRoleMap.set(
                                    registration.playerId,
                                    registration.primaryRole,
                                );
                            }
                        }

                        // ==================================================
                        // 3. Prepare every participant
                        // ==================================================

                        const adjustments =
                            new Map<
                                number,
                                PlayerAdjustment
                            >();

                        for (
                            const participant of
                            tournament.participants
                        ) {
                            adjustments.set(
                                participant.playerId,
                                {
                                    playerId:
                                        participant.playerId,

                                    tournamentsPlayed: 1,

                                    seriesPlayed: 0,
                                    gamesPlayed: 0,

                                    wins: 0,
                                    losses: 0,

                                    championships: 0,

                                    mvpCount: 0,
                                    svpCount: 0,

                                    role:
                                        playerRoleMap.get(
                                            participant.playerId,
                                        ) ?? null,

                                    roleGamesPlayed: 0,
                                    roleWins: 0,
                                    roleLosses: 0,

                                    roleRatingDelta: 0,

                                    events: [],
                                },
                            );
                        }

                        // participant id → player id
                        const participantPlayerMap =
                            new Map<number, number>();

                        for (
                            const participant of
                            tournament.participants
                        ) {
                            participantPlayerMap.set(
                                participant.id,
                                participant.playerId,
                            );
                        }

                        // team id → player ids
                        const teamPlayers =
                            new Map<
                                number,
                                number[]
                            >();

                        for (
                            const participant of
                            tournament.participants
                        ) {
                            const teamId =
                                participant
                                    .teamMembership
                                    ?.teamId;

                            if (!teamId) {
                                throw new BadRequestException(
                                    `Participant ${participant.id} has no team`,
                                );
                            }

                            const current =
                                teamPlayers.get(
                                    teamId,
                                ) ?? [];

                            current.push(
                                participant.playerId,
                            );

                            teamPlayers.set(
                                teamId,
                                current,
                            );
                        }

                        // ==================================================
                        // 4. Series + Games
                        // ==================================================

                        for (
                            const match of
                            tournament.matches
                        ) {
                            if (
                                !match.teamAId ||
                                !match.teamBId ||
                                !match.winnerTeamId
                            ) {
                                throw new BadRequestException(
                                    `Match ${match.id} has incomplete result data`,
                                );
                            }

                            const teamAPlayers =
                                teamPlayers.get(
                                    match.teamAId,
                                ) ?? [];

                            const teamBPlayers =
                                teamPlayers.get(
                                    match.teamBId,
                                ) ?? [];

                            for (
                                const playerId of [
                                    ...teamAPlayers,
                                    ...teamBPlayers,
                                ]
                            ) {
                                const adjustment =
                                    adjustments.get(
                                        playerId,
                                    );

                                if (adjustment) {
                                    adjustment.seriesPlayed++;
                                }
                            }

                            for (
                                const game of
                                match.games
                            ) {
                                if (!game.winnerTeamId) {
                                    throw new BadRequestException(
                                        `Game ${game.id} has no winner`,
                                    );
                                }

                                const loserTeamId =
                                    game.winnerTeamId ===
                                        match.teamAId
                                        ? match.teamBId
                                        : match.teamAId;

                                const winnerPlayers =
                                    teamPlayers.get(
                                        game.winnerTeamId,
                                    ) ?? [];

                                const loserPlayers =
                                    teamPlayers.get(
                                        loserTeamId,
                                    ) ?? [];

                                // ------------------------------
                                // Winners
                                // ------------------------------

                                for (
                                    const playerId of
                                    winnerPlayers
                                ) {
                                    const adjustment =
                                        adjustments.get(
                                            playerId,
                                        );

                                    if (!adjustment) {
                                        continue;
                                    }

                                    adjustment.gamesPlayed++;
                                    adjustment.wins++;

                                    adjustment.roleGamesPlayed++;
                                    adjustment.roleWins++;

                                    adjustment.roleRatingDelta += 20;

                                    adjustment.events.push({
                                        type:
                                            PointEventType.GAME_WIN,

                                        gameId:
                                            game.id,

                                        amount:
                                            getPoints(
                                                PointEventType.GAME_WIN,
                                            ),

                                        reason:
                                            `Game ${game.id} win`,
                                    });
                                }

                                // ------------------------------
                                // Losers
                                // ------------------------------

                                for (
                                    const playerId of
                                    loserPlayers
                                ) {
                                    const adjustment =
                                        adjustments.get(
                                            playerId,
                                        );

                                    if (!adjustment) {
                                        continue;
                                    }

                                    adjustment.gamesPlayed++;
                                    adjustment.losses++;

                                    adjustment.roleGamesPlayed++;
                                    adjustment.roleLosses++;

                                    adjustment.roleRatingDelta -= 10;

                                    adjustment.events.push({
                                        type:
                                            PointEventType.GAME_LOSS,

                                        gameId:
                                            game.id,

                                        amount:
                                            getPoints(
                                                PointEventType.GAME_LOSS,
                                            ),

                                        reason:
                                            `Game ${game.id} loss`,
                                    });
                                }

                                // ------------------------------
                                // MVP
                                // ------------------------------

                                if (
                                    game.mvpParticipantId
                                ) {
                                    const playerId =
                                        participantPlayerMap.get(
                                            game.mvpParticipantId,
                                        );

                                    if (playerId) {
                                        const adjustment =
                                            adjustments.get(
                                                playerId,
                                            );

                                        if (adjustment) {
                                            adjustment.mvpCount++;

                                            adjustment.roleRatingDelta += 10;

                                            adjustment.events.push({
                                                type:
                                                    PointEventType.MVP,

                                                gameId:
                                                    game.id,

                                                amount:
                                                    getPoints(
                                                        PointEventType.MVP,
                                                    ),

                                                reason:
                                                    `Game ${game.id} MVP`,
                                            });
                                        }
                                    }
                                }

                                // ------------------------------
                                // SVP
                                // ------------------------------

                                if (
                                    game.svpParticipantId
                                ) {
                                    const playerId =
                                        participantPlayerMap.get(
                                            game.svpParticipantId,
                                        );

                                    if (playerId) {
                                        const adjustment =
                                            adjustments.get(
                                                playerId,
                                            );

                                        if (adjustment) {
                                            adjustment.svpCount++;

                                            adjustment.roleRatingDelta += 5;

                                            adjustment.events.push({
                                                type:
                                                    PointEventType.SVP,

                                                gameId:
                                                    game.id,

                                                amount:
                                                    getPoints(
                                                        PointEventType.SVP,
                                                    ),

                                                reason:
                                                    `Game ${game.id} SVP`,
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        // ==================================================
                        // 5. Tournament placement bonuses
                        // ==================================================

                        for (
                            const result of
                            tournament.results
                        ) {
                            const players =
                                teamPlayers.get(
                                    result.teamId,
                                ) ?? [];

                            let eventType:
                                | PointEventType
                                | null = null;

                            if (result.placement === 1) {
                                eventType =
                                    PointEventType.CHAMPION;
                            } else if (
                                result.placement === 2
                            ) {
                                eventType =
                                    PointEventType.RUNNER_UP;
                            } else if (
                                result.placement === 3
                            ) {
                                eventType =
                                    PointEventType.THIRD_PLACE;
                            }

                            if (!eventType) {
                                continue;
                            }

                            for (
                                const playerId of players
                            ) {
                                const adjustment =
                                    adjustments.get(
                                        playerId,
                                    );

                                if (!adjustment) {
                                    continue;
                                }

                                if (
                                    eventType ===
                                    PointEventType.CHAMPION
                                ) {
                                    adjustment.championships++;
                                }

                                adjustment.events.push({
                                    type:
                                        eventType,

                                    amount:
                                        getPoints(
                                            eventType,
                                        ),

                                    reason:
                                        `Tournament ${tournamentId} placement ${result.placement}`,
                                });
                            }
                        }

                        // ==================================================
                        // 6. Apply player stats + point ledger
                        // ==================================================

                        for (
                            const adjustment of
                            adjustments.values()
                        ) {
                            let stats =
                                await tx.playerStats.findUnique({
                                    where: {
                                        playerId:
                                            adjustment.playerId,
                                    },
                                });

                            if (!stats) {
                                stats =
                                    await tx.playerStats.create({
                                        data: {
                                            playerId:
                                                adjustment.playerId,
                                        },
                                    });
                            }

                            let balance =
                                stats.points;

                            for (
                                const event of
                                adjustment.events
                            ) {
                                balance +=
                                    event.amount;

                                await tx.pointTransaction.create({
                                    data: {
                                        playerId:
                                            adjustment.playerId,

                                        tournamentId,

                                        gameId:
                                            event.gameId,

                                        type:
                                            event.type,

                                        amount:
                                            event.amount,

                                        balanceAfter:
                                            balance,

                                        reason:
                                            event.reason,
                                    },
                                });
                            }

                            await tx.playerStats.update({
                                where: {
                                    playerId:
                                        adjustment.playerId,
                                },

                                data: {
                                    points:
                                        balance,

                                    tournamentsPlayed: {
                                        increment:
                                            adjustment
                                                .tournamentsPlayed,
                                    },

                                    seriesPlayed: {
                                        increment:
                                            adjustment
                                                .seriesPlayed,
                                    },

                                    gamesPlayed: {
                                        increment:
                                            adjustment
                                                .gamesPlayed,
                                    },

                                    wins: {
                                        increment:
                                            adjustment.wins,
                                    },

                                    losses: {
                                        increment:
                                            adjustment.losses,
                                    },

                                    championships: {
                                        increment:
                                            adjustment
                                                .championships,
                                    },

                                    mvpCount: {
                                        increment:
                                            adjustment.mvpCount,
                                    },

                                    svpCount: {
                                        increment:
                                            adjustment.svpCount,
                                    },
                                },
                            });

                            if (adjustment.role) {
                                const roleRating =
                                    await tx.playerRoleRating.findUnique({
                                        where: {
                                            playerId_role: {
                                                playerId:
                                                    adjustment.playerId,

                                                role:
                                                    adjustment.role,
                                            },
                                        },
                                    });

                                if (!roleRating) {
                                    throw new BadRequestException(
                                        `Role rating not found for player ${adjustment.playerId} / ${adjustment.role}`,
                                    );
                                }

                                const newRating =
                                    Math.max(
                                        0,
                                        roleRating.rating +
                                        adjustment.roleRatingDelta,
                                    );

                                await tx.playerRoleRating.update({
                                    where: {
                                        playerId_role: {
                                            playerId:
                                                adjustment.playerId,

                                            role:
                                                adjustment.role,
                                        },
                                    },

                                    data: {
                                        rating:
                                            newRating,

                                        gamesPlayed: {
                                            increment:
                                                adjustment.roleGamesPlayed,
                                        },

                                        wins: {
                                            increment:
                                                adjustment.roleWins,
                                        },

                                        losses: {
                                            increment:
                                                adjustment.roleLosses,
                                        },
                                    },
                                });
                            }
                        }

                        // ==================================================
                        // 7. Mark tournament settled
                        // ==================================================

                        const settledAt =
                            new Date();

                        await tx.tournament.update({
                            where: {
                                id: tournamentId,
                            },

                            data: {
                                settledAt,
                            },
                        });

                        return {
                            settled: true,

                            tournamentId,

                            settledAt,

                            playersSettled:
                                adjustments.size,

                            scoringRules:
                                Object.fromEntries(
                                    Array.from(
                                        ruleMap.entries(),
                                    ),
                                ),
                        };
                    },

                    {
                        isolationLevel:
                            Prisma
                                .TransactionIsolationLevel
                                .Serializable,

                        timeout: 20000,
                    },
                );
            } catch (error) {
                if (
                    this.isTransactionConflict(error) &&
                    attempt < 3
                ) {
                    continue;
                }

                throw error;
            }
        }

        throw new ConflictException(
            'Settlement conflict, please try again',
        );
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
}