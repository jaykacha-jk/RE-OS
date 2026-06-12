import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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
  INQUIRY_CLIENT_NAME_MAX,
  INQUIRY_PRIORITIES,
  INQUIRY_PROPERTY_TYPES,
  INQUIRY_PURCHASE_TIMELINES,
  INQUIRY_REQUIREMENT_TYPES,
  INQUIRY_TEMPERATURES,
  LEAD_SCORE_MAX,
  LEAD_SCORE_MIN,
} from '../crm.constants';

export class CreateInquiryDto {
  @ApiProperty({ example: 'Rahul Sharma', maxLength: INQUIRY_CLIENT_NAME_MAX })
  @IsString()
  @Length(2, INQUIRY_CLIENT_NAME_MAX)
  client_name!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Length(5, 20)
  phone!: string;

  @ApiPropertyOptional({ example: 'rahul@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  // Linked entities
  @ApiPropertyOptional({ format: 'uuid', description: 'Linked property id' })
  @IsOptional()
  @IsUUID()
  property_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Assign to employee id' })
  @IsOptional()
  @IsUUID()
  assigned_employee_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Lead source id' })
  @IsOptional()
  @IsUUID()
  source_id?: string;

  @ApiPropertyOptional({ description: 'Free-text source if no source_id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_name?: string;

  // Budget
  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @ApiPropertyOptional({ example: 8000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget_max?: number;

  // Requirements
  @ApiPropertyOptional({ enum: INQUIRY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(INQUIRY_REQUIREMENT_TYPES as unknown as string[])
  requirement_type?: string;

  @ApiPropertyOptional({ example: 'SG Highway, Ahmedabad' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferred_location?: string;

  @ApiPropertyOptional({ enum: INQUIRY_PROPERTY_TYPES })
  @IsOptional()
  @IsIn(INQUIRY_PROPERTY_TYPES as unknown as string[])
  property_type?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ enum: INQUIRY_PURCHASE_TIMELINES })
  @IsOptional()
  @IsIn(INQUIRY_PURCHASE_TIMELINES as unknown as string[])
  purchase_timeline?: string;

  // Status / scoring
  @ApiPropertyOptional({ enum: INQUIRY_PRIORITIES, default: 'medium' })
  @IsOptional()
  @IsIn(INQUIRY_PRIORITIES as unknown as string[])
  priority?: string;

  @ApiPropertyOptional({ enum: INQUIRY_TEMPERATURES, default: 'warm' })
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

  @ApiPropertyOptional({ description: 'Internal remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Override BR-C01 duplicate detection (same phone within 30 days)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  override_duplicate?: boolean;
}
