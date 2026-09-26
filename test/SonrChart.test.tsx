import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";
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
      setFormatter: vi.fn(),
      setDataLoader: vi.fn(),
      subscribeAction: vi.fn(),
      unsubscribeAction: vi.fn(),
      getSize: vi.fn(() => ({ width: 800, height: 400, left: 0, right: 0, top: 0, bottom: 0 })),
      getBarSpace: vi.fn(() => ({ bar: 8, halfBar: 4, gapBar: 6, halfGapBar: 3 })),
      getVisibleRange: vi.fn(() => ({ from: 0, to: 2, realFrom: 0, realTo: 2 })),
      setBarSpace: vi.fn(),
      scrollToRealTime: vi.fn(),
      scrollToTimestamp: vi.fn(),
      zoomAtCoordinate: vi.fn(),
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
        f?.id
          ? chart._overlays.filter((o: any) => o.id === f.id)
          : f?.groupId
            ? chart._overlays.filter((o: any) => o.groupId === f.groupId)
            : chart._overlays.slice(),
      ),
      removeOverlay: vi.fn((f?: any) => {
        if (f?.groupId) chart._overlays = chart._overlays.filter((o: any) => o.groupId !== f.groupId);
        else if (f?.id) chart._overlays = chart._overlays.filter((o: any) => o.id !== f.id);
        return true;
      }),
      overrideOverlay: vi.fn((o: any) => {
        const { id, groupId, name, ...rest } = o ?? {};
        for (const ov of chart._overlays) {
          const match = (id && ov.id === id) || (groupId && ov.groupId === groupId) || (name && ov.name === name) || (!id && !groupId && !name);
          if (match) Object.assign(ov, rest);
        }
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
  registerOverlay: vi.fn(),
  utils: {
    formatDate: vi.fn(() => "2026-09-21 19:39"),
    formatPrecision: vi.fn((v: number) => String(v)),
    formatThousands: vi.fn((v: string) => v),
    formatBigNumber: vi.fn((v: number) => String(v)),
  },
}));

