# Real-catalog collection — report

- **Collected:** 2026-08-18. **HEAD:** `822f56f`. **Nothing was committed, and no `.js`/`.css`/`.html` was touched.**
- **Files written:** `real-catalog-draft.json`, `real-catalog-draft-report.md` (both repo root, both untracked).
- **Entries:** 41 collected + 2 recorded as *not collectable*.
- **Profile used:** `design-relay-native-data.md` §4.2 rule 2 — `content` is exactly
  `{schema:"org.nosmaps.software", version:1, state, name, summary, homepage?, superseded_by?}`,
  unknown keys rejected in v1. Tags from §4.2 rules 1/1b/4/5 and §5.1. No other field was invented
  inside `content`.
- **Method:** every value traces to the project's own repository metadata, its own README, or its own
  site, fetched today. No aggregator, no third-party listing, no inference from observed behaviour.
  Per-entry `provenance[]` records the URL, what was read there, and the fetch date.

## Unknown / absent counts, per profile field

| field | required? | Unknown | absent | note |
|---|---|---:|---:|---|
| `schema` | yes | 0 | 0 | constant |
| `version` | yes | 0 | 0 | constant `1` |
| `state` | yes | 0 | 0 | **misleading zero** — see FINDING 41. Three entries are demonstrably dead and still had to be written `active`. |
| `name` | yes | 0 | 0 | |
| `summary` | yes | **1** | 0 | Olas. The profile has no Unknown form for a required field — FINDING 23. |
| `homepage` | optional | 0 | **14** | Gossip, 0xchat, Olas, Amber, nos2x, strfry, nostr-rs-relay, nostream, HAVEN, Blossom server, Blossom, void.cat, nostr-tools, nak |
| `superseded_by` | optional | 0 | **41** | 1 entry (khatru) has a real, publisher-asserted successor that the field cannot express — FINDING 35 |

Outside the profile but required by the brief:

| field | Unknown | of |
|---|---:|---:|
| NIP support claim | **23** | 41 |

`d` byte lengths observed: **15–35** against a 192-byte ceiling. Zero entries came close.

Topic (`t`) distribution against the six shipped categories: clients 17, identity 9, relay 7, dev 7,
media 6, analytics 1. Eight entries had no honest category — see FINDING 27.

---

# FINDINGS

## A. The v1 profile has no field for facts that every entry has

**FINDING 1 — There is no field for a source URL.** The brief requires a primary source per entry;
the v1 profile has seven keys and none of them is provenance. Triggered by all 41 entries; sharpest
on **Damus**, where `name`/`summary` come from the README but `homepage` (`https://damus.io/`) comes
from the site, because the Damus repository's own homepage field is *empty*. Two fields, two
different sources, one record that cannot say so.

**FINDING 2 — There is no field for an observation date.** `created_at` is when the *record* was
signed, not when the fact was checked. **Mutiny Wallet** makes the gap concrete: the archived repo
(2024-09-04) and the live site (200 OK today) are both primary and both current-as-of different
moments.

**FINDING 3 — There is no field for a licence.** Every one of the 41 has one and it is a top-three
question for a catalogue. Notable values that would themselves need care: Gossip and Zeus are
`NOASSERTION` (GitHub could not map the licence file to SPDX); nos2x, 0xchat-app-main, noauth,
void.cat and YakiHonne/web-app report *no* licence at all.

**FINDING 4 — There is no field for platform/OS.** **Amethyst** is Android-only, **Damus** is
iOS 16+/macOS 13+, **0xchat** is "Android · iOS · macOS · Linux · Windows", **Snort** is web. The
sample data in `data.js` has `platform` and `os`; the v1 profile has neither, so the shipped UI has
fields the record cannot supply.

**FINDING 6 — There is no field for a distribution channel.** **Damus**'s README links App Store
`id1628663131`; **Amber** and **Citrine** link Zap Store `naddr…`; **nos2x** ships as a browser
extension. For a mobile or extension product the store listing *is* the artefact users install.

**FINDING 17 — There is no field for maintenance status.** **khatru** and **go-nostr** carry an
explicit "This repository is in maintenance mode" banner; **habla.news** last shipped 2025-07-17;
**noauth** 2025-05-26. §7.1 explicitly forbids inferring withdrawal from age, which is correct, and
leaves the client with nothing to say.

**FINDING 19 — There is no field for self-declared maturity.** **noStrudel**'s README opens with
"NOTE: This client is still in development and will have bugs". **nostr.watch** marks all 12 of its
packages `alpha`. Publishers *are* volunteering this and the profile discards it.

