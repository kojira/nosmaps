/* The one place that knows what a catalogue event is, shared by the signer, the verifier and the
   data.js build. The checks below are the read path's own rules, restated for a file instead of a
   relay: nostr-catalog.js validateSoftwareEvent() requires kind 30078, exactly one `d` inside the
   `nosmaps:` namespace, and the v1 content profile; discovery requires the `t` tag `nosmaps`.

   Signature and id verification use @rx-nostr/crypto, already a dependency of this project
   (package.json). nostr-tools is not vendored here and no dependency was added.
*/
import {readFileSync} from 'node:fs';
import {getEventHash, schnorr} from '@rx-nostr/crypto';

export const KIND = 30078;
export const D_PREFIX = 'nosmaps:';
export const DISCOVERY_TOPIC = 'nosmaps';
export const SCHEMA = 'org.nosmaps.software';
export const EVENTS_PATH = new URL('../catalogue-events.jsonl', import.meta.url);

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

/* Serialised with a fixed key order so a line is a stable text, not a re-serialisation lottery. */
export function serializeEvent(event) {
  return JSON.stringify({
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.sig
  });
}

export function readEventLines(path = EVENTS_PATH) {
  const text = readFileSync(path, 'utf8');
  if (text === '') return [];
  if (!text.endsWith('\n')) throw new Error('jsonl does not end with a newline');
  return text.slice(0, -1).split('\n').map((line, index) => ({lineNumber: index + 1, text: line}));
}

/* Returns a list of problems. An empty list means the event is one of ours and its signature holds.
   Nothing here repairs anything: a bad line is reported, never rewritten. */
export function checkEvent(event) {
  const problems = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) return ['not a JSON object'];

  if (!HEX64.test(String(event.id))) problems.push('id is not 64 lowercase hex');
  if (!HEX64.test(String(event.pubkey))) problems.push('pubkey is not 64 lowercase hex');
  if (!HEX128.test(String(event.sig))) problems.push('sig is not 128 lowercase hex');
  if (event.kind !== KIND) problems.push(`kind is ${JSON.stringify(event.kind)}, expected ${KIND}`);
  if (!Number.isSafeInteger(event.created_at)) problems.push('created_at is not an integer');
  if (typeof event.content !== 'string') problems.push('content is not a string');
  if (!Array.isArray(event.tags)) return [...problems, 'tags is not an array'];

  const dTags = event.tags.filter(tag => Array.isArray(tag) && tag[0] === 'd');
  if (dTags.length !== 1) problems.push(`${dTags.length} d tags, expected exactly 1`);
  else if (typeof dTags[0][1] !== 'string' || dTags[0][1].indexOf(D_PREFIX) !== 0) {
    problems.push(`d ${JSON.stringify(dTags[0][1])} is not prefixed ${D_PREFIX}`);
  } else if (dTags[0][1].length === D_PREFIX.length) problems.push('d is the bare prefix and names nothing');

  const topics = event.tags.filter(tag => Array.isArray(tag) && tag[0] === 't').map(tag => tag[1]);
  if (!topics.includes(DISCOVERY_TOPIC)) problems.push(`no t tag ${JSON.stringify(DISCOVERY_TOPIC)}`);

  if (problems.length) return problems;

  /* id is the hash of the canonical serialisation, and sig signs that hash. Both are checked: a
     line whose id was recomputed to match tampered content would still fail the signature. */
  const hash = getEventHash({
    pubkey: event.pubkey, created_at: event.created_at, kind: event.kind, tags: event.tags, content: event.content
  });
  if (hash !== event.id) problems.push(`id does not match the event hash (computed ${hash})`);
  if (!schnorr.verify(event.sig, event.id, event.pubkey)) problems.push('signature does not verify');

  return problems;
}

export function dOf(event) {
  const tag = event.tags.find(item => Array.isArray(item) && item[0] === 'd');
  return tag ? tag[1] : null;
}

/* The events, in file order, each with its parsed content. Throws on the first bad line: the build
   must not be able to emit data.js from a file it could not fully verify. */
export function loadVerifiedEvents(path = EVENTS_PATH) {
  return readEventLines(path).map(({lineNumber, text}) => {
    let event;
    try {
      event = JSON.parse(text);
    } catch (error) {
      throw new Error(`line ${lineNumber}: not valid JSON: ${error.message}`);
    }
    const problems = checkEvent(event);
    if (problems.length) throw new Error(`line ${lineNumber}: ${problems.join('; ')}`);
    const content = JSON.parse(event.content);
    if (content.schema !== SCHEMA) throw new Error(`line ${lineNumber}: content schema is not ${SCHEMA}`);
    return {event, content, d: dOf(event), lineNumber};
  });
}
