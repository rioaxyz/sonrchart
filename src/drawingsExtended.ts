import { registerOverlay } from "klinecharts";
import type { Coordinate, OverlayCreateFiguresCallbackParams, OverlayFigure } from "klinecharts";
import { priceRangeLabel } from "./shapes";

// Extended drawing family (issue #34). A curated second tier of drawing tools
// built on the same custom-overlay seam as shapes.ts: each `createPointFigures`
// derives its geometry from the placed screen `coordinates` (plus the anchored
// price `value`/`timestamp`/`dataIndex` on `overlay.points` for measurements),
// so everything pans/zooms with the chart and — created in the user-drawing
// group — plugs into undo/redo, clear, and export/import for free.
//
// These are OPT-IN: they are NOT in DEFAULT_DRAWING_TOOLS (the toolbar stays
// curated). A host adds them via EXTENDED_DRAWING_TOOLS or starts one by name
// through the chart handle.
//
// DEFERRED (noted in the issue + feature doc, "user did not decide to
// implement"): Gann fans/squares, Elliott-wave, Andrews' pitchfork, harmonic /
// XABCD patterns, and the rarer Fibonacci variants (spiral, arcs, fan, wedge,
// circles, channel). KLineChart has no primitives for these and each is a
// substantial standalone effort — out of scope for this curated pass.

// Overlay names double as DrawingTool ids (SonrChart maps startDrawing(tool) →
// createOverlay({ name: tool })), so these must match the DrawingTool union.
export const EXT_HORIZONTAL_RAY = "horizontalRay";
export const EXT_CROSS_LINE = "crossLine";
export const EXT_ARROW = "arrow";
export const EXT_FIB_EXTENSION = "fibExtension";
export const EXT_FIB_TIME_ZONE = "fibTimeZone";
export const EXT_DATE_RANGE = "dateRange";
export const EXT_DATE_PRICE_RANGE = "datePriceRange";

/** All extended overlay names, in toolbar order. */
export const EXTENDED_OVERLAYS = [
  EXT_HORIZONTAL_RAY,
  EXT_CROSS_LINE,
  EXT_ARROW,
  EXT_FIB_EXTENSION,
  EXT_FIB_TIME_ZONE,
  EXT_DATE_RANGE,
  EXT_DATE_PRICE_RANGE,
] as const;

// Shared palette (aligned with shapes.ts).
const LINE = "#2962ff";
const FILL = "rgba(41,98,255,0.08)";
const UP = "#26a69a";
const DOWN = "#ef5350";
const LABEL_TEXT = "#ffffff";
const FIB_COLORS = ["#787b86", "#f23645", "#ff9800", "#4caf50", "#089981", "#2962ff", "#9c27b0"];

const LABEL_STYLE = {
  color: LABEL_TEXT,
  size: 12,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 2,
  paddingBottom: 2,
  borderRadius: 2,
} as const;

type Params = OverlayCreateFiguresCallbackParams<unknown>;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested directly)
// ---------------------------------------------------------------------------

/** Trend-based Fibonacci extension levels (retracement + projection). */
export const FIB_EXTENSION_LEVELS: readonly number[] = [0, 0.382, 0.618, 1, 1.618, 2.618];

/** Fibonacci sequence multipliers for time zones (starts 1,2,3,5,8,…). Pure. */
export function fibSequence(count: number): number[] {
  const out: number[] = [];
  let a = 1;
  let b = 2;
  for (let i = 0; i < Math.max(0, count); i++) {
    out.push(a);
    [a, b] = [b, a + b];
  }
  return out;
}

/**
 * Arrowhead polygon for a segment ending at (x2,y2), coming from (x1,y1). Two
 * barbs swept back from the tip by `size` px at ±`spread` radians. Pure. Returns
 * [leftBarb, tip, rightBarb]. Zero-length segments yield a degenerate triangle
 * at the tip (harmless).
 */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 10,
  spread = Math.PI / 7,
): Coordinate[] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const left = { x: x2 - size * Math.cos(angle - spread), y: y2 - size * Math.sin(angle - spread) };
  const right = { x: x2 - size * Math.cos(angle + spread), y: y2 - size * Math.sin(angle + spread) };
  return [left, { x: x2, y: y2 }, right];
}

