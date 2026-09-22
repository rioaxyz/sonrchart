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
