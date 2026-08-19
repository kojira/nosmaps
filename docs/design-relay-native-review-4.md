# Relay-native data design review 4

- review_date: 2026-08-16
- reviewer_role: independent third-party, zero-base reassessment
- reviewed_document: `repos/nosmaps/design-relay-native-data.md`
- reviewed_document_sha256: `8db605c4200aea499972363d805b905c9789928a4ec7d02e9a606578043c65fa`
- reviewed_document_size: 814 lines / 67,734 bytes
- review_scope: review artifact only; no code/design modification, implementation, dependency addition, commit, push, or publication

verdict: CHANGES_REQUIRED
score: 0.94
review_policy: risk-proportional MVP

## Source fixation

Official/primary sources were independently re-fetched on 2026-08-16. The response documents were not treated as evidence of resolution.

- `nostr-protocol/nips` current HEAD `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`, commit date `2026-08-08T20:01:32-03:00`, message `nip29: add "previous" tag example.` Reviewed current NIP-01, 07, 09, 11, 22, 25, 40, 42, 44, 51, 67, 89 and 94 as applicable.
- `nostr-protocol/registry-of-kinds` current HEAD `8d3fa7e252452e30fdf4e2917a487c239ef350cf`, commit date `2026-08-15T19:13:06-03:00`, message `Update descriptions to use title case`. Reviewed `schema.yaml` assignments and kind classes.
- `penpenpng/rx-nostr` current HEAD and tag `rx-nostr@3.7.5` at `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc`, commit date `2026-06-26T06:06:16Z`; npm latest is `rx-nostr@3.7.5` published `2026-06-26T06:06:25.452Z`. Reviewed official v3 README/docs pointers, source/types for `createRxNostr`, Backward/Forward request factories, `.over()`, subscription teardown, AUTH configuration, `Nip11Registry`, and max-subscription queue behavior.
- `@rx-nostr/crypto@3.1.6`, npm latest, git commit `5f08ed88402d6ef5a42d792b0fe7c84290621718`, published `2026-04-20T15:11:08.275Z`. Reviewed package type declarations and implementation export of `verifier: EventVerifier`.
- Blossom official BUD repository `hzrd149/blossom` current HEAD `b5bd2801d1763aa635fc8fea7a76597e0eb18990`, commit date `2026-06-15T11:08:10-05:00`, message `Merge pull request #108 from hzrd149/clarify-bud-00-client-side`. Reviewed BUD-01, 02, 04, 06 and 11.
- RFC 8785, JSON Canonicalization Scheme, fetched from the RFC Editor on 2026-08-16. Reviewed I-JSON input constraints, string preservation/no implicit Unicode normalization, deterministic serialization and UTF-8 output.

## gaps:

### P1-1 — BUD-11 authorization-token authoring contract omits a current mandatory field

- likelihood: plausible
- impact: high
- fix_cost: low
- gate_reason: existing compatible Blossom servers may require BUD-11 on the core upload/mirror publication path. Current BUD-11 says every kind `24242` authorization token MUST have human-readable `content`; the design enumerates `t=upload`, `expiration`, matching `x`, preferred server scoping and the HTTP header but never requires or validates that content. A direct implementation of the written contract can therefore produce a nonconforming token and lose the primary publication path on a conforming auth-enforcing server. This is a clear, low-cost specification/interoperability closure, not a request for a new server or protocol.
- evidence: design §3.1 line 113 and §3.5 describe BUD-11 use but omit token content validation; Blossom BUD-11 HEAD requires human-readable content for all authorization tokens and names the optional domain scope tag exactly `server`.
- minimum_fix_for_later_design_revision: require nonempty human-readable content such as `Upload Nosmaps catalog manifest`; name and validate `["server", "lowercase.domain"]` when server scoping is used; retain required `expiration`, `t=upload`, matching lowercase `x`, kind `24242`, signature/time checks and Base64url `Authorization: Nostr` encoding. Add auth-required upload and mirror fixtures that reject empty content. This review does not make that edit.

## review3_resolution:

- P1-1: resolved
  - `30369` now requires exactly one canonical software-coordinate `a` equal byte-for-byte to content `tool`.
  - Tool-primary or tool-related `30370` requires content `tool` plus exactly one matching canonical `a`; unindexed observations are outside standard tool detail.
  - `30371` requires software-coordinate `a` tags to equal sorted unique content `tools`, and detail/comparison eligibility requires the selected coordinate in both places. Tool-unrelated evidence is explicitly outside standard retrieval and broad scans are forbidden.
  - Exact author/id discovery is no longer required: detail/comparison uses one author-independent logical `{"kinds":[30369,30370,30371],"#a":[selectedToolCoordinates]}` filter, coalesced across selected tools and split only by byte/array/filter limits. Backward pagination and raw-event/byte/page caps mark `incomplete: detail-cap`; at most one coalesced kind-5 cleanup follow-up is charged per relay/target round.
  - Candidate-kind or generic `#a` probe failure excludes that relay from the dependency and records `incomplete`; there is no broad kind scan, arbitrary author discovery, central index, backend fallback, per-tool N+1 or per-event cleanup N+1.
- P1-2: resolved
  - Independent ASCII byte arithmetic reproduces the stated maxima: `30367 = 19+64 = 83`; `30368 = 9+64+1+64 = 138`; `30369 = 12+64+1+115 = 192`; `30370 = 12+64+1+98+1+16 = 192`; `30371 = 9+64+1+11+1+32 = 118`; `30372 = 7+64 = 71`. All are `<=192` UTF-8 bytes.
  - Variable feature/type source values remain complete NFC strings in content. Direct `d` keys are allowed only for fitting lowercase ASCII slugs; otherwise deterministic `sha256-<64hex>` is derived from exact RFC-8785 serialization of the NFC JSON string. No locale fold, transliteration or truncation is allowed.
  - Common and kind-specific validation is before signing/publication. Acceptance requires each grammar's maximum legal and one-byte-over fixture plus 191/192/193 UTF-8 boundaries, non-ASCII byte counting, no truncation, and deterministic hash-key derivation.

## review2_regression_check:

1. resolved — `30267` remains a current NIP-51 App curation set, with exact software `a` members, whole-set replacement/removal semantics and one curator count per tool.
2. resolved — `@rx-nostr/crypto@3.1.6` exports `verifier` directly as `EventVerifier`; the design uses `createRxNostr({ verifier })` and does not use nonexistent `verifier.secp256k1`.
3. resolved — kind `10003` private bookmark read/edit/publish remains disabled unless both NIP-44 encrypt and decrypt exist; unreadable ciphertext blocks writes and no plaintext/public/empty downgrade is allowed.
4. resolved — Blossom availability quorum still requires anonymous unauthenticated successful `GET /<sha256>` with exact byte/hash verification; authenticated-only GET mirrors cannot count or be the only copy.
5. resolved — relay retry retransmits the identical signed pointer event/id; a newly signed pointer requires a newly constructed manifest generation with increased generation, updated previous commitment and new blob/hash.
6. resolved — dynamically learned targets have at most one coalesced kind-5 cleanup follow-up per relay/round, with provisional/incomplete state until merge and no per-target N+1.

## verified:

1. One signed stable `30367` pointer commits to one complete canonical manifest blob; relay sharding/index events are absent.
2. Manifest acceptance requires exact signed byte size, SHA-256, RFC-8785 canonical bytes, schema, count, MIME and pointer/tag equality. Unverified bytes never become truth.
3. BUD-01 retrieval, BUD-02 upload, optional BUD-04 mirror and advisory BUD-06 upload preflight are the only Blossom endpoints used. Existing compatible servers are assumed; self-hosting is not required.
4. Mirror fallback is bounded, hash-preserving and size-capped. Verified old content may be stale fallback; missing current content becomes stale/incomplete/unavailable rather than fabricated completeness.
5. The AP contract derives deterministic output only from observed valid signed events, verified blobs and observed deletions, exposes as-of/coverage/freshness, and promises eventual convergence only after the same valid input set becomes observable.
6. Durable removal uses explicit `active|withdrawn`; NIP-09 is best-effort observed cleanup, not an erasure or complete historical ledger. Cache wipe rebuilds from signed pointers/blobs/current record winners; IndexedDB is discardable.
7. Multi-curator merge, provenance, conflict visibility, trust-key removal, migration authority and recommendation counting are deterministic and scoped.
8. Registry HEAD assigns `30267` and `32267` but not `30367`–`30372`; the candidate range is addressable by NIP-01 class. Required `d`, `L/l`, envelope/schema/version/state and collision migration are explicit.
9. Current NIP-11 contains no `max_filters`; the design uses app-owned filter/array caps and serialized UTF-8 message budgeting while applying standard advertised `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, tag/content and time limits.
10. rx-nostr 3.7.5 source/types support the named core APIs and behaviors: `createRxNostr`, default relays, Backward/Forward factories, Backward `.over()`, RxJS unsubscription, pool/connection disposal, authenticator configuration, `Nip11Registry`, and a queue based on NIP-11 `max_subscriptions`. App-specific batching/chunking/per-relay helpers remain labeled pseudocode.
11. Cold/search/detail/comparison/review/profile/reaction/reconnect budgets are explicit. Search is zero network; lazy components are zero before activation; comparison coalesces coordinates; cleanup follows targets once rather than per row. Physical chunking is charged separately.
12. Winner-before-display pagination, inclusive same-timestamp boundaries, mandatory reconnect gap recovery, reaction reduction, frozen-context future quarantine, future-only NIP-22, pointer read-back and bookmark conflict handling are bounded and testable.
13. `relay.nostr.band` and `relay.damus.io` have zero occurrences. Default relay candidates are exactly `wss://x.kojira.io` and `wss://nos.lol`, and their capabilities are explicitly unverified before live probe.
14. No application backend is introduced. Signed Nostr events remain authoritative, Blossom remains content-addressed byte storage, local search is zero-REQ, and IndexedDB remains reconstructable cache.
15. Static checks: all seven fenced JSON examples parse; candidate byte arithmetic matches; old relay strings are absent; `git diff --check` reports no whitespace error for the reviewed design/review artifact.

