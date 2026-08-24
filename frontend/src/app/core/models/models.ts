export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed';
export type MessageRole = 'user' | 'assistant';

export interface Document {
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

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number | null;
  section: string | null;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  created_at: string;
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface AIResponse {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface PromptConfiguration {
  systemPrompt: string;
  userPrompt: string;
  documentIds: string[];
  retrievalCount: number;
  temperature: number;
  model: string;
  expectedAnswer?: string;
}

export interface RetrievalResult extends DocumentChunk {
  document_name: string;
  similarity: number;
  rank: number;
}

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  retrievalCount: number;
  temperature: number;
}

export interface PlaygroundResult extends AIResponse {
  retrieved: RetrievalResult[];
  finalPrompt: { system: string; contextAndUser: string };
  latencyMs: number;
  usage: AIUsage | null;
  evaluation: {
    expectedKeywords: string[];
    matchedKeywords: string[];
    coverage: number;
  } | null;
}

export interface Settings {
  provider: string;
  chat: string;
  embedding: string;
  reasoningEffort: string;
  availableChatModels: string[];
  defaults: { retrievalCount: number; temperature: number };
  application: { name: string; version: string; mode: string };
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string; title: string }
  | { type: 'retrieval'; count: number }
  | { type: 'delta'; content: string }
  | {
      type: 'complete';
      citations: Citation[];
      grounded: boolean;
      confidence: 'high' | 'medium' | 'low';
      usage?: AIUsage;
    }
  | { type: 'error'; message: string };
