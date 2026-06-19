import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class UploadOrgLogoDto {
  @ApiPropertyOptional({ description: 'Pre-hosted public URL (alternative to content_base64)' })
  @ValidateIf((o) => !o.content_base64)
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ description: 'Base64 (or data-URI) image payload to upload' })
  @ValidateIf((o) => !o.url)
  @IsString()
  content_base64?: string;

  @ApiPropertyOptional({ example: 'logo.png' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ example: 'image/png' })
  @IsOptional()
  @IsString()
  content_type?: string;
}
