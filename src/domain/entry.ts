/* The catalogue entry types, derived from what catalogue-events.jsonl and data.js
   ACTUALLY contain. Pure domain layer: no DOM, no network, no window.

   Generated data.js is the build artefact of the signed events; these types describe
   the rendered shape, with every genuinely-absent field modelled optional or null. */

export interface NipRegistryEntry {
  readonly number: string;
  readonly title: string;
  readonly deprecated: boolean;
  /** "" for an entry the registry does not annotate; the empty string is the
      absent form, and 94/94 entries carry the key. */
  readonly note: string;
  readonly source: string;
}

/** §21.2 R2: bud/lud are first-class families alongside nip. All three occur in
    the collected claims. */
export type CapabilityFamily = 'nip' | 'bud' | 'lud';

/** §21.7 R7: the seven stated results, matching data.resultPrecedence exactly.
    `unknown` is deliberately NOT one of them — it is what the UI shows when no
    stated result exists, so it never appears in the data. */
export type CapabilityResult =
  | 'supported'
  | 'partial'
  | 'disabled'
  | 'planned'
  | 'withdrawn'
  | 'not_supported'
  | 'not_applicable';

/** §21.2.3: the result of matching the claim's id against the pinned snapshot. */
export type RegistryStatus = 'resolved' | 'not_in_registry' | 'unresolvable';

/** §21.1 R1. The i18n dictionary carries three basis labels (transcribed /
    self_declared / tested), but the collector emits only `transcribed`, and all
    313 collected claims carry it. Typed as what the data holds. */
export type ClaimBasis = 'transcribed';

/** A single capability claim: the family, the verbatim source line, and the
    status the id resolves to against the pinned snapshot. */
export interface CapabilityClaim {
  readonly family: CapabilityFamily;
  /** Opaque token, so "5A" indexes exactly like "01". */
  readonly id: string;
  /** The `/sub` token of family:id[/sub][@scope]. Null in all 313 collected
      claims — no primary source used a sub-token — so null is its observed
      state, not a placeholder. */
  readonly sub: null;
  /** The `@scope` token. Null for 309 of 313; the four that carry one are
      "android" and "commonmain". */
  readonly scope: string | null;
  /** The reassembled key, family:id[/sub][@scope]. */
  readonly key: string;
  readonly result: CapabilityResult;
  /** The claim exactly as the primary source wrote it. */
  readonly sourceText: string;
  /** The qualification the source attached, verbatim. Null for 283 of 313. */
  readonly caveat: string | null;
  readonly registryStatus: RegistryStatus;
  /** The snapshot's title for this id. Null for the 22 claims whose id the
      snapshot does not hold or whose family it does not cover. */
  readonly registryTitle: string | null;
  readonly deprecated: boolean;
  readonly basis: ClaimBasis;
  /** The document the claim was transcribed from. */
  readonly source: string;
  readonly assertedAt: string;
}

/** §21.4 R4: liveness is an observation with a method, never a state. */
export type LivenessResult =
  | 'reachable'
  | 'unreachable'
  | 'archived'
  | 'moved'
  | 'superseded';

export type LivenessMethod = 'repository-metadata' | 'dns' | 'http';

export interface LivenessObservation {
  readonly result: LivenessResult;
  readonly method: LivenessMethod;
  readonly detail: string;
  /** Where the subject moved/was superseded to. Genuinely absent — the key is
      not present at all — on 5 of the 9 observations, so it is optional rather
      than nullable. */
  readonly target?: string;
  readonly subject: string;
  readonly observedAt: string;
}

/** Names the primary source is quoted for. */
export type SourceField = 'name' | 'summary' | 'homepage';

export interface ProvenanceSource {
  readonly fields: readonly SourceField[];
  readonly url: string;
  /** What was read at that URL, verbatim. */
  readonly what: string;
  readonly fetched: string;
}

/** A listing the source made that is explicitly NOT a support claim (modules or
    crates merely named after NIPs). Two occur across the 41 entries. */
export interface NonClaim {
  readonly kind: 'modules' | 'crates';
  readonly values: readonly string[];
}

/** The document the capability claims were transcribed from, and how it wrote
    them. */
