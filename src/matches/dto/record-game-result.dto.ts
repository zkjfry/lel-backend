import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordGameResultDto {
  @IsInt()
  @Min(1)
  winnerTeamId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mvpParticipantId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  svpParticipantId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resultImageUrl?: string;
}