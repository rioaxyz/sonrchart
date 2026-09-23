import type { DeepPartial, Styles } from "klinecharts";
import type { Theme } from "./types";

// --- named custom-theme registry (issue #46) --------------------------------
// Beyond the built-in "dark"/"light", hosts can register named palette themes
// (a KLineChart style object) and select them via <SonrChart theme="name"> or
// the `customThemes` prop. The registry is module-global (shared by every chart
// in the app), mirroring how KLineChart registers indicators/overlays.
const THEME_REGISTRY = new Map<string, DeepPartial<Styles>>();

/** Register a named theme's style object so `theme="<name>"` applies it. */
export function registerTheme(name: string, styles: DeepPartial<Styles>): void {
  THEME_REGISTRY.set(name, styles);
}

/** Look up a previously registered theme's styles (undefined if unknown). */
export function getRegisteredTheme(name: string): DeepPartial<Styles> | undefined {
  return THEME_REGISTRY.get(name);
}

// Sonr console palette. Up = green, down = red, neutrals biased slightly cool.
const GREEN = "#35c98d";
const RED = "#ff6a76";

const DARK = {
  text: "#e6ebe9",
  muted: "#78828e",
  grid: "#1d232b",
  axis: "#1d232b",
  // Crosshair axis-label pill (time on x, price on y) — a solid dark chip.
  pill: "#2a2f38",
  pillText: "#e6ebe9",
};

const LIGHT = {
  text: "#1a1f29",
  muted: "#5c6675",
  grid: "#d8dee8",
  axis: "#d8dee8",
  // A dark chip with light text reads clearly over a light chart (as TV does).
  pill: "#2b313c",
  pillText: "#ffffff",
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
      // Floating axis-label pills that follow the pointer, TradingView-style:
      // the hovered bar's time on the x-axis, the pointer's price on the y-axis.
      horizontal: {
        line: { color: c.muted },
        text: {
          show: true,
          color: c.pillText,
          backgroundColor: c.pill,
          borderColor: c.pill,
          borderRadius: 2,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          size: 11,
        },
      },
      vertical: {
        line: { color: c.muted },
        text: {
          show: true,
          color: c.pillText,
          backgroundColor: c.pill,
          borderColor: c.pill,
          borderRadius: 2,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 4,
          paddingBottom: 4,
          size: 11,
        },
      },
    },
  };
}

export const PALETTE = { GREEN, RED, DARK, LIGHT };

// One-level merge so a (possibly partial) custom theme layers over a base,
// filling in the crosshair pills / candle bars a terse palette leaves out.
// Kept local so theme.ts stays free of React/component imports.
function shallowMerge(base: DeepPartial<Styles>, over: DeepPartial<Styles>): DeepPartial<Styles> {
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(over)) {
    const b = (base as Record<string, unknown>)[k];
    const o = (over as Record<string, unknown>)[k];
    out[k] = b && o && typeof b === "object" && typeof o === "object" ? { ...(b as object), ...(o as object) } : o;
  }
  return out as DeepPartial<Styles>;
}

/**
 * Resolve a theme selector to a KLineChart style object (issue #46).
 * "dark"/"light" use the built-ins unchanged. Any other string is looked up in
 * `customThemes` first, then the module registry; a match layers over the dark
 * base so partial palettes still get sensible crosshair/candle defaults. An
 * unknown name falls back to the dark theme.
 */
export function resolveThemeStyles(theme: Theme | string, customThemes?: Record<string, DeepPartial<Styles>>): DeepPartial<Styles> {
  if (theme === "dark" || theme === "light") return themeStyles(theme);
  const custom = customThemes?.[theme] ?? getRegisteredTheme(theme);
  if (custom) return shallowMerge(themeStyles("dark"), custom);
  return themeStyles("dark");
}
