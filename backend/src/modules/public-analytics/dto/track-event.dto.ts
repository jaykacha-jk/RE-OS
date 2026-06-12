import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PUBLIC_EVENT_TYPES } from '../public-analytics.constants';

export class TrackEventDto {
  @ApiProperty({ description: 'Tenant slug the event belongs to', example: 'demo' })
  @IsString()
  @MaxLength(120)
  tenant!: string;

  @ApiProperty({ enum: PUBLIC_EVENT_TYPES })
  @IsIn(PUBLIC_EVENT_TYPES as unknown as string[])
  event_type!: string;

  @ApiPropertyOptional({ example: 'property' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity_type?: string;

  @ApiPropertyOptional({ description: 'Slug or id of the entity (e.g. property slug)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  entity_id?: string;

  @ApiPropertyOptional({ example: '/listings/sea-view-villa' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;

  @ApiPropertyOptional({ description: 'Document referrer URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  referrer?: string;

  @ApiPropertyOptional({ description: 'Marketing source (utm_source or derived channel)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @ApiPropertyOptional({ description: 'Opaque client session id for de-duplication' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  session_id?: string;
}
