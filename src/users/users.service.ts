import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findByUsername(username: string) {
        return this.prisma.user.findUnique({
            where: { username },
            include: {
                profile: true,
            },
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findPublicById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
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
                        riotRegion: true,
                        rankTier: true,
                        rankDivision: true,
                        mainRole: true,
                        secondaryRole: true,
                        yyName: true,
                        bio: true,
                    },
                },
            },
        });
    }

    async createPlayer(data: {
        username: string;
        email?: string;
        passwordHash: string;
        displayName: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username: data.username,
                    email: data.email,
                    passwordHash: data.passwordHash,

                    profile: {
                        create: {
                            displayName: data.displayName,
                        },
                    },
                },
                include: {
                    profile: true,
                },
            });

            if (!user.profile) {
                throw new Error('Player profile creation failed');
            }

            await tx.playerStats.create({
                data: {
                    playerId: user.profile.id,
                },
            });

            await tx.playerRoleRating.createMany({
                data: [
                    {
                        playerId: user.profile.id,
                        role: 'TOP',
                    },
                    {
                        playerId: user.profile.id,
                        role: 'JUNGLE',
                    },
                    {
                        playerId: user.profile.id,
                        role: 'MID',
                    },
                    {
                        playerId: user.profile.id,
                        role: 'ADC',
                    },
                    {
                        playerId: user.profile.id,
                        role: 'SUPPORT',
                    },
                ],
            });

            return user;
        });
    }

    async findAuthById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                role: true,
                status: true,
            },
        });
    }
}