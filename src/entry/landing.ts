/* Entry point for index.html.

   Per-page wiring only: it reads the generated catalogue, mounts the landing
   carousel and the shared footer, and does nothing else. Bundled by esbuild into
   dist/landing.js, which is the only script index.html loads. */

import {readCatalogueData} from '../data/catalogue-data.ts';
import {i18n} from '../ui/i18n.ts';
import {mountLanding} from '../ui/carousel.ts';
import {mountSiteFooter} from '../ui/site-footer.ts';

/* The missing-key reporting contract is observable on purpose: i18n-integrity
   asserts that a lookup which resolves to nothing is *reported* rather than
   rendered as "undefined". Bundling the module made that surface unreachable
   from the page, so the entry publishes it explicitly. It is a diagnostic
   surface, not an import path — nothing inside src/ reads it back. */
declare global {
  interface Window {
    NOSMAPS_I18N: typeof i18n;
  }
}
window.NOSMAPS_I18N = i18n;

mountLanding(readCatalogueData());
mountSiteFooter();
