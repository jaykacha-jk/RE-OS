import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

import { ORG_TIER_CODES } from '../org-tier';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ enum: ['trial', 'active', 'suspended', 'cancelled'] })
  @IsOptional()
  @IsIn(['trial', 'active', 'suspended', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ORG_TIER_CODES })
  @IsOptional()
  @IsIn([...ORG_TIER_CODES, 'basic'])
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
