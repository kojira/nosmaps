# Nosmaps write path — design (companion to the relay-native data design)

Status: design only; no implementation in this phase
Revision date: 2026-08-18
Verified against: `HEAD = 822f56f`
Companion to: [`design-relay-native-data.md`](design-relay-native-data.md) revision 2 (the **read design**)
Normative terms: MUST, MUST NOT, SHOULD, MAY
Amended: 2026-08-18 — the read design gained **§21**, a revision of the capability, liveness, and
taxonomy model derived from 41 real entries. §W2.2, §W2.4, §W7.3, §W10 and §W11 are updated below.
The v1 content profile is unchanged (§21.9), so **§W2's field map does not change** and no form field
is added, removed, or retyped.

**Citation convention.** A bare `§N` or `§N.M` always cites the read design. A `§WN` cites this
document. A `file.js:NN` cites the tree at `HEAD = 822f56f`.

## W0. Why this is a companion file, and what it may not do

**Choice: a separate file, linked from the read design, rather than a new §21.** Two reasons, both
mechanical rather than aesthetic.

1. The read design's §20.1 static checks are written as assertions over *that document* ("No
   manifest… appears anywhere in this document", "Every claim in §19.1 carries a source and a
   verification date"). Appending write-path text would silently pull new normative prose, and new
   uncited sources, inside the scope of gates that were reviewed against the read path. Keeping them
   apart means §20.1 still means what it meant when it passed.
2. The two documents have different lifecycles. The read design is a five-round-reviewed artifact.
   The write path's central facts — relay `OK` semantics, whether either default relay accepts a
   `30078` write at all, rx-nostr `send()` behaviour — are all **unprobed** (§W11), so this document
   is expected to change on first contact with a live relay. That churn should not touch a settled
   file.

The dependency is one-directional: this document cites the read design; the read design never needs
to cite this one. §W10 lists the amendments the read design will need, as amendments, rather than
making them here.

### W0.1 What is reused verbatim and MUST NOT be reinvented

| concern | authority | write path uses it by |
|---|---|---|
| canonical kind | §4.1, §4.2 | `POLICY.SOFTWARE_KIND` (`nostr-catalog.js:35`); no other kind is published in this slice (§W7) |
| `d` grammar and the `nosmaps:` namespace | §4.2 rules 1, 1b | `SOFTWARE_D_PREFIX` + `D_MAX_BYTES` (`nostr-catalog.js:78-79`) |
| 192-byte `d` ceiling | §4.2 rule 1 | `utf8ByteLength` over the whole `d`, reject-not-truncate (§W2.3) |
| v1 content profile | §4.2 rule 2 | exactly seven keys, five required, two optional; nothing else exists (§W2.2) |
| `state` enum | §4.2 rule 3, §7.1 | computed from the action, never a free field (§W3.3) |
| `t` topic rules | §5.1 rules 1, 2 | one tag per topic, lowercase, NFC (§W3.2) |
| **the validator** | §4.2 | `window.NOSMAPS_CATALOG.validateSoftwareEvent` (`nostr-catalog.js:254`, exported `:1771`) — the *same function object* the read path calls. There is no write-side validator. |
| winner selection | §5.3 | `selectSoftwareWinners` (`nostr-catalog.js:566`, exported `:1777`) — used by read-back (§W5.4) |
| withdrawal semantics | §7.1 | newer valid winner with `state:"withdrawn"` (§W6.2) |
| publisher locality | I2 | UI gate + pre-sign pubkey recheck (§W6.4) |
| future-timestamp policy | §12.3 | `futureCheck` inside the shared validator (`nostr-catalog.js:190`) |
| replaceable-list publish/read-back pattern | §14.1 steps 3–6 | the shape of §W3.4, §W4, §W5 |
| filter grouping and chunking | §5.2, §9.4 | `chunkFilters` (`:1782`), `groupByAuthor` (`:1783`) |

The single most important line in this table is the validator row. **The Publish control is enabled
by, and only by, `validateSoftwareEvent(draft).ok === true`.** Nothing publishable can be
unreadable, because "publishable" is defined as "the read path's validator accepts it". Any
field-level hint in the form is a UX convenience that MUST NOT be the gate, and MUST NOT be able to
disagree with the validator about whether a draft is publishable.

`validateSoftwareEvent` is pure, synchronous, and reads `event.id` only optionally
(`nostr-catalog.js:359`), so it runs on an **unsigned** draft. That is what makes pre-sign validation
possible, and it is not an accident — the comment at `nostr-catalog.js:250-253` records that
signature verification deliberately lives in the relay layer instead.

### W0.2 Write-path policy constants

App configuration, not protocol facts, in the manner of §3.

```text
WRITE_RELAYS              = the configured relay set (§16.1). No NIP-65 outbox (§W7.3).
SIGNER_TIMEOUT_MS         = 60_000     # a human is answering a dialog
PUBLISH_TIMEOUT_MS        = 15_000     # deadline for OK collection
PUBLISH_MANUAL_RETRIES    = 2          # user-initiated only; no silent background retry
READBACK_ATTEMPTS         = 3
READBACK_TIMEOUT_MS       = 8_000      # = POLICY.REQ_TIMEOUT_MS (nostr-catalog.js:64)
READBACK_BACKOFF_MS       = [0, 2_000, 8_000]
D_LOCAL_MAX_BYTES         = 184        # = 192 - len("nosmaps:"), §4.2 rule 1b
TOPIC_MAX_BYTES           = 128        # = §5.1 rule 2b = nostr-catalog.js:303 (RESOLVED OPEN-3)
MANAGE_LIMIT              = 64         # own-records query, §W6.1
IDENTITY_STORAGE_KEY      = "nosmaps:identity:v1"
DRAFT_STORAGE_KEY         = "nosmaps:draft:v1"
```

---

## W1. Signer and session model

**NIP-07 only.** No `nsec` paste field, no NIP-46 bunker, no key generation, no key import, no
"remember my key". A private key never enters the application's address space, and rx-nostr's
`seckey` send option (`node_modules/rx-nostr/dist/rx-nostr/interface.d.ts:102-104`) MUST NOT be
passed anywhere in this codebase.

### W1.1 Two orthogonal variables, not one

The read design already establishes that **reading a follow list requires only a pubkey, not a
signer** (§6.2 preamble). The write path must not collapse that distinction, so identity and signing
capability are tracked separately:

```text
identitySource ∈ { none, pasted, remembered, signer }     # who we rank the catalog for (§6.2 step 1)
signerState    ∈ { absent, present-unauthorised, authorised, rejected, error }
```

`identitySource` drives §6.4 counts and ordering only. `signerState` drives write affordances only.
A `pasted` or `remembered` identity ranks the catalog and **never** enables Publish.

### W1.2 The five signer states

`signerState` transitions only on evidence the app actually observed. It is never inferred from
elapsed time, from the presence of another extension, or from a previous session.

| # | state | entered when | UI asserts | UI MUST NOT assert |
|---|---|---|---|---|
| 1 | `absent` | `typeof window.nostr !== 'object'`, or `window.nostr.signEvent` is not a function | "No Nostr signer detected in this browser. Publishing needs a NIP-07 extension." Publish controls are **not rendered**, not merely disabled — a disabled button implies the action exists here. Browsing and ranking are unaffected. | that a signer is installed but broken; that installing one is required to use the site |
| 2 | `present-unauthorised` | `window.nostr` present and no successful `getPublicKey()` **in this page session** | "A signer is available. Connect to publish." A single explicit **Connect** button. | that the app knows who the user is; any pubkey; that connecting is safe/unsafe |
| 3 | `authorised` | `getPublicKey()` resolved and `decodeNpub()` (`nostr-catalog.js:202`) returned 64 lowercase hex | "Publishing as `npub1…` (`<abbrev hex>`)." The pubkey is shown on every screen that can sign. | ownership of any coordinate, "verified", "official" (§4.3) |
| 4 | `rejected` | the `getPublicKey()` or `signEvent()` promise **rejected** | "Your signer declined. If you dismissed the prompt, press Connect again." The raw error text goes to diagnostics, not to the headline. | that the user refused (we cannot know); that the extension is broken; that anything was published |
| 5 | `error` | the call threw synchronously, did not settle within `SIGNER_TIMEOUT_MS`, or **resolved with an unusable value** (§W1.3) | "Your signer returned something this app cannot use: `<reason-slug>`." Publish stays blocked. | that the user refused; that a retry will work; that anything was published |

**States 4 and 5 are not distinguishable from the NIP-07 surface, and this design does not pretend
otherwise.** NIP-07 specifies no error vocabulary (OPEN-5), so "the user clicked Reject" and "the
extension crashed" arrive as the same rejected promise. The split above is therefore drawn on
evidence the app *does* have — *did the promise settle, and was the settled value usable* — and the
`rejected` wording is hedged accordingly ("If you dismissed the prompt…"). Inventing a confident
"You rejected the request" from an unspecified error object would be exactly the fabrication D7
forbids, one layer down.

`present-unauthorised` is likewise honest about a limit: NIP-07 offers no way to ask "am I already
authorised?" without calling `getPublicKey()`, which prompts. The read path already respects this —
`opts.useNip07 === true` gates the call precisely because "prompting on a plain page load is not
opt-in" (`nostr-catalog.js:1530-1531`). The write path keeps that rule: **no NIP-07 call happens
without a user gesture.**

### W1.3 What "unusable value" means

`getPublicKey()` is unusable when `decodeNpub()` returns `null` (reason `nip07-key-unparsable`,
already a read-path diagnostic at `nostr-catalog.js:1541`).

`signEvent()` is unusable when any of the following holds. Each is a distinct reason slug, and each
aborts before any relay is contacted:

| reason | check |
|---|---|
| `signer-missing-fields` | returned `id`, `sig`, or `pubkey` is not 64/128 lowercase hex as applicable |
| `signer-wrong-pubkey` | returned `pubkey !== ` the pubkey from `getPublicKey()` in this same flow |
| `signer-mutated-event` | `canonicalize({kind, created_at, tags, content})` of the returned event ≠ that of the draft we handed over |
| `signer-invalid-record` | `validateSoftwareEvent(returned)` is not `ok` although it was `ok` for the draft |

`signer-mutated-event` is not paranoia about a hypothetical. rx-nostr ships
`nip07Signer({tags})`, whose documented behaviour is that "the set tags is appended to the end of
the given event's tags on signing"
(`node_modules/rx-nostr/dist/config/signer.d.ts:6-9`). An appended tag changes the event id and can
change validity. **Decision: the write path calls `window.nostr.signEvent(draft)` directly and does
not use `nip07Signer`.** Chosen over letting `rxNostr.send()` sign for us because:

