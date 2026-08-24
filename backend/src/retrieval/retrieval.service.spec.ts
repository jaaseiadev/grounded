import { AiProvider } from '../ai/ai-provider.interface';
import { SupabaseService } from '../database/supabase.service';
import { RetrievalService } from './retrieval.service';

describe('RetrievalService', () => {
  it('embeds the query and passes document scope to pgvector RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'chunk-1',
          document_id: 'document-1',
          document_name: 'policy.pdf',
          chunk_index: 0,
          content: 'Relevant evidence',
          page_number: 1,
          section: null,
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          similarity: 0.88,
        },
      ],
      error: null,
    });
    const supabase = { client: { rpc } } as unknown as SupabaseService;
    const ai: AiProvider = {
      embed: jest.fn().mockResolvedValue([[0.1, 0.2]]),
      streamStructured: jest.fn(),
      generateTitle: jest.fn(),
      getModels: jest.fn(),
    };
    const service = new RetrievalService(supabase, ai);

    const result = await service.search(
      'refund',
      ['11111111-1111-4111-8111-111111111111'],
      5,
    );

    expect(rpc).toHaveBeenCalledWith(
      'match_document_chunks',
      expect.objectContaining({
        match_count: 5,
        filter_document_ids: ['11111111-1111-4111-8111-111111111111'],
      }),
    );
    expect(result[0].rank).toBe(1);
  });
});
