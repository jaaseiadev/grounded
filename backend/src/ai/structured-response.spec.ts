import {
  extractPartialAnswer,
  parseStructuredAiResponse,
} from './structured-response';

describe('structured AI response', () => {
  it('validates the expected schema', () => {
    expect(
      parseStructuredAiResponse(
        JSON.stringify({
          answer: 'Supported answer',
          citationChunkIds: ['chunk-1'],
          grounded: true,
          confidence: 'high',
        }),
      ),
    ).toEqual(expect.objectContaining({ grounded: true }));
  });

  it('rejects arbitrary model output', () => {
    expect(() => parseStructuredAiResponse('{"answer": 3}')).toThrow();
  });

  it('accepts a complete JSON response wrapped in a Markdown fence', () => {
    expect(
      parseStructuredAiResponse(`\`\`\`json
{
  "answer": "Supported answer",
  "citationChunkIds": ["chunk-1"],
  "grounded": true,
  "confidence": "high"
}
\`\`\``),
    ).toEqual(expect.objectContaining({ answer: 'Supported answer' }));
  });

  it('rejects JSON surrounded by arbitrary prose', () => {
    expect(() =>
      parseStructuredAiResponse(
        'Here is the result: {"answer":"unsupported wrapper"}',
      ),
    ).toThrow();
  });

  it('extracts progressive answer text from partial JSON', () => {
    expect(extractPartialAnswer('{"answer":"Line one\\nLine two')).toBe(
      'Line one\nLine two',
    );
  });
});
