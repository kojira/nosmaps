verdict: CHANGES_REQUIRED
score: 0.42

# Independent design review — relay-native data (review 1)

review_role: independent third-party reviewer
reviewed_document: `repos/nosmaps/design-relay-native-data.md`
reviewed_document_state: uncommitted workspace file, 721 lines, inspected 2026-08-16
retrieval_date: 2026-08-16

## Source fixation

Only official/primary sources were used.

- **nostr-protocol/nips**, current HEAD `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` (`2026-08-08T20:01:32-03:00`, `nip29: add "previous" tag example.`). Reviewed NIP-01, 07, 09, 11, 22, 25, 32, 42, 44, 45, 51, 65, 67, 77, 78, 89, 94, B0, 5A.
- **nostr-protocol/registry-of-kinds**, current HEAD `8d3fa7e252452e30fdf4e2917a487c239ef350cf` (`2026-08-15T19:13:06-03:00`, `Update descriptions to use title case`).
- **penpenpng/rx-nostr**, repository current HEAD `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc` (`2026-06-26T06:06:16+00:00`, `version(rx-nostr): 3.7.5`); GitHub current release `rx-nostr@3.7.5`, published `2026-06-26T06:05:48Z`, tag points to the same commit. Reviewed v3 official docs, package manifests, public TypeScript interfaces, implementation and tests. `@rx-nostr/crypto` at that tree is `3.1.6`.

## gaps:

### P0

#### P0-1 — The cold-start manifest protocol cannot deterministically discover a complete sharded catalog

- **Evidence:** NIP-01 defines a filter `limit` as a maximum for the initial query; a relay may return fewer events. Addressable winners are per `(kind,pubkey,d)`, not a transaction spanning multiple `d` values. The proposed cold filter is only `{kinds:[30367], authors:TRUSTED_CURATORS, limit:40}` and does not name a generation or expected shard coordinates. The manifest content says `shards`, but a client cannot know which returned event is the authoritative generation index, whether all shards arrived, whether shards from different generations were mixed, or whether a missing shard means deletion, relay omission, timeout, or corruption.
- **Why this matters:** Once the catalog exceeds 50 entries, the central contract “cold start 1 REQ/relay” does not imply a complete, atomic, deterministically reconstructable catalog. A stale old shard can survive beside new shards, a newer shard can be absent, and `limit:40` can truncate a curator with many retained versions/shards. A malicious or compromised curator can also present inconsistent `shards` values without a signed commitment over the shard set.
- **Minimum fix:** Define an explicit addressable **generation/index event** with a stable queryable `d` (for example `catalog:index:<scope>`) containing generation id, exact shard coordinates, exact winning event ids/hashes, entry count and removal semantics. Fetch the index and shards with a specified completeness algorithm. If retaining exactly one REQ, include separate filters in that one REQ for the stable index coordinate and the shard namespace/known coordinates, and define cache fallback when any committed shard is missing; otherwise admit a second REQ. Specify generation atomicity, stale-shard rejection, cross-relay union rules, curator-by-curator completeness, and hard maximum shard count below relay filter/response caps.
- **Location:** §§0 item 3 (line 12), 2.1 manifest row (line 41), 2.4 (lines 68-72), JSON §3.3 (lines 147-163), §5.2 (lines 373-401), REQ budget lines 587-588, agreements lines 691-693.

#### P0-2 — Deletion/tombstone reconstruction is not possible from the defined fetches

- **Evidence:** NIP-09 requires clients to keep deletion requests available and applies an `a` deletion to all versions up to the deletion request timestamp. The detail request asks for kind 5 only with `since: deletionCursor`, and the cold/cache-rebuild path retrieves manifest only. `deletionCursor` is not defined per relay/filter/author, and no full tombstone set is committed by the manifest. Relays may already have removed the target event while another relay returns it; a fresh cache therefore needs the deletion request itself to make a deterministic decision.
- **Why this matters:** Clearing IndexedDB can resurrect reviews, facts, manifests, or tools that were previously deleted, because historical kind 5 requests can fall before the cursor or be absent from the relay serving the target. This violates “IndexedDB is discardable cache” and makes deletion state depend on prior local history. The same issue affects curator tombstones if an entry is merely removed from a newer manifest and an old manifest remains available elsewhere.
- **Minimum fix:** Define a relay-reconstructable deletion ledger strategy: query all relevant kind 5 events without an unsafe local-only lower bound (paged as needed), or commit deletion/tombstone coordinates and event ids in a signed generation index and fetch them. Define cursor scope and advancement only after completeness, retain per-relay high-water marks, and specify union semantics where any valid same-author deletion request observed on any configured relay suppresses covered versions. Add cache-wipe/rebuild tests that cannot resurrect deleted data.
- **Location:** invariant lines 8, 23-24; kind table lines 39-50; §4.2 items 4 and 6 (lines 315, 317); detail filter line 416; forward filter line 461; REQ budget lines 590-606; NIP-09 section lines 618-620.

