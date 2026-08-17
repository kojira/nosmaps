// node_modules/.pnpm/rx-nostr@3.7.5/node_modules/rx-nostr/dist/rx-nostr.js
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var RxNostrError = class extends Error {
};
var RxNostrWebSocketError = class extends RxNostrError {
  constructor(code) {
    super(
      `RxNostrWebSocketError: WebSocket was closed with code ${code} by relay.`
    );
    this.code = code;
    this.name = "RxNostrWebSocketError";
  }
};
var RxNostrInvalidUsageError = class extends RxNostrError {
  constructor(message) {
    super(`RxNostrInvalidUsageError: ${message}`);
    this.name = "RxNostrInvalidUsageError";
  }
};
var RxNostrEnvironmentError = class extends RxNostrError {
  constructor(message) {
    super(`RxNostrEnvironmentError: ${message}`);
    this.name = "RxNostrEnvironmentError";
  }
};
var RxNostrLogicError = class extends RxNostrError {
  constructor() {
    super(
      "RxNostrLogicError: This is rx-nostr's internal bug. Please report to the author of the library."
    );
    this.name = "RxNostrLogicError";
  }
};
var RxNostrAlreadyDisposedError = class extends RxNostrError {
  constructor() {
    super(
      "RxNostrAlreadyDisposedError: Attempted to access a disposed resource."
    );
    this.name = "RxNostrAlreadyDisposedError";
  }
};
var fill = (config2, defaults) => ({
  ...defaults,
  ...config2
});
function ensureEventFields(event) {
  if (typeof event.id !== "string")
    return false;
  if (typeof event.sig !== "string")
    return false;
  if (typeof event.kind !== "number")
    return false;
  if (typeof event.pubkey !== "string")
    return false;
  if (typeof event.content !== "string")
    return false;
  if (typeof event.created_at !== "number")
    return false;
  if (!Array.isArray(event.tags))
    return false;
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!Array.isArray(tag))
      return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object")
        return false;
    }
  }
  return true;
}
function earlierEvent(a, b) {
  return compareEvents(a, b) < 0 ? a : b;
}
function laterEvent(a, b) {
  return compareEvents(a, b) < 0 ? b : a;
}
function compareEvents(a, b) {
  if (a.id === b.id) {
    return 0;
  }
  return a.created_at < b.created_at || // https://github.com/nostr-protocol/nips/blob/master/16.md#replaceable-events
  a.created_at === b.created_at && a.id < b.id ? -1 : 1;
}
function inlineThrow(err) {
  throw err;
}
function nip07Signer(options) {
  return {
    async signEvent(params) {
      var _a, _b;
      const event = {
        ...params,
        pubkey: params.pubkey ?? await ((_a = window == null ? void 0 : window.nostr) == null ? void 0 : _a.getPublicKey()) ?? inlineThrow(
          new RxNostrEnvironmentError(
            "window.nostr.getPublicKey() is not found"
          )
        ),
        tags: [...params.tags ?? [], ...(options == null ? void 0 : options.tags) ?? []],
        created_at: params.created_at ?? Math.floor(Date.now() / 1e3)
      };
      if (ensureEventFields(event)) {
        return event;
      }
      return await ((_b = window == null ? void 0 : window.nostr) == null ? void 0 : _b.signEvent(event)) ?? inlineThrow(
        new RxNostrEnvironmentError("window.nostr.signEvent() is not found")
      );
    },
    getPublicKey() {
      var _a;
      return ((_a = window == null ? void 0 : window.nostr) == null ? void 0 : _a.getPublicKey()) ?? inlineThrow(
        new RxNostrEnvironmentError(
          "window.nostr.getPublicKey() is not found"
        )
      );
    }
  };
}
function noopSigner() {
  return {
    async signEvent(params) {
      return params;
    },
    async getPublicKey() {
      throw new RxNostrInvalidUsageError("noopSigner cannot calculate pubkey.");
    }
  };
}
var noopVerifier = async () => true;
var emptyVerifier = async () => {
  throw new Error(
    "You must give some verifier to createRxNostr(). In most cases, @rx-nostr/crypto packages will help you."
  );
};
var makeRxNostrConfig = (config2) => fill(config2, {
  signer: nip07Signer(),
  verifier: emptyVerifier,
  connectionStrategy: "lazy",
  retry: {
    strategy: "exponential",
    maxCount: 5,
    initialDelay: 1e3
  },
  disconnectTimeout: 1e4,
  eoseTimeout: 30 * 1e3,
  okTimeout: 30 * 1e3,
  authTimeout: 30 * 1e3,
  skipVerify: false,
  skipValidateFilterMatching: false,
  skipExpirationCheck: false,
  skipFetchNip11: false
});
function evalFilters(filters) {
  if ("length" in filters) {
    return filters.map(evalFilter);
  } else {
    return [evalFilter(filters)];
  }
}
function evalFilter(filter2) {
  return {
    ...filter2,
    since: filter2.since ? evalLazyNumber(filter2.since) : void 0,
    until: filter2.until ? evalLazyNumber(filter2.until) : void 0
  };
}
function evalLazyNumber(lazyNumber) {
  return typeof lazyNumber === "number" ? lazyNumber : lazyNumber();
}
async function fetchRelayInfo(url) {
  try {
    const u = new URL(url);
    u.protocol = u.protocol.replace(/^ws(s?):/, "http$1:");
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/nostr+json" }
    });
    return await res.json();
  } catch {
    return {};
  }
}
function inlineTry(f, g) {
  try {
    return f();
  } catch (err) {
    if (g instanceof Function) {
      return g(err);
    } else {
      return g;
    }
  }
}
function normalizeRelayUrl(url) {
  let o = "";
  try {
    o = url.trim();
    const u = new URL(o);
    u.hash = "";
    u.pathname = inlineTry(() => decodeURI(u.pathname), u.pathname);
    u.pathname = u.pathname.replace(/\/$/, "");
    u.hostname = u.hostname.replace(/\.$/, "");
    u.searchParams.sort();
    u.search = inlineTry(() => decodeURIComponent(u.search), u.search);
    let s = u.toString();
    if (!u.search) {
      s = s.replace(/\/$/, "");
    }
    return s;
  } catch {
    return o;
  }
}
var UrlMap = class _UrlMap extends Map {
  constructor(obj) {
    super();
    if (!obj) {
      return;
    }
    for (const [url, v] of Object.entries(obj)) {
      this.set(normalizeRelayUrl(url), v);
    }
  }
  get(url) {
    return super.get(normalizeRelayUrl(url));
  }
  getMany(urls) {
    const vs = [];
    for (const url of new Set(urls.map(normalizeRelayUrl))) {
      const v = this.get(url);
      if (v !== void 0) {
        vs.push(v);
      }
    }
    return vs;
  }
  set(url, v) {
    return super.set(normalizeRelayUrl(url), v);
  }
  has(url) {
    return super.has(normalizeRelayUrl(url));
  }
  delete(url) {
    return super.delete(normalizeRelayUrl(url));
  }
  toObject() {
    const obj = {};
    for (const [url, v] of this.entries()) {
      obj[url] = v;
    }
    return obj;
  }
  toKeys() {
    return [...super.keys()];
  }
  toValues() {
    return [...super.values()];
  }
  copy() {
    return new _UrlMap(this.toObject());
  }
};
var Nip11Registry = class {
  static async getValue(url, getter, options) {
    if (!(options == null ? void 0 : options.skipCache)) {
      const data = await this.cache.get(url);
      if (data) {
        return getter(data);
      }
    }
    if (!(options == null ? void 0 : options.skipFetch)) {
      const data = await this.fetch(url);
      if (data) {
        return getter(data);
      }
    }
    return getter(this.default);
  }
  /**
   * Return cached or `set()`'ed NIP-11 information.
   */
  static get(url) {
    const v = this.cache.get(url);
    if (v && !(v instanceof Promise)) {
      return v;
    } else {
      return void 0;
    }
  }
  /**
   * Cache fetched information then return it.
   */
  static async fetch(url) {
    const promise = fetchRelayInfo(url);
    this.cache.set(url, promise);
    promise.then((v) => {
      this.cache.set(url, v);
    });
    return promise;
  }
  /**
   * Return cached or `set()`'ed NIP-11 information,
   * or cache fetched information then return it.
   */
  static async getOrFetch(url) {
    return this.cache.get(url) ?? this.fetch(url);
  }
  /**
   * Set NIP-11 information manually for given relay URL.
   */
  static set(url, nip11) {
    this.cache.set(url, nip11);
  }
  /**
   * Get NIP-11 information for fallback.
   */
  static getDefault() {
    return this.default;
  }
  /**
   * Set NIP-11 information for fallback.
   */
  static setDefault(nip11) {
    this.default = nip11;
  }
  /**
   * Forget cached NIP-11 information for given relay URL.
   */
  static forget(url) {
    this.cache.delete(url);
  }
  /**
   * Forget all cached NIP-11 information.
   *
   * This doesn't erase `setDefault()`'ed value.
   * If you want it, you can `setDefault({})` instead.
   */
  static forgetAll() {
    this.cache.clear();
  }
};
__publicField(Nip11Registry, "cache", new UrlMap());
__publicField(Nip11Registry, "default", {});
function isBytes$1(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abytes(value, length, title = "") {
  const bytes = isBytes$1(value);
  const len = value == null ? void 0 : value.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  return value;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function isArrayOf(isString, arr) {
  if (!Array.isArray(arr))
    return false;
  if (arr.length === 0)
    return true;
  if (isString) {
    return arr.every((item) => typeof item === "string");
  } else {
    return arr.every((item) => Number.isSafeInteger(item));
  }
}
function afn(input) {
  if (typeof input !== "function")
    throw new Error("function expected");
  return true;
}
function astr(label, input) {
  if (typeof input !== "string")
    throw new Error(`${label}: string expected`);
  return true;
}
function anumber(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`invalid integer: ${n}`);
}
function aArr(input) {
  if (!Array.isArray(input))
    throw new Error("array expected");
}
function astrArr(label, input) {
  if (!isArrayOf(true, input))
    throw new Error(`${label}: array of strings expected`);
}
function anumArr(label, input) {
  if (!isArrayOf(false, input))
    throw new Error(`${label}: array of numbers expected`);
}
// @__NO_SIDE_EFFECTS__
function chain(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode = args.map((x) => x.decode).reduce(wrap, id);
  return { encode, decode };
}
// @__NO_SIDE_EFFECTS__
function alphabet(letters) {
  const lettersA = typeof letters === "string" ? letters.split("") : letters;
  const len = lettersA.length;
  astrArr("alphabet", lettersA);
  const indexes = new Map(lettersA.map((l, i) => [l, i]));
  return {
    encode: (digits) => {
      aArr(digits);
      return digits.map((i) => {
        if (!Number.isSafeInteger(i) || i < 0 || i >= len)
          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
        return lettersA[i];
      });
    },
    decode: (input) => {
      aArr(input);
      return input.map((letter) => {
        astr("alphabet.decode", letter);
        const i = indexes.get(letter);
        if (i === void 0)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
        return i;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join(separator = "") {
  astr("join", separator);
  return {
    encode: (from2) => {
      astrArr("join.decode", from2);
      return from2.join(separator);
    },
    decode: (to) => {
      astr("join.decode", to);
      return to.split(separator);
    }
  };
}
var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
var radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from2, to) => from2 + (to - gcd(from2, to));
var powers = /* @__PURE__ */ (() => {
  let res = [];
  for (let i = 0; i < 40; i++)
    res.push(2 ** i);
  return res;
})();
function convertRadix2(data, from2, to, padding) {
  aArr(data);
  if (from2 <= 0 || from2 > 32)
    throw new Error(`convertRadix2: wrong from=${from2}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry(from2, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from2} to=${to} carryBits=${/* @__PURE__ */ radix2carry(from2, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const max = powers[from2];
  const mask = powers[to] - 1;
  const res = [];
  for (const n of data) {
    anumber(n);
    if (n >= max)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from2}`);
    carry = carry << from2 | n;
    if (pos + from2 > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from2}`);
    pos += from2;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    const pow = powers[pos];
    if (pow === void 0)
      throw new Error("invalid carry");
    carry &= pow - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding && pos >= from2)
    throw new Error("Excess padding");
  if (!padding && carry > 0)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding && pos > 0)
    res.push(carry >>> 0);
  return res;
}
// @__NO_SIDE_EFFECTS__
function radix2(bits, revPadding = false) {
  anumber(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry(8, bits) > 32 || /* @__PURE__ */ radix2carry(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes(bytes))
        throw new Error("radix2.encode input should be Uint8Array");
      return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      anumArr("radix2.decode", digits);
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
function unsafeWrapper(fn) {
  afn(fn);
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
var BECH_ALPHABET = /* @__PURE__ */ chain(/* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join(""));
var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i];
  }
  return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i = 0; i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }
  chk = bech32Polymod(chk);
  for (let i = 0; i < len; i++)
    chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = bech32Polymod(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET.encode(convertRadix2([chk % powers[30]], 30, 5, false));
}
// @__NO_SIDE_EFFECTS__
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = /* @__PURE__ */ radix2(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper(fromWords);
  function encode(prefix, words, limit = 90) {
    astr("bech32.encode prefix", prefix);
    if (isBytes(words))
      words = Array.from(words);
    anumArr("bech32.encode", words);
    const plen = prefix.length;
    if (plen === 0)
      throw new TypeError(`Invalid prefix length ${plen}`);
    const actualLength = plen + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    const lowered = prefix.toLowerCase();
    const sum = bechChecksum(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
  }
  function decode(str, limit = 90) {
    astr("bech32.decode input", str);
    const slen = str.length;
    if (slen < 8 || limit !== false && slen > limit)
      throw new TypeError(`invalid string length: ${slen} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase())
      throw new Error(`String must be lowercase or uppercase`);
    const sepIndex = lowered.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix = lowered.slice(0, sepIndex);
    const data = lowered.slice(sepIndex + 1);
    if (data.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const words = BECH_ALPHABET.decode(data).slice(0, -6);
    const sum = bechChecksum(prefix, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix, words };
  }
  const decodeUnsafe = unsafeWrapper(decode);
  function decodeToBytes(str) {
    const { prefix, words } = decode(str, false);
    return { prefix, words, bytes: fromWords(words) };
  }
  function encodeFromBytes(prefix, bytes) {
    return encode(prefix, toWords(bytes));
  }
  return {
    encode,
    decode,
    encodeFromBytes,
    decodeToBytes,
    decodeUnsafe,
    fromWords,
    fromWordsUnsafe,
    toWords
  };
}
var bech32 = /* @__PURE__ */ genBech32("bech32");
function toHex(str) {
  const { words } = bech32.decode(str);
  const data = new Uint8Array(bech32.fromWords(words));
  return bytesToHex(data);
}
function isFiltered(event, filters, options) {
  if (Array.isArray(filters)) {
    return filters.some((filter2) => _isFiltered(event, filter2, options));
  } else {
    return _isFiltered(event, filters, options);
  }
}
function _isFiltered(event, filter2, options) {
  const { sinceInclusive, untilInclusive } = fill(options ?? {}, {
    sinceInclusive: true,
    untilInclusive: true
  });
  if (filter2.ids && filter2.ids.every((prefix) => !event.id.startsWith(prefix))) {
    return false;
  }
  if (filter2.kinds && !filter2.kinds.includes(event.kind)) {
    return false;
  }
  if (filter2.authors && filter2.authors.every((pubkey) => !event.pubkey.startsWith(pubkey))) {
    return false;
  }
  if (filter2.since && (sinceInclusive && !(filter2.since <= event.created_at) || !sinceInclusive && !(filter2.since < event.created_at))) {
    return false;
  }
  if (filter2.until && (untilInclusive && !(event.created_at <= filter2.until) || !untilInclusive && !(event.created_at < filter2.until))) {
    return false;
  }
  for (const [key, needleValues] of Object.entries(filter2)) {
    if (!key.startsWith("#") || !Array.isArray(needleValues)) {
      continue;
    }
    const needleTagName = key.slice(1);
    if (!event.tags.find(
      ([tagName, tagValue]) => needleTagName === tagName && needleValues.includes(tagValue)
    )) {
      return false;
    }
  }
  return true;
}
function isExpired(event, now2) {
  const tag = event.tags.find((tag2) => tag2[0] === "expiration");
  if (!tag) {
    return false;
  }
  try {
    const timestamp = Number(tag[1]);
    if (!Number.isInteger(timestamp)) {
      return false;
    }
    return timestamp <= (now2 ?? Math.floor(Date.now() / 1e3));
  } catch {
    return false;
  }
}
var extendStatics = function(d, b) {
  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
    d2.__proto__ = b2;
  } || function(d2, b2) {
    for (var p in b2)
      if (Object.prototype.hasOwnProperty.call(b2, p))
        d2[p] = b2[p];
  };
  return extendStatics(d, b);
};
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1)
      throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g;
  return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f)
      throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _)
      try {
        if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
          return t;
        if (y = 0, t)
          op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _.label++;
            return { value: op[1], done: false };
          case 5:
            _.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _.ops.pop();
            _.trys.pop();
            continue;
          default:
            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _ = 0;
              continue;
            }
            if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
              _.label = op[1];
              break;
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1];
              t = op;
              break;
            }
            if (t && _.label < t[2]) {
              _.label = t[2];
              _.ops.push(op);
              break;
            }
            if (t[2])
              _.ops.pop();
            _.trys.pop();
            continue;
        }
        op = body.call(thisArg, _);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
    if (op[0] & 5)
      throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m)
    return m.call(o);
  if (o && typeof o.length === "number")
    return {
      next: function() {
        if (o && i >= o.length)
          o = void 0;
        return { value: o && o[i++], done: !o };
      }
    };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m)
    return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
      ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"]))
        m.call(i);
    } finally {
      if (e)
        throw e.error;
    }
  }
  return ar;
}
function __spreadArray(to, from2, pack) {
  if (pack || arguments.length === 2)
    for (var i = 0, l = from2.length, ar; i < l; i++) {
      if (ar || !(i in from2)) {
        if (!ar)
          ar = Array.prototype.slice.call(from2, 0, i);
        ar[i] = from2[i];
      }
    }
  return to.concat(ar || Array.prototype.slice.call(from2));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator)
    throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function verb(n) {
    if (g[n])
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length)
      resume(q[0][0], q[0][1]);
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator)
    throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
