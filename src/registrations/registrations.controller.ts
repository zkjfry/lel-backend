import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    AuthGuard,
} from '../auth/auth.guard';

import type {
    AuthenticatedRequest,
} from '../auth/auth.guard';

import {
    RegisterTournamentDto,
} from './dto/register-tournament.dto';

import {
    RegistrationsService,
} from './registrations.service';


@Controller(
    'tournaments/:tournamentId/registrations',
)
@UseGuards(AuthGuard)
export class RegistrationsController {

    constructor(
        private readonly registrationsService:
            RegistrationsService,
    ) { }


    /* =========================================================
       REGISTER
    ========================================================= */

    @Post()
    register(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Body()
        dto:
            RegisterTournamentDto,

        @Req()
        request:
            AuthenticatedRequest,
    ) {

        return this.registrationsService.register(
            tournamentId,
            request.user.sub,
            dto,
        );

    }


    /* =========================================================
       MY REGISTRATION
    ========================================================= */

    @Get('me')
    getMine(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Req()
        request:
            AuthenticatedRequest,
    ) {

        return this.registrationsService.getMine(
            tournamentId,
            request.user.sub,
        );

    }


    /* =========================================================
       WITHDRAW
    ========================================================= */

    @Delete('me')
    withdraw(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Req()
        request:
            AuthenticatedRequest,
    ) {

        return this.registrationsService.withdraw(
            tournamentId,
            request.user.sub,
        );

    }


    /* =========================================================
       CHECK IN
    ========================================================= */

    @Post('check-in')
    checkIn(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Req()
        request:
            AuthenticatedRequest,
    ) {

        return this.registrationsService.checkIn(
            tournamentId,
            request.user.sub,
        );

    }

}