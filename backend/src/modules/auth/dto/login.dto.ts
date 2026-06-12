import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/i, {
    message: 'tenant_slug must be 3-63 chars of lowercase letters, numbers, and hyphens',
  })
  tenant_slug?: string;
}

