export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed';
export type MessageRole = 'user' | 'assistant';

export interface DocumentRecord {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RetrievalResult extends DocumentChunkRecord {
  document_name: string;
  similarity: number;
  rank: number;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number | null;
  section: string | null;
  excerpt: string;
}

export interface StructuredAiResponse {
  answer: string;
  citationChunkIds: string[];
  grounded: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConversationRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
  retrieval_count: number;
  temperature: number;
}
