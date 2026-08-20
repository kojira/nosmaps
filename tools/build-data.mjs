/* Generates data.js from the signed catalogue. data.js is a build artefact; it is never edited by
   hand and holds no value this build did not read from one of the inputs below.

   Inputs, all pinned artefacts that live in the repo:
     catalogue-events.jsonl     THE CANONICAL CATALOGUE. One signed kind 30078 event per line, as it
                                would arrive from a relay. Every record here is read through
                                tools/catalogue-events.mjs, which refuses a line whose signature,
                                id, kind, `d` namespace or `nosmaps` topic does not hold — so
                                data.js cannot be generated from anything unsigned or tampered with.
                                Written by tools/sign-catalogue.mjs; checked by
                                tools/verify-catalogue.mjs. Who collected a record is its `pubkey`.
     real-catalog-draft.json    The collection notes. The signed event carries only the record
                                profile (§4.2 rules 2 and 7:
                                schema/version/state/name/summary/descriptions?/homepage?), so the
                                provenance, the capability claims, the licence/platform/distribution
                                facts and the finding numbers — everything the draft itself files
                                under `facts_with_no_home_in_v1_profile` — are joined on from here by
                                `d`. These are annotations about a record, not the record.
     nips-registry-656cecc.json the NIP registry snapshot the client resolves ids against,
                                parsed from the pinned revision design-relay-native-data.md §19.1
                                already cites.

   The schema decisions this file implements are design-relay-native-data.md §21:
   R1 (a capability claim is a separate signed record with a `basis`), R2 (the capability key is
   family:id[/sub][@scope] and `id` is an opaque token, never an integer), R3 (bud/lud are
   first-class families), R4 (liveness is an observation, not a state), R5 ("" is the honest absent
   summary), R6 (seven seed topics, free topics render verbatim), R7 (eight `result` values, read
   from prose and never from a checkbox glyph).

   Nothing here invents a value. Where a primary source says nothing, the field is absent and the UI
   renders its own unknown state. Run: node tools/build-data.mjs
*/
import {readFileSync, writeFileSync} from 'node:fs';
import {loadVerifiedEvents, KIND} from './catalogue-events.mjs';

const catalog = JSON.parse(readFileSync(new URL('../real-catalog-draft.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../nips-registry-656cecc.json', import.meta.url), 'utf8'));

/* The canonical records. Order is file order, which is the order they were collected in. */
const signed = loadVerifiedEvents();
const signers = [...new Set(signed.map(item => item.event.pubkey))];
if (signers.length !== 1) throw new Error(`expected one collector, the jsonl carries ${signers.length}`);
const collectorPubkey = signers[0];

/* The draft's annotations, keyed by the `d` of the record they annotate. A signed record with no
   notes would still build; a note for a record nobody signed is dropped, because the signed events
   are what the catalogue is. */
const notesByD = new Map(catalog.entries.map(entry => [
  (entry.event_skeleton.tags.find(tag => tag[0] === 'd') || [])[1], entry
]));

/* R6: six terms nip-explorer.js already maps, plus `wallet`, minted because four of the 41 are
   described as a wallet by their own publisher (§21.6). Everything else is a free topic. */
const SEED_TOPICS = ['clients', 'relay', 'identity', 'media', 'analytics', 'dev', 'wallet'];

/* R7: the eight result values, in the precedence used to pick one representative record when a
   feature spans several capabilities. `unknown` is deliberately absent from this list — it is not a
   low rank, it is what is shown when the list yields nothing (D7 / invariant I8). */
const RESULT_PRECEDENCE = ['supported', 'partial', 'disabled', 'planned', 'withdrawn', 'not_supported', 'not_applicable'];

/* §21.6 — the collection filed eight entries under the nearest of six shipped categories and the
   report says so in as many words ("a data error I am reporting rather than hiding"). §21.6 decides
   the corrected topic for each, quoting the publisher's own description. The `t` tags below are the
   only values in this build that differ from real-catalog-draft.json, and each cites its evidence. */
