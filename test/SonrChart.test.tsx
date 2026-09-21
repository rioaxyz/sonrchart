import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef } from "react";

// A stateful KLineChart mock: init() returns a spy-backed chart that tracks
// created indicators so SonrChart's reconcile logic (which reads getIndicators)
// behaves. Registry is hoisted so the vi.mock factory can reach it.
const h = vi.hoisted(() => {
  const charts: any[] = [];
  const make = () => {
    const inds: { name: string; paneId: string }[] = [];
    let ovSeq = 0;
    const chart: any = {
      _overlays: [] as any[],
      setStyles: vi.fn(),
      setDataLoader: vi.fn(),
      setSymbol: vi.fn(),
      setPeriod: vi.fn(),
      setPaneOptions: vi.fn(),
      getConvertPictureUrl: vi.fn(() => "data:image/png;base64,FAKE"),
      getDataList: vi.fn(() => [
        { timestamp: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
        { timestamp: 2000, open: 1.5, high: 2.2, low: 1.4, close: 2.0, volume: 20 },
      ]),
      createIndicator: vi.fn((v: any) => {
        const name = typeof v === "string" ? v : v.name;
        const paneId = v?.paneId ?? "pane_" + name;
        inds.push({ name, paneId });
        return paneId;
      }),
      getIndicators: vi.fn((f?: any) => (f?.name ? inds.filter((i) => i.name === f.name) : inds.slice())),
      overrideIndicator: vi.fn(),
      removeIndicator: vi.fn((f?: any) => {
        const i = inds.findIndex((x) => x.name === f?.name);
        if (i >= 0) inds.splice(i, 1);
        return true;
      }),
      createOverlay: vi.fn((o: any) => {
        const id = "ov_" + ++ovSeq;
        chart._overlays.push({ id, ...o });
        return id;
      }),
      getOverlays: vi.fn((f?: any) =>
        f?.groupId ? chart._overlays.filter((o: any) => o.groupId === f.groupId) : chart._overlays.slice(),
      ),
      removeOverlay: vi.fn((f?: any) => {
        if (f?.groupId) chart._overlays = chart._overlays.filter((o: any) => o.groupId !== f.groupId);
        else if (f?.id) chart._overlays = chart._overlays.filter((o: any) => o.id !== f.id);
        return true;
      }),
    };
    charts.push(chart);
    return chart;
  };
  return { charts, make };
});

vi.mock("klinecharts", () => ({
  init: vi.fn((_el: unknown, opts: unknown) => {
    const c = h.make();
    c._initOptions = opts;
    return c;
  }),
  dispose: vi.fn(),
  registerIndicator: vi.fn(),
}));

import { SonrChart, type SonrChartHandle } from "../src/SonrChart";
import { SESSION_INDICATOR, PATTERN_INDICATOR, DEFAULT_SESSION_COLORS } from "../src/indicators";
import type { DataSource } from "../src/types";

const bars = [
  { time: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
  { time: 2000, open: 1.5, high: 2.2, low: 1.4, close: 2.0, volume: 20 },
];
function source(): DataSource {
  return { getBars: vi.fn(async () => bars), subscribe: vi.fn(() => vi.fn()) };
}

const lastChart = () => h.charts[h.charts.length - 1];

beforeEach(() => {
  h.charts.length = 0;
  vi.clearAllMocks();
});

describe("SonrChart — initialization", () => {
  it("inits, wires the data loader, and sets symbol + period", () => {
    render(<SonrChart symbol="AAPL" interval="5" dataSource={source()} />);
    const c = lastChart();
    expect(c.setDataLoader).toHaveBeenCalledOnce();
    expect(c.setSymbol).toHaveBeenCalledWith({ ticker: "AAPL" });
    expect(c.setPeriod).toHaveBeenCalledWith({ type: "minute", span: 5 });
  });

  it("loads bars through the DataSource and maps them to KLineData", async () => {
    const ds = source();
    render(<SonrChart symbol="AAPL" dataSource={ds} />);
    const loader = lastChart().setDataLoader.mock.calls[0][0];
    const callback = vi.fn();
    await act(async () => {
      await loader.getBars({ type: "init", callback });
    });
    expect(ds.getBars).toHaveBeenCalledWith("AAPL", "1", 500);
    expect(callback).toHaveBeenCalledWith(
      [
        { timestamp: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
        { timestamp: 2000, open: 1.5, high: 2.2, low: 1.4, close: 2.0, volume: 20 },
      ],
      false,
    );
  });

  it("does not paginate backward in this version", async () => {
    render(<SonrChart symbol="AAPL" dataSource={source()} />);
    const loader = lastChart().setDataLoader.mock.calls[0][0];
    const callback = vi.fn();
    await act(async () => await loader.getBars({ type: "backward", callback }));
    expect(callback).toHaveBeenCalledWith([], false);
  });
});

describe("SonrChart — indicators (#4)", () => {
  it("creates the default VOL indicator", () => {
    render(<SonrChart symbol="A" dataSource={source()} />);
    const names = lastChart().createIndicator.mock.calls.map((c: any[]) => c[0]?.name ?? c[0]);
    expect(names).toContain("VOL");
  });

  it("honors indicator specs with pane placement", () => {
    render(<SonrChart symbol="A" dataSource={source()} indicators={[{ name: "MA", pane: "main", calcParams: [5, 10] }]} />);
    const call = lastChart().createIndicator.mock.calls.find((c: any[]) => c[0]?.name === "MA");
    expect(call[0]).toMatchObject({ name: "MA", paneId: "candle_pane", calcParams: [5, 10] });
  });

  it("ref exposes add / remove / list", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} indicators={[]} />);
    act(() => ref.current!.addIndicator("RSI"));
    expect(ref.current!.listIndicators()).toContain("RSI");
    act(() => ref.current!.removeIndicator("RSI"));
    expect(ref.current!.listIndicators()).not.toContain("RSI");
  });

  it("list excludes the internal session/pattern indicators", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} sessions patterns={[{ time: 1000 }]} indicators={["VOL"]} />);
    expect(ref.current!.listIndicators()).toEqual(["VOL"]);
  });
});

