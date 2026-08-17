import { IsEnum } from 'class-validator';

import { TournamentStatus } from '../../generated/prisma/enums';

export class UpdateTournamentStatusDto {
  @IsEnum(TournamentStatus)
  status: TournamentStatus;
}