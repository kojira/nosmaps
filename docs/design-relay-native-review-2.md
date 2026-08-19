# Relay-Native Data Design — Independent Review 2

- review_date: 2026-08-16
- reviewer_role: independent third-party, zero-base re-review
- reviewed_document: `repos/nosmaps/design-relay-native-data.md`
- review_policy: risk-proportional MVP
- review_scope: design review only; no code/design modification, implementation, dependency addition, commit, push, or publication

verdict: CHANGES_REQUIRED
score: 0.76
review_policy: risk-proportional MVP

## Source fixation

Official/primary sources were re-fetched and fixed on 2026-08-16.

- `nostr-protocol/nips` HEAD `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`, commit author date `2026-08-08T23:01:22Z`, message `nip29: add "previous" tag example.` Reviewed NIP-01, 07, 09, 11, 22, 25, 32, 42, 44, 45, 51, 65, 67, 77, 78, 89, 94, B0, 5A and the repository kind table.
- `nostr-protocol/registry-of-kinds` HEAD `8d3fa7e252452e30fdf4e2917a487c239ef350cf`, committer date `2026-08-15T22:13:06Z`, message `Update descriptions to use title case`. Reviewed `schema.yaml`.
- `penpenpng/rx-nostr` HEAD/release/tag `rx-nostr@3.7.5`, commit `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc`, release published `2026-06-26T06:05:48Z`. Reviewed v3 official docs, exported interfaces, subscription implementation, NIP-11 queue implementation, AUTH, tests, and `@rx-nostr/crypto@3.1.6` source.
- Blossom official BUD repository `hzrd149/blossom` HEAD `b5bd2801d1763aa635fc8fea7a76597e0eb18990`, commit date `2026-06-15T16:08:10Z`, message `Merge pull request #108 from hzrd149/clarify-bud-00-client-side`. Reviewed BUD-00, 01, 02, 04, 06 and 11.
- RFC 8785 JSON Canonicalization Scheme remains the design's canonical JSON source.

## gaps:

### P0

none

### P1

#### P1-1 — Kind `30267` is a standardized app curation set, not a one-tool recommendation record

- likelihood: common
- impact: medium
- fix_cost: low
- gate_reason: current use is a clear kind/spec interoperability error in a normal catalog operation; it can be corrected without adding a heavy protocol.
- Evidence: current NIP-51 and the registry define `30267` as an addressable **App curation set** whose members are software-application `a` tags. The revised design instead defines one replacement unit per `(curator, tool)` with `d=recommend:<hash>`, a custom JSON `{state,tool,reason}` body, and one count per coordinate. A conforming NIP-51 implementation will interpret each event as a set, not as this per-tool recommendation schema.
- Consequence: recommendation counts and withdrawal semantics will not interoperate with existing/future NIP-51 readers. Independent clients can count the same curator differently, and a relay-native data contract would be built on an incompatible meaning of an assigned kind.
- Minimum fix: either (a) use `30267` as NIP-51 specifies—one or more curator-defined sets with exact software `a` tags, and derive “recommended by curator” from membership in the selected current sets—or (b) select an actually unassigned candidate kind for the custom per-tool record and subject it to the same registry-collision rule as `30367`–`30372`. Do not redefine `30267`.
- Location: §§2.1, 5.2, 7.8 and the recommendation-count tests/budgets.

#### P1-2 — The shown rx-nostr verifier API does not exist in `@rx-nostr/crypto@3.1.6`

- likelihood: common
- impact: medium
- fix_cost: low
- gate_reason: this is an explicit usage-API error; leaving it until implementation would make the documented integration fail immediately.
- Evidence: the design shows `createRxNostr({ verifier: verifier.secp256k1 })`. In the fixed package, `@rx-nostr/crypto` exports `verifier` itself as the `EventVerifier` function. It has no `secp256k1` property. Official v3 docs use `createRxNostr({ verifier })`.
- Consequence: direct implementation of the pseudocode does not typecheck or run. This is not merely an omitted project augmentation.
- Minimum fix: change the API-level example/contract to import `verifier` from `@rx-nostr/crypto` and pass `createRxNostr({ verifier })`; keep helper functions such as `backwardPerRelay` explicitly app-owned pseudocode. Retain exact-package `tsc --noEmit` as the implementation gate.
- Location: §9.3 and §15.

