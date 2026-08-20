# Nosmaps relay-native data design — revision 2 (curation as signal)

Status: design only; no implementation in this phase
Revision date: 2026-08-17
Supersedes: revision 1 (2026-08-16, "review-1 revision")
Amended: 2026-08-18 — **§21** revises the capability, liveness, and taxonomy model against 41 real
entries collected from primary sources (`real-catalog-draft.json`, `real-catalog-draft-report.md`).
The amendment touches §3, §4.2, §5.1, §8.2, §10.3, §10.4, §19.3, §20.1 and §20.2; each edit points
back at §21 for its evidence. The `org.nosmaps.software` v1 content profile is **unchanged** (§21.9).
Normative terms: MUST, MUST NOT, SHOULD, MAY
Write path: this document covers the **read path** only. Publishing, signing, and the submit
form are specified in the companion [`design-relay-native-write-path.md`](design-relay-native-write-path.md),
which reuses §4.2, §5.1-§5.4, §7.1, §12.3 and §14.1 verbatim and introduces no second schema,
validator, or `d` grammar. Amendments that companion requires here are listed in its §W10.

## 0. Why revision 2 exists

Revision 1 gated catalog inclusion on a per-curator Blossom manifest committed to by a signed
addressable pointer event. Three things were wrong with that, and they are the whole reason this
document was rewritten rather than patched.

