import type { DeepPartial, Styles } from "klinecharts";
import type { Theme } from "./types";

// Sonr console palette. Up = green, down = red, neutrals biased slightly cool.
const GREEN = "#35c98d";
const RED = "#ff6a76";

const DARK = {
  text: "#e6ebe9",
  muted: "#78828e",
  grid: "#1d232b",
  axis: "#1d232b",
};

const LIGHT = {
  text: "#1a1f29",
  muted: "#5c6675",
  grid: "#d8dee8",
  axis: "#d8dee8",
};

/**
 * KLineChart style object for a theme. Deliberately limited to the style keys
 * that typecheck cleanly under klinecharts v10 (grid, candle bars, axes,
 * crosshair line) — callers can override anything via the `styles` prop.
 */
export function themeStyles(theme: Theme): DeepPartial<Styles> {
  const c = theme === "dark" ? DARK : LIGHT;
  return {
    grid: {
      horizontal: { color: c.grid },
      vertical: { color: c.grid },
    },
    candle: {
      bar: {
        upColor: GREEN,
        downColor: RED,
        noChangeColor: c.muted,
        upBorderColor: GREEN,
        downBorderColor: RED,
        upWickColor: GREEN,
        downWickColor: RED,
      },
    },
    xAxis: { tickText: { color: c.muted }, axisLine: { color: c.axis } },
    yAxis: { tickText: { color: c.muted }, axisLine: { color: c.axis } },
    crosshair: {
      horizontal: { line: { color: c.muted } },
      vertical: { line: { color: c.muted } },
    },
  };
}

export const PALETTE = { GREEN, RED, DARK, LIGHT };
