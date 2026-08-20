import {
    IsEnum,
    IsOptional,
    IsString,
    Matches,
} from 'class-validator';

import {
    RankTier,
} from '../../generated/prisma/enums';


export class UpdatePlayerRankDto {

    @IsEnum(
        RankTier,
    )
    rankTier: RankTier;


    @IsOptional()
    @IsString()
    @Matches(
        /^(I|II|III|IV)$/,
    )
    rankDivision?: string | null;

}