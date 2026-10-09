// Microbenchmark for the Volume Surge compute — calc() reruns over the loaded
// history whenever data changes, so full-pass cost is what matters. Compares
// the shipped rolling-window implementation (O(n)) against the naive
// re-average-the-window-per-bar version (O(n*bars)). Dependency-free.
//   node bench/volumeSurge.mjs   (Node >= 23: imports the TS source directly
//   via native type stripping — the dist bundle touches `window` at load)
import { performance } from "node:perf_hooks";
import {
  computeVolumeSurge,
  DEFAULT_VOLUME_SURGE_BARS,
  DEFAULT_VOLUME_SURGE_MULT,
} from "../src/volumeSurge.ts";

// --- naive: recompute the window mean from scratch for every bar
function naive(dataList, bars = DEFAULT_VOLUME_SURGE_BARS, mult = DEFAULT_VOLUME_SURGE_MULT) {
  return dataList.map((d, i) => {
    if (i < bars) return {};
    let sum = 0;
    for (let j = i - bars; j < i; j++) {
      const v = dataList[j].volume;
      if (typeof v !== "number") return {};
      sum += v;
    }
    const v = d.volume;
    if (typeof v !== "number" || sum <= 0) return {};
    const ratio = v / (sum / bars);
    return { ratio, threshold: mult, strength: ratio >= mult ? "surging" : "continuing" };
  });
}

function bars(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = { timestamp: i * 60_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 500 + ((i * 7919) % 4000) };
  }
  return out;
}

function time(label, fn, reps = 5) {
  fn(); // warm up
  let best = Infinity;
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  console.log(`${label}: ${best.toFixed(2)} ms (best of ${reps})`);
  return best;
}

for (const n of [10_000, 100_000, 1_000_000]) {
  const data = bars(n);
  for (const w of [DEFAULT_VOLUME_SURGE_BARS, 200]) {
    console.log(`\n${n.toLocaleString()} bars, window ${w}:`);
    const a = time("  rolling (shipped)", () => computeVolumeSurge(data, w));
    const b = time("  naive re-mean    ", () => naive(data, w));
    console.log(`  speedup: ${(b / a).toFixed(1)}x`);
  }
}

// Sanity: both implementations agree bar-for-bar.
const data = bars(5_000);
const x = computeVolumeSurge(data);
const y = naive(data);
let mismatches = 0;
for (let i = 0; i < data.length; i++) {
  if (x[i].strength !== y[i].strength || Math.abs((x[i].ratio ?? 0) - (y[i].ratio ?? 0)) > 1e-9) mismatches++;
}
console.log(`\nagreement check: ${mismatches} mismatches over ${data.length} bars`);
