import { registerIndicator } from "klinecharts";
import type { PatternMarker } from "./types";

// Sonr's own custom KLineChart indicators (issues #5 and #10). Registered once
// at module load — registerIndicator is global to KLineChart, so the guard
// keeps repeat imports/HMR from double-registering.
//
// Performance: the classification/marker logic is kept out of the per-frame
// `draw` path. Session classification runs in `calc` (only when data changes)
// and is read back from the indicator's result; the ET offset is cached per
// UTC hour so it costs one Intl call per hour of data, then pure arithmetic.

export const SESSION_INDICATOR = "SONR_SESSION";
export const PATTERN_INDICATOR = "SONR_PATTERNS";
export const WATERMARK_INDICATOR = "SONR_WATERMARK";
export const SERIES_INDICATOR = "SONR_SERIES";
export const VWAP_INDICATOR = "VWAP";

/** Config for the custom series renderer (line/step/baseline/column/hlc/high_low). */
export interface SeriesData {
  style: "line" | "step" | "baseline" | "column" | "hlc" | "high_low";
  up: string;
  down: string;
  neutral: string;
  baseline?: number;
}

/** Background watermark content (the underlaid ticker + interval). */
export interface WatermarkData {
  title: string;
  subtitle?: string;
  color: string;
}

// A distinct, theme-agnostic line color for VWAP (violet) so it reads apart from
// MAs, order lines (amber), and price lines (blue).
const VWAP_COLOR = "#a970ff";

type VwapBar = { timestamp: number; high: number; low: number; close: number; volume?: number };

/** Volume-weighted average price, anchored to the ET trading day (resets at ET
 *  midnight). Pure cumulative arithmetic — one pass, no allocation beyond the
 *  result. Falls back to the typical price on a zero-volume bar. */
export function computeVWAP(dataList: VwapBar[]): Array<{ vwap: number }> {
  let day = Number.NaN;
  let pv = 0;
  let vol = 0;
  return dataList.map((d) => {
    const idx = etDayIndex(d.timestamp);
    if (idx !== day) {
      day = idx;
      pv = 0;
      vol = 0;
    }
    const typical = (d.high + d.low + d.close) / 3;
    const v = d.volume ?? 0;
    pv += typical * v;
    vol += v;
    return { vwap: vol > 0 ? pv / vol : typical };
  });
}

let _registered = false;

// --- ET session detection ----------------------------------------------------

const _etFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ET-minus-UTC offset in minutes, cached per UTC hour. DST transitions land on
// a UTC-hour boundary, so the offset is constant within each bucket — correct
// year-round while collapsing ~all timestamps to arithmetic after the first
// Intl call per hour. (Verified: 0 mismatches vs a pure-Intl classifier across
// a full year; ~70x faster in the hot path.)
const _offsetCache = new Map<number, number>();

function etOffsetMinutes(timeMs: number): number {
  const bucket = Math.floor(timeMs / 3_600_000);
  const cached = _offsetCache.get(bucket);
  if (cached !== undefined) return cached;
  const p = _etFmt.formatToParts(new Date(timeMs));
  const eh = Number(p.find((x) => x.type === "hour")?.value ?? "0");
  const em = Number(p.find((x) => x.type === "minute")?.value ?? "0");
  const d = new Date(timeMs);
  let diff = eh * 60 + em - (d.getUTCHours() * 60 + d.getUTCMinutes());
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  // Bound the cache: an intraday chart needs ~24 entries; keep it from growing
  // without limit on very long daily histories.
  if (_offsetCache.size > 4096) _offsetCache.clear();
  _offsetCache.set(bucket, diff);
  return diff;
}

/** ET calendar-day index (days since epoch, in America/New_York). VWAP anchors
 *  its cumulative sums to this so it resets at ET midnight, each trading day. */
export function etDayIndex(timeMs: number): number {
  return Math.floor((Math.floor(timeMs / 60_000) + etOffsetMinutes(timeMs)) / 1440);
}

export type Session = "pre" | "regular" | "post" | "closed";

/** Classify a UTC epoch-ms timestamp into a US-equities session (ET, DST-aware). */
export function etSession(timeMs: number): Session {
  const total = Math.floor(timeMs / 60_000) + etOffsetMinutes(timeMs);
  const mins = ((total % 1440) + 1440) % 1440;
  if (mins >= 240 && mins < 570) return "pre"; // 04:00–09:30
  if (mins >= 570 && mins < 960) return "regular"; // 09:30–16:00
  if (mins >= 960 && mins < 1200) return "post"; // 16:00–20:00
  return "closed";
}

export interface SessionColors {
  premarket: string;
  afterhours: string;
}

