# Relay-Native Data Design — Independent Review 3

- review_date: 2026-08-16
- reviewer_role: independent third-party, zero-based re-review
- reviewed_document: `repos/nosmaps/design-relay-native-data.md` (769 lines as inspected)
- review_policy: risk-proportional MVP
- review_scope: review artifact only; no code/design modification, implementation, dependency addition, commit, push, or publication

## Source fixation

Official/primary sources were independently re-fetched and fixed on 2026-08-16.

- `nostr-protocol/nips` current HEAD `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`, commit date `2026-08-08T20:01:32-03:00`, message `nip29: add "previous" tag example.` Reviewed NIP-01, 07, 09, 11, 22, 25, 42, 44, 51, 67, 89, 94, B0, 5A and the repository kind table.
- `nostr-protocol/registry-of-kinds` current HEAD `8d3fa7e252452e30fdf4e2917a487c239ef350cf`, commit date `2026-08-15T19:13:06-03:00`, message `Update descriptions to use title case`. Reviewed `schema.yaml`.
- `penpenpng/rx-nostr` current HEAD/release/tag `rx-nostr@3.7.5`, commit `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc`, commit date `2026-06-26T06:06:16Z`; latest GitHub release published `2026-06-26T06:05:48Z`. npm current versions rechecked as `rx-nostr@3.7.5` and `@rx-nostr/crypto@3.1.6`. Reviewed v3 official docs, exported interfaces, request/subscription implementation, AUTH, NIP-11 registry/queue behavior, tests, and crypto source.
- Blossom official BUD repository `hzrd149/blossom` current HEAD `b5bd2801d1763aa635fc8fea7a76597e0eb18990`, commit date `2026-06-15T11:08:10-05:00`, message `Merge pull request #108 from hzrd149/clarify-bud-00-client-side`. Reviewed BUD-00, 01, 02, 04, 06 and 11.
- RFC 8785, JSON Canonicalization Scheme, fetched from the RFC Editor on 2026-08-16.

verdict: CHANGES_REQUIRED
score: 0.88
review_policy: risk-proportional MVP

## gaps:

### P1-1 — Detail/comparison cannot discover `30369`/`30370`/`30371` records from a tool

- likelihood: common
- impact: high
- fix_cost: low
- gate_reason: this is a primary-path retrieval contract gap. The design budgets one coalesced detail target round, but gives an implementation no exact Nostr filter that can discover the stated claim/observation/evidence dependencies when their authors and event ids are not already known.
- Evidence: the detail shell and comparison graph require `30369/30370/30371` (§9.1), and the budget charges a target round for them (§13). Their schemas (§§7.4–7.6) put the tool/subject only in JSON content or a hash embedded inside `d`. Unlike `30372`, they do not require an indexed `a` tag that agrees with the tool coordinate. NIP-01 filters can query event fields and indexed single-letter tags, not arbitrary JSON content or a hash prefix inside `d`; the document supplies neither known authors/exact ids nor a concrete filter for these kinds.
- Consequence: a cold detail view cannot reliably fetch the promised conformance, observation, or evidence records. An implementation must either omit them, scan broad kind streams, depend on an undeclared search/index backend, or issue ad hoc queries whose completeness and budget are undefined. This breaks the backend-free relay-native contract and makes the stated one-round/no-N+1 detail budget untestable.
- Minimum fix: require and validate a queryable subject index for every record intended to appear in tool detail/comparison—preferably exact `["a", "32267:<publisher>:<d>"]` on `30369` and tool-subject `30370/30371`, with content/tag equality. Then specify the exact author-independent `{"kinds":[30369,30370,30371],"#a":[<selected tool coordinates>]}` coalesced filters, handling of evidence whose primary subject is an event/hash rather than the tool, generic-`#a` live-probe fallback, caps/pagination, and trace fixtures. Alternatively remove those records from immediate MVP detail dependencies and make them discoverable only from exact ids/coordinates already referenced by fetched records.
- Location: §§7.4–7.6, 9.1, 11.1, 13, 15.

### P1-2 — Candidate `d` grammars exceed the common 192-byte limit

- likelihood: plausible
- impact: medium
- fix_cost: low
- gate_reason: this is a clear internal schema contradiction that can reject otherwise schema-valid normal inputs or yield different author/validator behavior; it is cheap to close before implementation.
- Evidence: §7.1 caps every candidate-kind `d` at 192 bytes. Section 7.4 permits a 128-byte `feature` in `d=conformance:<64hex>:<feature-id>`, whose allowed maximum is 205 bytes; only 115 feature bytes fit the common cap. Section 7.5 permits a 128-byte observation type and 8–32-byte nonce in `d=observation:<64hex>:<type>:<nonce>`, whose allowed maximum reaches 238 bytes; even an 8-byte nonce leaves only 106 bytes for the type. The text does not say the common cap narrows those component maxima, and the defined hash/replacement coordinate depends on these exact strings.
- Consequence: conforming authors can create identifiers that conform to the kind-specific bullets but violate the common envelope, while independent validators may truncate, reject, or derive different replacement coordinates. This harms candidate-kind interoperability and testability.
- Minimum fix: make the per-kind component limits arithmetically fit 192 bytes, or explicitly reduce/encode/hash variable components in the `d` while retaining full values in content. Add exact 191/192/193-byte fixtures for every candidate-kind `d` grammar.
- Location: §§7.1, 7.4, 7.5, 15.

