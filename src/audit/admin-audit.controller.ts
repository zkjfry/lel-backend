import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '../auth/auth.guard';

import {
  Roles,
} from '../auth/roles.decorator';

import {
  RolesGuard,
} from '../auth/roles.guard';

import {
  UserRole,
} from '../generated/prisma/enums';

import {
  AuditQueryDto,
} from './dto/audit-query.dto';

import {
  AuditService,
} from './audit.service';

@Controller(
  'admin/audit-logs',
)
@UseGuards(
  AuthGuard,
  RolesGuard,
)
@Roles(
  UserRole.SUPER_ADMIN,
)
export class AdminAuditController {
  constructor(
    private readonly auditService:
      AuditService,
  ) {}

  @Get()
  findAll(
    @Query()
    query: AuditQueryDto,
  ) {
    return this.auditService.findAll({
      page:
        query.page ?? 1,

      pageSize:
        query.pageSize ??
        20,

      action:
        query.action,

      entityType:
        query.entityType,

      userId:
        query.userId,
    });
  }
}