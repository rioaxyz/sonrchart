import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { DrawingToolbar } from "../src/DrawingToolbar";
import { ChartToolbar } from "../src/ChartToolbar";
import { downloadSnapshot } from "../src/snapshot";
import type { SonrChartHandle } from "../src/SonrChart";

function fakeHandle(): SonrChartHandle {
  // Minimal armed-drawing pub/sub so the DrawingToolbar's highlight can be
  // exercised: startDrawing arms a tool, cancelDrawing clears it, subscribers
  // (the toolbar) are notified.
  let activeTool: any = null;
  const subs = new Set<(t: any) => void>();
  const set = (t: any) => {
    activeTool = t;
    subs.forEach((cb) => cb(t));
  };
  // Magnet + history sims so the magnet toggle and undo/redo can be exercised.
  let magnet: any = undefined;
  const magSubs = new Set<(m: any) => void>();
  const histSubs = new Set<() => void>();
  let undoable = false;
  let redoable = false;
  return {
    chart: () => null,
    addIndicator: vi.fn(),
    removeIndicator: vi.fn(),
    listIndicators: vi.fn(() => []),
    startDrawing: vi.fn((t: any) => set(t)),
    cancelDrawing: vi.fn(() => set(null)),
    activeDrawing: () => activeTool,
    subscribeDrawing: (cb: (t: any) => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    clearDrawings: vi.fn(),
    snapshot: vi.fn(() => "data:image/png;base64,FAKE"),
    exportState: vi.fn(),
    importState: vi.fn(),
    getMagnet: () => magnet,
    setMagnet: vi.fn((m: any) => {
      magnet = m;
      magSubs.forEach((cb) => cb(m));
    }),
    subscribeMagnet: (cb: (m: any) => void) => {
      magSubs.add(cb);
      return () => magSubs.delete(cb);
    },
    canUndo: () => undoable,
    canRedo: () => redoable,
    undo: vi.fn(),
    redo: vi.fn(),
    subscribeHistory: (cb: () => void) => {
      histSubs.add(cb);
      return () => histSubs.delete(cb);
    },
    // Handle-driven (uncontrolled) display settings.
    getCandleStyle: () => "candle",
    setCandleStyle: vi.fn(),
    subscribeCandleStyle: (_cb: (v: any) => void) => () => {},
    getPriceScale: () => ({ type: "normal" }),
    setPriceScale: vi.fn(),
    subscribePriceScale: (_cb: (v: any) => void) => () => {},
    getSessions: () => false,
    setSessions: vi.fn(),
    subscribeSessions: (_cb: (v: any) => void) => () => {},
    getWatermark: () => false,
    setWatermark: vi.fn(),
    subscribeWatermark: (_cb: (v: any) => void) => () => {},
    // test hooks (not part of the real handle)
    _setHistory: (u: boolean, r: boolean) => {
      undoable = u;
      redoable = r;
      histSubs.forEach((cb) => cb());
    },
  } as unknown as SonrChartHandle;
}
function ref(handle: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as any).current = handle;
  return r;
}

