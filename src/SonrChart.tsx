import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { dispose, init, type Chart, type DeepPartial, type Styles } from "klinecharts";
import { themeStyles } from "./theme";
import { PATTERN_INDICATOR, SESSION_INDICATOR, registerSonrIndicators } from "./indicators";
import { asSpec, mergeStyles, sessionColors, toKLine, toPeriod } from "./internal";
import type {
  DataSource,
  IndicatorSpec,
  Interval,
  OrderLine,
  PatternMarker,
  PriceLine,
  SessionTint,
  Theme,
} from "./types";

registerSonrIndicators();

const CANDLE_PANE = "candle_pane";

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
  /** Indicators to show. Strings ("VOL") or specs ({ name, pane, calcParams }).
   *  Defaults to ["VOL"]. Pass [] for a bare price pane. (issue #4) */
  indicators?: (string | IndicatorSpec)[];
  /** Session background tinting for pre/after-hours. (issue #10) */
  sessions?: SessionTint;
  /** Pattern-context markers drawn on the price pane. (issue #5) */
  patterns?: PatternMarker[];
  /** Static horizontal reference lines (entry / stop / target). */
  priceLines?: PriceLine[];
  /** Draggable on-chart order/position lines. (issue #19) */
  orderLines?: OrderLine[];
  /** How many bars to request on load. Default 500. */
  barCount?: number;
  /** Fired once the chart instance exists. */
  onReady?: (chart: Chart) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Imperative handle: the raw chart plus an indicator-control surface (the API
 *  half of issue #4 — host UIs drive these; see IndicatorMenu for a ready UI). */
export interface SonrChartHandle {
  chart(): Chart | null;
  addIndicator(spec: string | IndicatorSpec): void;
  removeIndicator(name: string): void;
  listIndicators(): string[];
}

let _seq = 0;

export const SonrChart = forwardRef<SonrChartHandle, SonrChartProps>(function SonrChart(
  {
    symbol,
    interval = "1",
    dataSource,
    theme = "dark",
    styles,
    indicators = ["VOL"],
    sessions,
    patterns,
    priceLines,
    orderLines,
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

  const createIndicator = (spec: IndicatorSpec) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.createIndicator(
      {
        name: spec.name,
        ...(spec.calcParams ? { calcParams: spec.calcParams } : {}),
        ...(spec.pane === "main" ? { paneId: CANDLE_PANE } : {}),
      },
      false,
    );
  };

  useImperativeHandle(
    ref,
    () => ({
      chart: () => chartRef.current,
      addIndicator: (i) => createIndicator(asSpec(i)),
      removeIndicator: (name) => {
        chartRef.current?.removeIndicator({ name });
      },
      listIndicators: () =>
        (chartRef.current?.getIndicators() ?? [])
          .map((ind) => ind.name)
          .filter((n) => n !== SESSION_INDICATOR && n !== PATTERN_INDICATOR),
    }),
    [],
  );

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
    // Session tint sits underneath everything else on the candle pane.
    if (sessions) {
      chart.createIndicator({ name: SESSION_INDICATOR, paneId: CANDLE_PANE, extendData: sessionColors(sessions) }, false);
    }
    for (const i of indicators) createIndicator(asSpec(i));
    if (patterns && patterns.length) {
      chart.createIndicator({ name: PATTERN_INDICATOR, paneId: CANDLE_PANE, extendData: patterns }, false);
    }

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

  // Session tint reconcile (issue #10).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const present = chart.getIndicators({ name: SESSION_INDICATOR }).length > 0;
    if (sessions && !present) {
      chart.createIndicator({ name: SESSION_INDICATOR, paneId: CANDLE_PANE, extendData: sessionColors(sessions) }, false);
    } else if (sessions && present) {
      chart.overrideIndicator({ name: SESSION_INDICATOR, extendData: sessionColors(sessions) });
    } else if (!sessions && present) {
      chart.removeIndicator({ name: SESSION_INDICATOR });
    }
  }, [sessions]);

  // Pattern markers reconcile (issue #5).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const present = chart.getIndicators({ name: PATTERN_INDICATOR }).length > 0;
    const has = !!(patterns && patterns.length);
    if (has && !present) {
      chart.createIndicator({ name: PATTERN_INDICATOR, paneId: CANDLE_PANE, extendData: patterns }, false);
    } else if (has && present) {
      chart.overrideIndicator({ name: PATTERN_INDICATOR, extendData: patterns });
    } else if (!has && present) {
      chart.removeIndicator({ name: PATTERN_INDICATOR });
    }
  }, [patterns]);

  // Reconcile price-line + order-line overlays whenever either changes.
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
        styles: { line: { color: pl.color ?? "#7d93e8", style: pl.style === "dashed" ? "dashed" : "solid" } },
        extendData: pl.label,
      });
      if (typeof created === "string") overlayIds.current.push(created);
    }

    for (const ol of orderLines ?? []) {
      const draggable = ol.draggable !== false;
      const priceOf = (o: any): number | null => {
        const v = o?.overlay?.points?.[0]?.value;
        return typeof v === "number" ? v : null;
      };
      const created = chart.createOverlay({
        name: "priceLine",
        points: [{ value: ol.price }],
        lock: !draggable,
        styles: { line: { color: ol.color ?? "#e0a33c", style: ol.style === "dashed" ? "dashed" : "solid" } },
        extendData: ol.label,
        onPressedMoving: (e) => {
          const p = priceOf(e);
          if (p != null) ol.onMove?.(p, "moving");
          return false;
        },
        onPressedMoveEnd: (e) => {
          const p = priceOf(e);
          if (p != null) ol.onMove?.(p, "end");
          return false;
        },
      });
      if (typeof created === "string") overlayIds.current.push(created);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceLines, orderLines]);

  return <div ref={elRef} className={className} style={{ width: "100%", height: "100%", ...style }} />;
});