import { SonrChart, type SonrChartHandle } from "../src/SonrChart";
import { SESSION_INDICATOR, PATTERN_INDICATOR, SERIES_INDICATOR, WATERMARK_INDICATOR, DEFAULT_SESSION_COLORS } from "../src/indicators";
import { registerTheme } from "../src/theme";
import { utils } from "klinecharts";
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

  it("stacks main-pane overlays (isStack=true) so they coexist — regression", () => {
    // KLineChart's addIndicator with isStack=false removes every indicator on the
    // target pane first, so two main-pane overlays would replace one another.
    render(
      <SonrChart symbol="A" dataSource={source()} indicators={[{ name: "MA", pane: "main" }, { name: "BOLL", pane: "main" }]} />,
    );
    const calls = lastChart().createIndicator.mock.calls;
    const ma = calls.find((c: any[]) => c[0]?.name === "MA");
    const boll = calls.find((c: any[]) => c[0]?.name === "BOLL");
    expect(ma[0]).toMatchObject({ name: "MA", paneId: "candle_pane" });
    expect(boll[0]).toMatchObject({ name: "BOLL", paneId: "candle_pane" });
    expect(ma[1]).toBe(true); // isStack
    expect(boll[1]).toBe(true);
  });

  it("creates the candle-pane layers with isStack=true so they don't wipe each other", () => {
    render(<SonrChart symbol="A" dataSource={source()} sessions watermark patterns={[{ time: 1000 }]} indicators={[]} />);
    const calls = lastChart().createIndicator.mock.calls;
    for (const name of ["SONR_SESSION", "SONR_WATERMARK", "SONR_PATTERNS"]) {
      const call = calls.find((c: any[]) => c[0]?.name === name);
      expect(call, name).toBeTruthy();
      expect(call[1], name).toBe(true); // isStack — never destructive to the pane
    }
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

  it("copies + pastes a drawing and reorders it via the handle (#35)", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("rectangle"));
    const row = ref.current!.listDrawings()[0];
    expect(row).toBeTruthy();
    const before = ref.current!.listDrawings().length;
    // Copy → paste creates a second drawing from the clipboard.
    act(() => ref.current!.copyDrawing(row.id));
    expect(ref.current!.canPasteDrawing()).toBe(true);
    act(() => ref.current!.pasteDrawing());
    expect(ref.current!.listDrawings().length).toBe(before + 1);
    // Z-order sets the overlay's zLevel via overrideOverlay.
    act(() => ref.current!.setDrawingZOrder(row.id, "front"));
    const zCall = c.overrideOverlay.mock.calls.map((a: any[]) => a[0]).find((o: any) => o?.id === row.id && "zLevel" in o);
    expect(zCall).toMatchObject({ id: row.id, fixedZLevel: true });
    expect(typeof zCall.zLevel).toBe("number");
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

  it("re-applies the session tint when the chart re-inits on an interval switch (#10)", () => {
    const { rerender } = render(<SonrChart symbol="A" interval="1" dataSource={source()} sessions />);
    const before = h.charts.length;
    // Switching interval re-creates the chart; the fresh chart must get sessions.
    rerender(<SonrChart symbol="A" interval="5" dataSource={source()} sessions />);
    expect(h.charts.length).toBeGreaterThan(before);
    const fresh = lastChart();
    const sess = fresh.createIndicator.mock.calls.find((call: any[]) => call[0]?.name === SESSION_INDICATOR);
    expect(sess?.[0]).toMatchObject({ name: SESSION_INDICATOR });
  });

  it("passes custom session colors and overrides on change", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} sessions={{ premarket: "#123456" }} />);
    const c = lastChart();
    rerender(<SonrChart symbol="A" dataSource={source()} sessions={{ premarket: "#abcdef" }} />);
    const override = c.overrideIndicator.mock.calls.filter((call: any[]) => call[0]?.name === SESSION_INDICATOR).at(-1);
    expect(override![0].extendData.premarket).toBe("#abcdef");
  });
});

describe("SonrChart — custom series styles (#33)", () => {
  it("draws SONR_SERIES with hidden bars for a custom style, and removes it when switching back", () => {
    const { rerender } = render(<SonrChart symbol="A" dataSource={source()} candleStyle="line" />);
    const c = lastChart();
    const create = c.createIndicator.mock.calls.find((call: any[]) => call[0]?.name === SERIES_INDICATOR);
    expect(create[0]).toMatchObject({ name: SERIES_INDICATOR, paneId: "candle_pane" });
    expect(create[0].extendData.style).toBe("line");
    // Native bars are hidden (fully transparent) while a custom series is active.
    const hid = c.setStyles.mock.calls.find((x: any[]) => x[0]?.candle?.bar?.upColor === "rgba(0,0,0,0)");
    expect(hid).toBeTruthy();

    rerender(<SonrChart symbol="A" dataSource={source()} candleStyle="candle" />);
    expect(c.removeIndicator).toHaveBeenCalledWith({ name: SERIES_INDICATOR });
  });
});

