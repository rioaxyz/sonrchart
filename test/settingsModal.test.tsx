import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { SettingsModal } from "../src/SettingsModal";
import type { SonrChartHandle } from "../src/SonrChart";

function fakeChart(calcParamsByName: Record<string, number[]> = {}) {
  return {
    getStyles: () => ({
      candle: { bar: { upColor: "#35c98d", downColor: "#ff6a76" } },
      grid: { horizontal: { color: "#1d232b", show: true } },
      crosshair: { horizontal: { line: { color: "#78828e" } } },
    }),
    setStyles: vi.fn(),
    overrideIndicator: vi.fn(),
    getIndicators: vi.fn(({ name }: { name: string }) =>
      calcParamsByName[name] ? [{ name, calcParams: calcParamsByName[name] }] : [],
    ),
  };
}

function handleWith(chart: any, indicators: string[] = []): SonrChartHandle {
  const brush: any = { brush: { color: "#e6ebe9", size: 2 }, highlighter: { color: "rgba(245,214,66,0.35)", size: 14 } };
  let penDefault: any = null;
  const penByTool: Record<string, any> = {};
  const penSubs = new Set<() => void>();
  let locked = false;
  let visible = true;
  let trendBars = 3;
  const templates: string[] = [];
  const tplSubs = new Set<() => void>();
  return {
    chart: () => chart,
    listIndicators: () => indicators,
    // #103 per-tool pen — a faithful little store so the UI round-trips.
    getDrawingStyle: (tool?: string) => {
      const s = tool === undefined ? penDefault : (penByTool[tool] ?? penDefault);
      return s ? { ...s } : null;
    },
    setDrawingStyle: vi.fn((style: any, tool?: string) => {
      if (tool === undefined) penDefault = style ? { ...style } : null;
      else if (style) penByTool[tool] = { ...style };
      else delete penByTool[tool];
      penSubs.forEach((cb) => cb());
    }),
    subscribeDrawingStyle: (cb: () => void) => {
      penSubs.add(cb);
      return () => penSubs.delete(cb);
    },
    getBrushStyle: (t: string) => brush[t],
    setBrushStyle: vi.fn((t: string, s: any) => {
      brush[t] = s;
    }),
    subscribeBrush: () => () => {},
    getWatermark: () => ({ symbol: true, interval: true, color: "#e6ebe9", opacity: 0.06 }),
    setWatermark: vi.fn(),
    subscribeWatermark: () => () => {},
    getSessions: () => true,
    setSessions: vi.fn(),
    subscribeSessions: () => () => {},
    // #79 volume-trend lookback
    getVolumeTrendBars: () => trendBars,
    setVolumeTrendBars: vi.fn((n: number) => {
      trendBars = n;
    }),
    subscribeVolumeTrendBars: () => () => {},
    // #35 drawing management
    getDrawingsLocked: () => locked,
    setDrawingsLocked: vi.fn((v: boolean) => {
      locked = v;
    }),
    getDrawingsVisible: () => visible,
    setDrawingsVisible: vi.fn((v: boolean) => {
      visible = v;
    }),
    saveDrawingTemplate: vi.fn((name: string) => {
      templates.push(name);
      tplSubs.forEach((cb) => cb());
    }),
    applyDrawingTemplate: vi.fn(),
    deleteDrawingTemplate: vi.fn((name: string) => {
      const i = templates.indexOf(name);
      if (i >= 0) templates.splice(i, 1);
      tplSubs.forEach((cb) => cb());
    }),
    listDrawingTemplates: () => templates.slice(),
    subscribeDrawingTemplates: (cb: () => void) => {
      tplSubs.add(cb);
      return () => tplSubs.delete(cb);
    },
    cloneLastDrawing: vi.fn(),
  } as unknown as SonrChartHandle;
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as any).current = h;
  return r;
}

