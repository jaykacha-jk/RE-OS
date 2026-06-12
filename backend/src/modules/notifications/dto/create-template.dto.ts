import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from '../notifications.constants';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Event key this template renders (e.g. crm.inquiry.assigned)' })
  @IsString()
  @MaxLength(120)
  key!: string;

  @ApiProperty({ enum: NOTIFICATION_CHANNELS })
  @IsIn(NOTIFICATION_CHANNELS as unknown as string[])
  channel!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  type!: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_PRIORITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(NOTIFICATION_PRIORITIES as unknown as string[])
  priority?: string;

  @ApiProperty({ description: 'Title template ({{var}} interpolation)' })
  @IsString()
  @MaxLength(300)
  title_template!: string;

  @ApiProperty({ description: 'Body template ({{var}} interpolation)' })
  @IsString()
  @MaxLength(2000)
  body_template!: string;

  @ApiPropertyOptional({ description: 'Email subject template (email channel)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  email_subject_template?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
