import {
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';


export class RegisterTournamentDto {

    /*
     * Optional here for backward compatibility.
     *
     * Old tournaments created before the password
     * feature may not have a password hash.
     *
     * The service will require this field whenever
     * the tournament itself has a password.
     */
    @IsOptional()
    @IsString()
    @MaxLength(64)
    password?: string;

}