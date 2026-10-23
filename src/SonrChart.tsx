import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dispose, init, utils, type Chart, type Coordinate, type DeepPartial, type KLineData, type Layout, type Nullable, type Options, type Point, type Styles } from "klinecharts";
import { resolveThemeStyles, PALETTE } from "./theme";
import { HALT_INDICATOR, PATTERN_INDICATOR, SERIES_INDICATOR, SESSION_INDICATOR, WATERMARK_INDICATOR, Z_ORDER, normalizeHalt, registerSonrIndicators } from "./indicators";
import { HaTransformer, isHeikinAshi, toHeikinAshi } from "./candles";
import { applyCandleStyle } from "./candleStyle";
import { COMPARE_INDICATOR, alignCompare, registerCompareIndicator, type CompareLine } from "./compare";
import { CANDLE_PANE, asSpec, intervalMs, mergeStyles, sessionColors, toIndicatorSpecs, toKLine, toPeriod } from "./internal";
import { loadPersistedIndicators, savePersistedIndicators } from "./indicatorPersistence";
import { loadPersistedDisplay, savePersistedDisplay } from "./displayPersistence";
import { PAGE_RETRY_COOLDOWN_MS, sanitizeOlderBars } from "./scrollback";
import { DrawingStore, drawingStoreFor } from "./drawingPersistence";
import { DEFAULT_TIMEZONE } from "./timezone";
import { bareTicker, buildWatermark, intervalLabel, mergeWatermark, normalizeWatermark } from "./watermark";
import { registerBrushOverlay, type BrushStyle, type BrushTool } from "./brush";
import { useDrawings } from "./useDrawings";
import { isEditableTarget, resolveShortcut, type ShortcutAction } from "./keyboard";
import { registerShapeOverlays } from "./shapes";
import { registerExtendedDrawings } from "./drawingsExtended";
import { registerTradeReview } from "./tradeReview";
import { registerTextOverlay, type TextStyle } from "./textOverlay";
import type { DrawingStyle } from "./drawingStyle";
import { formatWithUnit, type QuoteFormat } from "./symbolFormat";
import { volumeTrend, DEFAULT_VOLUME_TREND_BARS, type VolumeTrend } from "./volumeTrend";
import type {
  CandleStyle,
  ChartState,
  CompareSpec,
  DataSource,
  DrawingRow,
  DrawingTool,
  HaltBadge,
  IndicatorRow,
  IndicatorSpec,
  Interval,
  Magnet,
  OrderLine,
  PatternMarker,
  PriceLine,
  PriceLabels,
  PriceScale,
  SessionTint,
  SymbolInfo,
  Theme,
  WatermarkOptions,
} from "./types";

registerSonrIndicators();
registerCompareIndicator();
registerBrushOverlay();
registerShapeOverlays();
registerExtendedDrawings();
registerTradeReview();
registerTextOverlay();

// Library-managed indicators the user never sees as "their" studies — excluded
// from listIndicators / the data window / export / study templates.
const INTERNAL_INDICATORS = new Set<string>([SESSION_INDICATOR, PATTERN_INDICATOR, COMPARE_INDICATOR, WATERMARK_INDICATOR, SERIES_INDICATOR, HALT_INDICATOR]);
const isUserIndicator = (name: string): boolean => !INTERNAL_INDICATORS.has(name);

