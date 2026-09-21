import type { Bar, DataSource, Interval } from "../src/types";

// A self-contained random-walk data source so the demo runs with no backend.
// Host apps replace this with a real /bars + /stream (or any) adapter.
export function syntheticSource(seedPrice = 100): DataSource {
  const intervalMs = (iv: Interval): number => {
    if (iv === "10S") return 10_000;
    if (iv === "30S") return 30_000;
    if (iv === "D") return 86_400_000;
    if (iv === "60") return 3_600_000;
    return (parseInt(String(iv), 10) || 1) * 60_000;
  };

  const gen = (count: number, stepMs: number, endTime: number): Bar[] => {
    const bars: Bar[] = [];
    let price = seedPrice;
    let t = endTime - count * stepMs;
    for (let i = 0; i < count; i++) {
      const open = price;
      const drift = (Math.random() - 0.5) * seedPrice * 0.01;
      const close = Math.max(0.01, open + drift);
      const high = Math.max(open, close) + Math.random() * seedPrice * 0.004;
      const low = Math.min(open, close) - Math.random() * seedPrice * 0.004;
      bars.push({ time: t, open, high, low, close, volume: Math.round(1000 + Math.random() * 9000) });
      price = close;
      t += stepMs;
    }
    return bars;
  };

  let last: Bar | null = null;

  return {
    async getBars(_symbol, interval, count) {
      const stepMs = intervalMs(interval);
      const bars = gen(count, stepMs, Date.now());
      last = bars[bars.length - 1] ?? null;
      return bars;
    },
    subscribe(_symbol, interval, onBar) {
      const stepMs = intervalMs(interval);
      // Tick the forming bar a few times a second, roll to a new bar each step.
      let barStart = last ? last.time : Date.now();
      let cur: Bar = last ? { ...last } : { time: barStart, open: seedPrice, high: seedPrice, low: seedPrice, close: seedPrice, volume: 0 };
      const id = window.setInterval(() => {
        const now = Date.now();
        if (now - barStart >= stepMs) {
          barStart = now;
          cur = { time: barStart, open: cur.close, high: cur.close, low: cur.close, close: cur.close, volume: 0 };
        }
        const move = (Math.random() - 0.5) * seedPrice * 0.003;
        cur.close = Math.max(0.01, cur.close + move);
        cur.high = Math.max(cur.high, cur.close);
        cur.low = Math.min(cur.low, cur.close);
        cur.volume = (cur.volume ?? 0) + Math.round(Math.random() * 200);
        onBar({ ...cur });
      }, 400);
      return () => window.clearInterval(id);
    },
  };
}
