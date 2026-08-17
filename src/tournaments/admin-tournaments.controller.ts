import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/enums';

import {
  AuthGuard,
} from '../auth/auth.guard';
import type {
  AuthenticatedRequest,
} from '../auth/auth.guard';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';

import { TournamentsService } from './tournaments.service';

@Controller('admin/tournaments')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminTournamentsController {
  constructor(
    private readonly tournamentsService:
      TournamentsService,
  ) { }

  @Post()
  create(
    @Body() dto: CreateTournamentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tournamentsService.create(
      dto,
      request.user.sub,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(
      id,
      dto,
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Param(
      'id',
      ParseIntPipe,
    )
    tournamentId: number,

    @Body()
    dto:
      UpdateTournamentStatusDto,

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.tournamentsService.updateStatus(
      tournamentId,

      dto.status,

      request.user.sub,

      this.getIpAddress(
        request,
      ),
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