describe("SonrChart — watermark config", () => {
  it("draws only the chosen parts with the configured color+opacity, and removes when both off", () => {
    const { rerender } = render(
      <SonrChart symbol="AAPL" interval="5" dataSource={source()} watermark={{ symbol: true, interval: false, color: "#ff0000", opacity: 0.2 }} />,
    );
    const c = lastChart();
    const create = c.createIndicator.mock.calls.find((call: any[]) => call[0]?.name === WATERMARK_INDICATOR);
    expect(create[0].extendData).toMatchObject({ title: "AAPL", subtitle: "", color: "rgba(255,0,0,0.2)" });

    rerender(<SonrChart symbol="AAPL" interval="5" dataSource={source()} watermark={false} />);
    expect(c.removeIndicator).toHaveBeenCalledWith({ name: WATERMARK_INDICATOR });
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

  it("brush/highlighter map to the sonrBrush overlay with a preset style, ignoring magnet (#34)", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} theme="dark" magnet="strong" />);
    act(() => ref.current!.startDrawing("brush"));
    const brush = lastChart()._overlays.at(-1);
    expect(brush).toMatchObject({ name: "sonrBrush", mode: "normal", groupId: "sonr-user-drawing" });
    expect(brush.extendData).toMatchObject({ color: "#e6ebe9", size: 2 });
    // The toolbar highlights by the tool id ("brush"), not the overlay name.
    expect(ref.current!.activeDrawing()).toBe("brush");

    act(() => ref.current!.startDrawing("highlighter"));
    const hl = lastChart()._overlays.at(-1);
    expect(hl).toMatchObject({ name: "sonrBrush", mode: "normal" });
    expect(hl.extendData.size).toBe(14);
    expect(hl.extendData.color).toContain("rgba");
  });

  it("uses the configurable brush style for new strokes (get/set)", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} theme="dark" />);
    expect(ref.current!.getBrushStyle("brush")).toEqual({ color: "#e6ebe9", size: 2 });
    act(() => ref.current!.setBrushStyle("brush", { color: "#ff0000", size: 6 }));
    act(() => ref.current!.startDrawing("brush"));
    expect(lastChart()._overlays.at(-1).extendData).toEqual({ color: "#ff0000", size: 6 });
  });

  it("brush stays armed (sticky) after each stroke; a point tool deactivates (#34)", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("brush"));
    const before = c._overlays.length;
    act(() => c._overlays.at(-1).onDrawEnd({})); // finish a stroke
    expect(ref.current!.activeDrawing()).toBe("brush"); // still armed
    expect(c._overlays.length).toBeGreaterThan(before); // re-armed a fresh overlay

    // A point tool deactivates after placing one drawing.
    act(() => ref.current!.startDrawing("segment"));
    act(() => c._overlays.at(-1).onDrawEnd({}));
    expect(ref.current!.activeDrawing()).toBeNull();
  });
});

describe("SonrChart — drawing management tooling (#35)", () => {
  it("lock/hide all call overrideOverlay on the drawing group and mirror the state", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    // A placed drawing to override.
    act(() => ref.current!.startDrawing("segment"));
    act(() => c._overlays.at(-1).onDrawEnd({}));

    expect(ref.current!.getDrawingsLocked()).toBe(false);
    expect(ref.current!.getDrawingsVisible()).toBe(true);

    act(() => ref.current!.setDrawingsLocked(true));
    expect(ref.current!.getDrawingsLocked()).toBe(true);
    expect(c.overrideOverlay).toHaveBeenCalledWith(expect.objectContaining({ groupId: "sonr-user-drawing", lock: true }));
    expect(c._overlays.find((o: any) => o.name === "segment").lock).toBe(true);

    act(() => ref.current!.setDrawingsVisible(false));
    expect(ref.current!.getDrawingsVisible()).toBe(false);
    expect(c.overrideOverlay).toHaveBeenCalledWith(expect.objectContaining({ groupId: "sonr-user-drawing", visible: false }));
    expect(c._overlays.find((o: any) => o.name === "segment").visible).toBe(false);
  });

  it("new drawings inherit the current lock/hide state", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.setDrawingsLocked(true));
    act(() => ref.current!.setDrawingsVisible(false));
    act(() => ref.current!.startDrawing("segment"));
    act(() => c._overlays.at(-1).onDrawEnd({}));
    const seg = c._overlays.find((o: any) => o.name === "segment");
    expect(seg.lock).toBe(true);
    expect(seg.visible).toBe(false);
  });

  it("saves a drawing template and re-applies it, restoring the overlays", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.find((o: any) => o.name === "segment").points = [{ value: 1 }, { value: 2 }];
    act(() => c._overlays.at(-1).onDrawEnd({}));

    act(() => ref.current!.saveDrawingTemplate("setup"));
    expect(ref.current!.listDrawingTemplates()).toEqual(["setup"]);

    // Clear the board, then apply the template back.
    act(() => ref.current!.clearDrawings());
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(0);
    act(() => ref.current!.applyDrawingTemplate("setup"));
    const restored = c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing");
    expect(restored.length).toBe(1);
    expect(restored[0].name).toBe("segment");
    expect(restored[0].points).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it("deletes a template and notifies subscribers", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const cb = vi.fn();
    act(() => { ref.current!.subscribeDrawingTemplates(cb); });
    act(() => ref.current!.saveDrawingTemplate("a"));
    expect(cb).toHaveBeenCalled();
    expect(ref.current!.listDrawingTemplates()).toEqual(["a"]);
    act(() => ref.current!.deleteDrawingTemplate("a"));
    expect(ref.current!.listDrawingTemplates()).toEqual([]);
  });

  it("cloneLastDrawing duplicates the most-recent user overlay", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.find((o: any) => o.name === "segment").points = [{ value: 3 }, { value: 4 }];
    act(() => c._overlays.at(-1).onDrawEnd({}));
    expect(c._overlays.filter((o: any) => o.name === "segment").length).toBe(1);

    act(() => ref.current!.cloneLastDrawing());
    const segs = c._overlays.filter((o: any) => o.name === "segment");
    expect(segs.length).toBe(2);
    expect(segs[1].points).toEqual([{ value: 3 }, { value: 4 }]);
    expect(segs[1].groupId).toBe("sonr-user-drawing");
  });

  it("cloneLastDrawing is a no-op with no drawings", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.cloneLastDrawing());
    expect(c._overlays.filter((o: any) => o.groupId === "sonr-user-drawing").length).toBe(0);
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

