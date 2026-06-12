import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  agency_name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  owner_name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'phone must be a valid Indian mobile number in +91 format',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: 'agency_slug must be 3-63 lowercase letters, numbers, and hyphens',
  })
  agency_slug?: string;
}