function isFunction(value) {
  return typeof value === "function";
}
function createErrorClass(createImpl) {
  var _super = function(instance) {
    Error.call(instance);
    instance.stack = new Error().stack;
  };
  var ctorFunc = createImpl(_super);
  ctorFunc.prototype = Object.create(Error.prototype);
  ctorFunc.prototype.constructor = ctorFunc;
  return ctorFunc;
}
var UnsubscriptionError = createErrorClass(function(_super) {
  return function UnsubscriptionErrorImpl(errors) {
    _super(this);
    this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i) {
      return i + 1 + ") " + err.toString();
    }).join("\n  ") : "";
    this.name = "UnsubscriptionError";
    this.errors = errors;
  };
});
function arrRemove(arr, item) {
  if (arr) {
    var index = arr.indexOf(item);
    0 <= index && arr.splice(index, 1);
  }
}
var Subscription = (function() {
  function Subscription2(initialTeardown) {
    this.initialTeardown = initialTeardown;
    this.closed = false;
    this._parentage = null;
    this._finalizers = null;
  }
  Subscription2.prototype.unsubscribe = function() {
    var e_1, _a, e_2, _b;
    var errors;
    if (!this.closed) {
      this.closed = true;
      var _parentage = this._parentage;
      if (_parentage) {
        this._parentage = null;
        if (Array.isArray(_parentage)) {
          try {
            for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) {
              var parent_1 = _parentage_1_1.value;
              parent_1.remove(this);
            }
          } catch (e_1_1) {
            e_1 = { error: e_1_1 };
          } finally {
            try {
              if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return))
                _a.call(_parentage_1);
            } finally {
              if (e_1)
                throw e_1.error;
            }
          }
        } else {
          _parentage.remove(this);
        }
      }
      var initialFinalizer = this.initialTeardown;
      if (isFunction(initialFinalizer)) {
        try {
          initialFinalizer();
        } catch (e) {
          errors = e instanceof UnsubscriptionError ? e.errors : [e];
        }
      }
      var _finalizers = this._finalizers;
      if (_finalizers) {
        this._finalizers = null;
        try {
          for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
            var finalizer = _finalizers_1_1.value;
            try {
              execFinalizer(finalizer);
            } catch (err) {
              errors = errors !== null && errors !== void 0 ? errors : [];
              if (err instanceof UnsubscriptionError) {
                errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
              } else {
                errors.push(err);
              }
            }
          }
        } catch (e_2_1) {
          e_2 = { error: e_2_1 };
        } finally {
          try {
            if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return))
              _b.call(_finalizers_1);
          } finally {
            if (e_2)
              throw e_2.error;
          }
        }
      }
      if (errors) {
        throw new UnsubscriptionError(errors);
      }
    }
  };
  Subscription2.prototype.add = function(teardown) {
    var _a;
    if (teardown && teardown !== this) {
      if (this.closed) {
        execFinalizer(teardown);
      } else {
        if (teardown instanceof Subscription2) {
          if (teardown.closed || teardown._hasParent(this)) {
            return;
          }
          teardown._addParent(this);
        }
        (this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
      }
    }
  };
  Subscription2.prototype._hasParent = function(parent) {
    var _parentage = this._parentage;
    return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
  };
  Subscription2.prototype._addParent = function(parent) {
    var _parentage = this._parentage;
    this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
  };
  Subscription2.prototype._removeParent = function(parent) {
    var _parentage = this._parentage;
    if (_parentage === parent) {
      this._parentage = null;
    } else if (Array.isArray(_parentage)) {
      arrRemove(_parentage, parent);
    }
  };
  Subscription2.prototype.remove = function(teardown) {
    var _finalizers = this._finalizers;
    _finalizers && arrRemove(_finalizers, teardown);
    if (teardown instanceof Subscription2) {
      teardown._removeParent(this);
    }
  };
  Subscription2.EMPTY = (function() {
    var empty = new Subscription2();
    empty.closed = true;
    return empty;
  })();
  return Subscription2;
})();
var EMPTY_SUBSCRIPTION = Subscription.EMPTY;
function isSubscription(value) {
  return value instanceof Subscription || value && "closed" in value && isFunction(value.remove) && isFunction(value.add) && isFunction(value.unsubscribe);
}
function execFinalizer(finalizer) {
  if (isFunction(finalizer)) {
    finalizer();
  } else {
    finalizer.unsubscribe();
  }
}
var config = {
  onUnhandledError: null,
  onStoppedNotification: null,
  Promise: void 0,
  useDeprecatedSynchronousErrorHandling: false,
  useDeprecatedNextContext: false
};
var timeoutProvider = {
  setTimeout: function(handler, timeout2) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }
    var delegate = timeoutProvider.delegate;
    if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) {
      return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout2], __read(args)));
    }
    return setTimeout.apply(void 0, __spreadArray([handler, timeout2], __read(args)));
  },
  clearTimeout: function(handle) {
    var delegate = timeoutProvider.delegate;
    return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
  },
  delegate: void 0
};
function reportUnhandledError(err) {
  timeoutProvider.setTimeout(function() {
    {
      throw err;
    }
  });
}
function noop() {
}
function errorContext(cb) {
  {
    cb();
  }
}
var Subscriber = (function(_super) {
  __extends(Subscriber2, _super);
  function Subscriber2(destination) {
    var _this = _super.call(this) || this;
    _this.isStopped = false;
    if (destination) {
      _this.destination = destination;
      if (isSubscription(destination)) {
        destination.add(_this);
      }
    } else {
      _this.destination = EMPTY_OBSERVER;
    }
    return _this;
  }
  Subscriber2.create = function(next, error, complete) {
    return new SafeSubscriber(next, error, complete);
  };
  Subscriber2.prototype.next = function(value) {
    if (this.isStopped)
      ;
    else {
      this._next(value);
    }
  };
  Subscriber2.prototype.error = function(err) {
    if (this.isStopped)
      ;
    else {
      this.isStopped = true;
      this._error(err);
    }
  };
  Subscriber2.prototype.complete = function() {
    if (this.isStopped)
      ;
    else {
      this.isStopped = true;
      this._complete();
    }
  };
  Subscriber2.prototype.unsubscribe = function() {
    if (!this.closed) {
      this.isStopped = true;
      _super.prototype.unsubscribe.call(this);
      this.destination = null;
    }
  };
  Subscriber2.prototype._next = function(value) {
    this.destination.next(value);
  };
  Subscriber2.prototype._error = function(err) {
    try {
      this.destination.error(err);
    } finally {
      this.unsubscribe();
    }
  };
  Subscriber2.prototype._complete = function() {
    try {
      this.destination.complete();
    } finally {
      this.unsubscribe();
    }
  };
  return Subscriber2;
})(Subscription);
var _bind = Function.prototype.bind;
function bind(fn, thisArg) {
  return _bind.call(fn, thisArg);
}
var ConsumerObserver = (function() {
  function ConsumerObserver2(partialObserver) {
    this.partialObserver = partialObserver;
  }
  ConsumerObserver2.prototype.next = function(value) {
    var partialObserver = this.partialObserver;
    if (partialObserver.next) {
      try {
        partialObserver.next(value);
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  };
  ConsumerObserver2.prototype.error = function(err) {
    var partialObserver = this.partialObserver;
    if (partialObserver.error) {
      try {
        partialObserver.error(err);
      } catch (error) {
        handleUnhandledError(error);
      }
    } else {
      handleUnhandledError(err);
    }
  };
  ConsumerObserver2.prototype.complete = function() {
    var partialObserver = this.partialObserver;
    if (partialObserver.complete) {
      try {
        partialObserver.complete();
      } catch (error) {
        handleUnhandledError(error);
      }
    }
  };
  return ConsumerObserver2;
})();
var SafeSubscriber = (function(_super) {
  __extends(SafeSubscriber2, _super);
  function SafeSubscriber2(observerOrNext, error, complete) {
    var _this = _super.call(this) || this;
    var partialObserver;
    if (isFunction(observerOrNext) || !observerOrNext) {
      partialObserver = {
        next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
        error: error !== null && error !== void 0 ? error : void 0,
        complete: complete !== null && complete !== void 0 ? complete : void 0
      };
    } else {
      var context_1;
      if (_this && config.useDeprecatedNextContext) {
        context_1 = Object.create(observerOrNext);
        context_1.unsubscribe = function() {
          return _this.unsubscribe();
        };
        partialObserver = {
          next: observerOrNext.next && bind(observerOrNext.next, context_1),
          error: observerOrNext.error && bind(observerOrNext.error, context_1),
          complete: observerOrNext.complete && bind(observerOrNext.complete, context_1)
        };
      } else {
        partialObserver = observerOrNext;
      }
    }
    _this.destination = new ConsumerObserver(partialObserver);
    return _this;
  }
  return SafeSubscriber2;
})(Subscriber);
function handleUnhandledError(error) {
  {
    reportUnhandledError(error);
  }
}
function defaultErrorHandler(err) {
  throw err;
}
var EMPTY_OBSERVER = {
  closed: true,
  next: noop,
  error: defaultErrorHandler,
  complete: noop
};
var observable = (function() {
  return typeof Symbol === "function" && Symbol.observable || "@@observable";
})();
function identity(x) {
  return x;
}
function pipe() {
  var fns = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    fns[_i] = arguments[_i];
  }
  return pipeFromArray(fns);
}
function pipeFromArray(fns) {
  if (fns.length === 0) {
    return identity;
  }
  if (fns.length === 1) {
    return fns[0];
  }
  return function piped(input) {
    return fns.reduce(function(prev, fn) {
      return fn(prev);
    }, input);
  };
}
var Observable = (function() {
  function Observable2(subscribe) {
    if (subscribe) {
      this._subscribe = subscribe;
    }
  }
  Observable2.prototype.lift = function(operator) {
    var observable2 = new Observable2();
    observable2.source = this;
    observable2.operator = operator;
    return observable2;
  };
  Observable2.prototype.subscribe = function(observerOrNext, error, complete) {
    var _this = this;
    var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
    errorContext(function() {
      var _a = _this, operator = _a.operator, source = _a.source;
      subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
    });
    return subscriber;
  };
  Observable2.prototype._trySubscribe = function(sink) {
    try {
      return this._subscribe(sink);
    } catch (err) {
      sink.error(err);
    }
  };
  Observable2.prototype.forEach = function(next, promiseCtor) {
    var _this = this;
    promiseCtor = getPromiseCtor(promiseCtor);
    return new promiseCtor(function(resolve, reject) {
      var subscriber = new SafeSubscriber({
        next: function(value) {
          try {
            next(value);
          } catch (err) {
            reject(err);
            subscriber.unsubscribe();
          }
        },
        error: reject,
        complete: resolve
      });
      _this.subscribe(subscriber);
    });
  };
  Observable2.prototype._subscribe = function(subscriber) {
    var _a;
    return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
  };
  Observable2.prototype[observable] = function() {
    return this;
  };
  Observable2.prototype.pipe = function() {
    var operations = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      operations[_i] = arguments[_i];
    }
    return pipeFromArray(operations)(this);
  };
  Observable2.prototype.toPromise = function(promiseCtor) {
    var _this = this;
    promiseCtor = getPromiseCtor(promiseCtor);
    return new promiseCtor(function(resolve, reject) {
      var value;
      _this.subscribe(function(x) {
        return value = x;
      }, function(err) {
        return reject(err);
      }, function() {
        return resolve(value);
      });
    });
  };
  Observable2.create = function(subscribe) {
    return new Observable2(subscribe);
  };
  return Observable2;
})();
function getPromiseCtor(promiseCtor) {
  var _a;
  return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config.Promise) !== null && _a !== void 0 ? _a : Promise;
}
function isObserver(value) {
  return value && isFunction(value.next) && isFunction(value.error) && isFunction(value.complete);
}
function isSubscriber(value) {
  return value && value instanceof Subscriber || isObserver(value) && isSubscription(value);
}
function hasLift(source) {
  return isFunction(source === null || source === void 0 ? void 0 : source.lift);
}
function operate(init) {
  return function(source) {
    if (hasLift(source)) {
      return source.lift(function(liftedSource) {
        try {
          return init(liftedSource, this);
        } catch (err) {
          this.error(err);
        }
      });
    }
    throw new TypeError("Unable to lift unknown Observable type");
  };
}
function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
  return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
}
var OperatorSubscriber = (function(_super) {
  __extends(OperatorSubscriber2, _super);
  function OperatorSubscriber2(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
    var _this = _super.call(this, destination) || this;
    _this.onFinalize = onFinalize;
    _this.shouldUnsubscribe = shouldUnsubscribe;
    _this._next = onNext ? function(value) {
      try {
        onNext(value);
      } catch (err) {
        destination.error(err);
      }
    } : _super.prototype._next;
    _this._error = onError ? function(err) {
      try {
        onError(err);
      } catch (err2) {
        destination.error(err2);
      } finally {
        this.unsubscribe();
      }
    } : _super.prototype._error;
    _this._complete = onComplete ? function() {
      try {
        onComplete();
      } catch (err) {
        destination.error(err);
      } finally {
        this.unsubscribe();
      }
    } : _super.prototype._complete;
    return _this;
  }
  OperatorSubscriber2.prototype.unsubscribe = function() {
    var _a;
    if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
      var closed_1 = this.closed;
      _super.prototype.unsubscribe.call(this);
      !closed_1 && ((_a = this.onFinalize) === null || _a === void 0 ? void 0 : _a.call(this));
    }
  };
  return OperatorSubscriber2;
})(Subscriber);
var ObjectUnsubscribedError = createErrorClass(function(_super) {
  return function ObjectUnsubscribedErrorImpl() {
    _super(this);
    this.name = "ObjectUnsubscribedError";
    this.message = "object unsubscribed";
  };
});
var Subject = (function(_super) {
  __extends(Subject2, _super);
  function Subject2() {
    var _this = _super.call(this) || this;
    _this.closed = false;
    _this.currentObservers = null;
    _this.observers = [];
    _this.isStopped = false;
    _this.hasError = false;
    _this.thrownError = null;
    return _this;
  }
  Subject2.prototype.lift = function(operator) {
    var subject = new AnonymousSubject(this, this);
    subject.operator = operator;
    return subject;
  };
  Subject2.prototype._throwIfClosed = function() {
    if (this.closed) {
      throw new ObjectUnsubscribedError();
    }
  };
  Subject2.prototype.next = function(value) {
    var _this = this;
    errorContext(function() {
      var e_1, _a;
      _this._throwIfClosed();
      if (!_this.isStopped) {
        if (!_this.currentObservers) {
          _this.currentObservers = Array.from(_this.observers);
        }
        try {
          for (var _b = __values(_this.currentObservers), _c = _b.next(); !_c.done; _c = _b.next()) {
            var observer = _c.value;
            observer.next(value);
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return))
              _a.call(_b);
          } finally {
            if (e_1)
              throw e_1.error;
          }
        }
      }
    });
  };
  Subject2.prototype.error = function(err) {
    var _this = this;
    errorContext(function() {
      _this._throwIfClosed();
      if (!_this.isStopped) {
        _this.hasError = _this.isStopped = true;
        _this.thrownError = err;
        var observers = _this.observers;
        while (observers.length) {
          observers.shift().error(err);
        }
      }
    });
  };
  Subject2.prototype.complete = function() {
    var _this = this;
    errorContext(function() {
      _this._throwIfClosed();
      if (!_this.isStopped) {
        _this.isStopped = true;
        var observers = _this.observers;
        while (observers.length) {
          observers.shift().complete();
        }
      }
    });
  };
  Subject2.prototype.unsubscribe = function() {
    this.isStopped = this.closed = true;
    this.observers = this.currentObservers = null;
  };
  Object.defineProperty(Subject2.prototype, "observed", {
    get: function() {
      var _a;
      return ((_a = this.observers) === null || _a === void 0 ? void 0 : _a.length) > 0;
    },
    enumerable: false,
    configurable: true
  });
  Subject2.prototype._trySubscribe = function(subscriber) {
    this._throwIfClosed();
    return _super.prototype._trySubscribe.call(this, subscriber);
  };
  Subject2.prototype._subscribe = function(subscriber) {
    this._throwIfClosed();
    this._checkFinalizedStatuses(subscriber);
    return this._innerSubscribe(subscriber);
  };
  Subject2.prototype._innerSubscribe = function(subscriber) {
    var _this = this;
    var _a = this, hasError = _a.hasError, isStopped = _a.isStopped, observers = _a.observers;
    if (hasError || isStopped) {
      return EMPTY_SUBSCRIPTION;
    }
    this.currentObservers = null;
    observers.push(subscriber);
    return new Subscription(function() {
      _this.currentObservers = null;
      arrRemove(observers, subscriber);
    });
  };
  Subject2.prototype._checkFinalizedStatuses = function(subscriber) {
    var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, isStopped = _a.isStopped;
    if (hasError) {
      subscriber.error(thrownError);
    } else if (isStopped) {
      subscriber.complete();
    }
  };
  Subject2.prototype.asObservable = function() {
    var observable2 = new Observable();
    observable2.source = this;
    return observable2;
  };
  Subject2.create = function(destination, source) {
    return new AnonymousSubject(destination, source);
  };
  return Subject2;
})(Observable);
var AnonymousSubject = (function(_super) {
  __extends(AnonymousSubject2, _super);
  function AnonymousSubject2(destination, source) {
    var _this = _super.call(this) || this;
    _this.destination = destination;
    _this.source = source;
    return _this;
  }
  AnonymousSubject2.prototype.next = function(value) {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.call(_a, value);
  };
  AnonymousSubject2.prototype.error = function(err) {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, err);
  };
  AnonymousSubject2.prototype.complete = function() {
    var _a, _b;
    (_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.complete) === null || _b === void 0 ? void 0 : _b.call(_a);
  };
  AnonymousSubject2.prototype._subscribe = function(subscriber) {
    var _a, _b;
    return (_b = (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber)) !== null && _b !== void 0 ? _b : EMPTY_SUBSCRIPTION;
  };
  return AnonymousSubject2;
})(Subject);
var BehaviorSubject = (function(_super) {
  __extends(BehaviorSubject2, _super);
  function BehaviorSubject2(_value) {
    var _this = _super.call(this) || this;
    _this._value = _value;
    return _this;
  }
  Object.defineProperty(BehaviorSubject2.prototype, "value", {
    get: function() {
      return this.getValue();
    },
    enumerable: false,
    configurable: true
  });
  BehaviorSubject2.prototype._subscribe = function(subscriber) {
    var subscription = _super.prototype._subscribe.call(this, subscriber);
    !subscription.closed && subscriber.next(this._value);
    return subscription;
  };
  BehaviorSubject2.prototype.getValue = function() {
    var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, _value = _a._value;
    if (hasError) {
      throw thrownError;
    }
    this._throwIfClosed();
    return _value;
  };
  BehaviorSubject2.prototype.next = function(value) {
    _super.prototype.next.call(this, this._value = value);
  };
  return BehaviorSubject2;
})(Subject);
var dateTimestampProvider = {
  now: function() {
    return (dateTimestampProvider.delegate || Date).now();
  },
  delegate: void 0
};
var Action = (function(_super) {
  __extends(Action2, _super);
  function Action2(scheduler, work) {
    return _super.call(this) || this;
  }
  Action2.prototype.schedule = function(state, delay2) {
    return this;
  };
  return Action2;
})(Subscription);
var intervalProvider = {
  setInterval: function(handler, timeout2) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }
    var delegate = intervalProvider.delegate;
    if (delegate === null || delegate === void 0 ? void 0 : delegate.setInterval) {
      return delegate.setInterval.apply(delegate, __spreadArray([handler, timeout2], __read(args)));
    }
    return setInterval.apply(void 0, __spreadArray([handler, timeout2], __read(args)));
  },
  clearInterval: function(handle) {
    var delegate = intervalProvider.delegate;
    return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearInterval) || clearInterval)(handle);
  },
  delegate: void 0
};
var AsyncAction = (function(_super) {
  __extends(AsyncAction2, _super);
  function AsyncAction2(scheduler, work) {
    var _this = _super.call(this, scheduler, work) || this;
    _this.scheduler = scheduler;
    _this.work = work;
    _this.pending = false;
    return _this;
  }
  AsyncAction2.prototype.schedule = function(state, delay2) {
    var _a;
    if (delay2 === void 0) {
      delay2 = 0;
    }
    if (this.closed) {
      return this;
    }
    this.state = state;
    var id = this.id;
    var scheduler = this.scheduler;
    if (id != null) {
      this.id = this.recycleAsyncId(scheduler, id, delay2);
    }
    this.pending = true;
    this.delay = delay2;
    this.id = (_a = this.id) !== null && _a !== void 0 ? _a : this.requestAsyncId(scheduler, this.id, delay2);
    return this;
  };
  AsyncAction2.prototype.requestAsyncId = function(scheduler, _id, delay2) {
    if (delay2 === void 0) {
      delay2 = 0;
    }
    return intervalProvider.setInterval(scheduler.flush.bind(scheduler, this), delay2);
  };
  AsyncAction2.prototype.recycleAsyncId = function(_scheduler, id, delay2) {
    if (delay2 === void 0) {
      delay2 = 0;
    }
    if (delay2 != null && this.delay === delay2 && this.pending === false) {
      return id;
    }
    if (id != null) {
      intervalProvider.clearInterval(id);
    }
    return void 0;
  };
  AsyncAction2.prototype.execute = function(state, delay2) {
    if (this.closed) {
      return new Error("executing a cancelled action");
    }
    this.pending = false;
    var error = this._execute(state, delay2);
    if (error) {
      return error;
    } else if (this.pending === false && this.id != null) {
      this.id = this.recycleAsyncId(this.scheduler, this.id, null);
    }
  };
  AsyncAction2.prototype._execute = function(state, _delay) {
    var errored = false;
    var errorValue;
    try {
      this.work(state);
    } catch (e) {
      errored = true;
      errorValue = e ? e : new Error("Scheduled action threw falsy error");
    }
    if (errored) {
      this.unsubscribe();
      return errorValue;
    }
  };
  AsyncAction2.prototype.unsubscribe = function() {
    if (!this.closed) {
      var _a = this, id = _a.id, scheduler = _a.scheduler;
      var actions = scheduler.actions;
      this.work = this.state = this.scheduler = null;
      this.pending = false;
      arrRemove(actions, this);
      if (id != null) {
        this.id = this.recycleAsyncId(scheduler, id, null);
      }
      this.delay = null;
      _super.prototype.unsubscribe.call(this);
    }
  };
  return AsyncAction2;
})(Action);
var Scheduler = (function() {
  function Scheduler2(schedulerActionCtor, now2) {
    if (now2 === void 0) {
      now2 = Scheduler2.now;
    }
    this.schedulerActionCtor = schedulerActionCtor;
    this.now = now2;
  }
  Scheduler2.prototype.schedule = function(work, delay2, state) {
    if (delay2 === void 0) {
      delay2 = 0;
    }
    return new this.schedulerActionCtor(this, work).schedule(state, delay2);
  };
  Scheduler2.now = dateTimestampProvider.now;
  return Scheduler2;
})();
var AsyncScheduler = (function(_super) {
  __extends(AsyncScheduler2, _super);
  function AsyncScheduler2(SchedulerAction, now2) {
    if (now2 === void 0) {
      now2 = Scheduler.now;
    }
    var _this = _super.call(this, SchedulerAction, now2) || this;
    _this.actions = [];
    _this._active = false;
    return _this;
  }
  AsyncScheduler2.prototype.flush = function(action) {
    var actions = this.actions;
    if (this._active) {
      actions.push(action);
      return;
    }
    var error;
    this._active = true;
    do {
      if (error = action.execute(action.state, action.delay)) {
        break;
      }
    } while (action = actions.shift());
    this._active = false;
    if (error) {
      while (action = actions.shift()) {
        action.unsubscribe();
      }
      throw error;
    }
  };
  return AsyncScheduler2;
})(Scheduler);
var asyncScheduler = new AsyncScheduler(AsyncAction);
var async = asyncScheduler;
var EMPTY = new Observable(function(subscriber) {
  return subscriber.complete();
});
function isScheduler(value) {
  return value && isFunction(value.schedule);
}
function last(arr) {
  return arr[arr.length - 1];
}
function popResultSelector(args) {
  return isFunction(last(args)) ? args.pop() : void 0;
}
function popScheduler(args) {
  return isScheduler(last(args)) ? args.pop() : void 0;
}
function popNumber(args, defaultValue) {
  return typeof last(args) === "number" ? args.pop() : defaultValue;
}
var isArrayLike = function(x) {
  return x && typeof x.length === "number" && typeof x !== "function";
};
function isPromise(value) {
  return isFunction(value === null || value === void 0 ? void 0 : value.then);
}
function isInteropObservable(input) {
  return isFunction(input[observable]);
}
function isAsyncIterable(obj) {
  return Symbol.asyncIterator && isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
}
function createInvalidObservableTypeError(input) {
  return new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
}
function getSymbolIterator() {
  if (typeof Symbol !== "function" || !Symbol.iterator) {
    return "@@iterator";
  }
  return Symbol.iterator;
}
var iterator = getSymbolIterator();
function isIterable(input) {
  return isFunction(input === null || input === void 0 ? void 0 : input[iterator]);
}
function readableStreamLikeToAsyncGenerator(readableStream) {
  return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
    var reader, _a, value, done;
    return __generator(this, function(_b) {
      switch (_b.label) {
        case 0:
          reader = readableStream.getReader();
          _b.label = 1;
        case 1:
          _b.trys.push([1, , 9, 10]);
          _b.label = 2;
        case 2:
          return [4, __await(reader.read())];
        case 3:
          _a = _b.sent(), value = _a.value, done = _a.done;
          if (!done)
            return [3, 5];
          return [4, __await(void 0)];
        case 4:
          return [2, _b.sent()];
        case 5:
          return [4, __await(value)];
        case 6:
          return [4, _b.sent()];
        case 7:
          _b.sent();
          return [3, 2];
        case 8:
          return [3, 10];
        case 9:
          reader.releaseLock();
          return [7];
        case 10:
          return [2];
      }
    });
  });
}
function isReadableStreamLike(obj) {
  return isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
}
function innerFrom(input) {
  if (input instanceof Observable) {
    return input;
  }
  if (input != null) {
    if (isInteropObservable(input)) {
      return fromInteropObservable(input);
    }
    if (isArrayLike(input)) {
      return fromArrayLike(input);
    }
    if (isPromise(input)) {
      return fromPromise(input);
    }
    if (isAsyncIterable(input)) {
      return fromAsyncIterable(input);
    }
    if (isIterable(input)) {
      return fromIterable(input);
    }
    if (isReadableStreamLike(input)) {
      return fromReadableStreamLike(input);
    }
  }
  throw createInvalidObservableTypeError(input);
}
function fromInteropObservable(obj) {
  return new Observable(function(subscriber) {
    var obs = obj[observable]();
    if (isFunction(obs.subscribe)) {
      return obs.subscribe(subscriber);
    }
    throw new TypeError("Provided object does not correctly implement Symbol.observable");
  });
}
function fromArrayLike(array) {
  return new Observable(function(subscriber) {
    for (var i = 0; i < array.length && !subscriber.closed; i++) {
      subscriber.next(array[i]);
    }
    subscriber.complete();
  });
}
function fromPromise(promise) {
  return new Observable(function(subscriber) {
    promise.then(function(value) {
      if (!subscriber.closed) {
        subscriber.next(value);
        subscriber.complete();
      }
    }, function(err) {
      return subscriber.error(err);
    }).then(null, reportUnhandledError);
  });
}
function fromIterable(iterable) {
  return new Observable(function(subscriber) {
    var e_1, _a;
    try {
      for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
        var value = iterable_1_1.value;
        subscriber.next(value);
        if (subscriber.closed) {
          return;
        }
      }
    } catch (e_1_1) {
      e_1 = { error: e_1_1 };
    } finally {
      try {
        if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return))
          _a.call(iterable_1);
      } finally {
        if (e_1)
          throw e_1.error;
      }
    }
    subscriber.complete();
  });
}
function fromAsyncIterable(asyncIterable) {
  return new Observable(function(subscriber) {
    process(asyncIterable, subscriber).catch(function(err) {
      return subscriber.error(err);
    });
  });
}
function fromReadableStreamLike(readableStream) {
  return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream));
}
function process(asyncIterable, subscriber) {
  var asyncIterable_1, asyncIterable_1_1;
  var e_2, _a;
  return __awaiter(this, void 0, void 0, function() {
    var value, e_2_1;
    return __generator(this, function(_b) {
      switch (_b.label) {
        case 0:
          _b.trys.push([0, 5, 6, 11]);
          asyncIterable_1 = __asyncValues(asyncIterable);
          _b.label = 1;
        case 1:
          return [4, asyncIterable_1.next()];
        case 2:
          if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done))
            return [3, 4];
          value = asyncIterable_1_1.value;
          subscriber.next(value);
          if (subscriber.closed) {
            return [2];
          }
          _b.label = 3;
        case 3:
          return [3, 1];
        case 4:
          return [3, 11];
        case 5:
          e_2_1 = _b.sent();
          e_2 = { error: e_2_1 };
          return [3, 11];
        case 6:
          _b.trys.push([6, , 9, 10]);
          if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return)))
            return [3, 8];
          return [4, _a.call(asyncIterable_1)];
        case 7:
          _b.sent();
          _b.label = 8;
        case 8:
          return [3, 10];
        case 9:
          if (e_2)
            throw e_2.error;
          return [7];
        case 10:
          return [7];
        case 11:
          subscriber.complete();
          return [2];
      }
    });
  });
}
function executeSchedule(parentSubscription, scheduler, work, delay2, repeat) {
  if (delay2 === void 0) {
    delay2 = 0;
  }
  if (repeat === void 0) {
    repeat = false;
  }
  var scheduleSubscription = scheduler.schedule(function() {
    work();
    if (repeat) {
      parentSubscription.add(this.schedule(null, delay2));
    } else {
      this.unsubscribe();
    }
  }, delay2);
  parentSubscription.add(scheduleSubscription);
  if (!repeat) {
    return scheduleSubscription;
  }
}
function observeOn(scheduler, delay2) {
  if (delay2 === void 0) {
    delay2 = 0;
  }
  return operate(function(source, subscriber) {
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.next(value);
      }, delay2);
    }, function() {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.complete();
      }, delay2);
    }, function(err) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.error(err);
      }, delay2);
    }));
  });
}
function subscribeOn(scheduler, delay2) {
  if (delay2 === void 0) {
    delay2 = 0;
  }
  return operate(function(source, subscriber) {
    subscriber.add(scheduler.schedule(function() {
      return source.subscribe(subscriber);
    }, delay2));
  });
}
function scheduleObservable(input, scheduler) {
  return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
function schedulePromise(input, scheduler) {
  return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
function scheduleArray(input, scheduler) {
  return new Observable(function(subscriber) {
    var i = 0;
    return scheduler.schedule(function() {
      if (i === input.length) {
        subscriber.complete();
      } else {
        subscriber.next(input[i++]);
        if (!subscriber.closed) {
          this.schedule();
        }
      }
    });
  });
}
function scheduleIterable(input, scheduler) {
  return new Observable(function(subscriber) {
    var iterator$1;
    executeSchedule(subscriber, scheduler, function() {
      iterator$1 = input[iterator]();
      executeSchedule(subscriber, scheduler, function() {
        var _a;
        var value;
        var done;
        try {
          _a = iterator$1.next(), value = _a.value, done = _a.done;
        } catch (err) {
          subscriber.error(err);
          return;
        }
        if (done) {
          subscriber.complete();
        } else {
          subscriber.next(value);
        }
      }, 0, true);
    });
    return function() {
      return isFunction(iterator$1 === null || iterator$1 === void 0 ? void 0 : iterator$1.return) && iterator$1.return();
    };
  });
}
function scheduleAsyncIterable(input, scheduler) {
  if (!input) {
    throw new Error("Iterable cannot be null");
  }
  return new Observable(function(subscriber) {
    executeSchedule(subscriber, scheduler, function() {
      var iterator2 = input[Symbol.asyncIterator]();
      executeSchedule(subscriber, scheduler, function() {
        iterator2.next().then(function(result) {
          if (result.done) {
            subscriber.complete();
          } else {
            subscriber.next(result.value);
          }
        });
      }, 0, true);
    });
  });
}
function scheduleReadableStreamLike(input, scheduler) {
  return scheduleAsyncIterable(readableStreamLikeToAsyncGenerator(input), scheduler);
}
function scheduled(input, scheduler) {
  if (input != null) {
    if (isInteropObservable(input)) {
      return scheduleObservable(input, scheduler);
    }
    if (isArrayLike(input)) {
      return scheduleArray(input, scheduler);
    }
    if (isPromise(input)) {
      return schedulePromise(input, scheduler);
    }
    if (isAsyncIterable(input)) {
      return scheduleAsyncIterable(input, scheduler);
    }
    if (isIterable(input)) {
      return scheduleIterable(input, scheduler);
    }
    if (isReadableStreamLike(input)) {
      return scheduleReadableStreamLike(input, scheduler);
    }
  }
  throw createInvalidObservableTypeError(input);
}
function from(input, scheduler) {
  return scheduler ? scheduled(input, scheduler) : innerFrom(input);
}
function of() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  var scheduler = popScheduler(args);
  return from(args, scheduler);
}
var EmptyError = createErrorClass(function(_super) {
  return function EmptyErrorImpl() {
    _super(this);
    this.name = "EmptyError";
    this.message = "no elements in sequence";
  };
});
function firstValueFrom(source, config2) {
  var hasConfig = typeof config2 === "object";
  return new Promise(function(resolve, reject) {
    var subscriber = new SafeSubscriber({
      next: function(value) {
        resolve(value);
        subscriber.unsubscribe();
      },
      error: reject,
      complete: function() {
        if (hasConfig) {
          resolve(config2.defaultValue);
        } else {
          reject(new EmptyError());
        }
      }
    });
    source.subscribe(subscriber);
  });
}
function isValidDate(value) {
  return value instanceof Date && !isNaN(value);
}
var TimeoutError = createErrorClass(function(_super) {
  return function TimeoutErrorImpl(info) {
    if (info === void 0) {
      info = null;
    }
    _super(this);
    this.message = "Timeout has occurred";
    this.name = "TimeoutError";
    this.info = info;
  };
});
function timeout(config2, schedulerArg) {
  var _a = isValidDate(config2) ? { first: config2 } : typeof config2 === "number" ? { each: config2 } : config2, first2 = _a.first, each = _a.each, _b = _a.with, _with = _b === void 0 ? timeoutErrorFactory : _b, _c = _a.scheduler, scheduler = _c === void 0 ? schedulerArg !== null && schedulerArg !== void 0 ? schedulerArg : asyncScheduler : _c, _d = _a.meta, meta = _d === void 0 ? null : _d;
  if (first2 == null && each == null) {
    throw new TypeError("No timeout provided.");
  }
  return operate(function(source, subscriber) {
    var originalSourceSubscription;
    var timerSubscription;
    var lastValue = null;
    var seen = 0;
    var startTimer = function(delay2) {
      timerSubscription = executeSchedule(subscriber, scheduler, function() {
        try {
          originalSourceSubscription.unsubscribe();
          innerFrom(_with({
            meta,
            lastValue,
            seen
          })).subscribe(subscriber);
        } catch (err) {
          subscriber.error(err);
        }
      }, delay2);
    };
    originalSourceSubscription = source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.unsubscribe();
      seen++;
      subscriber.next(lastValue = value);
      each > 0 && startTimer(each);
    }, void 0, void 0, function() {
      if (!(timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.closed)) {
        timerSubscription === null || timerSubscription === void 0 ? void 0 : timerSubscription.unsubscribe();
      }
      lastValue = null;
    }));
    !seen && startTimer(first2 != null ? typeof first2 === "number" ? first2 : +first2 - scheduler.now() : each);
  });
}
function timeoutErrorFactory(info) {
  throw new TimeoutError(info);
}
function map(project, thisArg) {
  return operate(function(source, subscriber) {
    var index = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      subscriber.next(project.call(thisArg, value, index++));
    }));
  });
}
var isArray$1 = Array.isArray;
function callOrApply(fn, args) {
  return isArray$1(args) ? fn.apply(void 0, __spreadArray([], __read(args))) : fn(args);
}
function mapOneOrManyArgs(fn) {
  return map(function(args) {
    return callOrApply(fn, args);
  });
}
var isArray = Array.isArray;
var getPrototypeOf = Object.getPrototypeOf;
var objectProto = Object.prototype;
var getKeys = Object.keys;
function argsArgArrayOrObject(args) {
  if (args.length === 1) {
    var first_1 = args[0];
    if (isArray(first_1)) {
      return { args: first_1, keys: null };
    }
    if (isPOJO(first_1)) {
      var keys = getKeys(first_1);
      return {
        args: keys.map(function(key) {
          return first_1[key];
        }),
        keys
      };
    }
  }
  return { args, keys: null };
}
function isPOJO(obj) {
  return obj && typeof obj === "object" && getPrototypeOf(obj) === objectProto;
}
function createObject(keys, values) {
  return keys.reduce(function(result, key, i) {
    return result[key] = values[i], result;
  }, {});
}
function combineLatest() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  var scheduler = popScheduler(args);
  var resultSelector = popResultSelector(args);
  var _a = argsArgArrayOrObject(args), observables = _a.args, keys = _a.keys;
  if (observables.length === 0) {
    return from([], scheduler);
  }
  var result = new Observable(combineLatestInit(observables, scheduler, keys ? function(values) {
    return createObject(keys, values);
  } : identity));
  return resultSelector ? result.pipe(mapOneOrManyArgs(resultSelector)) : result;
}
function combineLatestInit(observables, scheduler, valueTransform) {
  if (valueTransform === void 0) {
    valueTransform = identity;
  }
  return function(subscriber) {
    maybeSchedule(scheduler, function() {
      var length = observables.length;
      var values = new Array(length);
      var active = length;
      var remainingFirstValues = length;
      var _loop_1 = function(i2) {
        maybeSchedule(scheduler, function() {
          var source = from(observables[i2], scheduler);
          var hasFirstValue = false;
          source.subscribe(createOperatorSubscriber(subscriber, function(value) {
            values[i2] = value;
            if (!hasFirstValue) {
              hasFirstValue = true;
              remainingFirstValues--;
            }
            if (!remainingFirstValues) {
              subscriber.next(valueTransform(values.slice()));
            }
          }, function() {
            if (!--active) {
              subscriber.complete();
            }
          }));
        }, subscriber);
      };
      for (var i = 0; i < length; i++) {
        _loop_1(i);
      }
    }, subscriber);
  };
}
function maybeSchedule(scheduler, execute, subscription) {
  if (scheduler) {
    executeSchedule(subscription, scheduler, execute);
  } else {
    execute();
  }
}
function mergeInternals(source, subscriber, project, concurrent, onBeforeNext, expand, innerSubScheduler, additionalFinalizer) {
  var buffer = [];
  var active = 0;
  var index = 0;
  var isComplete = false;
  var checkComplete = function() {
    if (isComplete && !buffer.length && !active) {
      subscriber.complete();
    }
  };
  var outerNext = function(value) {
    return active < concurrent ? doInnerSub(value) : buffer.push(value);
  };
  var doInnerSub = function(value) {
    expand && subscriber.next(value);
    active++;
    var innerComplete = false;
    innerFrom(project(value, index++)).subscribe(createOperatorSubscriber(subscriber, function(innerValue) {
      onBeforeNext === null || onBeforeNext === void 0 ? void 0 : onBeforeNext(innerValue);
      if (expand) {
        outerNext(innerValue);
      } else {
        subscriber.next(innerValue);
      }
    }, function() {
      innerComplete = true;
    }, void 0, function() {
      if (innerComplete) {
        try {
          active--;
          var _loop_1 = function() {
            var bufferedValue = buffer.shift();
            if (innerSubScheduler) {
              executeSchedule(subscriber, innerSubScheduler, function() {
                return doInnerSub(bufferedValue);
              });
            } else {
              doInnerSub(bufferedValue);
            }
          };
          while (buffer.length && active < concurrent) {
            _loop_1();
          }
          checkComplete();
        } catch (err) {
          subscriber.error(err);
        }
      }
    }));
  };
  source.subscribe(createOperatorSubscriber(subscriber, outerNext, function() {
    isComplete = true;
    checkComplete();
  }));
  return function() {
    additionalFinalizer === null || additionalFinalizer === void 0 ? void 0 : additionalFinalizer();
  };
}
function mergeMap(project, resultSelector, concurrent) {
  if (concurrent === void 0) {
    concurrent = Infinity;
  }
  if (isFunction(resultSelector)) {
    return mergeMap(function(a, i) {
      return map(function(b, ii) {
        return resultSelector(a, b, i, ii);
      })(innerFrom(project(a, i)));
    }, concurrent);
  } else if (typeof resultSelector === "number") {
    concurrent = resultSelector;
  }
  return operate(function(source, subscriber) {
    return mergeInternals(source, subscriber, project, concurrent);
  });
}
function mergeAll(concurrent) {
  if (concurrent === void 0) {
    concurrent = Infinity;
  }
  return mergeMap(identity, concurrent);
}
function concatAll() {
  return mergeAll(1);
}
function concat() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  return concatAll()(from(args, popScheduler(args)));
}
function timer(dueTime, intervalOrScheduler, scheduler) {
  if (dueTime === void 0) {
    dueTime = 0;
  }
  if (scheduler === void 0) {
    scheduler = async;
  }
  var intervalDuration = -1;
  if (intervalOrScheduler != null) {
    if (isScheduler(intervalOrScheduler)) {
      scheduler = intervalOrScheduler;
    } else {
      intervalDuration = intervalOrScheduler;
    }
  }
  return new Observable(function(subscriber) {
    var due = isValidDate(dueTime) ? +dueTime - scheduler.now() : dueTime;
    if (due < 0) {
      due = 0;
    }
    var n = 0;
    return scheduler.schedule(function() {
      if (!subscriber.closed) {
        subscriber.next(n++);
        if (0 <= intervalDuration) {
          this.schedule(void 0, intervalDuration);
        } else {
          subscriber.complete();
        }
      }
    }, due);
  });
}
function merge() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  var scheduler = popScheduler(args);
  var concurrent = popNumber(args, Infinity);
  var sources = args;
  return !sources.length ? EMPTY : sources.length === 1 ? innerFrom(sources[0]) : mergeAll(concurrent)(from(sources, scheduler));
}
function filter(predicate, thisArg) {
  return operate(function(source, subscriber) {
    var index = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      return predicate.call(thisArg, value, index++) && subscriber.next(value);
    }));
  });
}
function catchError(selector) {
  return operate(function(source, subscriber) {
    var innerSub = null;
    var syncUnsub = false;
    var handledResult;
    innerSub = source.subscribe(createOperatorSubscriber(subscriber, void 0, void 0, function(err) {
      handledResult = innerFrom(selector(err, catchError(selector)(source)));
      if (innerSub) {
        innerSub.unsubscribe();
        innerSub = null;
        handledResult.subscribe(subscriber);
      } else {
        syncUnsub = true;
      }
    }));
    if (syncUnsub) {
      innerSub.unsubscribe();
      innerSub = null;
      handledResult.subscribe(subscriber);
    }
  });
}
function scanInternals(accumulator, seed, hasSeed, emitOnNext, emitBeforeComplete) {
  return function(source, subscriber) {
    var hasState = hasSeed;
    var state = seed;
    var index = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      var i = index++;
      state = hasState ? accumulator(state, value, i) : (hasState = true, value);
      emitOnNext && subscriber.next(state);
    }, emitBeforeComplete && function() {
      hasState && subscriber.next(state);
      subscriber.complete();
    }));
  };
}
function defaultIfEmpty(defaultValue) {
  return operate(function(source, subscriber) {
    var hasValue = false;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      hasValue = true;
      subscriber.next(value);
    }, function() {
      if (!hasValue) {
        subscriber.next(defaultValue);
      }
      subscriber.complete();
    }));
  });
}
function take(count) {
  return count <= 0 ? function() {
    return EMPTY;
  } : operate(function(source, subscriber) {
    var seen = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      if (++seen <= count) {
        subscriber.next(value);
        if (count <= seen) {
          subscriber.complete();
        }
      }
    }));
  });
}
function ignoreElements() {
  return operate(function(source, subscriber) {
    source.subscribe(createOperatorSubscriber(subscriber, noop));
  });
}
function mapTo(value) {
  return map(function() {
    return value;
  });
}
function delayWhen(delayDurationSelector, subscriptionDelay) {
  if (subscriptionDelay) {
    return function(source) {
      return concat(subscriptionDelay.pipe(take(1), ignoreElements()), source.pipe(delayWhen(delayDurationSelector)));
    };
  }
  return mergeMap(function(value, index) {
    return innerFrom(delayDurationSelector(value, index)).pipe(take(1), mapTo(value));
  });
}
function delay(due, scheduler) {
  if (scheduler === void 0) {
    scheduler = asyncScheduler;
  }
  var duration = timer(due, scheduler);
  return delayWhen(function() {
    return duration;
  });
}
function distinct(keySelector, flushes) {
  return operate(function(source, subscriber) {
    var distinctKeys = /* @__PURE__ */ new Set();
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      var key = keySelector ? keySelector(value) : value;
      if (!distinctKeys.has(key)) {
        distinctKeys.add(key);
        subscriber.next(value);
      }
    }));
    flushes && innerFrom(flushes).subscribe(createOperatorSubscriber(subscriber, function() {
      return distinctKeys.clear();
    }, noop));
  });
}
function distinctUntilChanged(comparator, keySelector) {
  if (keySelector === void 0) {
    keySelector = identity;
  }
  comparator = comparator !== null && comparator !== void 0 ? comparator : defaultCompare;
  return operate(function(source, subscriber) {
    var previousKey;
    var first2 = true;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      var currentKey = keySelector(value);
      if (first2 || !comparator(previousKey, currentKey)) {
        first2 = false;
        previousKey = currentKey;
        subscriber.next(value);
      }
    }));
  });
}
function defaultCompare(a, b) {
  return a === b;
}
function throwIfEmpty(errorFactory) {
  if (errorFactory === void 0) {
    errorFactory = defaultErrorFactory;
  }
  return operate(function(source, subscriber) {
    var hasValue = false;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      hasValue = true;
      subscriber.next(value);
    }, function() {
      return hasValue ? subscriber.complete() : subscriber.error(errorFactory());
    }));
  });
}
function defaultErrorFactory() {
  return new EmptyError();
}
function finalize(callback) {
  return operate(function(source, subscriber) {
    try {
      source.subscribe(subscriber);
    } finally {
      subscriber.add(callback);
    }
  });
}
function first(predicate, defaultValue) {
  var hasDefaultValue = arguments.length >= 2;
  return function(source) {
    return source.pipe(predicate ? filter(function(v, i) {
      return predicate(v, i, source);
    }) : identity, take(1), hasDefaultValue ? defaultIfEmpty(defaultValue) : throwIfEmpty(function() {
      return new EmptyError();
    }));
  };
}
function groupBy(keySelector, elementOrOptions, duration, connector) {
  return operate(function(source, subscriber) {
    var element;
    if (!elementOrOptions || typeof elementOrOptions === "function") {
      element = elementOrOptions;
    } else {
      duration = elementOrOptions.duration, element = elementOrOptions.element, connector = elementOrOptions.connector;
    }
    var groups = /* @__PURE__ */ new Map();
    var notify = function(cb) {
      groups.forEach(cb);
      cb(subscriber);
    };
    var handleError = function(err) {
      return notify(function(consumer) {
        return consumer.error(err);
      });
    };
    var activeGroups = 0;
    var teardownAttempted = false;
    var groupBySourceSubscriber = new OperatorSubscriber(subscriber, function(value) {
      try {
        var key_1 = keySelector(value);
        var group_1 = groups.get(key_1);
        if (!group_1) {
          groups.set(key_1, group_1 = connector ? connector() : new Subject());
          var grouped = createGroupedObservable(key_1, group_1);
          subscriber.next(grouped);
          if (duration) {
            var durationSubscriber_1 = createOperatorSubscriber(group_1, function() {
              group_1.complete();
              durationSubscriber_1 === null || durationSubscriber_1 === void 0 ? void 0 : durationSubscriber_1.unsubscribe();
            }, void 0, void 0, function() {
              return groups.delete(key_1);
            });
            groupBySourceSubscriber.add(innerFrom(duration(grouped)).subscribe(durationSubscriber_1));
          }
        }
        group_1.next(element ? element(value) : value);
      } catch (err) {
        handleError(err);
      }
    }, function() {
      return notify(function(consumer) {
        return consumer.complete();
      });
    }, handleError, function() {
      return groups.clear();
    }, function() {
      teardownAttempted = true;
      return activeGroups === 0;
    });
    source.subscribe(groupBySourceSubscriber);
    function createGroupedObservable(key, groupSubject) {
      var result = new Observable(function(groupSubscriber) {
        activeGroups++;
        var innerSub = groupSubject.subscribe(groupSubscriber);
        return function() {
          innerSub.unsubscribe();
          --activeGroups === 0 && teardownAttempted && groupBySourceSubscriber.unsubscribe();
        };
      });
      result.key = key;
      return result;
    }
  });
}
function scan(accumulator, seed) {
  return operate(scanInternals(accumulator, seed, arguments.length >= 2, true));
}
function switchMap(project, resultSelector) {
  return operate(function(source, subscriber) {
    var innerSubscriber = null;
    var index = 0;
    var isComplete = false;
    var checkComplete = function() {
      return isComplete && !innerSubscriber && subscriber.complete();
    };
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      innerSubscriber === null || innerSubscriber === void 0 ? void 0 : innerSubscriber.unsubscribe();
      var innerIndex = 0;
      var outerIndex = index++;
      innerFrom(project(value, outerIndex)).subscribe(innerSubscriber = createOperatorSubscriber(subscriber, function(innerValue) {
        return subscriber.next(resultSelector ? resultSelector(value, innerValue, outerIndex, innerIndex++) : innerValue);
      }, function() {
        innerSubscriber = null;
        checkComplete();
      }));
    }, function() {
      isComplete = true;
      checkComplete();
    }));
  });
}
function switchAll() {
  return switchMap(identity);
}
function takeUntil(notifier) {
  return operate(function(source, subscriber) {
    innerFrom(notifier).subscribe(createOperatorSubscriber(subscriber, function() {
      return subscriber.complete();
    }, noop));
    !subscriber.closed && source.subscribe(subscriber);
  });
}
function takeWhile(predicate, inclusive) {
  if (inclusive === void 0) {
    inclusive = false;
  }
  return operate(function(source, subscriber) {
    var index = 0;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      var result = predicate(value, index++);
      (result || inclusive) && subscriber.next(value);
      !result && subscriber.complete();
    }));
  });
}
function tap(observerOrNext, error, complete) {
  var tapObserver = isFunction(observerOrNext) || error || complete ? { next: observerOrNext, error, complete } : observerOrNext;
  return tapObserver ? operate(function(source, subscriber) {
    var _a;
    (_a = tapObserver.subscribe) === null || _a === void 0 ? void 0 : _a.call(tapObserver);
    var isUnsub = true;
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      var _a2;
      (_a2 = tapObserver.next) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver, value);
      subscriber.next(value);
    }, function() {
      var _a2;
      isUnsub = false;
      (_a2 = tapObserver.complete) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver);
      subscriber.complete();
    }, function(err) {
      var _a2;
      isUnsub = false;
      (_a2 = tapObserver.error) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver, err);
      subscriber.error(err);
    }, function() {
      var _a2, _b;
      if (isUnsub) {
        (_a2 = tapObserver.unsubscribe) === null || _a2 === void 0 ? void 0 : _a2.call(tapObserver);
      }
      (_b = tapObserver.finalize) === null || _b === void 0 ? void 0 : _b.call(tapObserver);
    }));
  }) : identity;
}
function uniq(flushes) {
  return distinct(({ event }) => event.id, flushes);
}
function createUniq(keyFn, options) {
  const cache = /* @__PURE__ */ new Set();
  return [
    filter((packet) => {
      var _a, _b;
      const key = keyFn(packet);
      if (key === null) {
        return true;
      }
      if (cache.has(key)) {
        (_a = options == null ? void 0 : options.onHit) == null ? void 0 : _a.call(options, packet, cache);
        return false;
      } else {
        cache.add(key);
        (_b = options == null ? void 0 : options.onCache) == null ? void 0 : _b.call(options, packet, cache);
        return true;
      }
    }),
    cache
  ];
}
function tie(flushes) {
  const [fn, memo] = createTie();
  if (flushes) {
    from(flushes).subscribe(() => {
      memo.clear();
    });
  }
  return fn;
}
function createTie() {
  const memo = /* @__PURE__ */ new Map();
  return [
    pipe(
      filter((packet) => {
        var _a;
        return !((_a = memo.get(packet.event.id)) == null ? void 0 : _a.has(packet.from));
      }),
      map((packet) => {
        const seenOn = memo.get(packet.event.id) ?? /* @__PURE__ */ new Set();
        const isNew = seenOn.size <= 0;
        seenOn.add(packet.from);
        memo.set(packet.event.id, seenOn);
        return {
          ...packet,
          seenOn,
          isNew
        };
      })
    ),
    memo
  ];
}
function latest() {
  return pipe(
    scan(
      (acc, packet) => compareEvents(acc.event, packet.event) < 0 ? packet : acc
    ),
    distinctUntilChanged(
      (a, b) => a === b,
      ({ event }) => event.id
    )
  );
}
function latestEach(key) {
  return pipe(groupBy(key), map(pipe(latest())), mergeAll());
}
function verify(verifier) {
  return filterAsync(({ event }) => verifier(event));
}
function filterByKind(kind, options) {
  const { not } = fill(options, { not: false });
  return filter(({ event }) => xor(event.kind === kind, not));
}
function filterByKinds(kinds, options) {
  const { not } = fill(options, { not: false });
  return filter(({ event }) => xor(kinds.includes(event.kind), not));
}
function filterBy(filters, options) {
  const { not } = fill(options, { not: false });
  const evaledFilter = evalFilters(filters);
  return filter(({ event }) => {
    return xor(isFiltered(event, evaledFilter, options), not);
  });
}
function timeline(limit) {
  return scan((acc, packet) => {
    const next = [...acc, packet].sort(
      (a, b) => -1 * compareEvents(a.event, b.event)
    );
    if (limit !== void 0) {
      next.splice(limit);
    }
    return next;
  }, []);
}
function sortEvents(bufferTime, compareFn) {
  return sort(
    bufferTime,
    compareFn ?? ((a, b) => compareEvents(a.event, b.event))
  );
}
function dropExpiredEvents(now2) {
  let refTime = void 0;
  if (now2) {
    refTime = Math.floor((now2 == null ? void 0 : now2.getTime()) / 1e3);
  }
  return filter(({ event }) => !isExpired(event, refTime));
}
function filterByType(type) {
  return filter(
    (packet) => packet.type === type
  );
}
function filterByEventId(eventId, options) {
  const { not } = fill(options, { not: false });
  return filter((p) => xor(p.eventId === eventId, not));
}
function batch(mergeFilter) {
  return mergeMap((packets) => {
    const batched = [];
    for (const packetGroup of groupByRelays(packets)) {
      if (!packetGroup[0]) {
        continue;
      }
      const foldedFilters = packetGroup.map(({ filters }) => filters).reduce((acc, v) => (mergeFilter ?? defaultMergeFilter)(acc, v), []);
      batched.push({ ...packetGroup[0], filters: foldedFilters });
    }
    return from(batched);
  });
}
function groupByRelays(packets) {
  const groups = {};
  const toKey = (relays) => relays ? relays.join(",") : "*";
  for (const packet of packets) {
    const key = toKey(packet.relays);
    groups[key] ?? (groups[key] = []);
    groups[key].push(packet);
  }
  return Object.values(groups);
}
function chunk(predicate, toChunks) {
  return mergeMap(
    (packet) => predicate(packet.filters) ? from(
      toChunks(packet.filters).map((filters) => ({ ...packet, filters }))
    ) : of(packet)
  );
}
function filterAsync(predicate) {
  return mergeMap(
    (packet, index) => from(predicate(packet, index)).pipe(
      mergeMap((result) => result ? of(packet) : EMPTY)
    )
  );
}
function completeOnTimeout(time) {
  return pipe(
    timeout(time),
    catchError((error) => {
      if (error instanceof TimeoutError) {
        return EMPTY;
      } else {
        throw error;
      }
    })
  );
}
function sort(bufferTime, compareFn) {
  const buffer = [];
  return pipe(
    tap((v) => {
      buffer.push(v);
      buffer.sort(compareFn);
    }),
    delay(bufferTime),
    map(() => {
      if (buffer.length <= 0) {
        throw new RxNostrLogicError();
      }
      return buffer.shift();
    })
  );
}
function filterBySubId(subId, options) {
  const { not } = fill(options, { not: false });
  return filter((packet) => xor(packet.subId === subId, not));
}
function defaultMergeFilter(a, b) {
  return [...a, ...b];
}
function xor(x, y) {
  return !x && y || x && !y;
}
var AuthProxy = class {
  constructor(params) {
    __publicField(this, "relay");
    __publicField(this, "config");
    __publicField(this, "authenticator");
    __publicField(this, "ongoings", /* @__PURE__ */ new Set());
    __publicField(this, "authResult$", new Subject());
    __publicField(this, "disposed", false);
    this.relay = params.relay;
    this.config = params.config;
    this.authenticator = params.authenticator;
    const listenOK = this.relay.getOKObservable().subscribe((result) => {
      const { eventId, ok } = result;
      if (!this.ongoings.has(eventId)) {
        return;
      }
      this.ongoings.delete(eventId);
      this.authResult$.next(ok);
      if (!ok) {
        listenOK.unsubscribe();
        listenAUTH.unsubscribe();
      }
    });
    const listenAUTH = this.relay.getAUTHObservable().subscribe(({ challenge }) => {
      this.challenge(challenge);
    });
  }
  getAuthResultObservable() {
    return this.authResult$.asObservable();
  }
  async challenge(challenge) {
    try {
      const event = await this.signer.signEvent({
        kind: 22242,
        content: "",
        tags: [
          ["relay", this.relay.url],
          ["challenge", challenge]
        ]
      });
      this.ongoings.add(event.id);
      this.relay.send(["AUTH", event]);
    } catch {
      this.authResult$.next(false);
    }
  }
  get signer() {
    return this.authenticator.signer ?? this.config.signer;
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const subjects = [this.authResult$];
    for (const sub of subjects) {
      sub.complete();
    }
  }
};
var CounterSubject = class extends BehaviorSubject {
  constructor(count) {
    super(count ?? 0);
  }
  increment() {
    this.next(this.getValue() + 1);
  }
  decrement() {
    this.next(this.getValue() - 1);
  }
  next(x) {
    if (typeof x === "number") {
      super.next(x);
    } else {
      super.next(x(this.getValue()));
    }
  }
};
var NotifySubject = class extends Subject {
  waitNext() {
    return firstValueFrom(this.pipe(first(null, void 0)));
  }
};
var PublishProxy = class {
  constructor(params) {
    __publicField(this, "relay");
    __publicField(this, "authProxy");
    __publicField(this, "pubs", /* @__PURE__ */ new Map());
    __publicField(this, "authRequiredPubs", /* @__PURE__ */ new Set());
    __publicField(this, "count$", new CounterSubject(0));
    __publicField(this, "ok$", new Subject());
    __publicField(this, "disposed", false);
    var _a;
    this.relay = params.relay;
    this.authProxy = params.authProxy;
    this.relay.getReconnectedObservable().subscribe((toRelayMessage) => {
      for (const [type, event] of toRelayMessage) {
        if (type !== "EVENT") {
          continue;
        }
        if (this.pubs.has(event.id)) {
          this.sendEVENT(event);
        }
      }
    });
    this.relay.getOKObservable().subscribe(async (packet) => {
      const { eventId, notice } = packet;
      const event = this.pubs.get(eventId);
      if (!event) {
        return;
      }
      if (this.authProxy && (notice == null ? void 0 : notice.startsWith("auth-required:"))) {
        this.authRequiredPubs.add(eventId);
        this.ok$.next({ ...packet, done: false });
      } else {
        this.ok$.next({
          ...packet,
          done: true
        });
        this.confirmOK(eventId);
      }
    });
    (_a = this.authProxy) == null ? void 0 : _a.getAuthResultObservable().subscribe((ok) => {
      if (ok) {
        for (const eventId of this.authRequiredPubs) {
          const event = this.pubs.get(eventId);
          if (event) {
            this.sendEVENT(event);
          }
        }
      } else {
        for (const eventId of this.authRequiredPubs) {
          this.confirmOK(eventId);
        }
      }
      this.authRequiredPubs.clear();
    });
  }
  async publish(event) {
    if (this.disposed) {
      return;
    }
    if (!this.pubs.has(event.id)) {
      this.pubs.set(event.id, event);
      this.count$.increment();
    }
    return this.sendEVENT(event);
  }
  confirmOK(eventId) {
    if (this.disposed) {
      return;
    }
    if (!this.pubs.has(eventId)) {
      this.pubs.delete(eventId);
      this.count$.decrement();
    }
  }
  getOkAgainstEventObservable() {
    return this.ok$.asObservable();
  }
  getLogicalConnectionSizeObservable() {
    return this.count$.asObservable();
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const subjects = [this.count$, this.ok$];
    for (const sub of subjects) {
      sub.complete();
    }
  }
  sendEVENT(event) {
    return this.relay.send(["EVENT", event]);
  }
};
var ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};
var RelayConnection = class {
  constructor(url, config2) {
    __publicField(this, "socket", null);
    __publicField(this, "buffer", []);
    __publicField(this, "unsent", []);
    __publicField(this, "reconnected$", new Subject());
    __publicField(this, "outgoing$", new Subject());
    __publicField(this, "message$", new Subject());
    __publicField(this, "error$", new Subject());
    __publicField(this, "retryTimer", null);
    __publicField(this, "sendAttempted$", new NotifySubject());
    __publicField(this, "isFirstTry", true);
    __publicField(this, "maybeDown", false);
    __publicField(this, "disposed", false);
    __publicField(this, "state$", new Subject());
    __publicField(this, "_state", "initialized");
    this.url = url;
    this.config = config2;
    if (!config2.skipFetchNip11) {
      Nip11Registry.getOrFetch(url);
    }
    this.setState("initialized");
  }
  get state() {
    return this._state;
  }
  setState(state) {
    this._state = state;
    this.state$.next(state);
  }
  connectManually() {
    this.connect();
  }
  connect(retryCount) {
    if (this.state === "terminated") {
      return;
    }
    const isRetry = typeof retryCount === "number";
    const canConnect = this.state === "initialized" || this.state === "dormant" || this.state === "error" || this.state === "rejected" || isRetry;
    if (!canConnect) {
      return;
    }
    this.socket = this.createSocket(retryCount ?? 0);
  }
  createSocket(retryCount) {
    const isFirstTry = this.isFirstTry;
    this.isFirstTry = false;
    let hasConnected = false;
    const isAutoRetry = retryCount > 0;
    const isManualRetry = !isAutoRetry && (this.state === "error" || this.state === "rejected");
    if (isAutoRetry) {
      this.setState("retrying");
    } else {
      this.setState("connecting");
    }
    const onopen = async () => {
      if (this.state === "terminated") {
        socket == null ? void 0 : socket.close(WebSocketCloseCode.RX_NOSTR_DISPOSED);
        return;
      }
      this.setState("connected");
      hasConnected = true;
      retryCount = 0;
      if (isAutoRetry || isManualRetry) {
        this.reconnected$.next(this.unsent);
        this.unsent = [];
      }
      try {
        for (const message of this.buffer) {
          this.send(message);
        }
      } catch (err) {
        this.error$.next(err);
      } finally {
        this.buffer = [];
      }
    };
    const onmessage = ({ data }) => {
      if (this.state === "terminated") {
        return;
      }
      try {
        this.message$.next(this.pack(JSON.parse(data)));
      } catch (err) {
        this.error$.next(err);
      }
    };
    const onclose = ({ code }) => {
      var _a;
      socket == null ? void 0 : socket.removeEventListener("open", onopen);
      socket == null ? void 0 : socket.removeEventListener("message", onmessage);
      socket == null ? void 0 : socket.removeEventListener("close", onclose);
      if (this.socket === socket) {
        this.socket = null;
      }
      if (this.state === "terminated" || code === WebSocketCloseCode.RX_NOSTR_DISPOSED) {
        this.unsent = [];
        this.buffer = [];
        return;
      }
      if (code === WebSocketCloseCode.RX_NOSTR_IDLE) {
        this.setState("dormant");
        if (this.buffer.length > 0) {
          this.connect();
        }
      } else if (code === WebSocketCloseCode.DONT_RETRY) {
        this.unsent = [];
        this.buffer = [];
        this.error$.next(new RxNostrWebSocketError(code));
        this.setState("rejected");
      } else {
        if (isFirstTry && !hasConnected) {
          this.maybeDown = true;
        }
        this.unsent.push(...this.buffer);
        this.buffer = [];
        this.error$.next(new RxNostrWebSocketError(code));
        const nextRetry = retryCount + 1;
        const shouldRetry = this.config.retry.strategy !== "off" && !(this.config.retry.polite && this.maybeDown) && nextRetry <= this.config.retry.maxCount;
        if (shouldRetry) {
          this.setState("waiting-for-retrying");
          (_a = this.retryTimer) == null ? void 0 : _a.unsubscribe();
          this.retryTimer = retryTimer(this.config.retry, nextRetry).subscribe(
            () => {
              if (!this.disposed) {
                this.connect(nextRetry);
              }
            }
          );
        } else {
          this.setState("error");
        }
      }
    };
    const WebSocket = this.config.websocketCtor ?? globalThis.WebSocket;
    if (!WebSocket) {
      throw new RxNostrInvalidUsageError("WebSocket constructor is missing");
    }
    const socket = (() => {
      try {
        return new WebSocket(this.url);
      } catch (err) {
        onclose({
          type: "close",
          code: 0,
          reason: `${err}`
        });
        return null;
      }
    })();
    socket == null ? void 0 : socket.addEventListener("open", onopen);
    socket == null ? void 0 : socket.addEventListener("message", onmessage);
    socket == null ? void 0 : socket.addEventListener("close", onclose);
    socket == null ? void 0 : socket.addEventListener("error", () => {
    });
    return socket;
  }
  pack(message) {
    const type = message[0];
    const from2 = this.url;
    switch (type) {
      case "EVENT":
        return {
          from: from2,
          type,
          message,
          subId: message[1],
          event: message[2]
        };
      case "EOSE":
        return {
          from: from2,
          type,
          message,
          subId: message[1]
        };
      case "OK":
        return {
          from: from2,
          type,
          message,
          eventId: message[1],
          ok: message[2],
          notice: message[3]
        };
      case "CLOSED":
        return {
          from: from2,
          type,
          message,
          subId: message[1],
          notice: message[2]
        };
      case "NOTICE":
        return {
          from: from2,
          type,
          message,
          notice: message[1]
        };
      case "AUTH":
        return {
          from: from2,
          type,
          message,
          challenge: message[1]
        };
      case "COUNT":
        return {
          from: from2,
          type,
          message,
          subId: message[1],
          count: message[2]
        };
      default:
        return {
          from: from2,
          type: "unknown",
          message
        };
    }
  }
  disconnect(code) {
    var _a;
    if (((_a = this.socket) == null ? void 0 : _a.readyState) === ReadyState.OPEN) {
      this.socket.close(code);
    }
  }
  send(message) {
    const done = this.sendAttempted$.waitNext();
    switch (this.state) {
      case "terminated":
      case "rejected": {
        this.sendAttempted$.next();
        return done;
      }
      case "initialized":
      case "connecting":
      case "dormant": {
        this.buffer.push(message);
        this.connect();
        return done;
      }
      case "connected": {
        if (!this.socket) {
          throw new RxNostrLogicError();
        }
        if (this.socket.readyState === ReadyState.OPEN) {
          this.outgoing$.next({ to: this.url, message });
          this.socket.send(JSON.stringify(message));
          this.sendAttempted$.next();
          return done;
        } else {
          this.buffer.push(message);
        }
        return done;
      }
      case "waiting-for-retrying":
      case "retrying":
      case "error": {
        this.sendAttempted$.next();
        this.unsent.push(message);
        return done;
      }
    }
  }
  getEVENTObservable() {
    return this.message$.pipe(
      filter((p) => p.type === "EVENT")
    );
  }
  getEOSEObservable() {
    return this.message$.pipe(
      filter((p) => p.type === "EOSE")
    );
  }
  getCLOSEDObservable() {
    return this.message$.pipe(
      filter((p) => p.type === "CLOSED")
    );
  }
  getOKObservable() {
    return this.message$.pipe(filter((p) => p.type === "OK"));
  }
  getAUTHObservable() {
    return this.message$.pipe(
      filter((p) => p.type === "AUTH")
    );
  }
  getAllMessageObservable() {
    return this.message$.asObservable();
  }
  getOutgoingMessageObservable() {
    return this.outgoing$.asObservable();
  }
  getReconnectedObservable() {
    return this.reconnected$.asObservable();
  }
  getConnectionStateObservable() {
    return this.state$.pipe(
      distinctUntilChanged(),
      map((state) => ({
        from: this.url,
        state
      }))
    );
  }
  getErrorObservable() {
    return this.error$.asObservable();
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    var _a, _b;
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.setState("terminated");
    (_a = this.retryTimer) == null ? void 0 : _a.unsubscribe();
    (_b = this.socket) == null ? void 0 : _b.close(WebSocketCloseCode.RX_NOSTR_DISPOSED);
    this.socket = null;
    const subjects = [
      this.state$,
      this.outgoing$,
      this.message$,
      this.error$,
      this.reconnected$,
      this.sendAttempted$
    ];
    for (const sub of subjects) {
      sub.complete();
    }
  }
};
function retryTimer(config2, count) {
  switch (config2.strategy) {
    case "exponential": {
      const time = Math.max(
        config2.initialDelay * 2 ** (count - 1) + (Math.random() - 0.5) * 1e3,
        1e3
      );
      return timer(time);
    }
    case "immediately":
      return of(0);
    case "linear":
      return timer(config2.interval);
    case "off":
      return EMPTY;
  }
}
var WebSocketCloseCode = {
  /**
   * 1006 is a reserved value and MUST NOT be set as a status code in a
   * Close control frame by an endpoint.  It is designated for use in
   * applications expecting a status code to indicate that the
   * connection was closed abnormally, e.g., without sending or
   * receiving a Close control frame.
   *
   * See also: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
   */
  ABNORMAL_CLOSURE: 1006,
  /**
   * When a websocket is closed by the relay with a status code 4000
   * that means the client shouldn't try to connect again.
   *
   * See also: https://github.com/nostr-protocol/nips/blob/fab6a21a779460f696f11169ddf343b437327592/01.md?plain=1#L113
   */
  DONT_RETRY: 4e3,
  /** @internal rx-nostr uses it internally. */
  RX_NOSTR_IDLE: 4537,
  /** @internal rx-nostr uses it internally. */
  RX_NOSTR_DISPOSED: 4538
};
var SubscribeProxy = class {
  constructor(params) {
    __publicField(this, "relay");
    __publicField(this, "authProxy");
    __publicField(this, "config");
    __publicField(this, "subs", /* @__PURE__ */ new Map());
    __publicField(this, "authRequiredSubs", /* @__PURE__ */ new Set());
    __publicField(this, "fin$", new Subject());
    __publicField(this, "disposed", false);
    __publicField(this, "queue");
    var _a;
    this.relay = params.relay;
    this.authProxy = params.authProxy;
    this.config = params.config;
    this.queue = new SubQueue(this.relay.url, this.config);
    this.queue.getActivationObservable().subscribe((activated) => {
      for (const { req } of activated) {
        this.sendREQ(req);
      }
    });
    this.relay.getReconnectedObservable().subscribe(() => {
      for (const { req } of this.queue.ongoings) {
        this.sendREQ(req);
      }
    });
    this.relay.getEOSEObservable().subscribe(({ subId }) => {
      var _a2;
      if ((_a2 = this.subs.get(subId)) == null ? void 0 : _a2.autoclose) {
        this.unsubscribe(subId);
      }
    });
    this.relay.getCLOSEDObservable().subscribe(async ({ subId, notice }) => {
      const sub = this.subs.get(subId);
      if (!sub) {
        return;
      }
      if (this.authProxy && (notice == null ? void 0 : notice.startsWith("auth-required:"))) {
        this.authRequiredSubs.add(subId);
      } else {
        this.fin(subId);
      }
    });
    (_a = this.authProxy) == null ? void 0 : _a.getAuthResultObservable().subscribe((ok) => {
      var _a2;
      if (ok) {
        for (const subId of this.authRequiredSubs) {
          const req = (_a2 = this.subs.get(subId)) == null ? void 0 : _a2.req;
          if (req) {
            this.sendREQ(req);
          }
        }
      } else {
        for (const subId of this.authRequiredSubs) {
          this.fin(subId);
        }
      }
      this.authRequiredSubs.clear();
    });
  }
  subscribe(req, autoclose) {
    if (this.disposed) {
      return;
    }
    const subId = req[1];
    const sub = {
      subId,
      req,
      autoclose
    };
    this.subs.set(subId, sub);
    this.queue.enqueue(sub);
  }
  unsubscribe(subId) {
    if (this.disposed) {
      return;
    }
    if (this.subs.has(subId)) {
      this.sendCLOSE(subId);
    }
    this.fin(subId);
  }
  isOngoingOrQueued(subId) {
    return this.subs.has(subId);
  }
  getEventObservable() {
    return this.relay.getEVENTObservable().pipe(
      filter(({ subId, event }) => {
        var _a;
        const filters = (_a = this.subs.get(subId)) == null ? void 0 : _a.filters;
        if (!filters) {
          return false;
        }
        return this.config.skipValidateFilterMatching || isFiltered(event, filters);
      })
    );
  }
  getFinObservable() {
    return this.fin$.asObservable();
  }
  getLogicalConnectionSizeObservable() {
    return this.queue.getSizeObservable();
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const subjects = [this.fin$];
    for (const sub of subjects) {
      sub.complete();
    }
    this.queue.dispose();
  }
  sendREQ([, subId, ...lazyFilters]) {
    const filters = evalFilters(lazyFilters);
    const sub = this.subs.get(subId);
    if (!sub) {
      return;
    }
    sub.filters = filters;
    this.relay.send(["REQ", subId, ...filters]);
  }
  sendCLOSE(subId) {
    this.relay.send(["CLOSE", subId]);
  }
  fin(subId) {
    this.subs.delete(subId);
    this.queue.drop(subId);
    this.fin$.next({
      from: this.relay.url,
      subId
    });
  }
};
var SubQueue = class {
  constructor(url, config2) {
    __publicField(this, "_queuings", []);
    __publicField(this, "_ongoings", []);
    __publicField(this, "activated$", new Subject());
    __publicField(this, "count$", new CounterSubject());
    this.url = url;
    this.config = config2;
  }
  get queuings() {
    return this._queuings;
  }
  set queuings(v) {
    this._queuings = v;
  }
  get ongoings() {
    return this._ongoings;
  }
  set ongoings(v) {
    this._ongoings = v;
  }
  enqueue(v) {
    this.queuings = [...this.queuings, v];
    this.count$.increment();
    this.shift();
  }
  drop(subId) {
    const remove = (arr, subId2) => {
      const prevLength = arr.length;
      const filtered = arr.filter((e) => e.subId !== subId2);
      const removed = prevLength - filtered.length;
      return [filtered, removed];
    };
    const [queuings, droppedX] = remove(this.queuings, subId);
    const [ongoings, droppedY] = remove(this.ongoings, subId);
    this.queuings = queuings;
    this.ongoings = ongoings;
    this.count$.next((v) => v - (droppedX + droppedY));
    this.shift();
  }
  getActivationObservable() {
    return this.activated$.asObservable();
  }
  getSizeObservable() {
    return this.count$.asObservable();
  }
  dispose() {
    const subjects = [this.activated$, this.count$];
    for (const sub of subjects) {
      sub.complete();
    }
  }
  async shift() {
    const capacity = await this.capacity();
    const concated = [...this.ongoings, ...this.queuings];
    const ongoings = concated.slice(0, capacity);
    const queuings = concated.slice(capacity);
    const activated = this.queuings.slice(0, capacity - this.ongoings.length);
    this.ongoings = ongoings;
    this.queuings = queuings;
    if (activated.length > 0) {
      this.activated$.next(activated);
    }
  }
  async capacity() {
    const capacity = await Nip11Registry.getValue(
      this.url,
      (data) => {
        var _a;
        return (_a = data.limitation) == null ? void 0 : _a.max_subscriptions;
      },
      {
        skipFetch: this.config.skipFetchNip11
      }
    );
    return capacity ?? Infinity;
  }
};
var NostrConnection = class {
  constructor(url, config2) {
    __publicField(this, "relay");
    __publicField(this, "pubProxy");
    __publicField(this, "subProxy");
    __publicField(this, "defaultSubscriptionIds", /* @__PURE__ */ new Set());
    __publicField(this, "communicating", false);
    __publicField(this, "strategy", "lazy");
    __publicField(this, "disconnectTimeout");
    __publicField(this, "disconnectTimer");
    __publicField(this, "isDefaultRelay", false);
    __publicField(this, "disposed", false);
    __publicField(this, "_url");
    this._url = normalizeRelayUrl(url);
    const authenticator = getAuthenticator(url, config2);
    const relay = new RelayConnection(this.url, config2);
    const authProxy = authenticator ? new AuthProxy({ relay, config: config2, authenticator }) : null;
    const pubProxy = new PublishProxy({ relay, authProxy });
    const subProxy = new SubscribeProxy({ relay, authProxy, config: config2 });
    this.relay = relay;
    this.pubProxy = pubProxy;
    this.subProxy = subProxy;
    this.disconnectTimeout = config2.disconnectTimeout;
    combineLatest([
      this.pubProxy.getLogicalConnectionSizeObservable(),
      this.subProxy.getLogicalConnectionSizeObservable()
    ]).pipe(map(([pubConns, subConns]) => pubConns + subConns)).subscribe((logicalConns) => {
      this.communicating = logicalConns > 0;
      this.resetConnection();
    });
  }
  get url() {
    return this._url;
  }
  setConnectionStrategy(strategy) {
    if (this.disposed) {
      return;
    }
    this.strategy = strategy;
    this.resetConnection();
  }
  resetConnection() {
    let strategy = this.strategy;
    if (!this.isDefaultRelay) {
      strategy = "lazy";
    }
    switch (strategy) {
      case "lazy": {
        const disconnect = () => {
          if (!this.communicating) {
            this.relay.disconnect(WebSocketCloseCode.RX_NOSTR_IDLE);
          }
        };
        if (this.disconnectTimeout > 0) {
          if (this.disconnectTimeout) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = void 0;
          }
          this.disconnectTimer = setTimeout(disconnect, this.disconnectTimeout);
        } else
          disconnect();
        break;
      }
      case "lazy-keep": {
        break;
      }
      case "aggressive": {
        if (this.connectionState === "initialized" || this.connectionState === "dormant") {
          this.relay.connectManually();
        }
        break;
      }
    }
  }
  markAsDefault(flag) {
    if (this.disposed) {
      return;
    }
    this.isDefaultRelay = flag;
    if (!this.isDefaultRelay) {
      for (const subId of this.defaultSubscriptionIds) {
        this.subProxy.unsubscribe(subId);
      }
      this.defaultSubscriptionIds.clear();
    }
    this.resetConnection();
  }
  async publish(event) {
    if (this.disposed) {
      return;
    }
    return this.pubProxy.publish(event);
  }
  confirmOK(eventId) {
    if (this.disposed) {
      return;
    }
    this.pubProxy.confirmOK(eventId);
  }
  subscribe(req, options) {
    if (this.disposed) {
      return;
    }
    const { mode, overwrite, autoclose } = fill(options ?? {}, {
      overwrite: false,
      autoclose: false,
      mode: "default"
    });
    const [, subId] = req;
    if (mode === "default" && !this.isDefaultRelay) {
      return;
    }
    if (!overwrite && this.subProxy.isOngoingOrQueued(subId)) {
      return;
    }
    if (mode === "default") {
      this.defaultSubscriptionIds.add(subId);
    }
    this.subProxy.subscribe(req, autoclose);
  }
  unsubscribe(subId) {
    if (this.disposed) {
      return;
    }
    this.defaultSubscriptionIds.delete(subId);
    this.subProxy.unsubscribe(subId);
  }
  getEventObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.subProxy.getEventObservable();
  }
  getFinObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.subProxy.getFinObservable();
  }
  getOkAgainstEventObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.pubProxy.getOkAgainstEventObservable();
  }
  getAllMessageObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.relay.getAllMessageObservable();
  }
  getOutgoingMessageObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.relay.getOutgoingMessageObservable();
  }
  getConnectionStateObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.relay.getConnectionStateObservable();
  }
  get connectionState() {
    return this.relay.state;
  }
  getErrorObservable() {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    return this.relay.getErrorObservable().pipe(
      map((reason) => ({
        from: this.url,
        reason
      }))
    );
  }
  connectManually() {
    this.relay.connectManually();
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.disconnectTimer)
      clearTimeout(this.disconnectTimer);
    this.disconnectTimer = void 0;
    this.relay.dispose();
    this.pubProxy.dispose();
    this.subProxy.dispose();
  }
};
function getAuthenticator(url, config2) {
  const a = config2.authenticator;
  if (!a) {
    return;
  }
  const c = a instanceof Function ? a(url) : a;
  return c === "auto" ? {} : c;
}
function subtract(x, y) {
  return x.filter((e) => !y.includes(e));
}
function makeSubId(params) {
  const { rxReq, index } = params;
  const { rxReqId, strategy } = rxReq;
  const childId = strategy === "backward" ? index : 0;
  return `${rxReqId}:${childId}`;
}
function makeLazyREQ(params) {
  const { rxReq, filters, index } = params;
  return ["REQ", makeSubId({ rxReq, index }), ...filters];
}
function normalizeRelaysConfig(config2) {
  if (Array.isArray(config2)) {
    const arr = config2.map((urlOrConfig) => {
      let url = "";
      let read = false;
      let write = false;
      if (typeof urlOrConfig === "string") {
        url = urlOrConfig;
        read = true;
        write = true;
      } else if (Array.isArray(urlOrConfig)) {
        const mode = urlOrConfig[2];
        url = urlOrConfig[1];
        read = !mode || mode === "read";
        write = !mode || mode === "write";
      } else {
        url = urlOrConfig.url;
        read = urlOrConfig.read;
        write = urlOrConfig.write;
      }
      return {
        url,
        read,
        write
      };
    });
    return Object.fromEntries(arr.map((e) => [e.url, e]));
  } else {
    const arr = Object.entries(config2).map(([url, flags]) => ({
      url,
      ...flags
    }));
    return Object.fromEntries(arr.map((e) => [e.url, e]));
  }
}
function getMethodScopeRelays(rxNostr, options) {
  const targets = /* @__PURE__ */ new Set();
  if (options == null ? void 0 : options.on) {
    const on = options.on;
    if (!on.defaultReadRelays && !on.defaultWriteRelays && !on.relays) {
      return void 0;
    }
    const defaultRelays = rxNostr.getDefaultRelays();
    if (on.defaultReadRelays) {
      for (const { url } of Object.values(defaultRelays).filter(
        (e) => e.read
      )) {
        targets.add(url);
      }
    }
    if (on.defaultWriteRelays) {
      for (const { url } of Object.values(defaultRelays).filter(
        (e) => e.write
      )) {
        targets.add(url);
      }
    }
    if (on.relays) {
      for (const url of on.relays) {
        targets.add(normalizeRelayUrl(url));
      }
    }
    return [...targets];
  } else if (options == null ? void 0 : options.relays) {
    for (const url of options.relays) {
      targets.add(normalizeRelayUrl(url));
    }
    return [...targets];
  } else {
    return void 0;
  }
}
function createRxNostr(config2 = {}) {
  return new RxNostrImpl(makeRxNostrConfig(config2));
}
var RxNostrImpl = class {
  constructor(config2) {
    __publicField(this, "connections", new UrlMap());
    __publicField(this, "defaultRelays", new UrlMap());
    __publicField(this, "defaultSubscriptions", /* @__PURE__ */ new Map());
    __publicField(this, "event$", new Subject());
    __publicField(this, "fin$", new Subject());
    __publicField(this, "ok$", new Subject());
    __publicField(this, "all$", new Subject());
    __publicField(this, "error$", new Subject());
    __publicField(this, "connectionState$", new Subject());
    __publicField(this, "outgoing$", new Subject());
    __publicField(this, "dispose$", new Subject());
    __publicField(this, "disposed", false);
    this.config = config2;
  }
  get defaultReadableConnections() {
    const conns = [];
    for (const { url, read } of this.defaultRelays.values()) {
      const conn = this.connections.get(url);
      if (read && conn) {
        conns.push(conn);
      }
    }
    return conns;
  }
  get defaultWritableConnections() {
    const conns = [];
    for (const { url, write } of this.defaultRelays.values()) {
      const conn = this.connections.get(url);
      if (write && conn) {
        conns.push(conn);
      }
    }
    return conns;
  }
  // #region defaultRelays getter/setter
  getDefaultRelays(options) {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    const filter2 = ({ read, write }) => {
      if (!(options == null ? void 0 : options.filter)) {
        return true;
      }
      switch (options.filter) {
        case "all":
          return true;
        case "read-all":
          return read;
        case "write-all":
          return write;
        case "read-only":
          return read && !write;
        case "write-only":
          return !read && write;
      }
    };
    const relays = this.defaultRelays.toObject();
    const filtered = Object.values(relays).filter(filter2).map((config2) => [config2.url, config2]);
    return Object.fromEntries(filtered);
  }
  getDefaultRelay(url) {
    return this.defaultRelays.get(url);
  }
  setDefaultRelays(relays) {
    if (this.disposed) {
      throw new RxNostrAlreadyDisposedError();
    }
    const nextDefaultRelays = new UrlMap(normalizeRelaysConfig(relays));
    const nextReadableConnections = [];
    for (const { read, url } of nextDefaultRelays.values()) {
      const conn = this.ensureNostrConnection(url);
      conn.setConnectionStrategy(this.config.connectionStrategy);
      if (read) {
        nextReadableConnections.push(conn);
      }
    }
    this.updateDefaultSubscriptions(nextReadableConnections);
    this.defaultRelays = nextDefaultRelays;
  }
  ensureNostrConnection(url) {
    let conn = this.connections.get(url);
    if (conn) {
      return conn;
    }
    conn = new NostrConnection(url, this.config);
    this.attachNostrConnection(conn);
    this.connections.set(url, conn);
    return conn;
  }
  attachNostrConnection(conn) {
    conn.getEventObservable().subscribe(this.event$);
    conn.getFinObservable().subscribe(this.fin$);
    conn.getOkAgainstEventObservable().subscribe(this.ok$);
    conn.getAllMessageObservable().subscribe(this.all$);
    conn.getConnectionStateObservable().subscribe(this.connectionState$);
    conn.getErrorObservable().subscribe(this.error$);
    conn.getOutgoingMessageObservable().subscribe(this.outgoing$);
  }
  updateDefaultSubscriptions(nextReadableConnections) {
    const noLongerNeededConnections = subtract(
      this.defaultReadableConnections,
      nextReadableConnections
    );
    for (const conn of noLongerNeededConnections) {
      conn.markAsDefault(false);
    }
    for (const conn of nextReadableConnections) {
      conn.markAsDefault(true);
      for (const { req, autoclose } of this.defaultSubscriptions.values()) {
        conn == null ? void 0 : conn.subscribe(req, {
          mode: "default",
          overwrite: false,
          autoclose
        });
      }
    }
  }
  addDefaultRelays(relays) {
    const additionalDefaultRelays = normalizeRelaysConfig(relays);
    this.setDefaultRelays({
      ...this.defaultRelays.toObject(),
      ...additionalDefaultRelays
    });
  }
  removeDefaultRelays(urls) {
    const defaultRelays = this.defaultRelays.copy();
    const targets = Array.isArray(urls) ? urls : [urls];
    for (const url of targets) {
      defaultRelays.delete(url);
    }
    this.setDefaultRelays(defaultRelays.toObject());
  }
  // #endregion
  // #region connection state getter
  getAllRelayStatus() {
    return Object.fromEntries(
      Array.from(this.connections.values()).map((e) => [
        e.url,
        { connection: e.connectionState }
      ])
    );
  }
  getRelayStatus(url) {
    const conn = this.connections.get(url);
    if (!conn) {
      return void 0;
    }
    return { connection: conn.connectionState };
  }
  // #endregion
  reconnect(url) {
    const relay = this.getDefaultRelay(url);
    if (!relay) {
      throw new RxNostrInvalidUsageError(
        `The relay (${url}) is not a default relay. \`reconnect()\` can be used only for a readable default relay.`
      );
    }
    if (!relay.read) {
      throw new RxNostrInvalidUsageError(
        `The relay (${url}) is not readable. \`reconnect()\` can be used only for a readable default relay.`
      );
    }
    const conn = this.connections.get(url);
    if (!conn) {
      throw new RxNostrLogicError();
    }
    if (conn.connectionState === "error" || conn.connectionState === "rejected") {
      conn.connectManually();
    }
  }
  // #region use
  use(rxReq, options) {
    const useScopeRelays = getMethodScopeRelays(this, options);
    const makeOrderPacket = ({ filters, relays }, index) => {
      var _a;
      const emitScopeRelays = rxReq.strategy === "backward" ? relays : void 0;
      const req = makeLazyREQ({ rxReq, filters, index });
      const subId = req[1];
      return {
        subId,
        req,
        targetConnections: ((_a = emitScopeRelays ?? useScopeRelays) == null ? void 0 : _a.map(
          (url) => this.ensureNostrConnection(url)
        )) ?? this.defaultReadableConnections,
        mode: emitScopeRelays === void 0 && useScopeRelays === void 0 ? "default" : "temporary"
      };
    };
    const startSubscription = ({
      req,
      targetConnections,
      mode
    }) => {
      this.startSubscription({
        req,
        targetConnections,
        mode,
        overwrite: rxReq.strategy === "forward",
        autoclose: rxReq.strategy === "backward"
      });
    };
    const teardownSubscription = ({
      subId,
      targetConnections,
      mode
    }) => {
      this.teardownSubscription({
        subId,
        targetConnections,
        mode
      });
    };
    const createEventObservable = ({ req, targetConnections }) => {
      if (rxReq.strategy === "forward") {
        return this.createForwardEventObservable({
          req
        }).pipe(takeUntil(this.dispose$));
      } else {
        return this.createBackwardEventObservable({
          req,
          targetConnections
        }).pipe(takeUntil(this.dispose$));
      }
    };
    const order$ = rxReq.getReqPacketObservable().pipe(
      filter(({ filters }) => filters.length > 0),
      map(makeOrderPacket),
      takeUntil(this.dispose$)
    );
    const validate = () => filterAsync(async ({ event }) => {
      return (this.config.skipVerify || await this.config.verifier(event)) && (this.config.skipExpirationCheck || !isExpired(event));
    });
    if (rxReq.strategy === "forward") {
      let firstOrder;
      return order$.pipe(
        tap((order) => {
          firstOrder = order;
        }),
        tap(startSubscription),
        map(createEventObservable),
        finalize(() => {
          if (!firstOrder) {
            return;
          }
          teardownSubscription(firstOrder);
        }),
        switchAll(),
        validate()
      );
    } else {
      return order$.pipe(
        tap(startSubscription),
        map(
          (order) => createEventObservable(order).pipe(
            finalize(() => {
              teardownSubscription(order);
            })
          )
        ),
        mergeAll(),
        validate()
      );
    }
  }
  createForwardEventObservable(params) {
    const { req } = params;
    const subId = req[1];
    return this.event$.pipe(filterBySubId(subId));
  }
  createBackwardEventObservable(params) {
    const { req, targetConnections } = params;
    const subId = req[1];
    const finishedRelays = /* @__PURE__ */ new Set();
    const isDown = (state) => state === "error" || state === "rejected" || state === "terminated";
    const shouldComplete = () => targetConnections.every(
      ({ connectionState, url }) => isDown(connectionState) || finishedRelays.has(url)
    );
    const fin$ = this.fin$.pipe(
      filterBySubId(subId),
      tap(({ from: from2 }) => {
        finishedRelays.add(from2);
      })
    );
    const complete$ = merge(fin$, this.connectionState$.asObservable()).pipe(
      filter(() => shouldComplete()),
      first(null, void 0)
    );
    return this.event$.pipe(
      takeUntil(complete$),
      completeOnTimeout(this.config.eoseTimeout),
      filterBySubId(subId),
      filter((e) => !finishedRelays.has(e.from))
    );
  }
  startSubscription(params) {
    const { req, targetConnections, mode, overwrite, autoclose } = params;
    const subId = req[1];
    if (mode === "default") {
      this.defaultSubscriptions.set(subId, { req, autoclose });
    }
    for (const conn of targetConnections) {
      conn.subscribe(req, {
        mode,
        overwrite,
        autoclose
      });
    }
  }
  teardownSubscription(params) {
    const { subId, targetConnections, mode } = params;
    if (mode === "default") {
      this.defaultSubscriptions.delete(subId);
    }
    for (const conn of targetConnections) {
      conn.unsubscribe(subId);
    }
  }
  // #endregion use
  // #region createObservable
  createAllEventObservable() {
    return this.event$.asObservable();
  }
  createAllErrorObservable() {
    return this.error$.asObservable();
  }
  createAllMessageObservable() {
    return this.all$.asObservable();
  }
  createConnectionStateObservable() {
    return this.connectionState$.asObservable();
  }
  createOutgoingMessageObservable() {
    return this.outgoing$.asObservable();
  }
  // #endregion
  send(params, options) {
    const { signer, errorOnTimeout, completeOn } = fill(options ?? {}, {
      signer: this.config.signer,
      errorOnTimeout: false,
      completeOn: "all-ok"
    });
    const relays = getMethodScopeRelays(this, options);
    const targetRelays = relays === void 0 ? this.defaultWritableConnections : relays.map((url) => this.ensureNostrConnection(url));
    const subject = new Subject();
    const finishedRelays = /* @__PURE__ */ new Set();
    let eventId = "";
    const teardown = () => {
      if (!subject.closed) {
        subject.complete();
      }
      for (const conn of targetRelays) {
        conn.confirmOK(eventId);
      }
    };
    signer.signEvent(params).then(async (event) => {
      if (subject.closed) {
        return;
      }
      eventId = event.id;
      this.ok$.pipe(filter(({ eventId: eventId2 }) => eventId2 === event.id)).subscribe(subject);
      await Promise.all(targetRelays.map((conn) => conn.publish(event)));
      if (completeOn === "sent") {
        subject.complete();
      }
    }).catch((err) => {
      teardown();
      throw new RxNostrInvalidUsageError(
        err instanceof Error ? err.message : "Failed to sign the given event"
      );
    });
    const completeManager = (() => {
      switch (completeOn) {
        case "sent":
          return identity;
        case "all-ok":
          return takeWhile(({ from: from2, done }) => {
            if (done) {
              finishedRelays.add(from2);
            }
            return finishedRelays.size < targetRelays.length;
          }, true);
        case "any-ok":
          return first((p) => p.ok);
      }
    })();
    return subject.pipe(
      completeManager,
      takeUntil(this.dispose$),
      errorOnTimeout ? timeout(this.config.okTimeout) : completeOnTimeout(this.config.okTimeout),
      finalize(teardown)
    );
  }
  async cast(params, options) {
    await firstValueFrom(this.send(params, { ...options, completeOn: "sent" }));
  }
  dispose() {
    this[Symbol.dispose]();
  }
  [Symbol.dispose]() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const conn of this.connections.values()) {
      conn.dispose();
    }
    this.connections.clear();
    const subjects = [
      this.event$,
      this.ok$,
      this.fin$,
      this.all$,
      this.connectionState$,
      this.error$,
      this.outgoing$
    ];
    for (const sub of subjects) {
      sub.complete();
    }
    this.dispose$.next();
    this.dispose$.complete();
  }
};
var createRxReq = (params) => {
  const { strategy } = params;
  const _operators = params.operators ?? [];
  const rxReqId = params.rxReqId ?? getRandomDigitsString();
  const filters$ = params.subject ?? new Subject();
  return {
    strategy,
    rxReqId,
    getReqPacketObservable() {
      return filters$.pipe(..._operators);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipe(...operators) {
      return createRxReq({
        strategy,
        rxReqId,
        operators: [..._operators, ...operators],
        subject: filters$
      });
    },
    emit(filters, options) {
      filters$.next({ filters: normalizeFilters(filters), ...options ?? {} });
    },
    over() {
      filters$.complete();
    }
  };
};
function createRxBackwardReq(rxReqId) {
  return createRxReq({
    strategy: "backward",
    rxReqId
  });
}
function createRxForwardReq(rxReqId) {
  return createRxReq({
    strategy: "forward",
    rxReqId
  });
}
function createRxOneshotReq(params) {
  return {
    strategy: "backward",
    rxReqId: params.rxReqId ?? getRandomDigitsString(),
    getReqPacketObservable: () => of({ filters: normalizeFilters(params.filters) })
  };
}
function getRandomDigitsString() {
  return `${Math.floor(Math.random() * 1e6)}`;
}
function normalizeFilter(filter2) {
  var _a, _b;
  const res = {};
  const isTagName = (s) => /^#[a-zA-Z]$/.test(s);
  for (const key of Object.keys(filter2)) {
    if (key === "limit" && (filter2[key] ?? -1) >= 0) {
      res[key] = filter2[key];
      continue;
    }
    if (key === "since" || key === "until") {
      const f = filter2[key];
      if (typeof f !== "number" || (f ?? -1) >= 0) {
        res[key] = f;
        continue;
      }
    }
    if ((isTagName(key) || key === "ids" || key === "authors") && filter2[key] !== void 0 && (((_a = filter2[key]) == null ? void 0 : _a.length) ?? -1) > 0) {
      res[key] = filter2[key];
      continue;
    }
    if (key === "kinds" && filter2[key] !== void 0 && (((_b = filter2[key]) == null ? void 0 : _b.length) ?? -1) > 0) {
      res[key] = filter2[key];
      continue;
    }
    if (key === "search" && filter2[key] !== void 0) {
      res[key] = filter2[key];
      continue;
    }
  }
  const timeRangeIsValid = typeof res.since !== "number" || typeof res.until !== "number" || res.since <= res.until;
  if (!timeRangeIsValid) {
    return null;
  }
  return res;
}
function normalizeFilters(filters) {
  return (Array.isArray(filters) ? filters : [filters]).map((e) => normalizeFilter(e)).filter((e) => e !== null);
}
function now() {
  return Math.floor(Date.now() / 1e3);
}
export {
  Nip11Registry,
  RxNostrAlreadyDisposedError,
  RxNostrEnvironmentError,
  RxNostrError,
  RxNostrInvalidUsageError,
  RxNostrLogicError,
  RxNostrWebSocketError,
  batch,
  chunk,
  compareEvents,
  completeOnTimeout,
  createRxBackwardReq,
  createRxForwardReq,
  createRxNostr,
  createRxOneshotReq,
  createTie,
  createUniq,
  dropExpiredEvents,
  earlierEvent,
  evalFilters,
  fetchRelayInfo,
  filterAsync,
  filterBy,
  filterByEventId,
  filterByKind,
  filterByKinds,
  filterBySubId,
  filterByType,
  isExpired,
  isFiltered,
  laterEvent,
  latest,
  latestEach,
  nip07Signer,
  noopSigner,
  noopVerifier,
  now,
  sort,
  sortEvents,
  tie,
  timeline,
  toHex,
  uniq,
  verify
};
/*! Bundled license information:

rx-nostr/dist/rx-nostr.js:
  (*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
