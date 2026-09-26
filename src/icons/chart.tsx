import type { DrawingTool } from "../types";
import { Icon, dot } from "./Icon";

// Chart & drawing-tool glyphs — Lucide-style, 24×24 grid, 2px round stroke.
// These are charting-specific (no Lucide equivalents), authored in the same
// visual language: minimal line-art, rounded ends, a couple of deliberate solid
// accents (candle body, anchor dots).

/** Candlestick pair — the candle-type menu trigger. */
export function CandleIcon() {
  return (
    <Icon>
      <path d="M8 3v18" />
      <rect x="5.5" y="7" width="5" height="8" rx="1" fill="currentColor" stroke="none" />
      <path d="M16 5v14" />
      <rect x="13.5" y="9" width="5" height="6" rx="1" />
    </Icon>
  );
}

/** Icon for a drawing tool; falls back to a plain segment for unknown tools. */
export function DrawIcon({ tool }: { tool: DrawingTool }) {
  switch (tool) {
    case "brush":
      // A pen drawing a stroke.
      return (
        <Icon>
          <path d="M4 20l3-1 11-11-2-2L5 17l-1 3Z" />
          <path d="M15 6l2 2" />
        </Icon>
      );
    case "highlighter":
      // A marker tip over an underline.
      return (
        <Icon>
          <path d="M4 20h9" />
          <path d="M9 16l7-7 3 3-7 7H9v-3Z" />
          <path d="M15 5l3 3" />
        </Icon>
      );
    case "segment":
      return (
        <Icon>
          <line x1="6" y1="18" x2="18" y2="6" />
          {dot(6, 18)}
          {dot(18, 6)}
        </Icon>
      );
    case "rayLine":
      return (
        <Icon>
          <line x1="6" y1="18" x2="20" y2="4" />
          {dot(6, 18)}
        </Icon>
      );
    case "straightLine":
      return (
        <Icon>
          <line x1="3" y1="21" x2="21" y2="3" />
        </Icon>
      );
    case "horizontalStraightLine":
      return (
        <Icon>
          <line x1="3" y1="12" x2="21" y2="12" />
        </Icon>
      );
    case "verticalStraightLine":
      return (
        <Icon>
          <line x1="12" y1="3" x2="12" y2="21" />
        </Icon>
      );
    case "priceLine":
      return (
        <Icon>
          <line x1="3" y1="12" x2="13" y2="12" />
          <rect x="13" y="9" width="7" height="6" rx="1" />
        </Icon>
      );
    case "parallelStraightLine":
      return (
        <Icon>
          <line x1="3" y1="15" x2="16.5" y2="4.5" />
          <line x1="7.5" y1="19.5" x2="21" y2="9" />
        </Icon>
      );
    case "priceChannelLine":
      return (
        <Icon>
          <line x1="3" y1="7.5" x2="21" y2="7.5" />
          <line x1="3" y1="16.5" x2="21" y2="16.5" />
        </Icon>
      );
    case "fibonacciLine":
      return (
        <Icon>
          <line x1="3" y1="4" x2="21" y2="4" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="3" y1="14.5" x2="21" y2="14.5" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </Icon>
      );
    case "text":
      // A capital "T" — the text-label tool.
      return (
        <Icon>
          <line x1="5" y1="6" x2="19" y2="6" />
          <line x1="12" y1="6" x2="12" y2="19" />
        </Icon>
      );
    case "simpleAnnotation":
      // Speech bubble — a note.
      return (
        <Icon>
          <path d="M4 5h16v10H10l-4 3.5V15H4Z" />
        </Icon>
      );
    case "simpleTag":
      // Price tag.
      return (
        <Icon>
          <path d="M4 4h7l8 8-7 7-8-8Z" />
          <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
        </Icon>
      );
    case "rectangle":
      return (
        <Icon>
          <rect x="4" y="6" width="16" height="12" rx="1" />
        </Icon>
      );
    case "ellipse":
      return (
        <Icon>
          <ellipse cx="12" cy="12" rx="9" ry="6" />
        </Icon>
      );
    case "triangle":
      return (
        <Icon>
          <path d="M12 4 21 20H3Z" />
        </Icon>
      );
    case "priceRange":
      // A box with a double-headed vertical measure arrow.
      return (
        <Icon>
          <rect x="4" y="6" width="16" height="12" rx="1" />
          <line x1="12" y1="8.5" x2="12" y2="15.5" />
          <path d="M9.8 10.5 12 8.5l2.2 2" />
          <path d="M9.8 13.5 12 15.5l2.2-2" />
        </Icon>
      );
    case "riskReward":
      // Stacked reward (top) / risk (bottom) boxes split at the entry line.
      return (
        <Icon>
          <rect x="4" y="4" width="16" height="7" />
          <rect x="4" y="13" width="16" height="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </Icon>
      );
    // --- Extended family (drawingsExtended.ts) ---
    case "horizontalRay":
      // Anchored dot with a line running to the right edge.
      return (
        <Icon>
          <line x1="4" y1="12" x2="21" y2="12" />
          {dot(4, 12)}
        </Icon>
      );
    case "crossLine":
      // Full-width + full-height crosshair through an anchor.
      return (
        <Icon>
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
          {dot(12, 12)}
        </Icon>
      );
    case "arrow":
      // Directional arrow (up-right).
      return (
        <Icon>
          <line x1="5" y1="19" x2="18" y2="6" />
          <path d="M9 6h9v9" />
        </Icon>
      );
    case "fibExtension":
      // A→B→C impulse leg projected onto horizontal levels.
      return (
        <Icon>
          <path d="M3 20l4-7 4 4" />
          <line x1="12" y1="5" x2="21" y2="5" />
          <line x1="12" y1="11" x2="21" y2="11" />
          <line x1="12" y1="17" x2="21" y2="17" />
        </Icon>
      );
    case "fibTimeZone":
      // Vertical lines at Fibonacci-widening intervals.
      return (
        <Icon>
          <line x1="4" y1="4" x2="4" y2="20" />
          <line x1="7" y1="4" x2="7" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="20" y1="4" x2="20" y2="20" />
        </Icon>
      );
    case "dateRange":
      // Horizontal span measured between two end-bars, double-headed.
      return (
        <Icon>
          <line x1="4" y1="6" x2="4" y2="18" />
          <line x1="20" y1="6" x2="20" y2="18" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <path d="M7 9 4 12l3 3" />
          <path d="M17 9l3 3-3 3" />
        </Icon>
      );
    case "datePriceRange":
      // A range box measured across both axes (diagonal arrow).
      return (
        <Icon>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <line x1="7" y1="17" x2="17" y2="7" />
          <path d="M11 7h6v6" />
        </Icon>
      );
    default:
      return (
        <Icon>
          <line x1="6" y1="18" x2="18" y2="6" />
        </Icon>
      );
  }
}
