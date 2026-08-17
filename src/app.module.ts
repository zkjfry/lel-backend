import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { PlayersModule } from './players/players.module';
import { TeamsModule } from './teams/teams.module';
import { DraftModule } from './draft/draft.module';
import { MatchesModule } from './matches/matches.module';
import { SettlementModule } from './settlement/settlement.module';
import { RankingsModule } from './rankings/rankings.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    UsersModule,
    AuthModule,
    AdminModule,
    TournamentsModule,
    RegistrationsModule,
    PlayersModule,
    TeamsModule,
    DraftModule,
    MatchesModule,
    SettlementModule,
    RankingsModule,
    AuditModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}