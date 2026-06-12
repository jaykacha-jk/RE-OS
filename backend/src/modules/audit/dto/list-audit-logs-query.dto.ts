import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;

  @ApiPropertyOptional({ example: 'employees.create' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'employee' })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiPropertyOptional({ description: 'Filter by actor email (contains, case-insensitive)' })
  @IsOptional()
  @IsString()
  actor_email?: string;

  @ApiPropertyOptional({ description: 'Filter by exact entity id' })
  @IsOptional()
  @IsString()
  entity_id?: string;

  @ApiPropertyOptional({ description: 'ISO date — only logs at/after this instant' })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({ description: 'ISO date — only logs at/before this instant' })
  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Super Admin only tenant filter' })
  @IsOptional()
  @IsUUID()
  tenant_id?: string;
}
