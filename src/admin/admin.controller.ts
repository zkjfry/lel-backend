import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../generated/prisma/enums';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  @Get('ping')
  ping() {
    return {
      admin: true,
      message: 'LEL Admin API is working',
    };
  }
}