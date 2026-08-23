import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiGenerationOptions,
  AiProvider,
  AiStreamChunk,
} from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI is not configured. Set OPENAI_API_KEY.',
      );
    }
    this.client = new OpenAI({ apiKey });
    this.chatModel = config.get<string>('OPENAI_CHAT_MODEL', 'gpt-5-mini');
    this.embeddingModel = config.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
      encoding_format: 'float',
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async *streamStructured(
    options: AiGenerationOptions,
  ): AsyncGenerator<AiStreamChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: options.model ?? this.chatModel,
        messages: options.messages,
        temperature: options.temperature,
        stream: true,
        stream_options: { include_usage: true },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'grounded_document_answer',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                answer: { type: 'string' },
                citationChunkIds: { type: 'array', items: { type: 'string' } },
                grounded: { type: 'boolean' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: [
                'answer',
                'citationChunkIds',
                'grounded',
                'confidence',
              ],
            },
          },
        },
      },
      { signal: options.signal },
    );

    for await (const part of stream) {
      const content = part.choices[0]?.delta.content ?? '';
      const usage = part.usage
        ? {
            promptTokens: part.usage.prompt_tokens,
            completionTokens: part.usage.completion_tokens,
            totalTokens: part.usage.total_tokens,
          }
        : undefined;
      if (content || usage) yield { rawJson: content, usage };
    }
  }

  async generateTitle(question: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        {
          role: 'system',
          content:
            'Create a concise 3-7 word title. Return only the title, without quotation marks.',
        },
        { role: 'user', content: question.slice(0, 500) },
      ],
      max_completion_tokens: 30,
    });
    return (
      response.choices[0]?.message.content?.trim().slice(0, 80) ||
      question.slice(0, 80)
    );
  }

  getModels(): { chat: string; embedding: string } {
    return { chat: this.chatModel, embedding: this.embeddingModel };
  }
}
