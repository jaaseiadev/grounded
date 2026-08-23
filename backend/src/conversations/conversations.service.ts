import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Citation,
  ConversationRecord,
  MessageRecord,
  MessageRole,
} from '../common/types/domain.types';
import { SupabaseService } from '../database/supabase.service';
import { Json } from '../database/database.types';

@Injectable()
export class ConversationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<ConversationRecord[]> {
    const result = await this.supabase.client
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    return this.supabase.unwrap(result, 'Unable to load conversations');
  }

  async create(title = 'New conversation'): Promise<ConversationRecord> {
    const result = await this.supabase.client
      .from('conversations')
      .insert({
        id: randomUUID(),
        title: title.trim().slice(0, 120) || 'New conversation',
      })
      .select('*')
      .single();
    return this.supabase.unwrap(result, 'Unable to create conversation');
  }

  async findOne(
    id: string,
  ): Promise<ConversationRecord & { messages: MessageRecord[] }> {
    const [conversationResult, messagesResult] = await Promise.all([
      this.supabase.client
        .from('conversations')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
      this.supabase.client
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at'),
    ]);
    if (conversationResult.error)
      throw new ServiceUnavailableException(conversationResult.error.message);
    if (!conversationResult.data)
      throw new NotFoundException('Conversation not found.');
    return {
      ...conversationResult.data,
      messages: this.supabase
        .unwrap(messagesResult, 'Unable to load messages')
        .map((message) => ({
          ...message,
          citations: this.parseCitations(message.citations),
        })),
    };
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    citations: Citation[] = [],
  ): Promise<MessageRecord> {
    const result = await this.supabase.client
      .from('messages')
      .insert({
        id: randomUUID(),
        conversation_id: conversationId,
        role,
        content,
        citations: citations.map((citation) => this.citationToJson(citation)),
      })
      .select('*')
      .single();
    if (result.error?.message.includes('foreign key'))
      throw new NotFoundException('Conversation not found.');
    const saved = this.supabase.unwrap(result, 'Unable to save message');
    const message: MessageRecord = {
      ...saved,
      citations: this.parseCitations(saved.citations),
    };
    await this.supabase.client
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    return message;
  }

  async updateTitle(id: string, title: string): Promise<void> {
    const result = await this.supabase.client
      .from('conversations')
      .update({ title: title.slice(0, 120) })
      .eq('id', id);
    if (result.error)
      throw new ServiceUnavailableException(result.error.message);
  }

  async remove(id: string): Promise<void> {
    const result = await this.supabase.client
      .from('conversations')
      .delete()
      .eq('id', id)
      .select('id');
    if (result.error)
      throw new ServiceUnavailableException(result.error.message);
    if (!result.data?.length)
      throw new NotFoundException('Conversation not found.');
  }

  private citationToJson(citation: Citation): Json {
    return {
      chunkId: citation.chunkId,
      documentId: citation.documentId,
      documentName: citation.documentName,
      page: citation.page,
      section: citation.section,
      excerpt: citation.excerpt,
    };
  }

  private parseCitations(value: Json): Citation[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') return [];
      const chunkId = item['chunkId'];
      const documentId = item['documentId'];
      const documentName = item['documentName'];
      const excerpt = item['excerpt'];
      const page = item['page'];
      const section = item['section'];
      if (
        typeof chunkId !== 'string' ||
        typeof documentId !== 'string' ||
        typeof documentName !== 'string' ||
        typeof excerpt !== 'string'
      ) {
        return [];
      }
      return [
        {
          chunkId,
          documentId,
          documentName,
          excerpt,
          page: typeof page === 'number' ? page : null,
          section: typeof section === 'string' ? section : null,
        },
      ];
    });
  }
}
