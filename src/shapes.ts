import { registerOverlay } from "klinecharts";
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from "klinecharts";

// Shape & measurement drawing tools (issue #34). KLineChart ships line-based
// drawing tools but no filled shapes or measurement widgets, so we register
// these as custom overlays. Each `createPointFigures` builds its geometry from
// the placed screen `coordinates` (and, for measurement tools, the anchored
// price `value`s on `overlay.points`), so everything pans/zooms with the chart
// and — because they're created in the user-drawing group — plugs into
// undo/redo, clear, and export/import for free.
//
// DEFERRED (noted in the issue): Gann fans/boxes, Elliott-wave, harmonic
// patterns, and Andrews' pitchfork. KLineChart has no native primitives for
// these and each is a substantial standalone effort; out of scope here.

// Overlay names double as the DrawingTool ids (SonrChart maps
// startDrawing(tool) → createOverlay({ name: tool })), so these strings must
// match the DrawingTool union entries in types.ts.
export const SHAPE_RECTANGLE = "rectangle";
export const SHAPE_ELLIPSE = "ellipse";
export const SHAPE_TRIANGLE = "triangle";
export const SHAPE_PRICE_RANGE = "priceRange";
export const SHAPE_RISK_REWARD = "riskReward";

/** All shape/measurement overlay names, in toolbar order. */
export const SHAPE_OVERLAYS = [
  SHAPE_RECTANGLE,
  SHAPE_ELLIPSE,
  SHAPE_TRIANGLE,
  SHAPE_PRICE_RANGE,
  SHAPE_RISK_REWARD,
] as const;

// Shared palette. Semi-transparent fills so candles read through; borders are
// opaque. These are theme-neutral (a mid blue reads on both light and dark).
const OUTLINE = "#2962ff";
const FILL = "rgba(41,98,255,0.10)";
const UP = "#26a69a";
const UP_FILL = "rgba(38,166,154,0.15)";
const DOWN = "#ef5350";
const DOWN_FILL = "rgba(239,83,80,0.15)";
const LABEL_TEXT = "#ffffff";

type Params = OverlayCreateFiguresCallbackParams<unknown>;

function rectAttrs(x0: number, y0: number, x1: number, y1: number) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

/** Rectangle — a 2-point outlined/filled box. */
export function rectangleFigures({ coordinates }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  return [
    {
      type: "rect",
      attrs: rectAttrs(a.x, a.y, b.x, b.y),
      styles: { style: "stroke_fill", color: FILL, borderColor: OUTLINE, borderSize: 1 },
    },
  ];
}

/** Ellipse — a 2-point ellipse inscribed in the box the points bound. Drawn as
 *  a polygon approximation, since KLineChart's circle/arc take a single radius. */
export function ellipseFigures({ coordinates }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const STEPS = 48;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return [
    {
      type: "polygon",
      attrs: { coordinates: pts },
      styles: { style: "stroke_fill", color: FILL, borderColor: OUTLINE, borderSize: 1 },
    },
  ];
}

/** Triangle — a 3-point filled/outlined triangle. */
export function triangleFigures({ coordinates }: Params): OverlayFigure[] {
  if (coordinates.length < 3) return [];
  return [
    {
      type: "polygon",
      attrs: { coordinates: coordinates.slice(0, 3).map((c) => ({ x: c.x, y: c.y })) },
      styles: { style: "stroke_fill", color: FILL, borderColor: OUTLINE, borderSize: 1 },
    },
  ];
}

/** Format a price-range measurement: absolute delta + percentage between two
 *  prices. Pure so it's unit-testable. */
