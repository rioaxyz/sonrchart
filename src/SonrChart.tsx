import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  dispose,
  init,
  type Chart,
  type DeepPartial,
  type KLineData,
  type PeriodType,
  type Styles,
} from "klinecharts";
import { themeStyles } from "./theme";
import type { Bar, DataSource, Interval, PriceLine, Theme } from "./types";

export interface SonrChartProps {
  /** Ticker to chart, e.g. "AAPL". */
  symbol: string;
  /** Bar interval. Defaults to "1" (one minute). */
  interval?: Interval;
  /** Where bars come from — the sole integration seam (see DataSource). */
  dataSource: DataSource;
  /** "dark" (default) | "light". */
  theme?: Theme;
  /** Extra KLineChart style overrides merged over the Sonr theme. */
  styles?: DeepPartial<Styles>;
  /** Built-in KLine indicators to add in sub-panes, e.g. ["VOL","MACD"].
   *  Defaults to ["VOL"]. Pass [] for a bare price pane. */
  indicators?: string[];
  /** Horizontal reference lines (entry / stop / target …). */
  priceLines?: PriceLine[];
  /** How many bars to request on load. Default 500. */
  barCount?: number;
  /** Fired once the chart instance exists. */
  onReady?: (chart: Chart) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Imperative handle: the raw KLineChart instance for advanced use. */
export interface SonrChartHandle {
  chart(): Chart | null;
}

let _seq = 0;

function toKLine(b: Bar): KLineData {
  return { timestamp: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
}

function toPeriod(interval: Interval): { type: PeriodType; span: number } {
  if (interval === "10S") return { type: "second", span: 10 };
  if (interval === "30S") return { type: "second", span: 30 };
  if (interval === "D" || interval === "1D") return { type: "day", span: 1 };
  if (interval === "60") return { type: "hour", span: 1 };
  return { type: "minute", span: parseInt(String(interval), 10) || 1 };
}

const PRICELINE_COLORS: Record<string, string> = {};

export const SonrChart = forwardRef<SonrChartHandle, SonrChartProps>(function SonrChart(
  {
    symbol,
    interval = "1",
    dataSource,
    theme = "dark",
    styles,
    indicators = ["VOL"],
    priceLines,
    barCount = 500,
    onReady,
    className,
    style,
  },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const idRef = useRef(`sonrchart-${++_seq}`);
  const overlayIds = useRef<string[]>([]);

  useImperativeHandle(ref, () => ({ chart: () => chartRef.current }), []);

  // Create the chart, wire the data loader, load the symbol. Rebuilt on a
  // symbol/interval change (a clean history swap).
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.id = idRef.current;

    const chart = init(el, { timezone: "America/New_York" }) as Chart;
    chartRef.current = chart;
    chart.setStyles(mergeStyles(themeStyles(theme), styles));

    let unsub = () => {};
    chart.setDataLoader({
      getBars: async ({ type, callback }) => {
        // This spike loads one recent window; deeper backward pagination can be
        // added by honoring type === "backward" with an older request.
        if (type === "backward") {
          callback([], false);
          return;
        }
        try {
          const bars = await dataSource.getBars(symbol, interval, barCount);
          callback(bars.map(toKLine), false);
        } catch {
          callback([], false);
        }
      },
      subscribeBar: ({ callback }) => {
        if (dataSource.subscribe) {
          unsub = dataSource.subscribe(symbol, interval, (b) => callback(toKLine(b)));
        }
      },
      unsubscribeBar: () => unsub(),
    });

    chart.setSymbol({ ticker: symbol });
    chart.setPeriod(toPeriod(interval));
    for (const ind of indicators) chart.createIndicator(ind);

    onReady?.(chart);

    return () => {
      unsub();
      dispose(idRef.current);
      chartRef.current = null;
      overlayIds.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  // Re-theme without a rebuild.
  useEffect(() => {
    chartRef.current?.setStyles(mergeStyles(themeStyles(theme), styles));
  }, [theme, styles]);

  // Reconcile price-line overlays whenever they change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const id of overlayIds.current) chart.removeOverlay({ id });
    overlayIds.current = [];
    for (const pl of priceLines ?? []) {
      const created = chart.createOverlay({
        name: "priceLine",
        points: [{ value: pl.price }],
        lock: true,
        styles: {
          line: {
            color: pl.color ?? "#7d93e8",
            style: pl.style === "dashed" ? "dashed" : "solid",
          },
        },
        extendData: pl.label,
      });
      if (typeof created === "string") overlayIds.current.push(created);
    }
  }, [priceLines]);

  return <div ref={elRef} className={className} style={{ width: "100%", height: "100%", ...style }} />;
});

// Shallow-ish merge so callers' overrides win over the theme.
function mergeStyles(base: DeepPartial<Styles>, over?: DeepPartial<Styles>): DeepPartial<Styles> {
  if (!over) return base;
  const out: any = { ...base };
  for (const k of Object.keys(over) as (keyof Styles)[]) {
    out[k] = { ...(base as any)[k], ...(over as any)[k] };
  }
  return out;
}

void PRICELINE_COLORS;
