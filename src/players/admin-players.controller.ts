import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';

import type {
    AuthenticatedRequest,
} from '../auth/auth.guard';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import {
    UserRole,
    UserStatus,
} from '../generated/prisma/enums';

import { AdminPlayerQueryDto } from './dto/admin-player-query.dto';

import { UpdatePlayerRoleDto } from './dto/update-player-role.dto';

import { UpdatePlayerStatusDto } from './dto/update-player-status.dto';

import { PlayersService } from './players.service';

@Controller('admin/players')
@UseGuards(
    AuthGuard,
    RolesGuard,
)
@Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
)
export class AdminPlayersController {
    constructor(
        private readonly playersService:
            PlayersService,
    ) { }

    // ------------------------------------------------------------
    // OPTIONS
    // ------------------------------------------------------------

    @Get('meta/options')
    getOptions() {
        return {
            roles:
                Object.values(
                    UserRole,
                ),

            statuses:
                Object.values(
                    UserStatus,
                ),
        };
    }

    // ------------------------------------------------------------
    // LIST
    // ------------------------------------------------------------

    @Get()
    findAll(
        @Query()
        query: AdminPlayerQueryDto,
    ) {
        return this.playersService.adminFindAll(
            query,
        );
    }

    // ------------------------------------------------------------
    // POINT TRANSACTIONS
    // ------------------------------------------------------------

    @Get(':playerId/points')
    getPoints(
        @Param(
            'playerId',
            ParseIntPipe,
        )
        playerId: number,

        @Query('page')
        page?: string,

        @Query('pageSize')
        pageSize?: string,
    ) {
        return this.playersService.adminGetPointTransactions(
            playerId,

            Math.max(
                1,
                Number(page) || 1,
            ),

            Math.min(
                100,
                Math.max(
                    1,
                    Number(pageSize) ||
                    20,
                ),
            ),
        );
    }

    // ------------------------------------------------------------
    // STATUS
    // ------------------------------------------------------------

    @Patch(':playerId/status')
    updateStatus(
        @Param(
            'playerId',
            ParseIntPipe,
        )
        playerId: number,

        @Body()
        dto: UpdatePlayerStatusDto,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.playersService.adminUpdateStatus(
            playerId,
            dto.status,
            request.user.sub,
            request.user.role,
            this.getIpAddress(
                request,
            ),
        );
    }

    // ------------------------------------------------------------
    // ROLE - SUPER_ADMIN ONLY
    // ------------------------------------------------------------

    @Patch(':playerId/role')
    @Roles(
        UserRole.SUPER_ADMIN,
    )
    updateRole(
        @Param(
            'playerId',
            ParseIntPipe,
        )
        playerId: number,

        @Body()
        dto: UpdatePlayerRoleDto,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.playersService.adminUpdateRole(
            playerId,
            dto.role,
            request.user.sub,
            this.getIpAddress(
                request,
            ),
        );
    }

    // ------------------------------------------------------------
    // DETAIL
    // Keep dynamic route last
    // ------------------------------------------------------------

    @Get(':playerId')
    findOne(
        @Param(
            'playerId',
            ParseIntPipe,
        )
        playerId: number,
    ) {
        return this.playersService.adminFindOne(
            playerId,
        );
    }

    private getIpAddress(
        request:
            AuthenticatedRequest,
    ) {
        const forwarded =
            request.headers[
            'x-forwarded-for'
            ];

        if (
            typeof forwarded ===
            'string'
        ) {
            return forwarded
                .split(',')[0]
                ?.trim();
        }

        return request.ip;
    }
}