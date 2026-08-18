/* Generates data.js from the collected primary-source catalogue.

   Inputs, both pinned artefacts that live in the repo:
     real-catalog-draft.json    41 entries, every field traced to a primary source (see
                                real-catalog-draft-report.md for the 56 findings).
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

const catalog = JSON.parse(readFileSync(new URL('../real-catalog-draft.json', import.meta.url), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('../nips-registry-656cecc.json', import.meta.url), 'utf8'));

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

/* Per-language descriptions. The collected original (`summary`) stays canonical and is never
   overwritten; this map only adds a text for a language that has one recorded, and the UI falls
   back to the original for every language that does not. Each entry below is the recorded original
   of that same record carried into Japanese -- the record is the source, so nothing here states a
   fact the catalogue does not already state. An entry whose original is absent ("" -- Olas, R5)
   gets no description in any language: an absent summary stays absent. */
const DESCRIPTIONS_JA = {
  'nosmaps:io.damus': 'iPhone・iPad・macOS向けの、Twitterに似たNostrクライアント。',
  'nosmaps:social.amethyst': 'Android向けのNostrクライアント。',
  'nosmaps:net.primal.web': 'primal.netで使われているものと同じ、PrimalのNostrウェブアプリ。',
  'nosmaps:social.coracle': '複数リレーの潜在能力を引き出すことに主眼を置いた実験的なNostrクライアント。閲覧、絞り込み、Zap、カスタムフィードの作成により、自分好みのNostr体験を組み立てられる。',
  'nosmaps:social.phoenix': '機能を詰め込んだNostrのウェブUI。',
  'nosmaps:to.iris': '単一のリレーやサーバーに依存しない、高速でとっつきやすいオフラインファーストのNostrウェブクライアント。Cashuウォレット、安全なDM、ソーシャルグラフに基づく内容の絞り込みを備える。',
  'nosmaps:app.nostter': 'ウェブ向けのNostrクライアント。',
  'nosmaps:com.mikedilger.gossip': 'GossipはNostrクライアント。',
  'nosmaps:ninja.nostrudel': 'Nostrを探索するための砂場。',
  'nosmaps:net.syusui.rabbit': '🐰 TweetDeckのようなNostrクライアント。',
  'nosmaps:com.0xchat': 'Nostrプロトコル上に作られた、安全でオープンソースのチャットアプリ。Android、iOS、macOS、Linux、Windowsで利用できる。',
  'nosmaps:com.yakihonne.web': 'Nostrとビットコイン上の分散型ソーシャルペイメントクライアント。',
  'nosmaps:news.habla': 'HablaはNostr上で長文コンテンツを読み、書き、集め、収益化できるようにする。Nostrはソーシャルメディアのための検閲耐性のあるプロトコル。',
  'nosmaps:stream.zap': 'Nostrのライブ配信。',
  'nosmaps:pub.ditto': 'あなたのコンテンツ。あなたの雰囲気。あなたのルール。',
  'nosmaps:market.shopstr': 'ビットコイン商取引のための、世界規模で許可の要らないNostrマーケットプレイス。',
  'nosmaps:com.greenart7c3.nostrsigner': 'AmberはAndroid向けのNostrイベント署名アプリ。nsecを専用のアプリひとつに隔離しておける。Amberの目的は、サーバーも追加のハードウェアも要らずに、手元のスマートフォンをNIP-46の署名デバイスとして働かせること。',
  'nosmaps:com.fiatjaf.nos2x': 'Nostrの署名拡張機能。',
  'nosmaps:app.nsec': 'Noauth Nostr鍵マネージャー。',
  'nosmaps:com.getalby.extension': 'ウェブに深いLightningとNostrの統合をもたらすビットコインLightningブラウザ拡張機能。複数のLightningノードへのウォレットインターフェースであり、Nostr・Liquid・オンチェーンで使う鍵の署名役でもある。',
  'nosmaps:me.njump.pokey': '自分のNostrイベントの通知をその場で表示し、他のアプリがそれを受け取って操作できるようにする。',
  'nosmaps:com.hoytech.strfry': 'strfryはNostrプロトコルのリレー。外部データベースは不要で、データはすべてLMDBを使ってファイルシステム上にローカルに保存される。',
  'nosmaps:io.sourcehut.nostr-rs-relay': 'Rustで書かれたNostrリレー。',
  'nosmaps:technology.nostr.khatru': '独自のNostrリレーを作るためのフレームワーク。',
  'nosmaps:com.cameri.nostream': 'TypeScriptで書かれたNostrリレー。',
  'nosmaps:me.nostrcheck.server': 'コミュニティのNostrの頭脳。リレー、ファイルホスティング（NIP-96とBlossom）、Nostrアドレス（NIP-05）、Lightningリダイレクト、NWC、WoT、その他多数を備えた唯一のサーバー。',
  'nosmaps:com.bitvora.haven': 'Nostrのイベントのための高可用性の保管庫。',
  'nosmaps:com.hzrd149.blossom-server': 'Denoで書かれたBlossomサーバー。',
  'nosmaps:com.hzrd149.blossom': 'メディアサーバー上に素朴に保管されるブロブ ― Blossomプロトコルの仕様文書（BUD）。',
  'nosmaps:build.nostr': 'nostr.buildのメディアアップローダー ― Nostrのためのメディアホスティング。',
  'nosmaps:cat.void': '無料で単純なファイルホスティング。',
  'nosmaps:com.zeusln': '神々にふさわしいモバイルビットコインウォレット。',
  'nosmaps:com.albyhub': 'Alby Hub ― 自分だけのビットコインLightningノード。手軽で、つながりやすく、機能豊富。どこででも動かせる。自分で主権を持つ。',
  'nosmaps:com.mutinywallet.app': 'Mutinyはブラウザの中で動く自己管理型のLightningウォレット。',
  'nosmaps:wtf.nbd.nostr-tools': 'Nostrクライアントを開発するための道具一式。',
  'nosmaps:dev.nostr.ndk': 'アウトボックスモデルに対応したNostr開発キット。',
  'nosmaps:org.nostrdevkit': 'NostrプロトコルのRust実装。高水準のクライアントライブラリ、Nostr Wallet Connectなどを含む。',
  'nosmaps:com.fiatjaf.nak': 'Nostrに関することを何でもやるためのコマンドラインツール。',
  'nosmaps:watch.nostr': 'nostr.watchはNostrリレーネットワークを観測するための基盤を提供する。',
  'nosmaps:dev.zapstore': '利用者と作り手が出会うオープンなアプリストア。コミュニティが選ぶ。Androidアプリ。'
};