const TOPIC_CORRECTIONS = {
  'nosmaps:com.zeusln': {topics: ['wallet'], why: '§21.6 — publisher: "A mobile Bitcoin wallet fit for the gods."'},
  'nosmaps:com.albyhub': {topics: ['wallet'], why: '§21.6 — publisher: "Your own Bitcoin Lightning node"'},
  'nosmaps:com.mutinywallet.app': {topics: ['wallet'], why: '§21.6 — publisher: "a self-custodial lightning wallet that runs in the browser"'},
  'nosmaps:com.getalby.extension': {topics: ['identity', 'wallet'], why: '§21.6 — publisher: "The Bitcoin Lightning Browser Extension"; it signs and it pays, so it carries both'},
  'nosmaps:market.shopstr': {topics: ['commerce'], why: '§21.6 — free topic; filed as `clients` it "asserts something false"'},
  'nosmaps:dev.zapstore': {topics: ['distribution'], why: '§21.6 — free topic; app distribution, a singleton in a 41-entry sample'},
  'nosmaps:me.njump.pokey': {topics: ['notifications'], why: '§21.6 — free topic; notification bridge, a singleton'},
  'nosmaps:com.hzrd149.blossom': {topics: ['spec'], why: '§21.6 — free topic; a specification repository, for which `state`/`homepage`/NIP support are category errors'}
};

/* R7 — `result` MUST be read from the prose, never from the checkbox glyph. Every entry below is a
   reading of a verbatim line recorded in real-catalog-draft.json's `verbatim_caveats` or
   `explicitly_not_supported`, and the line itself travels to the screen as `sourceText`. */
const PROSE_READINGS = {
  'nosmaps:social.amethyst': [
    {capability: 'nip:07', result: 'not_applicable', sourceText: '- [ ] window.nostr for Web Browsers (NIP-07, Not applicable)'},
    {capability: 'nip:46@android', result: 'supported', sourceText: "README 'NIP Support' table: NIP-46 — Full (Android)"},
    {capability: 'nip:46@commonmain', result: 'partial', sourceText: "README 'NIP Support' table: NIP-46 — Partial (commonMain)"},
    {capability: 'nip:03@android', result: 'supported', sourceText: "README 'NIP Support' table: NIP-03 — Full (Android)"},
    {capability: 'nip:03@commonmain', result: 'not_supported', sourceText: "README 'NIP Support' table: NIP-03 — No (commonMain)"},
    {capability: 'nip:95', caveat: "annotated 'Draft'"}
  ],
  'nosmaps:social.phoenix': [
    {capability: 'nip:02', result: 'partial', sourceText: '- [x] NIP-02: Contact List and Petnames (No petname support)'},
    {capability: 'nip:26', result: 'partial', sourceText: '- [x] NIP-26: Delegated Event Signing (Display delegated signings only)'},
    {capability: 'nip:96', caveat: 'NIP-96: HTTP File Storage Integration (Draft)'}
  ],
  'nosmaps:market.shopstr': [
    {capability: 'nip:50', result: 'partial', sourceText: '- [ ] NIP-50: Search Capability (partial: product search)'},
    {capability: 'nip:56', result: 'partial', sourceText: '- [ ] NIP-56: Reporting (partial: profile/listing reports)'},
    {capability: 'nip:85', caveat: "listed as 'Reviews'; Amethyst calls NIP-85 'Trusted Assertions'"}
  ],
  'nosmaps:io.sourcehut.nostr-rs-relay': [
    {capability: 'nip:26', result: 'disabled', sourceText: '- [ ] NIP-26 (implemented, but currently disabled)'},
    {capability: 'nip:03', result: 'not_supported', sourceText: '- [ ] NIP-03'},
    {capability: 'nip:15', caveat: "this README titles NIP-15 'End of Stored Events Notice'; Amethyst titles it 'Nostr Marketplace'"},
    {capability: 'nip:22', caveat: "titled 'Event created_at limits', qualified '(future-dated events only)'"},
    {capability: 'nip:91', caveat: "'NIP-91: AND operator for filters' links to pull request nostr-protocol/nips#1365, not a merged NIP"}
  ],
  'nosmaps:com.cameri.nostream': [
    {capability: 'nip:26', result: 'withdrawn', sourceText: '- [ ] NIP-26: Delegated Event Signing (REMOVED)'}
  ],
  'nosmaps:me.nostrcheck.server': [
    {capability: 'nip:17', result: 'planned', sourceText: 'NIP17 — listed unchecked in a roadmap section'}
  ],
  'nosmaps:com.mikedilger.gossip': [
    {capability: 'nip:32', result: 'not_supported', sourceText: "In the future I intend for gossip to support one of the multiple competing standards ... (the options currently are NIP-32, NIP-56, and NIP-72), but none of these are defined well enough"},
    {capability: 'nip:56', result: 'not_supported', sourceText: "the options currently are NIP-32, NIP-56, and NIP-72, but none of these are defined well enough"},
    {capability: 'nip:72', result: 'not_supported', sourceText: "the options currently are NIP-32, NIP-56, and NIP-72, but none of these are defined well enough"}
  ],
  'nosmaps:com.albyhub': [
    {capability: 'nip:47', caveat: "the README publishes a per-method table ('NIP-47 info event', pay_invoice, …), not a whole-NIP claim"}
  ],
  'nosmaps:dev.nostr.ndk': [
    {capability: 'lud:06', result: 'supported', sourceText: "NIP-57 line annotated '(LUD06, LUD16)'"},
    {capability: 'lud:16', result: 'supported', sourceText: "NIP-57 line annotated '(LUD06, LUD16)'"}
  ],
  'nosmaps:social.coracle': [
    {capability: 'nip:24', caveat: "listed under 'Direct messages'; NIP-24 in the pinned registry is 'Extra metadata fields and tags' — the claim is stale"},
    {capability: 'nip:87', caveat: "'NIP 87 closed groups'"}
  ],
  'nosmaps:io.damus': [
    {capability: 'nip:12', caveat: 'merged into NIP-01; no longer a separate NIP in the registry'},
    {capability: 'nip:08', caveat: 'deprecated in favour of NIP-27'}
  ]
};