#### P1-3 — Private bookmarks are not explicitly disabled when NIP-44 capability is absent

- likelihood: plausible
- impact: high
- fix_cost: low
- gate_reason: a one-line capability gate prevents a realistic plaintext/privacy failure; the requested MVP contract explicitly requires disabled behavior.
- Evidence: NIP-51 requires private list items to be serialized as a tag-array JSON string and encrypted with NIP-44 self-encryption in `.content`; NIP-07 exposes `window.nostr.nip44` optionally. The design says to use the “applicable NIP-44/NIP-51” format and forbids plaintext logs, but never normatively says what the UI/write path does when the signer lacks `nip44.encrypt/decrypt`.
- Consequence: an implementer can accidentally fall back to public tags, empty content, an unsupported encryption path, or a write that destroys unreadable private items. This is a confidentiality/data-loss class issue, not a cosmetic capability difference.
- Minimum fix: state that private bookmark read/edit/publish is `disabled` unless both NIP-44 decrypt and encrypt are available for the active signer. Never downgrade private entries to public tags or plaintext. Existing ciphertext may be preserved byte-for-byte only in a mode that does not claim it was decrypted/merged; otherwise block the write with a capability message.
- Location: §§10.1–10.2 and the bookmark acceptance tests.

#### P1-4 — A Blossom mirror requiring authenticated GET can pass publication but cannot be read by the specified cold-fetch path

- likelihood: plausible
- impact: high
- fix_cost: low
- gate_reason: this can make the core catalog unavailable in the main cold-start path; the correction is a simple publication/readability invariant, not a new server.
- Evidence: BUD-11 permits authorization on `GET /<sha256>` and `HEAD /<sha256>`. Publication §3.5 accepts “public/read-authorized visibility,” but cold fetch §3.4 sends an ordinary HTTP fetch and defines no BUD-11 `t=get` authorization retry. An anonymous user may also have no signer at catalog-open time.
- Consequence: a curator can satisfy the stated Blossom quorum using mirrors that return `401` to ordinary readers. The pointer is valid, yet the MVP retrieval algorithm can only fall back to stale/unavailable.
- Minimum fix: for MVP, count a mirror toward the manifest availability quorum only after an **unauthenticated public GET** returns and its bytes verify. Authenticated GET mirrors may be retained as extra hints but not as the only/quorum copies unless the design adds an exact optional BUD-11 `t=get` flow and defines behavior for users without a signer. This requires using existing compatible Blossom servers only; no self-hosted server is requested.
- Location: §§3.4–3.5, 13 and Blossom preflight tests.

#### P1-5 — Pointer retry contradicts the generation/blob chain contract

- likelihood: plausible
- impact: medium
- fix_cost: low
- gate_reason: publish/read-back retries are ordinary failure handling; the current text produces a pointer that retained-history clients quarantine.
- Evidence: pointer validation requires generation to increase and `previous` to match the previously accepted pointer. The canonical blob repeats generation and previous commitments. Publication nevertheless says the pointer may be retried without changing the blob hash and that “a new signed event changes the addressable winner.” A newly signed same-blob event cannot both increase generation and keep the same canonical blob hash; keeping the same generation violates the retained-history monotonic check.
- Consequence: after a timeout or partial relay publish, signing a new pointer as described can make clients quarantine the retry or diverge between the new NIP-01 winner and the last accepted chain.
- Minimum fix: distinguish two cases: (1) retry the **identical already-signed pointer event/id** to additional relays without changing any field; or (2) if a new pointer event is required, create a new manifest generation whose canonical blob updates `generation` and `previous`, then sign its new hash. Do not describe a newly signed same-hash pointer as a valid retry.
- Location: §§3.2 and 3.5.