describe("SonrChart — keyboard shortcuts (#14)", () => {
  const GROUP = "sonr-user-drawing";
  const drawings = (c: any) => c._overlays.filter((o: any) => o.groupId === GROUP);
  const chartEl = () => screen.getByRole("application");

  it("makes the container focusable + labeled for keyboard users", () => {
    render(<SonrChart symbol="A" dataSource={source()} />);
    const el = chartEl();
    expect(el.getAttribute("tabindex")).toBe("0");
    expect(el).toHaveAttribute("aria-label", "Sonr chart");
  });

  it("Escape cancels an armed drawing", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    act(() => ref.current!.startDrawing("segment"));
    expect(ref.current!.activeDrawing()).toBe("segment");
    fireEvent.keyDown(chartEl(), { key: "Escape" });
    expect(ref.current!.activeDrawing()).toBeNull();
    expect(drawings(lastChart()).length).toBe(0);
  });

  it("Cmd/Ctrl+Z undoes and Shift+Z redoes drawings", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    const draw = () => { act(() => ref.current!.startDrawing("segment")); c._overlays.at(-1).onDrawEnd({}); };
    draw();
    draw();
    expect(drawings(c).length).toBe(2);
    fireEvent.keyDown(chartEl(), { key: "z", metaKey: true });
    expect(drawings(c).length).toBe(1);
    fireEvent.keyDown(chartEl(), { key: "z", metaKey: true, shiftKey: true });
    expect(drawings(c).length).toBe(2);
  });

  it("Ctrl+Y also redoes", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.at(-1).onDrawEnd({});
    fireEvent.keyDown(chartEl(), { key: "z", ctrlKey: true }); // undo → 0
    expect(drawings(c).length).toBe(0);
    fireEvent.keyDown(chartEl(), { key: "y", ctrlKey: true }); // redo → 1
    expect(drawings(c).length).toBe(1);
  });

  it("Delete clears drawings when no tool is armed", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.at(-1).onDrawEnd({}); // finished → not armed
    expect(drawings(c).length).toBe(1);
    fireEvent.keyDown(chartEl(), { key: "Delete" });
    expect(c.removeOverlay).toHaveBeenCalledWith({ groupId: GROUP });
    expect(drawings(c).length).toBe(0);
  });

  it("Delete does NOT clear while a tool is armed (but still notifies onShortcut)", () => {
    const onShortcut = vi.fn();
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} onShortcut={onShortcut} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment")); // armed, not finished
    fireEvent.keyDown(chartEl(), { key: "Backspace" });
    expect(c.removeOverlay).not.toHaveBeenCalledWith({ groupId: GROUP });
    expect(onShortcut).toHaveBeenCalledWith("delete", expect.anything());
  });

  it("calls onShortcut for every recognized shortcut", () => {
    const onShortcut = vi.fn();
    render(<SonrChart symbol="A" dataSource={source()} onShortcut={onShortcut} />);
    fireEvent.keyDown(chartEl(), { key: "Escape" });
    fireEvent.keyDown(chartEl(), { key: "z", metaKey: true });
    expect(onShortcut).toHaveBeenCalledWith("escape", expect.anything());
    expect(onShortcut).toHaveBeenCalledWith("undo", expect.anything());
  });

  it("ignores shortcuts typed into an input (does not hijack typing)", () => {
    const onShortcut = vi.fn();
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} onShortcut={onShortcut} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.at(-1).onDrawEnd({});
    // An input inside the chart (e.g. a symbol search) must keep its keys.
    const input = document.createElement("input");
    chartEl().appendChild(input);
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "z", metaKey: true });
    expect(onShortcut).not.toHaveBeenCalled();
    expect(drawings(c).length).toBe(1); // untouched
  });

  it("does nothing when keyboard is disabled", () => {
    const onShortcut = vi.fn();
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} keyboard={false} onShortcut={onShortcut} />);
    const c = lastChart();
    act(() => ref.current!.startDrawing("segment"));
    c._overlays.at(-1).onDrawEnd({});
    fireEvent.keyDown(chartEl(), { key: "z", metaKey: true });
    fireEvent.keyDown(chartEl(), { key: "Delete" });
    expect(onShortcut).not.toHaveBeenCalled();
    expect(drawings(c).length).toBe(1);
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

