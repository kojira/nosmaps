# Relay-Native Data Design — Review 2 Response Matrix

- response_date: 2026-08-16
- reviewed_document: `repos/nosmaps/design-relay-native-data.md`
- source_review: `repos/nosmaps/design-relay-native-review-2.md`
- scope: design-only minimal corrections; no implementation, dependency addition, commit, push, or publication
- status: resolved

## Response matrix

| review-2 ID | status | minimal correction | design locations | verification |
|---|---|---|---|---|
| P1-1 | resolved | Kind `30267` is a NIP-51 App curation set winner per `(curator,d)`; exact software `a` tags are members, removal in the next set version withdraws membership, and each curator counts once per tool. Manifest state remains separate. | §§0, 2.1, 5.2, 7.8, 9.1, 13, 15 | `recommend:` and custom recommendation JSON occurrences are both 0; set-membership fixtures/budget are present. |
| P1-2 | resolved | Pseudocode imports `verifier` from `@rx-nostr/crypto` and passes `createRxNostr({ verifier })`; app-owned helpers are explicitly labeled. | §§9.3, 15 | `verifier.secp256k1` occurrences 0; direct verifier call present; exact-lockfile `tsc --noEmit` remains the implementation gate. |
| P1-3 | resolved | Private bookmark read/edit/publish requires both active-signer `nip44.encrypt` and `nip44.decrypt`; missing capability or unreadable ciphertext disables writes, with explicit UI text and no plaintext/public downgrade. | §§9.1, 10, 15 | Capability-disabled, no-downgrade, decrypt-failure, and no-EVENT acceptance cases are explicit. |
| P1-4 | resolved | Manifest availability quorum counts only anonymous unauthenticated successful `GET /<sha256>` responses whose bytes hash-verify; authenticated GET mirrors are hints only and cannot be quorum/only copies. | §§3.4–3.5, 13, 15 | Cold fetch is signer-free; public-GET quorum and authenticated-only exclusion fixtures are explicit; existing Blossom only remains in scope. |
| P1-5 | resolved | Timeout/partial failure retries the identical signed pointer event/id to more relays. Any newly signed pointer requires a new canonical manifest generation, updated `previous`, and new hash. | §§3.2, 3.5, 13, 15 | Both retry cases and exact-id read-back are explicit; newly signed same-hash/same-generation behavior is prohibited. |
| P1-6 | resolved | Dynamically discovered review/reaction/observation/evidence events use a bounded target round then at most one coalesced cleanup REQ per relay for learned exact ids/coordinates and authors; results are provisional until merge/finalize. | §§4.2–4.3, 8, 9.1, 11, 13, 15 | Dependency table and budgets charge the follow-up; REQ trace gate forbids per-card/per-event N+1. |

## Accepted constraints retained

All eight accepted constraints from review 2 remain normative: AP/stale-incomplete behavior, best-effort NIP-09, existing Blossom only, fresh-client chain limits, bounded timestamp saturation, non-transactional forward handoff, no bookmark CRDT, and malformed-newer-pointer quarantine/stale fallback.

## Self-verification

Result: **6/6 resolved**.

- `30267` custom per-tool `d=recommend:*` / custom recommendation JSON: 0 occurrences.
- `verifier.secp256k1`: 0 occurrences; `createRxNostr({ verifier })` present.
- NIP-44 both-capabilities disabled rule, UI message, no downgrade, and unreadable-ciphertext write block: present.
- Manifest quorum: anonymous unauthenticated public GET plus byte-hash verification only; signer-free cold fetch present.
- Pointer retry: identical signed event/id resend and new-generation/new-hash re-sign cases both present.
- Dependency table and REQ budgets: at most one coalesced cleanup follow-up per relay; trace condition forbids N+1.
- Accepted constraints: 8/8 retained; no strong consistency, CRDT, self-hosted Blossom, backend, or global-completeness addition.
- JSON fenced examples: 6/6 parse.
- Closed relay strings: 0; both configured defaults remain present.
- `git diff --check`: pass.
