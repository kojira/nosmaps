# issue #11 — TypeScript restructure: state of the tree

Written by the run that ended 13:58 JST. Everything below was observed, not assumed.
**Nothing is committed.** The tree is left dirty on purpose so it can be inspected.

## What the task was

Not "rename files to .ts". Restructure into real modules with a stated dependency
direction, in TypeScript, under `strict`, without changing behaviour.

## Layers, and what is done

```
src/domain/   pure. no DOM, no network, no window.
src/data/     relays, IndexedDB, publish. no DOM.
src/ui/       markup, i18n, icons.
src/entry/    per-page wiring, bundled by esbuild into dist/.
```

### DONE — `npx tsc --noEmit` is 0 errors under strict over all of the below

| file | what it holds | from |
|---|---|---|
| `domain/json.ts` | RFC 8785 canonicalisation, strict JSON parser (rejects duplicate keys), sha256 | `nostr-canonical.js` |
| `domain/policy.ts` | POLICY, schema/prefix constants, coordinate grammar, WRITE | `nostr-catalog.js` head |
| `domain/event.ts` | event/tag shapes, coordinate helpers, code-point ordering, §12.3 clock | `nostr-catalog.js` |
| `domain/npub.ts` | bech32 encode/decode | `nostr-catalog.js` |
| `domain/records.ts` | the four validators (30078 / 30267 / 3 / 5) | `nostr-catalog.js` |
| `domain/winners.ts` | NIP-01 addressable winner selection, deletions, quarantine | `nostr-catalog.js` |
| `domain/graph.ts` | §6.2 social graph, curation membership, §6.4 ordering | `nostr-catalog.js` |
| `domain/catalogue.ts` | `buildCatalog` — the pure reducer | `nostr-catalog.js` |
| `domain/chunking.ts` | §9.4 byte-aware REQ chunking | `nostr-catalog.js` |
| `domain/entry.ts` | catalogue entry types, derived from the existing `nosmaps.d.ts` | `nosmaps.d.ts` |
| `data/cache.ts` | IndexedDB derived cache | `nostr-catalog.js` |
| `data/stats.ts` | request counters + bounded log | `nostr-catalog.js` |
| `data/relay.ts` | rx-nostr context, `fetchRound`, coverage, filters | `nostr-catalog.js` |
| `data/load.ts` | `loadCatalog` orchestration (R1/R2/R3) | `nostr-catalog.js` |
| `data/publish.ts` | the whole write path | `nostr-catalog.js` |
| `data/catalogue-data.ts` | the ONE place that reads `window.NOSMAPS_DATA` | new |
| `ui/i18n.ts` | full ja+en dictionary, unchanged, with a real typed runtime | `i18n.js` |
| `ui/icons.ts` | glyphs + entry icon + placeholder fallback | `icons.js` |
| `ui/site-footer.ts` | shared footer | `site-footer.js` |
| `ui/carousel.ts` | the landing carousel | `landing.js` |
| `entry/landing.ts` | index.html wiring | new |

`index.html` now loads **only** `data.js` (the generated artefact, still a classic
script by design) plus `<script type="module" src="dist/landing.js">`.

Measured after the change:

```
slides(real): 41
h1: "Here's the map of Nostr!"
console errors: 0 []
page errors: 0 []
```

### NOT DONE

1. **`nip-explorer.js` (1336 lines) is not migrated.** `nip-explorer.html` still
   loads the root-level classic scripts. This is the single largest remaining
   piece and it is why the explorer page is not yet dist-only.
2. **`tools/` and `tests/` are still `.js` / `.mjs`.** Deliberately dropped when
   the budget tightened; they are excluded from `tsconfig.json` right now.
3. The old root files (`nostr-catalog.js`, `nostr-canonical.js`, `i18n.js`,
   `icons.js`, `landing.js`, `site-footer.js`) are **still present**, because
   `nip-explorer.html` still needs them. They become deletable the moment (1) is
   done. `landing.js` and `site-footer.js` are already unused by any page.

## How the dependency direction is enforced

`tools/check-layering.mjs`, wired into `npm run typecheck`. It parses every
relative import under `src/` and fails if one points at a higher layer.

Verified to actually fail — a deliberate `domain -> ui` import was added and it
reported `FAIL: 1 reverse import(s)` with exit 1, then removed. A guard that has
never been seen to fail is not a guard.

## Findings (reported, not silently fixed)

1. **`orderEntries` flattens "unknown" into 0 for the sort key.** `buildCatalog`
   sets `recommendations: null` when the graph is `none` (I8: unknown is not
   zero), but the comparator treats a non-finite count as 0. So a row with an
   unknown count and a row with zero recommendations sort identically. The
   *display* is still correct (null renders as unknown), so nothing is fabricated
   on screen. Behaviour left exactly as it was; the type now says `number | null`
   and the comment states the 0 is key-only and never written back to the row.
2. **kind 3 and kind 5 validation does not read `content`.** Only 30078/30267
   require a string `content`. When the envelope check was factored out, this had
   to become an explicit `requireContent` flag — collapsing it would have started
   rejecting valid NIP-02/NIP-09 events. Worth knowing before anyone "tidies" it.

## Next run: do this, in this order

1. Port `nip-explorer.js` into `src/ui/explorer/*` + `src/entry/nip-explorer.ts`.
   The seams are already visible in the original: viewer/sign-in, filtering,
   card rendering, dialogs, relay rendering, publish form. `nosmaps.d.ts` still
   holds accurate types for all of it — reuse it rather than re-deriving.
   Keep `signIn()` the single sign-in path (no second `getPublicKey()` caller).
