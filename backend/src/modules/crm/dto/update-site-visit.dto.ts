import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { SITE_VISIT_STATUSES } from '../crm.constants';

export class UpdateSiteVisitDto {
  @ApiPropertyOptional({ example: '2026-06-19T10:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  scheduled_at?: string;

  @ApiPropertyOptional({ enum: SITE_VISIT_STATUSES })
  @IsOptional()
  @IsIn(SITE_VISIT_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  property_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
