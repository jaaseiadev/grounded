import { Location } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  LucideBot,
  LucideFileText,
  LucideLeaf,
  LucideLoaderCircle,
  LucideSend,
  LucideSquare,
  LucideUser,
} from '@lucide/angular';
import { filter, map } from 'rxjs';
import { ChatMessage, ChatStreamEvent, Citation } from '../../core/models/models';
import { AiService } from '../../core/services/ai.service';
import { ConversationService } from '../../core/services/conversation.service';
import { DocumentService } from '../../core/services/document.service';
import { CitationPanelComponent } from '../../shared/citation-panel.component';
import { DocumentScopeComponent } from '../../shared/document-scope.component';

@Component({
  selector: 'app-chat-page',
  imports: [
    ReactiveFormsModule,
    CitationPanelComponent,
    DocumentScopeComponent,
    LucideBot,
    LucideFileText,
    LucideLeaf,
    LucideLoaderCircle,
    LucideSend,
    LucideSquare,
    LucideUser,
  ],
  templateUrl: './chat.page.html',
})
export class ChatPage implements AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly ai = inject(AiService);
  readonly documents = inject(DocumentService);
  readonly conversations = inject(ConversationService);
  private abortController?: AbortController;
  private shouldScroll = false;

  @ViewChild('messageViewport') private messageViewport?: ElementRef<HTMLElement>;

  readonly question = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(6000)],
  });
  readonly messages = signal<ChatMessage[]>([]);
  readonly conversationId = signal<string | null>(null);
  readonly selectedDocumentIds = signal<string[]>([]);
  readonly streaming = signal(false);
  readonly retrievalStatus = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly activeCitation = signal<Citation | null>(null);
  readonly title = computed(() => this.conversations.current()?.title ?? 'New conversation');
  readonly hasReadyDocuments = computed(() => this.documents.readyDocuments().length > 0);
  readonly suggestions = [
    'Summarize the most important points.',
    'What actions or deadlines are described?',
    'Compare the key claims across these documents.',
  ];

  constructor() {
    this.documents.load();
    this.route.paramMap
      .pipe(
        map((params) => params.get('conversationId')),
        filter((id): id is string | null => id !== undefined),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.abortController?.abort();
        this.conversationId.set(id);
        this.error.set(null);
        if (id) {
          this.conversations.load(id);
        } else {
          this.conversations.clearCurrent();
          this.messages.set([]);
        }
      });

    effect(() => {
      const current = this.conversations.current();
      if (current && current.id === this.conversationId()) {
        this.messages.set(current.messages ?? []);
        this.queueScroll();
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messageViewport) {
      this.messageViewport.nativeElement.scrollTop =
        this.messageViewport.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  useSuggestion(suggestion: string): void {
    this.question.setValue(suggestion);
    this.send();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const question = this.question.value.trim();
    if (!question || this.streaming()) return;
    if (!this.hasReadyDocuments()) {
      this.error.set('Upload and process at least one document before asking a question.');
      return;
    }

    this.error.set(null);
    this.question.setValue('');
    this.streaming.set(true);
    this.retrievalStatus.set('Searching your documents…');
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: this.conversationId() ?? 'pending',
      role: 'user',
      content: question,
      citations: [],
      created_at: now,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      conversation_id: this.conversationId() ?? 'pending',
      role: 'assistant',
      content: '',
      citations: [],
      created_at: now,
      streaming: true,
    };
    this.messages.update((items) => [...items, userMessage, assistantMessage]);
    this.queueScroll();
    this.abortController = new AbortController();

    void this.ai
      .streamChat(
        {
          question,
          conversationId: this.conversationId() ?? undefined,
          documentIds: this.selectedDocumentIds(),
          retrievalCount: 5,
        },
        (event) => this.handleStreamEvent(event, assistantId),
        this.abortController.signal,
      )
      .then(() => {
        this.finishStream(assistantId);
        this.conversations.loadList();
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.finishStream(assistantId);
          return;
        }
        this.error.set(error instanceof Error ? error.message : 'Unable to generate an answer.');
        this.finishStream(assistantId);
      });
  }

  stop(): void {
    this.abortController?.abort();
    this.streaming.set(false);
    this.retrievalStatus.set(null);
  }

  private handleStreamEvent(event: ChatStreamEvent, assistantId: string): void {
    if (event.type === 'conversation') {
      this.conversationId.set(event.conversationId);
      this.location.replaceState(`/chat/${event.conversationId}`);
      return;
    }
    if (event.type === 'retrieval') {
      this.retrievalStatus.set(
        event.count > 0 ? `Using ${event.count} relevant sources` : 'No relevant sources found',
      );
      return;
    }
    if (event.type === 'delta') {
      this.updateAssistant(assistantId, (message) => ({
        ...message,
        content: message.content + event.content,
      }));
      this.queueScroll();
      return;
    }
    if (event.type === 'complete') {
      this.updateAssistant(assistantId, (message) => ({
        ...message,
        citations: event.citations,
        streaming: false,
      }));
      this.streaming.set(false);
      this.retrievalStatus.set(null);
      return;
    }
    this.error.set(event.message);
  }

  private finishStream(assistantId: string): void {
    this.updateAssistant(assistantId, (message) => ({ ...message, streaming: false }));
    this.streaming.set(false);
    this.retrievalStatus.set(null);
  }

  private updateAssistant(id: string, update: (message: ChatMessage) => ChatMessage): void {
    this.messages.update((items) => items.map((item) => (item.id === id ? update(item) : item)));
  }

  private queueScroll(): void {
    this.shouldScroll = true;
  }
}