#### P1-6 — `e`-only NIP-09 cleanup for dynamically discovered events requires a second coalesced dependency round, but the budget claims one

- likelihood: plausible
- impact: medium
- fix_cost: low
- gate_reason: the current primary-screen pipeline and REQ budget cannot perform the deletion validation it promises; adding one bounded coalesced round avoids both incorrect display and hidden N+1 growth.
- Evidence: review, reaction, observation and evidence event ids/authors are learned from the first result page. A valid kind-5 request may reference only an `e` id, and the client must know the target author's pubkey to validate it. Before the first page is received, an exact `#e`/author cleanup filter cannot be formed. The dependency table and budget nevertheless place “relevant kind 5” in the same single review/detail/reaction round and require deletion application before winner reduction.
- Consequence: an implementation must either skip valid `e`-only deletion requests, issue undocumented extra REQs, or run an unbounded broad kind-5 query. The latter two break the stated testable budget/N+1 contract.
- Minimum fix: define a bounded two-phase rule for event classes whose ids/authors are not known initially: first fetch/coalesce the target events; then issue at most one coalesced cleanup REQ per relay for the newly learned exact `e` ids/coordinates and matching authors, merge observed deletions, and finalize/provisionally update the page. Charge that follow-up in detail/review/reaction budgets. Exact ids already known from the manifest may remain in the first round.
- Location: §§4.3, 8.1–8.2, 9.1 and 13.

### P2

none blocking

### P3

none blocking

## review1_resolution:

| review-1 ID | classification | independent reassessment |
|---|---|---|
| P0-1 | resolved | Relay-internal shards were removed. One signed pointer commits to one whole canonical Blossom blob, and size/hash/schema/count verification gives an implementable completeness boundary for that curator snapshot. |
| P0-2 | resolved-by-explicit-CAP-tradeoff | The impossible arbitrary-relay strong deletion guarantee was withdrawn. `active/withdrawn`, observed winners, stale/incomplete UI and best-effort NIP-09 form a coherent AP MVP. |
| P1-1 | resolved | The design correctly states that current NIP-11 has no `max_filters`, uses an app-owned cap, and adds serialized-byte/array/limit constraints. |
| P1-2 | resolved-by-explicit-CAP-tradeoff | NIP-67 is no longer required. Same-timestamp saturation is bounded and reported incomplete rather than falsely complete. |
| P1-3 | resolved | Mandatory per-relay/scope Backward recovery replaced the fixed five-second overlap and is budgeted. A very narrow handoff race remains an accepted MVP limitation, not a blocker. |
| P1-4 | partial | Screen/cache/lazy dependencies and author-grouped filters are substantially resolved, but dynamically discovered `e`-only kind-5 cleanup needs a charged follow-up round (P1-6). |
| P1-5 | partial | Curator merge, provenance, active/withdrawn conflict and key removal are deterministic. The separate recommendation count still uses kind `30267` incompatibly (P1-1). |
| P1-6 | resolved | Only the old coordinate's same-publisher winner has migration authority; evidence is non-authoritative, with depth/cycle/deletion handling. |
| P1-7 | partial | Cross-relay read/merge/retry and irreducible simultaneous-edit limits are realistic. NIP-44-unavailable behavior remains unspecified (P1-3). |
| P2-1 | resolved | Claim levels avoid “official owner” claims, and duplicate publisher coordinates remain distinct. |
| P2-2 | resolved | Candidate `30367`–`30372` envelopes, grammars, canonical inputs, limits, unknown-version behavior and registry-collision migration are sufficiently closed for one implementation. |
| P2-3 | resolved-by-explicit-CAP-tradeoff | Winner-before-page ordering is deterministic; an unpageable timestamp boundary is capped and displayed as incomplete. |
| P2-4 | resolved | Per-reactor/target latest-event reduction and positive/negative/emoji/other buckets are deterministic. NIP-30 shortcode display can remain a non-core extension. |
| P2-5 | resolved | Receipt-time quarantine, fixed eligibility input, bounded horizon and explicit reevaluation triggers are defined. Live relay interpretation remains a preflight item. |
| P2-6 | resolved | Current NIP-22 top-level/nested tag examples, replacement/deletion treatment and future-only scope are present. |
| P2-7 | partial | Relay pointer limits, Blossom upload/mirror probes and independent quorums are present, but public cold-read accessibility and pointer retry semantics are inconsistent (P1-4/P1-5). |
| P3-1 | resolved | NIP-22, NIP-45 and Blossom BUD sources/adoption decisions are now listed with fixed commits. |
| P3-2 | partial | Pseudocode is correctly labeled non-compiling and exact typecheck is deferred, but one named API use is already known wrong: `verifier.secp256k1` (P1-2). |

