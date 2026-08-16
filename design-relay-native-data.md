# Nosmaps relay-native data design — review-1 revision

Status: design only; no implementation in this phase
Revision date: 2026-08-16
Normative terms: MUST, MUST NOT, SHOULD, MAY

## 0. Decisions, scope, and invariants

1. Nostr relays carry signed, small events. A curator catalog manifest is **one canonical JSON blob**, addressed by SHA-256 and replicated on Blossom servers. Relay-internal catalog shards, shard discovery, and generation-index events do not exist in this design.
2. A curator publishes one stable addressable pointer coordinate. The signed pointer commits to the blob hash, byte size, MIME, schema version, generation, prior pointer, entry count, generation time, and mirror hints.
3. Cold start costs one Nostr REQ per configured relay for pointers. After deterministic pointer-winner selection, blob retrieval is HTTP and has a separate budget.
4. The catalog is AP/eventually consistent. The client never claims a globally latest state under partition. It reports the winner observable from the configured relay set as of a stated time, with relay coverage and blob verification metadata.
5. Catalog inclusion is reconstructed from each trusted curator's latest **observed and verified** manifest snapshot plus current observed record winners. NIP-09 kind 5 is best-effort cleanup/privacy signaling, not a mandatory or globally reconstructable deletion ledger.
6. A valid `active` entry from one trusted curator is sufficient for listing, subject to the referenced tool record being an observed valid `active` winner. Other curator states, field provenance, and conflicts remain visible. Recommendation count comes from membership in selected current kind `30267` NIP-51 App curation set winners, never duplicate manifests.
7. Every addressable record in this design has explicit `state: "active" | "withdrawn"`; a later valid winner may withdraw or reactivate it. Old events that remain on another relay do not outrank a newer observed winner.
8. All relay- and server-specific capabilities are unverified until the implementation-preflight live probe. In particular: candidate-kind acceptance, generic tag indexing, NIP-11 values, NIP-42 AUTH, relay message/event limits, and Blossom upload/auth/size policy.
9. Default relay candidates are exactly `wss://x.kojira.io` and `wss://nos.lol`. Users may configure others.
10. IndexedDB is a discardable acceleration cache, not evidence of global completeness. Verified old blobs may be retained for stale fallback; unverified bytes never become catalog truth.
11. MVP pagination does not depend on NIP-67 hints and never treats an empty page as proof of multi-relay completeness.
12. TypeScript in this document is non-compiling pseudocode. Exact-package typechecking is an implementation-phase acceptance gate.

Non-goals:

- strong consistency, global latestness, or complete deletion reconstruction from arbitrary relay subsets;
- proof that a publisher key is an application's legal/official owner;
- concurrent lossless CRDT semantics for NIP-51 kind `10003`;
- NIP-22 comments in MVP;
- a new Blossom API, NIP, or BUD.

## 1. Terms, clocks, and observable states

- **configured relay set**: relays enabled for the current operation.
- **trusted curator set**: pubkeys locally trusted for catalog pointers.
- **relay coverage**: per relay, `eose | timeout | auth-required | rejected | disconnected`, recorded with observation time.
- **pointer winner**: valid addressable event winner per `(30367, curator pubkey, d)` over events actually observed: greatest `created_at`, then lexicographically lowest event id on a tie.
- **record winner**: same rule for an addressable record coordinate after signature/schema/future-time/deletion validation.
- **verified manifest**: bytes whose count, SHA-256, canonical JSON form, and schema all match the signed pointer.
- **as-of**: local time at which a fetch round was closed; it is not a global timestamp.
- **fresh**: verified current pointer/blob and sufficient configured-relay coverage within the local threshold.
- **stale**: a previously verified generation is shown because the currently observed pointer/blob cannot be fully verified or the freshness threshold was exceeded.
- **incomplete**: some required relay/dependency result is timeout, unavailable, boundary-saturated, or otherwise not proven complete.
- **unavailable**: no verified generation or required record can be displayed.
- **quarantined**: validly signed input withheld from winner selection because of schema, time, chain, or consistency policy.

Default local policy values are explicit app configuration, not protocol facts:

```text
CATALOG_STALE_AFTER = 24h
MAX_POINTER_AGE_BEFORE_WARNING = 7d
MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ = 8
MAX_FUTURE_SKEW = 10m
MAX_FUTURE_HORIZON = 30d
MAX_MIRROR_ATTEMPTS = 4
MAX_FILTERS_PER_REQ = 8
MAX_SERIALIZED_REQ_BYTES_FALLBACK = 12_000
MAX_ARRAY_ITEMS_PER_FILTER = 128
MAX_MIGRATION_DEPTH = 8
MAX_DETAIL_RAW_EVENTS_PER_RELAY = 2_000
MAX_DETAIL_BYTES_PER_RELAY = 4_000_000
MAX_DETAIL_PAGES_PER_RELAY = 8
```

## 2. Event model and publisher claims

### 2.1 Kinds

| kind | role | replacement unit / winner | MVP |
|---:|---|---|---|
| `0` | profile | pubkey | read lazily |
| `5` | NIP-09 deletion request | regular event; observed union | best effort |
| `7` | NIP-25 reaction | regular; app reduces per user/target | read lazily |
| `1063` | NIP-94 media metadata | regular | read lazily |
| `10003` | NIP-51 bookmark list | pubkey | private write/read |
| `30267` | NIP-51 App curation set | `(30267, curator, d)` set | count/source |
| `30367` | catalog blob pointer | `(30367, curator, d)` | core |
| `30368` | taxonomy record | `(30368, author, d)` | cached/lazy |
| `30369` | conformance claim; exact tool `a` index required | `(30369, author, d)` | detail |
| `30370` | observation; exact tool `a` required when tool-subject/linked | `(30370, author, d)` | detail only when tool-indexed |
| `30371` | evidence relation; related-tool `a` required for detail | `(30371, author, d)` | tool-indexed detail; not migration authority |
| `30372` | review | `(30372, reviewer, d)` | review tab |
| `32267` | software application | `(32267, publisher, d)` | core record |
| `1111` | NIP-22 comment | regular | future only |

Candidate kinds `30367`–`30372` are namespaced by required `L/l` tags but those tags are indexing aids, not schema negotiation or registry ownership. If an official registry collision occurs, old signed events remain readable under their original candidate schema; publication moves to a newly selected kind/schema major, and cross-kind migration is explicit rather than reinterpretation.

### 2.2 Tool identity and claim levels

Tool identity is the full coordinate `32267:<publisher-hex>:<d>`. Similar `d` values under different pubkeys are distinct and MUST NOT be auto-merged.

MVP uses a **curator-selected publisher claim**. The UI MUST NOT say “official” solely because `d` resembles reverse DNS, because a profile has NIP-05, or because a curator lists it.

Closed claim levels:

| level | machine meaning | UI wording |
|---|---|---|
| `self_asserted` | publisher signed the `32267` event | “publisher-signed” |
| `nip05_linked` | current NIP-05 lookup maps the displayed identifier to the publisher key | “NIP-05 linked”; not ownership proof |
| `curator_selected` | at least one trusted curator's verified manifest lists this exact coordinate | “selected by N curator(s)” |
| `evidence_linked` | valid `30371` evidence references the coordinate | “evidence available” |

Future delegation needs a separately specified signed format with issuer, delegate, exact coordinate/scope, issued time, expiry, and revocation. Until that exists, no delegation badge is emitted.

## 3. Blossom-backed manifest and signed relay pointer

### 3.1 Blossom behavior used—no invented endpoints

This design uses the primary Blossom BUDs as follows:

- BUD-01: retrieve exact content-addressed bytes with `GET /<sha256>`; optionally probe with `HEAD /<sha256>`. Redirects must preserve the hash in the destination URL.
- BUD-02: upload exact bytes with `PUT /upload`; optional `X-SHA-256`, `Content-Type`, and `Content-Length`; response descriptor contains `url`, `sha256`, `size`, `type`, `uploaded`.
- BUD-04: a destination that supports it may import with `PUT /mirror` and JSON body `{ "url": <source> }`.
- BUD-06: optional `HEAD /upload` preflight is advisory, not a guarantee.
- BUD-11: a server may require a signed kind `24242` authorization token. Every authored or accepted token MUST have nonempty human-readable `content` explaining its intended use. Nosmaps uses the fixed strings `Upload Nosmaps catalog manifest` for `PUT /upload`/`HEAD /upload` and `Mirror Nosmaps catalog manifest` for `PUT /mirror`; content MUST NOT contain secrets, blob bytes, authorization material, or URL tokens. Both upload and mirror use exactly one `t=upload`, a future `expiration`, and at least one required lowercase 64-hex `x=<sha256>` matching the endpoint's implied blob hash. `created_at` MUST be in the past, and id/signature MUST validate. When server scoping is used, the tag is exactly `["server", "lowercase.domain"]`: its value is a lowercase domain name only. Scheme, path, query, fragment, userinfo, and port are not serialized and do not participate in BUD-11 server-tag matching; this design does not extend the scope value beyond the domain-only primary specification. The HTTP form is `Authorization: Nostr <base64url-event>` using unpadded Base64url of the complete signed event JSON.

