import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

import {
  INQUIRY_CLIENT_NAME_MAX,
  INQUIRY_REQUIREMENT_TYPES,
} from '../crm.constants';

export class PublicInquiryDto {
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

  @ApiPropertyOptional({ example: '3bhk-flat-sg-highway' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  property_slug?: string;

  @ApiPropertyOptional({ enum: INQUIRY_REQUIREMENT_TYPES })
  @IsOptional()
  @IsIn(INQUIRY_REQUIREMENT_TYPES as unknown as string[])
  requirement_type?: string;

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

  @ApiPropertyOptional({ example: 'SG Highway, Ahmedabad' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferred_location?: string;

  @ApiPropertyOptional({ example: 'Interested in a site visit this weekend' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
