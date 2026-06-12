import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class QualifyTextDto {
  @IsString()
  @MinLength(3)
  text!: string;

  /** Optional inquiry to apply the qualification result to (BR-AI04). */
  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  /** Number of client responses observed (engagement signal). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responses?: number;

  /** Conversation/call duration in seconds (engagement signal). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  /** When true and confidence >= threshold, write score/temperature to CRM. */
  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}
