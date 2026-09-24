import { useEffect, useMemo, useState, type RefObject } from "react";
import type { KLineData } from "klinecharts";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { MarketStatus } from "./MarketStatus";
import { bareTicker, intervalLabel } from "./watermark";
import { mergeLabels, type Labels } from "./labels";

// TradingView-style chart header (issue #45): one HTML line reading
// `TICKER · interval · source` → the clickable market-status button → the live
// O/H/L/C values, the change vs the prior bar's close, and volume. The OHLC
// tracks the crosshair (falling back to the latest bar) via the chart handle's
// subscribeHeaderBar; pair it with `legend={false}` on <SonrChart> so the
// built-in canvas legend doesn't double up.

export interface ChartHeaderProps {
  chartRef: RefObject<SonrChartHandle>;
  symbol: string;
  interval: Interval;
  /** Data-source label shown after `symbol · interval` (e.g. "Alpaca"). */
  source?: string;
  /** Precision for O/H/L/C/change (defaults to 2). */
  pricePrecision?: number;
  labels?: Partial<Labels>;
  className?: string;
}

const fmt = (v: number | undefined, prec: number): string =>
  (v ?? 0).toLocaleString("en-US", { minimumFractionDigits: prec, maximumFractionDigits: prec });

const fmtVolume = (v: number | undefined): string => {
  const n = v ?? 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
};

export function ChartHeader({ chartRef, symbol, interval, source, pricePrecision = 2, labels, className }: ChartHeaderProps) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const [bar, setBar] = useState<{ current: KLineData | null; prev: KLineData | null }>({ current: null, prev: null });

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.subscribeHeaderBar) {
        unsub = h.subscribeHeaderBar((current, prev) => setBar({ current, prev }));
      } else {
        setTimeout(attach, 50);
      }
    };
    attach();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [chartRef]);

  const k = bar.current;
  const up = (k?.close ?? 0) >= (k?.open ?? 0);
  const dirClass = up ? "sonr-hd-up" : "sonr-hd-down";

  // Change vs the prior bar's close.
  const pc = bar.prev?.close;
  let change: { text: string; up: boolean } | null = null;
  if (typeof pc === "number" && pc !== 0 && typeof k?.close === "number") {
    const d = k.close - pc;
    const u = d >= 0;
    change = { up: u, text: `${u ? "+" : "−"}${fmt(Math.abs(d), pricePrecision)} (${u ? "+" : "−"}${(Math.abs(d / pc) * 100).toFixed(2)}%)` };
  }

  return (
    <div className={`sonr-hd${className ? ` ${className}` : ""}`} role="group" aria-label={L.symbolInfo}>
      <span className="sonr-hd-sym">
        {bareTicker(symbol).toUpperCase()} · {intervalLabel(interval)}
        {source ? ` · ${source}` : ""}
      </span>
      <MarketStatus labels={labels} />
      {k && (
        <span className="sonr-hd-ohlc">
          <span className="sonr-hd-cell">
            <span className="sonr-hd-k">O</span>
            <span className={dirClass}>{fmt(k.open, pricePrecision)}</span>
          </span>
          <span className="sonr-hd-cell">
            <span className="sonr-hd-k">H</span>
            <span className={dirClass}>{fmt(k.high, pricePrecision)}</span>
          </span>
          <span className="sonr-hd-cell">
            <span className="sonr-hd-k">L</span>
            <span className={dirClass}>{fmt(k.low, pricePrecision)}</span>
          </span>
          <span className="sonr-hd-cell">
            <span className="sonr-hd-k">C</span>
            <span className={dirClass}>{fmt(k.close, pricePrecision)}</span>
          </span>
          {change && <span className={change.up ? "sonr-hd-up" : "sonr-hd-down"}>{change.text}</span>}
          <span className="sonr-hd-cell">
            <span className="sonr-hd-k">V</span>
            <span className="sonr-hd-v">{fmtVolume(k.volume)}</span>
          </span>
        </span>
      )}
    </div>
  );
}
