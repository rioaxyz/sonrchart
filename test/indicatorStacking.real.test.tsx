import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef } from "react";
import { init, dispose } from "klinecharts";
// NOTE: this file deliberately does NOT mock klinecharts — it verifies indicator
// stacking against the REAL library, so the fix (isStack=true) is proven at the
// place the bug actually lived, not just at our call sites.
import { SonrChart, type SonrChartHandle } from "../src/SonrChart";
import type { DataSource } from "../src/types";

const CANDLE = "candle_pane";

// Minimal headless canvas / RAF / ResizeObserver so KLineChart can init + lay out
// in jsdom. The 2d context is a no-op proxy (measureText returns a width).
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as any;
  proto.getContext = () =>
    new Proxy(
      {},
      {
        get(_t, p) {
          if (p === "measureText") return () => ({ width: 0 });
          if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern")
            return () => ({ addColorStop() {} });
          if (p === "getImageData") return () => ({ data: [] });
          if (p === "canvas") return { width: 800, height: 400 };
          return () => {};
        },
      },
    );
  (globalThis as any).ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as any).requestAnimationFrame ||= (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
  (globalThis as any).devicePixelRatio ||= 1;
});

function sizedEl() {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 800 });
  Object.defineProperty(el, "clientHeight", { value: 400 });
  el.getBoundingClientRect = () =>
    ({ width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
}

const source = (): DataSource => ({
  getBars: vi.fn(async () => [
    { time: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    { time: 2000, open: 1.5, high: 2.2, low: 1.4, close: 2, volume: 20 },
  ]),
  resolveSymbol: vi.fn(async (s: string) => ({ ticker: s, pricePrecision: 2 })),
});

describe("indicator stacking — real KLineChart", () => {
  it("library: two candle-pane indicators coexist with isStack=true; isStack=false wipes the pane", () => {
    const el = sizedEl();
    document.body.appendChild(el);
    const chart = init(el)!;
    expect(chart).toBeTruthy();

    chart.createIndicator({ name: "MA", paneId: CANDLE }, true);
    chart.createIndicator({ name: "BOLL", paneId: CANDLE }, true);
    const stacked = chart.getIndicators({ paneId: CANDLE }).map((i) => i.name);
    expect(stacked).toEqual(expect.arrayContaining(["MA", "BOLL"]));

    // The old behavior, as a control: isStack=false removes the pane's indicators first.
    chart.createIndicator({ name: "SAR", paneId: CANDLE }, false);
    expect(chart.getIndicators({ paneId: CANDLE }).map((i) => i.name)).toEqual(["SAR"]);

    dispose(el);
  });

  it("component: <SonrChart> keeps BOTH main-pane overlays on the canvas", async () => {
    const ref = createRef<SonrChartHandle>();
    await act(async () => {
      render(
        <SonrChart
          ref={ref}
          symbol="AAPL"
          dataSource={source()}
          indicators={[{ name: "MA", pane: "main" }, { name: "BOLL", pane: "main" }]}
        />,
        { container: document.body.appendChild(sizedEl()) },
      );
    });
    // Let the init effect resolve the symbol + create the indicators.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const chart = ref.current!.chart()!;
    const onCandle = chart.getIndicators({ paneId: CANDLE }).map((i) => i.name);
    expect(onCandle).toEqual(expect.arrayContaining(["MA", "BOLL"]));
    // And the handle lists both user overlays.
    expect(ref.current!.listIndicators()).toEqual(expect.arrayContaining(["MA", "BOLL"]));
  });

  it("component: overlays coexist with the session tint + watermark on the candle pane", async () => {
    const ref = createRef<SonrChartHandle>();
    await act(async () => {
      render(
        <SonrChart
          ref={ref}
          symbol="AAPL"
          dataSource={source()}
          sessions
          watermark
          indicators={[{ name: "MA", pane: "main" }]}
        />,
        { container: document.body.appendChild(sizedEl()) },
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const chart = ref.current!.chart()!;
    const onCandle = chart.getIndicators({ paneId: CANDLE }).map((i) => i.name);
    // The user overlay AND the internal layers all survive on the shared pane.
    expect(onCandle).toEqual(expect.arrayContaining(["MA", "SONR_SESSION", "SONR_WATERMARK"]));
  });

  it("component: candle-pane layers are drawn back-to-front by zLevel", async () => {
    const ref = createRef<SonrChartHandle>();
    await act(async () => {
      render(
        <SonrChart
          ref={ref}
          symbol="AAPL"
          dataSource={source()}
          sessions
          watermark
          patterns={[{ time: 1000 }]}
          indicators={[{ name: "MA", pane: "main" }]}
        />,
        { container: document.body.appendChild(sizedEl()) },
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const chart = ref.current!.chart()!;
    // getIndicators returns the pane's indicators sorted ascending by zLevel —
    // the exact back-to-front draw order KLineChart uses.
    const inds = chart.getIndicators({ paneId: CANDLE });
    const order = inds.map((i) => i.name);
    const z = Object.fromEntries(inds.map((i) => [i.name, i.zLevel]));

    // Back layers sit behind the candles (zLevel < 0); patterns ride on top.
    expect(z.SONR_WATERMARK).toBeLessThan(z.SONR_SESSION);
    expect(z.SONR_SESSION).toBeLessThan(0);
    expect(z.MA).toBeGreaterThanOrEqual(0);
    expect(z.SONR_PATTERNS).toBeGreaterThan(z.MA);

    // …and that yields watermark → session → MA → patterns front-to-back.
    const rank = (n: string) => order.indexOf(n);
    expect(rank("SONR_WATERMARK")).toBeLessThan(rank("SONR_SESSION"));
    expect(rank("SONR_SESSION")).toBeLessThan(rank("MA"));
    expect(rank("MA")).toBeLessThan(rank("SONR_PATTERNS"));
  });
});
