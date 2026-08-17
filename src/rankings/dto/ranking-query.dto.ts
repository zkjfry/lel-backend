import { Type } from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum RankingType {
  POINTS = 'points',
  CHAMPIONSHIPS = 'championships',
  WINS = 'wins',
  MVP = 'mvp',
  SVP = 'svp',
  WINRATE = 'winrate',
}

export class RankingQueryDto {
  @IsOptional()
  @IsEnum(RankingType)
  type: RankingType = RankingType.POINTS;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}