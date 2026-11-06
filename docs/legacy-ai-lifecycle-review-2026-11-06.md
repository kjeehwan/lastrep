# Legacy AI endpoint lifecycle review

November 6, 2026. Reviewed from `f146e6b`, project `lastrep-ebac5`.
Read-only production inspection; no callable invocation, deployment, environment
change, secret-value access or production record mutation was performed.

## Decision

**Keep `getDailyDecision` temporarily for compatibility, but recommend a separately
approved change to disable new OpenAI calls.** Keep its valid cached responses
and deterministic server fallback available to older clients. Retire the two
unused debug AI endpoints in that separately approved change, after documenting
the loss of that development diagnostic route.

Do not delete the compatibility callable solely because the current client has
no callers. Source history proves the old path existed; installed-version
adoption has not been established. Exact billing was not retrieved, and observed
traffic does not establish an urgent cost incident.

## Current and historical callers

- Current workout action: `app/(tabs)/workout/log.tsx` calls
  `useWorkoutTodayPlan`; its review loads account context and calls
  `buildDeterministicTodayPlan` locally. It saves the result to Firestore.
  That path does not invoke `getDailyDecision` or OpenAI.
- `src/services/decision/getDecision.ts` still exports a cloud client with
  `USE_CLOUD_DECISION = true`. A repository-wide caller search found no current
  app imports/calls. Its presence is not evidence of an active feature.
- Git change `2d32ed6` (October 9, 2026) removed the Home import and call to
  `getDecision`. Earlier source, including `266aeeb`, used that callable.
  This is a source cutover date, not proof of which Play build every user has.
- No current app callers were found for `debugOpenAiPing` or
  `debugOpenAiDecision`. Their current source requires authentication and a dev
  UID allowlist, and calls OpenAI separately from the main enable flag. Their
  older deployed bodies were not downloaded in this review, so exact deployed
  guard behavior is not asserted from current source alone.
- The old cloud client normalizes a missing callable/network failure to an error;
  it does not automatically switch to its local heuristic when the deployed
  endpoint is deleted. Returning the existing server fallback preserves a useful
  response without requiring old binaries to update first.

## Live configuration and deployed-source verification

Cloud Functions v1 API metadata, inspected around November 6, 10:16 UTC:

| Function | State | Version | Runtime | Last updated (UTC) | Configured minimum instances |
| --- | --- | --- | --- | --- | --- |
| `getDailyDecision` | ACTIVE | 64 | Node.js 22 | Nov 3, 04:27:28 | 0 |
| `debugOpenAiPing` | ACTIVE | 15 | Node.js 20 | May 21, 03:31:40 | 0 |
| `debugOpenAiDecision` | ACTIVE | 11 | Node.js 20 | May 21, 03:31:35 | 0 |

All three have an OpenAI secret binding. Binding existence does not prove that a
key is valid or that a provider call occurred. No secret values were accessed.
Each is configured for 256 MB and a 60-second timeout. No explicit maximum
instance value was returned; no concurrency/cost ceiling is inferred from that.

For `getDailyDecision`, `ENABLE_OPENAI_DECISION` is absent and the emulator flag
is not true. Downloaded deployed version 64 source **in memory** and compared its
TypeScript callable body and enable-flag definition to the reviewed source. The
deployed compiled JavaScript body and flag also match the local compiled copy.
The verified code defaults OpenAI **on** outside the emulator when the override
is absent. Thus the dormant production capability remains enabled.

