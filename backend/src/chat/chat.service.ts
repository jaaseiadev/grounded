import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from '../ai/ai-provider.interface';
import type { AiProvider, AiUsage } from '../ai/ai-provider.interface';
import { PromptBuilderService } from '../ai/prompt-builder.service';
import {
  extractPartialAnswer,
  recoverStructuredAiResponse,
} from '../ai/structured-response';
import { Citation, RetrievalResult } from '../common/types/domain.types';
import { ConversationsService } from '../conversations/conversations.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ChatDto } from './dto/chat.dto';

export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string; title: string }
  | { type: 'retrieval'; count: number }
  | { type: 'delta'; content: string }
  | {
      type: 'complete';
      citations: Citation[];
      grounded: boolean;
      confidence: 'high' | 'medium' | 'low';
      usage?: AiUsage;
    };

@Injectable()
export class ChatService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly prompts: PromptBuilderService,
    private readonly conversations: ConversationsService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async *stream(
    dto: ChatDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const question = dto.question.trim();
    let isNewConversation = false;
    let conversationId = dto.conversationId;
    if (!conversationId) {
      const fallbackTitle = question.slice(0, 64) || 'New conversation';
      const conversation = await this.conversations.create(fallbackTitle);
      conversationId = conversation.id;
      isNewConversation = true;
      yield { type: 'conversation', conversationId, title: conversation.title };
    } else {
      await this.conversations.findOne(conversationId);
    }

    await this.conversations.addMessage(conversationId, 'user', question);
    if (isNewConversation) {
      void this.ai
        .generateTitle(question)
        .then((title) => this.conversations.updateTitle(conversationId, title))
        .catch(() => undefined);
    }

    const chunks = await this.retrieval.search(
      question,
      dto.documentIds,
      dto.retrievalCount,
    );
    yield { type: 'retrieval', count: chunks.length };
    if (chunks.length === 0) {
      const answer =
        'I could not find enough relevant information in the available documents.';
      yield { type: 'delta', content: answer };
      await this.conversations.addMessage(conversationId, 'assistant', answer);
      yield {
        type: 'complete',
        citations: [],
        grounded: false,
        confidence: 'low',
      };
      return;
    }

    const messages = this.prompts.build(question, chunks);
    let rawJson = '';
    let streamedAnswer = '';
    let usage: AiUsage | undefined;
    try {
      for await (const part of this.ai.streamStructured({
        messages,
        temperature: 0.1,
        signal,
      })) {
        rawJson += part.rawJson;
        usage = part.usage ?? usage;
        const partialAnswer = extractPartialAnswer(rawJson);
        if (partialAnswer.length > streamedAnswer.length) {
          const content = partialAnswer.slice(streamedAnswer.length);
          streamedAnswer = partialAnswer;
          yield { type: 'delta', content };
        }
      }
    } catch (error) {
      if (signal.aborted) {
        if (streamedAnswer) {
          await this.conversations.addMessage(
            conversationId,
            'assistant',
            streamedAnswer,
          );
        }
        return;
      }
      throw new BadGatewayException(
        error instanceof Error
          ? `AI provider request failed: ${error.message}`
          : 'AI provider request failed.',
      );
    }

    const structured = recoverStructuredAiResponse(rawJson) ?? {
      answer:
        'The AI provider returned an empty response. Please try your question again.',
      citationChunkIds: [],
      grounded: false,
      confidence: 'low' as const,
    };
    const citations = this.validateCitations(
      structured.citationChunkIds,
      chunks,
    );
    const finalAnswer = structured.answer;
    if (finalAnswer.length > streamedAnswer.length) {
      yield {
        type: 'delta',
        content: finalAnswer.slice(streamedAnswer.length),
      };
    }
    await this.conversations.addMessage(
      conversationId,
      'assistant',
      finalAnswer,
      citations,
    );
    yield {
      type: 'complete',
      citations,
      grounded: structured.grounded && citations.length > 0,
      confidence: structured.confidence,
      usage,
    };
  }

  validateCitations(
    chunkIds: string[],
    retrieved: RetrievalResult[],
  ): Citation[] {
    const retrievedById = new Map(retrieved.map((chunk) => [chunk.id, chunk]));
    return [...new Set(chunkIds)]
      .map((id) => retrievedById.get(id))
      .filter((chunk): chunk is RetrievalResult => Boolean(chunk))
      .map((chunk) => ({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentName: chunk.document_name,
        page: chunk.page_number,
        section: chunk.section,
        excerpt: chunk.content,
      }));
  }
}
