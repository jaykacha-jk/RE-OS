import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

import { PROMPT_KEYS } from '../ai.constants';

export class UpsertPromptDto {
  @IsIn(Object.values(PROMPT_KEYS))
  key!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(10)
  system_prompt!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  user_prompt_template?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
