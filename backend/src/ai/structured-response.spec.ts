import {
  extractPartialAnswer,
  parseStructuredAiResponse,
  recoverStructuredAiResponse,
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

  it('escapes literal whitespace control characters inside JSON strings', () => {
    const response = parseStructuredAiResponse(`{
      "answer": "Line one
Line\ttwo",
      "citationChunkIds": ["chunk-1"],
      "grounded": true,
      "confidence": "medium"
    }`);

    expect(response.answer).toBe('Line one\nLine\ttwo');
  });

  it.each([
    ['HIGH', 'high'],
    [' Moderate ', 'medium'],
    ['uncertain', 'low'],
    ['unexpected model label', 'low'],
    [0.8, 'high'],
    [55, 'medium'],
  ])('normalizes confidence value %p to %p', (input, expected) => {
    const response = parseStructuredAiResponse(
      JSON.stringify({
        answer: 'Supported answer',
        citationChunkIds: [],
        grounded: false,
        confidence: input,
      }),
    );

    expect(response.confidence).toBe(expected);
  });

  it('uses conservative defaults for malformed optional metadata', () => {
    const response = parseStructuredAiResponse(
      JSON.stringify({
        answer: 'Usable answer',
        citationChunkIds: null,
        grounded: 'unknown',
      }),
    );

    expect(response).toEqual({
      answer: 'Usable answer',
      citationChunkIds: [],
      grounded: false,
      confidence: 'low',
    });
  });

  it('normalizes common field and citation variants', () => {
    const response = parseStructuredAiResponse(
      JSON.stringify({
        response: 'Supported answer',
        citations: [
          { chunk_id: 'chunk-1' },
          { id: 'chunk-1' },
          { chunkId: 'chunk-2' },
        ],
        is_grounded: 'yes',
        confidence_level: { level: 'Very_High' },
      }),
    );

    expect(response).toEqual({
      answer: 'Supported answer',
      citationChunkIds: ['chunk-1', 'chunk-2'],
      grounded: true,
      confidence: 'high',
    });
  });

  it('accepts JSON surrounded by provider commentary and trailing commas', () => {
    const response = parseStructuredAiResponse(`Result follows:
{
  "answer": "Supported answer",
  "citationChunkIds": ["chunk-1",],
  "grounded": true,
  "confidence": "medium",
}
End of result.`);

    expect(response).toEqual(
      expect.objectContaining({
        answer: 'Supported answer',
        citationChunkIds: ['chunk-1'],
      }),
    );
  });

  it('accepts wrapped, array, and double-encoded responses', () => {
    const payload = {
      answer: 'Supported answer',
      citationChunkIds: ['chunk-1'],
      grounded: true,
      confidence: 'high',
    };

    expect(
      parseStructuredAiResponse(JSON.stringify({ data: [payload] })),
    ).toEqual(payload);
    expect(
      parseStructuredAiResponse(JSON.stringify(JSON.stringify(payload))),
    ).toEqual(payload);
  });

  it('does not repair unsupported control characters', () => {
    expect(() =>
      parseStructuredAiResponse(
        '{"answer":"unsafe\u0000value","citationChunkIds":[],"grounded":false,"confidence":"low"}',
      ),
    ).toThrow();
  });

  it('rejects arbitrary prose without a structured answer', () => {
    expect(() =>
      parseStructuredAiResponse(
        'Here is the result, but no structured answer was produced.',
      ),
    ).toThrow();
  });

  it('extracts progressive answer text from partial JSON', () => {
    expect(extractPartialAnswer('{"answer":"Line one\\nLine two')).toBe(
      'Line one\nLine two',
    );
  });

  it('recovers an answer from truncated JSON conservatively', () => {
    expect(
      recoverStructuredAiResponse(
        '{"answer":"A usable partial answer","citationChunkIds": [',
      ),
    ).toEqual({
      answer: 'A usable partial answer',
      citationChunkIds: [],
      grounded: false,
      confidence: 'low',
    });
  });

  it('recovers plain text conservatively when structured output is ignored', () => {
    expect(recoverStructuredAiResponse('A plain provider answer.')).toEqual({
      answer: 'A plain provider answer.',
      citationChunkIds: [],
      grounded: false,
      confidence: 'low',
    });
  });

  it('does not invent an answer for empty or metadata-only output', () => {
    expect(recoverStructuredAiResponse('')).toBeNull();
    expect(recoverStructuredAiResponse('{"confidence":"high"}')).toBeNull();
  });
});
