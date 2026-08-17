import { IsEnum } from 'class-validator';

import {
  UserRole,
} from '../../generated/prisma/enums';

export class UpdatePlayerRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}