## review2_resolution:

| review-2 ID | status | independent determination |
|---|---|---|
| P1-1 | resolved | `30267` is now explicitly a NIP-51 App curation set winner per `(curator,d)`. Recommendation is derived from exact software-application `a` membership, multiple sets from one curator count once per tool, replacement without the member withdraws that recommendation, and no custom per-tool JSON/state record remains. |
| P1-2 | resolved | The pseudocode imports `verifier` from `@rx-nostr/crypto` and passes `createRxNostr({ verifier })`. The fixed package exports `verifier` directly as `EventVerifier`; no `verifier.secp256k1` remains. App-owned helpers are named as non-compiling pseudocode. |
| P1-3 | resolved | Private bookmark read/edit/publish is disabled unless the active signer exposes both NIP-44 encrypt and decrypt. Missing capability, capability loss, or unreadable existing ciphertext blocks signing/EVENT publication, preserves the last event, and never downgrades to plaintext, public tags, or empty content. |
| P1-4 | resolved | Manifest availability quorum counts only an anonymous request with no `Authorization` header whose `GET /<sha256>` succeeds and whose bytes match length/hash. Authenticated-GET-only mirrors are optional hints, cannot count toward quorum, and cannot be the only copy; cold fetch requires no signer. |
| P1-5 | resolved | Relay retry retransmits the identical already-signed pointer event/id. A newly signed pointer requires a newly constructed canonical manifest generation with increased generation, updated previous commitment, and new blob hash; newly signed same-generation/same-hash retry is prohibited. |
| P1-6 | resolved | Review/reaction/observation/evidence cleanup is defined as target round followed by at most one coalesced kind-5 cleanup REQ per relay for newly learned ids/coordinates/authors. Dependency graph, physical budget, provisional/incomplete state, per-round caps, acceptance traces, and the no-N+1 invariant all include the follow-up. |

review2_resolved_count: 6
review2_partial_count: 0
review2_unresolved_count: 0

## verified:

1. **Manifest/pointer core is coherent:** one signed stable `30367` addressable pointer commits to one complete RFC-8785 canonical UTF-8 manifest blob by exact SHA-256, byte size, MIME, schema, count, generation, previous pointer/hash and mirror list. Strict byte/hash/canonical/schema validation precedes use; mismatches never become truth.
2. **Blossom use matches the fixed BUDs:** BUD-01 `GET/HEAD /<sha256>` and optional extension, BUD-02 `PUT /upload` and descriptor, BUD-04 optional `PUT /mirror`, BUD-06 advisory `HEAD /upload`, and BUD-11 kind `24242` authorization are used without inventing endpoints. Upload/mirror support is probed; self-hosted Blossom is not required.
3. **Mirror fallback is bounded and safe:** signed hints plus user fallback origins are bounded by `MAX_MIRROR_ATTEMPTS`; redirect/hash preservation, streaming size cap, exact hash and canonical schema checks are required; prior verified content is labeled stale and unverified bytes are rejected.
4. **AP/eventual-consistency contract is honest:** the document does not claim global latestness, global deletion completeness, or strong consistency. It derives deterministic state from observed valid signed events/blobs, exposes relay coverage/as-of/fresh/stale/incomplete/unavailable/quarantined, and states eventual convergence only after clients observe the same valid input set.
5. **Withdrawal/deletion/cache behavior is proportionate:** explicit `active|withdrawn` pointer/manifest/record winners carry durable logical state; observed valid NIP-09 deletion requests suppress covered versions, but kind 5 remains best effort and not a correctness ledger. Empty-cache rebuild uses signed pointers/blobs and current record winners; IndexedDB remains discardable.
6. **Multi-curator merge is deterministic:** curator-local verification precedes sorted pure merge; one active trusted curator may list an active tool winner; withdrawn/conflicting curator states and field provenance remain visible; recommendation count is separate from manifest inclusion.
7. **Kind status is current:** candidate `30367`–`30372` are unassigned at registry HEAD `8d3fa7e…`; NIP-01 makes them addressable by kind/pubkey/`d`. `30267` is assigned to App Curation Set and `32267` to Software Application. Collision migration preserves old signed interpretation rather than silently redefining it.
8. **Current NIP-11 handling is correct:** the design explicitly rejects a standard `max_filters`, uses an app-owned filter cap, and applies serialized UTF-8 REQ bytes, array caps, `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, content/tag limits, and advertised time bounds. Physical chunk growth is separate from logical dependency rounds.
9. **rx-nostr API posture is viable:** fixed v3 exports `createRxNostr`, `createRxBackwardReq`, `createRxForwardReq`, Backward `.over()`, RxJS unsubscription, `dispose()`, AUTH configuration and NIP-11/max-subscription queue support. The design does not pretend app-owned per-relay/byte-chunk helpers are package APIs, and exact-lockfile typechecking remains an implementation gate.
10. **Pagination/reconnect behavior is bounded:** review winner reduction precedes display/page construction, same-timestamp boundaries are inclusive and capped as incomplete, empty pages do not prove multi-relay completeness, NIP-67 is not required, and reconnect/resume/scope change charges a mandatory per-relay/scope Backward gap query before Forward resumes.
11. **Screen/network budget avoids obvious N+1:** cold pointer fetch is one REQ per relay, manifest retrieval is HTTP, search is zero network, lazy profile/review/reaction/media dependencies issue zero before open, comparison coalesces selected tools, and cleanup is one coalesced follow-up rather than per event. The one unresolved exception is the missing initial discovery filter for `30369`–`30371` recorded above.
12. **Other deterministic rules are implementable:** migration authority belongs only to the old coordinate's same-publisher winner; reaction reduction is per reactor/target with deterministic tie-breaking; future timestamps use frozen receipt context and bounded horizon; NIP-22 is future-only; pointer and bookmark publication use per-target OK/read-back and expose conflict/failure.
13. **Relay/product scope is preserved:** `relay.nostr.band` and `relay.damus.io` occur zero times; defaults are `wss://x.kojira.io` and `wss://nos.lol`; capabilities remain live-probe unknowns. No backend is introduced, signed Nostr events are authoritative, Blossom is content-addressed storage, and search operates from reconstructable local cache.
14. **Static review checks:** all six fenced JSON examples parse; `verifier.secp256k1`, custom `recommend:` coordinates, and the closed relay hostnames have zero occurrences; `git diff --check` passes for the reviewed design and this review artifact.

