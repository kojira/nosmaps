var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// dist/rx-nostr.js
var rx_nostr_exports = {};
__export(rx_nostr_exports, {
  Nip11Registry: () => Nip11Registry,
  RxNostrAlreadyDisposedError: () => RxNostrAlreadyDisposedError,
  RxNostrEnvironmentError: () => RxNostrEnvironmentError,
  RxNostrError: () => RxNostrError,
  RxNostrInvalidUsageError: () => RxNostrInvalidUsageError,
  RxNostrLogicError: () => RxNostrLogicError,
  RxNostrWebSocketError: () => RxNostrWebSocketError,
  batch: () => batch,
  chunk: () => chunk,
  compareEvents: () => compareEvents,
  completeOnTimeout: () => completeOnTimeout,
  createRxBackwardReq: () => createRxBackwardReq,
  createRxForwardReq: () => createRxForwardReq,
  createRxNostr: () => createRxNostr,
  createRxOneshotReq: () => createRxOneshotReq,
  createTie: () => createTie,
  createUniq: () => createUniq,
  dropExpiredEvents: () => dropExpiredEvents,
  earlierEvent: () => earlierEvent,
  evalFilters: () => evalFilters,
  fetchRelayInfo: () => fetchRelayInfo,
  filterAsync: () => filterAsync,
  filterBy: () => filterBy,
  filterByEventId: () => filterByEventId,
  filterByKind: () => filterByKind,
  filterByKinds: () => filterByKinds,
  filterBySubId: () => filterBySubId,
  filterByType: () => filterByType,
  isExpired: () => isExpired,
  isFiltered: () => isFiltered,
  laterEvent: () => laterEvent,
  latest: () => latest,
  latestEach: () => latestEach,
  nip07Signer: () => nip07Signer,
  noopSigner: () => noopSigner,
  noopVerifier: () => noopVerifier,
  now: () => now,
  sort: () => sort,
  sortEvents: () => sortEvents,
  tie: () => tie,
  timeline: () => timeline,
  toHex: () => toHex,
  uniq: () => uniq,
  verify: () => verify
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
function bech32Polymod2(pre) {
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
    chk = bech32Polymod2(chk) ^ c >> 5;
  }
  chk = bech32Polymod2(chk);
  for (let i = 0; i < len; i++)
    chk = bech32Polymod2(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod2(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = bech32Polymod2(chk);
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
function arrRemove(arr, item) {
  if (arr) {
    var index = arr.indexOf(item);
    0 <= index && arr.splice(index, 1);
  }
}
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
function bind(fn, thisArg) {
  return _bind.call(fn, thisArg);
}
function handleUnhandledError(error) {
  {
    reportUnhandledError(error);
  }
}
function defaultErrorHandler(err) {
  throw err;
}
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
function executeSchedule(parentSubscription, scheduler, work, delay22, repeat) {
  if (delay22 === void 0) {
    delay22 = 0;
  }
  if (repeat === void 0) {
    repeat = false;
  }
  var scheduleSubscription = scheduler.schedule(function() {
    work();
    if (repeat) {
      parentSubscription.add(this.schedule(null, delay22));
    } else {
      this.unsubscribe();
    }
  }, delay22);
  parentSubscription.add(scheduleSubscription);
  if (!repeat) {
    return scheduleSubscription;
  }
}
function observeOn(scheduler, delay22) {
  if (delay22 === void 0) {
    delay22 = 0;
  }
  return operate(function(source, subscriber) {
    source.subscribe(createOperatorSubscriber(subscriber, function(value) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.next(value);
      }, delay22);
    }, function() {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.complete();
      }, delay22);
    }, function(err) {
      return executeSchedule(subscriber, scheduler, function() {
        return subscriber.error(err);
      }, delay22);
    }));
  });
}
function subscribeOn(scheduler, delay22) {
  if (delay22 === void 0) {
    delay22 = 0;
  }
  return operate(function(source, subscriber) {
    subscriber.add(scheduler.schedule(function() {
      return source.subscribe(subscriber);
    }, delay22));
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
    var startTimer = function(delay22) {
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
      }, delay22);
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
function callOrApply(fn, args) {
  return isArray$1(args) ? fn.apply(void 0, __spreadArray([], __read(args))) : fn(args);
}
function mapOneOrManyArgs(fn) {
  return map(function(args) {
    return callOrApply(fn, args);
  });
}
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
  const cache2 = /* @__PURE__ */ new Set();
  return [
    filter((packet) => {
      var _a, _b;
      const key = keyFn(packet);
      if (key === null) {
        return true;
      }
      if (cache2.has(key)) {
        (_a = options == null ? void 0 : options.onHit) == null ? void 0 : _a.call(options, packet, cache2);
        return false;
      } else {
        cache2.add(key);
        (_b = options == null ? void 0 : options.onCache) == null ? void 0 : _b.call(options, packet, cache2);
        return true;
      }
    }),
    cache2
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
function verify(verifier2) {
  return filterAsync(({ event }) => verifier2(event));
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
      let read2 = false;
      let write = false;
      if (typeof urlOrConfig === "string") {
        url = urlOrConfig;
        read2 = true;
        write = true;
      } else if (Array.isArray(urlOrConfig)) {
        const mode = urlOrConfig[2];
        url = urlOrConfig[1];
        read2 = !mode || mode === "read";
        write = !mode || mode === "write";
      } else {
        url = urlOrConfig.url;
        read2 = urlOrConfig.read;
        write = urlOrConfig.write;
      }
      return {
        url,
        read: read2,
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
var __defProp2, __defNormalProp, __publicField, RxNostrError, RxNostrWebSocketError, RxNostrInvalidUsageError, RxNostrEnvironmentError, RxNostrLogicError, RxNostrAlreadyDisposedError, fill, noopVerifier, emptyVerifier, makeRxNostrConfig, UrlMap, Nip11Registry, hasHexBuiltin, hexes, gcd, radix2carry, powers, BECH_ALPHABET, POLYMOD_GENERATORS, bech32, extendStatics, UnsubscriptionError, Subscription, EMPTY_SUBSCRIPTION, config, timeoutProvider, Subscriber, _bind, ConsumerObserver, SafeSubscriber, EMPTY_OBSERVER, observable, Observable, OperatorSubscriber, ObjectUnsubscribedError, Subject, AnonymousSubject, BehaviorSubject, dateTimestampProvider, Action, intervalProvider, AsyncAction, Scheduler, AsyncScheduler, asyncScheduler, async, EMPTY, isArrayLike, iterator, EmptyError, TimeoutError, isArray$1, isArray, getPrototypeOf, objectProto, getKeys, AuthProxy, CounterSubject, NotifySubject, PublishProxy, ReadyState, RelayConnection, WebSocketCloseCode, SubscribeProxy, SubQueue, NostrConnection, RxNostrImpl, createRxReq;
var init_rx_nostr = __esm({
  "dist/rx-nostr.js"() {
    "use strict";
    __defProp2 = Object.defineProperty;
    __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    __publicField = (obj, key, value) => {
      __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
      return value;
    };
    RxNostrError = class extends Error {
    };
    RxNostrWebSocketError = class extends RxNostrError {
      constructor(code) {
        super(
          `RxNostrWebSocketError: WebSocket was closed with code ${code} by relay.`
        );
        this.code = code;
        this.name = "RxNostrWebSocketError";
      }
    };
    RxNostrInvalidUsageError = class extends RxNostrError {
      constructor(message) {
        super(`RxNostrInvalidUsageError: ${message}`);
        this.name = "RxNostrInvalidUsageError";
      }
    };
    RxNostrEnvironmentError = class extends RxNostrError {
      constructor(message) {
        super(`RxNostrEnvironmentError: ${message}`);
        this.name = "RxNostrEnvironmentError";
      }
    };
    RxNostrLogicError = class extends RxNostrError {
      constructor() {
        super(
          "RxNostrLogicError: This is rx-nostr's internal bug. Please report to the author of the library."
        );
        this.name = "RxNostrLogicError";
      }
    };
    RxNostrAlreadyDisposedError = class extends RxNostrError {
      constructor() {
        super(
          "RxNostrAlreadyDisposedError: Attempted to access a disposed resource."
        );
        this.name = "RxNostrAlreadyDisposedError";
      }
    };
    fill = (config2, defaults) => ({
      ...defaults,
      ...config2
    });
    noopVerifier = async () => true;
    emptyVerifier = async () => {
      throw new Error(
        "You must give some verifier to createRxNostr(). In most cases, @rx-nostr/crypto packages will help you."
      );
    };
    makeRxNostrConfig = (config2) => fill(config2, {
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
    UrlMap = class _UrlMap extends Map {
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
    Nip11Registry = class {
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
    hasHexBuiltin = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from2, to) => from2 + (to - gcd(from2, to));
    powers = /* @__PURE__ */ (() => {
      let res = [];
      for (let i = 0; i < 40; i++)
        res.push(2 ** i);
      return res;
    })();
    BECH_ALPHABET = /* @__PURE__ */ chain(/* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join(""));
    POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
    bech32 = /* @__PURE__ */ genBech32("bech32");
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2)
          if (Object.prototype.hasOwnProperty.call(b2, p))
            d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    UnsubscriptionError = createErrorClass(function(_super) {
      return function UnsubscriptionErrorImpl(errors) {
        _super(this);
        this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i) {
          return i + 1 + ") " + err.toString();
        }).join("\n  ") : "";
        this.name = "UnsubscriptionError";
        this.errors = errors;
      };
    });
    Subscription = (function() {
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
    EMPTY_SUBSCRIPTION = Subscription.EMPTY;
    config = {
      onUnhandledError: null,
      onStoppedNotification: null,
      Promise: void 0,
      useDeprecatedSynchronousErrorHandling: false,
      useDeprecatedNextContext: false
    };
    timeoutProvider = {
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
    Subscriber = (function(_super) {
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
    _bind = Function.prototype.bind;
    ConsumerObserver = (function() {
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
    SafeSubscriber = (function(_super) {
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
    EMPTY_OBSERVER = {
      closed: true,
      next: noop,
      error: defaultErrorHandler,
      complete: noop
    };
    observable = (function() {
      return typeof Symbol === "function" && Symbol.observable || "@@observable";
    })();
    Observable = (function() {
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
    OperatorSubscriber = (function(_super) {
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
    ObjectUnsubscribedError = createErrorClass(function(_super) {
      return function ObjectUnsubscribedErrorImpl() {
        _super(this);
        this.name = "ObjectUnsubscribedError";
        this.message = "object unsubscribed";
      };
    });
    Subject = (function(_super) {
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
    AnonymousSubject = (function(_super) {
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
    BehaviorSubject = (function(_super) {
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
    dateTimestampProvider = {
      now: function() {
        return (dateTimestampProvider.delegate || Date).now();
      },
      delegate: void 0
    };
    Action = (function(_super) {
      __extends(Action2, _super);
      function Action2(scheduler, work) {
        return _super.call(this) || this;
      }
      Action2.prototype.schedule = function(state, delay22) {
        return this;
      };
      return Action2;
    })(Subscription);
    intervalProvider = {
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
    AsyncAction = (function(_super) {
      __extends(AsyncAction2, _super);
      function AsyncAction2(scheduler, work) {
        var _this = _super.call(this, scheduler, work) || this;
        _this.scheduler = scheduler;
        _this.work = work;
        _this.pending = false;
        return _this;
      }
      AsyncAction2.prototype.schedule = function(state, delay22) {
        var _a;
        if (delay22 === void 0) {
          delay22 = 0;
        }
        if (this.closed) {
          return this;
        }
        this.state = state;
        var id = this.id;
        var scheduler = this.scheduler;
        if (id != null) {
          this.id = this.recycleAsyncId(scheduler, id, delay22);
        }
        this.pending = true;
        this.delay = delay22;
        this.id = (_a = this.id) !== null && _a !== void 0 ? _a : this.requestAsyncId(scheduler, this.id, delay22);
        return this;
      };
      AsyncAction2.prototype.requestAsyncId = function(scheduler, _id, delay22) {
        if (delay22 === void 0) {
          delay22 = 0;
        }
        return intervalProvider.setInterval(scheduler.flush.bind(scheduler, this), delay22);
      };
      AsyncAction2.prototype.recycleAsyncId = function(_scheduler, id, delay22) {
        if (delay22 === void 0) {
          delay22 = 0;
        }
        if (delay22 != null && this.delay === delay22 && this.pending === false) {
          return id;
        }
        if (id != null) {
          intervalProvider.clearInterval(id);
        }
        return void 0;
      };
      AsyncAction2.prototype.execute = function(state, delay22) {
        if (this.closed) {
          return new Error("executing a cancelled action");
        }
        this.pending = false;
        var error = this._execute(state, delay22);
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
    Scheduler = (function() {
      function Scheduler2(schedulerActionCtor, now2) {
        if (now2 === void 0) {
          now2 = Scheduler2.now;
        }
        this.schedulerActionCtor = schedulerActionCtor;
        this.now = now2;
      }
      Scheduler2.prototype.schedule = function(work, delay22, state) {
        if (delay22 === void 0) {
          delay22 = 0;
        }
        return new this.schedulerActionCtor(this, work).schedule(state, delay22);
      };
      Scheduler2.now = dateTimestampProvider.now;
      return Scheduler2;
    })();
    AsyncScheduler = (function(_super) {
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
    asyncScheduler = new AsyncScheduler(AsyncAction);
    async = asyncScheduler;
    EMPTY = new Observable(function(subscriber) {
      return subscriber.complete();
    });
    isArrayLike = function(x) {
      return x && typeof x.length === "number" && typeof x !== "function";
    };
    iterator = getSymbolIterator();
    EmptyError = createErrorClass(function(_super) {
      return function EmptyErrorImpl() {
        _super(this);
        this.name = "EmptyError";
        this.message = "no elements in sequence";
      };
    });
    TimeoutError = createErrorClass(function(_super) {
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
    isArray$1 = Array.isArray;
    isArray = Array.isArray;
    getPrototypeOf = Object.getPrototypeOf;
    objectProto = Object.prototype;
    getKeys = Object.keys;
    AuthProxy = class {
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
        const listenAUTH = this.relay.getAUTHObservable().subscribe(({ challenge: challenge2 }) => {
          this.challenge(challenge2);
        });
      }
      getAuthResultObservable() {
        return this.authResult$.asObservable();
      }
      async challenge(challenge2) {
        try {
          const event = await this.signer.signEvent({
            kind: 22242,
            content: "",
            tags: [
              ["relay", this.relay.url],
              ["challenge", challenge2]
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
    CounterSubject = class extends BehaviorSubject {
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
    NotifySubject = class extends Subject {
      waitNext() {
        return firstValueFrom(this.pipe(first(null, void 0)));
      }
    };
    PublishProxy = class {
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
    ReadyState = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    };
    RelayConnection = class {
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
    WebSocketCloseCode = {
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
    SubscribeProxy = class {
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
    SubQueue = class {
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
    NostrConnection = class {
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
    RxNostrImpl = class {
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
        for (const { url, read: read2 } of this.defaultRelays.values()) {
          const conn = this.connections.get(url);
          if (read2 && conn) {
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
        const filter2 = ({ read: read2, write }) => {
          if (!(options == null ? void 0 : options.filter)) {
            return true;
          }
          switch (options.filter) {
            case "all":
              return true;
            case "read-all":
              return read2;
            case "write-all":
              return write;
            case "read-only":
              return read2 && !write;
            case "write-only":
              return !read2 && write;
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
        for (const { read: read2, url } of nextDefaultRelays.values()) {
          const conn = this.ensureNostrConnection(url);
          conn.setConnectionStrategy(this.config.connectionStrategy);
          if (read2) {
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
    createRxReq = (params) => {
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
  }
});

// dist/rx-nostr-crypto.js
var rx_nostr_crypto_exports = {};
__export(rx_nostr_crypto_exports, {
  createNoopClient: () => createNoopClient,
  createVerificationServiceClient: () => createVerificationServiceClient,
  getEventHash: () => getEventHash,
  getPublicKey: () => getPublicKey,
  getSignature: () => getSignature,
  schnorr: () => schnorr,
  seckeySigner: () => seckeySigner,
  startVerificationServiceHost: () => startVerificationServiceHost,
  toHex: () => toHex2,
  verifier: () => verifier,
  verify: () => verify2
});
function isBytes$12(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function anumber$2(n, title = "") {
  if (typeof n !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(`${prefix}expected number, got ${typeof n}`);
  }
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes$1(value, length, title = "") {
  const bytes = isBytes$12(value);
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
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes$1(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new RangeError('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function bytesToHex$1(bytes) {
  abytes$1(bytes);
  if (hasHexBuiltin2)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes2[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes$1(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  if (hasHexBuiltin2) {
    try {
      return Uint8Array.fromHex(hex);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function concatBytes$1(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes$1(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber$2(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof (cr == null ? void 0 : cr.getRandomValues) !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
function abool(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber$1(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function numberToHexUnpadded(num2) {
  const hex = abignumber(num2).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  return hex === "" ? _0n$4 : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex$1(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex$1(copyBytes(abytes$1(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber$2(len);
  if (len === 0)
    throw new RangeError("zero length");
  n = abignumber(n);
  const hex = n.toString(16);
  if (hex.length > len * 2)
    throw new RangeError("number too large");
  return hexToBytes$1(hex.padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function copyBytes(bytes) {
  return Uint8Array.from(abytes2(bytes));
}
function asciiToBytes(ascii) {
  if (typeof ascii !== "string")
    throw new TypeError("ascii string expected, got " + typeof ascii);
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n$4)
    throw new Error("expected non-negative bigint, got " + n);
  let len;
  for (len = 0; n > _0n$4; n >>= _1n$3, len += 1)
    ;
  return len;
}
function validateObject(object, fields = {}, optFields = {}) {
  if (Object.prototype.toString.call(object) !== "[object Object]")
    throw new TypeError("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    if (!isOpt && expectedType !== "function" && !Object.hasOwn(object, fieldName))
      throw new TypeError(`param "${fieldName}" is invalid: expected own property`);
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
function mod(a, b) {
  if (b <= _0n$3)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n$3 ? result : b + result;
}
function pow2(x, power, modulo) {
  if (power < _0n$3)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n$3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n$3)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n$3)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n$3, u = _1n$2;
  while (a !== _0n$3) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd22 = b;
  if (gcd22 !== _1n$2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  const F = Fp;
  if (!F.eql(F.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp, n) {
  const F = Fp;
  const p1div4 = (F.ORDER + _1n$2) / _4n$1;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const F = Fp;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n$2);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n$2), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    const F = Fp;
    let tv1 = F.pow(n, c4);
    let tv2 = F.mul(tv1, c1);
    const tv3 = F.mul(tv1, c2);
    const tv4 = F.mul(tv1, c3);
    const e1 = F.eql(F.sqr(tv2), n);
    const e2 = F.eql(F.sqr(tv3), n);
    tv1 = F.cmov(tv1, tv2, e1);
    tv2 = F.cmov(tv4, tv3, e2);
    const e3 = F.eql(F.sqr(tv2), n);
    const root = F.cmov(tv1, tv2, e3);
    assertIsSquare(F, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n$1)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n$2;
  let S = 0;
  while (Q % _2n$2 === _0n$3) {
    Q /= _2n$2;
    S++;
  }
  let Z = _2n$2;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n$2) / _2n$2;
  return function tonelliSlow(Fp, n) {
    const F = Fp;
    if (F.is0(n))
      return n;
    if (FpLegendre(F, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F.mul(F.ONE, cc);
    let t = F.pow(n, Q);
    let R = F.pow(n, Q1div2);
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t))
        return F.ZERO;
      let i = 1;
      let t_tmp = F.sqr(t);
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n$2 << BigInt(M - i - 1);
      const b = F.pow(c, exponent);
      M = i;
      c = F.sqr(b);
      t = F.mul(t, c);
      R = F.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n$1 === _3n$1)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map2, val) => {
    map2[val] = "function";
    return map2;
  }, initial);
  validateObject(field, opts);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n$2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpPow(Fp, num2, power) {
  const F = Fp;
  if (power < _0n$3)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n$3)
    return F.ONE;
  if (power === _1n$2)
    return num2;
  let p = F.ONE;
  let d = num2;
  while (power > _0n$3) {
    if (power & _1n$2)
      p = F.mul(p, d);
    d = F.sqr(d);
    power >>= _1n$2;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const F = Fp;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (F.is0(num2))
      return acc;
    inverted[i] = acc;
    return F.mul(acc, num2);
  }, F.ONE);
  const invertedAcc = F.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (F.is0(num2))
      return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const F = Fp;
  const p1mod2 = (F.ORDER - _1n$2) / _2n$2;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber$1(nBitLength);
  if (n <= _0n$3)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== void 0 && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== void 0 && nBitLength < bits)
    throw new Error(`invalid n length: expected bit length (${bits}) >= n.length (${nBitLength})`);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, opts = {}) {
  return new _Field(ORDER, opts);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n$2)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n$2);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
  abytes2(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n$2) + _1n$2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window2, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n$1;
  }
  const offsetStart = window2 * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window2 % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n$2)
    throw new Error("invalid wNAF");
}
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n$2 || k2 > _0n$2) {
    if (k1 & _1n$1)
      p1 = p1.add(acc);
    if (k2 & _1n$1)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n$1;
    k2 >>= _1n$1;
  }
  return { p1, p2 };
}
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n$2))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = "b";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen(randomSecretKey, getPublicKey2) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey2(secretKey) };
  };
}
function _splitEndoScalar(k, basis, n) {
  aInRange("scalar", k, _0n$1, n);
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n$1;
  const k2neg = k2 < _0n$1;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n;
  if (k1 < _0n$1 || k1 >= MAX_NUM || k2 < _0n$1 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp = validated.Fp;
  const Fn = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object"
  });
  const { endo, allowInfinityPoint } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes2(_c, point, isCompressed) {
    if (allowInfinityPoint && point.is0())
      return Uint8Array.of(0);
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes === void 0 ? pointToBytes2 : extraOpts.toBytes;
  const decodePoint = extraOpts.fromBytes === void 0 ? pointFromBytes : extraOpts.fromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n), _4n);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  const _Point = class _Point2 {
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      __publicField2(this, "X");
      __publicField2(this, "Y");
      __publicField2(this, "Z");
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof _Point2)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return _Point2.ZERO;
      return new _Point2(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = _Point2.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return _Point2.fromBytes(hexToBytes(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy - true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      const p = this;
      if (p.is0()) {
        if (extraOpts.allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x, y } = p.toAffine();
      if (!Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new _Point2(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new _Point2(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new _Point2(X3, Y3, Z3);
    }
    subtract(other) {
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(_Point2.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar - by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new RangeError("invalid scalar: out of range");
      let point, fake;
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(_Point2, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(_Point2, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(scalar) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      const sc = scalar;
      if (!Fn.isValid(sc))
        throw new RangeError("invalid scalar: out of range");
      if (sc === _0n$1 || p.is0())
        return _Point2.ZERO;
      if (sc === _1n)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(_Point2, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      const { X, Y, Z } = p;
      if (Fp.eql(Z, Fp.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp.ONE : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n)
        return true;
      if (isTorsionFree)
        return isTorsionFree(_Point2, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n)
        return this;
      if (clearCofactor)
        return clearCofactor(_Point2, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n)
        return this.is0();
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(_Point2, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex2(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  };
  __publicField2(_Point, "BASE", new _Point(CURVE.Gx, CURVE.Gy, Fp.ONE));
  __publicField2(_Point, "ZERO", new _Point(Fp.ZERO, Fp.ONE, Fp.ZERO));
  __publicField2(_Point, "Fp", Fp);
  __publicField2(_Point, "Fn", Fn);
  let Point = _Point;
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  if (bits >= 8)
    Point.BASE.precompute(8);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    // Raw compact `(r || s)` signature width; DER and recovered signatures use
    // different lengths outside this helper.
    signature: 2 * Fn.BYTES
  };
}
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n2 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n2, P) * b3 % P;
  const b9 = pow2(b6, _3n2, P) * b3 % P;
  const b11 = pow2(b9, _2n, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n2, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256$1(asciiToBytes(tag));
    tagP = concatBytes(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256$1(concatBytes(tagP, ...messages));
}
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = Fn.fromBytes(priv);
  const p = BASE.multiply(d_);
  const scalar = hasEven(p.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x \u2265 p");
  const xx = Fp.create(x * x);
  const c = Fp.create(xx * x + BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn, BASE } = Pointk1;
  const m = abytes2(message, void 0, "message");
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = abytes2(auxRand, 32, "auxRand");
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = Fn.create(num(rand));
  if (k_ === 0n)
    throw new Error("sign failed: k is zero");
  const p = BASE.multiply(k_);
  const k = hasEven(p.y) ? k_ : Fn.neg(k_);
  const rx = pointToBytes(p);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const { Fp, Fn, BASE } = Pointk1;
  const sig = abytes2(signature, 64, "signature");
  const m = abytes2(message, void 0, "message");
  const pub = abytes2(publicKey, 32, "publicKey");
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!Fp.isValidNot0(r))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!Fn.isValidNot0(s))
      return false;
    const e = challenge(Fn.toBytes(r), pointToBytes(P), m);
    const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn.neg(e)));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function isArrayOf2(isString, arr) {
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
function afn2(input) {
  if (typeof input !== "function")
    throw new Error("function expected");
  return true;
}
function astr2(label, input) {
  if (typeof input !== "string")
    throw new Error(`${label}: string expected`);
  return true;
}
function anumber2(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`invalid integer: ${n}`);
}
function aArr2(input) {
  if (!Array.isArray(input))
    throw new Error("array expected");
}
function astrArr2(label, input) {
  if (!isArrayOf2(true, input))
    throw new Error(`${label}: array of strings expected`);
}
function anumArr2(label, input) {
  if (!isArrayOf2(false, input))
    throw new Error(`${label}: array of numbers expected`);
}
// @__NO_SIDE_EFFECTS__
function chain2(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode = args.map((x) => x.decode).reduce(wrap, id);
  return { encode, decode };
}
// @__NO_SIDE_EFFECTS__
function alphabet2(letters) {
  const lettersA = typeof letters === "string" ? letters.split("") : letters;
  const len = lettersA.length;
  astrArr2("alphabet", lettersA);
  const indexes = new Map(lettersA.map((l, i) => [l, i]));
  return {
    encode: (digits) => {
      aArr2(digits);
      return digits.map((i) => {
        if (!Number.isSafeInteger(i) || i < 0 || i >= len)
          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
        return lettersA[i];
      });
    },
    decode: (input) => {
      aArr2(input);
      return input.map((letter) => {
        astr2("alphabet.decode", letter);
        const i = indexes.get(letter);
        if (i === void 0)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
        return i;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join2(separator = "") {
  astr2("join", separator);
  return {
    encode: (from2) => {
      astrArr2("join.decode", from2);
      return from2.join(separator);
    },
    decode: (to) => {
      astr2("join.decode", to);
      return to.split(separator);
    }
  };
}
function convertRadix22(data, from2, to, padding) {
  aArr2(data);
  if (from2 <= 0 || from2 > 32)
    throw new Error(`convertRadix2: wrong from=${from2}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry2(from2, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from2} to=${to} carryBits=${/* @__PURE__ */ radix2carry2(from2, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const max = powers2[from2];
  const mask = powers2[to] - 1;
  const res = [];
  for (const n of data) {
    anumber2(n);
    if (n >= max)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from2}`);
    carry = carry << from2 | n;
    if (pos + from2 > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from2}`);
    pos += from2;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    const pow = powers2[pos];
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
function radix22(bits, revPadding = false) {
  anumber2(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry2(8, bits) > 32 || /* @__PURE__ */ radix2carry2(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes2(bytes))
        throw new Error("radix2.encode input should be Uint8Array");
      return convertRadix22(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      anumArr2("radix2.decode", digits);
      return Uint8Array.from(convertRadix22(digits, bits, 8, revPadding));
    }
  };
}
function unsafeWrapper2(fn) {
  afn2(fn);
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
function bech32Polymod3(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0; i < POLYMOD_GENERATORS2.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS2[i];
  }
  return chk;
}
function bechChecksum2(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i = 0; i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod3(chk) ^ c >> 5;
  }
  chk = bech32Polymod3(chk);
  for (let i = 0; i < len; i++)
    chk = bech32Polymod3(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod3(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = bech32Polymod3(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET2.encode(convertRadix22([chk % powers2[30]], 30, 5, false));
}
// @__NO_SIDE_EFFECTS__
function genBech322(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = /* @__PURE__ */ radix22(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper2(fromWords);
  function encode(prefix, words, limit = 90) {
    astr2("bech32.encode prefix", prefix);
    if (isBytes2(words))
      words = Array.from(words);
    anumArr2("bech32.encode", words);
    const plen = prefix.length;
    if (plen === 0)
      throw new TypeError(`Invalid prefix length ${plen}`);
    const actualLength = plen + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    const lowered = prefix.toLowerCase();
    const sum = bechChecksum2(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET2.encode(words)}${sum}`;
  }
  function decode(str, limit = 90) {
    astr2("bech32.decode input", str);
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
    const words = BECH_ALPHABET2.decode(data).slice(0, -6);
    const sum = bechChecksum2(prefix, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix, words };
  }
  const decodeUnsafe = unsafeWrapper2(decode);
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
function sha256(m) {
  return bytesToHex$1(sha256$1(utf8Encoder.encode(m)));
}
function getPublicKey(seckey) {
  return schnorr.getPublicKey(seckey);
}
function getEventHash(event) {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
  return sha256(serialized);
}
function getSignature(eventHash, seckey) {
  return schnorr.sign(eventHash, seckey);
}
function verify2(event) {
  try {
    return schnorr.verify(event.sig, getEventHash(event), event.pubkey);
  } catch (err) {
    console.warn("The following error occurred during verify():", err);
    return false;
  }
}
function toHex2(str) {
  const { words } = bech322.decode(str);
  const data = new Uint8Array(bech322.fromWords(words));
  return bytesToHex$1(data);
}
function seckeySigner(seckey, options) {
  const sechex = seckey.startsWith("nsec1") ? toHex2(seckey) : seckey;
  const pubhex = getPublicKey(sechex);
  return {
    async signEvent(params) {
      const event = {
        ...params,
        pubkey: params.pubkey ?? pubhex,
        tags: [...params.tags ?? [], ...(options == null ? void 0 : options.tags) ?? []],
        created_at: params.created_at ?? Math.floor(Date.now() / 1e3)
      };
      if (ensureEventFields2(event)) {
        return event;
      }
      const id = event.id ?? getEventHash(event);
      const sig = event.sig ?? getSignature(id, sechex);
      return {
        ...event,
        id,
        sig
      };
    },
    async getPublicKey() {
      return pubhex;
    }
  };
}
function ensureEventFields2(event) {
  if (typeof event.id !== "string") return false;
  if (typeof event.sig !== "string") return false;
  if (typeof event.kind !== "number") return false;
  if (typeof event.pubkey !== "string") return false;
  if (typeof event.content !== "string") return false;
  if (typeof event.created_at !== "number") return false;
  if (!Array.isArray(event.tags)) return false;
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object") return false;
    }
  }
  return true;
}
var __defProp3, __defNormalProp2, __publicField2, hasHexBuiltin2, hexes2, asciis, oidNist, HashMD, SHA256_IV, SHA256_K, SHA256_W, SHA2_32B, _SHA256, sha256$1, abytes2, anumber$1, bytesToHex2, concatBytes, hexToBytes, _0n$4, _1n$3, isPosBig, bitMask, _0n$3, _1n$2, _2n$2, _3n$1, _4n$1, _5n, _7n, _8n, _9n, _16n, FIELD_FIELDS, FIELD_SQRT, _Field, _0n$2, _1n$1, pointPrecomputes, pointWindowSizes, wNAF, divNearest, DERErr, DER, _0n$1, _1n, _2n$1, _3n, _4n, secp256k1_CURVE, secp256k1_ENDO, _0n, _2n, Fpk1, Pointk1, TAGGED_HASH_PREFIXES, pointToBytes, hasEven, num, schnorr$1, gcd2, radix2carry2, powers2, BECH_ALPHABET2, POLYMOD_GENERATORS2, bech322, utf8Encoder, schnorr, verifier, Batch, startVerificationServiceHost, createNoopClient, createVerificationServiceClient;
var init_rx_nostr_crypto = __esm({
  "dist/rx-nostr-crypto.js"() {
    "use strict";
    __defProp3 = Object.defineProperty;
    __defNormalProp2 = (obj, key, value) => key in obj ? __defProp3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
    hasHexBuiltin2 = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
    oidNist = (suffix) => ({
      // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
      // Larger suffix values would need base-128 OID encoding and a different length byte.
      oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
    });
    HashMD = class {
      constructor(blockLen, outputLen, padOffset, isLE) {
        __publicField2(this, "blockLen");
        __publicField2(this, "outputLen");
        __publicField2(this, "canXOF", false);
        __publicField2(this, "padOffset");
        __publicField2(this, "isLE");
        __publicField2(this, "buffer");
        __publicField2(this, "view");
        __publicField2(this, "finished", false);
        __publicField2(this, "length", 0);
        __publicField2(this, "pos", 0);
        __publicField2(this, "destroyed", false);
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
      }
      update(data) {
        aexists(this);
        abytes$1(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take2 = Math.min(blockLen - this.pos, len - pos);
          if (take2 === blockLen) {
            const dataView = createView(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take2), this.pos);
          this.pos += take2;
          pos += take2;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        clean(this.buffer.subarray(pos));
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen must be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    SHA256_K = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    SHA2_32B = class extends HashMD {
      constructor(outputLen) {
        super(64, outputLen, 8, false);
      }
      get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
          const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
          const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F;
          F = E;
          E = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E, F, G, H);
      }
      roundClean() {
        clean(SHA256_W);
      }
      destroy() {
        this.destroyed = true;
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
      }
    };
    _SHA256 = class extends SHA2_32B {
      constructor() {
        super(32);
        __publicField2(this, "A", SHA256_IV[0] | 0);
        __publicField2(this, "B", SHA256_IV[1] | 0);
        __publicField2(this, "C", SHA256_IV[2] | 0);
        __publicField2(this, "D", SHA256_IV[3] | 0);
        __publicField2(this, "E", SHA256_IV[4] | 0);
        __publicField2(this, "F", SHA256_IV[5] | 0);
        __publicField2(this, "G", SHA256_IV[6] | 0);
        __publicField2(this, "H", SHA256_IV[7] | 0);
      }
    };
    sha256$1 = /* @__PURE__ */ createHasher(
      () => new _SHA256(),
      /* @__PURE__ */ oidNist(1)
    );
    abytes2 = (value, length, title) => abytes$1(value, length, title);
    anumber$1 = anumber$2;
    bytesToHex2 = bytesToHex$1;
    concatBytes = (...arrays) => concatBytes$1(...arrays);
    hexToBytes = (hex) => hexToBytes$1(hex);
    _0n$4 = /* @__PURE__ */ BigInt(0);
    _1n$3 = /* @__PURE__ */ BigInt(1);
    isPosBig = (n) => typeof n === "bigint" && _0n$4 <= n;
    bitMask = (n) => (_1n$3 << BigInt(n)) - _1n$3;
    _0n$3 = /* @__PURE__ */ BigInt(0);
    _1n$2 = /* @__PURE__ */ BigInt(1);
    _2n$2 = /* @__PURE__ */ BigInt(2);
    _3n$1 = /* @__PURE__ */ BigInt(3);
    _4n$1 = /* @__PURE__ */ BigInt(4);
    _5n = /* @__PURE__ */ BigInt(5);
    _7n = /* @__PURE__ */ BigInt(7);
    _8n = /* @__PURE__ */ BigInt(8);
    _9n = /* @__PURE__ */ BigInt(9);
    _16n = /* @__PURE__ */ BigInt(16);
    FIELD_FIELDS = [
      "create",
      "isValid",
      "is0",
      "neg",
      "inv",
      "sqrt",
      "sqr",
      "eql",
      "add",
      "sub",
      "mul",
      "pow",
      "div",
      "addN",
      "subN",
      "mulN",
      "sqrN"
    ];
    FIELD_SQRT = /* @__PURE__ */ new WeakMap();
    _Field = class {
      constructor(ORDER, opts = {}) {
        __publicField2(this, "ORDER");
        __publicField2(this, "BITS");
        __publicField2(this, "BYTES");
        __publicField2(this, "isLE");
        __publicField2(this, "ZERO", _0n$3);
        __publicField2(this, "ONE", _1n$2);
        __publicField2(this, "_lengths");
        __publicField2(this, "_mod");
        if (ORDER <= _1n$2)
          throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
        let _nbitLength = void 0;
        this.isLE = false;
        if (opts != null && typeof opts === "object") {
          if (typeof opts.BITS === "number")
            _nbitLength = opts.BITS;
          if (typeof opts.sqrt === "function")
            Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
          if (typeof opts.isLE === "boolean")
            this.isLE = opts.isLE;
          if (opts.allowedLengths)
            this._lengths = Object.freeze(opts.allowedLengths.slice());
          if (typeof opts.modFromBytes === "boolean")
            this._mod = opts.modFromBytes;
        }
        const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
        if (nByteLength > 2048)
          throw new Error("invalid field: expected ORDER of <= 2048 bytes");
        this.ORDER = ORDER;
        this.BITS = nBitLength;
        this.BYTES = nByteLength;
        Object.freeze(this);
      }
      create(num2) {
        return mod(num2, this.ORDER);
      }
      isValid(num2) {
        if (typeof num2 !== "bigint")
          throw new TypeError("invalid field element: expected bigint, got " + typeof num2);
        return _0n$3 <= num2 && num2 < this.ORDER;
      }
      is0(num2) {
        return num2 === _0n$3;
      }
      // is valid and invertible
      isValidNot0(num2) {
        return !this.is0(num2) && this.isValid(num2);
      }
      isOdd(num2) {
        return (num2 & _1n$2) === _1n$2;
      }
      neg(num2) {
        return mod(-num2, this.ORDER);
      }
      eql(lhs, rhs) {
        return lhs === rhs;
      }
      sqr(num2) {
        return mod(num2 * num2, this.ORDER);
      }
      add(lhs, rhs) {
        return mod(lhs + rhs, this.ORDER);
      }
      sub(lhs, rhs) {
        return mod(lhs - rhs, this.ORDER);
      }
      mul(lhs, rhs) {
        return mod(lhs * rhs, this.ORDER);
      }
      pow(num2, power) {
        return FpPow(this, num2, power);
      }
      div(lhs, rhs) {
        return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
      }
      // Same as above, but doesn't normalize
      sqrN(num2) {
        return num2 * num2;
      }
      addN(lhs, rhs) {
        return lhs + rhs;
      }
      subN(lhs, rhs) {
        return lhs - rhs;
      }
      mulN(lhs, rhs) {
        return lhs * rhs;
      }
      inv(num2) {
        return invert(num2, this.ORDER);
      }
      sqrt(num2) {
        let sqrt = FIELD_SQRT.get(this);
        if (!sqrt)
          FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
        return sqrt(this, num2);
      }
      toBytes(num2) {
        return this.isLE ? numberToBytesLE(num2, this.BYTES) : numberToBytesBE(num2, this.BYTES);
      }
      fromBytes(bytes, skipValidation = false) {
        abytes2(bytes);
        const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
        if (allowedLengths) {
          if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
            throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
          }
          const padded = new Uint8Array(BYTES);
          padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
          bytes = padded;
        }
        if (bytes.length !== BYTES)
          throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
        let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
        if (modFromBytes)
          scalar = mod(scalar, ORDER);
        if (!skipValidation) {
          if (!this.isValid(scalar))
            throw new Error("invalid field element: outside of range 0..ORDER");
        }
        return scalar;
      }
      // TODO: we don't need it here, move out to separate fn
      invertBatch(lst) {
        return FpInvertBatch(this, lst);
      }
      // We can't move this out because Fp6, Fp12 implement it
      // and it's unclear what to return in there.
      cmov(a, b, condition) {
        abool(condition, "condition");
        return condition ? b : a;
      }
    };
    Object.freeze(_Field.prototype);
    _0n$2 = /* @__PURE__ */ BigInt(0);
    _1n$1 = /* @__PURE__ */ BigInt(1);
    pointPrecomputes = /* @__PURE__ */ new WeakMap();
    pointWindowSizes = /* @__PURE__ */ new WeakMap();
    wNAF = class {
      // Parametrized with a given Point class (not individual point)
      constructor(Point, bits) {
        __publicField2(this, "BASE");
        __publicField2(this, "ZERO");
        __publicField2(this, "Fn");
        __publicField2(this, "bits");
        this.BASE = Point.BASE;
        this.ZERO = Point.ZERO;
        this.Fn = Point.Fn;
        this.bits = bits;
      }
      // non-const time multiplication ladder
      _unsafeLadder(elm, n, p = this.ZERO) {
        let d = elm;
        while (n > _0n$2) {
          if (n & _1n$1)
            p = p.add(d);
          d = d.double();
          n >>= _1n$1;
        }
        return p;
      }
      /**
       * Creates a wNAF precomputation window. Used for caching.
       * Default window size is set by `utils.precompute()` and is equal to 8.
       * Number of precomputed points depends on the curve size:
       * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
       * - 𝑊 is the window size
       * - 𝑛 is the bitlength of the curve order.
       * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
       * @param point - Point instance
       * @param W - window size
       * @returns precomputed point tables flattened to a single array
       */
      precomputeWindow(point, W) {
        const { windows, windowSize } = calcWOpts(W, this.bits);
        const points = [];
        let p = point;
        let base = p;
        for (let window2 = 0; window2 < windows; window2++) {
          base = p;
          points.push(base);
          for (let i = 1; i < windowSize; i++) {
            base = base.add(p);
            points.push(base);
          }
          p = base.double();
        }
        return points;
      }
      /**
       * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
       * More compact implementation:
       * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
       * @returns real and fake (for const-time) points
       */
      wNAF(W, precomputes, n) {
        if (!this.Fn.isValid(n))
          throw new Error("invalid scalar");
        let p = this.ZERO;
        let f = this.BASE;
        const wo = calcWOpts(W, this.bits);
        for (let window2 = 0; window2 < wo.windows; window2++) {
          const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
          n = nextN;
          if (isZero) {
            f = f.add(negateCt(isNegF, precomputes[offsetF]));
          } else {
            p = p.add(negateCt(isNeg, precomputes[offset]));
          }
        }
        assert0(n);
        return { p, f };
      }
      /**
       * Implements unsafe EC multiplication using precomputed tables
       * and w-ary non-adjacent form.
       * @param acc - accumulator point to add result of multiplication
       * @returns point
       */
      wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
        const wo = calcWOpts(W, this.bits);
        for (let window2 = 0; window2 < wo.windows; window2++) {
          if (n === _0n$2)
            break;
          const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
          n = nextN;
          if (isZero) {
            continue;
          } else {
            const item = precomputes[offset];
            acc = acc.add(isNeg ? item.negate() : item);
          }
        }
        assert0(n);
        return acc;
      }
      getPrecomputes(W, point, transform) {
        let comp = pointPrecomputes.get(point);
        if (!comp) {
          comp = this.precomputeWindow(point, W);
          if (W !== 1) {
            if (typeof transform === "function")
              comp = transform(comp);
            pointPrecomputes.set(point, comp);
          }
        }
        return comp;
      }
      cached(point, scalar, transform) {
        const W = getW(point);
        return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
      }
      unsafe(point, scalar, transform, prev) {
        const W = getW(point);
        if (W === 1)
          return this._unsafeLadder(point, scalar, prev);
        return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
      }
      // We calculate precomputes for elliptic curve point multiplication
      // using windowed method. This specifies window size and
      // stores precomputed values. Usually only base point would be precomputed.
      createCache(P, W) {
        validateW(W, this.bits);
        pointWindowSizes.set(P, W);
        pointPrecomputes.delete(P);
      }
      hasCache(elm) {
        return getW(elm) !== 1;
      }
    };
    divNearest = (num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n$1) / den;
    DERErr = class extends Error {
      constructor(m = "") {
        super(m);
      }
    };
    DER = {
      // asn.1 DER encoding utils
      Err: DERErr,
      // Basic building block is TLV (Tag-Length-Value)
      _tlv: {
        encode: (tag, data) => {
          const { Err: E } = DER;
          asafenumber(tag, "tag");
          if (tag < 0 || tag > 255)
            throw new E("tlv.encode: wrong tag");
          if (typeof data !== "string")
            throw new TypeError('"data" expected string, got type=' + typeof data);
          if (data.length & 1)
            throw new E("tlv.encode: unpadded data");
          const dataLen = data.length / 2;
          const len = numberToHexUnpadded(dataLen);
          if (len.length / 2 & 128)
            throw new E("tlv.encode: long form length too big");
          const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
          const t = numberToHexUnpadded(tag);
          return t + lenLen + len + data;
        },
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
          const { Err: E } = DER;
          data = abytes2(data, void 0, "DER data");
          let pos = 0;
          if (tag < 0 || tag > 255)
            throw new E("tlv.encode: wrong tag");
          if (data.length < 2 || data[pos++] !== tag)
            throw new E("tlv.decode: wrong tlv");
          const first2 = data[pos++];
          const isLong = !!(first2 & 128);
          let length = 0;
          if (!isLong)
            length = first2;
          else {
            const lenLen = first2 & 127;
            if (!lenLen)
              throw new E("tlv.decode(long): indefinite length not supported");
            if (lenLen > 4)
              throw new E("tlv.decode(long): byte length is too big");
            const lengthBytes = data.subarray(pos, pos + lenLen);
            if (lengthBytes.length !== lenLen)
              throw new E("tlv.decode: length bytes not complete");
            if (lengthBytes[0] === 0)
              throw new E("tlv.decode(long): zero leftmost byte");
            for (const b of lengthBytes)
              length = length << 8 | b;
            pos += lenLen;
            if (length < 128)
              throw new E("tlv.decode(long): not minimal encoding");
          }
          const v = data.subarray(pos, pos + length);
          if (v.length !== length)
            throw new E("tlv.decode: wrong value length");
          return { v, l: data.subarray(pos + length) };
        }
      },
      // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
      // since we always use positive integers here. It must always be empty:
      // - add zero byte if exists
      // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
      _int: {
        encode(num2) {
          const { Err: E } = DER;
          abignumber(num2);
          if (num2 < _0n$1)
            throw new E("integer: negative integers are not allowed");
          let hex = numberToHexUnpadded(num2);
          if (Number.parseInt(hex[0], 16) & 8)
            hex = "00" + hex;
          if (hex.length & 1)
            throw new E("unexpected DER parsing assertion: unpadded hex");
          return hex;
        },
        decode(data) {
          const { Err: E } = DER;
          if (data.length < 1)
            throw new E("invalid signature integer: empty");
          if (data[0] & 128)
            throw new E("invalid signature integer: negative");
          if (data.length > 1 && data[0] === 0 && !(data[1] & 128))
            throw new E("invalid signature integer: unnecessary leading zero");
          return bytesToNumberBE(data);
        }
      },
      toSig(bytes) {
        const { Err: E, _int: int, _tlv: tlv } = DER;
        const data = abytes2(bytes, void 0, "signature");
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
        if (seqLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
        if (sLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
      },
      hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(2, int.encode(sig.r));
        const ss = tlv.encode(2, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(48, seq);
      }
    };
    Object.freeze(DER._tlv);
    Object.freeze(DER._int);
    Object.freeze(DER);
    _0n$1 = /* @__PURE__ */ BigInt(0);
    _1n = /* @__PURE__ */ BigInt(1);
    _2n$1 = /* @__PURE__ */ BigInt(2);
    _3n = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    secp256k1_CURVE = {
      p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
      n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
      h: BigInt(1),
      a: BigInt(0),
      b: BigInt(7),
      Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
      Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
    };
    secp256k1_ENDO = {
      beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
      basises: [
        [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
        [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
      ]
    };
    _0n = /* @__PURE__ */ BigInt(0);
    _2n = /* @__PURE__ */ BigInt(2);
    Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
    Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
      Fp: Fpk1,
      endo: secp256k1_ENDO
    });
    TAGGED_HASH_PREFIXES = {};
    pointToBytes = (point) => point.toBytes(true).slice(1);
    hasEven = (y) => y % _2n === _0n;
    num = bytesToNumberBE;
    schnorr$1 = /* @__PURE__ */ (() => {
      const size = 32;
      const seedLength = 48;
      const randomSecretKey = (seed) => {
        seed = seed === void 0 ? randomBytes(seedLength) : seed;
        return mapHashToField(seed, secp256k1_CURVE.n);
      };
      return Object.freeze({
        keygen: createKeygen(randomSecretKey, schnorrGetPublicKey),
        getPublicKey: schnorrGetPublicKey,
        sign: schnorrSign,
        verify: schnorrVerify,
        Point: Pointk1,
        utils: Object.freeze({
          randomSecretKey,
          taggedHash,
          lift_x,
          pointToBytes
        }),
        lengths: Object.freeze({
          secretKey: size,
          publicKey: size,
          publicKeyHasPrefix: false,
          signature: size * 2,
          seed: seedLength
        })
      });
    })();
    gcd2 = (a, b) => b === 0 ? a : gcd2(b, a % b);
    radix2carry2 = /* @__NO_SIDE_EFFECTS__ */ (from2, to) => from2 + (to - gcd2(from2, to));
    powers2 = /* @__PURE__ */ (() => {
      let res = [];
      for (let i = 0; i < 40; i++)
        res.push(2 ** i);
      return res;
    })();
    BECH_ALPHABET2 = /* @__PURE__ */ chain2(/* @__PURE__ */ alphabet2("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join2(""));
    POLYMOD_GENERATORS2 = [996825010, 642813549, 513874426, 1027748829, 705979059];
    bech322 = /* @__PURE__ */ genBech322("bech32");
    utf8Encoder = new TextEncoder();
    schnorr = {
      sign: (m, seckey) => bytesToHex$1(schnorr$1.sign(hexToBytes$1(m), hexToBytes$1(seckey))),
      verify: (sig, m, pubkey) => schnorr$1.verify(hexToBytes$1(sig), hexToBytes$1(m), hexToBytes$1(pubkey)),
      getPublicKey: (seckey) => bytesToHex$1(schnorr$1.getPublicKey(hexToBytes$1(seckey)))
    };
    verifier = async (event) => verify2(event);
    Batch = class {
      constructor(interval) {
        __publicField2(this, "timer");
        __publicField2(this, "fireNext", []);
        __publicField2(this, "takeNext", []);
        this.timer = setInterval(() => {
          for (const f of this.fireNext) {
            f();
          }
          this.fireNext = this.takeNext;
          this.takeNext = [];
        }, interval);
      }
      set(f) {
        this.takeNext.push(f);
      }
      stop() {
        clearInterval(this.timer);
      }
    };
    startVerificationServiceHost = (verifier$1 = verifier) => {
      if (typeof WorkerGlobalScope === "undefined" || !(self instanceof WorkerGlobalScope)) {
        throw new Error(
          "startVerificationServiceHost() must be called in a Worker context."
        );
      }
      self.addEventListener(
        "message",
        async (ev) => {
          if (ev.data === "ping") {
            self.postMessage("pong");
            return;
          }
          const { reqId, event } = ev.data;
          try {
            const ok = await verifier$1(event);
            self.postMessage({
              reqId,
              ok
            });
          } catch (err) {
            self.postMessage({
              reqId,
              ok: false,
              error: `${err}`
            });
          }
        }
      );
    };
    createNoopClient = () => {
      const noop2 = () => {
      };
      return {
        start: noop2,
        verifier: async () => false,
        get status() {
          return "prepared";
        },
        dispose: noop2,
        [Symbol.dispose]: noop2
      };
    };
    createVerificationServiceClient = ({
      worker,
      fallback,
      tags,
      timeout: timeout2
    }) => {
      let status = "prepared";
      let nextReqId = 1;
      const resolvers = /* @__PURE__ */ new Map();
      const batch2 = new Batch(timeout2 ?? 1e4);
      const fallbackVerifier = fallback ?? verifier;
      const workerVerifier = (event) => {
        const reqId = nextReqId++;
        const r = new Promise((resolve, reject) => {
          resolvers.set(reqId, resolve);
          batch2.set(() => {
            if (resolvers.get(reqId)) {
              reject(new Error("Verification request was timed out."));
              resolvers.delete(reqId);
            }
          });
        });
        worker == null ? void 0 : worker.postMessage({
          reqId,
          event
        });
        return r;
      };
      const onmessage = (ev) => {
        var _a;
        if (status === "terminated") {
          return;
        }
        if (ev.data === "pong") {
          status = "active";
          return;
        }
        const { reqId, ok } = ev.data;
        (_a = resolvers.get(reqId)) == null ? void 0 : _a(ok);
        resolvers.delete(reqId);
      };
      const onerror = () => {
        if (status === "terminated") {
          return;
        }
        status = "error";
      };
      const start = () => {
        if (status === "prepared") {
          status = "booting";
          worker.addEventListener("message", onmessage);
          worker.addEventListener("error", onerror);
          worker.addEventListener("messageerror", onerror);
          worker.postMessage("ping");
        }
      };
      const verifier$1 = (event) => {
        event = {
          ...event,
          tags: [...event.tags ?? [], ...tags ?? []]
        };
        switch (status) {
          case "prepared":
            throw new Error("VerificationServiceClient is not started yet.");
          case "booting":
          case "error":
            return fallbackVerifier(event);
          case "active":
            return workerVerifier(event);
          case "terminated":
            throw new Error("VerificationServiceClient is already disposed.");
        }
      };
      const dispose = () => {
        if (status === "terminated") {
          return;
        }
        status = "terminated";
        worker.removeEventListener("message", onmessage);
        worker.removeEventListener("error", onerror);
        worker.removeEventListener("messageerror", onerror);
        worker.terminate();
        batch2.stop();
      };
      return {
        start,
        verifier: verifier$1,
        get status() {
          return status;
        },
        dispose,
        [Symbol.dispose]: dispose
      };
    };
  }
});

// src/domain/json.ts
var textEncoder = new TextEncoder();
function utf8Encode(str) {
  return textEncoder.encode(String(str));
}
function utf8ByteLength(str) {
  return textEncoder.encode(String(str)).length;
}
function bytesEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
var SHA256_RE = /^[0-9a-f]{64}$/;
function isLowercaseSha256Hex(v) {
  return typeof v === "string" && SHA256_RE.test(v);
}
async function sha256Hex(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const view = new Uint8Array(digest);
  let out = "";
  for (const byte of view) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}
var NUMBER_TOKEN_RE = /^-?(?:0|[1-9][0-9]*)$/;
var StrictParseError = class extends Error {
  name = "StrictParseError";
};
var StrictParser = class {
  s;
  n;
  i = 0;
  constructor(text) {
    this.s = text;
    this.n = text.length;
  }
  /** How far the parser got. Trailing content is detected by comparing this to the length. */
  get position() {
    return this.i;
  }
  get length() {
    return this.n;
  }
  /** Character at an offset, or '' past the end. Returning '' rather than undefined
      keeps every comparison below a plain string comparison. */
  at(offset = 0) {
    return this.s[this.i + offset] ?? "";
  }
  error(msg) {
    return new StrictParseError(msg);
  }
  skipWs() {
    while (this.i < this.n) {
      const c = this.s.charCodeAt(this.i);
      if (c === 32 || c === 9 || c === 10 || c === 13) {
        this.i += 1;
      } else {
        break;
      }
    }
  }
  parseValue() {
    if (this.i >= this.n) throw this.error("unexpected-end");
    const c = this.at();
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === "-" || c >= "0" && c <= "9") return this.parseNumber();
    if (c === "t" || c === "f") return this.parseBool();
    if (c === "n") return this.parseNull();
    throw this.error("unexpected-token");
  }
  parseObject() {
    this.i += 1;
    const obj = {};
    const seen = /* @__PURE__ */ new Set();
    this.skipWs();
    if (this.at() === "}") {
      this.i += 1;
      return obj;
    }
    for (; ; ) {
      this.skipWs();
      if (this.at() !== '"') throw this.error("expected-key");
      const key = this.parseString();
      if (key === "__proto__") throw this.error("proto-key");
      if (seen.has(key)) throw this.error("duplicate-key");
      seen.add(key);
      this.skipWs();
      if (this.at() !== ":") throw this.error("expected-colon");
      this.i += 1;
      this.skipWs();
      const value = this.parseValue();
      obj[key] = value;
      this.skipWs();
      const ch = this.at();
      if (ch === ",") {
        this.i += 1;
        continue;
      }
      if (ch === "}") {
        this.i += 1;
        return obj;
      }
      throw this.error("expected-comma-or-brace");
    }
  }
  parseArray() {
    this.i += 1;
    const arr = [];
    this.skipWs();
    if (this.at() === "]") {
      this.i += 1;
      return arr;
    }
    for (; ; ) {
      this.skipWs();
      arr.push(this.parseValue());
      this.skipWs();
      const ch = this.at();
      if (ch === ",") {
        this.i += 1;
        continue;
      }
      if (ch === "]") {
        this.i += 1;
        return arr;
      }
      throw this.error("expected-comma-or-bracket");
    }
  }
  readHex4() {
    if (this.i + 4 > this.n) throw this.error("bad-escape");
    let code = 0;
    for (let k = 0; k < 4; k += 1) {
      const c = this.at();
      if (!isHexDigit(c)) throw this.error("bad-escape");
      code = code * 16 + parseInt(c, 16);
      this.i += 1;
    }
    return code;
  }
  parseString() {
    this.i += 1;
    let out = "";
    for (; ; ) {
      if (this.i >= this.n) throw this.error("unterminated-string");
      const ch = this.at();
      const code = this.s.charCodeAt(this.i);
      if (ch === '"') {
        this.i += 1;
        return out;
      }
      if (ch === "\\") {
        this.i += 1;
        if (this.i >= this.n) throw this.error("bad-escape");
        const esc4 = this.at();
        if (esc4 === '"') {
          out += '"';
          this.i += 1;
        } else if (esc4 === "\\") {
          out += "\\";
          this.i += 1;
        } else if (esc4 === "/") {
          out += "/";
          this.i += 1;
        } else if (esc4 === "b") {
          out += "\b";
          this.i += 1;
        } else if (esc4 === "f") {
          out += "\f";
          this.i += 1;
        } else if (esc4 === "n") {
          out += "\n";
          this.i += 1;
        } else if (esc4 === "r") {
          out += "\r";
          this.i += 1;
        } else if (esc4 === "t") {
          out += "	";
          this.i += 1;
        } else if (esc4 === "u") {
          this.i += 1;
          const cp = this.readHex4();
          if (cp >= 55296 && cp <= 56319) {
            if (this.at() !== "\\" || this.at(1) !== "u") {
              throw this.error("lone-surrogate");
            }
            this.i += 2;
            const low = this.readHex4();
            if (low < 56320 || low > 57343) throw this.error("lone-surrogate");
            out += String.fromCharCode(cp) + String.fromCharCode(low);
          } else if (cp >= 56320 && cp <= 57343) {
            throw this.error("lone-surrogate");
          } else {
            out += String.fromCharCode(cp);
          }
        } else {
          throw this.error("bad-escape");
        }
        continue;
      }
      if (code <= 31) throw this.error("unescaped-control");
      out += ch;
      this.i += 1;
    }
  }
  parseNumber() {
    const start = this.i;
    if (this.at() === "-") this.i += 1;
    while (this.i < this.n) {
      const c = this.at();
      if (c >= "0" && c <= "9" || c === "." || c === "e" || c === "E" || c === "+" || c === "-") {
        this.i += 1;
      } else {
        break;
      }
    }
    const token = this.s.slice(start, this.i);
    if (!NUMBER_TOKEN_RE.test(token)) throw this.error("bad-number");
    if (token === "-0") throw this.error("negative-zero");
    const value = Number(token);
    if (!Number.isSafeInteger(value)) throw this.error("unsafe-integer");
    return value;
  }
  parseBool() {
    if (this.s.startsWith("true", this.i)) {
      this.i += 4;
      return true;
    }
    if (this.s.startsWith("false", this.i)) {
      this.i += 5;
      return false;
    }
    throw this.error("bad-literal");
  }
  parseNull() {
    if (this.s.startsWith("null", this.i)) {
      this.i += 4;
      return null;
    }
    throw this.error("bad-literal");
  }
};
function isHexDigit(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
function strictParse(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    return { ok: false, error: "not-bytes" };
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { ok: false, error: "invalid-utf8" };
  }
  if (text.length > 0 && text.charCodeAt(0) === 65279) {
    return { ok: false, error: "bom" };
  }
  const parser = new StrictParser(text);
  let value;
  try {
    parser.skipWs();
    value = parser.parseValue();
    parser.skipWs();
  } catch (err) {
    return { ok: false, error: err instanceof StrictParseError ? err.message : "parse-error" };
  }
  if (parser.position !== parser.length) {
    return { ok: false, error: "trailing-content" };
  }
  return { ok: true, value };
}
function canonicalizeString(str) {
  let out = '"';
  for (let i = 0; i < str.length; i += 1) {
    const c = str[i] ?? "";
    const code = str.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === "\\") out += "\\\\";
    else if (code === 8) out += "\\b";
    else if (code === 9) out += "\\t";
    else if (code === 10) out += "\\n";
    else if (code === 12) out += "\\f";
    else if (code === 13) out += "\\r";
    else if (code <= 31) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += c;
  }
  return out + '"';
}
function canonicalizeValue(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || !Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error("canonicalize-unsupported-number");
    }
    return String(value);
  }
  if (typeof value === "string") return canonicalizeString(value);
  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i += 1) {
      if (i > 0) out += ",";
      out += canonicalizeValue(value[i]);
    }
    return out + "]";
  }
  if (t === "object") {
    const record = value;
    const keys = Object.keys(record).sort();
    let out = "{";
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === void 0) continue;
      if (i > 0) out += ",";
      out += canonicalizeString(key) + ":" + canonicalizeValue(record[key]);
    }
    return out + "}";
  }
  throw new Error("canonicalize-unsupported-value");
}
function canonicalize(value) {
  return utf8Encode(canonicalizeValue(value));
}
function isCanonicalBytes(bytes, value) {
  if (!(bytes instanceof Uint8Array)) return false;
  let canon;
  try {
    canon = canonicalize(value);
  } catch {
    return false;
  }
  return bytesEqual(canon, bytes);
}

// src/domain/policy.ts
var POLICY = {
  // The canonical record (§4.2) and the presentation-only signal (§6.1).
  // 30078 is NIP-78 application-specific data. Kind 32267 ("Software
  // Application") was considered and rejected: its semantics sit close enough to
  // ours — an app-store listing record — that our listing policy would inherit
  // another project's curation rules. Sharing 30078 with unrelated apps costs
  // nothing, because NIP-78 specifies the kind as shared by construction.
  SOFTWARE_KIND: 30078,
  CURATION_KIND: 30267,
  FOLLOW_KIND: 3,
  DELETION_KIND: 5,
  DEFAULT_RELAYS: ["wss://x.kojira.io", "wss://nos.lol"],
  // §16.2: an app-chosen token, user-editable, and a labelled visibility gap.
  DISCOVERY_TOPICS: ["nosmaps"],
  CATALOG_STALE_AFTER_MS: 24 * 60 * 60 * 1e3,
  GRAPH_STALE_AFTER_MS: 24 * 60 * 60 * 1e3,
  MAX_FUTURE_SKEW_SEC: 600,
  MAX_FUTURE_HORIZON_SEC: 30 * 24 * 60 * 60,
  MAX_MIGRATION_DEPTH: 8,
  DISCOVERY_LIMIT_PER_RELAY: 500,
  MAX_DISCOVERY_PAGES_PER_RELAY: 8,
  MAX_DISCOVERY_RAW_EVENTS_PER_RELAY: 4e3,
  GRAPH_MAX_FOLLOWS: 512,
  GRAPH_MAX_SETS_PER_CURATOR: 8,
  GRAPH_TIER2_ENABLED: false,
  MAX_FILTERS_PER_REQ: 8,
  MAX_SERIALIZED_REQ_BYTES_FALLBACK: 12e3,
  MAX_ARRAY_ITEMS_PER_FILTER: 128,
  CLEANUP_LIMIT: 256,
  REQ_TIMEOUT_MS: 8e3
};
var SOFTWARE_SCHEMA = "org.nosmaps.software";
var SOFTWARE_D_PREFIX = "nosmaps:";
var D_MAX_BYTES = 192;
var COORD_RE = new RegExp(
  "^" + POLICY.SOFTWARE_KIND + ":([0-9a-f]{64}):(" + SOFTWARE_D_PREFIX + ".{1," + (D_MAX_BYTES - SOFTWARE_D_PREFIX.length) + "})$"
);
var ADDRESS_RE = /^([0-9]{1,5}):([0-9a-f]{64}):(.{0,192})$/;
var D_ASCII_RE = /^[\x21-\x7e]+$/;
var WRITE = {
  PUBLISH_TIMEOUT_MS: 15e3,
  READBACK_ATTEMPTS: 3,
  READBACK_BACKOFF_MS: [0, 2e3, 8e3],
  SIGNER_TIMEOUT_MS: 6e4
};
var DISCOVERY_TOPIC = POLICY.DISCOVERY_TOPICS[0];

// src/domain/event.ts
function fail(reason) {
  return { ok: false, reason };
}
function isLowercaseHex64(v) {
  return typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
}
function tagsWithName(tags, name) {
  const out = [];
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === name) out.push(t);
  }
  return out;
}
function singleTagValue(tags, name) {
  const found = tagsWithName(tags, name);
  if (found.length !== 1) return null;
  const value = found[0]?.[1];
  return typeof value === "string" ? value : null;
}
function getDtag(tags) {
  if (!Array.isArray(tags)) return "";
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === "d" && typeof t[1] === "string") return t[1];
  }
  return "";
}
function compareCodePoints(a, b) {
  const ai = Array.from(a);
  const bi = Array.from(b);
  const len = Math.min(ai.length, bi.length);
  for (let i = 0; i < len; i += 1) {
    const ca = ai[i]?.codePointAt(0);
    const cb = bi[i]?.codePointAt(0);
    if (ca === void 0 || cb === void 0) break;
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
  if (ai.length === bi.length) return 0;
  return ai.length < bi.length ? -1 : 1;
}
function isValidCoordinate(coord) {
  if (typeof coord !== "string") return false;
  const m = COORD_RE.exec(coord);
  if (!m) return false;
  const local = m[2];
  if (local === void 0) return false;
  if (utf8ByteLength(local) > D_MAX_BYTES) return false;
  return true;
}
function coordinateOf(kind, pubkey, d) {
  return String(kind) + ":" + pubkey + ":" + d;
}
function charLength(str) {
  return Array.from(str).length;
}
function futureCheck(createdAt, opts) {
  const received = opts?.receivedAtSec;
  const now2 = opts?.nowSec;
  const receivedAt = Number.isFinite(received) ? received : Number.isFinite(now2) ? now2 : Math.floor(Date.now() / 1e3);
  if (createdAt > receivedAt + POLICY.MAX_FUTURE_HORIZON_SEC) return "future-horizon";
  if (createdAt > receivedAt + POLICY.MAX_FUTURE_SKEW_SEC) return "future-timestamp";
  return null;
}

// src/domain/npub.ts
var BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
var BECH32_GENERATOR = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32HrpExpand(hrp) {
  const out = [];
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31);
  return out;
}
function bech32Polymod(values) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = (chk & 33554431) << 5 ^ value;
    for (let j = 0; j < 5; j += 1) {
      if (top >> j & 1) chk ^= BECH32_GENERATOR[j] ?? 0;
    }
  }
  return chk;
}
function decodeNpub(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  const alreadyHex = isLowercaseHex64(s);
  if (alreadyHex) return s;
  if (s.toLowerCase() !== s && s.toUpperCase() !== s) return null;
  const lower = s.toLowerCase();
  if (lower.indexOf("npub1") !== 0) return null;
  const data = lower.slice(5);
  if (data.length !== 58) return null;
  const values = [];
  for (const ch of data) {
    const idx = BECH32_ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    values.push(idx);
  }
  if (bech32Polymod(bech32HrpExpand("npub").concat(values)) !== 1) return null;
  let acc = 0;
  let bits = 0;
  const bytes = [];
  for (let i = 0; i < 52; i += 1) {
    acc = acc << 5 | (values[i] ?? 0);
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push(acc >> bits & 255);
    }
  }
  if (bytes.length !== 32) return null;
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
function encodeNpub(pubkeyHex) {
  if (typeof pubkeyHex !== "string") return null;
  const hex = pubkeyHex.trim().toLowerCase();
  if (!isLowercaseHex64(hex)) return null;
  let acc = 0;
  let bits = 0;
  const values = [];
  for (let i = 0; i < 64; i += 2) {
    acc = acc << 8 | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      values.push(acc >> bits & 31);
    }
  }
  if (bits > 0) values.push(acc << 5 - bits & 31);
  const checksum = bech32Polymod(bech32HrpExpand("npub").concat(values, [0, 0, 0, 0, 0, 0])) ^ 1;
  let out = "npub1";
  for (const value of values) out += BECH32_ALPHABET[value] ?? "";
  for (let i = 0; i < 6; i += 1) out += BECH32_ALPHABET[checksum >> 5 * (5 - i) & 31] ?? "";
  return out;
}

// src/domain/records.ts
function checkEnvelope(event, kind, requireContent) {
  if (!event || typeof event !== "object") return fail("bad-schema");
  const raw = event;
  if (raw.kind !== kind) return fail("bad-kind");
  if (!isLowercaseHex64(raw.pubkey)) return fail("bad-schema");
  if (!Array.isArray(raw.tags)) return fail("bad-schema");
  if (requireContent && typeof raw.content !== "string") return fail("bad-schema");
  if (!Number.isSafeInteger(raw.created_at)) return fail("bad-schema");
  const { kind: k, pubkey, created_at: createdAt, tags } = raw;
  if (typeof k !== "number" || typeof pubkey !== "string" || typeof createdAt !== "number" || !Array.isArray(tags)) {
    return fail("bad-schema");
  }
  const envelope = {
    kind: k,
    pubkey,
    created_at: createdAt,
    tags,
    ...typeof raw.content === "string" ? { content: raw.content } : {},
    ...typeof raw.id === "string" ? { id: raw.id } : {},
    ...typeof raw.sig === "string" ? { sig: raw.sig } : {}
  };
  return { ok: true, event: envelope };
}
function isJsonRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function prop(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : void 0;
}
function validateSoftwareEvent(event, opts) {
  const envelope = checkEnvelope(event, POLICY.SOFTWARE_KIND, true);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;
  const content = ev.content ?? "";
  const dTags = tagsWithName(ev.tags, "d");
  const dValue = dTags[0]?.[1];
  if (dTags.length !== 1 || typeof dValue !== "string") return fail("bad-d");
  const d = dValue;
  if (d.indexOf(SOFTWARE_D_PREFIX) !== 0) return fail("foreign-d");
  if (d.length === SOFTWARE_D_PREFIX.length) return fail("bad-d");
  if (!D_ASCII_RE.test(d) || utf8ByteLength(d) > D_MAX_BYTES) return fail("bad-d");
  const parsed = strictParse(utf8Encode(content));
  if (!parsed.ok) return fail("foreign-profile");
  const value = parsed.value;
  if (!value || !isJsonRecord(value)) return fail("foreign-profile");
  const c = value;
  if (prop(c, "schema") !== SOFTWARE_SCHEMA) return fail("foreign-profile");
  const topics = [];
  for (const tag of tagsWithName(ev.tags, "t")) {
    const topic = tag[1];
    if (typeof topic !== "string" || topic === "") return fail("bad-topic");
    for (let j = 2; j < tag.length; j += 1) {
      const extra = tag[j];
      if (typeof extra === "string" && extra !== "") return fail("multi-value-t");
    }
    if (topic !== topic.toLowerCase()) return fail("uppercase-topic");
    if (utf8ByteLength(topic) > 128) return fail("bad-topic");
    if (topics.indexOf(topic) === -1) topics.push(topic);
  }
  const required = ["schema", "version", "state", "name", "summary"];
  const optional = ["homepage", "superseded_by"];
  for (const key of Object.keys(c)) {
    if (required.indexOf(key) === -1 && optional.indexOf(key) === -1) {
      return fail("unknown-field");
    }
  }
  for (const key of required) {
    if (!(key in c)) return fail("bad-schema");
  }
  if (prop(c, "version") !== 1) return fail("bad-version");
  const state = prop(c, "state");
  if (state !== "active" && state !== "withdrawn") return fail("bad-state");
  const name = prop(c, "name");
  if (typeof name !== "string" || name.length === 0 || charLength(name) > 120) {
    return fail("bad-schema");
  }
  const summary = prop(c, "summary");
  if (typeof summary !== "string" || charLength(summary) > 1e3) return fail("bad-schema");
  let homepage = null;
  if ("homepage" in c) {
    const value2 = prop(c, "homepage");
    if (typeof value2 !== "string" || value2.length > 2048) return fail("bad-schema");
    if (value2.indexOf("https://") !== 0) return fail("bad-schema");
    homepage = value2;
  }
  const coordinate = coordinateOf(POLICY.SOFTWARE_KIND, ev.pubkey, d);
  let supersededBy = null;
  if ("superseded_by" in c) {
    const value2 = prop(c, "superseded_by");
    if (!isValidCoordinate(value2)) return fail("bad-superseded-by");
    if (value2 === coordinate) return fail("bad-superseded-by");
    supersededBy = typeof value2 === "string" ? value2 : null;
  }
  for (const tag of tagsWithName(ev.tags, "state")) {
    if (tag[1] !== state) return fail("tag-content-mismatch");
  }
  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);
  return {
    ok: true,
    record: {
      coordinate,
      publisher: ev.pubkey,
      d,
      state,
      name,
      summary,
      homepage,
      supersededBy,
      topics,
      eventId: typeof ev.id === "string" ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}
function validateCurationSetEvent(event, opts) {
  const envelope = checkEnvelope(event, POLICY.CURATION_KIND, true);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;
  const dTags = tagsWithName(ev.tags, "d");
  const dValue = dTags[0]?.[1];
  if (dTags.length !== 1 || typeof dValue !== "string") return fail("bad-d");
  const d = dValue;
  if (d.length === 0 || utf8ByteLength(d) > 192) return fail("bad-d");
  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);
  const members = [];
  let ignored = 0;
  for (const tag of tagsWithName(ev.tags, "a")) {
    const value = tag[1];
    if (typeof value !== "string" || !isValidCoordinate(value)) {
      ignored += 1;
      continue;
    }
    if (members.indexOf(value) === -1) members.push(value);
  }
  return {
    ok: true,
    set: {
      curator: ev.pubkey,
      d,
      coordinate: coordinateOf(POLICY.CURATION_KIND, ev.pubkey, d),
      members,
      ignoredMembers: ignored,
      title: singleTagValue(ev.tags, "title"),
      image: singleTagValue(ev.tags, "image"),
      description: singleTagValue(ev.tags, "description"),
      eventId: typeof ev.id === "string" ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}
function validateFollowListEvent(event, opts) {
  const envelope = checkEnvelope(event, POLICY.FOLLOW_KIND, false);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;
  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);
  const follows = [];
  let malformed = 0;
  let total = 0;
  for (const tag of tagsWithName(ev.tags, "p")) {
    total += 1;
    const value = tag[1];
    if (!isLowercaseHex64(value)) {
      malformed += 1;
      continue;
    }
    if (follows.indexOf(value) === -1) follows.push(value);
  }
  return {
    ok: true,
    followList: {
      pubkey: ev.pubkey,
      follows,
      malformed,
      total,
      eventId: typeof ev.id === "string" ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}
function validateDeletionEvent(event, opts) {
  const envelope = checkEnvelope(event, POLICY.DELETION_KIND, false);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;
  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);
  const ids = [];
  for (const tag of tagsWithName(ev.tags, "e")) {
    const value = tag[1];
    if (isLowercaseHex64(value) && ids.indexOf(value) === -1) ids.push(value);
  }
  const addresses = [];
  for (const tag of tagsWithName(ev.tags, "a")) {
    const value = tag[1];
    if (typeof value !== "string") continue;
    const m = ADDRESS_RE.exec(value);
    if (!m) continue;
    if (m[2] !== ev.pubkey) continue;
    if (addresses.indexOf(value) === -1) addresses.push(value);
  }
  return {
    ok: true,
    deletion: {
      author: ev.pubkey,
      ids,
      addresses,
      eventId: typeof ev.id === "string" ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}

// src/domain/winners.ts
function asEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function collectDeletions(events, opts) {
  const ids = {};
  const addresses = {};
  let accepted = 0;
  let rejected = 0;
  const list2 = Array.isArray(events) ? events : [];
  for (const raw of list2) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.DELETION_KIND) continue;
    const vr = validateDeletionEvent(e, opts);
    if (!vr.ok) {
      rejected += 1;
      continue;
    }
    accepted += 1;
    const del = vr.deletion;
    for (const key of del.ids) {
      const bucket = ids[key] ?? (ids[key] = []);
      if (bucket.indexOf(del.author) === -1) bucket.push(del.author);
    }
    for (const key of del.addresses) {
      const current = addresses[key];
      if (current === void 0 || current < del.createdAt) addresses[key] = del.createdAt;
    }
  }
  return { ids, addresses, accepted, rejected };
}
function isSuppressed(event, coordinate, deletions) {
  if (!deletions) return false;
  const byId = event.id === void 0 ? void 0 : deletions.ids[event.id];
  if (Array.isArray(byId) && byId.indexOf(event.pubkey) !== -1) return true;
  if (coordinate) {
    const covered = deletions.addresses[coordinate];
    if (covered !== void 0 && event.created_at <= covered) return true;
  }
  return false;
}
function selectAddressableWinner(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  let best = null;
  for (const raw of events) {
    const e = asEvent(raw);
    if (!e) continue;
    if (!Number.isFinite(e.created_at) || typeof e.id !== "string") continue;
    if (best === null) {
      best = e;
    } else if (e.created_at > best.created_at) {
      best = e;
    } else if (e.created_at === best.created_at && best.id !== void 0 && e.id < best.id) {
      best = e;
    }
  }
  return best;
}
function selectSoftwareWinners(events, opts) {
  const deletions = opts?.deletions ?? null;
  const receipts = opts?.receipts ?? null;
  const groups = /* @__PURE__ */ new Map();
  const group = (coordinate) => {
    let g = groups.get(coordinate);
    if (!g) {
      g = { coordinate, valid: [], quarantined: [] };
      groups.set(coordinate, g);
    }
    return g;
  };
  const list2 = Array.isArray(events) ? events : [];
  for (const raw of list2) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.SOFTWARE_KIND) continue;
    const receipt = receipts && typeof e.id === "string" ? receipts[e.id] : null;
    const received = receipt?.receivedAtSec;
    const perEvent = {
      ...opts?.nowSec === void 0 ? {} : { nowSec: opts.nowSec },
      ...Number.isFinite(received) ? { receivedAtSec: received } : opts?.receivedAtSec === void 0 ? {} : { receivedAtSec: opts.receivedAtSec }
    };
    const vr = validateSoftwareEvent(e, perEvent);
    const coordinate = vr.ok ? vr.record.coordinate : coordinateOf(
      POLICY.SOFTWARE_KIND,
      isLowercaseHex64(e.pubkey) ? e.pubkey : "unknown",
      getDtag(e.tags)
    );
    const g = group(coordinate);
    if (!vr.ok) {
      g.quarantined.push({
        coordinate,
        eventId: typeof e.id === "string" ? e.id : null,
        pubkey: typeof e.pubkey === "string" ? e.pubkey : null,
        createdAt: Number.isFinite(e.created_at) ? e.created_at : null,
        reason: vr.reason
      });
      continue;
    }
    if (isSuppressed(e, coordinate, deletions)) {
      g.quarantined.push({
        coordinate,
        eventId: vr.record.eventId,
        pubkey: e.pubkey,
        createdAt: e.created_at,
        reason: "deleted"
      });
      continue;
    }
    g.valid.push({ event: e, record: vr.record });
  }
  const winners = [];
  const quarantined = [];
  const coords = Array.from(groups.keys()).sort(compareCodePoints);
  for (const coord of coords) {
    const g = groups.get(coord);
    if (!g) continue;
    const winnerEvent = selectAddressableWinner(g.valid.map((v) => v.event));
    const winner = winnerEvent ? g.valid.find((v) => v.event === winnerEvent) : void 0;
    for (const q of g.quarantined) quarantined.push(q);
    if (!winner) continue;
    let newer = null;
    for (const q of g.quarantined) {
      if (q.createdAt === null || !Number.isFinite(q.createdAt)) continue;
      if (q.createdAt <= winner.record.createdAt) continue;
      if (!newer || newer.createdAt === null || q.createdAt > newer.createdAt) newer = q;
    }
    winners.push({
      coordinate: g.coordinate,
      record: winner.record,
      event: winner.event,
      quarantinedNewer: newer ? { eventId: newer.eventId, reason: newer.reason, createdAt: newer.createdAt } : null,
      observedVersions: g.valid.length
    });
  }
  return { winners, quarantined };
}

// src/domain/graph.ts
function asEvent2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function deriveGraph(opts) {
  const viewerPubkey = isLowercaseHex64(opts?.viewerPubkey) ? opts.viewerPubkey : null;
  const base = {
    viewerPubkey,
    state: "none",
    pubkeys: [],
    coverage: "unknown",
    followsUsed: 0,
    followsTotal: 0,
    malformedPTags: 0,
    truncated: false,
    followListId: null,
    followListCreatedAt: null
  };
  if (!viewerPubkey) return base;
  const candidates = [];
  const list2 = Array.isArray(opts?.events) ? opts.events : [];
  for (const raw of list2) {
    const e = asEvent2(raw);
    if (!e || e.kind !== POLICY.FOLLOW_KIND || e.pubkey !== viewerPubkey) continue;
    const vr = validateFollowListEvent(e, opts);
    if (!vr.ok) continue;
    if (isSuppressed(e, coordinateOf(POLICY.FOLLOW_KIND, e.pubkey, ""), opts?.deletions)) continue;
    candidates.push(e);
  }
  const winnerEvent = selectAddressableWinner(candidates);
  if (!winnerEvent) {
    return {
      ...base,
      state: "self-only",
      pubkeys: [viewerPubkey],
      coverage: "incomplete",
      followsUsed: 0,
      followsTotal: 0
    };
  }
  const revalidated = validateFollowListEvent(winnerEvent, opts);
  if (!revalidated.ok) {
    return {
      ...base,
      state: "self-only",
      pubkeys: [viewerPubkey],
      coverage: "incomplete"
    };
  }
  const parsed = revalidated.followList;
  const pubkeys = [viewerPubkey];
  for (const key of parsed.follows) {
    if (pubkeys.indexOf(key) === -1) pubkeys.push(key);
  }
  const truncated = pubkeys.length > POLICY.GRAPH_MAX_FOLLOWS;
  const used = truncated ? pubkeys.slice(0, POLICY.GRAPH_MAX_FOLLOWS) : pubkeys;
  const nowSec = Number.isFinite(opts?.nowSec) ? opts?.nowSec : Math.floor(Date.now() / 1e3);
  const staleAfter = POLICY.GRAPH_STALE_AFTER_MS / 1e3;
  let coverage = "fresh";
  if (truncated) coverage = "truncated";
  else if (nowSec - parsed.createdAt > staleAfter) coverage = "stale";
  return {
    viewerPubkey,
    state: "tier1",
    pubkeys: used,
    coverage,
    followsUsed: used.length,
    followsTotal: pubkeys.length,
    malformedPTags: parsed.malformed,
    truncated,
    followListId: parsed.eventId,
    followListCreatedAt: parsed.createdAt
  };
}
function curationMembership(opts) {
  const counted = [];
  const source = Array.isArray(opts?.pubkeys) ? opts.pubkeys : [];
  for (const key of source) {
    if (isLowercaseHex64(key) && counted.indexOf(key) === -1) counted.push(key);
  }
  const countedSet = new Set(counted);
  const groups = /* @__PURE__ */ new Map();
  const list2 = Array.isArray(opts?.events) ? opts.events : [];
  for (const raw of list2) {
    const e = asEvent2(raw);
    if (!e || e.kind !== POLICY.CURATION_KIND) continue;
    if (!countedSet.has(e.pubkey)) continue;
    const vr = validateCurationSetEvent(e, opts);
    if (!vr.ok) continue;
    if (isSuppressed(e, vr.set.coordinate, opts?.deletions)) continue;
    let g = groups.get(vr.set.coordinate);
    if (!g) {
      g = { curator: e.pubkey, d: vr.set.d, events: [] };
      groups.set(vr.set.coordinate, g);
    }
    g.events.push(e);
  }
  const byCurator = /* @__PURE__ */ new Map();
  groups.forEach((g) => {
    const winnerEvent = selectAddressableWinner(g.events);
    if (!winnerEvent) return;
    const vr = validateCurationSetEvent(winnerEvent, opts);
    if (!vr.ok) return;
    let entry = byCurator.get(g.curator);
    if (!entry) {
      entry = { curator: g.curator, sets: [] };
      byCurator.set(g.curator, entry);
    }
    entry.sets.push(vr.set);
  });
  const curators = [];
  const recommenders = /* @__PURE__ */ new Map();
  const curatorKeys = Array.from(byCurator.keys()).sort(compareCodePoints);
  for (const key of curatorKeys) {
    const entry = byCurator.get(key);
    if (!entry) continue;
    entry.sets.sort((a, b) => compareCodePoints(a.d, b.d));
    const setsObserved = entry.sets.length;
    const used = entry.sets.slice(0, POLICY.GRAPH_MAX_SETS_PER_CURATOR);
    const members = [];
    for (const set of used) {
      for (const coord of set.members) {
        if (members.indexOf(coord) === -1) members.push(coord);
      }
    }
    members.sort(compareCodePoints);
    for (const coord of members) {
      let who = recommenders.get(coord);
      if (!who) {
        who = [];
        recommenders.set(coord, who);
      }
      if (who.indexOf(entry.curator) === -1) who.push(entry.curator);
    }
    curators.push({
      curator: entry.curator,
      setsObserved,
      setsUsed: used.length,
      truncated: setsObserved > used.length,
      setIds: used.map((s) => s.d),
      memberCount: members.length,
      members
    });
  }
  const recommenderList = {};
  recommenders.forEach((who, coord) => {
    recommenderList[coord] = who.slice().sort(compareCodePoints);
  });
  return {
    counted,
    curators,
    recommenders: recommenderList,
    learned: Object.keys(recommenderList).sort(compareCodePoints)
  };
}
function orderEntries(entries, graphState) {
  const useCounts = graphState !== "none";
  const copy = (Array.isArray(entries) ? entries : []).slice();
  copy.sort((a, b) => {
    if (useCounts) {
      const ra = Number.isFinite(a.recommendations) ? a.recommendations : 0;
      const rb = Number.isFinite(b.recommendations) ? b.recommendations : 0;
      if (ra !== rb) return rb - ra;
    }
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    const ia = a.eventId ?? "";
    const ib = b.eventId ?? "";
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
  return copy;
}

// src/domain/catalogue.ts
var EMPTY_MEMBERSHIP = {
  counted: [],
  curators: [],
  recommenders: {},
  learned: []
};
function summarise(list2) {
  return list2.map((c) => ({
    curator: c.curator,
    setsObserved: c.setsObserved,
    setsUsed: c.setsUsed,
    truncated: c.truncated,
    setIds: c.setIds,
    memberCount: c.memberCount
  }));
}
function buildCatalog(input) {
  const nowMs = Number.isFinite(input?.nowMs) ? input?.nowMs : Date.now();
  const nowSec = Number.isFinite(input?.nowSec) ? input?.nowSec : Math.floor(nowMs / 1e3);
  const events = Array.isArray(input?.events) ? input.events : [];
  const receipts = input?.receipts ?? {};
  const sources = input?.sources ?? {};
  const coverage = input?.coverage ?? {};
  const diagnostics = Array.isArray(input?.diagnostics) ? input.diagnostics.slice() : [];
  const validationOpts = { nowSec, receivedAtSec: nowSec, receipts };
  const deletions = collectDeletions(events, validationOpts);
  const graph = deriveGraph({
    ...input?.viewerPubkey === void 0 ? {} : { viewerPubkey: input.viewerPubkey },
    events,
    deletions,
    nowSec
  });
  const manual = [];
  const manualInput = Array.isArray(input?.manualCounted) ? input.manualCounted : [];
  for (const raw of manualInput) {
    const key = decodeNpub(raw);
    if (key && graph.pubkeys.indexOf(key) === -1 && manual.indexOf(key) === -1) manual.push(key);
  }
  const curation = curationMembership({
    events,
    pubkeys: graph.pubkeys,
    deletions,
    nowSec,
    receivedAtSec: nowSec
  });
  const manualCuration = manual.length ? curationMembership({ events, pubkeys: manual, deletions, nowSec, receivedAtSec: nowSec }) : EMPTY_MEMBERSHIP;
  const selection = selectSoftwareWinners(events, {
    deletions,
    nowSec,
    receivedAtSec: nowSec,
    receipts
  });
  const observedCoordinates = /* @__PURE__ */ new Set();
  for (const w of selection.winners) observedCoordinates.add(w.coordinate);
  for (const q of selection.quarantined) observedCoordinates.add(q.coordinate);
  const rows = [];
  for (const w of selection.winners) {
    if (w.record.state !== "active") continue;
    const receipt = w.record.eventId === null ? void 0 : receipts[w.record.eventId];
    const recommenders = curation.recommenders[w.coordinate] ?? [];
    const manualRecommenders = manualCuration.recommenders[w.coordinate] ?? [];
    rows.push({
      coordinate: w.coordinate,
      publisher: w.record.publisher,
      d: w.record.d,
      state: "active",
      fields: {
        name: w.record.name,
        summary: w.record.summary,
        homepage: w.record.homepage
      },
      topics: w.record.topics.slice(),
      supersededBy: w.record.supersededBy,
      eventId: w.record.eventId,
      createdAt: w.record.createdAt,
      // unknown when the viewer has no graph; never 0, never invented (I8).
      recommendations: graph.state === "none" ? null : recommenders.length,
      recommenders: graph.state === "none" ? [] : recommenders.slice(),
      manualRecommendations: manual.length ? manualRecommenders.length : null,
      manualRecommenders: manualRecommenders.slice(),
      quarantinedNewer: w.quarantinedNewer,
      relays: (w.record.eventId === null ? [] : sources[w.record.eventId] ?? []).slice(),
      stale: Boolean(receipt?.cached)
    });
  }
  const entries = orderEntries(rows, graph.state);
  const unresolved = [];
  const learnedAll = curation.learned.concat(manualCuration.learned);
  for (const coord of learnedAll) {
    if (observedCoordinates.has(coord)) continue;
    if (unresolved.indexOf(coord) === -1) unresolved.push(coord);
  }
  unresolved.sort(compareCodePoints);
  const relayUrls = Object.keys(coverage);
  let allEose = relayUrls.length > 0;
  for (const url of relayUrls) {
    const cov = coverage[url];
    if (!cov || cov.status !== "eose" && cov.status !== "skipped") {
      allEose = false;
      break;
    }
  }
  const anyStale = entries.some((e) => e.stale === true);
  const observedAnything = events.length > 0;
  if (graph.state === "none") diagnostics.push("graph-none");
  if (graph.state === "self-only") diagnostics.push("graph-self-only");
  if (graph.truncated) {
    diagnostics.push("graph-truncated:" + graph.followsUsed + "/" + graph.followsTotal);
  }
  if (graph.malformedPTags > 0) diagnostics.push("graph-malformed-p-tags:" + graph.malformedPTags);
  for (const c of curation.curators) {
    if (c.truncated) diagnostics.push("curator-sets-truncated:" + c.curator);
  }
  if (selection.quarantined.length) diagnostics.push("quarantined:" + selection.quarantined.length);
  if (unresolved.length) {
    diagnostics.push("recommended-coordinate-not-observed:" + unresolved.length);
  }
  if (!allEose) diagnostics.push("relay-coverage-incomplete");
  if (allEose && !observedAnything) diagnostics.push("no-records-observed");
  if (graph.coverage === "stale") diagnostics.push("graph-stale");
  let status;
  if (!observedAnything) {
    status = "unavailable";
  } else if (anyStale) {
    status = "stale";
  } else if (!allEose || diagnostics.indexOf("discovery-cap") !== -1 || graph.truncated) {
    status = "incomplete";
  } else {
    status = "fresh";
  }
  return {
    status,
    entries,
    graph,
    curation: {
      counted: curation.counted,
      curators: summarise(curation.curators),
      manual: summarise(manualCuration.curators)
    },
    quarantined: selection.quarantined,
    unresolved,
    deletions: { accepted: deletions.accepted, rejected: deletions.rejected },
    coverage,
    topics: Array.isArray(input?.topics) ? input.topics.slice() : POLICY.DISCOVERY_TOPICS.slice(),
    asOf: nowMs,
    diagnostics
  };
}

// src/domain/chunking.ts
function serializeReq(subId, filters) {
  return JSON.stringify(["REQ", subId, ...filters]);
}
function arrayKeys(filter2) {
  const out = [];
  for (const key of Object.keys(filter2).sort()) {
    if (Array.isArray(filter2[key])) out.push(key);
  }
  return out;
}
function arrayAt(filter2, key) {
  if (key === null) return null;
  const value = filter2[key];
  return Array.isArray(value) ? value : null;
}
function withKey(filter2, key, value) {
  return { ...filter2, [key]: value };
}
function capArrays(filter2, cap) {
  let out = [filter2];
  let changed = true;
  let guard = 0;
  while (changed) {
    if (++guard > 64) break;
    changed = false;
    const next = [];
    for (const f of out) {
      let bigKey = null;
      for (const k of arrayKeys(f)) {
        const arr2 = arrayAt(f, k);
        const big = arrayAt(f, bigKey);
        if (arr2 && arr2.length > cap && (bigKey === null || big && arr2.length > big.length)) {
          bigKey = k;
        }
      }
      const arr = arrayAt(f, bigKey);
      if (bigKey === null || !arr) {
        next.push(f);
        continue;
      }
      changed = true;
      for (let s = 0; s < arr.length; s += cap) {
        next.push(withKey(f, bigKey, arr.slice(s, s + cap)));
      }
    }
    out = next;
  }
  return out;
}
function largestArrayKey(filter2) {
  let big = null;
  for (const key of arrayKeys(filter2)) {
    const arr = arrayAt(filter2, key);
    const current = arrayAt(filter2, big);
    if (!arr) continue;
    if (big === null || current && arr.length > current.length) big = key;
  }
  return big;
}
function reqBytes(subId, filters) {
  return utf8ByteLength(serializeReq(subId, filters));
}
function chunkFilters(filters, opts) {
  const maxFilters = Number.isFinite(opts?.maxFilters) ? opts?.maxFilters : POLICY.MAX_FILTERS_PER_REQ;
  const maxBytes = Number.isFinite(opts?.maxBytes) ? opts?.maxBytes : POLICY.MAX_SERIALIZED_REQ_BYTES_FALLBACK;
  const arrayCap = Number.isFinite(opts?.maxArrayItems) ? opts?.maxArrayItems : POLICY.MAX_ARRAY_ITEMS_PER_FILTER;
  const subId = typeof opts?.subId === "string" && opts.subId ? opts.subId : "nosmaps-000000000000";
  const input = Array.isArray(filters) ? filters : [];
  const queue = [];
  for (const f of input) {
    for (const capped of capArrays(f, arrayCap)) queue.push(capped);
  }
  const chunks = [];
  let current = [];
  let guard = 0;
  while (queue.length) {
    if (++guard > 8192) return { ok: false, reason: "chunk-guard", chunks: [] };
    const f = queue[0];
    if (f === void 0) break;
    const withF = current.concat([f]);
    if (withF.length <= maxFilters && reqBytes(subId, withF) <= maxBytes) {
      current = withF;
      queue.shift();
      continue;
    }
    const key = withF.length <= maxFilters ? largestArrayKey(f) : null;
    const arr = arrayAt(f, key);
    if (key && arr && arr.length > 1) {
      let lo = 1;
      let hi = arr.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        const trial = withKey(f, key, arr.slice(0, mid));
        if (reqBytes(subId, current.concat([trial])) <= maxBytes) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (best > 0) {
        current.push(withKey(f, key, arr.slice(0, best)));
        queue[0] = withKey(f, key, arr.slice(best));
        chunks.push(current);
        current = [];
        continue;
      }
    }
    if (current.length) {
      chunks.push(current);
      current = [];
      continue;
    }
    return { ok: false, reason: "filter-too-large", chunks: [] };
  }
  if (current.length) chunks.push(current);
  let filterCount = 0;
  for (const chunk2 of chunks) filterCount += chunk2.length;
  return { ok: true, chunks, filterCount };
}

// src/data/cache.ts
var DB_NAME = "nosmaps-catalog";
var DB_VERSION = 2;
var STORE = "records";
var LEGACY_STORE = "manifests";
function idbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}
function open() {
  return new Promise((resolve) => {
    if (!idbAvailable()) {
      resolve(null);
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (db.objectStoreNames.contains(LEGACY_STORE)) db.deleteObjectStore(LEGACY_STORE);
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "coordinate" });
        }
      } catch {
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}
function closeQuietly(db) {
  try {
    db.close();
  } catch {
  }
}
function putRecord(record) {
  return new Promise((resolve) => {
    void open().then((db) => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => {
          closeQuietly(db);
          resolve();
        };
        tx.onerror = () => {
          closeQuietly(db);
          resolve();
        };
        tx.onabort = () => {
          closeQuietly(db);
          resolve();
        };
      } catch {
        closeQuietly(db);
        resolve();
      }
    });
  });
}
function getRecord(coordinate) {
  return new Promise((resolve) => {
    void open().then((db) => {
      if (!db) {
        resolve(null);
        return;
      }
      try {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(coordinate);
        r.onsuccess = () => {
          closeQuietly(db);
          const result = r.result;
          resolve(result ? result : null);
        };
        r.onerror = () => {
          closeQuietly(db);
          resolve(null);
        };
      } catch {
        closeQuietly(db);
        resolve(null);
      }
    });
  });
}
function getAll() {
  return new Promise((resolve) => {
    void open().then((db) => {
      if (!db) {
        resolve([]);
        return;
      }
      try {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).getAll();
        r.onsuccess = () => {
          closeQuietly(db);
          const result = r.result;
          resolve(Array.isArray(result) ? result : []);
        };
        r.onerror = () => {
          closeQuietly(db);
          resolve([]);
        };
      } catch {
        closeQuietly(db);
        resolve([]);
      }
    });
  });
}
function wipe() {
  return new Promise((resolve) => {
    void open().then((db) => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => {
          closeQuietly(db);
          resolve();
        };
        tx.onerror = () => {
          closeQuietly(db);
          resolve();
        };
        tx.onabort = () => {
          closeQuietly(db);
          resolve();
        };
      } catch {
        closeQuietly(db);
        resolve();
      }
    });
  });
}
function deleteDatabase() {
  return new Promise((resolve) => {
    if (!idbAvailable()) {
      resolve();
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
function isFresh(record, nowMs) {
  if (!record || !Number.isFinite(record.verifiedAt)) return false;
  return nowMs - record.verifiedAt < POLICY.CATALOG_STALE_AFTER_MS;
}
var cache = { open, putRecord, getRecord, getAll, wipe, deleteDatabase, isFresh };

// src/data/catalogue-data.ts
function looksLikeData(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return Array.isArray(candidate.tools) && typeof candidate.meta === "object";
}
function readCatalogueData() {
  const value = globalThis.NOSMAPS_DATA;
  if (!looksLikeData(value)) {
    throw new Error("nosmaps: data.js did not provide NOSMAPS_DATA");
  }
  return value;
}

// src/data/stats.ts
var MAX_LOG = 200;
var RequestStats = class {
  logicalReqs = 0;
  physicalReqs = 0;
  /* §9.2: HTTP in the catalog data path is zero. Nothing in this codebase
     increments this counter — it exists so "zero" is an assertable number in
     diagnostics and tests rather than an unverifiable claim. A non-zero value
     can only mean a regression reintroduced an HTTP dependency. */
  httpAttempts = 0;
  cacheHits = 0;
  log = [];
  push(entry) {
    this.log.push(entry);
    if (this.log.length > MAX_LOG) this.log.shift();
  }
  logReq(relay, detail) {
    this.physicalReqs += 1;
    this.push({ at: Date.now(), kind: "req", relay, detail });
  }
  logCache(detail) {
    this.cacheHits += 1;
    this.push({ at: Date.now(), kind: "cache", detail });
  }
  getLog() {
    return this.log.slice();
  }
  reset() {
    this.logicalReqs = 0;
    this.physicalReqs = 0;
    this.httpAttempts = 0;
    this.cacheHits = 0;
    this.log = [];
  }
  /** A snapshot, so a single load can report its own cost rather than the total. */
  snapshot() {
    return {
      logicalReqs: this.logicalReqs,
      physicalReqs: this.physicalReqs,
      httpAttempts: this.httpAttempts,
      cacheHits: this.cacheHits
    };
  }
  since(base) {
    return {
      logicalReqs: this.logicalReqs - base.logicalReqs,
      physicalReqs: this.physicalReqs - base.physicalReqs,
      httpAttempts: this.httpAttempts - base.httpAttempts,
      cacheHits: this.cacheHits - base.cacheHits
    };
  }
};
var stats = new RequestStats();

// src/data/relay.ts
function readRxModule(mod2) {
  return mod2 ?? {};
}
async function createRelayContext(relays, timeoutMs) {
  try {
    const [rxModRaw, cryptoModRaw] = await Promise.all([
      Promise.resolve().then(() => (init_rx_nostr(), rx_nostr_exports)),
      Promise.resolve().then(() => (init_rx_nostr_crypto(), rx_nostr_crypto_exports))
    ]);
    const rxMod = readRxModule(rxModRaw);
    const cryptoMod = cryptoModRaw ?? {};
    if (!rxMod.createRxNostr || !rxMod.createRxBackwardReq) {
      return { ok: false, rxNostr: null, createRxBackwardReq: null, relays: relays.slice(), timeoutMs };
    }
    const rxNostr = rxMod.createRxNostr({ verifier: cryptoMod.verifier });
    rxNostr.setDefaultRelays(relays);
    return {
      ok: true,
      rxNostr,
      createRxBackwardReq: rxMod.createRxBackwardReq,
      relays: relays.slice(),
      timeoutMs
    };
  } catch {
    return { ok: false, rxNostr: null, createRxBackwardReq: null, relays: relays.slice(), timeoutMs };
  }
}
function emptyCoverage(relays, status, observedAt) {
  const coverage = {};
  for (const relay of relays) coverage[relay] = { status, observedAt };
  return coverage;
}
function skippedRound(label, relays) {
  return {
    label,
    events: [],
    coverage: emptyCoverage(relays, "skipped", Date.now()),
    logicalReqs: 0,
    physicalReqs: 0,
    chunks: 0,
    filters: [],
    reason: "skipped"
  };
}
async function fetchRound(ctx, filters, label) {
  const relays = ctx.relays;
  const observedAt = Date.now();
  const round = {
    label,
    events: [],
    coverage: emptyCoverage(relays, "error", observedAt),
    logicalReqs: 0,
    physicalReqs: 0,
    chunks: 0,
    filters: [],
    reason: null
  };
  if (!filters.length) {
    round.coverage = emptyCoverage(relays, "skipped", observedAt);
    round.reason = "skipped";
    return round;
  }
  const chunked = chunkFilters(filters, { subId: "nosmaps-" + label });
  if (!chunked.ok) {
    round.coverage = emptyCoverage(relays, "rejected", observedAt);
    round.reason = chunked.reason;
    return round;
  }
  round.filters = chunked.chunks;
  round.chunks = chunked.chunks.length;
  if (!ctx.ok || !ctx.rxNostr || !ctx.createRxBackwardReq) {
    round.reason = "relay-unavailable";
    return round;
  }
  stats.logicalReqs += relays.length;
  round.logicalReqs = relays.length;
  for (const relay of relays) {
    for (let j = 0; j < chunked.chunks.length; j += 1) {
      stats.logReq(relay, label + ":" + j);
      round.physicalReqs += 1;
    }
  }
  const rxNostr = ctx.rxNostr;
  const rxReq = ctx.createRxBackwardReq();
  await new Promise((resolve) => {
    let settled = false;
    let sub = null;
    const timer2 = setTimeout(() => finish("timeout"), ctx.timeoutMs);
    function finish(mode) {
      if (settled) return;
      settled = true;
      clearTimeout(timer2);
      const at = Date.now();
      for (const r of relays) {
        if (mode === "eose") {
          round.coverage[r] = { status: "eose", observedAt: at };
        } else if (round.coverage[r]?.status === "error") {
          round.coverage[r] = { status: mode === "timeout" ? "timeout" : "error", observedAt: at };
        }
      }
      if (sub && typeof sub.unsubscribe === "function") {
        try {
          sub.unsubscribe();
        } catch {
        }
      }
      resolve();
    }
    try {
      sub = rxNostr.use(rxReq).subscribe({
        next: (packet) => {
          try {
            if (packet && packet.event) {
              round.events.push({ event: packet.event, from: packet.from ?? null });
            }
          } catch {
          }
        },
        error: () => finish("error"),
        complete: () => finish("eose")
      });
    } catch {
      finish("error");
      return;
    }
    try {
      for (const chunk2 of chunked.chunks) rxReq.emit(chunk2);
      if (typeof rxReq.over === "function") rxReq.over();
    } catch {
      finish("error");
    }
  });
  return round;
}
function mergeCoverage(target, round) {
  for (const k of Object.keys(round.coverage)) {
    const next = round.coverage[k];
    if (!next) continue;
    const prev = target[k];
    if (!prev) {
      target[k] = next;
      continue;
    }
    if (next.status === "skipped") continue;
    if (prev.status === "skipped" || prev.status === "eose") target[k] = next;
    else if (next.status !== "eose") target[k] = next;
  }
  return target;
}
function groupByAuthor(coordinates) {
  const byAuthor = /* @__PURE__ */ new Map();
  for (const coord of coordinates) {
    const m = COORD_RE.exec(coord);
    if (!m) continue;
    const author = m[1];
    const d = m[2];
    if (author === void 0 || d === void 0) continue;
    let ds = byAuthor.get(author);
    if (!ds) {
      ds = [];
      byAuthor.set(author, ds);
    }
    if (ds.indexOf(d) === -1) ds.push(d);
  }
  const authors = Array.from(byAuthor.keys()).sort(compareCodePoints);
  const filters = [];
  for (const author of authors) {
    const ds = (byAuthor.get(author) ?? []).slice().sort(compareCodePoints);
    filters.push({
      kinds: [POLICY.SOFTWARE_KIND],
      authors: [author],
      "#d": ds,
      limit: ds.length * 4
    });
  }
  return filters;
}
function cleanupFilter(authors, addresses) {
  const a = authors.slice().sort(compareCodePoints);
  const addr = addresses.slice().sort(compareCodePoints);
  if (!a.length && !addr.length) return null;
  return {
    kinds: [POLICY.DELETION_KIND],
    limit: POLICY.CLEANUP_LIMIT,
    ...a.length ? { authors: a } : {},
    ...addr.length ? { "#a": addr } : {}
  };
}

// src/data/load.ts
function reportRound(r) {
  return {
    label: r.label,
    logicalReqs: r.logicalReqs,
    physicalReqs: r.physicalReqs,
    chunks: r.chunks,
    filters: r.filters,
    reason: r.reason,
    coverage: r.coverage
  };
}
async function loadCatalog(opts) {
  const relays = Array.isArray(opts?.relays) && opts.relays.length ? opts.relays.slice() : POLICY.DEFAULT_RELAYS.slice();
  const topics = Array.isArray(opts?.topics) && opts.topics.length ? opts.topics.slice() : POLICY.DISCOVERY_TOPICS.slice();
  const useCache = opts?.useCache !== false;
  const nowMs = Number.isFinite(opts?.nowMs) ? opts?.nowMs : Date.now();
  const nowSec = Math.floor(nowMs / 1e3);
  const timeoutMs = Number.isFinite(opts?.timeoutMs) ? opts?.timeoutMs : POLICY.REQ_TIMEOUT_MS;
  const base = stats.snapshot();
  const delta = () => stats.since(base);
  const diagnostics = [];
  diagnostics.push("nip11-assumed");
  if (opts?.tier2 === true || POLICY.GRAPH_TIER2_ENABLED) {
    diagnostics.push("tier2-not-implemented");
  }
  const rounds = [];
  let ctx = null;
  try {
    let viewerPubkey = null;
    let viewerSource = "none";
    const pasted = opts?.viewerPubkey ?? opts?.viewerNpub;
    if (pasted) {
      viewerPubkey = decodeNpub(pasted);
      if (viewerPubkey) viewerSource = "pasted";
      else diagnostics.push("viewer-key-unparsable");
    }
    if (!viewerPubkey && opts?.useNip07 === true) {
      try {
        const signer = typeof window !== "undefined" ? window.nostr : void 0;
        if (signer && typeof signer.getPublicKey === "function") {
          const key = await signer.getPublicKey();
          viewerPubkey = decodeNpub(key);
          if (viewerPubkey) viewerSource = "nip07";
          else diagnostics.push("nip07-key-unparsable");
        } else {
          diagnostics.push("nip07-unavailable");
        }
      } catch {
        diagnostics.push("nip07-refused");
      }
    }
    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) diagnostics.push("relay-layer-unavailable");
    const r1Filters = [{
      kinds: [POLICY.SOFTWARE_KIND],
      "#t": topics.slice().sort(compareCodePoints),
      limit: POLICY.DISCOVERY_LIMIT_PER_RELAY
    }];
    if (viewerPubkey) {
      r1Filters.push({ kinds: [POLICY.FOLLOW_KIND], authors: [viewerPubkey], limit: 1 });
    }
    const r1 = await fetchRound(ctx, r1Filters, "r1");
    rounds.push(r1);
    const r1Events = r1.events.map((p) => p.event);
    const discoveredSoftware = r1Events.filter((e) => e && e.kind === POLICY.SOFTWARE_KIND);
    if (discoveredSoftware.length >= POLICY.DISCOVERY_LIMIT_PER_RELAY) {
      diagnostics.push("discovery-cap");
    }
    const graph = deriveGraph({ viewerPubkey, events: r1Events, nowSec });
    const manualCounted = [];
    const manualInput = Array.isArray(opts?.manualCounted) ? opts.manualCounted : [];
    for (const raw of manualInput) {
      const key = decodeNpub(raw);
      if (key && manualCounted.indexOf(key) === -1) manualCounted.push(key);
    }
    const countedPubkeys = graph.pubkeys.slice();
    for (const key of manualCounted) {
      if (countedPubkeys.indexOf(key) === -1) countedPubkeys.push(key);
    }
    let r2 = skippedRound("r2", relays);
    if (countedPubkeys.length) {
      r2 = await fetchRound(ctx, [{
        kinds: [POLICY.CURATION_KIND],
        authors: countedPubkeys.slice().sort(compareCodePoints),
        limit: POLICY.GRAPH_MAX_FOLLOWS
      }], "r2");
    }
    rounds.push(r2);
    const r2Events = r2.events.map((p) => p.event);
    const curationForRecall = curationMembership({
      events: r2Events,
      pubkeys: countedPubkeys,
      nowSec,
      receivedAtSec: nowSec
    });
    const observedInR1 = /* @__PURE__ */ new Set();
    for (const e of discoveredSoftware) {
      observedInR1.add(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
    }
    const missing2 = curationForRecall.learned.filter((coord) => !observedInR1.has(coord));
    const cleanupAuthors = [];
    const cleanupAddresses = [];
    const noteAuthor = (pubkey) => {
      if (isLowercaseHex64(pubkey) && cleanupAuthors.indexOf(pubkey) === -1) {
        cleanupAuthors.push(pubkey);
      }
    };
    const noteAddress = (coord) => {
      if (coord && cleanupAddresses.indexOf(coord) === -1) cleanupAddresses.push(coord);
    };
    for (const e of discoveredSoftware) {
      noteAuthor(e.pubkey);
      noteAddress(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
    }
    for (const coord of missing2) {
      const m = COORD_RE.exec(coord);
      const author = m?.[1];
      if (author !== void 0) noteAuthor(author);
      noteAddress(coord);
    }
    for (const e of r2Events) {
      if (!e || e.kind !== POLICY.CURATION_KIND) continue;
      noteAuthor(e.pubkey);
      noteAddress(coordinateOf(POLICY.CURATION_KIND, e.pubkey, getDtag(e.tags)));
    }
    if (viewerPubkey) noteAuthor(viewerPubkey);
    const r3Filters = groupByAuthor(missing2);
    const cleanup = cleanupFilter(cleanupAuthors, cleanupAddresses);
    if (cleanup) r3Filters.push(cleanup);
    let r3 = skippedRound("r3", relays);
    if (r3Filters.length) r3 = await fetchRound(ctx, r3Filters, "r3");
    rounds.push(r3);
    const observed = r1.events.concat(r2.events, r3.events);
    const receipts = {};
    const sources = {};
    const events = [];
    for (const packet of observed) {
      const e = packet.event;
      if (!e || typeof e.id !== "string") continue;
      if (!receipts[e.id]) {
        receipts[e.id] = { receivedAtSec: nowSec, cached: false };
        events.push(e);
      }
      const bucket = sources[e.id] ?? (sources[e.id] = []);
      if (packet.from && bucket.indexOf(packet.from) === -1) bucket.push(packet.from);
    }
    if (useCache) {
      let cached = [];
      try {
        cached = await cache.getAll();
      } catch {
        cached = [];
      }
      for (const rec of cached) {
        if (!rec || !rec.event || typeof rec.event.id !== "string") continue;
        if (receipts[rec.event.id]) continue;
        if (!isFresh(rec, nowMs)) continue;
        const receivedAtSec = rec.receivedAtSec;
        receipts[rec.event.id] = {
          receivedAtSec: Number.isFinite(receivedAtSec) ? receivedAtSec : nowSec,
          cached: true
        };
        events.push(rec.event);
        stats.logCache("reuse:" + rec.coordinate);
      }
    }
    const coverage = {};
    mergeCoverage(coverage, r1);
    mergeCoverage(coverage, r2);
    mergeCoverage(coverage, r3);
    const result = buildCatalog({
      events,
      receipts,
      sources,
      coverage,
      viewerPubkey,
      ...opts?.manualCounted === void 0 ? {} : { manualCounted: opts.manualCounted },
      topics,
      nowMs,
      nowSec,
      diagnostics
    });
    if (useCache) {
      for (const entry of result.entries) {
        const receipt = entry.eventId === null ? void 0 : receipts[entry.eventId];
        if (!receipt || receipt.cached) continue;
        const winner = events.find((e) => e.id === entry.eventId);
        if (!winner) continue;
        try {
          await cache.putRecord({
            coordinate: entry.coordinate,
            event: winner,
            verifiedAt: nowMs
          });
        } catch {
        }
      }
    }
    return {
      ...result,
      viewerSource,
      rounds: rounds.map(reportRound),
      stats: delta()
    };
  } catch {
    diagnostics.push("load-error");
    return {
      status: "unavailable",
      entries: [],
      graph: {
        state: "none",
        pubkeys: [],
        coverage: "unknown",
        followsUsed: 0,
        followsTotal: 0,
        truncated: false,
        malformedPTags: 0,
        viewerPubkey: null,
        followListId: null,
        followListCreatedAt: null
      },
      curation: { counted: [], curators: [], manual: [] },
      quarantined: [],
      unresolved: [],
      deletions: { accepted: 0, rejected: 0 },
      coverage: emptyCoverage(relays, "error", Date.now()),
      topics,
      asOf: nowMs,
      diagnostics,
      rounds: rounds.map((r) => ({
        label: r.label,
        logicalReqs: r.logicalReqs,
        physicalReqs: r.physicalReqs,
        chunks: r.chunks,
        reason: r.reason
      })),
      viewerSource: "none",
      stats: delta()
    };
  } finally {
    const rx = ctx?.rxNostr;
    if (rx && typeof rx.dispose === "function") {
      try {
        rx.dispose();
      } catch {
      }
    }
  }
}

// src/data/publish.ts
function buildSoftwareDraft(input) {
  const nfc = (value) => typeof value === "string" ? value.normalize("NFC") : "";
  const local = nfc(input?.dLocal).trim();
  const name = nfc(input?.name).trim();
  const summary = nfc(input?.summary);
  const homepage = nfc(input?.homepage).trim();
  const state = input?.state === "withdrawn" ? "withdrawn" : "active";
  const topics = [];
  const supplied = Array.isArray(input?.topics) ? input.topics : [];
  for (const raw of supplied) {
    const topic = nfc(raw).trim().toLowerCase();
    if (!topic || topic === DISCOVERY_TOPIC) continue;
    if (topics.indexOf(topic) === -1) topics.push(topic);
  }
  topics.sort(compareCodePoints);
  const tags = [["d", SOFTWARE_D_PREFIX + local], ["t", DISCOVERY_TOPIC]];
  for (const topic of topics) tags.push(["t", topic]);
  const content = {
    schema: SOFTWARE_SCHEMA,
    version: 1,
    state,
    name,
    summary
  };
  if (homepage) content["homepage"] = homepage;
  return {
    kind: POLICY.SOFTWARE_KIND,
    pubkey: typeof input?.pubkey === "string" ? input.pubkey : "",
    created_at: Number.isSafeInteger(input?.createdAt) ? input?.createdAt : Math.floor(Date.now() / 1e3),
    tags,
    content: JSON.stringify(content)
  };
}
function checkSignedEvent(draft, signed, expectedPubkey) {
  if (!signed || typeof signed !== "object") return "signer-missing-fields";
  const ev = signed;
  if (!isLowercaseHex64(ev.id) || !isLowercaseHex64(ev.pubkey)) return "signer-missing-fields";
  if (typeof ev.sig !== "string" || !/^[0-9a-f]{128}$/.test(ev.sig)) return "signer-missing-fields";
  if (ev.pubkey !== expectedPubkey) return "signer-wrong-pubkey";
  const shape = (event) => ({
    kind: event.kind,
    created_at: event.created_at,
    tags: event.tags,
    content: event.content
  });
  let ours;
  let theirs;
  try {
    ours = canonicalize(shape(draft));
    theirs = canonicalize(shape(ev));
  } catch {
    return "signer-mutated-event";
  }
  if (!bytesEqual(ours, theirs)) return "signer-mutated-event";
  return null;
}
function normalizeRelayUrl2(url) {
  return String(url ?? "").trim().toLowerCase().replace(/\/+$/, "");
}
function sendEvent(ctx, signed, relays, timeoutMs) {
  return new Promise((resolve) => {
    const outcomes = {};
    for (const relay of relays) outcomes[relay] = { outcome: "timeout", notice: "" };
    let settled = false;
    let sub = null;
    const timer2 = setTimeout(() => finish(), timeoutMs);
    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer2);
      if (sub && typeof sub.unsubscribe === "function") {
        try {
          sub.unsubscribe();
        } catch {
        }
      }
      resolve(outcomes);
    }
    function record(packet) {
      if (!packet || typeof packet !== "object") return;
      const p = packet;
      const from2 = typeof p.from === "string" ? p.from : "";
      let key = from2 in outcomes ? from2 : null;
      if (!key) {
        for (const relay of relays) {
          if (normalizeRelayUrl2(relay) === normalizeRelayUrl2(from2)) {
            key = relay;
            break;
          }
        }
      }
      if (!key) return;
      const notice = typeof p.notice === "string" ? p.notice : "";
      outcomes[key] = { outcome: p.ok === true ? "accepted" : "rejected", notice };
    }
    const rx = ctx.rxNostr;
    const send = rx?.send;
    if (!rx || typeof send !== "function") {
      for (const relay of relays) outcomes[relay] = { outcome: "connection-failed", notice: "" };
      finish();
      return;
    }
    try {
      const stream = send.call(rx, signed, {
        on: { relays },
        completeOn: "all-ok",
        errorOnTimeout: false
      });
      sub = stream.subscribe({
        next: record,
        /* A socket that never opened is `connection-failed`, which is
           undetermined-leaning-negative and, crucially, not "the relay
           rejected the content". */
        error: () => {
          for (const relay of relays) {
            if (outcomes[relay]?.outcome === "timeout") {
              outcomes[relay] = { outcome: "connection-failed", notice: "" };
            }
          }
          finish();
        },
        complete: () => finish()
      });
    } catch {
      for (const relay of relays) outcomes[relay] = { outcome: "connection-failed", notice: "" };
      finish();
    }
  });
}
async function readBackOnce(ctx, signed, d) {
  const filters = [
    { kinds: [POLICY.SOFTWARE_KIND], authors: [signed.pubkey], "#d": [d], limit: 8 },
    { kinds: [POLICY.SOFTWARE_KIND], authors: [signed.pubkey], "#t": [DISCOVERY_TOPIC], limit: 16 }
  ];
  const round = await fetchRound(ctx, filters, "publish-readback");
  const events = round.events.map((item) => item.event);
  const mine = events.find((event) => event && event.id === signed.id) ?? null;
  const statuses = Object.keys(round.coverage).map((url) => round.coverage[url]?.status);
  const anyComplete = statuses.indexOf("eose") !== -1;
  if (!mine) {
    return {
      state: anyComplete ? "not-returned-yet" : "query-failed",
      round,
      event: null,
      tIndex: "not-returned"
    };
  }
  const check = validateSoftwareEvent(mine, { receivedAtSec: Math.floor(Date.now() / 1e3) });
  if (!check.ok) {
    return {
      state: "readback-quarantined",
      reason: check.reason,
      round,
      event: mine,
      tIndex: "not-returned"
    };
  }
  const selection = selectSoftwareWinners(events, {});
  const winner = selection.winners.find((entry) => entry.coordinate === check.record.coordinate);
  const winnerId = winner?.event.id ?? null;
  if (winnerId && winnerId !== signed.id) {
    return { state: "superseded-during-publish", round, event: mine, winnerId, tIndex: "returned" };
  }
  return { state: "returned", round, event: mine, tIndex: "returned" };
}
function delay2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function publishSoftwareRecord(opts) {
  const relays = (Array.isArray(opts?.relays) && opts.relays.length ? opts.relays : POLICY.DEFAULT_RELAYS).slice();
  const timeoutMs = Number.isFinite(opts?.timeoutMs) ? opts?.timeoutMs : POLICY.REQ_TIMEOUT_MS;
  const publishTimeoutMs = Number.isFinite(opts?.publishTimeoutMs) ? opts?.publishTimeoutMs : WRITE.PUBLISH_TIMEOUT_MS;
  const attempts = Number.isFinite(opts?.readbackAttempts) ? opts?.readbackAttempts : WRITE.READBACK_ATTEMPTS;
  const backoff2 = Array.isArray(opts?.readbackBackoffMs) ? opts.readbackBackoffMs : WRITE.READBACK_BACKOFF_MS;
  const signer = opts?.signer ?? (typeof window !== "undefined" ? window.nostr : null);
  const nowSec = Number.isSafeInteger(opts?.nowSec) ? opts?.nowSec : Math.floor(Date.now() / 1e3);
  const failWith = (state, reason) => ({
    state,
    reason,
    eventId: null,
    coordinate: null,
    event: null,
    relays: relays.map((url) => ({ url, outcome: "not-attempted", notice: "" })),
    readback: null,
    attempts: 0,
    asOf: Date.now()
  });
  if (!signer || typeof signer.signEvent !== "function" || typeof signer.getPublicKey !== "function") {
    return failWith("blocked", "signer-absent");
  }
  let pubkey = null;
  try {
    pubkey = decodeNpub(await signer.getPublicKey());
  } catch {
    return failWith("blocked", "signer-rejected");
  }
  if (!pubkey) return failWith("blocked", "nip07-key-unparsable");
  if (opts?.expectPubkey && opts.expectPubkey !== pubkey) {
    return failWith("blocked", "pubkey-mismatch");
  }
  const draft = buildSoftwareDraft({ ...opts?.draft, pubkey, createdAt: nowSec });
  const preflight = validateSoftwareEvent(draft, { receivedAtSec: nowSec });
  if (!preflight.ok) return failWith("invalid", preflight.reason);
  const d = preflight.record.d;
  let signed = null;
  try {
    signed = await signer.signEvent(draft);
  } catch {
    return failWith("blocked", "signer-rejected");
  }
  const signerProblem = checkSignedEvent(draft, signed, pubkey);
  if (signerProblem) return failWith("blocked", signerProblem);
  const postflight = validateSoftwareEvent(signed, { receivedAtSec: nowSec });
  if (!postflight.ok) return failWith("blocked", "signer-invalid-record");
  const coordinate = postflight.record.coordinate;
  const signedEvent = signed;
  let ctx = null;
  try {
    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) {
      return {
        state: "failed",
        reason: "relay-unavailable",
        eventId: signedEvent.id ?? null,
        coordinate,
        event: signedEvent,
        relays: relays.map((url) => ({ url, outcome: "connection-failed", notice: "" })),
        readback: null,
        attempts: 0,
        asOf: Date.now()
      };
    }
    const outcomes = await sendEvent(ctx, signedEvent, relays, publishTimeoutMs);
    const perRelay = relays.map((url) => ({
      url,
      outcome: outcomes[url]?.outcome ?? "connection-failed",
      notice: outcomes[url]?.notice ?? ""
    }));
    const accepted = perRelay.filter((entry) => entry.outcome === "accepted").length;
    const undetermined = perRelay.filter(
      (entry) => entry.outcome === "timeout" || entry.outcome === "connection-failed"
    ).length;
    if (accepted === 0 && undetermined === 0) {
      return {
        state: "failed",
        reason: "all-relays-rejected",
        eventId: signedEvent.id ?? null,
        coordinate,
        event: signedEvent,
        relays: perRelay,
        readback: null,
        attempts: 0,
        asOf: Date.now()
      };
    }
    let readback = null;
    let used = 0;
    for (let i = 0; i < attempts; i += 1) {
      const wait = Number.isFinite(backoff2[i]) ? backoff2[i] : 0;
      if (wait > 0) await delay2(wait);
      used = i + 1;
      readback = await readBackOnce(ctx, signedEvent, d);
      if (readback.state === "returned" || readback.state === "superseded-during-publish" || readback.state === "readback-quarantined") break;
    }
    let state;
    if (readback && readback.state === "returned") {
      state = accepted === relays.length ? "published" : "published-partial";
    } else if (readback && readback.state === "superseded-during-publish") {
      state = "superseded-during-publish";
    } else if (readback && readback.state === "readback-quarantined") {
      state = "readback-quarantined";
    } else {
      state = "unconfirmed";
    }
    return {
      state,
      reason: readback ? readback.reason ?? readback.state : "no-readback",
      eventId: signedEvent.id ?? null,
      coordinate,
      event: signedEvent,
      relays: perRelay,
      accepted,
      readback: readback ? { state: readback.state, tIndex: readback.tIndex, winnerId: readback.winnerId ?? null } : null,
      attempts: used,
      asOf: Date.now()
    };
  } catch {
    return {
      state: "failed",
      reason: "publish-error",
      eventId: signedEvent.id ?? null,
      coordinate,
      event: signedEvent,
      relays: relays.map((url) => ({ url, outcome: "connection-failed", notice: "" })),
      readback: null,
      attempts: 0,
      asOf: Date.now()
    };
  } finally {
    const rx = ctx?.rxNostr;
    if (rx && typeof rx.dispose === "function") {
      try {
        rx.dispose();
      } catch {
      }
    }
  }
}

// src/ui/i18n.ts
var dictionaries = {
  ja: {
    localeName: "\u65E5\u672C\u8A9E",
    otherLocale: "English",
    language: "\u8A00\u8A9E",
    skip: "\u672C\u6587\u3078\u30B9\u30AD\u30C3\u30D7",
    close: "\u9589\u3058\u308B",
    all: "\u3059\u3079\u3066",
    none: "\u306A\u3057",
    unknown: "\u4E0D\u660E",
    optional: "\u4EFB\u610F",
    reset: "\u6761\u4EF6\u3092\u30EA\u30BB\u30C3\u30C8",
    remove: "\u5916\u3059",
    add: "\u8FFD\u52A0",
    replace: "\u5165\u308C\u66FF\u3048",
    title: "nosmaps \u2014 Nostr\u30C4\u30FC\u30EB\u3092\u898B\u3064\u3051\u308B",
    description: "\u76EE\u7684\u30FB\u30AB\u30C6\u30B4\u30EA\u30FB\u6A5F\u80FD\u304B\u3089Nostr\u5468\u8FBA\u30C4\u30FC\u30EB\u3092\u63A2\u3057\u3066\u6BD4\u8F03\u3067\u304D\u307E\u3059\u3002",
    footer: { source: "GitHub\u3067\u30BD\u30FC\u30B9\u30B3\u30FC\u30C9\u3092\u898B\u308B", sourceNewTab: "GitHub\u3067\u30BD\u30FC\u30B9\u30B3\u30FC\u30C9\u3092\u898B\u308B\uFF08\u65B0\u3057\u3044\u30BF\u30D6\u3067\u958B\u304D\u307E\u3059\uFF09" },
    categories: {
      clients: { name: "\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8", icon: "smartphone", description: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u3084\u6295\u7A3F\u3092\u6271\u3046\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3002" },
      relay: { name: "\u30EA\u30EC\u30FC\u904B\u7528", icon: "dns", description: "\u30EA\u30EC\u30FC\u306E\u8A2D\u5B9A\u3084\u63A5\u7D9A\u72B6\u6CC1\u3092\u78BA\u8A8D\u3059\u308B\u904B\u7528\u30C4\u30FC\u30EB\u3002" },
      identity: { name: "ID\u30FB\u9375\u7BA1\u7406", icon: "key", description: "\u9375\u3068\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3092\u7BA1\u7406\u3059\u308B\u88DC\u52A9\u30C4\u30FC\u30EB\u3002" },
      media: { name: "\u753B\u50CF\u30FB\u52D5\u753B", icon: "movie", description: "\u4F5C\u54C1\u3084\u30E1\u30C7\u30A3\u30A2\u3092\u516C\u958B\u3059\u308B\u5236\u4F5C\u30C4\u30FC\u30EB\u3002" },
      analytics: { name: "\u89B3\u6E2C\u30FB\u5206\u6790", icon: "analytics", description: "\u30A4\u30D9\u30F3\u30C8\u3084\u63A5\u7D9A\u50BE\u5411\u3092\u53EF\u8996\u5316\u3059\u308B\u89B3\u6E2C\u30C4\u30FC\u30EB\u3002" },
      dev: { name: "\u958B\u767A\u8005\u5411\u3051", icon: "code", description: "NIP\u3084\u30A4\u30D9\u30F3\u30C8\u3092\u78BA\u8A8D\u3059\u308B\u958B\u767A\u30C4\u30FC\u30EB\u3002" },
      /* §21.6 R6: 41件のうち4件が発行者自身の言葉で「ウォレット」と名乗ったので seed に加えた唯一の語。 */
      wallet: { name: "\u30A6\u30A9\u30EC\u30C3\u30C8", icon: "wallet", description: "Bitcoin\u30FBLightning\u306E\u30A6\u30A9\u30EC\u30C3\u30C8\u3002" }
    },
    statuses: { active: "\u7A3C\u50CD\u4E2D", stale: "\u66F4\u65B0\u505C\u6EDE", dead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD", unknown: "\u4E0D\u660E" },
    /* §21.4 R4: レコードの状態（active / withdrawn）は「プロジェクトが生きているか」ではない。 */
    recordStates: { active: "\u516C\u958B\u4E2D\uFF08active\uFF09", withdrawn: "\u53D6\u308A\u4E0B\u3052\u6E08\u307F\uFF08withdrawn\uFF09" },
    liveness: { unknown: "\u4E0D\u660E", reachable: "\u5230\u9054\u53EF\u80FD", unreachable: "\u5230\u9054\u4E0D\u80FD", archived: "\u30A2\u30FC\u30AB\u30A4\u30D6\u6E08\u307F", moved: "\u79FB\u8EE2", superseded: "\u5F8C\u7D99\u3042\u308A" },
    /* §21.7 R7: 実データが持っていた8値。unknown は否定ではなく「一次情報が何も言っていない」。 */
    support: {
      supported: "\u5BFE\u5FDC",
      partial: "\u90E8\u5206\u5BFE\u5FDC",
      not_supported: "\u975E\u5BFE\u5FDC\uFF08\u660E\u793A\uFF09",
      not_applicable: "\u5BFE\u8C61\u5916",
      planned: "\u4E88\u5B9A",
      disabled: "\u5B9F\u88C5\u6E08\u307F\u30FB\u7121\u52B9",
      withdrawn: "\u5BFE\u5FDC\u53D6\u308A\u3084\u3081",
      unknown: "\u4E0D\u660E\uFF08\u4E3B\u5F35\u306A\u3057\uFF09",
      out_of_family: "\u5225\u306E\u4ED5\u69D8\u30D5\u30A1\u30DF\u30EA"
    },
    evidence: {
      supported: "\u4E00\u6B21\u60C5\u5831\u304C\u7121\u6761\u4EF6\u306B\u5BFE\u5FDC\u3092\u4E3B\u5F35\u3057\u3066\u3044\u307E\u3059\u3002",
      partial: "\u4E00\u6B21\u60C5\u5831\u304C\u5236\u9650\u3064\u304D\u3067\u5BFE\u5FDC\u3092\u4E3B\u5F35\u3057\u3066\u3044\u307E\u3059\u3002",
      not_supported: "\u4E00\u6B21\u60C5\u5831\u304C\u300C\u5BFE\u5FDC\u3057\u306A\u3044\u300D\u3068\u660E\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u6C88\u9ED9\u3088\u308A\u3082\u5F37\u3044\u8A00\u660E\u3067\u3059\u3002",
      not_applicable: "\u4E00\u6B21\u60C5\u5831\u304C\u300C\u3053\u306E\u4ED5\u69D8\u306F\u5F53\u3066\u306F\u307E\u3089\u306A\u3044\u300D\u3068\u8FF0\u3079\u3066\u3044\u307E\u3059\u3002\u5206\u6BCD\u306B\u306F\u6570\u3048\u307E\u305B\u3093\u3002",
      planned: "\u4E00\u6B21\u60C5\u5831\u304C\u4E88\u5B9A\u3068\u3057\u3066\u6319\u3052\u3066\u3044\u307E\u3059\u3002\u73FE\u6642\u70B9\u306E\u5B9F\u88C5\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      disabled: "\u5B9F\u88C5\u6E08\u307F\u3067\u3001\u65E2\u5B9A\u3067\u306F\u7121\u52B9\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002",
      withdrawn: "\u304B\u3064\u3066\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3057\u305F\u304C\u53D6\u308A\u4E0B\u3052\u3089\u308C\u307E\u3057\u305F\u3002",
      unknown: "\u4E00\u6B21\u60C5\u5831\u306F\u4F55\u3082\u8FF0\u3079\u3066\u3044\u307E\u305B\u3093\u3002\u975E\u5BFE\u5FDC\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      out_of_family: "\u4E3B\u5F35\u306F\u5225\u306E\u4ED5\u69D8\u30D5\u30A1\u30DF\u30EA\u306B\u3042\u308A\u307E\u3059\u3002NIP\u306E\u4E3B\u5F35\u306F\u8A18\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"
    },
    /* §21.2.3: id をピン留めしたスナップショットに照合した結果。落とさず、書き換えず、そのまま出す。 */
    registryStatus: { resolved: "\u30EC\u30B8\u30B9\u30C8\u30EA\u3067\u89E3\u6C7A", not_in_registry: "\u30EC\u30B8\u30B9\u30C8\u30EA\u306B\u7121\u3044", unresolvable: "\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u7121\u3057" },
    /* §21.1 R1: 主張の出どころ。転記は「そのプロジェクトが言った」ではなく「署名者が書き写した」。 */
    basis: { transcribed: "\u8EE2\u8A18\uFF08\u7F72\u540D\u8005\u304C\u8AAD\u3093\u3060\u6587\u66F8\u306E\u5199\u3057\uFF09", self_declared: "\u81EA\u5DF1\u7533\u544A", tested: "\u5B9F\u884C\u3057\u3066\u691C\u8A3C" },
    observers: { crawler: "Nosmaps\u89B3\u6E2C", community: "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u30EC\u30D3\u30E5\u30FC", maintainer: "\u30E1\u30F3\u30C6\u30CA\u30FC\u7533\u544A" },
    landing: {
      headline: "Nostr\u306E\u5730\u56F3\u3001\u3053\u3053\u306B\u3042\u308A\u307E\u3059\uFF01",
      lead: "\u76EE\u7684\u3084\u6A5F\u80FD\u304B\u3089\u3001Nostr\u306E\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u3092\u63A2\u3057\u3066\u6BD4\u3079\u3089\u308C\u307E\u3059\u3002",
      carouselTitle: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9",
      carouselLabel: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u306E\u7D39\u4ECB",
      slideLabel: "{name}\uFF08{index}\uFF0F{total}\uFF09",
      openEntry: "{name} \u306E\u8A73\u7D30\u3092\u958B\u304F",
      position: "{index} / {total}",
      previous: "\u524D\u306E\u9805\u76EE",
      next: "\u6B21\u306E\u9805\u76EE",
      category: "\u30AB\u30C6\u30B4\u30EA",
      platform: "\u5BFE\u5FDC\u74B0\u5883",
      explorerCta: "\u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      explorerHelp: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u3092\u6A5F\u80FD\u3067\u7D5E\u308A\u8FBC\u307F\u3001NIP\u306E\u6839\u62E0\u307E\u3067\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002"
    },
    explorer: {
      pageTitle: "Nosmaps \u2014 \u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      pageDescription: "\u6A5F\u80FD\u304B\u3089Nostr\u30C4\u30FC\u30EB\u5019\u88DC\u3092\u63A2\u3057\u3001NIP\u306E\u6839\u62E0\u3068\u6A5F\u80FD\u5DEE\u3092\u6BD4\u8F03\u3067\u304D\u307E\u3059\u3002",
      location: "\u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      back: "\u30C8\u30C3\u30D7\u30DA\u30FC\u30B8\u3078\u623B\u308B",
      search: "\u30A2\u30D7\u30EA\uFF0F\u30B5\u30FC\u30D3\u30B9\u3092\u5168\u6587\u691C\u7D22",
      searchPlaceholder: "\u540D\u79F0\u30FB\u6982\u8981\u30FB\u30AB\u30C6\u30B4\u30EA\u30FBOS\u30FB\u63D0\u4F9B\u5F62\u614B\u30FB\u5225\u540D",
      featureGroup: "\u4E3B\u8981\u6A5F\u80FD\uFF08\u8907\u6570\u9078\u629E\u30FBAND\u6761\u4EF6\uFF09",
      categoryGroup: "\u30AB\u30C6\u30B4\u30EA\u3067\u7D5E\u308A\u8FBC\u3080",
      allCategoriesDescription: "\u3059\u3079\u3066\u306E\u30AB\u30C6\u30B4\u30EA\u304B\u3089\u63A2\u3057\u307E\u3059\u3002",
      candidates: "\u5019\u88DC",
      noFeature: "\u6A5F\u80FD\u306F\u672A\u9078\u629E\uFF1A\u3059\u3079\u3066\u306E\u5019\u88DC\u3092\u8868\u793A",
      featureAnd: "\u6A5F\u80FD\u6761\u4EF6\uFF08\u3059\u3079\u3066AND\uFF09",
      viewNips: "NIP\u3092\u898B\u308B",
      activeAnd: "\u6709\u52B9\u306A\u6761\u4EF6\uFF08\u3059\u3079\u3066AND\uFF09",
      noExtra: "\u8FFD\u52A0\u6761\u4EF6\u306A\u3057",
      settings: "\u8A73\u7D30\u8A2D\u5B9A",
      platform: "OS\uFF0F\u74B0\u5883",
      updateStatus: "\u66F4\u65B0\u72B6\u614B",
      activeStatus: "\u7A3C\u50CD\u30FB\u505C\u6EDE\u30FB\u4E0D\u660E",
      support: "\u6A5F\u80FD\u5BFE\u5FDC",
      featureNeeded: "\u6A5F\u80FD\u30921\u3064\u4EE5\u4E0A\u9078\u3076\u3068\u4F7F\u3048\u307E\u3059\u3002",
      delivery: "\u63D0\u4F9B\u5F62\u614B",
      webApp: "Web\u30A2\u30D7\u30EA",
      installed: "\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u578B",
      mobileApp: "\u30E2\u30D0\u30A4\u30EB\u30A2\u30D7\u30EA",
      oss: "OSS",
      includeDead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u3082\u542B\u3081\u308B",
      savedOnly: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F\u3060\u3051",
      nipSearch: "NIP\u756A\u53F7\u30FB\u540D\u79F0",
      supportModes: { all: "\u3059\u3079\u3066\uFF08\u4E0D\u660E\u3082\u542B\u3080\uFF09", confirmed: "\u5BFE\u5FDC\u30FB\u90E8\u5206\u5BFE\u5FDC\u306E\u307F" },
      supportModeHelp: "\u65E2\u5B9A\u306F\u300C\u5BFE\u5FDC\u30FB\u90E8\u5206\u5BFE\u5FDC\u306E\u307F\u300D\u3067\u3059\u3002\u4E3B\u5F35\u304C\u7121\u3044\u3082\u306E\uFF08\u4E0D\u660E\uFF09\u306F\u65E2\u5B9A\u3067\u306F\u51FA\u307E\u305B\u3093\u3002",
      unstatedSetAside: "\u9078\u3093\u3060\u6A5F\u80FD\u306B\u3064\u3044\u3066\u4E00\u6B21\u60C5\u5831\u304C\u4F55\u3082\u8FF0\u3079\u3066\u3044\u306A\u3044\u30A8\u30F3\u30C8\u30EA\u304C{count}\u4EF6\u3042\u308A\u307E\u3059\u3002\u975E\u5BFE\u5FDC\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      showUnstated: "\u4E0D\u660E\u3082\u542B\u3081\u3066\u8868\u793A",
      unknownInfo: "\u300C\u4E0D\u660E\u300D\u306B\u3064\u3044\u3066",
      unknownHelp: "\u6750\u6599\u4E0D\u8DB3\u3067\u5224\u5B9A\u3092\u4FDD\u7559\u3057\u305F\u72B6\u614B\u3067\u3059\u3002\u975E\u5BFE\u5FDC\u3092\u610F\u5473\u3057\u307E\u305B\u3093\u3002\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u306F\u9078\u3093\u3060\u5834\u5408\u3060\u3051\u8868\u793A\u3057\u307E\u3059\u3002",
      selectedCount: "{count}\u4EF6\u3092\u9078\u629E\uFF08\u6700\u59273\u4EF6\uFF09",
      compareByFeature: "\u6A5F\u80FD\u3067\u6BD4\u8F03",
      clearSelection: "\u9078\u629E\u89E3\u9664",
      evidenceTitle: "\u6280\u8853\u7684\u306A\u88CF\u4ED8\u3051",
      primarySource: "\u516C\u5F0FNIP\u4E00\u6B21\u8CC7\u6599",
      chooseForNips: "\u6A5F\u80FD\u3092\u9078\u3076\u3068\u3001\u95A2\u9023\u3059\u308BNIP\u306E\u4E00\u6B21\u8CC7\u6599\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
      facts: "\u4E8B\u5B9F\u30FB\u89B3\u6E2C",
      evaluations: "\u5229\u7528\u8005\u8A55\u4FA1",
      noFeatureCondition: "\u6A5F\u80FD\u6761\u4EF6\u306A\u3057",
      category: "\u30AB\u30C6\u30B4\u30EA",
      observed: "\u6700\u7D42\u89B3\u6E2C",
      officialLinks: "{name}\u306E\u516C\u5F0F\u60C5\u5831",
      site: "\u516C\u5F0F\u30B5\u30A4\u30C8",
      distribution: "\u30A2\u30D7\u30EA\u914D\u5E03",
      docs: "\u516C\u5F0FDocs",
      source: "\u30BD\u30FC\u30B9",
      linkDetails: "{type}\u306E\u60C5\u5831",
      displayUrl: "URL",
      opensInNewTab: "\u65B0\u3057\u3044\u30BF\u30D6\u3067\u958B\u304D\u307E\u3059",
      checkedAt: "\u6700\u7D42\u78BA\u8A8D\u65E5\u6642",
      like: "\u3044\u3044\u306D {count}",
      bookmark: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF",
      bookmarked: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F",
      reviews: "\u30EC\u30D3\u30E5\u30FC {count}",
      privateDefault: "\u975E\u516C\u958B",
      public: "\u516C\u958B",
      publicToggle: "\u516C\u958B\u306B\u3059\u308B",
      endedRecord: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u306E\u8A18\u9332\u3002",
      alternatives: "\u540C\u3058\u6A5F\u80FD\u306E\u7A3C\u50CD\u5019\u88DC\u3078\u623B\u308B",
      compareAdd: "\u6BD4\u8F03\u306B\u8FFD\u52A0",
      details: "\u8A73\u7D30\u30FB\u6839\u62E0",
      count: "{count}\u4EF6",
      noMatch: "\u6761\u4EF6\u306B\u5408\u3046\u5019\u88DC\u304C\u3042\u308A\u307E\u305B\u3093",
      noMatchHelp: "\u4E0A\u306E\u6761\u4EF6\u30921\u4EF6\u305A\u3064\u5916\u3057\u3066\u5E83\u3052\u3089\u308C\u307E\u3059\u3002",
      removeGets: "\u300C{label}\u300D\u3092\u5916\u3059\u3068 {count}\u4EF6",
      resetAll: "\u3059\u3079\u3066\u306E\u6761\u4EF6\u3092\u30EA\u30BB\u30C3\u30C8",
      conditionFeature: "\u6A5F\u80FD\u300C{value}\u300D",
      conditionQuery: "\u5168\u6587\u691C\u7D22\u300C{value}\u300D",
      conditionPlatform: "OS\uFF0F\u74B0\u5883\u300C{value}\u300D",
      conditionCategory: "\u30AB\u30C6\u30B4\u30EA\u300C{value}\u300D",
      conditionStatus: "\u66F4\u65B0\u72B6\u614B\u300C{value}\u300D",
      conditionSupport: "\u6A5F\u80FD\u5BFE\u5FDC\u300C{value}\u300D",
      conditionDelivery: "\u63D0\u4F9B\u5F62\u614B\u300C{value}\u300D",
      conditionOss: "OSS\u300C{value}\u300D",
      conditionDead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u3092\u542B\u3080",
      conditionSaved: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F\u3060\u3051",
      conditionNip: "NIP\u300C{value}\u300D",
      conditionTool: "\u30A8\u30F3\u30C8\u30EA\u300C{value}\u300D",
      conditionRemove: "{label}\u3092\u5916\u3059",
      /* §21 の新語彙。unknown は「値が無い」ことを名指す語で、0 でも否定でもない。 */
      summaryAbsent: "\u6982\u8981\u306F\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      freeTopic: "\u30EC\u30B3\u30FC\u30C9\u304C\u516C\u958B\u3057\u305F\u30C8\u30D4\u30C3\u30AF\u3002\u3053\u306E\u7AEF\u672B\u306B\u5BFE\u5FDC\u3059\u308B\u30E9\u30D9\u30EB\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      recordState: "\u30EC\u30B3\u30FC\u30C9\u306E\u72B6\u614B",
      recordStateFilter: "\u30EC\u30B3\u30FC\u30C9\u306E\u72B6\u614B",
      recordStateHelp: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u751F\u5B58\u3068\u306F\u5225\u306E\u8EF8\u3067\u3059\u3002",
      liveness: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u751F\u5B58",
      livenessDerived: "\u751F\u5B58\u78BA\u8A8D\uFF1A{value}",
      livenessUncounted: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30B0\u30E9\u30D5\u304C\u7121\u3044\u305F\u3081\u3001\u8A18\u9332\u6E08\u307F\u306E\u89B3\u6E2C {count} \u4EF6\u306F\u3069\u308C\u3082\u6570\u3048\u3066\u3044\u307E\u305B\u3093\u3002",
      /* issue #15-2: 到達可能と言える根拠は、収集時に記録が残っている応答だけ。記録が無ければ不明のまま。 */
      livenessFromSource: "\u5230\u9054\u53EF\u80FD\u3068\u8A00\u3048\u308B\u6839\u62E0\uFF1A{url}\uFF08{date} \u306B\u5FDC\u7B54\u3092\u8A18\u9332\uFF09",
      capabilityClaims: "\u5BFE\u5FDC\u4E3B\u5F35",
      noClaimPublished: "\u5BFE\u5FDC\u4E3B\u5F35\u306F\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      noNipClaims: "NIP\u306E\u4E3B\u5F35\u306F\u8A18\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      claimFamilyCount: "{family} {count}\u4EF6",
      claimSource: "\u4E3B\u5F35\u306E\u51FA\u5178",
      claimCaveats: "\u51FA\u5178\u306E\u4F46\u3057\u66F8\u304D",
      caveat: "\u4F46\u3057\u66F8\u304D",
      basis: "\u4E3B\u5F35\u306E\u6839\u62E0",
      assertedAt: "\u4E3B\u5F35\u306E\u53D6\u5F97\u65E5",
      notation: "\u51FA\u5178\u306E\u8A18\u6CD5",
      sourceText: "\u51FA\u5178\u306E\u8A72\u5F53\u884C",
      registryStatus: "\u30EC\u30B8\u30B9\u30C8\u30EA\u7167\u5408",
      registryDeprecated: "\u30EC\u30B8\u30B9\u30C8\u30EA\u3067\u975E\u63A8\u5968",
      notInRegistry: "\u30D4\u30F3\u7559\u3081\u3057\u305F\u30EC\u30B8\u30B9\u30C8\u30EA\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8 {revision} \u306B\u7121\u3044ID\u3067\u3059",
      noRegistrySnapshot: "\u30D5\u30A1\u30DF\u30EA {family} \u306E\u30EC\u30B8\u30B9\u30C8\u30EA\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093",
      primarySources: "\u51FA\u5178",
      noOfficialLinks: "\u51FA\u5178\u306B\u30EA\u30F3\u30AF\u306E\u8A18\u8F09\u306F\u3042\u308A\u307E\u305B\u3093",
      noReviewsObserved: "\u30EC\u30D3\u30E5\u30FC\u306F\u89B3\u6E2C\u3057\u3066\u3044\u307E\u305B\u3093",
      collectedData: "\u4E00\u6B21\u60C5\u5831\u304B\u3089\u53CE\u96C6",
      platformSourced: "\u5BFE\u5FDC\u74B0\u5883\u304C\u8A18\u9332\u3055\u308C\u3066\u3044\u308B\u30A8\u30F3\u30C8\u30EA\u3060\u3051\u304C\u4E00\u81F4\u3057\u307E\u3059\u3002",
      topicCorrection: "\u53CE\u96C6\u6642\u306E\u30C8\u30D4\u30C3\u30AF\uFF1A{collected} \u2014",
      nonClaim: { modules: "NIP\u540D\u306E\u30E2\u30B8\u30E5\u30FC\u30EB\uFF08\u5BFE\u5FDC\u4E3B\u5F35\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09", crates: "NIP\u540D\u306E\u30AF\u30EC\u30FC\u30C8\uFF08\u5BFE\u5FDC\u4E3B\u5F35\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09" },
      detailKicker: "\u5BFE\u5FDC\u306E\u6839\u62E0",
      supportFor: "{feature}\u3078\u306E\u5BFE\u5FDC",
      observer: "\u89B3\u6E2C\u4E3B\u4F53",
      nipPurpose: "NIP\u306E\u7528\u9014",
      state: "\u72B6\u614B",
      os: "OS\uFF0F\u74B0\u5883",
      license: "\u30E9\u30A4\u30BB\u30F3\u30B9",
      compareTitle: "{count}\u4EF6\u306E\u6A5F\u80FD\u6BD4\u8F03",
      differencesFirst: "\u5DEE\u304C\u3042\u308B\u9805\u76EE\u3092\u5148\u306B\u8868\u793A\u3057\u307E\u3059\u3002",
      removeCandidate: "{name}\u3092\u6BD4\u8F03\u304B\u3089\u5916\u3059",
      removeShort: "\u5916\u3059",
      alternative: "\u5225\u306E\u5019\u88DC",
      replaceTarget: "\u5165\u308C\u66FF\u3048\u308B\u5019\u88DC",
      addComparison: "\u6BD4\u8F03\u306B\u8FFD\u52A0",
      replaceComparison: "\u9078\u3093\u3060\u5019\u88DC\u3068\u5165\u308C\u66FF\u3048",
      needTwo: "\u6BD4\u8F03\u3059\u308B\u306B\u306F2\u4EF6\u4EE5\u4E0A\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
      featuresSection: "\u6A5F\u80FD",
      basicsSection: "\u57FA\u672C\u60C5\u5831",
      nipEvidence: "NIP\u88CF\u4ED8\u3051",
      reviewTitle: "{name}\u306E\u30EC\u30D3\u30E5\u30FC",
      reviewCount: "{count}\u4EF6",
      openGallery: "\u753B\u50CF\u30AE\u30E3\u30E9\u30EA\u30FC",
      reviewer: "\u6295\u7A3F\u8005",
      postedAt: "\u6295\u7A3F\u65E5\u6642",
      use: "\u7528\u9014",
      rating: "\u8A55\u4FA1",
      appVersion: "\u30A2\u30D7\u30EAversion",
      notEntered: "\u672A\u5165\u529B",
      helpful: "\u5F79\u306B\u7ACB\u3063\u305F {count}",
      unhelpful: "\u7ACB\u305F\u306A\u304B\u3063\u305F {count}",
      voters: "\u8A55\u4FA1\u8005{count}\u4EBA\u30FB\u5185\u8A33",
      writeReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0",
      body: "\u672C\u6587",
      bodyPlaceholder: "\u4F7F\u3063\u305F\u5834\u9762\u3084\u6C17\u3065\u3044\u305F\u3053\u3068",
      image: "\u753B\u50CF",
      deviceImage: "\u7AEF\u672B\u304B\u3089\u9078\u3076",
      osOptional: "\u5BFE\u8C61OS\uFF08\u4EFB\u610F\uFF09",
      versionOptional: "version\uFF08\u4EFB\u610F\uFF09",
      useOptional: "\u7528\u9014\uFF08\u4EFB\u610F\uFF09",
      ratingOptional: "\u8A55\u4FA1\uFF08\u4EFB\u610F\uFF09",
      createReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0",
      chooseBodyOrImage: "\u672C\u6587\u304B\u753B\u50CF\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
      addedReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F",
      imageOnly: "\u672C\u6587\u306A\u3057\uFF08\u753B\u50CF\u306E\u307F\uFF09",
      profileTitle: "\u30EC\u30D3\u30E5\u30A2\u30FC\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB",
      joined: "\u5229\u7528\u958B\u59CB",
      activity: "\u6295\u7A3F\u5C65\u6B74\u306E\u5E83\u304C\u308A",
      posting: "\u6295\u7A3F\u50BE\u5411",
      voteHistory: "\u904E\u53BB\u30EC\u30D3\u30E5\u30FC\u3068\u5F79\u7ACB\u3061\u5185\u8A33",
      history: "\u30EC\u30D3\u30E5\u30FC\u5C65\u6B74",
      /* 投稿フォーム (issue #9 スライス2)。成功の言い切りは readback が返ったときにしか出さないので、
         見出しは必ず「何台中何台」を持つ。「公開しました」だけの文字列はここに存在しない。 */
      publish: {
        title: "\u30EC\u30B3\u30FC\u30C9\u3092\u6295\u7A3F\u3059\u308B",
        lead: "\u7F72\u540D\u306FNIP-07\u62E1\u5F35\u304C\u884C\u3044\u3001\u3053\u306E\u753B\u9762\u306F\u79D8\u5BC6\u9375\u306B\u89E6\u308C\u307E\u305B\u3093\u3002\u516C\u958B\u3067\u304D\u305F\u3068\u8A00\u3048\u308B\u306E\u306F\u3001\u30EA\u30EC\u30FC\u304B\u3089\u8AAD\u307F\u623B\u305B\u305F\u3068\u304D\u3060\u3051\u3067\u3059\u3002",
        noSigner: "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306BNIP-07\u62E1\u5F35\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u6295\u7A3F\u306B\u306FNIP-07\u62E1\u5F35\u304C\u5FC5\u8981\u3067\u3059\u3002\u95B2\u89A7\u306F\u305D\u306E\u307E\u307E\u7D9A\u3051\u3089\u308C\u307E\u3059\u3002",
        signInFirst: "\u6295\u7A3F\u3059\u308B\u306B\u306FNIP-07\u3067\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        dLocal: "\u8B58\u5225\u5B50\uFF08d \u306E nosmaps: \u3088\u308A\u5F8C\u308D\uFF09",
        dBytes: "d \u5168\u4F53\u3067 {bytes} / {max} \u30D0\u30A4\u30C8\uFF08nosmaps: \u306E8\u30D0\u30A4\u30C8\u3092\u542B\u3080\uFF09",
        name: "\u540D\u524D",
        summary: "\u6982\u8981",
        summaryHelp: "\u7A7A\u6B04\u306E\u307E\u307E\u3067\u3082\u6295\u7A3F\u3067\u304D\u307E\u3059\u3002\u767A\u884C\u8005\u304C\u66F8\u3044\u305F\u6982\u8981\u304C\u7121\u3044\u3053\u3068\u306F\u3001\u7121\u3044\u3068\u66F8\u304F\u306E\u304C\u6B63\u78BA\u3067\u3059\u3002",
        homepage: "\u516C\u5F0F\u30B5\u30A4\u30C8\uFF08\u4EFB\u610F\u30FBhttps:// \u3067\u59CB\u307E\u308B\u3053\u3068\uFF09",
        topics: "\u8FFD\u52A0\u30C8\u30D4\u30C3\u30AF\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09",
        topicsHelp: "nosmaps \u30C8\u30D4\u30C3\u30AF\u306F\u767A\u898B\u306E\u305F\u3081\u306B\u5FC5\u305A\u4ED8\u304D\u307E\u3059\u3002\u5916\u305B\u307E\u305B\u3093\u3002",
        submit: "\u7F72\u540D\u3057\u3066\u6295\u7A3F",
        publishing: "\u6295\u7A3F\u4E2D\u2026",
        eventId: "\u7F72\u540D\u3057\u305F\u30A4\u30D9\u30F3\u30C8ID",
        partialConsequence: "\u53D7\u3051\u4ED8\u3051\u306A\u304B\u3063\u305F\u30EA\u30EC\u30FC\u3060\u3051\u3092\u8AAD\u3093\u3067\u3044\u308B\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306B\u306F\u3001\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u306F\u898B\u3048\u307E\u305B\u3093\u3002",
        headlines: {
          published: "{total}\u53F0\u4E2D{accepted}\u53F0\u306B\u516C\u958B\u3057\u3001\u8AAD\u307F\u623B\u305B\u307E\u3057\u305F\u3002",
          partial: "{total}\u53F0\u4E2D{accepted}\u53F0\u306B\u516C\u958B\u3057\u3001\u8AAD\u307F\u623B\u305B\u307E\u3057\u305F\u3002",
          unconfirmed: "\u7F72\u540D\u3068\u53D7\u9818\u306F\u3055\u308C\u307E\u3057\u305F\u304C\u3001{attempts}\u56DE\u8A66\u3057\u3066\u3082\u8AAD\u307F\u623B\u305B\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u3055\u308C\u3066\u3044\u308B\u53EF\u80FD\u6027\u306F\u3042\u308A\u307E\u3059\u3002",
          failed: "\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
          invalid: "\u3053\u306E\u5185\u5BB9\u306F\u6295\u7A3F\u3067\u304D\u307E\u305B\u3093\u3002",
          blocked: "\u7F72\u540D\u306E\u524D\u306B\u4E2D\u6B62\u3057\u307E\u3057\u305F\u3002",
          other: "\u72B6\u614B: {state}"
        },
        outcomes: {
          accepted: "\u53D7\u3051\u4ED8\u3051\u305F\uFF08OK true\uFF09",
          rejected: "\u62D2\u5426\u3057\u305F\uFF08OK false\uFF09",
          timeout: "\u5FDC\u7B54\u306A\u3057\uFF08\u672A\u78BA\u5B9A\u3002\u5931\u6557\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09",
          "connection-failed": "\u63A5\u7D9A\u3067\u304D\u306A\u304B\u3063\u305F\uFF08\u672A\u78BA\u5B9A\uFF09",
          "auth-required": "\u8A8D\u8A3C\u304C\u5FC5\u8981",
          "not-attempted": "\u9001\u3063\u3066\u3044\u306A\u3044"
        },
        reasons: {
          "bad-d": "\u8B58\u5225\u5B50\u304C\u4E0D\u6B63\u3067\u3059\uFF08\u5370\u5B57\u53EF\u80FD\u306AASCII\u306E\u307F\u3001d \u5168\u4F53\u3067192\u30D0\u30A4\u30C8\u307E\u3067\uFF09\u3002",
          "bad-schema": "\u5FC5\u9808\u306E\u9805\u76EE\u304C\u8DB3\u308A\u306A\u3044\u304B\u3001\u9577\u3055\u306E\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002",
          "foreign-d": "\u8B58\u5225\u5B50\u304C nosmaps: \u540D\u524D\u7A7A\u9593\u306E\u5916\u3092\u6307\u3057\u3066\u3044\u307E\u3059\u3002",
          "foreign-profile": "content \u304C nosmaps \u306E\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
          "bad-topic": "\u30C8\u30D4\u30C3\u30AF\u304C\u4E0D\u6B63\u3067\u3059\uFF08\u7A7A\u3001\u307E\u305F\u306F128\u30D0\u30A4\u30C8\u8D85\uFF09\u3002",
          "multi-value-t": "t \u30BF\u30B0\u306F1\u3064\u306E\u5024\u3060\u3051\u3092\u6301\u3066\u307E\u3059\u3002",
          "uppercase-topic": "\u30C8\u30D4\u30C3\u30AF\u306F\u5C0F\u6587\u5B57\u3060\u3051\u3067\u3059\u3002",
          "unknown-field": "v1\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u306B\u7121\u3044\u9805\u76EE\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002",
          "bad-version": "version \u306F 1 \u3060\u3051\u3067\u3059\u3002",
          "bad-state": "state \u306F active \u304B withdrawn \u3060\u3051\u3067\u3059\u3002",
          "bad-superseded-by": "superseded_by \u304C\u5EA7\u6A19\u3068\u3057\u3066\u4E0D\u6B63\u3067\u3059\u3002",
          "tag-content-mismatch": "state \u30BF\u30B0\u3068 content \u306E state \u304C\u98DF\u3044\u9055\u3063\u3066\u3044\u307E\u3059\u3002",
          "future-timestamp": "created_at \u304C\u3053\u306E\u7AEF\u672B\u306E\u6642\u8A08\u3088\u308A\u672A\u6765\u3067\u3059\u3002",
          "future-horizon": "created_at \u304C\u9060\u3059\u304E\u308B\u672A\u6765\u3067\u3059\u3002",
          "signer-absent": "NIP-07\u62E1\u5F35\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002",
          "signer-rejected": "NIP-07\u62E1\u5F35\u304C\u7F72\u540D\u3092\u8FD4\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u9589\u3058\u305F\u5834\u5408\u306F\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
          "signer-wrong-pubkey": "NIP-07\u62E1\u5F35\u304C\u30B5\u30A4\u30F3\u30A4\u30F3\u6642\u3068\u5225\u306E\u516C\u958B\u9375\u3067\u7F72\u540D\u3057\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-mutated-event": "NIP-07\u62E1\u5F35\u304C\u6E21\u3057\u305F\u5185\u5BB9\u3092\u66F8\u304D\u63DB\u3048\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-missing-fields": "NIP-07\u62E1\u5F35\u306E\u8FD4\u3057\u305F\u7F72\u540D\u6E08\u307F\u30A4\u30D9\u30F3\u30C8\u304C\u8AAD\u3081\u307E\u305B\u3093\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-invalid-record": "\u7F72\u540D\u5F8C\u306E\u30A4\u30D9\u30F3\u30C8\u304C\u691C\u8A3C\u3092\u901A\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "nip07-key-unparsable": "NIP-07\u62E1\u5F35\u304C\u516C\u958B\u9375\u3068\u3057\u3066\u8AAD\u3081\u306A\u3044\u5024\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002",
          "pubkey-mismatch": "\u30B5\u30A4\u30F3\u30A4\u30F3\u6642\u3068\u5225\u306E\u516C\u958B\u9375\u304C\u8FD4\u308A\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "relay-unavailable": "\u30EA\u30EC\u30FC\u5C64\u3092\u521D\u671F\u5316\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          "all-relays-rejected": "\u3059\u3079\u3066\u306E\u30EA\u30EC\u30FC\u304C\u62D2\u5426\u3057\u307E\u3057\u305F\u3002",
          "publish-error": "\u6295\u7A3F\u306E\u9014\u4E2D\u3067\u30A8\u30E9\u30FC\u304C\u8D77\u304D\u307E\u3057\u305F\u3002\u516C\u958B\u3055\u308C\u305F\u304B\u3069\u3046\u304B\u306F\u5206\u304B\u308A\u307E\u305B\u3093\u3002",
          "not-returned-yet": "\u3053\u306E\u56DE\u3067\u306F\u8FD4\u3063\u3066\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
          "query-failed": "\u8AAD\u307F\u623B\u3057\u306E\u554F\u3044\u5408\u308F\u305B\u81EA\u4F53\u304C\u5931\u6557\u3057\u305F\u306E\u3067\u3001\u4F55\u3082\u5206\u304B\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "readback-quarantined": "\u8AAD\u307F\u623B\u3057\u305F\u30A4\u30D9\u30F3\u30C8\u304C\u691C\u8A3C\u3067\u9694\u96E2\u3055\u308C\u307E\u3057\u305F\u3002",
          "superseded-during-publish": "\u540C\u3058\u5EA7\u6A19\u306B\u3001\u3088\u308A\u65B0\u3057\u3044\u5225\u306E\u30A4\u30D9\u30F3\u30C8\u304C\u89B3\u6E2C\u3055\u308C\u307E\u3057\u305F\u3002",
          "no-readback": "\u8AAD\u307F\u623B\u3057\u3092\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          unavailable: "\u30C7\u30FC\u30BF\u5C64\u3092\u8AAD\u307F\u8FBC\u3081\u3066\u3044\u307E\u305B\u3093\u3002",
          unknownReason: "\u7406\u7531: {reason}"
        }
      },
      /* NIP-07 サインイン。失敗の原因は原因ごとに別の文言で出す —— 「拡張が無い」「断られた」
         「エラーが返った」「応答が無い」は利用者が次に取る行動が違う。 */
      viewer: {
        label: "\u30D3\u30E5\u30FC\u30A2\u306E\u30B5\u30A4\u30F3\u30A4\u30F3\u72B6\u614B",
        signedIn: "\u30B5\u30A4\u30F3\u30A4\u30F3\u6E08\u307F",
        signedOut: "\u672A\u30B5\u30A4\u30F3\u30A4\u30F3",
        signIn: "NIP-07\u3067\u30B5\u30A4\u30F3\u30A4\u30F3",
        signingIn: "\u63A5\u7D9A\u4E2D\u2026",
        signOut: "\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8",
        reasonDetail: "{reason}\uFF08\u62E1\u5F35\u306E\u5FDC\u7B54: {detail}\uFF09",
        reasons: {
          noExtension: "NIP-07\u62E1\u5F35\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B window.nostr \u304C\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
          rejected: "NIP-07\u62E1\u5F35\u3067\u516C\u958B\u9375\u306E\u5171\u6709\u3092\u8A31\u53EF\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          error: "NIP-07\u62E1\u5F35\u304C\u30A8\u30E9\u30FC\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002",
          timeout: "NIP-07\u62E1\u5F35\u304C{seconds}\u79D2\u4EE5\u5185\u306B\u5FDC\u7B54\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          badKey: "NIP-07\u62E1\u5F35\u304C\u516C\u958B\u9375\u3068\u3057\u3066\u8AAD\u3081\u306A\u3044\u5024\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002"
        }
      },
      galleryTitle: "{name}\u306E\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      galleryEmpty: "\u6DFB\u4ED8\u753B\u50CF\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
      enlarge: "\u62E1\u5927",
      originalReview: "\u5143\u30EC\u30D3\u30E5\u30FC",
      imageTitle: "\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      remainingGallery: "\u6B8B\u308A{count}\u4EF6\u3092\u542B\u3080\u753B\u50CF\u30AE\u30E3\u30E9\u30EA\u30FC\u3092\u958B\u304F",
      imageAlt: "{author}\u30FB{date}\u306E\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      voteBreakdown: "\u5F79\u7ACB\u3061\u8A55\u4FA1\u306E\u5185\u8A33",
      communityVotes: "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u306E\u8A55\u4FA1",
      helpfulVotes: "\u5F79\u306B\u7ACB\u3063\u305F",
      unhelpfulVotes: "\u7ACB\u305F\u306A\u304B\u3063\u305F",
      toastLiked: "\u3044\u3044\u306D\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastBookmarked: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastVoted: "\u8A55\u4FA1\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastPublic: "\u516C\u958B\u7BC4\u56F2\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      compareLimit: "\u6BD4\u8F03\u306F\u6700\u59273\u4EF6\u3067\u3059",
      loading: "\u6A5F\u80FD\u5BFE\u5FDC\u60C5\u5831\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
      emptyState: "\u5019\u88DC\u306F0\u4EF6\u3067\u3059",
      errorState: "\u5BFE\u5FDC\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
      retry: "\u518D\u8A66\u884C",
      partialState: "\u4E00\u90E8\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      offlineState: "\u4FDD\u5B58\u6E08\u307F\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      offlineBanner: "\u30AA\u30D5\u30E9\u30A4\u30F3\uFF1A\u4FDD\u5B58\u6E08\u307F\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      staleState: "\u524D\u56DE\u89B3\u6E2C\u3057\u305F\u30EC\u30B3\u30FC\u30C9\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u4ECA\u56DE\u306E\u30E9\u30A6\u30F3\u30C9\u3092\u5B8C\u4E86\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
      incompleteState: "\u4E00\u90E8\u306E\u30EA\u30EC\u30FC\u5FDC\u7B54\u304C\u63C3\u308F\u306A\u304B\u3063\u305F\u305F\u3081\u3001\u7D50\u679C\u306F\u4E0D\u5B8C\u5168\u3067\u3059\u3002",
      unavailableState: "\u8A2D\u5B9A\u3057\u305F\u30EA\u30EC\u30FC\u304B\u3089\u306F\u8868\u793A\u3067\u304D\u308B\u30EC\u30B3\u30FC\u30C9\u3092\u89B3\u6E2C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      sampleData: "\u30B5\u30F3\u30D7\u30EB",
      relayVerified: "\u30EA\u30EC\u30FC\u691C\u8A3C\u6E08\u307F",
      relayEmptyTitle: "\u8A72\u5F53\u30EC\u30B3\u30FC\u30C9\u306A\u3057",
      relayEmpty: "\u8A2D\u5B9A\u3057\u305F\u30EA\u30EC\u30FC\u3067\u306F\u3001\u8A72\u5F53\u30C8\u30D4\u30C3\u30AF\u3092\u4ED8\u3051\u305F kind 30078 \u30EC\u30B3\u30FC\u30C9\u3092\u89B3\u6E2C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      relayDiagnostics: "\u30EA\u30EC\u30FC\u8A3A\u65AD",
      relayNoData: "\u30EA\u30EC\u30FC\u7D50\u679C\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
      relayReload: "\u30EA\u30EC\u30FC\u304B\u3089\u518D\u53D6\u5F97",
      relayRelays: "\u30EA\u30EC\u30FC\u3068\u30AB\u30D0\u30EC\u30C3\u30B8",
      relayCurators: "\u63A8\u85A6\u8005\uFF08\u3042\u306A\u305F\u306E\u30B0\u30E9\u30D5\u5185\uFF09",
      relayNoCuration: "\u89B3\u6E2C\u3067\u304D\u305F kind 30267 \u30BB\u30C3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093",
      relayManualCurators: "\u624B\u52D5\u3067\u6570\u3048\u3066\u3044\u308B pubkey",
      relayCuratorSets: "\u30BB\u30C3\u30C8",
      relayCuratorSetsValue: "{used} / {observed}",
      relayCuratorMembers: "\u30E1\u30F3\u30D0\u30FC\u6570",
      relayGraph: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30B0\u30E9\u30D5",
      relayGraphState: "\u72B6\u614B",
      relayGraphCoverage: "\u30AB\u30D0\u30EC\u30C3\u30B8",
      relayGraphFollows: "\u30B0\u30E9\u30D5\u4EBA\u6570 |G|",
      relayGraphFollowsValue: "{used} / {total}",
      relayGraphMalformed: "\u4E0D\u6B63\u306A p \u30BF\u30B0",
      relayViewer: "\u30D3\u30E5\u30FC\u30A2\u9375",
      relayViewerSource: "\u9375\u306E\u53D6\u5F97\u5143",
      relayRounds: "\u30E9\u30A6\u30F3\u30C9",
      relayChunks: "\u30C1\u30E3\u30F3\u30AF",
      relayQuarantined: "\u9694\u96E2 (quarantined)",
      relayUnresolved: "\u63A8\u85A6\u3055\u308C\u305F\u304C\u672A\u89B3\u6E2C\u306E\u5EA7\u6A19",
      relaySlugs: "\u8A3A\u65AD",
      relayAsOf: "as-of",
      relayReqs: "REQ\u96C6\u8A08",
      relayLogical: "\u8AD6\u7406REQ",
      relayPhysical: "\u7269\u7406REQ",
      relayHttp: "HTTP\u8A66\u884C",
      relayCache: "\u30AD\u30E3\u30C3\u30B7\u30E5\u30D2\u30C3\u30C8",
      relayReason: "\u7406\u7531",
      discoveryScope: "\u3042\u306A\u305F\u306E\u30EA\u30EC\u30FC\u3067\u30C8\u30D4\u30C3\u30AF\u300C{topics}\u300D\u3092\u516C\u958B\u3057\u305F\u30EC\u30B3\u30FC\u30C9\u306E\u307F\u3002\u3059\u3079\u3066\u306E\u30C4\u30FC\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      recommendations: "\u3042\u306A\u305F\u306E\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u3067{count}\u4EBA\u304C\u63A8\u85A6",
      recommendationsUnknown: "\u63A8\u85A6\u6570: \u4E0D\u660E\uFF08\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8\u304C\u5FC5\u8981\uFF09",
      graphNoneBanner: "\u30D1\u30FC\u30BD\u30CA\u30E9\u30A4\u30BA\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u63A8\u85A6\u6570\u306E\u96C6\u8A08\u306B\u306F\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8\u304C\u5FC5\u8981\u3067\u3059\u3002Nostr\u9375\u3092\u63A5\u7D9A\u3059\u308B\u304B\u3001npub\u3092\u8CBC\u308A\u4ED8\u3051\u308B\u3068\u8AAD\u307F\u53D6\u308A\u5C02\u7528\u3067\u4E26\u3073\u66FF\u3048\u3067\u304D\u307E\u3059\u3002",
      graphConnect: "Nostr\u9375\u3092\u63A5\u7D9A (NIP-07)",
      graphPasteLabel: "npub \u307E\u305F\u306F hex",
      graphApply: "\u3053\u306E\u9375\u3067\u4E26\u3073\u66FF\u3048\u308B",
      graphStateLine: "\u30B0\u30E9\u30D5: {state}\uFF08{coverage}\u30FB\u6570\u3048\u308B pubkey {used}/{total}\uFF09",
      graphStateLineShort: "\u30B0\u30E9\u30D5: {state}\uFF08{coverage}\uFF09",
      graphStates: { none: "\u306A\u3057", "self-only": "\u81EA\u5206\u306E\u307F", tier1: "\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8", "tier1+tier2": "\u30D5\u30A9\u30ED\u30FC\uFF0B1\u30DB\u30C3\u30D7" },
      graphCoverage: { fresh: "\u6700\u65B0", stale: "\u53E4\u3044", incomplete: "\u4E0D\u5B8C\u5168", truncated: "\u6253\u3061\u5207\u308A", unknown: "\u4E0D\u660E" },
      coverage: { eose: "\u5B8C\u4E86 (EOSE)", timeout: "\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8", error: "\u30A8\u30E9\u30FC", "auth-required": "\u8A8D\u8A3C\u8981\u6C42", rejected: "\u62D2\u5426", disconnected: "\u5207\u65AD", skipped: "\u672A\u5B9F\u884C" },
      nipPurposes: { "01": "\u57FA\u672C\u30A4\u30D9\u30F3\u30C8\u30FB\u7F72\u540D\u30FB\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\uFF0F\u30EA\u30EC\u30FC\u9593\u30E1\u30C3\u30BB\u30FC\u30B8", "02": "kind 3\u306B\u3088\u308B\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8", "05": "DNS\u30D9\u30FC\u30B9\u8B58\u5225\u5B50\u3068\u516C\u958B\u9375\u306E\u5BFE\u5FDC\u78BA\u8A8D", "09": "kind 5\u306B\u3088\u308B\u30A4\u30D9\u30F3\u30C8\u524A\u9664\u30EA\u30AF\u30A8\u30B9\u30C8", "11": "HTTP\u3067\u53D6\u5F97\u3059\u308B\u30EA\u30EC\u30FC\u60C5\u5831\u6587\u66F8", "19": "npub\u30FBnote\u7B49\u306Ebech32\u30A8\u30F3\u30B3\u30FC\u30C9\u8B58\u5225\u5B50", "21": "nostr: URI\u306B\u3088\u308B\u8B58\u5225\u5B50\u30EA\u30F3\u30AF", "23": "kind 30023\u306B\u3088\u308B\u9577\u6587\u30B3\u30F3\u30C6\u30F3\u30C4", "25": "kind 7\u306B\u3088\u308B\u30EA\u30A2\u30AF\u30B7\u30E7\u30F3", "42": "\u30EA\u30EC\u30FC\u306B\u5BFE\u3059\u308B\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u8A8D\u8A3C", "44": "\u30D0\u30FC\u30B8\u30E7\u30F3\u4ED8\u304D\u6697\u53F7\u5316\u30DA\u30A4\u30ED\u30FC\u30C9\u5F62\u5F0F", "46": "\u79D8\u5BC6\u9375\u3092\u5206\u96E2\u3059\u308B\u30EA\u30E2\u30FC\u30C8\u7F72\u540D", "47": "\u30EA\u30E2\u30FC\u30C8Lightning\u30A6\u30A9\u30EC\u30C3\u30C8\u63A5\u7D9A", "57": "zap request\uFF0Freceipt\u306B\u3088\u308BLightning\u652F\u6255\u3044\u8A18\u9332", "65": "kind 10002\u306B\u3088\u308Bread\uFF0Fwrite\u30EA\u30EC\u30FC\u4E00\u89A7", "78": "\u30A2\u30D7\u30EA\u56FA\u6709\u30C7\u30FC\u30BF\u306E\u4FDD\u5B58" },
      features: {
        posts: ["\u6295\u7A3F\u30FB\u8FD4\u4FE1", "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u3067\u8AAD\u307F\u66F8\u304D\u3057\u3001\u8FD4\u4FE1\u3057\u305F\u3044", "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3 \u6295\u7A3F \u8FD4\u4FE1"],
        dm: ["DM", "\u6697\u53F7\u5316\u3057\u305F\u500B\u5225\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u308A\u305F\u3044", "\u6697\u53F7\u5316DM \u500B\u5225\u30E1\u30C3\u30BB\u30FC\u30B8"],
        search: ["\u691C\u7D22", "\u6295\u7A3F\u3084\u4EBA\u3001\u8B58\u5225\u5B50\u3092\u63A2\u3057\u305F\u3044", "\u691C\u7D22 \u4EBA \u8B58\u5225\u5B50"],
        media: ["\u753B\u50CF\u30FB\u52D5\u753B", "\u753B\u50CF\u3084\u52D5\u753B\u3092\u898B\u305F\u308A\u516C\u958B\u3057\u305F\u3044", "\u30E1\u30C7\u30A3\u30A2 \u753B\u50CF\u6295\u7A3F \u52D5\u753B\u6295\u7A3F"],
        notifications: ["\u901A\u77E5", "\u8FD4\u4FE1\u30FB\u30EA\u30A2\u30AF\u30B7\u30E7\u30F3\u30FBzap\u306B\u6C17\u3065\u304D\u305F\u3044", "\u901A\u77E5 \u30EA\u30A2\u30AF\u30B7\u30E7\u30F3"],
        accounts: ["\u8907\u6570\u30A2\u30AB\u30A6\u30F3\u30C8", "\u8907\u6570\u306E\u9375\u3084\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3092\u5207\u308A\u66FF\u3048\u305F\u3044", "\u30DE\u30EB\u30C1\u30A2\u30AB\u30A6\u30F3\u30C8"],
        signing: ["\u5916\u90E8\u7F72\u540D", "\u79D8\u5BC6\u9375\u3092\u30A2\u30D7\u30EA\u304B\u3089\u5206\u96E2\u3057\u305F\u3044", "\u30EA\u30E2\u30FC\u30C8\u7F72\u540D"],
        wallet: ["Wallet\u30FBZap", "zap\u3084\u30A6\u30A9\u30EC\u30C3\u30C8\u63A5\u7D9A\u3092\u4F7F\u3044\u305F\u3044", "\u652F\u6255\u3044 \u6295\u3052\u92AD"],
        longform: ["\u9577\u6587", "\u8A18\u4E8B\u3084\u9577\u3044\u30B3\u30F3\u30C6\u30F3\u30C4\u3092\u66F8\u304D\u305F\u3044", "\u9577\u6587\u30B3\u30F3\u30C6\u30F3\u30C4 \u8A18\u4E8B"],
        community: ["\u30C1\u30E3\u30F3\u30CD\u30EB", "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u3067\u4F1A\u8A71\u30FB\u904B\u55B6\u3057\u305F\u3044", "\u30C1\u30E3\u30F3\u30CD\u30EB \u30B3\u30DF\u30E5\u30CB\u30C6\u30A3"]
      },
      reviewsSeed: {
        aBody: "\u8907\u6570\u7AEF\u672B\u3067\u8AAD\u307F\u3084\u3059\u304F\u3001\u901A\u77E5\u8A2D\u5B9A\u3082\u898B\u3064\u3051\u3084\u3059\u3044\u3002",
        bBody: "\u691C\u7D22\u7D50\u679C\u304B\u3089\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3078\u623B\u308B\u6D41\u308C\u304C\u5206\u304B\u308A\u3084\u3059\u304B\u3063\u305F\u3002",
        cBody: "\u753B\u50CF\u3092\u898B\u306A\u304C\u3089\u4F1A\u8A71\u3092\u8FFD\u3044\u3084\u3059\u3044\u3002",
        aBio: "\u8907\u6570OS\u3067\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306E\u5C0E\u7DDA\u3068\u30A2\u30AF\u30BB\u30B7\u30D3\u30EA\u30C6\u30A3\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u3002",
        bBio: "\u521D\u898B\u5229\u7528\u3068\u6BD4\u8F03\u691C\u8A3C\u3092\u4E2D\u5FC3\u306B\u8A18\u9332\u3057\u3066\u3044\u307E\u3059\u3002",
        aSpread: "28\u304B\u6708\u30FB11\u30AB\u30C6\u30B4\u30EA\u30FBWeb/Desktop/Mobile",
        bSpread: "9\u304B\u6708\u30FB6\u30AB\u30C6\u30B4\u30EA\u30FBWeb\u4E2D\u5FC3",
        aPosts: "\u67082\u301C9\u4EF6\u3002\u77ED\u6587\u3001\u753B\u50CF\u3001\u78BA\u8A8D\u30E1\u30E2\u3002",
        bPosts: "\u67081\u301C4\u4EF6\u3002\u6BD4\u8F03\u30EC\u30D3\u30E5\u30FC\u3068\u8FD4\u4FE1\u3002",
        localName: "\u3042\u306A\u305F",
        localBio: "\u3053\u306E\u753B\u9762\u3067\u8FFD\u52A0\u3057\u305F\u30EC\u30D3\u30E5\u30FC\u3002",
        screenTimeline: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3",
        screenSettings: "\u8A2D\u5B9A\u753B\u9762",
        screenMedia: "\u30E1\u30C7\u30A3\u30A2\u8868\u793A"
      }
    }
  },
  en: {
    localeName: "English",
    otherLocale: "\u65E5\u672C\u8A9E",
    language: "Language",
    skip: "Skip to content",
    close: "Close",
    all: "All",
    none: "None",
    unknown: "Unknown",
    optional: "Optional",
    reset: "Reset filters",
    remove: "Remove",
    add: "Add",
    replace: "Replace",
    title: "nosmaps \u2014 Find Nostr tools",
    description: "Discover and compare Nostr tools by goal, category, and feature.",
    footer: { source: "View the source on GitHub", sourceNewTab: "View the source on GitHub (opens in a new tab)" },
    categories: {
      clients: { name: "Clients", icon: "smartphone", description: "Clients for timelines and publishing." },
      relay: { name: "Relay operations", icon: "dns", description: "Tools for relay configuration and connectivity." },
      identity: { name: "Identity & keys", icon: "key", description: "Tools for keys and profiles." },
      media: { name: "Media", icon: "movie", description: "Tools for publishing creative media." },
      analytics: { name: "Analytics", icon: "analytics", description: "Tools for observing events and connections." },
      dev: { name: "Developer tools", icon: "code", description: "Tools for inspecting NIPs and events." },
      wallet: { name: "Wallet", icon: "wallet", description: "Bitcoin and Lightning wallets." }
    },
    statuses: { active: "Active", stale: "Stale", dead: "Ended / unreachable", unknown: "Unknown" },
    recordStates: { active: "Published (active)", withdrawn: "Withdrawn" },
    liveness: { unknown: "Unknown", reachable: "Reachable", unreachable: "Unreachable", archived: "Archived", moved: "Moved", superseded: "Superseded" },
    support: {
      supported: "Supported",
      partial: "Partial",
      not_supported: "Not supported",
      not_applicable: "Not applicable",
      planned: "Planned",
      disabled: "Implemented but disabled",
      withdrawn: "Support withdrawn",
      unknown: "Unknown (no claim)",
      out_of_family: "Other spec family"
    },
    evidence: {
      supported: "The primary source asserts it without qualification.",
      partial: "The primary source asserts it with a stated limitation.",
      not_supported: "The primary source explicitly denies it. That is a stronger statement than silence.",
      not_applicable: "The source says the capability does not apply. It is not counted in any denominator.",
      planned: "Listed as intended, not present today.",
      disabled: "Implemented, and switched off by default.",
      withdrawn: "Was supported, and has since been removed.",
      unknown: "The source makes no statement. This is not a denial.",
      out_of_family: "The claims are in another spec family. No NIP claim is recorded."
    },
    registryStatus: { resolved: "Resolved in the registry", not_in_registry: "Not in the registry", unresolvable: "No registry snapshot" },
    basis: { transcribed: "Transcribed (a copy of a document the signer read)", self_declared: "Self-declared", tested: "Tested by running it" },
    observers: { crawler: "Nosmaps observation", community: "Community review", maintainer: "Maintainer statement" },
    landing: {
      headline: "Here's the map of Nostr!",
      lead: "Find and compare Nostr apps and services by purpose and by feature.",
      carouselTitle: "Apps and services",
      carouselLabel: "Apps and services",
      slideLabel: "{name} ({index} of {total})",
      openEntry: "Open {name} in the explorer",
      position: "{index} / {total}",
      previous: "Previous item",
      next: "Next item",
      category: "Category",
      platform: "Platform",
      explorerCta: "Explore by feature",
      explorerHelp: "Filter apps and services by feature and follow the NIP evidence."
    },
    explorer: {
      pageTitle: "Nosmaps \u2014 Explore by feature",
      pageDescription: "Find Nostr tools by feature and compare differences with NIP evidence.",
      location: "Explore by feature",
      back: "Back to the top page",
      search: "Search apps and services",
      searchPlaceholder: "Name, summary, category, OS, delivery, alias",
      featureGroup: "Core features (multiple selection uses AND)",
      categoryGroup: "Filter by category",
      allCategoriesDescription: "Browse tools from every category.",
      candidates: "Candidates",
      noFeature: "No feature selected: showing all candidates",
      featureAnd: "Feature filters (all AND)",
      viewNips: "View NIPs",
      activeAnd: "Active filters (all AND)",
      noExtra: "No additional filters",
      settings: "More filters",
      platform: "OS / platform",
      updateStatus: "Update status",
      activeStatus: "Active, stale, or unknown",
      support: "Feature support",
      featureNeeded: "Select at least one feature to use this filter.",
      delivery: "Delivery",
      webApp: "Web app",
      installed: "Installed app",
      mobileApp: "Mobile app",
      oss: "OSS",
      includeDead: "Include ended / unreachable",
      savedOnly: "Bookmarked only",
      nipSearch: "NIP number or name",
      supportModes: { all: "All (including unknown)", confirmed: "Supported or partial only" },
      supportModeHelp: "Defaults to supported or partial only. Entries with no stated claim (unknown) are not shown by default.",
      unstatedSetAside: "{count} entries state nothing about the selected features. That is not the same as unsupported.",
      showUnstated: "Show unknown as well",
      unknownInfo: "About \u201CUnknown\u201D",
      unknownHelp: "Unknown means the evidence is insufficient, not unsupported. Ended or unreachable entries appear only when selected.",
      selectedCount: "{count} selected (maximum 3)",
      compareByFeature: "Compare features",
      clearSelection: "Clear selection",
      evidenceTitle: "Technical evidence",
      primarySource: "Official NIP source",
      chooseForNips: "Select a feature to show related primary NIP sources.",
      facts: "Facts & observations",
      evaluations: "User evaluations",
      noFeatureCondition: "No feature filter",
      category: "Category",
      observed: "Last observed",
      officialLinks: "Official information for {name}",
      site: "Official site",
      distribution: "Distribution",
      docs: "Official docs",
      source: "Source",
      linkDetails: "{type} information",
      displayUrl: "URL",
      opensInNewTab: "Opens in a new tab",
      checkedAt: "Last checked",
      like: "Like {count}",
      bookmark: "Bookmark",
      bookmarked: "Bookmarked",
      reviews: "Reviews {count}",
      privateDefault: "Private",
      public: "Public",
      publicToggle: "Make public",
      endedRecord: "Ended / unreachable record.",
      alternatives: "Return to active candidates with these features",
      compareAdd: "Add to comparison",
      details: "Details & evidence",
      count: "{count}",
      noMatch: "No candidates match these filters",
      noMatchHelp: "Remove filters one at a time to broaden the results.",
      removeGets: "Remove \u201C{label}\u201D for {count} results",
      resetAll: "Reset every filter",
      conditionFeature: "Feature \u201C{value}\u201D",
      conditionQuery: "Full-text \u201C{value}\u201D",
      conditionPlatform: "OS / platform \u201C{value}\u201D",
      conditionCategory: "Category \u201C{value}\u201D",
      conditionStatus: "Update status \u201C{value}\u201D",
      conditionSupport: "Feature support \u201C{value}\u201D",
      conditionDelivery: "Delivery \u201C{value}\u201D",
      conditionOss: "OSS \u201C{value}\u201D",
      conditionDead: "Include ended / unreachable",
      conditionSaved: "Bookmarked only",
      conditionNip: "NIP \u201C{value}\u201D",
      conditionTool: "Entry \u201C{value}\u201D",
      conditionRemove: "Remove {label}",
      detailKicker: "Support evidence",
      supportFor: "Support for {feature}",
      observer: "Observer",
      nipPurpose: "NIP purpose",
      state: "Status",
      os: "OS / platform",
      license: "License",
      compareTitle: "{count}-way feature comparison",
      differencesFirst: "Items that differ appear first.",
      removeCandidate: "Remove {name} from comparison",
      removeShort: "Remove",
      alternative: "Another candidate",
      replaceTarget: "Candidate to replace",
      addComparison: "Add to comparison",
      replaceComparison: "Replace selected candidate",
      needTwo: "Choose at least two candidates to compare.",
      featuresSection: "Features",
      basicsSection: "Basic information",
      nipEvidence: "NIP evidence",
      reviewTitle: "Reviews for {name}",
      reviewCount: "{count} reviews",
      openGallery: "Image gallery",
      reviewer: "Reviewer",
      postedAt: "Posted",
      use: "Use",
      rating: "Rating",
      appVersion: "App version",
      notEntered: "Not entered",
      helpful: "Helpful {count}",
      unhelpful: "Not helpful {count}",
      voters: "{count} voters \xB7 breakdown",
      writeReview: "Add a review",
      body: "Review",
      bodyPlaceholder: "Where you used it and what you noticed",
      image: "Image",
      deviceImage: "Choose from device",
      osOptional: "OS (optional)",
      versionOptional: "Version (optional)",
      useOptional: "Use (optional)",
      ratingOptional: "Rating (optional)",
      createReview: "Add review",
      chooseBodyOrImage: "Choose text or an image.",
      addedReview: "Review added",
      imageOnly: "No text (image only)",
      profileTitle: "Reviewer profile",
      joined: "Joined",
      activity: "Activity span",
      posting: "Posting pattern",
      voteHistory: "Review and vote history",
      history: "Review history",
      publish: {
        title: "Publish a record",
        lead: "Your NIP-07 extension does the signing; this page never touches a private key. It only says published when the record was read back from a relay.",
        noSigner: "No NIP-07 extension in this browser. Publishing needs one. Browsing is unaffected.",
        signInFirst: "Sign in with NIP-07 to publish.",
        dLocal: "Identifier (the part of d after nosmaps:)",
        dBytes: "{bytes} / {max} bytes for the whole d (the 8 bytes of nosmaps: included)",
        name: "Name",
        summary: "Summary",
        summaryHelp: "Leaving this empty is allowed. If the publisher wrote no summary, an empty one is the accurate answer.",
        homepage: "Homepage (optional, must start with https://)",
        topics: "Extra topics (comma separated)",
        topicsHelp: "The nosmaps topic is always attached so the record is discoverable. It cannot be removed.",
        submit: "Sign and publish",
        publishing: "Publishing\u2026",
        eventId: "Signed event id",
        partialConsequence: "Clients that read only the relays which did not accept it will not see this record.",
        headlines: {
          published: "Published to {accepted} of {total} relays and read back.",
          partial: "Published to {accepted} of {total} relays and read back.",
          unconfirmed: "Signed and acknowledged, but we could not read it back in {attempts} attempts. It may still be stored.",
          failed: "Not published.",
          invalid: "This record cannot be published as entered.",
          blocked: "Stopped before signing.",
          other: "State: {state}"
        },
        outcomes: {
          accepted: "accepted (OK true)",
          rejected: "rejected (OK false)",
          timeout: "no answer (undetermined, not a failure)",
          "connection-failed": "could not connect (undetermined)",
          "auth-required": "authentication required",
          "not-attempted": "nothing was sent"
        },
        reasons: {
          "bad-d": "The identifier is not valid (printable ASCII only, 192 bytes for the whole d).",
          "bad-schema": "A required field is missing or a length ceiling was exceeded.",
          "foreign-d": "The identifier points outside the nosmaps: namespace.",
          "foreign-profile": "The content is not the nosmaps profile.",
          "bad-topic": "A topic is not valid (empty, or over 128 bytes).",
          "multi-value-t": "A t tag carries only one value.",
          "uppercase-topic": "Topics are lowercase only.",
          "unknown-field": "A field outside the v1 profile is present.",
          "bad-version": "version must be 1.",
          "bad-state": "state must be active or withdrawn.",
          "bad-superseded-by": "superseded_by is not a valid coordinate.",
          "tag-content-mismatch": "The state tag disagrees with the state in content.",
          "future-timestamp": "created_at is ahead of this device clock.",
          "future-horizon": "created_at is too far in the future.",
          "signer-absent": "No NIP-07 extension was found.",
          "signer-rejected": "The NIP-07 extension returned no signature. If you dismissed the prompt, try again.",
          "signer-wrong-pubkey": "The extension signed with a different public key than the one you signed in with. Nothing was sent.",
          "signer-mutated-event": "The extension changed the event we handed it. Nothing was sent.",
          "signer-missing-fields": "The signed event returned by the extension is not readable. Nothing was sent.",
          "signer-invalid-record": "The signed event did not pass validation. Nothing was sent.",
          "nip07-key-unparsable": "The extension returned a value that is not a readable public key.",
          "pubkey-mismatch": "A different public key came back than the one you signed in with. Nothing was sent.",
          "relay-unavailable": "The relay layer could not be initialised.",
          "all-relays-rejected": "Every relay refused it.",
          "publish-error": "Publishing errored part way through. Whether it was stored is unknown.",
          "not-returned-yet": "It did not come back in this round. That is not a claim that it is absent.",
          "query-failed": "The read-back query itself failed, so nothing was learned.",
          "readback-quarantined": "The event we read back was quarantined by validation.",
          "superseded-during-publish": "A newer event was observed at the same coordinate.",
          "no-readback": "The read-back could not be run.",
          unavailable: "The data layer is not loaded.",
          unknownReason: "Reason: {reason}"
        }
      },
      viewer: {
        label: "Viewer sign-in state",
        signedIn: "Signed in",
        signedOut: "Not signed in",
        signIn: "Sign in with NIP-07",
        signingIn: "Connecting\u2026",
        signOut: "Sign out",
        reasonDetail: "{reason} (extension said: {detail})",
        reasons: {
          noExtension: "No NIP-07 extension found (this browser has no window.nostr).",
          rejected: "The NIP-07 extension did not allow sharing the public key.",
          error: "The NIP-07 extension returned an error.",
          timeout: "The NIP-07 extension did not answer within {seconds} seconds.",
          badKey: "The NIP-07 extension returned a value that is not a readable public key."
        }
      },
      galleryTitle: "Review images for {name}",
      galleryEmpty: "No images have been attached yet.",
      enlarge: "Enlarge",
      originalReview: "Original review",
      imageTitle: "Review image",
      remainingGallery: "Open gallery including {count} more",
      imageAlt: "Review image by {author} on {date}",
      voteBreakdown: "Vote breakdown",
      communityVotes: "Community votes",
      helpfulVotes: "Helpful",
      unhelpfulVotes: "Not helpful",
      toastLiked: "Like updated",
      toastBookmarked: "Bookmark updated",
      toastVoted: "Vote updated",
      toastPublic: "Visibility updated",
      compareLimit: "You can compare up to three",
      loading: "Loading feature support\u2026",
      emptyState: "There are no candidates",
      errorState: "Feature information could not be loaded",
      retry: "Retry",
      partialState: "Showing part of the candidate list.",
      offlineState: "Showing saved candidates.",
      offlineBanner: "Offline: showing saved candidates.",
      staleState: "Showing records observed earlier; the current round could not be completed.",
      incompleteState: "Some relay results did not complete, so this list is partial.",
      unavailableState: "No displayable record was observed on the configured relays. That is not a claim that none exists.",
      sampleData: "Sample",
      relayVerified: "Relay-verified",
      relayEmptyTitle: "No matching record",
      relayEmpty: "No kind 30078 record carrying the queried topic was observed on the configured relays. That is not a claim that none exists.",
      relayDiagnostics: "Relay diagnostics",
      relayNoData: "Relay results could not be retrieved.",
      relayReload: "Refetch from relays",
      relayRelays: "Relays and coverage",
      relayCurators: "Recommenders in your network",
      relayNoCuration: "No kind 30267 set was observed",
      relayManualCurators: "Manually counted pubkeys",
      relayCuratorSets: "Sets",
      relayCuratorSetsValue: "{used} / {observed}",
      relayCuratorMembers: "Members",
      relayGraph: "Social graph",
      relayGraphState: "State",
      relayGraphCoverage: "Coverage",
      relayGraphFollows: "Graph size |G|",
      relayGraphFollowsValue: "{used} of {total}",
      relayGraphMalformed: "Malformed p tags",
      relayViewer: "Viewer key",
      relayViewerSource: "Key source",
      relayRounds: "Rounds",
      relayChunks: "Chunks",
      relayQuarantined: "Quarantined",
      relayUnresolved: "Recommended but unobserved coordinates",
      relaySlugs: "Diagnostics",
      relayAsOf: "As of",
      relayReqs: "REQ counts",
      relayLogical: "Logical REQs",
      relayPhysical: "Physical REQs",
      relayHttp: "HTTP attempts",
      relayCache: "Cache hits",
      relayReason: "Reason",
      discoveryScope: "Records that published topic \u201C{topics}\u201D on your relays \u2014 not all tools.",
      recommendations: "Recommended by {count} in your network",
      recommendationsUnknown: "Recommendations: unknown (needs a follow list)",
      graphNoneBanner: "Not personalised \u2014 recommendation counts need a follow list. Connect a Nostr key, or paste an npub to rank in read-only mode.",
      graphConnect: "Connect a Nostr key (NIP-07)",
      graphPasteLabel: "npub or hex",
      graphApply: "Rank with this key",
      graphStateLine: "Graph: {state} ({coverage} \xB7 {used} of {total} in your graph)",
      graphStateLineShort: "Graph: {state} ({coverage})",
      graphStates: { none: "none", "self-only": "self-only", tier1: "tier1", "tier1+tier2": "tier1+tier2" },
      graphCoverage: { fresh: "fresh", stale: "stale", incomplete: "incomplete", truncated: "truncated", unknown: "unknown" },
      coverage: { eose: "Complete (EOSE)", timeout: "Timeout", error: "Error", "auth-required": "Auth required", rejected: "Rejected", disconnected: "Disconnected", skipped: "Not issued" },
      features: { posts: ["Posts & replies", "Read, write, and reply on a timeline", "timeline post reply"], dm: ["DM", "Send encrypted direct messages", "encrypted DM direct message"], search: ["Search", "Find posts, people, and identifiers", "search person identifier"], media: ["Images & video", "View and publish images or video", "media image video"], notifications: ["Notifications", "Notice replies, reactions, and zaps", "notification reaction"], accounts: ["Multiple accounts", "Switch between keys and profiles", "multi account"], signing: ["External signing", "Keep private keys separate from the app", "remote signing"], wallet: ["Wallet & Zap", "Use zaps and wallet connections", "payment tip"], longform: ["Long-form", "Write articles and longer content", "article long form"], community: ["Channels", "Talk and organize in communities", "channel community"] },
      reviewsSeed: { aBody: "Readable across devices, and notification settings were easy to find.", bBody: "The path from search results back to a profile was clear.", cBody: "It was easy to follow the conversation alongside images.", aBio: "Reviews client navigation and accessibility across several operating systems.", bBio: "Records first-use and comparison findings.", aSpread: "28 months \xB7 11 categories \xB7 Web/Desktop/Mobile", bSpread: "9 months \xB7 6 categories \xB7 mostly Web", aPosts: "2\u20139 per month: short posts, images, and notes.", bPosts: "1\u20134 per month: comparisons and replies.", localName: "You", localBio: "Reviews added on this screen.", screenTimeline: "Timeline", screenSettings: "Settings", screenMedia: "Media view" },
      summaryAbsent: "No summary published",
      freeTopic: "A topic the record published; this client ships no label for it.",
      recordState: "Record state",
      recordStateFilter: "Record state",
      recordStateHelp: "A separate axis from project liveness.",
      liveness: "Project liveness",
      livenessDerived: "Liveness check: {value}",
      livenessFromSource: "Grounds for reachable: {url} (a response was recorded on {date})",
      livenessUncounted: "No social graph, so none of the {count} recorded observations is counted.",
      capabilityClaims: "Capability claims",
      noClaimPublished: "No capability claim published",
      noNipClaims: "No NIP claims recorded",
      claimFamilyCount: "{count} {family} claims",
      claimSource: "Claim source",
      claimCaveats: "Verbatim caveats from the source",
      caveat: "Caveat",
      basis: "Claim basis",
      assertedAt: "Claim fetched",
      notation: "Source notation",
      sourceText: "Verbatim source line",
      registryStatus: "Registry resolution",
      registryDeprecated: "unrecommended in the registry",
      notInRegistry: "not in the pinned registry snapshot {revision}",
      noRegistrySnapshot: "no registry snapshot for family {family}",
      primarySources: "Sources",
      noOfficialLinks: "No link is recorded",
      noReviewsObserved: "No reviews observed",
      collectedData: "From primary sources",
      platformSourced: "Matches only entries with a recorded platform.",
      topicCorrection: "Collected topics: {collected} \u2014",
      nonClaim: { modules: "Modules named after NIPs (not a support claim)", crates: "Crates named after NIPs (not a support claim)" },
      nipPurposes: { "01": "Basic events, signatures, and client/relay messages", "02": "Follow lists using kind 3", "05": "Verification between DNS identifiers and public keys", "09": "Event deletion requests using kind 5", "11": "Relay information retrieved over HTTP", "19": "bech32 identifiers such as npub and note", "21": "Identifier links using the nostr: URI scheme", "23": "Long-form content using kind 30023", "25": "Reactions using kind 7", "42": "Client authentication to relays", "44": "Versioned encrypted payloads", "46": "Remote signing with private keys kept separate", "47": "Remote Lightning wallet connections", "57": "Lightning payments using zap requests and receipts", "65": "Read/write relay lists using kind 10002", "78": "Storage for app-specific data" }
    }
  }
};
var valid = (value) => typeof value === "string" && Object.prototype.hasOwnProperty.call(dictionaries, value);
function detectLanguage() {
  let stored;
  try {
    stored = sessionStorage.getItem("nosmaps.language");
  } catch {
    stored = null;
  }
  if (valid(stored)) return stored;
  const candidates = [...navigator.languages ?? [], navigator.language ?? ""];
  const detected = candidates.find((item) => /^(ja|en)\b/i.test(item));
  return /^en\b/i.test(detected ?? "") ? "en" : "ja";
}
var language = detectLanguage();
var listeners = /* @__PURE__ */ new Set();
function read(object, path) {
  return path.split(".").reduce((value, key) => {
    if (value === void 0 || typeof value === "string") return void 0;
    if (Array.isArray(value)) {
      const index = Number(key);
      return Number.isInteger(index) ? value[index] : void 0;
    }
    return value[key];
  }, object);
}
function format(value, variables = {}) {
  return value.replace(/\{(\w+)\}/g, (_match, key) => {
    const supplied = variables[key];
    return supplied === void 0 ? `{${key}}` : String(supplied);
  });
}
var missing = [];
var reported = /* @__PURE__ */ new Set();
function reportMissing(path, selectedLanguage, detail) {
  const signature = `${selectedLanguage}:${path}:${detail}`;
  missing.push({ path, language: selectedLanguage, detail });
  if (reported.has(signature)) return;
  reported.add(signature);
  console.error(`[nosmaps i18n] ${detail}: "${path}" (language: ${selectedLanguage})`);
}
var i18n = {
  get language() {
    return language;
  },
  get dictionaries() {
    return dictionaries;
  },
  get missing() {
    return missing.map((entry) => ({ ...entry }));
  },
  has(path, selectedLanguage = language) {
    return read(dictionaries[selectedLanguage], path) !== void 0 || read(dictionaries.ja, path) !== void 0;
  },
  /** The raw node, undefined and all: `value` is the lookup that is allowed to
      come back empty, and saying so is what stops a miss from being stringified
      further down. Callers that reach markup go through `t`, which has no hole. */
  value(path, selectedLanguage = language) {
    const found = read(dictionaries[selectedLanguage], path) ?? read(dictionaries.ja, path);
    if (found === void 0) reportMissing(path, selectedLanguage, "missing translation key");
    return found;
  },
  /** Always a string, per the missing-key contract above -- the key path stands
      in for a missing or non-string key. Declaring the return type is what makes
      handing `found` straight back an error rather than a silent "undefined". */
  t(path, variables, selectedLanguage = language) {
    const found = i18n.value(path, selectedLanguage);
    if (typeof found === "string") return format(found, variables);
    if (found !== void 0) {
      reportMissing(path, selectedLanguage, "translation key is not a string");
    }
    return path;
  },
  set(next) {
    if (!valid(next) || next === language) return;
    language = next;
    try {
      sessionStorage.setItem("nosmaps.language", language);
    } catch {
    }
    document.documentElement.lang = language;
    listeners.forEach((listener) => listener(language));
  },
  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  applyDocument() {
    document.documentElement.lang = language;
  }
};
i18n.applyDocument();

// src/ui/icons.ts
var paths = {
  apps: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
  tag: "M21.4 11.6l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l9 9c.4.4.9.6 1.4.6s1-.2 1.4-.6l7-7c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z",
  smartphone: "M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-6 3h2v-1h-2v1z",
  dns: "M20 13H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM6 18.5A1.5 1.5 0 1 1 6 15a1.5 1.5 0 0 1 0 3.5zM20 3H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 8.5A1.5 1.5 0 1 1 6 5a1.5 1.5 0 0 1 0 3.5z",
  key: "M7 14a5 5 0 1 1 4.9-6H22v4h-2v2h-2v2h-6.1A5 5 0 0 1 7 14zm0-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  movie: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM4 10h16v9H4v-9z",
  analytics: "M5 9.2h3V19H5V9.2zM10.5 5h3v14h-3V5zM16 12h3v7h-3v-7z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  mail: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  search: "M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 11.5 11 14.51 14.5 10l4.5 6H5l3.5-4.5z",
  notifications: "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  account: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  wallet: "M21 7V5c0-1.1-.9-2-2-2H5C3.34 3 2 4.34 2 6v12c0 1.66 1.34 3 3 3h16V9h-4c-1.1 0-2-.9-2-2H5a1 1 0 0 1 0-2h14v2h2zm-4 4h2v4h-2v-4z",
  article: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z",
  groups: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3a3 3 0 0 0 0 6zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
};
function svg(name, className = "material-icon") {
  const path = paths[name] ?? paths["apps"] ?? "";
  return `<svg class="${className}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="${path}"></path></svg>`;
}
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initialOf(tool) {
  const name = typeof tool?.name === "string" ? tool.name.trim() : "";
  const first2 = [...name][0];
  return first2 ? first2.toLocaleUpperCase() : "";
}
function placeholderMarkup(initial) {
  return `<span class="entity-icon is-placeholder" data-entity-initial="${esc(initial)}" aria-hidden="true"></span>`;
}
function placeholderElement(initial) {
  const span = document.createElement("span");
  span.className = "entity-icon is-placeholder";
  span.setAttribute("data-entity-initial", initial);
  span.setAttribute("aria-hidden", "true");
  return span;
}
function entity(tool) {
  const initial = initialOf(tool);
  const icon = tool ? tool.icon : null;
  const url = icon && typeof icon.url === "string" ? icon.url : "";
  if (!url) return placeholderMarkup(initial);
  return `<img class="entity-icon" src="${esc(url)}" data-entity-initial="${esc(initial)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}
document.addEventListener("error", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) || !target.classList.contains("entity-icon")) return;
  target.replaceWith(placeholderElement(target.getAttribute("data-entity-initial") ?? ""));
}, true);
var icons = Object.freeze({ svg, entity, names: Object.freeze(Object.keys(paths)) });

// src/ui/site-footer.ts
var SOURCE_URL = "https://github.com/kojira/nosmaps";
function esc2(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
function render() {
  const footer = document.querySelector("#site-footer");
  if (!footer) return;
  footer.innerHTML = `<div class="site-footer-inner"><a class="footer-source" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${esc2(i18n.t("footer.sourceNewTab"))}">${esc2(i18n.t("footer.source"))}</a></div>`;
}
function mountSiteFooter() {
  i18n.onChange(render);
  render();
}

// src/domain/explorer.ts
var UNSTATED_SUPPORT = ["unknown", "out_of_family"];
var CONFIRMED_SUPPORT = ["supported", "partial"];
var DEFAULT_SUPPORT = "confirmed";
var FEATURE_SOURCE = [
  ["posts", "edit", ["01", "09", "25"]],
  ["dm", "mail", ["44"]],
  ["search", "search", ["01", "19", "21"]],
  ["media", "image", ["01", "19"]],
  ["notifications", "notifications", ["25", "57"]],
  ["accounts", "account", ["19", "46"]],
  ["signing", "key", ["46"]],
  ["wallet", "wallet", ["47", "57"]],
  ["longform", "article", ["23"]],
  ["community", "groups", ["01", "42", "78"]]
];
var featureDefinitions = FEATURE_SOURCE.map(([id, icon, nips]) => ({ id, icon, nips }));
var featureById = Object.fromEntries(featureDefinitions.map((feature) => [feature.id, feature]));
var validStates = [
  "normal",
  "loading",
  "empty",
  "error",
  "partial",
  "offline",
  "stale",
  "incomplete",
  "unavailable"
];
function isUiState(value) {
  return typeof value === "string" && validStates.includes(value);
}
function precedenceOf(result, precedence) {
  const index = precedence.indexOf(result);
  return index === -1 ? -1 : precedence.length - index;
}
function supportPasses(value, mode) {
  if (mode === "all") return true;
  if (mode === DEFAULT_SUPPORT) return CONFIRMED_SUPPORT.includes(value);
  return value === mode;
}
function metadataValues(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(metadataValues);
  if (typeof value === "object") return Object.values(value).flatMap(metadataValues);
  return [String(value)];
}
var SPDX_OSS = /^(MIT|AGPL|GPL|LGPL|Apache|BSD|MPL|Unlicense|ISC|CC0)/i;
function ossState(tool) {
  if (!tool.license) return "unknown";
  return SPDX_OSS.test(tool.license) ? "yes" : "unknown";
}
function isOss(tool) {
  return ossState(tool) === "yes";
}
function normaliseNipQuery(value) {
  return value.trim().toLowerCase().replace(/^(nip|bud|lud)[- ]?/, "");
}

// src/ui/explorer/dom.ts
function esc3(value) {
  const map2 = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
  return String(value).replace(/[&<>'"]/g, (character) => map2[character] ?? character);
}
function $(selector) {
  return document.querySelector(selector);
}
var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusableElements(root) {
  return [...root.querySelectorAll(FOCUSABLE)];
}

// src/ui/explorer/params.ts
function positiveNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function list(raw) {
  if (!raw) return [];
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}
function backoff(raw) {
  const fallback = [0, 2e3, 8e3];
  if (!raw) return fallback;
  const values = raw.split(",").map(Number).filter(Number.isFinite);
  return values.length ? values : fallback;
}
function readExplorerParams(search) {
  const params = new URLSearchParams(search);
  return {
    readbackAttempts: positiveNumber(params.get("readbackattempts"), 3),
    readbackBackoff: backoff(params.get("readbackbackoff")),
    publishTimeoutMs: positiveNumber(params.get("publishtimeout"), 15e3),
    nip07TimeoutMs: positiveNumber(params.get("nip07timeout"), 2e4),
    relayRequested: params.get("relay") === "1",
    viewerPubkey: (params.get("viewer") ?? "").trim(),
    relays: list(params.get("relays")),
    manualCounted: list(params.get("curators")),
    topics: list(params.get("topics")),
    requestedTool: params.get("tool"),
    requestedState: params.get("state")
  };
}

// src/ui/explorer/relay-row.ts
function formatObserved(value) {
  if (typeof value === "string") return value;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
function categoryFromTopics(topics, seeds) {
  if (!Array.isArray(topics)) return null;
  return topics.find((value) => seeds.includes(value)) ?? null;
}
function relayEntryToRow(entry, asOf, seeds) {
  const observedCategory = categoryFromTopics(entry.topics, seeds);
  const stale = entry.stale === true;
  return {
    id: `relay:${entry.coordinate}`,
    name: entry.fields.name || entry.coordinate || "\u2014",
    recordState: entry.state,
    category: observedCategory ?? "clients",
    categoryObserved: observedCategory !== null,
    status: stale ? "stale" : "active",
    platform: "",
    os: [],
    license: "",
    observed: formatObserved(asOf),
    nips: [],
    provenance: "relay",
    coordinate: entry.coordinate,
    summary: entry.fields.summary,
    homepage: entry.fields.homepage,
    recommendations: entry.recommendations,
    recommenders: entry.recommenders,
    quarantinedNewer: entry.quarantinedNewer
  };
}
function shortKey(value) {
  if (typeof value === "string" && value.length > 16) return `${value.slice(0, 8)}\u2026${value.slice(-8)}`;
  return value ?? "";
}

// src/ui/explorer/draft-storage.ts
var DRAFT_STORAGE_KEY = "nosmaps.publish.draft";
var DRAFT_FIELDS = ["dLocal", "name", "summary", "homepage", "topics"];
function saveDraft(draft) {
  try {
    const stored = {};
    for (const field of DRAFT_FIELDS) stored[field] = draft[field];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
  }
}
function clearStoredDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
  }
}
function restoreDraft(draft) {
  let raw = null;
  try {
    raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let stored;
  try {
    stored = JSON.parse(raw);
  } catch {
    return;
  }
  if (!stored || typeof stored !== "object") return;
  const record = stored;
  for (const field of DRAFT_FIELDS) {
    const value = record[field];
    if (typeof value === "string") draft[field] = value;
  }
}

// src/ui/explorer/app.ts
function rowCapabilities(row) {
  return row.provenance === "relay" ? [] : row.capabilities;
}
function rowTopics(row) {
  if (row.provenance !== "relay") return row.topics;
  return row.categoryObserved ? [row.category] : [];
}
function rowLiveness(row) {
  return row.provenance === "relay" ? [] : row.liveness;
}
function rowLicense(row) {
  return row.license;
}
function mountExplorer(data) {
  const { tools, nipCatalog, seedTopics, registry, resultPrecedence } = data;
  const t = (key, variables) => i18n.t(key, variables);
  const iconSvg = (name) => icons.svg(name);
  const categories = seedTopics;
  const freeTopics = [...new Set(tools.flatMap((tool) => tool.topics).filter((topic) => !categories.includes(topic)))].sort();
  const allTopics = [...categories, ...freeTopics];
  const nipByNumber = Object.fromEntries(nipCatalog.map((nip) => [nip.number, nip]));
  const RESULT_VALUES = [...resultPrecedence, "unknown"];
  const precedenceOf2 = (result) => precedenceOf(result, resultPrecedence);
  const supportFilterValues = ["all", DEFAULT_SUPPORT, ...RESULT_VALUES, "out_of_family"];
  const explorerParams = readExplorerParams(location.search);
  const requestedState = explorerParams.requestedState;
  const requestedTool = explorerParams.requestedTool;
  const initialTool = tools.some((item) => item.id === requestedTool) ? String(requestedTool) : "";
  const relayRequested = explorerParams.relayRequested;
  let relayState = null;
  const state = {
    features: [],
    query: "",
    platform: "all",
    category: "all",
    toolStatus: "all",
    support: DEFAULT_SUPPORT,
    oss: "all",
    tool: initialTool,
    savedOnly: false,
    nipQuery: "",
    compare: [],
    likes: {},
    bookmarks: {},
    reviews: {},
    reviewVotes: {},
    reviewDrafts: {},
    uiState: isUiState(requestedState) ? requestedState : "normal"
  };
  const isSeedTopic = (id) => categories.includes(id);
  const nodeField = (node, key) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return void 0;
    return node[key];
  };
  const stringField = (node, key) => {
    const value = nodeField(node, key);
    return typeof value === "string" ? value : null;
  };
  const category = (id) => {
    if (!isSeedTopic(id)) return { name: id, icon: "tag", description: t("explorer.freeTopic") };
    const node = i18n.value(`categories.${id}`);
    return {
      name: stringField(node, "name") ?? t(`categories.${id}.name`),
      icon: stringField(node, "icon") ?? "tag",
      description: stringField(node, "description") ?? t(`categories.${id}.description`)
    };
  };
  const primaryTopic = (tool) => {
    const topics = rowTopics(tool);
    return topics.find(isSeedTopic) ?? topics[0] ?? null;
  };
  const topicLabel = (id) => category(id).name;
  const localizedFeature = (id, language2 = i18n.language) => {
    const values = i18n.value(`explorer.features.${id}`, language2);
    const at = (index) => {
      const value = Array.isArray(values) ? values[index] : void 0;
      return typeof value === "string" ? value : i18n.t(`explorer.features.${id}.${index}`, void 0, language2);
    };
    const definition = featureById[id] ?? { id, icon: "tag", nips: [] };
    return { ...definition, name: at(0), scene: at(1), aliases: at(2) };
  };
  const featureList = (language2) => featureDefinitions.map((feature) => localizedFeature(feature.id, language2));
  const toolDescription = (tool, language2 = i18n.language) => {
    if (tool.provenance === "relay") return tool.summary;
    if (tool.summaryAbsent) return i18n.t("explorer.summaryAbsent", void 0, language2);
    const recorded = tool.descriptions[language2];
    return typeof recorded === "string" && recorded ? recorded : tool.summary;
  };
  const displayLicense = (tool) => rowLicense(tool) || t("unknown");
  const rowIsOss = (tool) => tool.provenance === "relay" ? false : isOss(tool);
  const statusLabel = (status) => t(`support.${status}`);
  const supportModeLabel = (mode) => ["all", DEFAULT_SUPPORT].includes(mode) ? t(`explorer.supportModes.${mode}`) : statusLabel(mode);
  const registryStatusLabel = (status) => t(`registryStatus.${status}`);
  function need(selector, ctor) {
    const element = $(selector);
    if (!element) throw new Error(`nosmaps: ${selector} is missing from the page`);
    if (!(element instanceof ctor)) throw new Error(`nosmaps: ${selector} is not a ${ctor.name}`);
    return element;
  }
  const els = {
    query: need("#feature-query", HTMLInputElement),
    chips: need("#feature-chips", HTMLElement),
    results: need("#tool-results", HTMLElement),
    resultCount: need("#result-count", HTMLElement),
    selected: need("#selected-feature-summary", HTMLElement),
    condition: need("#condition-summary", HTMLElement),
    activeFilterCount: need("#active-filter-count", HTMLElement),
    uiState: need("#ui-state-view", HTMLElement),
    offline: need("#offline-banner", HTMLElement),
    compareActions: need("#compare-actions", HTMLElement),
    compareSummary: need("#compare-summary", HTMLElement),
    openCompare: need("#open-compare", HTMLButtonElement),
    filterDetails: need("#filter-details", HTMLDetailsElement),
    nipList: need("#nip-list", HTMLElement),
    nipCount: need("#nip-count", HTMLElement),
    evidenceDialog: need("#evidence-dialog", HTMLDialogElement),
    evidenceContent: need("#evidence-content", HTMLElement),
    compareDialog: need("#compare-dialog", HTMLDialogElement),
    compareContent: need("#compare-content", HTMLElement),
    reviewDialog: need("#review-dialog", HTMLDialogElement),
    reviewContent: need("#review-content", HTMLElement),
    profileDialog: need("#profile-dialog", HTMLDialogElement),
    profileContent: need("#profile-content", HTMLElement),
    galleryDialog: need("#gallery-dialog", HTMLDialogElement),
    galleryContent: need("#gallery-content", HTMLElement),
    imageDialog: need("#image-dialog", HTMLDialogElement),
    imageContent: need("#image-content", HTMLElement),
    toast: need("#toast", HTMLElement)
  };
  const dialogs = [els.evidenceDialog, els.compareDialog, els.reviewDialog, els.profileDialog, els.galleryDialog, els.imageDialog];
  const dialogOpeners = /* @__PURE__ */ new WeakMap();
  const dialogContexts = /* @__PURE__ */ new WeakMap();
  let lastInteractive = null;
  function languageControl() {
    return `<div class="language-switch" role="group" aria-label="${esc3(t("language"))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === "ja"}">\u65E5\u672C\u8A9E</button><button type="button" data-language="en" aria-pressed="${i18n.language === "en"}">English</button></div>`;
  }
  const VIEWER_SESSION_KEY = "nosmaps.viewer.pubkey";
  const NIP07_TIMEOUT_MS = explorerParams.nip07TimeoutMs;
  function nip07Signer2() {
    const candidate = window.nostr;
    if (!candidate || typeof candidate !== "object") return null;
    const signer = candidate;
    return typeof signer.getPublicKey === "function" ? candidate : null;
  }
  const DENIAL_PATTERN = /denied|deny|rejected|reject|declined|decline|refused|refuse|cancell?ed|cancel|not allowed|unauthori[sz]ed|拒否|却下|キャンセル/i;
  const viewer = { status: "signedOut", reason: null, detail: "", pubkey: null, npub: null, pending: false };
  let signInAttempt = 0;
  function normalizeViewerKey(value) {
    const pubkey = decodeNpub(typeof value === "string" ? value : "");
    if (!pubkey) return null;
    const npub = encodeNpub(pubkey);
    return npub ? { pubkey, npub } : null;
  }
  function signedInWith(key) {
    Object.assign(viewer, { status: "signedIn", reason: null, detail: "", pubkey: key.pubkey, npub: key.npub, pending: false });
    try {
      sessionStorage.setItem(VIEWER_SESSION_KEY, key.pubkey);
    } catch (_) {
    }
  }
  function signedOutBecause(reason, detail) {
    Object.assign(viewer, { status: "signedOut", reason: reason || null, detail: detail || "", pubkey: null, npub: null, pending: false });
    try {
      sessionStorage.removeItem(VIEWER_SESSION_KEY);
    } catch (_) {
    }
  }
  function restoreViewerSession() {
    let stored = null;
    try {
      stored = sessionStorage.getItem(VIEWER_SESSION_KEY);
    } catch (_) {
      stored = null;
    }
    const key = stored ? normalizeViewerKey(stored) : null;
    if (key) signedInWith(key);
    else signedOutBecause(null, "");
  }
  function signerErrorText(error) {
    if (error == null) return "";
    if (typeof error === "string") return error;
    if (typeof error !== "object") return "";
    const fields = error;
    const message = fields.message ?? fields.reason ?? fields.error;
    return typeof message === "string" ? message : "";
  }
  async function signIn() {
    if (viewer.pending) return;
    const attempt = ++signInAttempt;
    const signer = nip07Signer2();
    if (!signer) {
      signedOutBecause("noExtension", "");
      renderViewer();
      return;
    }
    Object.assign(viewer, { pending: true, reason: null, detail: "" });
    renderViewer();
    let timer2;
    const answered = new Promise((resolve) => {
      timer2 = setTimeout(() => resolve({ outcome: "timeout" }), NIP07_TIMEOUT_MS);
    });
    const asked = Promise.resolve().then(() => signer.getPublicKey()).then(
      (value) => ({ outcome: "resolved", value }),
      (error) => ({ outcome: "rejected", error })
    );
    let result;
    try {
      result = await Promise.race([asked, answered]);
    } finally {
      clearTimeout(timer2);
    }
    if (attempt !== signInAttempt) return;
    if (result.outcome === "timeout") signedOutBecause("timeout", "");
    else if (result.outcome === "rejected") {
      const message = signerErrorText(result.error);
      signedOutBecause(DENIAL_PATTERN.test(message) ? "rejected" : "error", message);
    } else {
      const key = normalizeViewerKey(result.value);
      if (key) signedInWith(key);
      else signedOutBecause("badKey", "");
    }
    renderViewer();
  }
  function signOut() {
    signInAttempt += 1;
    signedOutBecause(null, "");
    renderViewer();
  }
  function viewerReasonText() {
    if (!viewer.reason) return "";
    const reason = viewer.reason === "timeout" ? t("explorer.viewer.reasons.timeout", { seconds: Math.round(NIP07_TIMEOUT_MS / 1e3) }) : t(`explorer.viewer.reasons.${viewer.reason}`);
    return viewer.detail ? t("explorer.viewer.reasonDetail", { reason, detail: viewer.detail }) : reason;
  }
  function viewerMarkup() {
    if (viewer.status === "signedIn") {
      return `<span class="viewer-state">${esc3(t("explorer.viewer.signedIn"))}</span><code class="viewer-npub" data-viewer-npub>${esc3(viewer.npub)}</code><button class="text-button viewer-action" type="button" data-viewer-signout>${esc3(t("explorer.viewer.signOut"))}</button>`;
    }
    const reason = viewerReasonText();
    return `<span class="viewer-state">${esc3(t("explorer.viewer.signedOut"))}</span>` + (reason ? `<span class="viewer-reason" data-viewer-reason="${esc3(viewer.reason)}">${esc3(reason)}</span>` : "") + `<button class="text-button viewer-action" type="button" data-viewer-signin aria-disabled="${viewer.pending}">${esc3(viewer.pending ? t("explorer.viewer.signingIn") : t("explorer.viewer.signIn"))}</button>`;
  }
  function viewerControl() {
    return `<div class="viewer-identity" id="viewer-identity" role="status" aria-live="polite" aria-label="${esc3(t("explorer.viewer.label"))}" data-viewer-status="signedOut"></div>`;
  }
  function renderViewer() {
    const host = $("#viewer-identity");
    if (!host) return;
    const hadFocus = host.contains(document.activeElement);
    host.dataset["viewerStatus"] = viewer.pending ? "pending" : viewer.status;
    host.innerHTML = viewerMarkup();
    if (hadFocus) host.querySelector("button")?.focus();
    renderPublish();
  }
  function reviewerNpub(profileId) {
    if (profileId !== "local") return profiles[profileId]?.npub ?? "";
    return viewer.status === "signedIn" ? viewer.npub ?? "" : t("explorer.viewer.signedOut");
  }
  function featureName(id) {
    return localizedFeature(id).name;
  }
  function capabilitiesOf(tool) {
    return rowCapabilities(tool);
  }
  function supportRecords(tool, feature) {
    return capabilitiesOf(tool).filter((record) => record.family === registry.family && feature.nips.includes(record.id));
  }
  function outOfFamily(tool) {
    return !capabilitiesOf(tool).some((record) => record.family === registry.family) && capabilitiesOf(tool).length > 0;
  }
  function featureSupportRecord(tool, feature) {
    const records = supportRecords(tool, feature).filter((record) => precedenceOf2(record.result) > 0);
    const first2 = records[0];
    if (!first2) return null;
    return records.reduce(
      (best, record) => precedenceOf2(record.result) > precedenceOf2(best.result) ? record : best,
      first2
    );
  }
  function featureSupport(tool, feature) {
    const record = featureSupportRecord(tool, feature);
    if (record) return record.result;
    return outOfFamily(tool) ? "out_of_family" : "unknown";
  }
  function claimSummary(tool) {
    const byFamily = {};
    for (const record of capabilitiesOf(tool)) byFamily[record.family] = (byFamily[record.family] ?? 0) + 1;
    return { total: capabilitiesOf(tool).length, byFamily };
  }
  function selectedFeatures(source = state) {
    return source.features.map((id) => localizedFeature(id));
  }
  function basisLabel(value) {
    return t(`basis.${value || "transcribed"}`);
  }
  function evidenceText(status) {
    return t(`evidence.${status}`);
  }
  function nipPurpose(number) {
    if (i18n.has(`explorer.nipPurposes.${number}`)) return t(`explorer.nipPurposes.${number}`);
    const nip = nipByNumber[number];
    return nip ? nip.title : t("unknown");
  }
  const LANGUAGES = ["ja", "en"];
  function toolMatchesQuery(tool, source = state) {
    const query = source.query.trim().toLowerCase();
    if (!query) return true;
    const featureTerms = LANGUAGES.flatMap((language2) => featureList(language2).filter((feature) => featureSupport(tool, feature)).flatMap((feature) => [feature.name, feature.scene, feature.aliases]));
    const localised = (path, language2) => {
      const value = i18n.value(path, language2);
      return typeof value === "string" ? value : "";
    };
    const topicTerms = rowTopics(tool).flatMap((topic) => isSeedTopic(topic) ? LANGUAGES.flatMap((language2) => [localised(`categories.${topic}.name`, language2), localised(`categories.${topic}.description`, language2)]) : [topic]);
    const nipTerms = capabilitiesOf(tool).flatMap((record) => {
      const nip = record.family === registry.family ? nipByNumber[record.id] : null;
      return [record.key, `${record.family.toUpperCase()}-${record.id}`, `${record.family.toUpperCase()} ${record.id}`, record.id, record.registryTitle || "", nip?.title || "", record.sourceText || ""];
    });
    const collected = tool.provenance === "relay" ? [...metadataValues(tool.summary), ...metadataValues(tool.homepage)] : [
      ...metadataValues(tool.summary),
      ...metadataValues(tool.descriptions),
      ...metadataValues(tool.homepage),
      ...metadataValues(tool.sourceRepo),
      ...metadataValues(tool.distribution)
    ];
    const platformText = tool.provenance === "relay" ? tool.platform : tool.platformText ?? "";
    const terms = [
      tool.name,
      tool.id,
      platformText,
      displayLicense(tool),
      rowIsOss(tool) ? "OSS open source \u30AA\u30FC\u30D7\u30F3\u30BD\u30FC\u30B9" : "",
      /* Every recorded language, not the one on screen: a query is answered by what the catalogue
         holds, so switching the UI language never changes which entries match. */
      ...collected,
      ...topicTerms,
      ...featureTerms,
      ...nipTerms
    ];
    return terms.join(" ").toLowerCase().includes(query);
  }
  function filteredTools(overrides = {}) {
    const source = { ...state, ...overrides };
    const selected = source.features.flatMap((id) => {
      const feature = featureById[id];
      return feature ? [feature] : [];
    });
    const nipQuery = normaliseNipQuery(source.nipQuery);
    return tools.filter((tool) => {
      const supports = selected.map((feature) => featureSupport(tool, feature));
      const relevant = selected.length ? selected.flatMap((feature) => supportRecords(tool, feature)) : capabilitiesOf(tool);
      const nipMatch = !nipQuery || relevant.some((record) => `${record.id} ${record.key} ${record.registryTitle || ""}`.toLowerCase().includes(nipQuery));
      return (source.tool === "" || tool.id === source.tool) && toolMatchesQuery(tool, source) && (!source.savedOnly || Boolean(source.bookmarks[tool.id])) && (source.platform === "all" || String(tool.platformText ?? "").toLowerCase().includes(source.platform.toLowerCase())) && (source.category === "all" || tool.topics.includes(source.category)) && (source.toolStatus === "all" || tool.recordState === source.toolStatus) && /* issue #7: with a feature selected, every selected feature must pass the support mode --
         AND across features as before, but `unknown`/`out_of_family` now only pass when they were
         asked for. With no feature selected there is nothing to be unknown *about*, so the mode is
         inert and the list stays whole. */
      (!selected.length || supports.every((value) => supportPasses(value, source.support))) && (source.oss === "all" || ossState(tool) === source.oss) && nipMatch;
    });
  }
  function unstatedSetAside(source = state) {
    const selected = source.features.flatMap((id) => {
      const feature = featureById[id];
      return feature ? [feature] : [];
    });
    if (!selected.length || source.support === "all") return [];
    const shown = new Set(filteredTools(source).map((tool) => tool.id));
    return filteredTools({ ...source, support: "all" }).filter((tool) => !shown.has(tool.id) && selected.map((feature) => featureSupport(tool, feature)).some((value) => UNSTATED_SUPPORT.includes(value)));
  }
  function unstatedNoticeMarkup() {
    const setAside = unstatedSetAside();
    if (!setAside.length) return "";
    return `<div class="unstated-notice" data-unstated-count="${setAside.length}"><p>${esc3(t("explorer.unstatedSetAside", { count: setAside.length }))}</p><button class="secondary" type="button" data-support-mode="all">${esc3(t("explorer.showUnstated"))}</button></div>`;
  }
  function renderIdentity() {
    document.title = t("explorer.pageTitle");
    need('meta[name="description"]', HTMLMetaElement).content = t("explorer.pageDescription");
    need("#skip-link", HTMLElement).textContent = t("skip");
    need("#compact-identity", HTMLElement).innerHTML = `<a href="index.html" aria-label="${esc3(t("explorer.back"))}"><span class="identity-mark" aria-hidden="true">N</span><span>nosmaps</span></a><span aria-hidden="true">/</span><span>${esc3(t("explorer.location"))}</span>${viewerControl()}${languageControl()}`;
    renderViewer();
    need("#search-title", HTMLElement).textContent = t("explorer.search");
    els.query.placeholder = t("explorer.searchPlaceholder");
    els.chips.setAttribute("aria-label", t("explorer.featureGroup"));
    need("#results-title", HTMLElement).textContent = t("explorer.candidates");
    need("#settings-label", HTMLElement).textContent = t("explorer.settings");
    els.openCompare.textContent = t("explorer.compareByFeature");
    need("#clear-compare", HTMLButtonElement).textContent = t("explorer.clearSelection");
    need("#nip-reference-title", HTMLElement).textContent = t("explorer.evidenceTitle");
    els.offline.textContent = t("explorer.offlineBanner");
  }
  function renderFeatures() {
    els.chips.innerHTML = featureDefinitions.map((definition) => {
      const feature = localizedFeature(definition.id);
      const label = `${feature.name} \u2014 ${feature.scene}`;
      return `<button class="feature-chip" type="button" aria-pressed="${state.features.includes(feature.id)}" aria-label="${esc3(label)}" title="${esc3(label)}" data-select-feature="${feature.id}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="feature-chip-label">${esc3(feature.name)}</span></button>`;
    }).join("");
  }
  function option(value, label, selected) {
    return `<option value="${esc3(value)}" ${selected === value ? "selected" : ""}>${esc3(label)}</option>`;
  }
  function categoryFilterButton(id, iconName, name, description) {
    const selected = state.category === id;
    const accessibleName = `${name}: ${description}`;
    return `<button type="button" class="category-icon ${selected ? "selected" : ""}" data-category-filter="${id}" aria-pressed="${selected}" aria-label="${esc3(accessibleName)}" title="${esc3(accessibleName)}"><span class="category-symbol" aria-hidden="true">${iconSvg(iconName)}</span><span class="category-copy"><span class="category-title">${esc3(name)}</span><span class="category-description">${esc3(description)}</span></span></button>`;
  }
  function renderFilterPanel() {
    const wasOpen = els.filterDetails.open;
    need("#feature-filter-grid", HTMLElement).innerHTML = `<label class="field">${esc3(t("explorer.platform"))}<select id="platform-filter">${option("all", t("all"), state.platform)}${["Android", "iOS", "macOS"].map((value) => option(value, value, state.platform)).join("")}</select><small class="filter-prerequisite">${esc3(t("explorer.platformSourced"))}</small></label>
      <fieldset class="category-filter"><legend>${esc3(t("explorer.categoryGroup"))}</legend><div class="category-icon-group" role="group" aria-label="${esc3(t("explorer.categoryGroup"))}">${categoryFilterButton("all", "apps", t("all"), t("explorer.allCategoriesDescription"))}${allTopics.map((id) => {
      const item = category(id);
      return categoryFilterButton(id, item.icon, item.name, item.description);
    }).join("")}</div></fieldset>
      <label class="field">${esc3(t("explorer.recordStateFilter"))}<select id="tool-status-filter">${option("all", t("all"), state.toolStatus)}${["active", "withdrawn"].map((value) => option(value, t(`recordStates.${value}`), state.toolStatus)).join("")}</select><small class="filter-prerequisite">${esc3(t("explorer.recordStateHelp"))}</small></label>
      <label class="field">${esc3(t("explorer.support"))}<select id="support-filter" aria-describedby="support-filter-help" ${state.features.length ? "" : "disabled"}>${supportFilterValues.map((value) => option(value, supportModeLabel(value), state.support)).join("")}</select><small id="support-filter-help" class="filter-prerequisite">${esc3(state.features.length ? t("explorer.supportModeHelp") : t("explorer.featureNeeded"))}</small></label>
      <label class="field">${esc3(t("explorer.oss"))}<select id="oss-filter">${option("all", t("all"), state.oss)}${option("yes", "OSS", state.oss)}${option("unknown", t("unknown"), state.oss)}</select></label>
      <label class="include-dead"><input id="saved-only" type="checkbox" ${state.savedOnly ? "checked" : ""}> ${esc3(t("explorer.savedOnly"))}</label>
      <label class="field advanced-nip">${esc3(t("explorer.nipSearch"))}<input id="nip-query" type="search" value="${esc3(state.nipQuery)}" placeholder="46 / remote signing"></label>
      <div class="filter-help"><details><summary>${esc3(t("explorer.unknownInfo"))}</summary><p>${esc3(t("explorer.unknownHelp"))}</p></details><button class="text-button" type="button" data-reset-all>${esc3(t("reset"))}</button></div>`;
    els.filterDetails.open = wasOpen;
  }
  function supportBadge(status) {
    return `<span class="support-badge ${status}">${esc3(statusLabel(status))}</span>`;
  }
  function resourceTypes(tool) {
    const types = [];
    if (tool.homepage) types.push("site");
    if (tool.provenance !== "relay" && tool.distribution) types.push("distribution");
    if (tool.provenance !== "relay" && tool.sourceRepo) types.push("source");
    if (provenanceOf(tool) === "sample") return ["site", "distribution", "docs", ...rowIsOss(tool) ? ["source"] : []];
    return types;
  }
  function resourceLinks(tool) {
    const types = resourceTypes(tool);
    if (!types.length) return `<span class="no-support-record">${esc3(t("explorer.noOfficialLinks"))}</span>`;
    return types.map((type) => `<button class="resource-link" type="button" data-resource-tool="${tool.id}" data-resource-type="${type}">${esc3(t(`explorer.${type}`))}</button>`).join("");
  }
  const profiles = {
    a: { name: "Mina / relay walker", npub: "npub1mina7q3f4k8reva2x90cx", joined: "2023-04", useful: 31, notUseful: 4 },
    b: { name: "Tao / quiet tester", npub: "npub1tao8r5f7k4review2p9cx", joined: "2024-11", useful: 18, notUseful: 3 }
  };
  function provenanceOf(row) {
    return row.provenance;
  }
  const shotPalette = ["#5a46b8", "#08745e", "#a34c62", "#3f668c"];
  function imageData(label, color) {
    const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/><rect x="36" y="35" width="328" height="230" rx="18" fill="none" stroke="white" stroke-opacity=".7" stroke-width="4"/><circle cx="88" cy="90" r="22" fill="white" fill-opacity=".8"/><path d="M70 220l75-72 55 48 52-63 78 87" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><text x="200" y="105" fill="white" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700">${esc3(label)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg2)}`;
  }
  function seedText(seed, key) {
    return stringField(seed, key) ?? i18n.t(`explorer.reviewsSeed.${key}`);
  }
  function seedReviews(tool) {
    const seed = i18n.value("explorer.reviewsSeed");
    const bodies = [seedText(seed, "aBody"), seedText(seed, "bBody"), seedText(seed, "cBody"), seedText(seed, "aBody")];
    const labels = [seedText(seed, "screenTimeline"), seedText(seed, "screenSettings"), seedText(seed, "screenMedia"), seedText(seed, "screenTimeline")];
    return bodies.map((body, index) => {
      const label = labels[index] ?? "";
      const colour = shotPalette[index] ?? "";
      const author = index % 2 ? profiles["b"]?.name : profiles["a"]?.name;
      return {
        id: `${tool.id}-r${index + 1}`,
        profile: index % 2 ? "b" : "a",
        author: author ?? "",
        date: `2026-08-${String(12 - index).padStart(2, "0")}`,
        body,
        os: index % 2 ? "Web" : "Android",
        version: `2.${index + 1}`,
        use: topicLabel(primaryTopic(tool) ?? "clients"),
        rating: index === 1 ? 4 : 5,
        helpful: 7 + index * 2,
        unhelpful: index % 2,
        image: { label, src: imageData(label, colour) }
      };
    });
  }
  function allReviews(tool) {
    if (!tool) return [];
    return [...provenanceOf(tool) === "sample" ? seedReviews(tool) : [], ...state.reviews[tool.id] ?? []];
  }
  function reviewCounts(review) {
    const vote = state.reviewVotes[review.id] ?? null;
    return { helpful: review.helpful + (vote === "helpful" ? 1 : 0), unhelpful: review.unhelpful + (vote === "unhelpful" ? 1 : 0), vote };
  }
  function screenshotMarkup(image, compact = false, alt = "") {
    return `<img class="review-shot${compact ? " compact" : ""}" src="${image.src}" alt="${esc3(alt || image.label)}">`;
  }
  function reviewItem(tool, review) {
    const counts = reviewCounts(review);
    return `<article class="review-item" data-review-id="${esc3(review.id)}"><div class="review-author"><button type="button" class="reviewer-link" data-reviewer="${review.profile}"><strong>${esc3(review.author)}</strong><small>${esc3(reviewerNpub(review.profile))}</small></button><time>${esc3(review.date)}</time></div><p>${esc3(review.body || t("explorer.imageOnly"))}</p>${review.image ? `<button type="button" class="review-image-button" data-open-image="${tool.id}" data-image-review="${review.id}">${screenshotMarkup(review.image, true, t("explorer.imageAlt", { author: review.author, date: review.date }))}<span>${esc3(t("explorer.enlarge"))}</span></button>` : ""}<dl><div><dt>${esc3(t("explorer.os"))}</dt><dd>${esc3(review.os || t("explorer.notEntered"))}</dd></div><div><dt>${esc3(t("explorer.appVersion"))}</dt><dd>${esc3(review.version || t("explorer.notEntered"))}</dd></div><div><dt>${esc3(t("explorer.rating"))}</dt><dd>${review.rating || t("explorer.notEntered")}</dd></div><div><dt>${esc3(t("explorer.use"))}</dt><dd>${esc3(review.use || t("explorer.notEntered"))}</dd></div></dl><div class="helpful-actions"><button type="button" data-review-vote="helpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === "helpful"}">${esc3(t("explorer.helpful", { count: counts.helpful }))}</button><button type="button" data-review-vote="unhelpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === "unhelpful"}">${esc3(t("explorer.unhelpful", { count: counts.unhelpful }))}</button><button class="text-button" type="button" data-vote-basis="${review.id}" data-vote-tool="${tool.id}">${esc3(t("explorer.voters", { count: counts.helpful + counts.unhelpful }))}</button></div></article>`;
  }
  function cardReviewThumbnails(tool) {
    const images = allReviews(tool).flatMap((review) => review.image ? [{ ...review, image: review.image }] : []);
    if (!images.length) return "";
    const shown = images.slice(0, 3);
    const remaining = images.length - shown.length;
    return `<div class="card-review-thumbnails" aria-label="${esc3(t("explorer.openGallery"))}">${shown.map((review) => {
      const label = t("explorer.imageAlt", { author: review.author, date: review.date });
      return `<button type="button" class="card-review-thumbnail" data-open-image="${tool.id}" data-image-review="${review.id}" aria-label="${esc3(label)}" title="${esc3(label)}">${screenshotMarkup(review.image, true, "")}</button>`;
    }).join("")}${remaining ? `<button type="button" class="card-review-more" data-gallery-tool="${tool.id}" aria-label="${esc3(t("explorer.remainingGallery", { count: remaining }))}" title="${esc3(t("explorer.openGallery"))}">+${remaining}</button>` : ""}</div>`;
  }
  function likeCount(tool) {
    if (provenanceOf(tool) !== "sample") return null;
    const serial = Number(String(tool.id).replace("tool-", ""));
    return 12 + (Number.isFinite(serial) ? serial * 3 : 0) + (state.likes[tool.id] ? 1 : 0);
  }
  function likeCountMarkup(tool) {
    const count = likeCount(tool);
    return count === null ? `<span class="no-support-record" aria-label="${esc3(t("unknown"))}" title="${esc3(t("unknown"))}">\u2014</span>` : String(count);
  }
  function provenanceBadge(tool) {
    const provenance = tool ? provenanceOf(tool) : "";
    const kind = provenance === "relay" ? "relay" : provenance === "collected" ? "collected" : "sample";
    const labels = { relay: "explorer.relayVerified", collected: "explorer.collectedData", sample: "explorer.sampleData" };
    return `<span class="provenance-badge ${kind}">${esc3(t(labels[kind]))}</span>`;
  }
  const unknownMarker = () => `<span class="no-support-record" aria-label="${esc3(t("unknown"))}" title="${esc3(t("unknown"))}">\u2014</span>`;
  function topicsText(tool) {
    const list2 = rowTopics(tool);
    return list2.length ? list2.map(topicLabel).join(" / ") : t("unknown");
  }
  function categoryText(tool) {
    return topicsText(tool);
  }
  function topicTags(tool) {
    const list2 = rowTopics(tool);
    if (!list2.length) return `<span class="tag">${esc3(t("explorer.category"))}: ${esc3(t("unknown"))}</span>`;
    return list2.map((topic) => `<span class="tag topic-tag${isSeedTopic(topic) ? "" : " free-topic"}" data-topic="${esc3(topic)}">${esc3(topicLabel(topic))}</span>`).join("");
  }
  function osText(tool) {
    return (tool.provenance === "relay" ? "" : tool.platformText) || t("unknown");
  }
  function platformTags(tool) {
    return `<span class="tag">${esc3(t("explorer.os"))}: ${esc3(osText(tool))}</span>`;
  }
  const sameAddress = (a, b) => Boolean(a) && Boolean(b) && String(a).replace(/\/+$/, "") === String(b).replace(/\/+$/, "");
  function reachableSource(tool) {
    const sources = tool && tool.provenance !== "relay" ? tool.sources : [];
    for (const source of sources) {
      if (!source.url) continue;
      if (!/\bHTTP 200\b/.test(source.what)) continue;
      if (source.fields.includes("homepage") || sameAddress(source.url, tool ? tool.homepage : null)) return source;
    }
    return null;
  }
  function livenessValue(tool) {
    return reachableSource(tool) ? "reachable" : "unknown";
  }
  function livenessMarkup(tool) {
    const observations = rowLiveness(tool);
    const rows = observations.map((item) => `<li><span class="liveness-result ${esc3(item.result)}">${esc3(t(`liveness.${item.result}`))}</span> <code>${esc3(item.subject)}</code> <small>${esc3(item.detail)}</small>${item.target ? ` <small>\u2192 ${esc3(item.target)}</small>` : ""} <small>${esc3(item.observedAt)}</small></li>`).join("");
    const value = livenessValue(tool);
    const ground = reachableSource(tool);
    return `<div class="liveness-block"><p class="liveness-derived" data-liveness="${esc3(value)}">${esc3(t("explorer.livenessDerived", { value: t(`liveness.${value}`) }))} ${value === "unknown" ? unknownMarker() : ""}</p>${ground ? `<p class="liveness-ground">${esc3(t("explorer.livenessFromSource", { url: ground.url, date: ground.fetched || t("unknown") }))}</p>` : ""}${observations.length ? `<p class="liveness-why">${esc3(t("explorer.livenessUncounted", { count: observations.length }))}</p><ul class="liveness-list">${rows}</ul>` : ""}</div>`;
  }
  function recommendationMarkup(tool) {
    if (tool.provenance !== "relay") return "";
    const count = tool.recommendations;
    if (count === null || count === void 0) {
      return `<p class="recommendation-count is-unknown" data-recommendations="unknown">${esc3(t("explorer.recommendationsUnknown"))} ${unknownMarker()}</p>`;
    }
    return `<p class="recommendation-count" data-recommendations="${esc3(String(count))}">${esc3(t("explorer.recommendations", { count }))}</p>`;
  }
  function capabilityChip(tool, record) {
    const status = record.registryStatus;
    const title = record.registryTitle || (status === "not_in_registry" ? t("explorer.notInRegistry", { revision: registry.revision.slice(0, 7) }) : t("explorer.noRegistrySnapshot", { family: record.family }));
    const label = `${record.family.toUpperCase()}-${record.id}${record.scope ? `@${record.scope}` : ""}${record.sub ? `/${record.sub}` : ""}`;
    return `<button type="button" class="nip-tag-button registry-${esc3(status)}" data-evidence-tool="${esc3(tool.id)}" data-evidence-nip="${esc3(record.key)}" title="${esc3(`${label} \u2014 ${title}`)}">${esc3(label)} \xB7 ${esc3(statusLabel(record.result))}${status === "resolved" ? "" : ` <span class="registry-flag">${esc3(registryStatusLabel(status))}</span>`}</button>`;
  }
  function claimSummaryMarkup(tool) {
    const summary = claimSummary(tool);
    if (!summary.total) return `<p class="claim-summary is-unknown" data-claim-summary="none">${esc3(t("explorer.noClaimPublished"))} ${unknownMarker()}</p>`;
    const families = Object.entries(summary.byFamily).map(([family, count]) => t("explorer.claimFamilyCount", { family: family.toUpperCase(), count: count ?? 0 })).join(" \xB7 ");
    const outOf = outOfFamily(tool) ? ` <span class="out-of-family">${esc3(t("explorer.noNipClaims"))}</span>` : "";
    return `<p class="claim-summary" data-claim-summary="${esc3(String(summary.total))}" data-claim-families="${esc3(Object.keys(summary.byFamily).join(","))}">${esc3(families)}${outOf}</p>`;
  }
  function featureCard(tool) {
    return `<article class="feature-tool-card" data-tool-id="${esc3(tool.id)}" data-record-state="${esc3(tool.recordState)}"><div class="card-headline"><div class="card-identity">${icons.entity(tool)}<h2>${esc3(tool.name)}</h2></div><span class="record-state ${esc3(tool.recordState)}">${esc3(t(`recordStates.${tool.recordState}`))}</span></div><p class="tool-summary${tool.provenance !== "relay" && tool.summaryAbsent ? " is-unknown" : ""}">${esc3(toolDescription(tool))}</p><div class="card-topics">${topicTags(tool)}</div>${recommendationMarkup(tool)}<div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${esc3(tool.id)}" ${state.compare.includes(tool.id) ? "checked" : ""}> ${esc3(t("explorer.compareAdd"))}</label><button class="secondary" type="button" data-feature-detail="${esc3(tool.id)}">${esc3(t("explorer.details"))}</button></div></article>`;
  }
  function activeConditions() {
    const conditions = state.features.map((id) => ({ key: `feature:${id}`, label: t("explorer.conditionFeature", { value: featureName(id) }), overrides: { features: state.features.filter((value) => value !== id) } }));
    if (state.tool) conditions.unshift({ key: "tool", label: t("explorer.conditionTool", { value: findTool(state.tool)?.name ?? state.tool }), overrides: { tool: "" } });
    if (state.query) conditions.push({ key: "query", label: t("explorer.conditionQuery", { value: state.query }), overrides: { query: "" } });
    if (state.platform !== "all") conditions.push({ key: "platform", label: t("explorer.conditionPlatform", { value: state.platform }), overrides: { platform: "all" } });
    if (state.category !== "all") conditions.push({ key: "category", label: t("explorer.conditionCategory", { value: topicLabel(state.category) }), overrides: { category: "all" } });
    if (state.toolStatus !== "all") conditions.push({ key: "toolStatus", label: t("explorer.conditionStatus", { value: t(`recordStates.${state.toolStatus}`) }), overrides: { toolStatus: "all" } });
    if (state.features.length && state.support !== "all") conditions.push({ key: "support", label: t("explorer.conditionSupport", { value: supportModeLabel(state.support) }), overrides: { support: "all" } });
    if (state.oss !== "all") conditions.push({ key: "oss", label: t("explorer.conditionOss", { value: state.oss === "yes" ? "OSS" : t("unknown") }), overrides: { oss: "all" } });
    if (state.savedOnly) conditions.push({ key: "savedOnly", label: t("explorer.conditionSaved"), overrides: { savedOnly: false } });
    if (state.nipQuery) conditions.push({ key: "nipQuery", label: t("explorer.conditionNip", { value: state.nipQuery }), overrides: { nipQuery: "" } });
    return conditions;
  }
  function renderConditions() {
    const selected = selectedFeatures();
    const conditions = activeConditions();
    els.activeFilterCount.textContent = String(conditions.filter((item) => !item.key.startsWith("feature:") && item.key !== "query").length);
    els.selected.innerHTML = selected.length ? `<strong>${esc3(t("explorer.featureAnd"))}:</strong> ${selected.map((feature) => `<button class="selected-condition" type="button" data-remove-condition="feature:${feature.id}" aria-label="${esc3(t("explorer.conditionRemove", { label: feature.name }))}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="visually-hidden">${esc3(feature.name)}</span><span aria-hidden="true">\xD7</span></button>`).join('<span class="and-mark">AND</span>')} <button class="text-button" type="button" data-show-feature-basis>${esc3(t("explorer.viewNips"))}</button>` : `<strong>${esc3(t("explorer.noFeature"))}</strong>`;
    els.condition.innerHTML = conditions.length ? `<span class="condition-logic">${esc3(t("explorer.activeAnd"))}</span>${conditions.map((item) => `<button type="button" class="condition-pill" data-remove-condition="${esc3(item.key)}" aria-label="${esc3(t("explorer.conditionRemove", { label: item.label }))}">${esc3(item.label)} <span aria-hidden="true">\xD7</span></button>`).join("")}` : `<span class="condition-logic">${esc3(t("explorer.noExtra"))}</span>`;
  }
  function renderNips() {
    const numbers = [...new Set(state.features.flatMap((id) => featureById[id]?.nips ?? []))];
    const list2 = numbers.map((number) => nipByNumber[number] ?? { number, title: null, source: null });
    els.nipCount.textContent = `${list2.length} NIPs`;
    els.nipList.innerHTML = list2.length ? list2.map((nip) => `<article class="nip-reference-card" id="nip-${esc3(nip.number)}" data-registry-status="${nip.title ? "resolved" : "not_in_registry"}"><strong>NIP-${esc3(nip.number)}</strong><h3>${esc3(nip.title || t("explorer.notInRegistry", { revision: registry.revision.slice(0, 7) }))}</h3><p>${esc3(nipPurpose(nip.number))}</p>${nip.source ? `<a href="${nip.source}" target="_blank" rel="noreferrer">${esc3(t("explorer.primarySource"))}</a>` : ""}</article>`).join("") : `<p class="feature-chip-empty">${esc3(t("explorer.chooseForNips"))}</p>`;
  }
  function renderCompareActions() {
    state.compare = state.compare.filter((id) => Boolean(findTool(id)));
    els.compareActions.hidden = !state.compare.length;
    els.compareSummary.textContent = t("explorer.selectedCount", { count: state.compare.length });
    els.openCompare.disabled = state.compare.length < 2;
  }
  function stateMarkup(type) {
    if (type === "loading") return `<div class="state-message"><div class="nip-skeleton" aria-label="${esc3(t("explorer.loading"))}"><span></span><span></span><span></span></div><strong>${esc3(t("explorer.loading"))}</strong></div>`;
    if (type === "empty") return `<div class="state-message"><strong>${esc3(t("explorer.emptyState"))}</strong></div>`;
    if (type === "error") return `<div class="state-message error"><div><strong>${esc3(t("explorer.errorState"))}</strong><p><button class="secondary" type="button" data-set-state="normal">${esc3(t("explorer.retry"))}</button></p></div></div>`;
    if (type === "partial") return `<div class="state-message partial"><strong>${esc3(t("explorer.partialState"))}</strong></div>`;
    if (type === "offline") return `<div class="state-message partial"><strong>${esc3(t("explorer.offlineState"))}</strong></div>`;
    if (type === "stale") return `<div class="state-message partial stale"><strong>${esc3(t("explorer.staleState"))}</strong></div>`;
    if (type === "incomplete") return `<div class="state-message partial incomplete"><strong>${esc3(t("explorer.incompleteState"))}</strong></div>`;
    if (type === "unavailable") return `<div class="state-message error unavailable"><div><strong>${esc3(t("explorer.unavailableState"))}</strong><p><button class="secondary" type="button" data-relay-action="reload">${esc3(t("explorer.relayReload"))}</button></p></div></div>`;
    return "";
  }
  function relayCoverageLabel(value) {
    const key = value && typeof value === "object" && "status" in value ? String(value.status) : String(value);
    return i18n.has(`explorer.coverage.${key}`) ? t(`explorer.coverage.${key}`) : key;
  }
  function relayEntryToTool(entry, asOf) {
    return relayEntryToRow(entry, asOf, categories);
  }
  function relayEntries() {
    return relayState ? relayState.entries : [];
  }
  function findTool(id) {
    const collected = tools.find((item) => item.id === id);
    return collected ?? relayEntries().find((item) => item.id === id) ?? null;
  }
  function relayEntry(tool) {
    return Boolean(tool) && tool?.provenance === "relay";
  }
  function observedText(tool) {
    return formatObserved(tool.observed) || t("unknown");
  }
  function relayDiagnosticsMarkup(result) {
    const summary = `<summary>${esc3(t("explorer.relayDiagnostics"))}</summary>`;
    const reload = `<p><button class="secondary" type="button" data-relay-action="reload">${esc3(t("explorer.relayReload"))}</button></p>`;
    if (!result) return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<p>${esc3(t("explorer.relayNoData"))}</p>${reload}</details>`;
    const coverage = result.coverage;
    const relayUrls = Object.keys(coverage);
    const graph = result.graph;
    const curation = result.curation;
    const curators = curation.curators;
    const manual = curation.manual;
    const rounds = result.rounds;
    const quarantined = result.quarantined;
    const unresolved = result.unresolved;
    const slugs = result.diagnostics;
    const stats2 = result.stats;
    const field = (label, value) => `<div><dt>${esc3(label)}</dt><dd>${esc3(value == null || value === "" ? t("none") : value)}</dd></div>`;
    const relayRows = relayUrls.length ? relayUrls.map((url) => `<li><code>${esc3(url)}</code> \u2014 ${esc3(relayCoverageLabel(coverage[url]))}</li>`).join("") : `<li>${esc3(t("none"))}</li>`;
    const graphRow = `<dl class="relay-diagnostics-grid">${field(t("explorer.relayGraphState"), t(`explorer.graphStates.${graph.state || "none"}`))}${field(t("explorer.relayGraphCoverage"), t(`explorer.graphCoverage.${graph.coverage || "unknown"}`))}${field(t("explorer.relayGraphFollows"), graph.state === "tier1" ? t("explorer.relayGraphFollowsValue", { used: graph.followsUsed, total: graph.followsTotal }) : t("none"))}${field(t("explorer.relayGraphMalformed"), graph.malformedPTags)}${field(t("explorer.relayViewer"), graph.viewerPubkey ? shortKey(graph.viewerPubkey) : t("none"))}${field(t("explorer.relayViewerSource"), result.viewerSource || "none")}</dl>`;
    const curatorRow = (item) => `<li><code>${esc3(shortKey(item.curator))}</code><dl class="relay-diagnostics-grid">${field(t("explorer.relayCuratorSets"), t("explorer.relayCuratorSetsValue", { used: item.setsUsed, observed: item.setsObserved }))}${field(t("explorer.relayCuratorMembers"), item.memberCount)}${item.truncated ? field(t("explorer.relayReason"), "sets-truncated") : ""}</dl></li>`;
    const curatorRows = curators.length ? curators.map(curatorRow).join("") : `<li>${esc3(t("explorer.relayNoCuration"))}</li>`;
    const manualRows = manual.length ? `<h4>${esc3(t("explorer.relayManualCurators"))}</h4><ul class="relay-diagnostics-list">${manual.map(curatorRow).join("")}</ul>` : "";
    const roundRows = rounds.length ? rounds.map((round) => `<li><code>${esc3(round.label)}</code><dl class="relay-diagnostics-grid">${field(t("explorer.relayLogical"), round.logicalReqs)}${field(t("explorer.relayPhysical"), round.physicalReqs)}${field(t("explorer.relayChunks"), round.chunks)}${round.reason ? field(t("explorer.relayReason"), round.reason) : ""}</dl></li>`).join("") : `<li>${esc3(t("none"))}</li>`;
    const statsRow = `<dl class="relay-diagnostics-grid">${field(t("explorer.relayAsOf"), formatObserved(result.asOf))}${field(t("explorer.relayLogical"), stats2.logicalReqs)}${field(t("explorer.relayPhysical"), stats2.physicalReqs)}${field(t("explorer.relayHttp"), stats2.httpAttempts)}${field(t("explorer.relayCache"), stats2.cacheHits)}</dl>`;
    const quarantineRows = quarantined.length ? quarantined.map((item) => `<li><code>${esc3(item.coordinate || t("none"))}</code> \u2014 ${esc3(item.reason)}${item.eventId ? ` <small>${esc3(shortKey(item.eventId))}</small>` : ""}</li>`).join("") : `<li>${esc3(t("none"))}</li>`;
    const unresolvedRows = unresolved.length ? unresolved.map((coord) => `<li><code>${esc3(coord)}</code></li>`).join("") : `<li>${esc3(t("none"))}</li>`;
    const slugRow = `<p class="relay-diagnostics-slugs">${slugs.length ? slugs.map((slug) => `<code>${esc3(slug)}</code>`).join(" ") : esc3(t("none"))}</p>`;
    return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<div class="relay-diagnostics-body"><section><h3>${esc3(t("explorer.relayRelays"))}</h3><ul class="relay-diagnostics-list">${relayRows}</ul></section><section><h3>${esc3(t("explorer.relayGraph"))}</h3>${graphRow}</section><section><h3>${esc3(t("explorer.relayCurators"))}</h3><ul class="relay-diagnostics-list">${curatorRows}</ul>${manualRows}</section><section><h3>${esc3(t("explorer.relayRounds"))}</h3><ul class="relay-diagnostics-list">${roundRows}</ul></section><section><h3>${esc3(t("explorer.relayReqs"))}</h3>${statsRow}</section><section><h3>${esc3(t("explorer.relayQuarantined"))}</h3><ul class="relay-diagnostics-list">${quarantineRows}</ul></section><section><h3>${esc3(t("explorer.relayUnresolved"))}</h3><ul class="relay-diagnostics-list">${unresolvedRows}</ul></section><section><h3>${esc3(t("explorer.relaySlugs"))}</h3>${slugRow}</section>${reload}</div></details>`;
  }
  function discoveryScopeMarkup(result) {
    const topics = (result ? result.topics : []).join(", ");
    if (!topics) return "";
    return `<p class="discovery-scope" data-discovery-scope>${esc3(t("explorer.discoveryScope", { topics }))}</p>`;
  }
  function graphBannerMarkup(result) {
    const graph = result ? result.graph : null;
    if (!graph) return "";
    if (graph.state !== "none") {
      const label = graph.state === "tier1" ? t("explorer.graphStateLine", { state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || "unknown"}`), used: graph.followsUsed, total: graph.followsTotal }) : t("explorer.graphStateLineShort", { state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || "unknown"}`) });
      return `<p class="graph-state" data-graph-state="${esc3(graph.state)}">${esc3(label)}</p>`;
    }
    return `<div class="graph-banner" data-graph-state="none"><p>${esc3(t("explorer.graphNoneBanner"))}</p><div class="graph-banner-actions"><button class="secondary" type="button" data-graph-connect>${esc3(t("explorer.graphConnect"))}</button><label class="graph-npub-field">${esc3(t("explorer.graphPasteLabel"))}<input id="graph-npub" type="text" inputmode="text" autocomplete="off" placeholder="npub1\u2026" value="${esc3(relayViewer.viewerPubkey)}"></label><button class="secondary" type="button" data-graph-apply>${esc3(t("explorer.graphApply"))}</button></div></div>`;
  }
  function applyRelayResult(result) {
    if (!result) {
      relayState = { active: true, result: null, entries: [] };
      state.uiState = "unavailable";
      renderResults();
      return;
    }
    const asOf = result.asOf;
    const entries = result.entries.map((entry) => relayEntryToTool(entry, asOf));
    relayState = { active: true, result, entries };
    const hasEntries = entries.length > 0;
    let ui;
    if (result.status === "incomplete") ui = "incomplete";
    else if (result.status === "stale") ui = hasEntries ? "stale" : "unavailable";
    else if (result.status === "fresh") ui = hasEntries ? "normal" : "unavailable";
    else ui = "unavailable";
    state.uiState = ui;
    renderResults();
  }
  const relayViewer = { viewerPubkey: explorerParams.viewerPubkey };
  const relayResultListeners = [];
  function signedInPubkey() {
    return viewer.status === "signedIn" ? viewer.pubkey ?? "" : "";
  }
  async function loadRelayCatalog(override) {
    const next = override && typeof override === "object" && !(override instanceof Event) ? override : {};
    if ("viewerPubkey" in next) relayViewer.viewerPubkey = String(next.viewerPubkey ?? "").trim();
    try {
      const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
      const options = { relays };
      if (explorerParams.manualCounted.length) options.manualCounted = [...explorerParams.manualCounted];
      if (explorerParams.topics.length) options.topics = [...explorerParams.topics];
      const identity2 = relayViewer.viewerPubkey || signedInPubkey();
      if (identity2) options.viewerPubkey = identity2;
      state.uiState = "loading";
      renderResults();
      const result = await loadCatalog(options);
      relayResultListeners.forEach((listener) => listener(result));
      applyRelayResult(result);
      return result;
    } catch (error) {
      console.error("[nosmaps] relay catalog load failed", error);
      relayResultListeners.forEach((listener) => listener(null));
      applyRelayResult(null);
      return null;
    }
  }
  function renderResults() {
    renderConditions();
    renderNips();
    renderCompareActions();
    els.offline.hidden = state.uiState !== "offline";
    const relayActive = Boolean(relayState && relayState.active);
    const relayContext = relayActive && relayState ? graphBannerMarkup(relayState.result) + discoveryScopeMarkup(relayState.result) : "";
    const diagnostics = relayActive && relayState ? relayDiagnosticsMarkup(relayState.result) : "";
    if (["loading", "empty", "error", "unavailable"].includes(state.uiState)) {
      els.results.hidden = true;
      els.resultCount.textContent = t("explorer.count", { count: 0 });
      els.uiState.innerHTML = stateMarkup(state.uiState) + relayContext + diagnostics;
      return;
    }
    els.results.hidden = false;
    els.uiState.innerHTML = (["partial", "offline", "stale", "incomplete"].includes(state.uiState) ? stateMarkup(state.uiState) : "") + relayContext + diagnostics + (relayActive ? "" : unstatedNoticeMarkup());
    let list2 = relayActive && relayState ? relayState.entries : filteredTools();
    if (!relayActive && state.uiState === "partial") list2 = list2.slice(0, 7);
    els.resultCount.textContent = t("explorer.count", { count: list2.length });
    if (list2.length) {
      els.results.innerHTML = list2.map(featureCard).join("");
      return;
    }
    if (relayActive) {
      els.results.innerHTML = `<div class="empty zero-results"><h2>${esc3(t("explorer.relayEmptyTitle"))}</h2><p>${esc3(t("explorer.relayEmpty"))}</p></div>`;
      return;
    }
    const relaxations = activeConditions().map((item) => ({ ...item, count: filteredTools(item.overrides).length })).sort((a, b) => b.count - a.count);
    const suggestion = relaxations[0];
    els.results.innerHTML = `<div class="empty zero-results"><h2>${esc3(t("explorer.noMatch"))}</h2><p>${esc3(t("explorer.noMatchHelp"))}</p>${suggestion ? `<button class="secondary relaxation-suggestion" type="button" data-remove-condition="${esc3(suggestion.key)}">${esc3(t("explorer.removeGets", { label: suggestion.label, count: suggestion.count }))}</button>` : `<button class="secondary" type="button" data-reset-all>${esc3(t("explorer.resetAll"))}</button>`}</div>`;
  }
  const publish = {
    dLocal: "",
    name: "",
    summary: "",
    homepage: "",
    topics: "",
    busy: false,
    result: null
  };
  const PUBLISH_D_MAX_BYTES = 192;
  function saveDraft2() {
    saveDraft(publish);
  }
  function restoreDraft2() {
    restoreDraft(publish);
  }
  const publishReadbackAttempts = explorerParams.readbackAttempts;
  const publishReadbackBackoff = explorerParams.readbackBackoff;
  const publishTimeoutMs = explorerParams.publishTimeoutMs;
  function signingSigner() {
    const candidate = window.nostr;
    if (!candidate || typeof candidate !== "object") return null;
    const signer = candidate;
    if (typeof signer.signEvent !== "function" || typeof signer.getPublicKey !== "function") return null;
    return candidate;
  }
  function signerCanSign() {
    return signingSigner() !== null;
  }
  function publishDraft() {
    return buildSoftwareDraft({
      dLocal: publish.dLocal,
      name: publish.name,
      summary: publish.summary,
      homepage: publish.homepage,
      topics: publish.topics.split(",").map((value) => value.trim()).filter(Boolean),
      pubkey: viewer.pubkey ?? "",
      createdAt: Math.floor(Date.now() / 1e3)
    });
  }
  function publishValidation() {
    const result = validateSoftwareEvent(publishDraft(), { receivedAtSec: Math.floor(Date.now() / 1e3) });
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  }
  function publishDBytes() {
    const encoder = new TextEncoder();
    return encoder.encode(`${SOFTWARE_D_PREFIX}${publish.dLocal.normalize("NFC").trim()}`).length;
  }
  function publishReasonText(reason) {
    if (!reason) return "";
    return i18n.has(`explorer.publish.reasons.${reason}`) ? t(`explorer.publish.reasons.${reason}`) : t("explorer.publish.reasons.unknownReason", { reason });
  }
  function publishOutcomeText(outcome) {
    return i18n.has(`explorer.publish.outcomes.${outcome}`) ? t(`explorer.publish.outcomes.${outcome}`) : String(outcome);
  }
  function publishResultMarkup() {
    const result = publish.result;
    if (!result) return "";
    const total = result.relays.length;
    const accepted = result.relays.filter((entry) => entry.outcome === "accepted").length;
    const rows = result.relays.map((entry) => `<li><code>${esc3(entry.url)}</code> \u2014 ${esc3(publishOutcomeText(entry.outcome))}${entry.notice ? ` \u2014 <q class="relay-notice">${esc3(entry.notice)}</q>` : ""}</li>`).join("");
    let headline;
    if (result.state === "published") headline = t("explorer.publish.headlines.published", { accepted, total });
    else if (result.state === "published-partial") headline = t("explorer.publish.headlines.partial", { accepted, total });
    else if (result.state === "unconfirmed") headline = t("explorer.publish.headlines.unconfirmed", { attempts: result.attempts });
    else if (result.state === "failed") headline = t("explorer.publish.headlines.failed");
    else if (result.state === "invalid") headline = t("explorer.publish.headlines.invalid");
    else if (result.state === "blocked") headline = t("explorer.publish.headlines.blocked");
    else headline = t("explorer.publish.headlines.other", { state: result.state });
    const consequence = result.state === "published-partial" ? `<p class="publish-consequence">${esc3(t("explorer.publish.partialConsequence"))}</p>` : "";
    const reason = result.reason && result.state !== "published" && result.state !== "published-partial" ? `<p class="publish-reason" data-publish-reason="${esc3(result.reason)}">${esc3(publishReasonText(result.reason))}</p>` : "";
    const id = result.eventId ? `<p class="publish-event-id">${esc3(t("explorer.publish.eventId"))} <code data-publish-event-id>${esc3(result.eventId)}</code></p>` : "";
    return `<div class="publish-result" data-publish-state="${esc3(result.state)}"><p class="publish-headline" data-publish-headline>${esc3(headline)}</p>${consequence}${reason}${id}<ul class="publish-relays">${rows}</ul></div>`;
  }
  function publishMarkup() {
    if (!signerCanSign()) return `<p class="publish-unavailable" data-publish-unavailable>${esc3(t("explorer.publish.noSigner"))}</p>`;
    if (viewer.status !== "signedIn") return `<p class="publish-unavailable" data-publish-unavailable>${esc3(t("explorer.publish.signInFirst"))}</p>`;
    const validation = publishValidation();
    const bytes = publishDBytes();
    const canPublish = validation.ok && !publish.busy;
    const hint = validation.ok ? "" : publishReasonText(validation.reason);
    return `<h2 class="publish-title">${esc3(t("explorer.publish.title"))}</h2><p class="publish-lead">${esc3(t("explorer.publish.lead"))}</p><form class="publish-form" data-publish-form novalidate><label class="field">${esc3(t("explorer.publish.dLocal"))}<input id="publish-d" type="text" autocomplete="off" value="${esc3(publish.dLocal)}" placeholder="com.example.tool"><small class="publish-bytes" data-publish-bytes>${esc3(t("explorer.publish.dBytes", { bytes, max: PUBLISH_D_MAX_BYTES }))}</small></label><label class="field">${esc3(t("explorer.publish.name"))}<input id="publish-name" type="text" autocomplete="off" value="${esc3(publish.name)}"></label><label class="field">${esc3(t("explorer.publish.summary"))}<textarea id="publish-summary" rows="3">${esc3(publish.summary)}</textarea><small>${esc3(t("explorer.publish.summaryHelp"))}</small></label><label class="field">${esc3(t("explorer.publish.homepage"))}<input id="publish-homepage" type="text" autocomplete="off" inputmode="url" value="${esc3(publish.homepage)}" placeholder="https://"></label><label class="field">${esc3(t("explorer.publish.topics"))}<input id="publish-topics" type="text" autocomplete="off" value="${esc3(publish.topics)}" placeholder="clients, relay"><small>${esc3(t("explorer.publish.topicsHelp"))}</small></label><p class="publish-hint" data-publish-hint>${esc3(hint)}</p><button class="primary" type="submit" data-publish-submit ${canPublish ? "" : "disabled"}>${esc3(publish.busy ? t("explorer.publish.publishing") : t("explorer.publish.submit"))}</button></form>${publishResultMarkup()}`;
  }
  function renderPublish() {
    const host = $("#publish-panel");
    if (!host) return;
    host.innerHTML = publishMarkup();
  }
  function refreshPublishState() {
    const host = $("#publish-panel");
    if (!host) return;
    const button = host.querySelector("[data-publish-submit]");
    const hint = host.querySelector("[data-publish-hint]");
    const bytes = host.querySelector("[data-publish-bytes]");
    if (!button || !hint || !bytes) return;
    const validation = publishValidation();
    button.disabled = !(validation.ok && !publish.busy);
    hint.textContent = validation.ok ? "" : publishReasonText(validation.reason);
    bytes.textContent = t("explorer.publish.dBytes", { bytes: publishDBytes(), max: PUBLISH_D_MAX_BYTES });
  }
  async function submitPublish() {
    if (publish.busy) return;
    const signer = signingSigner();
    if (!signer) return;
    publish.busy = true;
    publish.result = null;
    renderPublish();
    const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
    let result;
    try {
      result = await publishSoftwareRecord({
        relays,
        signer,
        expectPubkey: viewer.pubkey ?? "",
        draft: {
          dLocal: publish.dLocal,
          name: publish.name,
          summary: publish.summary,
          homepage: publish.homepage,
          topics: publish.topics.split(",").map((value) => value.trim()).filter(Boolean)
        },
        readbackAttempts: publishReadbackAttempts,
        readbackBackoffMs: publishReadbackBackoff,
        publishTimeoutMs
      });
    } catch (error) {
      console.error("[nosmaps] publish failed", error);
      result = {
        state: "failed",
        reason: "publish-error",
        eventId: null,
        coordinate: null,
        event: null,
        relays: relays.map((url) => ({ url, outcome: "connection-failed", notice: "" })),
        readback: null,
        attempts: 0,
        asOf: Date.now()
      };
    }
    publish.busy = false;
    publish.result = result;
    if (result.state === "published" || result.state === "published-partial") clearStoredDraft();
    renderPublish();
    if (result.state === "published") await loadRelayCatalog();
    else if (result.state === "published-partial") await loadRelayCatalog();
  }
  function renderAll() {
    renderIdentity();
    renderFeatures();
    renderFilterPanel();
    els.query.value = state.query;
    renderResults();
    renderPublish();
    rerenderOpenDialogs();
  }
  function dialogFocusables(dialog) {
    return focusableElements(dialog).filter((element) => element.getClientRects().length);
  }
  function focusKey(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    for (const name of ["selectFeature", "language", "evidenceTool", "evidenceNip", "featureDetail", "reviewTool", "reviewer", "openImage", "imageReview", "galleryTool", "compareRemove"]) if (element.dataset[name] !== void 0) return `[data-${name.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}="${CSS.escape(element.dataset[name])}"]`;
    return null;
  }
  function restoreFocus(key, root = document) {
    if (key) requestAnimationFrame(() => {
      root.querySelector(key)?.focus();
    });
  }
  function openDialog(dialog, context, opener = lastInteractive ?? document.activeElement) {
    dialogContexts.set(dialog, context);
    if (opener instanceof HTMLElement) dialogOpeners.set(dialog, opener);
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => {
      dialogFocusables(dialog)[0]?.focus();
    });
  }
  function dialogHead(kicker, title) {
    return `<div class="dialog-head"><div><div class="dialog-kicker">${esc3(kicker)}</div><h2>${esc3(title)}</h2></div><div class="dialog-tools"><button class="icon-btn" type="button" data-close-dialog aria-label="${esc3(t("close"))}" title="${esc3(t("close"))}">\xD7</button></div></div>`;
  }
  function renderEvidence(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const record = tool ? capabilitiesOf(tool).find((item) => item.key === context.nip) : void 0;
    if (!tool || !record) return;
    const nip = record.family === registry.family ? nipByNumber[record.id] : null;
    const label = `${record.family.toUpperCase()}-${record.id}${record.scope ? `@${record.scope}` : ""}${record.sub ? `/${record.sub}` : ""}`;
    const registryLine = record.registryStatus === "resolved" ? `${registryStatusLabel("resolved")} \u2014 ${record.registryTitle}${record.deprecated ? ` (${t("explorer.registryDeprecated")})` : ""}` : record.registryStatus === "not_in_registry" ? `${registryStatusLabel("not_in_registry")} \u2014 ${t("explorer.notInRegistry", { revision: registry.revision.slice(0, 7) })}` : `${registryStatusLabel("unresolvable")} \u2014 ${t("explorer.noRegistrySnapshot", { family: record.family })}`;
    els.evidenceDialog.setAttribute("aria-label", `${tool.name} \xB7 ${label}`);
    els.evidenceContent.innerHTML = `${dialogHead(t("explorer.detailKicker"), `${tool.name} \xB7 ${label}`)}<p>${esc3(t("explorer.supportFor", { feature: context.featureId ? featureName(context.featureId) : record.registryTitle || label }))} ${supportBadge(record.result)}</p><section class="dialog-layer fact-layer"><h3>${esc3(t("explorer.facts"))}</h3><p>${esc3(evidenceText(record.result))}</p>${record.caveat ? `<p class="claim-caveat">${esc3(t("explorer.caveat"))}: ${esc3(record.caveat)}</p>` : ""}<dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.state"))}</dt><dd>${esc3(statusLabel(record.result))}</dd></div><div><dt>${esc3(t("explorer.basis"))}</dt><dd>${esc3(basisLabel(record.basis))}</dd></div><div><dt>${esc3(t("explorer.assertedAt"))}</dt><dd>${esc3(record.assertedAt || t("unknown"))}</dd></div><div><dt>${esc3(t("explorer.registryStatus"))}</dt><dd data-registry-status="${esc3(record.registryStatus)}">${esc3(registryLine)}</dd></div><div><dt>${esc3(t("explorer.nipPurpose"))}</dt><dd>${esc3(nip ? nipPurpose(record.id) : t("unknown"))}</dd></div><div><dt>${esc3(t("explorer.sourceText"))}</dt><dd class="source-text">${esc3(record.sourceText || t("unknown"))}</dd></div></dl>${record.source ? `<a href="${esc3(record.source)}" target="_blank" rel="noreferrer">${esc3(t("explorer.claimSource"))}</a> ` : ""}${nip ? `<a href="${esc3(nip.source)}" target="_blank" rel="noreferrer">${esc3(t("explorer.primarySource"))}</a>` : ""}</section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function sourceListMarkup(tool) {
    const sources = tool.provenance === "relay" ? [] : tool.sources;
    const rows = sources.map((item) => `<li><a href="${esc3(item.url)}" target="_blank" rel="noreferrer">${esc3(item.url)}</a> <small>${esc3(item.fields.join(", "))} \xB7 ${esc3(item.fetched)}</small><br><small>${esc3(item.what)}</small></li>`).join("");
    return rows ? `<ul class="source-list">${rows}</ul>` : `<p class="no-support-record">${esc3(t("none"))}</p>`;
  }
  function claimBlockMarkup(tool) {
    const claim = tool.provenance === "relay" ? null : tool.claim;
    const caveats = (claim?.caveats ?? []).map((text) => `<li>${esc3(text)}</li>`).join("");
    const nonClaims = (claim?.nonClaims ?? []).map((item) => `<p class="non-claim">${esc3(t(`explorer.nonClaim.${item.kind}`))}: <code>${esc3(item.values.join(", "))}</code></p>`).join("");
    const capabilities = capabilitiesOf(tool);
    const rows = capabilities.length ? capabilities.map((record) => capabilityChip(tool, record)).join("") : `<p class="claim-summary is-unknown" data-claim-summary="none">${esc3(t("explorer.noClaimPublished"))} ${unknownMarker()}</p>`;
    return `<section class="dialog-layer claim-layer"><h3>${esc3(t("explorer.capabilityClaims"))}</h3>${claimSummaryMarkup(tool)}<div class="basis-nips">${rows}</div><dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.basis"))}</dt><dd>${esc3(capabilities.length ? basisLabel(capabilities[0]?.basis) : t("unknown"))}</dd></div><div><dt>${esc3(t("explorer.notation"))}</dt><dd>${esc3(claim?.notation || t("unknown"))}</dd></div></dl>${claim?.source ? `<a href="${esc3(claim.source)}" target="_blank" rel="noreferrer">${esc3(t("explorer.claimSource"))}</a>` : ""}${nonClaims}${caveats ? `<details class="claim-caveats"><summary>${esc3(t("explorer.claimCaveats"))}</summary><ul>${caveats}</ul></details>` : ""}</section>`;
  }
  function renderToolDetail(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const description = relayEntry(tool) ? tool.summary || t("explorer.summaryAbsent") : toolDescription(tool);
    const reviews = allReviews(tool);
    const bookmark = state.bookmarks[tool.id];
    const supports = state.features.map((id) => localizedFeature(id)).map((feature) => ({ feature, support: featureSupport(tool, feature) }));
    els.evidenceDialog.setAttribute("aria-label", tool.name);
    els.evidenceContent.innerHTML = `${dialogHead(t("explorer.details"), tool.name)}<p class="detail-provenance">${provenanceBadge(tool)}<span class="record-state ${esc3(tool.recordState)}">${esc3(t(`recordStates.${tool.recordState}`))}</span></p><p class="tool-summary${tool.provenance !== "relay" && tool.summaryAbsent ? " is-unknown" : ""}">${esc3(description)}</p><section class="dialog-layer fact-layer"><h3>${esc3(t("explorer.facts"))}</h3><div class="support-line">${supports.length ? supports.map((item) => `<span class="feature-support-summary">${esc3(item.feature.name)} ${supportBadge(item.support)}</span>`).join("") : `<span class="tag">${esc3(t("explorer.noFeatureCondition"))}</span>`}${topicTags(tool)}${platformTags(tool)}</div><dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.recordState"))}</dt><dd>${esc3(t(`recordStates.${tool.recordState}`))}</dd></div><div><dt>${esc3(t("explorer.observed"))}</dt><dd>${esc3(observedText(tool))}</dd></div><div><dt>${esc3(t("explorer.category"))}</dt><dd>${esc3(topicsText(tool))}</dd></div><div><dt>${esc3(t("explorer.os"))}</dt><dd>${esc3(osText(tool))}</dd></div><div><dt>${esc3(t("explorer.license"))}</dt><dd>${esc3(displayLicense(tool))}</dd></div></dl>${livenessMarkup(tool)}${tool.provenance !== "relay" && tool.topicCorrection ? `<p class="topic-correction">${esc3(t("explorer.topicCorrection", { collected: tool.collectedTopics.join(", ") || t("none") }))} ${esc3(tool.topicCorrection)}</p>` : ""}<nav class="resource-links" aria-label="${esc3(t("explorer.officialLinks", { name: tool.name }))}">${resourceLinks(tool)}</nav><h4>${esc3(t("explorer.primarySources"))}</h4>${sourceListMarkup(tool)}</section>${claimBlockMarkup(tool)}<section class="dialog-layer evaluation-layer"><h3>${esc3(t("explorer.evaluations"))}</h3>${cardReviewThumbnails(tool)}<div class="evaluation-actions"><button type="button" class="like-button" data-like-tool="${esc3(tool.id)}" aria-pressed="${Boolean(state.likes[tool.id])}">\u2665 ${likeCountMarkup(tool)}</button><button type="button" data-bookmark-tool="${esc3(tool.id)}" aria-pressed="${Boolean(bookmark)}">${esc3(t(bookmark ? "explorer.bookmarked" : "explorer.bookmark"))}</button><button type="button" data-review-tool="${esc3(tool.id)}">${esc3(t("explorer.reviews", { count: reviews.length }))}</button></div>${bookmark ? `<label class="public-toggle"><input type="checkbox" data-public-bookmark="${esc3(tool.id)}" ${bookmark.public ? "checked" : ""}> ${esc3(t("explorer.publicToggle"))}</label><span class="privacy-state">${esc3(t(bookmark.public ? "explorer.public" : "explorer.privateDefault"))}</span>` : `<span class="privacy-state">${esc3(t("explorer.privateDefault"))}</span>`}${reviews.length ? "" : `<p class="no-support-record">${esc3(t("explorer.noReviewsObserved"))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function resourceUrl(tool, type) {
    if (provenanceOf(tool) === "sample") {
      const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const generated = {
        site: `https://${slug}.example.invalid/`,
        distribution: `https://store.example.invalid/apps/${slug}`,
        docs: `https://docs.${slug}.example.invalid/`,
        source: `https://code.example.invalid/${slug}/source`
      };
      return generated[type] ?? "";
    }
    const stated = tool.provenance === "relay" ? { site: tool.homepage } : { site: tool.homepage, distribution: tool.distribution, source: tool.sourceRepo };
    return stated[type] ?? "";
  }
  function httpUrl(value) {
    if (typeof value !== "string" || !value) return null;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return null;
    }
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  }
  function resourceValueMarkup(value) {
    const url = httpUrl(value);
    if (!url) return esc3(value || t("unknown"));
    return `<a href="${esc3(url)}" target="_blank" rel="noopener noreferrer" title="${esc3(t("explorer.opensInNewTab"))}">${esc3(url)}</a>`;
  }
  function renderResource(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const typeLabel = t(`explorer.${context.resourceType}`);
    const url = relayEntry(tool) ? context.resourceType === "site" ? tool.homepage ?? "" : "" : resourceUrl(tool, context.resourceType);
    els.evidenceDialog.setAttribute("aria-label", t("explorer.linkDetails", { type: typeLabel }));
    els.evidenceContent.innerHTML = `${dialogHead(t("explorer.linkDetails", { type: typeLabel }), tool.name)}<dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.displayUrl"))}</dt><dd>${resourceValueMarkup(url)}</dd></div><div><dt>${esc3(t("explorer.checkedAt"))}</dt><dd>${esc3(observedText(tool))}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function renderFeatureBasis(context = { type: "featureBasis" }, shouldOpen = true) {
    const selected = selectedFeatures();
    els.evidenceDialog.setAttribute("aria-label", t("explorer.evidenceTitle"));
    els.evidenceContent.innerHTML = `${dialogHead("NIP", t("explorer.evidenceTitle"))}<div class="feature-basis-list">${selected.flatMap((feature) => feature.nips.map((number) => nipByNumber[number] || { number, title: null, source: null }).map((nip) => `<article class="nip-reference-card" data-registry-status="${nip.title ? "resolved" : "not_in_registry"}"><strong>${esc3(feature.name)} \xB7 NIP-${esc3(nip.number)}</strong><h3>${esc3(nip.title || t("explorer.notInRegistry", { revision: registry.revision.slice(0, 7) }))}</h3><p>${esc3(nipPurpose(nip.number))}</p>${nip.source ? `<a href="${nip.source}" target="_blank" rel="noreferrer">${esc3(t("explorer.primarySource"))}</a>` : ""}</article>`)).join("")}</div>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function comparisonItem(label, values, contents, icon = "") {
    const different = new Set(values).size > 1;
    return { different, markup: `<section class="comparison-item ${different ? "is-different" : "is-identical"}" data-difference="${different}"><div class="comparison-label">${icon}<span>${esc3(label)}</span></div><div class="comparison-values">${contents.join("")}</div></section>` };
  }
  function renderCompare(context = { type: "compare" }, shouldOpen = true) {
    const selected = state.compare.flatMap((id) => {
      const found = findTool(id);
      return found ? [found] : [];
    });
    const alternatives = filteredTools().filter((tool) => !state.compare.includes(tool.id));
    const items = featureDefinitions.map((definition) => {
      const records = selected.map((tool) => featureSupportRecord(tool, definition));
      const values = selected.map((tool) => featureSupport(tool, definition));
      return comparisonItem(featureName(definition.id), values, selected.map((tool, index) => {
        const record = records[index];
        return `<div class="comparison-value" data-support="${esc3(values[index])}">${supportBadge(values[index] ?? "unknown")}${record ? `<button class="comparison-evidence" type="button" data-evidence-tool="${esc3(tool.id)}" data-evidence-nip="${esc3(record.key)}" data-evidence-feature="${definition.id}">${esc3(t("explorer.nipEvidence"))}</button>` : ""}</div>`;
      }), `<span class="feature-symbol" aria-hidden="true">${iconSvg(definition.icon)}</span>`);
    });
    const basics = [
      // OS / カテゴリも observedText と同じ扱い: 観測がない欄は「不明」語彙で埋め、空欄にも捏造にもしない。
      comparisonItem(t("explorer.os"), selected.map((tool) => osText(tool)), selected.map((tool) => `<div class="comparison-value">${esc3(osText(tool))}</div>`)),
      comparisonItem(t("explorer.category"), selected.map((tool) => categoryText(tool)), selected.map((tool) => `<div class="comparison-value">${esc3(categoryText(tool))}</div>`)),
      comparisonItem("OSS", selected.map((tool) => displayLicense(tool)), selected.map((tool) => `<div class="comparison-value">${esc3(displayLicense(tool))}</div>`)),
      // §21.10 item 4: レコードの状態とプロジェクトの生存は別行。ひとつのバッジに混ぜない。
      comparisonItem(t("explorer.recordState"), selected.map((tool) => tool.recordState), selected.map((tool) => `<div class="comparison-value">${esc3(t(`recordStates.${tool.recordState}`))}</div>`)),
      comparisonItem(t("explorer.liveness"), selected.map((tool) => livenessValue(tool)), selected.map((tool) => `<div class="comparison-value" data-liveness="${esc3(livenessValue(tool))}">${esc3(t(`liveness.${livenessValue(tool)}`))} ${livenessValue(tool) === "unknown" ? unknownMarker() : ""}${rowLiveness(tool).length ? `<small>${esc3(t("explorer.livenessUncounted", { count: rowLiveness(tool).length }))}</small>` : ""}</div>`)),
      comparisonItem(t("explorer.capabilityClaims"), selected.map((tool) => String(claimSummary(tool).total)), selected.map((tool) => `<div class="comparison-value" data-claim-total="${claimSummary(tool).total}">${claimSummary(tool).total ? esc3(Object.entries(claimSummary(tool).byFamily).map(([family, count]) => t("explorer.claimFamilyCount", { family: family.toUpperCase(), count: count ?? 0 })).join(" \xB7 ")) : `${esc3(t("explorer.noClaimPublished"))} ${unknownMarker()}`}</div>`)),
      // observed が空のリレー由来エントリでも空欄にせず、observedText の「不明」語彙で出す。
      comparisonItem(t("explorer.observed"), selected.map((tool) => observedText(tool)), selected.map((tool) => `<div class="comparison-value">${esc3(observedText(tool).split(" ")[0])}</div>`))
    ];
    const orderedFeatures = [...items].sort((a, b) => Number(b.different) - Number(a.different));
    const orderedBasics = [...basics].sort((a, b) => Number(b.different) - Number(a.different));
    const actionLabel = state.compare.length >= 3 ? t("explorer.replaceComparison") : t("explorer.addComparison");
    els.compareDialog.setAttribute("aria-label", t("explorer.compareTitle", { count: selected.length }));
    els.compareContent.innerHTML = `${dialogHead(t("explorer.differencesFirst"), t("explorer.compareTitle", { count: selected.length }))}<div class="comparison-edit"><label>${esc3(t("explorer.alternative"))}<select id="compare-alternative">${alternatives.map((tool) => `<option value="${tool.id}">${esc3(tool.name)}</option>`).join("")}</select></label>${state.compare.length >= 3 ? `<label>${esc3(t("explorer.replaceTarget"))}<select id="compare-replace-target">${selected.map((tool) => `<option value="${tool.id}">${esc3(tool.name)}</option>`).join("")}</select></label>` : "<span></span>"}<button class="secondary" type="button" data-compare-apply ${alternatives.length ? "" : "disabled"}>${esc3(actionLabel)}</button></div>${selected.length < 2 ? `<p class="comparison-incomplete">${esc3(t("explorer.needTwo"))}</p>` : ""}<div class="comparison-body" style="--candidate-count:${Math.max(selected.length, 1)}"><div class="comparison-candidates">${selected.map((tool) => `<div class="comparison-candidate"><strong>${esc3(tool.name)}</strong><button type="button" data-compare-remove="${tool.id}" aria-label="${esc3(t("explorer.removeCandidate", { name: tool.name }))}">${esc3(t("explorer.removeShort"))}</button></div>`).join("")}</div><section class="comparison-group"><h3 class="comparison-group-title">${esc3(t("explorer.featuresSection"))}</h3>${orderedFeatures.map((item) => item.markup).join("")}</section><section class="comparison-group"><h3 class="comparison-group-title">${esc3(t("explorer.basicsSection"))}</h3>${orderedBasics.map((item) => item.markup).join("")}</section></div>`;
    if (shouldOpen) openDialog(els.compareDialog, context);
  }
  function reviewForm(tool) {
    const draft = state.reviewDrafts[tool.id] ?? {};
    const localPreview = draft.localImage ? `<img src="${esc3(draft.localImage)}" alt="${esc3(t("explorer.imageTitle"))}">${draft.localFilename ? `<small>${esc3(draft.localFilename)}</small>` : ""}` : "";
    return `<form class="review-form" data-review-form="${tool.id}" data-local-image="${esc3(draft.localImage || "")}" data-local-filename="${esc3(draft.localFilename || "")}"><h3>${esc3(t("explorer.writeReview"))}</h3><label class="review-body">${esc3(t("explorer.body"))}<textarea name="body" placeholder="${esc3(t("explorer.bodyPlaceholder"))}">${esc3(draft.body || "")}</textarea></label><div class="local-image-field"><label class="local-file">${esc3(t("explorer.deviceImage"))}<input type="file" name="deviceImage" accept="image/*"></label><div class="local-image-preview">${localPreview}</div></div><label>${esc3(t("explorer.osOptional"))}<input name="os" value="${esc3(draft.os || "")}"></label><label>${esc3(t("explorer.versionOptional"))}<input name="version" value="${esc3(draft.version || "")}"></label><label>${esc3(t("explorer.useOptional"))}<input name="use" value="${esc3(draft.use || "")}"></label><label>${esc3(t("explorer.ratingOptional"))}<select name="rating"><option value="">${esc3(t("optional"))}</option>${[5, 4, 3, 2, 1].map((value) => `<option ${String(draft.rating) === String(value) ? "selected" : ""}>${value}</option>`).join("")}</select></label><div class="review-preview" aria-live="polite"></div><button class="primary" type="submit">${esc3(t("explorer.createReview"))}</button></form>`;
  }
  function fieldValue(form, name) {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
      return control.value;
    }
    return "";
  }
  function captureReviewDraft() {
    const form = els.reviewDialog.querySelector("[data-review-form]");
    if (!form) return;
    const toolId = form.dataset["reviewForm"];
    if (toolId === void 0) return;
    state.reviewDrafts[toolId] = {
      body: fieldValue(form, "body"),
      localImage: form.dataset["localImage"] ?? "",
      localFilename: form.dataset["localFilename"] ?? "",
      os: fieldValue(form, "os"),
      version: fieldValue(form, "version"),
      use: fieldValue(form, "use"),
      rating: fieldValue(form, "rating")
    };
  }
  function renderReview(context, shouldOpen = true) {
    if (!context.clearDraft) captureReviewDraft();
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool);
    els.reviewDialog.setAttribute("aria-label", t("explorer.reviewTitle", { name: tool.name }));
    els.reviewContent.innerHTML = `${dialogHead(t("explorer.reviewCount", { count: reviews.length }), t("explorer.reviewTitle", { name: tool.name }))}<div class="review-toolbar"><button class="secondary" type="button" data-gallery-tool="${tool.id}">${esc3(t("explorer.openGallery"))}</button></div><section class="review-list">${reviews.map((review) => reviewItem(tool, review)).join("")}</section>${reviewForm(tool)}`;
    if (shouldOpen) openDialog(els.reviewDialog, context);
    if (context.reviewId) restoreFocus(`[data-review-id="${CSS.escape(context.reviewId)}"] button`, els.reviewDialog);
  }
  function profileDetails(id) {
    const seed = i18n.value("explorer.reviewsSeed");
    if (id === "local") {
      return {
        name: seedText(seed, "localName"),
        bio: seedText(seed, "localBio"),
        npub: viewer.status === "signedIn" ? viewer.npub : null,
        joined: null,
        spread: null,
        posts: null,
        useful: null,
        notUseful: null
      };
    }
    const profile = profiles[id];
    return {
      name: profile?.name ?? "",
      bio: id === "a" ? seedText(seed, "aBio") : seedText(seed, "bBio"),
      npub: profile?.npub ?? null,
      joined: profile?.joined ?? null,
      spread: id === "a" ? seedText(seed, "aSpread") : seedText(seed, "bSpread"),
      posts: id === "a" ? seedText(seed, "aPosts") : seedText(seed, "bPosts"),
      useful: profile?.useful ?? null,
      notUseful: profile?.notUseful ?? null
    };
  }
  function profileHistory(profileId) {
    const rows = tools;
    return rows.flatMap((tool) => allReviews(tool).filter((review) => review.profile === profileId).map((review) => ({ tool, review }))).slice(0, 4);
  }
  function renderProfile(context, shouldOpen = true) {
    const profile = profileDetails(context.profileId);
    const history = profileHistory(context.profileId);
    const fact = (value) => value == null ? unknownMarker() : esc3(value);
    const votes = profile.useful == null || profile.notUseful == null ? unknownMarker() : `${profile.useful} / ${profile.notUseful}`;
    const npubLine = profile.npub ? `<p class="profile-npub" data-profile-npub>${esc3(profile.npub)}</p>` : `<p class="profile-npub is-signed-out" data-profile-npub>${esc3(t("explorer.viewer.signedOut"))}</p>`;
    els.profileDialog.setAttribute("aria-label", t("explorer.profileTitle"));
    els.profileContent.innerHTML = `${dialogHead(t("explorer.profileTitle"), profile.name)}${npubLine}<p>${esc3(profile.bio)}</p><dl class="profile-facts"><div><dt>${esc3(t("explorer.joined"))}</dt><dd>${fact(profile.joined)}</dd></div><div><dt>${esc3(t("explorer.activity"))}</dt><dd>${fact(profile.spread)}</dd></div><div><dt>${esc3(t("explorer.posting"))}</dt><dd>${fact(profile.posts)}</dd></div><div><dt>${esc3(t("explorer.voteHistory"))}</dt><dd>${votes}</dd></div></dl><section class="profile-history"><h3>${esc3(t("explorer.history"))}</h3>${history.map(({ tool, review }) => `<article><div><strong>${esc3(tool.name)}</strong><span>${esc3(review.date)}</span></div><p>${esc3(review.body)}</p><button class="secondary" type="button" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc3(t("explorer.originalReview"))}</button></article>`).join("")}</section>`;
    if (shouldOpen) openDialog(els.profileDialog, context);
  }
  function renderGallery(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool).flatMap((review) => review.image ? [{ ...review, image: review.image }] : []);
    els.galleryDialog.setAttribute("aria-label", t("explorer.galleryTitle", { name: tool.name }));
    els.galleryContent.innerHTML = `${dialogHead(t("explorer.openGallery"), t("explorer.galleryTitle", { name: tool.name }))}<section class="gallery-grid">${reviews.length ? reviews.map((review) => `<article class="gallery-card">${screenshotMarkup(review.image, false, t("explorer.imageAlt", { author: review.author, date: review.date }))}<dl><div><dt>${esc3(t("explorer.reviewer"))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc3(review.author)}</button></dd></div><div><dt>${esc3(t("explorer.postedAt"))}</dt><dd>${esc3(review.date)}</dd></div><div><dt>OS / version</dt><dd>${esc3(review.os || t("explorer.notEntered"))} / ${esc3(review.version || t("explorer.notEntered"))}</dd></div></dl><div><button type="button" class="primary" data-open-image="${tool.id}" data-image-review="${review.id}">${esc3(t("explorer.enlarge"))}</button><button type="button" class="secondary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc3(t("explorer.originalReview"))}</button></div></article>`).join("") : `<p>${esc3(t("explorer.galleryEmpty"))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.galleryDialog, context);
  }
  function renderImage(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const review = tool ? allReviews(tool).find((item) => item.id === context.reviewId) : void 0;
    if (!tool || !review?.image) return;
    els.imageDialog.setAttribute("aria-label", t("explorer.imageTitle"));
    els.imageContent.innerHTML = `${dialogHead(t("explorer.imageTitle"), review.image.label)}<div class="image-stage">${screenshotMarkup(review.image, false, t("explorer.imageAlt", { author: review.author, date: review.date }))}</div><dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.reviewer"))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc3(review.author)}</button></dd></div><div><dt>${esc3(t("explorer.postedAt"))}</dt><dd>${esc3(review.date)}</dd></div></dl><button type="button" class="primary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc3(t("explorer.originalReview"))}</button>`;
    if (shouldOpen) openDialog(els.imageDialog, context);
  }
  function renderVoteBasis(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const review = allReviews(tool).find((item) => item.id === context.reviewId);
    if (!tool || !review) return;
    const counts = reviewCounts(review);
    els.evidenceDialog.setAttribute("aria-label", t("explorer.voteBreakdown"));
    els.evidenceContent.innerHTML = `${dialogHead(t("explorer.communityVotes"), t("explorer.voteBreakdown"))}<dl class="nip-evidence-grid"><div><dt>${esc3(t("explorer.helpfulVotes"))}</dt><dd>${counts.helpful}</dd></div><div><dt>${esc3(t("explorer.unhelpfulVotes"))}</dt><dd>${counts.unhelpful}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function rerenderOpenDialogs() {
    for (const dialog of dialogs) {
      if (!dialog.open) continue;
      const context = dialogContexts.get(dialog);
      if (!context) continue;
      if (context.type === "evidence") renderEvidence(context, false);
      if (context.type === "toolDetail") renderToolDetail(context, false);
      if (context.type === "resource") renderResource(context, false);
      if (context.type === "featureBasis") renderFeatureBasis(context, false);
      if (context.type === "compare") renderCompare(context, false);
      if (context.type === "review") renderReview(context, false);
      if (context.type === "profile") renderProfile(context, false);
      if (context.type === "gallery") renderGallery(context, false);
      if (context.type === "image") renderImage(context, false);
      if (context.type === "voteBasis") renderVoteBasis(context, false);
    }
  }
  let toastTimer;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }
  function resetFilters() {
    Object.assign(state, { features: [], query: "", platform: "all", category: "all", toolStatus: "all", support: DEFAULT_SUPPORT, oss: "all", tool: "", savedOnly: false, nipQuery: "", uiState: "normal" });
    renderAll();
  }
  function removeCondition(key) {
    const item = activeConditions().find((condition) => condition.key === key);
    if (!item) return;
    Object.assign(state, item.overrides);
    if (!state.features.length) state.support = DEFAULT_SUPPORT;
    state.uiState = "normal";
    renderAll();
  }
  function toggleCompare(id, checked) {
    if (checked && state.compare.length >= 3) {
      const box = document.querySelector(`[data-compare-tool="${CSS.escape(id)}"]`);
      if (box) box.checked = false;
      toast(t("explorer.compareLimit"));
      return;
    }
    state.compare = checked ? [...state.compare, id] : state.compare.filter((value) => value !== id);
    renderCompareActions();
  }
  function syncComparisonCheckboxes() {
    document.querySelectorAll("[data-compare-tool]").forEach((input) => {
      const id = input.dataset["compareTool"];
      input.checked = id !== void 0 && state.compare.includes(id);
    });
  }
  function attr(element, key) {
    return element.dataset[key] ?? "";
  }
  function selectValue(selector) {
    const element = document.querySelector(selector);
    return element ? element.value : "";
  }
  function inputValue(selector) {
    const element = document.querySelector(selector);
    return element ? element.value : "";
  }
  function targetElement(event) {
    return event.target instanceof Element ? event.target : null;
  }
  document.addEventListener("pointerdown", (event) => {
    const target = targetElement(event);
    const found = target?.closest("button,a,input,select,textarea,[tabindex]");
    lastInteractive = found instanceof HTMLElement ? found : null;
  }, true);
  document.addEventListener("click", (event) => {
    const target = targetElement(event);
    if (!target) return;
    const language2 = target.closest("[data-language]");
    if (language2) {
      captureReviewDraft();
      const key = focusKey(language2);
      const openerKeys = dialogs.map((dialog) => dialog.open ? focusKey(dialogOpeners.get(dialog) ?? null) : null);
      i18n.set(attr(language2, "language"));
      dialogs.forEach((dialog, index) => {
        const openerKey = openerKeys[index];
        const replacement = openerKey ? document.querySelector(openerKey) : null;
        if (replacement instanceof HTMLElement) dialogOpeners.set(dialog, replacement);
      });
      const openModal = dialogs.filter((dialog) => dialog.open).at(-1);
      if (openModal) requestAnimationFrame(() => {
        if (!openModal.contains(document.activeElement)) dialogFocusables(openModal)[0]?.focus();
      });
      else restoreFocus(key);
      return;
    }
    if (target.closest("[data-viewer-signin]")) {
      signIn();
      return;
    }
    if (target.closest("[data-viewer-signout]")) {
      signOut();
      return;
    }
    const feature = target.closest("[data-select-feature]");
    if (feature) {
      const id = attr(feature, "selectFeature");
      state.features = state.features.includes(id) ? state.features.filter((value) => value !== id) : [...state.features, id];
      if (!state.features.length) state.support = DEFAULT_SUPPORT;
      state.uiState = "normal";
      renderAll();
      restoreFocus(`[data-select-feature="${id}"]`);
      return;
    }
    const supportMode = target.closest("[data-support-mode]");
    if (supportMode) {
      state.support = attr(supportMode, "supportMode");
      state.uiState = "normal";
      renderAll();
      restoreFocus("#support-filter");
      return;
    }
    const categoryButton = target.closest("[data-category-filter]");
    if (categoryButton) {
      state.category = attr(categoryButton, "categoryFilter");
      renderAll();
      restoreFocus(`[data-category-filter="${state.category}"]`);
      return;
    }
    const detail = target.closest("[data-feature-detail]");
    if (detail) {
      renderToolDetail({ type: "toolDetail", toolId: attr(detail, "featureDetail") });
      return;
    }
    const evidence = target.closest("[data-evidence-tool]");
    if (evidence) {
      renderEvidence({ type: "evidence", toolId: attr(evidence, "evidenceTool"), nip: attr(evidence, "evidenceNip"), featureId: attr(evidence, "evidenceFeature") });
      return;
    }
    const resource = target.closest("[data-resource-tool]");
    if (resource) {
      renderResource({ type: "resource", toolId: attr(resource, "resourceTool"), resourceType: attr(resource, "resourceType") });
      return;
    }
    const like = target.closest("[data-like-tool]");
    if (like) {
      state.likes[attr(like, "likeTool")] = !state.likes[attr(like, "likeTool")];
      renderResults();
      rerenderOpenDialogs();
      toast(t("explorer.toastLiked"));
      return;
    }
    const bookmark = target.closest("[data-bookmark-tool]");
    if (bookmark) {
      const id = attr(bookmark, "bookmarkTool");
      state.bookmarks[id] = state.bookmarks[id] ? null : { public: false };
      renderResults();
      rerenderOpenDialogs();
      toast(t("explorer.toastBookmarked"));
      return;
    }
    const reviewer = target.closest("[data-reviewer]");
    if (reviewer) {
      renderProfile({ type: "profile", profileId: attr(reviewer, "reviewer") });
      return;
    }
    const vote = target.closest("[data-review-vote]");
    if (vote) {
      const cast = attr(vote, "reviewVote");
      if (cast !== "helpful" && cast !== "unhelpful") return;
      const current = state.reviewVotes[attr(vote, "reviewId")];
      state.reviewVotes[attr(vote, "reviewId")] = current === cast ? null : cast;
      renderReview({ type: "review", toolId: attr(vote, "reviewToolId"), reviewId: attr(vote, "reviewId") }, false);
      toast(t("explorer.toastVoted"));
      return;
    }
    const basis = target.closest("[data-vote-basis]");
    if (basis) {
      renderVoteBasis({ type: "voteBasis", toolId: attr(basis, "voteTool"), reviewId: attr(basis, "voteBasis") });
      return;
    }
    const gallery = target.closest("[data-gallery-tool]");
    if (gallery) {
      renderGallery({ type: "gallery", toolId: attr(gallery, "galleryTool") });
      return;
    }
    const image = target.closest("[data-open-image]");
    if (image) {
      renderImage({ type: "image", toolId: attr(image, "openImage"), reviewId: attr(image, "imageReview") });
      return;
    }
    const review = target.closest("[data-review-tool]");
    if (review) {
      const child = review.closest("dialog");
      if (attr(review, "reviewJump") && child && child !== els.reviewDialog) child.close();
      renderReview({ type: "review", toolId: attr(review, "reviewTool"), reviewId: attr(review, "reviewJump") || "" }, !els.reviewDialog.open);
      return;
    }
    const close = target.closest("[data-close-dialog]");
    if (close) {
      close.closest("dialog")?.close();
      return;
    }
    const remove = target.closest("[data-remove-condition]");
    if (remove) {
      removeCondition(attr(remove, "removeCondition"));
      return;
    }
    if (target.closest("[data-reset-all]")) {
      resetFilters();
      return;
    }
    const compareRemove = target.closest("[data-compare-remove]");
    if (compareRemove) {
      state.compare = state.compare.filter((id) => id !== attr(compareRemove, "compareRemove"));
      renderCompareActions();
      syncComparisonCheckboxes();
      if (state.compare.length) renderCompare({ type: "compare" }, false);
      else els.compareDialog.close();
      return;
    }
    if (target.closest("[data-compare-apply]")) {
      const alternative = selectValue("#compare-alternative");
      if (!alternative) return;
      if (state.compare.length >= 3) {
        const replaceTarget = selectValue("#compare-replace-target");
        state.compare = state.compare.map((id) => id === replaceTarget ? alternative : id);
      } else state.compare.push(alternative);
      renderCompareActions();
      syncComparisonCheckboxes();
      renderCompare({ type: "compare" }, false);
      return;
    }
    if (target.closest("[data-show-feature-basis]")) {
      renderFeatureBasis();
      return;
    }
    const relayAction = target.closest("[data-relay-action]");
    if (relayAction) {
      if (attr(relayAction, "relayAction") === "reload") loadRelayCatalog();
      return;
    }
    if (target.closest("[data-graph-connect]")) {
      signIn().then(() => {
        if (viewer.status === "signedIn") loadRelayCatalog({ viewerPubkey: "" });
      });
      return;
    }
    if (target.closest("[data-graph-apply]")) {
      loadRelayCatalog({ viewerPubkey: inputValue("#graph-npub"), useNip07: false });
      return;
    }
    const setState2 = target.closest("[data-set-state]");
    if (setState2) {
      const next = attr(setState2, "setState");
      if (isUiState(next)) {
        state.uiState = next;
        renderAll();
      }
    }
  });
  els.query.addEventListener("input", () => {
    state.query = els.query.value;
    state.uiState = "normal";
    renderResults();
  });
  need("#open-compare", HTMLButtonElement).addEventListener("click", () => renderCompare());
  need("#clear-compare", HTMLButtonElement).addEventListener("click", () => {
    state.compare = [];
    renderCompareActions();
    syncComparisonCheckboxes();
  });
  const SELECT_FILTERS = {
    "platform-filter": "platform",
    "tool-status-filter": "toolStatus",
    "support-filter": "support",
    "oss-filter": "oss"
  };
  document.addEventListener("change", (event) => {
    const target = targetElement(event);
    if (!target) return;
    const field = SELECT_FILTERS[target.id];
    if (field && target instanceof HTMLSelectElement) {
      state[field] = target.value;
      state.uiState = "normal";
      renderAll();
      return;
    }
    if (target.id === "saved-only" && target instanceof HTMLInputElement) {
      state.savedOnly = target.checked;
      renderAll();
      return;
    }
    if (target.matches("[data-compare-tool]") && target instanceof HTMLInputElement) {
      toggleCompare(attr(target, "compareTool"), target.checked);
      return;
    }
    if (target.matches("[data-public-bookmark]") && target instanceof HTMLInputElement) {
      const bookmark = state.bookmarks[attr(target, "publicBookmark")];
      if (bookmark) bookmark.public = target.checked;
      renderResults();
      rerenderOpenDialogs();
      toast(t("explorer.toastPublic"));
      return;
    }
    const file = target.closest('input[name="deviceImage"]');
    if (file) {
      const form = file.closest("form");
      const selected = file.files?.[0];
      if (!form || !selected?.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const image = String(reader.result);
        form.dataset["localImage"] = image;
        form.dataset["localFilename"] = selected.name;
        const preview = form.querySelector(".local-image-preview");
        if (preview) preview.innerHTML = `<img src="${esc3(image)}" alt="${esc3(t("explorer.imageTitle"))}"><small>${esc3(selected.name)}</small>`;
        captureReviewDraft();
      };
      reader.readAsDataURL(selected);
    }
  });
  document.addEventListener("input", (event) => {
    const target = targetElement(event);
    if (target instanceof HTMLInputElement && target.id === "nip-query") {
      state.nipQuery = target.value;
      renderResults();
    }
  });
  const PUBLISH_FIELDS = {
    "publish-d": "dLocal",
    "publish-name": "name",
    "publish-summary": "summary",
    "publish-homepage": "homepage",
    "publish-topics": "topics"
  };
  document.addEventListener("input", (event) => {
    const target = targetElement(event);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const field = PUBLISH_FIELDS[target.id];
    if (!field) return;
    publish[field] = target.value;
    saveDraft2();
    refreshPublishState();
  });
  document.addEventListener("submit", (event) => {
    const target = targetElement(event);
    if (!target) return;
    if (target.closest("[data-publish-form]")) {
      event.preventDefault();
      void submitPublish();
      return;
    }
    const form = target.closest("form[data-review-form]");
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const data2 = new FormData(form);
    const body = String(data2.get("body") ?? "").trim();
    const localImage = form.dataset["localImage"];
    const image = localImage ? { label: form.dataset["localFilename"] || t("explorer.imageTitle"), src: localImage } : null;
    const preview = form.querySelector(".review-preview");
    if (!body && !image) {
      if (preview) preview.textContent = t("explorer.chooseBodyOrImage");
      return;
    }
    const toolId = form.dataset["reviewForm"] ?? "";
    const seed = i18n.value("explorer.reviewsSeed");
    const rating = data2.get("rating");
    const review = {
      id: `${toolId}-current-${Date.now()}`,
      profile: "local",
      author: seedText(seed, "localName"),
      date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      body,
      os: String(data2.get("os") ?? ""),
      version: String(data2.get("version") ?? ""),
      use: String(data2.get("use") ?? ""),
      rating: rating ? Number(rating) : null,
      helpful: 0,
      unhelpful: 0,
      image
    };
    state.reviews[toolId] = [...state.reviews[toolId] ?? [], review];
    delete state.reviewDrafts[toolId];
    renderReview({ type: "review", toolId, reviewId: review.id, clearDraft: true }, false);
    const nextPreview = els.reviewDialog.querySelector(".review-preview");
    if (nextPreview) nextPreview.textContent = t("explorer.addedReview");
  });
  dialogs.forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = dialogFocusables(dialog);
      const first2 = items[0];
      const last2 = items.at(-1);
      if (!first2 || !last2) return;
      if (event.shiftKey && document.activeElement === first2) {
        event.preventDefault();
        last2.focus();
      } else if (!event.shiftKey && document.activeElement === last2) {
        event.preventDefault();
        first2.focus();
      }
    });
    dialog.addEventListener("close", () => {
      const opener = dialogOpeners.get(dialog);
      if (!opener?.isConnected) return;
      const parent = opener.closest("dialog");
      if (!parent || parent.open) setTimeout(() => opener.focus(), 0);
    });
  });
  i18n.onChange(() => renderAll());
  window.addEventListener("offline", () => {
    state.uiState = "offline";
    renderAll();
  });
  window.addEventListener("online", () => {
    state.uiState = "normal";
    renderAll();
  });
  const setState = (next) => {
    if (isUiState(next)) {
      state.uiState = next;
      renderAll();
    }
  };
  const legacy = location.hash.match(/^#feature-([a-z]+)$/)?.[1];
  const initial = location.hash.match(/^#features-([a-z-]+)$/)?.[1]?.split("-") ?? [];
  state.features = legacy && featureById[legacy] ? [legacy] : initial.filter((id) => featureById[id]);
  restoreViewerSession();
  restoreDraft2();
  renderAll();
  if (relayRequested) {
    window.addEventListener("unhandledrejection", (event) => {
      event.preventDefault();
    });
    requestAnimationFrame(() => {
      void loadRelayCatalog();
    });
  }
  return {
    setState,
    loadRelayCatalog,
    onRelayResult: (listener) => {
      relayResultListeners.push(listener);
    }
  };
}

// src/entry/nip-explorer.ts
var catalog = {
  POLICY,
  SOFTWARE_SCHEMA,
  SOFTWARE_D_PREFIX,
  validateSoftwareEvent,
  validateCurationSetEvent,
  validateFollowListEvent,
  validateDeletionEvent,
  collectDeletions,
  selectAddressableWinner,
  selectSoftwareWinners,
  deriveGraph,
  curationMembership,
  orderEntries,
  /* buildCatalog is re-typed at the boundary only so a caller in a plain .js test
     hands it a value this signature accepts; the function itself is untouched. */
  buildCatalog: (input) => buildCatalog(input),
  chunkFilters,
  groupByAuthor,
  decodeNpub,
  encodeNpub,
  isValidCoordinate,
  compareCodePoints,
  cache,
  loadCatalog,
  buildSoftwareDraft,
  publishSoftwareRecord,
  stats
};
var canonical = {
  utf8Encode,
  utf8ByteLength,
  bytesEqual,
  isLowercaseSha256Hex,
  sha256Hex,
  strictParse,
  canonicalize,
  isCanonicalBytes
};
window.NOSMAPS_I18N = i18n;
window.NOSMAPS_ICONS = icons;
window.NOSMAPS_CATALOG = catalog;
window.NOSMAPS_CANONICAL = canonical;
var explorer = mountExplorer(readCatalogueData());
explorer.onRelayResult((result) => {
  window.__NOSMAPS_RELAY_RESULT__ = result;
});
window.__NOSMAPS_RELAY_LOAD__ = explorer.loadRelayCatalog;
window.__NOSMAPS_SET_STATE__ = explorer.setState;
mountSiteFooter();
/*! Bundled license information:

rx-nostr/dist/rx-nostr.js:
  (*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
/*! Bundled license information:

@rx-nostr/crypto/dist/crypto.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
  (*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
