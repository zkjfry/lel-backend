import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { MatchesService } from './matches.service';

@Controller(
  'tournaments/:tournamentId/matches',
)
export class MatchesController {
  constructor(
    private readonly matchesService:
      MatchesService,
  ) {}

  @Get()
  findAll(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,
  ) {
    return this.matchesService.findAll(
      tournamentId,
    );
  }

  @Get(':matchId')
  findOne(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,

    @Param(
      'matchId',
      ParseIntPipe,
    )
    matchId: number,
  ) {
    return this.matchesService.findOne(
      tournamentId,
      matchId,
    );
  }
}