/* The explorer application. Ported from nip-explorer.js (issue #11) with the
   behaviour left exactly as it was: this file is the old IIFE, typed.

   It stayed one module on purpose. The original is a single closure whose render
   functions call each other in both directions (renderViewer -> renderPublish,
   renderAll -> everything, every dialog -> rerenderOpenDialogs); splitting it into
   files would have meant inventing an initialisation order that the original does
   not have, and that is exactly how a "port" starts rendering something subtly
   different. The pure parts that CAN be lifted out already were, in run 2
   (domain/explorer.ts, ui/explorer/{params,dom,relay-row,draft-storage}.ts), and
   they are imported here rather than re-derived.

   ui layer: it renders and it reads the DOM. Everything pure comes from
   src/domain/, everything relay-facing from src/data/, and the globals the page
   publishes live in src/entry/nip-explorer.ts. */

import type {
  AccountSwitchingObservation, CapabilityClaim, Data, LivenessObservation, NipRegistryEntry,
  ProvenanceSource, Tool, ToolClaim
} from '../../domain/entry.ts';
import type {CatalogEntry, CuratorSummary} from '../../domain/catalogue.ts';
import {
  accountSwitchingSupport, DEFAULT_SUPPORT, featureById, featureDefinitions, isUiState,
  OBSERVED_FEATURE_ID, precedenceOf as precedenceOfIn, supportPasses, UNSTATED_SUPPORT,
  metadataValues, ossState, isOss, normaliseNipQuery,
  type DisplayResult, type FeatureDefinition, type UiState
} from '../../domain/explorer.ts';
import {isValidCoordinate} from '../../domain/event.ts';
import {isSortKey, sortDimension, sortRows, SORT_KEYS, type SortKey} from '../../domain/sorting.ts';
import {stackRecords, STACK_DRAWN_LIMIT, type RecordStack} from '../../domain/stacks.ts';
import {decodeNpub, encodeNpub} from '../../domain/npub.ts';
import {POLICY, SOFTWARE_D_PREFIX} from '../../domain/policy.ts';
import {validateSoftwareEvent, type SoftwareRecord} from '../../domain/records.ts';
import type {NostrEvent} from '../../domain/event.ts';
import {loadCatalog, type LoadCatalogOptions, type LoadedCatalog} from '../../data/load.ts';
import {
  buildSoftwareDraft, fetchMyRecords, MANAGE_LIMIT, publishSoftwareRecord, withdrawSoftwareRecord,
  type MyRecordsResult, type MyRecordsState, type Nip07Signer, type PublishResult, type RelayReport
} from '../../data/publish.ts';
import {
  observeReactions, publishReaction, retractReaction,
  type ReactionObservation, type ReactionResult
} from '../../data/reactions.ts';
import {i18n, type I18nNode, type I18nVariables, type Language} from '../i18n.ts';
import {icons} from '../icons.ts';
import {$, esc, focusableElements} from './dom.ts';
import {readExplorerParams} from './params.ts';
import {formatObserved, relayEntryToRow, shortKey, type RelayRow} from './relay-row.ts';
import {
  clearStoredDraft, restoreDraft as restoreStoredDraft, saveDraft as saveDraftFields,
  type PublishDraftFields
} from './draft-storage.ts';

/** A row on screen is either a collected catalogue entry or a live relay record.
    They are NOT the same shape and the difference is load-bearing: a relay record
    states no licence, no platform and no capability claims, so those fields are
    absent rather than empty. `provenance` discriminates them, exactly as the
    original code branched on it. */
export type Row = Tool | RelayRow;

/** The claims a row carries. A relay row carries none — it has not been asked. */
function rowCapabilities(row: Row): readonly CapabilityClaim[] {
  return row.provenance === 'relay' ? [] : row.capabilities;
}

/** issue #10: the account-switching observation a row carries. A relay row carries
    none for the same reason it carries no claims — a live 30078 record states
    nothing about it and nobody has gone and looked — so it is null, which reads as
    `unknown` and never as "does not support it". */
function rowAccountSwitching(row: Row): AccountSwitchingObservation | null {
  return row.provenance === 'relay' ? null : row.accountSwitching;
}

/* A relay row's topics are the `t` tags of the 30078 record. Most of them are
   bookkeeping — every record carries the discovery topic — so the one that is
   shown is the one `relayEntryToRow` already resolved against the seed
   vocabulary, and only when it actually resolved. `category` alone is a display
   fallback ('clients') and states nothing, which is why `categoryObserved` is
   the gate: an unresolved record reads Unknown rather than being filed under a
   category nobody published. Returning [] unconditionally here made both fields
   dead code and printed "Category: Unknown" on a record that named one. */
function rowTopics(row: Row): readonly string[] {
  if (row.provenance !== 'relay') return row.topics;
  return row.categoryObserved ? [row.category] : [];
}

function rowLiveness(row: Row): readonly LivenessObservation[] {
  return row.provenance === 'relay' ? [] : row.liveness;
}

function rowLicense(row: Row): string {
  return row.license;
}

/** A locally-entered review. Nothing here is observed from a relay; it lives in
    memory for the length of the session, which is what the original did too. */
interface ReviewImage {
  readonly label: string;
  readonly src: string;
}

interface Review {
  readonly id: string;
  readonly profile: string;
  readonly author: string;
  readonly date: string;
  readonly body: string;
  readonly os: string;
  readonly version: string;
  readonly use: string;
  readonly rating: number | null;
  readonly helpful: number;
  readonly unhelpful: number;
  readonly image: ReviewImage | null;
}

type ReviewVote = 'helpful' | 'unhelpful';

interface ReviewDraft {
  readonly body?: string;
  readonly os?: string;
  readonly version?: string;
  readonly use?: string;
  readonly rating?: string;
  /** A data: URL for an image chosen on this device, plus the file name that was
      chosen. Both are held on the form element and re-read from there. */
  readonly localImage?: string;
  readonly localFilename?: string;
}

/** A bookmark the viewer made. `null` is "not bookmarked" — the original stored
    exactly that, and the public flag is mutable because the checkbox toggles it. */
interface Bookmark {
  public: boolean;
}

/** What is known about the reactions on one row.

    `count: null` is "nobody has looked", which is a different fact from a look
    that found none (invariant I8) — the first prints Unknown, the second prints 0.
    `mine` is the id of the viewer's own live reaction, and it is what a retraction
    (kind 5) has to name, so it is carried rather than recomputed. */
interface ReactionView {
  readonly count: number | null;
  readonly mine: string | null;
}

interface ExplorerState {
  features: string[];
  query: string;
  platform: string;
  category: string;
  toolStatus: string;
  support: string;
  oss: string;
  tool: string;
  savedOnly: boolean;
  nipQuery: string;
  /** issue #1: how the candidate list is presented. Not a filter — it removes
      nothing — so it is deliberately not one of the removable condition pills. */
  sort: SortKey;
  compare: string[];
  reactions: Record<string, ReactionView | undefined>;
  bookmarks: Record<string, Bookmark | null | undefined>;
  reviews: Record<string, Review[] | undefined>;
  reviewVotes: Record<string, ReviewVote | null | undefined>;
  reviewDrafts: Record<string, ReviewDraft | undefined>;
  uiState: UiState;
}

/** What a dialog is currently showing. The union is what makes re-rendering an
    open dialog on a language change legal: `type` says which renderer owns it,
    and each renderer receives exactly the fields it needs — no optional grab-bag. */
type DialogContext =
  | {readonly type: 'evidence'; readonly toolId: string; readonly nip: string; readonly featureId?: string}
  | {readonly type: 'toolDetail'; readonly toolId: string}
  | {readonly type: 'resource'; readonly toolId: string; readonly resourceType: string}
  | {readonly type: 'featureBasis'}
  | {readonly type: 'compare'}
  | {readonly type: 'review'; readonly toolId: string; readonly reviewId: string; readonly clearDraft?: boolean}
  | {readonly type: 'profile'; readonly profileId: string}
  | {readonly type: 'gallery'; readonly toolId: string}
  | {readonly type: 'image'; readonly toolId: string; readonly reviewId: string}
  | {readonly type: 'voteBasis'; readonly toolId: string; readonly reviewId: string};

/** What a caller may hand `loadRelayCatalog`. The page also wires it to a click,
    so an Event arrives there too and means "no overrides" — exactly as before. */
export interface RelayLoadOverride extends LoadCatalogOptions {
  readonly viewerPubkey?: string | null;
}

/** What the relay round left on screen. `result` is null when the data layer is
    not loaded at all — a different thing from a round that returned nothing. */
interface RelayViewState {
  readonly active: boolean;
  readonly result: LoadedCatalog | null;
  readonly entries: readonly RelayRow[];
}

/** What the page publishes after mounting. These are diagnostic surfaces the
    tests drive the app through; they are returned rather than assigned to
    `window` from in here, so this module never touches a global and the entry
    stays the single place that decides what the page exposes. */
export interface ExplorerHandles {
  /** Drives the ui-state view (`?state=` has the same effect at load). */
  readonly setState: (next: string) => void;
  /** Runs a relay round and returns what it found, or null if it failed. The
      page also wires this to a click, so an Event is accepted and means "no
      overrides" — which is what the original did. */
  readonly loadRelayCatalog: (override?: RelayLoadOverride | Event) => Promise<LoadedCatalog | null>;
  /** The last relay result, republished on every round. Null after a failure —
      which is a different thing from a round that returned no entries. */
  readonly onRelayResult: (listener: (result: LoadedCatalog | null) => void) => void;
  /** issue #18: the relay rows as the list currently holds them, so a spec can
      read the `d` each row carries without scraping the rendered card. */
  readonly relayRows: () => readonly RelayRow[];
}

