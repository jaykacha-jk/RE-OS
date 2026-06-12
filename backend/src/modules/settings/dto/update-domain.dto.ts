import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateDomainDto {
  @ApiPropertyOptional({ description: 'Promote/demote this domain as the primary hostname' })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({
    enum: ['pending', 'provisioning', 'active', 'failed'],
    description: 'SSL provisioning state (admin/automation override)',
  })
  @IsOptional()
  @IsIn(['pending', 'provisioning', 'active', 'failed'])
  ssl_status?: string;
}