/** Human duration for a millisecond span, coarse-grained (largest two units).
 *  Pure. E.g. 3_660_000 → "1h 1m", 45_000 → "45s". */
export function humanDuration(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec && !d && !h) parts.push(`${sec}s`);
  return parts.slice(0, 2).join(" ") || "0s";
}

/** Measurement label for a date range: bar count + human time span. Pure. */
export function dateRangeLabel(bars: number, ms: number): string {
  const b = Math.abs(Math.round(bars));
  return `${b} bar${b === 1 ? "" : "s"} · ${humanDuration(ms)}`;
}

// ---------------------------------------------------------------------------
// Figure builders
// ---------------------------------------------------------------------------

/** Horizontal ray — locks to the first point's price, extends to the pane edge
 *  in the direction of the second point. */
export function horizontalRayFigures({ coordinates, bounding }: Params): OverlayFigure[] {
  if (coordinates.length < 1) return [];
  const [a, b] = coordinates;
  const endX = !b || b.x >= a.x ? bounding.width : 0;
  return [{ type: "line", attrs: { coordinates: [{ x: a.x, y: a.y }, { x: endX, y: a.y }] }, styles: { color: LINE, size: 1 } }];
}

/** Cross line — full-width horizontal + full-height vertical through one point. */
export function crossLineFigures({ coordinates, bounding }: Params): OverlayFigure[] {
  if (coordinates.length < 1) return [];
  const [p] = coordinates;
  return [
    { type: "line", attrs: { coordinates: [{ x: 0, y: p.y }, { x: bounding.width, y: p.y }] }, styles: { color: LINE, size: 1 } },
    { type: "line", attrs: { coordinates: [{ x: p.x, y: 0 }, { x: p.x, y: bounding.height }] }, styles: { color: LINE, size: 1 } },
  ];
}

/** Arrow — a 2-point segment with a filled arrowhead at the second point. */
export function arrowFigures({ coordinates }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  return [
    { type: "line", attrs: { coordinates: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] }, styles: { color: LINE, size: 2 } },
    {
      type: "polygon",
      attrs: { coordinates: arrowHeadPoints(a.x, a.y, b.x, b.y) },
      styles: { style: "fill", color: LINE },
    },
  ];
}

/**
 * Trend-based Fibonacci extension — 3 points A,B,C. Projects the A→B move from
 * C at each Fib level. The value/pixel relationship is read straight off the two
 * placed anchors (pixels-per-price = (B.y−A.y)/(B.value−A.value)), so no y-axis
 * conversion API is needed. Each level draws a horizontal line from C to the
 * right edge with a "{level} ({price})" label.
 */
export function fibExtensionFigures({ coordinates, overlay, bounding }: Params): OverlayFigure[] {
  if (coordinates.length < 3) return [];
  const [, , c] = coordinates;
  const yA = coordinates[0].y;
  const yB = coordinates[1].y;
  const valA = overlay.points[0]?.value ?? 0;
  const valB = overlay.points[1]?.value ?? 0;
  const valC = overlay.points[2]?.value ?? 0;
  const dySpan = yB - yA; // pixels for (valB - valA)
  const dValSpan = valB - valA;
  const figures: OverlayFigure[] = [];
  FIB_EXTENSION_LEVELS.forEach((level, i) => {
    const y = c.y + level * dySpan;
    const price = valC + level * dValSpan;
    const color = FIB_COLORS[i % FIB_COLORS.length];
    figures.push({ type: "line", attrs: { coordinates: [{ x: c.x, y }, { x: bounding.width, y }] }, styles: { color, size: 1 } });
    figures.push({
      type: "text",
      attrs: { x: c.x + 4, y: y - 2, text: `${level} (${price.toFixed(2)})`, baseline: "bottom" },
      ignoreEvent: true,
      styles: { ...LABEL_STYLE, backgroundColor: color },
    });
  });
  return figures;
}

