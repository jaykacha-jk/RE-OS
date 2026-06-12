import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  CONVERSATION_SUBJECT_MAX,
  CONVERSATION_TYPES,
  MESSAGE_CONTENT_MAX,
  type ConversationType,
} from '../chat.constants';

class InitialMessageDto {
  @ApiProperty({ description: 'Initial message body' })
  @IsString()
  @MaxLength(MESSAGE_CONTENT_MAX)
  content!: string;
}

export class CreateConversationDto {
  @ApiPropertyOptional({ enum: CONVERSATION_TYPES, default: 'website' })
  @IsOptional()
  @IsIn(CONVERSATION_TYPES as unknown as string[])
  type?: ConversationType;

  @ApiPropertyOptional({ description: 'Conversation subject / topic' })
  @IsOptional()
  @IsString()
  @MaxLength(CONVERSATION_SUBJECT_MAX)
  subject?: string;

  @ApiPropertyOptional({ description: 'Linked property id (property/website chat)' })
  @IsOptional()
  @IsUUID()
  property_id?: string;

  @ApiPropertyOptional({ description: 'Property slug snapshot (context for the agent)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  property_slug?: string;

  @ApiPropertyOptional({ description: 'Linked inquiry id (if already an inquiry)' })
  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  @ApiPropertyOptional({ description: 'Client (visitor) name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_name?: string;

  @ApiPropertyOptional({ description: 'Client email' })
  @IsOptional()
  @IsEmail()
  client_email?: string;

  @ApiPropertyOptional({ description: 'Client phone (+91 default market)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  client_phone?: string;

  @ApiPropertyOptional({ description: 'Pre-assign to an employee on creation' })
  @IsOptional()
  @IsUUID()
  assigned_employee_id?: string;

  @ApiPropertyOptional({ type: InitialMessageDto, description: 'Optional first message' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialMessageDto)
  initial_message?: InitialMessageDto;
}