## accepted_constraints:

1. Relay partitions can expose stale/incomplete state; global latestness and strong convergence during partition are non-goals.
2. Missing historical NIP-09 events can leave old signed content observable; `withdrawn` is the durable logical-removal mechanism and erasure is not promised.
3. Blossom outages can make a curator stale/unavailable; bounded mirror attempts and verified fallback are adequate, and self-hosted Blossom is out of scope.
4. A fresh client cannot prove the complete pointer chain; `chain-unverified` with signature/hash/schema checks is acceptable.
5. Same-timestamp pagination can hit a bounded saturation point; reporting `incomplete: boundary-saturated` is preferable to a heavy protocol.
6. Backward-to-Forward handoff is not transactional; a narrow race may remain until mandatory recovery, without justifying consensus machinery.
7. Kind `10003` cannot guarantee lossless disconnected concurrent edits; bounded conflict detection/retry/manual resolution is adequate and no CRDT is required.
8. A malformed newer pointer/blob can temporarily self-deny one trusted curator; quarantine plus last-verified stale fallback is proportionate.

accepted_constraints_count: 8

## unverified:

These are implementation-preflight/typecheck/E2E checks, not additional design blockers by themselves.

1. Dated reachability, NIP-11 and NIP-42 behavior for `wss://x.kojira.io` and `wss://nos.lol`.
2. Candidate-kind read/write acceptance, generic `#a/#d/#A/#L/#l` indexing, exact-id read-back, OK/CLOSED behavior, payment/PoW and real query/event/message retention limits.
3. Existing selected Blossom servers' BUD-01/02/04/06/11, CORS, anonymous GET, auth/payment, upload size, descriptor integrity, mirror import, redirect and retention behavior.
4. Exact-lockfile `rx-nostr@3.7.5` / `@rx-nostr/crypto@3.1.6` typecheck, DOM/NIP-07 augmentation, `tsc --noEmit`, build and concrete over/unsubscribe/dispose lifecycle tests.
5. RFC-8785 and strict-JSON fixtures, including duplicate keys, Unicode/JCS edge cases, URL normalization, tag/content equality and streaming size/hash enforcement.
6. Candidate `d` maximum/one-byte-over and common 191/192/193 byte fixtures.
7. Captured Nostr REQ and Blossom HTTP traces for all primary screens/actions, chunk bounds, lazy zero-before-open, detail `#a` discovery, cleanup maximum and no-N+1 assertions.
8. Property/E2E coverage for partitions, cache rebuild, withdrawal/deletion, multi-curator merge, pagination, reconnect, reactions, future timestamps, NIP-44 disabled/conflict cases and publish/read-back retries.
9. BUD-11 auth-required upload/mirror conformance after the blocking token-authoring contract is corrected.
10. Browser/device/accessibility checks required by the parent task.

implementation_gate: BLOCKED
blocking_findings: 1
