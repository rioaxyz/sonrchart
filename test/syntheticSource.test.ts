import { describe, it, expect, vi, afterEach } from "vitest";
import { syntheticSource } from "../demo/syntheticSource";

afterEach(() => vi.restoreAllMocks());

describe("syntheticSource (demo harness)", () => {
  it("returns the requested number of ascending-time bars", async () => {
    const src = syntheticSource(100);
    const bars = await src.getBars("SYNTH", "1", 120);
    expect(bars).toHaveLength(120);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].time).toBeGreaterThan(bars[i - 1].time);
      expect(bars[i].high).toBeGreaterThanOrEqual(bars[i].low);
    }
  });

  it("mean-reverts, staying in a readable band around the seed", async () => {
    const src = syntheticSource(100);
    const bars = await src.getBars("SYNTH", "1", 500);
    // Reversion keeps the walk within ~±10% of 100 (generous bound for randomness).
    for (const b of bars) {
      expect(b.close).toBeGreaterThan(85);
      expect(b.close).toBeLessThan(115);
    }
  });

  it("subscribe pushes bars and returns a working unsubscribe", async () => {
    vi.useFakeTimers();
    const src = syntheticSource(100);
    await src.getBars("SYNTH", "1", 10);
    const onBar = vi.fn();
    const unsub = src.subscribe!("SYNTH", "1", onBar);
    vi.advanceTimersByTime(1000); // ~2-3 ticks at 400ms
    expect(onBar).toHaveBeenCalled();
    const count = onBar.mock.calls.length;
    unsub();
    vi.advanceTimersByTime(1000);
    expect(onBar.mock.calls.length).toBe(count); // no more after unsub
    vi.useRealTimers();
  });
});
