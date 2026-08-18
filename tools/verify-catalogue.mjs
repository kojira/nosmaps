/* Verifies catalogue-events.jsonl, the canonical catalogue, and that data.js still renders it.

   Every line must parse as JSON, be kind 30078, carry a `d` prefixed `nosmaps:` and a `t` tag of
   `nosmaps`, have an id equal to the hash of its own canonical serialisation, and carry a schnorr
   signature that verifies against its pubkey. Then: no duplicate `d`, one signer for the whole
   file, and data.js holds exactly the same ids, in the same order, and says so in meta.entryCount.

   Exit code 0 only if every one of those holds. Run: node tools/verify-catalogue.mjs
*/
import {readFileSync} from 'node:fs';
import {readEventLines, checkEvent, dOf, KIND, D_PREFIX, DISCOVERY_TOPIC, EVENTS_PATH} from './catalogue-events.mjs';

const failures = [];
const events = [];

for (const {lineNumber, text} of readEventLines(EVENTS_PATH)) {
  let event;
  try {
    event = JSON.parse(text);
  } catch (error) {
    failures.push(`line ${lineNumber}: not valid JSON: ${error.message}`);
    continue;
  }
  const problems = checkEvent(event);
  if (problems.length) failures.push(`line ${lineNumber}: ${problems.join('; ')}`);
  else events.push(event);
}

const total = events.length + failures.length;

const seen = new Map();
for (const event of events) {
  const d = dOf(event);
  if (seen.has(d)) failures.push(`duplicate d ${d} (lines ${seen.get(d)} and ${events.indexOf(event) + 1})`);
  else seen.set(d, events.indexOf(event) + 1);
}

const signers = [...new Set(events.map(event => event.pubkey))];
if (signers.length > 1) failures.push(`${signers.length} different signers: ${signers.join(', ')}`);

/* data.js is a build artefact of this file, so it must render exactly these records. Loaded the way
   the tests load it: as the classic script it is, with a stand-in window. */
const source = readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('window', source)(sandbox);
const data = sandbox.NOSMAPS_DATA;

const jsonlIds = events.map(dOf);
const dataIds = data.tools.map(tool => tool.id);
if (jsonlIds.join('\n') !== dataIds.join('\n')) {
  failures.push(`data.js renders different records than the jsonl (${dataIds.length} vs ${jsonlIds.length}; first difference at index ${dataIds.findIndex((id, i) => id !== jsonlIds[i])})`);
}
if (data.meta.entryCount !== events.length) {
  failures.push(`data.js meta.entryCount is ${data.meta.entryCount}, the jsonl holds ${events.length} events`);
}
/* Attribution is the signature, so it is checked as one: every rendered coordinate must name the
   pubkey that actually signed that record. There is no collector field to compare against. */
const wrongAuthor = data.tools.filter((tool, index) => tool.coordinate !== `${KIND}:${(events[index] || {}).pubkey}:${tool.id}`);
if (wrongAuthor.length) {
  failures.push(`${wrongAuthor.length} data.js coordinate(s) do not name the signing pubkey, first: ${wrongAuthor[0].coordinate}`);
}

const report = [
  `lines: ${total}`,
  `valid signed events: ${events.length}`,
  `kind: ${KIND}, d prefix: ${D_PREFIX}, discovery topic: ${DISCOVERY_TOPIC}`,
  `signer: ${signers.length === 1 ? signers[0] : signers.join(', ') || 'none'}`,
  `data.js entries: ${dataIds.length} (meta.entryCount ${data.meta.entryCount})`
].join('\n');

if (failures.length) {
  process.stdout.write(`${report}\nFAIL: ${failures.length} problem(s)\n${failures.map(item => `  - ${item}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${report}\nOK: every line parses, verifies, and data.js matches the jsonl\n`);
