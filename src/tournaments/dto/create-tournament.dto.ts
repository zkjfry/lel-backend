import {
    Equals,
    IsDateString,
    IsDivisibleBy,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

import {
    MatchFormat,
    TournamentFormat,
} from '../../generated/prisma/enums';


export class CreateTournamentDto {

    /* =========================================================
       BASIC INFORMATION
    ========================================================= */

    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name: string;


    @IsOptional()
    @IsString()
    description?: string;


    /* =========================================================
       REGISTRATION
    ========================================================= */

    @IsOptional()
    @IsDateString()
    registrationStart?: string;


    @IsOptional()
    @IsDateString()
    registrationEnd?: string;


    /* =========================================================
       CHECK-IN

       LEL V1 currently does not use check-in,
       but these fields remain for schema compatibility.
    ========================================================= */

    @IsOptional()
    @IsDateString()
    checkinStart?: string;


    @IsOptional()
    @IsDateString()
    checkinEnd?: string;


    /* =========================================================
       TOURNAMENT START
    ========================================================= */

    @IsOptional()
    @IsDateString()
    startTime?: string;


    /* =========================================================
       TOURNAMENT SIZE

       LEL rules:

       - exactly 5 players per team
       - team count must be even
       - max players must be a multiple of 10
       - maxPlayers = teamCount × playersPerTeam

       Valid examples:

       10 players / 2 teams
       20 players / 4 teams
       30 players / 6 teams
       40 players / 8 teams
    ========================================================= */

    @IsOptional()
    @IsInt()
    @Min(10)
    @IsDivisibleBy(10, {
        message:
            'maxPlayers must be a multiple of 10',
    })
    maxPlayers?: number;


    @IsOptional()
    @IsInt()
    @Min(0)
    maxWaitlist?: number;


    @IsOptional()
    @IsInt()
    @Min(2)
    @IsDivisibleBy(2, {
        message:
            'teamCount must be an even number',
    })
    teamCount?: number;


    @IsOptional()
    @IsInt()
    @Equals(5, {
        message:
            'playersPerTeam must be exactly 5',
    })
    playersPerTeam?: number;


    /* =========================================================
       MATCH SETTINGS
    ========================================================= */

    @IsOptional()
    @IsEnum(MatchFormat)
    matchFormat?: MatchFormat;


    @IsOptional()
    @IsEnum(TournamentFormat)
    tournamentFormat?: TournamentFormat;
}