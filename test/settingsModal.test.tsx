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
  return {
    chart: () => chart,
    listIndicators: () => indicators,
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

  it("toggles the watermark from the Grid section when wired", async () => {
    const onWatermarkChange = vi.fn();
    render(
      <SettingsModal chartRef={ref(handleWith(fakeChart()))} open onClose={vi.fn()} watermark={false} onWatermarkChange={onWatermarkChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Grid & Crosshair" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Watermark/ }));
    expect(onWatermarkChange).toHaveBeenCalledWith(true);
  });

  it("closes on the ✕ button", async () => {
    const onClose = vi.fn();
    render(<SettingsModal chartRef={ref(handleWith(fakeChart()))} open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalled();
  });
});
