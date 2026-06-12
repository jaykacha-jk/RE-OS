import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Matches } from 'class-validator';

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

  @ApiProperty({ enum: ['basic', 'pro', 'enterprise'] })
  @IsIn(['basic', 'pro', 'enterprise'])
  tier!: string;

  @ApiProperty({ example: 'bill@xyz.realty' })
  @IsEmail()
  billing_email!: string;

  @ApiProperty({ example: 'admin@xyz.realty' })
  @IsEmail()
  owner_email!: string;
}
