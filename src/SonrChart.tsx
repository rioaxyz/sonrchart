import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { dispose, init, utils, type Chart, type DeepPartial, type KLineData, type Nullable, type Styles } from "klinecharts";
import { resolveThemeStyles, PALETTE } from "./theme";
import { PATTERN_INDICATOR, SERIES_INDICATOR, SESSION_INDICATOR, WATERMARK_INDICATOR, registerSonrIndicators, type SeriesData, type WatermarkData } from "./indicators";
import { CANDLE_TYPE, HaTransformer, isCustomSeries, isHeikinAshi, toHeikinAshi } from "./candles";
import { COMPARE_INDICATOR, alignCompare, registerCompareIndicator, type CompareLine } from "./compare";
import { asSpec, mergeStyles, sessionColors, toKLine, toPeriod } from "./internal";
import { USER_DRAWING_GROUP } from "./drawings";
import { BRUSH_OVERLAY, brushStyle, isBrushTool, registerBrushOverlay, type BrushStyle, type BrushTool } from "./brush";
import type {
  CandleStyle,
  ChartState,
  CompareSpec,
  DataSource,
  DrawingTool,
  IndicatorSpec,
  Interval,
  Magnet,
  OrderLine,
  PatternMarker,
  PriceLine,
  PriceScale,
  SessionTint,
  Theme,
  WatermarkOptions,
} from "./types";

registerSonrIndicators();
registerCompareIndicator();
registerBrushOverlay();

const CANDLE_PANE = "candle_pane";

function magnetMode(m: Magnet | undefined): "normal" | "weak_magnet" | "strong_magnet" {
  if (m === true || m === "weak") return "weak_magnet";
  if (m === "strong") return "strong_magnet";
  return "normal";
}

