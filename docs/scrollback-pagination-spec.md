# Spec: Scroll-back history pagination (`getBarsBefore`)

**Status**: proposed · **Target**: sonrchart 0.8.0 · **Author**: drafted 2026-10-14

## Problem

A chart's history is whatever one `getBars(symbol, interval, count)` call
returned at load (host-configurable via `barCount`, library default 500).
The `DataSource` contract is one-shot — when the user pans to the left edge
there is no mechanism to fetch older bars, so history is a hard wall:
~8 hours of 1-minute bars at the default, regardless of what the host's
backend could actually serve.

Raising `barCount` (Sonr now passes 2000) just moves the wall and taxes every
load for history most sessions never look at. The right shape is demand
paging: load a normal window up front, fetch older chunks only when the user
actually pans toward the edge.

## API change

One **optional** method on `DataSource` — presence is the capability signal:

```ts
interface DataSource {
  /** Most-recent `count` bars, oldest→newest. Unchanged. */
  getBars(symbol: string, interval: Interval, count: number): Promise<Bar[]>;

  /**
   * OPTIONAL scroll-back pagination. Return up to `count` bars strictly
   * OLDER than `before` (epoch ms, exclusive), oldest→newest. Return an
   * empty array when history is exhausted. Omit the method entirely for
   * the current one-shot behavior.
   */
  getBarsBefore?(
    symbol: string,
    interval: Interval,
    count: number,
    before: number
  ): Promise<Bar[]>;
}
```

Design notes:

- **Backward compatible by construction**: every existing datasource keeps
  working untouched; the chart only pages when the method exists.
- `before` is the timestamp of the currently-oldest bar. "Strictly older"
  keeps the seam duplicate-free without the chart needing fuzzy dedupe
  (though it still dedupes defensively, below).
- Return shape matches `getBars` (oldest→newest `Bar[]`) so datasource
  implementations share their mapping code.

## Chart behavior

Implemented in `SonrChart` on KLineChart's load-more hook
(`setLoadMoreDataCallback` in KLineChart 10 — fires when the viewport nears
the data's left edge):

1. **Trigger**: viewport scrolls within the library's edge threshold.
   No capability → report "no more" to KLineChart once and never again for
   this symbol/interval.
2. **Fetch**: `getBarsBefore(symbol, interval, chunk, oldest.timestamp)`
   where `chunk` = the effective `barCount` (one screenful-plus per request).
3. **Prepend** via KLineChart's backward-apply so the viewport anchor is
   preserved (no visual jump).
4. **Dedupe/ordering guard**: drop any returned bar with
   `timestamp >= oldest.timestamp`; drop non-monotonic bars. A datasource
   bug must degrade to shorter history, never to a corrupted series.
5. **Exhaustion**: an empty (or fully-deduped) result marks this
   symbol/interval exhausted — tell KLineChart there's no more so it stops
   firing; forget the flag on symbol/interval change.
6. **Single-flight + staleness**: one in-flight page per chart; responses
   arriving after a symbol/interval switch are discarded (same token pattern
   the initial load uses).
7. **Errors**: a rejected page logs (dev) and re-arms — the next pan retries.
   No user-facing error state for a failed backfill.

Indicators recompute over the extended series automatically (KLineChart
re-runs `calc` on data change — the existing contract). VWAP's ET-day
anchoring already handles longer series; no indicator changes needed.

## Shell passthrough

Nothing new: `SonrChartShell` forwards `dataSource` as-is. (Its `barCount`
passthrough shipped in 0.7.1.)

## Host (Sonr app) side

The backend `/bars` endpoint already supports ranged queries
(`start`/`end` → `fetch_bars_range`), so the datasource implementation is:

```ts
async getBarsBefore(symbol, interval, count, before) {
  const end = new Date(before - 1).toISOString();
  // /bars?symbol=&interval=&end=&limit= — most-recent `count` bars ≤ end
  …same row→Bar mapping as getBars…
}
```

One backend nuance to verify: `/bars` with only `end` set (open-ended
`start`) — if the current endpoint requires both, derive `start` as
`end − count × intervalMs × padding` (padding ≈ 3× for market closures) or
extend the endpoint to accept `end`+`limit` without `start`.

## Acceptance criteria

- Panning left on a datasource WITH `getBarsBefore` loads older bars with no
  viewport jump, repeatedly, until the source is exhausted; a wall only at
  true exhaustion.
- A datasource WITHOUT the method behaves byte-for-byte like today.
- Symbol/interval switches mid-page never mix series or resurrect stale
  pages.
- A pathological datasource (overlapping/unsorted/duplicate bars) yields a
  clean, monotonic series.
- Live `subscribe` updates continue to append correctly while/after paging.

## Tests

- Unit (vitest, existing harness): capability detection; prepend +
  anchor preservation; strict-older dedupe; exhaustion latch + reset on
  symbol change; single-flight; stale-response discard; error re-arm.
- `test/sonrChartShell.test.tsx`: datasource passthrough unchanged.
- Host side (scanner repo): `getBarsBefore` mapping + `end` derivation
  against a stubbed `/bars`.

## Out of scope

- Forward paging (gap-fill after reconnect) — the live `subscribe` path
  owns that today.
- Infinite-scroll persistence (caching paged history across remounts) —
  pairs naturally with `persistenceKey` later, separate proposal.
- Range-button integration ("ALL" fetching to exhaustion) — follow-up once
  paging exists.
