/* issue #14. Where the text on a card comes from.

   The forty Japanese descriptions the explorer showed were a literal inside tools/build-data.mjs.
   The build read them out of itself and wrote them into data.js, so the page displayed forty
   sentences that were in no signed record and behind no key -- and nothing distinguished them from
   the collected facts sitting next to them. The fix was not to delete the sentences but to put them
   where a reader can see who said them: inside the signature of the record they describe.

   These tests hold that shape. They read the three artefacts directly (the signed jsonl, data.js and
   the build script) rather than the page, because the property is about provenance, not rendering --
   a text that reaches the screen correctly from the wrong place is exactly the bug that was here.

   The design conditions are design-explorer-i18n-search.md §5 C: C1 the build authors no text, C2
   every rendered text is traceable to a signature, C4 no text is a second copy of the original, C5
   no translator field exists in either artefact. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {test, expect} = require('@playwright/test');

const REPO = path.join(__dirname, '..');

function readData() {
  const sandbox = {};
  new Function('window', fs.readFileSync(path.join(REPO, 'data.js'), 'utf8'))(sandbox);
  return sandbox.NOSMAPS_DATA;
}

function signedContentByD() {
  const lines = fs.readFileSync(path.join(REPO, 'catalogue-events.jsonl'), 'utf8').trim().split('\n');
  return new Map(lines.map(line => {
    const event = JSON.parse(line);
    const d = event.tags.find(tag => tag[0] === 'd')[1];
    return [d, JSON.parse(event.content)];
  }));
}

test('C. every per-language text on screen is inside the signature of the record it describes', () => {
  const data = readData();
  const signed = signedContentByD();
  const untraceable = [];
  let traceable = 0;
  for (const tool of data.tools) {
    const content = signed.get(tool.id);
    expect(content, `${tool.id} is in the signed catalogue`).toBeTruthy();
    for (const [language, text] of Object.entries(tool.descriptions || {})) {
      if (content.descriptions && content.descriptions[language] === text) traceable += 1;
      else untraceable.push(`${tool.id}/${language}`);
    }
  }
  expect(untraceable, 'no text on screen comes from outside the signature').toEqual([]);
  /* Not merely "none untraceable": zero texts would satisfy that while having quietly dropped the
     forty sentences the issue was about. They were moved, not deleted. */
  expect(traceable, 'the catalogue actually carries per-language texts').toBeGreaterThan(0);
});

test('C. the build script authors no description of its own', () => {
  const source = fs.readFileSync(path.join(REPO, 'tools', 'build-data.mjs'), 'utf8');
  /* Any CJK character in this one file is an authored text: the only reason it ever held Japanese
     was the DESCRIPTIONS_JA literal. Scoped to this file deliberately -- tools/diff-explorer.mjs
     holds Japanese legitimately, as a search query it types into the page. */
  const cjk = source.match(/[\u3041-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g) || [];
  expect(cjk.join(''), 'tools/build-data.mjs holds no authored text').toBe('');
  expect(source.includes('DESCRIPTIONS_JA'), 'the hardcoded translation table is gone').toBe(false);
});

test('C. no description repeats the original, and no field claims to name a translator', () => {
  const data = readData();
  /* D14-6: the original lives in `summary` and every unrecorded language falls back to it, so a
     language-coded copy of the same bytes adds nothing and can drift away from what it copies. */
  const copies = data.tools.flatMap(tool => Object.entries(tool.descriptions || {})
    .filter(([, text]) => text === tool.summary)
    .map(([language]) => `${tool.id}/${language}`));
  expect(copies, 'no description is a second copy of its own record\'s summary').toEqual([]);

  /* D14-3: the pubkey that signed the record is who wrote its texts. A field saying so as well is
     the same fact in two places, and the two can disagree once a record is re-signed. */
  const events = fs.readFileSync(path.join(REPO, 'catalogue-events.jsonl'), 'utf8');
  const source = fs.readFileSync(path.join(REPO, 'data.js'), 'utf8');
  const found = [];
  for (const field of ['translator', 'translatedBy', 'translated_by', 'generator']) {
    if (events.includes(field)) found.push(`catalogue-events.jsonl/${field}`);
    if (source.includes(field)) found.push(`data.js/${field}`);
  }
  expect(found, 'attribution is the signature, never a field').toEqual([]);
});

/* The same four conditions as one command, so they are checkable outside this suite too (AC-C3).
   `npm run verify-catalogue` runs it alongside the signature check. */
test('C. tools/check-descriptions.mjs enforces all of the above on its own', () => {
  const output = execFileSync('node', ['tools/check-descriptions.mjs'], {cwd: REPO, encoding: 'utf8'});
  expect(output).toContain('OK: every text on screen is signed');
});

/* D3. The 41 records collected on 2026-08-18 were re-signed to carry their Japanese, and re-signing
   is where a collection date can quietly become the date of the re-signing run. It did not: the
   value below is the one the draft's own _meta.generated states (2026-08-18T00:00:00Z), and the
   explorer prints it as the collection date (issue #21). A `created_at` that moved would mean the
   catalogue claims to have observed these projects on the day this work happened. */
test('D. re-signing did not move the collection date', () => {
  const lines = fs.readFileSync(path.join(REPO, 'catalogue-events.jsonl'), 'utf8').trim().split('\n');
  const stamps = [...new Set(lines.map(line => JSON.parse(line).created_at))];
  expect(stamps).toEqual([1787011200]);
  expect(new Date(1787011200 * 1000).toISOString()).toBe('2026-08-18T00:00:00.000Z');

  const draft = JSON.parse(fs.readFileSync(path.join(REPO, 'real-catalog-draft.json'), 'utf8'));
  expect(Math.floor(Date.parse(`${draft._meta.generated}T00:00:00Z`) / 1000), 'the date the draft records')
    .toBe(1787011200);
  expect(new Set(readData().tools.map(tool => tool.collectedAt))).toEqual(new Set([1787011200]));
});

/* D3. v1 is not deprecated by v2 and is not rewritten into it. The reader accepts both, so a record
   that states version 1 keeps meaning what it meant -- "this record carries no per-language text" --
   and does not become invalid because a later profile exists. */
test('D. the reader still accepts a v1 record after v2 exists', async ({page}) => {
  await page.goto('nip-explorer.html');
  const r = await page.evaluate(() => {
    const V = window.NOSMAPS_CATALOG.validateSoftwareEvent;
    const opts = {nowSec: 1787011200, receivedAtSec: 1787011200};
    const event = version => ({
      id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: 30078, created_at: 1787011100,
      tags: [['d', 'nosmaps:com.example.tool'], ['t', 'nosmaps'], ['state', 'active'], ['v', String(version)]],
      content: JSON.stringify({
        schema: 'org.nosmaps.software', version, state: 'active',
        name: 'Example Tool', summary: 'A relay client.'
      }),
      sig: 'f'.repeat(128)
    });
    const v1 = V(event(1), opts);
    const v2 = V(event(2), opts);
    return {
      v1ok: v1.ok, v1reason: v1.reason || null, v1descriptions: v1.ok ? v1.record.descriptions : undefined,
      v2ok: v2.ok, v2reason: v2.reason || null
    };
  });
  expect(r.v1ok, `a v1 record is still read (${r.v1reason})`).toBe(true);
  expect(r.v1descriptions, 'a v1 record records no language at all').toBeNull();
  expect(r.v2ok, `a v2 record is read too (${r.v2reason})`).toBe(true);
});
