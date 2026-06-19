import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class EndImpersonationDto {
  @ApiPropertyOptional({ description: 'Organization tenant id that was impersonated' })
  @IsOptional()
  @IsUUID()
  tenant_id?: string;
}