// KLineChart's default candle.tooltip.offsetTop — restored when no legend
// offset is in effect (#88).
const DEFAULT_LEGEND_OFFSET = 6;

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
  /** Indicators to show on first load. Strings ("VOL") or specs. Default
   *  none — the chart opens with no studies. (#4) */
  indicators?: (string | IndicatorSpec)[];
  /** Carry the user's indicator set (#94), per-symbol drawings (#97), and
   *  display settings — candle type, session tint, price-scale labels —
   *  across UNMOUNTS of this component. All already persist across
   *  symbol/interval/scale switches while the chart stays mounted; set a key
   *  (stable per chart tile, e.g. "main") if your app remounts the chart
   *  when the symbol changes — via key={symbol} or a loading state that
   *  swaps it out — so they survive that too. The `indicators`,
   *  `candleStyle`, `sessions`, and `priceLabels` props then only seed the
   *  very first mount (a later CHANGE to one still applies);
   *  `clearPersistedIndicators(key)` / `clearPersistedDrawings(key)` /
   *  `clearPersistedDisplay(key)` reset. */
  persistenceKey?: string;
  /** Per-indicator sub-pane heights in px, keyed by indicator name. (#7) */
  paneHeights?: Record<string, number>;
  /** Session background tinting for pre/after-hours. (#10) */
  sessions?: SessionTint;
  /** Underlaid symbol + interval watermark behind the candles. `true` shows both;
   *  pass options to toggle each and set color/opacity. */
  watermark?: boolean | Partial<WatermarkOptions>;
  /** Pattern-context markers on the price pane. (#5) */
  patterns?: PatternMarker[];
  /** Trading-halt badge (#78): `true` pins a blue "Halt" pill to the top of
   *  the price pane against the y-axis; pass a HaltBadge to customize. Omit
   *  to follow the data source's `subscribeHalt`, when it has one. */
  halted?: boolean | HaltBadge;
  /** Static reference lines (entry / stop / target). */
  priceLines?: PriceLine[];
  /** Draggable order/position lines. (#19) */
  orderLines?: OrderLine[];
  /** Price-scale mode (log / percentage / invert / inside). (#12) */
  priceScale?: PriceScale;
  /** Price-scale labels (last value/line, high/low marks). (#41) */
  priceLabels?: Partial<PriceLabels>;
  /** Magnet mode for drawing tools — snap points to nearby OHLC. (#13) */
  magnet?: Magnet;
  /** Keep a drawing tool armed after each placement (#102), so several rays /
   *  lines / shapes go down in a row; the tool stays active until clicked off
   *  in the toolbar or Escape. Default true. `false` restores one-shot tools
   *  (brush/highlighter stay sticky regardless). */
  stickyDrawings?: boolean;
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
  /** IANA timezone for the x-axis + crosshair time (#38). Default
   *  "America/New_York". Also settable via the handle / <TimezoneMenu>. */
  timezone?: string;
  /** Data-source label shown in the candle legend header (e.g. "Alpaca"),
   *  after `symbol · interval`, TradingView-style. */
  source?: string;
  /** Show the built-in canvas candle legend (O/H/L/C/…). Default true. Set false
   *  when rendering your own header via <ChartHeader> + `subscribeHeaderBar`. */
  legend?: boolean;
  /** Pixels from the price pane's top where the on-canvas legend stack (candle
   *  legend + main-pane indicator rows) starts, so it clears HTML overlaid on
   *  the chart (#88). Sub-pane legends are unaffected. Omit for the default
   *  (6) — a mounted <ChartHeader> then drives it automatically, keeping the
   *  rows below its own height; when set, this prop wins over that. */
  legendOffset?: number;
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
  /** Current IANA timezone for the x-axis + crosshair time (#38). */
  getTimezone(): string;
  /** Set the timezone imperatively (a changed `timezone` prop still wins). (#38) */
  setTimezone(tz: string): void;
  subscribeTimezone(cb: (tz: string) => void): () => void;
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
  /** Current price-scale label toggles (#41). */
  getPriceLabels(): Required<PriceLabels>;
  /** Toggle price-scale labels (merges over the current set). */
  setPriceLabels(opts: Partial<PriceLabels>): void;
  subscribePriceLabels(cb: () => void): () => void;
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
  /** The pen (color / solid-dashed / width) new drawings of `tool` use (#103)
   *  — its override, else the all-tools default, else null (theme default).
   *  Omit `tool` for the all-tools default itself. */
  getDrawingStyle(tool?: DrawingTool): DrawingStyle | null;
  /** Set the pen for new drawings of `tool` (omit for all tools); null clears
   *  back to the theme default. Existing drawings keep their style. */
  setDrawingStyle(style: DrawingStyle | null, tool?: DrawingTool): void;
  /** Subscribe to drawing-style changes (for a settings UI). Returns unsub. */
  subscribeDrawingStyle(cb: () => void): () => void;
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
  // Drawing z-order + copy/paste (#35) --------------------------------------
  /** Change a drawing's stacking order: front/back (extreme) or forward/
   *  backward (one step). */
  setDrawingZOrder(id: string, mode: "front" | "back" | "forward" | "backward"): void;
  /** Copy a drawing to the clipboard. */
  copyDrawing(id: string): void;
  /** Paste the copied drawing as a new drawing. */
  pasteDrawing(): void;
  /** Whether a copied drawing is available to paste. */
  canPasteDrawing(): boolean;
  /** Id of the drawing selected on the chart (clicked), or null. */
  getSelectedDrawing(): string | null;
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
  /** Subscribe to the bar a custom header should show — the hovered bar while
   *  the crosshair is active, else the latest bar (updates on each streamed
   *  bar). Emits once immediately. Returns unsubscribe. (#45) */
  subscribeHeaderBar(cb: (current: KLineData | null, prev: KLineData | null) => void): () => void;
  /** Subscribe to the volume trend over the bars ending at the header bar
   *  (hovered bar while the crosshair is active, else the latest bar):
   *  "increasing" | "decreasing" | "mixed", or null until enough bars are
   *  loaded. Omit `bars` to track the chart-level lookback (re-emits when the
   *  setting changes); pass a number to pin this subscription's own count.
   *  Emits once immediately. Returns unsubscribe. (#79) */
  subscribeVolumeTrend(cb: (trend: VolumeTrend | null) => void, bars?: number): () => void;
  /** Chart-level volume-trend lookback (#79): the bar count used by
   *  subscriptions that don't pin their own. Clamped to ≥ 1; setting it
   *  re-emits the trend to those subscribers. */
  getVolumeTrendBars(): number;
  setVolumeTrendBars(bars: number): void;
  subscribeVolumeTrendBars(cb: (bars: number) => void): () => void;
  /** Whether the volume-trend header row is on (#79). Chart-level state so
   *  any control (the indicators menu, a host button) can toggle it and a
   *  mounted <ChartHeader> shows/hides its row live. Default off; the
   *  header's `volumeTrend` prop seeds it on. */
  getVolumeTrendEnabled(): boolean;
  setVolumeTrendEnabled(on: boolean): void;
  subscribeVolumeTrendEnabled(cb: (on: boolean) => void): () => void;
  /** Start the price-pane legend stack (candle legend + main-pane indicator
   *  rows) `px` from the pane top, or pass null to restore the default (#88).
   *  <ChartHeader> drives this automatically so canvas legends start below
   *  it; a set `legendOffset` prop wins over this. */
  setLegendOffset(px: number | null): void;
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
// Props compared by value, so an inline object/array (`sessions={{ … }}`) —
// a new identity on every host render — isn't mistaken for a change and
// re-adopted over the user's own setting on each re-render (symbol switch…).
function samePropValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// `persisted` (from the persistenceKey registry) outranks the prop as the
// initial value: the prop seeds only the first mount, like `indicators`.
function useControllable<T>(prop: T | undefined, fallback: T, persisted?: T) {
  const [value, setValue] = useState<T>(persisted !== undefined ? persisted : prop === undefined ? fallback : prop);
  const propRef = useRef(prop);
  if (!samePropValue(prop, propRef.current)) {
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

// Price-scale labels (#41). Marks on by default (matches KLineChart); the
// bar-close countdown is opt-in.
const DEFAULT_PRICE_LABELS: Required<PriceLabels> = { lastValue: true, lastLine: true, high: true, low: true, countdown: false };

// Apply the price-scale label toggles to the candle price marks. The countdown
// is an extend-text under the last-price pill, refreshed every second; its text
// comes from the formatExtendText formatter (see applyFormatter). Booleans only
// — no data recompute. The extend-text style must be COMPLETE: KLineChart reads
// paddingLeft/size/weight/family etc. directly, and any `undefined` yields a NaN
// text width that blanks the whole candle pane.
function applyPriceLabels(chart: Chart, labels: Required<PriceLabels>): void {
  chart.setStyles({
    candle: {
      priceMark: {
        show: labels.lastValue || labels.lastLine || labels.high || labels.low || labels.countdown,
        last: {
          show: labels.lastValue || labels.countdown,
          line: { show: labels.lastLine },
          // Match the last-price pill's own text style (white, size 12, same
          // padding) so the countdown reads as a matching label centered under
          // it — it inherits the pill's colored background + right-axis
          // alignment, so a matching style keeps them stacked and legible.
          extendTexts: labels.countdown
            ? [
                {
                  show: true,
                  style: "fill",
                  color: "#FFFFFF",
                  size: 12,
                  family: "Helvetica Neue",
                  weight: "normal",
                  paddingLeft: 4,
                  paddingRight: 4,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderColor: "transparent",
                  borderSize: 0,
                  borderStyle: "solid",
                  borderDashedValue: [2, 2],
                  borderRadius: 2,
                  position: "below_price",
                  updateInterval: 1000,
                },
              ]
            : [],
        },
        high: { show: labels.high },
        low: { show: labels.low },
      },
    },
  } as DeepPartial<Styles>);
}

// mm:ss (or h:mm:ss) remaining until a bar that opened at `openMs` closes, given
// the bar length. Clamps to 0 (e.g. a stale last bar after hours).
function formatCountdown(openMs: number, barMs: number): string {
  const remaining = Math.max(0, openMs + barMs - Date.now());
  const s = Math.floor(remaining / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
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
    indicators = [],
    paneHeights,
    sessions: sessionsProp,
    watermark: watermarkProp,
    patterns,
    halted,
    persistenceKey,
    priceLines,
    orderLines,
    priceScale: priceScaleProp,
    priceLabels: priceLabelsProp,
    magnet,
    stickyDrawings = true,
    candleStyle: candleStyleProp,
    compareSeries,
    barCount = 500,
    keyboard = true,
    onShortcut,
    priceFormatter,
    dateFormat,
    timezone: timezoneProp,
    source,
    legend = true,
    legendOffset,
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
  // Bumped on every chart (re)init (e.g. an interval switch re-creates the
  // chart). Reconcile effects key on it so the session tint / pattern markers
  // are re-applied on the fresh chart — otherwise they'd vanish on the switch
  // while their toggle stays on (their reconciles don't otherwise re-run). (#10)
  const [chartEpoch, setChartEpoch] = useState(0);
  // The user's live study set, snapshotted at each chart teardown so a re-init
  // (symbol/interval/scale/HA switch) restores it instead of reseeding from
  // the `indicators` prop (#86). null until the first teardown. With a
  // persistenceKey, the snapshot is mirrored to the module-level registry so
  // it also survives a full unmount/remount of this component (#94).
  const persistedIndicatorsRef = useRef<IndicatorSpec[] | null>(null);
  const persistenceKeyRef = useRef(persistenceKey);
  persistenceKeyRef.current = persistenceKey;
  // Per-symbol drawing sets (#97): each chart instance owns a store; with a
  // persistenceKey the store is module-level and survives remounts too. Read
  // through a ref so the create effect's teardown always sees the current one.
  const drawingStore = useMemo(() => (persistenceKey ? drawingStoreFor(persistenceKey) : new DrawingStore()), [persistenceKey]);
  const drawingStoreRef = useRef(drawingStore);
  drawingStoreRef.current = drawingStore;
  // Mirror the current user study set to the keyed registry (#94). Called on
  // every set change and at teardown; a no-op without a key.
  const saveIndicatorSet = (chart: Chart | null) => {
    const key = persistenceKeyRef.current;
    if (!key || !chart) return;
    savePersistedIndicators(key, toIndicatorSpecs(chart.getIndicators() ?? [], isUserIndicator));
  };
  // Data-window subscribers (indicator add/remove/visibility). Notified from the
  // handle's indicator mutations so the panel refreshes without polling. (#45)
  const indicatorSubs = useRef(new Set<() => void>());
  const notifyIndicators = () => {
    indicatorSubs.current.forEach((cb) => cb());
    // Keep the keyed registry current on every set change (#94), so even an
    // abrupt remount restores the latest set.
    saveIndicatorSet(chartRef.current);
  };
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
  // Display settings saved under persistenceKey by a previous mount — read
  // once, so a remount (key={symbol}) restores the user's choices.
  const [persistedDisplay] = useState(() => (persistenceKey ? loadPersistedDisplay(persistenceKey) : null));
  const th = useControllable<Theme | string>(themeProp, "dark");
  const candle = useControllable<CandleStyle>(candleStyleProp, "candle", persistedDisplay?.candleStyle);
  const scale = useControllable<PriceScale>(priceScaleProp, { type: "normal" });
  const sess = useControllable<SessionTint>(sessionsProp, false, persistedDisplay?.sessions);
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
  if (!samePropValue(watermarkProp, wmPropRef.current)) {
    wmPropRef.current = watermarkProp;
    if (watermarkProp !== undefined) setWatermarkState(normalizeWatermark(watermarkProp, baseTheme));
  }
  const wmSubs = useRef(new Set<() => void>());
  const setWatermark = (next: boolean | Partial<WatermarkOptions>) => setWatermarkState((cur) => mergeWatermark(cur, next));
  useEffect(() => {
    wmSubs.current.forEach((cb) => cb());
  }, [watermark]);
  // Price-scale labels (#41): merge-able toggle config with prop-seed + a
  // handle-driven setter for the price-scale menu.
  const [priceLabels, setPriceLabelsState] = useState<Required<PriceLabels>>(
    () => persistedDisplay?.priceLabels ?? { ...DEFAULT_PRICE_LABELS, ...priceLabelsProp },
  );
  const plPropRef = useRef(priceLabelsProp);
  if (!samePropValue(priceLabelsProp, plPropRef.current)) {
    plPropRef.current = priceLabelsProp;
    if (priceLabelsProp) setPriceLabelsState((cur) => ({ ...cur, ...priceLabelsProp }));
  }
  const plSubs = useRef(new Set<() => void>());
  const setPriceLabels = (next: Partial<PriceLabels>) => setPriceLabelsState((cur) => ({ ...cur, ...next }));
  useEffect(() => {
    plSubs.current.forEach((cb) => cb());
  }, [priceLabels]);
  const priceLabelsRef = useRef(priceLabels);
  priceLabelsRef.current = priceLabels;
  // Mirror the display settings to the keyed registry on every change, so a
  // remount restores them (no-op without a persistenceKey).
  useEffect(() => {
    if (persistenceKey) savePersistedDisplay(persistenceKey, { candleStyle, sessions, priceLabels });
  }, [persistenceKey, candleStyle, sessions, priceLabels]);
  // Current interval, read live by the countdown formatter.
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  // Timezone (#38): prop-seeded, handle-settable. A changed `timezone` prop wins
  // over an imperative set (mirrors theme/candle-style).
  const [timezone, setTimezoneState] = useState<string>(timezoneProp ?? DEFAULT_TIMEZONE);
  const tzPropRef = useRef(timezoneProp);
  if (timezoneProp !== undefined && timezoneProp !== tzPropRef.current) {
    tzPropRef.current = timezoneProp;
    setTimezoneState(timezoneProp);
  }
  const tzSubs = useRef(new Set<(tz: string) => void>());
  const timezoneRef = useRef(timezone);
  timezoneRef.current = timezone;
  useEffect(() => {
    chartRef.current?.setTimezone(timezone);
    tzSubs.current.forEach((cb) => cb(timezone));
  }, [timezone]);
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
  // Currency/unit for the resolved symbol (#39), read live by the legend price().
  const quoteRef = useRef<QuoteFormat>({});
  // Host formatter overrides, read live from the (stable) formatter callbacks.
  const dateFormatRef = useRef(dateFormat);
  dateFormatRef.current = dateFormat;
  const priceFormatterRef = useRef(priceFormatter);
  priceFormatterRef.current = priceFormatter;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const legendRef = useRef(legend);
  legendRef.current = legend;
  // Legend offset (#88): candle.tooltip.offsetTop seeds where the price-pane
  // legend stack starts — the indicator rows chain below it even when the
  // candle legend itself is hidden — and sub-panes ignore it (they position
  // from indicator.tooltip). The prop, when set, wins over the handle-driven
  // value (which <ChartHeader> uses to clear its own height automatically).
  const legendOffsetPropRef = useRef(legendOffset);
  legendOffsetPropRef.current = legendOffset;
  const legendOffsetHandleRef = useRef<number | null>(null);
  const applyLegendOffset = () => {
    const top = legendOffsetPropRef.current ?? legendOffsetHandleRef.current ?? DEFAULT_LEGEND_OFFSET;
    chartRef.current?.setStyles({ candle: { tooltip: { offsetTop: top } } } as DeepPartial<Styles>);
  };
  // Header (custom legend) subscribers: emitted the hovered bar on crosshair
  // move, else the latest bar (on load + each streamed bar). `crosshairActive`
  // gates the latest-bar emissions so a hover isn't overwritten by a live tick.
  const headerSubs = useRef(new Set<(current: KLineData | null, prev: KLineData | null) => void>());
  // Volume-trend subscribers (#79): each watches the trend ending at the same
  // bar the header shows. A subscriber may pin its own bar count; otherwise it
  // tracks the chart-level setting (editable live from the settings dialog).
  const trendSubs = useRef(new Set<{ bars?: number; cb: (trend: VolumeTrend | null) => void }>());
  const trendBarsRef = useRef(DEFAULT_VOLUME_TREND_BARS);
  const trendBarsSubs = useRef(new Set<(bars: number) => void>());
  // Volume-trend row on/off — chart-level so the indicators menu and the
  // header agree without host wiring. Seeded by <ChartHeader volumeTrend>.
  const trendOnRef = useRef(false);
  const trendOnSubs = useRef(new Set<(on: boolean) => void>());
  const crosshairActiveRef = useRef(false);
  // The bar index the header currently shows, so a settings change mid-hover
  // recomputes the trend at the hovered bar, not the tail.
  const headerIdxRef = useRef(-1);
  // Emit the header bar at `idx` (and the volume trend ending there) to all
  // subscribers. idx < 0 means "no data": emits nulls.
  const emitHeaderAt = (list: KLineData[], idx: number) => {
    headerIdxRef.current = idx;
    const current = idx >= 0 ? (list[idx] ?? null) : null;
    const prev = idx > 0 ? list[idx - 1] : null;
    headerSubs.current.forEach((cb) => cb(current, prev));
    trendSubs.current.forEach((s) => s.cb(volumeTrend(list, idx, s.bars ?? trendBarsRef.current)));
  };
  const emitLatestHeader = () => {
    if (crosshairActiveRef.current) return;
    const list = chartRef.current?.getDataList() ?? [];
    emitHeaderAt(list, list.length - 1);
  };
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
  const stickyDrawingsRef = useRef(stickyDrawings);
  stickyDrawingsRef.current = stickyDrawings;
  const drawings = useDrawings(chartRef, () => magnetMode(magnetRef.current), baseTheme, onTextPlaced, () => stickyDrawingsRef.current);

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
      chart.createIndicator({ name: COMPARE_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.compare, extendData: lines }, true);
    }
  };

  const createIndicator = (spec: IndicatorSpec) => {
    const chart = chartRef.current;
    if (!chart) return;
    // isStack=true: KLineChart's addIndicator with isStack=false REMOVES every
    // existing indicator on the target pane first, so main-pane overlays (MA,
    // BOLL, VWAP…) would replace one another and wipe the session/watermark/
    // pattern layers that also live on the candle pane. Stacking lets them
    // coexist; duplicates are still blocked by KLineChart's per-name filter, and
    // a "new"-pane indicator lands on a fresh pane where stacking is a no-op.
    chart.createIndicator(
      {
        name: spec.name,
        ...(spec.calcParams ? { calcParams: spec.calcParams } : {}),
        ...(spec.pane === "main" ? { paneId: CANDLE_PANE } : {}),
      },
      true,
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
      // Bar-close countdown under the last-price pill (#41), refreshed each
      // second by KLineChart's extend-text update timer.
      formatExtendText: ({ type, data, index }) => {
        if (type === "last_price" && index === 0 && priceLabelsRef.current.countdown && typeof data?.timestamp === "number") {
          return formatCountdown(data.timestamp, intervalMs(intervalRef.current));
        }
        return "";
      },
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
            chart.createIndicator({ name: ind.name, ...(ind.paneId === CANDLE_PANE ? { paneId: CANDLE_PANE } : {}) }, true);
          }
        }
        // Reset the undo history to the imported drawing set.
        drawings.resetHistoryToCurrent();
        // priceScale in the state is informational; the host re-applies it via
        // the `priceScale` prop (scale type is fixed at chart init).
      },
      getIndicatorSet: (): IndicatorSpec[] => toIndicatorSpecs(chartRef.current?.getIndicators() ?? [], isUserIndicator),
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
      getTimezone: () => timezoneRef.current,
      setTimezone: (tz) => setTimezoneState(tz),
      subscribeTimezone: (cb) => {
        tzSubs.current.add(cb);
        return () => tzSubs.current.delete(cb);
      },
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
      getPriceLabels: () => ({ ...priceLabelsRef.current }),
      setPriceLabels: (opts) => setPriceLabels(opts),
      subscribePriceLabels: (cb) => {
        plSubs.current.add(cb);
        return () => plSubs.current.delete(cb);
      },
      getBrushStyle: (tool) => drawings.getBrushStyle(tool),
      setBrushStyle: (tool, style) => drawings.setBrushStyle(tool, style),
      subscribeBrush: (cb) => drawings.subscribeBrush(cb),
      getTextStyle: () => drawings.getTextStyle(),
      setTextStyle: (style) => drawings.setTextStyle(style),
      subscribeTextStyle: (cb) => drawings.subscribeTextStyle(cb),
      getDrawingStyle: (tool) => drawings.getDrawingStyle(tool),
      setDrawingStyle: (style, tool) => drawings.setDrawingStyle(style, tool),
      subscribeDrawingStyle: (cb) => drawings.subscribeDrawingStyle(cb),
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
      setDrawingZOrder: (id, mode) => drawings.setDrawingZOrder(id, mode),
      copyDrawing: (id) => drawings.copyDrawing(id),
      pasteDrawing: () => drawings.pasteDrawing(),
      canPasteDrawing: () => drawings.canPaste(),
      getSelectedDrawing: () => drawings.getSelectedDrawing(),
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
      // Custom header (#45) -------------------------------------------------
      subscribeHeaderBar: (cb) => {
        headerSubs.current.add(cb);
        // Seed with the latest bar so a late-mounting header isn't blank.
        const list = chartRef.current?.getDataList() ?? [];
        const n = list.length;
        cb(n ? list[n - 1] : null, n > 1 ? list[n - 2] : null);
        return () => headerSubs.current.delete(cb);
      },
      // Volume trend (#79) ---------------------------------------------------
      subscribeVolumeTrend: (cb, bars) => {
        const sub = { bars: bars === undefined ? undefined : Math.max(1, Math.floor(bars)), cb };
        trendSubs.current.add(sub);
        // Seed from the latest bar so a late-mounting label isn't blank.
        const list = chartRef.current?.getDataList() ?? [];
        cb(volumeTrend(list, list.length - 1, sub.bars ?? trendBarsRef.current));
        return () => trendSubs.current.delete(sub);
      },
      getVolumeTrendBars: () => trendBarsRef.current,
      setVolumeTrendBars: (bars) => {
        const n = Math.max(1, Math.floor(bars));
        if (!Number.isFinite(n) || n === trendBarsRef.current) return;
        trendBarsRef.current = n;
        // Recompute for unpinned subscribers at the bar the header shows now
        // (the hovered bar mid-crosshair, else the latest).
        const list = chartRef.current?.getDataList() ?? [];
        const idx = crosshairActiveRef.current ? headerIdxRef.current : list.length - 1;
        trendSubs.current.forEach((s) => {
          if (s.bars === undefined) s.cb(volumeTrend(list, idx, n));
        });
        trendBarsSubs.current.forEach((cb) => cb(n));
      },
      subscribeVolumeTrendBars: (cb) => {
        trendBarsSubs.current.add(cb);
        return () => trendBarsSubs.current.delete(cb);
      },
      getVolumeTrendEnabled: () => trendOnRef.current,
      setVolumeTrendEnabled: (on) => {
        if (on === trendOnRef.current) return;
        trendOnRef.current = on;
        trendOnSubs.current.forEach((cb) => cb(on));
      },
      subscribeVolumeTrendEnabled: (cb) => {
        trendOnSubs.current.add(cb);
        return () => trendOnSubs.current.delete(cb);
      },
      setLegendOffset: (px) => {
        legendOffsetHandleRef.current = px;
        applyLegendOffset();
      },
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
      } else if (action === "copy") {
        // Only consume Cmd/Ctrl+C when a drawing is selected — otherwise leave
        // the browser's normal copy alone.
        const sel = api.getSelectedDrawing();
        if (sel) {
          api.copyDrawing(sel);
          e.preventDefault();
        }
      } else if (action === "paste") {
        if (api.canPasteDrawing()) {
          api.pasteDrawing();
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
      timezone: timezoneRef.current,
      // Widen KLineChart's default bar-space limits (min 1 / max 50). The 50-px
      // cap silently no-ops setBarSpace, so a short lookback (e.g. "1D" with few
      // bars over a wide plot) could never zoom in far enough to apply.
      layout: { ...(yAxisLayout(priceScale) ?? {}), barSpaceLimit: { min: 0.3, max: 1000 } },
    };
    const chart = init(el, options);
    if (!chart) return;
    chartRef.current = chart;
    // Signal the reconcile effects to (re)apply session tint / pattern markers
    // on this fresh chart.
    setChartEpoch((e) => e + 1);
    chart.setStyles(mergeStyles(themeStyleObj, styles));
    // Feed a custom header (#45): the hovered bar while the crosshair is over a
    // bar, else fall back to the latest bar. KLineChart v10 emits the RAW
    // crosshair ({x, y, paneId} from the pointer event) to onCrosshairChange —
    // kLineData/dataIndex are never populated — so resolve the hovered bar from
    // the x coordinate ourselves.
    chart.subscribeAction("onCrosshairChange", (d) => {
      const cross = d as { kLineData?: KLineData; dataIndex?: number; x?: number } | undefined;
      const list = chart.getDataList();
      let k = cross?.kLineData ?? null;
      let idx = typeof cross?.dataIndex === "number" ? cross.dataIndex : -1;
      if (!k && typeof cross?.x === "number" && list.length > 0) {
        const [p] = chart.convertFromPixel([{ x: cross.x }], { paneId: CANDLE_PANE }) as Array<Partial<Point>>;
        if (typeof p?.dataIndex === "number") {
          idx = Math.max(0, Math.min(p.dataIndex, list.length - 1));
          k = list[idx] ?? null;
        }
      }
      if (k && idx >= 0) {
        crosshairActiveRef.current = true;
        emitHeaderAt(list, idx);
      } else {
        crosshairActiveRef.current = false;
        emitLatestHeader();
      }
    });
    // v10 fires no action when the crosshair clears (its paneId gate drops the
    // event), so restore the latest-bar header on pointer exit ourselves.
    const onPointerLeave = () => {
      crosshairActiveRef.current = false;
      emitLatestHeader();
    };
    el.addEventListener("mouseleave", onPointerLeave);
    // Candle rendering style (#1).
    applyCandleStyle(chart, candleStyleRef.current, themeStyleObj, baseTheme);
    // Price-scale labels (#41) — last value/line + high/low marks.
    applyPriceLabels(chart, priceLabelsRef.current);
    // Crosshair date/price formatting (#46), default: TV-style date+time pill.
    applyFormatter(chart);
    // Candle legend without the time row: the hovered bar's time lives in the
    // crosshair x-axis pill instead (like TradingView), leaving the legend to
    // show O/H/L/C/V colored by candle direction.
    chart.setStyles({
      candle: {
        tooltip: {
          // Fully hide the built-in legend when the host renders its own header
          // (returning [] from the template isn't enough — KLineChart then falls
          // back to its DEFAULT legend). The crosshair is a separate style.
          showRule: legend ? "follow_cross" : "none",
          legend: {
            // Single-line TradingView-style header: `TICKER · interval · source`
            // then O/H/L/C colored by the bar direction, the change vs the prior
            // bar's close (value + %), and volume.
            template: (data: { current: Nullable<KLineData>; prev: Nullable<KLineData> }): { title: Tip; value: Tip }[] => {
              const k = data.current;
              if (!k || !legendRef.current) return []; // host renders its own header

              const pal = themeRef.current === "dark" ? PALETTE.DARK : PALETTE.LIGHT;
              const label = pal.muted;
              const dir = (k.close ?? 0) >= (k.open ?? 0) ? PALETTE.GREEN : PALETTE.RED;
              const price = (v?: number) =>
                formatWithUnit(
                  priceFormatterRef.current
                    ? priceFormatterRef.current(v ?? 0)
                    : utils.formatThousands(utils.formatPrecision(v ?? 0, pricePrecRef.current), ","),
                  quoteRef.current,
                );
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
    // Scroll-back pagination (#109): getBarsBefore's presence is the
    // capability signal. All paging state is per chart instance, so a
    // symbol/interval switch resets the exhaustion latch for free and the
    // `disposed` flag discards any page that resolves after the switch.
    const canPageBack = typeof dataSource.getBarsBefore === "function";
    let pageInFlight = false;
    let pageExhausted = false;
    let pageErrorAt = 0;
    chart.setDataLoader({
      getBars: async ({ type, timestamp, callback }) => {
        if (type === "forward") {
          // KLineChart fires "forward" near the data's LEFT edge and prepends
          // the result, preserving the viewport anchor — our scroll-back page.
          if (!canPageBack || pageExhausted) {
            callback([], { forward: false, backward: false });
            return;
          }
          // Re-arm without fetching: mid-flight (KLineChart shouldn't refire,
          // but never double-fetch) or inside the post-error cooldown.
          const before = timestamp ?? chart.getDataList()[0]?.timestamp;
          if (pageInFlight || Date.now() - pageErrorAt < PAGE_RETRY_COOLDOWN_MS || typeof before !== "number") {
            callback([], { forward: true, backward: false });
            return;
          }
          pageInFlight = true;
          try {
            const page = await dataSource.getBarsBefore!(symbol, interval, barCount, before);
            if (disposed) return; // stale — the chart was re-inited mid-flight
            const clean = sanitizeOlderBars(page, before);
            if (clean.length === 0) {
              // Exhausted (or fully deduped): latch and tell KLineChart to
              // stop asking for this chart's lifetime.
              pageExhausted = true;
              callback([], { forward: false, backward: false });
            } else {
              // HA view: transform the chunk standalone — the live
              // transformer (haRef) keeps tracking the right edge.
              const shaped = isHeikinAshi(candleStyleRef.current) ? toHeikinAshi(clean) : clean;
              callback(shaped.map(toKLine), { forward: true, backward: false });
            }
          } catch {
            if (disposed) return;
            // Failed page: stay armed so the next pan retries (after the
            // cooldown). No user-facing error state for a backfill.
            pageErrorAt = Date.now();
            callback([], { forward: true, backward: false });
          } finally {
            pageInFlight = false;
          }
          return;
        }
        if (type === "backward") {
          callback([], false);
          return;
        }
        try {
          const bars = await dataSource.getBars(symbol, interval, barCount);
          const ha = isHeikinAshi(candleStyleRef.current);
          if (ha) haRef.current.seed(bars);
          const shaped = ha ? toHeikinAshi(bars) : bars;
          callback(shaped.map(toKLine), { forward: canPageBack, backward: false });
          emitLatestHeader();
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
            emitLatestHeader();
          });
        }
      },
      unsubscribeBar: () => unsub(),
    });

    let disposed = false;
    // Set once the async init has restored studies + drawings; the teardown
    // snapshot is gated on it (see the cleanup below).
    let seeded = false;
    (async () => {
      // Symbol resolution (#8): validate/enrich before loading.
      let info: SymbolInfo = { ticker: symbol };
      if (dataSource.resolveSymbol) {
        const resolved = await dataSource.resolveSymbol(symbol);
        if (disposed) return;
        if (!resolved) {
          onSymbolError?.(symbol);
          return; // unknown symbol — do not load
        }
        info = resolved;
      }
      // Our SymbolInfo is a stricter subset of KLineChart's (which carries an
      // open index signature); every field is a valid quote key, so cast to the
      // exact expected parameter type rather than widening our public type.
      chart.setSymbol(info as unknown as Parameters<typeof chart.setSymbol>[0]);
      pricePrecRef.current = info.pricePrecision ?? 2;
      // Quote metadata (#39): currency/unit decorate the legend + crosshair price.
      quoteRef.current = { currency: info.currency, unit: info.unit };
      chart.setPeriod(toPeriod(interval));
      // Watermark first so it sits at the very back (behind session tint + candles).
      if (watermark.symbol || watermark.interval) {
        chart.createIndicator(
          { name: WATERMARK_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.watermark, extendData: buildWatermark(info.ticker ?? symbol, interval, watermark) },
          true,
        );
      }
      // Session tint + pattern markers are (re)applied by their chartEpoch-keyed
      // reconcile effects below, so they survive a chart re-init (interval switch).
      // Studies: after a re-init, restore the set the user had live (#86);
      // after a remount, restore the keyed registry's set (#94). Only a
      // chart with no history on either seeds from the `indicators` prop.
      const persisted = persistedIndicatorsRef.current ?? (persistenceKey ? loadPersistedIndicators(persistenceKey) : null);
      for (const s of persisted ?? indicators.map(asSpec)) createIndicator(s);
      // Drawings: restore this symbol's saved set (#97) — carried across
      // interval/scale switches, isolated per ticker — and make it the undo
      // baseline so undo can't reach back into another symbol's history.
      const savedDrawings = drawingStoreRef.current.load(symbol);
      if (savedDrawings) {
        drawings.restoreDrawings(savedDrawings);
        drawings.resetHistoryToCurrent();
      }
      seeded = true;
      applyPaneHeights();
      // The seed lands after an async resolveSymbol, so the indicators menu /
      // data window (mounted earlier) re-read the list now.
      notifyIndicators();
      onReady?.(chart);
    })();

    return () => {
      disposed = true;
      unsub();
      // Snapshot the user's studies (before dispose) so the next init — a
      // symbol/interval/scale switch — restores them (#86), mirrored to the
      // keyed registry so a remount restores them too (#94); and this
      // symbol's drawings (#97) — `symbol` here is the OUTGOING one (the
      // effect closure), so the set lands under the right ticker. Skipped
      // when the async init never seeded this chart (a rapid second switch
      // mid-resolveSymbol): snapshotting that empty husk would overwrite the
      // real saved sets.
      if (seeded) {
        persistedIndicatorsRef.current = toIndicatorSpecs(chart.getIndicators() ?? [], isUserIndicator);
        saveIndicatorSet(chart);
        drawingStoreRef.current.save(symbol, drawings.snapshotDrawings());
      }
      el.removeEventListener("mouseleave", onPointerLeave);
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

  // Toggle the built-in candle legend when `legend` changes at runtime (#45).
  useEffect(() => {
    chartRef.current?.setStyles({ candle: { tooltip: { showRule: legend ? "follow_cross" : "none" } } } as DeepPartial<Styles>);
  }, [legend]);

  // Price-scale labels reconcile (#41).
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) applyPriceLabels(chart, priceLabels);
  }, [priceLabels]);

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
      chart.createIndicator({ name: SESSION_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.session, extendData: sessionColors(sessions) }, true);
    } else if (sessions && present) {
      chart.overrideIndicator({ name: SESSION_INDICATOR, extendData: sessionColors(sessions) });
    } else if (!sessions && present) {
      chart.removeIndicator({ name: SESSION_INDICATOR });
    }
    // chartEpoch: re-apply on a fresh chart (e.g. after an interval switch).
  }, [sessions, chartEpoch]);

  // Watermark reconcile: create/update/remove, and refresh its ticker+interval
  // text the instant the symbol, interval, or theme changes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const present = chart.getIndicators({ name: WATERMARK_INDICATOR }).length > 0;
    const active = watermark.symbol || watermark.interval;
    const ext = buildWatermark(symbol, interval, watermark);
    if (active && !present) {
      chart.createIndicator({ name: WATERMARK_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.watermark, extendData: ext }, true);
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
      chart.createIndicator({ name: PATTERN_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.pattern, extendData: patterns }, true);
    } else if (has && present) {
      chart.overrideIndicator({ name: PATTERN_INDICATOR, extendData: patterns });
    } else if (!has && present) {
      chart.removeIndicator({ name: PATTERN_INDICATOR });
    }
    // chartEpoch: re-apply on a fresh chart (e.g. after an interval switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns, chartEpoch]);

  // Halt status from the data source (subscribeHalt), per symbol. Reset on a
  // symbol switch so one ticker's halt never shows on the next; a callback
  // that lands after unsubscribe is dropped.
  // Read through a ref (like the bar feed) so an inline `dataSource` object
  // doesn't resubscribe — and flash the badge off — on every host render.
  const [sourceHalted, setSourceHalted] = useState<boolean | HaltBadge>(false);
  const dataSourceRef = useRef(dataSource);
  dataSourceRef.current = dataSource;
  useEffect(() => {
    setSourceHalted(false);
    const ds = dataSourceRef.current;
    if (!ds.subscribeHalt) return;
    let live = true;
    const unsub = ds.subscribeHalt(symbol, (h) => {
      if (live) setSourceHalted(h);
    });
    return () => {
      live = false;
      unsub();
    };
  }, [symbol]);
  // An explicit `halted` prop wins over the data source.
  const effectiveHalted = halted !== undefined ? halted : sourceHalted;

  // Halt badge reconcile (#78).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const present = chart.getIndicators({ name: HALT_INDICATOR }).length > 0;
    const badge = normalizeHalt(effectiveHalted);
    if (badge && !present) {
      chart.createIndicator({ name: HALT_INDICATOR, paneId: CANDLE_PANE, zLevel: Z_ORDER.halt, extendData: badge }, true);
    } else if (badge && present) {
      chart.overrideIndicator({ name: HALT_INDICATOR, extendData: badge });
    } else if (!badge && present) {
      chart.removeIndicator({ name: HALT_INDICATOR });
    }
    // chartEpoch: re-apply on a fresh chart (e.g. after an interval switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveHalted, chartEpoch]);

  // Legend offset reconcile (#88). chartEpoch: a fresh chart (symbol/interval
  // switch) resets styles to the library default, so re-apply.
  useEffect(() => {
    applyLegendOffset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legendOffset, chartEpoch]);

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