### P1

#### P1-1 — The design relies on NIP-11 `max_filters`, but current NIP-11 no longer defines it

- **Evidence:** At fixed NIP HEAD `656cecc7…`, NIP-11 server limitations define `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, `max_event_tags`, `max_content_length`, time limits and related fields, but **not `max_filters`**. Git history shows `nip-11: remove max filters, add max/default query limit` (`611b635`). rx-nostr v3 docs still mention the older `max_filters` concept, but that cannot make it a current relay-advertised standard field.
- **Why this matters:** “read the NIP-11 value and chunk” is not implementable against the current standard and cannot justify the REQ budget. More importantly, chunking only by number of filters does not enforce current `max_message_length`; a single filter with large `authors`, `ids`, or `#a` arrays can exceed it.
- **Minimum fix:** Remove claims that current NIP-11 supplies `max_filters`. Define an application-owned `MAX_FILTERS_PER_REQ` only as a conservative compatibility policy, and chunk by serialized REQ byte length using `max_message_length` when available plus a conservative fallback. Also enforce `max_subid_length`, `max_limit`, and per-array caps. Recalculate budgets for byte/limit chunking.
- **Location:** recommendation line 16; §4.4 lines 338-340; §5.6 lines 471-501; REQ budget preface line 583; NIP-11 section lines 622-624; sources/checks lines 706, 718.

#### P1-2 — NIP-67 pagination is described as usable, but rx-nostr 3.7.5 discards the hint in its completion path

- **Evidence:** rx-nostr 3.7.5 `EosePacket.message` retains the raw message, but `FinPacket` contains only `{from, subId}` and Backward completion consumes that stripped packet internally. `use()` emits only `EventPacket`; `createAllMessageObservable()` can observe raw EOSE separately, but the design does not correlate it with Backward child subIds/relay completion. The document simultaneously says NIP-67 may drive paging and says the high-level API was not confirmed to expose it.
- **Why this matters:** The review/history rows promise `finish`/`more` behavior that the shown code cannot implement. With multiple relays, completion must be tracked per relay: one relay may say `finish`, another `more`, and a timeout is neither. `until=oldest_created_at` plus id dedupe can still miss events sharing the boundary timestamp, exactly as NIP-67 warns.
- **Minimum fix:** Either remove NIP-67 from the MVP behavior/budget and specify a conservative boundary-tie algorithm with explicit incompleteness, or provide a concrete `createAllMessageObservable()` correlation layer keyed by generated subId and relay, including timeout/down-relay states and tests. Do not claim an empty page proves completeness across relays. Define how same-timestamp pages avoid infinite loops and omissions.
- **Location:** review code lines 427-445; budget lines 593-594; notes lines 609-614; NIP-67 section lines 638-640.

#### P1-3 — Forward subscription plus a fixed 5-second overlap is not a valid gap-recovery protocol

- **Evidence:** NIP-01 subscriptions deliver new events only while connected; it does not guarantee replay after an arbitrary disconnect. rx-nostr retries and re-establishes a Forward REQ but the design’s filter remains based on a stale `overlapSince = lastSync - 5`. The budget acknowledges “必要なら復旧後1 Backward gap REQ” but does not define when, from which cursor, or how completion is established.
- **Why this matters:** Events created during outages longer than five seconds can be missed permanently. Changes to the known author/address scope can also be missed before the forward filter is replaced. This breaks deterministic cache rebuilding and can leave manifest/detail state stale while claiming no new logical REQ on reconnect.
- **Minimum fix:** Specify a mandatory reconnect/state-change algorithm: record per-scope maximum accepted `created_at` plus boundary ids, run a Backward gap query from a conservative cursor after every disconnect/reconnect or filter-scope change, merge/dedupe, then resume Forward. Treat the gap query as part of the budget, and define timeout/incomplete status per relay.
- **Location:** recommendation line 15; §5.5 lines 447-469; budget lines 604-605; note line 614.

