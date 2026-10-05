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
  /** Price-scale labels section (#41). */
  priceLabelsHeading: string;
  priceLabelLastValue: string;
  priceLabelLastLine: string;
  priceLabelHigh: string;
  priceLabelLow: string;
  priceLabelCountdown: string;
  /** Sessions (extended-hours tint) toggle. */
  sessions: string;
  /** Timezone menu trigger + group label (#38). */
  timezone: string;
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
  /** Shell's side-panel toggle button (indicators + objects). */
  panelToggle: string;
  hide: string;
  show: string;
  lock: string;
  unlock: string;
  remove: string;
  close: string;
  noIndicators: string;
  noDrawings: string;
  /** Object-tree per-drawing actions (#35). */
  duplicate: string;
  bringToFront: string;
  sendToBack: string;
  searchUnavailable: string;
  searching: string;
  noResults: string;
  /** Save / Load dialog (#45). */
  saveLoad: string;
  saveLoadExportLabel: string;
  saveLoadImportLabel: string;
  saveLoadCopy: string;
  saveLoadCopied: string;
  saveLoadDownload: string;
  saveLoadLoad: string;
  saveLoadError: string;
  saveLoadClose: string;
  /** Go-to-date dialog (#45). */
  goToDate: string;
  goToDateGo: string;
  /** Symbol-info dialog (#45). */
  symbolInfo: string;
  symbolInfoTicker: string;
  symbolInfoName: string;
  symbolInfoPricePrecision: string;
  symbolInfoVolumePrecision: string;
  symbolInfoUnknown: string;
  symbolInfoLoading: string;
  symbolInfoType: string;
  symbolInfoPointValue: string;
  symbolInfoListedExchange: string;
  symbolInfoExchange: string;
  symbolInfoTickSize: string;
  symbolInfoSession: string;
  /** Symbol-info metadata fields (#39). */
  symbolInfoCurrency: string;
  symbolInfoUnit: string;
  symbolInfoDescription: string;
  symbolInfoPriceSource: string;
  /** Nav / control bar (#45). */
  navControls: string;
  zoomOut: string;
  zoomIn: string;
  fitContent: string;
  goToRealtime: string;
  /** Volume-trend header row (#79): label + the three trend values. */
  volumeTrend: string;
  volumeTrendIncreasing: string;
  volumeTrendDecreasing: string;
  volumeTrendMixed: string;
  /** Market-status badge (#45). */
  marketPre: string;
  marketOpen: string;
  marketAfter: string;
  marketClosed: string;
  marketTimezone: string;
  /** Settings dialog section (nav) titles. */
  settingsSections: Record<"candles" | "indicators" | "grid" | "sessions" | "drawing" | "drawings", string>;
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
  priceLabelsHeading: "Labels",
  priceLabelLastValue: "Last value",
  priceLabelLastLine: "Price line",
  priceLabelHigh: "High",
  priceLabelLow: "Low",
  priceLabelCountdown: "Countdown",
  sessions: "Sessions",
  timezone: "Timezone",
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
  panelToggle: "Indicators & objects",
  hide: "Hide",
  show: "Show",
  lock: "Lock",
  unlock: "Unlock",
  remove: "Remove",
  close: "Close",
  noIndicators: "No indicators",
  noDrawings: "No drawings yet",
  duplicate: "Duplicate",
  bringToFront: "Bring to front",
  sendToBack: "Send to back",
  searchUnavailable: "Search unavailable",
  searching: "Searching…",
  noResults: "No results",
  saveLoad: "Save / Load",
  saveLoadExportLabel: "Current chart state",
  saveLoadImportLabel: "Paste chart state to load",
  saveLoadCopy: "Copy",
  saveLoadCopied: "Copied",
  saveLoadDownload: "Download",
  saveLoadLoad: "Load",
  saveLoadError: "Invalid JSON — could not load.",
  saveLoadClose: "Close",
  goToDate: "Go to date",
  goToDateGo: "Go",
  symbolInfo: "Symbol info",
  symbolInfoTicker: "Ticker",
  symbolInfoName: "Name",
  symbolInfoPricePrecision: "Price precision",
  symbolInfoVolumePrecision: "Volume precision",
  symbolInfoUnknown: "Unknown symbol",
  symbolInfoLoading: "Loading…",
  symbolInfoType: "Type",
  symbolInfoPointValue: "Point value",
  symbolInfoListedExchange: "Listed exchange",
  symbolInfoExchange: "Exchange",
  symbolInfoTickSize: "Tick size",
  symbolInfoSession: "Session",
  symbolInfoCurrency: "Currency",
  symbolInfoUnit: "Unit",
  symbolInfoDescription: "Description",
  symbolInfoPriceSource: "Price source",
  navControls: "Chart navigation",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  fitContent: "Fit all data",
  goToRealtime: "Go to realtime",
  volumeTrend: "Vol trend",
  volumeTrendIncreasing: "Increasing",
  volumeTrendDecreasing: "Decreasing",
  volumeTrendMixed: "Mixed",
  marketPre: "Pre-market",
  marketOpen: "Open",
  marketAfter: "After-hours",
  marketClosed: "Closed",
  marketTimezone: "Exchange timezone",
  settingsSections: {
    candles: "Candles",
    indicators: "Indicators",
    grid: "Grid & Crosshair",
    sessions: "Sessions",
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
