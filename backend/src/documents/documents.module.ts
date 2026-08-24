import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChunkerService } from './chunker.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentParserService, ChunkerService],
  exports: [DocumentsService, ChunkerService, DocumentParserService],
})
export class DocumentsModule {}