describe("SonrChart — session tinting (#10)", () => {
  it("creates the session indicator with resolved colors, and removes it when turned off", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} sessions />);
    const c = lastChart();
    const sess = c.createIndicator.mock.calls.find((call: any[]) => call[0]?.name === SESSION_INDICATOR);
    expect(sess[0]).toMatchObject({ name: SESSION_INDICATOR, paneId: "candle_pane", extendData: DEFAULT_SESSION_COLORS });

    rerender(<SonrChart symbol="A" dataSource={source()} sessions={false} />);
    expect(c.removeIndicator).toHaveBeenCalledWith({ name: SESSION_INDICATOR });
  });

  it("passes custom session colors and overrides on change", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} sessions={{ premarket: "#123456" }} />);
    const c = lastChart();
    rerender(<SonrChart symbol="A" dataSource={source()} sessions={{ premarket: "#abcdef" }} />);
    const override = c.overrideIndicator.mock.calls.filter((call: any[]) => call[0]?.name === SESSION_INDICATOR).at(-1);
    expect(override![0].extendData.premarket).toBe("#abcdef");
  });
});

describe("SonrChart — pattern markers (#5)", () => {
  it("creates the pattern indicator carrying the markers, then overrides on change", () => {
    const p1 = [{ time: 1000, kind: "long" as const, label: "AT" }];
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} patterns={p1} />);
    const c = lastChart();
    const create = c.createIndicator.mock.calls.find((call: any[]) => call[0]?.name === PATTERN_INDICATOR);
    expect(create[0].extendData).toEqual(p1);

    const p2 = [...p1, { time: 2000, kind: "short" as const }];
    rerender(<SonrChart symbol="A" dataSource={source()} patterns={p2} />);
    const override = c.overrideIndicator.mock.calls.filter((call: any[]) => call[0]?.name === PATTERN_INDICATOR).at(-1);
    expect(override![0].extendData).toEqual(p2);
  });

  it("removes the pattern indicator when markers go empty", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} patterns={[{ time: 1 }]} />);
    const c = lastChart();
    rerender(<SonrChart symbol="A" dataSource={source()} patterns={[]} />);
    expect(c.removeIndicator).toHaveBeenCalledWith({ name: PATTERN_INDICATOR });
  });
});

