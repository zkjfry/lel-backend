import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminDraftController } from './admin-draft.controller';
import { DraftController } from './draft.controller';

import { DraftService } from './draft.service';
import { DraftGateway } from './draft.gateway';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    DraftController,
    AdminDraftController,
  ],

  providers: [
    DraftService,
    DraftGateway,
  ],

  exports: [
    DraftService,
    DraftGateway,
  ],
})
export class DraftModule {}