# nosmaps revision-2 — DONE / NOT-DONE inventory

**Tree state observed:** HEAD `70e12a0`; working tree dirty — 7 modified files (`design-relay-native-data.md`, `i18n.js`, `nip-explorer.css`, `nip-explorer.js`, `nostr-catalog.js`, `tests/relay-render.spec.js`, `tests/relay-unit.spec.js`), no new/untracked source files.
**Tests:** re-ran `npx playwright test` — **132 passed (41.5s)** across 3 files × 2 projects (chromium+webkit): `e2e.spec.js` 38, `relay-render.spec.js` 22, `relay-unit.spec.js` 72.
**Relays:** re-probed live, not taken on trust. `{"kinds":[32267],"#t":["nosmaps"]}` → **0 events** on both `wss://x.kojira.io` and `wss://nos.lol`. Unfiltered `{"kinds":[32267],"limit":200}` → 14 events on x.kojira.io, 200 on nos.lol; **0 of those carry a `d` starting `nosmaps:`**. Confirmed: zero of our records exist anywhere.

## Summary table

| # | Requirement (design §) | Status | Impl file:line | Test file:line |
|---|---|---|---|---|
| D1 | No backend; every fact from a signed relay event | DONE | nostr-catalog.js:1475 (`loadCatalog`, relay-only) | relay-render.spec.js:383 (0 HTTP asserted :394) |
| D2 | 32267 is the only canonical record | DONE | nostr-catalog.js:248 `validateSoftwareEvent` | relay-unit.spec.js:332, :361 |
| D3 | No listing gate | DONE | nostr-catalog.js:889 (`state!=='active'` is the whole rule) | relay-unit.spec.js:796 |
| D4/I7 | Curation is presentation-only | DONE | nostr-catalog.js:908, :920 | relay-unit.spec.js:796; relay-render.spec.js:303 |
| D5 | Trust = viewer's kind 3; no shipped curator | DONE | nostr-catalog.js:645 `deriveGraph`; POLICY has no curator const (:29–60) | relay-unit.spec.js:901 (asserts `counted/curators/manual` all `[]`) |
| D6/I4 | Deterministic reconstruction, order-independent | DONE | nostr-catalog.js:829 `buildCatalog`; :152 `compareCodePoints` | relay-unit.spec.js:275 (:324 permutation), :780 |
| D7/I8 | Unknown is never invented; unknown ≠ 0 | DONE | nostr-catalog.js:908 (`null` not 0); :809 `orderEntries` drops key | relay-unit.spec.js:859; relay-render.spec.js:329 (:349) |
| D8 | 3 logical REQ per relay, no N+1 | DONE | nostr-catalog.js:1543 (R1), :1584 (R2), :1639 (R3) | relay-render.spec.js:383 (:391–405); relay-unit.spec.js:1070 |
| D9 | AP: degrade honestly | IMPLEMENTED-UNTESTED | nostr-catalog.js:964–972 status ladder; :1413 `mergeCoverage` | Only `status:'fresh'`/`'stale'` covered (relay-unit.spec.js:1204). No test drives `timeout`/`error`/`rejected` coverage → `incomplete`. NOT FOUND |
| D10 | Discovery opt-in, always labelled | DONE | nip-explorer.js:354 `discoveryScopeMarkup` | relay-render.spec.js:329 (:353) |
| D11 | Explicit `state`, newest valid wins | DONE | nostr-catalog.js:310 (`state` enum); :539 | relay-unit.spec.js:938 |
| D12 | Relay/kind capabilities unverified until preflight | NOT IMPLEMENTED | No probe code. `nip11-assumed` pushed at nostr-catalog.js:1505 as the honest substitute | relay-render.spec.js:557 asserts the *label*, not a probe |
| D13 | Default relays exactly the two | DONE | nostr-catalog.js:36 | relay-render.spec.js uses `?relays=` override; default value covered only indirectly. Direct assertion NOT FOUND |
| D14 | IndexedDB = discardable cache | DONE | nostr-catalog.js:1142–1275 | relay-unit.spec.js:1140 |
| §4.2 r1b | `d` MUST begin `nosmaps:`; `foreign-d` distinct from `foreign-profile` | DONE | nostr-catalog.js:270 (`foreign-d`), :284 (`foreign-profile`) | relay-unit.spec.js:446 (4 real relay-fetched foreign events) |
| §4.2 r2 | Exact v1 content key set, limits | DONE | nostr-catalog.js:302–322 | relay-unit.spec.js:361 |
| §4.2 r3/r4 | `state` enum; `state` tag must match content | DONE | nostr-catalog.js:311, :333 | relay-unit.spec.js:361 (`badState`, `stateTagMismatch`) |
| §4.3 | Claim levels `self_asserted` / `nip05_linked` / `socially_recommended` / `evidence_linked` | NOT IMPLEMENTED | No claim-level field anywhere. Only `provenanceBadge` at nip-explorer.js:200 (relay-vs-sample, not a claim level) | NOT FOUND |
| §5.1 r1–2 | `t` lowercase; multi-value `t` rejected | DONE | nostr-catalog.js:287–298 | relay-unit.spec.js:361 (`multiValueT`, `uppercaseT`) |
| §5.1 r4 | Discovery pagination, `incomplete: discovery-cap` | NOT IMPLEMENTED (partial) | Single page only — self-declared `DEVIATION` at nostr-catalog.js:1560; cap slug at :1563 | Saturation path NOT FOUND |
| §5.2 | Exact fetch grouped **by author** | DONE | nostr-catalog.js:1435 `groupByAuthor` | relay-render.spec.js:383 (:412 recall filters) |
| §5.3 | Winner = max(created_at), tie → lowest id; validate before select | DONE | nostr-catalog.js:539, :560 | relay-unit.spec.js:275, :298 |
| §5.3 | `quarantined-newer-version` flag surfaced | IMPLEMENTED-UNTESTED (UI) | Computed nostr-catalog.js:624–633; passed through nip-explorer.js:304 but **never rendered** | Data layer: relay-unit.spec.js:298 (:313). UI render: NOT FOUND |
| §5.4 | Listability = winner + active, nothing else | DONE | nostr-catalog.js:889 | relay-unit.spec.js:796; relay-render.spec.js:266 |
| §5.4 | Recommended-but-unobserved → unresolved, never a row | DONE | nostr-catalog.js:924–933 | relay-unit.spec.js:1033; relay-render.spec.js:266 (:279) |
| §6.1 | 30267 members = `a` tags parsing `32267:<64hex>:<d>`; others ignored | DONE | nostr-catalog.js:378–390 | relay-unit.spec.js:608 |
| §6.1 | ≤8 sets/curator, ascending `d`, truncation reported | DONE | nostr-catalog.js:759–786; slug :954 | relay-unit.spec.js:651 (:693) |
| §6.2 s1 | Identity: NIP-07 → pasted → none | DONE | nostr-catalog.js:1517 (pasted), :1526–1539 (NIP-07 getPublicKey) | Pasted: relay-render.spec.js:360; relay-unit.spec.js:1115. **NIP-07 branch: NOT FOUND** (no test injects `window.nostr`) |
| §6.2 s2 | kind 3 union-then-select across relays | DONE | nostr-catalog.js:663–677 | relay-unit.spec.js:726 (:780) |
| §6.2 s3 | G = viewer ∪ p-tags; malformed dropped+counted; signed tag order; cap 512 "N of M" | DONE | nostr-catalog.js:411–450, :688–701 | relay-unit.spec.js:726 (:786–791) |
| §6.2 | No kind 3 → `self-only`, never "you follow nobody" | DONE | nostr-catalog.js:678–686 | relay-unit.spec.js:726 |
| §6.3 | Tier 2 opt-in | NOT IMPLEMENTED (honestly declared) | Flag nostr-catalog.js:52; `tier2-not-implemented` diagnostic :1509 | NOT FOUND — design §20.2 item 9 requires seed/byte-cap tests; none exist |
| §6.4 | `rec1` = distinct pubkeys in G, curator counted once | DONE | nostr-catalog.js:770–777 | relay-unit.spec.js:651 |
| §6.4 | Order `(rec1 DESC, created_at DESC, id ASC)`; drop counts when graph none | DONE | nostr-catalog.js:809–827 | relay-unit.spec.js:859 |
| §6.4 | Tier-2 shown separately, never summed | NOT IMPLEMENTED | No `rec2` field | NOT FOUND |
| §6.4 | Pubkeys behind each count inspectable | DONE | nostr-catalog.js:909; nip-explorer.js:333 | relay-render.spec.js:518 (:538–545) |
| §6.5.1–3 | No-graph: full row set, fallback order, counts `—` | DONE | nostr-catalog.js:908; :810 | relay-unit.spec.js:901; relay-render.spec.js:329 |
| §6.5.4 | Persistent banner naming both remedies | DONE | nip-explorer.js:360–373; i18n.js:74 (ja) / :116 (en) | relay-render.spec.js:329 (:334) |
| §6.5.5 | No shipped default curator / featured list | DONE | No such constant in POLICY (nostr-catalog.js:29–60) | relay-unit.spec.js:901 (:927–929) |
| §6.5.6 | Manual "also count these", ships empty, labelled | DONE | nostr-catalog.js:851–866, :1572–1581 | relay-render.spec.js:561 |
| §6.6 | Curation adds recall via exact fetch | DONE | nostr-catalog.js:1596–1641 (R3) | relay-render.spec.js:303; :561 (:580) |
| §7.1 | Publisher retraction via newer `withdrawn` winner | DONE | nostr-catalog.js:889 + :539 | relay-unit.spec.js:938 |
| §7.1 | Age never infers withdrawal | DONE (by absence) | No age→state code path exists in nostr-catalog.js | relay-unit.spec.js:938 asserts state comes only from winner |
| §7.2 | Curator drop = next set version; empty set valid & distinct | DONE | nostr-catalog.js:714–760 | relay-unit.spec.js:651 (:677, :682) |
| §7.3 | kind 5: same-author only, `a` covers up to created_at, one coalesced REQ | DONE | nostr-catalog.js:453–537 (:472 same-author), :1464 `cleanupFilter` | relay-unit.spec.js:981; relay-render.spec.js:383 (:407) |
| §7.3 | Deletion never load-bearing for rebuild | DONE | nostr-catalog.js:498 (union of observed only) | relay-unit.spec.js:981 |
| I1 | Signature first | DONE (delegated) | nostr-catalog.js:1295 `createRxNostr({verifier})` | relay-render.spec.js fixtures are really signed (:119, :130); **no negative test** — a tampered sig is never asserted rejected. NOT FOUND |
| I2 | Publisher locality | DONE | nostr-catalog.js:472; coordinate-keyed grouping :566 | relay-unit.spec.js:938; :981 |
| I3 | Newest valid wins across relays | DONE | nostr-catalog.js:539 | relay-unit.spec.js:275 |
| I5 | Honest freshness | IMPLEMENTED-UNTESTED | nostr-catalog.js:964–972 | Only fresh/stale asserted (relay-unit.spec.js:1204); `incomplete` from real relay failure NOT FOUND |
| I6 | Eventual convergence | NOT VERIFIABLE WITHOUT REAL DATA | Implied by :539 + :829 purity | No convergence test (design §20.2 item 14). NOT FOUND |
| §8.3 A–C | Partition scenarios | NOT VERIFIABLE WITHOUT REAL DATA | — | NOT FOUND |
| §8.4 | Empty-cache rebuild = R1–R3 only | DONE | nostr-catalog.js:1543–1641 | relay-render.spec.js:211 (cache wiped before each measured load); relay-unit.spec.js:1140 |
| §9.2 | HTTP in data path = 0, assertable | DONE | `httpAttempts` counter nostr-catalog.js:93, never incremented | relay-render.spec.js:383 (:394, :428) |
| §9.4 | Byte/array chunking, NIP-11 absent → `assumed` | DONE | nostr-catalog.js:1073 `chunkFilters`; :1505 slug | relay-unit.spec.js:1070; relay-render.spec.js:518 (:557) |
| §9.3 | Cost scaling C=1,8,64,512,2048 | DONE | nostr-catalog.js:1073 | relay-unit.spec.js:1070 (:1098–1108) |
| §10 | Candidate kinds 30368–30372 | NOT IMPLEMENTED | Zero occurrences of 30368/30369/30370/30371/30372 in any first-party file | NOT FOUND |
| §11 | Coordinate migration authority (depth 8, cycles, unavailable target) | NOT IMPLEMENTED | Only `superseded_by` shape+self-loop check: nostr-catalog.js:325–328; `MAX_MIGRATION_DEPTH` declared :44, **used 0 times** | Shape only: relay-unit.spec.js:402–403. Chain following NOT FOUND |
| §12.1 | Winner-before-display pagination | NOT IMPLEMENTED | No `until`/boundary code in nostr-catalog.js | NOT FOUND |
| §12.2 | Reaction reduction (kind 7) | NOT IMPLEMENTED | No kind 7 handling | NOT FOUND |
| §12.3 | Future-timestamp quarantine (10m skew / 30d horizon) | DONE | nostr-catalog.js:184–191 | relay-unit.spec.js:361 (:433–434); :633 |
| §13.1 | Lazy components issue 0 REQ before activation | NOT VERIFIABLE | Lazy rounds don't exist yet — nothing to activate | NOT FOUND |
| §13.2 | Mandatory gap query / reconnect recovery | NOT IMPLEMENTED | No high-water mark, no `since`, no reconnect handler | NOT FOUND |
| §14 | Private bookmarks (kind 10003, NIP-44) | NOT IMPLEMENTED | Zero `bookmark` hits in nostr-catalog.js | NOT FOUND |
| §16.1 | Relay set user-editable, coverage always shown | DONE | nip-explorer.js:403 (`?relays=`); nip-explorer.js:329 coverage rows | relay-render.spec.js:518 (:528) |
| §16.2 | `DISCOVERY_TOPICS` user-editable, gap labelled | DONE | nostr-catalog.js:38; nip-explorer.js:405 (`?topics=`); label :354 | Label: relay-render.spec.js:353. `?topics=` override itself: NOT FOUND |
| §16.3 | Foreign 32267 quarantined w/ reason, inspectable, never "nonexistent" | DONE | nostr-catalog.js:270/:284; surfaced nip-explorer.js:344 | relay-unit.spec.js:446; relay-render.spec.js:266 (:296) |
| §16.6 | NIP-05 verification (lazy, display-only) | NOT IMPLEMENTED | Zero `nip05` hits in first-party code | NOT FOUND |
| §17.4 | No trusted-curator gate | DONE | `trustedCurators` / `opts.curators` grep → **0 hits** in nostr-catalog.js | relay-render.spec.js:561 (`?curators=` proven additive-only) |

