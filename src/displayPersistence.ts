import type { CandleStyle, PriceLabels, SessionTint } from "./types";

// Module-level store for the user's chart display settings — candle type,
// session tint, and price-scale labels — keyed by a host-chosen
// `persistenceKey`, alongside the indicator (#94) and drawing (#97)
// registries. These settings are SonrChart state, so they already survive
// symbol/interval/scale switches while the component stays mounted; this
// registry carries them across UNMOUNTS too, for hosts that remount the chart
// on a symbol change (key={symbol}). Opt-in by key so multiple chart tiles
// never share state by accident; module lifetime, in-memory only.

/** The display settings carried across remounts under a `persistenceKey`. */
export interface PersistedDisplay {
  candleStyle?: CandleStyle;
  sessions?: SessionTint;
  priceLabels?: Required<PriceLabels>;
}

const settings = new Map<string, PersistedDisplay>();

/** Merge `patch` into the recorded settings for `key`. SonrChart calls this
 *  whenever one of them changes when `persistenceKey` is set. */
export function savePersistedDisplay(key: string, patch: PersistedDisplay): void {
  settings.set(key, { ...settings.get(key), ...patch });
}

/** The recorded settings for `key`, or null if none were ever saved. */
export function loadPersistedDisplay(key: string): PersistedDisplay | null {
  return settings.get(key) ?? null;
}

/** Drop the recorded settings for `key` — or every key when omitted. A host
 *  calls this to make the next mount seed from the props again. */
export function clearPersistedDisplay(key?: string): void {
  if (key === undefined) settings.clear();
  else settings.delete(key);
}
