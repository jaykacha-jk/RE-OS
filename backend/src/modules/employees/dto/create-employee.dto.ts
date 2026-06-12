import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Krunal' })
  @IsString()
  first_name!: string;

  @ApiProperty({ example: 'Thakkar' })
  @IsString()
  last_name!: string;

  @ApiProperty({ example: 'k@abc.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phone must be E.164 format' })
  phone?: string;

  @ApiProperty({
    enum: ['org_admin', 'sales_manager', 'sales_executive', 'telecaller', 'marketing_user'],
  })
  @IsIn(['org_admin', 'sales_manager', 'sales_executive', 'telecaller', 'marketing_user'])
  role_code!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  manager_id?: string;
}
