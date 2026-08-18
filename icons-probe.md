# Icon probe — measurement slice for issue #3

Run: 2026-08-18, from this machine, against HEAD `c15fafd`. Measurement only — no application
source file was changed, nothing was committed, no image binary was downloaded to the repo.

## Method

For each of the 41 entries in `window.NOSMAPS_DATA.tools` that carries a non-null `homepage`:

1. GET the homepage with a normal desktop Chrome user agent, redirects followed, 20 s timeout.
2. Read the returned markup and collect every declared icon: `<link rel="icon">` (incl.
   `shortcut icon`), `<link rel="apple-touch-icon">`, `<link rel="mask-icon">`,
   `<meta property="og:image">` / `twitter:image`, `<meta name="msapplication-TileImage">`, and
   — when the page declares `<link rel="manifest">` — every `icons[].src` in that manifest.
3. Resolve every href against the page's final URL.
4. GET each resolved URL and record status, `Content-Type` and byte count. A candidate counts as
   a verified image only when status is 2xx AND content-type starts with `image/` AND bytes > 0.
5. ~0.3 s between icon requests, ~0.8 s between entries.

`/favicon.ico` was requested **only** where the page itself declared it. No URL was guessed by
convention; no value below was inferred — every status, content-type and byte count in this file
was observed in the run.

The **Chosen** column is the highest-priority verified candidate, priority being
`rel=icon` > manifest `icons[]` > `apple-touch-icon` > `mask-icon` > `msapplication-TileImage` >
`og:image`. Every other verified candidate is listed in the appendix.

## Results

| # | entry id | homepage | page HTTP | chosen icon URL | markup source | icon HTTP | content-type | bytes |
|---|---|---|---|---|---|---|---|---|
| 1 | `nosmaps:io.damus` | https://damus.io/ | 200 | https://damus.io/logo_icon.png | meta og:image | 200 | image/png | 146861 |
| 2 | `nosmaps:social.amethyst` | https://amethyst.social | 200 | https://amethyst.social/amethyst-logo.jpg | link rel="icon" (image/jpeg) | 200 | image/jpeg | 7694 |
| 3 | `nosmaps:net.primal.web` | https://primal.net | 200 | https://primal.net/assets/favicon-85332ee3.ico | link rel="icon" (image/ico) | 200 | image/vnd.microsoft.icon | 15086 |
| 4 | `nosmaps:social.coracle` | https://app.coracle.social | 200 | https://app.coracle.social/icons/favicon.ico | link rel="icon" (48x48) | 200 | image/vnd.microsoft.icon | 33310 |
| 5 | `nosmaps:social.phoenix` | https://phoenix.social | 200 | https://phoenix.social/favicon.png | link rel="icon" | 200 | image/png | 2881 |
| 6 | `nosmaps:to.iris` | https://iris.to | 200 | https://iris.to/favicon.svg | link rel="icon" (image/svg+xml) | 200 | image/svg+xml | 77977 |
| 7 | `nosmaps:app.nostter` | https://nostter.app | 200 | https://nostter.app/favicon.svg | link rel="icon" (image/svg+xml) | 200 | image/svg+xml | 1135 |
| 8 | `nosmaps:com.mikedilger.gossip` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 9 | `nosmaps:ninja.nostrudel` | https://nostrudel.ninja/ | 200 | https://nostrudel.ninja/favicon.ico | link rel="icon" (any) | 200 | image/vnd.microsoft.icon | 5238 |
| 10 | `nosmaps:net.syusui.rabbit` | https://rabbit.syusui.net | 200 | https://rabbit.syusui.net/images/rabbit_256.png | link rel="shortcut icon" (image/png) | 200 | image/png | 12842 |
| 11 | `nosmaps:com.0xchat` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 12 | `nosmaps:com.yakihonne.web` | https://yakihonne.com | 200 | https://yakihonne.com/icon-512x512.png | manifest icons (512x512) | 200 | image/png | 30160 |
| 13 | `nosmaps:com.pablof7z.olas` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 14 | `nosmaps:news.habla` | https://habla.news | 404 | None | None | None | None | None |
| 15 | `nosmaps:stream.zap` | https://zap.stream | 200 | https://zap.stream/logo_32.png | link rel="icon" (32x32) | 200 | image/png | 1002 |
| 16 | `nosmaps:pub.ditto` | https://ditto.pub | 200 | https://ditto.pub/logo.svg | link rel="icon" (image/svg+xml) | 200 | image/svg+xml | 6567 |
| 17 | `nosmaps:market.shopstr` | https://shopstr.market | 200 | https://shopstr.market/shopstr.ico | link rel="icon" | 200 | image/x-icon | 11404 |
| 18 | `nosmaps:com.greenart7c3.nostrsigner` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 19 | `nosmaps:com.fiatjaf.nos2x` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 20 | `nosmaps:app.nsec` | https://use.nsec.app | 200 | https://use.nsec.app/favicon.ico | link rel="icon" | 200 | image/vnd.microsoft.icon | 15406 |
| 21 | `nosmaps:com.getalby.extension` | https://getalby.com/#extension | 200 | https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg | link rel="icon" | 200 | image/svg+xml | 1239 |
| 22 | `nosmaps:me.njump.pokey` | https://njump.me/npub1h2685kkxa4q50qpexuae9geqep7frr0u8t8pcy9zj0xnza9phvtsn… | 200 | https://njump.me/njump/static/favicon/profile/favicon-32x32.png?v=2 | link rel="icon" (32x32) | 200 | image/png | 1216 |
| 23 | `nosmaps:com.hoytech.strfry` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 24 | `nosmaps:io.sourcehut.nostr-rs-relay` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 25 | `nosmaps:technology.nostr.khatru` | https://khatru.nostr.technology/ | 200 | https://khatru.nostr.technology/logo.png | link rel="icon" | 200 | image/png | 35338 |
| 26 | `nosmaps:com.cameri.nostream` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 27 | `nosmaps:me.nostrcheck.server` | https://nostrcheck.me/ | 200 | https://nostrcheck.me/favicon.ico | link rel="icon" | 200 | image/x-icon | 15406 |
| 28 | `nosmaps:com.bitvora.haven` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 29 | `nosmaps:com.hzrd149.blossom-server` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 30 | `nosmaps:com.hzrd149.blossom` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 31 | `nosmaps:build.nostr` | https://nostr.build/ | 200 | https://nostr.build/favicon-32x32.png | link rel="icon" (32x32) | 200 | image/png | 2716 |
| 32 | `nosmaps:cat.void` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 33 | `nosmaps:com.zeusln` | https://zeusln.com | 200 | https://zeusln.com/favicon.ico | link rel="icon" | 200 | image/x-icon | 14835 |
| 34 | `nosmaps:com.albyhub` | https://albyhub.com | 200 | https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg | link rel="icon" | 200 | image/svg+xml | 1239 |
| 35 | `nosmaps:com.mutinywallet.app` | https://app.mutinywallet.com | 200 | https://app.mutinywallet.com/favicon.ico | link rel="icon" | 200 | image/vnd.microsoft.icon | 15086 |
| 36 | `nosmaps:wtf.nbd.nostr-tools` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 37 | `nosmaps:dev.nostr.ndk` | https://nostr-dev-kit.github.io/ndk/ | 200 | None | None | None | None | None |
| 38 | `nosmaps:org.nostrdevkit` | https://nostrdevkit.org | 200 | https://nostrdevkit.org/assets/logo.svg | link rel="icon" (image/svg+xml) | 200 | image/svg+xml | 1027 |
| 39 | `nosmaps:com.fiatjaf.nak` | None (absent in data.js) | Not requested | None | None | None | None | None |
| 40 | `nosmaps:watch.nostr` | https://nostr.watch | 200 | https://nostr.watch/favicon-32x32.png | link rel="icon" (32x32) | 200 | image/png | 1881 |
| 41 | `nosmaps:dev.zapstore` | https://zapstore.dev | 200 | https://zapstore.dev/favicon.ico | link rel="icon" | 200 | image/x-icon | 15406 |

