import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Matches } from 'class-validator';

import { ORG_TIER_CODES } from '../org-tier';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'XYZ Realty' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'xyz' })
  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: 'slug must be 3-63 lowercase letters, numbers, or hyphens',
  })
  slug!: string;

  @ApiProperty({ enum: ORG_TIER_CODES })
  @IsIn([...ORG_TIER_CODES, 'basic'])
  tier!: string;

  @ApiProperty({ example: 'bill@xyz.realty' })
  @IsEmail()
  billing_email!: string;

  @ApiProperty({ example: 'admin@xyz.realty' })
  @IsEmail()
  owner_email!: string;
}
