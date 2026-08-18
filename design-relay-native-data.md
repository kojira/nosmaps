# Nosmaps relay-native data design — revision 2 (curation as signal)

Status: design only; no implementation in this phase
Revision date: 2026-08-17
Supersedes: revision 1 (2026-08-16, "review-1 revision")
Normative terms: MUST, MUST NOT, SHOULD, MAY

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

Revision 2 removes the manifest, makes the publisher-signed `32267` record the only canonical record,
and demotes curation from an inclusion gate to a presentation-layer signal derived from the viewer's
own social graph. The result has no HTTP in the catalog data path, a fixed three-round cold start per
relay, and no notion of a globally trusted curator.

## 1. Decisions and invariants

**D1 — No backend.** There is no Nosmaps server, index, aggregator, or API. Every fact displayed
comes from a signed Nostr event observed on a relay the user configured.

**D2 — Signed events are the only source of truth.** The publisher-signed kind `32267` addressable
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
| `30267` | NIP-51 App curation set | `(30267, curator, d)` | **core** — ranking and count only |
| `30368` | taxonomy record | `(30368, author, d)` | cached/lazy |
| `30369` | conformance claim; exact tool `a` index required | `(30369, author, d)` | detail |
| `30370` | observation; exact tool `a` required when tool-subject/linked | `(30370, author, d)` | detail only when tool-indexed |
| `30371` | evidence relation; related-tool `a` required for detail | `(30371, author, d)` | tool-indexed detail; not migration authority |
| `30372` | review | `(30372, reviewer, d)` | review tab |
| `32267` | software application | `(32267, publisher, d)` | **the canonical record** |
| `1111` | NIP-22 comment | regular | future only |

Kinds `30367` and `30078` do not appear in this design. Revision 1's catalog pointer is deleted
(§18); NIP-78's kind `30078` is explicitly a home for data belonging to "apps that do not care about
interoperability" (§19), which is the opposite of what a public catalog record needs.

Candidate kinds `30368`–`30372` are namespaced by required `L`/`l` tags, but those tags are indexing
aids, not schema negotiation or registry ownership. On a later registry collision, old signed events
remain readable under their original candidate schema; publication moves to a newly selected
kind/schema major, and cross-kind migration is explicit rather than reinterpretation.

### 4.2 The canonical record: kind `32267`

Kind `32267` ("Software Application") appears in the NIPs event-kind registry **with an empty NIP
column** — there is no specification for its content (§19). The only interoperable contract Nosmaps
relies on is its *coordinate form*, `32267:<publisher-hex>:<d>`, which is exactly what NIP-51's App
curation sets use as members. Everything below is therefore a **Nosmaps-local content profile**, and
§16.3 records that as residual centralisation.

```json
{
  "kind": 32267,
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
   `32267:<publisher-hex>:nosmaps:<local>`. The 192-byte ceiling covers the whole `d`, so `<local>` has
   at most 184 bytes and MUST be non-empty. A `32267` event whose `d` lacks the prefix is another
   application's record and is recorded as `quarantined: foreign-d` — a **distinct** reason from
   `foreign-profile`, decided from tags alone without parsing `content`. The prefix is not ownership
   proof either; it is a namespace, and it is enforced in exactly one place
   (`validateSoftwareEvent`) alongside the kind and schema checks.
2. `content` is a JSON object with exactly `{schema:"org.nosmaps.software", version:1, state, name,
   summary, homepage?, superseded_by?}`. Unknown keys are rejected in the v1 profile. `name` max 120
   characters, `summary` max 1,000, `homepage` HTTPS max 2,048.
3. `state` is the closed, case-sensitive enum `active | withdrawn`.
4. A `["state", ...]` tag is optional. When present it MUST equal content `state`; disagreement
   invalidates the event. The tag exists for cheap scanning only — `state` is not a single-letter tag
   and is therefore **not relay-indexable**, so it can never be used as a filter.
5. `t` tags carry discovery topics (§5.1).
6. Signature and event id MUST validate. `created_at` is subject to future-timestamp quarantine
   (§12.3).

**Foreign `32267` events.** Because `32267` has no NIP, other applications publish it with their own
content, and they demonstrably do: a live probe of `wss://x.kojira.io` returned zapstore-style records
under `d` values `buzz.armada.app`, `com.greenart7c3.nostrsigner` and `pub.ditto.app` (tags `name`,
`summary`, `icon`, `image`, `url`, `repository`, `license`, `f`, `t`), plus a second family under
`d` values like `sats-to-usd-mbkiltxe`. None of them are ours and none must ever be read as ours.

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

