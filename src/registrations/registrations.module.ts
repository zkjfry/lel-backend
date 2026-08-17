import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AdminRegistrationsController } from './admin-registrations.controller';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    RegistrationsController,
    AdminRegistrationsController,
  ],

  providers: [
    RegistrationsService,
  ],

  exports: [
    RegistrationsService,
  ],
})
export class RegistrationsModule {}