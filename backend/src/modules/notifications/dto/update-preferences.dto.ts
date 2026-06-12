import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PreferenceItemDto {
  @ApiProperty({ description: 'Automation event key (e.g. crm.inquiry.assigned)' })
  @IsString()
  event_key!: string;

  @ApiProperty()
  @IsBoolean()
  in_app!: boolean;

  @ApiProperty()
  @IsBoolean()
  email!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences!: PreferenceItemDto[];
}
