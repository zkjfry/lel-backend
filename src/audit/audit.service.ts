import { Injectable } from '@nestjs/common';

import {
  Prisma,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogInput {
  userId?: number | null;

  action: string;

  entityType: string;

  entityId?: number | string | null;

  oldValue?: Prisma.InputJsonObject;

  newValue?: Prisma.InputJsonObject;

  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async log(
    input: CreateAuditLogInput,
  ) {
    return this.create(
      this.prisma,
      input,
    );
  }

  async logWithTx(
    tx: Prisma.TransactionClient,
    input: CreateAuditLogInput,
  ) {
    return this.create(
      tx,
      input,
    );
  }

  private create(
    client:
      | PrismaService
      | Prisma.TransactionClient,

    input: CreateAuditLogInput,
  ) {
    return client.auditLog.create({
      data: {
        userId:
          input.userId ??
          null,

        action:
          input.action,

        entityType:
          input.entityType,

        entityId:
          input.entityId !==
          undefined &&
          input.entityId !==
          null
            ? String(
                input.entityId,
              )
            : null,

        ...(input.oldValue
          ? {
              oldValue:
                input.oldValue,
            }
          : {}),

        ...(input.newValue
          ? {
              newValue:
                input.newValue,
            }
          : {}),

        ipAddress:
          input.ipAddress ??
          null,
      },
    });
  }

  async findAll(params: {
    page: number;
    pageSize: number;
    action?: string;
    entityType?: string;
    userId?: number;
  }) {
    const {
      page,
      pageSize,
      action,
      entityType,
      userId,
    } = params;

    const skip =
      (page - 1) *
      pageSize;

    const where:
      Prisma.AuditLogWhereInput = {
      ...(action
        ? {
            action: {
              contains:
                action,

              mode:
                'insensitive',
            },
          }
        : {}),

      ...(entityType
        ? {
            entityType: {
              contains:
                entityType,

              mode:
                'insensitive',
            },
          }
        : {}),

      ...(userId
        ? {
            userId,
          }
        : {}),
    };

    const [total, items] =
      await Promise.all([
        this.prisma.auditLog.count({
          where,
        }),

        this.prisma.auditLog.findMany({
          where,

          skip,
          take:
            pageSize,

          orderBy: {
            createdAt:
              'desc',
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
        }),
      ]);

    return {
      page,
      pageSize,
      total,

      totalPages:
        Math.ceil(
          total /
            pageSize,
        ),

      items,
    };
  }
}