Tool identity is the full coordinate `32267:<publisher-hex>:<d>`. Similar `d` values under different
pubkeys are distinct and MUST NOT be auto-merged.

The UI MUST NOT say "official" solely because `d` resembles reverse DNS, because a profile has
NIP-05, or because someone recommended it.

Closed claim levels:

| level | machine meaning | UI wording | scope |
|---|---|---|---|
| `self_asserted` | publisher signed the `32267` event | "publisher-signed" | global |
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
{"kinds":[32267],"#t":["nosmaps"],"limit":500}
```

Normative details:

1. `t` values are lowercase. Authors normalize to NFC and lowercase before signing; validators reject
   a `t` value that is not already lowercase rather than folding it, so the indexed byte string and
   the queried byte string are identical.
2. **NIP-01 indexes only the first value of any given tag.** A record with three topics MUST publish
   three separate `t` tags (`["t","nosmaps"], ["t","relay-client"], ["t","signer"]`), never
   `["t","nosmaps","relay-client","signer"]`. A validator MUST reject the multi-value form for
   `t` because it silently loses indexing.
3. `DISCOVERY_TOPICS` defaults to `["nosmaps"]` and is user-editable. Additional topics may be added
   from selected `30368` taxonomy terms.
4. Results are paginated with the §12.1 boundary protocol using inclusive `until`, bounded by
   `MAX_DISCOVERY_PAGES_PER_RELAY`, `MAX_DISCOVERY_RAW_EVENTS_PER_RELAY`, and
   `DISCOVERY_LIMIT_PER_RELAY`. Hitting a bound marks the relay `incomplete: discovery-cap`. An empty
   page proves only "no more events returned in this round".
5. **Discovery is opt-in and therefore lossy by construction.** A `32267` record that carries no
   queried `t` tag is invisible to §5.1. The UI MUST label discovery results as "records that
   published topic `nosmaps` on your relays", never as "all tools". §5.2 is the compensating path.

### 5.2 Exact fetch by coordinate

Any coordinate learned from any source — a `30267` set member, a `30371` evidence `a` tag, a `30369`
conformance claim, a `superseded_by` field, a bookmark, or a URL — is fetched **exactly**, regardless
of whether it carries a discovery topic:

```json
[
  {"kinds":[32267],"authors":["<publisher-A>"],"#d":["tool-a","tool-b"],"limit":8},
  {"kinds":[32267],"authors":["<publisher-B>"],"#d":["tool-c"],"limit":4}
]
```

Filters MUST be **grouped by author**. A single filter with `authors:[A,B]` and `#d:[x,y]` matches
the Cartesian product and lets one author's events consume another's `limit`. Grouping is by author,
not one REQ per author: all groups travel in the same REQ, subject only to §9.4 chunking.

This is what makes curation a *recall* mechanism rather than a gate (§6.6): a record with no
`t` tag that one person in your network recommends still appears, fetched by coordinate.

### 5.3 Winner selection among replaceable versions

`32267` is in the addressable range `30000 <= n < 40000`, so a coordinate is `(kind, pubkey, d)` and
relays keep only the latest per coordinate (§19). Clients MUST NOT rely on that: a partitioned relay
set will hand back different versions from different relays.

Selection is a pure function over the union of everything observed for the coordinate:

