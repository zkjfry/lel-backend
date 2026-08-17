import {
    Injectable,
} from '@nestjs/common';

import {
    PrismaService,
} from '../prisma/prisma.service';


@Injectable()
export class UsersService {

    constructor(
        private readonly prisma:
            PrismaService,
    ) { }


    /* =========================================================
       FIND BY USERNAME
    ========================================================= */

    async findByUsername(
        username: string,
    ) {

        return this.prisma.user.findUnique({

            where: {
                username,
            },


            include: {

                profile:
                    true,

            },

        });

    }


    /* =========================================================
       FIND BY EMAIL
  
       Kept for legacy/admin compatibility.
    ========================================================= */

    async findByEmail(
        email: string,
    ) {

        return this.prisma.user.findUnique({

            where: {
                email,
            },

        });

    }


    /* =========================================================
       FIND BY PHONE
    ========================================================= */

    async findByPhone(
        phone: string,
    ) {

        return this.prisma.user.findUnique({

            where: {
                phone,
            },

        });

    }


    /* =========================================================
       PUBLIC USER
    ========================================================= */

    async findPublicById(
        id: number,
    ) {

        return this.prisma.user.findUnique({

            where: {
                id,
            },


            select: {

                id:
                    true,

                username:
                    true,

                /*
                 * Email remains for existing accounts.
                 */
                email:
                    true,

                phone:
                    true,

                role:
                    true,

                status:
                    true,

                avatarUrl:
                    true,

                createdAt:
                    true,


                profile: {

                    select: {

                        id:
                            true,

                        displayName:
                            true,

                        riotGameName:
                            true,

                        riotTagLine:
                            true,

                        riotRegion:
                            true,

                        rankTier:
                            true,

                        rankDivision:
                            true,

                        mainRole:
                            true,

                        secondaryRole:
                            true,

                        yyName:
                            true,

                        bio:
                            true,

                    },

                },

            },

        });

    }


    /* =========================================================
       CREATE PLAYER
    ========================================================= */

    async createPlayer(
        data: {

            username:
            string;

            /*
             * Phone is optional at this lower service layer
             * for backwards compatibility with existing
             * admin/seed code.
             *
             * RegisterDto itself requires phone.
             */
            phone?:
            string;

            email?:
            string;

            passwordHash:
            string;

            displayName:
            string;

        },
    ) {

        return this.prisma.$transaction(

            async (
                tx,
            ) => {

                /* -----------------------------------------------------
                   User + profile
                ----------------------------------------------------- */

                const user =
                    await tx.user.create({

                        data: {

                            username:
                                data.username,

                            phone:
                                data.phone,

                            email:
                                data.email,

                            passwordHash:
                                data.passwordHash,


                            profile: {

                                create: {

                                    displayName:
                                        data.displayName,

                                },

                            },

                        },


                        include: {

                            profile:
                                true,

                        },

                    });


                if (
                    !user.profile
                ) {

                    throw new Error(
                        'Player profile creation failed',
                    );

                }


                /* -----------------------------------------------------
                   Player stats
                ----------------------------------------------------- */

                await tx.playerStats.create({

                    data: {

                        playerId:
                            user.profile.id,

                    },

                });


                /* -----------------------------------------------------
                   Initial role ratings
                ----------------------------------------------------- */

                await tx.playerRoleRating.createMany({

                    data: [

                        {

                            playerId:
                                user.profile.id,

                            role:
                                'TOP',

                        },


                        {

                            playerId:
                                user.profile.id,

                            role:
                                'JUNGLE',

                        },


                        {

                            playerId:
                                user.profile.id,

                            role:
                                'MID',

                        },


                        {

                            playerId:
                                user.profile.id,

                            role:
                                'ADC',

                        },


                        {

                            playerId:
                                user.profile.id,

                            role:
                                'SUPPORT',

                        },

                    ],

                });


                return user;

            },

        );

    }


    /* =========================================================
       AUTH USER
    ========================================================= */

    async findAuthById(
        id: number,
    ) {

        return this.prisma.user.findUnique({

            where: {
                id,
            },


            select: {

                id:
                    true,

                username:
                    true,

                role:
                    true,

                status:
                    true,

            },

        });

    }

}