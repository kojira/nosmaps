/* issue #18 phase 2: publishes ONE correction record and reads it back, so that
   "two signers can hold the same identifier" stops being a claim about NIP-01
   and becomes something observed on a relay.

   What it does, in order:

     1. reads the target `d` out of catalogue-events.jsonl (so the `d` is byte
        for byte one that already exists on the relay, per M1.3);
     2. signs a kind:30078 record under that same `d` with a DIFFERENT key;
     3. publishes it, waits for the OK;
     4. re-reads `[{kinds:[30078], '#d':[d]}]` and prints every record returned,
        with its pubkey — the point is to see two;
     5. with --retract <id...>, publishes a kind:5 for ids this key signed, and
        re-reads to show what the relay does afterwards.

   It never touches the existing 41 records: it does not re-sign them, does not
   change their `d`, and refuses to build a deletion for an id it did not sign
   (the `--retract` path checks the pubkey of what it is retracting against the
   key in hand, and a relay would reject it anyway — NIP-09 deletions only apply
   to your own events).

   Usage:
     NOSMAPS_CORRECTION_KEY_FILE=<path outside the repo> node tools/publish-correction.mjs --d-index 0
     NOSMAPS_CORRECTION_KEY_FILE=<...> node tools/publish-correction.mjs --read-only --d-index 0
     NOSMAPS_CORRECTION_KEY_FILE=<...> node tools/publish-correction.mjs --retract <id> [--retract <id>]

   The secret is read from the file named by the environment variable and is
   never printed. Only pubkey / npub / event ids reach stdout.

   Node's built-in WebSocket (Node >= 22) and @rx-nostr/crypto, both already
   available here. No dependency added. */
import {readFileSync} from 'node:fs';
import {getEventHash, getSignature, getPublicKey} from '@rx-nostr/crypto';
import {readEventLines, dOf, checkEvent, serializeEvent} from './catalogue-events.mjs';

const RELAYS = ['wss://x.kojira.io'];
const OK_TIMEOUT_MS = 20000;
const CONNECT_TIMEOUT_MS = 15000;
const READ_TIMEOUT_MS = 15000;

const SOFTWARE_KIND = 30078;
const DELETION_KIND = 5;
const D_PREFIX = 'nosmaps:';
const DISCOVERY_TOPIC = 'nosmaps';
const SCHEMA = 'org.nosmaps.software';

const argv = process.argv.slice(2);
function flag(name) { return argv.includes(name); }
function value(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
}
function values(name) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === name && i + 1 < argv.length) out.push(argv[i + 1]);
  return out;
}

const keyFile = process.env.NOSMAPS_CORRECTION_KEY_FILE;
if (!keyFile) {
  process.stderr.write('NOSMAPS_CORRECTION_KEY_FILE is not set (a key outside the repository).\n');
  process.exit(2);
}
const seckey = readFileSync(keyFile, 'utf8').trim();
if (!/^[0-9a-f]{64}$/.test(seckey)) {
  process.stderr.write('the key file does not hold a 64-hex secret key\n');
  process.exit(2);
}
const pubkey = getPublicKey(seckey);

/* Guard: this must not be the key that signed the existing catalogue. Publishing
   a second record under the collector's own key would replace one of the 41
   rather than sit beside it. */
const existing = readEventLines().map(({text}) => JSON.parse(text));
const collectorKeys = new Set(existing.map(event => event.pubkey));
if (collectorKeys.has(pubkey)) {
  process.stderr.write(`refusing to run: ${pubkey} already signed the catalogue; a record under it would REPLACE, not stack.\n`);
  process.exit(2);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error(`connect timeout ${url}`)), CONNECT_TIMEOUT_MS);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); }, {once: true});
    ws.addEventListener('error', event => { clearTimeout(timer); reject(new Error(`connect error ${url}: ${event.message ?? 'unknown'}`)); }, {once: true});
  });
}

