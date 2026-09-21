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
bars come from. See [`docs/charting-feature-inventory.md`](docs/charting-feature-inventory.md)
for the full feature target (a map of the TradingView Advanced Charts surface
we're working toward) and what KLine gives us vs. what we build here.

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

## Props

| Prop | Type | Notes |
|---|---|---|
| `symbol` | `string` | Ticker to chart. |
| `interval` | `Interval` | `"10S" \| "30S" \| "1" \| "5" \| "15" \| "30" \| "60" \| "D"` (or any string your DataSource understands). Default `"1"`. |
| `dataSource` | `DataSource` | `getBars(symbol, interval, count)` + optional `subscribe(...)`. The only integration seam. |
| `theme` | `"dark" \| "light"` | Default `"dark"` (the Sonr console palette). |
| `styles` | `DeepPartial<Styles>` | KLineChart style overrides merged over the theme. |
| `indicators` | `(string \| IndicatorSpec)[]` | Indicators to show — a name (`"VOL"`) or a spec (`{ name, pane: "main" \| "new", calcParams }`). Default `["VOL"]`. |
| `paneHeights` | `Record<string, number>` | Sub-pane pixel heights, keyed by indicator name. |
| `sessions` | `boolean \| { premarket?, afterhours? }` | Tint pre/after-hours session backgrounds (ET). |
| `patterns` | `PatternMarker[]` | Setup markers (`{ time, kind, label }`) drawn on the price pane. |
| `priceLines` | `PriceLine[]` | Static horizontal reference lines (entry / stop / target). |
| `orderLines` | `OrderLine[]` | Draggable order/position lines; `onMove(price, phase)` fires as the user drags. |
| `priceScale` | `{ type?, invert?, inside? }` | Scale mode — `"normal" \| "percentage" \| "logarithm"`, plus invert / labels-inside. |
| `magnet` | `boolean \| "weak" \| "strong"` | Snap drawing points to nearby OHLC. |
| `barCount` | `number` | Bars requested on load. Default 500. |
| `onReady` | `(chart) => void` | The raw KLineChart instance, for advanced use. |
| `onSymbolError` | `(symbol) => void` | Fired when `dataSource.resolveSymbol` returns `null`. |

A `ref` exposes the full control surface:

```ts
handle.addIndicator(spec); handle.removeIndicator(name); handle.listIndicators();
handle.startDrawing(tool); handle.clearDrawings();      // drawing tools
handle.snapshot({ type: "png" });                        // -> data URL
handle.exportState(); handle.importState(state);         // save / load
handle.chart();                                          // raw KLineChart
```

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

`sessions` and `patterns` are Sonr's own custom KLineChart indicators
(registered automatically). Session tinting shades pre-market (04:00–09:30 ET)
and after-hours (16:00–20:00 ET); pattern markers draw a labeled triangle at
each setup's bar (green up for longs, red down for shorts).

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