- the signed bytes must be observable to us *before* transmission to run the four checks above;
- `Nostr.EventParameters.created_at` is optional
  (`node_modules/.pnpm/nostr-typedef@0.13.0/node_modules/nostr-typedef/index.d.ts:39`), so handing an
  unsigned draft to `send()` opens a path where a library, not this design, decides a timestamp
  (§W3.4 forbids that);
- `canonicalize` already exists (`nostr-canonical.js:358`) and gives byte-exact comparison for free.

The cost is that we depend on `send()` forwarding an already-signed event unchanged, which is
**unverified** (OPEN-7).

### W1.4 What persists across reloads, and why

| item | persisted? | where | reason |
|---|---|---|---|
| private key | **never, in any form** | — | none exists in the app; D1/D2 do not need one, and NIP-07 exists so it never has to |
| viewer pubkey, last returned by `getPublicKey()` | **yes** | `localStorage[IDENTITY_STORAGE_KEY]` | it is public data, and it makes the *next* load rank the catalog (§6.4) without a prompt. It is stored as, and only as, a §6.2 step-2 identity: `identitySource = "remembered"`. |
| `signerState` | **no** | — | authorisation is a property of the extension's current session, not ours. Persisting `authorised` would let the app render "Publishing as …" for a signer that has since been locked or removed — a claim with no evidence behind it. Every reload starts at `absent` or `present-unauthorised`. |
| capability probe results (`nip44` presence, etc.) | **no** | — | same reason; §14.1 already requires capabilities to be checked at use time |
| form draft field values | **yes** | `localStorage[DRAFT_STORAGE_KEY]`, one draft | a publish attempt can fail for reasons entirely outside the user's control (§W8). Losing 1,000 characters of typing to a relay timeout is a failure mode we can simply not have. The draft holds no key and no signature. |
| a **signed but unpublished** event | **never** | — | a signed event carries a frozen `created_at`. Persisting one lets it be published hours later at a timestamp that no longer describes anything, and lets it lose §5.3 winner selection to an event the user published in between. Signed events are published immediately or discarded. |
| per-relay publish outcomes | **no** | — | they are observations with an as-of time (§3). A reload has not re-observed them, so it MUST NOT redisplay them. |

**The remembered pubkey never authorises a write.** It is an identity for ranking. Every publish
re-calls `getPublicKey()` immediately before signing (§W6.4), and if the returned key differs from
the remembered one, the app replaces the stored key, states the change in the UI, and requires the
user to re-confirm before signing. This is the account-switch hazard: an extension can change
accounts between page load and publish, and a design that trusted a cached key would sign a record
at a coordinate the user did not intend.

---

## W2. The submit form

### W2.1 What the form is

One screen with three groups — **address**, **record**, **discovery** — plus a live preview of the
exact event that will be signed (§W3.5). Every input maps one-to-one to something §4.2 defines. The
form has no field that the v1 profile does not have, and the v1 profile has no field the form cannot
express.

### W2.2 Field map

| form input | maps to | defined at | required | rule (enforced by `validateSoftwareEvent`) |
|---|---|---|---|---|
| **`d` local part** | the part of `d` after `nosmaps:` | §4.2 rule 1b | yes | non-empty; printable ASCII `[\x21-\x7e]` (`nostr-catalog.js:89`); `utf8ByteLength("nosmaps:" + local) ≤ 192` |
| **Name** | `content.name` | §4.2 rule 2 | yes | 1–120 characters, counted as code points via `charLength` (`nostr-catalog.js:184`) |
| **Summary** | `content.summary` | §4.2 rules 2, **2b** | key always present; text may be empty | ≤ 1,000 code points. The validator requires the *key* (`nostr-catalog.js:316-318`) but permits `""`, so the field is optional to fill and always serialised. **§4.2 rule 2b now makes this normative rather than incidental:** `""` is the honest form for "no publisher-authored summary exists" (§21.5, entry **Olas**, whose repository description is the literal string `"Guess."` and whose README is Maestro test setup). The form MUST therefore permit an empty Summary without a warning that reads as an error, and MUST warn on the cataloguer placeholders `Unknown` / `N/A` / `No description`, which the validator accepts and cannot distinguish from content (§20.2 item 29). The warning is advisory and MUST NOT gate Publish — §W0.1's validator rule is absolute. |
| **Homepage** | `content.homepage` | §4.2 rule 2 | no | when non-empty: `https://` prefix, ≤ 2,048 **UTF-8 bytes** (RESOLVED OPEN-4). The form MUST measure with `utf8ByteLength`, not `String.length`: the validator still counts UTF-16 code units (`nostr-catalog.js:326`) and is therefore more permissive than the design for a non-ASCII IRI until §W10.1 item 1 lands, so the form is the stricter of the two and rejects what the design rejects. When empty the **key is omitted entirely** — `""` fails the prefix check, so a blank field MUST NOT serialise as an empty string. |
| **Topics** | one `["t", …]` tag each | §5.1 rules 1–2, §4.2 rule 5 | `nosmaps` is mandatory and not removable | lowercase, non-empty, ≤ `TOPIC_MAX_BYTES`; the multi-value form is rejected (`nostr-catalog.js:293-300`) |
| *(no input)* | `content.schema` | §4.2 rule 2 | computed | constant `"org.nosmaps.software"` (`nostr-catalog.js:66`) |
| *(no input)* | `content.version` | §4.2 rule 2 | computed | constant `1` |
| *(no input)* | `content.state` | §4.2 rule 3, §7.1 | computed | from the invoked action, never a dropdown (§W3.3) |
| *(withdraw flow only)* | `content.superseded_by` | §4.2 rule 2, §11 | no | a valid `30078` coordinate, not a self-loop (`nostr-catalog.js:331-334`); see §W6.3 |

The mandatory `nosmaps` topic is not decoration. §5.1 rule 5 and §16.2 are explicit that a record
carrying no queried `t` is invisible to discovery, reachable only through the §6.6 recall path — i.e.
only if somebody already recommends it. Letting a first-time publisher opt out of the one tag that
makes their record findable would produce a record that is valid, published, and unfindable, and the
form would have helped them do it.

Additional topics are free text, but the form SHOULD surface the **seed of seven** that §5.1 rule 3b
now defines — `clients`, `relay`, `identity`, `media`, `analytics`, `dev`, `wallet` — as the values
the explorer ships labels for (`nip-explorer.js:9`, `:292`, `:300`). This is a labelling affordance,
not a schema requirement, exactly as §10.2's last bullet frames taxonomy terms.

Two things changed here in the 2026-08-18 amendment, both from real entries (§21.6):

- **`wallet` is new**, and it is the only term minted from the collection: **Zeus**, **Alby Hub**,
  **Mutiny Wallet** and the **Alby Browser Extension** are each described as a wallet by their own
  publisher, and all four were otherwise filed under `identity` as "the least wrong of six".
- **A free topic is not an uncategorised record.** §5.1 rule 3b requires a topic outside the seed to
  render **verbatim as itself**, and reserves `unknown` for a record carrying no `t` beyond
  `nosmaps`. The form MUST NOT discourage a free topic, and MUST NOT imply the record will be
  uncategorised: **Shopstr** is the entry that proves the cost — with no free-topic rendering it was
  filed `t=clients`, and that record asserts something false. `categoryObserved: false`
  (`nip-explorer.js:206`) currently conflates "no topic" with "topic I have no label for"; that is a
  code amendment (§21.10 item 1), not a form change.

### W2.3 The `d` byte ceiling, and what happens at it

The form shows a live byte counter (`utf8ByteLength`, `nostr-canonical.js:15`) against 192 for the
whole `d`, with the `nosmaps:` prefix's 8 bytes already spent and visible as spent.

**Over-limit input is rejected before signing. It is never truncated.** §10.1 states the rule for the
candidate kinds — "Authors and validators measure encoded UTF-8 bytes, MUST NOT truncate, and reject
an over-limit event before signing" — and the same rule is adopted here for `30078`, for a reason
specific to `d`: truncating a `d` does not shorten a label, it **retargets the coordinate**. A
truncated `nosmaps:com.example.toolkit` is `nosmaps:com.example.tool`, which is a different record,
possibly someone else's. Silent truncation is therefore a fabricated identity, not a cosmetic loss.

The form permits exactly what the validator permits: printable ASCII, uppercase included. Reverse-DNS
lowercase is offered as placeholder text and recommended in help copy, and enforced nowhere. A
stricter client-side grammar would be a second `d` grammar with its own opinion, which §W0.1 forbids;
it would also make the form unable to *edit* an existing record whose `d` the validator accepts.
Whether §10.1's narrower grammar should be extended to `30078` was OPEN-8, and it is now **resolved:
it is not**. §4.2 keeps rule 1's permissive printable-ASCII grammar, because tightening it would begin
quarantining records that are valid today and no observed case motivates it; the residual risk that
two coordinates differing only in case look identical in a list is recorded there as accepted. The
form above therefore needs no change, and if the decision is ever revisited the change belongs in
`validateSoftwareEvent`, not in the form.

### W2.4 Fields the profile does not define

**They do not exist.** Not hidden, not disabled, not "coming soon", not collected and dropped.

There is no version field, no licence, no icon or screenshot URL, no repository link, no author or
maintainer name, no download or install link, no platform list, no pricing, no rating, no
"official"/"verified" flag, no free-form tags outside `t`, no NIP support matrix, and no observation
or "last checked" date. Each of these is a thing a software-catalog form usually has, and each is
absent for the same mechanical reason: `validateSoftwareEvent` closes the content key set and returns
`unknown-field` for anything outside it (`nostr-catalog.js:311-315`). A form that collected one would
produce an event that the read path quarantines — it would be **published and unreadable**, which is
the exact failure §W0.1's validator rule exists to prevent.

Adding one is a change to §4.2 and a `version` bump, reviewed as a schema change. It is not a form
change and MUST NOT be introduced as one.

Some of these facts do have a home in the design — NIP support belongs to `30369` capability claims
(§10.3), observations to `30370` (§10.4), evidence to `30371` (§10.5). None of those kinds is
published in this slice (§W7).

**Amended 2026-08-18.** That paragraph used to be a pointer; §21 makes it a decision, and the
decision is that **NIP support will never be a field of the `30078` record, in v1 or any later
version** (§21.1). The mechanical reason above — the validator closes the key set — was always the
weaker argument. The load-bearing ones come from collected entries and would apply even if the key set
were open:

- The **Alby Browser Extension**'s README contains **zero occurrences of "NIP"** while its own
  description says "key signer for Nostr". A field inside the record can only hold the record
  publisher's view, so this project's NIP-07 support would be permanently unrecordable.
- **Amethyst** reports NIP-46 as "Full" on Android and "Partial" in commonMain in the same README. A
  single-valued field in a replaceable record cannot hold both answers.
- **Alby Hub** claims per-*method* NIP-47 support, not NIP-47. **strfry**'s truthful claim is a
  deployed instance's NIP-11 `supported_nips`, which is not a property of the software at all.

