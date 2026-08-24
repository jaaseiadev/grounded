import { z } from 'zod';
import { StructuredAiResponse } from '../common/types/domain.types';

export const structuredAiResponseSchema = z.object({
  answer: z.string().trim().min(1),
  citationChunkIds: z.array(z.string()).max(12),
  grounded: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export function parseStructuredAiResponse(raw: string): StructuredAiResponse {
  for (const candidate of jsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(repairJson(candidate)) as unknown;
      for (const value of responseValues(parsed)) {
        const result = structuredAiResponseSchema.safeParse(
          normalizeResponse(value),
        );
        if (result.success) return result.data;
      }
    } catch {
      // A stream can contain a malformed prefix before its usable JSON object.
    }
  }

  throw new Error(
    'The AI response did not contain a usable structured answer.',
  );
}

function unwrapJsonCodeFence(raw: string): string {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function jsonCandidates(raw: string): string[] {
  const unfenced = unwrapJsonCodeFence(raw);
  return [...new Set([unfenced, ...extractJsonObjects(unfenced)])].filter(
    Boolean,
  );
}

function extractJsonObjects(raw: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function repairJson(raw: string): string {
  return removeTrailingCommas(escapeJsonStringWhitespace(raw));
}

function removeTrailingCommas(raw: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ',') {
      let next = index + 1;
      while (/\s/.test(raw[next] ?? '')) next += 1;
      if (raw[next] === '}' || raw[next] === ']') continue;
    }
    result += character;
  }

  return result;
}

function responseValues(parsed: unknown): unknown[] {
  const values: unknown[] = [];
  const pending: Array<{ value: unknown; depth: number }> = [
    { value: parsed, depth: 0 },
  ];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) break;
    values.push(current.value);
    if (current.depth >= 2) continue;

    if (typeof current.value === 'string') {
      try {
        pending.push({
          value: JSON.parse(repairJson(current.value)) as unknown,
          depth: current.depth + 1,
        });
      } catch {
        // Plain answer strings are not structured response containers.
      }
      continue;
    }
    if (Array.isArray(current.value)) {
      for (const value of current.value as unknown[]) {
        pending.push({
          value,
          depth: current.depth + 1,
        });
      }
      continue;
    }
    if (isRecord(current.value)) {
      for (const key of ['response', 'result', 'data', 'output']) {
        if (key in current.value && typeof current.value[key] !== 'string') {
          pending.push({
            value: current.value[key],
            depth: current.depth + 1,
          });
        }
      }
    }
  }

  return values;
}

function normalizeResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;

  return {
    answer: normalizeAnswer(
      firstDefined(value, ['answer', 'response', 'content', 'text', 'output']),
    ),
    citationChunkIds: normalizeCitationIds(
      firstDefined(value, [
        'citationChunkIds',
        'citation_chunk_ids',
        'citationIds',
        'citation_ids',
        'citations',
        'sources',
      ]),
    ),
    grounded: normalizeGrounded(
      firstDefined(value, [
        'grounded',
        'isGrounded',
        'is_grounded',
        'supported',
      ]),
    ),
    confidence: normalizeConfidence(
      firstDefined(value, [
        'confidence',
        'confidenceLevel',
        'confidence_level',
        'certainty',
      ]),
    ),
  };
}

function normalizeAnswer(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    return firstDefined(value, ['text', 'content', 'answer', 'value']);
  }
  return value;
}

function normalizeCitationIds(value: unknown): string[] {
  let citations = value;
  if (typeof citations === 'string') {
    const trimmed = citations.trim();
    if (trimmed.startsWith('[')) {
      try {
        citations = JSON.parse(repairJson(trimmed)) as unknown;
      } catch {
        citations = trimmed;
      }
    }
  }

  const items = Array.isArray(citations) ? citations : [citations];
  const ids = items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (isRecord(item)) {
        const id = firstDefined(item, ['chunkId', 'chunk_id', 'id']);
        return typeof id === 'string' ? id.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
  return [...new Set(ids)].slice(0, 12);
}

function normalizeGrounded(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  return ['true', 'yes', '1', 'grounded', 'supported'].includes(
    value.trim().toLowerCase(),
  );
}

function normalizeConfidence(
  value: unknown,
): StructuredAiResponse['confidence'] {
  if (isRecord(value)) {
    return normalizeConfidence(
      firstDefined(value, ['level', 'value', 'score', 'confidence']),
    );
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const score = value > 1 ? value / 100 : value;
    if (score >= 0.75) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
  if (typeof value !== 'string') return 'low';

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (/^\d+(?:\.\d+)?%?$/.test(normalized)) {
    const numeric = Number(normalized.replace('%', ''));
    return normalizeConfidence(numeric);
  }
  if (
    ['high', 'very high', 'strong', 'certain', 'high confidence'].includes(
      normalized,
    )
  ) {
    return 'high';
  }
  if (
    [
      'medium',
      'moderate',
      'moderately confident',
      'medium confidence',
      'mid',
      'average',
    ].includes(normalized)
  ) {
    return 'medium';
  }
  return 'low';
}

function firstDefined(value: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonStringWhitespace(raw: string): string {
  const replacements: Record<string, string> = {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
  };
  let result = '';
  let inString = false;
  let escaped = false;

  for (const character of raw) {
    if (!inString) {
      result += character;
      if (character === '"') inString = true;
      continue;
    }

    const replacement = replacements[character];
    if (replacement) {
      result += escaped ? replacement.slice(1) : replacement;
      escaped = false;
      continue;
    }
    result += character;
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '"') {
      inString = false;
    }
  }

  return result;
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
