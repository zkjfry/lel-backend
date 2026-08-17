import {
    Controller,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DraftGateway } from './draft.gateway';

import { UserRole } from '../generated/prisma/enums';

import { DraftService } from './draft.service';

@Controller(
    'admin/tournaments/:tournamentId/draft',
)
@UseGuards(
    AuthGuard,
    RolesGuard,
)
@Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
)
export class AdminDraftController {
    constructor(
        private readonly draftService:
            DraftService,

        private readonly draftGateway:
            DraftGateway,
    ) { }

    @Post('start')
    async start(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,
    ) {
        const session =
            await this.draftService.start(
                tournamentId,
            );

        await this.draftGateway.broadcastState(
            tournamentId,
        );

        return session;
    }
}