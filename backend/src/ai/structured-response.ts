import { z } from 'zod';
import { StructuredAiResponse } from '../common/types/domain.types';

export const structuredAiResponseSchema = z.object({
  answer: z.string().min(1),
  citationChunkIds: z.array(z.string()).max(12),
  grounded: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export function parseStructuredAiResponse(raw: string): StructuredAiResponse {
  return structuredAiResponseSchema.parse(JSON.parse(unwrapJsonCodeFence(raw)));
}

function unwrapJsonCodeFence(raw: string): string {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function extractPartialAnswer(rawJson: string): string {
  const marker = '"answer"';
  const markerIndex = rawJson.indexOf(marker);
  if (markerIndex === -1) return '';
  const colonIndex = rawJson.indexOf(':', markerIndex + marker.length);
  if (colonIndex === -1) return '';
  const quoteIndex = rawJson.indexOf('"', colonIndex + 1);
  if (quoteIndex === -1) return '';

  let result = '';
  let escaped = false;
  for (let index = quoteIndex + 1; index < rawJson.length; index += 1) {
    const character = rawJson[index];
    if (escaped) {
      const escapeMap: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        '"': '"',
        '\\': '\\',
        '/': '/',
      };
      result += escapeMap[character] ?? character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') break;
    result += character;
  }
  return result;
}
