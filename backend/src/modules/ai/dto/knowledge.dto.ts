import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import { KNOWLEDGE_TYPES } from '../ai.constants';

export class CreateKnowledgeDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  content!: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsString()
  source_id?: string;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  content?: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class KnowledgeSearchDto {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ListKnowledgeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_TYPES as unknown as string[])
  type?: string;
}
