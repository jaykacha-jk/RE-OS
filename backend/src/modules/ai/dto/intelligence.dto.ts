import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class AnalyzeConversationDto {
  /** Free-form transcript/chat log to analyze. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  text?: string;

  /** Or analyze a stored AI call by id. */
  @IsOptional()
  @IsUUID()
  call_id?: string;

  /** Or analyze a stored AI conversation by id. */
  @IsOptional()
  @IsUUID()
  ai_conversation_id?: string;
}