describe("SonrChart — named custom themes (#46)", () => {
  const gridColorCall = (c: any) => c.setStyles.mock.calls.map((x: any[]) => x[0]?.grid?.horizontal?.color).filter(Boolean);

  it("applies a registered theme's styles via setStyles", () => {
    registerTheme("chart-neon", { grid: { horizontal: { color: "#00ffcc" } } });
    render(<SonrChart symbol="A" dataSource={source()} theme="chart-neon" />);
    expect(gridColorCall(lastChart())).toContain("#00ffcc");
  });

  it("applies an inline customThemes entry", () => {
    render(<SonrChart symbol="A" dataSource={source()} theme="inline" customThemes={{ inline: { grid: { horizontal: { color: "#abc123" } } } }} />);
    expect(gridColorCall(lastChart())).toContain("#abc123");
  });

  it("getTheme/setTheme drive the theme through the handle", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    const c = lastChart();
    expect(ref.current!.getTheme()).toBe("dark");
    act(() => ref.current!.setTheme("light"));
    expect(ref.current!.getTheme()).toBe("light");
    // Switching to light re-applies the light grid color.
    expect(gridColorCall(c)).toContain("#d8dee8");
  });
});

describe("SonrChart — formatters (#46)", () => {
  it("uses a host dateFormat for the crosshair pill", () => {
    render(<SonrChart symbol="A" dataSource={source()} dateFormat="YYYY/MM/DD" />);
    const fmt = lastChart().setFormatter.mock.calls.at(-1)![0];
    (utils.formatDate as any).mockClear();
    fmt.formatDate({ dateTimeFormat: {}, timestamp: 1000, template: "HH:mm", type: "crosshair" });
    expect((utils.formatDate as any)).toHaveBeenCalledWith({}, 1000, "YYYY/MM/DD");
  });

  it("keeps the default date+time pill when no dateFormat is given", () => {
    render(<SonrChart symbol="A" dataSource={source()} />);
    const fmt = lastChart().setFormatter.mock.calls.at(-1)![0];
    (utils.formatDate as any).mockClear();
    fmt.formatDate({ dateTimeFormat: {}, timestamp: 1000, template: "HH:mm", type: "crosshair" });
    // Default prepends the date to a time-only crosshair template.
    expect((utils.formatDate as any)).toHaveBeenCalledWith({}, 1000, "YYYY-MM-DD HH:mm");
  });

  it("wires a host priceFormatter into formatBigNumber", () => {
    const priceFormatter = (v: number) => `$${v.toFixed(2)}`;
    render(<SonrChart symbol="A" dataSource={source()} priceFormatter={priceFormatter} />);
    const fmt = lastChart().setFormatter.mock.calls.at(-1)![0];
    expect(fmt.formatBigNumber(12.5)).toBe("$12.50");
  });
});

