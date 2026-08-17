import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminMatchesController } from './admin-matches.controller';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    MatchesController,
    AdminMatchesController,
  ],

  providers: [
    MatchesService,
  ],

  exports: [
    MatchesService,
  ],
})
export class MatchesModule {}