export interface ToolClaim {
  readonly source: string;
  readonly sourceLabel: string;
  /** How the source notated NIP references. Null for 19 of 41 — those sources
      state no NIPs at all, so there is no notation to record. */
  readonly notation: string | null;
  readonly fetched: string;
  /** Qualifications quoted from the source verbatim. */
  readonly caveats: readonly string[];
  readonly nonClaims: readonly NonClaim[];
}

/** §21.4 R4: the record's own state, distinct from project liveness. The write
    path (nostr-catalog.js validateSoftwareEvent) accepts `active` and
    `withdrawn`; buildCatalog drops everything that is not `active`, so all 41
    collected entries are `active`. */
export type RecordState = 'active';

/** An icon URL that was requested and answered with a non-empty `image/*`
    body, together with the markup that declared it and the page that did. */
export interface ToolIcon {
  readonly url: string;
  /** The markup the page declared it in, e.g. `link rel="icon"`. */
  readonly source: string;
  /** The page that declared it. Two Framer-hosted entries name the same file. */
  readonly page: string;
  readonly observedAt: string;
}

/** One catalogue entry. All 41 entries carry every key below — absence is
    expressed as null (or as "" for `summary`), never by omitting the key. */
export interface Tool {
  /** The namespaced `d`, e.g. "nosmaps:io.damus". */
  readonly id: string;
  /** 30078:<publisher-hex>:<d>, with the publisher left as a template. */
  readonly coordinate: string;
  readonly name: string;
  /** §21.5 R5: "" is the normative absent form, paired with summaryAbsent. */
  readonly summary: string;
  readonly summaryAbsent: boolean;
  /** Language code -> description text. `summary` above stays canonical: a language
      with no recorded text falls back to it, so a missing language is never an
      empty string. Empty for a record whose summary is absent. */
  readonly descriptions: Readonly<Record<string, string>>;
  /** Null for 14 of 41 — those primary sources state no homepage. */
  readonly homepage: string | null;
  /** Null for 17 of 41 — the probe recorded in icons-probe.md found no URL for
      them that answered with an image. Never a guessed URL. */
  readonly icon: ToolIcon | null;
  readonly recordState: RecordState;
  /** §21.6 R6: seed topics plus free lowercase topics, rendered verbatim. Not
      restricted to seedTopics: the 41 entries use 11 distinct topics against 7
      seeds. */
  readonly topics: readonly string[];
  /** The topics as collected, before any correction. */
  readonly collectedTopics: readonly string[];
  /** Why `topics` differs from `collectedTopics`. Null for 33 of 41. */
  readonly topicCorrection: string | null;
  readonly provenance: 'collected';
  /** issue #21: the `created_at` of the signed record, in seconds — when it was
      collected into the catalogue, not when the project was released (no record
      states that). All 41 were signed in one batch, so all 41 carry the same
      second today. */
  readonly collectedAt: number;
  readonly observed: string;
  readonly sources: readonly ProvenanceSource[];
  readonly license: string;
  /** The platforms the primary source names, verbatim. Null for 39 of 41 —
      almost no source states one. */
  readonly platformText: string | null;
  /** How the project is distributed, verbatim. Null for 38 of 41. */
  readonly distribution: string | null;
  readonly sourceRepo: string;
  /** Empty for the 21 entries whose source claims no capabilities. */
  readonly capabilities: readonly CapabilityClaim[];
  readonly claim: ToolClaim;
  /** Empty for the 35 entries with no recorded liveness observation. */
  readonly liveness: readonly LivenessObservation[];
  /** Numbered findings from the collection report. */
  readonly findings: readonly number[];
}

export interface DataMeta {
  readonly collected: string;
  readonly collector: string;
  readonly entryCount: number;
  readonly notCollected: readonly {readonly name: string; readonly why: string}[];
}

export interface RegistryPin {
  readonly family: CapabilityFamily;
  readonly registry: string;
  readonly revision: string;
  readonly source: string;
  readonly fetched: string;
}

export interface Data {
  readonly meta: DataMeta;
  /** §21.6 R6: the seven seed topics. */
  readonly seedTopics: readonly string[];
  /** Highest-precedence result first. */
  readonly resultPrecedence: readonly CapabilityResult[];
  readonly registry: RegistryPin;
  readonly nipCatalog: readonly NipRegistryEntry[];
  readonly tools: readonly Tool[];
}

/* ------------------------------------------------------------------------ */
