import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * An image can be registered either by direct URL (already hosted) or by
 * uploading a base64 payload that the StorageService persists (S3 / local).
 */
export class AddImageDto {
  @ApiPropertyOptional({ description: 'Pre-hosted public URL (alternative to content_base64)' })
  @ValidateIf((o) => !o.content_base64)
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ description: 'Base64 (or data-URI) image payload to upload' })
  @ValidateIf((o) => !o.url)
  @IsString()
  content_base64?: string;

  @ApiPropertyOptional({ example: 'living-room.jpg' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  content_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt_text?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_cover?: boolean;
}

export class ReorderImagesDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'Image ids in desired order' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  image_ids!: string[];
}

export class AddVideoDto {
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.content_base64)
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.url)
  @IsString()
  content_base64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class AddDocumentDto {
  @ApiProperty({ example: 'Floor plan' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.content_base64)
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.url)
  @IsString()
  content_base64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content_type?: string;

  @ApiPropertyOptional({ example: 'floor_plan' })
  @IsOptional()
  @IsString()
  doc_type?: string;
}