## Totals

- Entries in `data.js`: **41**
- Entries with a homepage: **27** (the other **14** have `homepage: null` — not requested)
- Homepages that yielded at least one **verified image**: **25**
- Homepages that yielded **nothing**: **2**

**Entries that would need the initial-letter placeholder: 16 of 41.**
That is 14 with no homepage at all plus 2 whose homepage yielded no usable icon.

### Where nothing was yielded

- `nosmaps:news.habla` — homepage returned HTTP 404 — nothing read
- `nosmaps:dev.nostr.ndk` — HTTP 200 but the markup declares no icon of any kind

## Notes observed during the run (carry these into the fix slice)

- **`nosmaps:io.damus`** — damus.io is a Next.js page whose server-rendered markup declares no
  `<link rel="icon">` at all (verified by grepping the fetched HTML for `<link ... rel=...>`: only
  two stylesheet/preload links). The only icon it declares is `og:image` →
  `https://damus.io/logo_icon.png`, 146,861 bytes. That is a social-card image, not a favicon.
- **`nosmaps:com.getalby.extension` and `nosmaps:com.albyhub`** — both pages (Framer-hosted) declare
  the *same* icon URL, `https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg`. Two
  entries would end up sharing one icon URL on a third-party CDN host.
- **`nosmaps:me.njump.pokey`** — the recorded homepage is an njump *profile* page, so the icon
  discovered is njump's own favicon, not Pokey's.
- Five favicons came back at suspiciously equal byte counts (15,406 B ×3 and 15,086 B ×2). I hashed
  all five: `use.nsec.app` 3a6d7278…, `nostrcheck.me` f48a25d6…, `zapstore.dev` 45b49326…,
  `primal.net` 85332ee3…, `app.mutinywallet.com` 5ecc4cec… — all distinct. Equal sizes, different
  images; the `.ico` container just lands on the same size.
- **Declared ≠ served.** `zeusln.com`'s manifest declares `logo192.png` / `logo512.png`; both return
  HTTP 200 with `text/html` (the SPA catch-all), so neither is an image. `app.coracle.social`
  declares six icon paths that 404. This is why every URL was requested rather than trusted.
- **`nosmaps:news.habla`** — `https://habla.news/` itself answers 404 (confirmed twice, with two
  different user agents; curl saw `404 text/plain 107 bytes`). The recorded homepage is currently
  dead, which is a data finding beyond icons.

## Appendix — every candidate observed

Failures are kept in the table on purpose: several sites declare icon paths that 404 or that a
SPA catch-all answers with HTML, which is exactly why each URL had to be requested rather than
trusted from the markup.

### `nosmaps:io.damus` — Damus

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://damus.io/logo_icon.png | meta og:image | — | 200 | image/png | 146861 | yes |