export function priceRangeLabel(from: number, to: number): string {
  const delta = to - from;
  const sign = delta >= 0 ? "+" : "";
  const pct = from !== 0 ? (delta / Math.abs(from)) * 100 : 0;
  return `${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
}

/** Price range — a 2-point measurement box with a delta/% label. */
export function priceRangeFigures({ coordinates, overlay }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [a, b] = coordinates;
  const from = overlay.points[0]?.value ?? 0;
  const to = overlay.points[1]?.value ?? 0;
  const up = to >= from;
  const color = up ? UP : DOWN;
  const fill = up ? UP_FILL : DOWN_FILL;
  const midX = (a.x + b.x) / 2;
  const topY = Math.min(a.y, b.y);
  return [
    {
      type: "rect",
      attrs: rectAttrs(a.x, a.y, b.x, b.y),
      styles: { style: "stroke_fill", color: fill, borderColor: color, borderSize: 1 },
    },
    {
      type: "text",
      attrs: { x: midX, y: topY - 4, text: priceRangeLabel(from, to), align: "center", baseline: "bottom" },
      ignoreEvent: true,
      styles: { color: LABEL_TEXT, backgroundColor: color, size: 12, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
  ];
}

/** Risk/reward stats for a long setup (entry / stop / target). Pure so it's
 *  unit-testable. `rr` is reward-per-unit-risk (an R multiple); NaN-safe. */
export function riskRewardStats(entry: number, stop: number, target: number): { risk: number; reward: number; rr: number } {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;
  return { risk, reward, rr };
}

/** Risk/Reward (long) — 3 points (entry, stop, target): a green reward box
 *  from entry→target and a red risk box from entry→stop, with an R-multiple
 *  label. Boxes span the full horizontal extent of the placed points. */
export function riskRewardFigures({ coordinates, overlay }: Params): OverlayFigure[] {
  if (coordinates.length < 3) return [];
  const [entry, stop, target] = coordinates;
  const left = Math.min(entry.x, stop.x, target.x);
  const right = Math.max(entry.x, stop.x, target.x);
  const width = Math.max(right - left, 1);
  const entryVal = overlay.points[0]?.value ?? 0;
  const stopVal = overlay.points[1]?.value ?? 0;
  const targetVal = overlay.points[2]?.value ?? 0;
  const { rr } = riskRewardStats(entryVal, stopVal, targetVal);
  const rewardTop = Math.min(entry.y, target.y);
  const riskTop = Math.min(entry.y, stop.y);
  return [
    {
      type: "rect",
      attrs: { x: left, y: rewardTop, width, height: Math.abs(target.y - entry.y) },
      styles: { style: "stroke_fill", color: UP_FILL, borderColor: UP, borderSize: 1 },
    },
    {
      type: "rect",
      attrs: { x: left, y: riskTop, width, height: Math.abs(stop.y - entry.y) },
      styles: { style: "stroke_fill", color: DOWN_FILL, borderColor: DOWN, borderSize: 1 },
    },
    {
      type: "text",
      attrs: { x: (left + right) / 2, y: entry.y, text: `${rr.toFixed(2)}R`, align: "center", baseline: "middle" },
      ignoreEvent: true,
      styles: { color: LABEL_TEXT, backgroundColor: OUTLINE, size: 12, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
  ];
}

let _registered = false;

/** Register all shape/measurement overlays once. Idempotent. */
export function registerShapeOverlays(): void {
  if (_registered) return;
  _registered = true;
  const defs: Array<{ name: string; totalStep: number; build: (p: Params) => OverlayFigure[] }> = [
    { name: SHAPE_RECTANGLE, totalStep: 2, build: rectangleFigures },
    { name: SHAPE_ELLIPSE, totalStep: 2, build: ellipseFigures },
    { name: SHAPE_TRIANGLE, totalStep: 3, build: triangleFigures },
    { name: SHAPE_PRICE_RANGE, totalStep: 2, build: priceRangeFigures },
    { name: SHAPE_RISK_REWARD, totalStep: 3, build: riskRewardFigures },
  ];
  for (const d of defs) {
    registerOverlay({
      name: d.name,
      // totalStep is clicks-to-place + 1 (KLineChart counts the pending step).
      totalStep: d.totalStep + 1,
      needDefaultPointFigure: true,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      createPointFigures: d.build,
    });
  }
}