describe("SettingsModal (#settings)", () => {
  it("renders nothing when closed", () => {
    render(<SettingsModal chartRef={ref(handleWith(fakeChart()))} open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("applies candle colors live via setStyles", () => {
    const chart = fakeChart();
    render(<SettingsModal chartRef={ref(handleWith(chart))} open onClose={vi.fn()} />);
    // Candles section is the default; change the bullish color.
    const inputs = screen.getAllByDisplayValue(/#/i) as HTMLInputElement[];
    fireEvent.input(inputs[0], { target: { value: "#00ff00" } });
    expect(chart.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ candle: expect.objectContaining({ bar: expect.objectContaining({ upColor: "#00ff00" }) }) }),
    );
  });

  it("lists active indicators and overrides their color", async () => {
    const chart = fakeChart();
    render(<SettingsModal chartRef={ref(handleWith(chart, ["MA"]))} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Indicators" }));
    expect(screen.getByText("MA")).toBeInTheDocument();
    const input = screen.getByDisplayValue("#a970ff") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "#123456" } });
    expect(chart.overrideIndicator).toHaveBeenCalledWith(
      expect.objectContaining({ name: "MA", styles: expect.objectContaining({ lines: expect.any(Array) }) }),
    );
  });

  it("seeds indicator inputs from calcParams and applies them via overrideIndicator", async () => {
    const chart = fakeChart({ MACD: [12, 26, 9] });
    render(<SettingsModal chartRef={ref(handleWith(chart, ["MACD"]))} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Indicators" }));
    // Three numeric inputs seeded from calcParams.
    const first = screen.getByLabelText("MACD input 1") as HTMLInputElement;
    const second = screen.getByLabelText("MACD input 2") as HTMLInputElement;
    const third = screen.getByLabelText("MACD input 3") as HTMLInputElement;
    expect(first.value).toBe("12");
    expect(second.value).toBe("26");
    expect(third.value).toBe("9");
    // Editing one param applies the full array through overrideIndicator.
    fireEvent.change(second, { target: { value: "30" } });
    expect(chart.overrideIndicator).toHaveBeenCalledWith(
      expect.objectContaining({ name: "MACD", calcParams: [12, 30, 9] }),
    );
  });

  it("shows only a color picker for indicators without calcParams", async () => {
    const chart = fakeChart(); // getIndicators returns [] → no params
    render(<SettingsModal chartRef={ref(handleWith(chart, ["VOL"]))} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Indicators" }));
    expect(screen.getByText("VOL")).toBeInTheDocument();
    expect(screen.queryByLabelText(/VOL input/)).toBeNull();
  });

  it("edits the volume-trend lookback (#79) via setVolumeTrendBars", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Indicators" }));
    // Seeded from the handle's chart-level value.
    const input = screen.getByLabelText("Bars (lookback)") as HTMLInputElement;
    expect(input.value).toBe("3");
    fireEvent.change(input, { target: { value: "5" } });
    expect((h as any).setVolumeTrendBars).toHaveBeenCalledWith(5);
    expect(input.value).toBe("5");
    // Out-of-range input clamps to ≥ 1.
    fireEvent.change(input, { target: { value: "0" } });
    expect((h as any).setVolumeTrendBars).toHaveBeenCalledWith(1);
  });

  it("configures the watermark (symbol/interval/color/opacity) via the handle", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Grid & Crosshair" }));
    // Toggle the symbol off, then bump opacity.
    await userEvent.click(screen.getByRole("checkbox", { name: "Show symbol" }));
    expect(h.setWatermark).toHaveBeenCalledWith({ symbol: false });
    const opacity = screen.getByRole("slider");
    fireEvent.input(opacity, { target: { value: "0.3" } });
    expect(h.setWatermark).toHaveBeenCalledWith({ opacity: 0.3 });
  });

  it("edits brush width in the Drawing section via setBrushStyle", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(screen.getByText("Brush")).toBeInTheDocument();
    expect(screen.getByText("Highlighter")).toBeInTheDocument();
    // Spinbuttons in section order: pen width (#103), brush, highlighter, text.
    const widths = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.input(widths[1], { target: { value: "8" } });
    expect(h.setBrushStyle).toHaveBeenCalledWith("brush", expect.objectContaining({ size: 8 }));
  });

  it("edits the line/shape pen (#103): line style, per-tool width, and reset", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(screen.getByText("Line & shape tools")).toBeInTheDocument();

    // Comboboxes in pen-block order: Tool, then Line style.
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1], "dashed");
    expect(h.setDrawingStyle).toHaveBeenCalledWith(expect.objectContaining({ lineStyle: "dashed" }), undefined);

    // Pick a specific tool → edits land as that tool's override.
    await userEvent.selectOptions(selects[0], "rayLine");
    const widths = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.input(widths[0], { target: { value: "4" } });
    expect(h.setDrawingStyle).toHaveBeenCalledWith(expect.objectContaining({ size: 4 }), "rayLine");

    // A customized pen shows Reset, which clears back to the default.
    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(h.setDrawingStyle).toHaveBeenCalledWith(null, "rayLine");
  });

  it("edits pre-market / after-hours session color + opacity via setSessions", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Sessions" }));
    expect(screen.getByText("Pre-market")).toBeInTheDocument();
    expect(screen.getByText("After-hours")).toBeInTheDocument();
    // Two color pickers (premarket, afterhours) + two opacity sliders.
    const colors = screen.getAllByDisplayValue(/#/i) as HTMLInputElement[];
    fireEvent.input(colors[0], { target: { value: "#00ff00" } });
    // Sessions stay on and premarket becomes an rgba built from #00ff00.
    expect(h.setSessions).toHaveBeenCalledWith(expect.objectContaining({ premarket: expect.stringContaining("0,255,0") }));
    const sliders = screen.getAllByRole("slider") as HTMLInputElement[];
    fireEvent.input(sliders[0], { target: { value: "0.4" } });
    expect(h.setSessions).toHaveBeenCalledWith(expect.objectContaining({ premarket: expect.stringContaining("0.4") }));
  });

  it("drives lock/hide, clone, and templates from the Drawings section (#35)", async () => {
    const h = handleWith(fakeChart());
    render(<SettingsModal chartRef={ref(h)} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Drawings" }));

    // Lock all + hide all checkboxes drive the handle.
    await userEvent.click(screen.getByRole("checkbox", { name: "Lock all drawings" }));
    expect(h.setDrawingsLocked).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Hide all drawings" }));
    expect(h.setDrawingsVisible).toHaveBeenCalledWith(false);

    // Clone last.
    await userEvent.click(screen.getByRole("button", { name: "Clone last drawing" }));
    expect(h.cloneLastDrawing).toHaveBeenCalled();

    // Save a template, then apply + delete it from the list.
    await userEvent.type(screen.getByLabelText("Template name"), "setup");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(h.saveDrawingTemplate).toHaveBeenCalledWith("setup");
    expect(screen.getByText("setup")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(h.applyDrawingTemplate).toHaveBeenCalledWith("setup");
    await userEvent.click(screen.getByRole("button", { name: "Delete setup" }));
    expect(h.deleteDrawingTemplate).toHaveBeenCalledWith("setup");
  });

  it("closes on the ✕ button", async () => {
    const onClose = vi.fn();
    render(<SettingsModal chartRef={ref(handleWith(fakeChart()))} open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalled();
  });
});
