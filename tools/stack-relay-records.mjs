/* issue #18 phase 2: runs the phase 1 grouping (src/domain/stacks.ts) over records
   read from a real relay, rather than over a fixture written by hand.

   Phase 1 proved `stackRecords` groups by byte equality of `d` and names no
   default. What it could not prove is that a relay actually hands back two
   signers under one `d` — that took publishing. This closes the loop: read the
   relay, feed exactly what came back into the same function the browser uses,
   and print what it made of it.

   `stackRecords` is TypeScript in the domain layer, so it is bundled on the fly
   with esbuild (already a devDependency) into a temp file and imported. Nothing
   is reimplemented here; the point is that this is the shipped function.

   Usage: node tools/stack-relay-records.mjs --d 'nosmaps:io.damus'
   Needs no key: reading a relay is not signing. */
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const RELAYS = ['wss://x.kojira.io'];
const READ_TIMEOUT_MS = 15000;
const CONNECT_TIMEOUT_MS = 15000;
const SOFTWARE_KIND = 30078;

const argv = process.argv.slice(2);
const dIndex = argv.indexOf('--d');
const d = dIndex >= 0 && dIndex + 1 < argv.length ? argv[dIndex + 1] : null;
if (!d) {
  process.stderr.write("usage: node tools/stack-relay-records.mjs --d 'nosmaps:<identifier>'\n");
  process.exit(2);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'nosmaps-stacks-'));
const outFile = join(outDir, 'stacks.mjs');
execFileSync('npx', ['esbuild', join(root, 'src/domain/stacks.ts'), '--bundle', '--format=esm', `--outfile=${outFile}`], {stdio: 'pipe'});
const {stackRecords, drawnRecords, STACK_DRAWN_LIMIT} = await import(pathToFileURL(outFile).href);

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error(`connect timeout ${url}`)), CONNECT_TIMEOUT_MS);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); }, {once: true});
    ws.addEventListener('error', event => { clearTimeout(timer); reject(new Error(`connect error ${url}: ${event.message ?? 'unknown'}`)); }, {once: true});
  });
}

async function read(url, filter) {
  const ws = await connect(url);
  const subId = `stack-${Math.random().toString(36).slice(2, 10)}`;
  const events = [];
  const seen = new Set();
  let sawEose = false;
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
      } else if (msg[0] === 'EOSE' && msg[1] === subId) { sawEose = true; clearTimeout(timer); done(); }
    });
    ws.send(JSON.stringify(['REQ', subId, filter]));
  });
  return {events, sawEose};
}

try {
  for (const relay of RELAYS) {
    const {events, sawEose} = await read(relay, {kinds: [SOFTWARE_KIND], '#d': [d]});
    /* One relay answered, so coverage across the relay set is NOT complete: that
       is exactly what `complete: false` means, and it is passed honestly rather
       than as `true` to make the output look tidy (I8). */
    const complete = RELAYS.length === 1 && sawEose ? false : false;
    const rows = events.map(event => ({
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      d: (event.tags.find(tag => tag[0] === 'd') || [])[1] ?? ''
    }));
    const stacks = stackRecords(rows, row => row.d, complete);

    process.stdout.write(`[${relay}] read ${events.length} record(s) for ${JSON.stringify(d)} (EOSE seen: ${sawEose})\n`);
    process.stdout.write(`stackRecords(...) produced ${stacks.length} stack(s), complete=${complete}\n`);
    for (const stack of stacks) {
      process.stdout.write(`  stack d=${JSON.stringify(stack.d)} observed=${stack.observed} complete=${stack.complete} records=${stack.records.length}\n`);
      for (const row of stack.records) process.stdout.write(`    ${JSON.stringify(row)}\n`);
      process.stdout.write(`    drawn (cap ${STACK_DRAWN_LIMIT}): ${drawnRecords(stack).length}\n`);
      const keys = Object.keys(stack);
      process.stdout.write(`    fields on the stack: ${JSON.stringify(keys)}\n`);
      const verdictFields = keys.filter(key => ['displayed', 'primary', 'default', 'winner', 'collector'].includes(key));
      process.stdout.write(`    default-picking fields present: ${verdictFields.length === 0 ? 'none (D1 holds)' : JSON.stringify(verdictFields)}\n`);
      const signers = [...new Set(stack.records.map(row => row.pubkey))];
      process.stdout.write(`    distinct signers in this stack: ${signers.length} -> ${signers.join(', ')}\n`);
    }
  }
} finally {
  rmSync(outDir, {recursive: true, force: true});
}
