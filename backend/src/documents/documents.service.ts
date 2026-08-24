import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AI_PROVIDER } from '../ai/ai-provider.interface';
import type { AiProvider } from '../ai/ai-provider.interface';
import {
  DocumentChunkRecord,
  DocumentRecord,
} from '../common/types/domain.types';
import { SupabaseService } from '../database/supabase.service';
import { ChunkerService } from './chunker.service';
import { DocumentParserService } from './document-parser.service';
import { sanitizeFilename, validateDocumentFile } from './document-validation';

@Injectable()
export class DocumentsService {
  private readonly bucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly parser: DocumentParserService,
    private readonly chunker: ChunkerService,
    private readonly config: ConfigService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {
    this.bucket = this.config.get<string>(
      'SUPABASE_STORAGE_BUCKET',
      'documents',
    );
  }

  async list(): Promise<DocumentRecord[]> {
    const result = await this.supabase.client
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    return this.supabase.unwrap(result, 'Unable to load documents');
  }

  async findOne(
    id: string,
  ): Promise<DocumentRecord & { chunks: DocumentChunkRecord[] }> {
    const [documentResult, chunksResult] = await Promise.all([
      this.supabase.client
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
      this.supabase.client
        .from('document_chunks')
        .select(
          'id, document_id, chunk_index, content, page_number, section, metadata, created_at',
        )
        .eq('document_id', id)
        .order('chunk_index'),
    ]);
    if (documentResult.error)
      throw new ServiceUnavailableException(documentResult.error.message);
    if (!documentResult.data)
      throw new NotFoundException('Document not found.');
    return {
      ...documentResult.data,
      chunks: this.supabase
        .unwrap(chunksResult, 'Unable to load document chunks')
        .map((chunk) => ({
          ...chunk,
          metadata:
            chunk.metadata &&
            typeof chunk.metadata === 'object' &&
            !Array.isArray(chunk.metadata)
              ? chunk.metadata
              : {},
        })),
    };
  }

  async upload(file: Express.Multer.File): Promise<DocumentRecord> {
    validateDocumentFile(file);
    const id = randomUUID();
    const filename = sanitizeFilename(file.originalname);
    const storagePath = `${id}/${filename}`;
    const uploadResult = await this.supabase.client.storage
      .from(this.bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (uploadResult.error) {
      throw new ServiceUnavailableException(
        `Unable to store document: ${uploadResult.error.message}`,
      );
    }

    const insertResult = await this.supabase.client
      .from('documents')
      .insert({
        id,
        name: filename,
        file_type: file.mimetype,
        file_size: file.size,
        storage_path: storagePath,
        status: 'processing',
      })
      .select('*')
      .single();
    const document = this.supabase.unwrap(
      insertResult,
      'Unable to create document',
    );
    void this.process(id, file.buffer).catch(() => undefined);
    return document;
  }

  async reprocess(id: string): Promise<DocumentRecord> {
    const document = await this.findOne(id);
    await this.updateStatus(id, 'processing', null);
    const download = await this.supabase.client.storage
      .from(this.bucket)
      .download(document.storage_path);
    if (download.error)
      throw new ServiceUnavailableException(download.error.message);
    const buffer = Buffer.from(await download.data.arrayBuffer());
    void this.process(id, buffer).catch(() => undefined);
    return { ...document, status: 'processing', error_message: null };
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    const storageResult = await this.supabase.client.storage
      .from(this.bucket)
      .remove([document.storage_path]);
    if (storageResult.error) {
      throw new ServiceUnavailableException(
        `Unable to delete source file: ${storageResult.error.message}`,
      );
    }
    const deleteResult = await this.supabase.client
      .from('documents')
      .delete()
      .eq('id', id);
    if (deleteResult.error)
      throw new ServiceUnavailableException(deleteResult.error.message);
  }

  private async process(id: string, buffer: Buffer): Promise<void> {
    try {
      const documentResult = await this.supabase.client
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();
      const document = this.supabase.unwrap(
        documentResult,
        'Unable to process document',
      );
      const pages = await this.parser.extract(
        buffer,
        document.file_type,
        document.name,
      );
      const chunks = this.chunker.chunk(pages);
      if (chunks.length === 0)
        throw new Error('No readable text was found in this document.');

      const embeddings: number[][] = [];
      for (let offset = 0; offset < chunks.length; offset += 50) {
        embeddings.push(
          ...(await this.ai.embed(
            chunks.slice(offset, offset + 50).map((item) => item.content),
          )),
        );
      }

      const deleteResult = await this.supabase.client
        .from('document_chunks')
        .delete()
        .eq('document_id', id);
      if (deleteResult.error) throw new Error(deleteResult.error.message);

      const records = chunks.map((chunk, index) => ({
        id: randomUUID(),
        document_id: id,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: `[${embeddings[index].join(',')}]`,
        page_number: chunk.pageNumber,
        section: chunk.section,
        metadata: { tokenEstimate: chunk.tokenEstimate },
      }));
      for (let offset = 0; offset < records.length; offset += 100) {
        const insert = await this.supabase.client
          .from('document_chunks')
          .insert(records.slice(offset, offset + 100));
        if (insert.error) throw new Error(insert.error.message);
      }
      await this.updateStatus(id, 'ready', null, chunks.length);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Document processing failed.';
      await this.updateStatus(id, 'failed', message.slice(0, 500));
      throw error;
    }
  }

  private async updateStatus(
    id: string,
    status: DocumentRecord['status'],
    errorMessage: string | null,
    chunkCount?: number,
  ): Promise<void> {
    const values: {
      status: DocumentRecord['status'];
      error_message: string | null;
      chunk_count?: number;
    } = {
      status,
      error_message: errorMessage,
    };
    if (chunkCount !== undefined) values.chunk_count = chunkCount;
    const result = await this.supabase.client
      .from('documents')
      .update(values)
      .eq('id', id);
    if (result.error)
      throw new ServiceUnavailableException(result.error.message);
  }
}
