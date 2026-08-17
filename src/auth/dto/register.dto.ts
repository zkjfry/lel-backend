import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';


export class RegisterDto {

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  username: string;


  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;


  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;


  /*
   * Chinese mainland mobile number.
   *
   * Examples:
   * 13800138000
   * 18612345678
   */
  @IsString()
  @Matches(
    /^1[3-9]\d{9}$/,
    {
      message:
        'Phone number must be a valid Chinese mainland mobile number',
    },
  )
  phone: string;
}