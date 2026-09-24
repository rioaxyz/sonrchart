import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dispose, init, utils, type Chart, type Coordinate, type DeepPartial, type KLineData, type Layout, type Nullable, type Options, type Point, type Styles } from "klinecharts";
import { resolveThemeStyles, PALETTE } from "./theme";
import { PATTERN_INDICATOR, SERIES_INDICATOR, SESSION_INDICATOR, WATERMARK_INDICATOR, registerSonrIndicators } from "./indicators";
import { HaTransformer, isHeikinAshi, toHeikinAshi } from "./candles";
import { applyCandleStyle } from "./candleStyle";
import { COMPARE_INDICATOR, alignCompare, registerCompareIndicator, type CompareLine } from "./compare";
import { CANDLE_PANE, asSpec, mergeStyles, sessionColors, toKLine, toPeriod } from "./internal";
import { bareTicker, buildWatermark, intervalLabel, mergeWatermark, normalizeWatermark } from "./watermark";
import { registerBrushOverlay, type BrushStyle, type BrushTool } from "./brush";
import { useDrawings } from "./useDrawings";
import { isEditableTarget, resolveShortcut, type ShortcutAction } from "./keyboard";
import { registerShapeOverlays } from "./shapes";
import { registerTextOverlay, type TextStyle } from "./textOverlay";
import type {
  CandleStyle,
  ChartState,
  CompareSpec,
  DataSource,
  DrawingRow,
  DrawingTool,
  IndicatorRow,
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
registerShapeOverlays();
registerTextOverlay();

// Library-managed indicators the user never sees as "their" studies — excluded
// from listIndicators / the data window / export / study templates.
const INTERNAL_INDICATORS = new Set<string>([SESSION_INDICATOR, PATTERN_INDICATOR, COMPARE_INDICATOR, WATERMARK_INDICATOR, SERIES_INDICATOR]);
const isUserIndicator = (name: string): boolean => !INTERNAL_INDICATORS.has(name);

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
  /** Enable built-in keyboard shortcuts when the chart is focused. (#14)
   *  Default true. See `onShortcut` to observe/extend them. */
  keyboard?: boolean;
  /** Called for every recognized shortcut ("escape" | "undo" | "redo" |
   *  "delete") while the chart is focused, even when the built-in also runs —
   *  a host can observe or extend the behavior. (#14) */
  onShortcut?: (action: string, e: KeyboardEvent) => void;
  /** Override the crosshair price pill / big-number formatting. (#46) */
  priceFormatter?: (value: number) => string;
  /** Override the crosshair date template, e.g. "YYYY-MM-DD HH:mm". (#46) */
  dateFormat?: string;
  /** Data-source label shown in the candle legend header (e.g. "Alpaca"),
   *  after `symbol · interval`, TradingView-style. */
  source?: string;
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
  /** Default color/size applied to new text labels. */
  getTextStyle(): TextStyle;
  setTextStyle(style: TextStyle): void;
  subscribeTextStyle(cb: () => void): () => void;
  // Drawing management tooling (#35) ---------------------------------------
  /** Lock every user drawing (non-interactive) or unlock them. New drawings
   *  inherit the current lock state. */
  setDrawingsLocked(locked: boolean): void;
  /** Whether user drawings are currently locked. */
  getDrawingsLocked(): boolean;
  /** Show/hide every user drawing at once. New drawings inherit visibility. */
  setDrawingsVisible(visible: boolean): void;
  /** Whether user drawings are currently visible. */
  getDrawingsVisible(): boolean;
  /** Subscribe to hide/show-all changes (#35). Returns unsubscribe. */
  subscribeDrawingsVisible(cb: (visible: boolean) => void): () => void;
  /** Save the current user drawings as a named template (in-memory). */
  saveDrawingTemplate(name: string): void;
  /** Replace the current user drawings with a saved template's set. */
  applyDrawingTemplate(name: string): void;
  /** Names of all saved drawing templates. */
  listDrawingTemplates(): string[];
  /** Delete a saved drawing template. */
  deleteDrawingTemplate(name: string): void;
  /** Subscribe to drawing-template list changes. Returns unsubscribe. */
  subscribeDrawingTemplates(cb: () => void): () => void;
  /** Duplicate the most-recently-added user drawing (same points/style). */
  cloneLastDrawing(): void;
  // Data window — per-indicator rows (#45) ----------------------------------
  /** Active user indicators as data-window rows (excludes internal overlays). */
  listIndicatorRows(): IndicatorRow[];
  /** Show/hide one indicator by name. */
  setIndicatorVisible(name: string, visible: boolean): void;
  /** Subscribe to indicator add/remove/visibility changes. Returns unsubscribe. */
  subscribeIndicators(cb: () => void): () => void;
  // Object tree — per-drawing rows (#45) ------------------------------------
  /** Every user drawing as object-tree rows (id/label/visible/locked). */
  listDrawings(): DrawingRow[];
  /** Show/hide one drawing by id. */
  setDrawingVisible(id: string, visible: boolean): void;
  /** Lock/unlock one drawing by id. */
  setDrawingLocked(id: string, locked: boolean): void;
  /** Remove one drawing by id. */
  removeDrawing(id: string): void;
  /** Scroll the chart so the drawing with this id is in view (#45). */
  locateDrawing(id: string): void;
  // Range bar — visible-window control (#45) --------------------------------
  /** Zoom the visible window to the most recent `ms` of loaded data at the
   *  current resolution (clamped to what's loaded). `Infinity` fits all data. */
  setVisibleDuration(ms: number): void;
  // Navigation (#45) --------------------------------------------------------
  /** Scroll the visible window to the bar at (or nearest before) this epoch-ms. */
  scrollToTimestamp(timestamp: number): void;
  /** Jump the visible window to the latest (realtime) bar. */
  scrollToRealTime(): void;
  /** Zoom the visible range in one step (toward more detail). */
  zoomIn(): void;
  /** Zoom the visible range out one step (toward more history). */
  zoomOut(): void;
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

// The candle pane's y-axis config for a price scale. KLineChart fixes the scale
// TYPE (normal/percentage/logarithm) and inversion at pane creation, so this is
// applied at chart init — the component rebuilds when `priceScale` changes.
function yAxisLayout(ps?: PriceScale): DeepPartial<Layout> | undefined {
  if (!ps) return undefined;
  // `name` selects the scale type at init but is omitted from KLineChart's
  // Layout.yAxis type, so the narrow cast is confined here.
  return {
    yAxis: {
      ...(ps.type ? { name: ps.type } : {}),
      reverse: ps.invert ?? false,
      inside: ps.inside ?? false,
    },
  } as DeepPartial<Layout>;
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
    keyboard = true,
    onShortcut,
    priceFormatter,
    dateFormat,
    source,
    onReady,
    onSymbolError,
    className,
    style,
  },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // Captured imperative handle + latest onShortcut, so the (stable) keyboard
  // listener can drive the same operations the host uses. (#14)
  const handleRef = useRef<SonrChartHandle | null>(null);
  const onShortcutRef = useRef(onShortcut);
  onShortcutRef.current = onShortcut;
  const idRef = useRef(`sonrchart-${++_seq}`);
  const overlayIds = useRef<string[]>([]);
  // Data-window subscribers (indicator add/remove/visibility). Notified from the
  // handle's indicator mutations so the panel refreshes without polling. (#45)
  const indicatorSubs = useRef(new Set<() => void>());
  const notifyIndicators = () => indicatorSubs.current.forEach((cb) => cb());
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
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // Heikin Ashi live transformer (rebuilt per data load in the create effect).
  const haRef = useRef(new HaTransformer());

  // Text tool: an inline input floats over the just-placed text overlay so the
  // user can type the label. Positioned in page (fixed) coords from the anchor.
  const [textEdit, setTextEdit] = useState<{ id: string; left: number; top: number; value: string } | null>(null);
  // Stable: the once-built drawings API captures this, so it reads live refs only.
  const onTextPlaced = useCallback((id: string, point: Partial<Point>) => {
    const chart = chartRef.current;
    const el = elRef.current;
    if (!chart || !el) return;
    // Chart-relative pixel of the anchor + the container's page offset → the
    // fixed-position input lands right on the placed label, not at the page top.
    const px = chart.convertToPixel(point, { paneId: CANDLE_PANE }) as Partial<Coordinate>;
    const rect = el.getBoundingClientRect();
    setTextEdit({ id, left: rect.left + (px?.x ?? rect.width / 2), top: rect.top + (px?.y ?? rect.height / 2), value: "" });
  }, []);

  // User-drawing subsystem (#3/#16/#35): armed tool, undo/redo history, lock/hide
  // flags, named templates, and brush styles. Owns its own refs; reads the live
  // magnet mode via the getter and touches only the shared chart ref.
  const drawings = useDrawings(chartRef, () => magnetMode(magnetRef.current), baseTheme, onTextPlaced);

  // Commit the typed label into the overlay's extendData (empty → discard the
  // anchor), or cancel (discard). Both close the inline input.
  const commitText = useCallback(() => {
    setTextEdit((cur) => {
      if (!cur) return null;
      const chart = chartRef.current;
      const text = cur.value.trim();
      if (chart) {
        if (text) {
          // Preserve the label's seeded style (color/size) — only swap the text.
          const prev = (chart.getOverlays({ id: cur.id })[0]?.extendData ?? {}) as Record<string, unknown>;
          chart.overrideOverlay({ id: cur.id, extendData: { ...prev, text } });
          drawings.recordHistory();
        } else {
          chart.removeOverlay({ id: cur.id }); // onRemoved records the discard
        }
      }
      return null;
    });
  }, [drawings]);
  const cancelText = useCallback(() => {
    setTextEdit((cur) => {
      if (cur) chartRef.current?.removeOverlay({ id: cur.id });
      return null;
    });
  }, []);

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
    (): SonrChartHandle => (handleRef.current = {
      chart: () => chartRef.current,
      addIndicator: (i) => {
        createIndicator(asSpec(i));
        notifyIndicators();
      },
      removeIndicator: (name) => {
        chartRef.current?.removeIndicator({ name });
        notifyIndicators();
      },
      listIndicators: () =>
        (chartRef.current?.getIndicators() ?? []).map((ind) => ind.name).filter(isUserIndicator),
      startDrawing: (tool: DrawingTool) => drawings.beginDrawing(tool),
      cancelDrawing: () => drawings.cancelDrawing(),
      activeDrawing: () => drawings.activeDrawing(),
      subscribeDrawing: (cb) => drawings.subscribeDrawing(cb),
      clearDrawings: () => drawings.clearDrawings(),
      snapshot: (opts) => {
        const chart = chartRef.current;
        if (!chart) return null;
        return chart.getConvertPictureUrl(opts?.includeOverlays ?? true, opts?.type ?? "png", opts?.background);
      },
      exportState: (): ChartState => {
        const chart = chartRef.current;
        const inds = (chart?.getIndicators() ?? [])
          .filter((i) => isUserIndicator(i.name))
          .map((i) => ({ name: i.name, paneId: i.paneId }));
        return { version: 1, drawings: drawings.snapshotDrawings(), indicators: inds, priceScale };
      },
      importState: (state: ChartState) => {
        const chart = chartRef.current;
        if (!chart || state?.version !== 1) return;
        drawings.restoreDrawings(state.drawings ?? []);
        for (const ind of state.indicators ?? []) {
          if (!chart.getIndicators({ name: ind.name }).length) {
            chart.createIndicator({ name: ind.name, ...(ind.paneId === CANDLE_PANE ? { paneId: CANDLE_PANE } : {}) }, false);
          }
        }
        // Reset the undo history to the imported drawing set.
        drawings.resetHistoryToCurrent();
        // priceScale in the state is informational; the host re-applies it via
        // the `priceScale` prop (scale type is fixed at chart init).
      },
      getIndicatorSet: (): IndicatorSpec[] =>
        (chartRef.current?.getIndicators() ?? [])
          .filter((i) => isUserIndicator(i.name))
          .map((i) => ({ name: i.name, pane: i.paneId === CANDLE_PANE ? "main" : "new" })),
      applyIndicatorSet: (specs) => {
        const chart = chartRef.current;
        if (!chart) return;
        for (const i of chart.getIndicators()) {
          if (isUserIndicator(i.name)) chart.removeIndicator({ name: i.name });
        }
        for (const s of specs) createIndicator(asSpec(s));
        applyPaneHeights();
        notifyIndicators();
      },
      undo: () => drawings.undo(),
      redo: () => drawings.redo(),
      canUndo: () => drawings.canUndo(),
      canRedo: () => drawings.canRedo(),
      subscribeHistory: (cb) => drawings.subscribeHistory(cb),
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
      getBrushStyle: (tool) => drawings.getBrushStyle(tool),
      setBrushStyle: (tool, style) => drawings.setBrushStyle(tool, style),
      subscribeBrush: (cb) => drawings.subscribeBrush(cb),
      getTextStyle: () => drawings.getTextStyle(),
      setTextStyle: (style) => drawings.setTextStyle(style),
      subscribeTextStyle: (cb) => drawings.subscribeTextStyle(cb),
      // Drawing management tooling (#35) -----------------------------------
      setDrawingsLocked: (locked) => drawings.setDrawingsLocked(locked),
      getDrawingsLocked: () => drawings.getDrawingsLocked(),
      setDrawingsVisible: (visible) => drawings.setDrawingsVisible(visible),
      getDrawingsVisible: () => drawings.getDrawingsVisible(),
      subscribeDrawingsVisible: (cb) => drawings.subscribeDrawingsVisible(cb),
      saveDrawingTemplate: (name) => drawings.saveDrawingTemplate(name),
      applyDrawingTemplate: (name) => drawings.applyDrawingTemplate(name),
      listDrawingTemplates: () => drawings.listDrawingTemplates(),
      deleteDrawingTemplate: (name) => drawings.deleteDrawingTemplate(name),
      subscribeDrawingTemplates: (cb) => drawings.subscribeDrawingTemplates(cb),
      cloneLastDrawing: () => drawings.cloneLastDrawing(),
      // Data window — per-indicator rows (#45) ------------------------------
      listIndicatorRows: (): IndicatorRow[] =>
        (chartRef.current?.getIndicators() ?? [])
          .filter((i) => isUserIndicator(i.name))
          .map((i) => ({ name: i.name, visible: i.visible })),
      setIndicatorVisible: (name, visible) => {
        chartRef.current?.overrideIndicator({ name, visible });
        notifyIndicators();
      },
      subscribeIndicators: (cb) => {
        indicatorSubs.current.add(cb);
        return () => indicatorSubs.current.delete(cb);
      },
      // Object tree — per-drawing rows (#45) --------------------------------
      listDrawings: () => drawings.listDrawings(),
      setDrawingVisible: (id, visible) => drawings.setDrawingVisible(id, visible),
      setDrawingLocked: (id, locked) => drawings.setDrawingLocked(id, locked),
      removeDrawing: (id) => drawings.removeDrawing(id),
      locateDrawing: (id) => drawings.locateDrawing(id),
      // Range bar — zoom the window to the last `ms` of data (#45) -----------
      setVisibleDuration: (ms) => {
        const chart = chartRef.current;
        if (!chart) return;
        const data = chart.getDataList();
        if (data.length < 2) return;
        const startTs = data[data.length - 1].timestamp - ms;
        // First loaded bar at/after the window start (data is small; scan once).
        let idx = 0;
        for (let i = 0; i < data.length; i++) {
          if (data[i].timestamp >= startTs) {
            idx = i;
            break;
          }
        }
        const targetBars = Math.max(2, data.length - idx);
        // Use the actual plot width (excludes the y-axis, independent of the
        // current zoom) so bar space is computed the same way every time — a
        // range set from any prior zoom lands on the identical window, and
        // re-picking a narrower range zooms back in instead of sticking.
        const plotWidth = chart.getSize(CANDLE_PANE, "main")?.width ?? 0;
        if (plotWidth <= 0) return;
        chart.setBarSpace(plotWidth / targetBars);
        chart.scrollToRealTime();
      },
      // Navigation (#45) ----------------------------------------------------
      scrollToTimestamp: (ts) => chartRef.current?.scrollToTimestamp(ts),
      scrollToRealTime: () => chartRef.current?.scrollToRealTime(),
      zoomIn: () => chartRef.current?.zoomAtCoordinate(1.5),
      zoomOut: () => chartRef.current?.zoomAtCoordinate(0.6667),
    }),
    // paneHeights/priceScale captured by closure; recreated per render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Keyboard shortcuts (#14). The listener lives on the chart container, so it
  // only fires while focus is within the chart — global typing (symbol search,
  // settings) is never hijacked. Every recognized shortcut notifies the host
  // via `onShortcut`; the built-in runs too (delete is gated on no armed tool).
  useEffect(() => {
    const el = elRef.current;
    if (!el || !keyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return; // never hijack an input/typing
      const action: ShortcutAction | null = resolveShortcut(e);
      if (!action) return;
      // Let the host observe/extend first, even when a built-in also handles it.
      onShortcutRef.current?.(action, e);
      const api = handleRef.current;
      if (!api) return;
      if (action === "escape") {
        api.cancelDrawing();
      } else if (action === "undo") {
        api.undo();
        e.preventDefault();
      } else if (action === "redo") {
        api.redo();
        e.preventDefault();
      } else if (action === "delete") {
        // Clear only when no tool is armed — Escape cancels an armed draw, so
        // Delete/Backspace here removes the finished user drawings.
        if (!api.activeDrawing()) {
          api.clearDrawings();
          e.preventDefault();
        }
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [keyboard]);

  // Create the chart, wire the data loader, resolve + load the symbol.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.id = idRef.current;

    const options: Options = {
      timezone: "America/New_York",
      // Widen KLineChart's default bar-space limits (min 1 / max 50). The 50-px
      // cap silently no-ops setBarSpace, so a short lookback (e.g. "1D" with few
      // bars over a wide plot) could never zoom in far enough to apply.
      layout: { ...(yAxisLayout(priceScale) ?? {}), barSpaceLimit: { min: 0.3, max: 1000 } },
    };
    const chart = init(el, options);
    if (!chart) return;
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
            // Single-line TradingView-style header: `TICKER · interval · source`
            // then O/H/L/C colored by the bar direction, the change vs the prior
            // bar's close (value + %), and volume.
            template: (data: { current: Nullable<KLineData>; prev: Nullable<KLineData> }): { title: Tip; value: Tip }[] => {
              const k = data.current;
              if (!k) return [];
              const pal = themeRef.current === "dark" ? PALETTE.DARK : PALETTE.LIGHT;
              const label = pal.muted;
              const dir = (k.close ?? 0) >= (k.open ?? 0) ? PALETTE.GREEN : PALETTE.RED;
              const price = (v?: number) =>
                priceFormatterRef.current
                  ? priceFormatterRef.current(v ?? 0)
                  : utils.formatThousands(utils.formatPrecision(v ?? 0, pricePrecRef.current), ",");
              const head = `${bareTicker(symbol).toUpperCase()} · ${intervalLabel(interval)}${sourceRef.current ? ` · ${sourceRef.current}` : ""}`;
              const rows: { title: Tip; value: Tip }[] = [
                { title: { text: head, color: pal.text }, value: { text: "", color: pal.text } },
                { title: { text: "O", color: label }, value: { text: price(k.open), color: dir } },
                { title: { text: "H", color: label }, value: { text: price(k.high), color: dir } },
                { title: { text: "L", color: label }, value: { text: price(k.low), color: dir } },
                { title: { text: "C", color: label }, value: { text: price(k.close), color: dir } },
              ];
              // Change vs the previous bar's close (skipped on the first bar).
              const pc = data.prev?.close;
              if (typeof pc === "number" && pc !== 0 && typeof k.close === "number") {
                const chg = k.close - pc;
                const up = chg >= 0;
                const s = up ? "+" : "−";
                const chgTxt = `${s}${price(Math.abs(chg))} (${s}${(Math.abs(chg / pc) * 100).toFixed(2)}%)`;
                rows.push({ title: { text: "", color: label }, value: { text: chgTxt, color: up ? PALETTE.GREEN : PALETTE.RED } });
              }
              rows.push({ title: { text: "V", color: label }, value: { text: utils.formatBigNumber(k.volume ?? 0), color: label } });
              return rows;
            },
          },
        },
      },
    } as DeepPartial<Styles>);
    // Fresh Heikin Ashi transformer + fresh undo history for this chart.
    haRef.current = new HaTransformer();
    drawings.initHistory();

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

  return (
    <>
      <div
        ref={elRef}
        tabIndex={0}
        role="application"
        aria-label="Sonr chart"
        className={className}
        style={{ width: "100%", height: "100%", ...style }}
      />
      {textEdit &&
        typeof document !== "undefined" &&
        createPortal(
          <input
            className="sonr-text-input"
            aria-label="Chart text label"
            autoFocus
            value={textEdit.value}
            placeholder="Text"
            style={{ position: "fixed", left: textEdit.left, top: textEdit.top, zIndex: 2147483002 }}
            onChange={(e) => setTextEdit((c) => (c ? { ...c, value: e.target.value } : c))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitText();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelText();
              }
            }}
            onBlur={commitText}
          />,
          document.body,
        )}
    </>
  );
});
