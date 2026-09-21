// Microbenchmark for the ET session classifier — the hottest path added on top
// of KLineChart (session tinting redraws every frame). Dependency-free.
//   node bench/session.mjs
import { performance } from "node:perf_hooks";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// --- naive: an Intl.formatToParts on every call (the pre-optimization version)
function naive(ts) {
  const p = fmt.formatToParts(new Date(ts));
  const h = Number(p.find((x) => x.type === "hour").value);
  const m = Number(p.find((x) => x.type === "minute").value);
  const mins = h * 60 + m;
  return mins >= 240 && mins < 570 ? "pre" : mins >= 570 && mins < 960 ? "regular" : mins >= 960 && mins < 1200 ? "post" : "closed";
}

// --- optimized: ET offset cached per UTC hour, then pure arithmetic
const cache = new Map();
function offset(ts) {
  const bucket = Math.floor(ts / 3_600_000);
  const c = cache.get(bucket);
  if (c !== undefined) return c;
  const p = fmt.formatToParts(new Date(ts));
  const eh = Number(p.find((x) => x.type === "hour").value);
  const em = Number(p.find((x) => x.type === "minute").value);
  const d = new Date(ts);
  let diff = eh * 60 + em - (d.getUTCHours() * 60 + d.getUTCMinutes());
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  cache.set(bucket, diff);
  return diff;
}
function optimized(ts) {
  const total = Math.floor(ts / 60_000) + offset(ts);
  const mins = ((total % 1440) + 1440) % 1440;
  return mins >= 240 && mins < 570 ? "pre" : mins >= 570 && mins < 960 ? "regular" : mins >= 960 && mins < 1200 ? "post" : "closed";
}

// Correctness: agree across a full year.
let mism = 0;
for (let ts = Date.UTC(2026, 0, 1); ts < Date.UTC(2027, 0, 1); ts += 11 * 60_000) {
  if (optimized(ts) !== naive(ts)) mism++;
}

// Simulate one 2-second pan: 500 bars redrawn over 120 frames.
const N = 500, FRAMES = 120, base = Date.UTC(2026, 6, 15, 8, 0, 0);
const bars = Array.from({ length: N }, (_, i) => base + i * 60_000);
const run = (fn) => {
  let acc = 0;
  const t = performance.now();
  for (let f = 0; f < FRAMES; f++) for (let i = 0; i < N; i++) acc += fn(bars[i]).length;
  return { ms: performance.now() - t, acc };
};
run(optimized); // warm the cache
const a = run(naive);
cache.clear();
const b = run(optimized);

console.log(`correctness mismatches over a full year: ${mism}`);
console.log(`naive     (Intl per bar/frame): ${a.ms.toFixed(1)} ms  (${(a.ms / FRAMES).toFixed(3)} ms/frame)`);
console.log(`optimized (offset cache)       : ${b.ms.toFixed(1)} ms  (${(b.ms / FRAMES).toFixed(4)} ms/frame)`);
console.log(`speedup: ${(a.ms / b.ms).toFixed(0)}x`);
