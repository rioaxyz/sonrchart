import { registerOverlay } from "klinecharts";
import type { OverlayCreateFiguresCallbackParams, OverlayFigure } from "klinecharts";

// Text annotation tool (a click-and-type label, like TradingView's "Text").
// KLineChart's built-in simpleAnnotation/simpleTag render fixed text and have no
// input flow, so we register a small custom overlay: one click anchors it, then
// SonrChart shows an inline input and stores the typed string in `extendData.text`.
// Because it's a normal overlay in the user-drawing group, it pans/zooms with the
// chart and plugs into undo/redo, clear, and export/import for free.

export const TEXT_OVERLAY = "text";

/** Shape of a text overlay's extendData. */
export interface TextData {
  text: string;
}

const INK = "#2962ff";
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
  return [
    {
      type: "text",
      attrs: { x, y, text, align: "left", baseline: "middle" },
      // A subtle box in the accent ink, matching the toolbar's other overlays.
      styles: {
        color: INK,
        size: 12,
        family: "inherit",
        weight: "normal",
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        borderColor: INK,
        borderSize: 1,
        borderRadius: 2,
        backgroundColor: "rgba(41,98,255,0.06)",
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
  });
}
