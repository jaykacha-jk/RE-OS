import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phone must be E.164 format' })
  phone?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional({
    enum: ['org_admin', 'sales_manager', 'sales_executive', 'telecaller', 'marketing_user'],
  })
  @IsOptional()
  @IsIn(['org_admin', 'sales_manager', 'sales_executive', 'telecaller', 'marketing_user'])
  role_code?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  manager_id?: string | null;
}
