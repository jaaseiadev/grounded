import { Injectable } from '@nestjs/common';
import { RetrievalResult } from '../common/types/domain.types';
import { AiMessage } from './ai-provider.interface';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';

@Injectable()
export class PromptBuilderService {
  build(
    question: string,
    chunks: RetrievalResult[],
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  ): AiMessage[] {
    const context = chunks
      .map(
        (chunk) =>
          `<document_chunk id="${chunk.id}" document="${this.escapeAttribute(chunk.document_name)}" page="${chunk.page_number ?? 'unknown'}" section="${this.escapeAttribute(chunk.section ?? 'unknown')}">\n${chunk.content}\n</document_chunk>`,
      )
      .join('\n\n');

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `DOCUMENT CONTEXT START\n${context || '[No relevant document chunks were found.]'}\nDOCUMENT CONTEXT END\n\nUSER QUESTION START\n${question}\nUSER QUESTION END`,
      },
    ];
  }

  formatForInspector(messages: AiMessage[]): {
    system: string;
    contextAndUser: string;
  } {
    const system = messages[0]?.content;
    const contextAndUser = messages[1]?.content;
    return {
      system: typeof system === 'string' ? system : '',
      contextAndUser: typeof contextAndUser === 'string' ? contextAndUser : '',
    };
  }

  private escapeAttribute(value: string): string {
    return value.replace(/[&"<>]/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      };
      return entities[character];
    });
  }
}
