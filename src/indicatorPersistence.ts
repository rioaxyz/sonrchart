import type { IndicatorSpec } from "./types";

// Module-level store for user indicator sets, keyed by a host-chosen
// `persistenceKey` (#94). The in-instance snapshot (SonrChart's
// persistedIndicatorsRef) already carries studies across chart re-inits —
// symbol/interval/scale switches — while the component stays mounted; this
// registry carries them across UNMOUNTS too, for hosts that remount the chart
// on a symbol change (key={symbol}, or a loading state that swaps the chart
// out while the new ticker fetches). Opt-in by key so multiple chart tiles
// never share state by accident; module lifetime, so it survives as long as
// the page does and never touches storage.

const sets = new Map<string, IndicatorSpec[]>();

/** Record `specs` as the current indicator set for `key`. SonrChart calls
 *  this on every set change and at teardown when `persistenceKey` is set. */
export function savePersistedIndicators(key: string, specs: IndicatorSpec[]): void {
  sets.set(key, specs);
}

/** The last recorded set for `key`, or null if none was ever saved. */
export function loadPersistedIndicators(key: string): IndicatorSpec[] | null {
  return sets.get(key) ?? null;
}

/** Drop the recorded set for `key` — or every key when omitted. A host calls
 *  this to make the next mount seed from the `indicators` prop again. */
export function clearPersistedIndicators(key?: string): void {
  if (key === undefined) sets.clear();
  else sets.delete(key);
}
