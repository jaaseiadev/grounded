import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_PROVIDER } from '../ai/ai-provider.interface';
import type { AiProvider } from '../ai/ai-provider.interface';
import { RetrievalResult } from '../common/types/domain.types';
import { SupabaseService } from '../database/supabase.service';

interface MatchRow {
  id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  similarity: number;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async search(
    query: string,
    documentIds: string[],
    count: number,
  ): Promise<RetrievalResult[]> {
    const [queryEmbedding] = await this.ai.embed([query]);
    const result = await this.supabase.client.rpc('match_document_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_count: Math.min(Math.max(count, 1), 12),
      filter_document_ids: documentIds.length > 0 ? documentIds : null,
    });
    if (result.error) {
      throw new ServiceUnavailableException(
        `Vector search failed: ${result.error.message}`,
      );
    }
    return ((result.data ?? []) as MatchRow[]).map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }
}
