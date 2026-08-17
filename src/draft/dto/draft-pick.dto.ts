import { IsInt, Min } from 'class-validator';

export class DraftPickDto {
  @IsInt()
  @Min(1)
  participantId: number;
}