/* A blanket hedge qualifies every id in the list it introduces, and none may be shown unhedged (R7). */
const BLANKET_CAVEATS = {
  'nosmaps:com.hoytech.strfry': "Supports most applicable NIPs: 1, 2, 4, 9, 11, 28, 40, 42, 45, 70, 77 — 'most applicable' hedges the whole list",
  'nosmaps:io.damus': 'the list has no checkboxes and no status column: every line is an unqualified assertion'
};

/* R4 — liveness observations. Every one is a fact the collection recorded with a method and a
   source. None of them is counted: this build has no relay and no social graph, so §21.4's derived
   liveness value stays `unknown` for all 41 and these render as recorded-but-uncounted. */
const LIVENESS = {
  'nosmaps:cat.void': [
    {result: 'archived', method: 'repository-metadata', detail: 'repository archived, last push 2024-09-26', subject: 'https://github.com/v0l/void.cat', observedAt: '2026-08-18'},
    {result: 'unreachable', method: 'dns', detail: 'curl: (6) Could not resolve host', subject: 'https://void.cat', observedAt: '2026-08-18'}
  ],
  'nosmaps:com.mutinywallet.app': [
    {result: 'archived', method: 'repository-metadata', detail: 'repository archived 2024-09-04; the code is frozen', subject: 'https://github.com/MutinyWallet/mutiny-web', observedAt: '2026-08-18'},
    {result: 'reachable', method: 'http', detail: 'HTTP 200; serves the product page in the present tense', subject: 'https://app.mutinywallet.com', observedAt: '2026-08-18'}
  ],
  'nosmaps:technology.nostr.khatru': [
    {result: 'archived', method: 'repository-metadata', detail: 'repository archived, last push 2025-09-22', subject: 'https://github.com/fiatjaf/khatru', observedAt: '2026-08-18'},
    {result: 'superseded', method: 'repository-metadata', detail: 'README: adventurous programmers are encouraged to try fiatjaf.com/nostr/khatru@master instead', target: 'fiatjaf.com/nostr/khatru@master', subject: 'https://github.com/fiatjaf/khatru', observedAt: '2026-08-18'}
  ],
  'nosmaps:to.iris': [
    {result: 'moved', method: 'repository-metadata', detail: 'README: Main development is on decentralized git', target: 'htree://npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/iris-client', subject: 'https://github.com/irislib/iris-client', observedAt: '2026-08-18'}
  ],
  'nosmaps:org.nostrdevkit': [
    {result: 'moved', method: 'repository-metadata', detail: 'the org rust-nostr was renamed to nostrdevkit', target: 'https://github.com/nostrdevkit/nostr', subject: 'https://github.com/rust-nostr/nostr', observedAt: '2026-08-18'}
  ],
  'nosmaps:io.sourcehut.nostr-rs-relay': [
    {result: 'moved', method: 'repository-metadata', detail: "the GitHub repository's own description is 'Mirror of https://sr.ht/~gheartsfield/nostr-rs-relay/'", target: 'https://sr.ht/~gheartsfield/nostr-rs-relay/', subject: 'https://github.com/scsibug/nostr-rs-relay', observedAt: '2026-08-18'}
  ]
};

