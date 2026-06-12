import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ name: 'filter[role]' })
  @IsOptional()
  @IsString()
  'filter[role]'?: string;

  @ApiPropertyOptional({ name: 'filter[status]' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  'filter[status]'?: string;

  @ApiPropertyOptional({ name: 'filter[search]' })
  @IsOptional()
  @IsString()
  'filter[search]'?: string;

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
