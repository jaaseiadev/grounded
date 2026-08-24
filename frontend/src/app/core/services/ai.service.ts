import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ChatStreamEvent,
  PlaygroundResult,
  PromptConfiguration,
  PromptPreset,
} from '../models/models';

export interface ChatRequest {
  question: string;
  conversationId?: string;
  documentIds: string[];
  retrievalCount: number;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);

  async streamChat(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? `Request failed (${response.status}).`);
    }
    if (!response.body) throw new Error('The streaming response was empty.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) onEvent(JSON.parse(line) as ChatStreamEvent);
      }
      if (done) break;
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatStreamEvent);
  }

  presets(): Observable<PromptPreset[]> {
    return this.http.get<PromptPreset[]>('/api/playground/presets');
  }

  runPlayground(configuration: PromptConfiguration): Observable<PlaygroundResult> {
    return this.http.post<PlaygroundResult>('/api/playground/run', configuration);
  }
}