Upload-token authoring example:

```json
{
  "id": "<valid-event-id>",
  "kind": 24242,
  "pubkey": "<curator-pubkey>",
  "created_at": 1786800000,
  "tags": [
    ["t", "upload"],
    ["expiration", "1787000000"],
    ["x", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
    ["server", "blossom-a.example"]
  ],
  "content": "Upload Nosmaps catalog manifest",
  "sig": "<valid-signature>"
}
```

Mirror-token authoring example:

```json
{
  "id": "<valid-event-id>",
  "kind": 24242,
  "pubkey": "<curator-pubkey>",
  "created_at": 1786800000,
  "tags": [
    ["t", "upload"],
    ["expiration", "1787000000"],
    ["x", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
    ["server", "blossom-b.example"]
  ],
  "content": "Mirror Nosmaps catalog manifest",
  "sig": "<valid-signature>"
}
```

Normative non-compiling BUD-11 authoring/validation pseudocode:

```ts
function authorizeManifestWrite(operation, sha256, endpoint, now) {
  require(operation === "upload" || operation === "mirror")
  require(isLowercaseSha256(sha256))
  const content = operation === "mirror"
    ? "Mirror Nosmaps catalog manifest"
    : "Upload Nosmaps catalog manifest"
  const tags = [["t", "upload"], ["expiration", String(now + AUTH_TTL)], ["x", sha256]]
  const domain = lowercaseDomainOnly(endpoint.hostname)
  if (policy.scopeAuthorizationToServer) tags.push(["server", domain])
  return signEvent({ kind: 24242, created_at: now - 1, tags, content })
}

function validateManifestWriteAuthorization(event, operation, sha256, endpoint, now) {
  require(operation === "upload" || operation === "mirror")
  require(isLowercaseSha256(sha256))
  require(event.kind === 24242)
  require(validEventIdAndSignature(event))
  require(event.created_at < now)
  require(hasFutureExpiration(event.tags, now))
  require(exactlyOneTag(event.tags, "t", "upload"))
  require(hasTag(event.tags, "x", sha256) && isLowercaseSha256(sha256))
  require(typeof event.content === "string" && event.content.trim().length > 0)
  require(isHumanReadableForDisplay(event.content))
  require(noSecretBlobUrlTokenOrAuthorizationMaterial(event.content))
  if (hasTagName(event.tags, "server")) {
    require(allServerTagsAreLowercaseDomainOnly(event.tags))
    require(hasTag(event.tags, "server", lowercaseDomainOnly(endpoint.hostname)))
  }
  require(event.content === (operation === "mirror"
    ? "Mirror Nosmaps catalog manifest"
    : "Upload Nosmaps catalog manifest"))
}
```

This contract is applied on every token-authoring path and again before encoding/sending a token. `PUT /mirror` still uses the BUD-11 action `upload`; “mirror” selects the human-readable content and endpoint validation, not a different `t` verb. The implied hash is the `X-SHA-256` request header for `HEAD /upload`/`PUT /upload` and the SHA-256 of the imported blob for `PUT /mirror`.

Mirror hints are ordinary BUD-01 URLs, not a new discovery protocol. A client derives the canonical retrieval path from the hinted HTTPS origin plus `/<sha256>.json`; it rejects a hint whose path hash differs. Signed order is a preference only.

### 3.2 Pointer event

The stable coordinate is:

```text
kind: 30367
d: nosmaps:catalog:v1:<scope>
scope grammar: [a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?
```

Pointer content and tags duplicate critical values intentionally; disagreement invalidates the pointer. The event remains small and carries no catalog entries.

```json
{
  "kind": 30367,
  "created_at": 1786896000,
  "pubkey": "<trusted-curator-hex>",
  "tags": [
    ["d", "nosmaps:catalog:v1:global"],
    ["L", "org.nosmaps.schema"],
    ["l", "catalog-pointer", "org.nosmaps.schema"],
    ["v", "1"],
    ["state", "active"],
    ["generation", "42"],
    ["x", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
    ["size", "184292"],
    ["m", "application/vnd.nosmaps.catalog+json"],
    ["count", "317"],
    ["generated_at", "1786895900"],
    ["prev", "41", "<previous-pointer-event-id>", "<previous-blob-sha256>"],
    ["url", "https://blossom-a.example/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json"],
    ["url", "https://blossom-b.example/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json"]
  ],
  "content": "{\"schema\":\"org.nosmaps.catalog-pointer\",\"version\":1,\"state\":\"active\",\"scope\":\"global\",\"generation\":42,\"sha256\":\"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\",\"bytes\":184292,\"mime\":\"application/vnd.nosmaps.catalog+json\",\"entry_count\":317,\"generated_at\":1786895900,\"previous\":{\"generation\":41,\"pointer_id\":\"<previous-pointer-event-id>\",\"sha256\":\"<previous-blob-sha256>\"},\"mirrors\":[\"https://blossom-a.example/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json\",\"https://blossom-b.example/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json\"]}"
}
```

Validation:

1. valid Nostr id/signature, trusted curator, exact stable `d`, schema/version `1`;
2. closed `state` enum `active | withdrawn`; one lowercase 64-hex hash; integer `bytes`, `entry_count`, `generation`, and `generated_at`; allowed MIME exactly `application/vnd.nosmaps.catalog+json`;
3. HTTPS mirror origins/URLs only, no credentials/fragments, at most 8, each path hash equal to `x`;
4. content is strict canonical JSON and tag/content equality holds for duplicated committed fields, including ordered mirror URLs after URL normalization;
5. `previous` is mandatory and nullable only for generation `0`; otherwise it has generation, prior pointer id, and prior hash;
6. with retained verified local history, a newly signed pointer MUST increase generation and `previous` MUST match the previously accepted pointer; retransmission of the identical already-signed pointer event/id is not a new generation. A fresh client cannot prove the whole chain and labels it `chain-unverified`, without inventing global history;
7. normal addressable winner rules choose among observed pointer events. A higher `generation` does not override a newer NIP-01 winner by itself.

### 3.3 Canonical manifest blob

The blob is strict RFC 8785 JSON Canonicalization Scheme output encoded as UTF-8, with no BOM. Parser rejects duplicate keys, invalid Unicode, non-integer numbers, unsafe integers, and noncanonical bytes. SHA-256 is computed over the exact canonical UTF-8 bytes returned by HTTP.

```json
{
  "schema": "org.nosmaps.catalog",
  "version": 1,
  "scope": "global",
  "curator": "<trusted-curator-hex>",
  "generation": 42,
  "generated_at": 1786895900,
  "previous": {
    "generation": 41,
    "pointer_id": "<previous-pointer-event-id>",
    "sha256": "<previous-blob-sha256>"
  },
  "entries": [
    {
      "coordinate": "32267:<publisher-hex>:com.example.tool",
      "state": "active",
      "event_id": "<expected-observed-record-id-or-null>",
      "fields": {
        "name": "Example Tool",
        "category": "relay-client"
      }
    },
    {
      "coordinate": "32267:<publisher-hex>:org.example.retired",
      "state": "withdrawn",
      "event_id": null,
      "fields": {}
    }
  ]
}
```

Normative rules:

- top-level keys are exact; unknown keys are rejected for major version 1;
- `curator`, `scope`, `generation`, `generated_at`, and `previous` equal the pointer commitments;
- `entries` are sorted by Unicode-code-point order of `coordinate`, unique, and count equals `entry_count`;
- each entry has only `coordinate`, `state`, `event_id`, `fields`; state is `active | withdrawn`;
- `event_id` is null or lowercase 64-hex. It is an exact preferred source id, not a proof that every relay has it;
- `fields` is curator-local display metadata with provenance. Allowed v1 keys are `name`, `summary`, `category`, `homepage`, each bounded by §7; unknown keys reject the blob;
- active and withdrawn entries are retained explicitly in the current snapshot. Absence means “this curator makes no current statement,” not a universal deletion;
- maximum accepted blob bytes is an app policy and MUST also fit every selected Blossom write server's observed upload policy. There is no relay event-size coupling because entries are not in the pointer.

### 3.4 Cold fetch, verification, and mirror fallback