async function publish(url, event) {
  const ws = await connect(url);
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => resolve({ok: null, reason: 'no OK within timeout'}), OK_TIMEOUT_MS);
    ws.addEventListener('message', message => {
      let msg;
      try { msg = JSON.parse(message.data); } catch { return; }
      if (Array.isArray(msg) && msg[0] === 'OK' && msg[1] === event.id) {
        clearTimeout(timer);
        resolve({ok: msg[2], reason: msg[3] ?? ''});
      } else if (Array.isArray(msg) && (msg[0] === 'NOTICE' || msg[0] === 'AUTH')) {
        process.stdout.write(`  ${msg[0]}: ${JSON.stringify(msg.slice(1))}\n`);
      }
    });
    ws.send(JSON.stringify(['EVENT', event]));
  });
  try { ws.close(); } catch {}
  return result;
}

/** Reads whatever the relay returns for `filter`. Returns the raw events. */
async function read(url, filter) {
  const ws = await connect(url);
  const subId = `read-${Math.random().toString(36).slice(2, 10)}`;
  const events = [];
  const seen = new Set();
  await new Promise(resolve => {
    const done = () => { try { ws.send(JSON.stringify(['CLOSE', subId])); ws.close(); } catch {} resolve(); };
    const timer = setTimeout(done, READ_TIMEOUT_MS);
    ws.addEventListener('message', message => {
      let msg;
      try { msg = JSON.parse(message.data); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT' && msg[1] === subId) {
        const event = msg[2];
        if (!seen.has(event.id)) { seen.add(event.id); events.push(event); }
      } else if (msg[0] === 'EOSE' && msg[1] === subId) { clearTimeout(timer); done(); }
    });
    ws.send(JSON.stringify(['REQ', subId, filter]));
  });
  return events;
}

function describe(event) {
  const d = (event.tags.find(tag => tag[0] === 'd') || [])[1] ?? null;
  return {id: event.id, pubkey: event.pubkey, kind: event.kind, d, created_at: event.created_at};
}

function printEvents(label, events) {
  process.stdout.write(`${label} (${events.length})\n`);
  for (const event of events) process.stdout.write(`  ${JSON.stringify(describe(event))}\n`);
  const signers = [...new Set(events.filter(e => e.kind === SOFTWARE_KIND).map(e => e.pubkey))];
  if (signers.length) process.stdout.write(`  distinct signers on kind ${SOFTWARE_KIND}: ${signers.length} -> ${signers.join(', ')}\n`);
}

function sign(unsigned) {
  const base = {pubkey, created_at: unsigned.created_at, kind: unsigned.kind, tags: unsigned.tags, content: unsigned.content};
  const id = getEventHash(base);
  return {...base, id, sig: getSignature(id, seckey)};
}

const now = Math.floor(Date.now() / 1000);

// ---- --retract: publish a kind:5 for ids this key signed -------------------

if (flag('--retract')) {
  const ids = values('--retract');
  for (const id of ids) if (!/^[0-9a-f]{64}$/.test(id)) throw new Error(`not a 64-hex id: ${id}`);

  /* Refuse to ask for somebody else's event to be deleted: read each id back and
     check it was signed by the key in hand. An id the relay does not have is
     allowed through (it may already be gone), but a foreign pubkey is not. */
  for (const relay of RELAYS) {
    const found = await read(relay, {ids});
    for (const event of found) {
      if (event.pubkey !== pubkey) throw new Error(`refusing: ${event.id} was signed by ${event.pubkey}, not by this key`);
    }
    process.stdout.write(`[${relay}] targets present before retraction: ${found.length}\n`);
    printEvents('  before', found);
  }

  const deletion = sign({
    kind: DELETION_KIND,
    created_at: now,
    tags: [...ids.map(id => ['e', id]), ['k', String(SOFTWARE_KIND)]],
    content: 'issue #18 phase 2 verification event, retracted after the observation was made'
  });
  process.stdout.write(`\n=== DELETION EVENT (kind ${DELETION_KIND}) ===\n${serializeEvent(deletion)}\n`);
  process.stdout.write(`${JSON.stringify(describe(deletion))}\n`);

  for (const relay of RELAYS) {
    const result = await publish(relay, deletion);
    process.stdout.write(`\n[${relay}] deletion OK=${JSON.stringify(result.ok)} reason=${JSON.stringify(result.reason)}\n`);
    const after = await read(relay, {ids});
    printEvents(`  after retraction, filter {ids: [...]}`, after);
    const dTarget = value('--d', null);
    if (dTarget) {
      const stack = await read(relay, {kinds: [SOFTWARE_KIND], '#d': [dTarget]});
      printEvents(`  after retraction, filter {kinds:[${SOFTWARE_KIND}], '#d':['${dTarget}']}`, stack);
    }
    const deletionBack = await read(relay, {ids: [deletion.id]});
    printEvents('  the deletion event itself', deletionBack);
  }
  process.exit(0);
}

