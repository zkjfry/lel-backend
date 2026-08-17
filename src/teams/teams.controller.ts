import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { TeamsService } from './teams.service';

@Controller()
export class TeamsController {
  constructor(
    private readonly teamsService:
      TeamsService,
  ) {}

  @Get('team-templates')
  getTeamTemplates() {
    return this.teamsService.getTeamTemplates();
  }

  @Get('tournaments/:tournamentId/teams')
  getTournamentTeams(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,
  ) {
    return this.teamsService.getTournamentTeams(
      tournamentId,
    );
  }
}