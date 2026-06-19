import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePlatformPlanDto {
  @ApiPropertyOptional({ example: 'Growth Plus' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Monthly price in paise' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_inr_monthly?: number;

  @ApiPropertyOptional({ description: 'Yearly price in paise' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_inr_yearly?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_properties?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_employees?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  storage_limit_bytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_ai_minutes_monthly?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