#### P1-4 — Detail/comparison filters omit required event classes and cannot validate manifest staleness/recommendations in the promised one REQ

- **Evidence:** The shown detail REQ contains `32267`, `30369/30370/30371`, and kind 5 only. It omits `30267` curation, `30367` manifest, `30368` taxonomy, `30372` review, kind 7 reactions, kind 0 profiles, NIP-94 kind 1063 evidence media metadata, and kind 1111 future replies. Yet the UI contract discusses recommendation counts, source verification, taxonomy, reviews, profiles, gallery, reactions, and stale detection.
- **Why this matters:** These data require additional REQs or must already be in cache, but neither condition is specified. The “tool detail 1 REQ / comparison 1 REQ” acceptance budget is therefore not testable and can silently become N+1 by tab/component. Also, `32267` filters using separate `authors` and `#d` arrays form a Cartesian product, while `limit:6` can be consumed by unwanted cross-pairs before all requested coordinates arrive.
- **Minimum fix:** Define each screen’s exact required data dependency graph, cache preconditions, and one coalesced OR-filter set. Group exact tool coordinates by author (or query source event ids from the manifest) so `limit` cannot starve requested pairs. Include or explicitly lazy-load taxonomy/reviews/profile/reactions/media/curation with revised budgets. Add a test that records outbound REQ messages for each scenario.
- **Location:** recommendation line 14; §4.4 lines 332-340; §5.3 lines 403-425; budget lines 590-603, 611-612.

#### P1-5 — Manifest trust and recommendation counting lack a deterministic multi-curator merge/conflict policy

- **Evidence:** The design says one trusted curator is sufficient for listing, the union of curators creates candidates, recommendation count is displayed, and a single manifest must not immediately clear cache. It does not define what happens when trusted curators publish conflicting names/categories/statuses, one tombstones while another lists, manifests are missing/stale, a key is removed/rotated, or the same curator has inconsistent shards across relays.
- **Why this matters:** The displayed catalog and recommendation count will vary by arrival order and relay availability. A compromised curator can inject or hide data; “do not immediately clear cache” can preserve revoked entries indefinitely. This is central business logic, not a UI detail.
- **Minimum fix:** Define a pure deterministic merge function: curator-local generation validity first, then union/intersection semantics for active/tombstoned entries, recommendation count source (`30267` winners, not manifest duplicates), field provenance, conflicts shown rather than silently selected, trust-key removal/rotation behavior, stale thresholds, and cache eviction/quarantine rules. Give executable examples for conflicting curators and relay partitions.
- **Location:** lines 12, 27, 66, 70-72; §4.1 lines 302-308; §4.2 item 6-7; security lines 668-670; agreements lines 691-693.

#### P1-6 — `superseded_by`/evidence `supersedes` does not have a safe authority or conflict rule

- **Evidence:** The design says a coordinate move is represented by a field on the old event plus a separately signed evidence-relation event, but it does not require the superseding relation to be signed by the old coordinate’s author or a specifically trusted curator, nor define precedence among conflicting relations/chains/cycles. Any author can publish candidate tool identities and evidence relations.
- **Why this matters:** An attacker could claim that a legitimate tool is superseded by an attacker-controlled coordinate. Chained/cyclic relations can make cache reconstruction non-deterministic. An old event cannot be edited in place; only a new version at the old coordinate can carry `superseded_by`, and deletion timing interacts with that redirect.
- **Minimum fix:** Make coordinate migration authoritative only when a valid newer event at the **old coordinate**, signed by the same pubkey, names the new coordinate; optionally accept curator mappings only as curator-scoped recommendations. Define validation, cycles, maximum chain length, conflicting destinations, deletion interaction, and UI treatment. Do not use arbitrary `30371` as global identity authority.
- **Location:** tool identity lines 54-63; evidence lines 86-88; §4.2 item 5 line 316; recommendation line 15.

#### P1-7 — Private bookmark concurrency can lose data and the replaceable winner/publish protocol is incomplete

