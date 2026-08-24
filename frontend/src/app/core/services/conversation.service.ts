import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Conversation } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  readonly conversations = signal<Conversation[]>([]);
  readonly current = signal<Conversation | null>(null);
  readonly loading = signal(false);

  loadList(): void {
    this.http.get<Conversation[]>('/api/conversations').subscribe({
      next: (items) => this.conversations.set(items),
    });
  }

  load(id: string): void {
    this.loading.set(true);
    this.http.get<Conversation>(`/api/conversations/${id}`).subscribe({
      next: (conversation) => {
        this.current.set(conversation);
        this.loading.set(false);
      },
      error: () => {
        this.current.set(null);
        this.loading.set(false);
      },
    });
  }

  clearCurrent(): void {
    this.current.set(null);
  }

  addOptimistic(conversation: Conversation): void {
    this.conversations.update((items) => [conversation, ...items]);
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`/api/conversations/${id}`)
      .pipe(
        tap(() => this.conversations.update((items) => items.filter((item) => item.id !== id))),
      );
  }
}
