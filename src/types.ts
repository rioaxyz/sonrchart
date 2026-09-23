// Public types for sonrchart.

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
}

/** One hit from a symbol search (issue #37). Only `symbol` is required; the
 *  datafeed supplies whatever else it knows to help the user disambiguate. */
export interface SymbolSearchResult {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
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

/** Crosshair/drawing magnet mode (issue #13). `true` = weak. */
export type Magnet = boolean | "weak" | "strong";

/** Candle rendering style (issue #1). "heikin_ashi" transforms the data. */
export type CandleStyle = "candle" | "hollow" | "hollow_up" | "ohlc" | "area" | "heikin_ashi";

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
  | "simpleTag";

/** Serialized chart state for save/load (issue #15). Opaque JSON the host
 *  persists and hands back to `importState`. */
export interface ChartState {
  version: 1;
  drawings: Array<{ name: string; points: unknown[]; styles?: unknown; mode?: string }>;
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