2. Point `nip-explorer.html` at `dist/nip-explorer.js` only, add the entry to the
   `build` script, delete the then-unused root `.js` files.
3. Migrate `tools/` and `tests/` to `.ts` (node v25 runs `.ts` natively, so no
   build step is needed for either) and widen `tsconfig.json` `include`.
4. Full chromium run; the failure set must stay at or below the measured 13.

---

# Run 2 (ended 14:2x JST) — what this run actually did

**The headline: `nip-explorer.html` is NOT dist-only yet. It still loads the six
root-level classic scripts.** That was the task and it is not finished. Everything
below is what was measured, and the honest reason it stopped where it did.

## Why it did not finish

The first thing this run did after reading the handoff was measure the port instead
of estimating it: the whole of `nip-explorer.js` was copied to a scratch file,
typed as one module, and compiled under the real `tsconfig.json`.

```
tsc on the whole file, unmodified:                696 errors
after typing the single `t` helper (1 line):      389 errors
```

307 of the 696 were one thing — `t(key)` called with one argument against a
signature that wants two. Fixing *one line* removed them. The remaining 389 are
real: 172 implicit-`any` parameters, 94 property-does-not-exist, 46
possibly-null, 32 index-signature. Those are not mechanical; each one is a
question about what the code assumes, and `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes` mean the answers have to be written down rather than
asserted away. With ~35 minutes of budget left after the measurement, porting
1336 lines at that error density and *keeping behaviour identical* was not
honestly achievable. Shipping it half-done would have meant a page that loads
from `dist/` and renders something subtly different — far worse than a page that
still loads the old scripts and is correct.

So the run took the seams that could be finished **and proven equal to the
original**, and left the page wiring alone.

## What was added (all green, all differentially checked)

| file | what it holds | proof it matches the original |
|---|---|---|
| `domain/explorer.ts` | §21.7 result values, §21.3 R3 support resolution (`featureSupport`, `outOfFamily`, `precedenceOf`, `claimSummary`), issue #7 filter modes (`supportPasses`), feature definitions, `validStates`, search-term flattening, `ossState` | see the differential run below |
| `ui/explorer/relay-row.ts` | the relay→row boundary (`relayEntryToRow`, `formatObserved`, `categoryFromTopics`, `shortKey`) | field-by-field diff against the original closure: **0 differing fields, 0 extra, 0 missing** |
| `ui/explorer/draft-storage.ts` | §W1.4 draft persistence | behaviour preserved incl. "clear only on observed publication" |
| `ui/explorer/params.ts` | every query-string knob with its shipped default | defaults read back and compared to the source literals |
| `ui/explorer/dom.ts` | `esc`, `$`, focusable-element query | unchanged semantics, nullability now in the type |

### The differential run that matters

`featureSupport` + `supportPasses` were run over the real `data.js` for all ten
features, and the same ten selections were counted in a real chromium page
running the **original** `nip-explorer.js`:

```
extracted domain: {"posts":10,"dm":4,"search":10,"media":10,"notifications":7,
                   "accounts":9,"signing":6,"wallet":7,"longform":4,"community":10}
live page  (#result-count, after a real navigation to each #features-<id>):
                  {"posts":10,"dm":4,"search":10,"media":10,"notifications":7,
                   "accounts":9,"signing":6,"wallet":7,"longform":4,"community":10}
```

Identical on all ten. Note the numbers are not all 10 — the first attempt at this
check *did* return 10 for every feature, because a hash-only change does not
reload the page and the counts were the unfiltered set. The check was wrong, not
the code; it was fixed to force a reload, and only then did it mean anything. A
measurement that returns the same number for every input is a broken measurement.

## Measured, at the end of this run

```
$ npm run typecheck
tsc --noEmit && node tools/check-layering.mjs
layers: domain <- data <- ui <- entry
relative imports checked: 53
OK: every import points at its own layer or a lower one

$ node tools/verify-catalogue.mjs
lines: 41 / valid signed events: 41 / data.js entries: 41 (meta.entryCount 41)
OK: every line parses, verifies, and data.js matches the jsonl

chromium, full suite: 117 passed, 13 failed (5.2m)  — the same 13 as the handoff
(7 e2e + 5 relay-render + landing:40). No new failing title.

nip-explorer.html probe: cards 41, record-state badges 82, console errors 0,
page errors 0, window.NOSMAPS_I18N present.
scripts still loaded: data.js, i18n.js, icons.js, nostr-canonical.js,
nostr-catalog.js, nip-explorer.js, site-footer.js  — i.e. NOT dist-only.
```

## Next run: the remaining work, honestly scoped

1. The 389 real type errors are the port. Suggested order, because it front-loads
   the ones that unblock the rest: `t`/i18n call sites (already 1 line), then the
   `state` object (most of the 32 index-signature errors are `state[key]`), then
   the render functions in dependency order (`filters` → `cards` → `dialogs`).
   `params.ts`, `relay-row.ts`, `draft-storage.ts` and `dom.ts` are already done
   and should be imported, not re-derived.
2. Only when the whole entry compiles: add `src/entry/nip-explorer.ts` to the
   `build` script, point the html at `dist/nip-explorer.js` (`type="module"`),
   then delete the root `.js` files that become unused.
3. `tools/` and `tests/` to TS — still untouched.

**Do not point the html at `dist/` before the differential checks pass.** The
value of this page is that its numbers are true; a faster build that renders a
different 41 is a regression, not progress.
