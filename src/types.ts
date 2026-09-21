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
}

/** A horizontal reference line drawn across the chart (e.g. a trade plan's
 *  entry / stop / target). */
export interface PriceLine {
  price: number;
  color?: string;
  /** Short label drawn at the line, e.g. "Entry", "Stop", "Target". */
  label?: string;
  /** "solid" (default) | "dashed". */
  style?: "solid" | "dashed";
}

export type Theme = "dark" | "light";
