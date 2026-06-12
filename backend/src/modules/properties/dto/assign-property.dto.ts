import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignPropertyDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'Employee ids to assign' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  employee_ids!: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Primary agent (BR-P06: max 1)' })
  @IsOptional()
  @IsUUID()
  primary_employee_id?: string;
}