Summary: `resolved` 9; `resolved-by-explicit-CAP-tradeoff` 3; `accepted-MVP-constraint` 0 as a standalone review-1 row; `partial` 6; `unresolved` 0.

## verified:

1. **Blossom endpoints are not invented:** BUD-01 `GET/HEAD /<sha256>` with optional extension; BUD-02 `PUT /upload`; BUD-04 optional `PUT /mirror`; BUD-06 optional `HEAD /upload`; BUD-11 kind `24242`, `expiration`, `t`, optional `server`, endpoint-required `x`, and `Authorization: Nostr <base64url-event>` are correctly identified. The remaining issue is publication's public-vs-authenticated read invariant, not endpoint fabrication.
2. **Canonical manifest feasibility:** one RFC-8785 UTF-8 blob, exact byte count, SHA-256, strict schema/count and bounded mirror fallback are implementable without relay shards or a custom Blossom server.
3. **AP/eventual consistency:** addressable NIP-01 winner rules, explicit `active/withdrawn`, observed-deletion union, cache-wipe rebuild, stale/incomplete/unavailable states and no-global-latest promise are coherent and proportionate.
4. **Pointer shape:** kind `30367` is currently unassigned in the registry; it is addressable, has stable `d`, signed content/tag commitments, hash/size/MIME/count/generation/previous/mirror data, and deterministic NIP-01 winner selection. Retry wording is the only blocking chain inconsistency found.
5. **Candidate kinds:** `30367`–`30372` are unassigned at the fixed registry HEAD. `32267` is assigned only as “Software Application” with free content and no standard schema; the design appropriately labels its strict JSON as the Nosmaps v1 profile rather than proof of legal ownership.
6. **NIP-11:** current NIP-11 has no standard `max_filters`; `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, `max_event_tags`, `max_content_length`, time fields and `default_limit` are present. Byte-aware app chunking is necessary because rx-nostr only queues concurrent REQs by `max_subscriptions`; it does not automatically byte-chunk filters.
7. **rx-nostr 3.7.5:** `createRxNostr`, `setDefaultRelays`, `createRxBackwardReq`, `createRxForwardReq`, Backward `.over()`, RxJS `unsubscribe()`, `dispose()`, NIP-42 `authenticator`, `Nip11Registry`, and max-subscription queuing exist. `use()` emits event packets, while raw messages are available separately. `verifier.secp256k1` does not exist and is recorded as P1-2.
8. **Pagination/gap posture:** NIP-67 is not falsely depended on; empty pages do not prove global completeness; same-timestamp caps become `incomplete`; reconnect recovery is charged. The remaining deletion follow-up is a budget/dependency issue, not a demand for strong completeness.
9. **Private bookmark core:** NIP-51 kind `10003` is correctly treated as one normal replaceable list per user, with cross-relay winner selection and plaintext/log restrictions. Irreducible simultaneous edits are admitted rather than hidden.
10. **Relay requirements:** `relay.nostr.band` and `relay.damus.io` are absent. The only defaults are `wss://x.kojira.io` and `wss://nos.lol`, with all operational capabilities deferred to dated live probes.
11. **Product contract:** no backend is introduced; signed events remain authoritative; Blossom is content-addressed blob storage; IndexedDB is discardable cache; search/filter is zero network; comparison/dependencies are coalesced rather than per-card; self-hosted Blossom/Worker/R2 work is not required.
12. **Review policy:** no blocker is based solely on rare relay partition, rare simultaneous edit, clock skew, mirror outage, or theoretical global completeness. All six blockers are clear standards/API mismatches or low-cost fixes for plausible high/medium impact failures.