- **Evidence:** NIP-51 kind 10003 is one normal replaceable list per user. The design correctly self-encrypts private tags, but the read-modify-write flow has no concurrency control. NIP-01 resolves same-timestamp replaceables by lowest id, and relays may retain different winners. `send(... completeOn:"all-ok")` only reports acknowledgements from selected relays; it does not ensure that all user write relays hold the same prior winner or that another device did not update concurrently.
- **Why this matters:** Two devices adding bookmarks can overwrite each other; same-second updates can select an unintended winner; reading `limit:1` from several relays can yield conflicting versions. This is permanent signed-data loss, not merely stale cache.
- **Minimum fix:** Specify cross-relay winner collection and deterministic selection before editing, conflict detection after publish, retry/merge semantics, a monotonic timestamp policy bounded by relay `created_at_upper_limit`, and UI conflict handling. If true concurrent merge cannot be guaranteed with kind 10003, state that limitation explicitly and test it. Also zero/log-redact decrypted plaintext and do not include private relay hints unless user accepts that metadata inside ciphertext is visible after key compromise.
- **Location:** private-bookmark lines 94-100, JSON lines 250-270, code lines 503-528, budget lines 599-600, agreement line 694.

### P2

#### P2-1 — `32267` identity and “official publisher/delegation” rules are underspecified

- **Evidence:** The registry only names kind 32267 “Software Application” with free content and no tag schema. NIP-51 and NIP-5A demonstrate references but do not define reverse-DNS ownership, publisher delegation, official-domain proof, or merging duplicate candidates. The design invokes “explicit delegation”, NIP-05, repository statements, and curator evidence without defining event formats or verification algorithms.
- **Why this matters:** Official/candidate badges and merge decisions cannot be implemented or tested consistently. A reverse-DNS-looking `d` is not proof of domain control, and NIP-05 proves an identifier-to-pubkey mapping, not application ownership by itself.
- **Minimum fix:** Define exact claim levels and machine-verifiable evidence formats, or scope MVP to curator-selected publisher keys without claiming official ownership. Specify how delegation is signed, expires/revokes, and how duplicate coordinates remain distinct.
- **Location:** lines 10, 25, 54-63; JSON §3.1.

#### P2-2 — New-kind schemas and indexed-tag contracts are not complete enough for interoperable validation

- **Evidence:** The document gives examples but not normative JSON Schemas/canonicalization for `30367`-`30372`: maximum lengths, required/optional fields, enum behavior, unknown-field handling, hash input canonicalization, environment-hash construction, evidence subject syntax, feature identifier namespace, or `d` grammar. `L/l` are used as schema discriminators, although NIP-32 says self-labels on non-1985 events label the event itself; this is legal but not a substitute for schema negotiation.
- **Why this matters:** Independent implementations can derive different `d` values and replacement units, and hostile inputs cannot be rejected consistently. “Candidate kind + label” does not prevent semantic collision if another protocol later assigns the kind.
- **Minimum fix:** Add normative per-kind schemas, canonical UTF-8/hash algorithms, required indexed tags, size limits, versioning and unknown-version behavior. Define a migration rule if registry collision occurs after publication; old signed events cannot change kind.
- **Location:** lines 26, 37-52, §§2.4-2.9, JSON §§3.3-3.8, security lines 665, 673.

#### P2-3 — Review pagination and one-review-per-user semantics need explicit winner-before-page ordering

- **Evidence:** Kind 30372 is addressable per `(kind, reviewer pubkey, d)`, but a relay may retain multiple versions and a page’s `limit` applies to events, not unique reviewers. Fetching 20 raw newest events can yield fewer than 20 review winners. Paging by inclusive `until` with only id dedupe does not define a stable cursor across relay unions or same-second versions.
- **Why this matters:** Pages can duplicate reviewers, omit older unique reviews, change as replacement versions arrive, or loop at timestamp boundaries. Ratings computed before addressable reduction are wrong.
- **Minimum fix:** Define that signature/deletion validation and addressable winner reduction happen before display/aggregation; page until enough unique winners are collected or completeness is unknown. Specify cursor state `(created_at, seen ids)` per relay, boundary expansion, replacement handling, and deterministic ordering.
- **Location:** review model lines 46, 90-92; §5.4 lines 427-445; budget line 593.

#### P2-4 — Reactions have no deterministic per-user/target aggregation rule

