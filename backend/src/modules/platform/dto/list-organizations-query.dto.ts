import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ name: 'filter[status]' })
  @IsOptional()
  @IsIn(['trial', 'active', 'suspended', 'cancelled'])
  'filter[status]'?: string;

  @ApiPropertyOptional({ name: 'filter[tier]' })
  @IsOptional()
  @IsIn(['basic', 'pro', 'enterprise'])
  'filter[tier]'?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}
