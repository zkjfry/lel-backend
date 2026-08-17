import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { UsersService } from '../users/users.service';
import type {
  UserRole,
  UserStatus,
} from '../generated/prisma/enums';

interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}

export interface AuthenticatedUser {
  sub: number;
  username: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(token);

      const user =
        await this.usersService.findAuthById(payload.sub);

      if (!user) {
        throw new UnauthorizedException(
          'User no longer exists',
        );
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException(
          'This account is not active',
        );
      }

      request.user = {
        sub: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Invalid or expired token',
      );
    }
  }

  private extractTokenFromHeader(
    request: Request,
  ): string | undefined {
    const [type, token] =
      request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}