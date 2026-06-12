import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  PROPERTY_TITLE_MAX,
} from '../properties.constants';

export class CreatePropertyDto {
  @ApiProperty({ example: '3BHK Luxury Flat SG Highway', maxLength: PROPERTY_TITLE_MAX })
  @IsString()
  @Length(3, PROPERTY_TITLE_MAX)
  title!: string;

  @ApiPropertyOptional({ description: 'Manual slug override (admin only, BR-P01)' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PROPERTY_TYPES })
  @IsIn(PROPERTY_TYPES as unknown as string[])
  type!: string;

  @ApiProperty({ enum: PROPERTY_CATEGORIES })
  @IsIn(PROPERTY_CATEGORIES as unknown as string[])
  category!: string;

  @ApiProperty({ enum: PROPERTY_REQUIREMENT_TYPES })
  @IsIn(PROPERTY_REQUIREMENT_TYPES as unknown as string[])
  requirement_type!: string;

  // Pricing
  @ApiPropertyOptional({ example: 8500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maintenance?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  token_amount?: number;

  // Location
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Ahmedabad' })
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiPropertyOptional({ example: 'Gujarat' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '380015' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  // Details
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  balconies?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  total_floors?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  super_builtup_area?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carpet_area?: number;

  @ApiPropertyOptional({ enum: PROPERTY_STATUSES, default: 'draft' })
  @IsOptional()
  @IsIn(PROPERTY_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  // SEO
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  meta_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  meta_description?: string;

  @ApiPropertyOptional({ type: [String], example: ['gym', 'parking'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ type: [String], example: ['premium', 'sea-facing'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];
}
