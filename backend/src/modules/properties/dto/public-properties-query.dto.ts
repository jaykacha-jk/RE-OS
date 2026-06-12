import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import {
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_TYPES,
} from '../properties.constants';
import { PropertyListFiltersDto } from './property-list-filters.dto';

/**
 * Public listing query. No tenant_id (resolved from slug), no internal filters
 * (assigned_user, draft statuses) exposed.
 */
export class PublicPropertiesQueryDto {
  @ApiPropertyOptional({ description: 'Tenant slug (required when not using a tenant subdomain)' })
  @IsOptional()
  @IsString()
  tenant?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ name: 'filter[type]', enum: PROPERTY_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_TYPES as unknown as string[])
  'filter[type]'?: string;

  @ApiPropertyOptional({ name: 'filter[category]', enum: PROPERTY_CATEGORIES })
  @IsOptional()
  @IsIn(PROPERTY_CATEGORIES as unknown as string[])
  'filter[category]'?: string;

  @ApiPropertyOptional({ name: 'filter[requirement_type]', enum: PROPERTY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_REQUIREMENT_TYPES as unknown as string[])
  'filter[requirement_type]'?: string;

  @ApiPropertyOptional({ name: 'filter[city]' })
  @IsOptional()
  @IsString()
  'filter[city]'?: string;

  @ApiPropertyOptional({ name: 'filter[min_price]' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  'filter[min_price]'?: number;

  @ApiPropertyOptional({ name: 'filter[max_price]' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  'filter[max_price]'?: number;

  /** Nested filter object from bracket-style query params (`filter[city]=…`). */
  @ApiPropertyOptional({ type: PropertyListFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyListFiltersDto)
  filter?: PropertyListFiltersDto;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  per_page?: number = 24;
}
