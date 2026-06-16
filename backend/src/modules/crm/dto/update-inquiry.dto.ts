import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  COMMISSION_STATUSES,
  INQUIRY_CLIENT_NAME_MAX,
  INQUIRY_PRIORITIES,
  INQUIRY_PROPERTY_TYPES,
  INQUIRY_PURCHASE_TIMELINES,
  INQUIRY_REQUIREMENT_TYPES,
  INQUIRY_TEMPERATURES,
  LEAD_SCORE_MAX,
  LEAD_SCORE_MIN,
} from '../crm.constants';

/**
 * Inquiry update. Stage transitions go through PATCH /:id/stage; assignments
 * through POST /:id/assign. This DTO covers lead detail edits only.
 */
export class UpdateInquiryDto {
  @ApiPropertyOptional({ maxLength: INQUIRY_CLIENT_NAME_MAX })
  @IsOptional()
  @IsString()
  @Length(2, INQUIRY_CLIENT_NAME_MAX)
  client_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  property_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  source_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget_max?: number;

  @ApiPropertyOptional({ description: 'Booking/token amount captured when lead reaches BOOKED or CLOSED_WON' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  booking_amount?: number;

  @ApiPropertyOptional({ description: 'Expected agency commission for this inquiry/deal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expected_commission?: number;

  @ApiPropertyOptional({ description: 'Commission actually received by the agency' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received_commission?: number;

  @ApiPropertyOptional({ enum: COMMISSION_STATUSES })
  @IsOptional()
  @IsIn(COMMISSION_STATUSES as unknown as string[])
  commission_status?: string;

  @ApiPropertyOptional({ enum: INQUIRY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(INQUIRY_REQUIREMENT_TYPES as unknown as string[])
  requirement_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferred_location?: string;

  @ApiPropertyOptional({ enum: INQUIRY_PROPERTY_TYPES })
  @IsOptional()
  @IsIn(INQUIRY_PROPERTY_TYPES as unknown as string[])
  property_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ enum: INQUIRY_PURCHASE_TIMELINES })
  @IsOptional()
  @IsIn(INQUIRY_PURCHASE_TIMELINES as unknown as string[])
  purchase_timeline?: string;

  @ApiPropertyOptional({ enum: INQUIRY_PRIORITIES })
  @IsOptional()
  @IsIn(INQUIRY_PRIORITIES as unknown as string[])
  priority?: string;

  @ApiPropertyOptional({ enum: INQUIRY_TEMPERATURES })
  @IsOptional()
  @IsIn(INQUIRY_TEMPERATURES as unknown as string[])
  temperature?: string;

  @ApiPropertyOptional({ minimum: LEAD_SCORE_MIN, maximum: LEAD_SCORE_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LEAD_SCORE_MIN)
  @Max(LEAD_SCORE_MAX)
  lead_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