describe("SonrChart — price lines & draggable order lines (#19)", () => {
  it("creates static price lines locked", () => {
    render(<SonrChart symbol="A" dataSource={source()} priceLines={[{ price: 100, label: "Entry" }]} />);
    const ov = lastChart()._overlays.find((o: any) => o.extendData === "Entry");
    expect(ov).toMatchObject({ name: "priceLine", lock: true });
    expect(ov.points).toEqual([{ value: 100 }]);
  });

  it("creates order lines unlocked and fires onMove on drag", () => {
    const onMove = vi.fn();
    render(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50, label: "Ord", onMove }]} />);
    const ov = lastChart()._overlays.find((o: any) => o.extendData === "Ord");
    expect(ov).toMatchObject({ name: "priceLine", lock: false });
    expect(typeof ov.onPressedMoving).toBe("function");
    // Simulate KLine handing back the dragged overlay's new value.
    ov.onPressedMoving({ overlay: { points: [{ value: 51.25 }] } });
    ov.onPressedMoveEnd({ overlay: { points: [{ value: 52.5 }] } });
    expect(onMove).toHaveBeenNthCalledWith(1, 51.25, "moving");
    expect(onMove).toHaveBeenNthCalledWith(2, 52.5, "end");
  });

  it("respects draggable:false by locking the order line", () => {
    render(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50, draggable: false }]} />);
    const ov = lastChart()._overlays.at(-1);
    expect(ov.lock).toBe(true);
  });
});

describe("SonrChart — drawing tools & magnet (#3, #13)", () => {
  it("startDrawing creates a tagged overlay; clearDrawings removes them", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    act(() => ref.current!.startDrawing("fibonacciLine"));
    const c = lastChart();
    expect(c._overlays.some((o: any) => o.name === "fibonacciLine" && o.groupId === "sonr-user-drawing")).toBe(true);
    act(() => ref.current!.clearDrawings());
    expect(c.removeOverlay).toHaveBeenCalledWith({ groupId: "sonr-user-drawing" });
    expect(c._overlays.some((o: any) => o.groupId === "sonr-user-drawing")).toBe(false);
  });

  it("applies the magnet mode to new drawings", () => {
    const ref = createRef<SonrChartHandle>();
    const { rerender } = render(<SonrChart ref={ref} symbol="A" dataSource={source()} magnet="strong" />);
    act(() => ref.current!.startDrawing("segment"));
    expect(lastChart()._overlays.at(-1)).toMatchObject({ name: "segment", mode: "strong_magnet" });
    rerender(<SonrChart ref={ref} symbol="A" dataSource={source()} magnet={false} />);
    act(() => ref.current!.startDrawing("segment"));
    expect(lastChart()._overlays.at(-1)).toMatchObject({ mode: "normal" });
  });
});

describe("SonrChart — pane heights (#7)", () => {
  it("sets a sub-pane height by indicator name", () => {
    render(<SonrChart symbol="A" dataSource={source()} indicators={["VOL", "MACD"]} paneHeights={{ MACD: 120 }} />);
    expect(lastChart().setPaneOptions).toHaveBeenCalledWith({ id: "pane_MACD", height: 120 });
  });
});

describe("SonrChart — symbol resolution (#8)", () => {
  const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

  it("sets the resolved symbol info", async () => {
    const info = { ticker: "AAPL", name: "Apple", pricePrecision: 2 };
    const ds: DataSource = { getBars: vi.fn(async () => bars), resolveSymbol: vi.fn(async () => info) };
    render(<SonrChart symbol="AAPL" dataSource={ds} />);
    await flush();
    expect(ds.resolveSymbol).toHaveBeenCalledWith("AAPL");
    expect(lastChart().setSymbol).toHaveBeenCalledWith(info);
  });

  it("skips loading and fires onSymbolError for an unknown symbol", async () => {
    const onSymbolError = vi.fn();
    const ds: DataSource = { getBars: vi.fn(async () => bars), resolveSymbol: vi.fn(async () => null) };
    render(<SonrChart symbol="BAD" dataSource={ds} onSymbolError={onSymbolError} />);
    await flush();
    expect(onSymbolError).toHaveBeenCalledWith("BAD");
    expect(lastChart().setSymbol).not.toHaveBeenCalled();
  });
});

