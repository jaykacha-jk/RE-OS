import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsIn(['voice', 'chat'])
  type?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  call_provider?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'disabled'])
  status?: string;

  @IsOptional()
  @IsString()
  call_provider?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
