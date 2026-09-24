import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { NavControlBar } from "../src/NavControlBar";
import type { SonrChartHandle } from "../src/SonrChart";
import type { Labels } from "../src/labels";

// Label keys this widget introduces (the lead adds them to Labels + defaults).
// Supplied here so the buttons have stable, queryable accessible names.
const navLabels: Partial<Labels> = {
  navControls: "Chart navigation",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  fitContent: "Fit all data",
  goToRealtime: "Go to realtime",
} as Partial<Labels>;

function fakeHandle() {
  return {
    zoomOut: vi.fn(),
    zoomIn: vi.fn(),
    setVisibleDuration: vi.fn((_ms: number) => {}),
    scrollToRealTime: vi.fn(),
  } as unknown as SonrChartHandle;
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

describe("NavControlBar (#45)", () => {
  it("renders the four navigation buttons", () => {
    render(<NavControlBar chartRef={ref(fakeHandle())} labels={navLabels} />);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit all data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to realtime" })).toBeInTheDocument();
  });

  it("zoom out calls zoomOut", async () => {
    const h = fakeHandle();
    render(<NavControlBar chartRef={ref(h)} labels={navLabels} />);
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(h.zoomOut).toHaveBeenCalledTimes(1);
    expect(h.zoomIn).not.toHaveBeenCalled();
  });

  it("zoom in calls zoomIn", async () => {
    const h = fakeHandle();
    render(<NavControlBar chartRef={ref(h)} labels={navLabels} />);
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(h.zoomIn).toHaveBeenCalledTimes(1);
    expect(h.zoomOut).not.toHaveBeenCalled();
  });

  it("fit calls setVisibleDuration(Infinity)", async () => {
    const h = fakeHandle();
    render(<NavControlBar chartRef={ref(h)} labels={navLabels} />);
    await userEvent.click(screen.getByRole("button", { name: "Fit all data" }));
    expect(h.setVisibleDuration).toHaveBeenCalledWith(Infinity);
  });

  it("realtime calls scrollToRealTime", async () => {
    const h = fakeHandle();
    render(<NavControlBar chartRef={ref(h)} labels={navLabels} />);
    await userEvent.click(screen.getByRole("button", { name: "Go to realtime" }));
    expect(h.scrollToRealTime).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the handle is not yet attached", async () => {
    const r = createRef<SonrChartHandle>();
    render(<NavControlBar chartRef={r} labels={navLabels} />);
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    // Optional chaining on a null handle is a no-op — no assertion needed beyond
    // the click not throwing.
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });
});
