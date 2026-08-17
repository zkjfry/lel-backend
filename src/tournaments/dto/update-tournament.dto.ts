import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  MatchFormat,
  TournamentFormat,
} from '../../generated/prisma/enums';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsISO8601()
  registrationStart?: string;

  @IsOptional()
  @IsISO8601()
  registrationEnd?: string;

  @IsOptional()
  @IsISO8601()
  checkinStart?: string;

  @IsOptional()
  @IsISO8601()
  checkinEnd?: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxWaitlist?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(32)
  teamCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  playersPerTeam?: number;

  @IsOptional()
  @IsEnum(MatchFormat)
  matchFormat?: MatchFormat;

  @IsOptional()
  @IsEnum(TournamentFormat)
  tournamentFormat?: TournamentFormat;
}