/* Icons. Every URL below was requested in the probe recorded in icons-probe.md (run 2026-08-18
   against HEAD c15fafd): the entry's own homepage was fetched, every icon it declares was resolved
   and requested, and a URL is kept here only where that request answered 2xx with an `image/*`
   content-type and a non-zero body. `source` is the markup the page declared it in and `page` is
   the URL that declared it — for the two Framer-hosted sites that is the same third-party CDN file,
   which is a fact about those two pages rather than a mistake here.

   No URL is guessed by convention and none is inferred: an entry absent from this map has no icon,
   and the UI draws its initial-letter placeholder instead. Seventeen of the 41 are absent —
   fourteen publish no homepage at all, habla.news's homepage answers 404, the NDK page declares no
   icon of any kind, and Pokey's recorded homepage is an njump *profile* page, so the icon found
   there is njump's own and is deliberately not used for Pokey. */
const ICONS = {
  'nosmaps:io.damus': {url: 'https://damus.io/logo_icon.png', source: 'meta og:image', page: 'https://damus.io/'},
  'nosmaps:social.amethyst': {url: 'https://amethyst.social/amethyst-logo.jpg', source: 'link rel="icon" (image/jpeg)', page: 'https://amethyst.social'},
  'nosmaps:net.primal.web': {url: 'https://primal.net/assets/favicon-85332ee3.ico', source: 'link rel="icon" (image/ico)', page: 'https://primal.net'},
  'nosmaps:social.coracle': {url: 'https://app.coracle.social/icons/favicon.ico', source: 'link rel="icon" (48x48)', page: 'https://app.coracle.social'},
  'nosmaps:social.phoenix': {url: 'https://phoenix.social/favicon.png', source: 'link rel="icon"', page: 'https://phoenix.social'},
  'nosmaps:to.iris': {url: 'https://iris.to/favicon.svg', source: 'link rel="icon" (image/svg+xml)', page: 'https://iris.to'},
  'nosmaps:app.nostter': {url: 'https://nostter.app/favicon.svg', source: 'link rel="icon" (image/svg+xml)', page: 'https://nostter.app'},
  'nosmaps:ninja.nostrudel': {url: 'https://nostrudel.ninja/favicon.ico', source: 'link rel="icon" (any)', page: 'https://nostrudel.ninja/'},
  'nosmaps:net.syusui.rabbit': {url: 'https://rabbit.syusui.net/images/rabbit_256.png', source: 'link rel="shortcut icon" (image/png)', page: 'https://rabbit.syusui.net'},
  'nosmaps:com.yakihonne.web': {url: 'https://yakihonne.com/icon-512x512.png', source: 'manifest icons (512x512)', page: 'https://yakihonne.com'},
  'nosmaps:stream.zap': {url: 'https://zap.stream/logo_32.png', source: 'link rel="icon" (32x32)', page: 'https://zap.stream'},
  'nosmaps:pub.ditto': {url: 'https://ditto.pub/logo.svg', source: 'link rel="icon" (image/svg+xml)', page: 'https://ditto.pub'},
  'nosmaps:market.shopstr': {url: 'https://shopstr.market/shopstr.ico', source: 'link rel="icon"', page: 'https://shopstr.market'},
  'nosmaps:app.nsec': {url: 'https://use.nsec.app/favicon.ico', source: 'link rel="icon"', page: 'https://use.nsec.app'},
  'nosmaps:com.getalby.extension': {url: 'https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg', source: 'link rel="icon"', page: 'https://getalby.com/#extension'},
  'nosmaps:technology.nostr.khatru': {url: 'https://khatru.nostr.technology/logo.png', source: 'link rel="icon"', page: 'https://khatru.nostr.technology/'},
  'nosmaps:me.nostrcheck.server': {url: 'https://nostrcheck.me/favicon.ico', source: 'link rel="icon"', page: 'https://nostrcheck.me/'},
  'nosmaps:build.nostr': {url: 'https://nostr.build/favicon-32x32.png', source: 'link rel="icon" (32x32)', page: 'https://nostr.build/'},
  'nosmaps:com.zeusln': {url: 'https://zeusln.com/favicon.ico', source: 'link rel="icon"', page: 'https://zeusln.com'},
  'nosmaps:com.albyhub': {url: 'https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg', source: 'link rel="icon"', page: 'https://albyhub.com'},
  'nosmaps:com.mutinywallet.app': {url: 'https://app.mutinywallet.com/favicon.ico', source: 'link rel="icon"', page: 'https://app.mutinywallet.com'},
  'nosmaps:org.nostrdevkit': {url: 'https://nostrdevkit.org/assets/logo.svg', source: 'link rel="icon" (image/svg+xml)', page: 'https://nostrdevkit.org'},
  'nosmaps:watch.nostr': {url: 'https://nostr.watch/favicon-32x32.png', source: 'link rel="icon" (32x32)', page: 'https://nostr.watch'},
  'nosmaps:dev.zapstore': {url: 'https://zapstore.dev/favicon.ico', source: 'link rel="icon"', page: 'https://zapstore.dev'}
};
const ICONS_OBSERVED_AT = '2026-08-18';

