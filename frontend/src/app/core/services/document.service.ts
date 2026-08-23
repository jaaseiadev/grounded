import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, filter, finalize, map, tap, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Document, DocumentChunk } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private polling?: Subscription;
  readonly documents = signal<Document[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly uploadProgress = signal(0);
  readonly readyDocuments = computed(() =>
    this.documents().filter((document) => document.status === 'ready'),
  );

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<Document[]>('/api/documents')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (documents) => {
          this.documents.set(documents);
          this.configurePolling(documents);
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  upload(file: File): Observable<Document> {
    const form = new FormData();
    form.append('file', file);
    this.uploadProgress.set(0);
    return this.http
      .post<Document>('/api/documents/upload', form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        tap((event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
          }
        }),
        filter((event) => event.type === HttpEventType.Response),
        map((event) => event.body as Document),
        tap((document) => {
          this.documents.update((items) => [document, ...items]);
          this.configurePolling(this.documents());
        }),
        finalize(() => this.uploadProgress.set(0)),
      );
  }

  get(id: string): Observable<Document & { chunks: DocumentChunk[] }> {
    return this.http.get<Document & { chunks: DocumentChunk[] }>(`/api/documents/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`/api/documents/${id}`)
      .pipe(tap(() => this.documents.update((items) => items.filter((item) => item.id !== id))));
  }

  reprocess(id: string): Observable<Document> {
    return this.http.post<Document>(`/api/documents/${id}/reprocess`, {}).pipe(
      tap((document) => {
        this.documents.update((items) =>
          items.map((item) => (item.id === document.id ? document : item)),
        );
        this.configurePolling(this.documents());
      }),
    );
  }

  private configurePolling(documents: Document[]): void {
    const processing = documents.some((document) =>
      ['uploading', 'processing'].includes(document.status),
    );
    if (!processing) {
      this.polling?.unsubscribe();
      this.polling = undefined;
      return;
    }
    if (this.polling) return;
    this.polling = timer(2500, 2500)
      .pipe(switchMap(() => this.http.get<Document[]>('/api/documents')))
      .subscribe({
        next: (items) => {
          this.documents.set(items);
          this.configurePolling(items);
        },
        error: () => {
          this.polling?.unsubscribe();
          this.polling = undefined;
        },
      });
  }
}