- **Evidence:** The kind table explicitly leaves “same user/target policy” to the client. NIP-25 reactions are regular events, so users can publish multiple `+`, `-`, or emoji reactions and deletions. The design displays helpful/like counts but does not choose whether to count events, users, latest reaction, or each emoji class.
- **Why this matters:** Counts can be trivially inflated by one key and differ between implementations. The acceptance budget cannot assert correct aggregation.
- **Minimum fix:** Define a deterministic policy, e.g. latest non-deleted reaction per `(pubkey,target-id)` with lowest-id tie-break, then aggregate by normalized content; define whether `-` cancels `+`, how emoji are shown, and how addressable target replacements affect reactions to old event ids.
- **Location:** lines 47, 90-92, JSON §3.9, budget lines 597-598, note 612.

#### P2-5 — Future timestamp handling is incomplete and can later flip winners without a defined trigger

- **Evidence:** Events beyond `now + 10 minutes` are put in `pending`, but there is no rule for persistence, reevaluation, relay-specific NIP-11 upper limits, or a maximum age/future horizon. `now` changes, so a pending event may become eligible without any incoming event.
- **Why this matters:** Different clients/times can choose different winners; a far-future event can consume storage indefinitely or activate unexpectedly. A cache rebuild at another time can change state without new signed input.
- **Minimum fix:** Define a fixed acceptance policy using local receipt time plus relay-advertised `created_at_upper_limit`, persist quarantine metadata only as cache, schedule deterministic reevaluation, cap the horizon, and expose clock-skew status. Tests must freeze time.
- **Location:** time rule line 30; security line 671; winner rule lines 15 and 314.

#### P2-6 — Future NIP-22 review replies are directionally correct but not specified enough to implement safely

- **Evidence:** NIP-22 requires uppercase root scope tags and lowercase parent tags, mandatory `K`/`k`, and author tags where available. For a top-level comment on addressable review 30372, both `A` and `a` must reference the review coordinate; the current winning review event id should also be included as `e` for the parent, with `P`/`p` and kind tags. Replies to comments change the lowercase parent to the kind 1111 event id while preserving the uppercase root.
- **Why this matters:** Saying only “use kind 1111 later” is insufficient and commonly leads to malformed threads or comments attached to obsolete review versions.
- **Minimum fix:** Add exact top-level and nested-reply examples, winner/replacement behavior, deletion handling, filters (`#A` for root where supported plus fallback), and clarify that NIP-22 is draft/optional.
- **Location:** alternatives line 683; agreement line 695; NIP-22 is missing from the source list at line 700 despite being a required source.

#### P2-7 — “Schema/size validation” is stated but relay-dependent publishability is not resolved

- **Evidence:** The manifest permits 128 KiB uncompressed content, while current NIP-11 example limits may be much smaller (`max_message_length` 16 KiB, `max_content_length` 8196 chars). NIP-11 fields are optional and per relay. The design does not define the lowest common denominator, per-relay rejection behavior, or how a curator ensures replication.
- **Why this matters:** A valid manifest under the app schema can be rejected by common relays, making the “multiple relay signed source” unavailable. The 50-entry threshold is unrelated to serialized size.
- **Minimum fix:** Set a conservative default serialized event/message limit compatible with target relays, dynamically reduce shard size using each write relay’s NIP-11 limits, require publish success quorum/visibility checks, and record per-relay failures without treating `all-ok` timeout as content invalidity.
- **Location:** manifest line 70; §4.2 item 7; §5.8; NIP-11 section line 624; security line 665.

### P3

#### P3-1 — Source inventory is internally inconsistent

- **Evidence:** NIP-22 is required by the review scope and used in the design, but line 700’s enumerated NIP list omits 22 (and 45), while the document claims complete fixed-source coverage.
- **Why this matters:** It weakens reproducibility and can conceal that the future comment format was not actually validated in the original static checklist.
- **Minimum fix:** Add NIP-22 and NIP-45 to the fixed source inventory and state what was verified or rejected from each.
- **Location:** source list lines 697-701; alternatives/agreement lines 683, 695.

#### P3-2 — The pseudo-code claim “API shape fixed” is stronger than the verification performed

- **Evidence:** The API names/types exist, but the document does not include a repository-level typecheck artifact. A direct isolated typecheck is not equivalent to compiling in Nosmaps’ eventual bundler/DOM setup, especially around `window.nostr` type augmentation and package versions (`rx-nostr` 3.7.5 plus `@rx-nostr/crypto` 3.1.6).
- **Why this matters:** Readers may interpret the snippets as compile-proven. They are directionally compatible, but application integration remains unverified.
- **Minimum fix:** Reword as non-compiling pseudocode until implemented, or add a minimal official-package TypeScript fixture with exact lockfile versions and CI typecheck in the later implementation phase.
- **Location:** §5 preface lines 341-345; source checks lines 699, 705.