/* R7 — a mention is not a claim. These are recorded so a library does not read as empty, and are
   labelled as what they are: names, not support statements. */
const NON_CLAIM_KEYS = {
  modules_named_after_nips: 'modules',
  crates_named_after_nips: 'crates'
};

const registryByNumber = new Map(registry.entries.map(entry => [entry.number, entry]));

/* R2 — strip the family prefix and separators, uppercase, pad to a two-character minimum. The
   result is an opaque ASCII token: '01', '15', '5A', '7D'. No numeric parse anywhere. */
function normalizeId(raw) {
  const token = String(raw).trim().replace(/^(?:NIP|BUD|LUD)[\s-]*/i, '').toUpperCase();
  return token.length < 2 ? `0${token}` : token;
}
function familyOf(raw) {
  const match = /^(NIP|BUD|LUD)/i.exec(String(raw).trim());
  return match ? match[1].toLowerCase() : 'nip';
}
function parseCapabilityKey(key) {
  const match = /^([a-z0-9-]{1,16}):([^/@]+)(?:\/([a-z0-9._-]{1,64}))?(?:@([a-z0-9._-]{1,32}))?$/.exec(key);
  if (!match) throw new Error(`capability key does not match the §21.2 grammar: ${key}`);
  return {family: match[1], id: normalizeId(match[2]), sub: match[3] || null, scope: match[4] || null};
}
function capabilityKey({family, id, sub, scope}) {
  return `${family}:${id}${sub ? `/${sub}` : ''}${scope ? `@${scope}` : ''}`;
}

/* §21.2.3 — resolution is done by the reading client against its own pinned snapshot and is never
   stored. A claim is never dropped, never remapped, and never merged into a successor. */
function resolve(capability) {
  if (capability.family !== registry.family) return {registryStatus: 'unresolvable', registryTitle: null, deprecated: false};
  const found = registryByNumber.get(capability.id);
  if (!found) return {registryStatus: 'not_in_registry', registryTitle: null, deprecated: false};
  return {registryStatus: 'resolved', registryTitle: found.title, deprecated: found.deprecated};
}

function urlOf(text) {
  const match = /https?:\/\/\S+/.exec(String(text || ''));
  return match ? match[0].replace(/[.,;)]+$/, '') : null;
}

