import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { DraftGateway } from './draft.gateway';

import type {
    AuthenticatedRequest,
} from '../auth/auth.guard';

import { DraftPickDto } from './dto/draft-pick.dto';
import { DraftService } from './draft.service';

@Controller(
    'tournaments/:tournamentId/draft',
)
export class DraftController {
    constructor(
        private readonly draftService:
            DraftService,

        private readonly draftGateway:
            DraftGateway,
    ) { }

    // 任何人都可以看选人大厅状态
    @Get()
    getState(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,
    ) {
        return this.draftService.getState(
            tournamentId,
        );
    }

    // 只有当前轮到的 Captain 才能成功 Pick
    @Post('pick')
    @UseGuards(AuthGuard)
    async pick(
        @Param(
            'tournamentId',
            ParseIntPipe,
        )
        tournamentId: number,

        @Body()
        dto: DraftPickDto,

        @Req()
        request: AuthenticatedRequest,
    ) {
        const result =
            await this.draftService.pick(
                tournamentId,
                dto.participantId,
                request.user.sub,
            );

        this.draftGateway.emitState(
            tournamentId,
            result.state,
        );

        return result;
    }
}