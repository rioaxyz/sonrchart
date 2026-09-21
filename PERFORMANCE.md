# Performance

sonrchart adds features on top of [KLineChart](https://github.com/klinecharts/KLineChart)
without adding runtime dependencies (the only prod dependency is KLineChart
itself; React is a peer). The features that run in the render hot path — the
custom session/pattern indicators, whose `draw` fires on every frame during a
pan/zoom/crosshair move — are optimized so they cost near-zero.

## Session tinting (the hot path)

Session background shading (`sessions` prop) classifies each bar into a US-equities
session (pre / regular / after / closed) in Eastern Time, DST-aware.

**Problem.** The naive classifier called `Intl.DateTimeFormat.formatToParts` per
bar. In `draw` that means one Intl call × every bar × every frame — ~0.63 ms per
frame for 500 bars, ~4% of a 60fps budget for *one* indicator, growing linearly
with history.

**Fixes (no new dependency):**

1. **Cache the ET offset per UTC hour.** DST transitions land on a UTC-hour
   boundary, so `ET − UTC` is constant within each bucket. The first timestamp
   in a bucket does one Intl call; every other timestamp is pure integer
   arithmetic. Verified against a pure-Intl classifier: **0 mismatches across a
   full year**, including both DST switch days.
2. **Classify in `calc`, not `draw`.** KLineChart runs an indicator's `calc`
   only when the data changes and caches the result; `draw` runs every frame.
   The session code is computed once per bar in `calc` and read back in `draw`.
3. **Paint only the visible range.** `draw` walks `getVisibleRange()` (+1 bar
   of margin), not the whole history — so zooming in does *less* work, not the
   same.
4. **Read `extendData` directly** in `draw` instead of a per-frame
   `getIndicators()` lookup.

Measured with `node bench/session.mjs` (a 2-second, 120-frame pan over 500 bars):

```
naive     (Intl per bar/frame): 75.8 ms  (0.631 ms/frame)
optimized (offset cache)       : 1.0 ms  (0.0079 ms/frame)
speedup: 80x
```

## Pattern markers

Markers (`patterns` prop) are read from `extendData` (no per-frame indicator
lookup), the canvas state is set once per pass, and anything off-screen is
skipped. Typical marker counts are small, so this stays negligible.

## Compare overlay

The compare lines (`compareSeries`) are also drawn every frame by a custom
indicator. Its points are aligned 1:1 with the main bars, so the **visible data
range indexes straight into them** — `draw` converts only the on-screen points
(+1 bar margin), not the whole history, for each symbol. That drops a 500-bar,
2-symbol overlay from ~0.10 ms/frame to ~0.013 ms/frame when zoomed, and it
scales with symbol count. Comparison symbols are also fetched in parallel
(`Promise.all`), not one after another.

## Heikin Ashi & undo history

Heikin Ashi is a data transform, not a per-frame cost: the batch transform runs
once per load and the live `HaTransformer` is O(1) per streamed bar. The drawing
undo/redo stack is bounded (oldest snapshots drop past a cap) so long sessions
don't grow memory without limit.

## Overlay reconcile (price / order lines)

`priceLines` / `orderLines` are usually passed as fresh array literals, so the
reconcile effect runs on every parent render. A **content signature** guards the
expensive part: overlays are only removed and recreated when a line's *visual*
fields actually change — not when the array or a callback merely gets a new
identity. This avoids overlay thrash (and stops a re-render from fighting an
in-progress drag). The latest `onMove` handler is kept in a ref, so a changed
callback still takes effect without a rebuild.

## Non-hot paths

Drawing tools, snapshot, persistence, symbol resolution, pane heights, and price
scale are user-triggered (not per-frame), so they're left simple and direct.

## Dependencies

Zero runtime dependencies were added for any of the above — every optimization
is vanilla TS (memoization, moving work to `calc`, visible-range clipping,
signature guards). `klinecharts` remains the single prod dependency.