function buildCapabilities(entry, d) {
  const claim = entry.nip_support_claim || {};
  const readings = PROSE_READINGS[d] || [];
  const byKey = new Map();
  const source = urlOf(claim.source);
  const blanket = BLANKET_CAVEATS[d] || null;

  const put = (rawKey, result, sourceText, caveat) => {
    const parsed = parseCapabilityKey(rawKey);
    const key = capabilityKey(parsed);
    const previous = byKey.get(key) || {};
    byKey.set(key, {
      ...parsed, key,
      result: result || previous.result || null,
      sourceText: sourceText || previous.sourceText || null,
      caveat: caveat || previous.caveat || null
    });
  };

  const listed = Array.isArray(claim.claimed) ? claim.claimed : [];
  for (const raw of listed) put(`${familyOf(raw)}:${normalizeId(raw)}`, 'supported', String(raw), blanket);
  for (const raw of (claim.claimed_in_a_different_spec_family || [])) put(`${familyOf(raw)}:${normalizeId(raw)}`, 'supported', String(raw), null);
  for (const raw of (claim.explicitly_not_supported || [])) {
    const id = normalizeId(/^[A-Za-z-]*\s*[0-9A-Za-z]+/.exec(raw.replace(/^(?:NIP|BUD|LUD)[\s-]*/i, ''))[0]);
    put(`${familyOf(raw)}:${id}`, 'not_supported', String(raw), null);
  }
  for (const reading of readings) put(reading.capability, reading.result || null, reading.sourceText || null, reading.caveat || null);

  return [...byKey.values()]
    .map(capability => {
      const resolution = resolve(capability);
      /* A prose reading may attach only a caveat to a capability the checklist already carries; a
         reading that names a capability with no result at all would be a row with no claim, so it
         is dropped rather than shown as an invented `supported`. */
      return capability.result ? {...capability, ...resolution, basis: 'transcribed', source, assertedAt: claim.fetched || null} : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.family === b.family ? a.key.localeCompare(b.key) : a.family.localeCompare(b.family)));
}

/* One row of data.js, built from one signed event. `signedRecord` is {event, content, d}: the event
   as it sits in the jsonl, already verified. `entry` is that record's collection notes from
   real-catalog-draft.json, joined on `d` — it supplies only the annotations the v1 profile has no
   room for, never a name, summary, homepage, state or topic, which come from the signed event. */
function buildTool(signedRecord) {
  const {event, content, d} = signedRecord;
  const entry = notesByD.get(d);
  if (!entry) throw new Error(`no collection notes for the signed record ${d}`);
  const tags = event.tags;
  const facts = entry.facts_with_no_home_in_v1_profile || {};
  const claim = entry.nip_support_claim || {};
  const collected = tags.filter(tag => tag[0] === 't' && tag[1] !== 'nosmaps').map(tag => tag[1]);
  const correction = TOPIC_CORRECTIONS[d];
  const capabilities = buildCapabilities(entry, d);

  /* R5 — "" is the normative absent form, and the signed record already carries it that way:
     tools/sign-catalogue.mjs signed Olas's collector-authored "Unknown" as "" (its own header says
     why) rather than sealing an invented value into a signature. Read straight through here. */
  const summary = content.summary;

  /* A plain language-code -> text map, read straight off the signed event and from nowhere else
     (#14 D14-1). This build authors no text: a description that is not in the signature does not
     exist, and whoever signed the record is who wrote its translations -- which is why there is no
     translator field to join on here (D14-3).

     `summary` above stays the canonical original and is what every language with no recorded text
     falls back to, so the original's own language is NOT copied in under a language code (D14-6):
     the same bytes in two places can drift apart, and the fallback already covers it. */
  const descriptions = content.descriptions ? {...content.descriptions} : {};

  const nonClaims = Object.entries(NON_CLAIM_KEYS)
    .filter(([key]) => Array.isArray(claim[key]))
    .map(([key, kind]) => ({kind, values: claim[key]}));

  return {
    id: d,
    /* The record's real address. The draft could only write `30078:<publisher-hex>:…` because
       nothing had signed it yet; now something has, so the publisher is the signer of the line this
       row was built from rather than a placeholder. */
    coordinate: `${KIND}:${event.pubkey}:${d}`,
    name: content.name,
    summary,
    summaryAbsent: summary === '',
    descriptions,
    homepage: content.homepage || null,
    /* Absent for the 17 entries the probe left without a verified image. Never a guessed
       URL and never a placeholder string: the UI draws the initial-letter box for `null`. */
    icon: ICONS[d] ? {...ICONS[d], observedAt: ICONS_OBSERVED_AT} : null,
    /* R4 — two axes. `recordState` is the winner's own `state`; project liveness is below and is
       never merged into it. */
    recordState: content.state,
    topics: correction ? correction.topics : collected,
    collectedTopics: collected,
    topicCorrection: correction ? correction.why : null,
    provenance: 'collected',
    /* issue #21 — the second this record was signed into the catalogue, straight off its own
       event. It is NOT `observed` (the date the primary source was fetched) and it is NOT a
       publication date, which no record states. All 41 lines were signed in one batch so this
       value is the same for every row today; it is written per row anyway because it is a
       property of the record, and a record signed by anyone else will carry its own. */
    collectedAt: event.created_at,
    observed: (entry.provenance[0] || {}).fetched || null,
    sources: entry.provenance.map(item => ({fields: item.field, url: item.url, what: item.what, fetched: item.fetched})),
    license: facts.license || null,
    platformText: facts.platforms || facts.platform || null,
    distribution: facts.distribution || null,
    sourceRepo: facts.source_repo || facts.source_repo_mirror || facts.mirror || null,
    capabilities,
    claim: {
      source: urlOf(claim.source),
      sourceLabel: claim.source || null,
      notation: claim.notation || null,
      fetched: claim.fetched || null,
      caveats: claim.verbatim_caveats || [],
      nonClaims
    },
    liveness: LIVENESS[d] || [],
    /* issue #10 — whether a person can switch between several accounts, as something that was
       actually looked at, not as something inferred from the NIP list. The draft carries the key
       only for the entries that were looked at; an entry with no key comes through as `null`, which
       the explorer reads as `unknown` and never as "does not support it". */
    accountSwitching: entry.account_switching_observation || null,
    findings: entry.findings || []
  };
}