**FINDING 29 — Browser-extension and app-store identifiers have nowhere to go.** **nos2x** and the
**Alby Browser Extension** are identified in the real world by a Chrome Web Store extension ID.
`homepage` is the only URL field and Alby's is `https://getalby.com/#extension` — a fragment link
into a marketing page.

**FINDING 46 — Contribution/contact channels are Nostr-native and unrepresentable.** **nostr-tools**'
README says "Use NIP-34 to send your patches to: `naddr1qq…`". **Pokey**'s declared homepage is
`https://njump.me/npub1h2685…`. The catalogue is Nostr-native and cannot hold a Nostr address.

## B. The `state` enum does not describe reality

**FINDING 41 — `active | withdrawn` cannot express "dead".** **void.cat**: repository archived
2024-09-26, and `https://void.cat` **fails DNS resolution** (`curl: (6) Could not resolve host`).
The software is gone and the service is gone. Per §7.1 only the coordinate's own pubkey can publish
`withdrawn`, and "ceasing to publish is not retraction" — so if anyone ever publishes this record it
is `active` forever. **Mutiny Wallet** and **Flotilla** are the same shape. `data.js` has
`status: active|stale|dead|unknown`; the profile has two values, and they mean something else
entirely (record retracted vs. project alive).

**FINDING 36 — Archived-with-a-successor is not withdrawal.** **khatru** is archived and its README
says "adventurous programmers are encouraged to try `fiatjaf.com/nostr/khatru@master` instead". That
is a publisher-asserted succession, and §11 requires `superseded_by` to be a valid `30078`
coordinate, effective only when the old winner is `withdrawn`. Neither condition holds.

**FINDING 35 — `superseded_by` only accepts a 30078 coordinate.** khatru's successor is a Go module
path; **Iris**'s canonical source moved to `htree://npub1xdhnr…/iris-client`; **Flotilla**'s moved to
`gitea.coracle.social`; **rust-nostr**'s org was renamed to `nostrdevkit`. Four real migrations,
zero expressible.

**FINDING 44 — Two primary sources contradict each other and the profile has no precedence rule.**
**Mutiny Wallet**: the archived repo says the code is frozen; `app.mutinywallet.com` serves
"Mutiny is a self-custodial lightning wallet that runs in the browser" in the present tense. One
`summary`, one `homepage`, one `state`, no as-of stamp. I chose the live site for `summary`; choosing
the repo would have been equally defensible.

## C. `homepage`

**FINDING 5 — `homepage` must be HTTPS, and a real project declares HTTP.** **Amethyst**'s repository
homepage field is `http://amethyst.social`. To publish a valid v1 record I had to *rewrite the
publisher's own value* to `https://`. That is a silent data edit the profile forces.

**FINDING 10 — 14 of 41 entries have no homepage at all**, so a valid record can carry no
user-reachable link. **strfry**, **nak**, **Amber**, **nostr-tools**, **nostream**, **HAVEN**,
**Blossom server** and others assert no site anywhere in their primary sources. `homepage` being
optional is correct; the consequence — a catalogue row that links nowhere — is not designed for.

**FINDING 31 — A homepage can be a third-party gateway to an npub.** **Pokey**'s declared homepage is
`https://njump.me/npub1h2685kkxa4q50qpexuae9geqep7frr0u8t8pcy9zj0xnza9phvtsnkd9tm`. It satisfies
"HTTPS, ≤2048 bytes" and points at a rendering service the project does not control.

**FINDING 40 — Service and software are different artefacts sharing one `homepage`.**
**nostr.build**: the repo is described by its owner as the "FOSS version of nostr.build"; the operated
service at `https://nostr.build` is a different thing. Same for **nostrcheck-server** vs
`nostrcheck.me`, and **Blossom server** vs any deployed blossom host.

**FINDING 14 — `name` and the homepage domain disagree.** The repository **v0l/snort** declares
homepage `https://phoenix.social`. Which is the `name` — "Snort" or "Phoenix"? I recorded the repo
description's implied name. Both readings are defensible.

## D. `summary` and `name`

**FINDING 23 — `summary` is required and for one real project no primary source provides one.**
**Olas** (`pablof7z/olas`): the GitHub repository description is the literal string `"Guess."`, and
the entire README body is Maestro end-to-end-test setup instructions. There is no publisher-authored
statement of what Olas is. I wrote `"summary": "Unknown"`, which is **not a valid v1 record** — the
profile defines no absent/unknown form for a required string. The schema cannot represent this entry
without fabricating content.

