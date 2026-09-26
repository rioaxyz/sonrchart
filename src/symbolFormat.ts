// Currency / unit price formatting (issue #39). Pure so it's unit-tested and
// shared by the legend price cells and any host formatter.
//
// KLineChart's `Formatter` has no y-axis price hook and its global
// `thousandsSeparator.format` is applied to volume and %-change too, so a raw
// currency prefix there would corrupt those. We therefore decorate the prices
// we fully control — the legend O/H/L/C and the crosshair pill (both routed
// through the chart's price formatter) — rather than every axis tick.

/** Quote metadata attached to a symbol (subset of SymbolInfo). */
export interface QuoteFormat {
  /** Currency code or sign, prefixed (e.g. "USD", "$"). */
  currency?: string;
  /** Unit, suffixed (e.g. "pts", "¢"). */
  unit?: string;
}

// Single-glyph currency signs render tight against the number ("$12.30");
// multi-char codes read better spaced ("USD 12.30").
const SIGN = /^[^\p{L}]+$/u;

/**
 * Decorate an already-formatted price string with a currency prefix and/or unit
 * suffix. A glyph currency ("$", "€") hugs the number; an alphabetic code
 * ("USD") gets a space. Passing neither returns the text unchanged, so this
 * is a no-op for symbols without quote metadata. Pure.
 */
export function formatWithUnit(text: string, quote?: QuoteFormat): string {
  if (!quote) return text;
  let out = text;
  const cur = quote.currency?.trim();
  if (cur) out = SIGN.test(cur) ? `${cur}${out}` : `${cur} ${out}`;
  const unit = quote.unit?.trim();
  if (unit) out = `${out} ${unit}`;
  return out;
}
