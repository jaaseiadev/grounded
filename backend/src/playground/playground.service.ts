import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from '../ai/ai-provider.interface';
import type { AiProvider } from '../ai/ai-provider.interface';
import { PromptBuilderService } from '../ai/prompt-builder.service';
import { PROMPT_PRESETS } from '../ai/prompts';
import { parseStructuredAiResponse } from '../ai/structured-response';
import { ChatService } from '../chat/chat.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { RunPlaygroundDto } from './dto/run-playground.dto';

@Injectable()
export class PlaygroundService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly prompts: PromptBuilderService,
    private readonly chat: ChatService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  presets() {
    return PROMPT_PRESETS;
  }

  async run(dto: RunPlaygroundDto) {
    const startedAt = performance.now();
    const model = this.ai.getModels().chat;
    const retrieved = await this.retrieval.search(
      dto.userPrompt.trim(),
      dto.documentIds,
      dto.retrievalCount,
    );
    const messages = this.prompts.build(
      dto.userPrompt.trim(),
      retrieved,
      dto.systemPrompt.trim(),
    );
    const finalPrompt = this.prompts.formatForInspector(messages);

    if (retrieved.length === 0) {
      const answer =
        'I could not find enough relevant information in the available documents.';
      return {
        answer,
        citations: [],
        grounded: false,
        confidence: 'low' as const,
        retrieved,
        finalPrompt,
        latencyMs: Math.round(performance.now() - startedAt),
        usage: null,
        evaluation: this.evaluate(answer, dto.expectedAnswer),
      };
    }

    let raw = '';
    let usage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;
    try {
      for await (const part of this.ai.streamStructured({
        messages,
        temperature: dto.temperature,
        model,
      })) {
        raw += part.rawJson;
        usage = part.usage ?? usage;
      }
      const structured = parseStructuredAiResponse(raw);
      const citations = this.chat.validateCitations(
        structured.citationChunkIds,
        retrieved,
      );
      return {
        answer: structured.answer,
        citations,
        grounded: structured.grounded && citations.length > 0,
        confidence: structured.confidence,
        retrieved,
        finalPrompt,
        latencyMs: Math.round(performance.now() - startedAt),
        usage: usage ?? null,
        evaluation: this.evaluate(structured.answer, dto.expectedAnswer),
      };
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Playground run failed: ${error.message}`
          : 'Playground run failed.',
      );
    }
  }

  private evaluate(generated: string, expected?: string) {
    if (!expected?.trim()) return null;
    const stopWords = new Set([
      'that',
      'this',
      'with',
      'from',
      'have',
      'will',
      'would',
      'there',
      'their',
    ]);
    const expectedKeywords = [
      ...new Set(
        expected
          .toLowerCase()
          .match(/[a-z0-9]+/g)
          ?.filter((word) => word.length >= 4 && !stopWords.has(word)) ?? [],
      ),
    ].slice(0, 20);
    const normalizedGenerated = generated.toLowerCase();
    const matchedKeywords = expectedKeywords.filter((keyword) =>
      normalizedGenerated.includes(keyword),
    );
    return {
      expectedKeywords,
      matchedKeywords,
      coverage: expectedKeywords.length
        ? matchedKeywords.length / expectedKeywords.length
        : 1,
    };
  }
}
