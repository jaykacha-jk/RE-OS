import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { COMMISSION_STATUSES, INQUIRY_STAGES } from '../crm.constants';

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

  @ApiPropertyOptional({ description: 'Booking/token amount captured at BOOKED or CLOSED_WON' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  booking_amount?: number;

  @ApiPropertyOptional({ description: 'Expected agency commission for this inquiry/deal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expected_commission?: number;

  @ApiPropertyOptional({ description: 'Commission actually received by the agency' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received_commission?: number;

  @ApiPropertyOptional({ enum: COMMISSION_STATUSES })
  @IsOptional()
  @IsIn(COMMISSION_STATUSES as unknown as string[])
  commission_status?: string;
}
