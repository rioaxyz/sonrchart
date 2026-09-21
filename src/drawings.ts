import type { DrawingTool } from "./types";

// Curated drawing/annotation tools (issue #3) from KLineChart's built-ins,
// labeled for a toolbar. This is the "sensible default set" — hosts can pass
// their own subset to <DrawingToolbar>, or start any tool via the chart ref.
export interface DrawingToolOption {
  tool: DrawingTool;
  label: string;
}

export const DEFAULT_DRAWING_TOOLS: DrawingToolOption[] = [
  { tool: "segment", label: "Trend line" },
  { tool: "rayLine", label: "Ray" },
  { tool: "straightLine", label: "Extended line" },
  { tool: "horizontalStraightLine", label: "Horizontal" },
  { tool: "verticalStraightLine", label: "Vertical" },
  { tool: "priceLine", label: "Price line" },
  { tool: "parallelStraightLine", label: "Parallel channel" },
  { tool: "priceChannelLine", label: "Price channel" },
  { tool: "fibonacciLine", label: "Fibonacci" },
  { tool: "simpleAnnotation", label: "Note" },
  { tool: "simpleTag", label: "Tag" },
];

// Every user-started drawing is tagged with this group id so clearDrawings()
// can remove them without touching library-managed overlays (price/order lines,
// session/pattern indicators).
export const USER_DRAWING_GROUP = "sonr-user-drawing";
