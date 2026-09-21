# sonrchart

A themed, data-source-agnostic React charting component for financial
candlestick charts, built on [KLineChart](https://github.com/klinecharts/KLineChart)
(MIT). Extracted from the Sonr trading app so the chart engine can be developed,
versioned, and tested on its own.

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
| `indicators` | `string[]` | Built-in KLine indicators as sub-panes. Default `["VOL"]`. |
| `priceLines` | `PriceLine[]` | Horizontal reference lines (entry / stop / target). |
| `barCount` | `number` | Bars requested on load. Default 500. |
| `onReady` | `(chart) => void` | The raw KLineChart instance, for advanced use. |

A `ref` exposes `{ chart() }` for direct KLineChart access.

## Develop

```bash
npm install
npm run dev        # live demo at http://localhost:5300 (synthetic data, no backend)
npm run build      # tsup -> dist/ (ESM + CJS + d.ts)
npm run typecheck
```

The demo (`demo/`) drives the chart from a synthetic random-walk source, so it
runs with no backend — the same shape a real host adapter implements.

## License

MIT © Rioa, LLC
