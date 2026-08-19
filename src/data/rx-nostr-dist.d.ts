/* Types for the two generated bundles in dist/.

   dist/rx-nostr.js and dist/rx-nostr-crypto.js are esbuild output (build/entry-*.js
   re-exporting the upstream packages), so they ship no declarations of their own.
   Rather than let the dynamic import decay into `any`, the slice of the surface
   this codebase actually calls is declared here. If a call site starts using
   something outside this slice, it fails to compile — which is the point.

   The upstream packages' own types are NOT re-used deliberately: what matters is
   the contract src/data/relay.ts depends on, and that contract must stay small. */

declare module '*/dist/rx-nostr.js' {
  export interface RxNostrEventPacket {
    readonly event?: {
      readonly kind: number;
      readonly pubkey: string;
      readonly created_at: number;
      readonly content: string;
      readonly tags: readonly (readonly string[])[];
      readonly id?: string;
      readonly sig?: string;
    };
    readonly from?: string;
  }

  export interface RxNostrSubscription {
    unsubscribe?: () => void;
  }

  export interface RxBackwardReq {
    emit: (filters: readonly Record<string, unknown>[]) => void;
    over?: () => void;
  }

  export interface RxNostrInstance {
    setDefaultRelays: (relays: readonly string[]) => void;
    use: (req: RxBackwardReq) => {
      subscribe: (observer: {
        next: (packet: RxNostrEventPacket) => void;
        error: () => void;
        complete: () => void;
      }) => RxNostrSubscription;
    };
    send?: (event: unknown, opts?: unknown) => unknown;
    dispose?: () => void;
  }

  export function createRxNostr(opts: {verifier: unknown}): RxNostrInstance;
  export function createRxBackwardReq(): RxBackwardReq;
}

declare module '*/dist/rx-nostr-crypto.js' {
  /** Supplied to createRxNostr so events with invalid ids/signatures are dropped
      before they reach our handlers (invariant I1). */
  export const verifier: unknown;
}
