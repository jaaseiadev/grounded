import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpenRouter } from '@openrouter/sdk';
import type { ChatResult, ChatStreamChunk } from '@openrouter/sdk/models';
import {
  AiGenerationOptions,
  AiProvider,
  AiStreamChunk,
  AiUsage,
} from './ai-provider.interface';

const EMBEDDING_DIMENSIONS = 1536;
const REASONING_EFFORTS = [
  'max',
  'xhigh',
  'high',
  'medium',
  'low',
  'minimal',
  'none',
] as const;

type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

@Injectable()
export class OpenRouterProvider implements AiProvider {
  private client?: Promise<OpenRouter>;
  private readonly apiKey: string;
  private readonly httpReferer: string;
  private readonly appTitle: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly reasoningEffort: ReasoningEffort;
  private readonly maxCompletionTokens: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENROUTER_API_KEY', '');
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OpenRouter is not configured. Set OPENROUTER_API_KEY.',
      );
    }

    this.httpReferer = config.get<string>(
      'OPENROUTER_SITE_URL',
      config.get<string>('FRONTEND_URL', 'http://localhost:4200'),
    );
    this.appTitle = config.get<string>('OPENROUTER_APP_NAME', 'Grounded');
    this.chatModel = config.get<string>(
      'OPENROUTER_CHAT_MODEL',
      'stealth/ox-alpha',
    );
    this.embeddingModel = config.get<string>(
      'OPENROUTER_EMBEDDING_MODEL',
      'openai/text-embedding-3-small',
    );
    this.reasoningEffort = this.readReasoningEffort(config);
    this.maxCompletionTokens = this.readMaxCompletionTokens(config);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const client = await this.getClient();
    const response = await client.embeddings.generate({
      requestBody: {
        model: this.embeddingModel,
        input: texts,
        encodingFormat: 'float',
        dimensions: EMBEDDING_DIMENSIONS,
      },
    });
    if (typeof response === 'string') {
      throw new ServiceUnavailableException(
        'OpenRouter returned an invalid embedding response.',
      );
    }

    return response.data
      .map((item, position) => ({
        index: item.index ?? position,
        embedding: item.embedding,
      }))
      .sort((left, right) => left.index - right.index)
      .map(({ embedding }) => {
        if (
          !Array.isArray(embedding) ||
          embedding.length !== EMBEDDING_DIMENSIONS
        ) {
          throw new ServiceUnavailableException(
            `Embedding model must return ${EMBEDDING_DIMENSIONS} dimensions.`,
          );
        }
        return embedding;
      });
  }

  async *streamStructured(
    options: AiGenerationOptions,
  ): AsyncGenerator<AiStreamChunk> {
    const client = await this.getClient();
    const response = await client.chat.send(
      {
        chatRequest: {
          model: options.model ?? this.chatModel,
          messages: options.messages,
          temperature: options.temperature,
          maxCompletionTokens: this.maxCompletionTokens,
          reasoning: { effort: this.reasoningEffort },
          stream: true,
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'grounded_document_answer',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  answer: { type: 'string' },
                  citationChunkIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  grounded: { type: 'boolean' },
                  confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                  },
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
      },
      { signal: options.signal },
    );
    if (!this.isChatStream(response)) {
      throw new ServiceUnavailableException(
        'OpenRouter did not return a streaming response.',
      );
    }

    for await (const chunk of response) {
      if (chunk.error) throw new Error(chunk.error.message);
      const content = chunk.choices[0]?.delta.content ?? '';
      const usage = chunk.usage ? this.toUsage(chunk.usage) : undefined;
      if (content || usage) yield { rawJson: content, usage };
    }
  }

  async generateTitle(question: string): Promise<string> {
    const client = await this.getClient();
    const response = await client.chat.send({
      chatRequest: {
        model: this.chatModel,
        messages: [
          {
            role: 'system',
            content:
              'Create a concise 3-7 word title. Return only the title, without quotation marks.',
          },
          { role: 'user', content: question.slice(0, 500) },
        ],
        reasoning: { effort: 'none' },
        maxCompletionTokens: 30,
        stream: false,
      },
    });
    if (this.isChatStream(response)) {
      throw new ServiceUnavailableException(
        'OpenRouter returned an unexpected title stream.',
      );
    }
    const content = response.choices[0]?.message.content;
    return (
      (typeof content === 'string' ? content.trim().slice(0, 80) : '') ||
      question.slice(0, 80)
    );
  }

  getModels(): {
    provider: string;
    chat: string;
    embedding: string;
    reasoningEffort: string;
  } {
    return {
      provider: 'OpenRouter',
      chat: this.chatModel,
      embedding: this.embeddingModel,
      reasoningEffort: this.reasoningEffort,
    };
  }

  private readReasoningEffort(config: ConfigService): ReasoningEffort {
    const value = config.get<string>('OPENROUTER_REASONING_EFFORT', 'medium');
    if (!REASONING_EFFORTS.includes(value as ReasoningEffort)) {
      throw new ServiceUnavailableException(
        `OPENROUTER_REASONING_EFFORT must be one of: ${REASONING_EFFORTS.join(', ')}.`,
      );
    }
    return value as ReasoningEffort;
  }

  private getClient(): Promise<OpenRouter> {
    this.client ??= import('@openrouter/sdk').then(
      ({ OpenRouter: OpenRouterClient }) =>
        new OpenRouterClient({
          apiKey: this.apiKey,
          httpReferer: this.httpReferer,
          appTitle: this.appTitle,
        }),
    );
    return this.client;
  }

  private readMaxCompletionTokens(config: ConfigService): number {
    const value = Number(
      config.get<string>('OPENROUTER_MAX_COMPLETION_TOKENS', '4096'),
    );
    if (!Number.isInteger(value) || value < 128 || value > 32768) {
      throw new ServiceUnavailableException(
        'OPENROUTER_MAX_COMPLETION_TOKENS must be an integer from 128 to 32768.',
      );
    }
    return value;
  }

  private toUsage(usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    completionTokensDetails?: { reasoningTokens?: number | null } | null;
  }): AiUsage {
    const reasoningTokens =
      usage.completionTokensDetails?.reasoningTokens ?? undefined;
    return {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    };
  }

  private isChatStream(
    response: ChatResult | AsyncIterable<ChatStreamChunk>,
  ): response is AsyncIterable<ChatStreamChunk> {
    return Symbol.asyncIterator in response;
  }
}
