import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { FOLLOWUP_TYPES } from '../crm.constants';

export class CreateFollowupDto {
  @ApiProperty({ example: '2026-06-15', description: 'ISO date (YYYY-MM-DD)' })
  @IsISO8601()
  followup_date!: string;

  @ApiPropertyOptional({ example: '15:30', description: 'HH:mm (24h)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'followup_time must be HH:mm' })
  followup_time?: string;

  @ApiProperty({ enum: FOLLOWUP_TYPES })
  @IsIn(FOLLOWUP_TYPES as unknown as string[])
  followup_type!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Employee responsible (defaults to assignee)' })
  @IsOptional()
  @IsUUID()
  assigned_employee_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
