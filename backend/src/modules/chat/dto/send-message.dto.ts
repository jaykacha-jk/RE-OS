import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  ATTACHMENT_KINDS,
  MESSAGE_CONTENT_MAX,
  MESSAGE_TYPES,
  type AttachmentKind,
  type MessageType,
} from '../chat.constants';

export class MessageAttachmentDto {
  @ApiProperty({ description: 'Original file name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: ATTACHMENT_KINDS, description: 'image | file | document' })
  @IsIn(ATTACHMENT_KINDS as unknown as string[])
  kind!: AttachmentKind;

  @ApiProperty({ description: 'Base64 (optionally data-URI) encoded file content' })
  @IsString()
  content_base64!: string;

  @ApiPropertyOptional({ description: 'MIME type (used for storage + validation)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  content_type?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message body (required unless attachments are present)' })
  @ValidateIf((o: SendMessageDto) => !o.attachments || o.attachments.length === 0)
  @IsString()
  @MaxLength(MESSAGE_CONTENT_MAX)
  content!: string;

  @ApiPropertyOptional({ enum: MESSAGE_TYPES, default: 'text' })
  @IsOptional()
  @IsIn(MESSAGE_TYPES as unknown as string[])
  message_type?: MessageType;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], description: 'Image / file / document attachments' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
