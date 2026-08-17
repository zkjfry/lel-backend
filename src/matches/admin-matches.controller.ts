import {
    Controller,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
    Body,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RecordGameResultDto } from './dto/record-game-result.dto';

import { UserRole } from '../generated/prisma/enums';

import { MatchesService } from './matches.service';

@Controller(
    'admin/tournaments/:tournamentId/matches',
)
@UseGuards(
    AuthGuard,
    RolesGuard,
)
@Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
)
export class AdminMatchesController {
    constructor(
        private readonly matchesService:
            MatchesService,
    ) { }

    @Post('generate')
    generate(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,
    ) {
        return this.matchesService.generateBracket(
            tournamentId,
        );
    }

    @Post(':matchId/games')
    recordGameResult(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Param(
            'matchId',
            ParseIntPipe,
        )
        matchId: number,

        @Body()
        dto: RecordGameResultDto,
    ) {
        return this.matchesService.recordGameResult(
            tournamentId,
            matchId,
            dto,
        );
    }
}