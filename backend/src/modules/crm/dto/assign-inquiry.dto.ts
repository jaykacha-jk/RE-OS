import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignInquiryDto {
  @ApiProperty({ format: 'uuid', description: 'Employee id to own this inquiry' })
  @IsUUID()
  employee_id!: string;
}
