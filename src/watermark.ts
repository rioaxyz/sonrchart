// Watermark helpers: coerce the `watermark` prop into a full options object,
// fold in live changes, and build the faint symbol/interval ink the
// WATERMARK_INDICATOR paints behind the candles. Pure and framework-free so
// SonrChart just wires them to state.
import type { WatermarkData } from "./indicators";
import type { Theme, WatermarkOptions } from "./types";

/** Bare ticker for the watermark (drop any "EXCHANGE:" prefix). */
export function bareTicker(symbol: string): string {
  return symbol.includes(":") ? symbol.split(":").pop() ?? symbol : symbol;
}

/** Human interval label for the watermark subtitle. */
export function intervalLabel(iv: string): string {
  const m: Record<string, string> = { "10S": "10s", "30S": "30s", "1": "1m", "5": "5m", "15": "15m", "30": "30m", "60": "1h", D: "1D", "1D": "1D", "1440": "1D" };
  return m[iv] ?? iv;
}

/** Default faint watermark ink hex for the theme (candles read cleanly over it). */
export function watermarkInk(theme: Theme): string {
  return theme === "dark" ? "#e6ebe9" : "#1a1f29";
}

export function defaultWatermark(theme: Theme): WatermarkOptions {
  return { symbol: false, interval: false, color: watermarkInk(theme), opacity: 0.06 };
}

/** Coerce the `watermark` prop (boolean | partial) into a full options object.
 *  `true` shows both; a partial object shows whatever it doesn't turn off. */
export function normalizeWatermark(prop: boolean | Partial<WatermarkOptions> | undefined, theme: Theme): WatermarkOptions {
  const base = defaultWatermark(theme);
  if (prop === undefined || prop === false) return base;
  if (prop === true) return { ...base, symbol: true, interval: true };
  return {
    symbol: prop.symbol ?? true,
    interval: prop.interval ?? true,
    color: prop.color ?? base.color,
    opacity: prop.opacity ?? base.opacity,
  };
}

/** Fold a change (boolean master or partial options) into the current config. */
export function mergeWatermark(cur: WatermarkOptions, next: boolean | Partial<WatermarkOptions>): WatermarkOptions {
  if (typeof next === "boolean") return { ...cur, symbol: next, interval: next };
  return { ...cur, ...next };
}

/** #rrggbb + opacity -> rgba() for the canvas fill. */
export function composeRgba(color: string, opacity: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`;
}

export function buildWatermark(symbol: string, interval: string, opts: WatermarkOptions): WatermarkData {
  return {
    title: opts.symbol ? bareTicker(symbol).toUpperCase() : "",
    subtitle: opts.interval ? intervalLabel(interval) : "",
    color: composeRgba(opts.color, opts.opacity),
  };
}
