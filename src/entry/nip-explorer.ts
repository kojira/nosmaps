/* Entry point for nip-explorer.html.

   Per-page wiring only: it reads the generated catalogue, mounts the explorer,
   and publishes the diagnostic surfaces the page is driven through. All of the
   behaviour lives in src/ui/explorer/app.ts; nothing is decided here.

   Bundled by esbuild into dist/nip-explorer.js, which — together with the
   generated data.js — is the only script the page loads.

   The globals below are exactly the ones the classic scripts used to assign, and
   they are assigned HERE rather than from inside a module: bundling made them
   unreachable from the page, and the tests, the i18n-integrity check and the
   relay specs all drive the app through them. They are a diagnostic surface, not
   an import path — nothing inside src/ reads them back. */

import {buildCatalog, type CatalogInput, type CatalogResult} from '../domain/catalogue.ts';
import {chunkFilters} from '../domain/chunking.ts';
import {compareCodePoints, isValidCoordinate} from '../domain/event.ts';
import {curationMembership, deriveGraph, orderEntries} from '../domain/graph.ts';
import {
  bytesEqual, canonicalize, isCanonicalBytes, isLowercaseSha256Hex,
  sha256Hex, strictParse, utf8ByteLength, utf8Encode
} from '../domain/json.ts';
import {decodeNpub, encodeNpub} from '../domain/npub.ts';
import {POLICY, SOFTWARE_D_PREFIX, SOFTWARE_SCHEMA} from '../domain/policy.ts';
import {
  validateCurationSetEvent, validateDeletionEvent,
  validateFollowListEvent, validateSoftwareEvent
} from '../domain/records.ts';
import {collectDeletions, selectAddressableWinner, selectSoftwareWinners} from '../domain/winners.ts';
import {cache} from '../data/cache.ts';
import {readCatalogueData} from '../data/catalogue-data.ts';
import {loadCatalog, type LoadedCatalog} from '../data/load.ts';
import {buildSoftwareDraft, publishSoftwareRecord} from '../data/publish.ts';
import {groupByAuthor} from '../data/relay.ts';
import {stats} from '../data/stats.ts';
import {i18n} from '../ui/i18n.ts';
import {icons} from '../ui/icons.ts';
import {mountSiteFooter} from '../ui/site-footer.ts';
import {mountExplorer, type RelayLoadOverride} from '../ui/explorer/app.ts';

/* The catalogue surface, assembled from the modules rather than re-implemented.
   Same names, same functions — `nostr-catalog.js` was a bundle of these exact
   exports behind one global, and the tests call them by those names. */
const catalog = {
  POLICY,
  SOFTWARE_SCHEMA,
  SOFTWARE_D_PREFIX,
  validateSoftwareEvent,
  validateCurationSetEvent,
  validateFollowListEvent,
  validateDeletionEvent,
  collectDeletions,
  selectAddressableWinner,
  selectSoftwareWinners,
  deriveGraph,
  curationMembership,
  orderEntries,
  /* buildCatalog is re-typed at the boundary only so a caller in a plain .js test
     hands it a value this signature accepts; the function itself is untouched. */
  buildCatalog: (input?: CatalogInput): CatalogResult => buildCatalog(input),
  chunkFilters,
  groupByAuthor,
  decodeNpub,
  encodeNpub,
  isValidCoordinate,
  compareCodePoints,
  cache,
  loadCatalog,
  buildSoftwareDraft,
  publishSoftwareRecord,
  stats
};

const canonical = {
  utf8Encode,
  utf8ByteLength,
  bytesEqual,
  isLowercaseSha256Hex,
  sha256Hex,
  strictParse,
  canonicalize,
  isCanonicalBytes
};

declare global {
  interface Window {
    NOSMAPS_I18N: typeof i18n;
    NOSMAPS_ICONS: typeof icons;
    NOSMAPS_CATALOG: typeof catalog;
    NOSMAPS_CANONICAL: typeof canonical;
    /** The last relay result. Null after a failed round — which is a different
        thing from a round that returned no entries. */
    __NOSMAPS_RELAY_RESULT__: LoadedCatalog | null;
    __NOSMAPS_RELAY_LOAD__: (override?: RelayLoadOverride | Event) => Promise<LoadedCatalog | null>;
    __NOSMAPS_SET_STATE__: (next: string) => void;
  }
}

window.NOSMAPS_I18N = i18n;
window.NOSMAPS_ICONS = icons;
window.NOSMAPS_CATALOG = catalog;
window.NOSMAPS_CANONICAL = canonical;

const explorer = mountExplorer(readCatalogueData());

explorer.onRelayResult(result => { window.__NOSMAPS_RELAY_RESULT__ = result; });
window.__NOSMAPS_RELAY_LOAD__ = explorer.loadRelayCatalog;
window.__NOSMAPS_SET_STATE__ = explorer.setState;

mountSiteFooter();
