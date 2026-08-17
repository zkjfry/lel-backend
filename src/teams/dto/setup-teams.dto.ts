import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
} from 'class-validator';

export class SetupTeamsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsInt({ each: true })
  captainParticipantIds: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsInt({ each: true })
  teamTemplateIds?: number[];
}