import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
}

@Injectable()
export class DocumentParserService {
  async extract(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<ExtractedPage[]> {
    if (
      mimeType === 'application/pdf' ||
      filename.toLowerCase().endsWith('.pdf')
    ) {
      return this.extractPdf(buffer);
    }
    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return [{ pageNumber: null, text: this.clean(result.value) }];
    }
    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      filename.toLowerCase().endsWith('.txt') ||
      filename.toLowerCase().endsWith('.md')
    ) {
      return [{ pageNumber: null, text: this.clean(buffer.toString('utf8')) }];
    }
    throw new BadRequestException(
      'Unsupported document type. Use PDF, DOCX, TXT, or Markdown.',
    );
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractedPage[]> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.pages
        .map((page) => ({ pageNumber: page.num, text: this.clean(page.text) }))
        .filter((page) => page.text.length > 0);
    } finally {
      await parser.destroy();
    }
  }

  private clean(value: string): string {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
}
