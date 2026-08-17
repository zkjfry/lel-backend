import {
    INestApplication,
    ValidationPipe,
} from '@nestjs/common';

import {
    Test,
    TestingModule,
} from '@nestjs/testing';

import request from 'supertest';

import { AppModule } from '../src/app.module';

import {
    PrismaService,
} from '../src/prisma/prisma.service';

import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from '@jest/globals';

describe(
    'LEL Backend Smoke Tests',
    () => {
        let app!: INestApplication;
        let prisma!: PrismaService;
        let playerToken: string;
        let adminToken: string;

        let adminUserId: number;

        let testTournamentId:
            | number
            | null = null;

        const testSlug =
            `lel-e2e-${Date.now()}`;

        // ==========================================================
        // SETUP
        // ==========================================================

        beforeAll(
            async () => {
                const moduleFixture:
                    TestingModule =
                    await Test
                        .createTestingModule({
                            imports: [
                                AppModule,
                            ],
                        })
                        .compile();

                app =
                    moduleFixture
                        .createNestApplication();

                // main.ts is NOT executed by createNestApplication(),
                // so reproduce the relevant global settings here.

                app.setGlobalPrefix(
                    'api',
                );

                app.useGlobalPipes(
                    new ValidationPipe({
                        whitelist: true,

                        forbidNonWhitelisted:
                            true,

                        transform: true,
                    }),
                );

                await app.init();

                prisma =
                    app.get(
                        PrismaService,
                    );
            },
            30000,
        );

        // ==========================================================
        // PUBLIC API
        // ==========================================================

        it(
            'GET /api/health -> 200',
            async () => {
                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/health',
                        )
                        .expect(200);

                expect(
                    response.body.status,
                ).toBe('ok');

                expect(
                    response.body.service,
                ).toBe(
                    'lel-backend',
                );
            },
        );

        it(
            'GET /api/rankings -> returns ranking data',
            async () => {
                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/rankings?type=points',
                        )
                        .expect(200);

                expect(
                    response.body,
                ).toHaveProperty(
                    'items',
                );

                expect(
                    Array.isArray(
                        response.body.items,
                    ),
                ).toBe(true);
            },
        );

        it(
            'GET public player profile -> 200',
            async () => {
                const ranking =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/rankings?type=points',
                        )
                        .expect(200);

                expect(
                    ranking.body.items.length,
                ).toBeGreaterThan(0);

                const playerId =
                    ranking.body
                        .items[0]
                        .playerId;

                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            `/api/players/${playerId}`,
                        )
                        .expect(200);

                expect(
                    response.body.player.id,
                ).toBe(
                    playerId,
                );

                expect(
                    response.body,
                ).toHaveProperty(
                    'stats',
                );

                expect(
                    response.body,
                ).toHaveProperty(
                    'roleRatings',
                );
            },
        );

        // ==========================================================
        // PLAYER AUTH
        // ==========================================================

        it(
            'PLAYER can login',
            async () => {
                const username =
                    process.env
                        .TEST_PLAYER_USERNAME;

                const password =
                    process.env
                        .TEST_PLAYER_PASSWORD;

                expect(
                    username,
                ).toBeTruthy();

                expect(
                    password,
                ).toBeTruthy();

                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .post(
                            '/api/auth/login',
                        )
                        .send({
                            username,
                            password,
                        })
                        .expect(201);

                expect(
                    response.body
                        .accessToken,
                ).toBeTruthy();

                playerToken =
                    response.body
                        .accessToken;
            },
        );

        it(
            'PLAYER can access /players/me',
            async () => {
                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/players/me',
                        )
                        .set(
                            'Authorization',
                            `Bearer ${playerToken}`,
                        )
                        .expect(200);

                expect(
                    response.body,
                ).toHaveProperty(
                    'user',
                );
            },
        );

        // ==========================================================
        // RBAC
        // ==========================================================

        it(
            'Unauthenticated user cannot access Admin API',
            async () => {
                await request(
                    app.getHttpServer(),
                )
                    .get(
                        '/api/admin/players',
                    )
                    .expect(401);
            },
        );

        it(
            'PLAYER cannot access Admin API',
            async () => {
                await request(
                    app.getHttpServer(),
                )
                    .get(
                        '/api/admin/players',
                    )
                    .set(
                        'Authorization',
                        `Bearer ${playerToken}`,
                    )
                    .expect(403);
            },
        );

        // ==========================================================
        // SUPER ADMIN
        // ==========================================================

        it(
            'SUPER_ADMIN can login',
            async () => {
                const username =
                    process.env
                        .TEST_ADMIN_USERNAME;

                const password =
                    process.env
                        .TEST_ADMIN_PASSWORD;

                expect(
                    username,
                ).toBeTruthy();

                expect(
                    password,
                ).toBeTruthy();

                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .post(
                            '/api/auth/login',
                        )
                        .send({
                            username,
                            password,
                        })
                        .expect(201);

                adminToken =
                    response.body
                        .accessToken;

                expect(
                    adminToken,
                ).toBeTruthy();

                const admin =
                    await prisma
                        .user
                        .findUnique({
                            where: {
                                username:
                                    username!,
                            },

                            select: {
                                id: true,
                                role: true,
                            },
                        });

                expect(
                    admin,
                ).not.toBeNull();

                expect(
                    admin!.role,
                ).toBe(
                    'SUPER_ADMIN',
                );

                adminUserId =
                    admin!.id;
            },
        );

        it(
            'SUPER_ADMIN can access player management',
            async () => {
                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/admin/players?page=1&pageSize=5',
                        )
                        .set(
                            'Authorization',
                            `Bearer ${adminToken}`,
                        )
                        .expect(200);

                expect(
                    response.body,
                ).toHaveProperty(
                    'items',
                );
            },
        );

        it(
            'SUPER_ADMIN can access audit logs',
            async () => {
                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .get(
                            '/api/admin/audit-logs?page=1&pageSize=5',
                        )
                        .set(
                            'Authorization',
                            `Bearer ${adminToken}`,
                        )
                        .expect(200);

                expect(
                    response.body,
                ).toHaveProperty(
                    'items',
                );
            },
        );

        // ==========================================================
        // TOURNAMENT STATE MACHINE
        // ==========================================================

        it(
            'creates isolated E2E tournament',
            async () => {
                const tournament =
                    await prisma
                        .tournament
                        .create({
                            data: {
                                name:
                                    'LEL E2E Smoke Test',

                                slug:
                                    testSlug,

                                createdById:
                                    adminUserId,
                            },
                        });

                testTournamentId =
                    tournament.id;

                expect(
                    tournament.status,
                ).toBe(
                    'DRAFT',
                );
            },
        );

        it(
            'allows DRAFT -> REGISTRATION_OPEN',
            async () => {
                expect(
                    testTournamentId,
                ).not.toBeNull();

                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .patch(
                            `/api/admin/tournaments/${testTournamentId}/status`,
                        )
                        .set(
                            'Authorization',
                            `Bearer ${adminToken}`,
                        )
                        .send({
                            status:
                                'REGISTRATION_OPEN',
                        })
                        .expect(200);

                expect(
                    response.body.status,
                ).toBe(
                    'REGISTRATION_OPEN',
                );
            },
        );

        it(
            'rejects illegal REGISTRATION_OPEN -> COMPLETED',
            async () => {
                expect(
                    testTournamentId,
                ).not.toBeNull();

                const response =
                    await request(
                        app.getHttpServer(),
                    )
                        .patch(
                            `/api/admin/tournaments/${testTournamentId}/status`,
                        )
                        .set(
                            'Authorization',
                            `Bearer ${adminToken}`,
                        )
                        .send({
                            status:
                                'COMPLETED',
                        })
                        .expect(400);

                expect(
                    String(
                        response.body
                            .message,
                    ),
                ).toContain(
                    'Invalid tournament status transition',
                );
            },
        );

        // ==========================================================
        // AUDIT
        // ==========================================================

        it(
            'writes AuditLog for successful status change',
            async () => {
                expect(
                    testTournamentId,
                ).not.toBeNull();

                const audit =
                    await prisma
                        .auditLog
                        .findFirst({
                            where: {
                                action:
                                    'TOURNAMENT_STATUS_CHANGED',

                                entityType:
                                    'Tournament',

                                entityId:
                                    String(
                                        testTournamentId,
                                    ),
                            },

                            orderBy: {
                                createdAt:
                                    'desc',
                            },
                        });

                expect(
                    audit,
                ).not.toBeNull();

                expect(
                    audit!.userId,
                ).toBe(
                    adminUserId,
                );

                expect(
                    audit!.oldValue,
                ).toMatchObject({
                    status:
                        'DRAFT',
                });

                expect(
                    audit!.newValue,
                ).toMatchObject({
                    status:
                        'REGISTRATION_OPEN',
                });
            },
        );

        // ==========================================================
        // CLEANUP
        // ==========================================================

        afterAll(
            async () => {
                try {
                    if (prisma) {
                        if (
                            testTournamentId
                        ) {
                            await prisma.auditLog.deleteMany({
                                where: {
                                    entityType:
                                        'Tournament',

                                    entityId:
                                        String(
                                            testTournamentId,
                                        ),
                                },
                            });

                            await prisma.tournament.deleteMany({
                                where: {
                                    id:
                                        testTournamentId,
                                },
                            });
                        } else {
                            await prisma.tournament.deleteMany({
                                where: {
                                    slug:
                                        testSlug,
                                },
                            });
                        }
                    }
                } finally {
                    if (app) {
                        await app.close();
                    }
                }
            },
            30000,
        );
    },
);