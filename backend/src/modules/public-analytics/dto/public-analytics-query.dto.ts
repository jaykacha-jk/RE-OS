import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class PublicAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ['today', '7d', '30d', '90d', 'custom'], default: '30d' })
  @IsOptional()
  @IsIn(['today', '7d', '30d', '90d', 'custom'])
  range?: string;

  @ApiPropertyOptional({ description: 'Start date (range=custom)' })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End date (range=custom)' })
  @IsOptional()
  @IsISO8601()
  date_to?: string;
}
