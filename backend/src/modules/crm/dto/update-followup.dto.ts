import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { FOLLOWUP_STATUSES, FOLLOWUP_TYPES } from '../crm.constants';

export class UpdateFollowupDto {
  @ApiPropertyOptional({ example: '2026-06-16' })
  @IsOptional()
  @IsISO8601()
  followup_date?: string;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'followup_time must be HH:mm' })
  followup_time?: string;

  @ApiPropertyOptional({ enum: FOLLOWUP_TYPES })
  @IsOptional()
  @IsIn(FOLLOWUP_TYPES as unknown as string[])
  followup_type?: string;

  @ApiPropertyOptional({ enum: FOLLOWUP_STATUSES })
  @IsOptional()
  @IsIn(FOLLOWUP_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
