export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface AiGenerationOptions {
  messages: AiMessage[];
  temperature: number;
  model?: string;
  signal?: AbortSignal;
}

export interface AiStreamChunk {
  rawJson: string;
  usage?: AiUsage;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  embed(texts: string[]): Promise<number[][]>;
  streamStructured(options: AiGenerationOptions): AsyncGenerator<AiStreamChunk>;
  generateTitle(question: string): Promise<string>;
  getModels(): {
    provider: string;
    chat: string;
    embedding: string;
    reasoningEffort: string;
  };
}
