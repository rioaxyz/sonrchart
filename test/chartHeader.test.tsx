import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createRef } from "react";
import type { KLineData } from "klinecharts";
import { ChartHeader } from "../src/ChartHeader";
import type { SonrChartHandle } from "../src/SonrChart";

type HeaderCb = (current: KLineData | null, prev: KLineData | null) => void;

function fakeHandle() {
  const subs = new Set<HeaderCb>();
  return {
    handle: {
      subscribeHeaderBar: (cb: HeaderCb) => {
        subs.add(cb);
        cb(null, null); // seed empty
        return () => subs.delete(cb);
      },
    } as unknown as SonrChartHandle,
    emit: (current: KLineData | null, prev: KLineData | null) => subs.forEach((cb) => cb(current, prev)),
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
});