1. Send one pointer REQ to each configured relay. MVP permits at most `MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ=8` enabled curators and uses one exact `{kind, author, #d, limit}` filter per curator inside that REQ, avoiding one curator consuming another's limit. The serialized REQ must fit §11; configuration beyond the cap is rejected until a revised multi-REQ budget is accepted. EOSE/timeout/absence is tracked per relay and curator; absence is only an observation from that relay, not proof of global nonexistence.
2. Union valid events and select one pointer winner per curator deterministically.
3. For each changed winner, try signed mirror hints in order, deduplicated by origin, then configured user fallback origins, up to `MAX_MIRROR_ATTEMPTS` total. Cold fetch uses an anonymous, unauthenticated `GET /<sha256>` and MUST succeed without a signer; BUD-11-authenticated mirrors are optional hints only and are skipped when they do not permit this public read.
4. For each HTTP attempt enforce timeout, redirect count, maximum bytes, and final URL hash preservation. Stream bytes while hashing; abort above signed size.
5. Require HTTP success, exact signed byte count, exact SHA-256, canonical bytes, allowed MIME declared by pointer, and valid schema/count. HTTP `Content-Type` is checked when present; `application/octet-stream` is tolerated only as a BUD-01 transport fallback because the signed pointer MIME and schema/hash remain authoritative.
6. First fully verified blob wins for that pointer. Mirror disagreement cannot alter content because the signed hash is fixed.
7. If all mirrors fail or mismatch: show the last verified generation for that curator as `stale` if available; otherwise mark that curator `incomplete/unavailable`. Never parse or list from unverified bytes.

Non-compiling TypeScript pseudocode:

```ts
async function fetchVerifiedManifest(pointer, policy, cached) {
  validatePointer(pointer)
  const urls = boundedMirrorUrls(pointer, policy.maxMirrorAttempts)
  const failures = []

  for (const url of urls) {
    try {
      const response = await fetchWithTimeoutAndSafeRedirects(url)
      if (!response.ok) throw new Error(`http:${response.status}`)
      const bytes = await readExactlyAtMost(response.body, pointer.bytes)
      if (bytes.length !== pointer.bytes) throw new Error("size")
      if (hex(await sha256(bytes)) !== pointer.sha256) throw new Error("hash")
      const value = parseStrictJson(bytes)
      if (!isRfc8785Canonical(bytes, value)) throw new Error("noncanonical")
      validateCatalogSchema(value, pointer)
      return { status: "fresh", value, pointer, verifiedAt: now(), url, failures }
    } catch (error) {
      failures.push(redactedHttpFailure(url, error))
    }
  }

  if (cached?.verified) return { ...cached, status: "stale", failures }
  return { status: "unavailable", pointer, failures }
}
```

### 3.5 Publish and mirror protocol

Curator publication is ordered so no pointer commits to an unavailable blob:

1. construct and schema-validate the manifest; serialize canonical bytes; compute SHA-256 and byte count;
2. optionally `HEAD /upload` using BUD-06 metadata. If authorization is required, author and locally validate a kind `24242` token with `content:"Upload Nosmaps catalog manifest"`, `t=upload`, future `expiration`, matching lowercase `x`, optional matching `["server","lowercase.domain"]`, valid id/signature, and past `created_at`, then send `Authorization: Nostr <base64url-event>`; a refusal is server policy, not blob invalidity;
3. for `PUT /upload` to the primary target, author and locally validate the same upload-token contract when BUD-11 auth is required, encode the complete signed event as unpadded Base64url, send the Nostr authorization header, and validate descriptor hash/size/type;
4. upload exact bytes independently to other targets or request BUD-04 `PUT /mirror` from a verified source. For each auth-required mirror request, author and locally validate a kind `24242` token with `content:"Mirror Nosmaps catalog manifest"`, BUD-11 action `t=upload`, future `expiration`, the imported blob's matching lowercase `x`, optional matching domain-only `server`, valid id/signature, and past `created_at`; send the same header form and validate each descriptor;
5. for every target counted toward manifest availability quorum, issue an anonymous request with no `Authorization` header and require successful unauthenticated public `GET /<sha256>`, exact length, and downloaded hash. `HEAD` is advisory only. A BUD-11-authenticated GET mirror MAY be retained as an additional hint, but MUST NOT count toward quorum or be the only stored copy;
6. require configured Blossom quorum, default `2` verified servers. Record per-server preflight, upload/mirror, visibility, hash, status, and redacted `X-Reason` diagnostics;
7. only then sign/publish the small pointer. Require configured relay publish quorum, default `1`, based on positive `OK`, then read the exact pointer id back from at least one configured relay. Record per-relay AUTH, rejection, timeout, OK, and read-back result;
8. a failed mirror or relay is not evidence that the content is invalid. After a send timeout or partial relay failure, retry the identical already-signed pointer EVENT with the same event id on additional relays, then repeat exact-id read-back; do not re-sign or change any field. If a new signed pointer event is required, first construct and publish a new canonical manifest generation whose `generation` increases and whose `previous` commits to the prior pointer id/hash, upload and verify its new blob/hash, then sign/publish that new pointer. A newly signed event with the same hash and generation is invalid retry behavior.

Blossom upload/size policy and relay pointer message limits are separate constraints. Pointer validation sets a conservative local maximum (for example 8 KiB serialized EVENT message), then lowers it to the minimum observed write-relay `max_message_length`; the manifest blob instead obeys each Blossom server's upload response/policy.

## 4. AP catalog state, deletion, cache wipe, and partitions

### 4.1 CAP choice and exact guarantee

Under relay/network partition, availability is preferred over global consistency. The client guarantees only:

> For each trusted curator and coordinate, the displayed state is derived deterministically from valid pointers, verified blobs, record events, and deletion requests actually observed from the configured relay set by the shown as-of time.

It does not guarantee that an unobserved newer pointer/event/deletion does not exist. UI diagnostics SHOULD expose:

- configured relays and per-relay coverage;
- curator pubkey, pointer id, `generation`, pointer `created_at`, `generated_at`, blob hash;
- blob source and `last_verified_at`;
- latest record winner id/time and its observed relays;
- `fresh | stale | incomplete | unavailable | quarantined`.

### 4.2 Logical withdrawal and NIP-09

Catalog state uses two reconstructable inputs:

1. curator snapshot entry state `active | withdrawn` from the latest observed verified manifest;
2. current observed `32267` record winner state `active | withdrawn`.

A coordinate is listable only if at least one trusted curator has a verified active entry and the selected record winner is active. A manifest withdrawal suppresses that curator's older active snapshots. A record withdrawal suppresses all listings of that exact coordinate until a later valid record winner reactivates it.

NIP-09 kind 5 remains supported as best-effort cleanup/privacy request:

- validate signature and same-author rules;
- an `e` request covers the named event; an `a` request covers versions of the address up to the deletion request timestamp, as defined by NIP-09;
- union all valid deletion requests actually observed on configured relays and suppress covered versions before winner selection;
- never describe deletion as erasure, and never require historical kind 5 availability to rebuild catalog truth;
- no local deletion cursor or “complete deletion ledger” is part of correctness;
- deletion cleanup is bounded two-phase when target ids/authors are discovered by a query: round 1 coalesces target events; round 2 is at most one cleanup REQ per relay containing the newly learned exact `e` ids/address coordinates and matching target authors. Merge the observed deletion union before final display, or label round-1 output provisional/incomplete. Exact ids/coordinates already known before round 1 MAY be queried there. Per-card/per-event cleanup is forbidden.

For long-lived logical removal, authors MUST publish `state:"withdrawn"`; curators MUST publish withdrawn snapshot entries when they want their prior listing explicitly suppressed. Kind 5 may accompany those writes but cannot replace them.

### 4.3 Empty-cache rebuild

After IndexedDB is cleared:

1. fetch pointer winners from every configured relay and record coverage;
2. fetch/verify current blobs over Blossom HTTP;
3. pure-merge curator snapshots;
4. fetch referenced `32267` exact event ids where present, plus author-grouped exact coordinates to discover newer winners. Exact target ids/coordinates and authors known from the manifest MAY include matching kind 5 filters in this first coalesced dependency round;
5. for event classes whose ids/authors are learned only from that result (including observation/evidence and later review/reaction rounds), issue at most one second coalesced cleanup REQ per relay for the newly learned exact `e` ids/coordinates and matching target authors, merge observed deletions, then validate/reduce/finalize. Until that cleanup completes, results are provisional/incomplete rather than deletion-final;
6. mark incomplete dependencies/relays. Do not substitute an old unverified relay event for a missing blob;
7. start Forward subscriptions only after mandatory gap handling (§9).

