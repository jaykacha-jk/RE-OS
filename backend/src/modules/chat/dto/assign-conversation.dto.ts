import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignConversationDto {
  @ApiProperty({ description: 'Employee id to assign the conversation to' })
  @IsUUID()
  employee_id!: string;
}
