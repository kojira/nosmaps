/* issue #18 phase 2: the write side — producing a record that lands on an
   identifier somebody else already holds.

   Phase 1 guarded the read side. What is guarded here:

   - `d` handed to the draft builder is copied byte for byte, never normalised,
     so a correction lands on the identifier it was aimed at (M1.3);
   - the identifier format is `nosmaps:<normalised canonical URI>` (D2/D6) and
     the normalisation is exactly N1-N6 — scheme kept and lowercased, trailing
     slashes and `.git` removed, authority and path case untouched;
   - a schemeless URI is refused, not completed with `https://` (M1.6.4);
   - the discovery topic `t=nosmaps` is always on the event, or the record is
     signed and invisible (M3.1-5);
   - the draft names no default and points at nothing: no `supersedes`, no
     `corrects`, no collector field (D1);
   - two drafts built by two signers under one `d` stack together under the
     phase 1 grouping, and a one-byte-different `d` does not.

   Nothing here publishes: signing and sending are the tool's job
   (tools/publish-correction.mjs), and this file must run without a relay or a
   key. The real relay run is recorded in the PR, not asserted here.

   Driven through NOSMAPS_CATALOG, the diagnostic surface the other specs use. */

const {test, expect} = require('@playwright/test');

const EXPLORER = 'nip-explorer.html';

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// ---- identifier normalisation (D2 / D6 / N1-N6) ---------------------------

test('a canonical source URI becomes nosmaps:<uri> with the scheme kept', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {normaliseSourceUri} = window.NOSMAPS_CATALOG;
    return {
      https: normaliseSourceUri('https://github.com/damus-io/damus'),
      htree: normaliseSourceUri('htree://npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/iris-client'),
      http: normaliseSourceUri('http://example.com/a')
    };
  });
  // The prefix is written literally so a change to the constant fails here
  // instead of being followed silently.
  expect(r.https.d).toBe('nosmaps:https://github.com/damus-io/damus');
  expect(r.https.problem).toBe(null);
  // N1: a non-http scheme is real data and survives untouched.
  expect(r.htree.d).toBe('nosmaps:htree://npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/iris-client');
  // N1 again: http is NOT upgraded to https. We did not observe that https works.
  expect(r.http.d).toBe('nosmaps:http://example.com/a');
  expect(errors).toEqual([]);
});

test('N2-N4: the scheme name lowercases, trailing slashes and .git go', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {normaliseSourceUri} = window.NOSMAPS_CATALOG;
    return {
      upperScheme: normaliseSourceUri('HTTPS://github.com/a/b').d,
      oneSlash: normaliseSourceUri('https://sr.ht/~gheartsfield/nostr-rs-relay/').d,
      manySlashes: normaliseSourceUri('https://sr.ht/~gheartsfield/nostr-rs-relay///').d,
      dotGit: normaliseSourceUri('https://github.com/a/b.git').d,
      gitThenSlash: normaliseSourceUri('https://github.com/a/b.git/').d
    };
  });
  expect(r.upperScheme).toBe('nosmaps:https://github.com/a/b');            // N2
  expect(r.oneSlash).toBe('nosmaps:https://sr.ht/~gheartsfield/nostr-rs-relay');   // N3
  expect(r.manySlashes).toBe('nosmaps:https://sr.ht/~gheartsfield/nostr-rs-relay'); // N3, "one or more"
  expect(r.dotGit).toBe('nosmaps:https://github.com/a/b');                 // N4
  // Slashes come off before `.git`, so a clone URL with a trailing slash still
  // reaches the same identifier as the plain repo URL.
  expect(r.gitThenSlash).toBe('nosmaps:https://github.com/a/b');
  expect(errors).toEqual([]);
});

test('N5-N6: case in the authority and the path is never folded', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {normaliseSourceUri} = window.NOSMAPS_CATALOG;
    return {
      host: normaliseSourceUri('https://GitHub.com/a/b').d,
      path: normaliseSourceUri('https://github.com/Damus-IO/Damus').d
    };
  });
  // N5: we have no basis for treating every scheme's authority as DNS.
  expect(r.host).toBe('nosmaps:https://GitHub.com/a/b');
  // N6: some hosts distinguish path case; folding would merge two resources.
  expect(r.path).toBe('nosmaps:https://github.com/Damus-IO/Damus');
  // Which means these are deliberately two different identifiers, not one.
  expect(r.path).not.toBe('nosmaps:https://github.com/damus-io/damus');
  expect(errors).toEqual([]);
});

