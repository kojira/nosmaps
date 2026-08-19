/* Reconstitutes the pre-port explorer page so tools/diff-explorer.mjs has a real
   thing to compare against.

   The seven classic root scripts were deleted once nip-explorer.html became
   dist-only, but they are still in git, so the comparison stays repeatable
   instead of becoming a claim nobody can re-check. This writes them (and the old
   html) into a scratch directory served alongside the site, and it uses `git
   show` — it never touches the working tree, and it never runs checkout/restore.

   Run: node tools/restore-original-explorer.mjs [ref]   (default ref: HEAD)
   Then: NOSMAPS_ORIGINAL_PAGE=original/nip-explorer.html node tools/diff-explorer.mjs */
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.argv[2] || 'HEAD';
const OUT = join(ROOT, 'original');

const SCRIPTS = [
  'i18n.js', 'icons.js', 'nostr-canonical.js', 'nostr-catalog.js',
  'nip-explorer.js', 'site-footer.js', 'landing.js'
];

mkdirSync(OUT, {recursive: true});

function fromGit(path) {
  return execFileSync('git', ['show', `${REF}:${path}`], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024});
}

for (const name of SCRIPTS) {
  writeFileSync(join(OUT, name), fromGit(name));
}

/* The html moves down a directory, so the assets it does NOT own — the stylesheets,
   the generated data.js and the two rx-nostr bundles — have to keep resolving to
   the ones the real page uses. Only the six script srcs stay local. */
const html = fromGit('nip-explorer.html').toString('utf8')
  .replace(/(href|src)="(?!https?:|\/\/)([^"]+)"/g, (match, attr, value) => {
    const file = value.split('?')[0];
    return SCRIPTS.includes(file) ? match : `${attr}="../${value}"`;
  });
writeFileSync(join(OUT, 'nip-explorer.html'), html);

process.stdout.write(`restored from ${REF}: ${SCRIPTS.join(', ')}\n`);
process.stdout.write(`wrote original/nip-explorer.html (the pre-port page, loading the classic scripts)\n`);
