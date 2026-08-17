import 'dotenv/config';
import {
    HttpException,
    Injectable,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import {
    MessageBody,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    ConnectedSocket,
    WsException,
} from '@nestjs/websockets';

import {
    Server,
    Socket,
} from 'socket.io';

import { UsersService } from '../users/users.service';
import { DraftService } from './draft.service';

interface SocketUser {
    id: number;
    username: string;
    role: string;
}

const socketCorsOrigins =
    (
        process.env
            .CORS_ORIGINS ??
        'http://localhost:5173'
    )
        .split(',')
        .map(
            (origin) =>
                origin.trim(),
        )
        .filter(Boolean);

@WebSocketGateway({
    cors: {
        origin:
            socketCorsOrigins,
    },
})
@Injectable()
export class DraftGateway
    implements OnGatewayInit {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly draftService: DraftService,
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
    ) { }

    // ============================================================
    // SOCKET CONNECTION AUTH
    // ============================================================

    afterInit(server: Server) {
        server.use(
            async (
                socket,
                next,
            ) => {
                const token =
                    socket.handshake.auth?.token as
                    | string
                    | undefined;

                // 没 Token 也允许连接：
                // 以后游客可以围观 Draft。
                if (!token) {
                    next();
                    return;
                }

                try {
                    const payload =
                        await this.jwtService.verifyAsync<{
                            sub: number;
                        }>(token);

                    const user =
                        await this.usersService.findAuthById(
                            payload.sub,
                        );

                    if (
                        !user ||
                        user.status !== 'ACTIVE'
                    ) {
                        next(
                            new Error(
                                'Unauthorized',
                            ),
                        );

                        return;
                    }

                    socket.data.user = {
                        id: user.id,
                        username:
                            user.username,
                        role: user.role,
                    } satisfies SocketUser;

                    next();
                } catch {
                    next(
                        new Error(
                            'Unauthorized',
                        ),
                    );
                }
            },
        );
    }

    // ============================================================
    // JOIN DRAFT ROOM
    // ============================================================

    @SubscribeMessage(
        'draft:join',
    )
    async joinDraft(
        @ConnectedSocket()
        client: Socket,

        @MessageBody()
        body: {
            tournamentId: number;
        },
    ) {
        const tournamentId =
            Number(
                body?.tournamentId,
            );

        if (
            !Number.isInteger(
                tournamentId,
            ) ||
            tournamentId <= 0
        ) {
            throw new WsException(
                'Invalid tournamentId',
            );
        }

        try {
            const state =
                await this.draftService.getState(
                    tournamentId,
                );

            const room =
                this.roomName(
                    tournamentId,
                );

            await client.join(
                room,
            );

            client.emit(
                'draft:state',
                state,
            );

            return {
                ok: true,
                tournamentId,
            };
        } catch (error) {
            throw this.toWsException(
                error,
            );
        }
    }

    // ============================================================
    // LEAVE ROOM
    // ============================================================

    @SubscribeMessage(
        'draft:leave',
    )
    async leaveDraft(
        @ConnectedSocket()
        client: Socket,

        @MessageBody()
        body: {
            tournamentId: number;
        },
    ) {
        const tournamentId =
            Number(
                body?.tournamentId,
            );

        if (
            Number.isInteger(
                tournamentId,
            )
        ) {
            await client.leave(
                this.roomName(
                    tournamentId,
                ),
            );
        }

        return {
            ok: true,
        };
    }

    // ============================================================
    // CAPTAIN PICK OVER SOCKET.IO
    // ============================================================

    @SubscribeMessage(
        'draft:pick',
    )
    async pickPlayer(
        @ConnectedSocket()
        client: Socket,

        @MessageBody()
        body: {
            tournamentId: number;
            participantId: number;
        },
    ) {
        const user =
            client.data.user as
            | SocketUser
            | undefined;

        if (!user) {
            throw new WsException(
                'Authentication required',
            );
        }

        const tournamentId =
            Number(
                body?.tournamentId,
            );

        const participantId =
            Number(
                body?.participantId,
            );

        if (
            !Number.isInteger(
                tournamentId,
            ) ||
            !Number.isInteger(
                participantId,
            ) ||
            tournamentId <= 0 ||
            participantId <= 0
        ) {
            throw new WsException(
                'Invalid draft pick data',
            );
        }

        try {
            // 真正选人的业务逻辑依然走原来的 DraftService。
            const result =
                await this.draftService.pick(
                    tournamentId,
                    participantId,
                    user.id,
                );

            // 广播最新完整状态
            this.emitState(
                tournamentId,
                result.state,
            );

            // 另外广播一个轻量事件，
            // 前端以后可以用它做动画/提示。
            this.server
                .to(
                    this.roomName(
                        tournamentId,
                    ),
                )
                .emit(
                    'draft:picked',
                    {
                        tournamentId,
                        pick:
                            result.pick,
                        completed:
                            result.completed,
                    },
                );

            return {
                ok: true,
                completed:
                    result.completed,
            };
        } catch (error) {
            throw this.toWsException(
                error,
            );
        }
    }

    // ============================================================
    // PUBLIC BROADCAST HELPERS
    // ============================================================

    emitState(
        tournamentId: number,
        state: unknown,
    ) {
        this.server
            .to(
                this.roomName(
                    tournamentId,
                ),
            )
            .emit(
                'draft:state',
                state,
            );
    }

    async broadcastState(
        tournamentId: number,
    ) {
        const state =
            await this.draftService.getState(
                tournamentId,
            );

        this.emitState(
            tournamentId,
            state,
        );

        return state;
    }

    private roomName(
        tournamentId: number,
    ) {
        return `draft:${tournamentId}`;
    }

    private toWsException(
        error: unknown,
    ) {
        if (
            error instanceof
            HttpException
        ) {
            return new WsException(
                error.message,
            );
        }

        if (
            error instanceof Error
        ) {
            return new WsException(
                error.message,
            );
        }

        return new WsException(
            'Draft operation failed',
        );
    }
}