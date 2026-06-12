import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWhiteLabelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Hide all "RE-OS" branding from public surfaces' })
  @IsOptional()
  @IsBoolean()
  hide_branding?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  custom_logo_url?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  custom_favicon_url?: string | null;

  @ApiPropertyOptional({ example: '#0f766e' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  primary_color?: string | null;

  @ApiPropertyOptional({ example: '#0369a1' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondary_color?: string | null;

  @ApiPropertyOptional({ example: 'noreply@abc-realty.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email_sender?: string | null;

  @ApiPropertyOptional({ description: 'Custom login page block (enabled, headline, subtext, background_url)' })
  @IsOptional()
  @IsObject()
  custom_login?: Record<string, unknown>;
}