If a newer pointer or record winner becomes observable after partition repair, the next gap/query round deterministically replaces the older winner and clients eventually converge, assuming they later observe the same valid set. Strong convergence while partitions persist and complete global erasure are explicit non-goals.

### 4.4 Checkable invariants and partition examples

Invariants:

- **I1 Hash safety:** no entry affects catalog state until its entire blob matches signed size/hash/schema.
- **I2 Curator locality:** withdrawal by curator A removes A's endorsement only; it cannot forge B's state.
- **I3 Record withdrawal:** an observed newer valid withdrawn record beats an older active version at the same coordinate.
- **I4 Determinism:** identical validated observed inputs produce byte-identical merged output, independent of arrival order.
- **I5 Honest freshness:** missing current blob, insufficient relay coverage, or threshold expiry produces `stale/incomplete`, never “latest”.
- **I6 Eventual update:** when two clients later observe the same pointer/blob/event/deletion set, they select the same winners and merge result.

Partition A — newest withdrawal hidden:

- relay R1 has pointer generation 42 with coordinate X withdrawn; R2 only has generation 41 active.
- client seeing only R2 may display X as `stale/incomplete` if cached/freshness policy permits, but MUST NOT call it globally active/latest.
- after R1 becomes observable and generation 42 blob verifies, X is suppressed for that curator.

Partition B — old record survives elsewhere:

- R1 has newer `32267 X state=withdrawn`; R2 retains older active X.
- a client observing both selects withdrawn and suppresses X. A client partitioned to R2 may temporarily show old X with limited coverage.
- after observing R1's winner, it converges to withdrawn. Historical kind 5 availability is irrelevant.

Partition C — curator conflict:

- curator A lists X active with name Alpha; curator B lists X withdrawn and name Beta.
- because one trusted curator is active and record X is active, X remains listed, with endorsement count 1, active/withdrawn conflict, and field provenance. Arrival order cannot choose Alpha or Beta silently.

## 5. Deterministic multi-curator merge and recommendation count

### 5.1 Curator-local validation

For each trusted curator independently:

1. choose observed pointer winner;
2. verify exactly its committed blob or use a previously verified blob only as stale fallback;
3. map each unique coordinate to curator-local `active | withdrawn` and fields;
4. quarantine malformed, regressing cached-chain, missing-blob, or expired-stale inputs according to local policy;
5. key removal from the trusted set immediately excludes that curator from new merged output; cached data may remain only in audit storage, not listing. Rotation adds a new independent key; it does not transfer authority unless the local trust configuration explicitly maps it.

### 5.2 Pure merge

Input is sorted by curator hex, then coordinate. For each coordinate:

- pointers with `state=withdrawn` contribute no active entries; their verified blob may be retained only for audit/stale history;
- `activeCurators`: fresh/stale-allowed curator snapshots saying active;
- `withdrawnCurators`: snapshots saying withdrawn;
- `listingEligible`: `activeCurators.length >= 1` AND selected `32267` winner is active;
- `status`: conflict if both sets are nonempty, record is missing/withdrawn while a curator is active, or validated fields disagree;
- fields retain `(value, curator, generation, blobHash)` provenance. UI may choose a deterministic display value by curator trust-priority then pubkey, but MUST expose disagreement;
- stale curator snapshots may be displayed and optionally used under the explicit local stale policy, but their contribution is marked stale. Quarantined/unavailable snapshots do not count;
- removal/eviction: when no active curator remains, remove from normal listings after the merge; retain minimal audit/cache metadata under cache retention policy.

Recommendation count is separate. Kind `30267` is used only as a NIP-51 App curation set: one author-grouped dependency round per relay fetches the trusted curators’ current sets (or exact locally selected `d` values), then selects the current observed valid winner for each set coordinate `(30267, curator, d)`, applies observed deletion to the set event, and reads exact software-application `a` tags as members. For each tool coordinate, count a curator at most once when that tool is a member of one or more selected current set winners for that curator. Withdrawal removes the member `a` tag in the next version of that set; it is not a per-tool `state` record. A manifest entry never increments this count, and manifest `active | withdrawn` controls catalog inclusion rather than set membership.

## 6. Coordinate migration authority

Only a newer valid `32267` winner at the **old coordinate**, signed by the same publisher key as that coordinate, may authoritatively set `superseded_by` to another valid `32267` coordinate. The field is optional and only effective when the old winner is `state:"withdrawn"` or explicitly marks migration.

Rules:

1. parse exact destination coordinate; self-loop invalid;
2. follow at most `MAX_MIGRATION_DEPTH=8`;
3. detect repeated coordinates; any cycle quarantines the redirect chain and leaves coordinates distinct;
4. one addressable winner has one destination. Conflicting older destinations lose by winner selection but remain audit evidence;
5. if the authoritative old winner is deleted and no newer valid old-coordinate winner remains, its redirect is not authoritative;
6. destination missing/withdrawn leaves a visible “migration target unavailable” state; it does not reactivate the old record;
7. arbitrary `30371 supersedes` relations are evidence only. Trusted curator mappings are curator-scoped recommendations and cannot globally redirect identity;
8. UI shows old and new coordinates, signer, winner id/time, chain, and conflict/quarantine status.

## 7. Candidate-kind normative schema contract

### 7.1 Common envelope, grammar, limits, and canonical inputs

All candidate kinds `30367`–`30372` MUST have:

- valid Nostr signature/id; one `d`; `L=org.nosmaps.schema`; one `l=<type>,org.nosmaps.schema`; JSON-object content;
- top-level `schema`, integer `version`, `state`; unknown major versions are stored/quarantined and not interpreted;
- unknown content fields rejected in v1; unknown noncritical tags retained but ignored unless prohibited by the kind contract;
- UTF-8 strings normalized to NFC before authoring. Validators reject control characters except JSON whitespace escapes;
- `d` ASCII grammar `[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?`, maximum **192 UTF-8 bytes**; kind-specific grammar is narrower. Authors and validators measure encoded UTF-8 bytes, MUST NOT truncate, and reject an over-limit event before signing/publication;
- content maximum 16,384 UTF-8 bytes, 128 tags, 256 bytes/tag element, arrays maximum 128 unless narrower below. Actual publication is further limited by live relay policy;
- enums are closed and case-sensitive; `state` is `active | withdrawn`;
- canonical object/hash inputs use RFC 8785 UTF-8 bytes. SHA-256 output is lowercase hex. Nostr event id remains NIP-01 serialization, not JCS;
- `L/l` only aids indexing. `schema` + `version` governs validation.

Candidate `d` byte budgets are closed as follows; every listed component is lowercase ASCII, so its byte count is its character count. `sha256` means 64 lowercase hex bytes.

| kind | normative `d` grammar | component maxima (bytes) | maximum bytes |
|---:|---|---|---:|
| `30367` | `nosmaps:catalog:v1:<scope>` | prefix `19` + scope `64` | `83` |
| `30368` | `taxonomy:<namespace>:<term>` | prefix `9` + namespace `64` + separator `1` + term `64` | `138` |
| `30369` | `conformance:<tool-sha256>:<feature-key>` | prefix `12` + sha256 `64` + separator `1` + feature key `115` | `192` |
| `30370` | `observation:<subject-sha256>:<type-key>:<nonce>` | prefix `12` + sha256 `64` + separator `1` + type key `98` + separator `1` + nonce `16` | `192` |
| `30371` | `evidence:<subject-sha256>:<relation>:<nonce>` | prefix `9` + sha256 `64` + separator `1` + relation `11` + separator `1` + nonce `32` | `118` |
| `30372` | `review:<tool-sha256>` | prefix `7` + sha256 `64` | `71` |

For variable identifiers in `30369` and `30370`, the content keeps the complete NFC source value. Derive `<feature-key>` or `<type-key>` deterministically: use the source unchanged only when it is already a lowercase ASCII slug matching `[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?` and fits the per-kind byte maximum; otherwise use `sha256-<64hex>`, where the hash input is the exact RFC-8785 serialization of the NFC-normalized JSON string value, encoded as UTF-8. No locale case-folding or lossy transliteration is allowed. `30370` nonce is exactly 16 lowercase base32 characters; `30371` nonce is 8–32 lowercase base32 characters. Full unhashed source values remain in content.

Migration on later registry collision: stop publishing the collided candidate kind, define a new major/kind with an explicit converter, preserve old events as legacy inputs, and never reinterpret old content under a third party's schema.

### 7.2 `30367` catalog pointer

Contract is §3. Required fields: `schema=org.nosmaps.catalog-pointer`, `version=1`, `state`, `scope`, `generation`, `sha256`, `bytes`, `mime`, `entry_count`, `generated_at`, `previous`, `mirrors`; unknown fields rejected. `d=nosmaps:catalog:v1:<scope>`.

