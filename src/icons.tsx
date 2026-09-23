import type { ReactNode } from "react";
import type { DrawingTool } from "./types";

// Inline SVG icon set — no icon dependency. Every icon draws with currentColor
// so it inherits the button's text color (muted / hover / active), and carries
// aria-hidden since the button itself supplies the accessible label.
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="1.3" fill="currentColor" stroke="none" />;

/** Icon for a drawing tool; falls back to a plain segment for unknown tools. */
export function DrawIcon({ tool }: { tool: DrawingTool }) {
  switch (tool) {
    case "brush":
      // A pen/brush drawing a squiggle.
      return <Svg><path d="M2 14l1-3 7.5-7.5 2 2L5 13z" /><path d="M9.5 4l2 2" /></Svg>;
    case "highlighter":
      // A marker tip over an underline.
      return <Svg><path d="M3 13.5h6.5" /><path d="M6 11l5-5 2 2-5 5H6z" /><path d="M9.5 3.5l2 2" /></Svg>;
    case "segment":
      return <Svg><line x1="4" y1="12" x2="12" y2="4" />{dot(4, 12)}{dot(12, 4)}</Svg>;
    case "rayLine":
      return <Svg><line x1="4" y1="12" x2="13" y2="3" />{dot(4, 12)}</Svg>;
    case "straightLine":
      return <Svg><line x1="2" y1="14" x2="14" y2="2" /></Svg>;
    case "horizontalStraightLine":
      return <Svg><line x1="2" y1="8" x2="14" y2="8" /></Svg>;
    case "verticalStraightLine":
      return <Svg><line x1="8" y1="2" x2="8" y2="14" /></Svg>;
    case "priceLine":
      return <Svg><line x1="2" y1="8" x2="9.5" y2="8" /><rect x="9.5" y="5.8" width="4.7" height="4.4" rx="0.6" /></Svg>;
    case "parallelStraightLine":
      return <Svg><line x1="2" y1="10" x2="11" y2="3" /><line x1="5" y1="13" x2="14" y2="6" /></Svg>;
    case "priceChannelLine":
      return <Svg><line x1="2" y1="5" x2="14" y2="5" /><line x1="2" y1="11" x2="14" y2="11" /></Svg>;
    case "fibonacciLine":
      return (
        <Svg>
          <line x1="2" y1="3" x2="14" y2="3" />
          <line x1="2" y1="6.5" x2="14" y2="6.5" />
          <line x1="2" y1="10" x2="14" y2="10" />
          <line x1="2" y1="13.5" x2="14" y2="13.5" />
        </Svg>
      );
    case "simpleAnnotation":
      return <Svg><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></Svg>;
    case "simpleTag":
      return <Svg><path d="M3 3h5l5.5 5.5-5 5L3 8z" /><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" /></Svg>;
    default:
      return <Svg><line x1="4" y1="12" x2="12" y2="4" /></Svg>;
  }
}

/** Candlestick glyph — the candle-type menu trigger. */
export function CandleIcon() {
  return (
    <Svg>
      <line x1="5" y1="2.5" x2="5" y2="13.5" />
      <rect x="3.4" y="5" width="3.2" height="5.5" fill="currentColor" stroke="none" />
      <line x1="11" y1="3.5" x2="11" y2="12.5" />
      <rect x="9.4" y="6" width="3.2" height="4.5" />
    </Svg>
  );
}

/** Trash can — clear all drawings. */
export function ClearIcon() {
  return (
    <Svg>
      <path d="M3 4.5h10" />
      <path d="M6 4.5V3h4v1.5" />
      <path d="M4.5 4.5l.7 8.5h5.6l.7-8.5" />
    </Svg>
  );
}

/** Undo — curved arrow. Heavier stroke than the old ↶ glyph so it stays legible
 *  at a muted color on a dark theme. */
export function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path d="M6 4 2.5 7.5 6 11" />
      <path d="M2.5 7.5H9.5a3.75 3.75 0 0 1 0 7.5H7" />
    </svg>
  );
}

/** Redo — mirror of Undo. */
export function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path d="M10 4 13.5 7.5 10 11" />
      <path d="M13.5 7.5H6.5a3.75 3.75 0 0 0 0 7.5H9" />
    </svg>
  );
}

/** Pencil — the drawing-tools dropdown trigger (when no tool is armed). */
export function PencilIcon() {
  return <Svg><path d="M2.5 13.5l1-3 7-7 2 2-7 7-3 1z" /><path d="M9.5 4.5l2 2" /></Svg>;
}

/** Gear/cog — chart settings. Own 24×24 viewBox (feather-style settings path). */
export function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Camera — save a snapshot. */
export function CameraIcon() {
  return (
    <Svg>
      <path d="M2 5.5h2.5L5.5 4h5l1 1.5H14v8H2z" />
      <circle cx="8" cy="9" r="2.2" />
    </Svg>
  );
}
