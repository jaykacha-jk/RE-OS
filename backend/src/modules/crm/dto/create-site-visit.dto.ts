import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSiteVisitDto {
  @ApiProperty({ example: '2026-06-18T10:30:00.000Z', description: 'Scheduled datetime (ISO)' })
  @IsISO8601()
  scheduled_at!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Property to visit (defaults to inquiry property)' })
  @IsOptional()
  @IsUUID()
  property_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Employee conducting the visit (defaults to assignee)' })
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
