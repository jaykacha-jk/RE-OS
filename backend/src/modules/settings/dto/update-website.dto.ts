import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWebsiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hero_title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  hero_subtitle?: string | null;

  @ApiPropertyOptional({ description: 'Contact block (email, phone, whatsapp, address)' })
  @IsOptional()
  @IsObject()
  contact?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Social links (facebook, instagram, linkedin, twitter, youtube)' })
  @IsOptional()
  @IsObject()
  social_links?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Testimonials array ({ author, role, quote, avatar_url })' })
  @IsOptional()
  @IsArray()
  testimonials?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Featured sections array ({ title, subtitle, type, enabled })' })
  @IsOptional()
  @IsArray()
  featured_sections?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Footer block (about, copyright, links[])' })
  @IsOptional()
  @IsObject()
  footer?: Record<string, unknown>;
}
