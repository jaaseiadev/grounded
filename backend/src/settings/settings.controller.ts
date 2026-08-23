import { Controller, Get, Inject } from '@nestjs/common';
import { AI_PROVIDER } from '../ai/ai-provider.interface';
import type { AiProvider } from '../ai/ai-provider.interface';

@Controller('settings')
export class SettingsController {
  constructor(@Inject(AI_PROVIDER) private readonly ai: AiProvider) {}

  @Get('models')
  models() {
    const models = this.ai.getModels();
    return {
      ...models,
      availableChatModels: [models.chat],
      defaults: { retrievalCount: 5, temperature: 0.1 },
      application: { name: 'Grounded', version: '1.0.0', mode: 'single-user' },
    };
  }
}