test('a schemeless URI is refused rather than completed', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {normaliseSourceUri} = window.NOSMAPS_CATALOG;
    return {
      bare: normaliseSourceUri('github.com/a/b'),
      empty: normaliseSourceUri('   '),
      schemeOnly: normaliseSourceUri('https://'),
      slashesOnly: normaliseSourceUri('https:////'),
      nonAscii: normaliseSourceUri('https://example.com/日本語'),
      tooLong: normaliseSourceUri(`https://example.com/${'a'.repeat(300)}`)
    };
  });
  expect(r.bare.problem).not.toBe(null);
  expect(r.bare.d).toBe(''); // never a guessed https:// value
  expect(r.empty.problem).not.toBe(null);
  expect(r.schemeOnly.problem).not.toBe(null);
  expect(r.slashesOnly.problem).not.toBe(null);
  expect(r.nonAscii.problem).not.toBe(null); // D_ASCII_RE
  expect(r.tooLong.problem).not.toBe(null);  // D_MAX_BYTES
  expect(errors).toEqual([]);
});

// ---- the correction draft -------------------------------------------------

test('the d handed in is carried byte for byte, never normalised on the way out', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildCorrectionDraft} = window.NOSMAPS_CATALOG;
    const content = {name: 'Damus', summary: 'a second signer', homepage: 'https://damus.io/'};
    // The legacy reverse-domain form the 41 existing records still carry: a
    // correction has to reach THEM, so it must not be rewritten into the new
    // URI shape on the way out.
    const legacy = buildCorrectionDraft('nosmaps:io.damus', content, 1787154683);
    // A `d` that would change under N3/N4 if anyone normalised here.
    const wouldChange = buildCorrectionDraft('nosmaps:https://github.com/a/b.git/', content, 1787154683);
    // Each of N3 and N4 gets its own case, because a rewrite that strips only
    // one of them still lands on a different identifier than the one aimed at.
    const trailingSlash = buildCorrectionDraft('nosmaps:https://github.com/a/b/', content, 1787154683);
    const trailingGit = buildCorrectionDraft('nosmaps:https://github.com/a/b.git', content, 1787154683);
    const upperPath = buildCorrectionDraft('nosmaps:https://GitHub.com/A/B', content, 1787154683);
    const dOf = draft => (draft.event.tags.find(tag => tag[0] === 'd') || [])[1];
    return {
      legacyD: dOf(legacy), legacyProblem: legacy.problem, wouldChangeD: dOf(wouldChange),
      trailingSlashD: dOf(trailingSlash), trailingGitD: dOf(trailingGit), upperPathD: dOf(upperPath)
    };
  });
  expect(r.legacyProblem).toBe(null);
  expect(r.legacyD).toBe('nosmaps:io.damus');
  expect(r.wouldChangeD).toBe('nosmaps:https://github.com/a/b.git/');
  expect(r.trailingSlashD).toBe('nosmaps:https://github.com/a/b/');
  expect(r.trailingGitD).toBe('nosmaps:https://github.com/a/b.git');
  expect(r.upperPathD).toBe('nosmaps:https://GitHub.com/A/B');
  expect(errors).toEqual([]);
});

test('a correction is a kind:30078 record carrying the discovery topic', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildCorrectionDraft} = window.NOSMAPS_CATALOG;
    const {event} = buildCorrectionDraft(
      'nosmaps:io.damus',
      {name: 'Damus', summary: 'a second signer', homepage: 'https://damus.io/'},
      1787154683,
      ['clients', 'nosmaps', 'clients']
    );
    return {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: JSON.parse(event.content),
      keys: Object.keys(event)
    };
  });
  expect(r.kind).toBe(30078);
  expect(r.created_at).toBe(1787154683);
  // Written literally: `t=nosmaps` is what makes the record discoverable, and a
  // correction without it is signed, valid and invisible.
  const topics = r.tags.filter(tag => tag[0] === 't').map(tag => tag[1]);
  expect(topics).toEqual(['nosmaps', 'clients']);
  expect(r.content.schema).toBe('org.nosmaps.software');
  expect(r.content.version).toBe(1);
  expect(r.content.name).toBe('Damus');
  // No pubkey, no id, no sig: this module never touches a key.
  expect(r.keys.sort()).toEqual(['content', 'created_at', 'kind', 'tags']);
  expect(errors).toEqual([]);
});

