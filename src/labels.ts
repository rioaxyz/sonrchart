// Localizable UI strings for the toolbar/menu chrome (issue #46).
//
// The visible chrome text — menu triggers, section titles, and per-option
// labels for candle styles / drawing tools / scale types — can be overridden by
// passing a `labels` prop to <ChartToolbar> (which threads it to the menus).
// Everything is optional and merges over DEFAULT_LABELS, so omitting `labels`
// (or any field) keeps the current English. Interval tokens are data, not
// chrome, so they are intentionally not covered here.
import type { CandleStyle, DrawingTool, PriceScale } from "./types";

type ScaleType = NonNullable<PriceScale["type"]>;

export interface Labels {
  /** Indicators menu trigger + group label. */
  indicators: string;
  /** Price-scale trigger prefix, shown as `${scale}: ${scaleTypes[type]}`. */
  scale: string;
  /** Price-scale option labels, keyed by scale type. */
  scaleTypes: Record<ScaleType, string>;
  /** Sessions (extended-hours tint) toggle. */
  sessions: string;
  /** Snapshot button aria-label. */
  snapshot: string;
  /** Settings gear aria-label + settings dialog title. */
  settings: string;
  /** Candle-type menu aria/title prefix. */
  candleType: string;
  /** Drawing-tools menu aria/title. */
  drawingTools: string;
  /** Magnet toggle. */
  magnet: string;
  undo: string;
  redo: string;
  /** Clear-drawings button aria-label. */
  clear: string;
  /** Hide/show-all-drawings toggle labels (the eye button). */
  hideDrawings: string;
  showDrawings: string;
  /** Clear-drawings confirmation dialog: prompt, confirm button, cancel button. */
  clearConfirm: string;
  clearConfirmOk: string;
  cancel: string;
  /** Data-window / object-tree panel chrome (#45). */
  dataWindow: string;
  objectTree: string;
  hide: string;
  show: string;
  lock: string;
  unlock: string;
  remove: string;
  noIndicators: string;
  noDrawings: string;
  /** Settings dialog section (nav) titles. */
  settingsSections: Record<"candles" | "indicators" | "grid" | "drawing" | "drawings", string>;
  /** Optional per-style overrides for the candle menu; falls back to the
   *  option's own `label` when a style is not listed. */
  candleStyles: Partial<Record<CandleStyle, string>>;
  /** Optional per-tool overrides for the drawing menu; falls back to the
   *  tool option's own `label` when a tool is not listed. */
  drawingToolLabels: Partial<Record<DrawingTool, string>>;
}

export const DEFAULT_LABELS: Labels = {
  indicators: "Indicators",
  scale: "Scale",
  scaleTypes: {
    normal: "Normal",
    logarithm: "Logarithmic",
    percentage: "Percent",
  },
  sessions: "Sessions",
  snapshot: "Snapshot",
  settings: "Chart settings",
  candleType: "Candle type",
  drawingTools: "Drawing tools",
  magnet: "Magnet",
  undo: "Undo",
  redo: "Redo",
  clear: "Clear drawings",
  hideDrawings: "Hide drawings",
  showDrawings: "Show drawings",
  clearConfirm: "Are you sure you want to delete all drawings in this chart?",
  clearConfirmOk: "Delete",
  cancel: "Cancel",
  dataWindow: "Indicators",
  objectTree: "Objects",
  hide: "Hide",
  show: "Show",
  lock: "Lock",
  unlock: "Unlock",
  remove: "Remove",
  noIndicators: "No indicators",
  noDrawings: "No drawings yet",
  settingsSections: {
    candles: "Candles",
    indicators: "Indicators",
    grid: "Grid & Crosshair",
    drawing: "Drawing",
    drawings: "Drawings",
  },
  candleStyles: {},
  drawingToolLabels: {},
};

/** Merge a partial label override over the English defaults (nested records
 *  merged one level deep). Returns DEFAULT_LABELS unchanged when nothing is
 *  passed, so the no-`labels` path allocates nothing. */
export function mergeLabels(over?: Partial<Labels>): Labels {
  if (!over) return DEFAULT_LABELS;
  return {
    ...DEFAULT_LABELS,
    ...over,
    scaleTypes: { ...DEFAULT_LABELS.scaleTypes, ...over.scaleTypes },
    settingsSections: { ...DEFAULT_LABELS.settingsSections, ...over.settingsSections },
    candleStyles: { ...DEFAULT_LABELS.candleStyles, ...over.candleStyles },
    drawingToolLabels: { ...DEFAULT_LABELS.drawingToolLabels, ...over.drawingToolLabels },
  };
}
