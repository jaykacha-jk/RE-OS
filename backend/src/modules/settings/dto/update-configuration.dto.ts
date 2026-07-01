import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ChatConfigurationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_assign_enabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  auto_assign_delay_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_create_inquiry_on_phone?: boolean;
}

export class UpdateConfigurationDto {
  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @ApiPropertyOptional({ example: 'DD/MM/YYYY' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  date_format?: string;

  @ApiPropertyOptional({ example: 'en-IN' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  number_format?: string;

  @ApiPropertyOptional({ description: 'Business hours map keyed by weekday ({ open, close, closed })' })
  @IsOptional()
  @IsObject()
  business_hours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Live chat automation settings' })
  @IsOptional()
  @IsObject()
  chat?: ChatConfigurationDto;
}
