import {
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import type {
    AuthenticatedRequest,
} from '../auth/auth.guard';

import { RegistrationsService } from './registrations.service';

@Controller(
    'tournaments/:tournamentId/registrations',
)
@UseGuards(AuthGuard)
export class RegistrationsController {
    constructor(
        private readonly registrationsService:
            RegistrationsService,
    ) { }

    @Post()
    register(
        @Param('tournamentId', ParseIntPipe)
        tournamentId: number,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.registrationsService.register(
            tournamentId,
            request.user.sub,
        );
    }

    @Get('me')
    getMine(
        @Param('tournamentId', ParseIntPipe)
        tournamentId: number,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.registrationsService.getMine(
            tournamentId,
            request.user.sub,
        );
    }

    @Delete('me')
    withdraw(
        @Param('tournamentId', ParseIntPipe)
        tournamentId: number,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.registrationsService.withdraw(
            tournamentId,
            request.user.sub,
        );
    }

    @Post('check-in')
    checkIn(
        @Param('tournamentId', ParseIntPipe)
        tournamentId: number,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.registrationsService.checkIn(
            tournamentId,
            request.user.sub,
        );
    }
}