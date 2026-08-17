import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';

import type {
  AuthenticatedRequest,
} from '../auth/auth.guard';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { PlayersService } from './players.service';

@Controller('players')
export class PlayersController {
  constructor(
    private readonly playersService:
      PlayersService,
  ) {}

  // ============================================================
  // MY PROFILE DATA
  // ============================================================

  @Get('me')
  @UseGuards(AuthGuard)
  getMine(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.playersService.getMine(
      request.user.sub,
    );
  }

  // ============================================================
  // EDIT MY PROFILE
  // ============================================================

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMine(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: UpdateProfileDto,
  ) {
    return this.playersService.updateMine(
      request.user.sub,
      dto,
    );
  }

  // ============================================================
  // PUBLIC PROFILE
  // Keep dynamic route after /me
  // ============================================================

  @Get(':playerId')
  getPublicProfile(
    @Param(
      'playerId',
      ParseIntPipe,
    )
    playerId: number,
  ) {
    return this.playersService.getPublicProfile(
      playerId,
    );
  }
}