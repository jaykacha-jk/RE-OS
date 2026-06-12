import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// RFC 1123 hostname (labels of a-z 0-9 hyphen, at least one dot).
const HOSTNAME_REGEX =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export class CreateDomainDto {
  @ApiProperty({ example: 'abc-realty.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_REGEX, { message: 'domain must be a valid hostname (e.g. abc-realty.com)' })
  domain!: string;

  @ApiPropertyOptional({ description: 'Mark this domain as the primary public hostname' })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}
