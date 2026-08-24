import { ChunkerService } from './chunker.service';

describe('ChunkerService', () => {
  const service = new ChunkerService();

  it('keeps metadata and produces overlapping bounded chunks', () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, index) =>
        `Paragraph ${index}. ${'Evidence about the return policy. '.repeat(35)}`,
    ).join('\n\n');
    const chunks = service.chunk([
      { pageNumber: 4, text: `# Damaged Products\n\n${paragraphs}` },
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 4)).toBe(true);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
    expect(chunks[0].section).toBe('Damaged Products');
  });

  it('does not emit empty chunks', () => {
    expect(service.chunk([{ pageNumber: null, text: ' \n\n ' }])).toEqual([]);
  });
});
