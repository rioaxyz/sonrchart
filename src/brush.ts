import { registerOverlay } from "klinecharts";
import type { Theme } from "./types";

// Freehand brush / highlighter (issue #34 — the "brush, highlighter" shapes).
// KLineChart has no native freehand tool, but v10 supports `drawingMode:
// "continuous"` — an overlay that captures a mouse-down → move → up stroke as a
// series of points. We register one such overlay and draw a smooth polyline
// through the captured points; the stroke's colour/width come from extendData,
// so brush and highlighter share the renderer with different styles. Because it's
// a normal overlay (created in the user-drawing group), it pans/zooms with the
// chart and plugs into undo/redo, clear, and export/import for free.

export const BRUSH_OVERLAY = "sonrBrush";

export interface BrushStyle {
  color: string;
  size: number;
}

/** The two brush tools, keyed to the drawing-toolbar tool ids. */
export type BrushTool = "brush" | "highlighter";

export function isBrushTool(tool: string): tool is BrushTool {
  return tool === "brush" || tool === "highlighter";
}

/** Preset style for a brush tool in the current theme. Brush is a thin solid
 *  stroke in the foreground ink; highlighter is a thick, translucent marker. */
export function brushStyle(tool: BrushTool, theme: Theme): BrushStyle {
  if (tool === "highlighter") return { color: "rgba(245,214,66,0.35)", size: 14 };
  return { color: theme === "dark" ? "#e6ebe9" : "#1a1f29", size: 2 };
}

type XY = { x: number; y: number };

// Resample a captured stroke into a smooth curve. Continuous capture can leave
// sparse/jittery points, so we de-jitter (drop points <2px apart) then run a
// Catmull-Rom spline through the survivors (~8 samples/segment). The spline
// passes through the original points, so the stroke stays faithful but reads as
// a smooth TradingView-style curve instead of straight segments. Runs in screen
// space each frame, so it re-smooths correctly on pan/zoom.
function catmull(p0: XY, p1: XY, p2: XY, p3: XY, t: number): XY {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}
export function smoothStroke(pts: XY[]): XY[] {
  if (pts.length < 3) return pts;
  const p: XY[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = p[p.length - 1];
    const b = pts[i];
    if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 >= 4) p.push(b);
  }
  if (p.length < 3) return p;
  const out: XY[] = [];
  const SAMPLES = 8;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p[i + 1];
    for (let s = 0; s < SAMPLES; s++) out.push(catmull(p0, p1, p2, p3, s / SAMPLES));
  }
  out.push(p[p.length - 1]);
  return out;
}

let _registered = false;

export function registerBrushOverlay(): void {
  if (_registered) return;
  _registered = true;
  registerOverlay({
    name: BRUSH_OVERLAY,
    // Continuous freehand: the stroke completes on mouse-up.
    drawingMode: "continuous",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      if (!coordinates || coordinates.length < 2) return [];
      const ext = (overlay.extendData as BrushStyle | undefined) ?? { color: "#888888", size: 2 };
      return [
        {
          type: "line",
          attrs: { coordinates: smoothStroke(coordinates) },
          // smooth beziers the path; round caps/joins remove the sharp,
          // pixelated corners so it reads like a TradingView brush.
          styles: { style: "solid", smooth: true, lineCap: "round", lineJoin: "round", color: ext.color, size: ext.size },
        },
      ];
    },
  });
}