const tools = signed.map(buildTool);

const nipCatalog = registry.entries.map(entry => ({
  number: entry.number,
  title: entry.title,
  deprecated: entry.deprecated,
  note: entry.note,
  source: `https://github.com/nostr-protocol/nips/blob/${registry.revision}/${entry.number}.md`
}));

const payload = {
  meta: {
    /* The date the signed records themselves carry, not a date written down twice: every event's
       created_at is the collection date, so the catalogue states when it was collected. */
    collected: new Date(signed[0].event.created_at * 1000).toISOString().slice(0, 10),
    collector: 'primary sources only; see real-catalog-draft-report.md',
    entryCount: tools.length,
    notCollected: catalog.not_collected.map(item => ({name: item.name, why: item.why}))
  },
  seedTopics: SEED_TOPICS,
  resultPrecedence: RESULT_PRECEDENCE,
  registry: {family: registry.family, registry: registry.registry, revision: registry.revision, source: registry.source, fetched: registry.fetched},
  nipCatalog,
  tools
};

const banner = `/* Generated by tools/build-data.mjs — do not edit by hand.

   Canonical source: catalogue-events.jsonl — ${tools.length} signed kind 30078 events, one per line, all
   signed by ${collectorPubkey}.
   That signature is the attribution: no record here names its collector in a field. Annotations
   with no room in the v1 content profile (provenance, capability claims, licence/platform facts,
   finding numbers) are joined on by \`d\` from real-catalog-draft.json, see
   real-catalog-draft-report.md. Ids resolve against nips-registry-656cecc.json (the pinned NIP
   registry snapshot, design-relay-native-data.md §19.1). Schema decisions: §21 R1-R7.

   Unknown is absent, never zero and never a placeholder string. A capability claim carries its
   family, its verbatim source line, and the status it resolves to against the pinned snapshot; an
   id the snapshot does not hold is rendered as unresolved, never dropped. */\n`;

writeFileSync(new URL('../data.js', import.meta.url),
  `${banner}(function(){\nwindow.NOSMAPS_DATA=${JSON.stringify(payload, null, 1)};\n})();\n`);

const counts = {};
for (const tool of tools) for (const capability of tool.capabilities) counts[capability.result] = (counts[capability.result] || 0) + 1;
process.stderr.write(`tools: ${tools.length}\nresults: ${JSON.stringify(counts)}\n`);
process.stderr.write(`no capability claim at all: ${tools.filter(tool => !tool.capabilities.length).length}\n`);
process.stderr.write(`registry statuses: ${JSON.stringify(tools.flatMap(tool => tool.capabilities).reduce((acc, capability) => ({...acc, [capability.registryStatus]: (acc[capability.registryStatus] || 0) + 1}), {}))}\n`);
process.stderr.write(`free topics: ${JSON.stringify([...new Set(tools.flatMap(tool => tool.topics).filter(topic => !SEED_TOPICS.includes(topic)))])}\n`);
