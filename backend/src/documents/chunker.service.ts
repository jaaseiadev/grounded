import { Injectable } from '@nestjs/common';
import { ExtractedPage } from './document-parser.service';

export interface PreparedChunk {
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  tokenEstimate: number;
}

interface TextBlock {
  text: string;
  pageNumber: number | null;
  section: string | null;
}

@Injectable()
export class ChunkerService {
  private readonly targetTokens = 650;
  private readonly maxTokens = 800;
  private readonly overlapTokens = 110;

  chunk(pages: ExtractedPage[]): PreparedChunk[] {
    const blocks = this.toBlocks(pages);
    const chunks: PreparedChunk[] = [];
    let current: TextBlock[] = [];
    let currentTokens = 0;

    for (const block of blocks) {
      const blockTokens = this.estimateTokens(block.text);
      if (current.length > 0 && currentTokens + blockTokens > this.maxTokens) {
        chunks.push(this.createChunk(current, chunks.length));
        current = this.overlap(current);
        currentTokens = current.reduce(
          (total, item) => total + this.estimateTokens(item.text),
          0,
        );
      }

      if (blockTokens > this.maxTokens) {
        const sentences = block.text.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          const sentenceBlock = { ...block, text: sentence };
          const sentenceTokens = this.estimateTokens(sentence);
          if (
            currentTokens + sentenceTokens > this.maxTokens &&
            current.length > 0
          ) {
            chunks.push(this.createChunk(current, chunks.length));
            current = this.overlap(current);
            currentTokens = current.reduce(
              (total, item) => total + this.estimateTokens(item.text),
              0,
            );
          }
          current.push(sentenceBlock);
          currentTokens += sentenceTokens;
        }
      } else {
        current.push(block);
        currentTokens += blockTokens;
      }

      if (currentTokens >= this.targetTokens) {
        chunks.push(this.createChunk(current, chunks.length));
        current = this.overlap(current);
        currentTokens = current.reduce(
          (total, item) => total + this.estimateTokens(item.text),
          0,
        );
      }
    }

    if (current.length > 0) {
      const content = current
        .map((block) => block.text)
        .join('\n\n')
        .trim();
      const previousContent = chunks.at(-1)?.content;
      if (content && content !== previousContent)
        chunks.push(this.createChunk(current, chunks.length));
    }
    return chunks;
  }

  estimateTokens(text: string): number {
    if (!text.trim()) return 0;
    return Math.ceil(text.trim().split(/\s+/).length * 1.3);
  }

  private toBlocks(pages: ExtractedPage[]): TextBlock[] {
    const blocks: TextBlock[] = [];
    for (const page of pages) {
      let activeSection: string | null = null;
      for (const paragraph of page.text.split(/\n\s*\n/)) {
        const text = paragraph.trim();
        if (!text) continue;
        const firstLine = text.split('\n')[0].trim();
        if (this.isHeading(firstLine))
          activeSection = firstLine.replace(/^#{1,6}\s+/, '');
        blocks.push({
          text,
          pageNumber: page.pageNumber,
          section: activeSection,
        });
      }
    }
    return blocks;
  }

  private isHeading(line: string): boolean {
    return (
      /^#{1,6}\s+/.test(line) ||
      (line.length <= 90 && /^[A-Z][^.!?]*:?$/.test(line))
    );
  }

  private overlap(blocks: TextBlock[]): TextBlock[] {
    const selected: TextBlock[] = [];
    let tokens = 0;
    for (
      let index = blocks.length - 1;
      index >= 0 && tokens < this.overlapTokens;
      index -= 1
    ) {
      selected.unshift(blocks[index]);
      tokens += this.estimateTokens(blocks[index].text);
    }
    return selected;
  }

  private createChunk(blocks: TextBlock[], chunkIndex: number): PreparedChunk {
    const content = blocks
      .map((block) => block.text)
      .join('\n\n')
      .trim();
    return {
      content,
      chunkIndex,
      pageNumber:
        blocks.find((block) => block.pageNumber !== null)?.pageNumber ?? null,
      section:
        blocks.findLast((block) => block.section !== null)?.section ?? null,
      tokenEstimate: this.estimateTokens(content),
    };
  }
}
