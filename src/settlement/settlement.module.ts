import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminSettlementController } from './admin-settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    AdminSettlementController,
  ],

  providers: [
    SettlementService,
  ],

  exports: [
    SettlementService,
  ],
})
export class SettlementModule {}