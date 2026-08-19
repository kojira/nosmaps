/* Enforces the one-way dependency rule: domain <- data <- ui <- entry.

   A module may import from its own layer or from a layer to its left. A reverse
   import (domain importing data, data importing ui, ui importing entry) is a
   design error, not a style preference: the pure layer stops being testable
   without a DOM the moment it can reach one.

   This runs in `npm run typecheck` and in `npm test` so a reverse import fails
   the build rather than being noticed in review. Exit code 0 only if every
   import obeys the direction. Run: node tools/check-layering.mjs */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;

/** Left to right. An import may only point at the same rank or lower. */
const RANK = {domain: 0, data: 1, ui: 2, entry: 3};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^;'"]*from\s*['"]([^'"]+)['"]/g;

const failures = [];
let checked = 0;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const layer = rel.split('/')[0];
  if (!(layer in RANK)) continue;
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    checked += 1;
    const target = /(?:^|\/)(domain|data|ui|entry)\//.exec(specifier);
    if (!target) continue;
    const targetLayer = target[1];
    if (RANK[targetLayer] > RANK[layer]) {
      failures.push(`src/${rel}: ${layer} imports ${targetLayer} (${specifier})`);
    }
  }
}

const report = `layers: domain <- data <- ui <- entry\nrelative imports checked: ${checked}`;
if (failures.length) {
  process.stdout.write(`${report}\nFAIL: ${failures.length} reverse import(s)\n${failures.map(f => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${report}\nOK: every import points at its own layer or a lower one\n`);
