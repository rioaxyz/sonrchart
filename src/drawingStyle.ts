import type { DeepPartial, OverlayStyle } from "klinecharts";

// Per-tool drawing styles (#103): the pen — stroke color, line style, and
// width — applied to NEW line/shape drawings. Pure and framework-free:
// useDrawings stores the chosen styles and passes the mapped OverlayStyle to
// createOverlay at arm time, so there is zero per-frame cost and existing
// drawings keep the style they were drawn with (snapshots already carry
// overlay styles through undo/export/per-symbol persistence). Brush,
// highlighter, and text keep their own dedicated stores.

export type DrawingLineStyle = "solid" | "dashed";

/** The pen for new drawings: stroke color, solid/dashed, and width in px. */
export interface DrawingStyle {
  color: string;
  lineStyle: DrawingLineStyle;
  size: number;
}

/** Seed shown in the settings UI before the user customizes anything —
 *  matches KLineChart's overlay default (blue, solid, 1px). Until a style is
 *  explicitly set, drawings keep the theme/library default untouched. */
export const DEFAULT_DRAWING_STYLE: DrawingStyle = { color: "#1677ff", lineStyle: "solid", size: 1 };

/** #rrggbb → rgba() at the given alpha; anything else passes through. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// Shape fills take a faint tint of the stroke so filled tools (rectangle,
// ellipse, price range…) follow the chosen color without going opaque.
const FILL_ALPHA = 0.12;

/** Map a DrawingStyle onto every figure family an overlay can draw — lines,
 *  polygons/rects/circles (stroke + tinted fill), and arcs — so one pen
 *  covers every tool. */
export function toOverlayStyle(s: DrawingStyle): DeepPartial<OverlayStyle> {
  const stroke = { borderColor: s.color, borderSize: s.size, borderStyle: s.lineStyle, color: withAlpha(s.color, FILL_ALPHA) };
  return {
    line: { color: s.color, size: s.size, style: s.lineStyle },
    polygon: stroke,
    rect: stroke,
    circle: stroke,
    arc: { color: s.color, size: s.size, style: s.lineStyle },
  };
}
