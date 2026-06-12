import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import {
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_SORTABLE_FIELDS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from '../properties.constants';
import { PropertyListFiltersDto } from './property-list-filters.dto';

export class ListPropertiesQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search on title, property_code, city, locality' })
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

  @ApiPropertyOptional({ name: 'filter[status]', enum: PROPERTY_STATUSES })
  @IsOptional()
  @IsIn(PROPERTY_STATUSES as unknown as string[])
  'filter[status]'?: string;

  @ApiPropertyOptional({ name: 'filter[requirement_type]', enum: PROPERTY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_REQUIREMENT_TYPES as unknown as string[])
  'filter[requirement_type]'?: string;

  @ApiPropertyOptional({ name: 'filter[city]' })
  @IsOptional()
  @IsString()
  'filter[city]'?: string;

  @ApiPropertyOptional({ name: 'filter[assigned_user]', description: 'Employee id assigned to property' })
  @IsOptional()
  @IsString()
  'filter[assigned_user]'?: string;

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

  @ApiPropertyOptional({ enum: PROPERTY_SORTABLE_FIELDS, default: 'created_at' })
  @IsOptional()
  @IsIn(PROPERTY_SORTABLE_FIELDS as unknown as string[])
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}
