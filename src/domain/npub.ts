/* npub (bech32) encoding and decoding, so §6.2 step 2 "paste a pubkey" works.
   Pure domain layer: no DOM, no network, no window. */

import {isLowercaseHex64} from './event.ts';

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32HrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function bech32Polymod(values: readonly number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let j = 0; j < 5; j += 1) {
      if ((top >> j) & 1) chk ^= BECH32_GENERATOR[j] ?? 0;
    }
  }
  return chk;
}

/** Hex in, hex out; null for anything that is not a well-formed npub or
    64-char lowercase hex key. */
export function decodeNpub(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  /* Read as a boolean rather than as a type guard: `s` is already a string, so
     letting the guard narrow it would leave the else-branch typed `never`. */
  const alreadyHex: boolean = isLowercaseHex64(s);
  if (alreadyHex) return s;
  if (s.toLowerCase() !== s && s.toUpperCase() !== s) return null;
  const lower = s.toLowerCase();
  if (lower.indexOf('npub1') !== 0) return null;
  const data = lower.slice(5);
  if (data.length !== 58) return null; // 52 data chars + 6 checksum chars
  const values: number[] = [];
  for (const ch of data) {
    const idx = BECH32_ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    values.push(idx);
  }
  // Checksum over hrp "npub" + data.
  if (bech32Polymod(bech32HrpExpand('npub').concat(values)) !== 1) return null;
  // 5-bit -> 8-bit over the 52 data characters.
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (let i = 0; i < 52; i += 1) {
    acc = (acc << 5) | (values[i] ?? 0);
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if (bytes.length !== 32) return null;
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** The inverse of decodeNpub. NIP-07 hands back 32-byte hex, but the key a user can
    recognise and compare against their own client is the npub, so the viewer is shown
    the bech32 form and never the hex. Returns null rather than a partial string when
    the input is not a 32-byte lowercase hex key -- an npub that does not round-trip
    would be a fabricated identity.

    Non-strings are rejected with null rather than throwing, so the parameter is
    deliberately `unknown` — nip07-signin.spec asserts encodeNpub(null). */
export function encodeNpub(pubkeyHex: unknown): string | null {
  if (typeof pubkeyHex !== 'string') return null;
  const hex = pubkeyHex.trim().toLowerCase();
  if (!isLowercaseHex64(hex)) return null;
  // 8-bit -> 5-bit; 256 bits is 51 full groups plus one bit, zero-padded to 52.
  let acc = 0;
  let bits = 0;
  const values: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    acc = (acc << 8) | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      values.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) values.push((acc << (5 - bits)) & 31);
  const checksum = bech32Polymod(bech32HrpExpand('npub').concat(values, [0, 0, 0, 0, 0, 0])) ^ 1;
  let out = 'npub1';
  for (const value of values) out += BECH32_ALPHABET[value] ?? '';
  for (let i = 0; i < 6; i += 1) out += BECH32_ALPHABET[(checksum >> (5 * (5 - i))) & 31] ?? '';
  return out;
}
