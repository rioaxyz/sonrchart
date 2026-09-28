import { registerOverlay } from "klinecharts";
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from "klinecharts";

// Trade-review overlay (Echo #157 polish): a risk/reward-style box drawn from a
// trade's entry to its exit, tinted green (win) or red (loss), with the result
// (P&L or R) labelled at the box — far more legible than a pair of entry/exit
// arrow markers. Created programmatically (2 points + extendData), not by the
// user, so it carries `needDefaultPointFigure: false` (no anchor handles).
//
// extendData: { up: boolean; label?: string; entryLine?: boolean }

export const SONR_TRADE_BOX = "sonrTradeBox";

const UP = "#26a69a";
const UP_FILL = "rgba(38,166,154,0.14)";
const DOWN = "#ef5350";
const DOWN_FILL = "rgba(239,83,80,0.14)";

interface TradeBoxData {
  up?: boolean;
  label?: string;
  /** Draw a horizontal reference line at the entry price across the box. */
  entryLine?: boolean;
}

type Params = OverlayCreateFiguresCallbackParams<TradeBoxData>;

export function tradeBoxFigures({ coordinates, overlay }: Params): OverlayFigure[] {
  if (coordinates.length < 2) return [];
  const [entry, exit] = coordinates;
  const ext = overlay.extendData ?? {};
  const up = ext.up !== false;
  const color = up ? UP : DOWN;
  const fill = up ? UP_FILL : DOWN_FILL;
  const x = Math.min(entry.x, exit.x);
  const y = Math.min(entry.y, exit.y);
  const width = Math.max(Math.abs(exit.x - entry.x), 1);
  const height = Math.max(Math.abs(exit.y - entry.y), 1);

  const figures: OverlayFigure[] = [
    { type: "rect", attrs: { x, y, width, height }, styles: { style: "stroke_fill", color: fill, borderColor: color, borderSize: 1.5 } },
  ];
  // Entry reference line across the box (the risk/reward "entry" split).
  if (ext.entryLine !== false) {
    figures.push({ type: "line", attrs: { coordinates: [{ x, y: entry.y }, { x: x + width, y: entry.y }] }, styles: { color, size: 1, style: "dashed" } });
  }
  // Solid entry / exit anchor dots.
  figures.push({ type: "circle", attrs: { x: entry.x, y: entry.y, r: 3.5 }, ignoreEvent: true, styles: { style: "fill", color } });
  figures.push({ type: "circle", attrs: { x: exit.x, y: exit.y, r: 3.5 }, ignoreEvent: true, styles: { style: "fill", color } });
  // Result label pinned to the box's top edge.
  if (ext.label) {
    figures.push({
      type: "text",
      attrs: { x: x + width / 2, y: y - 4, text: ext.label, align: "center", baseline: "bottom" },
      ignoreEvent: true,
      styles: { color: "#ffffff", backgroundColor: color, size: 12, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 },
    });
  }
  return figures;
}

let _registered = false;

/** Register the trade-review overlay once. Idempotent. */
export function registerTradeReview(): void {
  if (_registered) return;
  _registered = true;
  registerOverlay({
    name: SONR_TRADE_BOX,
    totalStep: 3, // 2 points + 1 (created programmatically with both points supplied)
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: tradeBoxFigures,
  });
}
