import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createRef } from "react";
import type { KLineData } from "klinecharts";
import { ChartHeader } from "../src/ChartHeader";
import type { SonrChartHandle } from "../src/SonrChart";
import type { VolumeTrend } from "../src/volumeTrend";

type HeaderCb = (current: KLineData | null, prev: KLineData | null) => void;
type TrendCb = (trend: VolumeTrend | null) => void;

function fakeHandle() {
  const subs = new Set<HeaderCb>();
  const trendSubs = new Set<{ bars: number | undefined; cb: TrendCb }>();
  const setVolumeTrendBars = vi.fn();
  return {
    handle: {
      subscribeHeaderBar: (cb: HeaderCb) => {
        subs.add(cb);
        cb(null, null); // seed empty
        return () => subs.delete(cb);
      },
      subscribeVolumeTrend: (cb: TrendCb, bars?: number) => {
        const sub = { bars, cb };
        trendSubs.add(sub);
        cb(null); // seed empty
        return () => trendSubs.delete(sub);
      },
      setVolumeTrendBars,
    } as unknown as SonrChartHandle,
    emit: (current: KLineData | null, prev: KLineData | null) => subs.forEach((cb) => cb(current, prev)),
    emitTrend: (trend: VolumeTrend | null) => trendSubs.forEach((s) => s.cb(trend)),
    trendSubs,
    setVolumeTrendBars,
  };
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

const bar = (o: number, h: number, l: number, c: number, v: number): KLineData => ({ timestamp: 0, open: o, high: h, low: l, close: c, volume: v });

describe("ChartHeader (#45)", () => {
  it("renders ticker · interval · source and the market button, OHLC only once a bar arrives", () => {
    const { handle } = fakeHandle();
    render(<ChartHeader chartRef={ref(handle)} symbol="NASDAQ:CRWD" interval="1" source="Alpaca" />);
    expect(screen.getByText(/CRWD · 1m · Alpaca/)).toBeInTheDocument();
    // Market status button is embedded in the header.
    expect(screen.getByRole("button")).toBeInTheDocument();
    // No OHLC yet (seeded null).
    expect(screen.queryByText("O")).toBeNull();
  });

  it("shows the emitted bar's O/H/L/C, change vs prev close, and volume", () => {
    const { handle, emit } = fakeHandle();
    render(<ChartHeader chartRef={ref(handle)} symbol="CRWD" interval="1" pricePrecision={2} />);
    act(() => emit(bar(262.18, 262.2, 261.53, 261.83, 8_899_000), bar(0, 0, 0, 262.17, 0)));
    expect(screen.getByText("262.18")).toBeInTheDocument(); // open
    expect(screen.getByText("261.53")).toBeInTheDocument(); // low
    expect(screen.getByText("261.83")).toBeInTheDocument(); // close
    expect(screen.getByText("8.90M")).toBeInTheDocument(); // volume
    // Change vs prev close 262.17 → −0.34 (−0.13%).
    expect(screen.getByText(/−0\.34 \(−0\.13%\)/)).toBeInTheDocument();
  });

  it("shows the volume-trend row (#79) when enabled, colored by direction", () => {
    const { handle, emitTrend, trendSubs, setVolumeTrendBars } = fakeHandle();
    render(<ChartHeader chartRef={ref(handle)} symbol="CRWD" interval="1" volumeTrend={5} />);
    // A numeric prop sets the chart-level lookback; the subscription stays
    // unpinned so settings-dialog edits apply live.
    expect(setVolumeTrendBars).toHaveBeenCalledWith(5);
    expect([...trendSubs][0].bars).toBeUndefined();
    // Seeded null → the row is hidden until enough bars exist.
    expect(screen.queryByText("Vol trend")).toBeNull();

    act(() => emitTrend("increasing"));
    expect(screen.getByText("Vol trend")).toBeInTheDocument();
    expect(screen.getByText("Increasing")).toHaveClass("sonr-hd-up");

    act(() => emitTrend("decreasing"));
    expect(screen.getByText("Decreasing")).toHaveClass("sonr-hd-down");

    act(() => emitTrend("mixed"));
    expect(screen.getByText("Mixed")).toHaveClass("sonr-hd-mixed");
  });

  it("does not subscribe to the volume trend when the row is off (default)", () => {
    const { handle, trendSubs } = fakeHandle();
    render(<ChartHeader chartRef={ref(handle)} symbol="CRWD" interval="1" />);
    expect(trendSubs.size).toBe(0);
    expect(screen.queryByText("Vol trend")).toBeNull();
  });

  it("honors label overrides for the trend row", () => {
    const { handle, emitTrend } = fakeHandle();
    render(
      <ChartHeader
        chartRef={ref(handle)}
        symbol="CRWD"
        interval="1"
        volumeTrend
        labels={{ volumeTrend: "Tendance vol", volumeTrendMixed: "Mixte" }}
      />,
    );
    act(() => emitTrend("mixed"));
    expect(screen.getByText("Tendance vol")).toBeInTheDocument();
    expect(screen.getByText("Mixte")).toBeInTheDocument();
  });
});