### 7.3 `30368` taxonomy

- `d=taxonomy:<namespace>:<term>`; namespace and term each 1–64 lowercase ASCII `[a-z0-9._-]+`.
- required: `schema=org.nosmaps.taxonomy`, `version=1`, `state`, `namespace`, `term`, `label`.
- optional: `description`, `parent` exact taxonomy coordinate.
- label max 80 chars; description max 500; parent cannot self-reference. Cycles are displayed as invalid taxonomy edges.

### 7.4 `30369` conformance claim

- `d=conformance:<tool-coordinate-sha256>:<feature-key>`; hash the exact UTF-8 bytes of the canonical `32267:<publisher-hex>:<d>` coordinate, and derive the feature key by §7.1.
- required: `schema=org.nosmaps.conformance`, `version=1`, `state`, `tool`, `feature`, `result`, `environment_hash`.
- `tool` is one canonical software coordinate and the event MUST contain exactly one `["a", "32267:<publisher>:<d>"]` whose value equals content `tool` byte-for-byte. A mismatch, missing tag, duplicate differing tool tag, or noncanonical coordinate fails schema validation.
- `feature` is the complete NFC feature identifier, maximum 512 UTF-8 bytes; reverse-DNS ASCII plus version remains recommended, e.g. `org.nosmaps.nip.65-v1`. The `d` uses its bounded feature key, never truncation.
- `result`: `pass | fail | partial | unknown`; optional `evidence` array of at most 32 `30371` coordinates.
- environment hash input is canonical JSON of `{runtime, runtime_version, os, arch, dependency_lock_hash, config_hash}`, all required strings, where absent facts use `"unknown"`; hash exact JCS bytes.

### 7.5 `30370` observation

- `d=observation:<subject-hash>:<type-key>:<nonce>`; hash the exact RFC-8785 UTF-8 serialization of the NFC `subject` string, derive the type key by §7.1, and use an exactly 16-character lowercase base32 nonce.
- required: `schema=org.nosmaps.observation`, `version=1`, `state`, `subject`, `observation_type`, `observed_at`, `value`; optional `tool`.
- `subject` uses §7.6 syntax; `observation_type` is the complete NFC identifier, maximum 512 UTF-8 bytes; `observed_at` is an integer; value is a scalar or object up to 4 KiB canonical bytes.
- If `subject` is an `address:32267:<publisher>:<d>`, content `tool` is required and MUST equal that embedded coordinate. Any observation intended for a tool detail/comparison, whether tool-primary or merely tool-related, MUST carry content `tool` and exactly one matching canonical `["a", "32267:<publisher>:<d>"]`. Missing/mismatched tags fail validation; observations without a tool index are outside standard tool-detail retrieval.
- optional `environment_hash`; if present it follows §7.4.

### 7.6 `30371` evidence relation

- `d=evidence:<sha256(canonical-subject)>:<relation>:<nonce>`; hash the exact RFC-8785 UTF-8 serialization of the NFC `subject` string; nonce is lowercase base32 8–32 characters.
- required: `schema=org.nosmaps.evidence`, `version=1`, `state`, `subject`, `relation`, `object`; optional `tools`.
- subject grammar is exactly one of `event:<64hex>`, `address:<kind>:<64hex>:<d>`, `url:<absolute-https-url>`, `sha256:<64hex>`.
- relation closed enum v1: `supports | contradicts | documents | reproduces | supersedes`.
- object is the same subject grammar; optional `summary` max 500. `tools`, when present, is a sorted unique array of at most 16 canonical `32267` coordinates. If either `subject` or `object` is an `address:32267:<publisher>:<d>`, that embedded coordinate MUST occur in `tools`. The set of software-coordinate `a` tags MUST equal `tools` exactly, so tool-primary as well as tool-related evidence always carries the exact indexed tool tag.
- A `30371` is eligible for a selected tool's detail/comparison only when that exact tool coordinate occurs in both content `tools` and `["a", <coordinate>]`, even when the primary subject is an event, URL, or hash. Evidence with no related tool index is outside standard tool-detail retrieval; clients MUST NOT broad-scan kinds to find it.
- `supersedes` is evidence only and has no coordinate-migration authority (§6).

### 7.7 `30372` review

- `d=review:<sha256(tool-coordinate)>`; hash the exact UTF-8 bytes of the canonical `32267:<publisher-hex>:<d>` coordinate, therefore one replacement unit per reviewer/tool.
- required: `schema=org.nosmaps.review`, `version=1`, `state`, `tool`, `rating`, `body`.
- rating integer `1..5`; body max 8,000 chars; optional `evidence` max 16 exact event ids/addresses.
- `withdrawn` uses rating `1` and empty body solely to keep v1 shape stable; UI excludes it from aggregates.
- tool coordinate and `a` tag MUST agree. The current review winner id is the reaction/comment target.

### 7.8 `30267` App curation sets and `32267` tool fields used here

Although outside the candidate range, interoperability requires these local contracts:

- `30267` follows NIP-51 App curation set semantics. Each curator chooses a stable nonempty `d` that identifies a set; the selected addressable winner is the whole current set. Members are exact software-application `a` tags (`32267:<publisher-hex>:<d>`). The MVP defines no custom JSON schema, per-tool `d`, per-tool `state`, or reason field for this kind. To withdraw a recommendation, publish a new version of the same set without that member. Multiple selected sets from one curator are unioned for membership but count that curator only once per tool.
- `32267 d` max 192 ASCII with reverse-DNS recommended but not ownership proof; content requires `{schema:"org.nosmaps.software",version:1,state,name,summary,homepage?,superseded_by?}`; name max 120, summary max 1,000, homepage HTTPS max 2,048. Unknown fields rejected in the Nosmaps v1 profile.

## 8. Winner-before-display pagination, reactions, and future timestamps

### 8.1 Review pagination without NIP-67 dependency

Pipeline order is mandatory:

1. fetch raw `30372` events using exact tool `#a`, overfetching `RAW_LIMIT = min(relay max_limit, max(60, desiredUnique*3))`;
2. validate signatures/schema/time and collect exact review ids/authors. If exact ids were not known before this page, issue at most one coalesced kind-5 cleanup REQ per relay for those ids/coordinates and matching authors; merge observed deletions, then group by `(reviewer pubkey,d)` and select the addressable winner. The page MAY be shown only as provisional/incomplete before cleanup finalizes;
3. exclude withdrawn winners; order unique winners by `(created_at DESC, id ASC)`; only then form the page and aggregate ratings;
4. if fewer unique winners than requested, issue another Backward page per relay with inclusive `until=oldestCreatedAt` and maintain that relay's `boundaryIds` for the timestamp;
5. same-timestamp events are accumulated/deduped until the relay advances below the boundary. If the boundary reaches the configured raw-event/byte/page cap, stop and mark `incomplete: boundary-saturated` rather than skipping or looping;
6. a replacement observed later recomputes the winner and may move/remove a row. One user contributes at most one current active review per tool;
7. relay timeout/down/auth/rejection means incomplete. An empty page proves only “no more events returned in this round,” not global completeness.

MVP ignores NIP-67 `EOSE` `more/finish` hints because rx-nostr 3.7.5 Backward completion does not directly expose a correlated per-relay hint through the high-level path used here. A future raw-message correlation layer may adopt it after separate tests.

### 8.2 Reaction reduction

For NIP-25 kind `7`, target is the exact `e` event id. First fetch reactions for the coalesced target ids; then issue at most one coalesced kind-5 cleanup REQ per relay for newly learned exact reaction ids/coordinates and matching reactor authors, merge observed deletions, and select the latest non-deleted event per `(reactor pubkey, target event id)` by greatest `created_at`, lowest id tie-break. The panel is provisional/incomplete until cleanup finalizes. This is one bounded follow-up, not an N+1 request per reaction.

Normalize selected content:

- `+` and empty content -> `positive`;
- `-` -> `negative`;
- any single valid Unicode emoji grapheme -> normalized NFC emoji bucket;
- other content -> `other`, shown but not included in positive/negative totals.

A newer selected `-` replaces that user's earlier `+`; it does not add both. Reactions to old addressable event ids remain attached to that historical version and do not transfer to the replacement winner. UI labels counts as “observed on configured relays,” not universal totals.

### 8.3 Future timestamp quarantine

On first receipt record local `received_at`, source relay, and that relay's observed NIP-11 `created_at_upper_limit` if present.

An event is winner-eligible only when:

```text
created_at <= min(received_at + MAX_FUTURE_SKEW,
                  relay_upper_limit_if_known_or_infinity)
```