## verified:

- NIP-01 class interpretation is correct: `10003` is normal replaceable; `30267`, `32267`, `39701`, and candidate `30367`-`30372` are addressable by numeric range. Same-timestamp winner uses lowest lexical id.
- Current registry HEAD contains `10003` Bookmark List, `30267` App Curation Set, `32267` Software Application, and `39701` Web Bookmarks; it contains no entries for `30367`-`30372` at the fixed revision.
- NIP-51 explicitly defines public list items in tags and private items as a JSON tag-array encrypted with NIP-44 using the author’s own key agreement. The self-encryption direction and “no public target tags” choice are correct. NIP-07 `nip44.encrypt/decrypt` is optional, so disabling rather than publishing plaintext is correct.
- NIP-B0 kind 39701 is a public addressable URI bookmark; restricting it to explicit public opt-in is correct.
- NIP-01 multiple filters in one REQ are OR; list values within one filter are OR while distinct filter fields are AND. The warning that independent `authors` and `#d` arrays create cross-pair matches is correct.
- `#a`, `#d`, `#t`, `#L`, `#l`, and `#e` are syntactically valid one-letter generic tag filters under NIP-01, provided relays index generic tags as required. `since`/`until` are inclusive. `limit` only applies to the initial stored query.
- NIP-25 requires `e`, recommends `p`, and recommends `a` for addressable targets; the reaction JSON example includes the required target references and `k` is allowed.
- NIP-09 same-author validation and `a` deletion coverage through deletion-request `created_at` are represented correctly; deletion is a request, not guaranteed erasure.
- NIP-32 permits `L/l` self-labels on non-1985 events. Using them as an index aid is protocol-valid, though not sufficient as a complete custom schema.
- rx-nostr 3.7.5 exposes `createRxNostr`, `createRxBackwardReq`, `createRxForwardReq`, `use`, `emit`, Backward `over`, `setDefaultRelays`, scoped temporary relays, `send`, `dispose`, `batch`, and `chunk`. Forward emits replace the old REQ with the same sub-id; Backward emits create independent subscriptions. Unsubscribe sends/causes CLOSE teardown.
- rx-nostr defaults to NIP-07 signer when signer is omitted; `authenticator:"auto"` uses the configured signer for NIP-42. `@rx-nostr/crypto` exports `verifier`. `completeOn:"all-ok"`, `errorOnTimeout`, and `OkPacketAgainstEvent.done` exist.
- rx-nostr uses NIP-11 `limitation.max_subscriptions` for its queue. It does not automatically enforce filter-count or message-size constraints.
- The `batch()` and `chunk()` operator usages shown match their public signatures. Temporary relay selection through `on.relays` plus `defaultReadRelays` is supported, and emit-scope relay selection overrides use scope.
- NIP-22 kind 1111 is the correct future mechanism for comments on addressable non-kind-1 events, if its full root/parent tag rules are followed.
- The document correctly avoids treating NIP-42 authentication as content trust and correctly treats relay hints/NIP-65 as routing hints rather than authority.

## unverified:

- No live relay was used to prove that candidate kinds `30367`-`30372`, generic `#L/#l/#a/#d` indexing, large filters, or large content are accepted and indexed consistently. Protocol syntax alone does not guarantee deployment behavior.
- No canonical schema files exist for `org.nosmaps.*`; therefore example validation, canonical hashes, environment hashes, and cross-client `d` derivation could not be verified.
- No concrete curator keys, relay set, key-rotation events, delegation format, stale threshold, or recommendation merge implementation exists to verify.
- No typechecked Nosmaps integration exists. The rx-nostr API surface was verified from official source, but the document’s complete snippets were not compiled in the target project configuration.
- NIP-67 use through rx-nostr’s high-level subscription API is not implemented in the design; only raw-message observability was verified.
- Deterministic full reconstruction after cache deletion, relay partition, missed deletion requests, concurrent bookmark writes, and multi-curator shard conflicts is not demonstrated. These are blocking unverified properties, not PASS items.

implementation_gate: BLOCKED