describe("SonrChart — price-scale labels (#41)", () => {
  it("applies the label toggles to the candle price marks", () => {
    render(<SonrChart symbol="A" dataSource={source()} priceLabels={{ high: false, low: false }} />);
    const c = lastChart();
    const call = c.setStyles.mock.calls.map((a: any[]) => a[0]).find((s: any) => s?.candle?.priceMark);
    expect(call.candle.priceMark).toMatchObject({
      last: { show: true, line: { show: true } },
      high: { show: false },
      low: { show: false },
    });
  });

  it("get/set/subscribe price labels through the handle", () => {
    const ref = createRef<SonrChartHandle>();
    render(<SonrChart ref={ref} symbol="A" dataSource={source()} />);
    expect(ref.current!.getPriceLabels()).toMatchObject({ lastValue: true, lastLine: true, high: true, low: true });
    const cb = vi.fn();
    act(() => {
      ref.current!.subscribePriceLabels(cb);
      ref.current!.setPriceLabels({ high: false });
    });
    expect(ref.current!.getPriceLabels().high).toBe(false);
    expect(cb).toHaveBeenCalled();
    // The change re-applies the price marks.
    const c = lastChart();
    const last = c.setStyles.mock.calls.map((a: any[]) => a[0]).filter((s: any) => s?.candle?.priceMark).at(-1);
    expect(last.candle.priceMark.high).toMatchObject({ show: false });
  });
});

describe("SonrChart — bar-close countdown (#41)", () => {
  it("adds the last-price extend text and a countdown formatter when enabled", () => {
    // A bar that opened 20s ago on a 1-minute interval → ~40s remaining.
    const openMs = Date.now() - 20_000;
    render(<SonrChart symbol="A" interval="1" dataSource={source()} priceLabels={{ countdown: true }} />);
    const c = lastChart();
    const mark = c.setStyles.mock.calls.map((a: any[]) => a[0]).filter((s: any) => s?.candle?.priceMark).at(-1);
    expect(mark.candle.priceMark.last.extendTexts).toHaveLength(1);
    expect(mark.candle.priceMark.last.extendTexts[0]).toMatchObject({ show: true, position: "below_price", updateInterval: 1000 });

    const fmt = c.setFormatter.mock.calls.at(-1)![0];
    const text = fmt.formatExtendText({ type: "last_price", data: { timestamp: openMs }, index: 0 });
    expect(text).toMatch(/^\d{2}:\d{2}$/); // mm:ss, ~00:40
  });

  it("emits no extend texts (and empty countdown) when countdown is off", () => {
    render(<SonrChart symbol="A" interval="1" dataSource={source()} priceLabels={{ countdown: false }} />);
    const c = lastChart();
    const mark = c.setStyles.mock.calls.map((a: any[]) => a[0]).filter((s: any) => s?.candle?.priceMark).at(-1);
    expect(mark.candle.priceMark.last.extendTexts).toEqual([]);
    const fmt = c.setFormatter.mock.calls.at(-1)![0];
    expect(fmt.formatExtendText({ type: "last_price", data: { timestamp: Date.now() }, index: 0 })).toBe("");
  });
});