### `nosmaps:social.amethyst` — Amethyst

Manifest: https://amethyst.social/manifest.webmanifest — 200, application/octet-stream, 443 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://amethyst.social/amethyst-logo.jpg | link rel="icon" | image/jpeg | 200 | image/jpeg | 7694 | yes |
| https://amethyst.social/amethyst-logo.svg | manifest icons | any | 200 | image/svg+xml | 1394 | yes |
| https://amethyst-social.shakespeare.wtf/amethyst-hero.webp | meta og:image | — | 200 | image/webp | 135506 | yes |

### `nosmaps:net.primal.web` — Primal Web App

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://primal.net/assets/favicon-85332ee3.ico | link rel="icon" | image/ico | 200 | image/vnd.microsoft.icon | 15086 | yes |
| data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIW… | link rel="icon" | 32x32 | 200 | image/png | 1577 | yes |
| data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIW… | link rel="icon" | 16x16 | 200 | image/png | 692 | yes |
| https://primal.net/assets/apple-touch-icon-a536f430.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 6784 | yes |
| https://primal.net/assets/safari-pinned-tab-02640d32.svg | link rel="mask-icon" | — | 200 | image/svg+xml | 1237 | yes |
| https://primal.net/public/primal-link-preview.jpg | meta og:image | — | 200 | image/jpeg | 154419 | yes |
| https://primal.net/images/twitter-hero.jpg | meta twitter:image | — | 200 | image/jpeg | 437354 | yes |

### `nosmaps:social.coracle` — Coracle

Manifest: https://app.coracle.social/manifest.webmanifest — 200, binary/octet-stream, 668 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://app.coracle.social/icons/favicon.ico | link rel="icon" | 48x48 | 200 | image/vnd.microsoft.icon | 33310 | yes |
| https://app.coracle.social/icons/favicon-16x16.png | link rel="icon" | any | 200 | image/png | 622 | yes |
| https://app.coracle.social/icons/favicon-32x32.png | link rel="icon" | any | 200 | image/png | 1693 | yes |
| https://app.coracle.social/icons/favicon-48x48.png | link rel="icon" | any | 200 | image/png | 3071 | yes |
| https://app.coracle.social/icons/android-icon-192x192.png | link rel="icon" | 192x192 | 404 | text/plain; charset=utf-8 | 10 | no |
| https://app.coracle.social/icons/favicon-96x96.png | link rel="icon" | 96x96 | 404 | text/plain; charset=utf-8 | 10 | no |
| https://app.coracle.social/icons/android-chrome-144x144.png | link rel="icon" | 144x144 | 200 | image/png | 13754 | yes |
| https://app.coracle.social/icons/android-chrome-192x192.png | link rel="icon" | 192x192 | 200 | image/png | 21106 | yes |
| https://app.coracle.social/icons/android-chrome-256x256.png | link rel="icon" | 256x256 | 200 | image/png | 32586 | yes |
| https://app.coracle.social/icons/android-chrome-36x36.png | link rel="icon" | 36x36 | 200 | image/png | 2114 | yes |
| https://app.coracle.social/icons/android-chrome-384x384.png | link rel="icon" | 384x384 | 200 | image/png | 63982 | yes |
| https://app.coracle.social/icons/android-chrome-48x48.png | link rel="icon" | 48x48 | 200 | image/png | 3226 | yes |
| https://app.coracle.social/icons/android-chrome-512x512.png | link rel="icon" | 512x512 | 200 | image/png | 102145 | yes |
| https://app.coracle.social/icons/android-chrome-72x72.png | link rel="icon" | 72x72 | 200 | image/png | 5725 | yes |
| https://app.coracle.social/icons/android-chrome-96x96.png | link rel="icon" | 96x96 | 200 | image/png | 8318 | yes |
| https://app.coracle.social/images/pwa-64x64.png | manifest icons | 64x64 | 200 | image/png | 1322 | yes |
| https://app.coracle.social/images/pwa-192x192.png | manifest icons | 192x192 | 200 | image/png | 3842 | yes |
| https://app.coracle.social/images/pwa-512x512.png | manifest icons | 512x512 | 200 | image/png | 12851 | yes |
| https://app.coracle.social/images/maskable-icon-512x512.png | manifest icons | 512x512 | 200 | image/png | 6767 | yes |
| https://app.coracle.social/icons/apple-touch-icon-57x57.png | link rel="apple-touch-icon" | 57x57 | 200 | image/png | 3604 | yes |
| https://app.coracle.social/icons/apple-touch-icon-60x60.png | link rel="apple-touch-icon" | 60x60 | 200 | image/png | 3871 | yes |
| https://app.coracle.social/icons/apple-touch-icon-72x72.png | link rel="apple-touch-icon" | 72x72 | 200 | image/png | 5004 | yes |
| https://app.coracle.social/icons/apple-touch-icon-76x76.png | link rel="apple-touch-icon" | 76x76 | 200 | image/png | 5320 | yes |
| https://app.coracle.social/icons/apple-touch-icon-114x114.png | link rel="apple-touch-icon" | 114x114 | 200 | image/png | 8781 | yes |
| https://app.coracle.social/icons/apple-touch-icon-120x120.png | link rel="apple-touch-icon" | 120x120 | 200 | image/png | 9517 | yes |
| https://app.coracle.social/icons/apple-touch-icon-144x144.png | link rel="apple-touch-icon" | 144x144 | 200 | image/png | 12120 | yes |
| https://app.coracle.social/icons/apple-touch-icon-152x152.png | link rel="apple-touch-icon" | 152x152 | 200 | image/png | 12840 | yes |
| https://app.coracle.social/icons/apple-touch-icon-180x180.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 15944 | yes |
| https://app.coracle.social/images/logo.svg | link rel="mask-icon" | — | 200 | text/html; charset=utf-8 | 4146 | no |
| https://app.coracle.social/icons/mstile-144x144.png | meta msapplication-TileImage | — | 200 | image/png | 13754 | yes |
| https://app.coracle.social/images/banner.png | meta og:image | — | 200 | image/png | 925285 | yes |