export function mountExplorer(data: Data): ExplorerHandles {

  const {tools, nipCatalog, seedTopics, registry, resultPrecedence} = data;
  const t = (key: string, variables?: I18nVariables): string => i18n.t(key, variables);
  const iconSvg = (name: string): string => icons.svg(name);
  /* §21.6 R6: seven seed topics. Every other topic is a free lowercase string rendered verbatim as
     itself -- never coerced into a seed term and never rendered as `unknown`. */
  const categories = seedTopics;
  const freeTopics = [...new Set(tools.flatMap(tool => tool.topics).filter(topic => !categories.includes(topic)))].sort();
  const allTopics = [...categories, ...freeTopics];
  /* §21.2 R2: the key is an opaque ASCII token, so `5A` and `7D` index exactly like `01`. */
  const nipByNumber: Readonly<Record<string, NipRegistryEntry | undefined>> =
    Object.fromEntries(nipCatalog.map(nip => [nip.number, nip]));
  /* §21.7 R7: eight result values. `unknown` is deliberately absent from the precedence list -- it
     is not a low rank, it is what is shown when no stated result exists (D7 / invariant I8). */
  const RESULT_VALUES: readonly DisplayResult[] = [...resultPrecedence, 'unknown'];
  const precedenceOf = (result: string): number => precedenceOfIn(result, resultPrecedence);
  const supportFilterValues: readonly string[] = ['all', DEFAULT_SUPPORT, ...RESULT_VALUES, 'out_of_family'];
  const explorerParams = readExplorerParams(location.search);
  const requestedState = explorerParams.requestedState;
  /* issue #2: `?tool=<id>` is how the top-page carousel hands an entry over. An id the catalogue
     does not hold is not a filter and not an error -- it is simply absent, and the list stays whole. */
  const requestedTool = explorerParams.requestedTool;
  const initialTool = tools.some(item => item.id === requestedTool) ? String(requestedTool) : '';
  const relayRequested = explorerParams.relayRequested;
  let relayState: RelayViewState | null = null;
  const state: ExplorerState = {
    features: [], query: '', platform: 'all', category: 'all', toolStatus: 'all', support: DEFAULT_SUPPORT, oss: 'all',
    tool: initialTool,
    savedOnly: false, nipQuery: '', sort: 'default', compare: [], reactions: {}, bookmarks: {}, reviews: {}, reviewVotes: {}, reviewDrafts: {},
    uiState: isUiState(requestedState) ? requestedState : 'normal'
  };

  const isSeedTopic = (id: string): boolean => categories.includes(id);
  /** A seed topic has a translated label and an icon; a free topic renders as
      itself, with the generic topic icon, and is never reported as a missing
      translation key. The seed branch reads the dictionary node, so the shape is
      checked rather than assumed — a malformed entry falls back to the id, which
      is visible, instead of rendering "undefined". */
  interface TopicVocabulary {
    readonly name: string;
    readonly icon: string;
    readonly description: string;
  }
  const nodeField = (node: I18nNode | undefined, key: string): I18nNode | undefined => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
    return (node as {readonly [k: string]: I18nNode | undefined})[key];
  };
  const stringField = (node: I18nNode | undefined, key: string): string | null => {
    const value = nodeField(node, key);
    return typeof value === 'string' ? value : null;
  };
  const category = (id: string): TopicVocabulary => {
    if (!isSeedTopic(id)) return {name: id, icon: 'tag', description: t('explorer.freeTopic')};
    const node = i18n.value(`categories.${id}`);
    return {
      name: stringField(node, 'name') ?? t(`categories.${id}.name`),
      icon: stringField(node, 'icon') ?? 'tag',
      description: stringField(node, 'description') ?? t(`categories.${id}.description`)
    };
  };
  const primaryTopic = (tool: Row): string | null => {
    const topics = rowTopics(tool);
    return topics.find(isSeedTopic) ?? topics[0] ?? null;
  };
  const topicLabel = (id: string): string => category(id).name;
  /** A feature as it is said in one language. The three strings come from the
      dictionary as a list; a list that is not three strings is a missing key, and
      `t` reports it and hands back the key path rather than "undefined". */
  interface LocalizedFeature extends FeatureDefinition {
    readonly name: string;
    readonly scene: string;
    readonly aliases: string;
  }
  const localizedFeature = (id: string, language: Language = i18n.language): LocalizedFeature => {
    const values = i18n.value(`explorer.features.${id}`, language);
    const at = (index: number): string => {
      const value = Array.isArray(values) ? values[index] : undefined;
      return typeof value === 'string' ? value : i18n.t(`explorer.features.${id}.${index}`, undefined, language);
    };
    const definition = featureById[id] ?? {id, icon: 'tag', nips: []};
    return {...definition, name: at(0), scene: at(1), aliases: at(2)};
  };
  const featureList = (language: Language): LocalizedFeature[] =>
    featureDefinitions.map(feature => localizedFeature(feature.id, language));
  /* §21.5 R5: `""` is the normative absent form for `summary`, and it renders as an explicit
     "no summary published", never as a blank line that reads like a missing row. */
  /* `descriptions` is a plain language-code -> text map. The collected original (`summary`) stays
     canonical: a language with no recorded text falls back to it, so the description is never empty
     and never the string `undefined`. An entry whose original is absent still says so in words. */
  const toolDescription = (tool: Row, language: Language = i18n.language): string => {
    if (tool.provenance === 'relay') return tool.summary;
    if (tool.summaryAbsent) return i18n.t('explorer.summaryAbsent', undefined, language);
    const recorded = tool.descriptions[language];
    return typeof recorded === 'string' && recorded ? recorded : tool.summary;
  };
  /* The licence is whatever GitHub's own detection reported for the project. `NOASSERTION` and
     "reports none" are not "not open source": they are the absence of a machine-readable licence,
     so ossState has three values and the filter never turns an absence into a negative.
     `ossState` / `isOss` / `metadataValues` now live in domain/explorer.ts; a relay row states no
     licence at all, so it is unknown there too. */
  const displayLicense = (tool: Row): string => rowLicense(tool) || t('unknown');
  const rowIsOss = (tool: Row): boolean =>
    tool.provenance === 'relay' ? false : isOss(tool);
  const statusLabel = (status: string): string => t(`support.${status}`);
  /* The two modes that are not a single result value name themselves: "all" says out loud that it
     includes unknown, "confirmed" says out loud which two results it keeps. Neither hides that a
     choice was made about the unstated ones (issue #7). */
  const supportModeLabel = (mode: string): string =>
    ['all', DEFAULT_SUPPORT].includes(mode) ? t(`explorer.supportModes.${mode}`) : statusLabel(mode);
  const registryStatusLabel = (status: string): string => t(`registryStatus.${status}`);
  /* The page owns these ids; every one of them is in nip-explorer.html. Resolving
     them once, and saying so in the type, is what stops every later use from being
     a null check that can never fire. An id that really went missing throws here,
     naming itself, instead of surfacing as "cannot read properties of null"
     halfway through a render. */
  function need<T extends HTMLElement>(selector: string, ctor: abstract new () => T): T {
    const element = $(selector);
    if (!element) throw new Error(`nosmaps: ${selector} is missing from the page`);
    if (!(element instanceof ctor)) throw new Error(`nosmaps: ${selector} is not a ${ctor.name}`);
    return element;
  }
  const els = {
    query: need('#feature-query', HTMLInputElement), chips: need('#feature-chips', HTMLElement),
    results: need('#tool-results', HTMLElement), resultCount: need('#result-count', HTMLElement),
    selected: need('#selected-feature-summary', HTMLElement),
    condition: need('#condition-summary', HTMLElement), activeFilterCount: need('#active-filter-count', HTMLElement),
    sortBar: need('#sort-bar', HTMLElement),
    uiState: need('#ui-state-view', HTMLElement), offline: need('#offline-banner', HTMLElement),
    compareActions: need('#compare-actions', HTMLElement), compareSummary: need('#compare-summary', HTMLElement),
    openCompare: need('#open-compare', HTMLButtonElement), filterDetails: need('#filter-details', HTMLDetailsElement),
    nipList: need('#nip-list', HTMLElement), nipCount: need('#nip-count', HTMLElement),
    evidenceDialog: need('#evidence-dialog', HTMLDialogElement), evidenceContent: need('#evidence-content', HTMLElement),
    compareDialog: need('#compare-dialog', HTMLDialogElement), compareContent: need('#compare-content', HTMLElement),
    reviewDialog: need('#review-dialog', HTMLDialogElement), reviewContent: need('#review-content', HTMLElement),
    profileDialog: need('#profile-dialog', HTMLDialogElement), profileContent: need('#profile-content', HTMLElement),
    galleryDialog: need('#gallery-dialog', HTMLDialogElement), galleryContent: need('#gallery-content', HTMLElement),
    imageDialog: need('#image-dialog', HTMLDialogElement), imageContent: need('#image-content', HTMLElement),
    toast: need('#toast', HTMLElement)
  };
  const dialogs: readonly HTMLDialogElement[] =
    [els.evidenceDialog, els.compareDialog, els.reviewDialog, els.profileDialog, els.galleryDialog, els.imageDialog];
  const dialogOpeners = new WeakMap<HTMLDialogElement, HTMLElement>();
  const dialogContexts = new WeakMap<HTMLDialogElement, DialogContext>();
  let lastInteractive: HTMLElement | null = null;

  /* issue #5: 言語切り替えはページの上部に一つだけ。以前は dialogHead が同じものを毎回 dialog
     の中にも描いていたので、ダイアログを開くたびに二つ目・三つ目が現れていた。 */
  function languageControl(): string {
    return `<div class="language-switch" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;
  }

  /* ---- NIP-07 サインイン (issue #9) --------------------------------------------------
     この画面が持つのは「拡張が返した公開鍵」だけ。秘密鍵にも署名にも触れないし、
     このスライスでは何も publish しない。

     サインインしていないときに身元らしきものを出さないのが唯一の不変条件。以前ここには
     `npub1currentviewer8q4k2p7cx` という固定文字列が居て、拡張が無くても誰かがログイン
     しているように読めた。失敗したら必ず「未サインイン」に落とし、npub は絶対に作らない。

     失敗の原因は畳まない。拡張が入っていない / 拡張で断られた / 拡張がエラーを返した /
     拡張が黙ったままだった、は利用者にとって次の行動が違う別の出来事なので、別の文言で出す。
     拒否とエラーは NIP-07 が機械可読な区別を定義していないので、拡張が返した文言で判定し、
     判定に使った文言そのものも併記して、こちらの分類だけを信じさせないようにする。 */
  const VIEWER_SESSION_KEY = 'nosmaps.viewer.pubkey';
  const NIP07_TIMEOUT_MS = explorerParams.nip07TimeoutMs;
  /** The NIP-07 surface this page uses, and nothing else. Declared structurally
      rather than as a global augmentation: an extension is not guaranteed to be
      there at all, and saying so is the point. */
  interface Nip07 {
    getPublicKey(): Promise<unknown>;
  }
  function nip07Signer(): Nip07 | null {
    const candidate = (window as {nostr?: unknown}).nostr;
    if (!candidate || typeof candidate !== 'object') return null;
    const signer = candidate as {getPublicKey?: unknown};
    return typeof signer.getPublicKey === 'function' ? (candidate as Nip07) : null;
  }
  /** The three ways the race can settle. `timeout` carries nothing because nothing
      was learned; a late answer is discarded by the attempt counter, not by this. */
  type SignInOutcome =
    | {readonly outcome: 'timeout'}
    | {readonly outcome: 'resolved'; readonly value: unknown}
    | {readonly outcome: 'rejected'; readonly error: unknown};
  const DENIAL_PATTERN = /denied|deny|rejected|reject|declined|decline|refused|refuse|cancell?ed|cancel|not allowed|unauthori[sz]ed|拒否|却下|キャンセル/i;
  /** Why the viewer is signed out. Four distinct outcomes, on purpose: the user's
      next action differs for each, so they are never folded into one. `null` is
      "never asked", which is not a failure. */
  type ViewerReason = 'noExtension' | 'rejected' | 'error' | 'timeout' | 'badKey';
  interface ViewerKey {
    readonly pubkey: string;
    readonly npub: string;
  }
  interface Viewer {
    status: 'signedIn' | 'signedOut';
    reason: ViewerReason | null;
    detail: string;
    pubkey: string | null;
    npub: string | null;
    pending: boolean;
  }
  const viewer: Viewer = {status: 'signedOut', reason: null, detail: '', pubkey: null, npub: null, pending: false};
  let signInAttempt = 0;

  /* NIP-07 は 32 バイト hex を返すと決めているが、npub を返す実装も現に在る。どちらも
     受けて npub に正規化し、どちらでもない値は鍵として扱わない (null)。 */
  function normalizeViewerKey(value: unknown): ViewerKey | null {
    const pubkey = decodeNpub(typeof value === 'string' ? value : '');
    if (!pubkey) return null;
    const npub = encodeNpub(pubkey);
    return npub ? {pubkey, npub} : null;
  }
  function signedInWith(key: ViewerKey): void {
    Object.assign(viewer, {status: 'signedIn', reason: null, detail: '', pubkey: key.pubkey, npub: key.npub, pending: false});
    // セッション限り。sessionStorage はタブを閉じれば消えるし、localStorage と違って
    // 別タブに漏れない。書けない環境 (プライベートモード等) でも画面は動き続ける。
    try { sessionStorage.setItem(VIEWER_SESSION_KEY, key.pubkey); } catch (_) {}
  }
  function signedOutBecause(reason: ViewerReason | null, detail: string): void {
    Object.assign(viewer, {status: 'signedOut', reason: reason || null, detail: detail || '', pubkey: null, npub: null, pending: false});
    try { sessionStorage.removeItem(VIEWER_SESSION_KEY); } catch (_) {}
  }
  function restoreViewerSession(): void {
    let stored = null;
    try { stored = sessionStorage.getItem(VIEWER_SESSION_KEY); } catch (_) { stored = null; }
    const key = stored ? normalizeViewerKey(stored) : null;
    if (key) signedInWith(key); else signedOutBecause(null, '');
  }
  function signerErrorText(error: unknown): string {
    if (error == null) return '';
    if (typeof error === 'string') return error;
    if (typeof error !== 'object') return '';
    const fields = error as {message?: unknown; reason?: unknown; error?: unknown};
    const message = fields.message ?? fields.reason ?? fields.error;
    return typeof message === 'string' ? message : '';
  }
  async function signIn(): Promise<void> {
    if (viewer.pending) return;
    const attempt = ++signInAttempt;
    const signer = nip07Signer();
    if (!signer) { signedOutBecause('noExtension', ''); renderViewer(); return; }
    Object.assign(viewer, {pending: true, reason: null, detail: ''});
    renderViewer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // getPublicKey() は利用者にプロンプトを出す。プロンプトを閉じずに放置された拡張は
    // 永遠に settle しないので、待ち続けて「接続中…」のまま固まらないよう時間で切る。
    const answered = new Promise<SignInOutcome>(resolve => {
      timer = setTimeout(() => resolve({outcome: 'timeout'}), NIP07_TIMEOUT_MS);
    });
    // 遅れて settle しても unhandledrejection にならないよう、ここで両方に手を付けておく。
    const asked: Promise<SignInOutcome> = Promise.resolve().then(() => signer.getPublicKey())
      .then<SignInOutcome, SignInOutcome>(
        value => ({outcome: 'resolved', value}),
        (error: unknown) => ({outcome: 'rejected', error})
      );
    let result: SignInOutcome;
    try { result = await Promise.race([asked, answered]); } finally { clearTimeout(timer); }
    // 打ち切った後に届いた古い応答で画面を書き換えない。
    if (attempt !== signInAttempt) return;
    if (result.outcome === 'timeout') signedOutBecause('timeout', '');
    else if (result.outcome === 'rejected') {
      const message = signerErrorText(result.error);
      signedOutBecause(DENIAL_PATTERN.test(message) ? 'rejected' : 'error', message);
    } else {
      const key = normalizeViewerKey(result.value);
      if (key) signedInWith(key); else signedOutBecause('badKey', '');
    }
    renderViewer();
  }
  function signOut(): void { signInAttempt += 1; signedOutBecause(null, ''); renderViewer(); }
  function viewerReasonText(): string {
    if (!viewer.reason) return '';
    const reason = viewer.reason === 'timeout'
      ? t('explorer.viewer.reasons.timeout', {seconds: Math.round(NIP07_TIMEOUT_MS / 1000)})
      : t(`explorer.viewer.reasons.${viewer.reason}`);
    return viewer.detail ? t('explorer.viewer.reasonDetail', {reason, detail: viewer.detail}) : reason;
  }
  function viewerMarkup(): string {
    if (viewer.status === 'signedIn') {
      return `<span class="viewer-state">${esc(t('explorer.viewer.signedIn'))}</span>`
        + `<code class="viewer-npub" data-viewer-npub>${esc(viewer.npub)}</code>`
        + `<button class="text-button viewer-action" type="button" data-viewer-signout>${esc(t('explorer.viewer.signOut'))}</button>`;
    }
    const reason = viewerReasonText();
    return `<span class="viewer-state">${esc(t('explorer.viewer.signedOut'))}</span>`
      + (reason ? `<span class="viewer-reason" data-viewer-reason="${esc(viewer.reason)}">${esc(reason)}</span>` : '')
      + `<button class="text-button viewer-action" type="button" data-viewer-signin aria-disabled="${viewer.pending}">${esc(viewer.pending ? t('explorer.viewer.signingIn') : t('explorer.viewer.signIn'))}</button>`;
  }
  function viewerControl(): string {
    return `<div class="viewer-identity" id="viewer-identity" role="status" aria-live="polite" aria-label="${esc(t('explorer.viewer.label'))}" data-viewer-status="signedOut"></div>`;
  }
  function renderViewer(): void {
    const host = $('#viewer-identity');
    if (!host) return;
    // innerHTML の入れ替えでボタンごと消えるので、そこに居たフォーカスは呼び戻す。
    const hadFocus = host.contains(document.activeElement);
    host.dataset['viewerStatus'] = viewer.pending ? 'pending' : viewer.status;
    host.innerHTML = viewerMarkup();
    if (hadFocus) host.querySelector('button')?.focus();
    // サインイン状態が Publish フォームの有無そのものを決めるので、必ず一緒に描き直す。
    renderPublish();
  }
  // サインインしていないビューアには npub が無い。無いことを「—」ではなく言葉で出す。
  function reviewerNpub(profileId: string): string {
    if (profileId !== 'local') return profiles[profileId]?.npub ?? '';
    return viewer.status === 'signedIn' ? (viewer.npub ?? '') : t('explorer.viewer.signedOut');
  }

  function featureName(id: string): string { return localizedFeature(id).name; }
  /* §21.10 item 3: the old form mapped each feature NIP through `tool.nips.find` and then dropped
     every miss with `.filter(Boolean)`, so a claim against an id the registry does not hold vanished
     from the screen. Selecting from the tool's own capabilities instead means a claim is matched by
     its opaque id and is never dropped -- its resolution status is carried alongside it. */
  /* These four are the ui-layer bindings of the pure functions in
     domain/explorer.ts: the family and the precedence list are supplied once here
     instead of being threaded through every call site, exactly as the original
     closure captured them. The logic itself is not re-derived. */
  function capabilitiesOf(tool: Row): readonly CapabilityClaim[] { return rowCapabilities(tool); }
  function supportRecords(tool: Row, feature: FeatureDefinition): readonly CapabilityClaim[] {
    return capabilitiesOf(tool).filter(record => record.family === registry.family && feature.nips.includes(record.id));
  }
  /* §21.3 R3 case 1: claims exist but none in the requested family. That is a third answer, distinct
     from "supported" and from "no claim at all", and it must never read as supporting nothing. */
  function outOfFamily(tool: Row): boolean {
    return !capabilitiesOf(tool).some(record => record.family === registry.family) && capabilitiesOf(tool).length > 0;
  }
  function featureSupportRecord(tool: Row, feature: FeatureDefinition): CapabilityClaim | null {
    const records = supportRecords(tool, feature).filter(record => precedenceOf(record.result) > 0);
    const first = records[0];
    if (!first) return null;
    return records.reduce<CapabilityClaim>(
      (best, record) => precedenceOf(record.result) > precedenceOf(best.result) ? record : best, first);
  }
  /* §21.3 R3 case 2 / the brief: no claim at all is `unknown`, never "not supported" and never an
     empty checklist that reads as a set of negatives. It is a value, so it always has a badge.

     issue #10: `accounts` is the one feature whose answer is NOT the NIP list. "Can a person switch
     between several accounts" is not something any NIP states — NIP-19 is bech32 encoding — so the
     answer is the observation someone actually recorded, and a row nobody looked at stays `unknown`
     rather than being read as a negative. Every other feature goes through the same path as before.
     `featureSupportRecord` is deliberately left alone: it answers "which NIP claim does this row
     carry", which is what the NIP evidence button is about, and that is still true of the row. */
  function featureSupport(tool: Row, feature: FeatureDefinition): DisplayResult {
    if (feature.id === OBSERVED_FEATURE_ID) return accountSwitchingSupport({accountSwitching: rowAccountSwitching(tool)});
    const record = featureSupportRecord(tool, feature);
    if (record) return record.result;
    return outOfFamily(tool) ? 'out_of_family' : 'unknown';
  }
  function claimSummary(tool: Row): {total: number; byFamily: Record<string, number | undefined>} {
    const byFamily: Record<string, number | undefined> = {};
    for (const record of capabilitiesOf(tool)) byFamily[record.family] = (byFamily[record.family] ?? 0) + 1;
    return {total: capabilitiesOf(tool).length, byFamily};
  }
  function selectedFeatures(source: ExplorerState = state): LocalizedFeature[] {
    return source.features.map(id => localizedFeature(id));
  }
  /* §21.1 R1: a transcribed claim is the signer's claim, never "the project says". The basis is
     what makes the same kind carry a transcription and a test run without either impersonating the
     other, so it is named in the row rather than flattened into an observer label. */
  function basisLabel(value: string | null | undefined): string { return t(`basis.${value || 'transcribed'}`); }
  function evidenceText(status: string): string { return t(`evidence.${status}`); }
  /* nipCatalog is the pinned registry snapshot (§19.1), which supplies a title for every id it
     holds; the hand-written Japanese purpose exists only for the ids the feature chips use. Falling
     back to the snapshot title is a choice between two present values, not a missing key. */
  function nipPurpose(number: string): string {
    if (i18n.has(`explorer.nipPurposes.${number}`)) return t(`explorer.nipPurposes.${number}`);
    const nip = nipByNumber[number];
    return nip ? nip.title : t('unknown');
  }

  const LANGUAGES: readonly Language[] = ['ja', 'en'];
  function toolMatchesQuery(tool: Row, source: ExplorerState = state): boolean {
    const query = source.query.trim().toLowerCase();
    if (!query) return true;
    const featureTerms = LANGUAGES.flatMap(language => featureList(language).filter(feature => featureSupport(tool, feature)).flatMap(feature => [feature.name, feature.scene, feature.aliases]));
    /* A dictionary lookup that resolves to something other than a string contributes
       nothing rather than the text "undefined" — a missing key is reported by i18n,
       never made searchable. */
    const localised = (path: string, language: Language): string => {
      const value = i18n.value(path, language);
      return typeof value === 'string' ? value : '';
    };
    const topicTerms = rowTopics(tool).flatMap(topic => isSeedTopic(topic)
      ? LANGUAGES.flatMap(language => [localised(`categories.${topic}.name`, language), localised(`categories.${topic}.description`, language)])
      : [topic]);
    /* The claimed id, the family-qualified key, and the registry title the id resolves to are all
       searchable; an unresolved id is searchable by the id itself, which is all the source gave. */
    const nipTerms = capabilitiesOf(tool).flatMap(record => {
      const nip = record.family === registry.family ? nipByNumber[record.id] : null;
      return [record.key, `${record.family.toUpperCase()}-${record.id}`, `${record.family.toUpperCase()} ${record.id}`, record.id, record.registryTitle || '', nip?.title || '', record.sourceText || ''];
    });
    /* A relay row states none of the collected metadata — it is searchable by what
       it does carry (name, id, summary, homepage), which is what the original's
       `|| ''` fallbacks amounted to for those rows. */
    const collected = tool.provenance === 'relay'
      ? [...metadataValues(tool.summary), ...metadataValues(tool.homepage)]
      : [...metadataValues(tool.summary), ...metadataValues(tool.descriptions),
         ...metadataValues(tool.homepage), ...metadataValues(tool.sourceRepo), ...metadataValues(tool.distribution)];
    const platformText = tool.provenance === 'relay' ? tool.platform : (tool.platformText ?? '');
    const terms = [tool.name, tool.id, platformText, displayLicense(tool), rowIsOss(tool) ? 'OSS open source オープンソース' : '',
      /* Every recorded language, not the one on screen: a query is answered by what the catalogue
         holds, so switching the UI language never changes which entries match. */
      ...collected,
      ...topicTerms, ...featureTerms, ...nipTerms];
    return terms.join(' ').toLowerCase().includes(query);
  }

  function filteredTools(overrides: Partial<ExplorerState> = {}): Tool[] {
    const source: ExplorerState = {...state, ...overrides};
    const selected = source.features.flatMap(id => {
      const feature = featureById[id];
      return feature ? [feature] : [];
    });
    const nipQuery = normaliseNipQuery(source.nipQuery);
    return tools.filter(tool => {
      const supports = selected.map(feature => featureSupport(tool, feature));
      const relevant = selected.length ? selected.flatMap(feature => supportRecords(tool, feature)) : capabilitiesOf(tool);
      const nipMatch = !nipQuery || relevant.some(record => `${record.id} ${record.key} ${record.registryTitle || ''}`.toLowerCase().includes(nipQuery));
      /* §21.4 invariant I9: nothing about liveness removes a row. There is no dead filter, because
         `dead` is only derivable from a counted 30370 observation and this build counts none. */
      return (source.tool === '' || tool.id === source.tool) &&
        toolMatchesQuery(tool, source) && (!source.savedOnly || Boolean(source.bookmarks[tool.id])) &&
        (source.platform === 'all' || String(tool.platformText ?? '').toLowerCase().includes(source.platform.toLowerCase())) &&
        (source.category === 'all' || tool.topics.includes(source.category)) &&
        (source.toolStatus === 'all' || tool.recordState === source.toolStatus) &&
        /* issue #7: with a feature selected, every selected feature must pass the support mode --
           AND across features as before, but `unknown`/`out_of_family` now only pass when they were
           asked for. With no feature selected there is nothing to be unknown *about*, so the mode is
           inert and the list stays whole. */
        (!selected.length || supports.every(value => supportPasses(value, source.support))) &&
        (source.oss === 'all' || ossState(tool) === source.oss) && nipMatch;
    });
  }

  /* issue #7: the entries the support mode set aside are never silently gone. These are the rows
     that pass every other condition and whose only disqualification is that a selected feature has
     no stated result for them -- they are counted, said out loud, and one press away. */
  function unstatedSetAside(source: ExplorerState = state): Tool[] {
    const selected = source.features.flatMap(id => {
      const feature = featureById[id];
      return feature ? [feature] : [];
    });
    if (!selected.length || source.support === 'all') return [];
    const shown = new Set(filteredTools(source).map(tool => tool.id));
    return filteredTools({...source, support: 'all'}).filter(tool => !shown.has(tool.id) &&
      selected.map(feature => featureSupport(tool, feature)).some(value => UNSTATED_SUPPORT.includes(value)));
  }
  function unstatedNoticeMarkup(): string {
    const setAside = unstatedSetAside();
    if (!setAside.length) return '';
    return `<div class="unstated-notice" data-unstated-count="${setAside.length}"><p>${esc(t('explorer.unstatedSetAside', {count: setAside.length}))}</p><button class="secondary" type="button" data-support-mode="all">${esc(t('explorer.showUnstated'))}</button></div>`;
  }

  function renderIdentity(): void {
    document.title = t('explorer.pageTitle');
    need('meta[name="description"]', HTMLMetaElement).content = t('explorer.pageDescription');
    need('#skip-link', HTMLElement).textContent = t('skip');
    need('#compact-identity', HTMLElement).innerHTML = `<a href="index.html" aria-label="${esc(t('explorer.back'))}"><span class="identity-mark" aria-hidden="true">N</span><span>nosmaps</span></a><span aria-hidden="true">/</span><span>${esc(t('explorer.location'))}</span>${viewerControl()}${languageControl()}`;
    renderViewer();
    need('#search-title', HTMLElement).textContent = t('explorer.search');
    els.query.placeholder = t('explorer.searchPlaceholder');
    els.chips.setAttribute('aria-label', t('explorer.featureGroup'));
    need('#results-title', HTMLElement).textContent = t('explorer.candidates');
    need('#settings-label', HTMLElement).textContent = t('explorer.settings');
    els.openCompare.textContent = t('explorer.compareByFeature');
    need('#clear-compare', HTMLButtonElement).textContent = t('explorer.clearSelection');
    need('#nip-reference-title', HTMLElement).textContent = t('explorer.evidenceTitle');
    els.offline.textContent = t('explorer.offlineBanner');
  }

  function renderFeatures(): void {
    els.chips.innerHTML = featureDefinitions.map(definition => {
      const feature = localizedFeature(definition.id);
      const label = `${feature.name} — ${feature.scene}`;
      return `<button class="feature-chip" type="button" aria-pressed="${state.features.includes(feature.id)}" aria-label="${esc(label)}" title="${esc(label)}" data-select-feature="${feature.id}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="feature-chip-label">${esc(feature.name)}</span></button>`;
    }).join('');
  }

  function option(value: string, label: string, selected: string): string { return `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`; }
  function categoryFilterButton(id: string, iconName: string, name: string, description: string): string {
    const selected = state.category === id;
    const accessibleName = `${name}: ${description}`;
    return `<button type="button" class="category-icon ${selected ? 'selected' : ''}" data-category-filter="${id}" aria-pressed="${selected}" aria-label="${esc(accessibleName)}" title="${esc(accessibleName)}"><span class="category-symbol" aria-hidden="true">${iconSvg(iconName)}</span><span class="category-copy"><span class="category-title">${esc(name)}</span><span class="category-description">${esc(description)}</span></span></button>`;
  }
  function renderFilterPanel(): void {
    const wasOpen = els.filterDetails.open;
    need('#feature-filter-grid', HTMLElement).innerHTML = `<label class="field">${esc(t('explorer.platform'))}<select id="platform-filter">${option('all', t('all'), state.platform)}${['Android', 'iOS', 'macOS'].map(value => option(value, value, state.platform)).join('')}</select><small class="filter-prerequisite">${esc(t('explorer.platformSourced'))}</small></label>
      <fieldset class="category-filter"><legend>${esc(t('explorer.categoryGroup'))}</legend><div class="category-icon-group" role="group" aria-label="${esc(t('explorer.categoryGroup'))}">${categoryFilterButton('all', 'apps', t('all'), t('explorer.allCategoriesDescription'))}${allTopics.map(id => { const item = category(id); return categoryFilterButton(id, item.icon, item.name, item.description); }).join('')}</div></fieldset>
      <label class="field">${esc(t('explorer.recordStateFilter'))}<select id="tool-status-filter">${option('all', t('all'), state.toolStatus)}${['active', 'withdrawn'].map(value => option(value, t(`recordStates.${value}`), state.toolStatus)).join('')}</select><small class="filter-prerequisite">${esc(t('explorer.recordStateHelp'))}</small></label>
      <label class="field">${esc(t('explorer.support'))}<select id="support-filter" aria-describedby="support-filter-help" ${state.features.length ? '' : 'disabled'}>${supportFilterValues.map(value => option(value, supportModeLabel(value), state.support)).join('')}</select><small id="support-filter-help" class="filter-prerequisite">${esc(state.features.length ? t('explorer.supportModeHelp') : t('explorer.featureNeeded'))}</small></label>
      <label class="field">${esc(t('explorer.oss'))}<select id="oss-filter">${option('all', t('all'), state.oss)}${option('yes', 'OSS', state.oss)}${option('unknown', t('unknown'), state.oss)}</select></label>
      <label class="include-dead"><input id="saved-only" type="checkbox" ${state.savedOnly ? 'checked' : ''}> ${esc(t('explorer.savedOnly'))}</label>
      <label class="field advanced-nip">${esc(t('explorer.nipSearch'))}<input id="nip-query" type="search" value="${esc(state.nipQuery)}" placeholder="46 / remote signing"></label>
      <div class="filter-help"><details><summary>${esc(t('explorer.unknownInfo'))}</summary><p>${esc(t('explorer.unknownHelp'))}</p></details><button class="text-button" type="button" data-reset-all>${esc(t('reset'))}</button></div>`;
    els.filterDetails.open = wasOpen;
  }

  function supportBadge(status: string): string { return `<span class="support-badge ${status}">${esc(statusLabel(status))}</span>`; }

  /* ---- issue #1: 並び順 ----------------------------------------------------
     鍵は「レコードが実際に述べている値」だけ。名前は全行が持っている。いいね数は
     観測できた行だけが持っていて、観測していない行は null —— これは 0 ではない（I8）。
     なので lists は「並べられた行」と「その鍵を持たない行」に割れて返り、後者は
     0 件の行に混ぜず、未観測だと分かる見出しの下に出す。黙って末尾に沈めるのは
     「0 件と同じ」と読ませることであって、I8 が禁じているのはまさにそれ。

     issue #21 で「収集日が新しい順／古い順」を足した。鍵はレコード自身の
     created_at ——「収集した時刻」であって公開日ではない。だからラベルもそう書く。
     41件は一括署名なので今は全部同値で、その並び順は既定の順のまま出る。それが
     同値データの正しい出力で、鍵を伏せる理由にはならない。 */
  interface SortableRow {
    readonly id: string;
    readonly name: string;
    readonly likes: number | null;
    readonly collectedAt: number | null;
    readonly row: Row;
  }
  /** レコードが述べている収集の秒。収集済みの行は必ず持ち、relay 行は持たないこと
      がある（その場合は null = 未観測で、0 ではない）。 */
  function collectedAt(row: Row): number | null { return row.collectedAt; }
  function sortedList(list: readonly Row[]): {ranked: readonly Row[]; unranked: readonly Row[]} {
    const sortable: SortableRow[] = list.map(row => ({
      id: row.id, name: row.name, likes: likeCount(row), collectedAt: collectedAt(row), row
    }));
    const result = sortRows(sortable, state.sort);
    return {ranked: result.ranked.map(item => item.row), unranked: result.unranked.map(item => item.row)};
  }
  function sortLabel(key: SortKey): string { return t(`explorer.sort.${key}`); }
  function renderSortBar(): void {
    els.sortBar.innerHTML = `<label class="field sort-field" for="sort-order">${esc(t('explorer.sort.label'))}<select id="sort-order">${SORT_KEYS.map(key => option(key, sortLabel(key), state.sort)).join('')}</select></label>`;
  }
  /* 除外の見出しは鍵の次元ごとに別の文。「いいね数：未観測」を収集日順の下に出すと、
     観測していない値について嘘を書くことになる（issue #21）。 */
  function unrankedMarkup(rows: readonly Row[]): string {
    if (!rows.length) return '';
    const dimension = sortDimension(state.sort);
    if (dimension === null) return rows.map(featureCard).join('');
    const heading = t(`explorer.sort.unranked.${dimension}.heading`);
    const notice = t(`explorer.sort.unranked.${dimension}.notice`, {count: rows.length});
    return `<div class="sort-unranked" data-unranked-sort="${rows.length}" data-unranked-dimension="${esc(dimension)}"><h3>${esc(heading)}</h3><p>${esc(notice)}</p></div>${rows.map(featureCard).join('')}`;
  }
  /* 一次情報が持っていないリンク種別のボタンは出さない。存在しない URL を生成するのは捏造で、
     ボタンだけ出して「不明」を見せるのは、あるはずの物が壊れているように読める。 */
  function resourceTypes(tool: Row): string[] {
    const types: string[] = [];
    if (tool.homepage) types.push('site');
    if (tool.provenance !== 'relay' && tool.distribution) types.push('distribution');
    if (tool.provenance !== 'relay' && tool.sourceRepo) types.push('source');
    if (provenanceOf(tool) === 'sample') return ['site', 'distribution', 'docs', ...(rowIsOss(tool) ? ['source'] : [])];
    return types;
  }
  function resourceLinks(tool: Row): string {
    const types = resourceTypes(tool);
    if (!types.length) return `<span class="no-support-record">${esc(t('explorer.noOfficialLinks'))}</span>`;
    return types.map(type => `<button class="resource-link" type="button" data-resource-tool="${tool.id}" data-resource-type="${type}">${esc(t(`explorer.${type}`))}</button>`).join('');
  }

  /* `a` と `b` はサンプル入口専用の作り物のレビュアー (seedReviews と同じ扱い)。
     ビューア自身の欄はここには無い。かつて `local` として固定の npub と参加時期と
     役立ち票 0 を持っていたが、どれも観測していない値だったので viewer (下) が持つ
     「NIP-07 が返した公開鍵」だけに置き換えた。 */
  interface SeedProfile {
    readonly name: string;
    readonly npub: string;
    readonly joined: string;
    readonly useful: number;
    readonly notUseful: number;
  }
  const profiles: Readonly<Record<string, SeedProfile | undefined>> = {
    a: {name: 'Mina / relay walker', npub: 'npub1mina7q3f4k8reva2x90cx', joined: '2023-04', useful: 31, notUseful: 4},
    b: {name: 'Tao / quiet tester', npub: 'npub1tao8r5f7k4review2p9cx', joined: '2024-11', useful: 18, notUseful: 3}
  };

  /* The row's provenance, read as the open string it is on screen. `sample` was a
     third value the fixtures used; no row in the shipped data.js carries it (all 41
     are `collected`, relay rows are `relay`), so these branches are unreachable
     with the shipped catalogue. They are kept, not deleted: deleting them would be
     a behaviour change smuggled in under a type change, and this port does not do
     that. Reading through this helper is what lets the comparison stay legal
     without an assertion. */
  function provenanceOf(row: Row): string { return row.provenance; }

  const shotPalette: readonly string[] = ['#5a46b8', '#08745e', '#a34c62', '#3f668c'];
  function imageData(label: string, color: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/><rect x="36" y="35" width="328" height="230" rx="18" fill="none" stroke="white" stroke-opacity=".7" stroke-width="4"/><circle cx="88" cy="90" r="22" fill="white" fill-opacity=".8"/><path d="M70 220l75-72 55 48 52-63 78 87" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><text x="200" y="105" fill="white" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700">${esc(label)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  /** Reads one string out of the reviewsSeed group. A key that is missing is
      reported by i18n and stands in as its own path — never "undefined". */
  function seedText(seed: I18nNode | undefined, key: string): string {
    return stringField(seed, key) ?? i18n.t(`explorer.reviewsSeed.${key}`);
  }
  function seedReviews(tool: Row): Review[] {
    const seed = i18n.value('explorer.reviewsSeed');
    const bodies = [seedText(seed, 'aBody'), seedText(seed, 'bBody'), seedText(seed, 'cBody'), seedText(seed, 'aBody')];
    const labels = [seedText(seed, 'screenTimeline'), seedText(seed, 'screenSettings'), seedText(seed, 'screenMedia'), seedText(seed, 'screenTimeline')];
    return bodies.map((body, index) => {
      const label = labels[index] ?? '';
      const colour = shotPalette[index] ?? '';
      const author = index % 2 ? profiles['b']?.name : profiles['a']?.name;
      return {
        id: `${tool.id}-r${index + 1}`, profile: index % 2 ? 'b' : 'a', author: author ?? '',
        date: `2026-08-${String(12 - index).padStart(2, '0')}`, body, os: index % 2 ? 'Web' : 'Android', version: `2.${index + 1}`, use: topicLabel(primaryTopic(tool) ?? 'clients'),
        rating: index === 1 ? 4 : 5, helpful: 7 + index * 2, unhelpful: index % 2, image: {label, src: imageData(label, colour)}
      };
    });
  }
  // レビューは観測していない。実在のプロジェクトに架空のレビュー・npub・スクリーンショットを付けるのは捏造なので、seed はサンプル入口専用に閉じる。
  function allReviews(tool: Row | null): Review[] { if (!tool) return []; return [...(provenanceOf(tool) === 'sample' ? seedReviews(tool) : []), ...(state.reviews[tool.id] ?? [])]; }
  function reviewCounts(review: Review): {helpful: number; unhelpful: number; vote: ReviewVote | null} {
    const vote = state.reviewVotes[review.id] ?? null;
    return {helpful: review.helpful + (vote === 'helpful' ? 1 : 0), unhelpful: review.unhelpful + (vote === 'unhelpful' ? 1 : 0), vote};
  }
  function screenshotMarkup(image: ReviewImage, compact = false, alt = ''): string { return `<img class="review-shot${compact ? ' compact' : ''}" src="${image.src}" alt="${esc(alt || image.label)}">`; }

  function reviewItem(tool: Row, review: Review): string {
    const counts = reviewCounts(review);
    return `<article class="review-item" data-review-id="${esc(review.id)}"><div class="review-author"><button type="button" class="reviewer-link" data-reviewer="${review.profile}"><strong>${esc(review.author)}</strong><small>${esc(reviewerNpub(review.profile))}</small></button><time>${esc(review.date)}</time></div><p>${esc(review.body || t('explorer.imageOnly'))}</p>${review.image ? `<button type="button" class="review-image-button" data-open-image="${tool.id}" data-image-review="${review.id}">${screenshotMarkup(review.image, true, t('explorer.imageAlt', {author: review.author, date: review.date}))}<span>${esc(t('explorer.enlarge'))}</span></button>` : ''}<dl><div><dt>${esc(t('explorer.os'))}</dt><dd>${esc(review.os || t('explorer.notEntered'))}</dd></div><div><dt>${esc(t('explorer.appVersion'))}</dt><dd>${esc(review.version || t('explorer.notEntered'))}</dd></div><div><dt>${esc(t('explorer.rating'))}</dt><dd>${review.rating || t('explorer.notEntered')}</dd></div><div><dt>${esc(t('explorer.use'))}</dt><dd>${esc(review.use || t('explorer.notEntered'))}</dd></div></dl><div class="helpful-actions"><button type="button" data-review-vote="helpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === 'helpful'}">${esc(t('explorer.helpful', {count: counts.helpful}))}</button><button type="button" data-review-vote="unhelpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === 'unhelpful'}">${esc(t('explorer.unhelpful', {count: counts.unhelpful}))}</button><button class="text-button" type="button" data-vote-basis="${review.id}" data-vote-tool="${tool.id}">${esc(t('explorer.voters', {count: counts.helpful + counts.unhelpful}))}</button></div></article>`;
  }

  function cardReviewThumbnails(tool: Row): string {
    const images = allReviews(tool).flatMap(review => review.image ? [{...review, image: review.image}] : []);
    if (!images.length) return '';
    const shown = images.slice(0, 3);
    const remaining = images.length - shown.length;
    return `<div class="card-review-thumbnails" aria-label="${esc(t('explorer.openGallery'))}">${shown.map(review => { const label = t('explorer.imageAlt', {author: review.author, date: review.date}); return `<button type="button" class="card-review-thumbnail" data-open-image="${tool.id}" data-image-review="${review.id}" aria-label="${esc(label)}" title="${esc(label)}">${screenshotMarkup(review.image, true, '')}</button>`; }).join('')}${remaining ? `<button type="button" class="card-review-more" data-gallery-tool="${tool.id}" aria-label="${esc(t('explorer.remainingGallery', {count: remaining}))}" title="${esc(t('explorer.openGallery'))}">+${remaining}</button>` : ''}</div>`;
  }

  /* issue #20: いいね数は「観測できた kind 7 の件数」そのもの。id の形や連番から作らないし、
     ボタンを押したこと自体でも動かない。動くのはリレーがその kind 7 を返してきたときだけ。
     null = まだ見ていない（unknown）。0 = 見て0件だった。この二つを混ぜないのが不変式 I8。 */
  function likeCount(tool: Row): number | null { return state.reactions[tool.id]?.count ?? null; }
  function myReactionId(tool: Row): string | null { return state.reactions[tool.id]?.mine ?? null; }
  /* 反応の宛先は座標 (30078:<pubkey>:<d>)。NIP-25 は置換可能イベントを `a` タグで指すし、
     いいねは「たまたま画面に出ていた版」ではなくエントリに属する。座標を名乗らない行は押せない。 */
  function reactionTarget(tool: Row): string | null { return isValidCoordinate(tool.coordinate) ? tool.coordinate : null; }
  /* 未サインインで「押せるのに何も起きない」を作らない。理由は Publish パネルと同じ語彙で名乗る。 */
  function likeBlocker(tool: Row): string | null {
    if (!reactionTarget(tool)) return t('explorer.likeNoTarget');
    if (!signerCanSign()) return t('explorer.likeNeedsSigner');
    if (viewer.status !== 'signedIn') return t('explorer.likeNeedsSignIn');
    return null;
  }
  function likeButtonMarkup(tool: Row): string {
    const blocked = likeBlocker(tool);
    const busy = reactionBusy.has(tool.id);
    const mine = myReactionId(tool) !== null;
    const label = busy ? t('explorer.likeSending') : blocked ?? t(mine ? 'explorer.likeRetract' : 'explorer.likeAdd');
    const disabled = blocked !== null || busy;
    return `<button type="button" class="like-button" data-like-tool="${esc(tool.id)}" aria-pressed="${mine}" aria-label="${esc(label)}" title="${esc(label)}"${disabled ? ` disabled data-like-blocked="${esc(busy ? 'busy' : 'blocked')}"` : ''}>\u2665 ${likeCountMarkup(tool)}</button>`;
  }
  // 観測値がないときは比較ダイアログと同じ「—（不明）」マーカーで出す。数字を捏造しない。
  function likeCountMarkup(tool: Row): string { const count = likeCount(tool); return count === null ? `<span class="no-support-record" aria-label="${esc(t('unknown'))}" title="${esc(t('unknown'))}">—</span>` : String(count); }
  // 由来は3つある: リレーで検証したレコード、一次情報から収集したエントリ、サンプル。取り違えると出所を偽ることになるので分けて出す。
  function provenanceBadge(tool: Row | null): string {
    const provenance = tool ? provenanceOf(tool) : '';
    const kind = provenance === 'relay' ? 'relay' : provenance === 'collected' ? 'collected' : 'sample';
    const labels = {relay: 'explorer.relayVerified', collected: 'explorer.collectedData', sample: 'explorer.sampleData'} as const;
    return `<span class="provenance-badge ${kind}">${esc(t(labels[kind]))}</span>`;
  }
  const unknownMarker = () => `<span class="no-support-record" aria-label="${esc(t('unknown'))}" title="${esc(t('unknown'))}">—</span>`;
  // §21.6: トピックは集合。単一値に畳むと Nostrcheck server の3件も Ditto の2件も round-trip しない。
  // seed に無いトピックはそのまま出す。ラベルが無いことは「未分類」ではない。
  function topicsText(tool: Row): string { const list = rowTopics(tool); return list.length ? list.map(topicLabel).join(' / ') : t('unknown'); }
  function categoryText(tool: Row): string { return topicsText(tool); }
  function topicTags(tool: Row): string {
    const list = rowTopics(tool);
    if (!list.length) return `<span class="tag">${esc(t('explorer.category'))}: ${esc(t('unknown'))}</span>`;
    return list.map(topic => `<span class="tag topic-tag${isSeedTopic(topic) ? '' : ' free-topic'}" data-topic="${esc(topic)}">${esc(topicLabel(topic))}</span>`).join('');
  }
  // v1 profile には OS 欄が無い。一次情報が明言した分だけ逐語で出し、それ以外は不明のまま。
  function osText(tool: Row): string { return (tool.provenance === 'relay' ? '' : tool.platformText) || t('unknown'); }
  function platformTags(tool: Row): string { return `<span class="tag">${esc(t('explorer.os'))}: ${esc(osText(tool))}</span>`; }
  /* §21.4 R4: 記録の状態 (`state`) と プロジェクトの生存 (liveness) は別の軸。liveness は
     30370 の観測で、ビューアの G に居る署名者の分だけ数える。グラフが無いこのビルドでは
     どの観測も数えないので、導出値は常に unknown。観測そのものは消さずに併記する。 */
  /* issue #15-2: このビルドにグラフが無いので 30370 の観測は一件も数えられない。だが「数えられる観測が無い」
     ことと「何も観測されていない」ことは別。収集時にホームページへの応答が実際に記録されているエントリは、
     その記録を根拠に reachable と言える。根拠は記録された `sources` の行そのものであって、ここで新しく
     観測を作ることはしない。記録が無いエントリは unknown のままで、到達不能という意味ではない。 */
  const sameAddress = (a: string | null | undefined, b: string | null | undefined): boolean =>
    Boolean(a) && Boolean(b) && String(a).replace(/\/+$/, '') === String(b).replace(/\/+$/, '');
  function reachableSource(tool: Row | null): ProvenanceSource | null {
    const sources = tool && tool.provenance !== 'relay' ? tool.sources : [];
    for (const source of sources) {
      if (!source.url) continue;
      // 「HTTP 200 を見た」と収集時に書かれている行だけ。文脈を推測して広げない。
      if (!/\bHTTP 200\b/.test(source.what)) continue;
      // その応答がこのエントリのホームページに対するものだと、記録自体が言っているときだけ。
      if (source.fields.includes('homepage') || sameAddress(source.url, tool ? tool.homepage : null)) return source;
    }
    return null;
  }
  function livenessValue(tool: Row): string { return reachableSource(tool) ? 'reachable' : 'unknown'; }
  function livenessMarkup(tool: Row): string {
    const observations = rowLiveness(tool);
    const rows = observations.map(item => `<li><span class="liveness-result ${esc(item.result)}">${esc(t(`liveness.${item.result}`))}</span> <code>${esc(item.subject)}</code> <small>${esc(item.detail)}</small>${item.target ? ` <small>→ ${esc(item.target)}</small>` : ''} <small>${esc(item.observedAt)}</small></li>`).join('');
    const value = livenessValue(tool);
    const ground = reachableSource(tool);
    return `<div class="liveness-block"><p class="liveness-derived" data-liveness="${esc(value)}">${esc(t('explorer.livenessDerived', {value: t(`liveness.${value}`)}))} ${value === 'unknown' ? unknownMarker() : ''}</p>${ground ? `<p class="liveness-ground">${esc(t('explorer.livenessFromSource', {url: ground.url, date: ground.fetched || t('unknown')}))}</p>` : ''}${observations.length ? `<p class="liveness-why">${esc(t('explorer.livenessUncounted', {count: observations.length}))}</p><ul class="liveness-list">${rows}</ul>` : ''}</div>`;
  }
  // §6.4: 推薦数はビューアのフォローグラフから数えた「distinct pubkey 数」。
  // グラフが無いときは unknown で、0 とは別の見た目にし、並び順にも 0 として入れない (I8)。
  function recommendationMarkup(tool: Row): string {
    if (tool.provenance !== 'relay') return '';
    const count = tool.recommendations;
    if (count === null || count === undefined) {
      return `<p class="recommendation-count is-unknown" data-recommendations="unknown">${esc(t('explorer.recommendationsUnknown'))} ${unknownMarker()}</p>`;
    }
    return `<p class="recommendation-count" data-recommendations="${esc(String(count))}">${esc(t('explorer.recommendations', {count}))}</p>`;
  }
  /* §21.2.3 / §21.10 item 3: a claim carries the id the source wrote and the status it resolves to
     against the pinned snapshot. `not_in_registry` and `unresolvable` are rendered verbatim with the
     reason -- never dropped, never silently remapped to a successor NIP. */
  function capabilityChip(tool: Row, record: CapabilityClaim): string {
    const status = record.registryStatus;
    const title = record.registryTitle || (status === 'not_in_registry' ? t('explorer.notInRegistry', {revision: registry.revision.slice(0, 7)}) : t('explorer.noRegistrySnapshot', {family: record.family}));
    const label = `${record.family.toUpperCase()}-${record.id}${record.scope ? `@${record.scope}` : ''}${record.sub ? `/${record.sub}` : ''}`;
    return `<button type="button" class="nip-tag-button registry-${esc(status)}" data-evidence-tool="${esc(tool.id)}" data-evidence-nip="${esc(record.key)}" title="${esc(`${label} — ${title}`)}">${esc(label)} · ${esc(statusLabel(record.result))}${status === 'resolved' ? '' : ` <span class="registry-flag">${esc(registryStatusLabel(status))}</span>`}</button>`;
  }
  /* §21.3 R3 の三分岐をそのまま出す。1) 別ファミリの主張がある 2) 主張が一つも無い
     3) 主張が「対応しない」と言っている — 3 は 2 より強い言明であって、弱い言明ではない。 */
  function claimSummaryMarkup(tool: Row): string {
    const summary = claimSummary(tool);
    if (!summary.total) return `<p class="claim-summary is-unknown" data-claim-summary="none">${esc(t('explorer.noClaimPublished'))} ${unknownMarker()}</p>`;
    const families = Object.entries(summary.byFamily).map(([family, count]) => t('explorer.claimFamilyCount', {family: family.toUpperCase(), count: count ?? 0})).join(' · ');
    const outOf = outOfFamily(tool) ? ` <span class="out-of-family">${esc(t('explorer.noNipClaims'))}</span>` : '';
    return `<p class="claim-summary" data-claim-summary="${esc(String(summary.total))}" data-claim-families="${esc(Object.keys(summary.byFamily).join(','))}">${esc(families)}${outOf}</p>`;
  }
  /* issue #6: the collapsed card is a row to scan, not a dossier. It carries only what every one of
     the catalogue's records actually holds -- the name, the topics it published, its one-line
     summary, and (issue #15) whether the record is still active -- plus the two controls that belong to the list rather
     than to the record: the comparison checkbox (picking candidates is a multi-row act, so it
     cannot live inside a single record's dialog) and the button that opens the record. Everything
     that used to be printed here -- licence, OS, observation date, official links, capability
     chips, claim summary, liveness, likes, bookmarks, review thumbnails -- is in the detail dialog.

     issue #15: the coordinate (`30078:<pubkey>:nosmaps:<d>`) is internal bookkeeping -- a reader
     never types it, copies it or compares it -- so it is off the card and out of the reader-facing
     part of the dialog. The only place an identifier is still named is the publish form, where the
     author has to supply one, and there it is called 識別子 / Identifier. What replaced the
     coordinate on the headline is the record state, because whether the entry is still active is
     the first thing a reader needs and it was previously one press away for no reason.

     `recommendationMarkup` stays because it is the relay list's own ordering key, and it renders
     nothing at all for a record that did not come from a relay: for all 41 collected entries the
     card is exactly the four fields above.

     issue #3: the icon sits inside the headline, next to the name it belongs to. It is identity,
     not a fifth field -- the card still has exactly the four rows above, and the icon carries no
     text of its own (see NOSMAPS_ICONS.entity). */
  /* ---- issue #18: 同じ識別子に複数の署名者 ---------------------------------
     NIP-01 の置換は `kind:pubkey:d` 単位なので、別の鍵が同じ `d` を書いても
     上書きは起きず、座標が 2 つ在るだけになる。読み取り側は前からその 2 件を
     別々の行として持っていたが、「同じ識別子について言っている」と言う場所が
     どこにも無かった。ここがその場所。

     D1: 既定を選ばない。どれかを代表に立てるフィールドも、収集鍵の定数も置かない。
     カードは全件そのまま描かれ続ける（＝全件が辿れる）。付けるのは
     「この識別子には observed 件ある」「これはその何番目か」という観測の事実だけで、
     順序は state.sort が決めた並びをそのまま使う。手前に来ることは選択ではない。 */
  function rowIdentifier(row: Row): string { return row.provenance === 'relay' ? row.d : row.id; }
  /** 現在の並びから引いた、識別子 -> その識別子を共有する行。空なら重なりは無い。 */
  let stackIndex = new Map<string, RecordStack<Row>>();
  function rebuildStacks(rows: readonly Row[]): void {
    /* complete は「リレー到達が完全だったか」。relay 表示中でその判定が付いている
       ときだけ true を名乗り、収集済みカタログや診断が無いときは false のまま
       ＝ observed は下限であって総数ではない、と読める側に倒す（I8）。 */
    const complete = relayState?.result?.status === 'fresh';
    stackIndex = new Map();
    for (const stack of stackRecords(rows, rowIdentifier, complete)) stackIndex.set(stack.d, stack);
  }
  /** カードに付ける重なりの標識。observed が 1 の識別子には何も付けない
      （「1 件しか無い」を毎行に書くのはノイズ。M2.2-4）。 */
  function stackAttributes(tool: Row): string {
    const stack = stackIndex.get(rowIdentifier(tool));
    if (!stack || stack.observed < 2) return '';
    const position = stack.records.indexOf(tool);
    if (position === -1) return '';
    /* drawn は描画枚数の上限（3）であって件数ではない。読者に見せる数は observed。 */
    const drawn = position < STACK_DRAWN_LIMIT;
    return ` data-stack-d="${esc(stack.d)}" data-stack-observed="${stack.observed}" data-stack-position="${position}" data-stack-drawn="${drawn ? 'yes' : 'no'}" data-stack-complete="${stack.complete ? 'yes' : 'no'}"`;
  }
  function featureCard(tool: Row): string {
    return `<article class="feature-tool-card" data-tool-id="${esc(tool.id)}" data-record-state="${esc(tool.recordState)}"${stackAttributes(tool)}><div class="card-headline"><div class="card-identity">${icons.entity(tool)}<h2>${esc(tool.name)}</h2></div><span class="record-state ${esc(tool.recordState)}">${esc(t(`recordStates.${tool.recordState}`))}</span></div><p class="tool-summary${tool.provenance !== 'relay' && tool.summaryAbsent ? ' is-unknown' : ''}">${esc(toolDescription(tool))}</p><div class="card-topics">${topicTags(tool)}</div>${recommendationMarkup(tool)}<div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${esc(tool.id)}" ${state.compare.includes(tool.id) ? 'checked' : ''}> ${esc(t('explorer.compareAdd'))}</label><button class="secondary" type="button" data-feature-detail="${esc(tool.id)}">${esc(t('explorer.details'))}</button></div></article>`;
  }

  /** A removable filter pill: what it says, and the state change removing it makes. */
  interface Condition {
    readonly key: string;
    readonly label: string;
    readonly overrides: Partial<ExplorerState>;
  }
  function activeConditions(): Condition[] {
    const conditions: Condition[] = state.features.map(id => ({key: `feature:${id}`, label: t('explorer.conditionFeature', {value: featureName(id)}), overrides: {features: state.features.filter(value => value !== id)}}));
    /* The entry the carousel handed over is a removable condition like any other, so landing on one
       entry is never a dead end: the pill says which entry it is and clearing it restores the list. */
    if (state.tool) conditions.unshift({key: 'tool', label: t('explorer.conditionTool', {value: findTool(state.tool)?.name ?? state.tool}), overrides: {tool: ''}});
    if (state.query) conditions.push({key: 'query', label: t('explorer.conditionQuery', {value: state.query}), overrides: {query: ''}});
    if (state.platform !== 'all') conditions.push({key: 'platform', label: t('explorer.conditionPlatform', {value: state.platform}), overrides: {platform: 'all'}});
    if (state.category !== 'all') conditions.push({key: 'category', label: t('explorer.conditionCategory', {value: topicLabel(state.category)}), overrides: {category: 'all'}});
    if (state.toolStatus !== 'all') conditions.push({key: 'toolStatus', label: t('explorer.conditionStatus', {value: t(`recordStates.${state.toolStatus}`)}), overrides: {toolStatus: 'all'}});
    /* issue #7: the default is a real condition, so it is a removable pill like any other and is
       stated rather than applied behind the user's back. It is only listed while a feature is
       selected, because that is the only time it removes anything. Clearing it goes to `all`, which
       is how unknown comes back into view. */
    if (state.features.length && state.support !== 'all') conditions.push({key: 'support', label: t('explorer.conditionSupport', {value: supportModeLabel(state.support)}), overrides: {support: 'all'}});
    if (state.oss !== 'all') conditions.push({key: 'oss', label: t('explorer.conditionOss', {value: state.oss === 'yes' ? 'OSS' : t('unknown')}), overrides: {oss: 'all'}});
    if (state.savedOnly) conditions.push({key: 'savedOnly', label: t('explorer.conditionSaved'), overrides: {savedOnly: false}});
    if (state.nipQuery) conditions.push({key: 'nipQuery', label: t('explorer.conditionNip', {value: state.nipQuery}), overrides: {nipQuery: ''}});
    return conditions;
  }

  function renderConditions(): void {
    const selected = selectedFeatures();
    const conditions = activeConditions();
    els.activeFilterCount.textContent = String(conditions.filter(item => !item.key.startsWith('feature:') && item.key !== 'query').length);
    els.selected.innerHTML = selected.length ? `<strong>${esc(t('explorer.featureAnd'))}:</strong> ${selected.map(feature => `<button class="selected-condition" type="button" data-remove-condition="feature:${feature.id}" aria-label="${esc(t('explorer.conditionRemove', {label: feature.name}))}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="visually-hidden">${esc(feature.name)}</span><span aria-hidden="true">×</span></button>`).join('<span class="and-mark">AND</span>')} <button class="text-button" type="button" data-show-feature-basis>${esc(t('explorer.viewNips'))}</button>` : `<strong>${esc(t('explorer.noFeature'))}</strong>`;
    els.condition.innerHTML = conditions.length ? `<span class="condition-logic">${esc(t('explorer.activeAnd'))}</span>${conditions.map(item => `<button type="button" class="condition-pill" data-remove-condition="${esc(item.key)}" aria-label="${esc(t('explorer.conditionRemove', {label: item.label}))}">${esc(item.label)} <span aria-hidden="true">×</span></button>`).join('')}` : `<span class="condition-logic">${esc(t('explorer.noExtra'))}</span>`;
  }

  function renderNips(): void {
    const numbers = [...new Set(state.features.flatMap(id => featureById[id]?.nips ?? []))];
    // 参照カードも .filter(Boolean) で落とさない。スナップショットに無い id は理由付きで出す。
    const list: readonly {number: string; title: string | null; source: string | null}[] =
      numbers.map(number => nipByNumber[number] ?? {number, title: null, source: null});
    els.nipCount.textContent = `${list.length} NIPs`;
    els.nipList.innerHTML = list.length ? list.map(nip => `<article class="nip-reference-card" id="nip-${esc(nip.number)}" data-registry-status="${nip.title ? 'resolved' : 'not_in_registry'}"><strong>NIP-${esc(nip.number)}</strong><h3>${esc(nip.title || t('explorer.notInRegistry', {revision: registry.revision.slice(0, 7)}))}</h3><p>${esc(nipPurpose(nip.number))}</p>${nip.source ? `<a href="${nip.source}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a>` : ''}</article>`).join('') : `<p class="feature-chip-empty">${esc(t('explorer.chooseForNips'))}</p>`;
  }

  function renderCompareActions(): void {
    // 比較対象は data.js サンプルとリレー由来エントリの両方。tools だけで絞ると relay:<coordinate> が毎回落ちる。
    state.compare = state.compare.filter(id => Boolean(findTool(id)));
    els.compareActions.hidden = !state.compare.length;
    els.compareSummary.textContent = t('explorer.selectedCount', {count: state.compare.length});
    els.openCompare.disabled = state.compare.length < 2;
  }
  function stateMarkup(type: string): string {
    if (type === 'loading') return `<div class="state-message"><div class="nip-skeleton" aria-label="${esc(t('explorer.loading'))}"><span></span><span></span><span></span></div><strong>${esc(t('explorer.loading'))}</strong></div>`;
    if (type === 'empty') return `<div class="state-message"><strong>${esc(t('explorer.emptyState'))}</strong></div>`;
    if (type === 'error') return `<div class="state-message error"><div><strong>${esc(t('explorer.errorState'))}</strong><p><button class="secondary" type="button" data-set-state="normal">${esc(t('explorer.retry'))}</button></p></div></div>`;
    if (type === 'partial') return `<div class="state-message partial"><strong>${esc(t('explorer.partialState'))}</strong></div>`;
    if (type === 'offline') return `<div class="state-message partial"><strong>${esc(t('explorer.offlineState'))}</strong></div>`;
    if (type === 'stale') return `<div class="state-message partial stale"><strong>${esc(t('explorer.staleState'))}</strong></div>`;
    if (type === 'incomplete') return `<div class="state-message partial incomplete"><strong>${esc(t('explorer.incompleteState'))}</strong></div>`;
    if (type === 'unavailable') return `<div class="state-message error unavailable"><div><strong>${esc(t('explorer.unavailableState'))}</strong><p><button class="secondary" type="button" data-relay-action="reload">${esc(t('explorer.relayReload'))}</button></p></div></div>`;
    return '';
  }
  /* `formatObserved`, `categoryFromTopics`, `relayEntryToRow` and `shortKey` were
     lifted into ui/explorer/relay-row.ts in run 2 and field-by-field diffed
     against this closure (0 differing fields). They are imported, not re-derived. */
  function relayCoverageLabel(value: unknown): string {
    const key = value && typeof value === 'object' && 'status' in value
      ? String((value as {status: unknown}).status)
      : String(value);
    return i18n.has(`explorer.coverage.${key}`) ? t(`explorer.coverage.${key}`) : key;
  }
  function relayEntryToTool(entry: CatalogEntry, asOf: number): RelayRow {
    return relayEntryToRow(entry, asOf, categories);
  }
  // カード一覧に出る候補は data.js のサンプルとリレー由来エントリの両方。ダイアログの参照もこの両方を辿る。
  function relayEntries(): readonly RelayRow[] { return relayState ? relayState.entries : []; }
  function findTool(id: string): Row | null {
    const collected: Row | undefined = tools.find(item => item.id === id);
    return collected ?? relayEntries().find(item => item.id === id) ?? null;
  }
  function relayEntry(tool: Row | null): boolean { return Boolean(tool) && tool?.provenance === 'relay'; }
  function observedText(tool: Row): string { return formatObserved(tool.observed) || t('unknown'); }
  function relayDiagnosticsMarkup(result: LoadedCatalog | null): string {
    const summary = `<summary>${esc(t('explorer.relayDiagnostics'))}</summary>`;
    const reload = `<p><button class="secondary" type="button" data-relay-action="reload">${esc(t('explorer.relayReload'))}</button></p>`;
    if (!result) return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<p>${esc(t('explorer.relayNoData'))}</p>${reload}</details>`;
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
    const stats = result.stats;
    const field = (label: string, value: string | number | null | undefined): string =>
      `<div><dt>${esc(label)}</dt><dd>${esc(value == null || value === '' ? t('none') : value)}</dd></div>`;
    const relayRows = relayUrls.length ? relayUrls.map(url => `<li><code>${esc(url)}</code> — ${esc(relayCoverageLabel(coverage[url]))}</li>`).join('') : `<li>${esc(t('none'))}</li>`;
    // §6.2/§3: グラフの状態とカバレッジは数のそばに必ず出す。none は 0 ではなく不明。
    const graphRow = `<dl class="relay-diagnostics-grid">${field(t('explorer.relayGraphState'), t(`explorer.graphStates.${graph.state || 'none'}`))}${field(t('explorer.relayGraphCoverage'), t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`))}${field(t('explorer.relayGraphFollows'), graph.state === 'tier1' ? t('explorer.relayGraphFollowsValue', {used: graph.followsUsed, total: graph.followsTotal}) : t('none'))}${field(t('explorer.relayGraphMalformed'), graph.malformedPTags)}${field(t('explorer.relayViewer'), graph.viewerPubkey ? shortKey(graph.viewerPubkey) : t('none'))}${field(t('explorer.relayViewerSource'), result.viewerSource || 'none')}</dl>`;
    // §6.4: 数の裏にいる pubkey は必ず辿れるようにする。それが唯一の信頼調整手段。
    const curatorRow = (item: CuratorSummary): string => `<li><code>${esc(shortKey(item.curator))}</code><dl class="relay-diagnostics-grid">${field(t('explorer.relayCuratorSets'), t('explorer.relayCuratorSetsValue', {used: item.setsUsed, observed: item.setsObserved}))}${field(t('explorer.relayCuratorMembers'), item.memberCount)}${item.truncated ? field(t('explorer.relayReason'), 'sets-truncated') : ''}</dl></li>`;
    const curatorRows = curators.length ? curators.map(curatorRow).join('') : `<li>${esc(t('explorer.relayNoCuration'))}</li>`;
    const manualRows = manual.length ? `<h4>${esc(t('explorer.relayManualCurators'))}</h4><ul class="relay-diagnostics-list">${manual.map(curatorRow).join('')}</ul>` : '';
    const roundRows = rounds.length ? rounds.map(round => `<li><code>${esc(round.label)}</code><dl class="relay-diagnostics-grid">${field(t('explorer.relayLogical'), round.logicalReqs)}${field(t('explorer.relayPhysical'), round.physicalReqs)}${field(t('explorer.relayChunks'), round.chunks)}${round.reason ? field(t('explorer.relayReason'), round.reason) : ''}</dl></li>`).join('') : `<li>${esc(t('none'))}</li>`;
    const statsRow = `<dl class="relay-diagnostics-grid">${field(t('explorer.relayAsOf'), formatObserved(result.asOf))}${field(t('explorer.relayLogical'), stats.logicalReqs)}${field(t('explorer.relayPhysical'), stats.physicalReqs)}${field(t('explorer.relayHttp'), stats.httpAttempts)}${field(t('explorer.relayCache'), stats.cacheHits)}</dl>`;
    // §4.2 / §3: quarantine は理由付きで残し、「存在しない」とは絶対に言わない。
    const quarantineRows = quarantined.length ? quarantined.map(item => `<li><code>${esc(item.coordinate || t('none'))}</code> — ${esc(item.reason)}${item.eventId ? ` <small>${esc(shortKey(item.eventId))}</small>` : ''}</li>`).join('') : `<li>${esc(t('none'))}</li>`;
    // §5.4: 推薦されたが観測できなかった座標。行を捏造せずここにだけ出す。
    const unresolvedRows = unresolved.length ? unresolved.map(coord => `<li><code>${esc(coord)}</code></li>`).join('') : `<li>${esc(t('none'))}</li>`;
    const slugRow = `<p class="relay-diagnostics-slugs">${slugs.length ? slugs.map(slug => `<code>${esc(slug)}</code>`).join(' ') : esc(t('none'))}</p>`;
    return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<div class="relay-diagnostics-body">`
      + `<section><h3>${esc(t('explorer.relayRelays'))}</h3><ul class="relay-diagnostics-list">${relayRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayGraph'))}</h3>${graphRow}</section>`
      + `<section><h3>${esc(t('explorer.relayCurators'))}</h3><ul class="relay-diagnostics-list">${curatorRows}</ul>${manualRows}</section>`
      + `<section><h3>${esc(t('explorer.relayRounds'))}</h3><ul class="relay-diagnostics-list">${roundRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayReqs'))}</h3>${statsRow}</section>`
      + `<section><h3>${esc(t('explorer.relayQuarantined'))}</h3><ul class="relay-diagnostics-list">${quarantineRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayUnresolved'))}</h3><ul class="relay-diagnostics-list">${unresolvedRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relaySlugs'))}</h3>${slugRow}</section>${reload}</div></details>`;
  }
  // §5.1 rule 5 / D10: 発見はトピック opt-in なので必ず「全部」ではないと明示する。
  function discoveryScopeMarkup(result: LoadedCatalog | null): string {
    const topics = (result ? result.topics : []).join(', ');
    if (!topics) return '';
    return `<p class="discovery-scope" data-discovery-scope>${esc(t('explorer.discoveryScope', {topics}))}</p>`;
  }
  // §6.5.4: グラフが無いときは黙って空にせず、状況と二つの解決手段を出す。
  function graphBannerMarkup(result: LoadedCatalog | null): string {
    const graph = result ? result.graph : null;
    if (!graph) return '';
    if (graph.state !== 'none') {
      const label = graph.state === 'tier1'
        ? t('explorer.graphStateLine', {state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`), used: graph.followsUsed, total: graph.followsTotal})
        : t('explorer.graphStateLineShort', {state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`)});
      return `<p class="graph-state" data-graph-state="${esc(graph.state)}">${esc(label)}</p>`;
    }
    return `<div class="graph-banner" data-graph-state="none"><p>${esc(t('explorer.graphNoneBanner'))}</p>`
      + `<div class="graph-banner-actions"><button class="secondary" type="button" data-graph-connect>${esc(t('explorer.graphConnect'))}</button>`
      + `<label class="graph-npub-field">${esc(t('explorer.graphPasteLabel'))}<input id="graph-npub" type="text" inputmode="text" autocomplete="off" placeholder="npub1…" value="${esc(relayViewer.viewerPubkey)}"></label>`
      + `<button class="secondary" type="button" data-graph-apply>${esc(t('explorer.graphApply'))}</button></div></div>`;
  }
  function applyRelayResult(result: LoadedCatalog | null): void {
    if (!result) { relayState = {active: true, result: null, entries: []}; state.uiState = 'unavailable'; renderResults(); return; }
    const asOf = result.asOf;
    const entries = result.entries.map(entry => relayEntryToTool(entry, asOf));
    relayState = {active: true, result, entries};
    const hasEntries = entries.length > 0;
    let ui: UiState;
    if (result.status === 'incomplete') ui = 'incomplete';
    else if (result.status === 'stale') ui = hasEntries ? 'stale' : 'unavailable';
    else if (result.status === 'fresh') ui = hasEntries ? 'normal' : 'unavailable';
    else ui = 'unavailable';
    state.uiState = ui;
    renderResults();
  }
  // §6.5.4 の二つの手段（NIP-07 接続 / npub 貼り付け）はここで保持する。既定は空で、
  // アプリが既定のキュレーターを持つことはない (§6.5.5)。
  const relayViewer = {viewerPubkey: explorerParams.viewerPubkey};
  /* issue #9: サインインは一箇所しかない。以前はここが window.nostr.getPublicKey() を
     独自に呼び直していて、ヘッダは「サインイン済み」なのにカタログ側は viewerSource:'none'
     のまま、という食い違った二重経路になっていた。拡張に触るのは signIn() だけにして、
     ここは既にサインイン済みの鍵を読むだけにする。貼り付けた鍵 (§6.5.4) が在ればそちらが優先。 */
  const relayResultListeners: ((result: LoadedCatalog | null) => void)[] = [];
  function signedInPubkey(): string { return viewer.status === 'signedIn' ? (viewer.pubkey ?? '') : ''; }
  async function loadRelayCatalog(override?: RelayLoadOverride | Event): Promise<LoadedCatalog | null> {
    const next: RelayLoadOverride = override && typeof override === 'object' && !(override instanceof Event) ? override : {};
    if ('viewerPubkey' in next) relayViewer.viewerPubkey = String(next.viewerPubkey ?? '').trim();
    try {
      // §17.2 / §6.5.6: `?curators=` は掲載ゲートではなく、手動の「これも数える」リスト。
      // 出荷時は空で、行の集合には一切影響しない。
      const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
      const options: {
        relays: string[];
        manualCounted?: string[];
        topics?: string[];
        viewerPubkey?: string;
      } = {relays};
      if (explorerParams.manualCounted.length) options.manualCounted = [...explorerParams.manualCounted];
      if (explorerParams.topics.length) options.topics = [...explorerParams.topics];
      // 貼り付けた鍵が最優先。無ければサインイン済みの鍵。どちらも無ければ鍵は渡さない
      // (未サインインで勝手にプロンプトを出さないし、鍵をでっち上げもしない)。
      const identity = relayViewer.viewerPubkey || signedInPubkey();
      if (identity) options.viewerPubkey = identity;
      state.uiState = 'loading'; renderResults();
      const result = await loadCatalog(options);
      relayResultListeners.forEach(listener => listener(result));
      applyRelayResult(result);
      return result;
    } catch (error) {
      console.error('[nosmaps] relay catalog load failed', error);
      relayResultListeners.forEach(listener => listener(null));
      applyRelayResult(null);
      return null;
    }
  }
  function renderResults(): void {
    renderConditions(); renderNips(); renderCompareActions(); renderSortBar();
    els.offline.hidden = state.uiState !== 'offline';
    const relayActive = Boolean(relayState && relayState.active);
    // グラフの状態バナーと発見スコープの但し書きは、結果が空でも必ず出す。
    const relayContext = relayActive && relayState ? graphBannerMarkup(relayState.result) + discoveryScopeMarkup(relayState.result) : '';
    const diagnostics = relayActive && relayState ? relayDiagnosticsMarkup(relayState.result) : '';
    if (['loading', 'empty', 'error', 'unavailable'].includes(state.uiState)) { els.results.hidden = true; els.resultCount.textContent = t('explorer.count', {count: 0}); els.uiState.innerHTML = stateMarkup(state.uiState) + relayContext + diagnostics; return; }
    els.results.hidden = false;
    /* The set-aside notice sits above the list, so it is present whether the list has rows or none:
       "no candidates" and "no candidates with a stated result" are different sentences (issue #7). */
    els.uiState.innerHTML = (['partial', 'offline', 'stale', 'incomplete'].includes(state.uiState) ? stateMarkup(state.uiState) : '') + relayContext + diagnostics + (relayActive ? '' : unstatedNoticeMarkup());
    let list: readonly Row[] = relayActive && relayState ? relayState.entries : filteredTools();
    if (!relayActive && state.uiState === 'partial') list = list.slice(0, 7);
    els.resultCount.textContent = t('explorer.count', {count: list.length});
    /* 並び替えは行を落とさない。数え上げは並び替える前の list のままで、
       ranked + unranked は必ず list と同じ集合になる（issue #1）。 */
    const sorted = sortedList(list);
    /* 重なりは並べ替えた後の順序から引く。重なりの中の順序と一覧の順序で別の規則を
       使わない（M2.1-1）ので、ここ以外に順序を決める場所は無い。 */
    rebuildStacks([...sorted.ranked, ...sorted.unranked]);
    if (list.length) { els.results.innerHTML = sorted.ranked.map(featureCard).join('') + unrankedMarkup(sorted.unranked); return; }
    if (relayActive) { els.results.innerHTML = `<div class="empty zero-results"><h2>${esc(t('explorer.relayEmptyTitle'))}</h2><p>${esc(t('explorer.relayEmpty'))}</p></div>`; return; }
    const relaxations = activeConditions().map(item => ({...item, count: filteredTools(item.overrides).length})).sort((a, b) => b.count - a.count);
    const suggestion = relaxations[0];
    els.results.innerHTML = `<div class="empty zero-results"><h2>${esc(t('explorer.noMatch'))}</h2><p>${esc(t('explorer.noMatchHelp'))}</p>${suggestion ? `<button class="secondary relaxation-suggestion" type="button" data-remove-condition="${esc(suggestion.key)}">${esc(t('explorer.removeGets', {label: suggestion.label, count: suggestion.count}))}</button>` : `<button class="secondary" type="button" data-reset-all>${esc(t('explorer.resetAll'))}</button>`}</div>`;
  }


  /* ---- 投稿フォーム (issue #9 スライス2, design-relay-native-write-path.md) ----------
     署名済み → publish → 読み戻し → 一覧に1行、という鎖を端から端まで通すのがこのスライス。
     鎖の途中で切れたときに「成功」と読める画面を出さないことだけを守っている。

     成功文言を出す経路はただ一つ、readback.state === 'returned' のときだけ (§W4.3 / W-I3)。
     OK は「リレーがそう言った」という証拠であって、公開されたことの定義ではない。
     楽観的に一覧へ差し込むこともしない (§W5.6) —— 観測していない行は行ではない。

     window.nostr が無いブラウザではフォームごと描画しない (§W1.2 状態1)。無効化されたボタンは
     「ここにその機能はある」と読めてしまい、拡張が無いという事実と食い違う。 */
  interface PublishForm extends PublishDraftFields {
    busy: boolean;
    result: PublishResult | null;
    /* 直前に走らせたのが公開なのか取り下げなのか。結果は publish.result 一つに乗せる
       （表示系を二つ作らない）ので、同じ result をどちらの語彙で読むかだけをここが決める。 */
    action: 'publish' | 'withdraw';
  }
  const publish: PublishForm = {
    dLocal: '', name: '', summary: '', homepage: '', topics: '',
    busy: false, result: null, action: 'publish'
  };
  /* §W6.5 取り下げ。確認待ちと実行中を座標で持つ —— 行ごとに閉じるための鍵であり、
     同じ署名経路に二つ流さないための鍵でもある。 */
  const withdrawState: {confirming: string; busy: string} = {confirming: '', busy: ''};
  const PUBLISH_D_MAX_BYTES = 192;
  /* §W1.4 下書きの保持は ui/explorer/draft-storage.ts に移してある（run 2）。
     消すのは「公開を観測できたとき」だけ、という規則もそこに書いてある。 */
  function saveDraft(): void { saveDraftFields(publish); }
  function restoreDraft(): void { restoreStoredDraft(publish); }
  /* §W0.2 の既定値。テストは待ち時間を潰したいだけなので URL から縮められるようにしてあるが、
     出荷時の値は設計のままで、コードのほうが設計より短気になることはない。 */
  const publishReadbackAttempts = explorerParams.readbackAttempts;
  const publishReadbackBackoff = explorerParams.readbackBackoff;
  const publishTimeoutMs = explorerParams.publishTimeoutMs;

  /** The signing half of NIP-07. Absent is a state the page renders (§W1.2 state 1),
      so it is checked rather than assumed. */
  function signingSigner(): Nip07Signer | null {
    const candidate = (window as {nostr?: unknown}).nostr;
    if (!candidate || typeof candidate !== 'object') return null;
    const signer = candidate as {signEvent?: unknown; getPublicKey?: unknown};
    if (typeof signer.signEvent !== 'function' || typeof signer.getPublicKey !== 'function') return null;
    return candidate as Nip07Signer;
  }
  function signerCanSign(): boolean {
    return signingSigner() !== null;
  }
  function publishDraft(): NostrEvent {
    return buildSoftwareDraft({
      dLocal: publish.dLocal, name: publish.name, summary: publish.summary, homepage: publish.homepage,
      topics: publish.topics.split(',').map(value => value.trim()).filter(Boolean),
      pubkey: viewer.pubkey ?? '', createdAt: Math.floor(Date.now() / 1000)
    });
  }
  /* §W0.1: 出せるかどうかを決めるのは読み取り側と同じ validateSoftwareEvent ただ一つ。
     フォーム独自の判定を持たせると「出せるのに読めない」レコードが作れてしまう。 */
  function publishValidation(): {ok: true} | {ok: false; reason: string} {
    const result = validateSoftwareEvent(publishDraft(), {receivedAtSec: Math.floor(Date.now() / 1000)});
    return result.ok ? {ok: true} : {ok: false, reason: result.reason};
  }
  function publishDBytes(): number {
    const encoder = new TextEncoder();
    return encoder.encode(`${SOFTWARE_D_PREFIX}${publish.dLocal.normalize('NFC').trim()}`).length;
  }
  function publishReasonText(reason: string): string {
    if (!reason) return '';
    return i18n.has(`explorer.publish.reasons.${reason}`) ? t(`explorer.publish.reasons.${reason}`) : t('explorer.publish.reasons.unknownReason', {reason});
  }
  function publishOutcomeText(outcome: string): string {
    return i18n.has(`explorer.publish.outcomes.${outcome}`) ? t(`explorer.publish.outcomes.${outcome}`) : String(outcome);
  }
  /* §W4.4: 「1/2」と「2/2」は世界についての別の事実なので、見出しは必ず数を持つ。
     一部成功のときは「一部のリレーしか持っていない」という帰結まで書く。 */
  function publishResultMarkup(): string {
    const result = publish.result;
    if (!result) return '';
    const total = result.relays.length;
    const accepted = result.relays.filter(entry => entry.outcome === 'accepted').length;
    const rows = result.relays.map((entry: RelayReport) => `<li><code>${esc(entry.url)}</code> — ${esc(publishOutcomeText(entry.outcome))}${entry.notice ? ` — <q class="relay-notice">${esc(entry.notice)}</q>` : ''}</li>`).join('');
    /* §W5: published / published-partial だけが「読み戻せた」を意味する。取り下げの語彙で
       確認を語ってよいのはこの二つのときだけで、判定はここ一箇所にしかない。 */
    const readBack = result.state === 'published' || result.state === 'published-partial';
    const withdrawing = publish.action === 'withdraw';
    let headline: string;
    if (withdrawing) {
      if (result.state === 'published') headline = t('explorer.manage.withdrawHeadlines.confirmed', {accepted, total});
      else if (result.state === 'published-partial') headline = t('explorer.manage.withdrawHeadlines.partial', {accepted, total});
      else if (result.state === 'unconfirmed') headline = t('explorer.manage.withdrawHeadlines.unconfirmed', {attempts: result.attempts});
      else if (result.state === 'failed') headline = t('explorer.manage.withdrawHeadlines.failed');
      else if (result.state === 'invalid') headline = t('explorer.manage.withdrawHeadlines.invalid');
      else if (result.state === 'blocked') headline = t('explorer.manage.withdrawHeadlines.blocked');
      else headline = t('explorer.manage.withdrawHeadlines.other', {state: result.state});
    } else if (result.state === 'published') headline = t('explorer.publish.headlines.published', {accepted, total});
    else if (result.state === 'published-partial') headline = t('explorer.publish.headlines.partial', {accepted, total});
    else if (result.state === 'unconfirmed') headline = t('explorer.publish.headlines.unconfirmed', {attempts: result.attempts});
    else if (result.state === 'failed') headline = t('explorer.publish.headlines.failed');
    else if (result.state === 'invalid') headline = t('explorer.publish.headlines.invalid');
    else if (result.state === 'blocked') headline = t('explorer.publish.headlines.blocked');
    else headline = t('explorer.publish.headlines.other', {state: result.state});
    /* §W6.5: 読み戻せていない取り下げは「取り下げ済み」ではなく「まだ active に見える
       クライアントがある」と書く。一部のリレーにしか届いていないときは、確認できた
       という事実と、届いていないリレーだけを読むクライアントの帰結を両方書く。
       そして取り下げが削除でないことは、確認できたときに必ず書く。 */
    let consequence: string;
    if (withdrawing) {
      const lines = readBack
        ? (result.state === 'published-partial'
          ? [t('explorer.manage.withdrawPartialActive'), t('explorer.manage.withdrawNotDeletion')]
          : [t('explorer.manage.withdrawNotDeletion')])
        : [t('explorer.manage.withdrawStillActive')];
      consequence = lines.map(line => `<p class="publish-consequence">${esc(line)}</p>`).join('');
    } else consequence = result.state === 'published-partial' ? `<p class="publish-consequence">${esc(t('explorer.publish.partialConsequence'))}</p>` : '';
    /* §W3.4 / W-I4: created_at を動かしたなら、動かしたと書く。隠して出すのは「この時刻に
       書いた」という小さなウソになる。clock-conflict のときは何も署名していないので、
       観測した値と端末の時計を並べて、利用者が原因（時計のずれ）に辿り着ける形にする。 */
    let clockNote = '';
    if (result.clock && result.clock.bumped && result.clock.createdAt !== null && result.clock.priorCreatedAt !== null) {
      clockNote = `<p class="publish-clock" data-publish-clock="bumped">${esc(t('explorer.publish.clockBumped', {prior: result.clock.priorCreatedAt, createdAt: result.clock.createdAt}))}</p>`;
    } else if (result.reason === 'clock-conflict' && result.clock && result.clock.priorCreatedAt !== null) {
      clockNote = `<p class="publish-clock" data-publish-clock="conflict">${esc(t('explorer.publish.clockConflictDetail', {prior: result.clock.priorCreatedAt, now: Math.floor(result.asOf / 1000)}))}</p>`;
    }
    const reason = result.reason && !readBack
      ? `<p class="publish-reason" data-publish-reason="${esc(result.reason)}">${esc(publishReasonText(result.reason))}</p>` : '';
    const id = result.eventId ? `<p class="publish-event-id">${esc(t('explorer.publish.eventId'))} <code data-publish-event-id>${esc(result.eventId)}</code></p>` : '';
    return `<div class="publish-result" data-publish-state="${esc(result.state)}" data-publish-action="${esc(publish.action)}">`
      + `<p class="publish-headline" data-publish-headline>${esc(headline)}</p>${consequence}${reason}${clockNote}${id}`
      + `<ul class="publish-relays">${rows}</ul></div>`;
  }
  function publishMarkup(): string {
    // §W1.2 状態1: 拡張が無いなら Publish の UI そのものを描かない。
    if (!signerCanSign()) return `<p class="publish-unavailable" data-publish-unavailable>${esc(t('explorer.publish.noSigner'))}</p>`;
    if (viewer.status !== 'signedIn') return `<p class="publish-unavailable" data-publish-unavailable>${esc(t('explorer.publish.signInFirst'))}</p>`;
    const validation = publishValidation();
    const bytes = publishDBytes();
    const canPublish = validation.ok && !publish.busy;
    const hint = validation.ok ? '' : publishReasonText(validation.reason);
    return `<h2 class="publish-title">${esc(t('explorer.publish.title'))}</h2>`
      + `<p class="publish-lead">${esc(t('explorer.publish.lead'))}</p>`
      + `<form class="publish-form" data-publish-form novalidate>`
      + `<label class="field">${esc(t('explorer.publish.dLocal'))}<input id="publish-d" type="text" autocomplete="off" value="${esc(publish.dLocal)}" placeholder="com.example.tool"><small class="publish-bytes" data-publish-bytes>${esc(t('explorer.publish.dBytes', {bytes, max: PUBLISH_D_MAX_BYTES}))}</small></label>`
      + `<label class="field">${esc(t('explorer.publish.name'))}<input id="publish-name" type="text" autocomplete="off" value="${esc(publish.name)}"></label>`
      + `<label class="field">${esc(t('explorer.publish.summary'))}<textarea id="publish-summary" rows="3">${esc(publish.summary)}</textarea><small>${esc(t('explorer.publish.summaryHelp'))}</small></label>`
      + `<label class="field">${esc(t('explorer.publish.homepage'))}<input id="publish-homepage" type="text" autocomplete="off" inputmode="url" value="${esc(publish.homepage)}" placeholder="https://"></label>`
      + `<label class="field">${esc(t('explorer.publish.topics'))}<input id="publish-topics" type="text" autocomplete="off" value="${esc(publish.topics)}" placeholder="clients, relay"><small>${esc(t('explorer.publish.topicsHelp'))}</small></label>`
      + `<p class="publish-hint" data-publish-hint>${esc(hint)}</p>`
      + `<button class="primary" type="submit" data-publish-submit ${canPublish ? '' : 'disabled'}>${esc(publish.busy ? t('explorer.publish.publishing') : t('explorer.publish.submit'))}</button>`
      + `</form>${publishResultMarkup()}${myRecordsMarkup()}`;
  }

  /* ---- 自分が出したレコードの一覧 (issue #12) --------------------------------
     出せるのは「このリレーで観測できたもの」だけ。observed でないものを一覧に足さないのは
     公開経路と同じ規則 (§W5.6) で、逆に「問い合わせが完了しなかった」を 0 件と書かないのも
     同じ理由からくる —— 見ていないことを見た結果として出さない。 */
  const myRecords: {
    /** 'signed-out' は「一覧そのものを描かない」状態。属性には出ない（枠ごと出さない）。 */
    state: 'signed-out' | 'loading' | MyRecordsState;
    result: MyRecordsResult | null;
    /** 取得を始めた鍵。多重発行のガードであり、鍵が変われば取り直すという規則でもある。 */
    loadedFor: string;
  } = {state: 'signed-out', result: null, loadedFor: ''};

  /* 取り下げは押した瞬間には走らない。行の中で二段構えにしてあるのは、確認の文言
     （取り下げは削除ではない、§W6.5 / §7.3）を読む場所を作るため。 */
  function myRecordActionsMarkup(record: SoftwareRecord): string {
    const coordinate = record.coordinate;
    const busy = withdrawState.busy === coordinate;
    /* 走らせてよいのは一度に一つ。公開フォームか他の行が走っている間は、この行も押せない。 */
    const locked = publish.busy || withdrawState.busy !== '';
    if (withdrawState.confirming === coordinate && !busy) {
      return `<div class="my-record-actions" data-withdraw-panel="${esc(coordinate)}">`
        + `<p class="my-record-withdraw-prompt">${esc(t('explorer.manage.withdrawPrompt', {name: record.name}))}</p>`
        + `<button type="button" data-withdraw-confirm="${esc(coordinate)}"${locked ? ' disabled' : ''}>${esc(t('explorer.manage.withdrawConfirm'))}</button>`
        + `<button type="button" data-withdraw-cancel="${esc(coordinate)}">${esc(t('explorer.manage.withdrawCancel'))}</button>`
        + `</div>`;
    }
    return `<div class="my-record-actions">`
      + `<button type="button" data-withdraw-record="${esc(coordinate)}"${locked ? ' disabled' : ''}>`
      + `${esc(busy ? t('explorer.manage.withdrawing') : t('explorer.manage.withdraw'))}</button></div>`;
  }
  function myRecordRowMarkup(record: SoftwareRecord): string {
    return `<li class="my-record" data-my-record data-coordinate="${esc(record.coordinate)}" data-event-id="${esc(record.eventId ?? '')}">`
      + `<strong class="my-record-name">${esc(record.name)}</strong>`
      + `<span class="my-record-field"><span class="my-record-label">${esc(t('explorer.manage.coordinate'))}</span> <code class="my-record-d">${esc(record.d)}</code></span>`
      + `<span class="my-record-field"><span class="my-record-label">${esc(t('explorer.manage.updatedAt'))}</span> <time>${esc(formatObserved(record.createdAt * 1000))}</time></span>`
      + myRecordActionsMarkup(record)
      + `</li>`;
  }
  function myRecordsMarkup(): string {
    // 未サインインなら一覧は無い。空の一覧を出すと「0件だった」と読めてしまう。
    if (viewer.status !== 'signedIn' || myRecords.state === 'signed-out') return '';
    const state = myRecords.state;
    const note = (key: string): string => `<p class="my-records-note">${esc(t(`explorer.manage.${key}`))}</p>`;
    let body: string;
    if (state === 'loading') body = note('loading');
    else if (state === 'unavailable') body = note('unavailable');
    else if (state === 'query-failed') body = note('queryFailed');
    else if (state === 'empty' || !myRecords.result) body = note('empty');
    else {
      const result = myRecords.result;
      body = `<p class="my-records-count">${esc(t('explorer.manage.count', {count: result.records.length}))}</p>`
        + `<ul class="my-records-list">${result.records.map(myRecordRowMarkup).join('')}</ul>`
        // 上限まで読んだなら、その先を見ていないことを書く。
        + (result.truncated ? `<p class="my-records-note">${esc(t('explorer.manage.truncated', {limit: MANAGE_LIMIT}))}</p>` : '');
    }
    return `<section class="my-records" data-my-records="${esc(state)}">`
      + `<h3 class="my-records-title">${esc(t('explorer.manage.title'))}</h3>${body}</section>`;
  }
  function renderMyRecords(): void {
    const host = $('#publish-panel');
    const section = host ? host.querySelector('[data-my-records]') : null;
    // 枠がまだ無いなら出す場所も無い。renderPublish が描いたときに一緒に出る。
    if (!section) return;
    section.outerHTML = myRecordsMarkup();
  }
  async function loadMyRecords(force?: boolean): Promise<void> {
    const pubkey = signedInPubkey();
    if (!pubkey) {
      myRecords.state = 'signed-out';
      myRecords.result = null;
      myRecords.loadedFor = '';
      return;
    }
    // 同じ鍵で既に取りに行ったなら二重に発行しない。鍵が変わったときだけ取り直す。
    if (!force && myRecords.loadedFor === pubkey) return;
    myRecords.loadedFor = pubkey;
    myRecords.state = 'loading';
    myRecords.result = null;
    renderMyRecords();
    const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
    let result: MyRecordsResult;
    try {
      result = await fetchMyRecords({relays, pubkey});
    } catch (error) {
      /* 例外は「0件」ではない。問い合わせが完了していないのだから query-failed と書く。 */
      console.error('[nosmaps] my records load failed', error);
      myRecords.state = 'query-failed';
      myRecords.result = null;
      renderMyRecords();
      return;
    }
    // 途中で鍵が変わっていたら、前の鍵の答えを今の鍵の一覧として出さない。
    if (signedInPubkey() !== pubkey) return;
    myRecords.state = result.state;
    myRecords.result = result;
    renderMyRecords();
  }

  function renderPublish(): void {
    const host = $('#publish-panel');
    if (!host) return;
    /* 描く前に発火する。loadMyRecords は最初の await より前に 'loading' を立てるので、
       ここで描く枠は「まだ取りに行っていない」ではなく「取得中」から始まる。 */
    void loadMyRecords();
    host.innerHTML = publishMarkup();
  }
  /* 打鍵のたびにフォームごと描き直すとキャレットが飛ぶので、判定に連動する部分だけ差し替える。 */
  function refreshPublishState(): void {
    const host = $('#publish-panel');
    if (!host) return;
    const button = host.querySelector<HTMLButtonElement>('[data-publish-submit]');
    const hint = host.querySelector<HTMLElement>('[data-publish-hint]');
    const bytes = host.querySelector<HTMLElement>('[data-publish-bytes]');
    if (!button || !hint || !bytes) return;
    const validation = publishValidation();
    button.disabled = !(validation.ok && !publish.busy);
    hint.textContent = validation.ok ? '' : publishReasonText(validation.reason);
    bytes.textContent = t('explorer.publish.dBytes', {bytes: publishDBytes(), max: PUBLISH_D_MAX_BYTES});
  }
  async function submitPublish(): Promise<void> {
    if (publish.busy || withdrawState.busy) return;
    const signer = signingSigner();
    if (!signer) return;
    publish.busy = true;
    publish.action = 'publish';
    publish.result = null;
    renderPublish();
    const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
    let result: PublishResult;
    try {
      result = await publishSoftwareRecord({
        relays,
        signer,
        expectPubkey: viewer.pubkey ?? '',
        draft: {
          dLocal: publish.dLocal, name: publish.name, summary: publish.summary, homepage: publish.homepage,
          topics: publish.topics.split(',').map(value => value.trim()).filter(Boolean)
        },
        readbackAttempts: publishReadbackAttempts,
        readbackBackoffMs: publishReadbackBackoff,
        publishTimeoutMs: publishTimeoutMs
      });
    } catch (error) {
      // 例外を成功に読ませない。理由が分からないなら分からないと書く。
      console.error('[nosmaps] publish failed', error);
      result = {
        state: 'failed', reason: 'publish-error', eventId: null, coordinate: null, event: null,
        relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
        readback: null, clock: null, attempts: 0, asOf: Date.now()
      };
    }
    publish.busy = false;
    publish.result = result;
    /* §W1.4: 保存した下書きを捨ててよいのは、公開を実際に観測できたときだけ。
       failed / blocked / invalid / unconfirmed では打った文字をそのまま残す。 */
    if (result.state === 'published' || result.state === 'published-partial') clearStoredDraft();
    renderPublish();
    // §W5.6: 一覧に出るのは観測できたレコードだけ。読み戻せたときにだけ読み直す。
    if (result.state === 'published' || result.state === 'published-partial') {
      // 自分のレコード一覧も同じ規則で、読み戻せたときにだけ取り直す。
      void loadMyRecords(true);
      await loadRelayCatalog();
    }
  }

  /* §W6.2 / §W6.5 取り下げ。公開とまったく同じ一本の経路（NIP-07 で署名 → sendEvent →
     読み戻し）を通り、違うのは content の state だけ。kind 5 は送らない（§W6.6：削除要求は
     「消えた」と読まれるが、消えはしない）。§7.1 は name / summary を必須と定めているので、
     観測できたレコードの値をそのまま載せ直す —— 取り下げのために内容を空にすると、
     その版は読み取り側から見えないレコードになる。 */
  async function withdrawRecord(coordinate: string): Promise<void> {
    if (publish.busy || withdrawState.busy) return;
    /* 出すのは観測できたレコードだけ。一覧に無い座標を取り下げると、見ていないものについて
       署名することになる。 */
    const record = myRecords.result?.records.find(item => item.coordinate === coordinate);
    if (!record) return;
    const signer = signingSigner();
    if (!signer) return;
    withdrawState.confirming = '';
    withdrawState.busy = coordinate;
    publish.busy = true;
    publish.action = 'withdraw';
    publish.result = null;
    renderPublish();
    const relays = explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS];
    const dLocal = record.d.startsWith(SOFTWARE_D_PREFIX) ? record.d.slice(SOFTWARE_D_PREFIX.length) : record.d;
    let result: PublishResult;
    try {
      result = await withdrawSoftwareRecord({
        relays,
        signer,
        expectPubkey: viewer.pubkey ?? '',
        draft: {
          dLocal, name: record.name, summary: record.summary, homepage: record.homepage ?? '',
          topics: [...record.topics]
        },
        readbackAttempts: publishReadbackAttempts,
        readbackBackoffMs: publishReadbackBackoff,
        publishTimeoutMs: publishTimeoutMs
      });
    } catch (error) {
      // 例外を成功に読ませない。取り下がったかどうか分からないなら分からないと書く。
      console.error('[nosmaps] withdraw failed', error);
      result = {
        state: 'failed', reason: 'publish-error', eventId: null, coordinate: null, event: null,
        relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
        readback: null, clock: null, attempts: 0, asOf: Date.now()
      };
    }
    publish.busy = false;
    withdrawState.busy = '';
    publish.result = result;
    renderPublish();
    /* §W5.6 / §W6.5: 取り下げを読み戻せたときにだけ読み直す。読み戻せていないのに一覧を
       作り直すと、消えた行が「取り下がった証拠」に見えてしまう —— それはまだ観測していない。 */
    if (result.state === 'published' || result.state === 'published-partial') {
      void loadMyRecords(true);
      await loadRelayCatalog();
    }
  }

  /* issue #20: いいね = 対象エントリの座標への kind 7、取り消し = その kind 7 への kind 5。
     どちらも Publish と同じ経路（NIP-07 で署名 → data/publish.ts の sendEvent でリレーへ）を通る。
     押している間は二重発行しないように行ごとに閉じる。表示は下の applyObservation でしか動かない
     ので、「押したから増えた」という数はどこにも作られない。 */
  const reactionBusy = new Set<string>();

  /** 観測できたものだけを表に反映する。観測できなかった座標は触らない — 「見ていない」を
      「0 件だった」に書き換えないため。 */
  function applyObservation(observation: ReactionObservation | null): void {
    if (!observation || observation.state !== 'observed') return;
    const byCoordinate = new Map<string, Row>();
    for (const row of [...tools, ...relayEntries()]) {
      const coordinate = reactionTarget(row);
      if (coordinate) byCoordinate.set(coordinate, row);
    }
    for (const coordinate of observation.coordinates) {
      const row = byCoordinate.get(coordinate);
      if (!row) continue;
      const count = observation.counts[coordinate];
      if (count === undefined) continue;
      state.reactions[row.id] = {count, mine: observation.mine[coordinate] ?? null};
    }
  }

  /* 数を見に行くのは「その行の詳細を開いたとき」だけ。一覧のロードに相乗りさせると §9.2 の
     ラウンド予算（1ロードあたり論理3ラウンド）を勝手に増やすことになる。座標ごとに一度だけ。
     リレーを見ていない静的ページでは一切ソケットを開かない ＝ 数は unknown のままで、
     「見ていない」を 0 と書かない。 */
  const reactionsRequested = new Set<string>();
  async function ensureReactionsObserved(tool: Row): Promise<void> {
    if (!relayState || !relayState.active) return;
    const coordinate = reactionTarget(tool);
    if (!coordinate || reactionsRequested.has(coordinate)) return;
    reactionsRequested.add(coordinate);
    const observation = await observeReactions([coordinate], {
      relays: explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS],
      viewerPubkey: signedInPubkey()
    });
    /* 観測できなかったら記録を残さない。次に開いたときにもう一度見に行けるよう、要求済みの印も外す。 */
    if (observation.state !== 'observed') { reactionsRequested.delete(coordinate); return; }
    applyObservation(observation);
    renderResults(); rerenderOpenDialogs();
  }

  function reactionToast(result: ReactionResult): void {
    if (result.state === 'published') { toast(t('explorer.toastLiked')); return; }
    if (result.state === 'unconfirmed') { toast(t('explorer.toastLikeUnconfirmed')); return; }
    toast(t('explorer.toastLikeFailed'));
  }

  async function toggleLike(id: string): Promise<void> {
    const tool = findTool(id);
    if (!tool) return;
    const coordinate = reactionTarget(tool);
    // 押せない理由があるならボタンは disabled で出ている。ここは念のための二重の鍵。
    if (!coordinate || likeBlocker(tool) !== null || reactionBusy.has(id)) return;
    const signer = signingSigner();
    if (!signer) return;
    reactionBusy.add(id);
    renderResults(); rerenderOpenDialogs();
    /* 一覧に出ている座標をまとめて同じラウンドで数え直す。行ごとに REQ を増やさないための束ね方
       であって、押した行以外の数を勝手に作るわけではない（返ってきた分だけ反映する）。 */
    const listed = [...new Set([...tools, ...relayEntries()]
      .map(row => reactionTarget(row))
      .filter((value): value is string => value !== null))];
    const options = {
      relays: explorerParams.relays.length ? [...explorerParams.relays] : [...POLICY.DEFAULT_RELAYS],
      signer,
      expectPubkey: viewer.pubkey ?? '',
      publishTimeoutMs,
      observeCoordinates: listed
    };
    const mine = myReactionId(tool);
    let result: ReactionResult;
    try {
      result = mine === null
        ? await publishReaction(coordinate, options)
        : await retractReaction(coordinate, mine, options);
    } catch (error) {
      // 例外を成功に読ませない。分からないなら分からないと出す。
      console.error('[nosmaps] reaction failed', error);
      reactionBusy.delete(id);
      renderResults(); rerenderOpenDialogs();
      toast(t('explorer.toastLikeFailed'));
      return;
    }
    reactionBusy.delete(id);
    applyObservation(result.observation);
    renderResults(); rerenderOpenDialogs();
    reactionToast(result);
  }

  function renderAll(): void { renderIdentity(); renderFeatures(); renderFilterPanel(); els.query.value = state.query; renderResults(); renderPublish(); rerenderOpenDialogs(); }
  function dialogFocusables(dialog: ParentNode): HTMLElement[] { return focusableElements(dialog).filter(element => element.getClientRects().length); }
  function focusKey(element: Element | null): string | null {
    if (!(element instanceof HTMLElement)) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    for (const name of ['selectFeature', 'language', 'evidenceTool', 'evidenceNip', 'featureDetail', 'reviewTool', 'reviewer', 'openImage', 'imageReview', 'galleryTool', 'compareRemove']) if (element.dataset[name] !== undefined) return `[data-${name.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`)}="${CSS.escape(element.dataset[name])}"]`;
    return null;
  }
  function restoreFocus(key: string | null, root: ParentNode = document): void {
    if (key) requestAnimationFrame(() => { root.querySelector<HTMLElement>(key)?.focus(); });
  }
  function openDialog(
    dialog: HTMLDialogElement, context: DialogContext,
    opener: Element | null = lastInteractive ?? document.activeElement
  ): void {
    dialogContexts.set(dialog, context);
    if (opener instanceof HTMLElement) dialogOpeners.set(dialog, opener);
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => { dialogFocusables(dialog)[0]?.focus(); });
  }
  function dialogHead(kicker: string, title: string): string { return `<div class="dialog-head"><div><div class="dialog-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2></div><div class="dialog-tools"><button class="icon-btn" type="button" data-close-dialog aria-label="${esc(t('close'))}" title="${esc(t('close'))}">×</button></div></div>`; }

  /* §21.10 item 3: this used to `return` when `nipByNumber[record.nip]` was undefined, so a claim
     against NIP-5A, NIP-7D or NIP-12 opened an empty dialog. The claim is the subject of the row, so
     it renders whether or not the pinned snapshot resolves it. */
  function renderEvidence(context: DialogContext & {type: 'evidence'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    const record = tool ? capabilitiesOf(tool).find(item => item.key === context.nip) : undefined;
    if (!tool || !record) return;
    const nip = record.family === registry.family ? nipByNumber[record.id] : null;
    const label = `${record.family.toUpperCase()}-${record.id}${record.scope ? `@${record.scope}` : ''}${record.sub ? `/${record.sub}` : ''}`;
    const registryLine = record.registryStatus === 'resolved'
      ? `${registryStatusLabel('resolved')} — ${record.registryTitle}${record.deprecated ? ` (${t('explorer.registryDeprecated')})` : ''}`
      : record.registryStatus === 'not_in_registry'
        ? `${registryStatusLabel('not_in_registry')} — ${t('explorer.notInRegistry', {revision: registry.revision.slice(0, 7)})}`
        : `${registryStatusLabel('unresolvable')} — ${t('explorer.noRegistrySnapshot', {family: record.family})}`;
    els.evidenceDialog.setAttribute('aria-label', `${tool.name} · ${label}`);
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.detailKicker'), `${tool.name} · ${label}`)}<p>${esc(t('explorer.supportFor', {feature: context.featureId ? featureName(context.featureId) : (record.registryTitle || label)}))} ${supportBadge(record.result)}</p><section class="dialog-layer fact-layer"><h3>${esc(t('explorer.facts'))}</h3><p>${esc(evidenceText(record.result))}</p>${record.caveat ? `<p class="claim-caveat">${esc(t('explorer.caveat'))}: ${esc(record.caveat)}</p>` : ''}<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.state'))}</dt><dd>${esc(statusLabel(record.result))}</dd></div><div><dt>${esc(t('explorer.basis'))}</dt><dd>${esc(basisLabel(record.basis))}</dd></div><div><dt>${esc(t('explorer.assertedAt'))}</dt><dd>${esc(record.assertedAt || t('unknown'))}</dd></div><div><dt>${esc(t('explorer.registryStatus'))}</dt><dd data-registry-status="${esc(record.registryStatus)}">${esc(registryLine)}</dd></div><div><dt>${esc(t('explorer.nipPurpose'))}</dt><dd>${esc(nip ? nipPurpose(record.id) : t('unknown'))}</dd></div><div><dt>${esc(t('explorer.sourceText'))}</dt><dd class="source-text">${esc(record.sourceText || t('unknown'))}</dd></div></dl>${record.source ? `<a href="${esc(record.source)}" target="_blank" rel="noreferrer">${esc(t('explorer.claimSource'))}</a> ` : ''}${nip ? `<a href="${esc(nip.source)}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a>` : ''}</section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function sourceListMarkup(tool: Row): string {
    const sources: readonly ProvenanceSource[] = tool.provenance === 'relay' ? [] : tool.sources;
    const rows = sources.map(item => `<li><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.url)}</a> <small>${esc(item.fields.join(', '))} · ${esc(item.fetched)}</small><br><small>${esc(item.what)}</small></li>`).join('');
    return rows ? `<ul class="source-list">${rows}</ul>` : `<p class="no-support-record">${esc(t('none'))}</p>`;
  }
  function claimBlockMarkup(tool: Row): string {
    /* A relay row carries no claim document at all — the record does not state one,
       which is why every field below renders as its own explicit absence. */
    const claim: ToolClaim | null = tool.provenance === 'relay' ? null : tool.claim;
    const caveats = (claim?.caveats ?? []).map(text => `<li>${esc(text)}</li>`).join('');
    /* §21.7: a module or crate named after a NIP is not a support claim. It is recorded so a
       library does not read as empty, and it is labelled as what it is. */
    const nonClaims = (claim?.nonClaims ?? []).map(item => `<p class="non-claim">${esc(t(`explorer.nonClaim.${item.kind}`))}: <code>${esc(item.values.join(', '))}</code></p>`).join('');
    const capabilities = capabilitiesOf(tool);
    const rows = capabilities.length
      ? capabilities.map(record => capabilityChip(tool, record)).join('')
      : `<p class="claim-summary is-unknown" data-claim-summary="none">${esc(t('explorer.noClaimPublished'))} ${unknownMarker()}</p>`;
    return `<section class="dialog-layer claim-layer"><h3>${esc(t('explorer.capabilityClaims'))}</h3>${claimSummaryMarkup(tool)}<div class="basis-nips">${rows}</div>`
      + `<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.basis'))}</dt><dd>${esc(capabilities.length ? basisLabel(capabilities[0]?.basis) : t('unknown'))}</dd></div><div><dt>${esc(t('explorer.notation'))}</dt><dd>${esc(claim?.notation || t('unknown'))}</dd></div></dl>`
      + `${claim?.source ? `<a href="${esc(claim.source)}" target="_blank" rel="noreferrer">${esc(t('explorer.claimSource'))}</a>` : ''}${nonClaims}`
      + `${caveats ? `<details class="claim-caveats"><summary>${esc(t('explorer.claimCaveats'))}</summary><ul>${caveats}</ul></details>` : ''}</section>`;
  }
  /* issue #6: everything the collapsed card used to print now lands here, behind one press.
     The order is the order of the questions: what is it, what is observed about it, what does it
     claim, what have people said. Nothing is invented on the way in -- every helper is the same
     one the card called, so an absent field still renders as its own explicit absence. */
  function renderToolDetail(context: DialogContext & {type: 'toolDetail'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    if (!tool) return;
    // 説明文は署名済み content の summary だけ。空文字は「未公開」として明示する (§21.5)。
    const description = relayEntry(tool) ? (tool.summary || t('explorer.summaryAbsent')) : toolDescription(tool);
    const reviews = allReviews(tool);
    const bookmark = state.bookmarks[tool.id];
    // 選択中の機能に対する対応まとめ。カードから移したが、条件は一覧の状態のままを映す。
    const supports = state.features.map(id => localizedFeature(id)).map(feature => ({feature, support: featureSupport(tool, feature)}));
    els.evidenceDialog.setAttribute('aria-label', tool.name);
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.details'), tool.name)}<p class="detail-provenance">${provenanceBadge(tool)}<span class="record-state ${esc(tool.recordState)}">${esc(t(`recordStates.${tool.recordState}`))}</span></p><p class="tool-summary${tool.provenance !== 'relay' && tool.summaryAbsent ? ' is-unknown' : ''}">${esc(description)}</p><section class="dialog-layer fact-layer"><h3>${esc(t('explorer.facts'))}</h3><div class="support-line">${supports.length ? supports.map(item => `<span class="feature-support-summary">${esc(item.feature.name)} ${supportBadge(item.support)}</span>`).join('') : `<span class="tag">${esc(t('explorer.noFeatureCondition'))}</span>`}${topicTags(tool)}${platformTags(tool)}</div><dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.recordState'))}</dt><dd>${esc(t(`recordStates.${tool.recordState}`))}</dd></div><div><dt>${esc(t('explorer.observed'))}</dt><dd>${esc(observedText(tool))}</dd></div><div><dt>${esc(t('explorer.category'))}</dt><dd>${esc(topicsText(tool))}</dd></div><div><dt>${esc(t('explorer.os'))}</dt><dd>${esc(osText(tool))}</dd></div><div><dt>${esc(t('explorer.license'))}</dt><dd>${esc(displayLicense(tool))}</dd></div></dl>${livenessMarkup(tool)}${tool.provenance !== 'relay' && tool.topicCorrection ? `<p class="topic-correction">${esc(t('explorer.topicCorrection', {collected: tool.collectedTopics.join(', ') || t('none')}))} ${esc(tool.topicCorrection)}</p>` : ''}<nav class="resource-links" aria-label="${esc(t('explorer.officialLinks', {name: tool.name}))}">${resourceLinks(tool)}</nav><h4>${esc(t('explorer.primarySources'))}</h4>${sourceListMarkup(tool)}</section>${claimBlockMarkup(tool)}<section class="dialog-layer evaluation-layer"><h3>${esc(t('explorer.evaluations'))}</h3>${cardReviewThumbnails(tool)}<div class="evaluation-actions">${likeButtonMarkup(tool)}<button type="button" data-bookmark-tool="${esc(tool.id)}" aria-pressed="${Boolean(bookmark)}">${esc(t(bookmark ? 'explorer.bookmarked' : 'explorer.bookmark'))}</button><button type="button" data-review-tool="${esc(tool.id)}">${esc(t('explorer.reviews', {count: reviews.length}))}</button></div>${bookmark ? `<label class="public-toggle"><input type="checkbox" data-public-bookmark="${esc(tool.id)}" ${bookmark.public ? 'checked' : ''}> ${esc(t('explorer.publicToggle'))}</label><span class="privacy-state">${esc(t(bookmark.public ? 'explorer.public' : 'explorer.privateDefault'))}</span>` : `<span class="privacy-state">${esc(t('explorer.privateDefault'))}</span>`}${reviews.length ? '' : `<p class="no-support-record">${esc(t('explorer.noReviewsObserved'))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
    // 詳細を開いた行の いいね数 は、開いたその場で観測しに行く（issue #20）。
    void ensureReactionsObserved(tool);
  }

  function resourceUrl(tool: Row, type: string): string {
    /* The `sample` branch below is unreachable with the shipped catalogue (no row
       carries that provenance); it is kept because deleting it would be a
       behaviour change, and this port makes none. */
    if (provenanceOf(tool) === 'sample') {
      const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const generated: Readonly<Record<string, string | undefined>> = {
        site: `https://${slug}.example.invalid/`, distribution: `https://store.example.invalid/apps/${slug}`,
        docs: `https://docs.${slug}.example.invalid/`, source: `https://code.example.invalid/${slug}/source`
      };
      return generated[type] ?? '';
    }
    // 収集済みエントリは一次情報が述べた値だけ。生成した URL は一つも出さない。
    const stated: Readonly<Record<string, string | null | undefined>> = tool.provenance === 'relay'
      ? {site: tool.homepage}
      : {site: tool.homepage, distribution: tool.distribution, source: tool.sourceRepo};
    return stated[type] ?? '';
  }
  /* 一次情報が述べた値が本当に http(s) の URL のときだけ、本物のリンクにする。判定は URL パーサに
     任せ、`javascript:` などスキームの違うものは素通しさせない。href もリンク文字も一次情報の文字列
     そのままで、`new URL().href` の正規化形は使わない (`https://albyhub.com` は末尾に `/` が付く)。 */
  /** @param {string | null | undefined} value @returns {string | null} */
  function httpUrl(value: string | null | undefined): string | null {
    if (typeof value !== 'string' || !value) return null;
    let parsed: URL;
    try { parsed = new URL(value); } catch { return null; }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null;
  }
  /* URL を述べていない欄はリンクにしない。空の href は自分自身に飛ぶ死んだリンクになり、
     URL でない文章 (Damus の配布欄は "Apple App Store id1628663131 (README badge link)") を
     リンクにすれば行き先を捏造することになる。述べていないときは `unknown` の語彙で不在を書く。 */
  /** @param {string | null | undefined} value */
  function resourceValueMarkup(value: string | null | undefined): string {
    const url = httpUrl(value);
    if (!url) return esc(value || t('unknown'));
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(t('explorer.opensInNewTab'))}">${esc(url)}</a>`;
  }
  function renderResource(context: DialogContext & {type: 'resource'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const typeLabel = t(`explorer.${context.resourceType}`);
    const url = relayEntry(tool) ? (context.resourceType === 'site' ? (tool.homepage ?? '') : '') : resourceUrl(tool, context.resourceType);
    els.evidenceDialog.setAttribute('aria-label', t('explorer.linkDetails', {type: typeLabel}));
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.linkDetails', {type: typeLabel}), tool.name)}<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.displayUrl'))}</dt><dd>${resourceValueMarkup(url)}</dd></div><div><dt>${esc(t('explorer.checkedAt'))}</dt><dd>${esc(observedText(tool))}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function renderFeatureBasis(context: DialogContext = {type: 'featureBasis'}, shouldOpen = true): void {
    const selected = selectedFeatures();
    els.evidenceDialog.setAttribute('aria-label', t('explorer.evidenceTitle'));
    els.evidenceContent.innerHTML = `${dialogHead('NIP', t('explorer.evidenceTitle'))}<div class="feature-basis-list">${selected.flatMap(feature => feature.nips.map(number => nipByNumber[number] || {number, title: null, source: null}).map(nip => `<article class="nip-reference-card" data-registry-status="${nip.title ? 'resolved' : 'not_in_registry'}"><strong>${esc(feature.name)} · NIP-${esc(nip.number)}</strong><h3>${esc(nip.title || t('explorer.notInRegistry', {revision: registry.revision.slice(0, 7)}))}</h3><p>${esc(nipPurpose(nip.number))}</p>${nip.source ? `<a href="${nip.source}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a>` : ''}</article>`)).join('')}</div>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }

  function comparisonItem(label: string, values: readonly string[], contents: readonly string[], icon = ''): {different: boolean; markup: string} {
    const different = new Set(values).size > 1;
    return {different, markup: `<section class="comparison-item ${different ? 'is-different' : 'is-identical'}" data-difference="${different}"><div class="comparison-label">${icon}<span>${esc(label)}</span></div><div class="comparison-values">${contents.join('')}</div></section>`};
  }
  function renderCompare(context: DialogContext = {type: 'compare'}, shouldOpen = true): void {
    const selected = state.compare.flatMap(id => { const found = findTool(id); return found ? [found] : []; });
    const alternatives = filteredTools().filter(tool => !state.compare.includes(tool.id));
    const items = featureDefinitions.map(definition => {
      const records = selected.map(tool => featureSupportRecord(tool, definition));
      /* 主張が無い欄は「—」ではなく unknown のバッジで出す。空欄・ダッシュは否定に読める。
         主張が別ファミリだけのときは out_of_family で、unknown とも否定とも別の第三の答え。 */
      const values = selected.map(tool => featureSupport(tool, definition));
      return comparisonItem(featureName(definition.id), values, selected.map((tool, index) => {
        const record = records[index];
        return `<div class="comparison-value" data-support="${esc(values[index])}">${supportBadge(values[index] ?? 'unknown')}${record ? `<button class="comparison-evidence" type="button" data-evidence-tool="${esc(tool.id)}" data-evidence-nip="${esc(record.key)}" data-evidence-feature="${definition.id}">${esc(t('explorer.nipEvidence'))}</button>` : ''}</div>`;
      }), `<span class="feature-symbol" aria-hidden="true">${iconSvg(definition.icon)}</span>`);
    });
    const basics = [
      // OS / カテゴリも observedText と同じ扱い: 観測がない欄は「不明」語彙で埋め、空欄にも捏造にもしない。
      comparisonItem(t('explorer.os'), selected.map(tool => osText(tool)), selected.map(tool => `<div class="comparison-value">${esc(osText(tool))}</div>`)),
      comparisonItem(t('explorer.category'), selected.map(tool => categoryText(tool)), selected.map(tool => `<div class="comparison-value">${esc(categoryText(tool))}</div>`)),
      comparisonItem('OSS', selected.map(tool => displayLicense(tool)), selected.map(tool => `<div class="comparison-value">${esc(displayLicense(tool))}</div>`)),
      // §21.10 item 4: レコードの状態とプロジェクトの生存は別行。ひとつのバッジに混ぜない。
      comparisonItem(t('explorer.recordState'), selected.map(tool => tool.recordState), selected.map(tool => `<div class="comparison-value">${esc(t(`recordStates.${tool.recordState}`))}</div>`)),
      comparisonItem(t('explorer.liveness'), selected.map(tool => livenessValue(tool)), selected.map(tool => `<div class="comparison-value" data-liveness="${esc(livenessValue(tool))}">${esc(t(`liveness.${livenessValue(tool)}`))} ${livenessValue(tool) === 'unknown' ? unknownMarker() : ''}${rowLiveness(tool).length ? `<small>${esc(t('explorer.livenessUncounted', {count: rowLiveness(tool).length}))}</small>` : ''}</div>`)),
      comparisonItem(t('explorer.capabilityClaims'), selected.map(tool => String(claimSummary(tool).total)), selected.map(tool => `<div class="comparison-value" data-claim-total="${claimSummary(tool).total}">${claimSummary(tool).total ? esc(Object.entries(claimSummary(tool).byFamily).map(([family, count]) => t('explorer.claimFamilyCount', {family: family.toUpperCase(), count: count ?? 0})).join(' · ')) : `${esc(t('explorer.noClaimPublished'))} ${unknownMarker()}`}</div>`)),
      // observed が空のリレー由来エントリでも空欄にせず、observedText の「不明」語彙で出す。
      comparisonItem(t('explorer.observed'), selected.map(tool => observedText(tool)), selected.map(tool => `<div class="comparison-value">${esc(observedText(tool).split(' ')[0])}</div>`))
    ];
    const orderedFeatures = [...items].sort((a, b) => Number(b.different) - Number(a.different));
    const orderedBasics = [...basics].sort((a, b) => Number(b.different) - Number(a.different));
    const actionLabel = state.compare.length >= 3 ? t('explorer.replaceComparison') : t('explorer.addComparison');
    els.compareDialog.setAttribute('aria-label', t('explorer.compareTitle', {count: selected.length}));
    els.compareContent.innerHTML = `${dialogHead(t('explorer.differencesFirst'), t('explorer.compareTitle', {count: selected.length}))}<div class="comparison-edit"><label>${esc(t('explorer.alternative'))}<select id="compare-alternative">${alternatives.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>${state.compare.length >= 3 ? `<label>${esc(t('explorer.replaceTarget'))}<select id="compare-replace-target">${selected.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>` : '<span></span>'}<button class="secondary" type="button" data-compare-apply ${alternatives.length ? '' : 'disabled'}>${esc(actionLabel)}</button></div>${selected.length < 2 ? `<p class="comparison-incomplete">${esc(t('explorer.needTwo'))}</p>` : ''}<div class="comparison-body" style="--candidate-count:${Math.max(selected.length, 1)}"><div class="comparison-candidates">${selected.map(tool => `<div class="comparison-candidate"><strong>${esc(tool.name)}</strong><button type="button" data-compare-remove="${tool.id}" aria-label="${esc(t('explorer.removeCandidate', {name: tool.name}))}">${esc(t('explorer.removeShort'))}</button></div>`).join('')}</div><section class="comparison-group"><h3 class="comparison-group-title">${esc(t('explorer.featuresSection'))}</h3>${orderedFeatures.map(item => item.markup).join('')}</section><section class="comparison-group"><h3 class="comparison-group-title">${esc(t('explorer.basicsSection'))}</h3>${orderedBasics.map(item => item.markup).join('')}</section></div>`;
    if (shouldOpen) openDialog(els.compareDialog, context);
  }

  function reviewForm(tool: Row): string {
    /* issue #8: かつてここに seed 画像の選択肢があったが、それはモック時代の作り物の SVG だった。カタログは
       実データになり、正当なプリセットレビュー画像の出所は一つも無いので、選択 UI ごと消した。
       残るのは「自分の端末から選んだ画像」だけ。 */
    const draft: ReviewDraft = state.reviewDrafts[tool.id] ?? {};
    const localPreview = draft.localImage ? `<img src="${esc(draft.localImage)}" alt="${esc(t('explorer.imageTitle'))}">${draft.localFilename ? `<small>${esc(draft.localFilename)}</small>` : ''}` : '';
    return `<form class="review-form" data-review-form="${tool.id}" data-local-image="${esc(draft.localImage || '')}" data-local-filename="${esc(draft.localFilename || '')}"><h3>${esc(t('explorer.writeReview'))}</h3><label class="review-body">${esc(t('explorer.body'))}<textarea name="body" placeholder="${esc(t('explorer.bodyPlaceholder'))}">${esc(draft.body || '')}</textarea></label><div class="local-image-field"><label class="local-file">${esc(t('explorer.deviceImage'))}<input type="file" name="deviceImage" accept="image/*"></label><div class="local-image-preview">${localPreview}</div></div><label>${esc(t('explorer.osOptional'))}<input name="os" value="${esc(draft.os || '')}"></label><label>${esc(t('explorer.versionOptional'))}<input name="version" value="${esc(draft.version || '')}"></label><label>${esc(t('explorer.useOptional'))}<input name="use" value="${esc(draft.use || '')}"></label><label>${esc(t('explorer.ratingOptional'))}<select name="rating"><option value="">${esc(t('optional'))}</option>${[5, 4, 3, 2, 1].map(value => `<option ${String(draft.rating) === String(value) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="review-preview" aria-live="polite"></div><button class="primary" type="submit">${esc(t('explorer.createReview'))}</button></form>`;
  }
  /** Reads one named control out of the review form. A control that is not there
      contributes "" rather than throwing — the same shape the original relied on. */
  function fieldValue(form: HTMLFormElement, name: string): string {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
      return control.value;
    }
    return '';
  }
  function captureReviewDraft(): void {
    const form = els.reviewDialog.querySelector<HTMLFormElement>('[data-review-form]');
    if (!form) return;
    const toolId = form.dataset['reviewForm'];
    if (toolId === undefined) return;
    state.reviewDrafts[toolId] = {
      body: fieldValue(form, 'body'),
      localImage: form.dataset['localImage'] ?? '', localFilename: form.dataset['localFilename'] ?? '', os: fieldValue(form, 'os'),
      version: fieldValue(form, 'version'), use: fieldValue(form, 'use'), rating: fieldValue(form, 'rating')
    };
  }
  function renderReview(context: DialogContext & {type: 'review'}, shouldOpen = true): void {
    if (!context.clearDraft) captureReviewDraft();
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool);
    els.reviewDialog.setAttribute('aria-label', t('explorer.reviewTitle', {name: tool.name}));
    els.reviewContent.innerHTML = `${dialogHead(t('explorer.reviewCount', {count: reviews.length}), t('explorer.reviewTitle', {name: tool.name}))}<div class="review-toolbar"><button class="secondary" type="button" data-gallery-tool="${tool.id}">${esc(t('explorer.openGallery'))}</button></div><section class="review-list">${reviews.map(review => reviewItem(tool, review)).join('')}</section>${reviewForm(tool)}`;
    if (shouldOpen) openDialog(els.reviewDialog, context);
    if (context.reviewId) restoreFocus(`[data-review-id="${CSS.escape(context.reviewId)}"] button`, els.reviewDialog);
  }
  /* ビューアの欄には「拡張が返した公開鍵」しか無い。参加時期も役立ち票も一度も観測して
     いないので、0 や今月を埋めずに null で返し、他の未観測値と同じ「—（不明）」で出す。 */
  interface ProfileDetails {
    readonly name: string;
    readonly bio: string;
    readonly npub: string | null;
    readonly joined: string | null;
    readonly spread: string | null;
    readonly posts: string | null;
    readonly useful: number | null;
    readonly notUseful: number | null;
  }
  function profileDetails(id: string): ProfileDetails {
    const seed = i18n.value('explorer.reviewsSeed');
    if (id === 'local') {
      return {
        name: seedText(seed, 'localName'), bio: seedText(seed, 'localBio'), npub: viewer.status === 'signedIn' ? viewer.npub : null,
        joined: null, spread: null, posts: null, useful: null, notUseful: null
      };
    }
    const profile = profiles[id];
    return {
      name: profile?.name ?? '',
      bio: id === 'a' ? seedText(seed, 'aBio') : seedText(seed, 'bBio'),
      npub: profile?.npub ?? null,
      joined: profile?.joined ?? null,
      spread: id === 'a' ? seedText(seed, 'aSpread') : seedText(seed, 'bSpread'),
      posts: id === 'a' ? seedText(seed, 'aPosts') : seedText(seed, 'bPosts'),
      useful: profile?.useful ?? null,
      notUseful: profile?.notUseful ?? null
    };
  }
  function profileHistory(profileId: string): {tool: Row; review: Review}[] {
    const rows: readonly Row[] = tools;
    return rows.flatMap(tool => allReviews(tool).filter(review => review.profile === profileId).map(review => ({tool, review}))).slice(0, 4);
  }
  function renderProfile(context: DialogContext & {type: 'profile'}, shouldOpen = true): void {
    const profile = profileDetails(context.profileId);
    const history = profileHistory(context.profileId);
    // 観測していない欄はカードの「—（不明）」と同じマーカーで出す。0 も今日の日付も埋めない。
    const fact = (value: string | number | null): string => value == null ? unknownMarker() : esc(value);
    const votes = profile.useful == null || profile.notUseful == null ? unknownMarker() : `${profile.useful} / ${profile.notUseful}`;
    const npubLine = profile.npub
      ? `<p class="profile-npub" data-profile-npub>${esc(profile.npub)}</p>`
      : `<p class="profile-npub is-signed-out" data-profile-npub>${esc(t('explorer.viewer.signedOut'))}</p>`;
    els.profileDialog.setAttribute('aria-label', t('explorer.profileTitle'));
    els.profileContent.innerHTML = `${dialogHead(t('explorer.profileTitle'), profile.name)}${npubLine}<p>${esc(profile.bio)}</p><dl class="profile-facts"><div><dt>${esc(t('explorer.joined'))}</dt><dd>${fact(profile.joined)}</dd></div><div><dt>${esc(t('explorer.activity'))}</dt><dd>${fact(profile.spread)}</dd></div><div><dt>${esc(t('explorer.posting'))}</dt><dd>${fact(profile.posts)}</dd></div><div><dt>${esc(t('explorer.voteHistory'))}</dt><dd>${votes}</dd></div></dl><section class="profile-history"><h3>${esc(t('explorer.history'))}</h3>${history.map(({tool, review}) => `<article><div><strong>${esc(tool.name)}</strong><span>${esc(review.date)}</span></div><p>${esc(review.body)}</p><button class="secondary" type="button" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button></article>`).join('')}</section>`;
    if (shouldOpen) openDialog(els.profileDialog, context);
  }
  function renderGallery(context: DialogContext & {type: 'gallery'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool).flatMap(review => review.image ? [{...review, image: review.image}] : []);
    els.galleryDialog.setAttribute('aria-label', t('explorer.galleryTitle', {name: tool.name}));
    els.galleryContent.innerHTML = `${dialogHead(t('explorer.openGallery'), t('explorer.galleryTitle', {name: tool.name}))}<section class="gallery-grid">${reviews.length ? reviews.map(review => `<article class="gallery-card">${screenshotMarkup(review.image, false, t('explorer.imageAlt', {author: review.author, date: review.date}))}<dl><div><dt>${esc(t('explorer.reviewer'))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc(review.author)}</button></dd></div><div><dt>${esc(t('explorer.postedAt'))}</dt><dd>${esc(review.date)}</dd></div><div><dt>OS / version</dt><dd>${esc(review.os || t('explorer.notEntered'))} / ${esc(review.version || t('explorer.notEntered'))}</dd></div></dl><div><button type="button" class="primary" data-open-image="${tool.id}" data-image-review="${review.id}">${esc(t('explorer.enlarge'))}</button><button type="button" class="secondary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button></div></article>`).join('') : `<p>${esc(t('explorer.galleryEmpty'))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.galleryDialog, context);
  }
  function renderImage(context: DialogContext & {type: 'image'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    const review = tool ? allReviews(tool).find(item => item.id === context.reviewId) : undefined;
    if (!tool || !review?.image) return;
    els.imageDialog.setAttribute('aria-label', t('explorer.imageTitle'));
    els.imageContent.innerHTML = `${dialogHead(t('explorer.imageTitle'), review.image.label)}<div class="image-stage">${screenshotMarkup(review.image, false, t('explorer.imageAlt', {author: review.author, date: review.date}))}</div><dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.reviewer'))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc(review.author)}</button></dd></div><div><dt>${esc(t('explorer.postedAt'))}</dt><dd>${esc(review.date)}</dd></div></dl><button type="button" class="primary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button>`;
    if (shouldOpen) openDialog(els.imageDialog, context);
  }
  function renderVoteBasis(context: DialogContext & {type: 'voteBasis'}, shouldOpen = true): void {
    const tool = findTool(context.toolId);
    const review = allReviews(tool).find(item => item.id === context.reviewId);
    // `allReviews(null)` is empty, so a review here always came from a row; the
    // check states that rather than leaving it to be inferred.
    if (!tool || !review) return;
    const counts = reviewCounts(review);
    els.evidenceDialog.setAttribute('aria-label', t('explorer.voteBreakdown'));
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.communityVotes'), t('explorer.voteBreakdown'))}<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.helpfulVotes'))}</dt><dd>${counts.helpful}</dd></div><div><dt>${esc(t('explorer.unhelpfulVotes'))}</dt><dd>${counts.unhelpful}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function rerenderOpenDialogs(): void {
    for (const dialog of dialogs) {
      if (!dialog.open) continue;
      const context = dialogContexts.get(dialog);
      if (!context) continue;
      if (context.type === 'evidence') renderEvidence(context, false);
      if (context.type === 'toolDetail') renderToolDetail(context, false);
      if (context.type === 'resource') renderResource(context, false);
      if (context.type === 'featureBasis') renderFeatureBasis(context, false);
      if (context.type === 'compare') renderCompare(context, false);
      if (context.type === 'review') renderReview(context, false);
      if (context.type === 'profile') renderProfile(context, false);
      if (context.type === 'gallery') renderGallery(context, false);
      if (context.type === 'image') renderImage(context, false);
      if (context.type === 'voteBasis') renderVoteBasis(context, false);
    }
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(message: string): void {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }
  function resetFilters(): void { Object.assign(state, {features: [], query: '', platform: 'all', category: 'all', toolStatus: 'all', support: DEFAULT_SUPPORT, oss: 'all', tool: '', savedOnly: false, nipQuery: '', uiState: 'normal'}); renderAll(); }
  function removeCondition(key: string): void { const item = activeConditions().find(condition => condition.key === key); if (!item) return; Object.assign(state, item.overrides); if (!state.features.length) state.support = DEFAULT_SUPPORT; state.uiState = 'normal'; renderAll(); }
  function toggleCompare(id: string, checked: boolean): void { if (checked && state.compare.length >= 3) { const box = document.querySelector<HTMLInputElement>(`[data-compare-tool="${CSS.escape(id)}"]`); if (box) box.checked = false; toast(t('explorer.compareLimit')); return; } state.compare = checked ? [...state.compare, id] : state.compare.filter(value => value !== id); renderCompareActions(); }
  function syncComparisonCheckboxes(): void {
    document.querySelectorAll<HTMLInputElement>('[data-compare-tool]').forEach(input => {
      const id = input.dataset['compareTool'];
      input.checked = id !== undefined && state.compare.includes(id);
    });
  }

  /** The element an event happened on, when it is one. `event.target` is typed as
      EventTarget because an event can come from something that is not an element
      at all; every handler below asked `.closest(...)` of it, which is an Element
      method, so the narrowing is made once here instead of being assumed. */
  /** The value of a `data-` attribute the selector already matched on. The
      attribute is present by construction — the element was found BY it — so the
      only value that ever stands in is "", which is the same string the original
      read out of `dataset`. Nothing is invented and nothing is skipped. */
  function attr(element: HTMLElement, key: string): string {
    return element.dataset[key] ?? '';
  }
  /** The value of a select / input the page owns. Absent means the control is not
      on screen right now, which the callers already treated as "nothing chosen". */
  function selectValue(selector: string): string {
    const element = document.querySelector<HTMLSelectElement>(selector);
    return element ? element.value : '';
  }
  function inputValue(selector: string): string {
    const element = document.querySelector<HTMLInputElement>(selector);
    return element ? element.value : '';
  }
  function targetElement(event: Event): Element | null {
    return event.target instanceof Element ? event.target : null;
  }
  document.addEventListener('pointerdown', event => {
    const target = targetElement(event);
    const found = target?.closest('button,a,input,select,textarea,[tabindex]');
    lastInteractive = found instanceof HTMLElement ? found : null;
  }, true);
  document.addEventListener('click', event => {
    const target = targetElement(event);
    if (!target) return;
    const language = target.closest<HTMLElement>('[data-language]');
    if (language) {
      captureReviewDraft();
      const key = focusKey(language);
      const openerKeys = dialogs.map(dialog => dialog.open ? focusKey(dialogOpeners.get(dialog) ?? null) : null);
      i18n.set(attr(language, 'language'));
      dialogs.forEach((dialog, index) => {
        const openerKey = openerKeys[index];
        const replacement = openerKey ? document.querySelector(openerKey) : null;
        if (replacement instanceof HTMLElement) dialogOpeners.set(dialog, replacement);
      });
      /* issue #5 以降、言語ボタンは dialog の外にしか無い。開いているダイアログの中身は差し替わって
         いるので、そこにあった元の要素はもう居ない。焦点をモーダルの中に戻さないと body (inert) に
         落ちるので、開いているダイアログの先頭の操作対象に戻す。 */
      const openModal = dialogs.filter(dialog => dialog.open).at(-1);
      if (openModal) requestAnimationFrame(() => { if (!openModal.contains(document.activeElement)) dialogFocusables(openModal)[0]?.focus(); });
      else restoreFocus(key);
      return;
    }
    if (target.closest<HTMLElement>('[data-viewer-signin]')) { signIn(); return; }
    if (target.closest<HTMLElement>('[data-viewer-signout]')) { signOut(); return; }
    const feature = target.closest<HTMLElement>('[data-select-feature]');
    if (feature) { const id = attr(feature, 'selectFeature'); state.features = state.features.includes(id) ? state.features.filter(value => value !== id) : [...state.features, id]; if (!state.features.length) state.support = DEFAULT_SUPPORT; state.uiState = 'normal'; renderAll(); restoreFocus(`[data-select-feature="${id}"]`); return; }
    const supportMode = target.closest<HTMLElement>('[data-support-mode]');
    if (supportMode) { state.support = attr(supportMode, 'supportMode'); state.uiState = 'normal'; renderAll(); restoreFocus('#support-filter'); return; }
    const categoryButton = target.closest<HTMLElement>('[data-category-filter]');
    if (categoryButton) { state.category = attr(categoryButton, 'categoryFilter'); renderAll(); restoreFocus(`[data-category-filter="${state.category}"]`); return; }
    const detail = target.closest<HTMLElement>('[data-feature-detail]'); if (detail) { renderToolDetail({type: 'toolDetail', toolId: attr(detail, 'featureDetail')}); return; }
    const evidence = target.closest<HTMLElement>('[data-evidence-tool]'); if (evidence) { renderEvidence({type: 'evidence', toolId: attr(evidence, 'evidenceTool'), nip: attr(evidence, 'evidenceNip'), featureId: attr(evidence, 'evidenceFeature')}); return; }
    const resource = target.closest<HTMLElement>('[data-resource-tool]'); if (resource) { renderResource({type: 'resource', toolId: attr(resource, 'resourceTool'), resourceType: attr(resource, 'resourceType')}); return; }
    // いいねとブックマークは詳細ダイアログの中にあるので、一覧と一緒に開いているダイアログも描き直す。
    const like = target.closest<HTMLElement>('[data-like-tool]'); if (like) { void toggleLike(attr(like, 'likeTool')); return; }
    const bookmark = target.closest<HTMLElement>('[data-bookmark-tool]'); if (bookmark) { const id = attr(bookmark, 'bookmarkTool'); state.bookmarks[id] = state.bookmarks[id] ? null : {public: false}; renderResults(); rerenderOpenDialogs(); toast(t('explorer.toastBookmarked')); return; }
    const reviewer = target.closest<HTMLElement>('[data-reviewer]'); if (reviewer) { renderProfile({type: 'profile', profileId: attr(reviewer, 'reviewer')}); return; }
    const vote = target.closest<HTMLElement>('[data-review-vote]'); if (vote) { const cast = attr(vote, 'reviewVote'); if (cast !== 'helpful' && cast !== 'unhelpful') return; const current = state.reviewVotes[attr(vote, 'reviewId')]; state.reviewVotes[attr(vote, 'reviewId')] = current === cast ? null : cast; renderReview({type: 'review', toolId: attr(vote, 'reviewToolId'), reviewId: attr(vote, 'reviewId')}, false); toast(t('explorer.toastVoted')); return; }
    const basis = target.closest<HTMLElement>('[data-vote-basis]'); if (basis) { renderVoteBasis({type: 'voteBasis', toolId: attr(basis, 'voteTool'), reviewId: attr(basis, 'voteBasis')}); return; }
    const gallery = target.closest<HTMLElement>('[data-gallery-tool]'); if (gallery) { renderGallery({type: 'gallery', toolId: attr(gallery, 'galleryTool')}); return; }
    const image = target.closest<HTMLElement>('[data-open-image]'); if (image) { renderImage({type: 'image', toolId: attr(image, 'openImage'), reviewId: attr(image, 'imageReview')}); return; }
    const review = target.closest<HTMLElement>('[data-review-tool]'); if (review) { const child = review.closest('dialog'); if (attr(review, 'reviewJump') && child && child !== els.reviewDialog) child.close(); renderReview({type: 'review', toolId: attr(review, 'reviewTool'), reviewId: attr(review, 'reviewJump') || ''}, !els.reviewDialog.open); return; }
    const close = target.closest<HTMLElement>('[data-close-dialog]'); if (close) { close.closest('dialog')?.close(); return; }
    const remove = target.closest<HTMLElement>('[data-remove-condition]'); if (remove) { removeCondition(attr(remove, 'removeCondition')); return; }
    if (target.closest<HTMLElement>('[data-reset-all]')) { resetFilters(); return; }
    const compareRemove = target.closest<HTMLElement>('[data-compare-remove]'); if (compareRemove) { state.compare = state.compare.filter(id => id !== attr(compareRemove, 'compareRemove')); renderCompareActions(); syncComparisonCheckboxes(); if (state.compare.length) renderCompare({type: 'compare'}, false); else els.compareDialog.close(); return; }
    if (target.closest<HTMLElement>('[data-compare-apply]')) { const alternative = selectValue('#compare-alternative'); if (!alternative) return; if (state.compare.length >= 3) { const replaceTarget = selectValue('#compare-replace-target'); state.compare = state.compare.map(id => id === replaceTarget ? alternative : id); } else state.compare.push(alternative); renderCompareActions(); syncComparisonCheckboxes(); renderCompare({type: 'compare'}, false); return; }
    if (target.closest<HTMLElement>('[data-show-feature-basis]')) { renderFeatureBasis(); return; }
    const relayAction = target.closest<HTMLElement>('[data-relay-action]'); if (relayAction) { if (attr(relayAction, 'relayAction') === 'reload') loadRelayCatalog(); return; }
    // §6.5.4 の二つの手段。どちらも並び順と推薦数にしか効かず、行の集合は動かない (I7)。
    // 「Nostr鍵を接続」もヘッダのサインインと同じ一本の経路を通る。成功したときだけ読み直す。
    // 失敗したらヘッダの未サインイン理由がそのまま出るので、ここで別の文言を作らない。
    if (target.closest<HTMLElement>('[data-graph-connect]')) {
      signIn().then(() => { if (viewer.status === 'signedIn') loadRelayCatalog({viewerPubkey: ''}); });
      return;
    }
    if (target.closest<HTMLElement>('[data-graph-apply]')) { loadRelayCatalog({viewerPubkey: inputValue('#graph-npub'), useNip07: false}); return; }
    /* 取り下げ（issue #12 / §W6.5）。一段目は確認の文言を出すだけで、何も署名しない。 */
    const withdrawStart = target.closest<HTMLElement>('[data-withdraw-record]');
    if (withdrawStart) { if (publish.busy || withdrawState.busy) return; withdrawState.confirming = attr(withdrawStart, 'withdrawRecord'); renderPublish(); return; }
    const withdrawCancel = target.closest<HTMLElement>('[data-withdraw-cancel]');
    if (withdrawCancel) { withdrawState.confirming = ''; renderPublish(); return; }
    const withdrawConfirm = target.closest<HTMLElement>('[data-withdraw-confirm]');
    if (withdrawConfirm) { void withdrawRecord(attr(withdrawConfirm, 'withdrawConfirm')); return; }
    const setState = target.closest<HTMLElement>('[data-set-state]'); if (setState) { const next = attr(setState, 'setState'); if (isUiState(next)) { state.uiState = next; renderAll(); } }
  });

  els.query.addEventListener('input', () => { state.query = els.query.value; state.uiState = 'normal'; renderResults(); });
  need('#open-compare', HTMLButtonElement).addEventListener('click', () => renderCompare());
  need('#clear-compare', HTMLButtonElement).addEventListener('click', () => { state.compare = []; renderCompareActions(); syncComparisonCheckboxes(); });
  /* The four select filters write into `state` by name. The map is typed to those
     four keys so a typo is a compile error rather than a silently-ignored filter. */
  const SELECT_FILTERS: Readonly<Record<string, 'platform' | 'toolStatus' | 'support' | 'oss' | undefined>> = {
    'platform-filter': 'platform', 'tool-status-filter': 'toolStatus', 'support-filter': 'support', 'oss-filter': 'oss'
  };
  document.addEventListener('change', event => {
    const target = targetElement(event);
    if (!target) return;
    const field = SELECT_FILTERS[target.id];
    if (field && target instanceof HTMLSelectElement) { state[field] = target.value; state.uiState = 'normal'; renderAll(); return; }
    /* issue #1: 並び順は絞り込みではないので uiState には触らない。知らない値は
       黙って既定に落とさず、単に無視する（勝手な並び順を作らない）。 */
    if (target.id === 'sort-order' && target instanceof HTMLSelectElement) { if (isSortKey(target.value)) { state.sort = target.value; renderResults(); } return; }
    if (target.id === 'saved-only' && target instanceof HTMLInputElement) { state.savedOnly = target.checked; renderAll(); return; }
    if (target.matches('[data-compare-tool]') && target instanceof HTMLInputElement) { toggleCompare(attr(target, 'compareTool'), target.checked); return; }
    if (target.matches('[data-public-bookmark]') && target instanceof HTMLInputElement) { const bookmark = state.bookmarks[attr(target, 'publicBookmark')]; if (bookmark) bookmark.public = target.checked; renderResults(); rerenderOpenDialogs(); toast(t('explorer.toastPublic')); return; }
    const file = target.closest<HTMLInputElement>('input[name="deviceImage"]');
    if (file) {
      const form = file.closest('form');
      const selected = file.files?.[0];
      if (!form || !selected?.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const image = String(reader.result);
        form.dataset['localImage'] = image;
        form.dataset['localFilename'] = selected.name;
        const preview = form.querySelector('.local-image-preview');
        if (preview) preview.innerHTML = `<img src="${esc(image)}" alt="${esc(t('explorer.imageTitle'))}"><small>${esc(selected.name)}</small>`;
        captureReviewDraft();
      };
      reader.readAsDataURL(selected);
    }
  });
  document.addEventListener('input', event => {
    const target = targetElement(event);
    if (target instanceof HTMLInputElement && target.id === 'nip-query') { state.nipQuery = target.value; renderResults(); }
  });
  const PUBLISH_FIELDS: Readonly<Record<string, keyof PublishDraftFields | undefined>> = {
    'publish-d': 'dLocal', 'publish-name': 'name', 'publish-summary': 'summary', 'publish-homepage': 'homepage', 'publish-topics': 'topics'
  };
  document.addEventListener('input', event => {
    const target = targetElement(event);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const field = PUBLISH_FIELDS[target.id];
    if (!field) return;
    publish[field] = target.value;
    saveDraft();
    refreshPublishState();
  });
  document.addEventListener('submit', event => {
    const target = targetElement(event);
    if (!target) return;
    if (target.closest('[data-publish-form]')) { event.preventDefault(); void submitPublish(); return; }
    const form = target.closest('form[data-review-form]');
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const data = new FormData(form); const body = String(data.get('body') ?? '').trim();
    const localImage = form.dataset['localImage'];
    const image: ReviewImage | null = localImage ? {label: form.dataset['localFilename'] || t('explorer.imageTitle'), src: localImage} : null;
    const preview = form.querySelector('.review-preview');
    if (!body && !image) { if (preview) preview.textContent = t('explorer.chooseBodyOrImage'); return; }
    const toolId = form.dataset['reviewForm'] ?? ''; const seed = i18n.value('explorer.reviewsSeed');
    const rating = data.get('rating');
    const review: Review = {
      id: `${toolId}-current-${Date.now()}`, profile: 'local', author: seedText(seed, 'localName'),
      date: new Date().toISOString().slice(0, 10), body, os: String(data.get('os') ?? ''),
      version: String(data.get('version') ?? ''), use: String(data.get('use') ?? ''),
      rating: rating ? Number(rating) : null, helpful: 0, unhelpful: 0, image
    };
    state.reviews[toolId] = [...(state.reviews[toolId] ?? []), review];
    delete state.reviewDrafts[toolId];
    renderReview({type: 'review', toolId, reviewId: review.id, clearDraft: true}, false);
    const nextPreview = els.reviewDialog.querySelector('.review-preview'); if (nextPreview) nextPreview.textContent = t('explorer.addedReview');
  });

  dialogs.forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = dialogFocusables(dialog);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('close', () => {
      const opener = dialogOpeners.get(dialog);
      if (!opener?.isConnected) return;
      const parent = opener.closest('dialog');
      if (!parent || parent.open) setTimeout(() => opener.focus(), 0);
    });
  });
  i18n.onChange(() => renderAll());
  window.addEventListener('offline', () => { state.uiState = 'offline'; renderAll(); });
  window.addEventListener('online', () => { state.uiState = 'normal'; renderAll(); });
  const setState = (next: string): void => { if (isUiState(next)) { state.uiState = next; renderAll(); } };
  const legacy = location.hash.match(/^#feature-([a-z]+)$/)?.[1];
  const initial = location.hash.match(/^#features-([a-z-]+)$/)?.[1]?.split('-') ?? [];
  state.features = legacy && featureById[legacy] ? [legacy] : initial.filter(id => featureById[id]);
  // 読み込み時に getPublicKey() は呼ばない。プロンプトはページを開いた行為への同意ではない。
  // 同じタブで既にサインインしていたときだけ、保存した公開鍵から状態を復元する。
  restoreViewerSession();
  restoreDraft();
  renderAll();
  if (relayRequested) {
    window.addEventListener('unhandledrejection', event => { event.preventDefault(); });
    requestAnimationFrame(() => { void loadRelayCatalog(); });
  }
  return {
    setState,
    loadRelayCatalog,
    onRelayResult: listener => { relayResultListeners.push(listener); },
    relayRows: () => relayEntries()
  };
}
