import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import {
  CONVERSATION_SORTABLE_FIELDS,
  CONVERSATION_STATUSES,
  CONVERSATION_TYPES,
  type ConversationSortableField,
} from '../chat.constants';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;

  @ApiPropertyOptional({ description: 'Search client name / email / phone / code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CONVERSATION_STATUSES })
  @IsOptional()
  @IsIn(CONVERSATION_STATUSES as unknown as string[])
  'filter[status]'?: string;

  @ApiPropertyOptional({ enum: CONVERSATION_TYPES })
  @IsOptional()
  @IsIn(CONVERSATION_TYPES as unknown as string[])
  'filter[type]'?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned employee id' })
  @IsOptional()
  @IsUUID()
  'filter[assigned_employee]'?: string;

  @ApiPropertyOptional({ description: 'Filter by linked property id' })
  @IsOptional()
  @IsUUID()
  'filter[property]'?: string;

  @ApiPropertyOptional({ description: 'Only my conversations (assigned to me / I participate)' })
  @IsOptional()
  @IsString()
  'filter[mine]'?: string;

  @ApiPropertyOptional({ description: 'Only conversations with unread messages' })
  @IsOptional()
  @IsString()
  'filter[unread]'?: string;

  @ApiPropertyOptional({ enum: CONVERSATION_SORTABLE_FIELDS, default: 'last_message_at' })
  @IsOptional()
  @IsIn(CONVERSATION_SORTABLE_FIELDS as unknown as string[])
  sort_by?: ConversationSortableField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_dir?: 'asc' | 'desc';
}
