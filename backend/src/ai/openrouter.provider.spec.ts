import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterProvider } from './openrouter.provider';

function createProvider(
  values: Record<string, string> = {},
): OpenRouterProvider {
  return new OpenRouterProvider(
    new ConfigService({ OPENROUTER_API_KEY: 'test-key', ...values }),
  );
}

function setClient(provider: OpenRouterProvider, client: unknown): void {
  (
    provider as unknown as {
      client?: Promise<unknown>;
    }
  ).client = Promise.resolve(client);
}

describe('OpenRouterProvider', () => {
  it('requires a server-side OpenRouter key', () => {
    expect(() => new OpenRouterProvider(new ConfigService({}))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('uses the requested reasoning model and safe defaults', () => {
    expect(createProvider().getModels()).toEqual({
      provider: 'OpenRouter',
      chat: 'stealth/ox-alpha',
      embedding: 'openai/text-embedding-3-small',
      reasoningEffort: 'medium',
    });
  });

  it('rejects unsupported reasoning effort values', () => {
    expect(() =>
      createProvider({ OPENROUTER_REASONING_EFFORT: 'unlimited' }),
    ).toThrow(ServiceUnavailableException);
  });

  it('requests and validates 1,536-dimensional embeddings', async () => {
    type EmbeddingRequest = {
      requestBody: { model: string; dimensions?: number };
    };
    type EmbeddingResponse = {
      data: Array<{ embedding: number[]; index: number; object: string }>;
      model: string;
      object: string;
    };
    let embeddingRequest: EmbeddingRequest | undefined;
    const generate = jest.fn(
      (request: EmbeddingRequest): Promise<EmbeddingResponse> => {
        embeddingRequest = request;
        return Promise.resolve({
          data: [
            {
              embedding: Array.from({ length: 1536 }, () => 0.1),
              index: 0,
              object: 'embedding',
            },
          ],
          model: 'openai/text-embedding-3-small',
          object: 'list',
        });
      },
    );
    const provider = createProvider();
    setClient(provider, { embeddings: { generate } });

    const [embedding] = await provider.embed(['grounded evidence']);

    expect(embedding).toHaveLength(1536);
    expect(embeddingRequest?.requestBody).toMatchObject({
      model: 'openai/text-embedding-3-small',
      dimensions: 1536,
    });
  });

  it('enables reasoning and exposes only reasoning token usage', async () => {
    async function* response() {
      await Promise.resolve();
      yield {
        choices: [
          {
            delta: {
              content: '{"answer":"Supported answer"}',
              reasoningDetails: [
                { type: 'reasoning.text', text: 'private reasoning' },
              ],
            },
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          completionTokensDetails: { reasoningTokens: 12 },
        },
      };
    }
    type ChatSendRequest = {
      chatRequest: {
        model?: string;
        reasoning?: { effort?: string | null };
        stream?: boolean;
      };
    };
    let chatRequest: ChatSendRequest | undefined;
    let chatRequestOptions: { signal?: AbortSignal } | undefined;
    const send = jest.fn(
      (
        request: ChatSendRequest,
        options: { signal?: AbortSignal },
      ): Promise<AsyncIterable<unknown>> => {
        chatRequest = request;
        chatRequestOptions = options;
        return Promise.resolve(response());
      },
    );
    const provider = createProvider({ OPENROUTER_REASONING_EFFORT: 'high' });
    setClient(provider, { chat: { send } });

    const chunks = [];
    for await (const chunk of provider.streamStructured({
      messages: [{ role: 'user', content: 'Question' }],
      temperature: 0.1,
    })) {
      chunks.push(chunk);
    }

    expect(chatRequest?.chatRequest).toMatchObject({
      model: 'stealth/ox-alpha',
      reasoning: { effort: 'high' },
      stream: true,
    });
    expect(chatRequestOptions).toEqual({ signal: undefined });
    expect(chunks).toEqual([
      {
        rawJson: '{"answer":"Supported answer"}',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          reasoningTokens: 12,
        },
      },
    ]);
    expect(JSON.stringify(chunks)).not.toContain('private reasoning');
  });
});
