/* Third-party hosts are not part of what this suite tests, but the suite was depending on them.

   The entries in data.js carry real icon URLs on ~25 real hosts (github.com and the rest). Every
   page under test therefore fired ~25 requests at the open internet, and several specs end with
   `expect(errors).toEqual([])`. When one of those hosts rate-limited or refused a request, the
   browser logged `Failed to load resource: the server responded with a status of 403 ()` and specs
   that have nothing to do with icons went red. Measured, not guessed: running
   review-local-image.spec.js + support-mode-unstated.spec.js alone on webkit produced 6 failures,
   and a bare probe of nip-explorer.html on webkit logged exactly one 403 console error with no
   `response`/`requestfailed` event of its own.

   So: serve those image requests locally. The URL is untouched -- the request still goes out at the
   exact recorded URL, and every assertion about *which* URL an icon uses reads the same `src` it
   read before. Only the bytes come from here instead of from a stranger's server.

   WHAT THIS DELIBERATELY DOES NOT FIX -- and why entry-icon.spec.js must not call this.

   With any route registered, a request whose filename is exactly `favicon.ico` is never delivered
   to the handler and fails instead. Verified here against both engines with a two-image page:

     no route   -> favicon.ico complete=true naturalWidth=32   (loads)
     with route -> favicon.ico complete=true naturalWidth=0    (fails, handler never called)

   and in both cases Playwright emits no `request` event for it at all, so it cannot be intercepted,
   only avoided. Seven of the recorded icon URLs are exactly `favicon.ico`. Under this stub those
   seven fall back to the placeholder, which is silent (no console error, no pageerror) and so does
   not disturb the specs that only care that the page is quiet.

   It would very much disturb entry-icon.spec.js, whose whole subject is which box each entry
   renders: those seven entries carry a URL and must render an <img>, and under this stub they would
   render the placeholder. That spec keeps its own arrangement -- no stub for the tests that read the
   boxes, and its own `route.abort()` for the one test that wants icons to fail on purpose. */

/* A 1x1 opaque PNG. Content-Type is what a browser sniffs an <img> by, so this answers a `.svg` or
   `.ico` URL just as well as a `.png` one; the recorded URL's extension is irrelevant to the load. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

/* The site under test is served by playwright.config.js's webServer on 127.0.0.1:4173. Anything
   else is somebody else's machine. */
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** @param {URL} url */
function isLocal(url) {
  return LOCAL_HOSTNAMES.has(url.hostname);
}

/**
 * Make every off-origin request answered locally, so no test result depends on a remote server.
 *
 * Off-origin images are fulfilled with a real 1x1 PNG. Anything else off-origin is aborted rather
 * than quietly allowed out: the pages under test request nothing but images from other hosts (probed
 * on index.html and nip-explorer.html: 25 requests, all resourceType `image`), so an abort here is
 * unreachable today and is a loud, deterministic failure rather than a silent network dependency if
 * that ever stops being true.
 *
 * Call it before the first `goto`. Accepts a Page or a BrowserContext -- both expose `route`.
 *
 * @param {import('@playwright/test').Page | import('@playwright/test').BrowserContext} target
 */
async function stubExternalImages(target) {
  await target.route(url => !isLocal(url), route => {
    if (route.request().resourceType() === 'image') {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: {'cache-control': 'no-store'},
        body: PIXEL_PNG
      });
    }
    return route.abort('blockedbyclient');
  });
}

module.exports = {stubExternalImages, PIXEL_PNG};