describe("SonrChart — price scale (#12)", () => {
  it("sets the scale type + inversion on the y-axis at init", () => {
    render(<SonrChart symbol="A" dataSource={source()} priceScale={{ type: "logarithm", invert: true }} />);
    expect(lastChart()._initOptions.layout.yAxis).toMatchObject({ name: "logarithm", reverse: true });
  });

  it("re-inits (new chart) when the scale type changes", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} priceScale={{ type: "normal" }} />);
    const before = h.charts.length;
    rerender(<SonrChart symbol="A" dataSource={source()} priceScale={{ type: "percentage" }} />);
    expect(h.charts.length).toBe(before + 1); // rebuilt
    expect(lastChart()._initOptions.layout.yAxis).toMatchObject({ name: "percentage" });
  });
});

describe("SonrChart — snapshot (#20)", () => {
  it("returns the chart picture url", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    expect(ref.current!.snapshot()).toBe("data:image/png;base64,FAKE");
    expect(lastChart().getConvertPictureUrl).toHaveBeenCalledWith(true, "png", undefined);
  });
});

describe("SonrChart — persistence (#15)", () => {
  it("exports drawings + indicators + price scale and re-imports them", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} indicators={["VOL"]} priceScale={{ type: "percentage" }} />);
    act(() => ref.current!.startDrawing("segment"));
    const c = lastChart();
    // Give the drawing some points, as a finished overlay would have.
    c._overlays.find((o: any) => o.name === "segment").points = [{ value: 1 }, { value: 2 }];

    const state = ref.current!.exportState();
    expect(state.version).toBe(1);
    expect(state.indicators.map((i) => i.name)).toContain("VOL");
    expect(state.drawings.find((d) => d.name === "segment")!.points).toEqual([{ value: 1 }, { value: 2 }]);
    expect(state.priceScale).toEqual({ type: "percentage" });

    act(() => ref.current!.importState(state));
    // Re-import clears then recreates: exactly one segment remains.
    expect(c._overlays.filter((o: any) => o.name === "segment").length).toBe(1);
  });

  it("ignores state with the wrong version", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.importState({ version: 99 as any, drawings: [], indicators: [] }));
    expect(c.removeOverlay).not.toHaveBeenCalledWith({ groupId: "sonr-user-drawing" });
  });
});

describe("SonrChart — overlay reconcile guard (perf)", () => {
  it("does NOT rebuild overlays when order-line content is unchanged", () => {
    const lines = [{ id: "e", price: 50, label: "Ord", onMove: vi.fn() }];
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} orderLines={lines} />);
    const c = lastChart();
    const created = c.createOverlay.mock.calls.length;
    const removed = c.removeOverlay.mock.calls.length;
    // New array + new callback identity, same visual content.
    rerender(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50, label: "Ord", onMove: vi.fn() }]} />);
    expect(c.createOverlay.mock.calls.length).toBe(created);
    expect(c.removeOverlay.mock.calls.length).toBe(removed);
  });

  it("rebuilds when a line's price changes", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50 }]} />);
    const c = lastChart();
    const created = c.createOverlay.mock.calls.length;
    rerender(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 60 }]} />);
    expect(c.createOverlay.mock.calls.length).toBeGreaterThan(created);
  });

  it("routes drags to the latest onMove even without a rebuild", () => {
    const onMove1 = vi.fn();
    const onMove2 = vi.fn();
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50, onMove: onMove1 }]} />);
    const ov = lastChart()._overlays.find((o: any) => o.name === "priceLine" && o.lock === false);
    rerender(<SonrChart symbol="A" dataSource={source()} orderLines={[{ id: "e", price: 50, onMove: onMove2 }]} />);
    ov.onPressedMoveEnd({ overlay: { points: [{ value: 51 }] } });
    expect(onMove2).toHaveBeenCalledWith(51, "end");
    expect(onMove1).not.toHaveBeenCalled();
  });
});

