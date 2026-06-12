import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const REQUIREMENT_TYPES = ['buy', 'sell', 'rent'] as const;

/**
 * Convert a conversation into a CRM inquiry (lead). If `inquiry_id` is provided
 * the conversation is simply linked to that existing inquiry; otherwise a new
 * inquiry is created from the conversation's client details.
 */
export class ConvertInquiryDto {
  @ApiPropertyOptional({ description: 'Link to an existing inquiry instead of creating one' })
  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  @ApiPropertyOptional({ description: 'Override client name for the new inquiry' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_name?: string;

  @ApiPropertyOptional({ description: 'Phone for the new inquiry (required if client_phone absent)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email for the new inquiry' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(REQUIREMENT_TYPES as unknown as string[])
  requirement_type?: (typeof REQUIREMENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Bypass BR-C01 duplicate detection' })
  @IsOptional()
  @IsBoolean()
  override_duplicate?: boolean;
}
