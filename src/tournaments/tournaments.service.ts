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

import {
    PrismaService,
} from '../prisma/prisma.service';

import {
    CreateTournamentDto,
} from './dto/create-tournament.dto';

import {
    UpdateTournamentDto,
} from './dto/update-tournament.dto';

import {
    UpdateTournamentStatusDto,
} from './dto/update-tournament-status.dto';

import * as bcrypt from 'bcrypt';


@Injectable()
export class TournamentsService {

    constructor(
        private readonly prisma:
            PrismaService,

        private readonly auditService:
            AuditService,
    ) { }


    /* =========================================================
       CREATE TOURNAMENT
    ========================================================= */

    async create(
        dto: CreateTournamentDto,
        createdById: number,
    ) {

        /*
         * LEL defaults
         *
         * 20 players
         * 4 teams
         * 5 players / team
         */
        const maxPlayers =
            dto.maxPlayers ?? 20;

        const teamCount =
            dto.teamCount ?? 4;

        const playersPerTeam =
            dto.playersPerTeam ?? 5;

        const maxWaitlist =
            dto.maxWaitlist ?? 5;


        /*
         * Enforce LEL tournament structure.
         */
        this.validateTournamentSize(
            maxPlayers,
            teamCount,
            playersPerTeam,
        );


        const slug =
            this.generateSlug();

        const registrationPassword =
            dto.registrationPassword.trim();


        if (
            registrationPassword.length < 4
            ||
            registrationPassword.length > 32
        ) {

            throw new BadRequestException(
                'Registration password must be between 4 and 32 characters',
            );

        }


        const registrationPasswordHash =
            await bcrypt.hash(
                registrationPassword,
                12,
            );


        const created =
            await this.prisma.tournament.create({

                data: {

                    name:
                        dto.name.trim(),

                    slug,

                    description:
                        dto.description?.trim(),
                    registrationPasswordHash,


                    registrationStart:
                        dto.registrationStart
                            ? new Date(
                                dto.registrationStart,
                            )
                            : undefined,


                    registrationEnd:
                        dto.registrationEnd
                            ? new Date(
                                dto.registrationEnd,
                            )
                            : undefined,


                    checkinStart:
                        dto.checkinStart
                            ? new Date(
                                dto.checkinStart,
                            )
                            : undefined,


                    checkinEnd:
                        dto.checkinEnd
                            ? new Date(
                                dto.checkinEnd,
                            )
                            : undefined,


                    startTime:
                        dto.startTime
                            ? new Date(
                                dto.startTime,
                            )
                            : undefined,


                    maxPlayers,

                    maxWaitlist,

                    teamCount,

                    playersPerTeam,


                    matchFormat:
                        dto.matchFormat ??
                        'BO3',


                    tournamentFormat:
                        dto.tournamentFormat ??
                        'SINGLE_ELIMINATION',


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

        return this.toPublicTournament(
            created,
        );

    }


    /* =========================================================
       FIND ALL
    ========================================================= */

    async findAll() {

        const tournaments =
            await this.prisma.tournament.findMany({

                orderBy: {

                    createdAt:
                        'desc',

                },


                include: {

                    _count: {

                        select: {

                            registrations: {
                                where: {
                                    status: 'REGISTERED',
                                },
                            },

                            participants:
                                true,

                            teams:
                                true,

                            matches:
                                true,

                        },

                    },

                },

            });

        return tournaments.map(
            (
                tournament,
            ) =>
                this.toPublicTournament(
                    tournament,
                ),
        );

    }


    /* =========================================================
       FIND ONE
    ========================================================= */

    async findOne(
        id: number,
    ) {

        const tournament =
            await this.prisma.tournament.findUnique({

                where: {
                    id,
                },


                include: {

                    /* =========================================
                       CREATOR
                    ========================================= */

                    createdBy: {

                        select: {

                            id: true,

                            username: true,

                        },

                    },


                    /* =========================================
                       PARTICIPANTS
                    ========================================= */

                    participants: {

                        orderBy: {
                            id: 'asc',
                        },


                        include: {

                            /*
                             * Temporarily include the complete
                             * PlayerProfile.
                             *
                             * After we inspect the real JSON,
                             * frontend/public fields will be
                             * narrowed with select.
                             */
                            player: true,


                            /*
                             * If draft/team assignment has
                             * completed, this tells us which
                             * team the participant belongs to.
                             */
                            teamMembership: {

                                include: {

                                    team: {

                                        select: {

                                            id: true,

                                            name: true,

                                            shortName: true,

                                            logoUrl: true,

                                            seed: true,

                                            draftOrder: true,

                                        },

                                    },

                                },

                            },

                        },

                    },


                    /* =========================================
                       TEAMS
                    ========================================= */

                    teams: {

                        orderBy: [
                            {
                                seed: 'asc',
                            },
                            {
                                id: 'asc',
                            },
                        ],


                        include: {

                            /* Captain */

                            captainParticipant: {

                                include: {

                                    player: true,

                                },

                            },


                            /* Team roster */

                            members: {

                                orderBy: {
                                    id: 'asc',
                                },


                                include: {

                                    participant: {

                                        include: {

                                            player: true,

                                        },

                                    },

                                },

                            },

                        },

                    },


                    /* =========================================
                       MATCHES
                    ========================================= */

                    matches: {

                        orderBy: {
                            id: 'asc',
                        },

                    },


                    /* =========================================
                       FINAL RESULTS
                    ========================================= */

                    results: {

                        orderBy: {
                            placement: 'asc',
                        },


                        include: {

                            team: true,

                        },

                    },


                    /* =========================================
                       COUNTS
                    ========================================= */

                    _count: {

                        select: {

                            registrations: {
                                where: {
                                    status: 'REGISTERED',
                                },
                            },

                            participants:
                                true,

                            teams:
                                true,

                            matches:
                                true,

                        },

                    },

                },

            });


        if (!tournament) {

            throw new NotFoundException(
                'Tournament not found',
            );

        }


        return this.toPublicTournament(
            tournament,
        );

    }


    /* =========================================================
       UPDATE TOURNAMENT
    ========================================================= */

    async update(
        id: number,
        dto: UpdateTournamentDto,
    ) {

        /*
         * Load current values first because update DTO
         * may only contain one of the size fields.
         */
        const current =
            await this.findOne(id);


        const maxPlayers =
            dto.maxPlayers ??
            current.maxPlayers;


        const teamCount =
            dto.teamCount ??
            current.teamCount;


        const playersPerTeam =
            dto.playersPerTeam ??
            current.playersPerTeam;


        /*
         * Validate the FINAL resulting tournament structure,
         * not only fields present in this request.
         */
        this.validateTournamentSize(
            maxPlayers,
            teamCount,
            playersPerTeam,
        );


        const updated =
            await this.prisma.tournament.update({

                where: {
                    id,
                },


                data: {

                    name:
                        dto.name?.trim(),


                    description:
                        dto.description !== undefined
                            ? dto.description.trim()
                            : undefined,


                    registrationStart:
                        dto.registrationStart !== undefined
                            ? new Date(
                                dto.registrationStart,
                            )
                            : undefined,


                    registrationEnd:
                        dto.registrationEnd !== undefined
                            ? new Date(
                                dto.registrationEnd,
                            )
                            : undefined,


                    checkinStart:
                        dto.checkinStart !== undefined
                            ? new Date(
                                dto.checkinStart,
                            )
                            : undefined,


                    checkinEnd:
                        dto.checkinEnd !== undefined
                            ? new Date(
                                dto.checkinEnd,
                            )
                            : undefined,


                    startTime:
                        dto.startTime !== undefined
                            ? new Date(
                                dto.startTime,
                            )
                            : undefined,


                    maxPlayers:
                        dto.maxPlayers,

                    maxWaitlist:
                        dto.maxWaitlist,

                    teamCount:
                        dto.teamCount,

                    playersPerTeam:
                        dto.playersPerTeam,


                    matchFormat:
                        dto.matchFormat,


                    tournamentFormat:
                        dto.tournamentFormat,

                },

            });
        return this.toPublicTournament(
            updated,
        );
    }


    /* =========================================================
       UPDATE STATUS
    ========================================================= */

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


                return this.toPublicTournament(
                    updated,
                );

            },

        );

    }


