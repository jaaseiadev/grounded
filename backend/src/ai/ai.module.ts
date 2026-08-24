import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenRouterProvider } from './openrouter.provider';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  providers: [
    OpenRouterProvider,
    { provide: AI_PROVIDER, useExisting: OpenRouterProvider },
    PromptBuilderService,
  ],
  exports: [AI_PROVIDER, PromptBuilderService],
})
export class AiModule {}
