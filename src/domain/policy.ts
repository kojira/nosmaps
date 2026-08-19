/* The constants that define what a Nosmaps record IS.
   Pure domain layer: no DOM, no network, no window.

   Authoritative design: docs/design-relay-native-data.md revision 2. */

export const POLICY = {
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

  DEFAULT_RELAYS: ['wss://x.kojira.io', 'wss://nos.lol'],
  // §16.2: an app-chosen token, user-editable, and a labelled visibility gap.
  DISCOVERY_TOPICS: ['nosmaps'],

  CATALOG_STALE_AFTER_MS: 24 * 60 * 60 * 1000,
  GRAPH_STALE_AFTER_MS: 24 * 60 * 60 * 1000,
  MAX_FUTURE_SKEW_SEC: 600,
  MAX_FUTURE_HORIZON_SEC: 30 * 24 * 60 * 60,
  MAX_MIGRATION_DEPTH: 8,

  DISCOVERY_LIMIT_PER_RELAY: 500,
  MAX_DISCOVERY_PAGES_PER_RELAY: 8,
  MAX_DISCOVERY_RAW_EVENTS_PER_RELAY: 4000,

  GRAPH_MAX_FOLLOWS: 512,
  GRAPH_MAX_SETS_PER_CURATOR: 8,
  GRAPH_TIER2_ENABLED: false,

  MAX_FILTERS_PER_REQ: 8,
  MAX_SERIALIZED_REQ_BYTES_FALLBACK: 12000,
  MAX_ARRAY_ITEMS_PER_FILTER: 128,
  CLEANUP_LIMIT: 256,

  REQ_TIMEOUT_MS: 8000
} as const;

export const SOFTWARE_SCHEMA = 'org.nosmaps.software';

/* §4.2 rule 1: every canonical Nosmaps `d` is namespaced with this literal
   prefix. Kind 30078 is NIP-78 application-specific data, so records published
   by other applications on the same kind are the specified normal state, not an
   anomaly (observed on wss://x.kojira.io: `nostter-read`, `AmethystSettings`,
   `circl-settings`). The namespace is therefore the primary separation, and it
   does not depend on reading `content` at all. It is deliberately independent of
   the `org.nosmaps.software` content check: either one alone rejects a foreign
   record, and they fail with different reasons. */
export const SOFTWARE_D_PREFIX = 'nosmaps:';
export const D_MAX_BYTES = 192;

/* Built from the constants above so the coordinate grammar can never drift from
   the gate in validateSoftwareEvent. The local part is bounded so
   prefix + local part still fits the 192-byte `d` ceiling. */
export const COORD_RE = new RegExp(
  '^' + POLICY.SOFTWARE_KIND + ':([0-9a-f]{64}):('
    + SOFTWARE_D_PREFIX + '.{1,' + (D_MAX_BYTES - SOFTWARE_D_PREFIX.length) + '})$'
);

/* Kind-agnostic address form (§7.3 deletion `a` tags). Any kind, any `d`: a
   deletion may cover someone else's coordinate, so this MUST stay unnamespaced. */
export const ADDRESS_RE = /^([0-9]{1,5}):([0-9a-f]{64}):(.{0,192})$/;

/* §4.2 rule 1: `d` is ASCII with a 192-byte ceiling. Printable, no spaces. */
export const D_ASCII_RE = /^[\x21-\x7e]+$/;

/* The write path (docs/design-relay-native-write-path.md).
   One rule governs the write path and is the reason the code is shaped the way
   it is: `published` is a claim about a read-back, not about an OK (§W4.3). */
export const WRITE = {
  PUBLISH_TIMEOUT_MS: 15000,
  READBACK_ATTEMPTS: 3,
  READBACK_BACKOFF_MS: [0, 2000, 8000],
  SIGNER_TIMEOUT_MS: 60000
} as const;

export const DISCOVERY_TOPIC: string = POLICY.DISCOVERY_TOPICS[0];
