import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { NOTIFICATION_TYPES } from '../notifications.constants';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ name: 'filter[type]', enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  'filter[type]'?: string;

  @ApiPropertyOptional({ name: 'filter[is_read]', enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  'filter[is_read]'?: string;

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
