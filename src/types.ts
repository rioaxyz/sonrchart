// Public types for sonrchart.
import type { DrawingSnapshotItem } from "./drawingTemplates";

/** One OHLC(V) bar. `time` is milliseconds since the Unix epoch. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Chart interval token. Seconds ("10S"/"30S"), minutes ("1".."30"),
 *  hour ("60"), or daily ("D"). Host apps may pass any string a matching
 *  DataSource understands; these are what the built-in period mapping knows. */
export type Interval = "10S" | "30S" | "1" | "5" | "15" | "30" | "60" | "D" | (string & {});

/** Resolved metadata for a symbol (issue #8). All fields optional except the
 *  ticker; the host supplies whatever it knows. */
export interface SymbolInfo {
  ticker: string;
  name?: string;
  /** Decimal places for prices; drives the y-axis format. */
  pricePrecision?: number;
  /** Decimal places for volume. */
  volumePrecision?: number;
  // Symbol metadata (issue #39) — all optional; the host supplies what it knows.
  /** ISO currency code or symbol prices are quoted in (e.g. "USD", "$", "€").
   *  Prefixed to prices in the legend / crosshair pill. */
  currency?: string;
  /** Unit prices are quoted in (e.g. "pts", "¢", "bps"). Suffixed to prices. */
  unit?: string;
  /** URL (or data URI) for the symbol's logo, shown in the info dialog + legend. */
  logo?: string;
  /** URL (or data URI) for the listing exchange's logo. */
  exchangeLogo?: string;
  /** Long-form description of the instrument, shown in the info dialog. */
  description?: string;
  /** Where the price data originates (e.g. "Alpaca", "IEX"), shown in the dialog. */
  priceSource?: string;
}

/** One hit from a symbol search (issue #37). Only `symbol` is required; the
 *  datafeed supplies whatever else it knows to help the user disambiguate. */
export interface SymbolSearchResult {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
  /** URL (or data URI) for the symbol's logo, shown beside the result (#39). */
  logo?: string;
}

/**
 * How sonrchart gets its data. This is the whole integration seam: the
 * component knows nothing about where bars come from, so any host — a REST
 * API, a websocket, a local file, synthetic data — implements this.
 */
export interface DataSource {
  /** Return the most-recent `count` bars for a symbol/interval, oldest→newest. */
  getBars(symbol: string, interval: Interval, count: number): Promise<Bar[]>;
  /**
   * Optional live feed. Call `onBar` for every new/updated bar (forming or
   * closed). Return an unsubscribe function. Omit for a static chart.
   */
  subscribe?(symbol: string, interval: Interval, onBar: (bar: Bar) => void): () => void;
  /**
   * Optional scroll-back pagination (#109): presence is the capability
   * signal. Return up to `count` bars strictly OLDER than `before` (epoch
   * ms, exclusive), oldest→newest — the same shape as `getBars`. Return an
   * empty array when history is exhausted. Omit the method entirely for the
   * one-shot behavior (history ends at the initial `getBars` window).
   */
  getBarsBefore?(symbol: string, interval: Interval, count: number, before: number): Promise<Bar[]>;
  /**
   * Optional symbol resolution (issue #8). Validate/enrich a ticker before it
   * loads. Return `null` for an unknown symbol (the chart fires `onSymbolError`
   * and skips loading), or a SymbolInfo to set precision/name.
   */
  resolveSymbol?(symbol: string): Promise<SymbolInfo | null>;
  /**
   * Optional symbol search (issue #37). Given a partial query, return matching
   * symbols for a search-as-you-type dialog. Omit if the datafeed can't search
   * (the SymbolSearch component degrades gracefully).
   */
  searchSymbols?(query: string): Promise<SymbolSearchResult[]>;
  /**
   * Optional trading-halt status: presence is the capability signal. Call
   * `onChange` with the symbol's current state as soon as it's known — and
   * again whenever it changes: `true` (or a HaltBadge to customize the pill)
   * while halted, `false` once trading resumes. Return an unsubscribe
   * function. Drives the halt badge (#78) with no host wiring; an explicit
   * `halted` prop takes precedence.
   */
  subscribeHalt?(symbol: string, onChange: (halted: boolean | HaltBadge) => void): () => void;
}

/** Price-scale configuration (issue #12). */
export interface PriceScale {
  /** "normal" (default), "percentage" (% change), or "logarithm". */
  type?: "normal" | "percentage" | "logarithm";
  /** Flip the axis so price increases downward. */
  invert?: boolean;
  /** Draw the y-axis labels inside the plot area. */
  inside?: boolean;
}

/** Price-scale labels shown on the y-axis (issue #41 — labels). Each toggles a
 *  KLineChart price mark. `undefined` fields keep the current value. */
export interface PriceLabels {
  /** The last-price value pill on the axis. */
  lastValue?: boolean;
  /** The horizontal line drawn across the chart at the last price. */
  lastLine?: boolean;
  /** The visible-range high price mark. */
  high?: boolean;
  /** The visible-range low price mark. */
  low?: boolean;
  /** Countdown to the current bar's close, under the last-price pill. */
  countdown?: boolean;
}

/** Crosshair/drawing magnet mode (issue #13). `true` = weak. */
export type Magnet = boolean | "weak" | "strong";

