import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { INQUIRY_STAGES } from '../crm.constants';

export class ChangeStageDto {
  @ApiProperty({ enum: INQUIRY_STAGES })
  @IsIn(INQUIRY_STAGES as unknown as string[])
  stage!: string;

  @ApiPropertyOptional({ description: 'Required when moving to CLOSED_LOST (BR-C04)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lost_reason?: string;

  @ApiPropertyOptional({
    description: 'Required for CLOSED_WON without a linked property (BR-C03)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  no_property_reason?: string;
}
