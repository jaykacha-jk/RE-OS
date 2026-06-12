import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ enum: ['trial', 'active', 'suspended', 'cancelled'] })
  @IsOptional()
  @IsIn(['trial', 'active', 'suspended', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['basic', 'pro', 'enterprise'] })
  @IsOptional()
  @IsIn(['basic', 'pro', 'enterprise'])
  tier?: string;

  @ApiPropertyOptional({ example: 'bill@xyz.realty' })
  @IsOptional()
  @IsEmail()
  billing_email?: string;

  @ApiPropertyOptional({ example: 'XYZ Realty Pvt Ltd' })
  @IsOptional()
  @IsString()
  name?: string;
}