The API returns a short-lived signed source-download URL; neither that URL nor
the source archive was retained in the report. Only matching/hashing results
were saved locally. Reference: Google's
[source-download API](https://docs.cloud.google.com/functions/docs/reference/rest/v1/projects.locations.functions/generateDownloadUrl).

## Defined observation window

October 7, 2026 **10:18:24.284 UTC** through November 6, 2026
**10:18:24.284 UTC**, a 30-day window. Cloud Logging pagination completed without
reaching the safety cap. Cloud Monitoring metrics were queried for the same window.

| Function | Recorded executions | Outcome / duration | Decision events | Observed OpenAI attempts |
| --- | --- | --- | --- | --- |
| `getDailyDecision` | 1 | HTTP 401, about 208 ms | 0 | 0 |
| `debugOpenAiPing` | None observed | No log entries or invocation series returned | 0 | None observed |
| `debugOpenAiDecision` | None observed | No log entries or invocation series returned | 0 | None observed |

The main function's five log entries consist of two deployment audit notices,
execution start/end, and callable-verification metadata. The verification status
was `auth: MISSING`; the request completed at November 3, 04:28:02 UTC with 401.
The verified handler rejects missing authentication before input validation,
Firestore gates, cache lookup or any provider call. This observed request did
not reach OpenAI. Its purpose/caller identity was not established.

Monitoring independently reports one `error` execution, an execution-time
distribution with one sample at 208,167,000 ns, and 75 bytes of function network
egress. Metric descriptors were checked: execution time is nanoseconds, memory
and egress are bytes, and execution count is a delta count. Memory observations
are not a substitute for billed allocation. No successful or authenticated
decision requests were observed in this window.

The logger's decision events include provider-attempt/retry flags, path and
latencies. None were present. This is bounded evidence, not a guarantee about
usage before the window, future calls, other functions/projects or logging/
monitoring coverage beyond these queries. No raw inputs, user IDs, input hashes,
request payloads or saved user profiles were retained in this report.

## Costs and remaining uncertainty

- The observed execution work is very small; no provider work is attributable
  to the observed unauthenticated request. There is no evidence here of material
  recent OpenAI usage by these endpoints.
- This is **not** an invoice reconciliation or a zero-cost claim. No Cloud Billing
  export or OpenAI organization usage/invoice was queried. Deployment artifacts,
  secret storage/access and other services were not costed.
- No minimum instances are configured for these functions, but that alone does
  not establish the project's total idle or storage cost.
- Installed-client versions and active-version distribution are unverified.
  These logs do not carry enough version evidence to prove all older callable
  clients are gone. No personal account data was inspected to infer adoption.

## Concrete follow-up proposal, not executed

1. Preserve the `getDailyDecision` callable and response schema. Set
   `ENABLE_OPENAI_DECISION=false` through an explicitly approved, scoped change.
   Check the resulting live configuration rather than relying on emulator defaults.
   Valid cache hits remain possible; new allowed requests use the existing server
   heuristic instead of initiating provider calls. Existing quota/rate gates still
   run, which must be considered in any legacy product/paid-feature decision.
2. Retire the two debug AI callables with explicit approval. Turning off the main
   function's flag is not evidence that all separate debug provider paths are off.
   Keep the shared key/secret while any remaining approved consumer needs it.
3. Validate with disposable accounts in a controlled environment: auth rejection,
   allowed request, cache, fallback output, gates, provider-attempt suppression
   and old-client error handling. Do not use real accounts to consume quotas.
4. Observe the following 30 days using invocation outcomes and provider-attempt
   telemetry, and check active Play-version distribution. Successful legacy
   requests reset the retirement assessment; do not equate an old client being
   quiet for a month with proof it no longer exists.
5. Remove the compatibility callable only after an explicit support-policy
   decision: either verified supported clients no longer depend on it, or the
   owner accepts requiring old clients to update. Remove dormant client code and
   update relevant product/privacy wording as part of that separate retirement.

The current privacy policy describes AI transfers and past provider retention.
Do not erase that disclosure during this read-only audit while live capability
and older clients remain. Onboarding/Profile also contain AI-disclosure copy;
review it when the actual provider lifecycle changes. No policy or Play
declaration was changed here. No emulator/phone tests were needed for this
documentation-only audit; source tracing and production metadata/aggregates are
the evidence, not a new runtime validation.