// ---- default: publish one correction under an existing `d` ----------------

const index = Number(value('--d-index', '0'));
if (!Number.isInteger(index) || index < 0 || index >= existing.length) {
  throw new Error(`--d-index must be 0..${existing.length - 1}`);
}
const target = existing[index];
const d = dOf(target);
if (typeof d !== 'string' || d.indexOf(D_PREFIX) !== 0) throw new Error(`target d is not in the ${D_PREFIX} namespace: ${d}`);

const targetContent = JSON.parse(target.content);
process.stdout.write('=== TARGET (an existing record; NOT modified, NOT re-signed) ===\n');
process.stdout.write(`${JSON.stringify(describe(target))}\n`);
process.stdout.write(`  name: ${JSON.stringify(targetContent.name)}\n`);
process.stdout.write(`this key: ${pubkey}\n\n`);

if (flag('--read-only')) {
  for (const relay of RELAYS) {
    const stack = await read(relay, {kinds: [SOFTWARE_KIND], '#d': [d]});
    printEvents(`[${relay}] filter {kinds:[${SOFTWARE_KIND}], '#d':['${d}']}`, stack);
  }
  process.exit(0);
}

/* The correction. Same `d`, byte for byte — it is copied off the existing event,
   never rebuilt from a name — different key, and content that says what this
   signer says. `t` = nosmaps or it is invisible (M3.1-5). */
const content = {
  schema: SCHEMA,
  version: 1,
  state: 'active',
  name: targetContent.name,
  summary: `issue #18 phase 2 verification record: a second signer writing the same identifier. Retracted after the observation.`,
  homepage: targetContent.homepage
};
const correction = sign({
  kind: SOFTWARE_KIND,
  created_at: now,
  tags: [['d', d], ['t', DISCOVERY_TOPIC], ['state', 'active'], ['v', '1']],
  content: JSON.stringify(content)
});

const problems = checkEvent(correction);
if (problems.length) throw new Error(`the event this tool built is not valid: ${problems.join('; ')}`);
if (dOf(correction) !== d) throw new Error('the built d does not match the target d byte for byte');
if (correction.pubkey === target.pubkey) throw new Error('same signer as the target: this would replace it');

process.stdout.write('=== CORRECTION EVENT (about to publish) ===\n');
process.stdout.write(`${serializeEvent(correction)}\n`);
process.stdout.write(`${JSON.stringify(describe(correction))}\n\n`);

for (const relay of RELAYS) {
  const before = await read(relay, {kinds: [SOFTWARE_KIND], '#d': [d]});
  printEvents(`[${relay}] BEFORE, filter {kinds:[${SOFTWARE_KIND}], '#d':['${d}']}`, before);

  const result = await publish(relay, correction);
  process.stdout.write(`\n[${relay}] publish OK=${JSON.stringify(result.ok)} reason=${JSON.stringify(result.reason)}\n\n`);

  const after = await read(relay, {kinds: [SOFTWARE_KIND], '#d': [d]});
  printEvents(`[${relay}] AFTER, filter {kinds:[${SOFTWARE_KIND}], '#d':['${d}']}`, after);
}
process.exit(0);