describe("DrawingToolbar (#3)", () => {
  const openTools = () => userEvent.click(screen.getByRole("button", { name: /Drawing tools/ }));
  const toolsTrigger = () => screen.getByRole("button", { name: /Drawing tools/ });

  it("opens a tool dropdown, starts a drawing per tool, and clears via the ref", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[{ tool: "segment", label: "Trend line" }]} />);
    await openTools();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Trend line" }));
    expect(h.startDrawing).toHaveBeenCalledWith("segment");
    // Clear stays a direct button.
    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(h.clearDrawings).toHaveBeenCalled();
  });

  it("highlights the armed tool and toggles it off on a second selection", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[{ tool: "segment", label: "Trend line" }, { tool: "fibonacciLine", label: "Fibonacci" }]} />);

    // Arm Trend line → the trigger reflects an active tool (dropdown closes).
    await openTools();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Trend line" }));
    expect(h.startDrawing).toHaveBeenCalledWith("segment");
    expect(toolsTrigger().classList.contains("on")).toBe(true);

    // Reopen → Trend line is checked, Fibonacci isn't.
    await openTools();
    expect(screen.getByRole("menuitemradio", { name: "Trend line" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Fibonacci" })).toHaveAttribute("aria-checked", "false");

    // Select it again → toggles off (cancel), trigger no longer active.
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Trend line" }));
    expect(h.cancelDrawing).toHaveBeenCalled();
    expect(toolsTrigger().classList.contains("on")).toBe(false);
  });

  it("cycles the magnet mode off → weak → strong through the ref", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[]} showClear={false} showHistory={false} />);
    const btn = screen.getByRole("button", { name: /Magnet/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn); // off → weak
    expect(h.setMagnet).toHaveBeenLastCalledWith("weak");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(btn); // weak → strong
    expect(h.setMagnet).toHaveBeenLastCalledWith("strong");
    await userEvent.click(btn); // strong → off
    expect(h.setMagnet).toHaveBeenLastCalledWith(undefined);
  });

  it("enables undo/redo only when the chart reports history available", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[]} showClear={false} showMagnet={false} />);
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    act(() => (h as any)._setHistory(true, false));
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
    await userEvent.click(undo);
    expect(h.undo).toHaveBeenCalled();
  });

  it("clears the trigger highlight when the drawing is placed (armed → null)", async () => {
    const h = fakeHandle();
    render(<DrawingToolbar chartRef={ref(h)} tools={[{ tool: "segment", label: "Trend line" }]} />);
    await openTools();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Trend line" }));
    expect(toolsTrigger().classList.contains("on")).toBe(true);
    // Simulate the chart reporting the drawing as placed (onDrawEnd → null).
    act(() => (h as any).cancelDrawing()); // set(null) via the mock's pub/sub
    expect(toolsTrigger().classList.contains("on")).toBe(false);
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
    expect(screen.getByRole("button", { name: /Indicators/ })).toBeInTheDocument(); // indicator dropdown trigger
    expect(screen.getByRole("button", { name: /Drawing tools/ })).toBeInTheDocument(); // drawing-tools dropdown
    expect(screen.getByRole("button", { name: "Snapshot" })).toBeInTheDocument();
  });

  it("out of the box (no host callbacks) drives candle/scale/sessions via the handle", async () => {
    const h = fakeHandle();
    // Only interval is wired; candle type, price scale, and sessions still render
    // and drive the chart through its handle.
    render(<ChartToolbar chartRef={ref(h)} intervals={["1"]} interval="1" onIntervalChange={vi.fn()} showDrawing={false} showSnapshot={false} showSettings={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Candle type/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Heikin Ashi/ }));
    expect(h.setCandleStyle).toHaveBeenCalledWith("heikin_ashi");

    await userEvent.click(screen.getByRole("button", { name: /Scale/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Logarithmic" }));
    expect(h.setPriceScale).toHaveBeenCalledWith(expect.objectContaining({ type: "logarithm" }));

    await userEvent.click(screen.getByRole("button", { name: "Sessions" }));
    expect(h.setSessions).toHaveBeenCalledWith(true);
  });

  it("fires onIntervalChange when an interval is clicked", async () => {
    const h = fakeHandle();
    const onIntervalChange = vi.fn();
    render(<ChartToolbar chartRef={ref(h)} intervals={["1", "5"]} interval="1" onIntervalChange={onIntervalChange} showDrawing={false} showSnapshot={false} />);
    await userEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onIntervalChange).toHaveBeenCalledWith("5");
  });

  it("shows edge scroll-hint chevrons only for the scrollable direction", async () => {
    const h = fakeHandle();
    render(<ChartToolbar chartRef={ref(h)} intervals={["1", "5"]} interval="1" onIntervalChange={vi.fn()} showDrawing={false} showSnapshot={false} />);
    const bar = screen.getByRole("toolbar");
    const set = (prop: string, value: number) => Object.defineProperty(bar, prop, { configurable: true, writable: true, value });
    (bar as any).scrollBy = vi.fn();

    // Overflowing, scrolled to the start → only the right chevron.
    set("scrollWidth", 300);
    set("clientWidth", 100);
    set("scrollLeft", 0);
    fireEvent.scroll(bar);
    expect(screen.getByLabelText("Scroll toolbar right")).toBeInTheDocument();
    expect(screen.queryByLabelText("Scroll toolbar left")).toBeNull();

    // Scrolled into the middle → both chevrons.
    set("scrollLeft", 150);
    fireEvent.scroll(bar);
    expect(screen.getByLabelText("Scroll toolbar left")).toBeInTheDocument();
    expect(screen.getByLabelText("Scroll toolbar right")).toBeInTheDocument();

    // Clicking a chevron nudges the scroller. (fireEvent bypasses the
    // pointer-events:none the hover-reveal CSS applies while not hovered.)
    fireEvent.click(screen.getByLabelText("Scroll toolbar right"));
    expect((bar as any).scrollBy).toHaveBeenCalled();
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
