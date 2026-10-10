# sonrchart

**Own the glass, not the ocean.** A themed, data-source-agnostic React charting
component for financial candlestick charts, built on
[KLineChart](https://github.com/klinecharts/KLineChart) (MIT). Extracted from the
Sonr trading app so the chart engine can be developed, versioned, and tested on
its own.

> New here? Read the [lore](LORE.md) for the why. MIT-licensed — see
> [LICENSE](LICENSE).

The design goal: KLineChart gives us candles, ~50+ indicators, drawing tools,
and sub-panes for free; sonrchart wraps it with the Sonr look, a clean React
API, and one integration seam — a `DataSource` — so the host app owns where
bars come from.

## Features

- **One React component, one data seam.** `<SonrChart>` renders from a single
  `DataSource` you implement (REST, websocket, anything) — the library never
  knows where bars come from.
- **Themed out of the box.** Sonr dark/light palette baked in; override any
  KLineChart style.
- **Candle styles.** Solid, hollow, hollow-up, OHLC/HLC bars, area, and Heikin
  Ashi (a built-in data transform).
- **Indicators.** All of KLineChart's ~50+ built-ins, placed on the price pane
  or their own sub-pane, with per-pane heights — plus a drop-in `IndicatorMenu`
  to toggle them.
- **Sonr custom indicators.** Session tinting (pre/after-hours, ET, DST-aware)
  and pattern-context markers.
- **Trade plan on the chart.** Static `priceLines` (entry/stop/target) and
  **draggable** `orderLines` with an `onMove` callback.
- **Compare / multi-symbol overlay.** Overlay other symbols, ratio-scaled to
  share a starting price.
- **Drawing tools.** Curated trend/ray/Fibonacci/channel/note tools with a
  `DrawingToolbar`, magnet-to-OHLC snapping, and **undo/redo**.
- **Price scale modes.** Normal / percentage / logarithmic, invert, labels
  inside.
- **Persistence & templates.** Export/import chart state (drawings + indicators)
  and save/apply named indicator sets.
- **Snapshots.** Capture the chart to a PNG data URL (or trigger a download).
- **Composable chrome.** `ChartToolbar` bundles intervals + indicators +
  drawing tools + snapshot; add your own buttons via its children slot.
- **Volume trend readout.** Optional header row classifying the last N bars'
  volume as Increasing / Decreasing / Mixed (lookback editable live in the
  settings dialog, tracks the crosshair). Toggle it from the indicators menu
  ("VOLTREND"), seed it on with `volumeTrend` on `ChartHeader` /
  `SonrChartShell`, drive it via `setVolumeTrendEnabled` on the chart handle,
  or subscribe to the raw trend via `subscribeVolumeTrend`.
- **Fast & dependency-light.** The only runtime dependency is KLineChart;
  React is a peer. The per-frame hot paths are tuned (see
  [PERFORMANCE.md](PERFORMANCE.md)).

See [`docs/charting-feature-inventory.md`](docs/charting-feature-inventory.md)
for the full roadmap and what KLineChart provides vs. what this library adds.

## Install

```bash
npm install sonrchart klinecharts react react-dom
```

## Usage

```tsx
import { SonrChart, type DataSource } from "sonrchart";

// You implement this — REST, websocket, anything. `time` is epoch ms.
const source: DataSource = {
  async getBars(symbol, interval, count) {
    const r = await fetch(`/bars?symbol=${symbol}&interval=${interval}&limit=${count}`);
    return (await r.json()).bars; // [{ time, open, high, low, close, volume }]
  },
  subscribe(symbol, interval, onBar) {
    const ws = new WebSocket(`/stream?symbol=${symbol}`);
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.bar) onBar(m.bar); };
    return () => ws.close();
  },
};

export function Chart() {
  return (
    <div style={{ height: 480 }}>
      <SonrChart
        symbol="AAPL"
        interval="1"
        dataSource={source}
        theme="dark"
        indicators={["VOL"]}
        priceLines={[
          { price: 101.5, color: "#35c98d", label: "Target", style: "dashed" },
          { price: 100.0, color: "#7d93e8", label: "Entry" },
          { price: 98.8,  color: "#ff6a76", label: "Stop", style: "dashed" },
        ]}
      />
    </div>
  );
}
```

The component fills its parent, so give the parent a height.

## Integrating into an app

1. **Install** the package and its peers:
   `npm install sonrchart klinecharts react react-dom`.
2. **Implement a `DataSource`.** This is the whole integration — one object with
   `getBars(symbol, interval, count)` returning `[{ time, open, high, low,
   close, volume }]` (`time` in epoch ms), and an optional `subscribe(symbol,
   interval, onBar)` for live updates that returns an unsubscribe function.
   Point them at your own API/feed.
3. **Render `<SonrChart>`** inside a sized container (it fills its parent),
   passing `symbol`, `interval`, and your `dataSource`. That's a working chart.
4. **Turn on features with props** as you need them — `indicators`, `sessions`,
   `patterns`, `priceLines`, `orderLines`, `compareSeries`, `priceScale`,
   `candleStyle`, `theme`. Each is independent and optional.
5. **Add chrome (optional).** Grab a `ref<SonrChartHandle>` and drop in
   `<ChartToolbar chartRef={ref} … />` (or the individual `IndicatorMenu` /
   `DrawingToolbar`) for interval buttons, indicator toggles, drawing tools, and
   a snapshot button. Add your own controls via the toolbar's children slot.
6. **Drive it imperatively (optional)** through the same `ref` —
   `startDrawing`, `undo`/`redo`, `snapshot`, `exportState`/`importState`,
   `applyIndicatorSet`, etc. (full list under [Props](#props)).
7. **Style it.** The chart uses your `theme`; all toolbar/button classes are
   `sonr-*-btn`, so your app's CSS controls the chrome.

```tsx
import { useRef } from "react";
import { SonrChart, ChartToolbar, type SonrChartHandle, type DataSource } from "sonrchart";

function TradingChart({ source }: { source: DataSource }) {
  const ref = useRef<SonrChartHandle>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <ChartToolbar chartRef={ref} intervals={["1", "5", "60", "D"]} interval="1" onIntervalChange={/* ... */ () => {}} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <SonrChart ref={ref} symbol="AAPL" interval="1" dataSource={source} theme="dark" sessions indicators={["VOL"]} />
      </div>
    </div>
  );
}
```

> **Bundler note:** sonrchart ships ESM + CJS with types, and bundles KLineChart
> in. It's browser-only (canvas), so if you server-render, load it client-side.

## Props

| Prop | Type | Notes |
|---|---|---|
| `symbol` | `string` | Ticker to chart. |
| `interval` | `Interval` | `"10S" \| "30S" \| "1" \| "5" \| "15" \| "30" \| "60" \| "D"` (or any string your DataSource understands). Default `"1"`. |
| `dataSource` | `DataSource` | `getBars(symbol, interval, count)` + optional `subscribe(...)`. The only integration seam. |
| `theme` | `"dark" \| "light"` | Default `"dark"` (the Sonr console palette). |
| `styles` | `DeepPartial<Styles>` | KLineChart style overrides merged over the theme. |
| `indicators` | `(string \| IndicatorSpec)[]` | Indicators to show on first load — a name (`"VOL"`) or a spec (`{ name, pane: "main" \| "new", calcParams }`). Default `["VOL"]`. Runtime changes (menu/handle) persist across symbol and interval switches. |
| `paneHeights` | `Record<string, number>` | Sub-pane pixel heights, keyed by indicator name. |
| `sessions` | `boolean \| { premarket?, afterhours? }` | Tint pre/after-hours session backgrounds (ET). |
| `patterns` | `PatternMarker[]` | Setup markers (`{ time, kind, label }`) drawn on the price pane. |
| `halted` | `boolean \| HaltBadge` | Trading-halt badge: a pill pinned to the top of the price pane against the y-axis. `true` shows the default blue "Halt"; pass `{ label?, color?, textColor? }` to customize. |
| `priceLines` | `PriceLine[]` | Static horizontal reference lines (entry / stop / target). |
| `orderLines` | `OrderLine[]` | Draggable order/position lines; `onMove(price, phase)` fires as the user drags. |
| `priceScale` | `{ type?, invert?, inside? }` | Scale mode — `"normal" \| "percentage" \| "logarithm"`, plus invert / labels-inside. |
| `magnet` | `boolean \| "weak" \| "strong"` | Snap drawing points to nearby OHLC. |
| `candleStyle` | `"candle" \| "hollow" \| "hollow_up" \| "ohlc" \| "area" \| "heikin_ashi"` | Candle rendering style (Heikin Ashi transforms the data). |
| `compareSeries` | `{ symbol, color? }[]` | Overlay other symbols on the main pane, ratio-scaled to share a start price. |
| `barCount` | `number` | Bars requested on load. Default 500. |
| `legendOffset` | `number` | Pixels from the price pane's top where the on-canvas legends (candle + main-pane indicator rows) start. Usually unneeded: a mounted `<ChartHeader>` measures itself and keeps them below its own height automatically. |
| `onReady` | `(chart) => void` | The raw KLineChart instance, for advanced use. |
| `onSymbolError` | `(symbol) => void` | Fired when `dataSource.resolveSymbol` returns `null`. |

A `ref` exposes the full control surface:

```ts
handle.addIndicator(spec); handle.removeIndicator(name); handle.listIndicators();
handle.getIndicatorSet(); handle.applyIndicatorSet(specs); // study templates
handle.startDrawing(tool); handle.clearDrawings();      // drawing tools
handle.undo(); handle.redo(); handle.canUndo(); handle.canRedo(); // drawing history
handle.snapshot({ type: "png" });                        // -> data URL
handle.exportState(); handle.importState(state);         // save / load
handle.chart();                                          // raw KLineChart
```

Custom header controls: drop `ToolbarButton`s (or any element) into
`<ChartToolbar>`'s children slot; they inherit the `sonr-*-btn` classes so the
host styles all chrome through its own CSS.

### Chrome components

Drop-in, ref-driven UI you can use as-is or replace:

- **`<IndicatorMenu chartRef={ref} />`** — toggle indicators.
- **`<DrawingToolbar chartRef={ref} />`** — the curated drawing tools + Clear.
- **`<ChartToolbar chartRef={ref} intervals=… />`** — composes the interval
  buttons, indicator menu, drawing tools, and a Snapshot button into one bar.
- **`downloadSnapshot(handle, "chart.png")`** — save the chart as an image.

### Symbol resolution

Add `resolveSymbol(symbol)` to your `DataSource` to validate/enrich a ticker
before it loads — return a `SymbolInfo` (name, price/volume precision) or `null`
for an unknown symbol (the chart then fires `onSymbolError` and skips loading).

### Persistence

`exportState()` returns a plain-JSON `ChartState` (user drawings + indicators +
scale) for the host to store; `importState(state)` restores the drawings and
indicators.

### Indicator config UI

`IndicatorMenu` is a drop-in control that drives a chart's `ref` — toggling a
button adds/removes that indicator live:

```tsx
import { SonrChart, IndicatorMenu, type SonrChartHandle } from "sonrchart";
const ref = useRef<SonrChartHandle>(null);
// ...
<IndicatorMenu chartRef={ref} />
<SonrChart ref={ref} symbol="AAPL" dataSource={source} />
```

### Sonr custom indicators

`sessions`, `patterns`, and `halted` are Sonr's own custom KLineChart
indicators (registered automatically). Session tinting shades pre-market
(04:00–09:30 ET) and after-hours (16:00–20:00 ET); pattern markers draw a
labeled triangle at each setup's bar (green up for longs, red down for
shorts); the halt badge pins a rounded pill to the top-right of the price
pane while a symbol is trading-halted (drawn on the canvas, so it's included
in snapshots).

## Releases

What each published npm version shipped is documented in the
[changelog](https://github.com/rioaxyz/sonrchart/blob/main/CHANGELOG.md);
every publish is also tagged (`v0.x.y`) with a matching
[GitHub Release](https://github.com/rioaxyz/sonrchart/releases).

## Develop

```bash
npm install
npm run dev        # live demo at http://localhost:5300 (synthetic data, no backend)
npm run build      # tsup -> dist/ (ESM + CJS + d.ts)
npm run typecheck
npm test           # vitest run
npm run coverage   # vitest run --coverage
npm run check      # typecheck + test + build (what CI runs)
```

The demo (`demo/`) drives the chart from a synthetic random-walk source, so it
runs with no backend — the same shape a real host adapter implements.

## Testing

Unit + integration tests run under [Vitest](https://vitest.dev) (jsdom) and
gate every push/PR via GitHub Actions (`.github/workflows/ci.yml`):

- **Pure logic** (`test/internal.test.ts`, `test/session.test.ts`) — interval→
  period mapping, bar conversion, style merge, and the ET session classifier
  including its DST behavior.
- **Feature wiring** (`test/SonrChart.test.tsx`) — KLineChart is mocked so each
  feature is asserted at the integration boundary: data-loader plumbing, the
  indicator API + specs (#4), session-indicator create/override/remove (#10),
  pattern-indicator lifecycle (#5), and static vs. draggable overlays with the
  `onMove` drag callback (#19).
- **Custom-indicator drawing** (`test/indicatorsDraw.test.ts`) — the canvas
  `draw` callbacks run against a fake 2D context: session bands fill pre/after-
  hours only, pattern markers draw a triangle + label colored by direction.
- **Config UI** (`test/IndicatorMenu.test.tsx`) and the demo data source.

Coverage sits near 98% of `src/`. The one path not unit-tested is real
pixel rendering, which the demo harness (`npm run dev`) exercises end to end.

## Performance

The features that run in the render hot path (session/pattern tinting) are
tuned so they cost near-zero per frame — no added dependencies. The ET session
classifier alone is **~80× faster** than a naive `Intl`-per-bar approach and
stays DST-correct. See [PERFORMANCE.md](PERFORMANCE.md); reproduce with
`npm run bench`.

## License

[MIT](LICENSE) © Rioa, LLC
