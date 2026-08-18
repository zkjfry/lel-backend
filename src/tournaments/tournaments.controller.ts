import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard';

import {
  Roles,
} from '../auth/roles.decorator';

import {
  RolesGuard,
} from '../auth/roles.guard';

import {
  UserRole,
} from '../generated/prisma/enums';

import {
  CreateTournamentDto,
} from './dto/create-tournament.dto';

import {
  UpdateTournamentStatusDto,
} from './dto/update-tournament-status.dto';

import {
  TournamentsService,
} from './tournaments.service';


@Controller('tournaments')
export class TournamentsController {

  constructor(
    private readonly tournamentsService:
      TournamentsService,
  ) {}


  /* =========================================================
     PUBLIC: TOURNAMENT LIST
  ========================================================= */

  @Get()
  findAll() {

    return this.tournamentsService.findAll();

  }


  /* =========================================================
     ADMIN: CREATE TOURNAMENT
  ========================================================= */

  @Post()
  @UseGuards(
    AuthGuard,
    RolesGuard,
  )
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(
    @Body()
    dto: CreateTournamentDto,

    @Req()
    request: AuthenticatedRequest,
  ) {

    return this.tournamentsService.create(
      dto,
      request.user.sub,
    );

  }


  /* =========================================================
     ADMIN: UPDATE TOURNAMENT STATUS
  ========================================================= */

  @Patch(':id/status')
  @UseGuards(
    AuthGuard,
    RolesGuard,
  )
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  updateStatus(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Body()
    dto: UpdateTournamentStatusDto,

    @Req()
    request: AuthenticatedRequest,
  ) {

    return this.tournamentsService.updateStatus(
      id,
      dto.status,
      request.user.sub,
    );

  }


  /* =========================================================
     PUBLIC: TOURNAMENT DETAIL
  ========================================================= */

  @Get(':id')
  findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {

    return this.tournamentsService.findOne(
      id,
    );

  }

}