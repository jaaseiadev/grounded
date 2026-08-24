export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

interface DocumentsTable {
  Row: {
    id: string;
    name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    status: 'uploading' | 'processing' | 'ready' | 'failed';
    chunk_count: number;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    status?: 'uploading' | 'processing' | 'ready' | 'failed';
    chunk_count?: number;
    error_message?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<DocumentsTable['Insert']>;
  Relationships: [];
}

interface DocumentChunksTable {
  Row: {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: string;
    page_number: number | null;
    section: string | null;
    metadata: Json;
    created_at: string;
  };
  Insert: {
    id?: string;
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: string;
    page_number?: number | null;
    section?: string | null;
    metadata?: Json;
    created_at?: string;
  };
  Update: Partial<DocumentChunksTable['Insert']>;
  Relationships: [];
}

interface ConversationsTable {
  Row: { id: string; title: string; created_at: string; updated_at: string };
  Insert: {
    id?: string;
    title: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ConversationsTable['Insert']>;
  Relationships: [];
}

interface MessagesTable {
  Row: {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    citations: Json;
    created_at: string;
  };
  Insert: {
    id?: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: Json;
    created_at?: string;
  };
  Update: Partial<MessagesTable['Insert']>;
  Relationships: [];
}

interface PromptPresetsTable {
  Row: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    user_prompt_template: string;
    retrieval_count: number;
    temperature: number;
    created_at: string;
    updated_at: string;
  };
  Insert: Omit<PromptPresetsTable['Row'], 'created_at' | 'updated_at'> & {
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<PromptPresetsTable['Insert']>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      documents: DocumentsTable;
      document_chunks: DocumentChunksTable;
      conversations: ConversationsTable;
      messages: MessagesTable;
      prompt_presets: PromptPresetsTable;
    };
    Views: Record<string, never>;
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: string;
          match_count?: number;
          filter_document_ids?: string[] | null;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          document_name: string;
          chunk_index: number;
          content: string;
          page_number: number | null;
          section: string | null;
          metadata: Json;
          created_at: string;
          similarity: number;
        }>;
      };
    };
    Enums: {
      document_status: 'uploading' | 'processing' | 'ready' | 'failed';
      message_role: 'user' | 'assistant';
    };
    CompositeTypes: Record<string, never>;
  };
}