Otherwise cache only quarantine metadata/bytes, never publish it onward automatically, and show clock-skew diagnostics. If `created_at > received_at + MAX_FUTURE_HORIZON`, evict/quarantine permanently under cache policy until explicitly re-fetched; it cannot silently activate.

Reevaluate on app startup, foreground/resume, system clock change, relay-info refresh, new event at the coordinate, and a timer scheduled for the earliest eligibility instant. Revalidation uses the original `received_at` and frozen policy version, so advancing `now` alone does not rewrite receipt history. If it becomes eligible within the horizon, rerun deletion and winner selection. Tests freeze wall clock and receipt times.

## 9. Screen dependency graph, filters, and reconnect recovery

### 9.1 Dependency graph and cache/lazy rules

| screen/action | immediate dependencies | cache prerequisite / lazy dependencies |
|---|---|---|
| cold catalog | pointer winners; verified manifest blobs; referenced `32267` winners; current `30267` App curation set winners coalesced by trusted curator | taxonomy labels may use cache; profiles/reviews/reactions/media lazy |
| search/filter | local verified merged catalog only | no network |
| tool detail shell | round 1: exact tool event id(s), author-grouped winner fallback, plus one coalesced `{"kinds":[30369,30370,30371],"#a":[selectedToolCoordinates]}` logical filter; round 2: at most one coalesced kind-5 cleanup REQ per relay | cached catalog and passing candidate-kind/`#a` probe required; failures are excluded/incomplete; caps apply; unrelated evidence is not fetched; other tabs/components stay lazy |
| comparison | union selected coordinates in the same exact coalesced `#a` filter and tool-winner filters, with the same single cleanup follow-up bound | same probes/caps/lazy tabs; no per-tool or per-card N+1 |
| review tab | round 1: `30372` pages; round 2: at most one coalesced kind-5 cleanup REQ per relay for newly learned review ids/coordinates and authors | reactions to current review ids lazy/coalesced |
| profile popover | exact author kind `0` | zero REQ until opened |
| reaction panel | round 1: kind `7` exact target ids; round 2: at most one coalesced kind-5 cleanup REQ per relay for newly learned reaction ids/coordinates and authors | zero REQ until opened |
| bookmark edit | cross-relay `10003` winner collection, then publish/read-back | decrypted only in transient memory |

Exact manifest `event_id` filters are preferred. To find newer tool winners, group `#d` by author in separate OR filters:

```json
[
  {"kinds":[32267],"authors":["publisher-A"],"#d":["tool-a","tool-b"],"limit":8},
  {"kinds":[32267],"authors":["publisher-B"],"#d":["tool-c"],"limit":4}
]
```

The same detail/comparison target round MUST include one author-independent logical filter for all selected canonical tool coordinates:

```json
{"kinds":[30369,30370,30371],"#a":["32267:<publisher-A>:tool-a","32267:<publisher-B>:tool-c"],"limit":500}
```

`limit` is lowered to the relay's observed `max_limit`; selected coordinates are deduplicated and split only by §11 byte/array/filter limits. Backward pagination remains inclusive and stops at `MAX_DETAIL_RAW_EVENTS_PER_RELAY`, `MAX_DETAIL_BYTES_PER_RELAY`, or `MAX_DETAIL_PAGES_PER_RELAY`, marking `incomplete: detail-cap` rather than scanning beyond the bound. For each returned event, validate the §7 content/tag equality before winner selection and discard unrelated/malformed rows. The logical query is coalesced across every selected tool; it MUST NOT become one REQ per tool.

NIP-01 permits querying indexed single-letter tags such as `#a`, but each configured relay's candidate-kind acceptance and generic `#a` indexing MUST be live-probed immediately before implementation. If either probe fails for `30369`–`30371`, exclude that relay from those detail dependencies and mark its coverage `incomplete: candidate-kind-or-a-index-unsupported`; continue only with passing configured relays. Broad kind scans, arbitrary author discovery, and a central index/backend fallback are prohibited.

Never put unrelated author and `#d` arrays into one Cartesian-product filter with a low limit. Filter sets are coalesced across components, deduped, byte-chunked, and lazy tabs issue zero REQs before open. Acceptance captures serialized outbound REQ traces and asserts exact logical/physical counts.

### 9.2 Mandatory gap query

Maintain high-water per `(relay, scopeKey)`:

```text
scopeKey = hash(canonical filter semantics excluding since/until/limit)
highWater = { created_at, boundaryIdsAtCreatedAt }
```

After initial Backward completion, Forward may start. On **every** disconnect/reconnect, relay recovery, app resume after connection loss, or filter-scope change:

1. pause/replace affected Forward subscription;
2. issue mandatory Backward gap query with inclusive `since = prior highWater.created_at` for old scope; a broadened/new scope also performs an initial Backward query for newly included coordinates/authors;
3. track EOSE/timeout per relay, merge/dedupe all events, and exhaust or mark same-timestamp boundary incomplete using §8.1 caps;
4. update high-water only from accepted events after the gap result is merged; preserve boundary ids;
5. start new Forward subscription, again with inclusive `since=highWater.created_at`, dedupe boundary ids;
6. timeout/auth/down leaves relay/scope incomplete and schedules retry. There is no fixed five-second overlap.

Each affected relay/scope gap query is charged in the reconnect Nostr budget.

### 9.3 rx-nostr 3.7.5 non-compiling pseudocode

```ts
// Pseudocode only. Import/API integration and DOM/window.nostr augmentation are unverified here.
import { verifier } from "@rx-nostr/crypto"

const pool = createRxNostr({ verifier })
pool.setDefaultRelays(["wss://x.kojira.io", "wss://nos.lol"])

// backwardPerRelay, byteChunk, validateDeleteReduce, startForward, and markIncomplete are app-owned pseudocode helpers.
async function recoverGap(relay, scope) {
  const hw = await cache.highWater(relay, scope.key)
  const filters = byteChunk(scope.filters.map(f => ({ ...f, since: hw.created_at })))
  const packets = await backwardPerRelay(relay, filters) // records EOSE/timeout itself
  const merged = validateDeleteReduce(packets.events, hw.boundaryIdsAtCreatedAt)
  await cache.atomicMergeAndAdvance(relay, scope.key, merged, packets.coverage)
  if (packets.coverage === "eose") startForward(relay, scope, merged.highWater)
  else markIncomplete(relay, scope.key)
}
```

NIP-42 AUTH, candidate-kind acceptance, generic `#d/#a/#A` indexing, and message limits are not assumed by the pseudocode; implementation preflight probes them. Detail scheduling is likewise app-owned pseudocode:

```ts
async function fetchToolDetail(relay, selectedToolCoordinates) {
  if (!liveProbe.accepts30369To30371(relay) || !liveProbe.indexesGenericA(relay)) {
    return markIncomplete(relay, "candidate-kind-or-a-index-unsupported")
  }
  const targetFilters = coalesceAndByteChunk([
    ...exactToolWinnerFilters(selectedToolCoordinates),
    { kinds: [30369, 30370, 30371], "#a": dedupe(selectedToolCoordinates), limit: detailLimit(relay) },
  ])
  const target = await backwardPerRelayBounded(relay, targetFilters, DETAIL_CAPS)
  const valid = target.events.filter(validateCandidateContentTagEquality)
  return validateDeleteReduce(valid, { maxCleanupReqs: 1 })
}
```

## 10. Private bookmark winner and concurrent edit protocol

### 10.1 Read-modify-write

Kind `10003` is one normal replaceable list per user. Private bookmark read/edit/publish is enabled only when the active signer exposes both `nip44.encrypt` and `nip44.decrypt`. If either capability is absent, all three operations are disabled and the UI says: “Private bookmarks require NIP-44 encrypt and decrypt from the active signer.” No plaintext, public-tag, or empty-content downgrade is permitted. Existing ciphertext that cannot be decrypted and merged blocks every write; byte-for-byte retention alone MUST NOT be described as a successful read or merge.

When both capabilities are present, before editing:

1. query every configured user read/write relay for kind `10003`, author=self, with enough history to collect each relay's reported candidate; do not independently accept each relay's `limit:1` as global truth;
2. validate/decrypt candidates, then choose winner by greatest `created_at`, lowest id tie-break. Record divergent relay winners;
3. decrypt private tags in transient memory, apply edit, preserve unknown valid entries, and choose `created_at = max(now, prior.created_at + 1)` only if it does not exceed the minimum known write-relay `created_at_upper_limit`; otherwise wait/report clock conflict rather than forge farther future time;
4. immediately before signing, reread winners. If base id changed, merge set-like independent bookmark additions/removals, surface non-mergeable metadata conflicts, and retry up to 3 times;
5. publish to write relays, record each `OK`, then read back exact id and recompute winner from all relays;
6. if another winner replaced it, merge/retry. On exhaustion show a conflict with both versions and never claim success.

