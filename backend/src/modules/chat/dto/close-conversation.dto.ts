import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseConversationDto {
  @ApiPropertyOptional({ description: 'Optional closing note (stored on activity)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Archive instead of close (status=archived)' })
  @IsOptional()
  @IsBoolean()
  archive?: boolean;
}
