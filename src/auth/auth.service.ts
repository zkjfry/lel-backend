import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const username = dto.username.trim();

    const existingUsername =
      await this.usersService.findByUsername(username);

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    if (dto.email) {
      const existingEmail = await this.usersService.findByEmail(
        dto.email.toLowerCase(),
      );

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.usersService.createPlayer({
      username,
      email: dto.email?.toLowerCase(),
      passwordHash,
      displayName: dto.displayName.trim(),
    });

    const accessToken = await this.createAccessToken(user);

    return {
      accessToken,
      user: await this.usersService.findPublicById(user.id),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(
      dto.username.trim(),
    );

    if (!user) {
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'This account is not active',
      );
    }

    const accessToken = await this.createAccessToken(user);

    return {
      accessToken,
      user: await this.usersService.findPublicById(user.id),
    };
  }

  private async createAccessToken(user: {
    id: number;
    username: string;
    role: string;
  }) {
    return this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }
}