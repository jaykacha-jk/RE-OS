import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refresh_token?: string;
}

