import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsIn(['mock', 'openai'])
  provider?: string;

  @IsOptional()
  @IsBoolean()
  chat_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  voice_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_qualify?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_create_inquiry?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_followups?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handoff_keywords?: string[];

  @IsOptional()
  @IsString()
  default_language?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
