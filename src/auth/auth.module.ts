import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import {
  ThrottlerModule,
} from '@nestjs/throttler';

@Module({
  imports: [
    UsersModule,

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 120,
        },
      ],
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: Number(
            configService.get(
              'JWT_EXPIRES_IN_SECONDS',
              '604800',
            ),
          ),
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    AuthGuard,
    RolesGuard,
  ],

  exports: [
    AuthGuard,
    RolesGuard,
    JwtModule,
    UsersModule,
  ],
})
export class AuthModule { }