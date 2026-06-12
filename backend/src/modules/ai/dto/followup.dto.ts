import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

import { FOLLOWUP_TYPES } from '../ai.constants';

export class GenerateFollowupsDto {
  /** Generate suggestions for a specific inquiry, else scan stale inquiries. */
  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  @IsOptional()
  @IsUUID()
  call_id?: string;
}

export class UpdateFollowupStatusDto {
  @IsIn(['accepted', 'dismissed', 'applied'])
  status!: string;
}

export class ListFollowupsQueryDto {
  @IsOptional()
  @IsIn(['suggested', 'accepted', 'dismissed', 'applied'])
  status?: string;

  @IsOptional()
  @IsIn(FOLLOWUP_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}

export class ListCallsQueryDto {
  @IsOptional()
  @IsIn(['queued', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}
