import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

import {
  INQUIRY_PRIORITIES,
  INQUIRY_SORTABLE_FIELDS,
  INQUIRY_STAGES,
  INQUIRY_TEMPERATURES,
} from '../crm.constants';

export class ListInquiriesQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search on client_name, phone, email, inquiry_code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ name: 'filter[stage]', enum: INQUIRY_STAGES })
  @IsOptional()
  @IsIn(INQUIRY_STAGES as unknown as string[])
  'filter[stage]'?: string;

  @ApiPropertyOptional({ name: 'filter[priority]', enum: INQUIRY_PRIORITIES })
  @IsOptional()
  @IsIn(INQUIRY_PRIORITIES as unknown as string[])
  'filter[priority]'?: string;

  @ApiPropertyOptional({ name: 'filter[temperature]', enum: INQUIRY_TEMPERATURES })
  @IsOptional()
  @IsIn(INQUIRY_TEMPERATURES as unknown as string[])
  'filter[temperature]'?: string;

  @ApiPropertyOptional({ name: 'filter[source]', description: 'Lead source id' })
  @IsOptional()
  @IsString()
  'filter[source]'?: string;

  @ApiPropertyOptional({ name: 'filter[assigned_employee]', description: 'Employee id' })
  @IsOptional()
  @IsString()
  'filter[assigned_employee]'?: string;

  @ApiPropertyOptional({ name: 'filter[property]', description: 'Property id' })
  @IsOptional()
  @IsString()
  'filter[property]'?: string;

  @ApiPropertyOptional({ name: 'filter[date_from]', description: 'ISO date (created_at >=)' })
  @IsOptional()
  @IsString()
  'filter[date_from]'?: string;

  @ApiPropertyOptional({ name: 'filter[date_to]', description: 'ISO date (created_at <=)' })
  @IsOptional()
  @IsString()
  'filter[date_to]'?: string;

  @ApiPropertyOptional({ enum: INQUIRY_SORTABLE_FIELDS, default: 'created_at' })
  @IsOptional()
  @IsIn(INQUIRY_SORTABLE_FIELDS as unknown as string[])
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
