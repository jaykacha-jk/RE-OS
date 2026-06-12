import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Feature flags are persisted per tenant. Each flag is optional so a PATCH can
 * toggle a single capability. Unknown flags are rejected by the global pipe.
 */
export class UpdateFeaturesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chat?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ai?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  billing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  crm?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  website?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  analytics?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;
}
