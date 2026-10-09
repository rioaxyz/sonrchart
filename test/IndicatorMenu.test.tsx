import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { IndicatorMenu, DEFAULT_INDICATOR_OPTIONS, VOLUME_TREND_OPTION } from "../src/IndicatorMenu";
import type { SonrChartHandle } from "../src/SonrChart";

// A fake chart handle backed by an in-memory indicator set (plus the
// volume-trend header-row flag), so the menu can be tested without a chart.
function fakeHandle() {
  const set = new Set<string>();
  const onSubs = new Set<(on: boolean) => void>();
  let trendEnabled = false;
  const handle: SonrChartHandle = {
    chart: () => null,
    addIndicator: vi.fn((i) => set.add(typeof i === "string" ? i : i.name)),
    removeIndicator: vi.fn((n) => set.delete(n)),
    listIndicators: vi.fn(() => [...set]),
    getVolumeTrendEnabled: vi.fn(() => trendEnabled),
    setVolumeTrendEnabled: vi.fn((on: boolean) => {
      if (on === trendEnabled) return;
      trendEnabled = on;
      onSubs.forEach((cb) => cb(on));
    }),
    subscribeVolumeTrendEnabled: vi.fn((cb: (on: boolean) => void) => {
      onSubs.add(cb);
      return () => onSubs.delete(cb);
    }),
  };
  return { handle, set, enableTrend: () => { trendEnabled = true; } };
}

describe("DEFAULT_INDICATOR_OPTIONS (#36 wider library)", () => {
  it("offers a broad curated set of KLineChart built-ins plus custom VWAP", () => {
    const names = DEFAULT_INDICATOR_OPTIONS.map((o) => o.name);
    // A sampling across overlays and oscillators newly added in #36.
    for (const expected of ["MA", "EMA", "SMA", "BBI", "BOLL", "SAR", "DMA", "VWAP", "VOL", "MACD", "RSI", "KDJ", "CCI", "DMI", "WR", "OBV", "AO", "TRIX", "MTM", "ROC", "PVT", "EMV", "PSY", "VR", "CR", "BIAS", "BRAR"]) {
      expect(names).toContain(expected);
    }
    // No internal library indicators leak into the user-facing list.
    for (const internal of ["SONR_SESSION", "SONR_PATTERNS", "SONR_WATERMARK"]) {
      expect(names).not.toContain(internal);
    }
  });

  it("lists options in alphabetical order by symbol", () => {
    const names = DEFAULT_INDICATOR_OPTIONS.map((o) => o.name);
    expect(names).toEqual([...names].sort());
  });

  it("assigns overlays to the main pane and oscillators to a new pane", () => {
    const byName = Object.fromEntries(DEFAULT_INDICATOR_OPTIONS.map((o) => [o.name, o.pane]));
    for (const overlay of ["MA", "EMA", "SMA", "BBI", "BOLL", "SAR", "DMA"]) {
      expect(byName[overlay]).toBe("main");
    }
    for (const osc of ["MACD", "RSI", "KDJ", "CCI", "DMI", "OBV", "AO"]) {
      expect(byName[osc]).toBe("new");
    }
    // Every option has a human-readable label.
    for (const o of DEFAULT_INDICATOR_OPTIONS) expect(o.label.length).toBeGreaterThan(0);
  });
});

describe("IndicatorMenu (#4 config UI)", () => {
  it("opens a dropdown with a row per option and seeds active state from the chart", async () => {
    const { handle, set } = fakeHandle();
    set.add("VOL");
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: "VOL", label: "Volume" }, { name: "MACD", label: "MACD" }]} />);
    // Flush the mount-tick seed (setTimeout 0) so the active set (VOL) is read.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    // Collapsed by default: a single trigger showing the active count.
    const trigger = screen.getByRole("button", { name: /Indicators/ });
    expect(trigger).toHaveTextContent("(1)");
    expect(screen.queryByRole("menuitemcheckbox", { name: /VOL/ })).toBeNull();
    // Open it → one row per option, VOL seeded as checked, label as tooltip.
    await userEvent.click(trigger);
    const vol = screen.getByRole("menuitemcheckbox", { name: /VOL/ });
    expect(vol).toHaveAttribute("title", "Volume");
    expect(vol).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: /MACD/ })).toHaveAttribute("aria-checked", "false");
  });

  it("toggles an indicator on and off through the handle", async () => {
    const { handle } = fakeHandle();
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: "MACD", label: "MACD", pane: "new" }]} />);
    await userEvent.click(screen.getByRole("button", { name: /Indicators/ }));
    const opt = screen.getByRole("menuitemcheckbox", { name: /MACD/ });

    await userEvent.click(opt);
    expect(handle.addIndicator).toHaveBeenCalledWith({ name: "MACD", pane: "new" });
    expect(opt).toHaveAttribute("aria-checked", "true");

    await userEvent.click(opt);
    expect(handle.removeIndicator).toHaveBeenCalledWith("MACD");
    expect(opt).toHaveAttribute("aria-checked", "false");
  });
});

describe("IndicatorMenu — volume-trend row (#79 toggle)", () => {
  it("offers VOLTREND in the default options", () => {
    const opt = DEFAULT_INDICATOR_OPTIONS.find((o) => o.name === VOLUME_TREND_OPTION);
    expect(opt).toBeTruthy();
    expect(opt!.pane).toBeUndefined(); // not a pane study
  });

  it("toggles the header row via setVolumeTrendEnabled, not add/removeIndicator", async () => {
    const { handle } = fakeHandle();
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: VOLUME_TREND_OPTION, label: "Volume Trend (header row)" }]} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await userEvent.click(screen.getByRole("button", { name: /Indicators/ }));
    const opt = screen.getByRole("menuitemcheckbox", { name: /VOLTREND/ });

    await userEvent.click(opt);
    expect(handle.setVolumeTrendEnabled).toHaveBeenCalledWith(true);
    expect(handle.addIndicator).not.toHaveBeenCalled();
    expect(opt).toHaveAttribute("aria-checked", "true"); // via the subscription

    await userEvent.click(opt);
    expect(handle.setVolumeTrendEnabled).toHaveBeenCalledWith(false);
    expect(handle.removeIndicator).not.toHaveBeenCalled();
    expect(opt).toHaveAttribute("aria-checked", "false");
  });

  it("seeds checked when the chart-level flag is already on", async () => {
    const { handle, enableTrend } = fakeHandle();
    enableTrend(); // e.g. seeded by <ChartHeader volumeTrend>
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: VOLUME_TREND_OPTION, label: "Volume Trend (header row)" }]} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole("button", { name: /Indicators/ })).toHaveTextContent("(1)");
    await userEvent.click(screen.getByRole("button", { name: /Indicators/ }));
    expect(screen.getByRole("menuitemcheckbox", { name: /VOLTREND/ })).toHaveAttribute("aria-checked", "true");
  });
});