function buildTool(entry) {
  const content = entry.event_skeleton.content;
  const tags = entry.event_skeleton.tags;
  const d = tags.find(tag => tag[0] === 'd')[1];
  const facts = entry.facts_with_no_home_in_v1_profile || {};
  const claim = entry.nip_support_claim || {};
  const collected = tags.filter(tag => tag[0] === 't' && tag[1] !== 'nosmaps').map(tag => tag[1]);
  const correction = TOPIC_CORRECTIONS[d];
  const capabilities = buildCapabilities(entry, d);

  /* R5 — "" is the normative absent form. The collection wrote the string "Unknown" for Olas and
     flagged the record invalid; §21.5 says a cataloguer-authored placeholder is forbidden and the
     empty string is what the schema means. This is the one content value the build rewrites, and it
     removes an invented value rather than adding one. */
  const summary = content.summary === 'Unknown' ? '' : content.summary;

  /* A plain language-code -> text map. `summary` above stays the canonical text and is what every
     language falls back to; `descriptions.en` is that same original, named by its language so the
     map is not a Japanese-only side channel. A record with no summary at all carries no
     descriptions -- absent stays absent rather than becoming an empty string in two languages. */
  const descriptions = summary ? {en: summary, ...(DESCRIPTIONS_JA[d] ? {ja: DESCRIPTIONS_JA[d]} : {})} : {};

  const nonClaims = Object.entries(NON_CLAIM_KEYS)
    .filter(([key]) => Array.isArray(claim[key]))
    .map(([key, kind]) => ({kind, values: claim[key]}));

  return {
    id: d,
    coordinate: entry.coordinate_template,
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
    findings: entry.findings || []
  };
}

const tools = catalog.entries.map(buildTool);

const nipCatalog = registry.entries.map(entry => ({
  number: entry.number,
  title: entry.title,
  deprecated: entry.deprecated,
  note: entry.note,
  source: `https://github.com/nostr-protocol/nips/blob/${registry.revision}/${entry.number}.md`
}));

const payload = {
  meta: {
    collected: catalog._meta.generated,
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

   Source: real-catalog-draft.json (${tools.length} entries, every field from a primary source, see
   real-catalog-draft-report.md) and nips-registry-656cecc.json (the pinned NIP registry snapshot,
   design-relay-native-data.md §19.1). Schema decisions: §21 R1-R7.

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
