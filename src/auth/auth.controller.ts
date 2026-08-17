import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

import {
    Throttle,
    ThrottlerGuard,
} from '@nestjs/throttler';

@Controller('auth')
@UseGuards(
    ThrottlerGuard,
)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) { }

    @Post('register')
    @Throttle({
        default: {
            limit: 5,
            ttl: 60000,
        },
    })
    register(
        @Body()
        dto: RegisterDto,
    ) {
        return this.authService.register(
            dto,
        );
    }
    @Post('login')
    @Throttle({
        default: {
            limit: 10,
            ttl: 60000,
        },
    })
    login(
        @Body()
        dto: LoginDto,
    ) {
        return this.authService.login(
            dto,
        );
    }

    @UseGuards(AuthGuard)
    @Get('me')
    async me(@Req() request: AuthenticatedRequest) {
        return this.usersService.findPublicById(
            request.user.sub,
        );
    }
}