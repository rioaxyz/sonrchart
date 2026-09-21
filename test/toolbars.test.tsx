import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { DrawingToolbar } from "../src/DrawingToolbar";
import { ChartToolbar } from "../src/ChartToolbar";
import { downloadSnapshot } from "../src/snapshot";
import type { SonrChartHandle } from "../src/SonrChart";

function fakeHandle(): SonrChartHandle {
  return {
    chart: () => null,
    addIndicator: vi.fn(),
    removeIndicator: vi.fn(),
    listIndicators: vi.fn(() => []),
    startDrawing: vi.fn(),
    clearDrawings: vi.fn(),
    snapshot: vi.fn(() => "data:image/png;base64,FAKE"),
    exportState: vi.fn(),
    importState: vi.fn(),
  };
}
function ref(handle: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as any).current = handle;
  return r;
}

describe("DrawingToolbar (#3)", () => {
  it("starts a drawing per tool and clears via the ref", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[{ tool: "segment", label: "Trend line" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Trend line" }));
    expect(h.startDrawing).toHaveBeenCalledWith("segment");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(h.clearDrawings).toHaveBeenCalled();
  });
});

describe("ChartToolbar (#17)", () => {
  it("renders intervals, indicator menu, drawing tools, and a snapshot button", () => {
    const h = fakeHandle();
    render(
      <ChartToolbar
        chartRef={ref(h)}
        intervals={["1", "5"]}
        interval="1"
        onIntervalChange={vi.fn()}
        indicatorOptions={[{ name: "VOL", label: "Volume" }]}
        drawingTools={[{ tool: "segment", label: "Trend line" }]}
      />,
    );
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "VOL" })).toBeInTheDocument(); // indicator menu
    expect(screen.getByRole("button", { name: "Trend line" })).toBeInTheDocument(); // drawing
    expect(screen.getByRole("button", { name: "Snapshot" })).toBeInTheDocument();
  });

  it("fires onIntervalChange when an interval is clicked", async () => {
    const h = fakeHandle();
    const onIntervalChange = vi.fn();
    render(<ChartToolbar chartRef={ref(h)} intervals={["1", "5"]} interval="1" onIntervalChange={onIntervalChange} showDrawing={false} showSnapshot={false} />);
    await userEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onIntervalChange).toHaveBeenCalledWith("5");
  });

  it("snapshot button downloads the picture", async () => {
    const h = fakeHandle();
    const click = vi.fn();
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag) as any;
      if (tag === "a") el.click = click;
      return el;
    });
    render(<ChartToolbar chartRef={ref(h)} showDrawing={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(h.snapshot).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("downloadSnapshot (#20)", () => {
  it("returns false when there is no chart", () => {
    expect(downloadSnapshot(null)).toBe(false);
  });
  it("triggers a download from the data url", () => {
    const h = fakeHandle();
    const click = vi.fn();
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag) as any;
      if (tag === "a") el.click = click;
      return el;
    });
    expect(downloadSnapshot(h, "my.png")).toBe(true);
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
