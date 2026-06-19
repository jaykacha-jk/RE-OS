import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformPlanDto {
  @ApiProperty({ example: 'growth' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,48}$/, {
    message: 'code must be 2-49 lowercase letters, numbers, or underscores',
  })
  code!: string;

  @ApiProperty({ example: 'Growth' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Monthly price in paise', example: 999900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_inr_monthly!: number;

  @ApiPropertyOptional({ description: 'Yearly price in paise', example: 9999000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_inr_yearly?: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_properties!: number;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_employees!: number;

  @ApiPropertyOptional({ description: '0 = unlimited storage', example: 53687091200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  storage_limit_bytes?: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_ai_minutes_monthly!: number;

  @ApiPropertyOptional({ example: { crm: true, chat: true, ai: false } })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