## Blocked purely on "no real records exist on the relays yet"

Every relay-facing test runs against `installMockRelay` (`relay-render.spec.js:32`), a WebSocket stand-in — not a real relay. So:

- **Never executed against non-empty real data:** the entire `loadCatalog` path against `wss://x.kojira.io` / `wss://nos.lol`. Against production today the only reachable outcome is `status:'unavailable'` → `els.results.hidden = true` and the `relayEmptyTitle` empty state (`nip-explorer.js:435`), a branch **no test asserts** (grep for `relayEmptyTitle`/`zero-results` in `tests/` → zero hits).
- **Never executed at all:** real per-relay divergence (I3/§8.3 A–C), real EOSE timing, `coverage` statuses other than `eose`/`skipped` — `timeout`, `auth-required`, `rejected`, `disconnected` are defined in i18n and in `emptyCoverage` (nostr-catalog.js:1309) but nothing has ever produced them; `discovery-cap` saturation; real NIP-11 limits; `authors`-array behaviour at 512/2048 against a real relay (only chunked locally at relay-unit.spec.js:1070).
- **Structurally impossible today:** `graph: tier1` against a real follow list — nobody follows a pubkey that curates nosmaps records, because none exist. `rec1 > 0` in production is unreachable.
- **What the 132 passing tests DO prove:** the pure reducers (`validateSoftwareEvent`, `selectSoftwareWinners`, `deriveGraph`, `curationMembership`, `orderEntries`, `buildCatalog`, `chunkFilters`) are correct on fixtures, including 4 *real, signature-valid* foreign 32267 events pulled off x.kojira.io (relay-unit.spec.js:129–241); and that the REQ framing, filter shapes and round count are right when a relay behaves.
- **What they do NOT prove:** that any real relay indexes `#t` on kind 32267; that rx-nostr's per-relay EOSE correlation works (self-declared `DEVIATION`, nostr-catalog.js:1278 — coverage is *approximated*: on clean completion **all** relays are marked `eose`, so `incomplete` from a single slow relay has never happened); that signature verification rejects anything (no negative-signature test exists — the mock only ever serves genuinely signed events); that the page shows anything at all in production.

