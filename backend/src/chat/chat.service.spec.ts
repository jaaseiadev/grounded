import { PromptBuilderService } from '../ai/prompt-builder.service';
import { RetrievalResult } from '../common/types/domain.types';
import { ConversationsService } from '../conversations/conversations.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ChatService } from './chat.service';

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
});
