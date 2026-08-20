/* Checks that every per-language text on screen came out of a signature, and that none of them says
   something the catalogue already says (#14, design-explorer-i18n-search.md §5 C).

   This is the guard on the actual bug #14 was about. The Japanese texts used to be a literal inside
   this very directory: the build injected them into data.js, so the page showed forty sentences that
   no signed record contained and no key stood behind. Nothing in the pipeline could tell that from a
   collected fact. These four conditions are what makes the difference checkable rather than
   remembered.

   Exit code 0 only if all four hold. Run: node tools/check-descriptions.mjs
*/
import {readFileSync} from 'node:fs';
import {loadVerifiedEvents} from './catalogue-events.mjs';

const failures = [];

/* The signed catalogue, read through the same verifier the build uses: a line whose signature or id
   does not hold throws here rather than being counted as a source. */
const signed = loadVerifiedEvents();
const contentByD = new Map(signed.map(item => [item.d, item.content]));

const source = readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('window', source)(sandbox);
const tools = sandbox.NOSMAPS_DATA.tools;

/* C1 — the build authors no text. Any CJK character in tools/build-data.mjs is one, because the
   only reason that file ever held Japanese was the DESCRIPTIONS_JA literal this check exists to keep
   out. Scoped to that one file on purpose: tools/diff-explorer.mjs legitimately holds Japanese as a
   *search query* it types into the page, and widening this check would fail on it. */
const buildData = readFileSync(new URL('./build-data.mjs', import.meta.url), 'utf8');
const cjk = (buildData.match(/[\u3041-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g) || []).length;
if (cjk !== 0) failures.push(`tools/build-data.mjs holds ${cjk} CJK character(s); the build must author no text`);

let traceable = 0;
for (const tool of tools) {
  const content = contentByD.get(tool.id);
  if (!content) {
    failures.push(`${tool.id}: data.js renders a record the signed catalogue does not hold`);
    continue;
  }
  for (const [language, text] of Object.entries(tool.descriptions || {})) {
    /* C2 — every rendered text is in the signature of the record it is shown under. Which also
       settles who wrote it: the pubkey that signed that line, with no translator field to trust
       or to contradict (C5). */
    if (content.descriptions && content.descriptions[language] === text) traceable += 1;
    else failures.push(`${tool.id}: the ${language} text on screen is in no signature`);
    // C4 — and it is not a second copy of the original, which lives in `summary` and is fallen back to.
    if (text === tool.summary) failures.push(`${tool.id}: the ${language} text is a copy of the record's own summary`);
  }
}

/* C5 — no translator field, in the events or in the build artefact. The signature already names who
   said it; a field saying it again is a second copy that can disagree with the first. */
const events = readFileSync(new URL('../catalogue-events.jsonl', import.meta.url), 'utf8');
for (const field of ['translator', 'translatedBy', 'translated_by', 'generator']) {
  for (const [name, text] of [['catalogue-events.jsonl', events], ['data.js', source]]) {
    const count = text.split(field).length - 1;
    if (count) failures.push(`${name} names \`${field}\` ${count} time(s); attribution is the pubkey`);
  }
}

const report = [
  `records: ${tools.length}`,
  `per-language texts rendered: ${tools.reduce((n, tool) => n + Object.keys(tool.descriptions || {}).length, 0)}`,
  `traceable to a signature: ${traceable}`,
  `CJK characters in tools/build-data.mjs: ${cjk}`
].join('\n');

if (failures.length) {
  process.stdout.write(`${report}\nFAIL: ${failures.length} problem(s)\n${failures.map(item => `  - ${item}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${report}\nOK: every text on screen is signed, once, by the record it belongs to\n`);