```text
candidates = observed events at (32267, pubkey, d)
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
a `d` tag and `a` tags of the form `32267:<pubkey>:<d>` (§19).

Nosmaps uses it exactly as specified and adds no custom schema:

- The set is addressable at `(30267, curator, d)`; the winner (§5.3 rules, minus the
  `org.nosmaps.software` schema check, which does not apply) is the whole current set.
- Members are the values of `a` tags that parse as `32267:<64-hex>:<d>`. Other `a` values are ignored,
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
             of the 32267 coordinates in their `a` tags

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

A publisher retracts their own record by publishing a **newer valid `32267` event at the same
coordinate with `state:"withdrawn"`**:

```json
{
  "kind": 32267,
  "created_at": 1786982400,
  "pubkey": "<publisher-hex>",
  "tags": [["d", "com.example.tool"], ["state", "withdrawn"], ["v", "1"]],
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

> For each coordinate, the displayed state is derived deterministically from the valid `32267`
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

### 8.3 Partition examples

**A — newest withdrawal hidden.** R1 holds `32267 X state=withdrawn` at `created_at = t2`; R2 holds
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
  {"kinds":[32267],"#t":["nosmaps"],"limit":500},
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
  {"kinds":[32267],"authors":["<publisher-A>"],"#d":["tool-a","tool-b"],"limit":8},
  {"kinds":[32267],"authors":["<publisher-B>"],"#d":["tool-c"],"limit":4},
  {"kinds":[5],"authors":["<publisher-A>","<publisher-B>","<curator-C>"],
   "#a":["32267:<publisher-A>:tool-a","30267:<curator-C>:nostr"],"limit":256}
]
```

The `32267` filters cover coordinates learned from R2 sets but not returned by R1's topic query — the
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
| R1 cold discovery + identity | `1` (+ up to `MAX_DISCOVERY_PAGES_PER_RELAY - 1` pages) | `0` | `{32267 #t}` + optional `{3 authors:[viewer]}` |
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
write path beyond ordinary `32267` and `30267` event limits, and no separate upload-size constraint
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

### 10.3 `30369` conformance claim

- `d=conformance:<tool-coordinate-sha256>:<feature-key>`; hash the exact UTF-8 bytes of the canonical
  `32267:<publisher-hex>:<d>` coordinate; derive the feature key by §10.1.
- required: `schema=org.nosmaps.conformance`, `version=1`, `state`, `tool`, `feature`, `result`,
  `environment_hash`.
- `tool` is one canonical software coordinate and the event MUST contain exactly one
  `["a", "32267:<publisher>:<d>"]` whose value equals content `tool` byte-for-byte. Mismatch, missing
  tag, duplicate differing tool tag, or a noncanonical coordinate fails validation.
- `feature` is the complete NFC feature identifier, maximum 512 UTF-8 bytes; reverse-DNS ASCII plus
  version remains recommended, e.g. `org.nosmaps.nip.65-v1`. The `d` uses its bounded feature key,
  never truncation.
- `result`: `pass | fail | partial | unknown`; optional `evidence` array of at most 32 `30371`
  coordinates.
- environment hash input is canonical JSON of
  `{runtime, runtime_version, os, arch, dependency_lock_hash, config_hash}`, all required strings,
  where absent facts use `"unknown"`.

### 10.4 `30370` observation

- `d=observation:<subject-hash>:<type-key>:<nonce>`; hash the exact RFC-8785 UTF-8 serialization of
  the NFC `subject` string; derive the type key by §10.1; nonce is exactly 16 lowercase base32
  characters.
- required: `schema=org.nosmaps.observation`, `version=1`, `state`, `subject`, `observation_type`,
  `observed_at`, `value`; optional `tool`, `environment_hash`.
- `subject` uses §10.5 syntax; `observation_type` is the complete NFC identifier, maximum 512 UTF-8
  bytes; `observed_at` is an integer; `value` is a scalar or object up to 4 KiB canonical bytes.
- If `subject` is an `address:32267:<publisher>:<d>`, content `tool` is required and MUST equal that
  embedded coordinate. Any observation intended for tool detail or comparison MUST carry content
  `tool` and exactly one matching canonical `["a", "32267:<publisher>:<d>"]`. Observations without a
  tool index are outside standard tool-detail retrieval.

### 10.5 `30371` evidence relation

- `d=evidence:<sha256(canonical-subject)>:<relation>:<nonce>`; nonce is lowercase base32 8–32
  characters.
- required: `schema=org.nosmaps.evidence`, `version=1`, `state`, `subject`, `relation`, `object`;
  optional `tools`, `summary`.
- subject grammar is exactly one of `event:<64hex>`, `address:<kind>:<64hex>:<d>`,
  `url:<absolute-https-url>`, `sha256:<64hex>`. `object` uses the same grammar.
- relation closed enum v1: `supports | contradicts | documents | reproduces | supersedes`.
- `summary` max 500. `tools`, when present, is a sorted unique array of at most 16 canonical `32267`
  coordinates. If either `subject` or `object` is an `address:32267:<publisher>:<d>`, that coordinate
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

Only a newer valid `32267` winner at the **old coordinate**, signed by the same publisher key as that
coordinate, may authoritatively set `superseded_by` to another valid `32267` coordinate. The field is
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

Pipeline order is mandatory, and applies to `32267` discovery pages (§5.1) as well as `30372` reviews:

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
| re-rank after follow change | R2 only, with the new `G` | row set unchanged (I7), so no `32267` refetch is required |
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
implementation. **`#t` indexing on kind `32267` is the single most load-bearing probe in this
design**: if a relay does not index it, discovery on that relay is impossible and the relay is marked
`incomplete: t-index-unsupported`. Curation-derived exact fetches (§5.2) still work there, so the
relay degrades to recall-only rather than being useless. Broad kind scans, arbitrary author
discovery, and any central index fallback are prohibited.

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
    { kinds: [32267], "#t": policy.discoveryTopics, limit: policy.discoveryLimit },
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

**16.3 Kind `32267` has no NIP, so its content schema is ours.** Verified: the event-kind registry
lists `32267` as "Software Application" with an empty NIP column (§19). `org.nosmaps.software` is a
Nosmaps-local profile, so a record another client considers perfectly valid is quarantined here
(§4.2). Mitigation: quarantine carries a reason, the raw event stays inspectable, and the only
interoperable contract we depend on is the coordinate form that NIP-51 `a` tags already use. This is
the largest remaining piece of unilateral authority in the design and it should be revisited if a
`32267` specification ever lands.

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
- **kind `32267` is never fetched.** It appears only at `nostr-catalog.js:52` as
  `COORD_RE = /^32267:([0-9a-f]{64}):(.{1,192})$/`, used by `isValidCoordinate` (`:147-154`) to
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
pointer, and a `32267` record's authority derives entirely from the coordinate it is signed at
(invariant I2), so "who may publish" stops being a question the client has to answer.

### 17.5 Test blast radius

- `tests/relay-unit.spec.js`: group B (`:139`, `:168`, `validatePointerEvent`), group D (`:298`
  `verifyManifestBytes`, `:342` `validateManifestValue`), group E (`:395` mirror fallback), and group
  F (`:461` IndexedDB rebuild, including `:484` "full rebuild from pointer + Blossom bytes alone")
  are deleted. Group A (`:96`, winner selection) and group C (`:240`, RFC 8785) survive — group A
  becomes more important, since §5.3 is now the core of the design.
- `tests/relay-render.spec.js`: `BLOSSOM_ORIGIN` (`:11`), the signed kind-30078 fixture builder
  (`:67-113`), and the mock Blossom route (`:140`) are deleted and replaced by signed `32267` and
  `30267` fixtures plus a mock kind `3`.
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
- Kind `30078` (and its predecessor `30367`) as a catalog pointer, the coordinate
  `nosmaps:catalog:v1:<scope>`, the scope grammar, `DEFAULT_SCOPE`.
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
| a `30267` set's members look like `32267:<pubkey>:<d>` | NIP-51 `51.md:156-168` | example event with `["d","nostr"]` and `["a","32267:7579…:com.example.app1"]` |
| sets are replaceable; editing means publishing a new version; sets are distinguished by `d` and may carry `title`/`image`/`description` | NIP-51 | "Sets are lists with well-defined meaning… users are expected to have more than one set of each kind", each with "a different `\"d\"` identifier" |
| kind `30078` is app-specific data, explicitly for apps that do not want interoperability — **cited only to record why it was the wrong home for a catalog pointer** | NIP-78 | "arbitrary custom app data"; "some apps do not want or do not need interoperability" |
| the event-kind registry: `3` Follows [02]; `30078` Application-specific Data [78]; `30267` App curation sets [51]; **`32267` Software Application with an empty NIP column** | NIPs `README.md:128, 262, 264, 285` | `\| \`32267\` \| Software Application \| \|` |

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

## 20. Verification and acceptance gates

### 20.1 Static design checks

- No manifest, blob, pointer, mirror, quorum, generation, previous-hash, or BUD concept appears
  anywhere in this document.
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
6. **Recall path (§6.6)**: a `32267` record with **no** `t` tag, recommended by one pubkey in `G`, is
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
23. **Foreign `32267`**: a signature-valid `32267` with non-Nosmaps content is quarantined with
    `foreign-profile`, remains inspectable, and is never reported as nonexistent.

### 20.3 Implementation preflight

Live-probe both default relays for reachability, NIP-11 fields, AUTH behaviour, `OK` semantics,
message and event limits, query limits, and read-back visibility. Probe generic tag indexing
specifically for:

- **`#t` on kind `32267`** — load-bearing for discovery (§13.1); failure marks the relay
  `incomplete: t-index-unsupported` and degrades it to recall-only;
- `#d` on kinds `32267` and `30267`;
- `#a` on kinds `30369`–`30371`, plus uppercase-tag behaviour for the §15 future work;
- `authors`-array size behaviour with 128, 512, and 2,048 entries, which is what §9.3 depends on;
- candidate-kind reads and writes in a safe test namespace.

A relay failing a probe is excluded from the affected dependency and reported `incomplete`. No broad
kind scan, no arbitrary author discovery, and no central-index fallback is permitted under any probe
outcome.

TypeScript acceptance requires an exact lockfile fixture, project DOM libs, explicit `window.nostr`
type augmentation, `tsc --noEmit`, and the real project build. Pseudocode in this document is not
compile evidence.