So the sentence a future reader needs is not "the form has no NIP field because the validator would
reject it" but **"a NIP claim is a different signed record with a different author and a different
lifetime, and the form for it is a different form"**. §W7.1's ordering rule still governs when that
form may be built.

### W2.5 Validation in the form

1. On every input event, the form assembles the complete draft event (§W3) and calls
   `validateSoftwareEvent(draft, { receivedAtSec: nowSec })`.
2. `ok === true` → Publish is enabled. `ok === false` → Publish is disabled and the returned `reason`
   slug is displayed, mapped to a localised sentence through the existing i18n layer, which makes a
   missing key loud rather than silent (`i18n.js:127-146`).
3. Field-level hints (character counts, byte counts, the `https://` requirement) are advisory and
   MUST be derived from the same constants the validator uses, not from independent literals.
4. There is **no** submit-time-only validation. The state that enables the button is the state that
   is published.

The reason slugs the form must be able to render, all from `nostr-catalog.js:254-353`: `bad-kind`,
`bad-schema`, `bad-d`, `foreign-d`, `foreign-profile`, `bad-topic`, `multi-value-t`,
`uppercase-topic`, `unknown-field`, `bad-version`, `bad-state`, `bad-superseded-by`,
`tag-content-mismatch`, `future-timestamp`, `future-horizon`.

`foreign-d` and `foreign-profile` should be unreachable from this form, because the form always
writes the prefix and the schema constant. They are still rendered rather than swallowed: reaching
one means the form and the validator have drifted, and that is worth seeing.

---

## W3. Event construction

### W3.1 The envelope

```text
kind       = POLICY.SOFTWARE_KIND = 30078            (§4.1, §4.2)
pubkey     = filled by the signer                    (§W1.3 verifies it)
created_at = §W3.4
tags       = §W3.2
content    = §W3.3
id, sig    = filled by the signer
```

### W3.2 Tags — exact, ordered, and minimal

Emitted in exactly this order, so that identical form input produces an identical event id (testable,
and the write-path analogue of I4):

```text
1.  ["d", "nosmaps:" + local]                                     # exactly one, §4.2 rule 1
2.  ["t", "nosmaps"]                                              # mandatory, §5.1, §16.2
3.  ["t", <topic>]  for each remaining topic, sorted by compareCodePoints (nostr-catalog.js:158)
```

One `t` tag per topic. Never `["t","a","b"]` — NIP-01 indexes only the first value of a tag (§19.1,
NIP-01 `01.md:84`), so the multi-value form silently loses indexing, and §5.1 rule 2 requires
validators to reject it. `validateSoftwareEvent` does (`nostr-catalog.js:299-301`).

**Decision: the optional `["state", …]` tag is not emitted.** §4.2 rule 4 makes it optional, notes it
exists "for cheap scanning only", and states that `state` is not a single-letter tag and therefore
"can never be used as a filter". So it buys nothing we consume — our own reader parses `content`
regardless — while carrying a live failure mode: any disagreement with content `state` invalidates
the event (`tag-content-mismatch`, `nostr-catalog.js:339-342`). A field that can only ever make an
event invalid, and can never make a query cheaper, is a liability. This deliberately differs from the
example events in §4.2 and §7.1, both of which show the tag; rule 4 permits omitting it, and the
examples are illustrative.

**No other tags at all.** No `client` tag, no NIP-31 `alt`, no relay hints, no `published_at`. Each
would be app-authored metadata that §4.2 does not define and that nothing in the read path reads —
which is fabricated data in the literal sense: bytes we signed that assert something we were not
asked to assert.

### W3.3 Content

`content` is `JSON.stringify` of an object built in this fixed key order:

```text
schema, version, state, name, summary, homepage?, superseded_by?
```

- `schema` = `"org.nosmaps.software"`, `version` = `1`, both computed constants.
- `state` = `"active"` for the Publish and Update actions, `"withdrawn"` for the Withdraw action
  (§W6.2). **It is never a form control.** A dropdown offering `withdrawn` on a first submission
  invites publishing a record that is born non-listable (§5.4), and there is no reading of a user's
  intent under which that is what they meant.
- `name`, `summary`, `homepage` come from the form, NFC-normalised (§W3.6).
- `homepage` and `superseded_by` keys are present only when non-empty.

**Canonicalisation.** RFC 8785 JCS is **not** applied to `content`. §10.1 is explicit: JCS "is used
**only** as the byte-exact hash input when deriving a bounded `d` component… It is not a transport,
storage, or event format anywhere in this design. Nostr event ids remain NIP-01 serialization, not
JCS." The bytes that matter are the NIP-01 event serialization the signer hashes, and `content` is
just a string inside it. `canonicalize` (`nostr-canonical.js:357`) is used on this path for exactly
one thing: the draft-versus-signed comparison in §W1.3, where it is an equality test, not a format.

Ordinary `JSON.stringify` is sufficient and is what the read path can parse: `strictParse`
(`nostr-canonical.js:251`) rejects duplicate keys (`:103`), a BOM (`:263`), invalid UTF-8, and
trailing content, none of which `JSON.stringify` of a plain object can produce.

### W3.4 `created_at` — the one place a timestamp could be fabricated

```text
now = Math.floor(Date.now() / 1000)

if no observed winner at this coordinate         -> created_at = now
if now  >  winner.created_at                     -> created_at = now
if now <=  winner.created_at                     -> created_at = winner.created_at + 1,
                                                    but only if that passes futureCheck()
                                                    (i.e. <= now + MAX_FUTURE_SKEW_SEC = 600);
                                                    otherwise refuse with `clock-conflict`
```

The `+1` branch is not an invention: it is §14.1 step 3 applied to a different replaceable kind —
"choose `created_at = max(now, prior.created_at + 1)` only if it does not exceed the minimum known
write-relay `created_at_upper_limit`; otherwise wait and report a clock conflict rather than forging
a farther-future time". It exists because §5.3 breaks ties by lowest event id, so an update stamped
at the same second as the record it replaces might simply **lose**, leaving the user staring at their
old record after a completely successful publish.

Two deviations from §14.1 step 3, both deliberate:

- The bound is `MAX_FUTURE_SKEW_SEC` (`nostr-catalog.js:47`) rather than the relay's NIP-11
  `created_at_upper_limit`, because reading NIP-11 is an HTTP request and §9.2 requires zero HTTP on
  the publication path. Using our own eligibility bound also has the better property: it is the same
  bound *every reader* applies (§12.3), so an event we accept is one our own read path can select.
- If a relay rejects on its own upper limit anyway, its `OK` message is surfaced verbatim (§W4.2)
  rather than pre-empted by a guess.

`clock-conflict` is surfaced as: "A record at this address is already timestamped
`<time>`, which is ahead of this device's clock. Check your system time." No event is signed.

Explicitly forbidden anywhere on this path: back-dating to a release date, "publication date" fields,
copying `created_at` from an older event, and letting rx-nostr default the field
(`EventParameters.created_at` is optional — §W1.3).

### W3.5 Computed versus user-supplied

| value | source |
|---|---|
| `kind` | computed constant |
| `d` prefix `nosmaps:` | computed constant |
| `d` local part | **user** |
| `t` = `nosmaps` | computed constant |
| further `t` values | **user** |
| tag order | computed, deterministic (§W3.2) |
| `content.schema`, `content.version` | computed constants |
| `content.state` | computed from the invoked action |
| `content.name`, `content.summary`, `content.homepage` | **user** |
| `content.superseded_by` | **user**, withdraw flow only |
| `created_at` | computed from the real clock (§W3.4) |
| `pubkey`, `id`, `sig` | the signer's, verified on return (§W1.3) |

**Nothing else is computed, because nothing else exists.** In particular this path never emits: an
event id it did not receive from a signer; a count of anything; a "verified"/"official" assertion
(§4.3); an observation date (that is `30370`, §10.4, out of scope); a rating (`30372`, §10.6, out of
scope); a relay list; or a curator reference.

### W3.6 Normalisation

