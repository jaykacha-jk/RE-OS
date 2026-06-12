import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCallDto {
  @IsString()
  @MinLength(6)
  client_phone!: string;

  @IsOptional()
  @IsString()
  client_name?: string;

  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: string;

  @IsOptional()
  @IsUUID()
  agent_id?: string;

  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  /** Recording-disclosure consent for outbound (India compliance). */
  @IsOptional()
  @IsBoolean()
  consent_recorded?: boolean;

  /** When true, run the post-call pipeline synchronously (mock telephony). */
  @IsOptional()
  @IsBoolean()
  simulate?: boolean;
}

/** Telephony provider webhook payload (provider-agnostic shape). */
export class CallWebhookDto {
  @IsString()
  call_sid!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  recording_url?: string;

  @IsOptional()
  duration_seconds?: number;
}
