/* Observable cumulative request stats, with a bounded log.
   Data layer: the counters the diagnostics and the relay tests read. */

export interface StatEntry {
  readonly at: number;
  readonly kind: 'req' | 'cache';
  readonly relay?: string;
  readonly detail: string;
}

export interface StatsDelta {
  readonly logicalReqs: number;
  readonly physicalReqs: number;
  readonly httpAttempts: number;
  readonly cacheHits: number;
}

const MAX_LOG = 200;

class RequestStats {
  logicalReqs = 0;
  physicalReqs = 0;
  /* §9.2: HTTP in the catalog data path is zero. Nothing in this codebase
     increments this counter — it exists so "zero" is an assertable number in
     diagnostics and tests rather than an unverifiable claim. A non-zero value
     can only mean a regression reintroduced an HTTP dependency. */
  httpAttempts = 0;
  cacheHits = 0;

  private log: StatEntry[] = [];

  private push(entry: StatEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG) this.log.shift();
  }

  logReq(relay: string, detail: string): void {
    this.physicalReqs += 1;
    this.push({at: Date.now(), kind: 'req', relay, detail});
  }

  logCache(detail: string): void {
    this.cacheHits += 1;
    this.push({at: Date.now(), kind: 'cache', detail});
  }

  getLog(): StatEntry[] {
    return this.log.slice();
  }

  reset(): void {
    this.logicalReqs = 0;
    this.physicalReqs = 0;
    this.httpAttempts = 0;
    this.cacheHits = 0;
    this.log = [];
  }

  /** A snapshot, so a single load can report its own cost rather than the total. */
  snapshot(): StatsDelta {
    return {
      logicalReqs: this.logicalReqs,
      physicalReqs: this.physicalReqs,
      httpAttempts: this.httpAttempts,
      cacheHits: this.cacheHits
    };
  }

  since(base: StatsDelta): StatsDelta {
    return {
      logicalReqs: this.logicalReqs - base.logicalReqs,
      physicalReqs: this.physicalReqs - base.physicalReqs,
      httpAttempts: this.httpAttempts - base.httpAttempts,
      cacheHits: this.cacheHits - base.cacheHits
    };
  }
}

export const stats = new RequestStats();