## accepted_constraints:

1. **Relay partitions may expose stale/incomplete state.** No global latestness or strong convergence is promised while partitions persist; verified stale fallback is acceptable.
2. **NIP-09 is best effort.** A missing historical kind-5 event can leave old signed content observable; `withdrawn` winners/snapshots are the long-lived logical-removal mechanism, and erasure is not promised.
3. **Blossom outages may make a curator stale/unavailable.** Bounded mirror attempts and hash-safe fallback are sufficient; creating a self-hosted Blossom service is out of scope.
4. **Fresh clients cannot prove the entire pointer chain.** `chain-unverified` plus signature/hash/schema validation is an acceptable AP limitation; retained local history may enforce monotonicity.
5. **Same-timestamp pagination can saturate.** NIP-01 provides no portable exclusion cursor within one timestamp; bounded stop plus `incomplete: boundary-saturated` is proportionate.
6. **Forward handoff is not transactional.** A narrow event race between Backward completion and replacement Forward activation may remain until a later mandatory recovery round; a heavier consensus/state protocol is not justified for MVP.
7. **Kind `10003` cannot provide lossless concurrent editing.** Pre-read/reread/retry detects observable conflicts, but disconnected simultaneous same-field edits may need manual resolution; no CRDT is required.
8. **A trusted curator can temporarily self-deny with a malformed newer pointer/blob.** Quarantine plus last-verified stale fallback is sufficient; the client need not search arbitrary old generations as a consensus mechanism.

accepted_constraints_count: 8

## unverified:

These are implementation-preflight/typecheck/E2E checks. They do not independently block the design and should not be read as failures.

1. Dated reachability and NIP-11 responses for `wss://x.kojira.io` and `wss://nos.lol`.
2. NIP-42 AUTH, payment/PoW/write policy, candidate-kind acceptance, `OK`, exact-id read-back visibility, actual event/message/query limits and retained-version behavior on both relays.
3. Generic tag indexing for `#d`, `#a`, `#A`, `#L` and `#l`; `#a` is especially necessary for the minimum fix to P1-1, while uppercase `#A` matters only to future NIP-22.
4. Selected existing Blossom servers' BUD-01/02/04/06/11 support, CORS, anonymous public GET, auth/payment, upload size, descriptor integrity, mirror import, redirect and retention behavior.
5. Exact project lockfile and imports for `rx-nostr@3.7.5` and `@rx-nostr/crypto@3.1.6`, DOM/NIP-07 augmentation, `tsc --noEmit`, production build, and concrete Backward/Forward subscription teardown (`over`/RxJS unsubscribe/`dispose`) tests.
6. RFC-8785 implementation fixtures including duplicate-key rejection, Unicode/JCS edge cases, URL normalization, pointer tag/content equality and streaming size/hash enforcement.
7. Captured outbound logical/physical REQ and Blossom traces after P1-1 defines exact filters; byte/array/filter chunk limits, cleanup bound, lazy zero-before-open, and comparison no-N+1 assertions.
8. Property/E2E tests for AP partitions, cache wipe, active/withdrawn, multi-curator merge, pointer retry/read-back, public Blossom quorum, bookmark capability/conflict paths, pagination saturation, reaction replacement/deletion, future timestamps and reconnect recovery.
9. Live probe and fixtures for corrected candidate-kind `d` boundary lengths after P1-2 is closed.
10. Browser/device/accessibility checks required by the parent task.

implementation_gate: BLOCKED
blocking_findings: 2