`name`, `summary`, `homepage`, the `d` local part, and every topic are NFC-normalised
(`String.prototype.normalize('NFC')`) at input time, before validation and before serialisation.
Topics are additionally lowercased at input time. This follows §10.1 ("UTF-8 strings normalized to
NFC before authoring") and §5.1 rule 1 ("Authors normalize to NFC and lowercase before signing;
validators reject a `t` value that is not already lowercase rather than folding it").

Note the asymmetry, and keep it: **the author normalises; the validator rejects.** The form must not
rely on `validateSoftwareEvent` to normalise, because it does not — it only rejects a non-lowercase
topic (`nostr-catalog.js:302`), and it checks NFC for `30078` not at all. If the form fails to
normalise, the record is still valid; it is just indexed under bytes the user did not expect.

---

## W4. Publish semantics

### W4.1 Transport

The write path reuses the read path's relay context rather than building a second one:
`createRelayContext` (`nostr-catalog.js:1291`) already supplies `createRxNostr({ verifier })` and
`setDefaultRelays`. It is currently module-private, and `loadCatalog` disposes its context in a
`finally` block (`nostr-catalog.js:1762-1765`), so this slice must export `createRelayContext` (and a
`publishSoftwareRecord` entry point) from `window.NOSMAPS_CATALOG`. **A second transport module MUST
NOT be written**: chunking, coverage vocabulary, and timeout semantics would then exist twice and
could drift.

Publication is `rxNostr.send(signedEvent, { on: { relays: WRITE_RELAYS }, completeOn: 'all-ok',
errorOnTimeout: false })`, which returns `Observable<OkPacketAgainstEvent>` — packets carrying
`{ from, ok, notice?, done }` (`node_modules/rx-nostr/dist/packet.d.ts:49-56`). `from` is the relay
URL, which is what makes a per-relay outcome model possible at all.

`completeOn: 'any-ok'` is rejected: it completes as soon as one relay answers, discarding the other
relays' outcomes — which is precisely the blanket-success behaviour this section exists to prevent.
The app does not delegate the success decision to `completeOn` in any case; it collects packets until
`done` or `PUBLISH_TIMEOUT_MS` and computes the outcome itself.

### W4.2 Per-relay outcome model

One record per relay in `WRITE_RELAYS`, from a closed enum. There is no aggregate field that is not
derived from these.

| outcome | evidence | what it means | what it does not mean |
|---|---|---|---|
| `accepted` | `OK` with `ok === true` | that relay says it stored the event | that the event is retrievable — §W5 is what establishes that |
| `rejected` | `OK` with `ok === false` | that relay refused. `notice` is retained **verbatim** | anything about other relays; that a retry will differ |
| `auth-required` | an `OK`/`CLOSED` indicating NIP-42 | the relay wants an authenticated session | that the user lacks permission. NIP-42 is unimplemented here (§W7.3) |
| `timeout` | no `OK` within `PUBLISH_TIMEOUT_MS` | **undetermined.** The relay may hold the event and have lost the `OK` | failure. It MUST NOT be counted as one |
| `connection-failed` | socket never opened, or errored before any `OK` | undetermined, leaning negative | that the relay rejected the content |
| `not-attempted` | relay excluded from this publish | nothing was sent there | — |

Relay `notice` strings are shown **verbatim and unparaphrased**. NIP-01's machine-readable prefixes
(`blocked:`, `rate-limited:`, `invalid:`, `pow:`, `auth-required:`, `error:`) MAY additionally drive a
badge, but only after §20.3's "`OK` semantics" probe confirms both default relays actually use them;
until then the raw string is the only thing displayed. Rewriting a relay's refusal into friendlier
app copy is how a rejection becomes indistinguishable from a success in a user's memory.

### W4.3 What "published" means

> **The app says `published` for a coordinate only when the read-back of §W5 returned an event whose
> `id` equals the signed event's id from at least one configured relay, and `validateSoftwareEvent`
> passes on the returned event.**

An `OK` is *evidence for* publication. It is not the definition of it. This is the same discipline
§14.1 steps 5–6 already apply to bookmarks — "record each `OK`, then read back the exact id and
recompute the winner from all relays… On exhaustion, show a conflict with both versions and never
claim success."

Aggregate states, all derived, all closed:

| aggregate | condition | headline |
|---|---|---|
| `published` | every attempted relay `accepted`, and read-back `returned` | "Published to 2 of 2 relays." |
| `published-partial` | ≥1 `accepted` and ≥1 not, and read-back `returned` | "Published to 1 of 2 relays." Never "Published." |
| `pending` | no `rejected`, ≥1 `timeout`/`connection-failed`, read-back budget not yet exhausted | "Not confirmed yet." |
| `unconfirmed` | ≥1 `accepted`, read-back budget exhausted without `returned` | "Signed and acknowledged, but we could not read it back." (§W5.5) |
| `failed` | every attempted relay `rejected`/`auth-required`/`connection-failed` | "Not published." Per-relay reasons listed. |

### W4.4 Presenting partial success

A per-relay table is rendered **always**, including on full success. Not a toast, not a collapsed
"details" affordance that a user has to discover after the fact.

```text
Published to 1 of 2 relays.                                  as of 14:22:07 local
  wss://x.kojira.io   accepted
  wss://nos.lol       rejected — "blocked: pubkey not allowed"

Clients that read only wss://nos.lol will not see this record. (§8.3 partition A)
```

Two rules the copy must follow:

1. The headline carries the count, never a bare "Published". "1 of 2" and "2 of 2" must be
   distinguishable at a glance, because they are different facts about the world.
2. Partial success names the consequence — some readers will not see this record — rather than
   leaving the user to infer it. This is the write-side face of §8.3 example A, and it is the honest
   version of the same event.

### W4.5 Retry

A retry re-sends **the same signed bytes** to the relays that are not `accepted`. It never re-signs
and never re-stamps `created_at`. Re-signing would produce a second event at the same coordinate with
a different id, making read-back ambiguous (which id are we confirming?) and adding a §5.3 tie-break
that nobody asked for.

Retries are **user-initiated**, capped at `PUBLISH_MANUAL_RETRIES = 2`. There is no silent background
retry. A retry that succeeds quietly after the user has read "not published" is a lie in the opposite
direction, and it moves the moment of truth to a screen nobody is looking at.

---

## W5. Read-back verification

### W5.1 The two queries

One logical REQ round per attempt, two filters, both single-author (so §5.2's group-by-author rule is
satisfied trivially), chunked by `chunkFilters` (`nostr-catalog.js:1079`):

```json
[
  {"kinds":[30078],"authors":["<publisher>"],"#d":["nosmaps:<local>"],"limit":8},
  {"kinds":[30078],"authors":["<publisher>"],"#t":["nosmaps"],"limit":16}
]
```

Filter 1 is the verification query. `limit:8` rather than `1` because §5.3 is explicit that a relay's
own "latest" is not global truth and clients must union first; 8 leaves room for divergent versions
to be visible.

Filter 2 is the `#t` index probe, scoped to our own author so it costs almost nothing. §13.1 calls
`#t` indexing on kind `30078` "the single most load-bearing probe in this design", and §20.3 already
lists it as a preflight item. Running it on every publish means every publish contributes a data
point, from a real record, on a real relay, for free.

### W5.2 What the `#t` probe does and does not prove

Recorded per relay as `t-index: returned | not-returned | query-failed`, and fed into the same
`incomplete: t-index-unsupported` marking §13.1 defines.

- **Negative is strong.** If filter 1 returns the event and filter 2 does not, that relay either does
  not index `#t` on this kind or is filtering it away. Either way discovery there is broken and the
  relay degrades to recall-only (§5.2, §6.6).
- **Positive is weaker than it looks.** A relay that ignores the `#t` term entirely and matches on
  `authors` alone also returns the event. So a positive result is *consistent with* indexing without
  proving it. The diagnostic wording must say "returned via `#t`", not "`#t` is indexed". Proving the
  positive needs a control record by the same author **without** the tag, which belongs in the §20.3
  preflight probe, not in a user's publish flow.

### W5.3 Three states, per relay and aggregated

| state | evidence | meaning |
|---|---|---|
| `returned` | an event with the expected `id` arrived, and `validateSoftwareEvent` passes | confirmed on that relay. Signature and id were already checked by rx-nostr's verifier before the packet reached us (`nostr-catalog.js:1298-1301`, I1) |
| `not-returned-yet` | the round reached EOSE without the id | **only** "not returned in this round". §12.1 rule 7 and §5.1 rule 4 both say an empty result proves nothing global. The `-yet` in the name is load-bearing |
| `query-failed` | timeout, socket error, `CLOSED`, or auth-required | **nothing was learned.** This is not `not-returned`, and it MUST NOT be aggregated with it |

A relay in `query-failed` never contributes to a negative conclusion. If every relay is
`query-failed`, the aggregate is `unconfirmed: coverage-incomplete` and names the unreachable relays,
in the §3 vocabulary (`incomplete`).

### W5.4 Winner selection on read-back

Read-back does not stop at "is my id present". The returned events are passed through
`selectSoftwareWinners` (`nostr-catalog.js:566`) exactly as the read path does (§5.3), because the
answer the user needs is *what will people see*, not *did my bytes arrive*.

- winner id = our id → `returned`.
- winner id ≠ our id, newer `created_at`, same pubkey → `superseded-during-publish`. The publisher
  published from another device or tab. Both ids and both `created_at`s are shown; the app does not
  pick a side and does not retry.
- our event is present but quarantined by the read path → `readback-quarantined` with the reason
  slug. This should be unreachable (§W1.3 re-validated the signed event) and is therefore worth
  surfacing loudly if it ever happens.

### W5.5 Wait, retry, and the point at which the app stops claiming anything

```text
attempt 1  immediately after the OK deadline           (READBACK_BACKOFF_MS[0] = 0)
attempt 2  2s   after attempt 1 settles
attempt 3  8s   after attempt 2 settles
each attempt: READBACK_TIMEOUT_MS = 8_000
budget:       READBACK_ATTEMPTS = 3, then stop
```

Retries inside the budget are automatic, bounded, and visible ("checking, attempt 2 of 3"). A small
automatic wait is honest because relay propagation genuinely is eventually consistent on a
seconds timescale, and making the user click three times to observe that costs them without teaching
them anything.

**After attempt 3, the app stops claiming anything.** Terminal state `unconfirmed`, with this
meaning and no other:

> "Your signer signed it and `wss://x.kojira.io` acknowledged it, but we could not read it back from
> any configured relay in 3 attempts over 18 seconds. It may still be stored there. Check again."

A manual **Check again** button runs exactly one more round. It never runs on a timer, and the app
never flips to `published` on a background poll after the user has been shown `unconfirmed` and moved
on.

**A `not-returned-yet` or `query-failed` result MUST NEVER render as success.** The success string is
emitted from exactly one code path, guarded on `returned`, and no other code path may produce it.
This is invariant W-I3, and it is directly testable (§W9, W-T22).

### W5.6 The cache, and the record that is not yet a row

Only `returned` events are written to the derived cache, through the same `cache.putRecord` path the
read layer uses (`nostr-catalog.js:1722-1731`). Consequently:

**The catalog never renders the user's own unconfirmed submission as a row.** No optimistic insert,
no "pending" ghost card in the grid, no local-only entry. §5.4 defines listability as the existence of
an observed valid active winner; a draft the relays have not confirmed is not one, and painting it
into the list would be D7 fabrication with the user's own data — the most convincing kind.

The publish screen shows the submission's status. The catalog shows what was observed. They are
different surfaces because they are different claims.

---

## W6. Update, withdrawal, and reactivation

### W6.1 Finding your own records

Withdrawal creates a problem the read design does not have to solve: once a coordinate's winner is
`withdrawn` it is not listable (§5.4), so the publisher cannot find it in the catalog in order to
reactivate it. The manage screen therefore issues one logical REQ round:

```json
[{"kinds":[30078],"authors":["<self>"],"limit":64}]
```

This is an exact single-author filter for the viewer's own key. It is neither a broad kind scan nor
"arbitrary author discovery" in §13.1's sense, and §13.1 now says so explicitly: its "Carve-out — the
viewer's own key" permits exactly this query and nothing wider (RESOLVED OPEN-9). The reasoning is
that an exact match on a key the viewer already holds is not a scan over a key space and discovers
nothing the viewer did not publish. The query stays subject to the same caps, coalescing, and chunking
as any other.

Results are validated by `validateSoftwareEvent` like everything else, which means the publisher's
*other* applications' `30078` records — the `AmethystSettings`, `nostter-read`, `seen_notifications_at`
kind of record §4.2 documents as the specified normal state — come back and are dropped as
`foreign-d`. They are not shown, not counted, and not described as broken. Nothing on this screen may
offer to edit or overwrite them.

### W6.2 Update, withdraw, reactivate

All three are the same mechanism — a newer valid winner at the same coordinate (§5.3, §7.1) — with a
different computed `state` and different copy.

| action | `content.state` | `d` | notes |
|---|---|---|---|
| Update | `active` | **unchanged** | ordinary edit; §W3.4 governs `created_at` |
| Withdraw | `withdrawn` | **unchanged** | `name` and `summary` remain required (§7.1) so a client can still explain *what* was withdrawn. The form pre-fills `name` and invites replacing `summary` with the reason |
| Reactivate | `active` | **unchanged** | §7.1: "A later valid `active` winner reactivates it; nothing else can" |

**`d` is immutable in the edit form.** It is rendered read-only with an explanation: changing `d`
does not rename a record, it creates a second, unrelated record and leaves the first one live
(§4.3 — tool identity *is* the full coordinate). A user who wants a different address is routed to
the new-record flow, which makes the consequence explicit.

Winner selection is entirely the read design's: §5.3 for the rule, §5.4 for what listable means, I3
for "newest valid wins", §12.1 rule 6 for a replacement observed later moving or removing a row.
Nothing about it is re-specified here.

### W6.3 `superseded_by`

Offered only in the withdraw flow, as an optional "this record moved to" coordinate, validated by
`isValidCoordinate` with the self-loop check already present (`nostr-catalog.js:331-334`). Migration
chain behaviour — depth, cycles, unavailable destination — is §11 and is entirely a read-path
concern.

§11 says the field is "effective only when the old winner is `state:"withdrawn"` or explicitly marks
migration". The v1 content profile has no field that can express "explicitly marks migration", and
unknown keys are rejected, so the second branch is unimplementable as written (OPEN-2). This slice
therefore offers `superseded_by` only together with `withdrawn`, which is the branch that works.

### W6.4 Who may, and how that is enforced

Only the coordinate's own pubkey (I2). Three layers, because the outer two are convenience and only
the inner one is real:

1. **Protocol.** The coordinate embeds the pubkey; a relay accepting an event signed by a different
   key stores it at a *different* coordinate. Nothing the app does can violate I2, and nothing the
   app does is what enforces it.
2. **UI.** Edit / Withdraw / Reactivate are rendered only when `signerState === 'authorised'` and the
   authorised pubkey equals `winner.publisher`.
3. **Pre-sign recheck.** Immediately before `signEvent`, `getPublicKey()` is called again. If the
   result differs from the pubkey the form was opened with, the flow aborts with `pubkey-mismatch`,
   the identity is updated, and the user is told which key is now active. This is the account-switch
   case from §W1.4 and it is the only one of the three that catches it.

### W6.5 What the UI shows, and when

Before publishing: the currently observed winner's event id, `created_at`, and which relays served it
— the §8.1 diagnostic list, which the read path already computes.

After publishing: §W4.4's per-relay table and §W5's read-back state. Crucially, **the record is not
described as withdrawn until read-back confirms the withdrawn event.** Until then:

> "Withdrawal published to 1 of 2 relays. Clients reading only `wss://nos.lol` will still see this
> record as active." (§8.3 example A, from the publisher's side.)

And permanently, on the withdraw confirmation: withdrawal is not deletion. §7.4's table is explicit
that "what did X look like before" and "was any event deleted" are both **No**, and §7.3 forbids
describing deletion as erasure. The copy says the record stops being listed by clients that observe
the withdrawal, and that older versions may persist on relays that do not.

### W6.6 No kind 5

§7.1 permits a publisher to additionally publish a kind `5`. **This slice does not.** §7.3 is
unambiguous that kind 5 is "best-effort cleanup, not a ledger" and that "For long-lived logical
removal, publishers MUST use §7.1" — so the withdrawal event is the whole mechanism, and the kind 5
adds a second event, a second per-relay outcome model, and a second read-back, for zero semantic
gain. It also adds a real hazard: a user who sees "deletion request sent" will read it as erasure,
which is the one thing §7.3 says a client must never imply.

If it is added later, it needs its own copy — something like "also ask relays to drop older versions
(relays are not required to comply, and other clients may keep them)" — reviewed as its own change.

---

## W7. Scope boundary — reviews, and everything else this slice does not publish

### W7.1 Decision

**This slice publishes kind `30078` and nothing else.** Review publishing is a later slice. Both
halves of "reviews" are out, for different reasons:

**NIP-22 kind `1111` comments — out, because the design says so and the citations are unverified.**
§2 lists "No NIP-22 comments in MVP"; §15 is titled "future comments — draft, outside MVP"; §19.2
records NIP-22's tag scoping as carried forward and **not re-verified**. Publishing against unverified
tag semantics is categorically worse than reading against them: a mis-scoped read renders wrongly and
is fixed by a redeploy, while a mis-scoped `1111` is a signed event on other people's relays that
§7.3 says cannot be reliably retracted. Write bugs are permanent in a way read bugs are not, and that
asymmetry is the whole argument.

**Kind `30372` reviews — out, because the read path cannot read them yet.** §10.6 defines the schema,
but there is no `validateReviewEvent` in `nostr-catalog.js` (its full export surface is
`nostr-catalog.js:1767-1790`; the only validators are software, curation set, follow list, deletion).
Publishing `30372` would therefore require this slice to ship a validator the read path does not
have — creating exactly the second validator §W0.1 forbids — and would produce write-only data the
app cannot render, which §W5.6 already refuses to do with the user's own `30078` submissions. It also
needs `d = review:<sha256(tool-coordinate)>` (§10.6) and content/`a`-tag equality, which is a new `d`
grammar on the write side before there is one on the read side.

The ordering rule that falls out of this, and that should govern every later slice:

> **A kind becomes publishable only after the read path can validate, select, and render it.** The
> validator comes first, the write form second.

### W7.2 Curation sets (`30267`) — also out, and for a different reason

`30267` passes the ordering rule: `validateCurationSetEvent` exists (`nostr-catalog.js:368`). It is
still out of this slice because publishing a curation set is a **read-modify-write over a replaceable
list**: fetch the current set across relays, union-then-select the winner, add or remove one `a` tag,
preserve every entry you did not touch, handle the concurrent-edit conflict, republish. That is the
§14.1 algorithm, not the §W4 one — §14.1 steps 1–6 exist precisely because a naive republish silently
drops other devices' edits. It belongs in the same slice as bookmarks, sharing that machinery.

### W7.3 Also out, listed so the boundary is a line and not a fog

- Kinds `30368`–`30371` (§10.2–§10.5) — no read-side validators; same ordering rule as `30372`.
  **Still out after the 2026-08-18 amendment, and this is worth saying explicitly.** §21 rewrote
  `30369`'s contract (§10.3) and registered a liveness `observation_type` on `30370` (§10.4). Neither
  change unblocks either kind: `nostr-catalog.js` still exports no `validateConformanceEvent` and no
  `validateObservationEvent` (its full surface is `nostr-catalog.js:1767-1790`), so §W7.1's ordering
  rule — *a kind becomes publishable only after the read path can validate, select, and render it* —
  excludes them exactly as before. §21 was done **now** for a different reason: so the `30078` form in
  §W2 is not built around a shape that turns out to be wrong, and so the capability form, when its
  slice arrives, has a schema that the real data fits.
- Kind `5` deletion requests — §W6.6.
- Kind `10003` private bookmarks — §14; needs NIP-44 capability handling.
- Kind `0` profile editing, kind `3` follow editing, kind `7` reactions.
- NIP-42 AUTH. Carried forward unverified (§19.2), and an authenticator is a second signing surface
  (challenge signing) with its own consent story. A relay demanding AUTH is reported as
  `auth-required` (§W4.2) and not fought.
- NIP-65 outbox relay lists. §16.1 names them as a possible later widening of coverage; write relays
  here are the configured relay set, full stop.
- Any HTTP. §9.2's zero-HTTP requirement covers the publication row too.

---

## W8. Failure-state matrix

The invariant first, because every row is an instance of it:

> **No failure on this path renders as success, and no failure produces a value the app did not
> observe.** Where the app does not know, it says which of the three it is — did not happen, happened
> but unconfirmed, or could not be checked — and stops.

| # | stage | failure | machine state | user sees | never claimed |
|---|---|---|---|---|---|
| 1 | signer | no `window.nostr` | `signer: absent` | "No Nostr signer detected." Publish UI not rendered | that publishing failed; that a key is required to browse |
| 2 | signer | user has not connected | `signer: present-unauthorised` | "Connect to publish." | any identity |
| 3 | signer | `getPublicKey()` rejects | `signer: rejected` | "Your signer declined. If you dismissed the prompt, press Connect again." | that the user refused; that the extension is broken |
| 4 | signer | `getPublicKey()` returns non-hex | `signer: error / nip07-key-unparsable` | "Your signer returned an unusable key." | a pubkey; a partial identity |
| 5 | signer | `signEvent()` rejects | `signer: rejected` | as row 3, on the publish screen | that anything reached a relay |
| 6 | signer | `signEvent()` never settles in `SIGNER_TIMEOUT_MS` | `signer: error / signer-timeout` | "Your signer did not respond." | that it was signed; that it was published |
| 7 | signer | returned event mutated | `signer: error / signer-mutated-event` | "Your signer changed the event before signing it. Nothing was published." Diff shown | that the mutation is harmless; nothing is sent |
| 8 | signer | returned event fails the validator | `signer: error / signer-invalid-record` | as row 7, with the reason slug | — |
| 9 | signer | pubkey changed since the form opened | `pubkey-mismatch` | "The active key changed to `npub1…`. Confirm before signing." | that the record belongs to the new key |
| 10 | form | any validator failure | `draft-invalid: <reason>` | inline reason; Publish disabled | that the draft is nearly valid; no partial publish exists |
| 11 | form | `d` over 192 bytes | `bad-d` | byte counter over the limit; Publish disabled | a truncated `d`. **Never truncate** (§W2.3) |
| 12 | form | a fact the profile has no field for | — | the field does not exist (§W2.4) | that it was saved anywhere |
| 13 | clock | observed winner is ahead of local time beyond skew | `clock-conflict` | "A record here is timestamped ahead of this device's clock." Nothing signed | a forged future `created_at` |
| 14 | publish | relay `OK false` | `relay: rejected` | relay row with the verbatim message | that other relays rejected it; a paraphrase |
| 15 | publish | relay wants NIP-42 | `relay: auth-required` | "This relay requires authentication, which this app does not do yet." | that the user is banned |
| 16 | publish | no `OK` in `PUBLISH_TIMEOUT_MS` | `relay: timeout` | "No answer." Counted as undetermined | failure **or** success |
| 17 | publish | socket error | `relay: connection-failed` | "Could not connect." | that the content was refused |
| 18 | publish | every relay non-accepting | `failed` | "Not published." Per-relay reasons | that a retry will work |
| 19 | publish | some accept, some do not | `published-partial` | "Published to 1 of 2 relays" + the consequence sentence | "Published" |
| 20 | read-back | EOSE without the id | `not-returned-yet` | "Not confirmed yet (attempt N of 3)." | that it is absent from the relay or from the network |
| 21 | read-back | query timeout / error | `query-failed` | "Could not check `wss://…`." | `not-returned`; any aggregate conclusion |
| 22 | read-back | budget exhausted | `unconfirmed` | §W5.5's sentence, plus **Check again** | `published`, ever, on any surface |
| 23 | read-back | a newer winner by the same key | `superseded-during-publish` | both ids and timestamps | that our version is live; an automatic retry |
| 24 | read-back | returned but quarantined | `readback-quarantined: <reason>` | loud diagnostic — this should be unreachable | that the record is listable |
| 25 | discovery | `#t` probe negative | `t-index: not-returned` | "This relay may not index `#t`; your record may not appear in discovery there." Links to §5.2 recall | that `#t` is definitely unindexed (needs the §20.3 control probe) |
| 26 | catalog | submission not yet confirmed | — | no row in the catalog | an optimistic row (§W5.6) |

### W8.1 Write-path invariants

- **W-I1 Nothing is published that the read path cannot read.** Every draft passes
  `validateSoftwareEvent` before signing, and it is the same function object the read path calls.
- **W-I2 Nothing is published that the signer altered.** The signed event is re-validated and
  compared byte-for-byte on `{kind, created_at, tags, content}` against the draft.
- **W-I3 No failure renders as success.** `published` is emitted from exactly one code path, gated on
  a `returned` read-back. `not-returned-yet` and `query-failed` are not success states and are not
  aggregated with each other.
- **W-I4 No fabricated values.** Every published byte is user-supplied or computed by a rule stated in
  §W3.5. `created_at` is the real clock, or the §14.1-derived `+1` bump, which is disclosed.
- **W-I5 Per-relay truth.** Outcomes exist per relay and are always displayed per relay, including on
  full success.
- **W-I6 Publisher locality.** Only the authorised pubkey's own coordinates are writable, and a key
  change between form-open and signing aborts the flow.

---

## W9. Testability

The observable assertion for each decision, in the style of §20.2, so the test list is derivable
without further design work. The harness is the existing Playwright setup (`playwright.config.js`,
`tests/*.spec.js`); `window.nostr` and the relay socket are both injectable via `page.addInitScript`,
which is how `tests/relay-render.spec.js` already mocks relays.

**Signer and session (§W1)**

- W-T1 With no `window.nostr`, the Publish control is **absent from the DOM**, not merely disabled,
  and the catalog still renders.
- W-T2 With `window.nostr` present, zero NIP-07 methods are called before a user gesture. Assert by
  counting calls on the injected stub after load.
- W-T3 `getPublicKey()` rejecting leaves `signerState = rejected`; the headline contains the hedged
  wording and does not contain the word "rejected by you" or equivalent.
- W-T4 `getPublicKey()` resolving `"not-a-key"` leaves `signerState = error`, reason
  `nip07-key-unparsable`, and no pubkey is displayed anywhere.
- W-T5 `getPublicKey()` never settling leaves `signerState = error` after `SIGNER_TIMEOUT_MS` (with a
  faked timer), and no relay socket was opened.
- W-T6 A signer that appends `["client","x"]` to `tags` produces `signer-mutated-event`, and the relay
  mock records **zero** `EVENT` messages.
- W-T7 A signer returning a valid signature over a `content` we did not author produces
  `signer-mutated-event`; same zero-EVENT assertion.
- W-T8 After reload, `localStorage` contains a pubkey but `signerState` is `absent` or
  `present-unauthorised`; the catalog is ranked; the Publish control is not enabled.
- W-T9 `localStorage` never contains a string matching `nsec1`, a 64-hex key that is not the pubkey,
  or a `"sig"` field — asserted by scanning the whole storage after a full publish flow.
- W-T10 A signer that returns pubkey `A` at form-open and `B` at publish aborts with
  `pubkey-mismatch` and sends nothing.

**Form (§W2)**

- W-T11 The rendered form's input set equals exactly the §W2.2 map. A snapshot test fails if any
  input is added, which is the point.
- W-T12 The Publish button's enabled state equals `validateSoftwareEvent(draft).ok` across a fixture
  table covering every reason slug in §W2.5.
- W-T13 `d` boundary fixtures: local part of 184 bytes → valid; 185 bytes → `bad-d` and Publish
  disabled; the rendered `d` is never shorter than what the user typed (no truncation).
- W-T14 A non-ASCII character in the `d` local part → `bad-d`, with the byte counter reflecting UTF-8
  bytes, not characters.
- W-T15 A blank Homepage produces content **without** a `homepage` key (assert on the exact content
  string, not the parsed object); `http://…` → validator failure.
- W-T16 A blank Summary produces `"summary":""` and validates; removing the key entirely fails.
- W-T17 A 120-code-point name with astral-plane characters validates; 121 does not. Asserts
  `charLength` semantics rather than `String.length`.
- W-T18 The `nosmaps` topic cannot be removed through any UI interaction.
- W-T19 An uppercase topic typed into the form is lowercased at input; the validator is never reached
  with `uppercase-topic` from normal typing, and still rejects it when reached directly.

**Event construction (§W3)**

- W-T20 Given fixed form input and a frozen clock, the constructed event is **byte-identical** across
  runs, including tag order — the write-side analogue of I4.
- W-T21 The constructed event contains no `["state", …]` tag, no `client` tag, and no `alt` tag.
- W-T22 With an observed winner at `created_at = T`, a publish at wall-clock `T` produces `T+1`; at
  `T-1` produces `T+1`; at `T+700` produces the wall-clock value; a winner at `T = now + 1200`
  produces `clock-conflict` and no signature request.
- W-T23 The event handed to `signEvent` has `created_at` set. Assert the property exists on the
  argument, so a regression to library-defaulted timestamps fails here.

**Publish (§W4)**

- W-T24 Two mock relays, one `OK true` one `OK false`: aggregate is `published-partial`, the headline
  contains "1 of 2", the relay's message appears verbatim in the DOM, and the string "Published to
  2 of 2" appears nowhere.
- W-T25 One relay `OK true`, one silent: the silent relay renders as `timeout` and is counted neither
  as accepted nor as rejected. Assert the count string is not "2 of 2".
- W-T26 Both relays `OK false`: `failed`, and no success string anywhere in the DOM.
- W-T27 Retry sends the identical event id to the non-accepting relay only. Assert the relay mock saw
  the same id twice and the accepted relay saw it once.
- W-T28 No background retry: after `failed`, with 60s of faked time and no user interaction, the relay
  mock records no further `EVENT`.

**Read-back (§W5)**

- W-T29 Relay accepts and serves the event: `returned`, aggregate `published`, and the row appears in
  the catalog.
- W-T30 **Relay accepts and never serves the event**: after 3 attempts the state is `unconfirmed`, the
  DOM contains "could not read it back", and the success string is absent. This is the headline
  regression test for W-I3.
- W-T31 Read-back socket errors on every attempt: `query-failed`, and the copy distinguishes it from
  `not-returned-yet`. Assert the two states produce different strings.
- W-T32 Read-back returns a newer event by the same pubkey: `superseded-during-publish`, both ids
  rendered, no automatic retry.
- W-T33 The `#d` filter returns the event but the `#t` filter does not: `t-index: not-returned` is
  recorded for that relay and the discovery caveat is shown; the publish itself is still `published`.
- W-T34 The unconfirmed submission is **not** in the catalog row set and **not** in IndexedDB. Assert
  on the cache store directly.
- W-T35 REQ trace: exactly one logical read-back round per attempt, two filters, both single-author;
  zero HTTP requests across the entire publish flow (assert `stats.httpAttempts === 0`, which
  `nostr-catalog.js:93-99` exists to make assertable).

**Update and withdrawal (§W6)**

- W-T36 The manage query returns the publisher's `AmethystSettings`-style foreign `30078` record; it
  is absent from the manage list, recorded as `foreign-d`, and no control offers to edit it.
- W-T37 `d` is read-only in the edit form; no interaction can change it.
- W-T38 Withdraw publishes `state:"withdrawn"` with `name` and `summary` still present, and the
  validator accepts it.
- W-T39 After a confirmed withdrawal the coordinate is not listable; after a later `active` publish it
  is listable again — the write-side of §20.2 test 10.
- W-T40 Withdrawal accepted by one of two relays: the copy states that clients reading the other relay
  still see the record, and does not say "withdrawn" unqualified.
- W-T41 The withdrawal confirmation copy contains no claim of deletion or erasure. Assert against a
  banned-substring list.
- W-T42 No kind `5` event is ever sent. Assert the relay mock saw only kind `30078`.

**Scope (§W7)**

- W-T43 The relay mock sees no event of any kind other than `30078` across every flow in the test
  suite.

**i18n**

- W-T44 Every string introduced by the write path exists in all shipped languages;
  `tests/i18n-integrity.spec.js` extends to the new keys, and `i18n.js:127-146` makes a missing one
  visible rather than silent.

---

## W10. Amendments the read design will need

Listed so they are not lost, and so any divergence is deliberate rather than a drift. Items 1–3 are
still outstanding. Items 4–7 were **applied to `design-relay-native-data.md` in this revision** by the
owner's ruling on OPEN-1/3/4/8/9; they are kept here, marked applied, so the history of what changed
and why is not lost.

1. **§9.2 budget table, `publisher publication` row.** *(outstanding)* Currently "`EVENT` + `1`
   read-back". The retry policy of §W5.5 makes it `EVENT` + up to `READBACK_ATTEMPTS = 3` read-back
   rounds, plus one manual round per **Check again** press. §14.1's bookmark row already carries the
   honest form ("`2+` … retries add rounds"); the publication row should match. The manage screen
   (§W6.1) adds one more logical round, and needs its own row.
2. **§20.3 preflight.** *(outstanding)* Add: whether each default relay accepts a kind-`30078` write
   from an arbitrary pubkey without NIP-42; its `OK` message vocabulary and whether NIP-01's
   machine-readable prefixes are used; whether it enforces `created_at_upper_limit` on write; and a
   `#t`-indexing **control** probe using a same-author record that omits the tag (§W5.2).
3. **§19.2.** *(outstanding)* Add NIP-07 — the design depends on it in §6.2 step 1 and the code calls
   it at `nostr-catalog.js:1533-1546`, and it is cited nowhere. See OPEN-5.
4. **§13.1 self-query carve-out.** *(applied)* The prohibition on "arbitrary author discovery" now
   carries an explicit carve-out for an exact single-author query on the viewer's own key (§W6.1).
   See RESOLVED OPEN-9.
5. **§7.1, §5.2, §9.1 R3 examples.** *(applied)* Those examples' `d` values now carry the `nosmaps:`
   prefix that §4.2 rule 1b makes mandatory. See RESOLVED OPEN-1.
6. **§5.1 `t` byte ceiling.** *(applied)* §5.1 now carries rule 2b, recording the 128-UTF-8-byte
   ceiling on a `t` value that `validateSoftwareEvent` already enforces. See RESOLVED OPEN-3.
7b. **The §21 amendment.** *(applied to `design-relay-native-data.md`, 2026-08-18)* §21 is a new
   section; §3 gains `RECORD_AGE_WARN_AFTER`; §4.2 gains rule 2b and a `state`-is-about-the-record
   note; §5.1 gains rule 3b; §8.2 gains invariant I9; §10.3 is rewritten; §10.4 gains the
   `org.nosmaps.liveness` observation type; §19.3 is amended and §19.4 added; §20.1's BUD check is
   narrowed; §20.2 gains items 24–29. **The v1 content profile is unchanged**, so §W2's field map,
   §W3's construction, §W4's publish semantics and §W5's read-back are all untouched; only §W2.2's
   Summary and Topics rows, §W2.4, §W7.3 and this section changed here.
7. **§4.2 rule 2 `homepage` unit; §4.2 `d` grammar note.** *(applied)* Rule 2 now states that the
   `homepage` 2,048 ceiling is counted in UTF-8 bytes, and §4.2 carries a note recording that
   `30078`'s `d` deliberately keeps rule 1's permissive printable-ASCII grammar rather than adopting
   §10.1's narrower one. See RESOLVED OPEN-4 and RESOLVED OPEN-8.

### W10.1 Code amendments required

Not made here either — this document does not change code, and none of the resolutions below were
allowed to.

1. **`validateSoftwareEvent` must count `homepage` in UTF-8 bytes.** *(required, not applied)*
   §4.2 rule 2 now states the 2,048 ceiling in **UTF-8 bytes** (RESOLVED OPEN-4), but the validator
   applies `c.homepage.length > 2048` (`nostr-catalog.js:326`), which is UTF-16 code units. The two
   agree for every ASCII URL and for every percent-encoded one, and **diverge for a non-ASCII IRI**:
   a 1,200-character IRI of three-byte CJK characters is 3,600 UTF-8 bytes — invalid under the design,
   accepted by the code today; and any string above 2,048 code units is already rejected by the code,
   so the divergence is one-directional (the code is *more* permissive than the design, never less).
   The fix is to replace `.length` with `utf8ByteLength(c.homepage)` — the helper is already imported
   at `nostr-catalog.js:20` and is what `d` and `t` are measured with (`:281`, `:303`). Tightening a
   ceiling can newly quarantine existing records, so this needs the same treatment §4.2's grammar note
   describes: no observed record is known to be affected, but the change should land with a
   quarantine-count check rather than silently.
   *Not in scope for this document; recorded so it is not lost.*

2. **Five further code amendments are listed in §21.10** *(required, not applied)* — multi-valued
   topics with verbatim free-topic rendering, an eight-value support ladder, opaque non-numeric NIP
   ids with a resolution status, record-freshness split from project-liveness, and keeping
   `data.js`'s already-observation-shaped `nips[]` record. They are read-path amendments, so they
   live in the read design rather than here; none of them changes the write path, because none of
   them changes the v1 profile.

---

## W11. OPEN and RESOLVED

Everything below could not be decided from the read design or the code at the time this document was
written. Each carries what evidence would settle it. None of them is silently answered anywhere above.

*(Amended 2026-08-18: OPEN-11 through OPEN-14 are recorded in the read design's §21.11, because they
are read-design decisions. OPEN-15 and OPEN-16 are write-path and are recorded below. OPEN-2 gains
four real cases and remains open — see §21.11.)*

Five of the first ten have since been **decided by the owner** as decidable without further input:
OPEN-1, OPEN-3, OPEN-4, OPEN-8 and OPEN-9 are now **RESOLVED**. Their original statements are kept
verbatim below the resolution — the history is not deleted — and each carries the ruling, the reason,
and where the edit landed. The other five remain **OPEN**, and each says so explicitly and names the
evidence that would settle it.

**RESOLVED OPEN-1 — rule 1b is normative; the examples were stale.**

*Ruling.* §4.2 rule 1b stands unchanged. The unprefixed `d` values in the read design's examples are
stale text and have been corrected to carry the `nosmaps:` prefix.

*Reason.* `30078` is a **shared** kind under NIP-78 — foreign records on it are the specified normal
state, not an anomaly — so the `nosmaps:` `d` prefix is the only mechanism that separates our records
from other applications' at the tag level, decidable without parsing `content`. The validator depends
on it (`validateSoftwareEvent`'s `foreign-d` branch), the tests depend on it, and the real-relay
foreign fixtures (`nostter-read`, `AmethystSettings`, `heat:user:90d:v2`, …) are only classifiable
because of it. The unprefixed examples date from when a dedicated kind was assumed and no prefix was
needed; they did not survive the move to `30078`. Making the examples normative instead would delete
the separation the whole §4.2 design rests on.

*Where it landed.* `design-relay-native-data.md`: §5.2's exact-fetch filter, §7.1's withdrawal
example, and §9.1's R3 filters and `#a` coordinate. Rule 1b itself is untouched, and no code changed.

*Original statement, kept for history:* §4.2 rule 1b makes
`d` MUST begin with `nosmaps:`, and `validateSoftwareEvent` returns `foreign-d` otherwise
(`nostr-catalog.js:276`). But §7.1's withdrawal example uses `["d", "com.example.tool"]`, §5.2's
exact-fetch example filters `"#d":["tool-a","tool-b"]`, and §9.1's R3 example uses
`"30078:<publisher-A>:tool-a"` — all unprefixed, all `quarantined: foreign-d` under rule 1b. The
write path cannot copy these examples, and did not. Settled by: a decision on whether rule 1b or the
examples is normative. Expected resolution is that the examples are stale rev-1 text and should be
prefixed, but that is an edit to the read design and is not made here.

**OPEN-2 — STILL OPEN. §11's "explicitly marks migration" names no field the v1 profile can express.**
*This remains open and is not decided by the current round of rulings.* It is settled by a read-design
decision, and the evidence that settles it is a choice between exactly two edits: either §11's second
branch is deleted (making `withdrawn` the only trigger, which is what §W6.3 already implements), or a
migration marker is added to the §4.2 rule 2 key set — which is a `version` bump, because the v1
profile rejects unknown keys, so every existing record and the validator's `unknown-field` branch are
in scope. Nothing observable can decide this; it is a design choice, and until it is made §W6.3's
withdraw-only branch is the only implementable reading. §11 says
`superseded_by` is "effective only when the old winner is `state:"withdrawn"` or explicitly marks
migration". The v1 content profile (§4.2 rule 2) has exactly seven keys and rejects unknown ones, so
there is no way to mark migration without withdrawing. §W6.3 therefore offers only the `withdrawn`
branch. Settled by: either deleting the second branch from §11, or adding a field to the profile with
a `version` bump.

**RESOLVED OPEN-3 — the limit is recorded in §5.1, matching the code exactly.**

*Ruling.* §5.1 gains rule 2b: a `t` value is at most **128 UTF-8 bytes**. The value, the unit, and the
rejection behaviour are taken from `nostr-catalog.js:303` verbatim
(`utf8ByteLength(tag[1]) > 128` → `bad-topic`). **No code change.**

*Reason.* Of the two ways to close this gap — record the code's limit in the design, or pick a
different number and change both — only the first costs nothing. The code's value is already in
production behaviour, `TOPIC_MAX_BYTES = 128` in §W0.2 already adopts it, and no evidence suggests 128
is the wrong number. Choosing any other value would newly quarantine topics that validate today for no
stated benefit. So the design is corrected to match the code, not the reverse.

*Where it landed.* `design-relay-native-data.md` §5.1, new rule 2b (numbered `2b` rather than
renumbering 3–5, because §W2.2 and §4.2 rule 5 cite "§5.1 rules 1–2" and "§5.1 rule 5" by number).
§W0.2's `TOPIC_MAX_BYTES` comment now cites §5.1 rather than "code-only".

*Original statement, kept for history:* `nostr-catalog.js:303` rejects a
topic longer than 128 UTF-8 bytes. No section of the read design states this limit; §5.1 constrains
only case and multiplicity. §W0.2 adopts the code's value. Settled by: recording the limit in §5.1, or
correcting it there and in the validator together.

**RESOLVED OPEN-4 — `homepage` 2,048 is counted in UTF-8 bytes; the validator diverges and must be
amended.**

*Ruling.* The unit is **UTF-8 bytes**, and §4.2 rule 2 now says so explicitly.

*Reason.* Consistency with every other length limit in this design: §10.1 requires UTF-8 byte counting
for the candidate kinds' fields, and §4.2 rule 1's `d` ceiling is already measured in UTF-8 bytes by
the same helper. A design in which one field is measured in bytes and its neighbour in code units has
a unit bug waiting in it; picking the unit the rest of the document already uses costs nothing and
removes the ambiguity permanently.

*Consequence for the code — recorded, not applied.* `validateSoftwareEvent` uses
`c.homepage.length > 2048` (`nostr-catalog.js:326`), i.e. UTF-16 code units, and therefore **diverges
from this rule for non-ASCII IRIs**. The divergence is one-directional: the code is more permissive
than the design (a 1,200-character CJK IRI is 3,600 UTF-8 bytes and passes today), never stricter.
This is a **required code amendment**, filed as §W10.1 item 1, and it is deliberately **not made in
this round** — no code was changed here.

*Where it landed.* `design-relay-native-data.md` §4.2 rule 2 (unit stated, divergence noted);
§W10.1 item 1 of this document (the code amendment).

*Original statement, kept for history:* §4.2 rule 2 says "homepage HTTPS max 2,048"
without a unit. The code applies `c.homepage.length > 2048` (`nostr-catalog.js:326`), i.e. UTF-16 code
units, while §10.1 requires UTF-8 byte counting for the candidate kinds' fields. A percent-encoded URL
cannot differ, but an IRI with non-ASCII characters can. Settled by: stating the unit in §4.2 and
aligning the validator.

**OPEN-5 — STILL OPEN. NIP-07 is load-bearing and uncited.**
*This remains open.* It is settled by **reading the NIP-07 specification text itself at a pinned
commit** — not the `nostr-typedef` package's rendering of it, which is what §W12 currently cites and
which is a typings file, not a normative source. The specific question is whether NIP-07 defines any
error shape that distinguishes a user rejection from an extension failure. If it does, §W1.2's states
4 and 5 split on it and the hedged "If you dismissed the prompt…" copy is replaced with something
confident; if it does not, §W1.2 stands as written and §19.2 simply gains the citation. Nothing in
this repository can answer it. §6.2 step 1 depends on `window.nostr.getPublicKey()`
and the code calls it (`nostr-catalog.js:1533`), but NIP-07 appears in neither §19.1 nor §19.2. The
specific question this design needed and could not answer: **does NIP-07 specify any error shape that
distinguishes a user rejection from an extension failure?** §W1.2 assumes it does not and hedges the
copy accordingly. Settled by: reading NIP-07 at a pinned commit and adding it to §19, and if an error
vocabulary does exist, splitting states 4 and 5 on it.

**OPEN-6 — STILL OPEN, and expected to be settled by the implementation itself.**
*This remains open.* No amount of document work can close it: it is settled only by a **live write
probe** against `wss://x.kojira.io` and `wss://nos.lol` in a throwaway `d` namespace, which §20.3
should carry (§W10 item 2). Until that probe runs, every relay-behaviour statement in §W4 is a design
that survives any answer rather than a description of an observed one, and the badge copy in §W4.4 is
provisional. Expect the implementation slice to produce the evidence as a side effect of its first
successful publish. Unknown for both
`wss://x.kojira.io` and `wss://nos.lol`: whether a write from an arbitrary pubkey is accepted at all;
whether NIP-42 AUTH is demanded on write; the `OK` message vocabulary and whether NIP-01's
machine-readable prefixes are used; whether `created_at_upper_limit` is enforced on write; and any
per-pubkey rate limit. §W4.2's outcome model is designed to survive any of these answers, but the copy
and the badge mapping depend on them. Settled by: a live write probe in a throwaway `d` namespace,
which §20.3 should carry (§W10 item 2).

**OPEN-7 — STILL OPEN, and expected to be settled by the implementation itself.**
*This remains open.* It is settled by an **integration test against a mock relay socket** asserting the
exact frames `send()` puts on the wire — the test named in §W9 and buildable only alongside the
implementation. Point (c) is the load-bearing one: §W1.3 requires that `send()` forward an
already-signed event unchanged, and if it re-signs, §W1.3's transport choice changes rather than its
conclusion. §19.2 already flags the package facts as
carried forward. Three specifics this design leans on: (a) does `send()` emit exactly one
`OkPacketAgainstEvent` per configured write relay, with `from` set to the relay URL; (b) what, if
anything, does it emit for a relay that never answers, under `errorOnTimeout: false`; (c) **does it
forward an already-signed event unchanged, or does it re-sign** — §W1.3 requires the former. Settled
by: an integration test against a mock relay socket asserting the exact frames sent.

**RESOLVED OPEN-8 — keep the permissive ASCII grammar; §10.1's narrower one is not adopted for
`30078`.**

*Ruling.* §4.2 rule 1 stands: ASCII, maximum 192 UTF-8 bytes, printable, uppercase permitted, exactly
as `validateSoftwareEvent` implements it (`nostr-catalog.js:89`). §10.1's
`[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?` continues to bind the candidate kinds only.

*Reason.* Tightening would begin **quarantining previously valid records**: any `d` already published
with an uppercase letter or a character outside the narrow set would flip to `bad-d` with its
publisher having done nothing, and the publisher has no way to fix a coordinate — changing `d` creates
a different record, it does not repair the old one. Against that cost there is **no observed
real-world case** motivating the change. A stricter grammar would also give the form a second opinion
about `d`, which §W0.1 forbids, and would make the form unable to edit an existing record the
validator accepts.

*Accepted residual risk.* Two coordinates differing only in case (`nosmaps:Tool` and `nosmaps:tool`)
are distinct records that look identical in a list. This is a **known and accepted** risk, not an
oversight. It is revisited only if real data shows the collision actually occurring; the change would
then belong in `validateSoftwareEvent` and would need its own quarantine-migration note.

*Where it landed.* `design-relay-native-data.md` §4.2, note following the normative rules. §W2.3 of
this document needed no change — it already follows the validator.

*Original statement, kept for history:* §10.1 gives candidate kinds a
lowercase ASCII grammar `[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?`; §4.2 rule 1 gives `30078` only
"ASCII, maximum 192 UTF-8 bytes", and the code permits any printable ASCII including uppercase
(`nostr-catalog.js:89`). Two coordinates differing only in case are distinct records that look
identical in a list. §W2.3 follows the validator rather than inventing a stricter form. Settled by: a
decision in §4.2 — and if it tightens, the change belongs in `validateSoftwareEvent`, where existing
records with uppercase `d` values would begin quarantining, which needs its own note.

**RESOLVED OPEN-9 — the self case is carved out of §13.1's prohibition.**

*Ruling.* An **exact single-author** query for the signed-in viewer's own records does **not** fall
under §13.1's prohibition on arbitrary author discovery. §13.1 now says so explicitly, naming
`{"kinds":[30078],"authors":["<self>"],"limit":64}` and §W6.1.

*Reason.* The prohibition exists to forbid **scanning** — enumerating authors the viewer has not
named, which is how a client turns into a central index. An exact match on a key the viewer already
holds is the opposite of a scan: it discovers nothing the viewer did not themselves publish, its
result set is bounded by what they signed, and it names exactly one author known in advance. §W6.1's
reading was therefore correct and is now the text. The carve-out is deliberately narrow — it licenses
the viewer's own key and nothing else, and the query stays subject to the same caps, coalescing, and
chunking as any other.

*Where it landed.* `design-relay-native-data.md` §13.1, "Carve-out — the viewer's own key", following
the prohibition sentence. §W6.1 of this document now cites the carve-out instead of the open question.

*Original statement, kept for history:* §W6.1 needs
`{"kinds":[30078],"authors":["<self>"],"limit":64}` so a publisher can reach a record that withdrawal
made non-listable (§5.4). It is an exact single-author query, not a scan, but §13.1's prohibition is
stated without a carve-out. §W6.1 proceeds on the reading that it does not apply; if that reading is
wrong, the manage screen needs another mechanism and there is currently no candidate — withdrawn
records would be unreachable within the app. Settled by: a clarifying sentence in §13.1.

**OPEN-15 — STILL OPEN. Does the submit form warn on a placeholder `summary`, and how loudly?**
*This is new in the 2026-08-18 amendment and is not decided here.* §4.2 rule 2b forbids
cataloguer-authored placeholders and §W2.2 requires an advisory warning, but the warning cannot be a
gate — §W0.1 makes `validateSoftwareEvent(draft).ok` the sole enable condition, and the validator
accepts `"Unknown"` as an ordinary 7-character string. So the form can warn and cannot stop, which
means a determined publisher writes the placeholder anyway. **Settled by:** either accepting the
advisory-only outcome (cheap, honest, ineffective), or adding a placeholder denylist to
`validateSoftwareEvent` — which is a **read-path** validator change with quarantine consequences for
any record already carrying such a string, and needs the same treatment §4.2's grammar note
describes. The evidence that would decide it is a count of how many published records carry a
placeholder summary, and that count is currently **zero of zero** (§21.0), so there is nothing to
measure yet.

**OPEN-16 — STILL OPEN. Which slice builds the capability form, and does it reuse §W2's shell?**
*Not decided here.* §21 gives `30369` a schema the real data fits, and §W7.1's ordering rule keeps it
unpublishable until a read-side validator exists. What is undecided is whether the capability form is
a second screen in the §W2 shell (sharing the signer model, the preview, and the read-back machinery)
or a separate slice with its own. The `basis` field makes the two shapes genuinely different: a
`self_declared` claim is one field and a signature, while a `transcribed` claim needs `source`,
`source_text` and `asserted_at`, and a bulk transcription of **Amethyst**'s 84 claimed NIPs is 84
signed events, which is a publish-loop this document's §W4 single-event semantics does not describe.
**Settled by:** the §20.3 preflight result on whether either default relay accepts a batch of 84
`30369` writes from one pubkey without rate-limiting, plus a decision on whether bulk transcription is
a thing Nosmaps should offer at all.

**OPEN-10 — STILL OPEN. Is a per-relay `EVENT` send counted against the §9.2 physical budget, and
how?**
*This remains open.* It is settled by a read-design edit — extending §9.2's acceptance expression so it
covers write frames as well as REQs — and that edit is blocked on §W10 item 1, since the budget row it
would amend is itself wrong about the read-back round count. Until the expression covers writes there
is no stated bound for W-T35 to assert, so W-T35 deliberately asserts the read-back round count and
zero HTTP and stops there; asserting an invented bound would be worse than asserting none. §9.2
counts REQs and HTTP; `EVENT` frames are named in the publication row but not in the acceptance
expression `physical ≤ Σrelay Σround max(filter chunks, byte chunks, array chunks)`. §W9's W-T35
asserts the read-back round count and zero HTTP, and does not assert a bound on `EVENT` frames because
there is no stated one. Settled by: extending the §9.2 acceptance expression to cover writes, at which
point W-T35 gains an assertion.

---

## W12. Sources introduced by this document

Everything cited from the read design is already sourced there. New primary material used here, and
its verification status:

| fact used | source | status |
|---|---|---|
| `OkPacketAgainstEvent` shape `{from, ok, notice?, done}` | `node_modules/rx-nostr/dist/packet.d.ts:49-56` | read at `HEAD = 822f56f`; **runtime behaviour unverified** (OPEN-7) |
| `send(params, options)` returns `Observable<OkPacketAgainstEvent>`; `completeOn: "all-ok" \| "any-ok" \| "sent"`; `seckey` option exists | `node_modules/rx-nostr/dist/rx-nostr/interface.d.ts:100-136` | as above |
| `nip07Signer(options)` appends `options.tags` on signing | `node_modules/rx-nostr/dist/config/signer.d.ts:1-11` | as above; this is why §W1.3 does not use it |
| `EventParameters.created_at` is optional | `node_modules/.pnpm/nostr-typedef@0.13.0/node_modules/nostr-typedef/index.d.ts:32-42` | as above |
| NIP-07 `window.nostr` surface (`getPublicKey`, `signEvent`, optional `nip04`/`nip44`) | same file, `:633-645` | a **typedef package's** rendering of NIP-07, not NIP-07 itself — see OPEN-5 |
| the read path already calls NIP-07 behind an explicit opt-in, with diagnostics `nip07-unavailable` / `nip07-refused` / `nip07-key-unparsable` | `nostr-catalog.js:1530-1546` | read at `HEAD = 822f56f` |
| `validateSoftwareEvent` is pure, synchronous, exported, and does not require `id`/`sig` | `nostr-catalog.js:250-353`, `:1771` | read at `HEAD = 822f56f` |
| the explorer derives its rendered category from `t` topics, with `categoryObserved` false otherwise | `nip-explorer.js:9`, `:292`, `:300`, `:206` | read at `HEAD = 822f56f` |
| observed foreign `30078` `d` values on `wss://x.kojira.io` | §4.2, probe dated 2026-08-18 | carried from the read design, not re-probed here |
| 41 real entries with per-entry `provenance[]`; 56 numbered FINDINGS | `real-catalog-draft.json`, `real-catalog-draft-report.md`, collected 2026-08-18 at `HEAD = 822f56f` | primary sources only; **untracked working-tree files** — sourced in the read design's §19.4, cited here for §W2.2, §W2.4, §W7.3 |
| `summary: ""` is accepted; `name: ""` is rejected | `nostr-catalog.js:320-323` | read at `HEAD = 822f56f`; load-bearing for §4.2 rule 2b and §21.5 |

NIP-01's machine-readable `OK` message prefixes are referenced in §W4.2 as a **possible** badge source
and are deliberately not relied upon: they are not in §19.1, and §20.3 already schedules an `OK`
semantics probe.