### `nosmaps:social.phoenix` — Snort

Manifest: https://phoenix.social/manifest.webmanifest — 200, application/manifest+json, 164 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://phoenix.social/favicon.png | link rel="icon" | — | 200 | image/png | 2881 | yes |
| https://phoenix.social/img/apple-touch-icon.png | link rel="apple-touch-icon" | — | 200 | image/png | 44820 | yes |
| https://snort.social/nostrich_512.png | meta og:image | — | 200 | image/png | 540613 | yes |

### `nosmaps:to.iris` — Iris

Manifest: https://iris.to/manifest.json — 200, application/json, 893 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://iris.to/favicon.svg | link rel="icon" | image/svg+xml | 200 | image/svg+xml | 77977 | yes |
| https://iris.to/img/android-chrome-192x192.png | manifest icons | 192x192 | 200 | image/png | 23510 | yes |
| https://iris.to/img/android-chrome-512x512.png | manifest icons | 512x512 | 200 | image/png | 49988 | yes |
| https://iris.to/img/maskable_icon.png | manifest icons | 640x640 | 200 | image/png | 135648 | yes |
| https://iris.to/img/maskable_icon_x192.png | manifest icons | 192x192 | 200 | image/png | 19874 | yes |
| https://iris.to/img/apple-touch-icon.png | link rel="apple-touch-icon" | — | 200 | image/png | 17925 | yes |

### `nosmaps:app.nostter` — nostter

Manifest: https://nostter.app/manifest.webmanifest — 200, application/manifest+json, 708 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostter.app/favicon.svg | link rel="icon" | image/svg+xml | 200 | image/svg+xml | 1135 | yes |
| https://nostter.app/icon.192.png | manifest icons | 192x192 | 200 | image/png | 5618 | yes |
| https://nostter.app/icon.512.png | manifest icons | 512x512 | 200 | image/png | 16735 | yes |
| https://nostter.app/apple-touch-icon.png | link rel="apple-touch-icon" | — | 200 | image/png | 5264 | yes |
| https://nostter.app/logo.png | meta og:image | — | 200 | image/png | 15490 | yes |

### `nosmaps:ninja.nostrudel` — noStrudel

Manifest: https://nostrudel.ninja/manifest.webmanifest — 200, application/manifest+json; charset=utf-8, 742 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostrudel.ninja/favicon.ico | link rel="icon" | any | 200 | image/vnd.microsoft.icon | 5238 | yes |
| https://nostrudel.ninja/logo.svg | link rel="icon" | any | 200 | image/svg+xml | 17904 | yes |
| https://nostrudel.ninja/icon-192.png | manifest icons | 192x192 | 200 | image/png | 17914 | yes |
| https://nostrudel.ninja/icon-512.png | manifest icons | 512x512 | 200 | image/png | 56868 | yes |
| https://nostrudel.ninja/icon-192-maskable.png | manifest icons | 192x192 | 200 | image/png | 15161 | yes |
| https://nostrudel.ninja/icon-512-maskable.png | manifest icons | 512x512 | 200 | image/png | 47246 | yes |
| https://nostrudel.ninja/apple-touch-icon.png | link rel="apple-touch-icon" | — | 200 | image/png | 14167 | yes |
| https://repository-images.githubusercontent.com/581644549/d5eec580-ba3d-41e… | meta og:image | — | 200 | image/jpeg | 6446 | yes |

### `nosmaps:net.syusui.rabbit` — Rabbit

Manifest: https://rabbit.syusui.net/manifest.json — 200, application/json; charset=utf-8, 476 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://rabbit.syusui.net/images/rabbit_256.png | link rel="shortcut icon" | image/png | 200 | image/png | 12842 | yes |
| https://rabbit.syusui.net/images/rabbit_app_256.png | manifest icons | 256x256 | 200 | image/png | 12152 | yes |
| https://rabbit.syusui.net/images/rabbit_app_1280.png | manifest icons | 1280x1280 | 200 | image/png | 69491 | yes |

### `nosmaps:com.yakihonne.web` — YakiHonne Web App

Manifest: https://yakihonne.com/manifest.json — 200, application/json; charset=UTF-8, 292 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://yakihonne.com/icon-512x512.png | manifest icons | 512x512 | 200 | image/png | 30160 | yes |
| https://yakihonne.s3.ap-east-1.amazonaws.com/media/images/thumbnail.png | meta og:image | — | 200 | image/png | 576366 | yes |

### `nosmaps:stream.zap` — zap.stream

Manifest: https://zap.stream/manifest.webmanifest — 200, application/manifest+json, 162 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://zap.stream/logo_32.png | link rel="icon" | 32x32 | 200 | image/png | 1002 | yes |
| https://zap.stream/logo.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 9196 | yes |

### `nosmaps:pub.ditto` — Ditto

