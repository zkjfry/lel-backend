import {
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

import {
    ParticipantStatus,
    PlayerRole,
    UserRole,
    UserStatus,
} from '../generated/prisma/enums';

import { Prisma } from '../generated/prisma/client';

import { AdminPlayerQueryDto } from './dto/admin-player-query.dto';

import {
    AuditService,
} from '../audit/audit.service';

@Injectable()
export class PlayersService {
    constructor(
        private readonly prisma:
            PrismaService,

        private readonly auditService:
            AuditService,
    ) { }

    async getMine(userId: number) {
        const profile =
            await this.prisma.playerProfile.findUnique({
                where: {
                    userId,
                },

                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatarUrl: true,
                            role: true,
                            status: true,
                            createdAt: true,
                        },
                    },

                    stats: true,

                    roleRatings: {
                        orderBy: {
                            role: 'asc',
                        },
                    },
                },
            });

        if (!profile) {
            throw new NotFoundException(
                'Player profile not found',
            );
        }

        return profile;
    }

    async updateMine(
        userId: number,
        dto: UpdateProfileDto,
    ) {
        const existing =
            await this.prisma.playerProfile.findUnique({
                where: {
                    userId,
                },
            });

        if (!existing) {
            throw new NotFoundException(
                'Player profile not found',
            );
        }

        const mainRole =
            dto.mainRole ?? existing.mainRole;

        const secondaryRole =
            dto.secondaryRole ?? existing.secondaryRole;

        if (
            mainRole &&
            secondaryRole &&
            mainRole === secondaryRole
        ) {
            throw new BadRequestException(
                'Main role and secondary role cannot be the same',
            );
        }

        return this.prisma.playerProfile.update({
            where: {
                userId,
            },

            data: {
                displayName:
                    dto.displayName !== undefined
                        ? dto.displayName.trim()
                        : undefined,

                riotGameName:
                    dto.riotGameName !== undefined
                        ? dto.riotGameName.trim()
                        : undefined,

                riotTagLine:
                    dto.riotTagLine !== undefined
                        ? dto.riotTagLine.trim()
                        : undefined,

                riotRegion:
                    dto.riotRegion !== undefined
                        ? dto.riotRegion.trim()
                        : undefined,

                rankTier: dto.rankTier,

                rankDivision: dto.rankDivision,

                mainRole: dto.mainRole,

                secondaryRole: dto.secondaryRole,

                yyName:
                    dto.yyName !== undefined
                        ? dto.yyName.trim()
                        : undefined,

                bio:
                    dto.bio !== undefined
                        ? dto.bio.trim()
                        : undefined,
            },

            include: {
                stats: true,
                roleRatings: true,

                user: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });
    }

    async getPublicProfile(
        playerId: number,
    ) {
        const profile =
            await this.prisma.playerProfile.findUnique({
                where: {
                    id: playerId,
                },

                select: {
                    id: true,
                    displayName: true,

                    riotGameName: true,
                    riotTagLine: true,
                    riotRegion: true,

                    rankTier: true,
                    rankDivision: true,

                    mainRole: true,
                    secondaryRole: true,

                    yyName: true,
                    bio: true,

                    createdAt: true,

                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatarUrl: true,
                            status: true,
                        },
                    },

                    stats: true,

                    roleRatings: true,
                },
            });

        if (
            !profile ||
            profile.user.status !==
            UserStatus.ACTIVE
        ) {
            throw new NotFoundException(
                'Player not found',
            );
        }

        // ============================================================
        // Win rate
        // ============================================================

        const wins =
            profile.stats?.wins ?? 0;

        const losses =
            profile.stats?.losses ?? 0;

        const totalGames =
            wins + losses;

        const winRate =
            totalGames === 0
                ? 0
                : Number(
                    (
                        (wins /
                            totalGames) *
                        100
                    ).toFixed(2),
                );

        // ============================================================
        // Role rating order
        // TOP → JUNGLE → MID → ADC → SUPPORT
        // ============================================================

        const roleOrder:
            Record<PlayerRole, number> = {
            [PlayerRole.TOP]: 1,
            [PlayerRole.JUNGLE]: 2,
            [PlayerRole.MID]: 3,
            [PlayerRole.ADC]: 4,
            [PlayerRole.SUPPORT]: 5,
        };

        const roleRatings =
            [...profile.roleRatings].sort(
                (a, b) =>
                    roleOrder[a.role] -
                    roleOrder[b.role],
            );

        const mainRoleRating =
            profile.mainRole
                ? (
                    roleRatings.find(
                        (rating) =>
                            rating.role ===
                            profile.mainRole,
                    )?.rating ?? 0
                )
                : 0;

        // ============================================================
        // Recent tournaments
        // ============================================================

        const participations =
            await this.prisma.tournamentParticipant.findMany({
                where: {
                    playerId,

                    status:
                        ParticipantStatus.ACTIVE,
                },

                take: 5,

                orderBy: {
                    createdAt: 'desc',
                },

                select: {
                    id: true,
                    role: true,

                    tournament: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                            startTime: true,
                            createdAt: true,
                        },
                    },

                    teamMembership: {
                        select: {
                            team: {
                                select: {
                                    id: true,
                                    name: true,
                                    shortName: true,
                                    logoUrl: true,

                                    tournamentResults: {
                                        select: {
                                            placement: true,
                                            isChampion: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

        const recentTournaments =
            participations.map(
                (participation) => {
                    const team =
                        participation
                            .teamMembership
                            ?.team;

                    const result =
                        team
                            ?.tournamentResults?.[0];

                    return {
                        tournament:
                            participation.tournament,

                        participantRole:
                            participation.role,

                        team: team
                            ? {
                                id: team.id,
                                name: team.name,
                                shortName:
                                    team.shortName,
                                logoUrl:
                                    team.logoUrl,
                            }
                            : null,

                        placement:
                            result?.placement ??
                            null,

                        isChampion:
                            result?.isChampion ??
                            false,
                    };
                },
            );

        return {
            player: {
                id: profile.id,

                username:
                    profile.user.username,

                displayName:
                    profile.displayName,

                avatarUrl:
                    profile.user.avatarUrl,

                riotGameName:
                    profile.riotGameName,

                riotTagLine:
                    profile.riotTagLine,

                riotRegion:
                    profile.riotRegion,

                rankTier:
                    profile.rankTier,

                rankDivision:
                    profile.rankDivision,

                mainRole:
                    profile.mainRole,

                secondaryRole:
                    profile.secondaryRole,

                yyName:
                    profile.yyName,

                bio:
                    profile.bio,

                joinedAt:
                    profile.createdAt,
            },

            stats: {
                points:
                    profile.stats?.points ??
                    0,

                tournamentsPlayed:
                    profile.stats
                        ?.tournamentsPlayed ??
                    0,

                seriesPlayed:
                    profile.stats
                        ?.seriesPlayed ??
                    0,

                gamesPlayed:
                    profile.stats
                        ?.gamesPlayed ??
                    0,

                wins,

                losses,

                winRate,

                championships:
                    profile.stats
                        ?.championships ??
                    0,

                mvpCount:
                    profile.stats
                        ?.mvpCount ??
                    0,

                svpCount:
                    profile.stats
                        ?.svpCount ??
                    0,

                mainRoleRating,
            },

            roleRatings,

            recentTournaments,
        };
    }

    async adminFindAll(
        query: AdminPlayerQueryDto,
    ) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const skip =
            (page - 1) * pageSize;

        const search =
            query.search?.trim();

        const where: Prisma.UserWhereInput = {
            ...(query.role
                ? {
                    role: query.role,
                }
                : {}),

            ...(query.status
                ? {
                    status: query.status,
                }
                : {}),

            ...(search
                ? {
                    OR: [
                        {
                            username: {
                                contains: search,
                                mode: 'insensitive',
                            },
                        },

                        {
                            email: {
                                contains: search,
                                mode: 'insensitive',
                            },
                        },

                        {
                            profile: {
                                is: {
                                    displayName: {
                                        contains: search,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [total, users] =
            await Promise.all([
                this.prisma.user.count({
                    where,
                }),

                this.prisma.user.findMany({
                    where,

                    skip,
                    take: pageSize,

                    orderBy: {
                        createdAt: 'desc',
                    },

                    select: {
                        id: true,
                        username: true,
                        email: true,

                        role: true,
                        status: true,

                        avatarUrl: true,
                        createdAt: true,

                        profile: {
                            select: {
                                id: true,
                                displayName: true,

                                riotGameName: true,
                                riotTagLine: true,

                                rankTier: true,
                                rankDivision: true,

                                mainRole: true,
                                secondaryRole: true,

                                yyName: true,

                                stats: true,
                            },
                        },
                    },
                }),
            ]);

        return {
            page,
            pageSize,
            total,

            totalPages:
                Math.ceil(
                    total / pageSize,
                ),

            items: users,
        };
    }

    async adminFindOne(
        playerId: number,
    ) {
        const player =
            await this.prisma.playerProfile.findUnique({
                where: {
                    id: playerId,
                },

                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,

                            role: true,
                            status: true,

                            avatarUrl: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },

                    stats: true,

                    roleRatings: {
                        orderBy: {
                            role: 'asc',
                        },
                    },

                    participants: {
                        take: 10,

                        orderBy: {
                            createdAt: 'desc',
                        },

                        include: {
                            tournament: {
                                select: {
                                    id: true,
                                    name: true,
                                    status: true,
                                },
                            },

                            teamMembership: {
                                include: {
                                    team: {
                                        select: {
                                            id: true,
                                            name: true,
                                            shortName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

        if (!player) {
            throw new NotFoundException(
                'Player not found',
            );
        }

        return player;
    }

    async adminGetPointTransactions(
        playerId: number,
        page = 1,
        pageSize = 20,
    ) {
        const player =
            await this.prisma.playerProfile.findUnique({
                where: {
                    id: playerId,
                },

                select: {
                    id: true,
                    displayName: true,
                },
            });

        if (!player) {
            throw new NotFoundException(
                'Player not found',
            );
        }

        const skip =
            (page - 1) *
            pageSize;

        const [total, items] =
            await Promise.all([
                this.prisma.pointTransaction.count({
                    where: {
                        playerId,
                    },
                }),

                this.prisma.pointTransaction.findMany({
                    where: {
                        playerId,
                    },

                    skip,
                    take: pageSize,

                    orderBy: {
                        createdAt: 'desc',
                    },

                    include: {
                        tournament: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },

                        game: {
                            select: {
                                id: true,
                                gameNumber: true,
                                matchId: true,
                            },
                        },
                    },
                }),
            ]);

        return {
            player,

            page,
            pageSize,
            total,

            totalPages:
                Math.ceil(
                    total / pageSize,
                ),

            items,
        };
    }

    async adminUpdateStatus(
        playerId: number,
        status: UserStatus,
        actorUserId: number,
        actorRole: UserRole,
        ipAddress?: string
    ) {
        const player =
            await this.prisma.playerProfile.findUnique({
                where: {
                    id: playerId,
                },

                include: {
                    user: true,
                },
            });

        if (!player) {
            throw new NotFoundException(
                'Player not found',
            );
        }

        if (
            player.user.id ===
            actorUserId
        ) {
            throw new BadRequestException(
                'You cannot change your own account status',
            );
        }

        if (
            player.user.role ===
            UserRole.SUPER_ADMIN &&
            actorRole !==
            UserRole.SUPER_ADMIN
        ) {
            throw new ForbiddenException(
                'Only SUPER_ADMIN can manage a SUPER_ADMIN account',
            );
        }

        return this.prisma.$transaction(
            async (tx) => {
                const updated =
                    await tx.user.update({
                        where: {
                            id:
                                player.user.id,
                        },

                        data: {
                            status,
                        },

                        select: {
                            id: true,
                            username: true,
                            role: true,
                            status: true,
                        },
                    });

                await this.auditService.logWithTx(
                    tx,
                    {
                        userId:
                            actorUserId,

                        action:
                            'PLAYER_STATUS_CHANGED',

                        entityType:
                            'User',

                        entityId:
                            player.user.id,

                        oldValue: {
                            status:
                                player.user.status,
                        },

                        newValue: {
                            status:
                                updated.status,
                        },

                        ipAddress,
                    },
                );

                return updated;
            },
        );
    }

    async adminUpdateRole(
        playerId: number,
        role: UserRole,
        actorUserId: number,
        ipAddress?: string
    ) {
        const player =
            await this.prisma.playerProfile.findUnique({
                where: {
                    id: playerId,
                },

                include: {
                    user: true,
                },
            });

        if (!player) {
            throw new NotFoundException(
                'Player not found',
            );
        }

        if (
            player.user.id ===
            actorUserId
        ) {
            throw new BadRequestException(
                'You cannot change your own role',
            );
        }

        if (
            player.user.role ===
            UserRole.SUPER_ADMIN &&
            role !==
            UserRole.SUPER_ADMIN
        ) {
            const superAdminCount =
                await this.prisma.user.count({
                    where: {
                        role:
                            UserRole.SUPER_ADMIN,
                    },
                });

            if (
                superAdminCount <= 1
            ) {
                throw new ConflictException(
                    'The last SUPER_ADMIN cannot be demoted',
                );
            }
        }

        return this.prisma.$transaction(
            async (tx) => {
                const updated =
                    await tx.user.update({
                        where: {
                            id:
                                player.user.id,
                        },

                        data: {
                            role,
                        },

                        select: {
                            id: true,
                            username: true,
                            role: true,
                            status: true,
                        },
                    });

                await this.auditService.logWithTx(
                    tx,
                    {
                        userId:
                            actorUserId,

                        action:
                            'PLAYER_ROLE_CHANGED',

                        entityType:
                            'User',

                        entityId:
                            player.user.id,

                        oldValue: {
                            role:
                                player.user.role,
                        },

                        newValue: {
                            role:
                                updated.role,
                        },

                        ipAddress,
                    },
                );

                return updated;
            },
        );
    }
}