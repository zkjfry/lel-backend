import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UserRole } from '../generated/prisma/enums';

import { SetupTeamsDto } from './dto/setup-teams.dto';
import { TeamsService } from './teams.service';

@Controller(
  'admin/tournaments/:tournamentId',
)
@UseGuards(
  AuthGuard,
  RolesGuard,
)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
)
export class AdminTeamsController {
  constructor(
    private readonly teamsService:
      TeamsService,
  ) {}

  @Get('participants')
  getParticipants(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,
  ) {
    return this.teamsService.getParticipants(
      tournamentId,
    );
  }

  @Post('teams/setup')
  setupTeams(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,

    @Body()
    dto: SetupTeamsDto,
  ) {
    return this.teamsService.setupTeams(
      tournamentId,
      dto,
    );
  }
}