Manifest: https://ditto.pub/manifest.webmanifest — 200, , 3138 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://ditto.pub/logo.svg | link rel="icon" | image/svg+xml | 200 | image/svg+xml | 6567 | yes |
| https://ditto.pub/icon-192.png | manifest icons | 192x192 | 200 | image/png | 4552 | yes |
| https://ditto.pub/icon-512.png | manifest icons | 512x512 | 200 | image/png | 26638 | yes |
| https://ditto.pub/apple-touch-icon.png | link rel="apple-touch-icon" | — | 200 | image/png | 5227 | yes |
| https://ditto.pub/og-image.jpg | meta og:image | — | 200 | image/jpeg | 111543 | yes |

### `nosmaps:market.shopstr` — Shopstr

Manifest: https://shopstr.market/manifest.json — 200, application/json; charset=UTF-8, 2882 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://shopstr.market/shopstr.ico | link rel="icon" | — | 200 | image/x-icon | 11404 | yes |
| https://shopstr.market/shopstr-144x144.png | manifest icons | 144x144 | 200 | image/png | 8708 | yes |
| https://shopstr.market/shopstr-512x512.png | manifest icons | 512x512 | 200 | image/png | 35848 | yes |
| https://shopstr.market/shopstr-2000x2000.png | manifest icons | 2000x2000 | 200 | image/png | 107989 | yes |

### `nosmaps:app.nsec` — nsec.app (noauth)

Manifest: https://use.nsec.app/manifest.json — 200, application/json; charset=utf-8, 424 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://use.nsec.app/favicon.ico | link rel="icon" | — | 200 | image/vnd.microsoft.icon | 15406 | yes |
| https://use.nsec.app/favicon-32x32.png | link rel="icon" | 32x32 | 200 | image/png | 1182 | yes |
| https://use.nsec.app/favicon-16x16.png | link rel="icon" | 16x16 | 200 | image/png | 536 | yes |
| https://use.nsec.app/android-chrome-192x192.png | manifest icons | 192x192 | 200 | image/png | 13687 | yes |
| https://use.nsec.app/android-chrome-512x512.png | manifest icons | 512x512 | 200 | image/png | 45922 | yes |
| https://use.nsec.app/apple-touch-icon.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 12338 | yes |

### `nosmaps:com.getalby.extension` — Alby Browser Extension

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg | link rel="icon" | — | 200 | image/svg+xml | 1239 | yes |
| https://framerusercontent.com/images/LFziDM4n79CY8uZICOkGWeiDqK0.svg | link rel="icon" | — | 200 | image/svg+xml | 1239 | yes |
| https://framerusercontent.com/images/0OrJGU3TzgwX3Nmd1GAXaJdXEDw.png | link rel="apple-touch-icon" | — | 200 | image/png | 2091 | yes |
| https://framerusercontent.com/assets/Czpsh1ZiXyAltZCVDztU4AS6BB0.png | meta og:image | — | 200 | image/png | 235165 | yes |

### `nosmaps:me.njump.pokey` — Pokey

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://njump.me/njump/static/favicon/profile/favicon-32x32.png?v=2 | link rel="icon" | 32x32 | 200 | image/png | 1216 | yes |
| https://njump.me/njump/static/favicon/profile/favicon-16x16.png?v=2 | link rel="icon" | 16x16 | 200 | image/png | 848 | yes |
| https://njump.me/njump/static/favicon/profile/apple-touch-icon.png?v=2 | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 5033 | yes |
| https://raw.githubusercontent.com/KoalaSat/pokey/refs/heads/main/app/src/ma… | meta og:image | — | 200 | image/png | 32130 | yes |

### `nosmaps:technology.nostr.khatru` — khatru

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://khatru.nostr.technology/logo.png | link rel="icon" | — | 200 | image/png | 35338 | yes |

### `nosmaps:me.nostrcheck.server` — Nostrcheck server

Manifest: https://nostrcheck.me/site.webmanifest — 200, application/octet-stream, 406 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostrcheck.me/favicon.ico | link rel="icon" | — | 200 | image/x-icon | 15406 | yes |
| https://nostrcheck.me/favicon-32x32.png | link rel="icon" | 32x32 | 200 | image/png | 1190 | yes |
| https://nostrcheck.me/favicon-16x16.png | link rel="icon" | 16x16 | 200 | image/png | 564 | yes |
| https://nostrcheck.me/android-chrome-192x192.png | manifest icons | 192x192 | 200 | image/png | 14652 | yes |
| https://nostrcheck.me/android-chrome-512x512.png | manifest icons | 512x512 | 200 | image/png | 70112 | yes |
| https://nostrcheck.me/apple-touch-icon.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 13411 | yes |
| https://nostrcheck.me/static/resources/logo-server.webp | meta og:image | — | 200 | image/webp | 32674 | yes |

### `nosmaps:build.nostr` — nostr.build

Manifest: https://nostr.build/site.webmanifest — 200, application/octet-stream, 463 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostr.build/favicon-32x32.png | link rel="icon" | 32x32 | 200 | image/png | 2716 | yes |
| https://nostr.build/favicon-16x16.png | link rel="icon" | 16x16 | 200 | image/png | 1458 | yes |
| https://nostr.build/android-chrome-192x192.png | manifest icons | 192x192 | 200 | image/png | 20541 | yes |
| https://nostr.build/android-chrome-256x256.png | manifest icons | 256x256 | 200 | image/png | 30661 | yes |
| https://nostr.build/apple-touch-icon.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 13312 | yes |
| https://nostr.build/safari-pinned-tab.svg | link rel="mask-icon" | — | 200 | image/svg+xml | 2411 | yes |

