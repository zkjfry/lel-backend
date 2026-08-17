import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {
    ParticipantRole,
    ParticipantStatus,
    TournamentStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';
import { SetupTeamsDto } from './dto/setup-teams.dto';

@Injectable()
export class TeamsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // ============================================================
    // PUBLIC: TEAM TEMPLATE POOL
    // ============================================================

    async getTeamTemplates() {
        return this.prisma.teamTemplate.findMany({
            where: {
                enabled: true,
            },

            orderBy: {
                id: 'asc',
            },
        });
    }

    // ============================================================
    // PUBLIC: TOURNAMENT TEAMS
    // ============================================================

    async getTournamentTeams(
        tournamentId: number,
    ) {
        const tournament =
            await this.prisma.tournament.findUnique({
                where: {
                    id: tournamentId,
                },

                select: {
                    id: true,
                    name: true,
                },
            });

        if (!tournament) {
            throw new NotFoundException(
                'Tournament not found',
            );
        }

        return this.prisma.tournamentTeam.findMany({
            where: {
                tournamentId,
            },

            orderBy: {
                draftOrder: 'asc',
            },

            include: {
                teamTemplate: true,

                captainParticipant: {
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

                                stats: true,
                                roleRatings: true,
                            },
                        },
                    },
                },

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
        });
    }

    // ============================================================
    // ADMIN: GET FINALIZED PARTICIPANTS
    // ============================================================

    async getParticipants(
        tournamentId: number,
    ) {
        const tournament =
            await this.prisma.tournament.findUnique({
                where: {
                    id: tournamentId,
                },
            });

        if (!tournament) {
            throw new NotFoundException(
                'Tournament not found',
            );
        }

        return this.prisma.tournamentParticipant.findMany({
            where: {
                tournamentId,

                status:
                    ParticipantStatus.ACTIVE,
            },

            include: {
                player: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                                status: true,
                            },
                        },

                        stats: true,

                        roleRatings: {
                            orderBy: {
                                role: 'asc',
                            },
                        },
                    },
                },

                teamMembership: {
                    include: {
                        team: true,
                    },
                },
            },

            orderBy: {
                id: 'asc',
            },
        });
    }

    // ============================================================
    // ADMIN: CREATE TEAMS + ASSIGN CAPTAINS
    // ============================================================

    async setupTeams(
        tournamentId: number,
        dto: SetupTeamsDto,
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
                    TournamentStatus.DRAFTING
                ) {
                    throw new BadRequestException(
                        'Tournament must be in DRAFTING stage',
                    );
                }

                if (
                    dto.captainParticipantIds.length !==
                    tournament.teamCount
                ) {
                    throw new BadRequestException(
                        `Exactly ${tournament.teamCount} captains are required`,
                    );
                }

                if (
                    dto.teamTemplateIds &&
                    dto.teamTemplateIds.length !==
                    tournament.teamCount
                ) {
                    throw new BadRequestException(
                        `Exactly ${tournament.teamCount} team templates are required`,
                    );
                }

                const existingTeams =
                    await tx.tournamentTeam.count({
                        where: {
                            tournamentId,
                        },
                    });

                if (existingTeams > 0) {
                    throw new ConflictException(
                        'Tournament teams have already been created',
                    );
                }

                // --------------------------------------------------------
                // Verify captains
                // --------------------------------------------------------

                const captains =
                    await tx.tournamentParticipant.findMany({
                        where: {
                            tournamentId,

                            id: {
                                in: dto.captainParticipantIds,
                            },

                            status:
                                ParticipantStatus.ACTIVE,
                        },

                        include: {
                            player: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    });

                if (
                    captains.length !==
                    tournament.teamCount
                ) {
                    throw new BadRequestException(
                        'One or more captains are invalid or do not belong to this tournament',
                    );
                }

                // --------------------------------------------------------
                // Verify team templates
                // --------------------------------------------------------

                let templates:
                    {
                        id: number;
                        name: string;
                        shortName: string;
                        logoUrl: string | null;
                    }[] = [];

                if (dto.teamTemplateIds) {
                    templates =
                        await tx.teamTemplate.findMany({
                            where: {
                                id: {
                                    in: dto.teamTemplateIds,
                                },

                                enabled: true,
                            },

                            select: {
                                id: true,
                                name: true,
                                shortName: true,
                                logoUrl: true,
                            },
                        });

                    if (
                        templates.length !==
                        tournament.teamCount
                    ) {
                        throw new BadRequestException(
                            'One or more team templates are invalid or disabled',
                        );
                    }
                }

                // --------------------------------------------------------
                // Change selected participants to CAPTAIN
                // --------------------------------------------------------

                await tx.tournamentParticipant.updateMany({
                    where: {
                        tournamentId,

                        id: {
                            in: dto.captainParticipantIds,
                        },
                    },

                    data: {
                        role:
                            ParticipantRole.CAPTAIN,
                    },
                });

                let createdTeamCount = 0;

                // --------------------------------------------------------
                // Create Team 1 ~ Team N
                // --------------------------------------------------------

                for (
                    let index = 0;
                    index < tournament.teamCount;
                    index++
                ) {
                    const captainParticipantId =
                        dto.captainParticipantIds[index];

                    let template:
                        | {
                            id: number;
                            name: string;
                            shortName: string;
                            logoUrl: string | null;
                        }
                        | undefined;

                    if (dto.teamTemplateIds) {
                        const requestedTemplateId =
                            dto.teamTemplateIds[index];

                        template = templates.find(
                            (item) =>
                                item.id ===
                                requestedTemplateId,
                        );
                    }

                    const defaultName =
                        `Team ${String.fromCharCode(
                            65 + index,
                        )}`;

                    const defaultShortName =
                        `T${index + 1}`;

                    const team =
                        await tx.tournamentTeam.create({
                            data: {
                                tournamentId,

                                teamTemplateId:
                                    template?.id,

                                name:
                                    template?.name ??
                                    defaultName,

                                shortName:
                                    template?.shortName ??
                                    defaultShortName,

                                logoUrl:
                                    template?.logoUrl,

                                captainParticipantId,

                                draftOrder:
                                    index + 1,

                                seed:
                                    index + 1,
                            },
                        });

                    // Captain is automatically the first member
                    await tx.teamMember.create({
                        data: {
                            teamId:
                                team.id,

                            participantId:
                                captainParticipantId,
                        },
                    });

                    createdTeamCount++;
                }

                return {
                    setup: true,

                    tournamentId,

                    teamCount:
                        createdTeamCount,

                    teams:
                        await tx.tournamentTeam.findMany({
                            where: {
                                tournamentId,
                            },

                            orderBy: {
                                draftOrder: 'asc',
                            },

                            include: {
                                captainParticipant: {
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
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        }),
                };
            },
        );
    }
}