/** Fibonacci time zones — 2 points set the base unit (bar spacing); vertical
 *  lines at Fibonacci multiples of that unit, full height. */
export function fibTimeZoneFigures({ coordinates, bounding }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const unit = b.x - a.x;
  if (unit === 0) return [];
  const figures: OverlayFigure[] = [];
  fibSequence(8).forEach((mult, i) => {
    const x = a.x + unit * mult;
    if (x < 0 || x > bounding.width) return;
    const color = FIB_COLORS[i % FIB_COLORS.length];
    figures.push({ type: "line", attrs: { coordinates: [{ x, y: 0 }, { x, y: bounding.height }] }, styles: { color, size: 1 } });
  });
  return figures;
}

function rectAttrs(x0: number, y0: number, x1: number, y1: number) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

/** Date range — 2-point measurement box labelled with the bar count + time span
 *  between the anchors. */
export function dateRangeFigures({ coordinates, overlay }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const bars = (overlay.points[1]?.dataIndex ?? 0) - (overlay.points[0]?.dataIndex ?? 0);
  const ms = (overlay.points[1]?.timestamp ?? 0) - (overlay.points[0]?.timestamp ?? 0);
  return [
    { type: "rect", attrs: rectAttrs(a.x, a.y, b.x, b.y), styles: { style: "stroke_fill", color: FILL, borderColor: LINE, borderSize: 1 } },
    {
      type: "text",
      attrs: { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 4, text: dateRangeLabel(bars, ms), align: "center", baseline: "bottom" },
      ignoreEvent: true,
      styles: { ...LABEL_STYLE, backgroundColor: LINE },
    },
  ];
}

/** Date & price range — 2-point box labelled with BOTH the price delta/% and
 *  the bar-count/time span. Direction tints the box green/red. */
export function datePriceRangeFigures({ coordinates, overlay }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const fromV = overlay.points[0]?.value ?? 0;
  const toV = overlay.points[1]?.value ?? 0;
  const bars = (overlay.points[1]?.dataIndex ?? 0) - (overlay.points[0]?.dataIndex ?? 0);
  const ms = (overlay.points[1]?.timestamp ?? 0) - (overlay.points[0]?.timestamp ?? 0);
  const up = toV >= fromV;
  const color = up ? UP : DOWN;
  return [
    { type: "rect", attrs: rectAttrs(a.x, a.y, b.x, b.y), styles: { style: "stroke_fill", color: up ? "rgba(38,166,154,0.12)" : "rgba(239,83,80,0.12)", borderColor: color, borderSize: 1 } },
    {
      type: "text",
      attrs: { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 4, text: `${priceRangeLabel(fromV, toV)}  ·  ${dateRangeLabel(bars, ms)}`, align: "center", baseline: "bottom" },
      ignoreEvent: true,
      styles: { ...LABEL_STYLE, backgroundColor: color },
    },
  ];
}

let _registered = false;

/** Register all extended-family overlays once. Idempotent. */
export function registerExtendedDrawings(): void {
  if (_registered) return;
  _registered = true;
  const defs: Array<{ name: string; points: number; build: (p: Params) => OverlayFigure[] }> = [
    { name: EXT_HORIZONTAL_RAY, points: 2, build: horizontalRayFigures },
    { name: EXT_CROSS_LINE, points: 1, build: crossLineFigures },
    { name: EXT_ARROW, points: 2, build: arrowFigures },
    { name: EXT_FIB_EXTENSION, points: 3, build: fibExtensionFigures },
    { name: EXT_FIB_TIME_ZONE, points: 2, build: fibTimeZoneFigures },
    { name: EXT_DATE_RANGE, points: 2, build: dateRangeFigures },
    { name: EXT_DATE_PRICE_RANGE, points: 2, build: datePriceRangeFigures },
  ];
  for (const d of defs) {
    registerOverlay({
      name: d.name,
      // totalStep is clicks-to-place + 1 (KLineChart counts the pending step).
      totalStep: d.points + 1,
      needDefaultPointFigure: true,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      createPointFigures: d.build,
    });
  }
}
