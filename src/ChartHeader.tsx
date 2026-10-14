import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { KLineData } from "klinecharts";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { MarketStatus } from "./MarketStatus";
import { bareTicker, intervalLabel } from "./watermark";
import { mergeLabels, type Labels } from "./labels";
import type { VolumeTrend } from "./volumeTrend";

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
  /** Volume-trend row (#79): `true` turns it on with the chart-level lookback
   *  (default 2 bars, editable in the settings dialog); a number also sets
   *  that lookback. The on/off state lives on the chart handle, so it's also
   *  toggleable from the indicators menu ("VOLTREND") — this prop seeds it on.
   *  Shown on a second line below the symbol/OHLC row; tracks the same bar as
   *  the OHLC (crosshair, falling back to the latest bar). */
  volumeTrend?: boolean | number;
  labels?: Partial<Labels>;
  className?: string;
}

const fmt = (v: number | undefined, prec: number): string =>
  (v ?? 0).toLocaleString("en-US", { minimumFractionDigits: prec, maximumFractionDigits: prec });

// Breathing room between the header's bottom edge and the first canvas
// legend row it pushes down (#88).
const LEGEND_GAP = 4;

const fmtVolume = (v: number | undefined): string => {
  const n = v ?? 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
};

export function ChartHeader({ chartRef, symbol, interval, source, pricePrecision = 2, volumeTrend, labels, className }: ChartHeaderProps) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const [bar, setBar] = useState<{ current: KLineData | null; prev: KLineData | null }>({ current: null, prev: null });
  const [trend, setTrend] = useState<VolumeTrend | null>(null);
  const [trendOn, setTrendOn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const seedOn = volumeTrend === true || (typeof volumeTrend === "number" && volumeTrend > 0);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    let unsubOn: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.subscribeHeaderBar) {
        unsub = h.subscribeHeaderBar((current, prev) => setBar({ current, prev }));
        if (seedOn) {
          // A numeric prop (re)sets the chart-level lookback; the subscription
          // itself stays unpinned so settings-dialog edits apply live.
          if (typeof volumeTrend === "number") h.setVolumeTrendBars?.(volumeTrend);
          // The prop seeds the chart-level flag on; the indicators menu (or
          // any host control) can still toggle it off afterwards.
          h.setVolumeTrendEnabled?.(true);
        }
        setTrendOn(h.getVolumeTrendEnabled?.() ?? seedOn);
        unsubOn = h.subscribeVolumeTrendEnabled?.(setTrendOn);
      } else {
        setTimeout(attach, 50);
      }
    };
    attach();
    return () => {
      cancelled = true;
      unsub?.();
      unsubOn?.();
    };
  }, [chartRef, volumeTrend, seedOn]);

  // Auto legend offset (#88): keep the chart's on-canvas price-pane legend
  // rows (indicator legends) below this header, so they never draw under the
  // HTML. Geometry-based — the offset is the header's bottom edge measured
  // against the chart container — so a header that doesn't overlap the canvas
  // contributes ~nothing, and a ResizeObserver tracks height changes (e.g.
  // the volume-trend row toggling). A set `legendOffset` prop on <SonrChart>
  // wins over this.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let cancelled = false;
    let ro: ResizeObserver | undefined;
    const apply = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h && !h.setLegendOffset) return; // handle without support — nothing to drive
      const dom = h?.chart?.()?.getDom?.();
      if (!h || !dom) {
        // Chart (or handle) not ready yet — retry like the attach loop above.
        setTimeout(apply, 50);
        return;
      }
      const bottom = el.getBoundingClientRect().bottom - dom.getBoundingClientRect().top;
      h.setLegendOffset(Math.max(0, Math.round(bottom)) + LEGEND_GAP);
    };
    apply();
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => apply());
      ro.observe(el);
    }
    return () => {
      cancelled = true;
      ro?.disconnect();
      chartRef.current?.setLegendOffset?.(null);
    };
  }, [chartRef]);

  // Subscribe to the trend only while the row is on (toggled from the
  // indicators menu or seeded by the prop) — no per-bar work when it's off.
  // trendOn only turns true once the handle exists, so chartRef is ready here.
  useEffect(() => {
    if (!trendOn) {
      setTrend(null);
      return;
    }
    const unsubTrend = chartRef.current?.subscribeVolumeTrend?.((t) => setTrend(t));
    return () => unsubTrend?.();
  }, [chartRef, trendOn]);

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
    <div ref={rootRef} className={`sonr-hd${className ? ` ${className}` : ""}`} role="group" aria-label={L.symbolInfo}>
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
      {trendOn && trend && (
        <span className="sonr-hd-trend">
          <span className="sonr-hd-k">{L.volumeTrend}</span>
          <span className={trend === "increasing" ? "sonr-hd-up" : trend === "decreasing" ? "sonr-hd-down" : "sonr-hd-mixed"}>
            {trend === "increasing" ? L.volumeTrendIncreasing : trend === "decreasing" ? L.volumeTrendDecreasing : L.volumeTrendMixed}
          </span>
        </span>
      )}
    </div>
  );
}
