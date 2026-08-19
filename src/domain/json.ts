/* Canonical JSON + strict parsing + hashing (RFC 8785 JCS).
   Pure domain layer: no DOM, no network, no window.

   We deliberately DO NOT use JSON.parse: it silently accepts duplicate object
   keys, which the signed-event security boundary must reject.
   See docs/design-relay-native-data.md §3.3 and §7.1. */

/** A value the strict parser can produce, and canonicalize() can serialise. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | {readonly [key: string]: JsonValue};

export type JsonObject = {readonly [key: string]: JsonValue};

/** Parse outcome. The failure carries the reason so callers can report it. */
export type ParseResult =
  | {readonly ok: true; readonly value: JsonValue}
  | {readonly ok: false; readonly error: string};

const textEncoder = new TextEncoder();

export function utf8Encode(str: string): Uint8Array {
  return textEncoder.encode(String(str));
}

export function utf8ByteLength(str: string): number {
  return textEncoder.encode(String(str)).length;
}

export function bytesEqual(a: unknown, b: unknown): boolean {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const SHA256_RE = /^[0-9a-f]{64}$/;

export function isLowercaseSha256Hex(v: unknown): v is string {
  return typeof v === 'string' && SHA256_RE.test(v);
}

export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  // crypto.subtle.digest is available in both browser targets and node globals.
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', input as BufferSource);
  const view = new Uint8Array(digest);
  let out = '';
  for (const byte of view) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/* ---- strict recursive-descent JSON parser ---- */

const NUMBER_TOKEN_RE = /^-?(?:0|[1-9][0-9]*)$/;

/** Thrown only inside the parser; the tag distinguishes our own rejections from
    genuine crashes, so an unexpected error is never reported as a parse reason. */
class StrictParseError extends Error {
  override readonly name = 'StrictParseError';
}

class StrictParser {
  private readonly s: string;
  private readonly n: number;
  private i = 0;

  constructor(text: string) {
    this.s = text;
    this.n = text.length;
  }

  /** How far the parser got. Trailing content is detected by comparing this to the length. */
  get position(): number {
    return this.i;
  }

  get length(): number {
    return this.n;
  }

  /** Character at an offset, or '' past the end. Returning '' rather than undefined
      keeps every comparison below a plain string comparison. */
  private at(offset = 0): string {
    return this.s[this.i + offset] ?? '';
  }

  private error(msg: string): StrictParseError {
    return new StrictParseError(msg);
  }

  skipWs(): void {
    // JSON insignificant whitespace: space, tab, LF, CR only.
    while (this.i < this.n) {
      const c = this.s.charCodeAt(this.i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        this.i += 1;
      } else {
        break;
      }
    }
  }

  parseValue(): JsonValue {
    if (this.i >= this.n) throw this.error('unexpected-end');
    const c = this.at();
    if (c === '{') return this.parseObject();
    if (c === '[') return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
    if (c === 't' || c === 'f') return this.parseBool();
    if (c === 'n') return this.parseNull();
    throw this.error('unexpected-token');
  }

  private parseObject(): JsonObject {
    this.i += 1; // consume {
    const obj: Record<string, JsonValue> = {};
    const seen = new Set<string>();
    this.skipWs();
    if (this.at() === '}') {
      this.i += 1;
      return obj;
    }
    for (;;) {
      this.skipWs();
      if (this.at() !== '"') throw this.error('expected-key');
      const key = this.parseString();
      if (key === '__proto__') throw this.error('proto-key');
      if (seen.has(key)) throw this.error('duplicate-key');
      seen.add(key);
      this.skipWs();
      if (this.at() !== ':') throw this.error('expected-colon');
      this.i += 1;
      this.skipWs();
      const value = this.parseValue();
      // Safe: __proto__ already rejected, so plain assignment cannot alter the prototype.
      obj[key] = value;
      this.skipWs();
      const ch = this.at();
      if (ch === ',') {
        this.i += 1;
        continue;
      }
      if (ch === '}') {
        this.i += 1;
        return obj;
      }
      throw this.error('expected-comma-or-brace');
    }
  }

  private parseArray(): JsonValue[] {
    this.i += 1; // consume [
    const arr: JsonValue[] = [];
    this.skipWs();
    if (this.at() === ']') {
      this.i += 1;
      return arr;
    }
    for (;;) {
      this.skipWs();
      arr.push(this.parseValue());
      this.skipWs();
      const ch = this.at();
      if (ch === ',') {
        this.i += 1;
        continue;
      }
      if (ch === ']') {
        this.i += 1;
        return arr;
      }
      throw this.error('expected-comma-or-bracket');
    }
  }

  private readHex4(): number {
    if (this.i + 4 > this.n) throw this.error('bad-escape');
    let code = 0;
    for (let k = 0; k < 4; k += 1) {
      const c = this.at();
      if (!isHexDigit(c)) throw this.error('bad-escape');
      code = code * 16 + parseInt(c, 16);
      this.i += 1;
    }
    return code;
  }

  private parseString(): string {
    this.i += 1; // consume opening quote
    let out = '';
    for (;;) {
      if (this.i >= this.n) throw this.error('unterminated-string');
      const ch = this.at();
      const code = this.s.charCodeAt(this.i);
      if (ch === '"') {
        this.i += 1;
        return out;
      }
      if (ch === '\\') {
        this.i += 1;
        if (this.i >= this.n) throw this.error('bad-escape');
        const esc = this.at();
        if (esc === '"') { out += '"'; this.i += 1; }
        else if (esc === '\\') { out += '\\'; this.i += 1; }
        else if (esc === '/') { out += '/'; this.i += 1; }
        else if (esc === 'b') { out += '\b'; this.i += 1; }
        else if (esc === 'f') { out += '\f'; this.i += 1; }
        else if (esc === 'n') { out += '\n'; this.i += 1; }
        else if (esc === 'r') { out += '\r'; this.i += 1; }
        else if (esc === 't') { out += '\t'; this.i += 1; }
        else if (esc === 'u') {
          this.i += 1;
          const cp = this.readHex4();
          if (cp >= 0xd800 && cp <= 0xdbff) {
            // high surrogate: must be followed by \u low surrogate
            if (this.at() !== '\\' || this.at(1) !== 'u') {
              throw this.error('lone-surrogate');
            }
            this.i += 2;
            const low = this.readHex4();
            if (low < 0xdc00 || low > 0xdfff) throw this.error('lone-surrogate');
            out += String.fromCharCode(cp) + String.fromCharCode(low);
          } else if (cp >= 0xdc00 && cp <= 0xdfff) {
            throw this.error('lone-surrogate');
          } else {
            out += String.fromCharCode(cp);
          }
        } else {
          throw this.error('bad-escape');
        }
        continue;
      }
      if (code <= 0x1f) throw this.error('unescaped-control');
      // Literal lone surrogates cannot occur because the bytes were decoded with a
      // fatal UTF-8 decoder; well-formed non-ASCII passes through unchanged.
      out += ch;
      this.i += 1;
    }
  }

  private parseNumber(): number {
    const start = this.i;
    if (this.at() === '-') this.i += 1;
    while (this.i < this.n) {
      const c = this.at();
      // Accept only digits here; '.', 'e', 'E', '+' are rejected by the token regex below.
      if ((c >= '0' && c <= '9') || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') {
        this.i += 1;
      } else {
        break;
      }
    }
    const token = this.s.slice(start, this.i);
    if (!NUMBER_TOKEN_RE.test(token)) throw this.error('bad-number');
    if (token === '-0') throw this.error('negative-zero');
    const value = Number(token);
    if (!Number.isSafeInteger(value)) throw this.error('unsafe-integer');
    return value;
  }

  private parseBool(): boolean {
    if (this.s.startsWith('true', this.i)) { this.i += 4; return true; }
    if (this.s.startsWith('false', this.i)) { this.i += 5; return false; }
    throw this.error('bad-literal');
  }

  private parseNull(): null {
    if (this.s.startsWith('null', this.i)) { this.i += 4; return null; }
    throw this.error('bad-literal');
  }
}

function isHexDigit(c: string): boolean {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

/** The security boundary: bytes in, a JSON value or a stated reason out. Never throws. */
export function strictParse(bytes: unknown): ParseResult {
  if (!(bytes instanceof Uint8Array)) {
    return {ok: false, error: 'not-bytes'};
  }
  let text: string;
  try {
    // ignoreBOM keeps a leading U+FEFF in the decoded string so we can reject it;
    // the default decoder silently strips the BOM, which would defeat the check.
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    return {ok: false, error: 'invalid-utf8'};
  }
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return {ok: false, error: 'bom'};
  }
  const parser = new StrictParser(text);
  let value: JsonValue;
  try {
    parser.skipWs();
    value = parser.parseValue();
    parser.skipWs();
  } catch (err) {
    return {ok: false, error: err instanceof StrictParseError ? err.message : 'parse-error'};
  }
  if (parser.position !== parser.length) {
    return {ok: false, error: 'trailing-content'};
  }
  return {ok: true, value};
}

/* ---- RFC 8785 canonicalization ---- */

function canonicalizeString(str: string): string {
  let out = '"';
  for (let i = 0; i < str.length; i += 1) {
    const c = str[i] ?? '';
    const code = str.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === '\\') out += '\\\\';
    else if (code === 0x08) out += '\\b';
    else if (code === 0x09) out += '\\t';
    else if (code === 0x0a) out += '\\n';
    else if (code === 0x0c) out += '\\f';
    else if (code === 0x0d) out += '\\r';
    else if (code <= 0x1f) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += c; // non-ASCII emitted literally per RFC 8785 §3.2.2.2
  }
  return out + '"';
}

function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    // Only the safe integers admitted by strictParse are supported.
    if (!Number.isFinite(value) || !Number.isInteger(value) ||
        !Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error('canonicalize-unsupported-number');
    }
    return String(value);
  }
  if (typeof value === 'string') return canonicalizeString(value);
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i += 1) {
      if (i > 0) out += ',';
      out += canonicalizeValue(value[i]);
    }
    return out + ']';
  }
  if (t === 'object') {
    // Sort keys by UTF-16 code-unit order (default JS string sort), per RFC 8785.
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    let out = '{';
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === undefined) continue;
      if (i > 0) out += ',';
      out += canonicalizeString(key) + ':' + canonicalizeValue(record[key]);
    }
    return out + '}';
  }
  throw new Error('canonicalize-unsupported-value');
}

export function canonicalize(value: unknown): Uint8Array {
  return utf8Encode(canonicalizeValue(value));
}

export function isCanonicalBytes(bytes: unknown, value: unknown): boolean {
  if (!(bytes instanceof Uint8Array)) return false;
  let canon: Uint8Array;
  try {
    canon = canonicalize(value);
  } catch {
    return false;
  }
  return bytesEqual(canon, bytes);
}
