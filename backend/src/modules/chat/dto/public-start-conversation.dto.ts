import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

import { MESSAGE_CONTENT_MAX } from '../chat.constants';

/**
 * Payload for a website visitor starting a chat from a public property page.
 * No authentication: tenant is resolved from the `?tenant={slug}` query (mirrors
 * the public properties controller). Returns a conversation access token the
 * widget uses to send/poll messages.
 */
export class PublicStartConversationDto {
  @ApiProperty({ description: 'Visitor name' })
  @IsString()
  @MaxLength(120)
  client_name!: string;

  @ApiPropertyOptional({ description: 'Visitor email' })
  @IsOptional()
  @IsEmail()
  client_email?: string;

  @ApiPropertyOptional({ description: 'Visitor phone (+91 default market)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  client_phone?: string;

  @ApiPropertyOptional({ description: 'Property slug the chat was started from' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  property_slug?: string;

  @ApiProperty({ description: 'First message from the visitor' })
  @IsString()
  @MaxLength(MESSAGE_CONTENT_MAX)
  message!: string;
}

export class PublicSendMessageDto {
  @ApiProperty({ description: 'Conversation access token returned from start' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Message body' })
  @IsString()
  @MaxLength(MESSAGE_CONTENT_MAX)
  content!: string;
}