Kind `10003` cannot guarantee a lossless merge for truly simultaneous same-field edits or same-second disconnected devices. The protocol only detects/retries observable conflicts; users may need manual resolution.

### 10.2 Encryption and plaintext handling

Private tags use the applicable NIP-44/NIP-51 self-encryption format. The client MUST call both active-signer capabilities successfully before enabling the read-modify-write flow. Decrypt failure or capability loss disables edit/publish and preserves the last signed event unchanged; it never republishes unreadable ciphertext as though merged. Private relay hints are included only with explicit user acceptance that metadata is inside ciphertext but still persists in signed events.

Decrypted plaintext, keys, full ciphertext, and private tags MUST NOT enter logs, analytics, crash reports, Redux/devtools snapshots, or persistent debug traces. Keep plaintext in the shortest-lived mutable buffers practical; overwrite mutable byte arrays on completion/error where the runtime permits, drop references in `finally`, and document that JavaScript garbage collection prevents guaranteed zeroization.

Tests cover concurrent devices, same-second tie, read-back failure, retry exhaustion, decrypt failure, relay divergence, upper-limit refusal, and log redaction. Capability tests assert: missing encrypt, missing decrypt, or both missing disables read/edit/publish with the capability message; no public/plaintext downgrade occurs; and unreadable existing ciphertext prevents signing or EVENT publication.

## 11. NIP-11 limits, byte-aware REQs, and publication constraints

### 11.1 Current NIP-11 handling

Current NIP-11 has no standard `max_filters`. `MAX_FILTERS_PER_REQ` is app-owned compatibility policy only.

Read and apply, when present:

- `max_message_length` to the serialized UTF-8 JSON message, not character count;
- `max_subscriptions` to concurrent active REQs;
- `max_limit` to each filter's `limit`;
- `max_subid_length` to generated subscription ids;
- `max_event_tags` and `max_content_length` to publication validation;
- time bounds including `created_at_upper_limit` where advertised.

Absent/malformed values use conservative app fallbacks and are labeled assumed. Independently cap ids/authors/tag-value arrays at `MAX_ARRAY_ITEMS_PER_FILTER`, then serialize the full `["REQ",subId,...filters]` and split until both filter count and byte length fit. A single oversized filter is split by its largest array. If a scalar-only filter cannot fit, fail visibly.

For review, reaction, observation, and evidence classes whose event ids/authors become known only after round 1, the physical budget includes at most one additional coalesced cleanup REQ per relay. All newly learned exact `e` ids/coordinates and matching authors share that REQ; per-event cleanup REQs are forbidden. Exact ids known from the manifest may be included in round 1. The target round/page is capped so its cleanup filter fits one physical serialized REQ under the effective byte/array/filter limits; overflow remains `incomplete` for a later bounded target page rather than splitting cleanup into N+1 requests.

Physical request upper bound for a logical operation is:

```text
chunks = max(
  ceil(filterCount / effectiveFilterCap),
  bytePackingChunks(serialized REQ <= effectiveMaxMessageBytes),
  max over arrays ceil(arrayItems / effectiveArrayCap)
)
physical Nostr REQs = sum(chunks per relay and dependency round)
```

Relay values, AUTH behavior, generic tag indexing, candidate-kind acceptance, and limits on both default relays remain implementation-preflight unknowns.

### 11.2 Pointer vs Blossom size

The pointer event is kept under the minimum of local 8 KiB serialized EVENT-message policy and observed target relay `max_message_length`, while also satisfying tag/content/subid rules. The catalog blob is not sent through a relay and instead must pass each target Blossom server's `HEAD /upload`/`PUT /upload` or mirror policy. A 413 from Blossom may require reducing manifest scope or selecting another server; it does not imply relay sharding.

Pointer relay publication quorum/visibility and Blossom upload/GET/hash quorum are independently recorded as in §3.5.

## 12. NIP-22 future comments — draft/optional, outside MVP

NIP-22 kind `1111` is not fetched or published in MVP. A later feature must resolve the current `30372` review winner before creating a thread. For review coordinate `30372:<reviewer>:review:<toolhash>`, top-level comment uses uppercase root scope and lowercase parent scope:

```json
{
  "kind": 1111,
  "content": "Useful review.",
  "tags": [
    ["A", "30372:<reviewer>:review:<toolhash>", "wss://x.kojira.io"],
    ["K", "30372"],
    ["P", "<reviewer>", "wss://x.kojira.io"],
    ["a", "30372:<reviewer>:review:<toolhash>", "wss://x.kojira.io"],
    ["e", "<current-review-winner-id>", "wss://x.kojira.io", "<reviewer>"],
    ["k", "30372"],
    ["p", "<reviewer>", "wss://x.kojira.io"]
  ]
}
```

For a regular-event root, `E` replaces `A` and the top-level parent uses lowercase `e`; `a` is not added merely because another coordinate happens to describe the subject. Positive regular-root scope tags are:

```json
[
  ["E", "<regular-root-event-id>", "wss://x.kojira.io", "<root-author>"],
  ["K", "1063"],
  ["P", "<root-author>", "wss://x.kojira.io"],
  ["e", "<regular-root-event-id>", "wss://x.kojira.io", "<root-author>"],
  ["k", "1063"],
  ["p", "<root-author>", "wss://x.kojira.io"]
]
```

Thus the positive tag mapping is: addressable root `A` and top-level parent `a` plus current-version `e`; regular root `E` and parent `e`; nested comment parent always `e`; `K/k` and available `P/p` are mandatory as NIP-22 specifies.

Nested reply preserves root `A/K/P` and points lowercase parent to the comment:

```json
{
  "kind": 1111,
  "content": "Agreed.",
  "tags": [
    ["A", "30372:<reviewer>:review:<toolhash>", "wss://x.kojira.io"],
    ["K", "30372"],
    ["P", "<reviewer>", "wss://x.kojira.io"],
    ["e", "<parent-comment-id>", "wss://x.kojira.io", "<comment-author>"],
    ["k", "1111"],
    ["p", "<comment-author>", "wss://x.kojira.io"]
  ]
}
```

Filters prefer `#A` root where live probes confirm uppercase generic-tag indexing, with bounded fallback strategies otherwise. Validate signature/time, apply observed kind 5, and attach top-level comments to the current review winner context. When the review is replaced, existing comments remain historical to the root coordinate/current-id context; UI shows that their recorded `e` may reference an older version. Deleted/withdrawn review/comment winners are suppressed according to observed deletion and state. This remains a separately reviewed future design.

## 13. Separate Nostr and Blossom budgets

Budgets are per configured relay/server unless stated. “Logical” is before byte/array chunking; physical Nostr REQs multiply by the §11.1 chunk expression. HTTP attempts stop on first verified success and are bounded by `MAX_MIRROR_ATTEMPTS`.

| scenario | Nostr logical REQs | Blossom HTTP | notes |
|---|---:|---:|---|
| cold pointers | `1 / relay` | `0` initially | exact kind/d pointer filters; per-relay EOSE/timeout |
| changed cold manifest | `0` extra | `1 successful GET / curator`; at most `MAX_MIRROR_ATTEMPTS` | fallback failures recorded; cached unchanged hash needs 0 GET if policy accepts recent verification |
| cold referenced tool winners | `1 target round + at most 1 cleanup follow-up / relay` | `0` | exact ids plus author-grouped coordinates, coalesced; cleanup only for newly learned winner ids/authors |
| current recommendation sets | `1 coalesced round / relay` | `0` | kind `30267` grouped by trusted curator or exact selected `d`; winner per set, software `a` membership, one count per curator/tool |
| search/filter | `0` | `0` | local verified merged catalog |
| detail shell | `1 coalesced target round + at most 1 cleanup follow-up / passing relay` | `0` | exact tool-winner filters plus one `30369/30370/30371 #a=[selectedToolCoordinates]` logical filter; caps/pagination apply; failed probes are excluded/incomplete, never broad-scanned |
| comparison | `1 coalesced target round + at most 1 cleanup follow-up / passing relay` | `0` | union all selected tool coordinates into the same exact `#a` logical filter; neither per-tool, per-card, nor per-event N+1 |
| review first page | `1 overfetch round + at most 1 cleanup follow-up / relay` | `0` | cleanup covers newly learned review ids/authors; more target pages until unique target or incomplete cap |
| review next page | `1+ target rounds; at most 1 cleanup follow-up per target round / relay` | `0` | same-timestamp boundary expansion counted; each returned page is finalized by one coalesced cleanup, never per review |
| profile open | `0 or 1 / relay` | `0` | lazy; 0 before open/cache hit |
| reaction panel | `0`, or `1 target round + at most 1 cleanup follow-up / relay` | `0` | lazy; target ids coalesced, then newly learned reaction ids/authors coalesced; no N+1 |
| media/gallery | `0 or 1 / relay` | optional content GET outside manifest budget | NIP-94 metadata on Nostr; media bytes separate product HTTP budget |
| bookmark edit | `2+ / relay` | `0` | pre-read + conflict reread; publish is EVENT, read-back adds 1; retries add rounds |
| reconnect/recovery | `1 mandatory gap round / affected relay/scope` | `0` | plus new-scope Backward if scope broadened; never zero-cost |
| curator publication | pointer EVENT + `1 read-back / target relay` | uploads/mirrors + anonymous `GET` hash probes per quorum target | exact same signed event/id may be retried to more relays; a new signed event requires a new manifest generation/hash |