**FINDING 13 — The publisher's own one-liner is often a slogan, not a description.** **Ditto**:
"Your content. Your vibe. Your rules." **Primal**'s site meta description is "Live Free". **0xchat**,
**habla.news**, **Amber**, **Iris** and **Olas** have a *null* GitHub description, so the summary had
to be lifted out of README prose — a judgement call the profile does not acknowledge.

**FINDING 42 — Publisher descriptions contain content that is not a summary.** **Zeus**: "A mobile
Bitcoin wallet fit for the gods. ⚡️ Est. 563345" — an emoji and a Bitcoin block height. **Rabbit**:
"🐰 A nostr client like TweetDeck". Recording verbatim or cleaning up are both defensible; the profile
says nothing, so 41 records were normalised by my judgement alone.

**FINDING 20 — There is no language tag.** **Rabbit**'s README is entirely Japanese; the only English
self-description is the one-line repo field. Nosmaps ships a Japanese UI (`i18n.js`) and the record
format is monolingual.

**FINDING 21 — One product, many repositories.** **YakiHonne** is `web-app` + `mobile-app` + three
*archived* predecessors (`yakihonne-web-app`, `yakihonne-mobile-app`, `web-app-v4`), all declaring
`https://yakihonne.com`. **0xchat** spans at least five repos. **Primal** spans web/iOS/Android/cache.
One coordinate, one homepage, one summary — I had to pick one repo per product and drop the rest.

**FINDING 22 — One repository, many separately versioned packages.** **NDK** is a monorepo where
NIP-17 lives in `@nostr-dev-kit/messages` and NIP-77 in `@nostr-dev-kit/sync`. **nostr.watch** ships
12+ packages each with its own `alpha`/`docs` status. A single record flattens all of it.

## E. NIP support — the highest-risk field, and it has no home at all

**FINDING 45 — The v1 content profile has NO NIP field whatsoever.** NIP claims live in candidate
kind `30369` (§10.3), which is not implemented and is self-assigned (§16.4). Meanwhile `data.js`
renders a `nips[]` array per tool and `nip-explorer.js` is built around it. So the single most
prominent thing the shipped UI displays is the one thing a valid v1 record cannot carry. All 41
entries trigger this. Everything below is recorded outside the profile, in `nip_support_claim`.

**FINDING 34 — The same NIP number means different specifications in two primary sources.**
**nostr-rs-relay**'s README: "NIP-15: End of Stored Events Notice". **Amethyst**'s README:
"Nostr Marketplace (NIP-15)". Both are the project's own documentation. NIP-15 was reassigned after
the original was merged into NIP-01. Same key, two specs, and a per-NIP comparison table would show
these two projects as supporting "the same thing". The same happens with **NIP-22** (nostr-rs-relay:
"Event created_at limits"; Amethyst/NDK/Ditto: "Comment") and **NIP-43** (nostream: "invite codes";
Amethyst: "Relay Access Metadata and Requests") and **NIP-85** (Shopstr: "Reviews"; Amethyst:
"Trusted Assertions"). A bare NIP number is not a stable key.

**FINDING 33 — Projects actively claim NIPs that no longer exist.** **nostr-rs-relay** claims
NIP-12, 15, 16, 20 and 33 — *all five* merged into NIP-01 and deleted from the registry.
**nostream** claims the same five. **Damus** claims NIP-12. **YakiHonne** claims NIP-12. These are
current primary sources making claims against a registry that has moved. Recording them faithfully
produces rows referencing NIPs the explorer's `nipCatalog` does not contain; discarding them means
overriding the primary source, which the brief forbids.

