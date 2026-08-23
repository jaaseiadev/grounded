import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  question!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  documentIds: string[] = [];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  retrievalCount = 5;
}
