import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import {
    TournamentStatus,
} from '../generated/prisma/enums';

import {
    AuditService,
} from '../audit/audit.service';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';

@Injectable()
export class TournamentsService {
    constructor(
        private readonly prisma:
            PrismaService,

        private readonly auditService:
            AuditService,
    ) { }

    async create(dto: CreateTournamentDto, createdById: number) {
        this.validateTournamentSize(
            dto.maxPlayers,
            dto.teamCount,
            dto.playersPerTeam,
        );

        const slug = this.generateSlug();

        return this.prisma.tournament.create({
            data: {
                name: dto.name.trim(),
                slug,
                description: dto.description?.trim(),

                registrationStart: dto.registrationStart
                    ? new Date(dto.registrationStart)
                    : undefined,

                registrationEnd: dto.registrationEnd
                    ? new Date(dto.registrationEnd)
                    : undefined,

                checkinStart: dto.checkinStart
                    ? new Date(dto.checkinStart)
                    : undefined,

                checkinEnd: dto.checkinEnd
                    ? new Date(dto.checkinEnd)
                    : undefined,

                startTime: dto.startTime
                    ? new Date(dto.startTime)
                    : undefined,

                maxPlayers: dto.maxPlayers,
                maxWaitlist: dto.maxWaitlist ?? 5,

                teamCount: dto.teamCount,
                playersPerTeam: dto.playersPerTeam,

                matchFormat: dto.matchFormat ?? 'BO3',

                tournamentFormat:
                    dto.tournamentFormat ?? 'SINGLE_ELIMINATION',

                createdById,
            },

            include: {
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
        });
    }

    async findAll() {
        return this.prisma.tournament.findMany({
            orderBy: {
                createdAt: 'desc',
            },

            include: {
                _count: {
                    select: {
                        registrations: true,
                        participants: true,
                        teams: true,
                        matches: true,
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const tournament =
            await this.prisma.tournament.findUnique({
                where: { id },

                include: {
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                        },
                    },

                    teams: true,

                    _count: {
                        select: {
                            registrations: true,
                            participants: true,
                            teams: true,
                            matches: true,
                        },
                    },
                },
            });

        if (!tournament) {
            throw new NotFoundException('Tournament not found');
        }

        return tournament;
    }

    async update(id: number, dto: UpdateTournamentDto) {
        const current = await this.findOne(id);

        const maxPlayers =
            dto.maxPlayers ?? current.maxPlayers;

        const teamCount =
            dto.teamCount ?? current.teamCount;

        const playersPerTeam =
            dto.playersPerTeam ?? current.playersPerTeam;

        this.validateTournamentSize(
            maxPlayers,
            teamCount,
            playersPerTeam,
        );

        return this.prisma.tournament.update({
            where: { id },

            data: {
                name: dto.name?.trim(),

                description:
                    dto.description !== undefined
                        ? dto.description.trim()
                        : undefined,

                registrationStart:
                    dto.registrationStart !== undefined
                        ? new Date(dto.registrationStart)
                        : undefined,

                registrationEnd:
                    dto.registrationEnd !== undefined
                        ? new Date(dto.registrationEnd)
                        : undefined,

                checkinStart:
                    dto.checkinStart !== undefined
                        ? new Date(dto.checkinStart)
                        : undefined,

                checkinEnd:
                    dto.checkinEnd !== undefined
                        ? new Date(dto.checkinEnd)
                        : undefined,

                startTime:
                    dto.startTime !== undefined
                        ? new Date(dto.startTime)
                        : undefined,

                maxPlayers: dto.maxPlayers,
                maxWaitlist: dto.maxWaitlist,

                teamCount: dto.teamCount,
                playersPerTeam: dto.playersPerTeam,

                matchFormat: dto.matchFormat,

                tournamentFormat: dto.tournamentFormat,
            },
        });
    }

    async updateStatus(
        tournamentId: number,

        status:
            TournamentStatus,

        actorUserId:
            number,

        ipAddress?:
            string,
    ) {
        return this.prisma.$transaction(
            async (tx) => {
                const tournament =
                    await tx.tournament.findUnique({
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

                this.assertAdminStatusTransition(
                    tournament.status,
                    status,
                );

                const updated =
                    await tx.tournament.update({
                        where: {
                            id:
                                tournamentId,
                        },

                        data: {
                            status,
                        },
                    });

                await this.auditService.logWithTx(
                    tx,
                    {
                        userId:
                            actorUserId,

                        action:
                            'TOURNAMENT_STATUS_CHANGED',

                        entityType:
                            'Tournament',

                        entityId:
                            tournamentId,

                        oldValue: {
                            status:
                                tournament.status,
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

    private assertAdminStatusTransition(
        current:
            TournamentStatus,

        next:
            TournamentStatus,
    ) {
        if (current === next) {
            throw new BadRequestException(
                `Tournament is already ${next}`,
            );
        }

        const allowed:
            Record<
                TournamentStatus,
                TournamentStatus[]
            > = {
            [TournamentStatus.DRAFT]: [
                TournamentStatus
                    .REGISTRATION_OPEN,

                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.REGISTRATION_OPEN]: [
                TournamentStatus
                    .REGISTRATION_CLOSED,

                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.REGISTRATION_CLOSED]: [
                TournamentStatus
                    .CANCELLED,
            ],

            // CHECK_IN retained only because it still exists
            // in the database enum. LEL V1 does not enter it.
            [TournamentStatus.CHECK_IN]: [
                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.DRAFTING]: [
                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.ROSTER_LOCKED]: [
                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.SCHEDULED]: [
                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.LIVE]: [
                TournamentStatus
                    .CANCELLED,
            ],

            [TournamentStatus.COMPLETED]: [
                TournamentStatus
                    .ARCHIVED,
            ],

            [TournamentStatus.ARCHIVED]: [],

            [TournamentStatus.CANCELLED]: [
                TournamentStatus
                    .ARCHIVED,
            ],
        };

        if (
            !allowed[current].includes(
                next,
            )
        ) {
            throw new BadRequestException(
                `Invalid tournament status transition: ${current} -> ${next}`,
            );
        }
    }

    private validateTournamentSize(
        maxPlayers: number,
        teamCount: number,
        playersPerTeam: number,
    ) {
        const requiredPlayers =
            teamCount * playersPerTeam;

        if (maxPlayers !== requiredPlayers) {
            throw new BadRequestException(
                `maxPlayers must equal ${requiredPlayers} for ${teamCount} teams × ${playersPerTeam} players`,
            );
        }
    }

    private generateSlug() {
        const timestamp = Date.now();
        const random = randomBytes(3).toString('hex');

        return `lel-${timestamp}-${random}`;
    }
}