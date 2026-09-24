// Applying a candle rendering style to a live chart (issue #1 / #33). Bridges
// the pure candle-type mapping (candles.ts) with the SONR_SERIES custom
// indicator: native styles just set candle.type + bar colors, while the custom
// series styles (line/step/baseline/column/hlc/high_low) hide the native bars
// and draw on top. Kept out of SonrChart.tsx so the candle/series coupling
// lives in one place.
import type { Chart, DeepPartial, Styles } from "klinecharts";
import { CANDLE_TYPE, isCustomSeries } from "./candles";
import { CANDLE_PANE } from "./internal";
import { SERIES_INDICATOR, type SeriesData } from "./indicators";
import { PALETTE } from "./theme";
import type { CandleStyle, Theme } from "./types";

const SERIES_TRANSPARENT = "rgba(0,0,0,0)";

// Fully transparent candle bars — hides the native series so SONR_SERIES can
// draw line/step/baseline/column/hlc/high_low on top.
const HIDDEN_BAR = {
  upColor: SERIES_TRANSPARENT,
  downColor: SERIES_TRANSPARENT,
  noChangeColor: SERIES_TRANSPARENT,
  upBorderColor: SERIES_TRANSPARENT,
  downBorderColor: SERIES_TRANSPARENT,
  noChangeBorderColor: SERIES_TRANSPARENT,
  upWickColor: SERIES_TRANSPARENT,
  downWickColor: SERIES_TRANSPARENT,
  noChangeWickColor: SERIES_TRANSPARENT,
};

function seriesConfig(style: CandleStyle, theme: Theme): SeriesData {
  return {
    style: style as SeriesData["style"],
    up: PALETTE.GREEN,
    down: PALETTE.RED,
    neutral: theme === "dark" ? "#cbd5e1" : "#334155",
  };
}

// Apply a candle style to the chart: for a custom series style, hide the native
// bars and draw/refresh SONR_SERIES; otherwise restore the theme bar colors and
// drop the series indicator. Safe to call on every candle-style/theme change.
export function applyCandleStyle(chart: Chart, style: CandleStyle | undefined, styleObj: DeepPartial<Styles>, baseTheme: Theme): void {
  const s = style ?? "candle";
  const custom = isCustomSeries(s);
  const bar = custom ? HIDDEN_BAR : (styleObj.candle as { bar?: unknown } | undefined)?.bar;
  chart.setStyles({ candle: { type: CANDLE_TYPE[s], ...(bar ? { bar } : {}) } } as DeepPartial<Styles>);
  const present = chart.getIndicators({ name: SERIES_INDICATOR }).length > 0;
  if (custom) {
    const ext = seriesConfig(s, baseTheme);
    if (present) chart.overrideIndicator({ name: SERIES_INDICATOR, extendData: ext });
    else chart.createIndicator({ name: SERIES_INDICATOR, paneId: CANDLE_PANE, extendData: ext }, false);
  } else if (present) {
    chart.removeIndicator({ name: SERIES_INDICATOR });
  }
}
