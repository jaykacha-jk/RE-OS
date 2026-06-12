import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({ example: 'Spoke with client, interested in 3BHK near SG Highway.' })
  @IsString()
  @Length(1, 5000)
  note!: string;
}
