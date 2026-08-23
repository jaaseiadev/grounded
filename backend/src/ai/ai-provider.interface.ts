import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AiGenerationOptions {
  messages: ChatCompletionMessageParam[];
  temperature: number;
  model?: string;
  signal?: AbortSignal;
}

export interface AiStreamChunk {
  rawJson: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  embed(texts: string[]): Promise<number[][]>;
  streamStructured(options: AiGenerationOptions): AsyncGenerator<AiStreamChunk>;
  generateTitle(question: string): Promise<string>;
  getModels(): { chat: string; embedding: string };
}
