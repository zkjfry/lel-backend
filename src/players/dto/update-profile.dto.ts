import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PlayerRole,
  RankTier,
} from '../../generated/prisma/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  riotGameName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  riotTagLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  riotRegion?: string;

  @IsOptional()
  @IsEnum(RankTier)
  rankTier?: RankTier;

  @IsOptional()
  @IsString()
  @Matches(/^(I|II|III|IV)$/)
  rankDivision?: string;

  @IsOptional()
  @IsEnum(PlayerRole)
  mainRole?: PlayerRole;

  @IsOptional()
  @IsEnum(PlayerRole)
  secondaryRole?: PlayerRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  yyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}