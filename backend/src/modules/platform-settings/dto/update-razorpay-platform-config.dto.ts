import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateRazorpayPlatformConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  key_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  key_secret?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  webhook_secret?: string;

  @IsIn(['test', 'live'])
  environment!: 'test' | 'live';

  @IsBoolean()
  active!: boolean;
}
