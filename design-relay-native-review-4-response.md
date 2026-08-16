# Relay-native data design review 4 response matrix

- source_review: `repos/nosmaps/design-relay-native-review-4.md`
- target_design: `repos/nosmaps/design-relay-native-data.md`
- scope: blocking P1-1 only; design/documentation change only
- implementation_status: not started and out of scope
- resolution: 1/1 resolved

## Constraint guardrails

The revision preserves all eight accepted constraints: AP/stale-incomplete behavior, best-effort NIP-09 with durable logical withdrawal, existing compatible Blossom servers with self-hosting out of scope, fresh-client pointer-chain limits, bounded same-timestamp saturation, non-transactional Backward/Forward handoff, no bookmark CRDT, and malformed-newer-pointer quarantine with verified stale fallback. It also preserves eventual convergence after equal valid inputs become observable, no application backend, and coalesced retrieval/cleanup with no N+1 behavior.

## Findings

| finding | decision | status | minimal resolution |
|---|---|---|---|
| P1-1 — BUD-11 authorization-token authoring contract omits mandatory human-readable `content` | accept | resolved | Every authored or accepted kind `24242` upload/mirror token now requires nonempty human-readable `content`. Upload uses `Upload Nosmaps catalog manifest`; mirror uses `Mirror Nosmaps catalog manifest`. The design now contains both token JSON examples, normative authoring/validation pseudocode, publication-sequence checks, exact current BUD-11 `["server","lowercase.domain"]` domain-only scope, and auth-required rejection/acceptance fixtures. Existing kind/signature/time/action/hash/endpoint/header requirements remain mandatory. |

## Verification matrix

| check | status | evidence |
|---|---|---|
| P1-1 resolved | pass | §3.1 and §3.5 plus implementation-phase fixture 19 cover all requested authoring/validation surfaces. |
| all kind `24242` authoring examples have nonempty human-readable `content` | pass | Two fenced JSON examples parse; upload and mirror have the fixed nonempty purpose strings. |
| empty-content rejection fixture plus valid upload/mirror fixtures | pass | Fixture 19 rejects empty/whitespace content and accepts otherwise-valid upload/mirror purpose strings. |
| `server` tag matches current BUD-11 | pass | Exact tag name `server`; lowercase domain only; scheme/path/port/query/fragment/userinfo and uppercase are rejected. Checked against pinned BUD-11 commit `b5bd2801d1763aa635fc8fea7a76597e0eb18990`. |
| existing BUD-11 requirements retained | pass | kind `24242`, valid id/signature, past `created_at`, future `expiration`, endpoint-correct `t=upload` including mirror, matching lowercase SHA-256 `x`, endpoint/server match, and unpadded Base64url `Authorization: Nostr` remain explicit. |
| review 3 findings remain resolved | pass | Canonical `#a` discovery/equality/no-N+1 contract and all `d <= 192` UTF-8-byte/hash-key requirements are unchanged. |
| review 2 findings remain resolved | pass | `30267`, direct `verifier`, NIP-44 disabled behavior, anonymous GET quorum, identical pointer retry, and bounded kind-5 follow-up are unchanged. |
| accepted constraints remain 8 | pass | Constraint guardrail above maps all eight without modification. |
| `git diff --check` | pass | No whitespace error; explicit trailing-whitespace scan also passes for the edited design. |
| fenced JSON examples parse | pass | 9/9 fenced `json` blocks parse, including 2/2 kind `24242` examples. |
| retired relay strings absent | pass | `relay.nostr.band`: 0; `relay.damus.io`: 0. |
| exactly two default relay candidates remain | pass | Declaration remains exactly `wss://x.kojira.io` and `wss://nos.lol`. |

No implementation, dependency addition, commit, push, or Pages publication was performed.
