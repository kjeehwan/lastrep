# Decision Service Logging Semantics

This note defines the operational logging contract for the Phase 3 decision service.

## `pathUsed` enum

`pathUsed` is one of:

- `CACHE_HIT`
- `OPENAI`
- `FALLBACK_HEURISTIC`
- `RATE_LIMITED`

## Rate-limited behavior

When server rate limit is exceeded:

- Function logs:
  - `pathUsed: "RATE_LIMITED"`
  - `rateLimited: true`
  - `fallbackReason: "rate_limited"`
- Function throws `resource-exhausted`.
- Client shows: `Too many requests. Try again later.`

The rate-limited path does **not** return a decision payload.

