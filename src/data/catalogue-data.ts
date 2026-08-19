/* Loading the generated catalogue (data.js).

   data.js is a build artefact of catalogue-events.jsonl, produced by
   tools/build-data.mjs, and it stays a classic script assigning window.NOSMAPS_DATA.
   That is deliberate: the signed events are canonical, and the generated file is
   loaded as data rather than imported as a module so the build step keeps owning
   its shape. This module is the ONE place that reads it, so every other layer
   receives a typed value instead of touching a global. */

import type {Data} from '../domain/entry.ts';

/* The global the generated data.js assigns, declared here and nowhere else.
   Declared on globalThis rather than read through a cast: the value really is
   there at runtime, and the validation below is what decides whether it is
   usable. */
declare global {
  // eslint-disable-next-line no-var
  var NOSMAPS_DATA: unknown;
}

function looksLikeData(value: unknown): value is Data {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {tools?: unknown; meta?: unknown};
  return Array.isArray(candidate.tools) && typeof candidate.meta === 'object';
}

/** Read the generated catalogue. Throws rather than returning a half-built
    stand-in: a page with no data has nothing honest to render, and inventing an
    empty catalogue would show "0 entries" as if that were an observation. */
export function readCatalogueData(): Data {
  const value: unknown = globalThis.NOSMAPS_DATA;
  if (!looksLikeData(value)) {
    throw new Error('nosmaps: data.js did not provide NOSMAPS_DATA');
  }
  return value;
}