### `nosmaps:com.zeusln` — Zeus

Manifest: https://zeusln.com/manifest.json — 200, application/json, 586 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://zeusln.com/favicon.ico | link rel="icon" | — | 200 | image/x-icon | 14835 | yes |
| https://zeusln.com/logo192.png | manifest icons | 192x192 | 200 | text/html | 1807 | no |
| https://zeusln.com/logo512.png | manifest icons | 512x512 | 200 | text/html | 1807 | no |
| https://zeusln.com/preview.jpg | meta og:image | — | 200 | image/jpeg | 163667 | yes |

### `nosmaps:com.albyhub` — Alby Hub

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://framerusercontent.com/images/M1y26zs7Y5u5rQ1fy2kVJB5U.svg | link rel="icon" | — | 200 | image/svg+xml | 1239 | yes |
| https://framerusercontent.com/images/LFziDM4n79CY8uZICOkGWeiDqK0.svg | link rel="icon" | — | 200 | image/svg+xml | 1239 | yes |
| https://framerusercontent.com/images/0OrJGU3TzgwX3Nmd1GAXaJdXEDw.png | link rel="apple-touch-icon" | — | 200 | image/png | 2091 | yes |
| https://framerusercontent.com/assets/2Nee6wcbe4YexAsSKby2TuYzDsw.png | meta og:image | — | 200 | image/png | 179783 | yes |

### `nosmaps:com.mutinywallet.app` — Mutiny Wallet

