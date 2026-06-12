import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import {
  PROPERTY_CATEGORIES,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from '../properties.constants';

/**
 * Nested `filter` object produced by Express/qs when clients send
 * `filter[city]=Ahmedabad` style query params.
 */
export class PropertyListFiltersDto {
  @ApiPropertyOptional({ enum: PROPERTY_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_TYPES as unknown as string[])
  type?: string;

  @ApiPropertyOptional({ enum: PROPERTY_CATEGORIES })
  @IsOptional()
  @IsIn(PROPERTY_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional({ enum: PROPERTY_STATUSES })
  @IsOptional()
  @IsIn(PROPERTY_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ enum: PROPERTY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(PROPERTY_REQUIREMENT_TYPES as unknown as string[])
  requirement_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Employee id assigned to property' })
  @IsOptional()
  @IsString()
  assigned_user?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;
}