## accepted_constraints:

1. **Relay partitions may expose stale/incomplete state.** No global latestness or strong convergence is promised while partitions persist; verified stale fallback is acceptable.
2. **NIP-09 is best effort.** A missing historical kind-5 event can leave old signed content observable; `withdrawn` winners/snapshots are the long-lived logical removal mechanism, and erasure is not promised.
3. **Blossom outages may make a curator stale/unavailable.** Bounded mirror attempts and hash-safe fallback are sufficient; a new self-hosted Blossom service is out of scope.
4. **Fresh clients cannot prove the entire pointer chain.** `chain-unverified` plus signature/hash/schema validation is an acceptable AP limitation; cached history can enforce local monotonicity.
5. **Same-timestamp pagination can saturate.** NIP-01 has no portable exclusion cursor within one timestamp. Stopping at a bounded cap and showing `incomplete: boundary-saturated` is preferable to a complex protocol for an uncommon boundary.
6. **Forward handoff is not transactional.** A very narrow event race between a completed Backward query and activation of a replacement Forward subscription can remain until a later recovery round; this does not justify a heavy state machine for MVP.
7. **Kind `10003` cannot provide lossless concurrent editing.** Pre-read/reread/retry catches observable conflicts, but disconnected same-field simultaneous edits may require manual conflict resolution. No CRDT is required.
8. **A trusted curator can temporarily self-deny its catalog with a malformed newer pointer/blob.** Quarantine plus last-verified stale fallback is adequate; the client need not search arbitrary older generations as a consensus protocol.

accepted_constraints_count: 8

## unverified:

These are implementation-preflight or runtime checks. They do not independently block design approval once the six gaps above are corrected.

1. Reachability and dated NIP-11 responses for `wss://x.kojira.io` and `wss://nos.lol`.
2. NIP-42 behavior, write policy/payment/PoW, candidate-kind acceptance, `OK`, read-back visibility and actual message/query limits on both relays.
3. Generic single-letter tag indexing for `#d`, `#a`, `#A`, `#L` and `#l`; uppercase behavior matters only to the future NIP-22 feature.
4. Selected existing Blossom servers' BUD-01/02/04/06/11 support, CORS, unauthenticated public GET policy, auth/payment, upload size, descriptor integrity, mirror import and redirect behavior.
5. Exact project lockfile and imports for `rx-nostr@3.7.5` and `@rx-nostr/crypto@3.1.6`, DOM/NIP-07 augmentation, `tsc --noEmit` and the project build.
6. RFC-8785 canonical fixtures, duplicate-key rejection, URL normalization, pointer tag/content equality and streaming size/hash enforcement.
7. Captured outbound logical/physical REQ traces after adding the coalesced deletion follow-up round; lazy zero-before-open and comparison no-N+1 assertions.
8. Property/E2E tests for AP partitions, cache wipe, pointer exact-event retry, Blossom public mirror quorum, bookmark capability-disabled behavior, concurrency conflicts, pagination saturation, reconnect recovery and stale UI.
9. Chromium/WebKit, desktop/375×812, console/page errors, and later physical-device/accessibility checks listed in task #79.

implementation_gate: BLOCKED
blocking_findings: 6
