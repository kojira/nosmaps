/* Generates the collector's signing key. Run once; the secret never enters the repository.

   Usage: node tools/new-collector-key.mjs /absolute/path/outside/the/repo/collector.key

   The secret is written to the path you name, with mode 0600, and this script refuses to write
   anywhere inside the working tree so a key cannot be committed by accident. Only the public half
   (hex pubkey and npub) is printed. tools/sign-catalogue.mjs reads the secret back through the
   environment variable NOSMAPS_COLLECTOR_KEY_FILE; nothing else in the pipeline needs it, and
   rebuilding data.js from the signed jsonl needs no key at all.

   Signing uses @rx-nostr/crypto, which the project already depends on (package.json). No
   dependency is added here: nostr-tools is not vendored in this repository.
*/
import {writeFileSync, existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getPublicKey} from '@rx-nostr/crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const target = process.argv[2];
if (!target) {
  process.stderr.write('usage: node tools/new-collector-key.mjs <path outside the repository>\n');
  process.exit(2);
}
const path = resolve(process.cwd(), target);
if (path === REPO || path.startsWith(`${REPO}/`)) {
  process.stderr.write(`refusing to write a secret inside the working tree: ${path}\n`);
  process.exit(2);
}
if (existsSync(path)) {
  process.stderr.write(`refusing to overwrite an existing key: ${path}\n`);
  process.exit(2);
}

/* secp256k1 order. A 32-byte draw at or above it, or zero, is not a valid key; redraw rather than
   reduce, so the key stays uniform. */
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
let seckey = '';
for (;;) {
  const bytes = randomBytes(32);
  const value = BigInt(`0x${bytes.toString('hex')}`);
  if (value > 0n && value < N) { seckey = bytes.toString('hex'); break; }
}

const pubkey = getPublicKey(seckey);
writeFileSync(path, `${seckey}\n`, {mode: 0o600});

/* bech32 (BIP-173) encoding of the npub, so the public half can be quoted without a second
   dependency. Only the public key is ever encoded here. */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}
function convertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const max = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & max); }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & max);
  return out;
}
function bech32(hrp, data) {
  const expanded = [...[...hrp].map(c => c.charCodeAt(0) >> 5), 0, ...[...hrp].map(c => c.charCodeAt(0) & 31)];
  const values = [...expanded, ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i += 1) checksum.push((mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map(v => CHARSET[v]).join('')}`;
}
const npub = bech32('npub', convertBits([...Buffer.from(pubkey, 'hex')], 8, 5, true));

process.stdout.write(`secret written to ${path} (mode 0600, outside the repository)\npubkey ${pubkey}\nnpub   ${npub}\n`);
