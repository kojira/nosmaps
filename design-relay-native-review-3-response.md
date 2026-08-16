# Relay-Native Data Design — Review 3 Response Matrix

- response_date: 2026-08-16
- reviewed_document: `repos/nosmaps/design-relay-native-data.md`
- review: `repos/nosmaps/design-relay-native-review-3.md`
- scope: design-only minimum corrections for the two blocking P1 findings; no implementation, dependency addition, commit, push, or publication

| review-3 ID | disposition | design response | verification |
|---|---|---|---|
| P1-1 | resolved | §§2.1, 7.4–7.6, 9.1–9.3, 13, and 15 now require exact canonical software-coordinate `a` indexes for `30369`, tool-subject/linked `30370`, and every `30371` shown in tool detail/comparison. Content/tool tag equality is schema-validated. Detail/comparison uses one author-independent coalesced `{"kinds":[30369,30370,30371],"#a":[selectedToolCoordinates]}` logical filter with pagination/event/byte/page caps and the existing maximum one kind-5 cleanup follow-up. Candidate-kind or generic-`#a` live-probe failure excludes that relay and marks `incomplete`; tool-unrelated evidence is outside standard retrieval; broad scans and central-index fallbacks are prohibited. | Exact filter appears in kind/dependency/pseudocode/budget/acceptance contracts; no per-tool N+1 was added. |
| P1-2 | resolved | §7.1 now defines UTF-8 byte validation, no truncation, deterministic RFC-8785/SHA-256 key derivation, and an arithmetic table for every candidate kind `30367`–`30372`. Maxima are `83, 138, 192, 192, 118, 71` bytes. The former 128-byte feature/type contradiction is removed; complete source values remain in content. §15 requires per-grammar maximum/one-byte-over fixtures plus common 191/192/193-byte boundaries. | All candidate maxima calculate to `<=192`; searches find no obsolete 128-byte feature/type or variable 30370 nonce rule. |

resolved_count: 2
unresolved_count: 0

## Preserved constraints

- review-2 fixes remain intact: NIP-51 `30267`, direct crypto verifier wiring, fail-closed NIP-44 bookmarks, anonymous public Blossom quorum, identical signed pointer retry, and bounded coalesced kind-5 cleanup.
- The eight accepted AP/eventual-consistency constraints remain unchanged.
- Existing Blossom BUD usage remains; self-hosted Blossom and a backend/central index remain out of scope.
- Detail/comparison still has one coalesced target round plus at most one coalesced cleanup follow-up per passing relay; no tool/event N+1.

## Static verification

- `git diff --check`: pass.
- fenced JSON examples: 7/7 parse.
- closed relay strings: 0.
- default relays present: `wss://x.kojira.io`, `wss://nos.lol`.
- candidate `d` arithmetic: all six kinds `<=192` UTF-8 bytes.
- implementation/dependency/commit/push/Pages publication: not performed.
