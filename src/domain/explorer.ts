/* The explorer's pure vocabulary: result values, the support-filter modes and the
   feature definitions. Lifted verbatim out of nip-explorer.js (issue #11), with no
   DOM, no i18n and no window reachable from here — the labels for every id below
   live in the ui layer, which is the only place allowed to know how to say them.

   §21.7 R7 / issue #7 semantics are unchanged; only the location moved. */

import type {AccountSwitchingObservation, CapabilityClaim, CapabilityResult, Tool} from './entry.ts';

/** What a row can show for a feature: one of the seven stated results, or one of
    the two shapes of *no stated result*. `unknown` is deliberately absent from the
    precedence list — it is not a low rank, it is what is shown when no stated
    result exists (D7 / invariant I8). `out_of_family` means claims exist but none
    of them are NIP claims (§21.3 R3 case 1). */
export type DisplayResult = CapabilityResult | 'unknown' | 'out_of_family';

/** The two values that mean *no stated result*. Neither is turned into a negative. */
export const UNSTATED_SUPPORT: readonly DisplayResult[] = ['unknown', 'out_of_family'];

export const CONFIRMED_SUPPORT: readonly DisplayResult[] = ['supported', 'partial'];

export const DEFAULT_SUPPORT = 'confirmed';

export interface FeatureDefinition {
  readonly id: string;
  readonly icon: string;
  /** The NIP ids this feature asks about, as opaque ASCII tokens. */
  readonly nips: readonly string[];
}

const FEATURE_SOURCE: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ['posts', 'edit', ['01', '09', '25']], ['dm', 'mail', ['44']], ['search', 'search', ['01', '19', '21']], ['media', 'image', ['01', '19']],
  ['notifications', 'notifications', ['25', '57']], ['accounts', 'account', ['19', '46']], ['signing', 'key', ['46']], ['wallet', 'wallet', ['47', '57']],
  ['longform', 'article', ['23']], ['community', 'groups', ['01', '42', '78']]
];

/** issue #10 — the one feature that is NOT decided by the NIP list. `accounts`
    asks "can a person switch between several accounts", and no NIP answers that:
    NIP-19 is bech32 encoding, which is why Damus, YakiHonne Web App and
    Nostrcheck server were shown as supporting multiple accounts on the strength
    of NIP-19 alone. The answer now comes from `tool.accountSwitching`, which is
    what someone found when they went and looked. The NIP ids above stay in the
    definition because they are still what the NIP reference cards and the NIP
    query are about; they are simply no longer the answer to this question. */
export const OBSERVED_FEATURE_ID = 'accounts';

export const featureDefinitions: readonly FeatureDefinition[] =
  FEATURE_SOURCE.map(([id, icon, nips]) => ({id, icon, nips}));

export const featureById: Readonly<Record<string, FeatureDefinition | undefined>> =
  Object.fromEntries(featureDefinitions.map(feature => [feature.id, feature]));

export const validStates = [
  'normal', 'loading', 'empty', 'error', 'partial', 'offline', 'stale', 'incomplete', 'unavailable'
] as const;

export type UiState = (typeof validStates)[number];

export function isUiState(value: string | null | undefined): value is UiState {
  return typeof value === 'string' && (validStates as readonly string[]).includes(value);
}

/* ---- support resolution (§21.3 R3) ------------------------------------------
   Moved out of nip-explorer.js unchanged. These decide *what a row states* about a
   feature; how that is said on screen belongs to the ui layer. */


/** The claims a row carries. Empty for the 21 entries whose source claims none. */
export function capabilitiesOf(tool: Tool): readonly CapabilityClaim[] {
  return tool.capabilities;
}

export function supportRecords(
  tool: Tool, feature: FeatureDefinition, family: string
): readonly CapabilityClaim[] {
  return capabilitiesOf(tool).filter(record => record.family === family && feature.nips.includes(record.id));
}

/** §21.3 R3 case 1: claims exist but none in the requested family. A third answer,
    distinct from "supported" and from "no claim at all"; it must never read as
    supporting nothing. */
export function outOfFamily(tool: Tool, family: string): boolean {
  const claims = capabilitiesOf(tool);
  return claims.length > 0 && !claims.some(record => record.family === family);
}

/** Rank within the stated results. -1 for a value the precedence list does not
    hold, matching the original `precedenceOf` exactly. */
export function precedenceOf(result: string, precedence: readonly string[]): number {
  const index = precedence.indexOf(result);
  return index === -1 ? -1 : precedence.length - index;
}

/** §21.3 R3 case 2: no claim at all is `unknown`, never "not supported" and never
    an empty checklist that reads as a set of negatives. It is a value, so it
    always has a badge. */
/** The account-switching observation a row carries, or null when nobody has
    looked. A relay row carries no such field at all, which is also null: a live
    record has not been asked the question either. */
