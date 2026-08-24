# API reference

Base path: `/api`. Request bodies are validated with `class-validator`; unknown fields are rejected.

| Method   | Path                       | Behavior                                                         |
| -------- | -------------------------- | ---------------------------------------------------------------- |
| `GET`    | `/health`                  | Service health                                                   |
| `POST`   | `/documents/upload`        | Multipart upload (`file`), returns `202` while processing starts |
| `GET`    | `/documents`               | List documents and processing state                              |
| `GET`    | `/documents/:id`           | Document plus extracted chunks                                   |
| `DELETE` | `/documents/:id`           | Delete source and embeddings, returns `204`                      |
| `POST`   | `/documents/:id/reprocess` | Re-run extraction and embeddings, returns `202`                  |
| `POST`   | `/chat`                    | Stream newline-delimited JSON events                             |
| `GET`    | `/conversations`           | List recent conversations                                        |
| `POST`   | `/conversations`           | Create a conversation                                            |
| `GET`    | `/conversations/:id`       | Conversation with messages                                       |
| `DELETE` | `/conversations/:id`       | Delete conversation and messages                                 |
| `GET`    | `/playground/presets`      | Prompt presets                                                   |
| `POST`   | `/playground/run`          | Retrieval, generation, inspector data, metrics, evaluation       |
| `GET`    | `/settings/models`         | Non-sensitive model and default configuration                    |

## Chat stream

`POST /api/chat` accepts:

```json
{
  "question": "What is the damaged-product policy?",
  "conversationId": "optional-uuid",
  "documentIds": [],
  "retrievalCount": 5
}
```

An empty `documentIds` array means all ready documents. The response content type is `application/x-ndjson`. Events arrive in order:

- `conversation`: new conversation ID and fallback title
- `retrieval`: retrieved chunk count
- `delta`: progressive answer text
- `complete`: trusted citations, grounding, confidence, and OpenRouter token usage, including reasoning-token counts when supplied
- `error`: stream-safe error message

Closing the request cancels upstream generation.

## Errors

Non-stream endpoints return a consistent JSON envelope with `statusCode`, `message`, `path`, and `timestamp`. Common responses include `400` for file or DTO validation, `404` for deleted/invalid IDs, `413` from upload limits, `502` for invalid model output or upstream AI failure, and `503` for database or configuration failures.
