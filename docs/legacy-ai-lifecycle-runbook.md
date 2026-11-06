# Legacy OpenAI lifecycle

## Intended state

Today's Plan uses the local deterministic engine. Keep `getDailyDecision` in
`lastrep-ebac5` / `asia-northeast3` for older app compatibility, with
`ENABLE_OPENAI_DECISION=false`. Source also defaults to disabled if the variable
is missing or malformed. Only explicit `true` enables provider calls.

The two unused `debugOpenAiPing` and `debugOpenAiDecision` exports are removed.
Remove only those deployed endpoints; unrelated billing/admin callables remain.
Their on-demand development diagnostic route is retired. Keep the shared provider
integration, dependency and secret so a future approved feature can reuse them.
No secret values belong in source or deployment logs.

## Compatibility and validation

Auth, input validation, hourly rate limits, free-window quotas, same-day cache
lookup, response schema and guardrails remain unchanged. Gates still precede
cache/fallback and can reject requests. Existing cache responses can be returned;
new allowed uncached requests use the server heuristic without creating a provider
client. This is separate from today's local workout-review engine.

`functions/src/legacyDecisionLifecycle.test.ts` runs the real callable handler
with synthetic records and mocked storage/provider boundaries. It checks default
and explicit disabled states, authentication, invalid inputs, cache, rate/quota
gates, failure/retry, retired exports and an explicit opt-in with a fake provider.
It does not contact OpenAI or consume a user's production quota.

```powershell
npm.cmd --prefix functions run build
npx.cmd vitest run functions/src/legacyDecisionLifecycle.test.ts functions/src/decisionPipeline.test.ts functions/src/decisionGuardrails.test.ts
```

Deployment must target only `getDailyDecision`; endpoint deletion must name only
the two retired debug functions and the region/project explicitly. Verify live
configuration afterward, preserving all other environment variables. Do not use
a full-functions deployment to clean up unrelated endpoints. Do not delete the
OpenAI secret or change personal account records for a smoke test.

## Future OpenAI features

Disabling provider calls is reversible. Before enabling them, define the actual
feature and callers, review consent and precisely which fields are transferred,
check current SDK/model availability, establish spending/usage limits and retry
behavior, and test with synthetic accounts. Retain the disabled fallback and test
failures before rollout. An old secret binding is not proof of a valid key.

Enable the variable only through a scoped deployment after that review; verify
the resulting environment and provider-attempt telemetry. Restoring debug
endpoints is not required. Do not flip the flag merely to keep credentials active.

## Privacy and eventual retirement

Disabling new provider transfers does not erase past transfers or provider
retention. Existing privacy wording and AI-disclosure UI are conservative and
remain unchanged in this backend-only change; no new data type, permission,
sharing or provider is introduced. Reconcile user-facing AI copy and the hosted
policy when the feature is reintroduced or fully retired, including any needed
Play declaration updates.

Observe the next 30 days of invocation outcomes and provider-attempt telemetry.
Check active Play-version distribution before proposing callable deletion.
Quiet logs alone cannot prove all older clients have disappeared. Endpoint
deletion needs an explicit supported-version decision because the old cloud
client has no automatic network fallback.

See the [November 6 audit](legacy-ai-lifecycle-review-2026-11-06.md) for the
pre-change live configuration, observations, historical callers and cost limits.

## Rollout record

November 6, 2026, verified at 10:34 UTC:

- Deployed only `getDailyDecision` to `lastrep-ebac5` / `asia-northeast3`, version
  65, Node.js 22, ACTIVE. Live environment is explicitly
  `ENABLE_OPENAI_DECISION=false`; the OpenAI secret binding remains.
- Downloaded version 65 source into memory and verified that both TypeScript
  and compiled JavaScript match the reviewed local files. No archive, signed
  download URL or secret value is included in this document.
- Explicitly deleted only `debugOpenAiPing` and `debugOpenAiDecision` in that
  project/region. A fresh function inventory confirms both are absent.
- Backend build passed. Backend tests: 61 passed; 28 emulator-dependent tests
  skipped. The 13 new handler tests passed, including mocked explicit opt-in.
  No real provider request was made. Authenticated production fallback/cache
  behavior was not smoke-tested with a live account; those branches were tested
  at the handler boundary with mocked storage and verified deployed source.
- No personal records, quotas, permissions, policy pages or Play declarations
  were changed. No AAB or phone review is required for this server-only change.

A temporary, ignored deployment environment file supplied the non-secret flag
and was removed afterward. Future deployments remain disabled by source default
even if the explicit environment value is omitted; check live configuration on
every intentional provider-lifecycle change. The deployment was made from the
focused implementation branch; Git publication/merge is a separate step.
