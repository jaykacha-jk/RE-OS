import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  CONVERSATION_STATUSES,
  CONVERSATION_SUBJECT_MAX,
  type ConversationStatus,
} from '../chat.constants';

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: 'Conversation subject / topic' })
  @IsOptional()
  @IsString()
  @MaxLength(CONVERSATION_SUBJECT_MAX)
  subject?: string;

  @ApiPropertyOptional({
    enum: CONVERSATION_STATUSES,
    description: 'Set status (open | assigned | waiting | closed | archived)',
  })
  @IsOptional()
  @IsIn(CONVERSATION_STATUSES as unknown as string[])
  status?: ConversationStatus;

  @ApiPropertyOptional({ description: 'Replace conversation tags' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Update client name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_name?: string;

  @ApiPropertyOptional({ description: 'Update client email' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  client_email?: string;

  @ApiPropertyOptional({ description: 'Update client phone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  client_phone?: string;
}