## Missing for the published page to show real content — the write path

**`grep -rn 'window.nostr'` across the repo, excluding `node_modules/` and the vendored `dist/`, returns exactly 2 hits, verbatim:**

```
./nostr-catalog.js:1528:          if (typeof window !== 'undefined' && window.nostr && typeof window.nostr.getPublicKey === 'function') {
./nostr-catalog.js:1529:            const key = await window.nostr.getPublicKey();
```

Both are **read-only identity**. `window.nostr.signEvent` in first-party code: **zero hits** (it exists only in `dist/rx-nostr.js:110`, vendored, never called by us).

- **Event building for publishing: zero.** No code anywhere constructs a kind 32267 or 30267 event. `validateSoftwareEvent` parses; nothing serialises. No `created_at`/`tags`/`content` assembly, no `getEventHash`, no `finalizeEvent`.
- **Relay publish call from the browser: zero.** `rxNostr` is constructed with a **verifier only** (`nostr-catalog.js:1295`) — no signer. `rxNostr.send` / any `["EVENT",...]` emission: zero hits in first-party code. The only outbound frames are `REQ` (`nostr-catalog.js:1403`) and `CLOSE`.
- **No publisher UI.** No form, no dialog, no button that would produce a record. `?relay=1` is required even to *read* (`nip-explorer.js:20`, `:716`) — the default published page runs on `data.js` samples and never touches a relay.
- **Net:** the app is a **read-only client for a corpus that does not exist**. To show real content end to end, minimally: (1) a NIP-07 `signEvent` path, (2) a 32267 v1 event builder emitting `d:"nosmaps:…"` + `t:"nosmaps"` + the exact 5-key content profile, (3) an `EVENT` publish with read-back (design §9.2 "publisher publication"), (4) at least one record actually on a default relay, (5) flipping the read path on without `?relay=1`.

