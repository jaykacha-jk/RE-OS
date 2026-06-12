import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '../notifications.constants';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  type?: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_PRIORITIES })
  @IsOptional()
  @IsIn(NOTIFICATION_PRIORITIES as unknown as string[])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title_template?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body_template?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  email_subject_template?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
