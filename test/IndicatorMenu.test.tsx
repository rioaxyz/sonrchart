import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { IndicatorMenu } from "../src/IndicatorMenu";
import type { SonrChartHandle } from "../src/SonrChart";

// A fake chart handle backed by an in-memory indicator set, so the menu can be
// tested without a real chart.
function fakeHandle() {
  const set = new Set<string>();
  const handle: SonrChartHandle = {
    chart: () => null,
    addIndicator: vi.fn((i) => set.add(typeof i === "string" ? i : i.name)),
    removeIndicator: vi.fn((n) => set.delete(n)),
    listIndicators: vi.fn(() => [...set]),
  };
  return { handle, set };
}

describe("IndicatorMenu (#4 config UI)", () => {
  it("renders a button per option and seeds active state from the chart", async () => {
    const { handle, set } = fakeHandle();
    set.add("VOL");
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: "VOL", label: "Volume" }, { name: "MACD", label: "MACD" }]} />);
    // buttons present (accessible name is the button text = the indicator name)
    expect(screen.getByRole("button", { name: "VOL" })).toBeInTheDocument();
    // it carries the label as a tooltip
    expect(screen.getByRole("button", { name: "VOL" })).toHaveAttribute("title", "Volume");
    // Flush the mount-tick seed (setTimeout 0) inside act, then assert VOL is pressed.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole("button", { name: "VOL" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles an indicator on and off through the handle", async () => {
    const { handle } = fakeHandle();
    const ref = createRef<SonrChartHandle>();
    (ref as any).current = handle;
    render(<IndicatorMenu chartRef={ref} options={[{ name: "MACD", label: "MACD", pane: "new" }]} />);
    const btn = screen.getByRole("button", { name: /MACD/ });

    await userEvent.click(btn);
    expect(handle.addIndicator).toHaveBeenCalledWith({ name: "MACD", pane: "new" });
    expect(btn).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(btn);
    expect(handle.removeIndicator).toHaveBeenCalledWith("MACD");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });
});