## Doc / code drift

1. **§17 is stale by construction.** It says "verified against `HEAD = 70e12a0`" (design:1302) and describes `validatePointerEvent` at `nostr-catalog.js:195-327`, `POLICY.POINTER_KIND`, `opts.curators` defaulting to `[]` at `:888`/`:731`, `STORE='manifests'`, `window.NOSMAPS_CATALOG` at `:1131`. In the working tree **all of these are gone**: `grep trustedCurators|opts.curators` → 0 hits; the export is at `nostr-catalog.js:1761`; `'manifests'` survives only as `LEGACY_STORE` for the v1→v2 migration (`:1147`). §17 describes the *pre-change* tree while the tree is already changed — it reads as a to-do list that has silently been done.
2. **§17.5 test line numbers are all wrong.** It claims `relay-unit.spec.js:139`/`:168` are pointer-validation tests to delete; those lines are now real 32267 fixture data (`id:` and `kind: 32267`). It claims `relay-render.spec.js:11` is `BLOSSOM_ORIGIN`; line 11 is now `const KEYS = {`.
3. **§7.1's own example violates §4.2 rule 1b.** design:575 shows `["d", "com.example.tool"]` with no `nosmaps:` prefix. Run through `validateSoftwareEvent` (nostr-catalog.js:270) that event returns `foreign-d` — the doc's canonical retraction example would be quarantined by the doc's own gate. Same for §5.2's `#d:["tool-a","tool-b"]` (design:334) and §9.1 R3 (design:764).
4. **§7.1 cites a deleted constant.** design:591 says the client "flags it past `MAX_POINTER_AGE_BEFORE_WARNING`-equivalent age thresholds" — but §18 deletes the pointer entirely, no such constant exists in POLICY, and no age flag is implemented.
5. **Declared-but-dead policy constants.** `MAX_MIGRATION_DEPTH` (nostr-catalog.js:44), `MAX_DISCOVERY_PAGES_PER_RELAY` (:47), `MAX_DISCOVERY_RAW_EVENTS_PER_RELAY` (:48) are each referenced **0 times**. Conversely `GRAPH_TIER2_MAX_SEEDS`, `GRAPH_TIER2_MAX_PUBKEYS`, `GRAPH_TIER2_MAX_BYTES_PER_RELAY`, `MAX_DETAIL_*` (design:162–171) don't exist in POLICY at all.
6. **§4.3's claim-level table has no counterpart in code.** `socially_recommended` / `nip05_linked` / `evidence_linked` appear nowhere; `nip-explorer.js:200` emits only a relay-vs-sample provenance badge.
7. **Two self-declared DEVIATIONs in code with no doc counterpart** — `nostr-catalog.js:1278` (per-relay EOSE approximated) and `:1560` (single discovery page). Honest in the source; the design still states both as normative without noting the gap.
8. **`manualRecommendations` is computed and never displayed.** Produced at `nostr-catalog.js:910`, asserted in `relay-render.spec.js:591`, but `grep manualRecommendations nip-explorer.js` → 0 hits. §6.5.6 requires manual-list rows be "labelled as coming from the manual list"; on a card they are not.