    /* =========================================================
       ADMIN STATUS TRANSITIONS
    ========================================================= */

    private assertAdminStatusTransition(
        current:
            TournamentStatus,

        next:
            TournamentStatus,
    ) {

        if (
            current === next
        ) {

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
                    .REGISTRATION_OPEN,

                TournamentStatus
                    .CANCELLED,

            ],


            /*
             * CHECK_IN remains in Prisma enum for
             * database compatibility.
             *
             * LEL V1 does NOT use check-in.
             */
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


    /* =========================================================
       TOURNAMENT SIZE VALIDATION
    ========================================================= */

    private validateTournamentSize(
        maxPlayers: number,
        teamCount: number,
        playersPerTeam: number,
    ) {

        /*
         * LEL is always 5-player League of Legends.
         */
        if (
            playersPerTeam !== 5
        ) {

            throw new BadRequestException(
                'playersPerTeam must be exactly 5',
            );

        }


        /*
         * Minimum tournament:
         *
         * 2 teams × 5 players = 10 players.
         */
        if (
            teamCount < 2
        ) {

            throw new BadRequestException(
                'teamCount must be at least 2',
            );

        }


        /*
         * Tournament must have an even number of teams:
         *
         * 2 / 4 / 6 / 8 / ...
         */
        if (
            teamCount % 2 !== 0
        ) {

            throw new BadRequestException(
                'teamCount must be an even number',
            );

        }


        /*
         * As every team contains 5 players
         * and team count must be even,
         * participant count must be:
         *
         * 10 / 20 / 30 / 40 / ...
         */
        if (
            maxPlayers < 10
        ) {

            throw new BadRequestException(
                'maxPlayers must be at least 10',
            );

        }


        if (
            maxPlayers % 10 !== 0
        ) {

            throw new BadRequestException(
                'maxPlayers must be a multiple of 10',
            );

        }


        /*
         * Cross-field consistency.
         */
        const requiredPlayers =
            teamCount *
            playersPerTeam;


        if (
            maxPlayers !==
            requiredPlayers
        ) {

            throw new BadRequestException(
                `Invalid tournament size: ${teamCount} teams × ${playersPerTeam} players requires exactly ${requiredPlayers} players`,
            );

        }

    }


    /* =========================================================
       SLUG
    ========================================================= */

    private generateSlug() {

        const timestamp =
            Date.now();


        const random =
            randomBytes(3)
                .toString(
                    'hex',
                );


        return (
            `lel-${timestamp}-${random}`
        );

    }

    /* =========================================================
   PUBLIC TOURNAMENT RESPONSE

   registrationPasswordHash must NEVER be returned
   to the browser.

   Frontend only needs to know whether a password exists.
========================================================= */

    private toPublicTournament<
        T extends {
            registrationPasswordHash:
            string | null;
        },
    >(
        tournament:
            T,
    ) {

        const {
            registrationPasswordHash,
            ...publicTournament
        } =
            tournament;


        return {

            ...publicTournament,

            registrationPasswordRequired:
                Boolean(
                    registrationPasswordHash,
                ),

        };

    }

}