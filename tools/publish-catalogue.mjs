// Publish already-signed catalogue events (kind 30078) to relays.
// Uses Node's built-in global WebSocket (Node >= 22). No new dependency added.
// Reads catalogue-events.jsonl (one complete signed event JSON per line).
// Never re-signs, never mutates event content.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'catalogue-events.jsonl');

const RELAYS = ['wss://x.kojira.io', 'wss://nos.lol'];
const OK_TIMEOUT_MS = 20000;
const CONNECT_TIMEOUT_MS = 15000;

const events = readFileSync(FILE, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error(`connect timeout ${url}`)), CONNECT_TIMEOUT_MS);
    ws.addEventListener('open', () => { clearTimeout(t); resolve(ws); }, { once: true });
    ws.addEventListener('error', (e) => { clearTimeout(t); reject(new Error(`connect error ${url}: ${e.message ?? 'unknown'}`)); }, { once: true });
  });
}

async function publishAll(url) {
  const res = { relay: url, accepted: 0, rejected: 0, timedOut: 0, rejections: [], fatal: null };
  let ws;
  try {
    ws = await connect(url);
  } catch (e) {
    res.fatal = String(e.message ?? e);
    return res;
  }

  const pending = new Map(); // id -> resolve
  const notices = [];

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (Array.isArray(msg) && msg[0] === 'OK') {
      const [, id, ok, reason] = msg;
      const r = pending.get(id);
      if (r) { pending.delete(id); r({ ok, reason: reason ?? '' }); }
    } else if (Array.isArray(msg) && (msg[0] === 'NOTICE' || msg[0] === 'AUTH')) {
      notices.push(JSON.stringify(msg));
    }
  });
  ws.addEventListener('close', () => {
    for (const [id, r] of pending) { pending.delete(id); r({ ok: false, reason: 'connection closed before OK' }); }
  });

  for (const ev of events) {
    const wait = new Promise((resolve) => {
      pending.set(ev.id, resolve);
      setTimeout(() => {
        if (pending.has(ev.id)) { pending.delete(ev.id); resolve({ ok: null, reason: 'no OK within timeout' }); }
      }, OK_TIMEOUT_MS);
    });
    try {
      ws.send(JSON.stringify(['EVENT', ev]));
    } catch (e) {
      res.fatal = `send failed: ${String(e.message ?? e)}`;
      break;
    }
    const r = await wait;
    if (r.ok === true) res.accepted++;
    else if (r.ok === false) { res.rejected++; res.rejections.push({ id: ev.id, d: (ev.tags.find((t) => t[0] === 'd') || [])[1], reason: r.reason }); }
    else { res.timedOut++; res.rejections.push({ id: ev.id, d: (ev.tags.find((t) => t[0] === 'd') || [])[1], reason: r.reason }); }
  }

  res.notices = notices;
  try { ws.close(); } catch {}
  return res;
}

async function readBack(url) {
  const res = { relay: url, returned: 0, ids: new Set(), dTags: [], fatal: null };
  let ws;
  try {
    ws = await connect(url);
  } catch (e) {
    res.fatal = String(e.message ?? e);
    return res;
  }
  const subId = 'readback-' + Math.random().toString(36).slice(2, 10);
  await new Promise((resolve) => {
    const done = () => { try { ws.send(JSON.stringify(['CLOSE', subId])); ws.close(); } catch {} resolve(); };
    const t = setTimeout(done, OK_TIMEOUT_MS);
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT' && msg[1] === subId) {
        const e = msg[2];
        if (!res.ids.has(e.id)) {
          res.ids.add(e.id);
          const d = (e.tags.find((t) => t[0] === 'd') || [])[1];
          if (d) res.dTags.push(d);
        }
      } else if (msg[0] === 'EOSE' && msg[1] === subId) {
        clearTimeout(t); done();
      }
    });
    ws.send(JSON.stringify(['REQ', subId, { kinds: [30078], '#t': ['nosmaps'], limit: 500 }]));
  });
  res.returned = res.ids.size;
  return res;
}

const pubResults = [];
for (const r of RELAYS) pubResults.push(await publishAll(r));

console.log('=== PUBLISH ===');
console.log(`local events in catalogue-events.jsonl: ${events.length}`);
for (const r of pubResults) {
  console.log(`\n[${r.relay}]`);
  if (r.fatal) console.log(`  FATAL: ${r.fatal}`);
  console.log(`  accepted: ${r.accepted}`);
  console.log(`  rejected: ${r.rejected}`);
  console.log(`  no-response(timeout): ${r.timedOut}`);
  for (const rj of r.rejections) console.log(`  - ${rj.d ?? rj.id}: ${JSON.stringify(rj.reason)}`);
  if (r.notices?.length) for (const n of r.notices) console.log(`  NOTICE/AUTH: ${n}`);
}

console.log('\n=== READ BACK (kind 30078, #t=nosmaps) ===');
for (const relay of RELAYS) {
  const r = await readBack(relay);
  console.log(`\n[${r.relay}]`);
  if (r.fatal) { console.log(`  FATAL: ${r.fatal}`); continue; }
  console.log(`  events returned: ${r.returned}`);
  console.log(`  example d tag: ${r.dTags[0] ?? '(none)'}`);
  const pub = pubResults.find((p) => p.relay === relay);
  if (pub && r.returned < pub.accepted) {
    console.log(`  NOTE: relay returned FEWER (${r.returned}) than it accepted (${pub.accepted}).`);
  }
}
process.exit(0);