Manifest: https://app.mutinywallet.com/manifest.webmanifest — 200, application/manifest+json, 8375 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://app.mutinywallet.com/favicon.ico | link rel="icon" | — | 200 | image/vnd.microsoft.icon | 15086 | yes |
| https://app.mutinywallet.com/192.png | manifest icons | 192x192 | 200 | image/png | 3325 | yes |
| https://app.mutinywallet.com/512.png | manifest icons | 512x512 | 200 | image/png | 65833 | yes |
| https://app.mutinywallet.com/maskable_icon.png | manifest icons | 512x512 | 200 | image/png | 10006 | yes |
| https://app.mutinywallet.com/windows11/SmallTile.scale-100.png | manifest icons | 71x71 | 200 | image/png | 2828 | yes |
| https://app.mutinywallet.com/windows11/SmallTile.scale-125.png | manifest icons | 89x89 | 200 | image/png | 3438 | yes |
| https://app.mutinywallet.com/windows11/SmallTile.scale-150.png | manifest icons | 107x107 | 200 | image/png | 4538 | yes |
| https://app.mutinywallet.com/windows11/SmallTile.scale-200.png | manifest icons | 142x142 | 200 | image/png | 7690 | yes |
| https://app.mutinywallet.com/windows11/SmallTile.scale-400.png | manifest icons | 284x284 | 200 | image/png | 19994 | yes |
| https://app.mutinywallet.com/windows11/Square150x150Logo.scale-100.png | manifest icons | 150x150 | 200 | image/png | 6967 | yes |
| https://app.mutinywallet.com/windows11/Square150x150Logo.scale-125.png | manifest icons | 188x188 | 200 | image/png | 9293 | yes |
| https://app.mutinywallet.com/windows11/Square150x150Logo.scale-150.png | manifest icons | 225x225 | 200 | image/png | 11599 | yes |
| https://app.mutinywallet.com/windows11/Square150x150Logo.scale-200.png | manifest icons | 300x300 | 200 | image/png | 26150 | yes |
| https://app.mutinywallet.com/windows11/Square150x150Logo.scale-400.png | manifest icons | 600x600 | 200 | image/png | 80181 | yes |
| https://app.mutinywallet.com/windows11/Wide310x150Logo.scale-100.png | manifest icons | 310x150 | 200 | image/png | 7578 | yes |
| https://app.mutinywallet.com/windows11/Wide310x150Logo.scale-125.png | manifest icons | 388x188 | 200 | image/png | 10048 | yes |
| https://app.mutinywallet.com/windows11/Wide310x150Logo.scale-150.png | manifest icons | 465x225 | 200 | image/png | 12509 | yes |
| https://app.mutinywallet.com/windows11/Wide310x150Logo.scale-200.png | manifest icons | 620x300 | 200 | image/png | 28000 | yes |
| https://app.mutinywallet.com/windows11/Wide310x150Logo.scale-400.png | manifest icons | 1240x600 | 200 | image/png | 86315 | yes |
| https://app.mutinywallet.com/windows11/LargeTile.scale-100.png | manifest icons | 310x310 | 200 | image/png | 18182 | yes |
| https://app.mutinywallet.com/windows11/LargeTile.scale-125.png | manifest icons | 388x388 | 200 | image/png | 36449 | yes |
| https://app.mutinywallet.com/windows11/LargeTile.scale-150.png | manifest icons | 465x465 | 200 | image/png | 38940 | yes |
| https://app.mutinywallet.com/windows11/LargeTile.scale-200.png | manifest icons | 620x620 | 200 | image/png | 110282 | yes |
| https://app.mutinywallet.com/windows11/LargeTile.scale-400.png | manifest icons | 1240x1240 | 200 | image/png | 230237 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.scale-100.png | manifest icons | 44x44 | 200 | image/png | 1717 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.scale-125.png | manifest icons | 55x55 | 200 | image/png | 2650 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.scale-150.png | manifest icons | 66x66 | 200 | image/png | 3307 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.scale-200.png | manifest icons | 88x88 | 200 | image/png | 4105 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.scale-400.png | manifest icons | 176x176 | 200 | image/png | 9898 | yes |
| https://app.mutinywallet.com/windows11/StoreLogo.scale-100.png | manifest icons | 50x50 | 200 | image/png | 1819 | yes |
| https://app.mutinywallet.com/windows11/StoreLogo.scale-125.png | manifest icons | 63x63 | 200 | image/png | 2441 | yes |
| https://app.mutinywallet.com/windows11/StoreLogo.scale-150.png | manifest icons | 75x75 | 200 | image/png | 2995 | yes |
| https://app.mutinywallet.com/windows11/StoreLogo.scale-200.png | manifest icons | 100x100 | 200 | image/png | 4604 | yes |
| https://app.mutinywallet.com/windows11/StoreLogo.scale-400.png | manifest icons | 200x200 | 200 | image/png | 11577 | yes |
| https://app.mutinywallet.com/windows11/SplashScreen.scale-100.png | manifest icons | 620x300 | 200 | image/png | 28000 | yes |
| https://app.mutinywallet.com/windows11/SplashScreen.scale-125.png | manifest icons | 775x375 | 200 | image/png | 46272 | yes |
| https://app.mutinywallet.com/windows11/SplashScreen.scale-150.png | manifest icons | 930x450 | 200 | image/png | 70207 | yes |
| https://app.mutinywallet.com/windows11/SplashScreen.scale-200.png | manifest icons | 1240x600 | 200 | image/png | 86315 | yes |
| https://app.mutinywallet.com/windows11/SplashScreen.scale-400.png | manifest icons | 2480x1200 | 200 | image/png | 172953 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-16.png | manifest icons | 16x16 | 200 | image/png | 584 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-20.png | manifest icons | 20x20 | 200 | image/png | 737 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-24.png | manifest icons | 24x24 | 200 | image/png | 916 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-30.png | manifest icons | 30x30 | 200 | image/png | 1109 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-32.png | manifest icons | 32x32 | 200 | image/png | 1240 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-36.png | manifest icons | 36x36 | 200 | image/png | 1456 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-40.png | manifest icons | 40x40 | 200 | image/png | 1630 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-44.png | manifest icons | 44x44 | 200 | image/png | 1717 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-48.png | manifest icons | 48x48 | 200 | image/png | 1983 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-60.png | manifest icons | 60x60 | 200 | image/png | 2585 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-64.png | manifest icons | 64x64 | 200 | image/png | 2847 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-72.png | manifest icons | 72x72 | 200 | image/png | 3197 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-80.png | manifest icons | 80x80 | 200 | image/png | 3688 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-96.png | manifest icons | 96x96 | 200 | image/png | 4520 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.targetsize-256.png | manifest icons | 256x256 | 200 | image/png | 16192 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 16x16 | 200 | image/png | 584 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 20x20 | 200 | image/png | 737 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 24x24 | 200 | image/png | 916 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 30x30 | 200 | image/png | 1109 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 32x32 | 200 | image/png | 1240 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 36x36 | 200 | image/png | 1456 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 40x40 | 200 | image/png | 1630 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 44x44 | 200 | image/png | 1717 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 48x48 | 200 | image/png | 1983 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 60x60 | 200 | image/png | 2585 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 64x64 | 200 | image/png | 2847 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 72x72 | 200 | image/png | 3197 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 80x80 | 200 | image/png | 3688 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 96x96 | 200 | image/png | 4520 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-unplated_tar… | manifest icons | 256x256 | 200 | image/png | 16192 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 16x16 | 200 | image/png | 584 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 20x20 | 200 | image/png | 737 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 24x24 | 200 | image/png | 916 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 30x30 | 200 | image/png | 1109 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 32x32 | 200 | image/png | 1240 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 36x36 | 200 | image/png | 1456 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 40x40 | 200 | image/png | 1630 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 44x44 | 200 | image/png | 1717 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 48x48 | 200 | image/png | 1983 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 60x60 | 200 | image/png | 2585 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 64x64 | 200 | image/png | 2847 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 72x72 | 200 | image/png | 3197 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 80x80 | 200 | image/png | 3688 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 96x96 | 200 | image/png | 4520 | yes |
| https://app.mutinywallet.com/windows11/Square44x44Logo.altform-lightunplate… | manifest icons | 256x256 | 200 | image/png | 16192 | yes |
| https://app.mutinywallet.com/android/android-launchericon-512-512.png | manifest icons | 512x512 | 200 | image/png | 45227 | yes |
| https://app.mutinywallet.com/android/android-launchericon-192-192.png | manifest icons | 192x192 | 200 | image/png | 9525 | yes |
| https://app.mutinywallet.com/android/android-launchericon-144-144.png | manifest icons | 144x144 | 200 | image/png | 7955 | yes |
| https://app.mutinywallet.com/android/android-launchericon-96-96.png | manifest icons | 96x96 | 200 | image/png | 4290 | yes |
| https://app.mutinywallet.com/android/android-launchericon-72-72.png | manifest icons | 72x72 | 200 | image/png | 2836 | yes |
| https://app.mutinywallet.com/android/android-launchericon-48-48.png | manifest icons | 48x48 | 200 | image/png | 1796 | yes |
| https://app.mutinywallet.com/ios/16.png | manifest icons | 16x16 | 200 | image/png | 558 | yes |
| https://app.mutinywallet.com/ios/20.png | manifest icons | 20x20 | 200 | image/png | 669 | yes |
| https://app.mutinywallet.com/ios/29.png | manifest icons | 29x29 | 200 | image/png | 1016 | yes |
| https://app.mutinywallet.com/ios/32.png | manifest icons | 32x32 | 200 | image/png | 1115 | yes |
| https://app.mutinywallet.com/ios/40.png | manifest icons | 40x40 | 200 | image/png | 1361 | yes |
| https://app.mutinywallet.com/ios/50.png | manifest icons | 50x50 | 200 | image/png | 1819 | yes |
| https://app.mutinywallet.com/ios/57.png | manifest icons | 57x57 | 200 | image/png | 2274 | yes |
| https://app.mutinywallet.com/ios/58.png | manifest icons | 58x58 | 200 | image/png | 2299 | yes |
| https://app.mutinywallet.com/ios/60.png | manifest icons | 60x60 | 200 | image/png | 2262 | yes |
| https://app.mutinywallet.com/ios/64.png | manifest icons | 64x64 | 200 | image/png | 2774 | yes |
| https://app.mutinywallet.com/ios/72.png | manifest icons | 72x72 | 200 | image/png | 2836 | yes |
| https://app.mutinywallet.com/ios/76.png | manifest icons | 76x76 | 200 | image/png | 3133 | yes |
| https://app.mutinywallet.com/ios/80.png | manifest icons | 80x80 | 200 | image/png | 3114 | yes |
| https://app.mutinywallet.com/ios/87.png | manifest icons | 87x87 | 200 | image/png | 3788 | yes |
| https://app.mutinywallet.com/ios/100.png | manifest icons | 100x100 | 200 | image/png | 4604 | yes |
| https://app.mutinywallet.com/ios/114.png | manifest icons | 114x114 | 200 | image/png | 5517 | yes |
| https://app.mutinywallet.com/ios/120.png | manifest icons | 120x120 | 200 | image/png | 5542 | yes |
| https://app.mutinywallet.com/ios/128.png | manifest icons | 128x128 | 200 | image/png | 6641 | yes |
| https://app.mutinywallet.com/ios/144.png | manifest icons | 144x144 | 200 | image/png | 7955 | yes |
| https://app.mutinywallet.com/ios/152.png | manifest icons | 152x152 | 200 | image/png | 7972 | yes |
| https://app.mutinywallet.com/ios/167.png | manifest icons | 167x167 | 200 | image/png | 9093 | yes |
| https://app.mutinywallet.com/ios/180.png | manifest icons | 180x180 | 200 | image/png | 10810 | yes |
| https://app.mutinywallet.com/ios/192.png | manifest icons | 192x192 | 200 | image/png | 9525 | yes |
| https://app.mutinywallet.com/ios/256.png | manifest icons | 256x256 | 200 | image/png | 16749 | yes |
| https://app.mutinywallet.com/ios/512.png | manifest icons | 512x512 | 200 | image/png | 45227 | yes |
| https://app.mutinywallet.com/ios/1024.png | manifest icons | 1024x1024 | 200 | image/png | 231945 | yes |
| https://app.mutinywallet.com/images/icon.png | link rel="apple-touch-icon" | 512x512 | 200 | image/png | 71177 | yes |
| https://app.mutinywallet.com/mutiny_logo_mask.svg | link rel="mask-icon" | — | 200 | image/svg+xml | 582 | yes |
| https://app.mutinywallet.com/images/twitter_card_image.png | meta og:image | — | 200 | image/png | 414490 | yes |