export function accountSwitchingOf(
  tool: {readonly accountSwitching?: AccountSwitchingObservation | null}
): AccountSwitchingObservation | null {
  return tool.accountSwitching ?? null;
}

/** issue #10 — the `accounts` answer, read off the observation instead of the
    NIP list.

    Unobserved (no record at all) is `unknown`, and so is an observation whose own
    result is `unknown` — the two are the same answer on screen ("nothing states
    this"), and neither may be read as "does not support it" (§21.3 R3 case 2 /
    invariant I8). `out_of_family` has no meaning here: there is no family to be
    outside of, because the question is not asked of a NIP registry at all. */
export function accountSwitchingSupport(
  tool: {readonly accountSwitching?: AccountSwitchingObservation | null}
): DisplayResult {
  const observation = accountSwitchingOf(tool);
  if (!observation) return 'unknown';
  return observation.result === 'unknown' ? 'unknown' : observation.result;
}

export interface ClaimSummary {
  readonly total: number;
  readonly byFamily: Readonly<Record<string, number>>;
}

export function claimSummary(tool: Tool): ClaimSummary {
  const byFamily: Record<string, number> = {};
  for (const record of capabilitiesOf(tool)) byFamily[record.family] = (byFamily[record.family] ?? 0) + 1;
  return {total: capabilitiesOf(tool).length, byFamily};
}

/** `all` keeps everything (unknown included), the default keeps only the
    affirmative claims, and any other mode is exactly one result value — so
    `unknown` stays reachable rather than being silently dropped (issue #7). */
export function supportPasses(value: DisplayResult, mode: string): boolean {
  if (mode === 'all') return true;
  if (mode === DEFAULT_SUPPORT) return CONFIRMED_SUPPORT.includes(value);
  return value === mode;
}

/* ---- filtering (§21.4) -------------------------------------------------------
   `filteredTools` is the reducer the whole results section is a view of. It is
   pure: it takes the rows, the selection, and the localised search terms the ui
   layer collected, and returns rows. Nothing here can reach the DOM, so the same
   selection always produces the same set. */

export interface FilterState {
  readonly features: readonly string[];
  readonly query: string;
  readonly platform: string;
  readonly category: string;
  readonly toolStatus: string;
  readonly support: string;
  readonly oss: string;
  readonly tool: string;
  readonly savedOnly: boolean;
  readonly nipQuery: string;
  readonly bookmarks: Readonly<Record<string, boolean | undefined>>;
}

/** Flatten whatever a metadata field holds into searchable strings. An absent
    value contributes nothing rather than the string "null". */
export function metadataValues(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(metadataValues);
  if (typeof value === 'object') return Object.values(value).flatMap(metadataValues);
  return [String(value)];
}

/** SPDX ids GitHub's own detection reports for an open-source licence.
    `NOASSERTION` and "reports none" are the absence of a machine-readable
    licence, never "not open source" — hence three states, not two. */
const SPDX_OSS = /^(MIT|AGPL|GPL|LGPL|Apache|BSD|MPL|Unlicense|ISC|CC0)/i;

export function ossState(tool: Tool): 'yes' | 'unknown' {
  if (!tool.license) return 'unknown';
  return SPDX_OSS.test(tool.license) ? 'yes' : 'unknown';
}

export function isOss(tool: Tool): boolean {
  return ossState(tool) === 'yes';
}

/** The terms a row is searchable by, minus the ones only the ui layer can supply
    (feature names and topic labels in every language). Those are passed in, so
    switching the UI language still never changes which entries match. */
export function toolSearchTerms(
  tool: Tool, family: string, registryTitleOf: (id: string) => string | null
): string[] {
  const nipTerms = capabilitiesOf(tool).flatMap(record => [
    record.key,
    `${record.family.toUpperCase()}-${record.id}`,
    `${record.family.toUpperCase()} ${record.id}`,
    record.id,
    record.registryTitle ?? '',
    (record.family === family ? registryTitleOf(record.id) : null) ?? '',
    record.sourceText
  ]);
  return [
    tool.name, tool.id, tool.platformText ?? '', tool.license || '',
    isOss(tool) ? 'OSS open source オープンソース' : '',
    ...metadataValues(tool.summary), ...metadataValues(tool.descriptions),
    ...metadataValues(tool.homepage), ...metadataValues(tool.sourceRepo), ...metadataValues(tool.distribution),
    ...nipTerms
  ];
}

export function matchesQuery(query: string, terms: readonly string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return terms.join(' ').toLowerCase().includes(needle);
}

/** Normalise a NIP query: `NIP-44`, `nip 44` and `44` all ask the same thing. */
export function normaliseNipQuery(value: string): string {
  return value.trim().toLowerCase().replace(/^(nip|bud|lud)[- ]?/, '');
}