**FINDING 8 — NIP identifiers are not numbers.** **Amethyst** claims **NIP-5A** ("Pubkey Static
Websites") and **NIP-7D** ("Threads"). Any integer key, zero-padded-two-digit string, or numeric sort
breaks. `data.js` uses `"01"`-style zero-padded strings, which cannot hold `5A`.

**FINDING 9 — Seven mutually incompatible notations across 18 sources.** `- [x] NIP-01: Title`
(Snort, nostr-rs-relay, nostream, Shopstr); `- [x] Title (NIP-01)` (Amethyst, YakiHonne);
`- [x] NIP 05` with a space (Coracle, in the *same file* as `NIP-50` with a hyphen);
`- ✅ **NIP-01** - Title` (NDK); `NIP01` with no separator at all (nostrcheck-server);
`nip46` lowercase unhyphenated (nsec.app); and bare comma-separated integers (**strfry**:
"Supports most applicable NIPs: 1, 2, 4, 9, 11, 28, 40, 42, 45, 70, 77"). Normalising `1` → `NIP-01`
is an inference the source does not make.

**FINDING 25 — Checkbox semantics are project-local and invert between projects.** **Shopstr** uses
*unchecked* boxes for partial support: `- [ ] NIP-50: Search Capability (partial: product search)`.
**Snort** and **Amethyst** use unchecked for *not supported*. Reading `[ ]` the same way across both
sets produces wrong data for one of them. Conversely **Snort** uses *checked* boxes for partial
support with the caveat in prose: `- [x] NIP-02: Contact List and Petnames (No petname support)`,
`- [x] NIP-26: Delegated Event Signing (Display delegated signings only)`.

**FINDING 28 — The same checkbox notation means "roadmap" in another README.** **Amber**'s README
contains `- [x] Use nip-46 or make an addendum in nip-46` inside a TODO list. Mechanically it is
indistinguishable from Snort's support checklist.

**FINDING 32 — For relays the truthful NIP claim lives at runtime, not in the repo.** **strfry**,
**khatru**, **HAVEN** and **nostream** all mention NIP-11 only as *configuration*. The authoritative
machine-readable claim is the `supported_nips` array of a *deployed instance's* NIP-11 document. The
v1 profile has no relay-instance concept, so relay software can only ever carry a README claim about
a capability that is actually per-deployment.

**FINDING 43 — Support is claimed below NIP granularity.** **Alby Hub**'s README has a section titled
"NIP-47 Supported Methods" with a per-method table (`info` event, `pay_invoice`, …). "Supports
NIP-47" is not a fact about Alby Hub; "supports these NIP-47 methods" is.

**FINDING 47 — Support is per-platform inside one project.** **Amethyst**'s README carries a second
table where NIP-46 is "✅ Full" on Android but "⚠️ Partial" in commonMain, and NIP-03 is "✅ Full" on
Android but "❌ No" in commonMain. One project, one NIP, two answers. The same README's checklist
reports both as `[x]`.

**FINDING 16 — "Requires a NIP" reads exactly like "implements a NIP".** **nostter**: "NIP-07 browser
extensions (recommended)" under login. **Rabbit**: "NIP-07に対応したブラウザ拡張機能のインストールが事前
に必要です". **Gossip**: "my NIP-05 address of mike@mikedilger.com". None of these are support claims;
all three would be captured by a mention-scraper. All three recorded Unknown.

**FINDING 48 — Library "support" is a different predicate.** **nostr-tools**, **rust-nostr**,
**go-nostr** and **nak** mention NIPs only as module/crate/subcommand names (`@nostr/tools/nip19`,
`nostr-connect (NIP-46)`). A library shipping a `nip19` module provides primitives; it does not
implement user-facing NIP-19 behaviour. All four recorded Unknown, which is correct and also makes
four of the ecosystem's most important projects look empty.

**FINDING 18 — Explicit *non*-support has nowhere to go.** **Gossip**'s README: "the options currently
are NIP-32, NIP-56, and NIP-72, but none of these are defined well enough". That is a stronger, more
useful statement than most support claims, and there is no negative form anywhere in the model.

**FINDING 26 — There are at least six support states in the wild, not four.** Beyond
`implemented/partial/planned/unknown` (`data.js`): **nostr-rs-relay**'s
`- [ ] NIP-26 (implemented, but currently disabled)` and **nostream**'s
`- [ ] NIP-26: Delegated Event Signing (REMOVED)` — implemented-but-off, and formerly-supported-now-
removed, are distinct from all four.

**FINDING 11 — NIP claims decay silently.** **Coracle** lists "Direct messages - NIP 04 and NIP 24".
NIP-24 in the current registry is "Extra metadata fields and tags"; DMs moved to NIP-17. The claim was
true when written. Nothing in the record can mark a claim as stale.

**FINDING 30 — A claim can reference a NIP that was never merged.** **nostr-rs-relay** claims
"NIP-91: AND operator for filters", linking to pull request `nostr-protocol/nips#1365`. **Coracle**
claims "NIP 87 closed groups"; NIP-87 is not in the merged registry.

**FINDING 24 — Some projects state a NIP as an identity, not a capability.** **zap.stream**'s entire
README is: "This is a [NIP-53] nostr client." One NIP; no matrix; and it is closer to a category than
to a support claim.

**FINDING 38 — A whole spec family has no representation.** **Blossom server**'s capability surface is
**BUD-01 … BUD-09** (Blossom Upgrade Documents), not NIPs. Its only NIP mentions are incidental
(`BUD-08 — nip94 field in blob descriptors`). A NIP-only model reports this project as supporting
essentially nothing, which is the opposite of the truth. LUD (Lightning) and Cashu specs have the same
problem — **NDK** annotates NIP-57 as "(LUD06, LUD16)".

**FINDING 39 — Not everything in the ecosystem is software.** **Blossom** (`hzrd149/blossom`) is a
specification repository. `state: active|withdrawn`, `homepage`, and "NIP support" are all
category errors for it, yet it is exactly the kind of thing a Nostr catalogue should list.

**FINDING 16b / 37 — One collected project publishes on our own kind.** **nostrcheck-server** claims
`NIP78 - Arbitrary custom app data`, i.e. it writes kind `30078`. §4.2 already documents this
(`foreign-d`/`foreign-profile` quarantine), and the catalogue now contains an entry for a project
whose records the catalogue must quarantine.

## F. Taxonomy

**FINDING 27 — Eight entries fit none of the six shipped categories.** `data.js` ships
`clients / relay / identity / media / analytics / dev`. No category exists for:
**Shopstr** (marketplace), **Zeus** / **Alby Hub** / **Mutiny Wallet** (Lightning wallets),
**Zapstore** (app distribution), **Pokey** (notification bridge), **Blossom** (specification),
**Alby Browser Extension** (wallet that also signs). I filed the wallets under `identity` because it
is the least wrong of six, which is a data error I am reporting rather than hiding. The brief's own
category list (client, relay tooling, signer, zap/wallet, media host, bot framework, discovery) is a
*seventh* taxonomy that matches neither the shipped one nor the design, which defines **no** topic
vocabulary for `30078` at all beyond the literal string `nosmaps`.

**FINDING 55 — Every `t` topic beyond `nosmaps` in this file is invented by me.** §5.1 defines only
`DISCOVERY_TOPICS = ["nosmaps"]` and says further topics "may be added from selected `30368` taxonomy
terms" — and `30368` is an unimplemented candidate kind (§10.2, §16.4). There is no normative
vocabulary to publish against, so 41 records carry topic strings with no defined meaning.

**FINDING 25b — One artefact is several categories at once.** **nostrcheck-server** is a relay *and*
a media host *and* a NIP-05 provider *and* a Lightning service, in one binary. **Ditto** is a relay
*and* a Mastodon-API server *and* a web client. **Nostrcheck** got three `t` tags and **Ditto** two —
but the shipped UI's `category`/`categoryLabel` pair is single-valued, so multi-topic records cannot
round-trip into it.

**FINDING 26b — Nostr is a minority feature of some entries.** The **Alby Browser Extension** is
primarily a Bitcoin Lightning wallet; **Zeus**'s own description does not mention Nostr at all. Listing
them in a Nostr catalogue overstates them, and there is no field to say "Nostr support is one feature".

**FINDING 49 — One collected entry is a competing implementation of this catalogue.** **Zapstore** is
a Nostr-native, community-curated app store addressing apps by `naddr`. Nosmaps and Zapstore are
solving the same problem, and the profile has no way to note the relationship.

## G. `d` grammar and the 192-byte ceiling

**FINDING 54 — The 192-byte ceiling never binds.** Across 41 real projects, `d` ranged **15 to 35
bytes** (longest: `nosmaps:com.greenart7c3.nostrsigner`, 35). The constraint the design spends budget
tables on is not the one that hurts. What hurts is FINDING 15 and FINDING 7.

**FINDING 7 — Two defensible reverse-DNS readings, and they disagree.** **Amethyst** declares
`applicationId = "com.vitorpamplona.amethyst"` in `amethyst/build.gradle.kts` — a genuine
reverse-DNS identifier the project itself owns and publishes — while its site is `amethyst.social`,
which reverses to `social.amethyst`. **Amber** is `com.greenart7c3.nostrsigner` (which does not
contain the string "Amber"). **Damus** is `io.damus` by domain but a `com.jb55.*` bundle by store.
§4.2 rule 1 says reverse-DNS is "recommended", picks neither, and says the choice is not ownership
proof either way. I chose domain-derived for Amethyst/Damus and applicationId-derived for
Amber/Citrine, inconsistently, because each looked more canonical in its own case.

**FINDING 15 — For several projects the GitHub URL is not the canonical source, so a
GitHub-derived `d` encodes the wrong thing.** **nostr-rs-relay**: the GitHub repo's *own description*
is "Mirror of https://sr.ht/~gheartsfield/nostr-rs-relay/" — it is a mirror, and its description
describes the mirroring rather than the software. **Iris**: "Main development is on decentralized git:
`htree://npub1xdhnr…/iris-client`". **Flotilla**: "This repository has been archived. Please see
https://gitea.coracle.social/coracle/flotilla". **HAVEN**: requested as `bitvora/haven`, GitHub
redirected to `barrydeen/haven` — the owner changed under a stable-looking path.

**FINDING 48b — An upstream rename invalidates a reverse-DNS `d` with no migration path.**
`rust-nostr/nostr` now resolves to `nostrdevkit/nostr` with domain `nostrdevkit.org`. The name in
common use ("rust-nostr") matches neither. §11 only permits migration via a *withdrawn* record at the
old coordinate pointing to a new `30078` coordinate — which is about *our* records, not about the
project renaming itself upstream.

**FINDING 17b — 12 of 41 projects assert no domain at all**, so a "reverse-DNS" `d` has to be
fabricated from a GitHub owner name the project does not own: `com.mikedilger.gossip`,
`com.hoytech.strfry`, `com.cameri.nostream`, `com.fiatjaf.nak`, `wtf.nbd.nostr-tools`,
`com.hzrd149.blossom-server`, and others. §4.2 says the prefix "is not ownership proof", which is
true and also means these strings assert something false-looking with the design's blessing.

**FINDING 52 — The design contradicts itself on the `d` prefix, in its own worked example.** §4.2
rule 1b: "`d` MUST begin with the literal prefix `nosmaps:`". The §7.1 retraction example three
sections later publishes `["d", "com.example.tool"]` — no prefix. Under rule 1b that example event is
`quarantined: foreign-d`. I followed rule 1b for all 41 entries.

**FINDING 53 — The `d` grammar for kind `30078` is under-specified relative to the candidate kinds.**
§4.2 rule 1 says only "ASCII, maximum 192 UTF-8 bytes". §10.1 gives candidate kinds a strict
`[a-z0-9](?:[a-z0-9._:/-]{0,190}[a-z0-9])?`. Is uppercase legal in a `30078` `d`? Is `_`? Two
defensible readings, and it matters immediately: **0xchat** starts with a digit, **YakiHonne** and
**noStrudel** and **ZeusLN** are mixed-case brands, `nostr-tools` and `blossom-server` contain `-`.
I lowercased everything and used only `[a-z0-9.:-]`, i.e. I applied the §10.1 grammar to a kind the
document does not apply it to.

**FINDING 56 — The optional `["state", …]` tag is a decision the profile leaves to every publisher.**
§4.2 rule 4 makes it optional but requires it to match `content.state` when present, and notes it can
never be used as a filter. I emitted it on all 41 records; omitting it on all 41 would be equally
conformant, which means two publishers will produce byte-different events for identical facts.

## H. Collection failures worth recording

**FINDING 50 — A live, well-known service could not be verified and was therefore dropped.**
`https://nostr.band` timed out twice from this network (20 s and 30 s). With no readable primary
source, no field could be established. It is recorded in `not_collected[]`. The design has no state
for "this exists but we could not verify it" other than absence — which §5.4 correctly says must never
be reported as nonexistence, but the collection format has nowhere to say it either.

**FINDING 51 — Store-only and closed-source products are structurally excluded.** Fountain, the
Primal iOS/Android apps, and similar products have a publisher-authored primary source that is an
app-store listing. There is no fetchable stable document and no field that can hold a store product
ID, so a whole class of real, widely-used Nostr apps cannot be collected under these rules at all.

---

## What I would not do

I did not bend any value to fit the schema. Specifically: Olas keeps `"summary": "Unknown"` even
though that makes the record invalid; void.cat/Mutiny/Flotilla keep `state: "active"` even though
they are dead; 23 of 41 entries carry `nip_support_claim: "Unknown"` even where the NIP support is
obvious (the Alby extension certainly implements NIP-07; its README does not say so, so it is
Unknown); and Amethyst's HTTP homepage is flagged as an edit rather than silently corrected.

## git status

Only the two new untracked files plus the pre-existing untracked `STATUS-revision2.md`. Nothing
staged, nothing committed, no tracked file modified.