**Cost grew linearly in curators.** Every enabled curator cost at least one HTTP `GET` of a whole
canonical blob (revision 1's own example blob was 184,292 bytes), plus up to
`MAX_MIRROR_ATTEMPTS - 1` further attempts on failure, plus per-server availability-quorum probes at
publish time. Each was an independent round trip with an independent failure mode. Revision 1 hid the
problem by capping enabled curators at eight (`MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ = 8`). A cap
is not a design; it is an admission that the mechanism does not scale.

**It required a trusted-curator list, which is a central authority.** Revision 1 §0.5 made inclusion
depend on "each trusted curator's latest observed and verified manifest snapshot". Somebody has to
decide who is trusted. In an application whose entire premise is that there is no backend, shipping
that decision — or shipping an empty list and hoping users fill it, which is what the current code
actually does — is the same centralisation either encoded or abdicated.

**Inclusion state was duplicated.** Curation already exists as signed events. Kind `30267` is a
NIP-51 *App curation set* whose members are software-application `a` tags, and withdrawal is simply
publishing the next version of the set without that member. Revision 1 kept that *and* invented a
parallel manifest with per-entry `active | withdrawn`. Two mechanisms expressing one fact is two
mechanisms that can disagree, and revision 1 spent §4.4 and §5.2 specifying what to do when they did.

Revision 2 removes the manifest, makes the publisher-signed `30078` record the only canonical record,
and demotes curation from an inclusion gate to a presentation-layer signal derived from the viewer's
own social graph. The result has no HTTP in the catalog data path, a fixed three-round cold start per
relay, and no notion of a globally trusted curator.

## 1. Decisions and invariants

**D1 — No backend.** There is no Nosmaps server, index, aggregator, or API. Every fact displayed
comes from a signed Nostr event observed on a relay the user configured.

**D2 — Signed events are the only source of truth.** The publisher-signed kind `30078` addressable
event is the only canonical record of a tool. No blob, file, pointer, manifest, or third-party
assertion contributes to what a record *is*.

**D3 — No listing gate.** An observed, signature-valid, schema-valid winner for a coordinate whose
`state` is `active` is listable. Nothing else is consulted. No curator, relay, or configuration can
add a row that has no valid winner, or remove a row that has one (§5.4).

**D4 — Curation is presentation only.** Kind `30267` App curation sets affect ranking, ordering, and
a recommendation count. They never affect the listable row set (invariant I7).

**D5 — Trust is the viewer's, not ours.** The set of pubkeys whose curation counts is derived from
the viewer's own kind `3` follow list, optionally extended one hop (§6.3). The application ships no
default curator, no curator allowlist, and no curator ranking.

**D6 — Deterministic reconstruction from whatever was observed.** Identical validated observed inputs
produce byte-identical output, including ordering, independent of arrival order and of which relay
delivered which event.

**D7 — Unknown is never invented.** Missing, unobserved, quarantined, or truncated data is surfaced
as `stale`, `incomplete`, `unknown`, or `quarantined`. An unknown recommendation count is rendered
distinctly from a zero count and never participates in ranking as zero (invariant I8).

**D8 — Bounded REQ budget, no N+1.** Cold catalog load is exactly three logical REQ rounds per
configured relay, independent of the number of curators and of the number of tools (§9). Physical
request count grows only through NIP-11 byte and array chunking, never through per-curator,
per-tool, per-card, or per-event requests.

**D9 — AP behaviour.** Under partition, availability is preferred over global consistency. Partial
observation degrades honestly and converges later (§8).

**D10 — Discovery is opt-in and therefore incomplete by construction.** Topic discovery finds only
records that carry the queried `t` tag on a relay we queried. This is always labelled; it is never
presented as a complete catalog (§5.1).

**D11 — Every record carries explicit `state`.** A later valid winner may withdraw or reactivate a
coordinate. Older events surviving on another relay do not outrank a newer observed winner.

**D12 — Relay and kind capabilities are unverified until preflight.** Candidate-kind acceptance,
generic single-letter tag indexing (`#t`, `#a`, `#d`), NIP-11 values, NIP-42 AUTH, and message limits
are live-probed immediately before implementation, not assumed here.

**D13 — Default relay candidates are exactly `wss://x.kojira.io` and `wss://nos.lol`.** Users may
configure others. This is bootstrap, not authority (§16.1).

**D14 — IndexedDB is a discardable acceleration cache**, never evidence of global completeness.

## 2. Non-goals

These are not partial goals or later phases. They are outside the design.

- **No global consistency.** There is no "latest" state of the catalog. There is only the winner
  observable from the configured relay set as of a stated local time.
- **No complete deletion history.** Kind `5` deletion requests are best-effort cleanup. A client that
  never observed a deletion request is not wrong; it is under-informed, and says so.
- **No guarantee of seeing every relay.** Nosmaps queries the relays the user configured. Records
  that exist only elsewhere are invisible, and their absence is reported as incomplete coverage, not
  as nonexistence.
- **No complete version history.** NIP-01 permits relays to discard older versions of addressable
  events. A coordinate's past is not reconstructable.
- **No proof of ownership.** Nothing here proves a publisher key is an application's legal or
  official owner (§4.3).
- **No global curator authority.** There is no trusted-curator list, no curator reputation, and no
  cross-user notion of "endorsed".
- **No lossless CRDT semantics for NIP-51 kind `10003`** private bookmarks (§14).
- **No NIP-22 comments in MVP** (§15).
- **No new NIP, BUD, or HTTP API.** Revision 2 additionally introduces no HTTP dependency at all in
  the catalog data path.

## 3. Terms, observable states, and policy constants

- **configured relay set**: relays enabled for the current operation.
- **viewer**: the person using the client. May be identified (pubkey known) or anonymous.
- **social graph** (`G`): the set of pubkeys whose kind `30267` sets are consulted for this viewer.
  Derived per §6.2/§6.3. Never hardcoded.
- **curator**: any pubkey in `G` that has an observed kind `30267` set. Membership in `G` is the only
  thing that makes a pubkey a curator, and it is viewer-relative.
- **relay coverage**: per relay, `eose | timeout | auth-required | rejected | disconnected`, recorded
  with observation time.
- **winner**: for an addressable coordinate `(kind, pubkey, d)`, the greatest `created_at` among
  events that passed signature, schema, future-time, and deletion validation; ties broken by
  lexicographically lowest event `id` (NIP-01, §19).
- **as-of**: local time at which a fetch round was closed. Not a global timestamp.
- **fresh**: sufficient configured-relay coverage within the local threshold.
- **stale**: previously observed data is shown because the current round could not be completed, or
  the freshness threshold was exceeded.
- **incomplete**: some required relay or dependency result is timeout, unavailable,
  boundary-saturated, truncated by a cap, or otherwise not proven complete.
- **unavailable**: no displayable record.
- **quarantined**: a validly signed event withheld from winner selection because of schema, time, or
  consistency policy. Quarantined events are retained with their reason and remain inspectable; they
  are never silently discarded and never treated as nonexistent.

Graph-specific states, always displayed alongside counts:

- **graph: none** — no viewer pubkey is known. Counts are `unknown`, not `0`.
- **graph: self-only** — viewer pubkey known, no kind `3` winner observed. `G = {viewer}`.
- **graph: tier1** — `G` from the viewer's kind `3` follow list.
- **graph: tier1+tier2** — extended one hop, opt-in (§6.3).
- **graph coverage: fresh | stale | incomplete | truncated** — `truncated` when a cap in §3 cut the
  graph, and the cut is reported as "N of M follows".

Default local policy values are explicit app configuration, not protocol facts:

```text
CATALOG_STALE_AFTER              = 24h
GRAPH_STALE_AFTER                = 24h
MAX_FUTURE_SKEW                  = 10m
MAX_FUTURE_HORIZON               = 30d
MAX_MIGRATION_DEPTH              = 8
RECORD_AGE_WARN_AFTER            = 365d            # record age only, never project liveness (§21.4)

DISCOVERY_TOPICS                 = ["nosmaps"]     # lowercase `t` values, user-editable
DISCOVERY_LIMIT_PER_RELAY        = 500
MAX_DISCOVERY_PAGES_PER_RELAY    = 8
MAX_DISCOVERY_RAW_EVENTS_PER_RELAY = 4_000

GRAPH_MAX_FOLLOWS                = 512             # tier-1 cap on |G|
GRAPH_MAX_SETS_PER_CURATOR       = 8
GRAPH_TIER2_ENABLED              = false           # opt-in, default off
GRAPH_TIER2_MAX_SEEDS            = 32
GRAPH_TIER2_MAX_PUBKEYS          = 2_048
GRAPH_TIER2_MAX_BYTES_PER_RELAY  = 4_000_000

MAX_FILTERS_PER_REQ              = 8
MAX_SERIALIZED_REQ_BYTES_FALLBACK= 12_000
MAX_ARRAY_ITEMS_PER_FILTER       = 128
MAX_DETAIL_RAW_EVENTS_PER_RELAY  = 2_000
MAX_DETAIL_BYTES_PER_RELAY       = 4_000_000
MAX_DETAIL_PAGES_PER_RELAY       = 8
```

## 4. Event model

### 4.1 Kinds

| kind | role | replacement unit / winner | MVP |
|---:|---|---|---|
| `0` | profile | pubkey | read lazily |
| `3` | NIP-02 follow list | pubkey | **core** — source of the social graph |
| `5` | NIP-09 deletion request | regular event; observed union | best effort |
| `7` | NIP-25 reaction | regular; app reduces per user/target | read lazily |
| `1063` | NIP-94 media metadata | regular | read lazily |
| `10003` | NIP-51 bookmark list | pubkey | private write/read |
| `30078` | NIP-78 application-specific data; the software record | `(30078, publisher, d)` | **the canonical record** |
| `30267` | NIP-51 App curation set | `(30267, curator, d)` | **core** — ranking and count only |
| `30368` | taxonomy record | `(30368, author, d)` | cached/lazy |
| `30369` | conformance claim; exact tool `a` index required | `(30369, author, d)` | detail |
| `30370` | observation; exact tool `a` required when tool-subject/linked | `(30370, author, d)` | detail only when tool-indexed |
| `30371` | evidence relation; related-tool `a` required for detail | `(30371, author, d)` | tool-indexed detail; not migration authority |
| `30372` | review | `(30372, reviewer, d)` | review tab |
| `1111` | NIP-22 comment | regular | future only |

Kind `30367` does not appear in this design: revision 1's catalog pointer is deleted (§18). Kind
`30078` does appear, but in a different role — it is no longer a pointer to an off-relay manifest, it
is the canonical record itself (§4.2).

Candidate kinds `30368`–`30372` are namespaced by required `L`/`l` tags, but those tags are indexing
aids, not schema negotiation or registry ownership. On a later registry collision, old signed events
remain readable under their original candidate schema; publication moves to a newly selected
kind/schema major, and cross-kind migration is explicit rather than reinterpretation.

### 4.2 The canonical record: kind `30078`

Kind `30078` is NIP-78 **application-specific data** (§19). NIP-78 hands the kind to every
application that needs somewhere to keep its own data, so records published on it by unrelated
applications are the **specified normal state, not an anomaly**. Nosmaps records are separated from
them by the `d` namespace prefix `nosmaps:` (rule 1b) together with the `t` tag `nosmaps` used for
discovery (§5.1). NIP-01 makes single-letter tag filters mandatory, so querying `#t` is ordinary
protocol usage rather than a workaround for sharing the kind.

Kind `32267` ("Software Application") was considered and rejected. It is assigned in the event-kind
registry with an empty NIP column, and its semantics — an app-store listing record — sit close enough
to ours that adopting it would make our listing policy depend on another project's curation rules. A
kind whose meaning is deliberately generic carries no such dependency.

The content profile below is therefore a **Nosmaps-local** one, and §16.3 records that as residual
centralisation. The coordinate form is `30078:<publisher-hex>:<d>`; NIP-51 App curation sets carry
arbitrary addressable coordinates in their `a` tags, so they can reference it (§6.1) even though the
worked example in NIP-51 uses a `32267` coordinate.

```json
{
  "kind": 30078,
  "created_at": 1786896000,
  "pubkey": "<publisher-hex>",
  "tags": [
    ["d", "nosmaps:com.example.tool"],
    ["t", "nosmaps"],
    ["t", "relay-client"],
    ["state", "active"],
    ["v", "1"]
  ],
  "content": "{\"schema\":\"org.nosmaps.software\",\"version\":1,\"state\":\"active\",\"name\":\"Example Tool\",\"summary\":\"A relay client.\",\"homepage\":\"https://example.com/tool\"}"
}
```

Normative rules:

1. Exactly one `d` tag. `d` grammar is ASCII, maximum 192 UTF-8 bytes; reverse-DNS is recommended but
   is not ownership proof.
1b. `d` MUST begin with the literal prefix `nosmaps:`, so the canonical coordinate form is
   `30078:<publisher-hex>:nosmaps:<local>`. The 192-byte ceiling covers the whole `d`, so `<local>` has
   at most 184 bytes and MUST be non-empty. A `30078` event whose `d` lacks the prefix is another
   application's record and is recorded as `quarantined: foreign-d` — a **distinct** reason from
   `foreign-profile`, decided from tags alone without parsing `content`. The prefix is not ownership
   proof either; it is a namespace, and it is enforced in exactly one place
   (`validateSoftwareEvent`) alongside the kind and schema checks.
2. `content` is a JSON object with exactly `{schema:"org.nosmaps.software", version:1, state, name,
   summary, homepage?, superseded_by?}`. Unknown keys are rejected in the v1 profile. `name` max 120
   characters, `summary` max 1,000, `homepage` HTTPS max **2,048 UTF-8 bytes**. The `homepage`
   ceiling is counted in **encoded UTF-8 bytes**, not UTF-16 code units and not code points, for
   consistency with every other length limit in this design — §10.1 requires UTF-8 byte counting
   for the candidate kinds' fields, and rule 1's `d` ceiling is already measured that way. A
   percent-encoded URL cannot tell the two units apart; a non-ASCII IRI can, which is exactly why
   the unit is stated rather than left to the reader. `validateSoftwareEvent` currently applies
   `c.homepage.length > 2048` (`nostr-catalog.js:326`), i.e. UTF-16 code units, and therefore
   diverges from this rule for non-ASCII IRIs. The divergence is one-directional — the code is more
   permissive than this rule, never stricter — and it is a **known, unapplied** code amendment, not a
   second opinion about the limit. Authors MUST measure UTF-8 bytes regardless of what the validator
   currently accepts.
2b. **`summary` is a required *key* whose value MAY be the empty string.** `""` is the normative
   form for "no publisher-authored summary exists" and MUST be rendered as §3's `unknown`. A
   cataloguer-authored placeholder (`"Unknown"`, `"N/A"`, `"No description"`) is forbidden: it is
   indistinguishable from content, is monolingual, and is a fabricated value under D7. `name`, by
   contrast, is required **non-empty**. This records what `validateSoftwareEvent` already implements
   (`nostr-catalog.js:316-318`, `:323`) and what §W2.2 already documents; it is stated here because
   reading rule 2's "required" as required-*value* produced exactly one fabricated record in the
   2026-08-18 collection. Evidence and reasoning: §21.5.
3. `state` is the closed, case-sensitive enum `active | withdrawn`. It is a property of the
   **record**, not of the project. Project liveness — dead, archived, moved, unreachable — is a kind
   `30370` observation and is never expressible here; see §21.4, which proves the enum cannot carry
   it (only the publisher may set `state`, and a dead project's publisher is by definition the party
   that has stopped acting).
4. A `["state", ...]` tag is optional. When present it MUST equal content `state`; disagreement
   invalidates the event. The tag exists for cheap scanning only — `state` is not a single-letter tag
   and is therefore **not relay-indexable**, so it can never be used as a filter.
5. `t` tags carry discovery topics (§5.1).
6. Signature and event id MUST validate. `created_at` is subject to future-timestamp quarantine
   (§12.3).
7. `content.version` is `1` or `2`. Rule 2's key set above is the **v1** profile; **v2** adds two
   optional keys and changes nothing else (see "The v2 content profile" below). A reader MUST accept
   both. **v1 is not deprecated and is not rewritten:** an event that states `version: 1` keeps
   meaning exactly what it meant, which is "this record carries no per-language text".

**The v2 content profile — per-language descriptions (#14).**

v1's key set is enforced as an *exact* set (unknown keys are `unknown-field`), so a record cannot
carry a description in a second language without a version bump. That is the whole reason v2 exists;
nothing else about the record changes.

```json
{
  "kind": 30078,
  "tags": [["d", "nosmaps:com.example.tool"], ["t", "nosmaps"], ["state", "active"], ["v", "2"]],
  "content": "{\"schema\":\"org.nosmaps.software\",\"version\":2,\"state\":\"active\",\"name\":\"Example Tool\",\"summary\":\"A relay client.\",\"descriptions\":{\"ja\":\"リレークライアント。\"}}"
}
```

| key | required | v1 → v2 |
|---|---|---|
| `schema` / `state` / `name` / `summary` | required | unchanged. `summary` is still the collected original and is **never** overwritten by a translation |
| `version` | required | value `2` instead of `1` |
| `homepage` / `superseded_by` | optional | unchanged |
| **`descriptions`** | optional | **new in v2.** A JSON object mapping a language code to a text |
| **`summary_lang`** | optional | **new in v2.** The language of `summary`, when the signer knows it |

Normative rules for the new keys:

7a. `descriptions` is a JSON object (not an array, not null). Every key is a non-empty string
    language code; every value is a non-empty string. A key or value that is not a non-empty string
    invalidates the event (`bad-schema`) — a broken language map is not silently dropped, because a
    dropped map is indistinguishable from a record that recorded nothing.
7b. **The empty map is not written.** "No text in any language" is already stated by omitting the
    key; `descriptions: {}` states the same thing a second way, so a record that has nothing to say
    omits `descriptions` entirely. (An absent `summary` — `""`, rule 2b — likewise carries no
    descriptions: absent stays absent.)
7c. **A value equal to that record's `summary` MUST NOT be written.** The original already lives in
    `summary`, and a second copy of the same bytes is a value that can drift out of agreement with
    the one it copies. Readers fall back to `summary` for every language with no recorded text, so
    the copy buys nothing. (#14 D14-6.)
7d. **There is no translator field, in v2 or any later version.** `translator`, `translated_by`,
    `generator` and the like are rejected by the exact key set, and that is deliberate: the signer's
    pubkey *is* who says it. Writing it into `content` as well would put the same fact in two places
    that can disagree — the same rule §4.2 already applies to attribution generally, and the same
    reason `state` may not be authored twice without agreeing (rule 4).
7e. `summary_lang`, when present, is a non-empty string language code. It is **optional and stays
    optional**: the language of an original is a fact about that text, and a signer who has not
    determined it MUST NOT guess one (D7). A record with no `summary_lang` is read as "original, in
    an unrecorded language", not as "English".
7f. The `["v", "2"]` tag accompanies a v2 record for symmetry with the existing `["v","1"]` lines.
    Like `state`'s tag it is a **scanning aid with no authority**: `content.version` is what a reader
    decides on. (No code in this repository reads the `v` tag today.)

**How a second language gets written by someone else.** It does not need anything here: a different
signer publishes their own event under the *same* `d`, which is a different coordinate
(`kind`+`pubkey`+`d`, NIP-01), so neither replaces the other and both are read. That is the
multi-signer overlap of #18, unchanged. One signer who wants two languages puts both in one
`descriptions` map — publishing them as two events under one key would make the second **replace**
the first.

**Why rule 1's `d` grammar is not narrowed to §10.1's.** §10.1 gives the candidate kinds the
lowercase ASCII grammar `[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?`. `30078` deliberately does
**not** adopt it. Rule 1's permissive printable-ASCII form stands, exactly as
`validateSoftwareEvent` implements it today (`nostr-catalog.js:89`,
`D_ASCII_RE = /^[\x21-\x7e]+$/`, uppercase included). The reason is migration cost against zero
observed benefit: tightening the grammar would begin quarantining records that are valid right
now — any existing `d` carrying an uppercase letter, or any character outside the narrow set,
would flip to `bad-d` without its publisher having done anything — and there is no observed
real-world case motivating the change. **Accepted residual risk:** two coordinates differing only
in case (`nosmaps:Tool` and `nosmaps:tool`) are distinct records that look identical in a list,
and this design accepts that rather than paying the quarantine cost to prevent it. Revisit only if
real data shows the collision actually occurring; the change would then belong in
`validateSoftwareEvent` and would need its own quarantine-migration note.

**Foreign `30078` events.** NIP-78 specifies the kind as shared, so other applications publish it
with their own content, and they demonstrably do: a live probe of `wss://x.kojira.io` on 2026-08-18
returned records under `d` values `nostter-read`, `AmethystSettings`, `nym-presence`,
`circl-settings`, `seen_notifications_at`, `ditto/metadata`, `armada/read-state` and
`heat:user:90d:v2`, with `content` ranging from empty through NIP-44 ciphertext to plain JSON
objects. None of them are ours and none must ever be read as ours — and their presence is the kind
working as specified, so the separations below are the **primary mechanism**, not a compensation for
occupying someone else's number.

Two **independent** separations enforce that, both in `validateSoftwareEvent`, each with its own
reason. Either one alone is sufficient; neither is trusted to be the only one:

| # | separation | check | reason |
|---|---|---|---|
| 1 | address namespace | `d` starts with `nosmaps:` (rule 1b) | `foreign-d` |
| 2 | content profile | `content.schema === "org.nosmaps.software"` (rule 2) | `foreign-profile` |

Separation 1 is decided from tags only, so it also holds for records whose `content` is not JSON at
all — which is the observed real-world case. Separation 2 catches a record that lands inside our
namespace anyway (copy, typo, impersonation). Either way the event is recorded as `quarantined` with
its reason and raw event surfaced in diagnostics; it is not listed, and it is **not** reported as
nonexistent. This is a known limitation, not a claim about the event.

### 4.3 Tool identity and claim levels

Tool identity is the full coordinate `30078:<publisher-hex>:<d>`. Similar `d` values under different
pubkeys are distinct and MUST NOT be auto-merged.

The UI MUST NOT say "official" solely because `d` resembles reverse DNS, because a profile has
NIP-05, or because someone recommended it.

Closed claim levels:

| level | machine meaning | UI wording | scope |
|---|---|---|---|
| `self_asserted` | publisher signed the `30078` event | "publisher-signed" | global |
| `nip05_linked` | current NIP-05 lookup maps the displayed identifier to the publisher key | "NIP-05 linked"; not ownership proof | global, lazy |
| `socially_recommended` | at least one pubkey in the **viewer's** `G` has an observed `30267` winner containing this coordinate | "recommended by N in your network" | **viewer-relative** |
| `evidence_linked` | valid `30371` evidence references the coordinate | "evidence available" | global |

Revision 1's `curator_selected` level is deleted. It asserted a global property derived from a
global trusted-curator list; `socially_recommended` asserts a viewer-relative one and must be
labelled as such in the UI. Two users MUST be able to see different `socially_recommended` badges on
the same row without either being wrong.

Future delegation needs a separately specified signed format with issuer, delegate, exact
coordinate/scope, issued time, expiry, and revocation. Until that exists, no delegation badge is
emitted.

## 5. Discovery, exact fetch, and listability

### 5.1 Discovery by `t`

NIP-01 indexes single-letter tags and NIP-24 defines `t` as a hashtag whose value MUST be lowercase
(§19). Discovery therefore uses `#t`:

```json
{"kinds":[30078],"#t":["nosmaps"],"limit":500}
```

Normative details:

1. `t` values are lowercase. Authors normalize to NFC and lowercase before signing; validators reject
   a `t` value that is not already lowercase rather than folding it, so the indexed byte string and
   the queried byte string are identical.
2. **NIP-01 indexes only the first value of any given tag.** A record with three topics MUST publish
   three separate `t` tags (`["t","nosmaps"], ["t","relay-client"], ["t","signer"]`), never
   `["t","nosmaps","relay-client","signer"]`. A validator MUST reject the multi-value form for
   `t` because it silently loses indexing.
2b. A `t` value is at most **128 UTF-8 bytes**, measured on the encoded bytes exactly as rule 1 of
   §4.2 measures `d`. This records the ceiling `validateSoftwareEvent` already enforces —
   `utf8ByteLength(tag[1]) > 128` returns `bad-topic` (`nostr-catalog.js:303`) — so the design and
   the code agree and **no code change follows from this rule**. An over-limit topic is rejected
   before signing and is never truncated: a truncated topic is a *different* topic, so it would
   silently move the record into someone else's discovery bucket.
3. `DISCOVERY_TOPICS` defaults to `["nosmaps"]` and is user-editable. Additional topics may be added
   from selected `30368` taxonomy terms.
3b. **The topic vocabulary is open and multi-valued.** A seed of seven terms — `clients`, `relay`,
   `identity`, `media`, `analytics`, `dev`, `wallet` — is what the UI ships labels for. Every other
   lowercase topic is valid and MUST be rendered **verbatim as itself**, never coerced into a seed
   term and never rendered as `unknown`; `unknown` is reserved for a record carrying no `t` beyond
   `nosmaps`. `wallet` is the only term minted from the 2026-08-18 collection, and only because four
   entries clustered on it. Derivation, the entries behind each term, and the promotion rule: §21.6.
4. Results are paginated with the §12.1 boundary protocol using inclusive `until`, bounded by
   `MAX_DISCOVERY_PAGES_PER_RELAY`, `MAX_DISCOVERY_RAW_EVENTS_PER_RELAY`, and
   `DISCOVERY_LIMIT_PER_RELAY`. Hitting a bound marks the relay `incomplete: discovery-cap`. An empty
   page proves only "no more events returned in this round".
5. **Discovery is opt-in and therefore lossy by construction.** A `30078` record that carries no
   queried `t` tag is invisible to §5.1. The UI MUST label discovery results as "records that
   published topic `nosmaps` on your relays", never as "all tools". §5.2 is the compensating path.

### 5.2 Exact fetch by coordinate

Any coordinate learned from any source — a `30267` set member, a `30371` evidence `a` tag, a `30369`
conformance claim, a `superseded_by` field, a bookmark, or a URL — is fetched **exactly**, regardless
of whether it carries a discovery topic:

```json
[
  {"kinds":[30078],"authors":["<publisher-A>"],"#d":["nosmaps:tool-a","nosmaps:tool-b"],"limit":8},
  {"kinds":[30078],"authors":["<publisher-B>"],"#d":["nosmaps:tool-c"],"limit":4}
]
```

Filters MUST be **grouped by author**. A single filter with `authors:[A,B]` and `#d:[x,y]` matches
the Cartesian product and lets one author's events consume another's `limit`. Grouping is by author,
not one REQ per author: all groups travel in the same REQ, subject only to §9.4 chunking.

This is what makes curation a *recall* mechanism rather than a gate (§6.6): a record with no
`t` tag that one person in your network recommends still appears, fetched by coordinate.

### 5.3 Winner selection among replaceable versions

`30078` is in the addressable range `30000 <= n < 40000`, so a coordinate is `(kind, pubkey, d)` and
relays keep only the latest per coordinate (§19). Clients MUST NOT rely on that: a partitioned relay
set will hand back different versions from different relays.

Selection is a pure function over the union of everything observed for the coordinate:

```text
candidates = observed events at (30078, pubkey, d)
  filtered by valid event id and signature
  filtered by schema validity (§4.2)
  filtered by future-timestamp eligibility (§12.3)
  filtered by not-covered-by-observed-valid-kind-5 (§7.3)

winner = argmax over candidates by (created_at, then lowest id lexicographically)
```

Consequences that MUST be surfaced rather than hidden:

- **Validation precedes selection.** If the newest observed version fails schema validation, it is
  quarantined and the newest *valid* version wins. The row is flagged
  `quarantined-newer-version: <id>, reason: <slug>` so the display is not silently a version behind.
- **A publisher cannot be de-listed by publishing garbage.** Only a valid `state:"withdrawn"` winner
  retracts (§7.1).
- **Per-relay `limit:1` is never global truth.** NIP-01 says a relay SHOULD return just the latest
  version it holds; that is the latest *it* holds. Union across relays first, then select.
- Selection is order-independent and relay-independent, which is invariant I4.

### 5.4 Listability — there is no gate

> A coordinate is **listable** if and only if there exists a winner for it under §5.3 and that
> winner's `state` is `active`.

That is the complete rule. No curator, no relay preference, no configuration, and no local list
participates. Specifically:

- A coordinate with a valid active winner and **zero** recommendations from anyone is listable.
- A coordinate recommended by everyone in `G` but with no observed valid winner is **not** listable;
  it appears only as an unresolved reference in diagnostics (`recommended coordinate not observed`),
  never as a fabricated row.
- Changing `G` — adding follows, removing follows, logging out entirely — MUST NOT change the
  listable row set. This is invariant I7 and is a required test.

## 6. Curation as a presentation-layer signal

### 6.1 The `30267` contract

NIP-51 defines kind `30267` as *App curation sets*: "references to multiple software applications",
with expected tag items `"a"` (software application event), and NIP-51's own example shows a set with
a `d` tag and `a` tags of the form `30078:<pubkey>:<d>` (§19).

Nosmaps uses it exactly as specified and adds no custom schema:

- The set is addressable at `(30267, curator, d)`; the winner (§5.3 rules, minus the
  `org.nosmaps.software` schema check, which does not apply) is the whole current set.
- Members are the values of `a` tags that parse as `30078:<64-hex>:<d>`. Other `a` values are ignored,
  not errors.
- `content` is free text (NIP-51's example uses `"My nostr app selection"`). Nosmaps neither requires
  nor validates it.
- Optional NIP-51 `title`, `image`, `description` tags may be displayed.
- **Nosmaps defines no per-tool `state`, no per-tool `d`, and no reason field for this kind.**
- A curator may have several sets. Their members are unioned, but the curator counts **once** per
  tool. To bound a hostile or accidental curator publishing thousands of sets, at most
  `GRAPH_MAX_SETS_PER_CURATOR = 8` sets per curator are consulted, selected deterministically by
  ascending `d` code-point order, and the truncation is reported.

### 6.2 Obtaining the viewer's social graph (tier 1)

The client needs a viewer pubkey and that pubkey's kind `3` follow list. Note that **reading a follow
list requires only a pubkey, not a signer** — this matters for honest degradation.

Step 1, identity, in preference order:

1. NIP-07 `window.nostr.getPublicKey()` when an extension is present and the user has granted it.
2. A pubkey the user pasted (npub or hex), which enables ranking in read-only mode with no signer.
3. None. Go to §6.5.

Step 2, follow list. NIP-02 kind `3` is replaceable at `(3, pubkey)`, its `p` tags are
`["p", <32-bytes hex key>, <main relay URL>, <petname>]`, and every published list replaces the
previous one in full (§19):

```json
{"kinds":[3],"authors":["<viewer-hex>"],"limit":1}
```

sent to every configured relay in round R1 (§9.1), unioned, then the winner selected by §5.3 rules.
`limit:1` per relay is safe here only because the union-then-select step follows; one relay's answer
is never accepted as the global winner.

Step 3, `G`:

```text
G  = { viewer }                                    # the viewer's own sets always count
   ∪ { validated p-tag values from the kind 3 winner }
```

- Values must be 64 lowercase hex characters; malformed `p` tags are dropped and counted.
- Deduplicated preserving **first occurrence in the signed event's own tag order**. NIP-02 says fresh
  follows are appended chronologically, so tag order is meaningful and, being part of the signed
  event, is arrival-order independent (invariant I4).
- Truncated to `GRAPH_MAX_FOLLOWS = 512`. Truncation is surfaced as `graph coverage: truncated —
  512 of M follows used`.
- If no kind `3` winner was observed, `G = { viewer }` and the state is `graph: self-only`, which is
  reported as such and never as "you follow nobody".

Cost: the kind `3` filter rides inside round R1 and the `30267` query for all of `G` is a single
filter with an `authors` array (round R2). See §9.3 for why this is the whole point.

### 6.3 Tier 2 — follows-of-follows, opt-in, and why the naive form is rejected

**The naive form is rejected on bytes, not on round trips.** Fetching kind `3` for all 512 members of
`G` is only one extra bounded round —
`{"kinds":[3],"authors":[<512 pubkeys, chunked>],"limit":512}` — so it does not violate D8. It fails
on payload: a kind `3` event with 1,000 follows is roughly 70–100 KB, and 512 of them is 35–50 MB per
relay per cold start. That is not acceptable in a browser, particularly on mobile, and it is not
justifiable for a signal that only reorders rows.

**The accepted form narrows the seed set using information round R2 already produced.** After R2 the
client knows `G_c`: the subset of `G` that actually published an observed `30267` set. `|G_c|` is in
practice far smaller than `|G|`, because most people do not curate.

```text
seeds = first GRAPH_TIER2_MAX_SEEDS (32) of G_c, ordered by ascending pubkey hex
G2    = ∪ { validated p-tag values from each seed's kind 3 winner } \ G
        truncated to GRAPH_TIER2_MAX_PUBKEYS (2_048), deterministic order
```

- Round R4 fetches `{"kinds":[3],"authors":[seeds],"limit":32}`; the byte ceiling is
  `GRAPH_TIER2_MAX_BYTES_PER_RELAY = 4 MB`, worst case roughly `32 × 100 KB = 3.2 MB`. Exceeding it
  stops the round and marks tier 2 `incomplete: tier2-byte-cap`.
- Round R5 fetches `{"kinds":[30267],"authors":[G2 chunked],"limit":...}`.
- Ordering seeds by ascending pubkey hex is arbitrary but deterministic and independent of arrival
  order, which is what invariant I4 requires. Any truncation is reported.
- `GRAPH_TIER2_ENABLED` defaults to **false**. Tier 2 costs two extra rounds and megabytes for a
  reordering signal; that is the user's call to make, not the app's default.

**Tier-2 counts are displayed separately and never summed silently into the tier-1 count** (§6.4).

### 6.4 Recommendation count and deterministic ordering

For a listable coordinate `X`:

```text
members(p) = ∪ over the ≤ GRAPH_MAX_SETS_PER_CURATOR selected winners of (30267, p, *)
             of the 30078 coordinates in their `a` tags

rec1(X) = | { p ∈ G   : X ∈ members(p) } |          # each curator counted at most once
rec2(X) = | { p ∈ G2  : X ∈ members(p) } |          # only when tier 2 is enabled; disjoint from G
```

The count is a **count of distinct pubkeys in the viewer's graph**, not a count of sets, not a score,
and not weighted. There is no reputation model here and none is planned.

Ordering key, applied only when `graph` is not `none`:

```text
(rec1 DESC, rec2 DESC, winner.created_at DESC, winner.id ASC)
```

`winner.id` is unique, so the order is total and deterministic. When `graph` is `none`, `rec1`/`rec2`
are **unknown for every row**, so the count components are dropped from the key entirely rather than
substituted with `0`:

```text
(winner.created_at DESC, winner.id ASC)
```

Display rules:

- `rec1 = 0` with a known graph renders as "0 in your network" — a real, informative zero.
- `rec1 = unknown` renders as "—" with the reason. It MUST NOT render as `0`, and MUST NOT be sorted
  as `0`. This is invariant I8.
- Tier 2 renders as a separate figure: "3 in your network · +11 extended", never "14".
- Every count is labelled as observed on the configured relays as of the stated as-of time, never as
  a universal total.
- The pubkeys behind a count are inspectable in diagnostics, so the user can see *who* recommended a
  row and unfollow them if they disagree. That is the entire trust-adjustment mechanism.

### 6.5 When the viewer has no graph

This is the logged-out, no-NIP-07, no-pasted-key case, and it is the case that must be got right,
because it is most users on first load.

1. **The catalog is fully listable and fully displayed.** §5.4 does not consult `G`. The row set is
   byte-identical to what a logged-in user with 500 follows sees.
2. Ordering falls back to `(winner.created_at DESC, winner.id ASC)` — deterministic, derived only
   from signed data, no clock and no arrival-order dependence.
3. Recommendation counts render as `—` / `unknown`, never `0`, never invented, never a placeholder
   number.
4. A persistent, non-modal banner states the situation honestly and names both remedies:
   *"Not personalised — recommendation counts need a follow list. Connect a Nostr key, or paste an
   npub to rank in read-only mode."*
5. **The client MUST NOT fall back to a shipped default curator, a bundled recommendation set, a
   popularity heuristic derived from anything other than the viewer's graph, or a "featured" list.**
   Any of those would reintroduce exactly the central authority this revision removes.
6. A user MAY add pubkeys to a local, user-editable "also count these" list. It **ships empty**, it is
   not populated by the app or by any update, and rows sourced from it are labelled as coming from
   the manual list rather than from the follow graph. It is user-owned local configuration, not an
   app-shipped opinion.

### 6.6 Curation adds recall, never a gate

Curation participates in the data path in exactly two ways, and it is worth stating them together
because they are easy to confuse:

| curation does | curation does not |
|---|---|
| contribute `rec1`/`rec2` to ranking and ordering (§6.4) | decide whether a row is listable (§5.4) |
| surface coordinates that carry no discovery topic, which are then fetched exactly by §5.2 | vouch for, validate, or override a record's content |
| provide a `socially_recommended` viewer-relative badge (§4.3) | grant a global "official" or "selected" status |
| let the viewer adjust what they see by adjusting who they follow | let anyone adjust what someone else sees |

The second row is the compensating path for D10. Because a recommended coordinate is fetched exactly,
a record that never published a `t` tag is still reachable. Curation therefore *increases* what is
found without ever being able to *decrease* it.

## 7. Withdrawal, retraction, and deletion

### 7.1 Publisher retraction

A publisher retracts their own record by publishing a **newer valid `30078` event at the same
coordinate with `state:"withdrawn"`**:

```json
{
  "kind": 30078,
  "created_at": 1786982400,
  "pubkey": "<publisher-hex>",
  "tags": [["d", "nosmaps:com.example.tool"], ["state", "withdrawn"], ["v", "1"]],
  "content": "{\"schema\":\"org.nosmaps.software\",\"version\":1,\"state\":\"withdrawn\",\"name\":\"Example Tool\",\"summary\":\"No longer maintained.\"}"
}
```

- `name` and `summary` remain required so the v1 shape stays stable and a client can explain *what*
  was withdrawn.
- Once the withdrawn winner is observed, the coordinate is not listable (§5.4). A later valid
  `active` winner reactivates it; nothing else can.
- Only the coordinate's own pubkey can do this (invariant I2). No curator, relay, or other publisher
  can withdraw someone else's record.
- The publisher MAY additionally publish a kind `5` naming the coordinate (§7.3). That is cleanup, not
  the retraction mechanism.

**Ceasing to publish is not retraction.** If a publisher simply stops, the last active winner remains
the winner indefinitely. The client cannot distinguish "still current" from "abandoned"; it shows the
winner's `created_at` and flags it past `MAX_POINTER_AGE_BEFORE_WARNING`-equivalent age thresholds,
but it MUST NOT infer withdrawal from age.

### 7.2 A curator dropping a recommendation

A curator drops a recommendation by publishing **the next version of the same `(30267, curator, d)`
set without that member's `a` tag**. This is plain NIP-51 replaceable-set semantics; there is no
Nosmaps-specific mechanism, no per-tool state, and no tombstone.

Consequences:

- Once the newer set winner is observed, `rec1(X)` drops by one for viewers who have that curator in
  `G`. The row's listability is unchanged (invariant I7).
- A curator can only ever affect counts, so a dropped recommendation is a display change, never a
  removal.
- To stop curating entirely, publish an empty set (a `30267` winner with no `a` tags) or stop being
  followed. An empty set is valid and means "this curator currently recommends nothing", which is
  distinguishable from "no set observed".

### 7.3 NIP-09 kind `5` is best-effort cleanup, not a ledger

NIP-09 states that relays SHOULD delete or stop publishing referenced events with an identical
`pubkey` as the deletion request; that an `a` tag causes relays to "delete all versions of the
replaceable event up to the `created_at` timestamp of the deletion request event"; that requests
SHOULD include a `k` tag; and that clients MAY inform the user that "their request for deletion does
not guarantee deletion because it is impossible to delete events from all relays and clients" (§19).

Nosmaps therefore:

- validates signature and the same-author rule before honouring anything;
- treats an `e` request as covering the named event, and an `a` request as covering versions of that
  address **up to the request's `created_at`**, exactly as NIP-09 specifies;
- unions all valid deletion requests actually observed on configured relays and suppresses covered
  versions *before* winner selection (§5.3);
- never describes deletion as erasure, and never requires historical kind `5` availability to rebuild
  state;
- keeps no "deletion cursor" and no completeness claim about deletions;
- bounds cleanup to **at most one coalesced kind-5 REQ per relay per target round** (§9.1 R3),
  carrying all newly learned exact `e` ids and `a` coordinates plus matching authors. Per-card and
  per-event cleanup requests are forbidden.

For long-lived logical removal, publishers MUST use §7.1 and curators MUST use §7.2. Kind `5` may
accompany those writes; it can never replace them.

### 7.4 What is and is not reconstructable

Stated plainly, because the honest answer to several of these is "no".

| question | reconstructable from observed signed events? | why |
|---|---|---|
| Is coordinate X listable right now? | **Yes**, from the observed winner | §5.3 + §5.4, deterministic |
| Did publisher P retract X? | **Only if** the withdrawn winner was observed | absence of an event is not evidence of an event |
| What did X look like before? | **No** | NIP-01 permits relays to discard older versions of addressable events |
| Did P ever publish X at all, if nothing is observed? | **No** | unobserved is reported as `incomplete`, never as "does not exist" |
| Does curator C recommend X now? | **Yes**, from C's observed `30267` winners | current set membership |
| Did C ever recommend X and then drop it? | **No** | prior set versions may be discarded; no per-tool record exists |
| When did C drop X? | **No** | nothing records the transition |
| Was any event deleted? | **No** | kind `5` is best-effort; relays need not retain or honour it |
| Is the displayed set complete across all relays? | **No** | only configured relays were observed (D10, §2) |
| Is the displayed set complete across all publishers? | **No** | discovery is `t`-opt-in (§5.1) |

Every "No" row above has a corresponding UI state in §3 (`stale`, `incomplete`, `unknown`,
`quarantined`). None of them is allowed to render as a confident value.

## 8. AP behaviour, partitions, and convergence

### 8.1 The exact guarantee

Under relay or network partition, availability is preferred over global consistency. The client
guarantees only:

> For each coordinate, the displayed state is derived deterministically from the valid `30078`
> events, `30267` sets, kind `3` follow lists, and kind `5` deletion requests actually observed from
> the configured relay set by the shown as-of time.

It does not guarantee that an unobserved newer event or deletion does not exist. Diagnostics SHOULD
expose: configured relays and per-relay coverage; the winner's event id, `created_at`, and which
relays served it; any quarantined newer version and its reason; graph state and graph coverage; the
pubkeys behind each count; and the overall `fresh | stale | incomplete | unavailable | quarantined`
state.

### 8.2 Checkable invariants

- **I1 Signature first** — no bytes influence any displayed value before event id and signature
  validate. There is no content-addressed side channel any more; the signature *is* the integrity
  mechanism.
- **I2 Publisher locality** — only the pubkey of a coordinate can change that coordinate's state. No
  curator, relay, or configuration can withdraw, alter, or forge it.
- **I3 Newest valid wins** — an observed newer valid `withdrawn` winner beats an older `active`
  version at the same coordinate, regardless of which relay held which.
- **I4 Determinism** — identical validated observed inputs produce byte-identical merged output *and
  identical ordering*, independent of arrival order and of which relay delivered what.
- **I5 Honest freshness** — a missing dependency, insufficient relay coverage, a cap, or threshold
  expiry produces `stale`/`incomplete`/`truncated`, never "latest" and never a fabricated value.
- **I6 Eventual convergence** — two clients that later observe the same valid event set select the
  same winners, the same counts for the same graph, and the same order.
- **I7 Curation neutrality** — for any two graphs `G` and `G'`, the listable row set is identical.
  Only ordering, counts, and badges differ. *(New in revision 2; this is the invariant that encodes
  the whole point of the rewrite, and it is directly testable by loading the catalog logged out and
  logged in and diffing the row sets.)*
- **I8 Unknown is not zero** — an unknown count renders distinctly from a zero count and is excluded
  from the ordering key rather than coerced to `0`.
- **I9 Liveness neutrality** — for any set of observed kind `30370` liveness observations, the
  listable row set is identical. Only ordering, badges, and the derived liveness value differ. This
  is I7's guarantee extended to the observation layer, and it is what keeps "no third party can
  de-list a publisher" true once a third party can publish "this project is dead" (§21.4).

### 8.3 Partition examples

**A — newest withdrawal hidden.** R1 holds `30078 X state=withdrawn` at `created_at = t2`; R2 holds
only the older `active` version at `t1 < t2`. A client seeing only R2 lists X with relay coverage
`incomplete` and MUST NOT call it globally active or latest. Once R1 is observable, the withdrawn
winner is selected and X is suppressed. No manifest, generation, or blob participates.

**B — stale graph.** The viewer's kind `3` winner is observed only from R2, which holds an older
version than R1. Counts are computed from that older graph and the state is `graph: stale`. The
**row set is unaffected** (I7). Once R1's newer follow list is observed, counts are recomputed and
converge. A user who just followed someone sees the new count on the next round, not never.

**C — curators disagree.** Curator A's set contains X; curator B's set does not. There is nothing to
resolve: `rec1(X) = 1`. Revision 1 had a "curator conflict" merge state here, with field provenance
and a deterministic display-value tiebreak, because manifests carried competing display fields and
competing `active`/`withdrawn` claims. Revision 2 has no such state, because curation is
additive-only and carries no fields — the record's own content is the only display source. The
conflict was an artifact of the mechanism, and deleting the mechanism deleted the conflict.

### 8.4 Empty-cache rebuild

After IndexedDB is cleared, the full cold path is §9.1 R1–R3 and nothing else:

1. R1: discovery by `t` plus the viewer's kind `3`, per relay, recording coverage.
2. R2: `30267` sets for all of `G` in one author-array filter.
3. R3: exact author-grouped `#d` fetch of coordinates learned in R2 but not returned by R1, plus one
   coalesced kind-5 cleanup filter for everything learned in R1 and R2. Until R3 completes, results
   are labelled provisional/incomplete rather than deletion-final.
4. Validate, select winners, compute counts, order, render.
5. Mark incomplete dependencies and relays. Never substitute an unverified or fabricated value for a
   missing one.
6. Start Forward subscriptions only after mandatory gap handling (§13.2).

Convergence: if a newer winner, set version, follow list, or deletion becomes observable after
partition repair, the next gap round deterministically replaces the older winner and clients
converge, assuming they later observe the same valid set. Strong convergence while partitions
persist, and complete global erasure, are explicit non-goals (§2).

## 9. Round structure and REQ budget

### 9.1 Per-relay round structure

Budgets are per configured relay. "Logical" is before NIP-11 byte/array chunking; physical REQs
multiply per §9.4.

**R1 — discovery and viewer identity.** One REQ, up to two filters:

```json
[
  {"kinds":[30078],"#t":["nosmaps"],"limit":500},
  {"kinds":[3],"authors":["<viewer-hex>"],"limit":1}
]
```

The second filter is omitted entirely when no viewer pubkey is known. Discovery may paginate within
this round under §5.1's caps.

**R2 — curation.** One REQ. Every pubkey in `G` is an **array element**, not a filter:

```json
[{"kinds":[30267],"authors":["<g-1>","<g-2>","…","<g-512>"],"limit":512}]
```

This single line is the structural fix. Revision 1 needed one HTTP fetch per curator; revision 2
needs 67 bytes per curator inside a filter that was going to be sent anyway.

**R3 — gap-fill and deletion cleanup.** One REQ:

```json
[
  {"kinds":[30078],"authors":["<publisher-A>"],"#d":["nosmaps:tool-a","nosmaps:tool-b"],"limit":8},
  {"kinds":[30078],"authors":["<publisher-B>"],"#d":["nosmaps:tool-c"],"limit":4},
  {"kinds":[5],"authors":["<publisher-A>","<publisher-B>","<curator-C>"],
   "#a":["30078:<publisher-A>:nosmaps:tool-a","30267:<curator-C>:nostr"],"limit":256}
]
```

The `30078` filters cover coordinates learned from R2 sets but not returned by R1's topic query — the
§6.6 recall path. The kind-5 filter is the single coalesced cleanup for everything learned in R1 and
R2; there is at most one such filter per relay per target round, never one per event.

**R4/R5 — tier-2 graph.** Only when `GRAPH_TIER2_ENABLED` (§6.3). R4 fetches kind `3` for at most 32
seeds; R5 fetches `30267` for `G2 \ G`.

Lazy rounds (detail, review, reactions, profiles, media, bookmarks) issue **zero** requests before
their component is opened, and each follows the same "one target round + at most one coalesced
cleanup follow-up" shape.

### 9.2 REQ budget table

| scenario | Nostr logical REQs / relay | HTTP | notes |
|---|---:|---:|---|
| R1 cold discovery + identity | `1` (+ up to `MAX_DISCOVERY_PAGES_PER_RELAY - 1` pages) | `0` | `{30078 #t}` + optional `{3 authors:[viewer]}` |
| R2 curation | `1` | `0` | `{30267 authors:G}`; curators are array elements, not filters |
| R3 gap-fill + cleanup | `1` | `0` | author-grouped `#d` for R2-learned coordinates + one coalesced kind-5 filter |
| **cold catalog total** | **`3`** | **`0`** | independent of curator count and tool count; pages and chunks per §9.4 |
| R4 tier-2 seeds (opt-in) | `1` | `0` | `{3 authors:G_c[0..31]}`; byte-capped at 4 MB |
| R5 tier-2 curation (opt-in) | `1` | `0` | `{30267 authors:G2\G}` |
| search / filter | `0` | `0` | local, over already-observed events |
| re-rank after follow change | `0` or `1` | `0` | `0` if `G` unchanged; else re-run R2 only |
| tool detail shell | `1` target + `≤1` cleanup | `0` | one coalesced `{30369,30370,30371 #a:[selected]}` filter |
| comparison | `1` target + `≤1` cleanup | `0` | selected coordinates unioned into the same `#a` filter; no per-tool N+1 |
| review page | `1` target + `≤1` cleanup | `0` | `{30372 #a}` overfetch; cleanup covers newly learned ids/authors |
| profile popover | `0` or `1` | `0` | lazy; kind `0` coalesced across visible authors |
| reaction panel | `0`, or `1` + `≤1` cleanup | `0` | lazy; targets coalesced |
| media / gallery | `0` or `1` | media bytes only | NIP-94 metadata on relays; media bytes are a separate product budget |
| bookmark edit | `2+` | `0` | pre-read + conflict reread + read-back; retries add rounds |
| reconnect / recovery | `1` gap round / affected relay+scope | `0` | plus an initial Backward query if scope broadened |
| publisher publication | `EVENT` + `1` read-back | `0` | no blob, no upload, no quorum, no mirror, no second signature |
| curator publication | `EVENT` + `1` read-back | `0` | next `30267` version; identical cost regardless of set size |

**HTTP in the catalog data path is zero.** The only outbound HTTP anywhere in the design is optional,
lazy, display-only, and outside this budget: NIP-05 verification against a publisher-chosen host for
the `nip05_linked` badge (§4.3), and media bytes for NIP-94 attachments. Neither can affect
listability, ordering, or counts.

Acceptance criterion, unchanged in form from revision 1:

```text
physical ≤ Σrelay Σround max(filter chunks, byte chunks, array chunks)
HTTP requests in the catalog data path = 0
```

Lazy components MUST issue zero requests before activation. Coalescing tests assert no duplicate
equivalent filter in one scheduling window, and REQ traces MUST show at most one cleanup follow-up
per relay per target round.

### 9.3 How cost behaves as curator count grows

This is the point of the rewrite, so it is stated numerically. Let `C = |G|`, the number of pubkeys
whose curation is consulted.

A pubkey costs `67` bytes inside an `authors` array (64 hex characters, two quotes, one comma). With
`MAX_SERIALIZED_REQ_BYTES_FALLBACK = 12_000`, one physical REQ absorbs roughly `179` curators, so R2
chunks as `ceil(67C / 12_000)`, floored at 1, and additionally as `ceil(C / 128)` filters against
`MAX_FILTERS_PER_REQ = 8`, i.e. `ceil(C / 1024)` — the byte bound dominates.

| `C` | revision 1: HTTP `GET`s | revision 1: worst-case HTTP attempts | revision 1: supported? | revision 2: logical REQs / relay | revision 2: physical REQs / relay | revision 2: HTTP |
|---:|---:|---:|---|---:|---:|---:|
| 1 | 1 | 4 | yes | 3 | 3 | 0 |
| 8 | 8 | 32 | yes — at the hard cap | 3 | 3 | 0 |
| 64 | 64 | 256 | **no** — exceeds `MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ = 8` | 3 | 3 | 0 |
| 512 | 512 | 2,048 | no | 3 | 5 | 0 |
| 2,048 | 2,048 | 8,192 | no | 3 | 14 | 0 |

Read the marginal cost of one more curator:

- **Revision 1:** one HTTP round trip to a third-party Blossom server, downloading and hashing an
  entire manifest blob (184,292 bytes in revision 1 §3.3's own example), with up to three further
  attempts against mirrors on failure, plus an independent failure mode — that curator's server being
  down made that curator's *entire* contribution unavailable, which then had to be papered over with
  a stale-generation fallback and a `chain-unverified` label. Cost was Θ(C) **round trips** and Θ(C)
  **megabytes**, which is why revision 1 capped C at 8.
- **Revision 2:** 67 bytes appended to an `authors` array in a REQ that is sent regardless, and zero
  additional round trips until a 12,000-byte chunk boundary is crossed — once per ~179 curators. Cost
  is Θ(C) **bytes** and Θ(C / 179) round trips. Logical rounds are Θ(1).

The failure semantics improve by the same factor. In revision 1, one curator's unreachable server
degraded that curator's whole snapshot and, because manifests gated inclusion, could remove rows. In
revision 2 a missing `30267` set simply lowers a count by one; the row set is provably unchanged
(invariant I7). Curator count also stops needing a cap at all: `GRAPH_MAX_FOLLOWS = 512` exists to
bound *bytes and rendering*, not to bound round trips, and raising it costs bytes linearly rather
than round trips linearly.

### 9.4 Byte-aware chunking (NIP-11)

NIP-11 has no standard `max_filters`; `MAX_FILTERS_PER_REQ` is app-owned compatibility policy only.
Read and apply, when present: `max_message_length` (to the serialized UTF-8 JSON message, not
character count), `max_subscriptions`, `max_limit`, `max_subid_length`, `max_event_tags`,
`max_content_length`, and `created_at_upper_limit` (§19).

Absent or malformed values use conservative app fallbacks and are labelled *assumed*. Independently
cap `ids`, `authors`, and tag-value arrays at `MAX_ARRAY_ITEMS_PER_FILTER`, then serialize the full
`["REQ", subId, ...filters]` and split until both filter count and byte length fit. A single oversized
filter is split by its largest array. If a scalar-only filter cannot fit, fail visibly.

```text
chunks = max(
  ceil(filterCount / effectiveFilterCap),
  bytePackingChunks(serialized REQ <= effectiveMaxMessageBytes),
  max over arrays ceil(arrayItems / effectiveArrayCap)
)
physical Nostr REQs = sum(chunks per relay and dependency round)
```

Since revision 2 has no event that carries a payload, there is no relay message-size coupling on the
write path beyond ordinary `30078` and `30267` event limits, and no separate upload-size constraint
of any kind.

## 10. Candidate-kind normative schema contract

### 10.1 Common envelope, grammar, limits, and canonical inputs

All candidate kinds `30368`–`30372` MUST have:

- valid Nostr signature/id; one `d`; `L=org.nosmaps.schema`; one `l=<type>,org.nosmaps.schema`;
  JSON-object content;
- top-level `schema`, integer `version`, `state`; unknown major versions are stored/quarantined and
  not interpreted;
- unknown content fields rejected in v1; unknown noncritical tags retained but ignored unless
  prohibited by the kind contract;
- UTF-8 strings normalized to NFC before authoring; validators reject control characters except JSON
  whitespace escapes;
- `d` ASCII grammar `[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?`, maximum **192 UTF-8 bytes**;
  kind-specific grammar is narrower. Authors and validators measure encoded UTF-8 bytes, MUST NOT
  truncate, and reject an over-limit event before signing;
- content maximum 16,384 UTF-8 bytes, 128 tags, 256 bytes per tag element, arrays maximum 128 unless
  narrower below. Actual publication is further limited by live relay policy;
- enums are closed and case-sensitive; `state` is `active | withdrawn`;
- RFC 8785 JSON Canonicalization Scheme is used **only** as the byte-exact hash input when deriving a
  bounded `d` component below. It is not a transport, storage, or event format anywhere in this
  design. Nostr event ids remain NIP-01 serialization, not JCS;
- `L`/`l` only aid indexing. `schema` + `version` governs validation.

Candidate `d` byte budgets are closed as follows; every listed component is lowercase ASCII, so its
byte count is its character count. `sha256` means 64 lowercase hex bytes.

| kind | normative `d` grammar | component maxima (bytes) | maximum bytes |
|---:|---|---|---:|
| `30368` | `taxonomy:<namespace>:<term>` | prefix `9` + namespace `64` + separator `1` + term `64` | `138` |
| `30369` | `conformance:<tool-sha256>:<feature-key>` | prefix `12` + sha256 `64` + separator `1` + feature key `115` | `192` |
| `30370` | `observation:<subject-sha256>:<type-key>:<nonce>` | prefix `12` + sha256 `64` + separator `1` + type key `98` + separator `1` + nonce `16` | `192` |
| `30371` | `evidence:<subject-sha256>:<relation>:<nonce>` | prefix `9` + sha256 `64` + separator `1` + relation `11` + separator `1` + nonce `32` | `118` |
| `30372` | `review:<tool-sha256>` | prefix `7` + sha256 `64` | `71` |

For variable identifiers in `30369` and `30370`, content keeps the complete NFC source value. Derive
`<feature-key>` or `<type-key>` deterministically: use the source unchanged only when it is already a
lowercase ASCII slug matching `[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?` and fits the per-kind byte maximum;
otherwise use `sha256-<64hex>`, where the hash input is the exact RFC-8785 serialization of the
NFC-normalized JSON string value, encoded as UTF-8. No locale case-folding or lossy transliteration.
`30370` nonce is exactly 16 lowercase base32 characters; `30371` nonce is 8–32.

Migration on a later registry collision: stop publishing the collided candidate kind, define a new
major/kind with an explicit converter, preserve old events as legacy inputs, and never reinterpret
old content under a third party's schema.

### 10.2 `30368` taxonomy

- `d=taxonomy:<namespace>:<term>`; namespace and term each 1–64 lowercase ASCII `[a-z0-9._-]+`.
- required: `schema=org.nosmaps.taxonomy`, `version=1`, `state`, `namespace`, `term`, `label`.
- optional: `description`, `parent` exact taxonomy coordinate.
- label max 80 characters; description max 500; parent cannot self-reference. Cycles are displayed as
  invalid taxonomy edges.
- A taxonomy `term` MAY be offered as a discovery `t` value (§5.1); doing so is a UI affordance, not
  a schema requirement.

### 10.3 `30369` capability claim

**Revised 2026-08-18 against real data (§21.1, §21.2, §21.7). Zero records are published on this
kind, so this is a v1 definition change before first publication — not a version bump and not a
migration (§21.9).** The kind previously read as a *test-result* schema; the real world supplies
*transcriptions* of publisher documents, and `basis` is what lets one kind carry both without either
impersonating the other. The kind remains unpublishable until the read path can validate it (§W7.1).

- `d=conformance:<tool-coordinate-sha256>:<capability-key>`; hash the exact UTF-8 bytes of the
  canonical `30078:<publisher-hex>:<d>` coordinate; derive the capability key by §10.1 from the slug
  form of `capability` (§21.2.4). **The `d` grammar and its 115-byte key budget are unchanged.**
- required: `schema=org.nosmaps.conformance`, `version=1`, `state`, `tool`, `capability`,
  `spec_title`, `registry`, `basis`, `result`.
- conditionally required: `environment_hash` **iff** `basis === "tested"`, and MUST be absent
  otherwise; `source`, `source_text` and `asserted_at` **iff** `basis === "transcribed"`.
- optional: `caveat` (max 500 UTF-8 bytes); `evidence` array of at most 32 `30371` coordinates.
- `tool` is one canonical software coordinate and the event MUST contain exactly one
  `["a", "30078:<publisher>:<d>"]` whose value equals content `tool` byte-for-byte. Mismatch, missing
  tag, duplicate differing tool tag, or a noncanonical coordinate fails validation. *(unchanged)*
- `capability` replaces the former free-form `feature` and has the closed grammar
  `<family> ":" <id> [ "/" <sub> ] [ "@" <scope> ]`, maximum 512 UTF-8 bytes: `family` lowercase
  ASCII `[a-z0-9-]{1,16}`; `id` the identifier **as the source writes it**, uppercased and zero-padded
  to a minimum of two characters, an **opaque ASCII token and never an integer**; `sub` and `scope`
  lowercase `[a-z0-9._-]`, maximum 64 and 32 bytes. Ordering is by codepoint over the uppercased
  minimum-two-character form, which reproduces the sources' own order (`59 < 5A < 60`). Rationale and
  the four observed same-number-different-spec collisions: §21.2.
- `spec_title` is the specification title **as the source wrote it**, verbatim, maximum 200 UTF-8
  bytes. Two claims sharing `(family, id[, sub][, scope])` with different `spec_title` are a
  **collision**: both are rendered, and they MUST NOT share a comparison column (§21.2.2).
- `registry` is `{family, registry, revision}`, naming the snapshot the signer resolved the id
  against; `revision` is a 40-hex commit or the literal `"unpinned"`. `registry_status`
  (`resolved | title_mismatch | not_in_registry | unresolvable`) is **derived by the reader** against
  its own snapshot and is never stored. **A claim whose id is absent from the registry is rendered
  verbatim with its status; it is never dropped and never remapped to a successor NIP** (§21.2.3).
- `basis`: `self_declared | transcribed | tested`. `self_declared` means the signer's pubkey **equals**
  the `30078` coordinate's publisher pubkey; it asserts nothing about ownership and MUST NOT be
  rendered as "official" (§4.3). Claims are **never merged across `basis`**, and no numeric capability
  score or "supports N" figure may be computed from them (§21.1).
- `result` is the closed, case-sensitive enum
  `supported | partial | not_supported | not_applicable | planned | disabled | withdrawn | unknown`,
  replacing v1's `pass | fail | partial | unknown`. Each value is carried by a collected entry;
  `result` MUST be read from the source's prose and **never from a checkbox glyph**, whose polarity is
  project-local and inverts between projects (§21.7).
- environment hash input is canonical JSON of
  `{runtime, runtime_version, os, arch, dependency_lock_hash, config_hash}`, all required strings,
  where absent facts use `"unknown"`. *(unchanged, but now reachable only via `basis === "tested"`,
  because writing it for a transcribed README claim fabricates a test that never ran — §21.1.)*

### 10.4 `30370` observation

- `d=observation:<subject-hash>:<type-key>:<nonce>`; hash the exact RFC-8785 UTF-8 serialization of
  the NFC `subject` string; derive the type key by §10.1; nonce is exactly 16 lowercase base32
  characters.
- required: `schema=org.nosmaps.observation`, `version=1`, `state`, `subject`, `observation_type`,
  `observed_at`, `value`; optional `tool`, `environment_hash`.
- `subject` uses §10.5 syntax; `observation_type` is the complete NFC identifier, maximum 512 UTF-8
  bytes; `observed_at` is an integer; `value` is a scalar or object up to 4 KiB canonical bytes.
- **Registered `observation_type` `org.nosmaps.liveness` (added 2026-08-18, §21.4).** `value` is
  `{result, method, detail?, target?}`: `result` is
  `reachable | unreachable | archived | moved | superseded`; `method` is
  `http | dns | repository-metadata | nip11`; `detail` is at most 200 UTF-8 bytes verbatim from the
  check; `target` is a free absolute URL or `30078` coordinate and is required when `result` is
  `moved` or `superseded`. This is a **schema-field-free addition** — §10.4's `subject` grammar,
  `observed_at`, and `value` cap already carry it. Liveness observations are counted only from
  pubkeys in the viewer's `G` (§6.2), affect display and ordering only, and MUST NOT change the
  listable row set (invariant I9). `target` is deliberately free-form because khatru's successor is a
  Go module path and Iris's is an `htree://` URL; it carries **no** coordinate-migration authority,
  which stays with §11 clause 7.
- If `subject` is an `address:30078:<publisher>:<d>`, content `tool` is required and MUST equal that
  embedded coordinate. Any observation intended for tool detail or comparison MUST carry content
  `tool` and exactly one matching canonical `["a", "30078:<publisher>:<d>"]`. Observations without a
  tool index are outside standard tool-detail retrieval.

### 10.5 `30371` evidence relation

- `d=evidence:<sha256(canonical-subject)>:<relation>:<nonce>`; nonce is lowercase base32 8–32
  characters.
- required: `schema=org.nosmaps.evidence`, `version=1`, `state`, `subject`, `relation`, `object`;
  optional `tools`, `summary`.
- subject grammar is exactly one of `event:<64hex>`, `address:<kind>:<64hex>:<d>`,
  `url:<absolute-https-url>`, `sha256:<64hex>`. `object` uses the same grammar.
- relation closed enum v1: `supports | contradicts | documents | reproduces | supersedes`.
- `summary` max 500. `tools`, when present, is a sorted unique array of at most 16 canonical `30078`
  coordinates. If either `subject` or `object` is an `address:30078:<publisher>:<d>`, that coordinate
  MUST occur in `tools`. The set of software-coordinate `a` tags MUST equal `tools` exactly.
- A `30371` is eligible for a tool's detail or comparison only when that exact coordinate occurs in
  both content `tools` and an `a` tag. Evidence with no related tool index is outside standard
  tool-detail retrieval; clients MUST NOT broad-scan kinds to find it.
- `supersedes` is evidence only and has no coordinate-migration authority (§11).

### 10.6 `30372` review

- `d=review:<sha256(tool-coordinate)>`, therefore one replacement unit per reviewer per tool.
- required: `schema=org.nosmaps.review`, `version=1`, `state`, `tool`, `rating`, `body`.
- rating integer `1..5`; body max 8,000 characters; optional `evidence` max 16 exact event
  ids/addresses.
- `withdrawn` uses rating `1` and an empty body solely to keep the v1 shape stable; the UI excludes it
  from aggregates.
- Content `tool` and the `a` tag MUST agree. The current review winner id is the reaction/comment
  target.

## 11. Coordinate migration authority

Only a newer valid `30078` winner at the **old coordinate**, signed by the same publisher key as that
coordinate, may authoritatively set `superseded_by` to another valid `30078` coordinate. The field is
optional and effective only when the old winner is `state:"withdrawn"` or explicitly marks migration.

1. Parse the exact destination coordinate; a self-loop is invalid.
2. Follow at most `MAX_MIGRATION_DEPTH = 8`.
3. Detect repeated coordinates; any cycle quarantines the redirect chain and leaves coordinates
   distinct.
4. One addressable winner has one destination. Conflicting older destinations lose by winner
   selection but remain audit evidence.
5. If the authoritative old winner is deleted and no newer valid old-coordinate winner remains, its
   redirect is not authoritative.
6. A missing or withdrawn destination leaves a visible "migration target unavailable" state; it does
   not reactivate the old record.
7. Arbitrary `30371 supersedes` relations are evidence only. **A `30267` set containing both
   coordinates carries no migration meaning whatsoever** — curation cannot redirect identity, in
   revision 2 not even for the viewer who follows that curator.
8. The UI shows old and new coordinates, signer, winner id/time, chain, and conflict/quarantine
   status.

## 12. Pagination, reactions, and future timestamps

### 12.1 Winner-before-display pagination

Pipeline order is mandatory, and applies to `30078` discovery pages (§5.1) as well as `30372` reviews:

1. Fetch raw events with the exact filter for the class, overfetching
   `RAW_LIMIT = min(relay max_limit, max(60, desiredUnique * 3))`.
2. Validate signatures/schema/time and collect exact ids and authors. If exact ids were not known
   before this page, issue at most one coalesced kind-5 cleanup REQ per relay for those ids,
   coordinates, and matching authors; merge observed deletions; then group by coordinate and select
   the winner. The page MAY be shown only as provisional/incomplete before cleanup finalizes.
3. Exclude withdrawn winners; order unique winners by the §6.4 key; only then form the page and
   compute aggregates.
4. If fewer unique winners than requested, issue another Backward page per relay with inclusive
   `until = oldestCreatedAt`, maintaining that relay's `boundaryIds` for that timestamp.
5. Same-timestamp events accumulate and dedupe until the relay advances below the boundary. At a
   raw-event, byte, or page cap, stop and mark `incomplete: boundary-saturated` rather than skipping
   or looping.
6. A replacement observed later recomputes the winner and may move or remove a row.
7. Relay timeout, downtime, AUTH, or rejection means `incomplete`. An empty page proves only "no more
   events returned in this round", never global completeness.

NIP-67 `EOSE` hints are not an MVP dependency (§19 records this as carried forward and unverified).

### 12.2 Reaction reduction

For NIP-25 kind `7`, the target is the exact `e` event id. Fetch reactions for the coalesced target
ids; then issue at most one coalesced kind-5 cleanup REQ per relay for newly learned reaction ids and
reactor authors; merge observed deletions; select the latest non-deleted event per
`(reactor pubkey, target event id)` by greatest `created_at`, lowest id tie-break. The panel is
provisional until cleanup finalizes. This is one bounded follow-up, never an N+1 per reaction.

Normalize selected content: `+` or empty → `positive`; `-` → `negative`; a single valid Unicode emoji
grapheme → normalized NFC emoji bucket; anything else → `other`, shown but excluded from
positive/negative totals. A newer selected `-` replaces that user's earlier `+` rather than adding
both. Reactions to old addressable event ids stay attached to that historical version and do not
transfer to the replacement winner. Counts are labelled "observed on configured relays", never
universal totals.

### 12.3 Future timestamp quarantine

On first receipt, record local `received_at`, the source relay, and that relay's observed NIP-11
`created_at_upper_limit` if present. An event is winner-eligible only when:

```text
created_at <= min(received_at + MAX_FUTURE_SKEW,
                  relay_upper_limit_if_known_or_infinity)
```

Otherwise cache only quarantine metadata, never republish it automatically, and show clock-skew
diagnostics. If `created_at > received_at + MAX_FUTURE_HORIZON`, evict or quarantine permanently
under cache policy until explicitly re-fetched; it cannot silently activate.

Re-evaluate on app startup, foreground/resume, system clock change, relay-info refresh, a new event
at the coordinate, and a timer scheduled for the earliest eligibility instant. Revalidation uses the
original `received_at` and the frozen policy version, so advancing `now` alone does not rewrite
receipt history. Tests freeze wall clock and receipt times.

## 13. Screen dependency graph, gap query, and reconnect recovery

### 13.1 Dependency graph and cache/lazy rules

| screen / action | immediate dependencies | cache prerequisite / lazy dependencies |
|---|---|---|
| cold catalog | R1 discovery + viewer kind `3`; R2 `30267` for `G`; R3 gap-fill + cleanup | taxonomy labels may use cache; profiles, reviews, reactions, media are lazy |
| re-rank after follow change | R2 only, with the new `G` | row set unchanged (I7), so no `30078` refetch is required |
| search / filter | local observed events only | no network |
| tool detail shell | round 1: exact tool winner filters plus one coalesced `{"kinds":[30369,30370,30371],"#a":[selectedToolCoordinates]}` filter; round 2: at most one coalesced kind-5 cleanup REQ per relay | candidate-kind and `#a` probes must pass; failures are excluded and marked incomplete; caps apply; unrelated evidence is not fetched |
| comparison | union selected coordinates into the same coalesced `#a` filter, same single cleanup bound | same probes, caps, and lazy tabs; no per-tool or per-card N+1 |
| review tab | round 1: `30372` pages; round 2: at most one coalesced kind-5 cleanup REQ per relay | reactions to current review ids are lazy and coalesced |
| profile popover | exact author kind `0` | zero REQ until opened |
| reaction panel | round 1: kind `7` exact target ids; round 2: one coalesced cleanup REQ per relay | zero REQ until opened |
| bookmark edit | cross-relay `10003` winner collection, then publish and read-back | decrypted only in transient memory |

`limit` is lowered to each relay's observed `max_limit`; selected coordinates are deduplicated and
split only by §9.4 limits. Backward pagination remains inclusive and stops at
`MAX_DETAIL_RAW_EVENTS_PER_RELAY`, `MAX_DETAIL_BYTES_PER_RELAY`, or `MAX_DETAIL_PAGES_PER_RELAY`,
marking `incomplete: detail-cap` rather than scanning beyond the bound.

NIP-01 permits querying indexed single-letter tags such as `#t`, `#a`, and `#d`, but each configured
relay's candidate-kind acceptance and generic tag indexing MUST be live-probed immediately before
implementation. **`#t` indexing on kind `30078` is the single most load-bearing probe in this
design**: if a relay does not index it, discovery on that relay is impossible and the relay is marked
`incomplete: t-index-unsupported`. Curation-derived exact fetches (§5.2) still work there, so the
relay degrades to recall-only rather than being useless. Broad kind scans, arbitrary author
discovery, and any central index fallback are prohibited.

**Carve-out — the viewer's own key.** "Arbitrary author discovery" means enumerating or scanning
for authors the viewer has not already named. An **exact single-author** query for the signed-in
viewer's *own* pubkey — `{"kinds":[30078],"authors":["<self>"],"limit":64}`, as a publisher's
own-records screen needs — does **not** fall under this prohibition and is permitted. It is an exact
match on a key the viewer already holds rather than a scan over a key space, it discovers nothing the
viewer did not themselves publish, and it is the only way to reach a coordinate that withdrawal made
non-listable (§5.4). It remains subject to the same caps, coalescing, chunking, and pagination bounds
as any other query, and it does not license widening `authors` to any other key.

Never put unrelated `authors` and `#d` arrays into one Cartesian-product filter with a low limit.
Filter sets are coalesced across components, deduped, byte-chunked, and lazy tabs issue zero REQs
before opening. Acceptance captures serialized outbound REQ traces and asserts exact logical and
physical counts.

### 13.2 Mandatory gap query

Maintain a high-water mark per `(relay, scopeKey)`:

```text
scopeKey  = hash(canonical filter semantics excluding since/until/limit)
highWater = { created_at, boundaryIdsAtCreatedAt }
```

After initial Backward completion, Forward may start. On **every** disconnect, reconnect, relay
recovery, app resume after connection loss, or filter-scope change — including a change to `G`, which
changes the R2 scope:

1. Pause or replace the affected Forward subscription.
2. Issue a mandatory Backward gap query with inclusive `since = prior highWater.created_at` for the
   old scope; a broadened scope also performs an initial Backward query for newly included
   coordinates or authors.
3. Track EOSE/timeout per relay, merge and dedupe, and exhaust or mark the same-timestamp boundary
   incomplete using §12.1 caps.
4. Update the high-water mark only from accepted events after the gap result is merged; preserve
   boundary ids.
5. Start the new Forward subscription, again with inclusive `since = highWater.created_at`, deduping
   boundary ids.
6. Timeout, AUTH failure, or downtime leaves that relay/scope incomplete and schedules a retry. There
   is no fixed overlap window.

Each affected relay/scope gap query is charged in the reconnect budget (§9.2).

### 13.3 Non-compiling pseudocode

```ts
// Pseudocode only. Package API integration and DOM/window.nostr augmentation are unverified here.
import { verifier } from "@rx-nostr/crypto"

const pool = createRxNostr({ verifier })
pool.setDefaultRelays(["wss://x.kojira.io", "wss://nos.lol"])

// backwardPerRelay, byteChunk, validateDeleteReduce, and markIncomplete are app-owned helpers.
async function coldCatalog(relay, viewerPubkey) {
  const r1 = await backwardPerRelay(relay, byteChunk([
    { kinds: [30078], "#t": policy.discoveryTopics, limit: policy.discoveryLimit },
    ...(viewerPubkey ? [{ kinds: [3], authors: [viewerPubkey], limit: 1 }] : []),
  ]))

  const graph = deriveGraph(r1.events, viewerPubkey)          // §6.2; may be { state: "none" }
  const r2 = graph.state === "none"
    ? { events: [], coverage: "skipped" }
    : await backwardPerRelay(relay, byteChunk([
        { kinds: [30267], authors: graph.pubkeys, limit: policy.setLimit },
      ]))

  const learned = coordinatesFrom(r2.events)                  // §6.6 recall path
  const missing = learned.filter(c => !r1.hasCoordinate(c))
  const r3 = await backwardPerRelay(relay, byteChunk([
    ...groupByAuthor(missing),                                // §5.2, never one REQ per author
    cleanupFilter(r1, r2),                                    // exactly one coalesced kind-5 filter
  ]))

  return validateDeleteReduce([...r1.events, ...r2.events, ...r3.events], {
    maxCleanupReqs: 1,
    coverage: [r1.coverage, r2.coverage, r3.coverage],
  })
}
```

NIP-42 AUTH, candidate-kind acceptance, generic `#t`/`#d`/`#a` indexing, and message limits are not
assumed by this pseudocode; implementation preflight probes them.

## 14. Private bookmarks

### 14.1 Read-modify-write

Kind `10003` is one normal replaceable list per user. Private bookmark read, edit, and publish are
enabled only when the active signer exposes both `nip44.encrypt` and `nip44.decrypt`. If either is
absent, all three operations are disabled and the UI says: "Private bookmarks require NIP-44 encrypt
and decrypt from the active signer." No plaintext, public-tag, or empty-content downgrade is
permitted. Existing ciphertext that cannot be decrypted and merged blocks every write; byte-for-byte
retention alone MUST NOT be described as a successful read or merge.

When both capabilities are present, before editing:

1. Query every configured user read/write relay for kind `10003`, author = self, with enough history
   to collect each relay's candidate; do not accept any single relay's `limit:1` as global truth.
2. Validate and decrypt candidates, then choose the winner by greatest `created_at`, lowest id
   tie-break. Record divergent relay winners.
3. Decrypt private tags in transient memory, apply the edit, preserve unknown valid entries, and
   choose `created_at = max(now, prior.created_at + 1)` only if it does not exceed the minimum known
   write-relay `created_at_upper_limit`; otherwise wait and report a clock conflict rather than
   forging a farther-future time.
4. Immediately before signing, reread winners. If the base id changed, merge set-like independent
   additions and removals, surface non-mergeable metadata conflicts, and retry up to 3 times.
5. Publish to write relays, record each `OK`, then read back the exact id and recompute the winner
   from all relays.
6. If another winner replaced it, merge and retry. On exhaustion, show a conflict with both versions
   and never claim success.

Kind `10003` cannot guarantee a lossless merge for truly simultaneous same-field edits or same-second
disconnected devices. The protocol only detects and retries observable conflicts; users may need
manual resolution.

### 14.2 Encryption and plaintext handling

Private tags use the applicable NIP-44/NIP-51 self-encryption format. Decrypt failure or capability
loss disables edit and publish and preserves the last signed event unchanged; it never republishes
unreadable ciphertext as though merged. Private relay hints are included only with explicit user
acceptance that metadata inside ciphertext still persists in signed events.

Decrypted plaintext, keys, full ciphertext, and private tags MUST NOT enter logs, analytics, crash
reports, devtools snapshots, or persistent debug traces. Keep plaintext in the shortest-lived mutable
buffers practical, overwrite mutable byte arrays on completion or error where the runtime permits,
drop references in `finally`, and document that JavaScript garbage collection prevents guaranteed
zeroization.

## 15. NIP-22 future comments — draft, outside MVP

NIP-22 kind `1111` is not fetched or published in MVP. A later feature must resolve the current
`30372` review winner before creating a thread. For review coordinate
`30372:<reviewer>:review:<toolhash>`, a top-level comment uses uppercase root scope and lowercase
parent scope:

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

A nested reply preserves root `A`/`K`/`P` and points the lowercase parent at the comment
(`["e","<parent-comment-id>",…]`, `["k","1111"]`, `["p","<comment-author>",…]`). For a regular-event
root, `E` replaces `A` and the top-level parent uses lowercase `e`. Filters prefer `#A` root where
live probes confirm uppercase generic-tag indexing, with bounded fallbacks otherwise. This remains a
separately reviewed future design, and its NIP-22 details are carried forward unverified (§19).

## 16. Residual centralisation — what this design could not remove

Stated explicitly, because a design that claims to have removed all central authority and has not is
worse than one that names what is left.

**16.1 The configured relay set is a shipped default.** `wss://x.kojira.io` and `wss://nos.lol` are
constants in the application. Every client must start somewhere, and there is no decentralised way to
learn a first relay from nothing. Mitigation: the list is user-editable, per-relay coverage is always
shown, and no relay can change what a record *means* — only whether it is visible. A later revision
could use NIP-65 outbox relay lists to widen coverage from the viewer's own graph, which would reduce
but not eliminate the bootstrap. **This is bootstrap centralisation, not authority.**

**16.2 The discovery topic string `nosmaps` is an app-chosen token.** Topic discovery requires
agreement on a string, and whoever defines it holds soft naming authority; publishers who do not use
it are invisible to §5.1. Mitigations: `DISCOVERY_TOPICS` is user-editable, coordinates learned from
the viewer's social graph are fetched regardless of `t` (§6.6), and the visibility gap is labelled
rather than hidden. **This is not removable without a global index, which is the thing we refuse to
build.**

**16.3 Kind `30078` has no content schema, so ours is Nosmaps-local.** Verified: NIP-78 defines
`30078` as application-specific data and specifies no content schema for it at all (§19).
`org.nosmaps.software` is therefore a Nosmaps-local profile, and a record another client considers
perfectly valid is quarantined here (§4.2). That follows from the kind rather than from occupying
someone else's number: NIP-78 shares `30078` by construction, and the `nosmaps:` `d` namespace plus
the `nosmaps` `t` tag are exactly the separation the spec expects. Mitigation: quarantine carries a
reason, the raw event stays inspectable, and the only interoperable contract we depend on is the
addressable coordinate form that NIP-51 `a` tags already carry. Authority over the content profile
remains unilateral, which is the largest such piece left in the design; it should be revisited if a
registered kind with a published schema ever fits.

**16.4 Candidate kinds `30368`–`30372` and the `org.nosmaps.schema` `L`/`l` namespace are
self-assigned.** Same reasoning and the same collision-migration plan as §10.1.

**16.5 App-shipped policy constants shape what is seen.** `GRAPH_MAX_FOLLOWS`,
`DISCOVERY_LIMIT_PER_RELAY`, and the detail caps decide what gets truncated. Mitigation: every
truncation is surfaced with its count, and the constants are configuration rather than protocol.

**16.6 NIP-05 verification contacts a publisher-chosen HTTPS host.** It is the only remaining HTTP
call anywhere near this design. Mitigation: it is lazy, opt-in, per-publisher, and display-only — it
can never affect listability, ordering, or counts (§4.3).

**Not centralisation, recorded to prevent confusion:** the viewer's own key and follow graph are a
trust root, but they are *the viewer's*. Nosmaps neither supplies them nor can observe a choice the
viewer did not make.

## 17. Migration note — what the current implementation does that this design removes

**No code changes are made by this document.** This section is the concrete blast radius, verified
against `HEAD = 70e12a0` on 2026-08-17.

`nostr-catalog.js` is a single IIFE with no ES module exports; its whole public surface is the object
assigned to `window.NOSMAPS_CATALOG` at `nostr-catalog.js:1131`. Its only first-party consumer is
`nip-explorer.js:315`, which uses exactly two members: `catalog.loadCatalog` and
`catalog.POLICY.DEFAULT_RELAYS`. `app.js` and `data.js` are entirely uninvolved — `index.html` does
not load the catalog at all, and `app.js:4` reads a static list from `data.js`.

### 17.1 What exists today and is deleted outright

| symbol | location | why it goes |
|---|---|---|
| `validatePointerEvent` | `nostr-catalog.js:195-327` | 133 lines validating a pointer that no longer exists — schema, `state`, `generation`, `x`/`sha256`, `size`, `mime`, `previous`, mirrors, tag/content equality |
| `validateManifestValue` | `nostr-catalog.js:414-450` | manifest top-level keys, pointer-commitment equality, `entries.length === pointer.entryCount`, strict coordinate ordering |
| `validateEntry` | `nostr-catalog.js:399-412` | per-entry `coordinate`/`state`/`event_id`/`fields`, incl. the `active` / `withdrawn` gate at `:407` |
| `validateFields` | `nostr-catalog.js:373-397` | curator-supplied display fields; revision 2 takes display data from the record's own content only |
| `validatePrevious` / `previousEquals` | `nostr-catalog.js:156-172` | the previous-hash chain |
| `verifyManifestBytes` | `nostr-catalog.js:453-468` | size → sha256 → strictParse → canonical → schema |
| `fetchVerifiedManifest` | `nostr-catalog.js:505-585` | the whole mirror fallback loop, including the `GET` at `:536-541` |
| `validateMirror`, `deriveMirrorUrls`, `urlPathHasHash`, `errSlug` | `nostr-catalog.js:174-189`, `471-490`, `492-498`, `500-503` | mirror URL machinery |
| `mergeManifestView` | `nostr-catalog.js:864-883` | flattens `entries[]` into a multi-curator view; replaced by §6.4 counting |
| entry-state listability gate | `nostr-catalog.js:1065-1066` | `activeViews.length === 0 → skip`: today's *entire* withdrawal semantics is "≥1 curator says active". Replaced by §5.4, which consults no curator. |
| display-winner tiebreak by lowest curator hex | `nostr-catalog.js:1067-1069` | there is no curator-supplied display value to break ties between |
| `isValidScope`, `SCOPE_RE` | `nostr-catalog.js:129`, `:51` | scope only existed to namespace pointer `d` values |
| `stats.httpAttempts` / `stats._logHttp` | `nostr-catalog.js:69-72` | HTTP in the data path is zero |
| `POLICY.POINTER_KIND` (`30078`), `POINTER_D_PREFIX`, `MANIFEST_MIME`, `MAX_MIRROR_ATTEMPTS`, `MAX_POINTER_MIRRORS`, `MAX_MANIFEST_BYTES`, `HTTP_TIMEOUT_MS`, `MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ` | `nostr-catalog.js:29-41` | every one is manifest/pointer/HTTP policy |
| `POINTER_SCHEMA`, `MANIFEST_SCHEMA`, `POINTER_L_NAMESPACE`, `POINTER_L_TYPE` | `nostr-catalog.js:46-49` | |

Two constants are already dead and simply stop being dead weight: `POLICY.DISCOVERY_TAG = 'nosmaps'`
(`nostr-catalog.js:30`) and `POLICY.MAX_FUTURE_HORIZON_SEC` (`:39`) are declared and never read.
Revision 2 gives both an actual job — `DISCOVERY_TAG` becomes `DISCOVERY_TOPICS` (§5.1) and the
horizon is used by §12.3. `README.md:64` already describes `t`-tag discovery as the intent; the code
never implemented it.

### 17.2 What exists today and is rewritten

- **`fetchPointers`** (`nostr-catalog.js:727`). The rx-nostr plumbing at `:757-846` survives — the
  dynamic imports of `./dist/rx-nostr.js` and `./dist/rx-nostr-crypto.js` at `:759-762`,
  `createRxNostr({ verifier })` at `:769` (which is where signature verification actually happens,
  *not* in `validatePointerEvent` — see the comment at `:192-194`), and the
  `createRxBackwardReq → emit → over` cycle at `:790-839`. What dies is the `d` derivation at `:734`
  and the filter construction at `:772-784`. Those are the only two REQ filter shapes in the entire
  codebase today:

  ```js
  // nostr-catalog.js:775 — the default path, when no curators are configured
  [{ kinds: [30078], '#d': ['nosmaps:catalog:v1:global'], limit: 64 }]
  // nostr-catalog.js:778-783 — when curators are configured, one filter per curator
  curators.map(cur => ({ kinds: [30078], authors: [cur], '#d': [d], limit: 8 }))
  ```

  They are replaced by the R1/R2/R3 shapes in §9.1. Note that the second shape is exactly the
  per-curator fan-out this revision removes: it grows one *filter* per curator, and revision 2 grows
  one *array element* per curator (§9.3).

- **`loadCatalog`** (`nostr-catalog.js:885`). Steps 3 and 4 at `:970-1058` — cache lookup at `:975`,
  `fetchVerifiedManifest` at `:997`, `cache.putManifest` at `:1015`, `curatorReports` at `:1047-1055`,
  `mergeManifestView` at `:1057` — all die. The merge/dedupe at `:1061-1088` is partly reusable as
  the shape that produces `entries[]`. The status precedence at `:1094-1106`
  (`fresh|stale|incomplete|unavailable`) survives and gains the graph states from §3. The return
  contract `{status, entries[], curators[], coverage, asOf, diagnostics, stats}` **should be held
  stable**, because `nip-explorer.js` depends on it.

- **The IndexedDB cache** (`nostr-catalog.js:587-717`). The API shape survives — `open`,
  `putManifest`, `getManifest`, `getAll`, `wipe`, `deleteDatabase`, `cacheKey` at `:596` — but the
  store name `STORE = 'manifests'` (`:590`) and the record written at `:1015-1025`
  (`{curator, scope, generation, sha256, pointerId, verifiedAt, bytes, entryCount, value}`) are
  manifest-shaped: 6 of those 9 fields die. This needs a `DB_VERSION` bump from `1` (`:589`) with a
  new store keyed by coordinate rather than by `curator:scope`. The exact-generation cache-hit gate
  at `:982` (`cached.sha256 === pointer.sha256 && isFresh(...)`) becomes an
  `event id + created_at` comparison. `isFresh` (`:859`) survives unchanged.

- **The `?curators=` URL override** (`nip-explorer.js:318-321`). Today this is the only thing that
  ever populates the curator list. Under revision 2 it must not become an inclusion input; if it is
  kept at all it maps to the §6.5.6 manual "also count these" list, which affects counts only and is
  labelled as manual.

- **Diagnostics rendering** (`nip-explorer.js:295`). Reads `item.pointerId`, `item.generation`,
  `item.sha256`, `item.verifiedAt` from the `curatorReports` built at `nostr-catalog.js:1047-1055`.
  The first three become meaningless and this line needs rewriting against §8.1's diagnostic list.

- **Entry rendering** (`nip-explorer.js:271-279`, produced at `nostr-catalog.js:1079-1087`). Reads
  `entry.fields.{name,category}`, `entry.stale`, `entry.state`, `entry.coordinate`. `fields` now come
  from the record's own `org.nosmaps.software` content instead of from a curator's manifest, so the
  field names can be kept while the source changes. `entry.generation` and `entry.blobHash` are
  produced but never read by the UI and simply disappear.

### 17.3 What has to be built that does not exist at all

Grep-verified absences in the current tree:

- **kind `30267` appears nowhere.** No curation set fetching, no membership parsing, no count.
- **kind `30078` is never fetched.** It appears only at `nostr-catalog.js:52` as
  `COORD_RE = /^30078:([0-9a-f]{64}):(.{1,192})$/`, used by `isValidCoordinate` (`:147-154`) to
  shape-check a manifest entry string. The coordinate is an opaque display id today — it becomes a
  card id at `nip-explorer.js:276` and is never resolved to an event. **The canonical record of
  revision 2 is currently not retrieved at all.**
- **kind `3` / NIP-02 appears nowhere** outside glossary prose in `data.js:9` and `i18n.js:109`. The
  entire §6.2 social graph is new.
- **NIP-07 is unused.** `window.nostr` appears only inside the vendored `dist/rx-nostr.js` bundle;
  `nostr-catalog.js` constructs `createRxNostr({ verifier })` with a verifier only and never a
  signer. §6.2's identity step is new.
- **kind `5` / NIP-09 is not handled.** No `kinds:[5]` filter, no deletion processing. All of §7.3 is
  new.
- **No `#t`, `#a`, `#e`, or `#p` filter exists anywhere.** Only `#d` is used today.

### 17.4 Trust configuration — correcting a claim about the current code

Revision 1 assumed a trusted-curator set. **The code never implemented one, and its actual default
behaviour is worse than the design in a different direction.** There is no `TRUSTED_CURATORS`
constant anywhere. `opts.curators` defaults to `[]` in both `loadCatalog` (`nostr-catalog.js:888`)
and `fetchPointers` (`:731`), and the gate inside `validatePointerEvent` is a no-op when the list is
empty:

```js
// nostr-catalog.js:205-208
const trusted = opts.trustedCurators;
if (Array.isArray(trusted) && trusted.length > 0) { /* … fail('untrusted-curator') … */ }
```

So in production today, with no `?curators=` in the URL, the wide filter at `:775` accepts a catalog
pointer from **any pubkey at all**. Revision 2 makes this moot rather than fixing it: there is no
pointer, and a `30078` record's authority derives entirely from the coordinate it is signed at
(invariant I2), so "who may publish" stops being a question the client has to answer.

### 17.5 Test blast radius

- `tests/relay-unit.spec.js`: group B (`:139`, `:168`, `validatePointerEvent`), group D (`:298`
  `verifyManifestBytes`, `:342` `validateManifestValue`), group E (`:395` mirror fallback), and group
  F (`:461` IndexedDB rebuild, including `:484` "full rebuild from pointer + Blossom bytes alone")
  are deleted. Group A (`:96`, winner selection) and group C (`:240`, RFC 8785) survive — group A
  becomes more important, since §5.3 is now the core of the design.
- `tests/relay-render.spec.js`: `BLOSSOM_ORIGIN` (`:11`), the signed kind-`30078` **pointer** fixture
  builder (`:67-113`), and the mock Blossom route (`:140`) are deleted and replaced by signed
  canonical `30078` record and `30267` fixtures plus a mock kind `3`.
- New tests required: invariant I7 (logged-out and logged-in row sets are byte-identical), invariant
  I8 (unknown count never renders or sorts as `0`), the §9.2 budget assertions, and graph truncation
  reporting.

## 18. Concepts deleted in revision 2

Deleted, not deprecated and not made optional. None of these appears anywhere above.

**Blossom and HTTP**
- Blossom entirely: BUD-01 retrieval, BUD-02 upload, BUD-04 mirror, BUD-06 upload preflight, BUD-11
  Nostr authorization.
- Kind `24242` authorization tokens, the `t=upload` action, the `x`/`expiration`/`server` tag
  contract, the domain-only server-scope rule, `Authorization: Nostr <base64url-event>`, and the two
  fixed content strings `Upload Nosmaps catalog manifest` / `Mirror Nosmaps catalog manifest`.
- `authorizeManifestWrite` and `validateManifestWriteAuthorization`.
- Mirror hints, mirror ordering, origin deduplication, redirect hash preservation, `MAX_MIRROR_ATTEMPTS`.
- Blossom availability quorum (default 2 servers), anonymous unauthenticated `GET` hash probes, the
  authenticated-mirror-excluded-from-quorum rule, per-server preflight/visibility/`X-Reason`
  diagnostics.
- The publish ordering protocol (build blob → upload → verify quorum → only then sign the pointer)
  and its retry bifurcation (identical signed event to more relays vs. a new generation).
- Separate Nostr and Blossom budgets; the "Blossom HTTP" budget column; `MAX_MANIFEST_BYTES`;
  pointer-vs-Blossom size reconciliation and the 413 handling note.

**The pointer**
- Kind `30078` **in its pointer role** (and its predecessor `30367`): the coordinate
  `nosmaps:catalog:v1:<scope>`, the scope grammar, `DEFAULT_SCOPE`. The kind survives revision 2 as
  the canonical record (§4.2); this role does not.
- Pointer winner selection as a distinct concept, pointer `state`, `generation`, `count`,
  `generated_at`, `size`, `m`/MIME, `x`/`sha256`, `url` mirror tags, and the tag↔content duplication
  rule for those fields.
- The `previous` chain, generation monotonicity, and the `chain-unverified` label.
- The `30367` row in the candidate-`d` byte-budget table and the `30367` schema contract.

**The manifest**
- The canonical manifest blob, its `org.nosmaps.catalog` schema, `entries[]`, entry `coordinate`,
  entry `state` (`active | withdrawn`), entry `event_id`, entry `fields`
  (`name`/`summary`/`category`/`homepage`), `entry_count`, and code-point entry ordering.
- RFC 8785 as a transport or storage format. JCS survives *only* as the byte-exact hash input for
  derived `d` components in §10.1.
- "Verified manifest", "verified generation", and stale-generation fallback as states.
- `MANIFEST_MIME` and the `application/octet-stream` transport-fallback tolerance.

**Curation as a gate**
- The trusted-curator set, `MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ`, and per-curator cold REQ
  filters.
- Curator-local validation, the pure multi-curator merge, `activeCurators` / `withdrawnCurators` /
  `listingEligible` / curator-conflict status.
- Curator-supplied display fields, field provenance `(value, curator, generation, blobHash)`, and the
  curator-trust-priority display tiebreak.
- The `curator_selected` claim level (replaced by viewer-relative `socially_recommended`).
- Key removal/rotation as a trust operation on a curator list.
- Manifest withdrawal as a removal mechanism, and "a valid active entry from one trusted curator is
  sufficient for listing".

## 19. Sources

### 19.1 Re-verified for this revision

Retrieved and read on **2026-08-17** from `github.com/nostr-protocol/nips` at commit
`656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` (repository `master` head at retrieval time; the same
commit revision 1 pinned, re-confirmed rather than assumed). Line numbers are from the files at that
commit.

| claim used in this document | source | verbatim |
|---|---|---|
| single-letter tags are relay-indexed and queried with `#<letter>`; **only the first value of a tag is indexed** | NIP-01 `01.md:84` | "all single-letter (only english alphabet letters: a-z, A-Z) key tags are expected to be indexed by relays… Only the first value in any given tag is indexed." |
| `a` tag coordinate form | NIP-01 `01.md:81` | `["a", "<kind integer>:<32-bytes lowercase hex of a pubkey>:<d tag value>", <recommended relay URL, optional>]` |
| kind ranges; `30000 <= n < 40000` is addressable | NIP-01 `01.md:96-99` | "for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value" |
| kind `3` is replaceable | NIP-01 `01.md:97` | "for kind `n` such that `10000 <= n < 20000 \|\| n == 0 \|\| n == 3`, events are **replaceable**" |
| winner tie-break is lowest event id | NIP-01 `01.md:101` | "In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained" |
| a relay returns only its own latest version | NIP-01 `01.md:103` | "even if the relay has more than one version stored, it SHOULD return just the latest one" |
| `limit` applies only to the initial query | NIP-01 `01.md:149` | "The `limit` property of a filter is only valid for the initial query and MUST be ignored afterwards." |
| kind `3` follow list, tag shape, full replacement | NIP-02 | kind `3`; `["p", <32-bytes hex key>, <main relay URL>, <petname>]`; "every new following list that gets published overwrites the past ones, so it should contain all entries"; fresh follows are appended chronologically |
| kind `5` deletion request; `e`/`a` semantics; not guaranteed | NIP-09 | "Relays SHOULD delete or stop publishing any referenced events that have an identical `pubkey` as the deletion request"; "When an `a` tag is used, relays SHOULD delete all versions of the replaceable event up to the `created_at` timestamp of the deletion request event"; "Deletion requests SHOULD include a `k` tag"; "their request for deletion does not guarantee deletion because it is impossible to delete events from all relays and clients" |
| NIP-11 field names used in §9.4 | NIP-11 `11.md:117-159` | `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, `max_event_tags`, `max_content_length`, `created_at_upper_limit` |
| `t` is a hashtag and MUST be lowercase | NIP-24 `24.md:43` | "`t`: a hashtag. The value MUST be a lowercase string." |
| kind `7` reaction; `+`/empty means like | NIP-25 `25.md:10,14` | "A reaction is a `kind 7` event"; "A reaction with `content` set to `+` or an empty string MUST be interpreted as a 'like' or 'upvote'." |
| kind `30267` is *App curation sets*, members are software-application `a` tags | NIP-51 `51.md:72` | `\| App curation sets \| 30267 \| references to multiple software applications \| "a" (software application event) \|` |
| a `30267` set's members are `a` tags holding addressable coordinates | NIP-51 `51.md:156-168` | example event with `["d","nostr"]` and `["a","32267:7579…:com.example.app1"]` |
| sets are replaceable; editing means publishing a new version; sets are distinguished by `d` and may carry `title`/`image`/`description` | NIP-51 | "Sets are lists with well-defined meaning… users are expected to have more than one set of each kind", each with "a different `\"d\"` identifier" |
| kind `30078` is application-specific data with no content schema of its own, shared by every application — **the canonical record's kind (§4.2); foreign records on it are the specified normal state** | NIP-78 | "arbitrary custom app data"; "some apps do not want or do not need interoperability" |
| the event-kind registry: `3` Follows [02]; **`30078` Application-specific Data [78]**; `30267` App curation sets [51]; `32267` Software Application with an empty NIP column — assigned, and rejected for our use (§4.2) | NIPs `README.md:128, 262, 264, 285` | `\| \`32267\` \| Software Application \| \|` |

Revision 1's separate citation of `nostr-protocol/registry-of-kinds` at commit
`8d3fa7e252452e30fdf4e2917a487c239ef350cf` is **dropped**. It was not re-verified; the kind facts
this document needs were re-verified against the NIPs `README.md` event-kind table instead, which is
cited above with line numbers.

### 19.2 Carried forward but NOT re-verified in this revision

These are used in sections outside the rewrite's scope. They are recorded as implementation-preflight
items, not as design claims, and MUST be re-verified before implementation:

- NIP-22 (kind `1111` comment tag scoping) — all of §15.
- NIP-42 AUTH, NIP-44 encryption, NIP-45 counts, NIP-65 relay lists, NIP-67 relay discovery, NIP-94
  media metadata, NIP-05 identifier mapping.
- Package facts: `rx-nostr@3.7.5` and `@rx-nostr/crypto@3.1.6`, and the `penpenpng/rx-nostr` commit
  `2feeceb936c3e4bf2f6fd79a867b2e35b1cc4fcc` pinned by revision 1. The pseudocode in §13.3 is
  illustrative and is not compile evidence.
- RFC 8785 JSON Canonicalization Scheme, retained only for the §10.1 hash-input derivation.

### 19.3 Deliberately not cited

The Blossom BUD repository `hzrd149/blossom` at commit
`b5bd2801d1763aa635fc8fea7a76597e0eb18990`, cited throughout revision 1, is removed along with every
claim that depended on it (§18).

**Amended 2026-08-18.** That removal stands in full: no Blossom *mechanism* — manifest, blob, mirror,
quorum — is cited anywhere, and §18's deletions are unaffected. The repository re-enters this design
in **two unrelated roles**, neither of which is a mechanism:

1. as a **collected catalogue entry** (`hzrd149/blossom`, a specification repository — the entry for
   which `state`, `homepage` and "NIP support" are all category errors, FINDING 39), and
2. as the **registry for the `bud` spec family** (§21.3), because `hzrd149/blossom-server` claims
   BUD-01…09 and nothing else, and a NIP-only capability model would report it as supporting nothing.

Neither role is pinned or verified in this revision, so both currently resolve
`registry_status: unresolvable` (§21.2.3) — honest, and recorded as **OPEN-12** in §21.11.

### 19.4 Sources introduced by the §21 amendment

Collected 2026-08-18, primary sources only; every value traces to the project's own repository
metadata, README, or site, with per-entry `provenance[]` recording URL, what was read, and the fetch
date. No aggregator, no third-party listing, no inference from observed behaviour.

| artefact | what it is | used by |
|---|---|---|
| `real-catalog-draft.json` | 41 collected entries + 2 recorded as not-collectable, each with `provenance[]`, `nip_support_claim`, and `facts_with_no_home_in_v1_profile` | every decision in §21 |
| `real-catalog-draft-report.md` | 56 numbered FINDINGS with per-entry evidence | §21.0–§21.11 |

Both are untracked working-tree files at `HEAD = 822f56f`. They are **evidence, not normative**: if
they are regenerated and an entry's facts change, the decision that cited it must be re-derived, and
§21 names the entry behind each decision precisely so that check is mechanical.

## 20. Verification and acceptance gates

### 20.1 Static design checks

- No manifest, blob, pointer, mirror, quorum, generation, or previous-hash concept appears anywhere
  in this document.
- **No BUD is used as a Nosmaps storage, transport, or inclusion mechanism anywhere in this
  document.** *(Narrowed 2026-08-18. The original check read "…or BUD concept appears anywhere",
  which §21.3 now violates: `bud` is registered as a **spec family a catalogued project claims
  capability in** — Blossom server's entire capability surface is BUD-01…09 — which is data about a
  third party, not a mechanism. The prohibition this check exists to enforce is revision 1's
  Blossom-manifest mechanism (§0, §18), and that prohibition is unweakened. See §19.3.)*
- No trusted-curator list, no shipped default curator, and no shipped recommendation set appears
  anywhere in this document or in configuration defaults.
- Every catalog-path budget row in §9.2 shows `0` HTTP.
- Closed relay strings are absent; both default relay candidates are present.
- Every claim in §19.1 carries a source and a verification date; every claim not re-verified is in
  §19.2.
- `git diff --check` passes.

### 20.2 Property and fixture tests required before implementation acceptance

1. **Winner selection**: newest-valid-wins; lowest-id tie-break; schema-invalid newest version is
   quarantined and the older valid version wins *with the `quarantined-newer-version` flag set*;
   per-relay divergence resolved by union-then-select; arrival-order permutation produces identical
   output (I4).
2. **Listability (I7)**: for the same observed event set, the row set is byte-identical across
   `graph: none`, `graph: self-only`, `graph: tier1` with 1 follow, and `graph: tier1` with 512
   follows. Only ordering, counts, and badges differ. This is the headline regression test.
3. **Unknown ≠ zero (I8)**: with no viewer pubkey, counts render as `—` and the ordering key omits the
   count components entirely; a real `rec1 = 0` with a known graph renders as `0` and participates in
   ordering. A fixture asserts the two orderings differ when a zero-count row would otherwise sort
   differently from an unknown-count row.
4. **No-graph usability**: logged-out cold load produces a non-empty, ordered, honestly-labelled
   catalog; the banner is present; no default curator, featured list, or fabricated count appears
   anywhere in the output.
5. **Discovery contract**: `t` values must be lowercase; a multi-value `["t","a","b"]` tag is
   rejected with the indexing reason; discovery pagination boundary saturation marks
   `incomplete: discovery-cap`; an empty page never sets `fresh`.
6. **Recall path (§6.6)**: a `30078` record with **no** `t` tag, recommended by one pubkey in `G`, is
   fetched by coordinate in R3 and listed; the same record with an empty `G` is absent from discovery
   and reported as such — not as nonexistent.
7. **Graph derivation**: kind `3` union-then-select across relays; malformed `p` tags dropped and
   counted; deduplication preserves signed tag order; truncation at `GRAPH_MAX_FOLLOWS` is
   deterministic and reported as "N of M"; no kind `3` observed yields `graph: self-only`, never
   "follows nobody".
8. **Curation counting**: one curator with 8 sets containing the same tool counts once;
   `GRAPH_MAX_SETS_PER_CURATOR` truncation is reported; a member removed in the next set version
   lowers the count and leaves the row set unchanged; an empty set is valid and distinguishable from
   no set observed.
9. **Tier 2**: disabled by default; when enabled, seeds are the deterministic first 32 of `G_c` by
   ascending hex; byte cap enforced and reported; `rec2` displayed separately and never summed into
   `rec1`.
10. **Withdrawal**: publisher `state:"withdrawn"` winner suppresses the row; a later `active` winner
    reactivates it; no curator, relay, or configuration can withdraw someone else's coordinate (I2);
    age alone never infers withdrawal.
11. **NIP-09**: `a` deletion covers versions up to the request's `created_at` and no further; deletion
    from a different author is ignored; a rebuild with no kind `5` history available still produces a
    correct current state (deletion is never load-bearing).
12. **REQ budget (§9.2)**: captured outbound REQ traces show exactly 3 logical rounds per relay on
    cold start; physical counts match the §9.4 chunk expression; `0` HTTP requests in the catalog
    data path; at most one cleanup follow-up per relay per target round; no per-curator, per-tool,
    per-card, or per-event request; lazy components issue zero REQs before opening.
13. **Curator-count scaling**: with `C = 1, 8, 64, 512, 2048`, assert logical rounds stay at 3 and
    physical REQs match the §9.3 table.
14. **AP partitions A–C** (§8.3), plus eventual convergence when the newer event set becomes
    observable.
15. **Empty-cache rebuild** with no kind `5` history and a stale graph.
16. **NIP-11 boundaries**: byte, subid, `max_limit`, array, and message-length limits; absent and
    malformed NIP-11 values fall back conservatively and are labelled *assumed*.
17. **Detail and comparison**: exact author-independent
    `{30369,30370,30371 #a:[selectedToolCoordinates]}`; content/tag equality rejection; tool-unrelated
    evidence excluded; live-probe failure excludes the relay and marks `incomplete`; caps and
    pagination honoured.
18. **Migration chain**: depth, cycle, conflicting old winners, deleted authority, unavailable
    destination; and an explicit test that a `30267` set containing both coordinates confers **no**
    migration authority.
19. **Reviews and reactions**: duplicate versions, same-timestamp saturation, timeout, withdrawn
    review, one reviewer per tool, replacement movement; reaction replace/delete/tie/emoji/old-target.
20. **Frozen-time quarantine**: timer, foreground, clock-change, and relay-info re-evaluation; the
    30-day horizon.
21. **Bookmarks**: concurrent devices, same-second tie, conflict retry, read-back failure, upper
    timestamp bound, plaintext and log redaction, NIP-44 capability-disabled UI, no downgrade,
    unreadable-ciphertext write refusal.
22. **Candidate-kind `d` fixtures** for `30368`–`30372`: each grammar's maximum legal value and a
    one-byte-over value, plus common-envelope 191/192/193 UTF-8-byte boundaries; non-ASCII byte
    counting, no truncation, deterministic feature/type key derivation.
23. **Foreign `30078`**: a signature-valid `30078` with non-Nosmaps content is quarantined with
    `foreign-profile`, remains inspectable, and is never reported as nonexistent.

Added by the §21 amendment. Each is fixtured from a **named real entry**, so a regression is
traceable to the fact that motivated the rule.

24. **Capability key is opaque (§21.2.1)**: `nip:5A` and `nip:7D` (Amethyst) round-trip through key,
    slug, and sort without a numeric parse; codepoint ordering yields `59 < 5A < 60` and
    `78 < 7D < 84`, matching the source's own order. Any integer coercion fails the test.
25. **Registry resolution never drops (§21.2.3)**: `nip:12` (nostr-rs-relay, nostream, Damus,
    YakiHonne) and `nip:91` (nostr-rs-relay, a PR number) render as `not_in_registry` rows carrying
    the claim verbatim; assert they are **never** absent from output and **never** remapped to
    `nip:01`. `bud:01` (Blossom server) renders `unresolvable` with its claim intact.
26. **Same-number collision (§21.2.2)**: two claims at `nip:15` with `spec_title` "End of Stored
    Events Notice" (nostr-rs-relay) and "Nostr Marketplace" (Amethyst) render as a collision and
    **never share a comparison column**. Repeat for `nip:22`, `nip:43`, `nip:85`.
27. **Liveness neutrality (I9, §21.4)**: for the void.cat fixture (repo archived, `url:` DNS failure),
    the listable row set is byte-identical with zero, one, and eight counted liveness observations;
    only the derived liveness value and ordering differ. With `graph: none` the value is `unknown`,
    never `dead`. Mutiny Wallet's two contradicting subjects (`archived` repo, `reachable` site) both
    render; neither is reconciled away.
28. **`result` is read from prose, not glyphs (§21.7)**: a transcriber fixture over Shopstr
    (`- [ ]` = partial), Snort (`- [x]` = partial, `- [ ]` = not_supported), Amber (`- [x]` inside a
    TODO = planned), nostr-rs-relay (`- [ ]` = disabled) and nostream (`- [ ]` = withdrawn) asserts
    that deriving `result` from checkbox state alone produces a wrong value for at least four of the
    five, in both directions. `unknown` is never rendered as a negative or ordered as zero (I8).
29. **Free topics and empty summary (§21.6, §21.5)**: a record with `t=commerce` (Shopstr) renders
    the string `commerce`, not `unknown`; a record with only `t=nosmaps` renders `unknown`; a record
    with four topics (Nostrcheck server) round-trips all four. A record with `summary: ""` (Olas) is
    valid, listable, and renders "no summary published"; a record with `summary: "Unknown"` is
    accepted by the validator and MUST be flagged by the authoring path (§W2), because the schema
    cannot distinguish it from content.

### 20.3 Implementation preflight

Live-probe both default relays for reachability, NIP-11 fields, AUTH behaviour, `OK` semantics,
message and event limits, query limits, and read-back visibility. Probe generic tag indexing
specifically for:

- **`#t` on kind `30078`** — load-bearing for discovery (§13.1); failure marks the relay
  `incomplete: t-index-unsupported` and degrades it to recall-only;
- `#d` on kinds `30078` and `30267`;
- `#a` on kinds `30369`–`30371`, plus uppercase-tag behaviour for the §15 future work;
- `authors`-array size behaviour with 128, 512, and 2,048 entries, which is what §9.3 depends on;
- candidate-kind reads and writes in a safe test namespace.

A relay failing a probe is excluded from the affected dependency and reported `incomplete`. No broad
kind scan, no arbitrary author discovery, and no central-index fallback is permitted under any probe
outcome.

TypeScript acceptance requires an exact lockfile fixture, project DOM libs, explicit `window.nostr`
type augmentation, `tsc --noEmit`, and the real project build. Pseudocode in this document is not
compile evidence.

## 21. Capability, liveness, and taxonomy — revised against real data (2026-08-18)

### 21.0 Why this section exists, and what evidence it is built on

§4.2 through §10 were written before any real record existed. On 2026-08-18, 41 entries were
collected from primary sources only — each project's own repository metadata, README, or site — and
recorded in `real-catalog-draft.json` with per-entry `provenance[]`, plus 56 numbered findings in
`real-catalog-draft-report.md`. Two further entries were recorded as *not collectable*.

That collection is the evidence base for this section. **Every rule below names the entry that forced
it.** No rule here is justified by a hypothetical, and where the real data did not settle something it
is left OPEN in §21.11 with the evidence that would settle it.

The headline result is a negative one and is stated first, because it constrains everything else:

> **The `org.nosmaps.software` v1 content profile does not change, and there is no `version` bump.**
> Not one of the seven decisions below adds, removes, or retypes a key in §4.2 rule 2. The real data
> broke the *candidate* kinds (§10.3, §10.4), the *topic vocabulary* (§5.1), and one *reading* of
> §4.2 rule 2 — not the canonical record. §21.9 states this in full, with what a bump would have cost.

**Published-record count: zero.** No write path exists — both design documents are marked
"design only; no implementation in this phase", and §W7.1 confirms this slice publishes nothing yet.
The only live relay probe recorded in this repo (`STATUS-revision2.md`, both default relays) found
**0 events carrying a `d` that begins `nosmaps:`**. There is therefore **no migration to define**: no
record exists that any rule below could invalidate. Every "before first publication" claim in this
section rests on that, and if a record is ever observed before these rules land, the claim is void and
this section must be re-derived.

**Scope note.** §21.1–§21.3 and §21.8 revise the *candidate* kinds `30369` and `30370`. Those kinds
have no read-side validator (§W7.1, §W7.3) and remain unpublishable under the §W7.1 ordering rule:
*a kind becomes publishable only after the read path can validate, select, and render it.* Defining
their schema correctly does **not** unblock them. It stops the submit form from being built around a
shape that cannot render — which is the whole reason this revision happens before §W2 is implemented.

---

### 21.1 DECISION R1 — a NIP claim lives in a separate signed record, never inside the software record

**Decision.** A capability claim is a kind `30369` event (§10.3), signed by anyone, carrying a
required `basis` field that says how the signer came to hold it. It is **not** a field of the `30078`
record, in v1 or any later version. §4.2 rule 2's key set is unchanged and §W2.4's "no NIP support
matrix" stands, now with a positive reason rather than only a mechanical one.

**Why not a field in the record.** Four collected entries each independently rule it out.

1. **Alby Browser Extension** — its README contains **zero occurrences of the string "NIP"**, while
   its own repository description says "key signer for Nostr". The capability is real and the
   publisher does not state it. A field inside the software record can only ever hold the record
   publisher's view, so this project's NIP-07 support would be permanently unrecordable. A separate
   signed record lets a third party record it *as a third party's claim*, which is the honest shape.
2. **Amethyst** — one README, one NIP, **two answers**: a second "NIP Support" table marks NIP-46
   "Full" on Android and "Partial" in commonMain, and NIP-03 "Full" on Android and "No" in
   commonMain, while the same README's checklist reports both as `[x]`. A single-valued field in a
   replaceable record cannot hold both. Two `30369` records at different `scope` values can (§21.2).
3. **Alby Hub** — its README section is titled "NIP-47 **Supported Methods**" and carries a
   per-method table (`info` event, `pay_invoice`, …). "Alby Hub supports NIP-47" is not the fact;
   "Alby Hub supports these NIP-47 methods" is. Sub-NIP granularity needs a key space, not an array
   slot (§21.2).
4. **strfry** — the truthful, machine-readable claim for relay software is the `supported_nips` array
   of a **deployed instance's** NIP-11 document, a property of each deployment, not of the software.
   Its README says only "Supports most applicable NIPs: 1, 2, 4, 9, 11, 28, 40, 42, 45, 70, 77".
   A deployment fact cannot live in a record whose coordinate identifies software. It is an
   observation with a `url:` subject (§21.4, §10.5 subject grammar).

**Why not a new kind.** `30369` already exists in §10.3, already requires the exact tool `a` index
(§4.1 row, §20.2 item 17), and already carries `result: pass | fail | partial | unknown`. Minting a
second capability kind alongside it would be two mechanisms expressing one fact, which is the exact
failure §0 rewrote revision 1 to remove.

**By whom — publisher self-claim versus third-party observation.** Both, in one kind, separated by a
**required** `basis` enum and never merged in display:

| `basis` | meaning | required alongside | evidencing entry |
|---|---|---|---|
| `self_declared` | the signer's pubkey **equals** the `30078` coordinate's publisher pubkey, asserting about their own record's subject | nothing further | none yet — zero records published, so zero self-declared claims exist. This is the shape §W2 will eventually produce. |
| `transcribed` | the signer read a document they did not sign and is repeating it | `source` (HTTPS URL), `source_text` (the verbatim line), `asserted_at` | **Damus** — the claim is 10 lines of a README the collector did not author; the README "has no checkboxes and no status column: every line is an unqualified assertion", and that qualifier is only recoverable from `source_text`. |
| `tested` | the signer ran the software | `environment_hash` (§10.3's existing definition) | **none of the 41.** Zero entries came from a test run. This is why `environment_hash` becomes conditional — see below. |

`self_declared` is defined **coordinate-locally**, by pubkey equality with the coordinate, and MUST
NOT be rendered as "official". §4.3 already forbids exactly that inference ("The UI MUST NOT say
'official' solely because `d` resembles reverse DNS…"), and §4.3's `self_asserted` level is the
precedent this reuses: it means *this key signed it*, nothing more. §4.3's closed level list is
**not** extended — those levels are about *tool identity*; `basis` is about *capability provenance*.
Two orthogonal axes, two vocabularies, stated here so a later reader does not merge them.

**`environment_hash` becomes conditional, and that is a schema change to `30369` v1.** §10.3 requires
it unconditionally, with absent facts written `"unknown"`. Against the real data that produces a
fabricated test result: **18 of the 41 entries** carry a README NIP list and **none** of them is a
test run with a runtime, os, arch, or dependency lock. Writing `{runtime:"unknown", os:"unknown",
arch:"unknown", …}` for all of them makes every real claim indistinguishable from a genuine test whose
environment was not captured. `environment_hash` is therefore required **only** when
`basis === "tested"`, and MUST be absent otherwise. See §21.8 for the full revised contract.

**Consistency with the read design's layers.** §4.3 (identity claim levels), §10.3 (conformance
claim), §10.4 (observation), and §10.5 (evidence relation) already separate fact / claim / observation.
This decision uses them as written and adds nothing to the stack: the software record is the fact
(§4.2), the capability claim is the claim (§10.3), the deployment or liveness check is the
observation (§10.4), and the URL it was read from is the evidence (§10.5 `url:` subject). The one
thing that changes is that §10.3's contract was written as a *test-result* schema and the real world
supplies *transcriptions*; `basis` is what makes the same kind carry both without either
impersonating the other.

**Display rules the UI MUST honour.**

- A `transcribed` claim signed by pubkey X about Damus is **X's claim**, never "Damus says". The
  signer is named in the row.
- Claims are **never merged across `basis`**. A `tested` fail and a `transcribed` supported are two
  rows, both shown, not reconciled.
- **No numeric capability score, ever.** Amethyst's README claims 84 NIPs and Damus's claims 10.
  That ratio measures README verbosity, not capability, and any "supports N NIPs" figure or sort key
  would present it as if it measured capability.
- Retrieval stays author-independent — §20.2 item 17's exact
  `{30369,30370,30371 #a:[selectedToolCoordinates]}` is unchanged. Only *aggregation order* is
  viewer-relative: `self_declared` first, then claims signed by a pubkey in the viewer's `G` (§6.2),
  then the rest, each group labelled. This is D4/D5 applied to a new signal, and like curation it
  MUST NOT change which capability rows exist — only their order and grouping.

---

### 21.2 DECISION R2 — the capability key is `family:id`, the registry is pinned, and an unresolvable id is rendered, never dropped

**Decision.** A bare NIP number is not the key. The key is:

```text
capability = <family> ":" <id> [ "/" <sub> ] [ "@" <scope> ]
```

- `family` — lowercase ASCII `[a-z0-9-]{1,16}`, the spec family (§21.3).
- `id` — the identifier **exactly as the source writes it**, stripped of the family prefix and
  separators, uppercased, and zero-padded to a minimum of two characters: `01`, `15`, `5A`, `7D`.
  It is an **opaque ASCII token, never an integer**.
- `sub` — optional, lowercase `[a-z0-9._-]{1,64}`, a named part of the spec below whole-spec
  granularity.
- `scope` — optional, lowercase `[a-z0-9._-]{1,32}`, the source's own scope word.

Content also carries **`spec_title`** — the title as the source wrote it, verbatim, ≤ 200 UTF-8
bytes — and **`registry`**, the snapshot the signer resolved the id against (§21.2.3).

**21.2.1 Why `id` is an opaque token and not a number.** **Amethyst** claims **NIP-5A** ("Pubkey
Static Websites") and **NIP-7D** ("Threads"). Any integer key, any numeric sort, and any
zero-padded-numeric coercion breaks on these two values. `data.js`'s `nipCatalog` uses `"01"`-style
zero-padded *strings* (`data.js`, `nipCatalog[].number`), which is the right type and the wrong
alphabet — it cannot hold `5A`.

Ordering is by **codepoint over the uppercased, two-character-minimum form**. This is not a
convenience: it reproduces the source's own order. Amethyst's README lists `59, 5A, 60` and
`78, 7D, 84`, and codepoint order over `59 < 5A < 60` and `78 < 7D < 84` gives exactly that, because
`'9' < 'A'` and `'5' < '6'`. No numeric parse is needed anywhere, and none is permitted.

**21.2.2 Why `spec_title` is required, and what a collision renders as.** The same number denotes
different specifications across primary sources. Four collected collisions, all between two current,
publisher-authored documents:

| id | one source | the other source |
|---|---|---|
| `15` | **nostr-rs-relay** README: "NIP-15: End of Stored Events Notice" | **Amethyst** README: "Nostr Marketplace (NIP-15)" |
| `22` | **nostr-rs-relay** README: "Event created_at limits" (qualified "future-dated events only") | **Amethyst**, **NDK**, **Ditto**: "Comment" |
| `43` | **nostream** README: "invite codes" | **Amethyst** README: "Relay Access Metadata and Requests" |
| `85` | **Shopstr** README: "Reviews" | **Amethyst** README: "Trusted Assertions" |

Rule: two claims sharing `(family, id[, sub][, scope])` but carrying **different `spec_title`** are a
**collision**. The UI MUST render them as a collision — both titles, both signers, both sources —
and MUST NOT place them in the same comparison column. Without this, a per-NIP comparison grid shows
nostr-rs-relay and Amethyst as "supporting the same thing", which is false for all four rows above.

Collision detection deliberately requires **no external registry**: both titles are in the claims
themselves. That is what makes the rule implementable today.

**21.2.3 Withdrawn, renumbered, and never-merged ids — recorded, resolved, never dropped.**
Claims against ids that are absent from the registry are not an edge case. **nostr-rs-relay** claims
NIP-12, 15, 16, 20 and 33 — *five of its fifteen claims* — all merged into NIP-01 and deleted from the
registry. **nostream** claims the same five. **Damus** and **YakiHonne Web App** each claim NIP-12.
**nostr-rs-relay** additionally claims "NIP-91: AND operator for filters", linking to
`nostr-protocol/nips` **pull request #1365** — a number that exists only in a proposal. **Coracle**
claims "NIP 87 closed groups", not in the merged registry.

The `registry` field pins what the signer resolved against:

```json
{"family": "nip",
 "registry": "github.com/nostr-protocol/nips",
 "revision": "656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab"}
```

That commit is not invented here: §19.1 already pins it, re-verified 2026-08-17, and it is the same
commit `data.js`'s `nipCatalog[].source` URLs cite. When a source does not pin a revision — and
**none of the 18 collected sources does** — `revision` is the literal `"unpinned"`, and the claim is
still valid.

Resolution is performed **by the reading client against its own pinned snapshot**, and produces a
derived, never-stored `registry_status`:

| `registry_status` | when | UI MUST show | evidencing entry |
|---|---|---|---|
| `resolved` | id present in the client's snapshot **and** `spec_title` matches it | the registry title | Damus `nip:01` |
| `title_mismatch` | id present, `spec_title` differs | **both** titles, marked as disagreeing with the snapshot | nostr-rs-relay `nip:15` ("End of Stored Events Notice") against the snapshot's current NIP-15 |
| `not_in_registry` | id absent from the snapshot | the claim verbatim, plus "claimed against `nip:12`, which is not in the pinned registry snapshot `656cecc…`" | nostr-rs-relay / nostream / Damus / YakiHonne `nip:12` |
| `unresolvable` | the client holds no snapshot for `family` | the claim verbatim, plus "no registry snapshot for family `bud`" | Blossom server `bud:01` (§21.3) |

**A claim is never dropped, never silently remapped, and never merged into its successor.** Mapping
`nip:12` to `nip:01` because the registry merged them would override a current primary source, and
the brief for this collection forbids that; dropping it would report a project as claiming less than
it claims. Both are fabrications in opposite directions. Rendering the unresolved claim verbatim with
its status is the only option that adds nothing and removes nothing — and it is D7 ("Unknown is never
invented") applied to a fifth kind of unknown.

`nipCatalog` lookup in `nip-explorer.js` is keyed by `nipByNumber`, which returns `undefined` for
`"12"` and for `"5A"`. Today that yields a row that quietly renders nothing. Under this rule it MUST
render as a `not_in_registry` / `unresolvable` row. That is a code amendment (§21.10 item 3).

**21.2.4 `sub` and `scope`, and why they cost no `d` grammar change.** §10.3's
`d = conformance:<tool-sha256>:<feature-key>` allows 115 bytes for the feature key, and §10.1 already
specifies the derivation: use the source value unchanged when it is a lowercase ASCII slug matching
`[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?` and fits, otherwise `sha256-<64hex>`. The capability key's slug
form substitutes `:` → `.`, `/` → `-`, `@` → `.`, then lowercases:

| capability | slug (the §10.1 feature key) | bytes | evidencing entry |
|---|---|---|---|
| `nip:01` | `nip.01` | 6 | Damus |
| `nip:5A` | `nip.5a` | 6 | Amethyst |
| `nip:46@android` | `nip.46.android` | 14 | Amethyst — "Full" on Android |
| `nip:46@commonmain` | `nip.46.commonmain` | 17 | Amethyst — "Partial" in commonMain |
| `nip:47/pay_invoice` | `nip.47-pay_invoice` | 18 | Alby Hub |
| `bud:01` | `bud.01` | 6 | Blossom server |

Every one matches §10.1's slug grammar and fits inside 115 bytes, so §10.3's `d` grammar is
**unchanged** and the `sha256-` escape hatch stays available for anything exotic. `id` is uppercased
in content and lowercased in the slug; that fold is lossless for every id observed
(`[0-9A-F]`-shaped), and a family whose ids are case-significant MUST use the `sha256-` form.

**One replacement unit per (author, tool, capability).** `basis` is deliberately **not** part of the
key. If a signer transcribes a README and then tests the software and disagrees, they publish one
claim carrying their current position and current `basis` — replacement, not accumulation. This
matches §10.6's "one replacement unit per reviewer per tool" and keeps `d` stable.

---

### 21.3 DECISION R3 — non-NIP spec families are in scope, expressed by the `family` component

**Decision.** `family` is a first-class component of the capability key, not a NIP-shaped
afterthought. v1 registers three families with the evidence that put each one there, and leaves the
set open:

| `family` | registry | evidencing entry |
|---|---|---|
| `nip` | `github.com/nostr-protocol/nips` @ `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` (§19.1) | 18 entries |
| `bud` | `github.com/hzrd149/blossom` — **Blossom Upgrade Documents** | **Blossom server** claims BUD-01, 02, 03, 04, 05, 06, 08, 09 and its only NIP mentions are incidental ("BUD-08 — nip94 field in blob descriptors", "BUD-09 — … accepting NIP-56 kind:1984 events") |
| `lud` | Lightning LUD specifications | **NDK** annotates its NIP-57 line "(LUD06, LUD16)" |

Any other family is expressed as a reverse-DNS ASCII token (e.g. `org.cashu.nut`) and resolves to
`registry_status: unresolvable` until a snapshot exists for it (§21.2.3). It is still **published,
stored, displayed, and comparable within its own family**.

**Why not "NIP-only, out of scope".** Blossom server's *entire* capability surface is BUDs. Under a
NIP-only model its `nip_support_claim` is `Unknown` and the project renders as supporting nothing,
which the collection report states flatly is "the opposite of the truth". The brief's constraint —
such a project must not read as "supports nothing" — is therefore not satisfiable by declaring
non-NIP families out of scope, because the project's real, publisher-documented capability surface
would be the thing declared out of scope.

**What the UI MUST show, in three distinct cases.** These are three different facts and the UI MUST
NOT collapse them:

1. **Claims exist, none in the requested family.** Blossom server: 8 `bud:` claims, 0 `nip:` claims.
   Render "8 capability claims — BUD family. No NIP claims recorded." In the NIP explorer's per-NIP
   filter the project is **out of family**, rendered distinctly from both "supported" and
   "not supported", and MUST NOT be counted as a NIP-supporting-zero row.
2. **No claim of any family exists.** This is **23 of the 41 entries**, including nostr-tools,
   rust-nostr, go-nostr, nak, Gossip, Iris, noStrudel, Olas, Zeus, Pokey, and the Alby Browser
   Extension. Render §3's `unknown` — "no capability claim published" — never "supports nothing" and
   never an empty checklist that reads as a set of negatives.
3. **A claim exists and says no.** Snort explicitly lists NIP-03, 14, 39 and 40 as unsupported;
   Shopstr lists NIP-42, 58, 61; Gossip's README states "the options currently are NIP-32, NIP-56, and
   NIP-72, but none of these are defined well enough". These are `not_supported` results (§21.5) and
   are a **stronger** statement than case 2, not a weaker one.

**Conflict with §20.1, and which side changes.** §20.1's static check reads "No manifest, blob,
pointer, mirror, quorum, generation, previous-hash, or **BUD** concept appears anywhere in this
document." **§20.1 must change, not this decision.** That check was written to keep revision 1's
Blossom-manifest mechanism from returning (§0, §18) — it prohibits a *storage and transport
mechanism*. Decision R3 introduces BUD only as a **spec family that a catalogued project claims
capability in**, which is data about a third party, not a Nosmaps mechanism. §20.1 is narrowed
accordingly (edit applied). §19.3 likewise moves `hzrd149/blossom` from "deliberately not cited" to a
cited entry — as the BUD family registry and as a collected catalogue entry — and the removal of
every *mechanism* claim that depended on it is unaffected (edit applied).

---

### 21.4 DECISION R4 — liveness is a third-party observation on kind `30370`; `state` stays `active | withdrawn`

**Decision.** `content.state` is **not** extended. Deadness is expressed as a kind `30370` observation
(§10.4) with a registered `observation_type` of `org.nosmaps.liveness`, signed by anyone, counted only
from the viewer's `G`, and affecting **display and ordering only** — never listability.

**Why extending the enum cannot work, proved by one entry.** **void.cat**: the repository is archived
(last push 2024-09-26) and `https://void.cat` **fails DNS resolution** — `curl` returns
"Could not resolve host". The software is gone and the service is gone. §7.1 permits only the
coordinate's own pubkey to change `state`, and "ceasing to publish is not retraction". So adding
`dead` to the enum would produce a value that **only the party who has demonstrably stopped acting is
permitted to publish**. The one entry that most needs the value is the one entry structurally
guaranteed never to carry it. That is not a gap in the enum; it is proof that liveness is not a
property the record's own `state` field can hold.

**The invariant is preserved exactly.** §5.4 is unchanged: *a coordinate is listable iff a winner
exists and its `state` is `active`.* No liveness observation, from anyone, by anyone, in any quantity,
can remove a row. This gets a named invariant of its own, parallel to I7 and testable the same way:

> **I9 — Changing the set of observed liveness observations MUST NOT change the listable row set.**
> Only ordering, badges, and the derived liveness value differ.

**The subject is a URL or a coordinate, and that is what makes contradictions representable.**
§10.5's subject grammar — reused by §10.4 — already admits `url:<absolute-https-url>`,
`address:<kind>:<64hex>:<d>`, `event:<64hex>` and `sha256:<64hex>`. **Mutiny Wallet** is the entry
that proves the subject must be finer-grained than the tool: its archived repository says the code is
frozen while `app.mutinywallet.com` serves "Mutiny is a self-custodial lightning wallet that runs in
the browser" in the present tense, both primary, both current. Under one liveness field per tool the
design would need a source-precedence rule and would have to pick a winner between two true facts.
Under per-subject observations it needs neither:

```text
subject: url:https://github.com/MutinyWallet/mutiny-web   value.result: archived
subject: url:https://app.mutinywallet.com                 value.result: reachable
```

Both are shown. Nothing is reconciled. The contradiction *is* the finding, and it renders as one.

**`value` shape** (a §10.4 `value` object, ≤ 4 KiB canonical bytes):

```json
{"result": "reachable | unreachable | archived | moved | superseded",
 "method": "http | dns | repository-metadata | nip11",
 "detail": "<= 200 UTF-8 bytes, verbatim from the check>",
 "target": "<optional; absolute URL or 30078 coordinate; required when result is moved|superseded>"}
```

Each `result` value is carried by a collected entry, and none is speculative:

| `result` | evidencing entry | the observed fact |
|---|---|---|
| `unreachable` | **void.cat** | `https://void.cat` — `curl: (6) Could not resolve host` |
| `archived` | **void.cat**, **Mutiny Wallet**, **khatru** | repository archived; khatru's last push 2025-09-22 |
| `reachable` | **Mutiny Wallet** | `app.mutinywallet.com` serves the product page, HTTP 200 |
| `moved` | **Flotilla** (recorded in FINDING 15/35, not collected as an entry), **Iris** ("Main development is on decentralized git: `htree://npub1xdhnr…/iris-client`"), **rust-nostr** (org renamed to `nostrdevkit`) | canonical source is elsewhere |
| `superseded` | **khatru** | README banner: "This repository is in maintenance mode and adventurous programmers are encouraged to try `fiatjaf.com/nostr/khatru@master` instead" |

`moved` and `superseded` deliberately carry a free-form `target`, because khatru's successor is a **Go
module path**, Iris's is an `htree://` URL, and Flotilla's is a Gitea instance. §11's `superseded_by`
accepts only a `30078` coordinate and is effective only when the old winner is `withdrawn` — neither
condition holds for any of the four, so all four migrations are currently inexpressible. An
observation with a free `target` records them without touching §11's coordinate-migration authority,
which stays exactly as written. This does **not** resolve OPEN-2 (§21.11).

**Who counts.** Same rule as curation, for the same reason: **only pubkeys in the viewer's `G`**
(§6.2/§6.3). Anyone may sign a liveness observation and all are fetched (§20.2 item 17 retrieval is
unchanged), but only counted signers drive the derived display value. This is D5 — trust is the
viewer's — and it is what makes the "no third party can de-list a publisher" guarantee hold in
practice as well as in principle: an observation from outside your graph cannot paint a project dead
on your screen, and an observation from inside it cannot remove the row either (I9).

**The honest consequence, stated rather than hidden:** with `graph: none` (§3), void.cat's liveness
renders `unknown`, not `dead`, even though the DNS failure is a fact. A logged-out viewer sees the
row with no liveness verdict. That follows from D5 and D7 and is the same trade §6.5 already accepts
for recommendation counts — an unknown is rendered as unknown, never as a value nobody vouched for.

**Two axes, not one — and this is where `data.js` is wrong.** `data.js` ships a single
`status: active | stale | dead | unknown` per tool. Two independent facts are conflated in it:

- **record freshness** — derived from the winner's `created_at` against `RECORD_AGE_WARN_AFTER`
  (§21.8). Always computable, needs no graph. It says *the catalogue record has not been re-signed*,
  and §7.1 already forbids inferring withdrawal from it. It says nothing about the project.
- **project liveness** — `unknown` by default; otherwise the newest counted observation per subject.
  It says nothing about the record.

FINDING 2 is exactly this conflation: `created_at` is when the *record* was signed, and
`30370.observed_at` is when the *fact* was checked, and **Mutiny Wallet** shows they can be years
apart and both current. The two MUST be labelled separately and MUST NOT be merged into one badge.
That is a code amendment (§21.10 item 4).

---

### 21.5 DECISION R5 — `summary` stays required, and the empty string is the honest absent form

**Decision.** `summary` remains a **required key** in §4.2 rule 2. Its **value MAY be the empty
string**, and `""` is the normative form for "no publisher-authored summary exists". A
cataloguer-authored placeholder — `"Unknown"`, `"N/A"`, `"No description"` — is **forbidden**.
`name` stays required and non-empty.

**The evidencing entry.** **Olas** (`pablof7z/olas`): the GitHub repository description is the literal
string `"Guess."`, and the entire README body is Maestro end-to-end-test setup instructions. There is
no publisher-authored statement of what Olas is. The collector, reading "required", wrote
`"summary": "Unknown"` and correctly flagged the record as invalid.

**The record was never invalid, and that is the actual defect.** `validateSoftwareEvent` requires the
*key* and accepts any string including `""` (`nostr-catalog.js:316-318`, `:323` —
`typeof c.summary !== 'string' || charLength(c.summary) > 1000`), and §W2.2 already documents this
("key always present; text may be empty"). §4.2 rule 2 says "required" without saying required-key
versus required-value, and a careful reader of §4.2 alone read it the stricter way and fabricated a
value. The rule is now explicit (§4.2 rule 2b, applied).

**Why `""` and not `"Unknown"`.** `"Unknown"` is a nine-character English string sitting in a
monolingual field (FINDING 20 — Rabbit's README is entirely Japanese and Nosmaps ships a Japanese UI).
It is indistinguishable from a project whose summary genuinely is that word, it is not translatable by
the i18n layer, and it renders as content. `""` is machine-detectable, language-neutral, and maps to
§3's `unknown` state, which the UI already knows how to render distinctly from a value.

**What the record does.** It is valid, listable, and shows the row with "no summary published" — the
project is not excluded from the catalogue for its README's shape. Recording Olas's own `"Guess."`
verbatim is **equally conformant**, because it is publisher-authored text; the schema takes no view
between the two. What it forbids is the third option the collector was pushed into.

**Why `summary` is not made optional.** Making the key optional would be a `version` bump (the v1
profile rejects unknown keys and requires this one), for zero gain: `""` and an absent key render
identically, and an absent key would let a form omit the field silently rather than showing an empty
one. The bump is not worth buying a second way to say the same thing. §21.9.

---

### 21.6 DECISION R6 — the topic vocabulary is a seed of seven, derived from the 41, and free topics render as themselves

**Decision.** `t` topics are a **multi-valued, open** vocabulary. v1 ships a **seed of seven** and
every other topic is a free lowercase string that the UI renders **verbatim as itself**, never coerced
into a seed term and never rendered as `unknown`.

**The seed, and what put each term in it.** Six are the terms `nip-explorer.js` already maps
(`clients`, `relay`, `identity`, `media`, `analytics`, `dev`). Exactly one is minted, and only because
the data clustered:

> **`wallet`** — **Zeus** ("A mobile Bitcoin wallet fit for the gods."), **Alby Hub** ("Your own
> Bitcoin Lightning node"), **Mutiny Wallet** ("a self-custodial lightning wallet that runs in the
> browser"), **Alby Browser Extension** ("The Bitcoin Lightning Browser Extension"). Four of 41
> entries, each described as a wallet **by its own publisher**.

All four were filed under `identity` in the collection, which the report states plainly was "the least
wrong of six… a data error I am reporting rather than hiding". With `wallet` present, `identity`
narrows to what it names — **Amber**, **nos2x**, **nsec.app** — and the Alby Browser Extension carries
both `identity` and `wallet`, which is true of it.

**Why nothing else is minted.** The other four misfits are **singletons in a 41-entry sample**:
**Shopstr** (marketplace), **Zapstore** (app distribution), **Pokey** (notification bridge),
**Blossom** (a specification repository, for which `state`, `homepage` and "NIP support" are all
category errors). Minting four one-member terms from 41 entries would be taxonomy by imagination, and
the brief forbids exactly that. Instead they publish the topic that is true of them —
`t=commerce`, `t=distribution`, `t=notifications`, `t=spec` — as free values, and the row renders
that string. **Shopstr is the proof this is necessary**: with no free-topic rendering it was filed
`t=clients`, and the record now asserts something false. A free topic rendered as itself is honest
with no vocabulary decision required from anyone.

Promotion from free topic to seed term is by evidence and nothing else: a term is added when
collected entries cluster on it, recorded with the entries that clustered — which is exactly how
`wallet` got in. §5.1 rule 3's pointer to `30368` taxonomy records (§10.2) stands as the eventual
decentralised mechanism; the seed is the bootstrap, and it is named as such in §16.2's terms.

**Topics are multi-valued and the UI is not.** **Nostrcheck server** is one binary that is
simultaneously a relay, a media host, a NIP-05 provider and a Lightning service, and it carries four
`t` tags; **Ditto** is a relay *and* a Mastodon-API server *and* a web client, and carries two. §5.1
rule 2 already requires one `t` tag per topic and already makes this work at the record level. The
single-valued `tool.category` / `categoryLabel` pair in `data.js` and the `categories` array in
`nip-explorer.js:9` cannot round-trip a multi-topic record. That is a code amendment (§21.10 item 1),
not a schema change — the schema was already right.

**`unknown` is reserved for its real meaning:** a record carrying no `t` beyond the mandatory
`nosmaps`. A record with `t=commerce` is **not** uncategorised, and MUST NOT render as `unknown`
merely because the client ships no label for that string.

---

### 21.7 DECISION R7 — eight `result` values, each carried by a collected entry, and none inferred from a checkbox

**Decision.** `result` is a closed, case-sensitive enum of eight values. Yes, the model has both a
partial level and an unknown level, and six more, because the real data has at least eight and
collapsing them loses facts a user acts on.

| `result` | meaning | evidencing entry — verbatim |
|---|---|---|
| `supported` | asserted, unqualified | **Damus** — 10 NIP lines, "no checkboxes and no status column: every line is an unqualified assertion" |
| `partial` | asserted, with a stated limitation | **Snort** — `- [x] NIP-02: Contact List and Petnames (No petname support)`; **Shopstr** — `- [ ] NIP-50: Search Capability (partial: product search)` |
| `not_supported` | explicitly denied | **Snort** lists NIP-03, 14, 39, 40 unchecked as unsupported; **Shopstr** lists NIP-42, 58, 61 |
| `not_applicable` | the source says the capability does not apply | **Amethyst** — `- [ ] window.nostr for Web Browsers (NIP-07, Not applicable)` |
| `planned` | listed as intended, not present | **Amber** — `- [x] Use nip-46 or make an addendum in nip-46`, inside a TODO list; **Nostrcheck server** — NIP17 unchecked in a roadmap section |
| `disabled` | implemented and off | **nostr-rs-relay** — `- [ ] NIP-26 (implemented, but currently disabled)` |
| `withdrawn` | was supported, no longer | **nostream** — `- [ ] NIP-26: Delegated Event Signing (REMOVED)` |
| `unknown` | the source makes no statement | **23 of the 41 entries**, including the **Alby Browser Extension**, which certainly implements NIP-07 and whose README never says so |

`disabled` and `withdrawn` are kept separate from `partial` because they are separate actions for a
user: `disabled` is a configuration flag away, `withdrawn` is gone. Both are single-entry values and
both are recorded verbatim from a primary source.

**The checkbox rule, which is the whole point of R7.** **Checkbox polarity is project-local and
inverts between projects.** Shopstr uses an *unchecked* box for partial support; Snort and Amethyst
use unchecked for not supported; Amber uses a *checked* box for a roadmap item; Snort uses a *checked*
box for partial support with the limitation in prose. Mechanically, Amber's
`- [x] Use nip-46 or make an addendum in nip-46` is indistinguishable from Snort's support checklist.

Therefore:

> **`result` MUST be read from the prose, never from the checkbox glyph.** A transcriber MUST NOT
> derive `result` from `[x]`/`[ ]` alone, and a `transcribed` claim MUST carry `source_text` — the
> verbatim line — so a reader can check the derivation. Any tool that scrapes checkbox state without
> reading the qualifier produces wrong data for at least Shopstr, Snort, Amber, nostr-rs-relay and
> nostream, in both directions.

Two further rules the data forces:

- **A blanket hedge is not a per-capability status.** **strfry**'s README says "Supports **most
  applicable** NIPs: 1, 2, 4, 9, 11, 28, 40, 42, 45, 70, 77". The hedge qualifies the whole list, so
  every one of the eleven is `supported` with the hedge in `caveat`, and none may be shown unhedged.
  Its bare integers are also normalised to `01`, `02`, `04`… only in the *key*; `source_text` keeps
  `1, 2, 4` as written, because "normalising `1` → `NIP-01` is an inference the source does not make".
- **A mention is not a claim.** **nostter** ("NIP-07 browser extensions (recommended)" under login),
  **Rabbit** ("NIP-07に対応したブラウザ拡張機能のインストールが事前に必要です") and **Gossip**
  ("my NIP-05 address of mike@mikedilger.com") all mention NIPs as *requirements* or *examples*, and a
  mention-scraper captures all three as support. All three are `unknown`. Likewise **nostr-tools**,
  **rust-nostr**, **go-nostr** and **nak**, whose NIP mentions are module, crate and subcommand names
  (`@nostr/tools/nip19`, `nostr-connect (NIP-46)`) — a library shipping a `nip19` module provides
  primitives, not user-facing NIP-19 behaviour. All `unknown`, which makes four of the ecosystem's
  most-used projects look empty, and that is the correct and honest output.

**What the UI MUST show for each.** `supported` reads as a positive; `partial`, `disabled` and
`planned` MUST each render distinctly from `supported` **and from each other**, each with its
`caveat` visible in the row, not in a tooltip; `not_supported` and `withdrawn` render as explicit
negatives — a stronger statement than silence; `not_applicable` renders as out-of-scope and MUST NOT
be counted in any denominator; `unknown` renders as §3's `unknown`, never as a negative, never as
zero, and never participates in ordering as a low value (D7, invariant I8). `nip-explorer.js`'s
existing four-value ladder `{implemented: 4, partial: 3, planned: 2, unknown: 1}` and its
`['implemented','partial','planned','unknown']` filter cannot express six of the eight; that is a code
amendment (§21.10 item 2).

---

### 21.8 The revised candidate-kind contracts

Applied to §10.3 and §10.4. **Both kinds have zero published records** and no read-side validator
(§W7.1, §W7.3), so these are **v1 definition changes before first publication, not version bumps and
not migrations.**

**`30369` conformance claim — revised (§10.3).** Changes from the text it replaces:

- `feature` is renamed to `capability` and takes the §21.2 grammar. `spec_title`, `registry`,
  `basis` are added and required. `source`, `source_text`, `asserted_at`, `caveat` are added and
  conditionally required. `environment_hash` becomes conditional on `basis === "tested"`.
- `result` replaces `pass | fail | partial | unknown` with the eight-value enum of §21.7.
- `d` grammar, the `a`-tag equality rule, the `evidence` array, and every §10.1 envelope rule are
  **unchanged**.

**`30370` observation — extended (§10.4).** One registered `observation_type`,
`org.nosmaps.liveness`, with the `value` shape of §21.4. No schema field changes; §10.4's `subject`
grammar, `observed_at`, and `value` size cap already carry it.

**New policy constant** (app configuration, §3):

```text
RECORD_AGE_WARN_AFTER = 365d
```

Set from the data rather than from taste: **habla.news** last shipped 2025-07-17 and **noauth**
2025-05-26, both more than a year before the 2026-08-18 collection, while **khatru**'s 2025-09-22 is
inside a year and is instead covered by an `archived` observation (§21.4). It flags the **record's**
age only, and §7.1's prohibition on inferring withdrawal from age is unchanged.

---

### 21.9 What did NOT change, and what a `version` bump would have cost

**`org.nosmaps.software` stays at `version: 1`.** No key is added, removed, or retyped in §4.2 rule 2.
Checked decision by decision:

| decision | touches the v1 profile? | where it lands instead |
|---|---|---|
| R1 — NIP claims | no | kind `30369` (§10.3) |
| R2 — capability key | no | `30369` content |
| R3 — spec families | no | `30369` content |
| R4 — liveness | no | kind `30370` (§10.4); `state` enum unchanged |
| R5 — `summary` | no | §4.2 rule 2b — a **clarification** of a rule the validator already implements |
| R6 — topics | no | `t` tags, already multi-valued and already free (§5.1) |
| R7 — result levels | no | `30369` content |

**Had a bump been needed, this is what it would have cost**, recorded so the next person weighing one
has the figure: the v1 profile rejects unknown keys (`unknown-field`, `nostr-catalog.js:311-315`), so
a v2 key means every v1 record fails a v2 validator and every v2 record fails a v1 one. Every deployed
client must accept both majors, `validateSoftwareEvent` grows a version branch, §5.3 winner selection
must not let a v2 winner hide a v1 record from a v1-only client, and §20.2 needs cross-version
fixtures. That is the price of one field, and none of the seven decisions was worth it.

**Migration for existing records: none is required, because there are none.** Zero records are
published (§21.0). Stated plainly as the brief requires: **there are currently zero published
records, so the migration section for this revision is empty.** The `30369` and `30370` contract
changes in §21.8 are likewise pre-publication definition changes, not migrations, for the same reason.

---

### 21.10 Code amendments required (none made here)

This section changes no `.js`, `.css`, or `.html`. Recorded so they are not lost, in the manner of
§17 and §W10.1.

1. **Topics must be a set, not a scalar.** `data.js` `tool.category` / `tool.categoryLabel` and
   `nip-explorer.js:9`'s `categories` array are single-valued and cannot round-trip Nostrcheck
   server's four topics or Ditto's two (§21.6). Free topics must render verbatim rather than as
   `unknown`. Add `wallet` to the seed.
2. **The support ladder must carry eight values.** `nip-explorer.js:66`'s
   `{implemented: 4, partial: 3, planned: 2, unknown: 1}` and the `['implemented','partial','planned',
   'unknown']` filter at `:138` cannot express `not_supported`, `not_applicable`, `disabled` or
   `withdrawn` (§21.7). Note the rename: `supported`, not `implemented` — a transcribed README claim
   is not evidence of implementation.
3. **NIP ids must be opaque tokens with a resolution status.** `nipByNumber` (`nip-explorer.js:10`)
   returns `undefined` for `"5A"`, `"7D"` and `"12"`, and `supportRecords` silently drops them
   (`.filter(Boolean)`, `:61`). They must render as `unresolvable` / `not_in_registry` rows (§21.2.3).
   `nipCatalog[].number` must also admit non-numeric ids.
4. **Record freshness and project liveness must be two fields.** `data.js`'s single
   `status: active|stale|dead|unknown` conflates them (§21.4). `dead` must be derivable only from a
   counted `30370` observation, and must render `unknown` when `graph: none`.
5. **The per-NIP record shape is already observation-shaped and should be kept that way.**
   `data.js`'s `nips[]` entries carry `{nip, status, evidence, observed, observer}` — an observer and
   an observation date. That is the `30369` + `basis` shape, not a publisher-array shape, and it is
   evidence that the UI was always rendering a claim rather than a fact. Wire it to real `30369`
   records rather than replacing it with a bare array.

None of these is unblocked by this section: §W7.1's ordering rule still holds, and `30369`/`30370`
have no read-side validator.

---

### 21.11 OPEN — what this revision could not decide

**OPEN-11 — STILL OPEN. Which registry snapshot the shipping client pins for `family: nip`.**
§21.2.3 decides the *mechanism* (pin a commit; render unresolved ids explicitly) and reuses §19.1's
`656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`, verified 2026-08-17, which `data.js`'s `nipCatalog`
already cites. What is not decided is the update policy: who re-pins, how often, and what a client
does with claims resolved against an older snapshot than its own. **Settled by:** a decision on
snapshot cadence plus a fetch of the registry at two revisions to measure how many of the 41 entries'
claims change `registry_status` between them. That fetch was not performed here.

**OPEN-12 — STILL OPEN. Registries for `bud` and `lud`.** §21.3 registers both families from
**Blossom server**'s BUD-01…09 and **NDK**'s "(LUD06, LUD16)", but neither family's spec repository
was fetched or pinned in this revision, so both currently resolve `unresolvable` (§21.2.3), which is
honest but renders every BUD claim as unresolved. **Settled by:** fetching `hzrd149/blossom` and the
LUD repository and pinning a commit for each, in the manner of §19.1. Note §19.3's history: the
Blossom repo was previously pinned at `b5bd2801d1763aa635fc8fea7a76597e0eb18990` for a *mechanism*
claim that revision 2 deleted; re-pinning it as a spec-family registry is a different use and needs
its own verification date.

**OPEN-13 — STILL OPEN. Whether one product spanning several repositories is one coordinate or
several.** **YakiHonne** is `web-app` + `mobile-app` + three archived predecessors, all declaring
`https://yakihonne.com`; **0xchat** spans at least five repositories; **Primal** spans web, iOS,
Android and cache; **NDK** is a monorepo where NIP-17 lives in `@nostr-dev-kit/messages` and NIP-77 in
`@nostr-dev-kit/sync`; **nostr.watch** ships 12+ packages each with its own `alpha`/`docs` status. The
collection picked one repository per product and dropped the rest, and recorded that as a loss.
§21.2's `scope` component can express per-platform *capability* (Amethyst's Android/commonMain case)
but says nothing about whether the *record* should be one coordinate or several. **Settled by:** a
decision on record granularity — one coordinate per product versus one per artefact — which changes
what `d` identifies and therefore what §4.3's "tool identity is the full coordinate" means. It cannot
be decided from the data alone: both readings are consistent with every entry collected.

**OPEN-14 — STILL OPEN, and outside this revision's seven decisions. FINDING 3, 4, 6, 29, 46 —
licence, platform, distribution channel, extension/store id, and Nostr-native contact.** Every one of
the 41 entries has a licence; **Amethyst** is Android-only and **Damus** is iOS 16+/macOS 13+;
**Damus** links App Store `id1628663131` and **Amber** links a Zap Store `naddr`; **nos2x** and the
**Alby Browser Extension** are identified in the real world by a Chrome Web Store extension id;
**nostr-tools**' README says "Use NIP-34 to send your patches to: `naddr1qq…`" and **Pokey**'s declared
homepage is `https://njump.me/npub1h2685…`. None has a home in the v1 profile, and `data.js` renders
`platform` and `license` fields the record cannot supply. This revision deliberately did **not** decide
them: each is a candidate for a `30370` observation, a `30371` evidence relation, or a `version` bump,
and choosing between those three is a larger decision than the seven this section was scoped to.
**Settled by:** a separate pass over FINDINGS 3, 4, 6, 29, 46 with the §21.9 bump cost in hand.

**OPEN-2 — STILL OPEN, with new evidence. §11's "explicitly marks migration".** §W11's OPEN-2 says
§11's second branch names no field the v1 profile can express, and offers two edits: delete the branch,
or add a migration marker with a `version` bump. The real data adds four cases and does **not** settle
it: **khatru**'s successor is a Go module path (`fiatjaf.com/nostr/khatru@master`), **Iris**'s is
`htree://npub1xdhnr…/iris-client`, **Flotilla**'s is a Gitea instance, and **rust-nostr**'s org was
renamed to `nostrdevkit` — none of the four is a `30078` coordinate, so `superseded_by` cannot hold
any of them regardless of which branch of §11 survives, and none of the four projects is withdrawn.
§21.4's `moved` / `superseded` liveness observation records all four **as observations**, which is
strictly weaker than migration authority and is meant to be: §11 clause 7's rule that evidence carries
no coordinate-migration authority is unchanged, and an observation must not become a back door to it.
**Still settled by:** the same two edits §W11 names.

**Not open, recorded to prevent re-litigation.** FINDING 50 (nostr.band could not be verified) and
FINDING 51 (store-only products are structurally excluded) are collection-method limits, not schema
gaps: §5.4 and §2 already say that an unobserved record is reported as incomplete and never as
nonexistence, and §21.11's OPEN-14 covers the store-identifier half of FINDING 51.