export interface SonrChartProps {
  symbol: string;
  interval?: Interval;
  dataSource: DataSource;
  /** "dark" | "light", or the name of a theme registered via `registerTheme`
   *  or supplied in `customThemes`. (#46) */
  theme?: Theme | string;
  /** Inline named custom themes, looked up before the global registry. (#46) */
  customThemes?: Record<string, DeepPartial<Styles>>;
  styles?: DeepPartial<Styles>;
  /** Indicators to show. Strings ("VOL") or specs. Default ["VOL"]. (#4) */
  indicators?: (string | IndicatorSpec)[];
  /** Per-indicator sub-pane heights in px, keyed by indicator name. (#7) */
  paneHeights?: Record<string, number>;
  /** Session background tinting for pre/after-hours. (#10) */
  sessions?: SessionTint;
  /** Underlaid symbol + interval watermark behind the candles. `true` shows both;
   *  pass options to toggle each and set color/opacity. */
  watermark?: boolean | Partial<WatermarkOptions>;
  /** Pattern-context markers on the price pane. (#5) */
  patterns?: PatternMarker[];
  /** Static reference lines (entry / stop / target). */
  priceLines?: PriceLine[];
  /** Draggable order/position lines. (#19) */
  orderLines?: OrderLine[];
  /** Price-scale mode (log / percentage / invert / inside). (#12) */
  priceScale?: PriceScale;
  /** Magnet mode for drawing tools — snap points to nearby OHLC. (#13) */
  magnet?: Magnet;
  /** Candle rendering style — solid/hollow/ohlc/area/heikin_ashi. (#1) */
  candleStyle?: CandleStyle;
  /** Comparison symbols overlaid on the main pane, ratio-scaled. (#9) */
  compareSeries?: CompareSpec[];
  /** How many bars to request on load. Default 500. */
  barCount?: number;
  /** Override the crosshair price pill / big-number formatting. (#46) */
  priceFormatter?: (value: number) => string;
  /** Override the crosshair date template, e.g. "YYYY-MM-DD HH:mm". (#46) */
  dateFormat?: string;
  onReady?: (chart: Chart) => void;
  /** Fired when resolveSymbol returns null for the requested ticker. (#8) */
  onSymbolError?: (symbol: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Imperative surface: raw chart, indicator control (#4), drawing tools (#3),
 *  price scale (#12), snapshot (#20), and state save/load (#15). */
export interface SonrChartHandle {
  chart(): Chart | null;
  addIndicator(spec: string | IndicatorSpec): void;
  removeIndicator(name: string): void;
  listIndicators(): string[];
  /** Start interactive drawing of a tool; honors the current magnet mode. */
  startDrawing(tool: DrawingTool): void;
  /** Cancel an armed-but-unplaced drawing (toggle the tool off). */
  cancelDrawing(): void;
  /** The tool currently armed for drawing, or null if none. */
  activeDrawing(): DrawingTool | null;
  /** Subscribe to armed-tool changes (arm → tool, placed/cancelled → null).
   *  Returns an unsubscribe fn. Lets a toolbar highlight the active tool. */
  subscribeDrawing(cb: (tool: DrawingTool | null) => void): () => void;
  /** Remove all user-drawn overlays (leaves price/order lines + indicators). */
  clearDrawings(): void;
  /** Capture the chart to a data URL (PNG by default). */
  snapshot(opts?: { type?: "png" | "jpeg"; background?: string; includeOverlays?: boolean }): string | null;
  /** Serialize user drawings + indicators + price scale (#15). */
  exportState(): ChartState;
  /** Restore state produced by exportState (#15). */
  importState(state: ChartState): void;
  /** Current indicator set as specs — a study template to name/persist (#6). */
  getIndicatorSet(): IndicatorSpec[];
  /** Replace the user indicators with a saved set (#6). */
  applyIndicatorSet(specs: (string | IndicatorSpec)[]): void;
  /** Undo the last drawing change (#16). */
  undo(): void;
  /** Redo an undone drawing change (#16). */
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Subscribe to undo/redo-availability changes (#16). Returns unsubscribe. */
  subscribeHistory(cb: () => void): () => void;
  /** Current magnet mode for new drawings (#13). */
  getMagnet(): Magnet | undefined;
  /** Set the magnet mode imperatively (a changed `magnet` prop still overrides). */
  setMagnet(magnet: Magnet | undefined): void;
  /** Subscribe to magnet-mode changes. Returns unsubscribe. */
  subscribeMagnet(cb: (magnet: Magnet | undefined) => void): () => void;
  // Handle-driven display settings — let the toolbar control them with no host
  // wiring (uncontrolled), while a `*` prop can still control them.
  /** Current theme selector ("dark"/"light" or a registered/custom name). (#46) */
  getTheme(): Theme | string;
  /** Apply a theme by name imperatively (a changed `theme` prop still wins). (#46) */
  setTheme(theme: Theme | string): void;
  subscribeTheme(cb: (theme: Theme | string) => void): () => void;
  getCandleStyle(): CandleStyle;
  setCandleStyle(style: CandleStyle): void;
  subscribeCandleStyle(cb: (style: CandleStyle) => void): () => void;
  getPriceScale(): PriceScale | undefined;
  setPriceScale(scale: PriceScale): void;
  subscribePriceScale(cb: (scale: PriceScale) => void): () => void;
  getSessions(): SessionTint | undefined;
  setSessions(on: SessionTint): void;
  subscribeSessions(cb: (on: SessionTint) => void): () => void;
  getWatermark(): WatermarkOptions;
  setWatermark(opts: boolean | Partial<WatermarkOptions>): void;
  subscribeWatermark(cb: () => void): () => void;
  /** Current brush/highlighter stroke style (color + width). */
  getBrushStyle(tool: BrushTool): BrushStyle;
  /** Set the brush/highlighter stroke style — applies to subsequent strokes. */
  setBrushStyle(tool: BrushTool, style: BrushStyle): void;
  /** Subscribe to brush-style changes (for a settings UI). Returns unsubscribe. */
  subscribeBrush(cb: () => void): () => void;
}

let _seq = 0;

// A colored legend cell (title or value) in the candle tooltip.
type Tip = { text: string; color: string };

// Controllable-but-not-required state: the prop is an INITIAL value (and a live
// override when the host explicitly changes it), while `set` lets the toolbar
// drive the value through the chart handle with no host wiring. This is what
// makes the candle-type / price-scale / sessions / watermark controls work out
// of the box — a bare consumer gets them for free; a host can still control them
// by passing the prop. `subscribe` notifies observers (the toolbar) on change.
function useControllable<T>(prop: T | undefined, fallback: T) {
  const [value, setValue] = useState<T>(prop === undefined ? fallback : prop);
  const propRef = useRef(prop);
  if (prop !== propRef.current) {
    propRef.current = prop;
    if (prop !== undefined) setValue(prop); // host changed the prop → adopt it
  }
  const subs = useRef(new Set<(v: T) => void>());
  useEffect(() => {
    subs.current.forEach((cb) => cb(value));
  }, [value]);
  const set = useCallback((v: T) => setValue(v), []);
  const subscribe = useCallback((cb: (v: T) => void) => {
    subs.current.add(cb);
    return () => subs.current.delete(cb);
  }, []);
  return { value, set, subscribe };
}

// --- watermark helpers -------------------------------------------------------
// Bare ticker for the watermark (drop any "EXCHANGE:" prefix).
function bareTicker(symbol: string): string {
  return symbol.includes(":") ? symbol.split(":").pop() ?? symbol : symbol;
}
// Human interval label for the watermark subtitle.
function intervalLabel(iv: string): string {
  const m: Record<string, string> = { "10S": "10s", "30S": "30s", "1": "1m", "5": "5m", "15": "15m", "30": "30m", "60": "1h", D: "1D", "1D": "1D", "1440": "1D" };
  return m[iv] ?? iv;
}
// Default faint watermark ink hex for the theme (candles read cleanly over it).
function watermarkInk(theme: Theme): string {
  return theme === "dark" ? "#e6ebe9" : "#1a1f29";
}
function defaultWatermark(theme: Theme): WatermarkOptions {
  return { symbol: false, interval: false, color: watermarkInk(theme), opacity: 0.06 };
}
// Coerce the `watermark` prop (boolean | partial) into a full options object.
// `true` shows both; a partial object shows whatever it doesn't turn off.
function normalizeWatermark(prop: boolean | Partial<WatermarkOptions> | undefined, theme: Theme): WatermarkOptions {
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
// Fold a change (boolean master or partial options) into the current config.
function mergeWatermark(cur: WatermarkOptions, next: boolean | Partial<WatermarkOptions>): WatermarkOptions {
  if (typeof next === "boolean") return { ...cur, symbol: next, interval: next };
  return { ...cur, ...next };
}
// #rrggbb + opacity -> rgba() for the canvas fill.
function composeRgba(color: string, opacity: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`;
}
function buildWatermark(symbol: string, interval: string, opts: WatermarkOptions): WatermarkData {
  return {
    title: opts.symbol ? bareTicker(symbol).toUpperCase() : "",
    subtitle: opts.interval ? intervalLabel(interval) : "",
    color: composeRgba(opts.color, opts.opacity),
  };
}

// --- custom series styles (#33) ----------------------------------------------
const SERIES_TRANSPARENT = "rgba(0,0,0,0)";
// Fully transparent candle bars — hides the native series so SONR_SERIES can
// draw line/step/baseline/column/hlc/high_low on top.
const HIDDEN_BAR = {
  upColor: SERIES_TRANSPARENT,
  downColor: SERIES_TRANSPARENT,
  noChangeColor: SERIES_TRANSPARENT,
  upBorderColor: SERIES_TRANSPARENT,
  downBorderColor: SERIES_TRANSPARENT,
  noChangeBorderColor: SERIES_TRANSPARENT,
  upWickColor: SERIES_TRANSPARENT,
  downWickColor: SERIES_TRANSPARENT,
  noChangeWickColor: SERIES_TRANSPARENT,
};
function seriesConfig(style: CandleStyle, theme: Theme): SeriesData {
  return {
    style: style as SeriesData["style"],
    up: PALETTE.GREEN,
    down: PALETTE.RED,
    neutral: theme === "dark" ? "#cbd5e1" : "#334155",
  };
}
// Apply a candle style to the chart: for a custom series style, hide the native
// bars and draw/refresh SONR_SERIES; otherwise restore the theme bar colors and
// drop the series indicator. Safe to call on every candle-style/theme change.
function applyCandleStyle(chart: Chart, style: CandleStyle | undefined, styleObj: DeepPartial<Styles>, baseTheme: Theme): void {
  const s = style ?? "candle";
  const custom = isCustomSeries(s);
  const bar = custom ? HIDDEN_BAR : (styleObj.candle as { bar?: unknown } | undefined)?.bar;
  chart.setStyles({ candle: { type: CANDLE_TYPE[s], ...(bar ? { bar } : {}) } } as DeepPartial<Styles>);
  const present = chart.getIndicators({ name: SERIES_INDICATOR }).length > 0;
  if (custom) {
    const ext = seriesConfig(s, baseTheme);
    if (present) chart.overrideIndicator({ name: SERIES_INDICATOR, extendData: ext });
    else chart.createIndicator({ name: SERIES_INDICATOR, paneId: CANDLE_PANE, extendData: ext }, false);
  } else if (present) {
    chart.removeIndicator({ name: SERIES_INDICATOR });
  }
}

// The candle pane's y-axis config for a price scale. KLineChart fixes the scale
// TYPE (normal/percentage/logarithm) and inversion at pane creation, so this is
// applied at chart init — the component rebuilds when `priceScale` changes.
function yAxisLayout(ps?: PriceScale) {
  if (!ps) return undefined;
  return {
    yAxis: {
      ...(ps.type ? { name: ps.type } : {}),
      reverse: ps.invert ?? false,
      inside: ps.inside ?? false,
    },
  };
}

// Stable key so a priceScale change re-inits the chart.
function scaleKey(ps?: PriceScale) {
  return ps ? `${ps.type ?? "normal"}:${ps.invert ? 1 : 0}:${ps.inside ? 1 : 0}` : "";
}

export const SonrChart = forwardRef<SonrChartHandle, SonrChartProps>(function SonrChart(
  {
    symbol,
    interval = "1",
    dataSource,
    theme: themeProp,
    customThemes,
    styles,
    indicators = ["VOL"],
    paneHeights,
    sessions: sessionsProp,
    watermark: watermarkProp,
    patterns,
    priceLines,
    orderLines,
    priceScale: priceScaleProp,
    magnet,
    candleStyle: candleStyleProp,
    compareSeries,
    barCount = 500,
    priceFormatter,
    dateFormat,
    onReady,
    onSymbolError,
    className,
    style,
  },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const idRef = useRef(`sonrchart-${++_seq}`);
  const overlayIds = useRef<string[]>([]);
  // Magnet mode. Prop-seeded, but a toolbar toggle can override it imperatively;
  // a *changed* prop still wins (so the host stays authoritative when it drives
  // magnet), while an unchanged prop won't clobber a toolbar-set value.
  const magnetRef = useRef<Magnet | undefined>(magnet);
  const magnetPropRef = useRef<Magnet | undefined>(magnet);
  if (magnet !== magnetPropRef.current) {
    magnetPropRef.current = magnet;
    magnetRef.current = magnet;
  }
  const magnetSubs = useRef(new Set<(m: Magnet | undefined) => void>());
  const setMagnet = (m: Magnet | undefined) => {
    magnetRef.current = m;
    magnetSubs.current.forEach((cb) => cb(m));
  };
  // History-change subscribers (the toolbar's undo/redo enablement).
  const historySubs = useRef(new Set<() => void>());
  const notifyHistory = () => historySubs.current.forEach((cb) => cb());
  // Signature of the current line overlays' *visual* fields; lets the reconcile
  // skip a full remove+recreate when a parent re-render changes only array/
  // callback identity, not content (avoids overlay thrash and drag fighting).
  const linesSigRef = useRef<string>("");
  // Latest onMove per order-line id, so a changed callback takes effect without
  // recreating the overlay.
  const orderMoveRef = useRef(new Map<string, OrderLine["onMove"]>());
  // Live-updated prop mirrors read from inside the (stable) data loader.
  // Out-of-the-box, handle-driven display settings (host may still control via
  // the matching prop). Defaults preserve the previous "prop not passed" behavior.
  const th = useControllable<Theme | string>(themeProp, "dark");
  const candle = useControllable<CandleStyle>(candleStyleProp, "candle");
  const scale = useControllable<PriceScale>(priceScaleProp, { type: "normal" });
  const sess = useControllable<SessionTint>(sessionsProp, false);
  const theme = th.value;
  const candleStyle = candle.value;
  const priceScale = scale.value;
  const sessions = sess.value;
  // Resolved KLineChart style object for the current theme (built-in or named).
  const themeStyleObj = resolveThemeStyles(theme, customThemes);
  // A named/custom theme has no intrinsic dark/light; default its boolean-driven
  // bits (watermark ink, series neutral, legend label) to the dark base.
  const baseTheme: Theme = theme === "light" ? "light" : "dark";
  // Watermark is a merge-able config (symbol/interval/color/opacity), so it uses
  // its own controllable-ish state rather than the scalar useControllable helper.
  const [watermark, setWatermarkState] = useState<WatermarkOptions>(() => normalizeWatermark(watermarkProp, baseTheme));
  const wmPropRef = useRef(watermarkProp);
  if (watermarkProp !== wmPropRef.current) {
    wmPropRef.current = watermarkProp;
    if (watermarkProp !== undefined) setWatermarkState(normalizeWatermark(watermarkProp, baseTheme));
  }
  const wmSubs = useRef(new Set<() => void>());
  const setWatermark = (next: boolean | Partial<WatermarkOptions>) => setWatermarkState((cur) => mergeWatermark(cur, next));
  useEffect(() => {
    wmSubs.current.forEach((cb) => cb());
  }, [watermark]);
  const candleStyleRef = useRef(candleStyle);
  candleStyleRef.current = candleStyle;
  // Live mirrors so the (stable, []-deps) imperative handle's getters read the
  // current value, not the one captured on first render.
  const priceScaleRef = useRef(priceScale);
  priceScaleRef.current = priceScale;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const watermarkRef = useRef(watermark);
  watermarkRef.current = watermark;
  const compareRef = useRef(compareSeries);
  compareRef.current = compareSeries;
  // Live mirrors read from inside the (stable) candle-legend callback so it
  // reflects the current theme and the resolved price precision without being
  // re-created on every theme/symbol change.
  const themeRef = useRef(baseTheme);
  themeRef.current = baseTheme;
  // The raw theme selector (name), for the handle's getTheme().
  const themeSelRef = useRef(theme);
  themeSelRef.current = theme;
  const pricePrecRef = useRef(2);
  // Host formatter overrides, read live from the (stable) formatter callbacks.
  const dateFormatRef = useRef(dateFormat);
  dateFormatRef.current = dateFormat;
  const priceFormatterRef = useRef(priceFormatter);
  priceFormatterRef.current = priceFormatter;
  // Heikin Ashi live transformer (rebuilt per data load in the create effect).
  const haRef = useRef(new HaTransformer());
  // Drawing undo/redo history (#16). stack[ptr] is the current drawing set;
  // `restoring` suppresses history capture while we recreate overlays.
  type Snap = Array<{ name: string; points: unknown[]; styles?: unknown; mode?: string; extendData?: unknown }>;
  const historyRef = useRef<{ stack: Snap[]; ptr: number }>({ stack: [[]], ptr: 0 });
  const restoringRef = useRef(false);

  // Armed-drawing state (#3): which tool is mid-draw, the id of its in-progress
  // overlay (so it can be cancelled), and subscribers (the toolbar) that want to
  // reflect the armed tool as an active/highlighted button.
  const activeToolRef = useRef<DrawingTool | null>(null);
  const progressIdRef = useRef<string | null>(null);
  const drawingSubs = useRef(new Set<(tool: DrawingTool | null) => void>());
  const setActiveTool = (tool: DrawingTool | null) => {
    activeToolRef.current = tool;
    drawingSubs.current.forEach((cb) => cb(tool));
  };
  // Brush/highlighter stroke styles (color + width), configurable from settings.
  // Seeded from the theme presets; each new stroke reads the current value.
  const brushStylesRef = useRef<Record<BrushTool, BrushStyle>>({
    brush: brushStyle("brush", baseTheme),
    highlighter: brushStyle("highlighter", baseTheme),
  });
  const brushSubs = useRef(new Set<() => void>());
  const notifyBrush = () => brushSubs.current.forEach((cb) => cb());

  const snapshotDrawings = (): Snap =>
    (chartRef.current?.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? []).map((o) => ({
      name: o.name,
      points: o.points as unknown[],
      styles: o.styles,
      mode: o.mode,
      // Brush/highlighter carry their colour+width here — keep it through
      // undo/redo and export/import.
      extendData: o.extendData,
    }));

  const HISTORY_CAP = 100;
  const pushHistory = () => {
    if (restoringRef.current) return;
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.ptr + 1);
    h.stack.push(snapshotDrawings());
    // Bound memory: drop the oldest entries past the cap.
    if (h.stack.length > HISTORY_CAP) h.stack = h.stack.slice(h.stack.length - HISTORY_CAP);
    h.ptr = h.stack.length - 1;
    notifyHistory();
  };

  const beginDrawing = (tool: string) => {
    // Brush/highlighter are one continuous-draw overlay (`sonrBrush`) styled by
    // extendData; magnet snapping is meaningless for freehand, so force normal.
    const brush = isBrushTool(tool);
    const id = chartRef.current?.createOverlay({
      name: brush ? BRUSH_OVERLAY : tool,
      groupId: USER_DRAWING_GROUP,
      mode: brush ? "normal" : magnetMode(magnetRef.current),
      ...(brush ? { extendData: { ...brushStylesRef.current[tool as BrushTool] } } : {}),
      onDrawEnd: () => {
        // Drawing placed: the overlay is now a finished drawing, not in progress.
        progressIdRef.current = null;
        pushHistory();
        // Brush/highlighter are "sticky": stay armed and immediately re-arm for
        // the next stroke, so you can draw repeatedly without re-clicking the
        // toolbar. The tool stays active until toggled off (cancelDrawing).
        if (brush) beginDrawing(tool);
        else setActiveTool(null);
        return false;
      },
      onRemoved: () => {
        pushHistory();
        return false;
      },
    });
    progressIdRef.current = typeof id === "string" ? id : Array.isArray(id) ? (id[0] ?? null) : null;
    setActiveTool(tool as DrawingTool);
  };

  // Cancel an armed-but-unplaced drawing (toggling the tool off). Removes only
  // the in-progress overlay, leaving finished drawings untouched.
  const cancelDrawing = () => {
    const id = progressIdRef.current;
    progressIdRef.current = null;
    setActiveTool(null);
    if (id) {
      restoringRef.current = true; // a cancelled draw isn't a history step
      chartRef.current?.removeOverlay({ id });
      restoringRef.current = false;
    }
  };

  const restoreDrawings = (snap: Snap) => {
    const chart = chartRef.current;
    if (!chart) return;
    restoringRef.current = true;
    chart.removeOverlay({ groupId: USER_DRAWING_GROUP });
    for (const d of snap) {
      chart.createOverlay({
        name: d.name,
        points: d.points as never,
        styles: d.styles as never,
        mode: d.mode as never,
        extendData: d.extendData as never,
        groupId: USER_DRAWING_GROUP,
        onDrawEnd: () => {
          pushHistory();
          return false;
        },
        onRemoved: () => {
          pushHistory();
          return false;
        },
      });
    }
    restoringRef.current = false;
  };

  // Fetch each comparison symbol, align to the main bars, and (re)build the
  // compare overlay indicator (#9). Removes it when there are none.
  const refreshCompare = async () => {
    const chart = chartRef.current;
    if (!chart) return;
    const specs = compareRef.current ?? [];
    const present = chart.getIndicators({ name: COMPARE_INDICATOR }).length > 0;
    if (specs.length === 0) {
      if (present) chart.removeIndicator({ name: COMPARE_INDICATOR });
      return;
    }
    const mainBars = chart.getDataList().map((d) => ({ time: d.timestamp, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume }));
    if (mainBars.length === 0) return;
    const palette = ["#7d93e8", "#e0a33c", "#c678dd", "#56b6c2", "#98c379"];
    // Fetch all comparison symbols in parallel.
    const fetched = await Promise.all(
      specs.map(async (s, i): Promise<CompareLine | null> => {
        try {
          const bars = await dataSource.getBars(s.symbol, interval, barCount);
          return { color: s.color ?? palette[i % palette.length], points: alignCompare(mainBars, bars) };
        } catch {
          return null; // skip a symbol that fails to load
        }
      }),
    );
    if (compareRef.current !== specs) return; // superseded mid-fetch
    const lines = fetched.filter((l): l is CompareLine => l !== null);
    if (chart.getIndicators({ name: COMPARE_INDICATOR }).length > 0) {
      chart.overrideIndicator({ name: COMPARE_INDICATOR, extendData: lines });
    } else {
      chart.createIndicator({ name: COMPARE_INDICATOR, paneId: CANDLE_PANE, extendData: lines }, false);
    }
  };

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

  const applyPaneHeights = () => {
    const chart = chartRef.current;
    if (!chart || !paneHeights) return;
    for (const [name, height] of Object.entries(paneHeights)) {
      const ind = chart.getIndicators({ name })[0];
      if (ind?.paneId) chart.setPaneOptions({ id: ind.paneId, height });
    }
  };

  // Crosshair date + price formatting (#46). Default: prepend the date to the
  // crosshair time pill (TV-style). A host `dateFormat` overrides the crosshair
  // template; a host `priceFormatter` drives big-number/price formatting. Reads
  // refs so it can be re-applied without recreating the chart.
  const applyFormatter = (chart: Chart) => {
    chart.setFormatter({
      formatDate: ({ dateTimeFormat, timestamp, template, type }) => {
        if (dateFormatRef.current && type === "crosshair") {
          return utils.formatDate(dateTimeFormat, timestamp, dateFormatRef.current);
        }
        const t = type === "crosshair" && !/[YMD]/.test(template) ? `YYYY-MM-DD ${template}` : template;
        return utils.formatDate(dateTimeFormat, timestamp, t);
      },
      ...(priceFormatterRef.current
        ? { formatBigNumber: (value: string | number) => priceFormatterRef.current!(typeof value === "number" ? value : Number(value)) }
        : {}),
    });
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
          .filter((n) => n !== SESSION_INDICATOR && n !== PATTERN_INDICATOR && n !== COMPARE_INDICATOR && n !== WATERMARK_INDICATOR && n !== SERIES_INDICATOR),
      startDrawing: (tool: DrawingTool) => beginDrawing(tool),
      cancelDrawing: () => cancelDrawing(),
      activeDrawing: () => activeToolRef.current,
      subscribeDrawing: (cb) => {
        drawingSubs.current.add(cb);
        return () => drawingSubs.current.delete(cb);
      },
      clearDrawings: () => {
        chartRef.current?.removeOverlay({ groupId: USER_DRAWING_GROUP });
        pushHistory();
      },
      snapshot: (opts) => {
        const chart = chartRef.current;
        if (!chart) return null;
        return chart.getConvertPictureUrl(opts?.includeOverlays ?? true, opts?.type ?? "png", opts?.background);
      },
      exportState: (): ChartState => {
        const chart = chartRef.current;
        const drawings = (chart?.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? []).map((o) => ({
          name: o.name,
          points: o.points as unknown[],
          styles: o.styles,
          mode: o.mode,
          extendData: o.extendData,
        }));
        const inds = (chart?.getIndicators() ?? [])
          .filter((i) => i.name !== SESSION_INDICATOR && i.name !== PATTERN_INDICATOR && i.name !== COMPARE_INDICATOR && i.name !== WATERMARK_INDICATOR && i.name !== SERIES_INDICATOR)
          .map((i) => ({ name: i.name, paneId: i.paneId }));
        return { version: 1, drawings, indicators: inds, priceScale };
      },
      importState: (state: ChartState) => {
        const chart = chartRef.current;
        if (!chart || state?.version !== 1) return;
        restoreDrawings((state.drawings ?? []) as Snap);
        for (const ind of state.indicators ?? []) {
          if (!chart.getIndicators({ name: ind.name }).length) {
            chart.createIndicator({ name: ind.name, ...(ind.paneId === CANDLE_PANE ? { paneId: CANDLE_PANE } : {}) }, false);
          }
        }
        // Reset the undo history to the imported drawing set.
        historyRef.current = { stack: [snapshotDrawings()], ptr: 0 };
        // priceScale in the state is informational; the host re-applies it via
        // the `priceScale` prop (scale type is fixed at chart init).
      },
      getIndicatorSet: (): IndicatorSpec[] =>
        (chartRef.current?.getIndicators() ?? [])
          .filter((i) => i.name !== SESSION_INDICATOR && i.name !== PATTERN_INDICATOR && i.name !== COMPARE_INDICATOR && i.name !== WATERMARK_INDICATOR && i.name !== SERIES_INDICATOR)
          .map((i) => ({ name: i.name, pane: i.paneId === CANDLE_PANE ? "main" : "new" })),
      applyIndicatorSet: (specs) => {
        const chart = chartRef.current;
        if (!chart) return;
        for (const i of chart.getIndicators()) {
          if (i.name !== SESSION_INDICATOR && i.name !== PATTERN_INDICATOR && i.name !== COMPARE_INDICATOR && i.name !== WATERMARK_INDICATOR && i.name !== SERIES_INDICATOR) {
            chart.removeIndicator({ name: i.name });
          }
        }
        for (const s of specs) createIndicator(asSpec(s));
        applyPaneHeights();
      },
      undo: () => {
        const h = historyRef.current;
        if (h.ptr <= 0) return;
        h.ptr -= 1;
        restoreDrawings(h.stack[h.ptr]);
        notifyHistory();
      },
      redo: () => {
        const h = historyRef.current;
        if (h.ptr >= h.stack.length - 1) return;
        h.ptr += 1;
        restoreDrawings(h.stack[h.ptr]);
        notifyHistory();
      },
      canUndo: () => historyRef.current.ptr > 0,
      canRedo: () => historyRef.current.ptr < historyRef.current.stack.length - 1,
      subscribeHistory: (cb) => {
        historySubs.current.add(cb);
        return () => historySubs.current.delete(cb);
      },
      getMagnet: () => magnetRef.current,
      setMagnet: (m) => setMagnet(m),
      subscribeMagnet: (cb) => {
        magnetSubs.current.add(cb);
        return () => magnetSubs.current.delete(cb);
      },
      getTheme: () => themeSelRef.current,
      setTheme: (t) => th.set(t),
      subscribeTheme: (cb) => th.subscribe(cb),
      getCandleStyle: () => candleStyleRef.current ?? "candle",
      setCandleStyle: (s) => candle.set(s),
      subscribeCandleStyle: (cb) => candle.subscribe(cb),
      getPriceScale: () => priceScaleRef.current,
      setPriceScale: (s) => scale.set(s),
      subscribePriceScale: (cb) => scale.subscribe(cb),
      getSessions: () => sessionsRef.current,
      setSessions: (s) => sess.set(s),
      subscribeSessions: (cb) => sess.subscribe(cb),
      getWatermark: () => ({ ...watermarkRef.current }),
      setWatermark: (opts) => setWatermark(opts),
      subscribeWatermark: (cb) => {
        wmSubs.current.add(cb);
        return () => wmSubs.current.delete(cb);
      },
      getBrushStyle: (tool) => ({ ...brushStylesRef.current[tool] }),
      setBrushStyle: (tool, style) => {
        brushStylesRef.current[tool] = { ...style };
        notifyBrush();
      },
      subscribeBrush: (cb) => {
        brushSubs.current.add(cb);
        return () => brushSubs.current.delete(cb);
      },
    }),
    // paneHeights/priceScale captured by closure; recreated per render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Create the chart, wire the data loader, resolve + load the symbol.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.id = idRef.current;

    const chart = init(el, {
      timezone: "America/New_York",
      layout: yAxisLayout(priceScale),
    } as never) as Chart;
    chartRef.current = chart;
    chart.setStyles(mergeStyles(themeStyleObj, styles));
    // Candle rendering style (#1).
    applyCandleStyle(chart, candleStyleRef.current, themeStyleObj, baseTheme);
    // Crosshair date/price formatting (#46), default: TV-style date+time pill.
    applyFormatter(chart);
    // Candle legend without the time row: the hovered bar's time lives in the
    // crosshair x-axis pill instead (like TradingView), leaving the legend to
    // show O/H/L/C/V colored by candle direction.
    chart.setStyles({
      candle: {
        tooltip: {
          legend: {
            template: (data: { current: Nullable<KLineData> }): { title: Tip; value: Tip }[] => {
              const k = data.current;
              if (!k) return [];
              const label = (themeRef.current === "dark" ? PALETTE.DARK : PALETTE.LIGHT).muted;
              const dir = (k.close ?? 0) >= (k.open ?? 0) ? PALETTE.GREEN : PALETTE.RED;
              const price = (v?: number) =>
                priceFormatterRef.current
                  ? priceFormatterRef.current(v ?? 0)
                  : utils.formatThousands(utils.formatPrecision(v ?? 0, pricePrecRef.current), ",");
              return [
                { title: { text: "O", color: label }, value: { text: price(k.open), color: dir } },
                { title: { text: "H", color: label }, value: { text: price(k.high), color: dir } },
                { title: { text: "L", color: label }, value: { text: price(k.low), color: dir } },
                { title: { text: "C", color: label }, value: { text: price(k.close), color: dir } },
                { title: { text: "V", color: label }, value: { text: utils.formatBigNumber(k.volume ?? 0), color: label } },
              ];
            },
          },
        },
      },
    } as DeepPartial<Styles>);
    // Fresh Heikin Ashi transformer + fresh undo history for this chart.
    haRef.current = new HaTransformer();
    historyRef.current = { stack: [[]], ptr: 0 };

    let unsub = () => {};
    chart.setDataLoader({
      getBars: async ({ type, callback }) => {
        if (type === "backward") {
          callback([], false);
          return;
        }
        try {
          const bars = await dataSource.getBars(symbol, interval, barCount);
          const ha = isHeikinAshi(candleStyleRef.current);
          if (ha) haRef.current.seed(bars);
          const shaped = ha ? toHeikinAshi(bars) : bars;
          callback(shaped.map(toKLine), false);
          // Compare overlays need the loaded main bars to align to.
          void refreshCompare();
        } catch {
          callback([], false);
        }
      },
      subscribeBar: ({ callback }) => {
        if (dataSource.subscribe) {
          unsub = dataSource.subscribe(symbol, interval, (b) => {
            const shaped = isHeikinAshi(candleStyleRef.current) ? haRef.current.next(b) : b;
            callback(toKLine(shaped));
          });
        }
      },
      unsubscribeBar: () => unsub(),
    });

    let disposed = false;
    (async () => {
      // Symbol resolution (#8): validate/enrich before loading.
      let info: { ticker: string; name?: string; pricePrecision?: number; volumePrecision?: number } = { ticker: symbol };
      if (dataSource.resolveSymbol) {
        const resolved = await dataSource.resolveSymbol(symbol);
        if (disposed) return;
        if (!resolved) {
          onSymbolError?.(symbol);
          return; // unknown symbol — do not load
        }
        info = resolved;
      }
      chart.setSymbol(info);
      pricePrecRef.current = info.pricePrecision ?? 2;
      chart.setPeriod(toPeriod(interval));
      // Watermark first so it sits at the very back (behind session tint + candles).
      if (watermark.symbol || watermark.interval) {
        chart.createIndicator(
          { name: WATERMARK_INDICATOR, paneId: CANDLE_PANE, extendData: buildWatermark(info.ticker ?? symbol, interval, watermark) },
          false,
        );
      }
      if (sessions) {
        chart.createIndicator({ name: SESSION_INDICATOR, paneId: CANDLE_PANE, extendData: sessionColors(sessions) }, false);
      }
      for (const i of indicators) createIndicator(asSpec(i));
      if (patterns && patterns.length) {
        chart.createIndicator({ name: PATTERN_INDICATOR, paneId: CANDLE_PANE, extendData: patterns }, false);
      }
      applyPaneHeights();
      onReady?.(chart);
    })();

    return () => {
      disposed = true;
      unsub();
      dispose(idRef.current);
      chartRef.current = null;
      overlayIds.current = [];
    };
    // priceScale (scaleKey) re-inits because the scale type/inversion is fixed
    // at init. Toggling Heikin Ashi (haKey) re-inits because it transforms the
    // data feed; plain candle-style swaps do NOT rebuild (handled below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, scaleKey(priceScale), isHeikinAshi(candleStyle) ? "ha" : "std"]);

  // Theme (#46): re-apply the resolved style object (built-in or named/custom)
  // whenever the selector, custom map, or host styles change. Re-applies the
  // candle style too so its bar colors track the new theme.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setStyles(mergeStyles(themeStyleObj, styles));
    applyCandleStyle(chart, candleStyleRef.current, themeStyleObj, baseTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, styles, customThemes]);

  // Candle style (#1): a pure setStyles for non-HA swaps (no rebuild). HA
  // transitions are handled by the create effect's haKey dependency.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) applyCandleStyle(chart, candleStyle, themeStyleObj, baseTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candleStyle, theme]);

  // Formatter overrides (#46): re-apply when the host changes them at runtime.
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) applyFormatter(chart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFormat, priceFormatter]);

  // Compare / multi-symbol overlays (#9).
  useEffect(() => {
    void refreshCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((compareSeries ?? []).map((c) => [c.symbol, c.color]))]);

  // Pane heights reconcile (#7).
  useEffect(() => {
    applyPaneHeights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneHeights]);

  // Session tint reconcile (#10).
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

  // Watermark reconcile: create/update/remove, and refresh its ticker+interval
  // text the instant the symbol, interval, or theme changes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const present = chart.getIndicators({ name: WATERMARK_INDICATOR }).length > 0;
    const active = watermark.symbol || watermark.interval;
    const ext = buildWatermark(symbol, interval, watermark);
    if (active && !present) {
      chart.createIndicator({ name: WATERMARK_INDICATOR, paneId: CANDLE_PANE, extendData: ext }, false);
    } else if (active && present) {
      chart.overrideIndicator({ name: WATERMARK_INDICATOR, extendData: ext });
    } else if (!active && present) {
      chart.removeIndicator({ name: WATERMARK_INDICATOR });
    }
  }, [watermark, symbol, interval, theme]);

  // Pattern markers reconcile (#5).
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

  // Price-line + order-line overlays. Runs every render (the arrays are usually
  // fresh references), but a signature guard skips the costly rebuild unless the
  // visual content actually changed.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Refresh the latest onMove handlers regardless of whether we rebuild.
    orderMoveRef.current.clear();
    for (const ol of orderLines ?? []) orderMoveRef.current.set(ol.id, ol.onMove);

    const sig = JSON.stringify([
      (priceLines ?? []).map((p) => [p.price, p.color, p.label, p.style]),
      (orderLines ?? []).map((o) => [o.id, o.price, o.color, o.label, o.style, o.draggable]),
    ]);
    if (sig === linesSigRef.current) return; // content unchanged — keep overlays
    linesSigRef.current = sig;

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

    const priceOf = (o: { overlay?: { points?: Array<{ value?: number }> } }): number | null => {
      const v = o?.overlay?.points?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    for (const ol of orderLines ?? []) {
      const draggable = ol.draggable !== false;
      const id = ol.id;
      const created = chart.createOverlay({
        name: "priceLine",
        points: [{ value: ol.price }],
        lock: !draggable,
        styles: { line: { color: ol.color ?? "#e0a33c", style: ol.style === "dashed" ? "dashed" : "solid" } },
        extendData: ol.label,
        onPressedMoving: (e) => {
          const p = priceOf(e);
          if (p != null) orderMoveRef.current.get(id)?.(p, "moving");
          return false;
        },
        onPressedMoveEnd: (e) => {
          const p = priceOf(e);
          if (p != null) orderMoveRef.current.get(id)?.(p, "end");
          return false;
        },
      });
      if (typeof created === "string") overlayIds.current.push(created);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceLines, orderLines]);

  return <div ref={elRef} className={className} style={{ width: "100%", height: "100%", ...style }} />;
});
