import { IsEnum } from 'class-validator';

import {
  UserStatus,
} from '../../generated/prisma/enums';

export class UpdatePlayerStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}