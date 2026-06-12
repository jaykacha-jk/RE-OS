import { IsObject, IsOptional, IsString } from 'class-validator';

export class RazorpayWebhookDto {
  @IsString()
  event!: string;

  @IsString()
  @IsOptional()
  id?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
