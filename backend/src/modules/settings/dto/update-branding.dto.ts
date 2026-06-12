import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logo_url?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  favicon_url?: string | null;

  @ApiPropertyOptional({ example: '#0f766e' })
  @IsOptional()
  @IsHexColor()
  primary_color?: string;

  @ApiPropertyOptional({ example: '#0369a1' })
  @IsOptional()
  @IsHexColor()
  secondary_color?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  font_family?: string;

  @ApiPropertyOptional({ description: 'Email branding block (from_name, header_logo_url, footer_text, accent_color)' })
  @IsOptional()
  @IsObject()
  email_branding?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'PDF branding block (header_logo_url, footer_text, accent_color)' })
  @IsOptional()
  @IsObject()
  pdf_branding?: Record<string, unknown>;
}
