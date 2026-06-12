import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSeoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  meta_title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_description?: string | null;

  @ApiPropertyOptional({ description: 'Open Graph block (title, description, image_url, type)' })
  @IsOptional()
  @IsObject()
  open_graph?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Twitter card block (card, site, title, description, image_url)' })
  @IsOptional()
  @IsObject()
  twitter_card?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Default schema.org block (organization_type, enabled)' })
  @IsOptional()
  @IsObject()
  default_schema?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Robots rules (index, follow, custom_rules[])' })
  @IsOptional()
  @IsObject()
  robots?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Sitemap options (enabled, include_properties, change_frequency, priority)' })
  @IsOptional()
  @IsObject()
  sitemap?: Record<string, unknown>;
}
