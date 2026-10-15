import type { Bar } from "./types";

// Scroll-back pagination support (#109). The stateful paging (exhaustion
// latch, single-flight, stale discard) lives in SonrChart's data loader —
// per chart instance, so symbol/interval switches reset it for free. What
// lives here is the pure seam guard, kept framework-free and unit-testable.

/** Minimum quiet time after a failed page before the next left-edge pan
 *  refetches — KLineChart refires its load hook on every render while the
 *  viewport touches the edge, so without this a persistently failing
 *  datasource would be hammered in a tight loop. */
export const PAGE_RETRY_COOLDOWN_MS = 2000;

/**
 * Guard a page of older bars before it's prepended (#109): keep only bars
 * strictly older than `before` (the current oldest timestamp — the seam) and
 * strictly increasing in time, dropping anything else. A datasource bug
 * (overlap, duplicates, unsorted rows) degrades to shorter history, never to
 * a corrupted series. O(n), allocation-light.
 */
export function sanitizeOlderBars(page: readonly Bar[], before: number): Bar[] {
  const out: Bar[] = [];
  for (const bar of page) {
    if (!(bar.time < before)) continue; // at/after the seam — would duplicate or reorder
    const prev = out[out.length - 1];
    if (prev && !(bar.time > prev.time)) continue; // non-monotonic — drop, don't resort
    out.push(bar);
  }
  return out;
}
