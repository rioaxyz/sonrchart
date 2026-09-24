import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { TimeframeBar, DEFAULT_RANGES } from "../src/TimeframeBar";
import type { SonrChartHandle } from "../src/SonrChart";

const DAY = 24 * 60 * 60 * 1000;

function fakeHandle() {
  return { setVisibleDuration: vi.fn() } as unknown as SonrChartHandle;
}
function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

describe("TimeframeBar / lookback ranges (#45)", () => {
  it("renders the default lookback ranges", () => {
    render(<TimeframeBar chartRef={ref(fakeHandle())} interval="30" />);
    for (const r of DEFAULT_RANGES) expect(screen.getByRole("button", { name: r.label })).toBeInTheDocument();
  });

  it("applies the window via setVisibleDuration and highlights the pick", async () => {
    const h = fakeHandle();
    render(<TimeframeBar chartRef={ref(h)} interval="30" />);
    const oneM = screen.getByRole("button", { name: "1M" });
    await userEvent.click(oneM);
    expect(h.setVisibleDuration).toHaveBeenCalledWith(30 * DAY);
    expect(oneM).toHaveAttribute("aria-pressed", "true");
    // "All" fits everything.
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(h.setVisibleDuration).toHaveBeenCalledWith(Infinity);
  });

  it("tooltip reads '{range} in {resolution} intervals'", () => {
    render(<TimeframeBar chartRef={ref(fakeHandle())} interval="30" />);
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("title", "1 month in 30 minute intervals");
    expect(screen.getByRole("button", { name: "1D" })).toHaveAttribute("title", "1 day in 30 minute intervals");
  });

  it("honors a custom range set", async () => {
    const h = fakeHandle();
    render(<TimeframeBar chartRef={ref(h)} interval="1" ranges={[{ label: "2D", ms: 2 * DAY, title: "2 days" }]} />);
    expect(screen.queryByRole("button", { name: "1M" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(h.setVisibleDuration).toHaveBeenCalledWith(2 * DAY);
  });
});