test('a correction points at nothing and ranks nothing (D1)', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildCorrectionDraft} = window.NOSMAPS_CATALOG;
    const {event} = buildCorrectionDraft(
      'nosmaps:io.damus',
      {name: 'Damus', summary: 'a second signer', homepage: 'https://damus.io/'},
      1787154683
    );
    return {tagNames: event.tags.map(tag => tag[0]), contentKeys: Object.keys(JSON.parse(event.content))};
  });
  // No `e` pointing at the record being corrected, no `a` coordinate, no `p`.
  // Replacement is keyed on kind:pubkey:d; a correction needs no pointer, and a
  // pointer would imply this record supersedes the other one.
  expect(r.tagNames).not.toContain('e');
  expect(r.tagNames).not.toContain('a');
  expect(r.tagNames).not.toContain('p');
  for (const banned of ['supersedes', 'corrects', 'collector', 'primary', 'default']) {
    expect(r.tagNames).not.toContain(banned);
    expect(r.contentKeys).not.toContain(banned);
  }
  expect(errors).toEqual([]);
});

test('a draft with an unusable d or content is refused, never repaired', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildCorrectionDraft} = window.NOSMAPS_CATALOG;
    const ok = {name: 'X', summary: 's', homepage: 'https://x.test/'};
    const at = 1787154683;
    return {
      noPrefix: buildCorrectionDraft('io.damus', ok, at),
      barePrefix: buildCorrectionDraft('nosmaps:', ok, at),
      nonAscii: buildCorrectionDraft('nosmaps:日本語', ok, at),
      badTime: buildCorrectionDraft('nosmaps:io.damus', ok, 1787154683.5),
      noName: buildCorrectionDraft('nosmaps:io.damus', {...ok, name: ''}, at),
      noHome: buildCorrectionDraft('nosmaps:io.damus', {...ok, homepage: ''}, at)
    };
  });
  for (const key of ['noPrefix', 'barePrefix', 'nonAscii', 'badTime', 'noName', 'noHome']) {
    expect(r[key].event, key).toBe(null);
    expect(r[key].problem, key).not.toBe(null);
  }
  expect(errors).toEqual([]);
});

// ---- write side meets read side ------------------------------------------

test('two signers drafting one d stack together; one byte apart they do not', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildCorrectionDraft, stackRecords} = window.NOSMAPS_CATALOG;
    const dOf = draft => (draft.event.tags.find(tag => tag[0] === 'd') || [])[1];
    const shared = 'nosmaps:io.damus';
    const neighbour = 'nosmaps:io.damuz'; // one byte away
    const content = n => ({name: 'Damus', summary: `${n} says so`, homepage: 'https://damus.io/'});
    // Two different signers is modelled by two different pubkeys on the rows;
    // the draft builder itself never sees a key.
    const rows = [
      {pubkey: 'a'.repeat(64), d: dOf(buildCorrectionDraft(shared, content('A'), 1787000000))},
      {pubkey: 'b'.repeat(64), d: dOf(buildCorrectionDraft(shared, content('B'), 1787154683))},
      {pubkey: 'c'.repeat(64), d: dOf(buildCorrectionDraft(neighbour, content('C'), 1787154683))}
    ];
    const stacks = stackRecords(rows, row => row.d, false);
    return stacks.map(stack => ({
      d: stack.d,
      observed: stack.observed,
      complete: stack.complete,
      signers: stack.records.map(row => row.pubkey),
      fields: Object.keys(stack)
    }));
  });
  expect(r.length).toBe(2);
  expect(r[0].d).toBe('nosmaps:io.damus');
  expect(r[0].observed).toBe(2);
  expect(r[0].signers).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
  // Read with incomplete coverage: 2 is a floor, and the type says so.
  expect(r[0].complete).toBe(false);
  // D1: still no field that elects one of the two.
  expect(r[0].fields.sort()).toEqual(['complete', 'd', 'observed', 'records']);
  expect(r[1].d).toBe('nosmaps:io.damuz');
  expect(r[1].observed).toBe(1);
  expect(errors).toEqual([]);
});

// ---- retraction (NIP-09), used only for verification events ---------------

test('a deletion request names the ids and the kind, and refuses bad input', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {buildDeletionDraft} = window.NOSMAPS_CATALOG;
    const id = '7'.repeat(64);
    const good = buildDeletionDraft([id], 1787154683, 'verification event');
    return {
      kind: good.event.kind,
      tags: good.event.tags,
      content: good.event.content,
      empty: buildDeletionDraft([], 1787154683),
      shortId: buildDeletionDraft(['abc'], 1787154683),
      upperId: buildDeletionDraft(['A'.repeat(64)], 1787154683)
    };
  });
  expect(r.kind).toBe(5);
  expect(r.tags).toEqual([['e', '7'.repeat(64)], ['k', '30078']]);
  expect(r.content).toBe('verification event');
  expect(r.empty.event).toBe(null);
  expect(r.shortId.event).toBe(null);
  expect(r.upperId.event).toBe(null); // ids are lowercase hex
  expect(errors).toEqual([]);
});
