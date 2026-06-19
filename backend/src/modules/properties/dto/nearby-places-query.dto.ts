import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearbyPlacesQueryDto {
  @ApiProperty({ example: 23.0225 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 72.5714 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional({ example: 1500, description: 'Search radius in metres (200–5000)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(5000)
  radius_m?: number;
}
