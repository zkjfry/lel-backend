import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminPlayersController } from './admin-players.controller';

import { PlayersController } from './players.controller';

import { PlayersService } from './players.service';

import {
  AuditModule,
} from '../audit/audit.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
  ],

  controllers: [
    PlayersController,
    AdminPlayersController,
  ],

  providers: [
    PlayersService,
  ],

  exports: [
    PlayersService,
  ],
})
export class PlayersModule { }