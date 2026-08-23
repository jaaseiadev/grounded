import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './health.controller';
import { PlaygroundModule } from './playground/playground.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AiModule,
    DocumentsModule,
    RetrievalModule,
    ConversationsModule,
    ChatModule,
    PlaygroundModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