A UI scenario passes only if captured outbound traces meet both logical dependency expectations and physical bound:

```text
physical <= Σrelay Σround max(filter chunks, byte chunks, array chunks)
HTTP manifest attempts <= changedVerifiedCurators * MAX_MIRROR_ATTEMPTS
```

Lazy tabs/components MUST issue zero requests before activation. Coalescing tests assert no duplicate equivalent filter in the same scheduling window. REQ traces MUST show no more than one cleanup follow-up per relay for each target round and MUST show all learned exact ids/coordinates/authors coalesced rather than an N+1 sequence.

## 14. Source inventory and adoption decisions

Primary source fixation used by review/revision:

- `nostr-protocol/nips` commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`: NIP-01 (events, filters, addressable/tie rules), 05, 07, 09, 11, **22**, 25, 32, 40, 42, **45**, 51, 65, 67, 77, 78, 89, 94, B0, 5A.
- `nostr-protocol/registry-of-kinds` commit `8d3fa7e252452e30fdf4e2917a487c239ef350cf`.
- `penpenpng/rx-nostr` commit/tag `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc`, package `rx-nostr@3.7.5`; `@rx-nostr/crypto@3.1.6` in that tree.
- Blossom primary BUD repository `hzrd149/blossom` commit `b5bd2801d1763aa635fc8fea7a76597e0eb18990`: BUD-01 retrieval, BUD-02 upload, BUD-04 mirror, BUD-06 upload preflight, BUD-11 Nostr authorization.
- RFC 8785 JSON Canonicalization Scheme for manifest bytes.

Adoption decisions:

- NIP-22: draft/optional and excluded from MVP; exact future examples retained in §12.
- NIP-45: event counts are not a completeness proof for catalog/pagination and are not an MVP dependency. A future optimization may use counts only as advisory telemetry after relay support probes.
- NIP-67: not an MVP dependency because the selected rx-nostr high-level Backward path does not directly provide the required correlated per-relay hint; empty pages never prove completeness.
- BUD-01/02/04/06/11: used exactly at their documented endpoints/status/auth semantics; BUD-04/06/11 are optional server capabilities and require probes/fallback.

## 15. Verification and implementation-phase acceptance

Static design checks:

- all 18 review rows map to a section and test;
- no relay-internal manifest shard, shard event, generation index, or reconstructable deletion-ledger requirement remains;
- closed relay strings are absent; both default relay candidates are present;
- manifest and pointer examples round-trip under strict schema/canonicalization fixtures;
- response matrix says resolved only after checks pass;
- `git diff --check` passes.

Property/fixture tests required before implementation acceptance:

1. pointer tag/content mismatch, bad signature, wrong hash/size/count/MIME, noncanonical JSON, mirror redirect/hash mismatch, all mirrors unavailable, verified stale fallback, no-cache unavailable;
2. Blossom 413/auth/payment/mirror failure, descriptor mismatch, anonymous unauthenticated public GET/hash quorum probe, authenticated-only mirror excluded from quorum/only-copy, signer-free cold fetch, relay pointer OK/read-back quorum independence;
3. AP partitions A–C, arrival-order permutation, key removal/rotation, stale/quarantine, active/withdrawn conflict, old record on another relay;
4. empty-cache rebuild without kind-5 history and eventual convergence when newer pointer/record appears;
5. byte/subid/max-limit/array/message boundaries and NIP-11 absent/malformed values;
6. pagination duplicate versions, same timestamp saturation, timeout, withdrawn/deleted review, one reviewer/tool, replacement movement;
7. mandatory gap requests on disconnect, reconnect, resume, relay recovery, and scope change; per-relay high-water/boundary assertions;
8. dependency trace snapshots for cold/detail/comparison/review/profile/reaction/media; exact author-independent `30369/30370/30371 #a=[selectedToolCoordinates]`, content/tag equality rejection, tool-unrelated evidence exclusion, live-probe failure exclusion plus `incomplete`, detail caps/pagination, lazy zero-before-open, coalescing, and at most one cleanup follow-up per relay with no per-tool/per-event N+1;
9. migration chain, depth, cycle, conflicting old winners, deleted authority, unavailable destination, untrusted evidence;
10. bookmark concurrent devices, same-second tie, conflict retry/read-back failure, upper timestamp bound, plaintext/log redaction, NIP-44 capability-disabled UI, no downgrade, and unreadable-ciphertext write refusal;
11. claim-level UI and duplicate coordinates remaining distinct;
12. reaction replace/delete/tie/emoji/old-target fixtures;
13. frozen-time quarantine, timer/foreground/clock-change/relay-info reevaluation, 30-day horizon;
14. NIP-22 top-level/nested JSON fixtures and uppercase-index live-probe gate;
15. recommendation set fixtures: current `30267` winners, exact software `a` membership, member removal on replacement, multiple sets per curator counted once, no per-tool custom record;
16. pointer retry fixtures: identical signed event/id retransmission after timeout/partial failure, and newly signed retry only after a new manifest generation/previous/hash;
17. exact-lockfile `tsc --noEmit` verifies `import { verifier } from "@rx-nostr/crypto"` with `createRxNostr({ verifier })`; app-owned helpers remain pseudocode;
18. candidate-kind `d` fixtures for `30367`–`30372`: each grammar maximum legal value and a one-byte-over-limit value, plus common-envelope 191/192/193 UTF-8-byte boundaries; non-ASCII byte counting, no truncation, and deterministic feature/type hash-key derivation are asserted;
19. auth-required Blossom fixtures validate the complete signed kind `24242` contract before header encoding and at the receiving boundary: otherwise-valid upload and mirror tokens with `content:""` or whitespace-only content are rejected; an upload token with `content:"Upload Nosmaps catalog manifest"` and a mirror token with `content:"Mirror Nosmaps catalog manifest"` are accepted when kind, id/signature, past `created_at`, future `expiration`, BUD-11 `t=upload`, matching lowercase SHA-256 `x`, endpoint/domain-only `server` scope when present, and `Authorization: Nostr <base64url-event>` are all correct. The fixtures also reject a `server` value containing a scheme, path, port, query, fragment, userinfo, or uppercase domain.

Implementation preflight must live-probe both default relays for reachability, NIP-11 fields, AUTH, candidate-kind reads/writes in a safe test namespace, generic tag indexing including `#a` for each of `30369`–`30371` and uppercase behavior, `OK`, message/event limits, query limits, and read-back visibility. A relay failing the candidate-kind or `#a` probe is excluded from those detail dependencies and reported incomplete; no broad scan or central-index fallback is permitted. It must probe selected Blossom servers for BUD endpoints, CORS, auth/payment, upload size, descriptor integrity, mirror support, and GET/HEAD visibility. Results are dated artifacts, not permanent assumptions.

TypeScript implementation acceptance requires an exact lockfile fixture using `rx-nostr@3.7.5` and `@rx-nostr/crypto@3.1.6`, project DOM libs, explicit `window.nostr` type augmentation, `tsc --noEmit`, and the real project build. Pseudocode here is not compile evidence.

## 16. Review-1 agreement summary

- P0-1 is resolved by deleting relay shards/indexes and using a signed content-addressed Blossom blob pointer with bounded HTTP fallback and verified stale behavior.
- P0-2 is resolved by withdrawing impossible strong guarantees and specifying AP scope, observable freshness, logical state winners, cache-wipe rebuild, partition behavior, and eventual convergence.
- The remaining 16 findings are resolved by §§5–15 and their explicit trace/property/preflight gates.
- This revision changes design documents only. No implementation, dependency addition, commit, push, or publication is authorized.