describe("SonrChart — candle style (#1)", () => {
  it("sets the candle type from candleStyle", () => {
    render(<SonrChart symbol="A" dataSource={source()} candleStyle="hollow" />);
    const c = lastChart();
    const call = c.setStyles.mock.calls.find((x: any[]) => x[0]?.candle?.type);
    expect(call[0].candle.type).toBe("candle_stroke");
  });

  it("transforms bars to Heikin Ashi in the loader", async () => {
    const rawBars = [
      { time: 1, open: 10, high: 12, low: 9, close: 11 },
      { time: 2, open: 11, high: 13, low: 10, close: 12 },
    ];
    const ds: DataSource = { getBars: vi.fn(async () => rawBars) };
    render(<SonrChart symbol="A" dataSource={ds} candleStyle="heikin_ashi" />);
    const loader = lastChart().setDataLoader.mock.calls[0][0];
    const cb = vi.fn();
    await act(async () => await loader.getBars({ type: "init", callback: cb }));
    const passed = cb.mock.calls[0][0];
    // HA bar 0 close = (10+12+9+11)/4 = 10.5, not the raw close 11.
    expect(passed[0].close).toBeCloseTo(10.5);
  });
});

describe("SonrChart — compare overlay (#9)", () => {
  it("creates the compare indicator with ratio-scaled aligned lines", async () => {
    const cmp = [
      { time: 1000, open: 10, high: 10, low: 10, close: 10 },
      { time: 2000, open: 12, high: 12, low: 12, close: 12 },
    ];
    const ds: DataSource = { getBars: vi.fn(async () => cmp) };
    render(<SonrChart symbol="A" dataSource={ds} compareSeries={[{ symbol: "SPY", color: "#f00" }]} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const c = lastChart();
    const call = c.createIndicator.mock.calls.find((x: any[]) => x[0]?.name === "SONR_COMPARE");
    expect(call).toBeTruthy();
    const lines = call[0].extendData;
    expect(lines[0].color).toBe("#f00");
    // main closes [1.5, 2.0], cmp closes [10,12] → scale 1.5/10=0.15 → [1.5, 1.8]
    expect(lines[0].points.map((p: any) => p.value)).toEqual([1.5, 1.7999999999999998]);
  });
});

describe("SonrChart — study templates (#6)", () => {
  it("getIndicatorSet returns current specs; applyIndicatorSet replaces them", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} indicators={["VOL"]} />);
    expect(ref.current!.getIndicatorSet().map((s) => s.name)).toEqual(["VOL"]);
    act(() => ref.current!.applyIndicatorSet(["MACD", "RSI"]));
    expect(ref.current!.listIndicators().sort()).toEqual(["MACD", "RSI"]);
    expect(ref.current!.listIndicators()).not.toContain("VOL");
  });
});

describe("SonrChart — undo/redo (#16)", () => {
  it("tracks drawing history and restores on undo/redo", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    expect(ref.current!.canUndo()).toBe(false);

    // Draw two shapes; each onDrawEnd pushes history.
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.at(-1).onDrawEnd({});
    act(() => ref.current!.startDrawing("rayLine"));
    c._overlays.at(-1).onDrawEnd({});
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(2);
    expect(ref.current!.canUndo()).toBe(true);

    // Undo → back to one drawing.
    act(() => ref.current!.undo());
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(1);
    expect(ref.current!.canRedo()).toBe(true);

    // Redo → two again.
    act(() => ref.current!.redo());
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(2);
  });

  it("undo is a no-op at the start of history", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    act(() => ref.current!.undo());
    expect(ref.current!.canUndo()).toBe(false);
  });
});

describe("SonrChart — undo/redo tail truncation (#16)", () => {
  it("drops the redo tail when a new drawing is made after an undo", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    const draw = () => { act(() => ref.current!.startDrawing("segment")); c._overlays.at(-1).onDrawEnd({}); };
    draw();
    draw();
    act(() => ref.current!.undo()); // back to 1 drawing, redo available
    expect(ref.current!.canRedo()).toBe(true);
    draw(); // new drawing after undo → redo tail discarded
    expect(ref.current!.canRedo()).toBe(false);
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(2);
  });
});
