# Prompt engineering

## Why the system prompt exists

Retrieval provides evidence, but it does not by itself control how a model uses that evidence. Grounded's central system prompt defines the assistant's role, prohibits unsupported facts, explains the insufficient-evidence behavior, requires the response schema, and restricts citations to supplied chunk identifiers.

The production prompt lives in `backend/src/ai/prompts.ts`. The Prompt Playground may override it for an isolated run; normal chat always uses the production prompt.

## Context isolation

The prompt has three explicit layers:

1. System instructions define behavior.
2. Retrieved content is enclosed by `DOCUMENT CONTEXT START/END` and per-chunk XML-like tags.
3. The user's question is enclosed by `USER QUESTION START/END` after the context.

This separation makes the origin of every token legible to both the model and a developer using the Playground inspector.

## Reducing hallucinations

The model is told to use only retrieved material, identify insufficient or conflicting evidence, and avoid filling gaps with general knowledge. Temperature defaults to 0.1. Context is limited to semantically relevant chunks. The backend also requires a grounded boolean and confidence label, then independently verifies every citation.

These controls reduce hallucinations; they cannot mathematically eliminate model error. The source preview exists so a user can inspect the actual passage.

## Retrieval count

A small count produces focused prompts and lower latency but can miss supporting or contradictory passages. A larger count improves coverage while increasing token use and the chance of irrelevant context. Normal chat uses five. The Playground permits 1–12 and reports the rank and similarity of each result.

## Temperature

Lower temperature favors repeatable, extractive answers. Higher values may improve phrasing or synthesis but can increase variation. Grounded constrains the Playground to 0–1 and keeps strict QA at 0.1.

## Structured responses

OpenRouter routes `stealth/ox-alpha` with reasoning enabled and a strict JSON schema containing:

- `answer`
- `citationChunkIds`
- `grounded`
- `confidence`

The complete stream is parsed with Zod. Invalid JSON, missing fields, or invalid enum values fail generation rather than flowing to the client. Angular receives answer deltas and a final validated event. OpenRouter reasoning details remain server-side; the application exposes only aggregate reasoning-token usage.

## Citation generation

The model sees real retrieved chunk IDs and selects the IDs supporting its answer. It does not supply display metadata. The backend intersects selected IDs with retrieved IDs, deduplicates them, and builds citation cards from trusted database records.

## Document prompt injection

Documents may contain phrases such as “ignore previous instructions.” Grounded treats those phrases as quoted source content. The system prompt explicitly says that context is untrusted data and that instructions inside it must never override system instructions. Context delimiters, fixed role ordering, no tool execution, schema validation, and server-side citation mapping provide defense in depth.

## Presets and evaluation

Strict QA, Summary, Extract Key Facts, Compare Documents, and Explain Simply presets centralize useful prompt patterns. The basic evaluation feature extracts meaningful expected-answer keywords, reports matched keywords and coverage, and displays retrieval and latency beside the generated answer. It is a debugging aid, not a semantic correctness benchmark.
