import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  getHello() {
    return {
      name: 'LEL API',
      status: 'running',
    };
  }

  @Get('health/database')
  async databaseHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      database: 'connected',
      environment: 'dev',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',

      service:
        'lel-backend',

      timestamp:
        new Date()
          .toISOString(),
    };
  }
}