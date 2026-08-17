import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Query,
} from '@nestjs/common';

import {
  PlayerRole,
} from '../generated/prisma/enums';

import {
  RankingQueryDto,
} from './dto/ranking-query.dto';

import {
  RankingsService,
} from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(
    private readonly rankingsService:
      RankingsService,
  ) {}

  @Get()
  getRanking(
    @Query()
    query: RankingQueryDto,
  ) {
    return this.rankingsService.getRanking(
      query,
    );
  }

  @Get('overview')
  getOverview() {
    return this.rankingsService.getOverview();
  }

  @Get('roles/:role')
  getRoleRanking(
    @Param(
      'role',
      new ParseEnumPipe(
        PlayerRole,
      ),
    )
    role: PlayerRole,

    @Query('page')
    page?: string,

    @Query('pageSize')
    pageSize?: string,
  ) {
    const parsedPage =
      Math.max(
        1,
        Number(page) || 1,
      );

    const parsedPageSize =
      Math.min(
        100,
        Math.max(
          1,
          Number(
            pageSize,
          ) || 20,
        ),
      );

    return this.rankingsService.getRoleRanking(
      role,
      parsedPage,
      parsedPageSize,
    );
  }
}