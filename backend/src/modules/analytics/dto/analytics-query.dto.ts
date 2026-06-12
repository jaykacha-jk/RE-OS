import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

import {
  ANALYTICS_TIME_RANGES,
  type AnalyticsTimeRange,
} from '../analytics.constants';

/**
 * Shared query DTO for every analytics endpoint. Supports preset windows
 * (today / 7d / 30d / 90d) and a custom range via `date_from` / `date_to`.
 */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Preset time window. Use `custom` with date_from/date_to.',
    enum: ANALYTICS_TIME_RANGES,
    default: '30d',
  })
  @IsOptional()
  @IsIn(ANALYTICS_TIME_RANGES)
  range?: AnalyticsTimeRange;

  @ApiPropertyOptional({ description: 'Custom range start (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Custom range end (ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  date_to?: string;
}