### `nosmaps:org.nostrdevkit` — rust-nostr

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostrdevkit.org/assets/logo.svg | link rel="icon" | image/svg+xml | 200 | image/svg+xml | 1027 | yes |
| https://nostrdevkit.org/assets/social-preview.png | meta og:image | — | 200 | image/png | 255521 | yes |

### `nosmaps:watch.nostr` — nostr.watch

Manifest: https://nostr.watch/site.webmanifest — 200, application/octet-stream, 263 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://nostr.watch/favicon-32x32.png | link rel="icon" | 32x32 | 200 | image/png | 1881 | yes |
| https://nostr.watch/favicon-16x16.png | link rel="icon" | 16x16 | 200 | image/png | 782 | yes |
| https://nostr.watch/favicon.ico | link rel="icon" | — | 200 | image/x-icon | 15406 | yes |
| https://nostr.watch/android-chrome-192x192.png | manifest icons | 192x192 | 200 | image/png | 19501 | yes |
| https://nostr.watch/android-chrome-512x512.png | manifest icons | 512x512 | 200 | image/png | 66276 | yes |
| https://nostr.watch/apple-touch-icon.png | link rel="apple-touch-icon" | 180x180 | 200 | image/png | 17516 | yes |

### `nosmaps:dev.zapstore` — Zapstore

Manifest: https://zapstore.dev/manifest.json — 200, application/json, 315 bytes

| candidate URL | markup source | declared | HTTP | content-type | bytes | image? |
|---|---|---|---|---|---|---|
| https://zapstore.dev/favicon.ico | link rel="icon" | — | 200 | image/x-icon | 15406 | yes |
| https://zapstore.dev/images/og-landing.png | meta og:image | — | 200 | image/png | 555666 | yes |

