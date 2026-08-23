# RAG pipeline

```text
User Question

↓

Question Embedding

↓

Vector Similarity Search

↓

Top Relevant Document Chunks

↓

Context Construction

↓

System Prompt + Context + User Question

↓

OpenAI

↓

Structured Response

↓

Citation Validation

↓

Streaming Angular Interface
```

## Ingestion

1. The API accepts PDF, DOCX, TXT, and Markdown files up to 15 MB and checks both extension and MIME type.
2. The original file is stored in a private Supabase Storage bucket.
3. `pdf-parse` returns page-aware text, Mammoth extracts DOCX text, and UTF-8 decoding handles text and Markdown.
4. Whitespace is normalized. Paragraph blocks are accumulated toward roughly 650 tokens, capped near 800 tokens, with about 110 tokens of block overlap. Headings and page numbers are retained where detectable.
5. Chunks are embedded in batches of 50 using the configured OpenAI embedding model.
6. Each chunk and its 1,536-dimensional vector are stored in PostgreSQL. An HNSW cosine index accelerates retrieval.

Processing runs after the upload request is accepted. Angular polls while any document is uploading or processing. A failed extraction or embedding batch changes the document status to `failed` and stores a bounded error message.

## Retrieval and generation

The question is embedded once. `match_document_chunks` applies the selected document IDs before ranking by cosine distance and returns at most 12 chunks (five by default). The backend never sends the entire library to the model.

Retrieved chunks are serialized into tagged blocks containing the authoritative chunk ID, source name, page, section, and exact text. OpenAI streams a strict JSON-schema response. The backend extracts the partial `answer` string for progressive UI delivery while retaining the complete JSON for final Zod validation.

## Citation integrity

The model may return only `citationChunkIds`. The backend maps those IDs against the exact retrieval result. Unknown and duplicate IDs are removed. Document names, pages, sections, and excerpts always come from the database—not from model-authored metadata. If no relevant chunk exists, Grounded returns an explicit insufficient-evidence state without calling generation.

## Cancellation

The Angular client owns an `AbortController`. Stopping generation closes the request, the NestJS controller aborts the OpenAI request, and a useful partial answer is retained in conversation history when available.
