import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import {
    ParticipantRole,
    ParticipantStatus,
    RegistrationStatus,
    TournamentStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegistrationsService {
    constructor(private readonly prisma: PrismaService) { }

    // ============================================================
    // PLAYER: REGISTER
    // ============================================================

    async register(tournamentId: number, userId: number) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        const tournament =
                            await tx.tournament.findUnique({
                                where: { id: tournamentId },
                            });

                        if (!tournament) {
                            throw new NotFoundException(
                                'Tournament not found',
                            );
                        }

                        if (
                            tournament.status !==
                            TournamentStatus.REGISTRATION_OPEN
                        ) {
                            throw new BadRequestException(
                                'Tournament registration is not open',
                            );
                        }

                        const player =
                            await tx.playerProfile.findUnique({
                                where: { userId },
                            });

                        if (!player) {
                            throw new NotFoundException(
                                'Player profile not found',
                            );
                        }

                        if (!player.mainRole) {
                            throw new BadRequestException(
                                'Please set your main role before registering',
                            );
                        }

                        const existing =
                            await tx.tournamentRegistration.findFirst({
                                where: {
                                    tournamentId,
                                    playerId: player.id,
                                },
                            });

                        if (
                            existing &&
                            (
                                existing.status ===
                                RegistrationStatus.REGISTERED ||
                                existing.status ===
                                RegistrationStatus.WAITLIST
                            )
                        ) {
                            throw new ConflictException(
                                'You are already registered for this tournament',
                            );
                        }

                        const registeredCount =
                            await tx.tournamentRegistration.count({
                                where: {
                                    tournamentId,
                                    status:
                                        RegistrationStatus.REGISTERED,
                                },
                            });

                        let status: RegistrationStatus;
                        let waitlistPosition: number | null = null;

                        if (
                            registeredCount <
                            tournament.maxPlayers
                        ) {
                            status =
                                RegistrationStatus.REGISTERED;
                        } else {
                            const waitlistCount =
                                await tx.tournamentRegistration.count({
                                    where: {
                                        tournamentId,
                                        status:
                                            RegistrationStatus.WAITLIST,
                                    },
                                });

                            if (
                                waitlistCount >=
                                tournament.maxWaitlist
                            ) {
                                throw new ConflictException(
                                    'Tournament and waitlist are full',
                                );
                            }

                            const maxPosition =
                                await tx.tournamentRegistration.aggregate({
                                    where: {
                                        tournamentId,
                                        status:
                                            RegistrationStatus.WAITLIST,
                                    },

                                    _max: {
                                        waitlistPosition: true,
                                    },
                                });

                            waitlistPosition =
                                (maxPosition._max.waitlistPosition ?? 0) +
                                1;

                            status =
                                RegistrationStatus.WAITLIST;
                        }

                        const data = {
                            status,
                            primaryRole: player.mainRole,
                            secondaryRole: player.secondaryRole,
                            checkedIn: false,
                            checkedInAt: null,
                            waitlistPosition,
                            registeredAt: new Date(),
                        };

                        if (existing) {
                            return tx.tournamentRegistration.update({
                                where: {
                                    id: existing.id,
                                },

                                data,

                                include: {
                                    player: true,
                                    tournament: true,
                                },
                            });
                        }

                        return tx.tournamentRegistration.create({
                            data: {
                                tournamentId,
                                playerId: player.id,
                                ...data,
                            },

                            include: {
                                player: true,
                                tournament: true,
                            },
                        });
                    },

                    {
                        isolationLevel:
                            Prisma.TransactionIsolationLevel
                                .Serializable,
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
            'Registration conflict, please try again',
        );
    }

    // ============================================================
    // PLAYER: GET MY REGISTRATION
    // ============================================================

    async getMine(
        tournamentId: number,
        userId: number,
    ) {
        const player =
            await this.prisma.playerProfile.findUnique({
                where: { userId },
            });

        if (!player) {
            throw new NotFoundException(
                'Player profile not found',
            );
        }

        const registration =
            await this.prisma.tournamentRegistration.findFirst({
                where: {
                    tournamentId,
                    playerId: player.id,
                },

                include: {
                    tournament: true,
                },
            });

        if (
            !registration ||
            (
                registration.status !==
                RegistrationStatus.REGISTERED &&
                registration.status !==
                RegistrationStatus.WAITLIST
            )
        ) {
            throw new NotFoundException(
                'You are not registered for this tournament',
            );
        }

        let queuePosition: number | null = null;

        if (
            registration.status ===
            RegistrationStatus.WAITLIST &&
            registration.waitlistPosition !== null
        ) {
            const peopleAhead =
                await this.prisma.tournamentRegistration.count({
                    where: {
                        tournamentId,
                        status:
                            RegistrationStatus.WAITLIST,

                        waitlistPosition: {
                            lt: registration.waitlistPosition,
                        },
                    },
                });

            queuePosition = peopleAhead + 1;
        }

        return {
            ...registration,
            queuePosition,
        };
    }

    // ============================================================
    // PLAYER: CHECK IN
    // ============================================================

    async checkIn(
        tournamentId: number,
        userId: number,
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

        if (
            tournament.status !==
            TournamentStatus.CHECK_IN
        ) {
            throw new BadRequestException(
                'Tournament is not in check-in stage',
            );
        }

        const now = new Date();

        if (
            tournament.checkinStart &&
            now < tournament.checkinStart
        ) {
            throw new BadRequestException(
                'Check-in has not started yet',
            );
        }

        if (
            tournament.checkinEnd &&
            now > tournament.checkinEnd
        ) {
            throw new BadRequestException(
                'Check-in has ended',
            );
        }

        const player =
            await this.prisma.playerProfile.findUnique({
                where: {
                    userId,
                },
            });

        if (!player) {
            throw new NotFoundException(
                'Player profile not found',
            );
        }

        const registration =
            await this.prisma.tournamentRegistration.findFirst({
                where: {
                    tournamentId,
                    playerId: player.id,

                    status: {
                        in: [
                            RegistrationStatus.REGISTERED,
                            RegistrationStatus.WAITLIST,
                        ],
                    },
                },
            });

        if (!registration) {
            throw new NotFoundException(
                'Active registration not found',
            );
        }

        if (registration.checkedIn) {
            return registration;
        }

        return this.prisma.tournamentRegistration.update({
            where: {
                id: registration.id,
            },

            data: {
                checkedIn: true,
                checkedInAt: now,
            },
        });
    }

    // ============================================================
    // ADMIN: REMOVE REGISTRATION
    // ============================================================

    async adminRemove(
        tournamentId: number,
        registrationId: number,
    ) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        const registration =
                            await tx.tournamentRegistration.findFirst({
                                where: {
                                    id: registrationId,
                                    tournamentId,
                                },
                            });

                        if (!registration) {
                            throw new NotFoundException(
                                'Registration not found',
                            );
                        }

                        if (
                            registration.status !==
                            RegistrationStatus.REGISTERED &&
                            registration.status !==
                            RegistrationStatus.WAITLIST
                        ) {
                            throw new BadRequestException(
                                'Registration is not active',
                            );
                        }

                        const previousStatus =
                            registration.status;

                        await tx.tournamentRegistration.update({
                            where: {
                                id: registration.id,
                            },

                            data: {
                                status:
                                    RegistrationStatus.REMOVED,

                                checkedIn: false,
                                checkedInAt: null,
                                waitlistPosition: null,
                            },
                        });

                        let promotedPlayer: unknown = null;

                        // 正式选手被移除时，优先补候补第一名
                        if (
                            previousStatus ===
                            RegistrationStatus.REGISTERED
                        ) {
                            const firstWaitlist =
                                await tx.tournamentRegistration.findFirst({
                                    where: {
                                        tournamentId,
                                        status:
                                            RegistrationStatus.WAITLIST,
                                    },

                                    orderBy: {
                                        waitlistPosition: 'asc',
                                    },
                                });

                            if (firstWaitlist) {
                                promotedPlayer =
                                    await tx.tournamentRegistration.update({
                                        where: {
                                            id: firstWaitlist.id,
                                        },

                                        data: {
                                            status:
                                                RegistrationStatus.REGISTERED,

                                            waitlistPosition: null,
                                        },

                                        include: {
                                            player: true,
                                        },
                                    });
                            }
                        }

                        return {
                            removed: true,
                            previousStatus,
                            promotedPlayer,
                        };
                    },

                    {
                        isolationLevel:
                            Prisma.TransactionIsolationLevel
                                .Serializable,
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
            'Operation conflict, please try again',
        );
    }

    // ============================================================
    // PLAYER: WITHDRAW
    // ============================================================

    async withdraw(
        tournamentId: number,
        userId: number,
    ) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
                    async (tx) => {
                        const player =
                            await tx.playerProfile.findUnique({
                                where: { userId },
                            });

                        if (!player) {
                            throw new NotFoundException(
                                'Player profile not found',
                            );
                        }

                        const registration =
                            await tx.tournamentRegistration.findFirst({
                                where: {
                                    tournamentId,
                                    playerId: player.id,

                                    status: {
                                        in: [
                                            RegistrationStatus.REGISTERED,
                                            RegistrationStatus.WAITLIST,
                                        ],
                                    },
                                },
                            });

                        if (!registration) {
                            throw new NotFoundException(
                                'Active registration not found',
                            );
                        }

                        const previousStatus =
                            registration.status;

                        await tx.tournamentRegistration.update({
                            where: {
                                id: registration.id,
                            },

                            data: {
                                status:
                                    RegistrationStatus.WITHDRAWN,

                                checkedIn: false,
                                checkedInAt: null,

                                waitlistPosition: null,
                            },
                        });

                        let promotedPlayer: unknown = null;

                        // 如果正式选手退出，候补 #1 自动转正
                        if (
                            previousStatus ===
                            RegistrationStatus.REGISTERED
                        ) {
                            const firstWaitlist =
                                await tx.tournamentRegistration.findFirst({
                                    where: {
                                        tournamentId,
                                        status:
                                            RegistrationStatus.WAITLIST,
                                    },

                                    orderBy: {
                                        waitlistPosition: 'asc',
                                    },
                                });

                            if (firstWaitlist) {
                                promotedPlayer =
                                    await tx.tournamentRegistration.update({
                                        where: {
                                            id: firstWaitlist.id,
                                        },

                                        data: {
                                            status:
                                                RegistrationStatus.REGISTERED,

                                            waitlistPosition: null,
                                        },

                                        include: {
                                            player: true,
                                        },
                                    });
                            }
                        }

                        return {
                            withdrawn: true,
                            previousStatus,
                            promotedPlayer,
                        };
                    },

                    {
                        isolationLevel:
                            Prisma.TransactionIsolationLevel
                                .Serializable,
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
            'Withdrawal conflict, please try again',
        );
    }

    // ============================================================
    // ADMIN: REGISTRATION LIST
    // ============================================================

    async getAdminList(tournamentId: number) {
        const tournament =
            await this.prisma.tournament.findUnique({
                where: { id: tournamentId },
            });

        if (!tournament) {
            throw new NotFoundException(
                'Tournament not found',
            );
        }

        const [registered, waitlist] =
            await Promise.all([
                this.prisma.tournamentRegistration.findMany({
                    where: {
                        tournamentId,
                        status:
                            RegistrationStatus.REGISTERED,
                    },

                    orderBy: {
                        registeredAt: 'asc',
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
                            },
                        },
                    },
                }),

                this.prisma.tournamentRegistration.findMany({
                    where: {
                        tournamentId,
                        status:
                            RegistrationStatus.WAITLIST,
                    },

                    orderBy: {
                        waitlistPosition: 'asc',
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
                            },
                        },
                    },
                }),
            ]);

        return {
            tournament: {
                id: tournament.id,
                name: tournament.name,
                status: tournament.status,

                maxPlayers: tournament.maxPlayers,
                maxWaitlist: tournament.maxWaitlist,
            },

            counts: {
                registered: registered.length,
                waitlist: waitlist.length,

                remaining:
                    tournament.maxPlayers -
                    registered.length,
            },

            registered,

            waitlist: waitlist.map(
                (registration, index) => ({
                    ...registration,
                    queuePosition: index + 1,
                }),
            ),
        };
    }

    // ============================================================
    // ADMIN: FINALIZE PARTICIPANTS
    // ============================================================

    async finalizeParticipants(
        tournamentId: number,
    ) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.prisma.$transaction(
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
                            TournamentStatus.REGISTRATION_CLOSED
                        ) {
                            throw new BadRequestException(
                                'Registration must be closed before finalizing participants',
                            );
                        }

                        const existingParticipants =
                            await tx.tournamentParticipant.count({
                                where: {
                                    tournamentId,
                                },
                            });

                        if (existingParticipants > 0) {
                            throw new ConflictException(
                                'Tournament participants have already been finalized',
                            );
                        }

                        const requiredPlayers =
                            tournament.teamCount *
                            tournament.playersPerTeam;

                        const registrations =
                            await tx.tournamentRegistration.findMany({
                                where: {
                                    tournamentId,

                                    status:
                                        RegistrationStatus.REGISTERED,
                                },

                                orderBy: {
                                    registeredAt: 'asc',
                                },
                            });

                        if (
                            registrations.length !==
                            requiredPlayers
                        ) {
                            throw new BadRequestException(
                                `Exactly ${requiredPlayers} registered players are required. Current: ${registrations.length}`,
                            );
                        }

                        const result =
                            await tx.tournamentParticipant.createMany({
                                data: registrations.map(
                                    (registration) => ({
                                        tournamentId,
                                        playerId:
                                            registration.playerId,

                                        role:
                                            ParticipantRole.PLAYER,

                                        status:
                                            ParticipantStatus.ACTIVE,
                                    }),
                                ),
                            });

                        await tx.tournament.update({
                            where: {
                                id: tournamentId,
                            },

                            data: {
                                status:
                                    TournamentStatus.DRAFTING,
                            },
                        });

                        const participants =
                            await tx.tournamentParticipant.findMany({
                                where: {
                                    tournamentId,
                                },

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

                                orderBy: {
                                    id: 'asc',
                                },
                            });

                        return {
                            finalized: true,

                            tournamentId,

                            participantCount:
                                result.count,

                            tournamentStatus:
                                TournamentStatus.DRAFTING,

                            participants,
                        };
                    },

                    {
                        isolationLevel:
                            Prisma.TransactionIsolationLevel
                                .Serializable,
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
            'Finalize conflict, please try again',
        );
    }

    private isTransactionConflict(
        error: unknown,
    ): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code ===
            'P2034'
        );
    }
}