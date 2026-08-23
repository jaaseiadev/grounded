import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  providers: [
    OpenAiProvider,
    { provide: AI_PROVIDER, useExisting: OpenAiProvider },
    PromptBuilderService,
  ],
  exports: [AI_PROVIDER, PromptBuilderService],
})
export class AiModule {}
