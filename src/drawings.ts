import type { DrawingTool } from "./types";
import { BRUSH_OVERLAY } from "./brush";
import { TEXT_OVERLAY } from "./textOverlay";

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
  { tool: "text", label: "Text" },
  { tool: "simpleAnnotation", label: "Note" },
  { tool: "simpleTag", label: "Tag" },
  { tool: "brush", label: "Brush" },
  { tool: "highlighter", label: "Highlighter" },
  { tool: "rectangle", label: "Rectangle" },
  { tool: "ellipse", label: "Ellipse" },
  { tool: "triangle", label: "Triangle" },
  { tool: "priceRange", label: "Price range" },
  { tool: "riskReward", label: "Risk / reward" },
];

// Extended drawing family (issue #34) — an opt-in second tier of tools
// registered as custom overlays (see drawingsExtended.ts). NOT in the default
// toolbar; a host spreads these into <DrawingToolbar tools> to offer them.
export const EXTENDED_DRAWING_TOOLS: DrawingToolOption[] = [
  { tool: "horizontalRay", label: "Horizontal ray" },
  { tool: "crossLine", label: "Cross line" },
  { tool: "arrow", label: "Arrow" },
  { tool: "fibExtension", label: "Fib extension" },
  { tool: "fibTimeZone", label: "Fib time zone" },
  { tool: "dateRange", label: "Date range" },
  { tool: "datePriceRange", label: "Date & price range" },
];

// Every user-started drawing is tagged with this group id so clearDrawings()
// can remove them without touching library-managed overlays (price/order lines,
// session/pattern indicators).
export const USER_DRAWING_GROUP = "sonr-user-drawing";

// Tool id → label, for the object tree (#45). Built once from the default +
// extended sets so every placed overlay resolves to a human label.
const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  [...DEFAULT_DRAWING_TOOLS, ...EXTENDED_DRAWING_TOOLS].map((t) => [t.tool, t.label]),
);

/** Human label for a placed drawing in the object tree. Text labels show their
 *  own content; freehand shares one overlay name; everything else maps to its
 *  tool label (falling back to the raw overlay name). Pure. */
export function drawingLabel(name: string, extendData?: unknown): string {
  if (name === TEXT_OVERLAY) {
    const text = (extendData as { text?: string } | undefined)?.text?.trim();
    return text && text.length > 0 ? text : "Text";
  }
  if (name === BRUSH_OVERLAY) return "Freehand";
  return TOOL_LABELS[name] ?? name;
}
