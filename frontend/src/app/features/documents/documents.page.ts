import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  LucideAlertCircle,
  LucideCheckCircle,
  LucideEye,
  LucideFileText,
  LucideLoaderCircle,
  LucideRefreshCw,
  LucideTrash2,
  LucideUploadCloud,
  LucideX,
} from '@lucide/angular';
import { finalize, from, mergeMap } from 'rxjs';
import { Document, DocumentChunk } from '../../core/models/models';
import { DocumentService } from '../../core/services/document.service';

@Component({
  selector: 'app-documents-page',
  imports: [
    DatePipe,
    DecimalPipe,
    LucideAlertCircle,
    LucideCheckCircle,
    LucideEye,
    LucideFileText,
    LucideLoaderCircle,
    LucideRefreshCw,
    LucideTrash2,
    LucideUploadCloud,
    LucideX,
  ],
  templateUrl: './documents.page.html',
})
export class DocumentsPage {
  readonly documents = inject(DocumentService);
  readonly dragging = signal(false);
  readonly uploading = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly preview = signal<(Document & { chunks: DocumentChunk[] }) | null>(null);
  readonly previewLoading = signal(false);

  constructor() {
    this.documents.load();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFilePicker(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  view(document: Document): void {
    this.previewLoading.set(true);
    this.documents
      .get(document.id)
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        next: (detail) => this.preview.set(detail),
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  reprocess(document: Document): void {
    this.actionError.set(null);
    this.documents.reprocess(document.id).subscribe({
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  remove(document: Document): void {
    if (!window.confirm(`Delete “${document.name}” and all of its embeddings?`)) return;
    this.actionError.set(null);
    this.documents.delete(document.id).subscribe({
      next: () => {
        if (this.preview()?.id === document.id) this.preview.set(null);
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  fileExtension(name: string): string {
    return name.split('.').pop()?.toUpperCase() ?? 'FILE';
  }

  private uploadFiles(files: File[]): void {
    if (files.length === 0 || this.uploading()) return;
    const invalid = files.find(
      (file) => !/\.(pdf|docx|txt|md)$/i.test(file.name) || file.size > 15 * 1024 * 1024,
    );
    if (invalid) {
      this.actionError.set(`“${invalid.name}” is unsupported or larger than 15 MB.`);
      return;
    }
    this.actionError.set(null);
    this.uploading.set(true);
    from(files)
      .pipe(
        mergeMap((file) => this.documents.upload(file), 2),
        finalize(() => this.uploading.set(false)),
      )
      .subscribe({ error: (error: Error) => this.actionError.set(error.message) });
  }
}
