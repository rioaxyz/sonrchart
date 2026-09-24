import { registerOverlay } from "klinecharts";
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from "klinecharts";

// Text annotation tool (a click-and-type label, like TradingView's "Text").
// KLineChart's built-in simpleAnnotation/simpleTag render fixed text and have no
// input flow, so we register a small custom overlay: one click anchors it, then
// SonrChart shows an inline input and stores the typed string in `extendData.text`.
// Because it's a normal overlay in the user-drawing group, it pans/zooms with the
// chart and plugs into undo/redo, clear, and export/import for free.

export const TEXT_OVERLAY = "text";

/** Styling for a text label (defaults for new labels live on the chart handle). */
export interface TextStyle {
  color: string;
  size: number;
}

/** Shape of a text overlay's extendData: the label plus its per-label style. */
export interface TextData extends Partial<TextStyle> {
  text: string;
}

/** Default text label style. */
export const DEFAULT_TEXT_STYLE: TextStyle = { color: "#2962ff", size: 12 };

const PLACEHOLDER = "Text";

/** Build the text figure(s) for a placed text overlay. Shows a muted
 *  placeholder while the label is still empty (during editing) so the anchor
 *  stays visible. */
export function textFigures({ coordinates, overlay }: OverlayCreateFiguresCallbackParams<unknown>): OverlayFigure[] {
  if (!coordinates || coordinates.length < 1) return [];
  const { x, y } = coordinates[0];
  const ext = overlay.extendData as TextData | undefined;
  const raw = ext?.text ?? "";
  const text = raw.length > 0 ? raw : PLACEHOLDER;
  const color = ext?.color ?? DEFAULT_TEXT_STYLE.color;
  const size = ext?.size ?? DEFAULT_TEXT_STYLE.size;
  return [
    {
      type: "text",
      attrs: { x, y, text, align: "left", baseline: "middle" },
      // A subtle box in the label's ink, matching the toolbar's other overlays.
      // NB: no `family` override — a canvas font string like "20px inherit" is
      // invalid and canvas silently ignores the whole assignment (dropping the
      // size with it), so we let KLineChart's valid default family apply.
      styles: {
        color,
        size,
        weight: "normal",
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        borderColor: color,
        borderSize: 1,
        borderRadius: 2,
        backgroundColor: "transparent",
      },
    },
  ];
}

let _registered = false;

export function registerTextOverlay(): void {
  if (_registered) return;
  _registered = true;
  registerOverlay({
    name: TEXT_OVERLAY,
    // One click to anchor (+1 for KLineChart's pending step).
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: textFigures,
    // KLineChart removes an overlay on right-click by default; returning true
    // consumes the event so a text label isn't deleted by a stray right-click.
    onRightClick: () => true,
  });
}
