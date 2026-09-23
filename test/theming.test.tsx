import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { registerTheme, getRegisteredTheme, resolveThemeStyles, themeStyles } from "../src/theme";
import { getCSSCustomProperty, setCSSCustomProperty } from "../src/css";
import { DEFAULT_LABELS, mergeLabels } from "../src/labels";
import { ChartToolbar } from "../src/ChartToolbar";
import type { SonrChartHandle } from "../src/SonrChart";

// --- Named custom themes (#46) ----------------------------------------------
describe("theme registry (#46)", () => {
  it("round-trips registerTheme / getRegisteredTheme", () => {
    const styles = { grid: { horizontal: { color: "#abcdef" } } };
    expect(getRegisteredTheme("sunset")).toBeUndefined();
    registerTheme("sunset", styles);
    expect(getRegisteredTheme("sunset")).toBe(styles);
  });

  it("resolveThemeStyles returns the built-ins for dark/light unchanged", () => {
    expect(resolveThemeStyles("dark")).toEqual(themeStyles("dark"));
    expect(resolveThemeStyles("light")).toEqual(themeStyles("light"));
  });

  it("resolveThemeStyles layers a registered custom theme over the dark base", () => {
    registerTheme("neon", { grid: { horizontal: { color: "#00ffcc" } } });
    const resolved = resolveThemeStyles("neon") as any;
    // Custom grid color wins.
    expect(resolved.grid.horizontal.color).toBe("#00ffcc");
    // Base crosshair pill survives (partial theme filled in from dark).
    expect(resolved.crosshair).toBeTruthy();
  });

  it("resolveThemeStyles prefers an inline customThemes entry over the registry", () => {
    registerTheme("dup", { grid: { horizontal: { color: "#111111" } } });
    const resolved = resolveThemeStyles("dup", { dup: { grid: { horizontal: { color: "#222222" } } } }) as any;
    expect(resolved.grid.horizontal.color).toBe("#222222");
  });

  it("resolveThemeStyles falls back to the dark theme for an unknown name", () => {
    expect(resolveThemeStyles("does-not-exist")).toEqual(themeStyles("dark"));
  });
});

// --- CSS custom-property helpers (#46) --------------------------------------
describe("CSS custom-property helpers (#46)", () => {
  it("writes and reads a variable on an element (with and without the -- prefix)", () => {
    const el = document.createElement("div");
    setCSSCustomProperty("brand", "#ff0000", el);
    expect(el.style.getPropertyValue("--brand")).toBe("#ff0000");
    // getCSSCustomProperty reads inline style back; accepts the bare name.
    expect(getCSSCustomProperty("brand", el)).toBe("#ff0000");
    // Explicit -- prefix is equivalent.
    setCSSCustomProperty("--accent", "#00ff00", el);
    expect(getCSSCustomProperty("--accent", el)).toBe("#00ff00");
  });

  it("defaults its target to document.documentElement", () => {
    setCSSCustomProperty("sonr-test-var", "42px");
    expect(document.documentElement.style.getPropertyValue("--sonr-test-var")).toBe("42px");
    expect(getCSSCustomProperty("sonr-test-var")).toBe("42px");
  });

  it("returns '' for an unset variable", () => {
    expect(getCSSCustomProperty("definitely-not-set-xyz", document.createElement("div"))).toBe("");
  });
});

// --- Localization (#46) ------------------------------------------------------
describe("labels merge (#46)", () => {
  it("returns the English defaults unchanged when nothing is passed", () => {
    expect(mergeLabels()).toBe(DEFAULT_LABELS);
  });

  it("merges nested records one level deep", () => {
    const merged = mergeLabels({ indicators: "Estudios", scaleTypes: { logarithm: "Log" } });
    expect(merged.indicators).toBe("Estudios");
    expect(merged.scaleTypes.logarithm).toBe("Log");
    // Untouched nested keys keep their defaults.
    expect(merged.scaleTypes.normal).toBe(DEFAULT_LABELS.scaleTypes.normal);
    expect(merged.sessions).toBe(DEFAULT_LABELS.sessions);
  });
});

function fakeHandle(): SonrChartHandle {
  return {
    chart: () => null,
    listIndicators: () => [],
    activeDrawing: () => null,
    subscribeDrawing: () => () => {},
    getMagnet: () => undefined,
    subscribeMagnet: () => () => {},
    canUndo: () => false,
    canRedo: () => false,
    subscribeHistory: () => () => {},
    getCandleStyle: () => "candle",
    subscribeCandleStyle: () => () => {},
    getPriceScale: () => ({ type: "normal" }),
    subscribePriceScale: () => () => {},
    getSessions: () => false,
    subscribeSessions: () => () => {},
  } as unknown as SonrChartHandle;
}
function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as any).current = h;
  return r;
}

describe("ChartToolbar localization (#46)", () => {
  it("renders overridden chrome labels", () => {
    render(
      <ChartToolbar
        chartRef={ref(fakeHandle())}
        labels={{ indicators: "Estudios", sessions: "Sesiones" }}
      />,
    );
    // Indicator menu trigger + sessions toggle reflect the overrides.
    expect(screen.getByRole("button", { name: /Estudios/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sesiones" })).toBeInTheDocument();
    // A non-overridden label stays English.
    expect(screen.getByRole("button", { name: "Snapshot" })).toBeInTheDocument();
  });

  it("keeps the English defaults when no labels are passed", () => {
    render(<ChartToolbar chartRef={ref(fakeHandle())} />);
    expect(screen.getByRole("button", { name: /Indicators/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessions" })).toBeInTheDocument();
  });
});
