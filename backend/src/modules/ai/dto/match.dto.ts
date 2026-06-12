import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class MatchDto {
  /** Match against an existing inquiry's stored requirements. */
  @IsOptional()
  @IsUUID()
  inquiry_id?: string;

  /** Or supply ad-hoc criteria / free text. */
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budget_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budget_max?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsIn(['residential', 'commercial'])
  property_type?: string;

  @IsOptional()
  @IsIn(['buy', 'sell', 'rent'])
  requirement_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
