import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SettingsController } from './settings.controller';

@Module({ imports: [AiModule], controllers: [SettingsController] })
export class SettingsModule {}
