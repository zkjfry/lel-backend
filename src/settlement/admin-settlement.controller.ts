import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UserRole } from '../generated/prisma/enums';

import { SettlementService } from './settlement.service';

@Controller(
  'admin/tournaments/:tournamentId/settlement',
)
@UseGuards(
  AuthGuard,
  RolesGuard,
)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
)
export class AdminSettlementController {
  constructor(
    private readonly settlementService:
      SettlementService,
  ) {}

  @Post()
  settle(
    @Param(
      'tournamentId',
      ParseIntPipe,
    )
    tournamentId: number,
  ) {
    return this.settlementService.settleTournament(
      tournamentId,
    );
  }
}