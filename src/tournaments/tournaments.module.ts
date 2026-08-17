import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminTournamentsController } from './admin-tournaments.controller';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

import {
  AuditModule,
} from '../audit/audit.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
  ],

  controllers: [
    TournamentsController,
    AdminTournamentsController,
  ],

  providers: [
    TournamentsService,
  ],

  exports: [
    TournamentsService,
  ],
})
export class TournamentsModule { }