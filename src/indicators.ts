import { registerIndicator } from "klinecharts";
import type { PatternMarker } from "./types";

// Sonr's own custom KLineChart indicators (issues #5 and #10). Registered once
// at module load — registerIndicator is global to KLineChart, so the guard
// keeps repeat imports/HMR from double-registering.

export const SESSION_INDICATOR = "SONR_SESSION";
export const PATTERN_INDICATOR = "SONR_PATTERNS";

let _registered = false;

// --- ET session detection ----------------------------------------------------
// Classify a UTC epoch-ms timestamp into a US-equities session without a
// timezone library, using a cached Intl formatter (America/New_York handles DST).
const _etFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type Session = "pre" | "regular" | "post" | "closed";

function etSession(timeMs: number): Session {
  const parts = _etFmt.formatToParts(new Date(timeMs));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = h * 60 + m;
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "pre"; // 04:00–09:30
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "regular"; // 09:30–16:00
  if (mins >= 16 * 60 && mins < 20 * 60) return "post"; // 16:00–20:00
  return "closed";
}

export interface SessionColors {
  premarket: string;
  afterhours: string;
}

export const DEFAULT_SESSION_COLORS: SessionColors = {
  // Low alpha so candles read straight through the band.
  premarket: "rgba(125, 147, 232, 0.07)", // cool blue
  afterhours: "rgba(224, 163, 60, 0.07)", // amber
};

// --- registration ------------------------------------------------------------

export function registerSonrIndicators(): void {
  if (_registered) return;
  _registered = true;

  // Session tinting: full-height background bands per session, painted on the
  // candle pane. Colors come from the indicator's extendData.
  registerIndicator<Record<string, never>, unknown, SessionColors>({
    name: SESSION_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, chart, bounding, xAxis }) => {
      const colors = (chart.getIndicators({ name: SESSION_INDICATOR })[0]?.extendData as SessionColors) ||
        DEFAULT_SESSION_COLORS;
      const data = chart.getDataList();
      if (data.length === 0) return false;
      const top = bounding.top ?? 0;
      const h = bounding.height;
      const colorFor = (s: Session) =>
        s === "pre" ? colors.premarket : s === "post" ? colors.afterhours : null;

      // Fill contiguous same-session runs as single rects.
      let runStart = 0;
      let runSession = etSession(data[0].timestamp);
      const flush = (endIdx: number) => {
        const c = colorFor(runSession);
        if (c) {
          const x0 = xAxis.convertTimestampToPixel(data[runStart].timestamp);
          const x1 = xAxis.convertTimestampToPixel(data[endIdx].timestamp);
          const half = endIdx > runStart ? (x1 - x0) / (endIdx - runStart) / 2 : 3;
          ctx.fillStyle = c;
          ctx.fillRect(x0 - half, top, x1 - x0 + half * 2, h);
        }
      };
      for (let i = 1; i < data.length; i++) {
        const s = etSession(data[i].timestamp);
        if (s !== runSession) {
          flush(i - 1);
          runStart = i;
          runSession = s;
        }
      }
      flush(data.length - 1);
      return false;
    },
  });

  // Pattern-context markers: small triangles + labels at setup bars. Markers
  // ride in the indicator's extendData as PatternMarker[].
  registerIndicator<Record<string, never>, unknown, PatternMarker[]>({
    name: PATTERN_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, chart, bounding, xAxis }) => {
      const markers = (chart.getIndicators({ name: PATTERN_INDICATOR })[0]?.extendData as PatternMarker[]) || [];
      if (markers.length === 0) return false;
      const top = bounding.top ?? 0;
      const h = bounding.height;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "10px ui-monospace, Menlo, monospace";
      for (const mk of markers) {
        const x = xAxis.convertTimestampToPixel(mk.time);
        if (x < 0 || x > bounding.width) continue;
        const color = mk.color ?? (mk.kind === "short" ? "#ff6a76" : "#35c98d");
        const up = mk.kind !== "short";
        const y = up ? top + h - 16 : top + 16; // near bottom for longs, top for shorts
        ctx.fillStyle = color;
        ctx.beginPath();
        if (up) {
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x - 5, y + 3);
          ctx.lineTo(x + 5, y + 3);
        } else {
          ctx.moveTo(x, y + 6);
          ctx.lineTo(x - 5, y - 3);
          ctx.lineTo(x + 5, y - 3);
        }
        ctx.closePath();
        ctx.fill();
        if (mk.label) {
          ctx.fillText(mk.label, x, up ? y + 15 : y - 9);
        }
      }
      ctx.restore();
      return false;
    },
  });
}
