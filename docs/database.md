# Database and storage

The initial migration is `supabase/migrations/202608240001_initial_schema.sql`.

## Tables

| Table             | Purpose                                                | Important relationships               |
| ----------------- | ------------------------------------------------------ | ------------------------------------- |
| `documents`       | File metadata, processing state, and chunk count       | Parent of chunks; deleting cascades   |
| `document_chunks` | Text, source metadata, and 1,536-dimensional embedding | `document_id → documents.id`          |
| `conversations`   | Chat title and timestamps                              | Parent of messages; deleting cascades |
| `messages`        | User/assistant content and validated citation JSON     | `conversation_id → conversations.id`  |
| `prompt_presets`  | Database-ready prompt preset representation            | Independent                           |

UUID primary keys use `pgcrypto`. Status and role fields use PostgreSQL enums. Check constraints bound file sizes, string lengths, temperatures, retrieval counts, and page numbers.

## Vector search

`document_chunks.embedding` is `vector(1536)`. The HNSW index uses cosine operators. `match_document_chunks` joins source names, filters ready documents and optional document IDs, ranks by cosine distance, and clamps the result to 1–12 rows.

Changing to an embedding model with a different vector width requires a migration and reprocessing all documents.

## Storage and access

The migration creates a private `documents` bucket with a 15 MB limit and accepted MIME types. The backend stores files at `<document UUID>/<sanitized filename>`.

RLS is enabled and all browser-role table privileges and vector RPC execution are revoked. The service role bypasses RLS from NestJS. Never expose that key to Angular. This single-user design has no public database policies.

## Deletion

Document deletion removes the private object first, then the document record. PostgreSQL cascades remove every associated chunk and embedding. Conversation deletion cascades to messages.