export const DEFAULT_SESSION_COLORS: SessionColors = {
  premarket: "rgba(125, 147, 232, 0.07)", // cool blue
  afterhours: "rgba(224, 163, 60, 0.07)", // amber
};

// Session codes stored per bar by calc, read by draw. Small ints keep the
// result array compact.
const SESSION_CODE: Record<Session, number> = { pre: 1, regular: 0, post: 2, closed: -1 };

// --- registration ------------------------------------------------------------

export function registerSonrIndicators(): void {
  if (_registered) return;
  _registered = true;

  // Session tinting. calc (data-change only) precomputes the session code per
  // bar; draw reads it back and only paints the visible range.
  registerIndicator<{ s: number }, unknown, SessionColors>({
    name: SESSION_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map((d) => ({ s: SESSION_CODE[etSession(d.timestamp)] })),
    draw: ({ ctx, chart, indicator, bounding, xAxis }) => {
      const colors = (indicator.extendData as SessionColors) || DEFAULT_SESSION_COLORS;
      const result = indicator.result as Array<{ s: number }>;
      const data = chart.getDataList();
      const n = data.length;
      if (n === 0 || result.length === 0) return false;

      // Only walk the visible bars (+1 margin) — during a zoom-in this is a
      // handful instead of the whole history.
      const range = chart.getVisibleRange();
      const from = Math.max(0, (range?.from ?? 0) - 1);
      const to = Math.min(n - 1, (range?.to ?? n - 1));
      if (to < from) return false;

      const top = bounding.top ?? 0;
      const h = bounding.height;
      const colorFor = (code: number) => (code === 1 ? colors.premarket : code === 2 ? colors.afterhours : null);

      let runStart = from;
      let runCode = result[from]?.s ?? -1;
      const flush = (endIdx: number) => {
        const c = colorFor(runCode);
        if (c) {
          const x0 = xAxis.convertTimestampToPixel(data[runStart].timestamp);
          const x1 = xAxis.convertTimestampToPixel(data[endIdx].timestamp);
          const half = endIdx > runStart ? (x1 - x0) / (endIdx - runStart) / 2 : 3;
          ctx.fillStyle = c;
          ctx.fillRect(x0 - half, top, x1 - x0 + half * 2, h);
        }
      };
      for (let i = from + 1; i <= to; i++) {
        const code = result[i]?.s ?? -1;
        if (code !== runCode) {
          flush(i - 1);
          runStart = i;
          runCode = code;
        }
      }
      flush(to);
      return false;
    },
  });

  // VWAP: volume-weighted average price, overlaid on the candle pane, anchored
  // to the ET trading day (resets at midnight ET, matching a standard daily
  // VWAP). Pure cumulative arithmetic in calc; KLineChart draws the line.
  registerIndicator<{ vwap: number }>({
    name: VWAP_INDICATOR,
    shortName: "VWAP",
    series: "price",
    precision: 2,
    figures: [
      {
        key: "vwap",
        title: "VWAP: ",
        type: "line",
        // Default to the violet, but honor an override applied via
        // overrideIndicator({ name: "VWAP", styles: { lines: [{ color }] } }) —
        // that lands on indicator.styles.lines[0], so the settings color picker
        // recolors VWAP like any other line indicator.
        styles: ({ indicator }) => ({ color: indicator.styles?.lines?.[0]?.color ?? VWAP_COLOR }),
      },
    ],
    calc: (dataList) => computeVWAP(dataList),
  });

  // Symbol/interval watermark, drawn on the candle pane BEHIND the candles (same
  // background layer as the session tint). Content comes from extendData so it
  // updates the instant the ticker or interval changes.
  registerIndicator<Record<string, never>, unknown, WatermarkData>({
    name: WATERMARK_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, bounding, indicator }) => {
      const wm = indicator.extendData as WatermarkData | undefined;
      // The title is the primary line; if only the interval is shown it becomes
      // the primary (drawn large), so support title-only / subtitle-only / both.
      if (!wm || (!wm.title && !wm.subtitle)) return false;
      const top = bounding.top ?? 0;
      const h = bounding.height;
      const w = bounding.width;
      if (w < 40 || h < 40) return false;
      const cx = w / 2;
      const cy = top + h / 2;
      const titleSize = Math.max(20, Math.min(96, Math.min(w * 0.16, h * 0.28)));
      const primary = wm.title || (wm.subtitle as string);
      const secondary = wm.title ? wm.subtitle : "";
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = wm.color;
      ctx.font = `700 ${titleSize}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillText(primary, cx, secondary ? cy - titleSize * 0.34 : cy);
      if (secondary) {
        const subSize = titleSize * 0.48;
        ctx.font = `600 ${subSize}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;
        ctx.fillText(secondary, cx, cy + subSize * 0.7);
      }
      ctx.restore();
      return false;
    },
  });

  // Custom series renderer (issue #33): draws line / step / baseline / column /
  // HLC / high-low on the candle pane, with the native candles hidden (SonrChart
  // sets a transparent "area" base when one of these styles is active). Config
  // arrives via extendData; only the visible range is walked each frame.
  registerIndicator<Record<string, never>, unknown, SeriesData>({
    name: SERIES_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, chart, bounding, xAxis, yAxis, indicator }) => {
      const cfg = indicator.extendData as SeriesData | undefined;
      if (!cfg || !cfg.style) return false;
      const data = chart.getDataList();
      const n = data.length;
      if (n === 0) return false;
      const range = chart.getVisibleRange();
      const from = Math.max(0, (range?.from ?? 0) - 1);
      const to = Math.min(n - 1, (range?.to ?? n - 1));
      if (to < from) return false;

      const x = (i: number) => xAxis.convertTimestampToPixel(data[i].timestamp);
      const yv = (v: number) => yAxis.convertToPixel(v);
      const top = bounding.top ?? 0;
      const paneBottom = top + bounding.height;
      const half = Math.max(1, chart.getBarSpace().gapBar) / 2;
      const { up, down, neutral } = cfg;
      // Colour a bar by its close vs the previous close (open on the first bar).
      const dir = (i: number) => (data[i].close >= (i > 0 ? data[i - 1].close : data[i].open) ? up : down);

      ctx.save();
      if (cfg.style === "line" || cfg.style === "step") {
        ctx.strokeStyle = neutral;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (let i = from; i <= to; i++) {
          const px = x(i);
          const py = yv(data[i].close);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else if (cfg.style === "step") {
            ctx.lineTo(px, yv(data[i - 1].close));
            ctx.lineTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      } else if (cfg.style === "baseline") {
        const base = cfg.baseline ?? data[from].close;
        ctx.lineWidth = 1.5;
        for (let i = from + 1; i <= to; i++) {
          ctx.strokeStyle = (data[i - 1].close + data[i].close) / 2 >= base ? up : down;
          ctx.beginPath();
          ctx.moveTo(x(i - 1), yv(data[i - 1].close));
          ctx.lineTo(x(i), yv(data[i].close));
          ctx.stroke();
        }
        // Dashed reference line at the baseline.
        const by = yv(base);
        ctx.strokeStyle = neutral;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x(from), by);
        ctx.lineTo(x(to), by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (cfg.style === "column") {
        for (let i = from; i <= to; i++) {
          const px = x(i);
          const py = yv(data[i].close);
          ctx.fillStyle = dir(i);
          ctx.fillRect(px - half, py, half * 2, paneBottom - py);
        }
      } else {
        // hlc / high_low
        ctx.lineWidth = 1.4;
        for (let i = from; i <= to; i++) {
          const px = x(i);
          ctx.strokeStyle = dir(i);
          ctx.beginPath();
          ctx.moveTo(px, yv(data[i].high));
          ctx.lineTo(px, yv(data[i].low));
          ctx.stroke();
          if (cfg.style === "hlc") {
            const cy = yv(data[i].close);
            ctx.beginPath();
            ctx.moveTo(px, cy);
            ctx.lineTo(px + half, cy);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      return false;
    },
  });

  // Pattern-context markers. Few in number; draw reads them from extendData
  // (no per-frame getIndicators lookup) and skips anything off-screen.
  registerIndicator<Record<string, never>, unknown, PatternMarker[]>({
    name: PATTERN_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, indicator, bounding, xAxis }) => {
      const markers = (indicator.extendData as PatternMarker[]) || [];
      if (markers.length === 0) return false;
      const top = bounding.top ?? 0;
      const h = bounding.height;
      const w = bounding.width;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "10px ui-monospace, Menlo, monospace";
      for (let m = 0; m < markers.length; m++) {
        const mk = markers[m];
        const x = xAxis.convertTimestampToPixel(mk.time);
        if (x < 0 || x > w) continue;
        const color = mk.color ?? (mk.kind === "short" ? "#ff6a76" : "#35c98d");
        const up = mk.kind !== "short";
        const y = up ? top + h - 16 : top + 16;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (up) {
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x - 5, y + 3);
          ctx.lineTo(x + 5, y + 3);
        } else {
          ctx.moveTo(x, y + 6);
          ctx.lineTo(x - 5, y - 3);
          ctx.lineTo(x + 5, y - 3);
        }
        ctx.closePath();
        ctx.fill();
        if (mk.label) ctx.fillText(mk.label, x, up ? y + 15 : y - 9);
      }
      ctx.restore();
      return false;
    },
  });
}
