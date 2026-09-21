import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef } from "react";

// A stateful KLineChart mock: init() returns a spy-backed chart that tracks
// created indicators so SonrChart's reconcile logic (which reads getIndicators)
// behaves. Registry is hoisted so the vi.mock factory can reach it.
const h = vi.hoisted(() => {
  const charts: any[] = [];
  const make = () => {
    const inds: string[] = [];
    const chart: any = {
      _overlays: [] as any[],
      setStyles: vi.fn(),
      setDataLoader: vi.fn(),
      setSymbol: vi.fn(),
      setPeriod: vi.fn(),
      createIndicator: vi.fn((v: any) => {
        const name = typeof v === "string" ? v : v.name;
        inds.push(name);
        return "pane_" + name;
      }),
      getIndicators: vi.fn((f?: any) =>
        (f?.name ? inds.filter((n) => n === f.name) : inds).map((n) => ({ name: n })),
      ),
      overrideIndicator: vi.fn(),
      removeIndicator: vi.fn((f?: any) => {
        const i = inds.indexOf(f?.name);
        if (i >= 0) inds.splice(i, 1);
        return true;
      }),
      createOverlay: vi.fn((o: any) => {
        chart._overlays.push(o);
        return "ov_" + chart._overlays.length;
      }),
      removeOverlay: vi.fn(),
    };
    charts.push(chart);
    return chart;
  };
  return { charts, make };
});

vi.mock("klinecharts", () => ({
  init: vi.fn(() => h.make()),
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
