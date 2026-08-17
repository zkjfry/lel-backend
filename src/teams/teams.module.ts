import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminTeamsController } from './admin-teams.controller';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    TeamsController,
    AdminTeamsController,
  ],

  providers: [
    TeamsService,
  ],

  exports: [
    TeamsService,
  ],
})
export class TeamsModule {}