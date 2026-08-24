import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RunPlaygroundDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12_000)
  systemPrompt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(6_000)
  userPrompt!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  documentIds: string[] = [];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  retrievalCount = 5;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature = 0.1;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6_000)
  expectedAnswer?: string;
}
