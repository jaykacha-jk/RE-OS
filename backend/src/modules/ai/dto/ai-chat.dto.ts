import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class StartAiChatDto {
  @IsOptional()
  @IsIn(['website', 'crm', 'whatsapp'])
  channel?: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  @IsOptional()
  @IsString()
  client_name?: string;

  @IsOptional()
  @IsString()
  client_phone?: string;

  /** Optional opening message from the client. */
  @IsOptional()
  @IsString()
  message?: string;
}

export class AiChatMessageDto {
  @IsString()
  @MinLength(1)
  message!: string;
}