/** Candle rendering style (issue #1). "heikin_ashi" transforms the data. */
export type CandleStyle =
  // Native KLineChart candle types.
  | "candle"
  | "hollow"
  | "hollow_up"
  | "ohlc"
  | "area"
  | "heikin_ashi"
  // Custom series renderers (drawn by SONR_SERIES over hidden candles).
  | "line"
  | "step"
  | "baseline"
  | "column"
  | "hlc"
  | "high_low";

/** A comparison symbol overlaid on the main pane (issue #9). */
export interface CompareSpec {
  symbol: string;
  color?: string;
}

/** A KLineChart drawing-tool name (issue #3). */
export type DrawingTool =
  | "segment"
  | "rayLine"
  | "straightLine"
  | "horizontalStraightLine"
  | "verticalStraightLine"
  | "priceLine"
  | "priceChannelLine"
  | "parallelStraightLine"
  | "fibonacciLine"
  | "simpleAnnotation"
  | "simpleTag"
  // Click-and-type text label (custom overlay, see textOverlay.ts).
  | "text"
  // Freehand tools (custom continuous-draw overlay).
  | "brush"
  | "highlighter"
  // Shape & measurement tools (custom overlays, see shapes.ts).
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "priceRange"
  | "riskReward"
  // Extended family (custom overlays, see drawingsExtended.ts) — opt-in (#34).
  | "horizontalRay"
  | "crossLine"
  | "arrow"
  | "fibExtension"
  | "fibTimeZone"
  | "dateRange"
  | "datePriceRange";

/** One active indicator row for the data-window panel (#45). */
export interface IndicatorRow {
  name: string;
  visible: boolean;
}

/** One user-drawing row for the object-tree panel (#45). */
export interface DrawingRow {
  /** Overlay id — the stable handle for per-drawing operations. */
  id: string;
  /** Raw overlay/tool name (e.g. "segment", "sonrBrush", "text"). */
  name: string;
  /** Human label (tool name, or the text content for a text label). */
  label: string;
  visible: boolean;
  locked: boolean;
}

/** Serialized chart state for save/load (issue #15). Opaque JSON the host
 *  persists and hands back to `importState`. */
export interface ChartState {
  version: 1;
  drawings: DrawingSnapshotItem[];
  indicators: Array<{ name: string; paneId?: string }>;
  priceScale?: PriceScale;
}

/** A horizontal reference line drawn across the chart (e.g. a trade plan's
 *  entry / stop / target). Static — see OrderLine for draggable lines. */
export interface PriceLine {
  price: number;
  color?: string;
  /** Short label drawn at the line, e.g. "Entry", "Stop", "Target". */
  label?: string;
  /** "solid" (default) | "dashed". */
  style?: "solid" | "dashed";
}

/**
 * A draggable on-chart order/position line (issue #19). Like PriceLine but the
 * user can drag it to a new price; `onMove` fires with the new price when the
 * drag ends (and continuously if `live`).
 */
export interface OrderLine {
  /** Stable id so React reconciliation and callbacks can identify the line. */
  id: string;
  price: number;
  color?: string;
  label?: string;
  style?: "solid" | "dashed";
  /** Allow dragging. Default true (that's the point of an OrderLine). */
  draggable?: boolean;
  /** Fires with the new price. `phase` is "moving" during the drag and "end"
   *  when released. */
  onMove?: (price: number, phase: "moving" | "end") => void;
}

/**
 * How to add one technical indicator (issue #4). A bare string is shorthand
 * for `{ name }`.
 */
export interface IndicatorSpec {
  /** KLineChart indicator name, e.g. "VOL", "MACD", "RSI", "BOLL", "MA". */
  name: string;
  /** "main" overlays it on the price pane; "new" (default) gives it a sub-pane. */
  pane?: "main" | "new";
  /** Indicator calc params, e.g. [5, 10, 20] for MA. */
  calcParams?: number[];
}

/** A pattern-context marker drawn on the price pane (issue #5) — Sonr's own
 *  custom indicator. Marks where a setup triggered. */
export interface PatternMarker {
  /** Bar time (epoch ms) to anchor the marker to. */
  time: number;
  /** "long" draws below the bar pointing up; "short" above pointing down. */
  kind?: "long" | "short";
  /** Optional short label (e.g. the pattern name). */
  label?: string;
  color?: string;
}

/** Halt badge shown at the top of the price pane while the symbol is
 *  trading-halted (issue #78). `halted={true}` shows the default blue "Halt"
 *  pill; pass an object to customize it. */
export interface HaltBadge {
  /** Badge text. Default "Halt". */
  label?: string;
  /** Pill background color. Default "#2196f3". */
  color?: string;
  /** Badge text color. Default "#ffffff". */
  textColor?: string;
}

/** Session background tinting (issue #10). `true` uses the default palette;
 *  pass an object to override the pre/after-hours tints (regular hours are
 *  untinted). Colors should be low-alpha so candles read through. */
export type SessionTint =
  | boolean
  | {
      premarket?: string;
      afterhours?: string;
    };

export type Theme = "dark" | "light";

/** Watermark configuration (issue: watermark controls). Show the symbol and/or
 *  the interval, with a configurable color and opacity. */
export interface WatermarkOptions {
  symbol: boolean;
  interval: boolean;
  /** #rrggbb ink color (opacity applied separately). */
  color: string;
  /** 0..1. */
  opacity: number;
}
