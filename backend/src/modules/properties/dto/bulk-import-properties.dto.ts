import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class BulkImportPropertiesDto {
  @ApiProperty({
    description: 'Raw CSV text with a header row (max 500 data rows, BR-P05)',
    example:
      'title,type,category,requirement_type,city,price,bedrooms\n3BHK SG Highway,residential,flat,sell,Ahmedabad,8500000,3',
  })
  @IsString()
  @MaxLength(2_000_000)
  csv_content!: string;
}
