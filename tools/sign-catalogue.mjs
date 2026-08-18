/* Signs the collected catalogue into catalogue-events.jsonl — one raw Nostr event per line.

   Input:  real-catalog-draft.json, the 41 records collected on 2026-08-18, each already carrying a
           complete `event_skeleton` (kind 30078, its `d`, its `t` tags, and the v1 content profile).
   Output: catalogue-events.jsonl, the same 41 records as signed events. This file is the
           repository's canonical catalogue; data.js is built from it (tools/build-data.mjs).

   This step signs what was already collected. It does not re-collect, re-word or add anything, with
   one stated exception: the Olas record's summary was written by the collector as the literal string
   "Unknown" and flagged invalid in the same breath (real-catalog-draft.json provenance: "NO
   primary-source summary exists ... Recorded as Unknown"). design-relay-native-data.md §21.5 R5 says
   the empty string is the absent summary and a cataloguer-authored placeholder is forbidden, and
   data.js has always rewritten it on the way out. Signing it as "Unknown" would put an invented
   value inside a signed record, so it is signed as "". That removes an invented value; it adds none.

   created_at is the collection date recorded in the draft's own _meta.generated (2026-08-18),
   at 00:00:00 UTC. It is not the wall-clock time of this run, because the run is not the
   observation: the records were collected that day and nothing here observed anything.

   Attribution is the pubkey. There is no collector field: whoever signed is who says so (#15,
   and issue #17's "signature tells you, do not write it twice").

   Usage:
     node tools/new-collector-key.mjs <path outside the repo>      # once
     NOSMAPS_COLLECTOR_KEY_FILE=<that path> node tools/sign-catalogue.mjs [--force]

   The secret key is read from the file named by NOSMAPS_COLLECTOR_KEY_FILE and is never written
   into the repository, never printed, and never needed again: verification and the data.js build
   use the public half only. Re-signing produces different signature bytes (schnorr signing draws
   fresh auxiliary randomness), so an existing jsonl is not overwritten without --force.

   Signing uses @rx-nostr/crypto, already a dependency (package.json). nostr-tools is not vendored
   in this repository and no dependency was added.
*/
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {getEventHash, getSignature, getPublicKey} from '@rx-nostr/crypto';
import {KIND, D_PREFIX, DISCOVERY_TOPIC, EVENTS_PATH, serializeEvent, checkEvent} from './catalogue-events.mjs';

const keyFile = process.env.NOSMAPS_COLLECTOR_KEY_FILE;
if (!keyFile) {
  process.stderr.write('NOSMAPS_COLLECTOR_KEY_FILE is not set. Generate a key with tools/new-collector-key.mjs first.\n');
  process.exit(2);
}
if (existsSync(EVENTS_PATH) && !process.argv.includes('--force')) {
  process.stderr.write('catalogue-events.jsonl already exists; re-signing changes every signature. Pass --force if that is what you want.\n');
  process.exit(2);
}

const seckey = readFileSync(keyFile, 'utf8').trim();
if (!/^[0-9a-f]{64}$/.test(seckey)) {
  process.stderr.write('the key file does not hold a 64-hex secret key\n');
  process.exit(2);
}
const pubkey = getPublicKey(seckey);

const catalog = JSON.parse(readFileSync(new URL('../real-catalog-draft.json', import.meta.url), 'utf8'));
const createdAt = Math.floor(Date.parse(`${catalog._meta.generated}T00:00:00Z`) / 1000);
if (!Number.isSafeInteger(createdAt)) throw new Error(`_meta.generated is not a date: ${catalog._meta.generated}`);

const lines = catalog.entries.map(entry => {
  const skeleton = entry.event_skeleton;
  if (skeleton.kind !== KIND) throw new Error(`entry is not kind ${KIND}: ${entry.coordinate_template}`);

  const content = {...skeleton.content};
  if (content.summary === 'Unknown') content.summary = ''; // R5, explained in the header comment.

  const tags = skeleton.tags.map(tag => [...tag]);
  const d = (tags.find(tag => tag[0] === 'd') || [])[1];
  if (typeof d !== 'string' || d.indexOf(D_PREFIX) !== 0) throw new Error(`d is not in the ${D_PREFIX} namespace: ${d}`);
  if (!tags.some(tag => tag[0] === 't' && tag[1] === DISCOVERY_TOPIC)) throw new Error(`no t tag ${DISCOVERY_TOPIC}: ${d}`);

  const unsigned = {pubkey, created_at: createdAt, kind: KIND, tags, content: JSON.stringify(content)};
  const id = getEventHash(unsigned);
  const event = {...unsigned, id, sig: getSignature(id, seckey)};

  const problems = checkEvent(event);
  if (problems.length) throw new Error(`${d}: ${problems.join('; ')}`);
  return serializeEvent(event);
});

writeFileSync(EVENTS_PATH, `${lines.join('\n')}\n`);
process.stderr.write(`signed ${lines.length} events as ${pubkey}\ncreated_at ${createdAt} (${catalog._meta.generated}T00:00:00Z, the recorded collection date)\n`);
