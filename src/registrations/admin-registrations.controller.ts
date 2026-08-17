import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UserRole } from '../generated/prisma/enums';

import { RegistrationsService } from './registrations.service';

@Controller(
  'admin/tournaments/:tournamentId/registrations',
)
@UseGuards(AuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
)
export class AdminRegistrationsController {
  constructor(
    private readonly registrationsService:
      RegistrationsService,
  ) { }

  @Get()
  getList(
    @Param('tournamentId', ParseIntPipe)
    tournamentId: number,
  ) {
    return this.registrationsService.getAdminList(
      tournamentId,
    );
  }

  @Post('finalize')
  finalizeParticipants(
    @Param('tournamentId', ParseIntPipe)
    tournamentId: number,
  ) {
    return this.registrationsService.finalizeParticipants(
      tournamentId,
    );
  }
}