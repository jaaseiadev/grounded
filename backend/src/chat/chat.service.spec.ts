import { PromptBuilderService } from '../ai/prompt-builder.service';
import { RetrievalResult } from '../common/types/domain.types';
import { ConversationsService } from '../conversations/conversations.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ChatService, ChatStreamEvent } from './chat.service';

describe('ChatService citation validation', () => {
  const service = new ChatService(
    {} as RetrievalService,
    {} as PromptBuilderService,
    {} as ConversationsService,
    {
      embed: jest.fn(),
      streamStructured: jest.fn(),
      generateTitle: jest.fn(),
      getModels: jest.fn(),
    },
  );
  const chunk: RetrievalResult = {
    id: 'valid-chunk',
    document_id: 'document-1',
    document_name: 'policy.pdf',
    chunk_index: 2,
    content: 'The replacement window is 30 days.',
    page_number: 4,
    section: 'Damaged products',
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    similarity: 0.9,
    rank: 1,
  };

  it('removes nonexistent and duplicate citation ids', () => {
    const citations = service.validateCitations(
      ['valid-chunk', 'invented-chunk', 'valid-chunk'],
      [chunk],
    );
    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual(
      expect.objectContaining({ chunkId: 'valid-chunk', page: 4 }),
    );
  });

  it('completes conservatively when model metadata is truncated', async () => {
    const addMessage = jest.fn().mockResolvedValue(undefined);
    const streamingService = new ChatService(
      {
        search: jest.fn().mockResolvedValue([chunk]),
      } as unknown as RetrievalService,
      {
        build: jest
          .fn()
          .mockReturnValue([{ role: 'user', content: 'Question' }]),
      } as unknown as PromptBuilderService,
      {
        findOne: jest.fn().mockResolvedValue(undefined),
        addMessage,
      } as unknown as ConversationsService,
      {
        embed: jest.fn(),
        async *streamStructured() {
          await Promise.resolve();
          yield {
            rawJson: '{"answer":"Recovered answer","citationChunkIds": [',
          };
        },
        generateTitle: jest.fn(),
        getModels: jest.fn(),
      },
    );
    const events: ChatStreamEvent[] = [];

    for await (const event of streamingService.stream(
      {
        question: 'Question',
        conversationId: 'conversation-1',
        documentIds: [],
        retrievalCount: 5,
      },
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: 'delta',
      content: 'Recovered answer',
    });
    expect(events).toContainEqual({
      type: 'complete',
      citations: [],
      grounded: false,
      confidence: 'low',
      usage: undefined,
    });
    expect(addMessage).toHaveBeenLastCalledWith(
      'conversation-1',
      'assistant',
      'Recovered answer',
      [],
    );
  });
});
