# Changelog

All notable changes to `@rioaxyz/sonrchart`, per **published npm version**. Each section lists what that version's tarball actually shipped — reconstructed from the merge history against the npm publish timestamps — which can differ from what the version number implies (see 0.3.1). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/) pre-1.0 conventions.

## [Unreleased]

### Changed
- The volume-trend default lookback is now 2 bars (was 3) — `DEFAULT_VOLUME_TREND_BARS`; still editable live in the settings dialog or via `setVolumeTrendBars` (#101).

### Added
- Volume Surge pressure side (#99): each classified bar carries `side: "buying" | "selling" | "neutral"`, inferred from Close Location Value (where the bar closed within its range — the A/D Money Flow Multiplier, with a ±0.2 dead-zone so dojis stay neutral). Surge bars color by side (green / red / amber) and the tooltip reads "Surging (buying)" / "(selling)". Pressure, not positioning — OHLCV can't distinguish longs from shorts. `closeLocationValue`, `surgeSide`, `volumeSurgeColorFor`, and the extended palette are exported.
- Per-symbol drawing persistence (#97): a chart's drawings now survive interval, price-scale, and Heikin-Ashi switches, and each ticker symbol keeps its own isolated drawing set — switch from AAPL to TSLA and back, and AAPL's drawings return. With a `persistenceKey` the sets also survive unmounts; `DrawingStore`, `drawingStoreFor`, and `clearPersistedDrawings` are exported.
- `persistenceKey` prop on `SonrChart` and `SonrChartShell` (#94): carries the user's indicator set across full unmounts of the component — for hosts that remount the chart on symbol changes (`key={symbol}`, or a loading state that swaps it out) — on top of the existing in-instance persistence across symbol/interval/scale switches. The registry is written through on every indicator change; `save`/`load`/`clearPersistedIndicators` are exported.
- This changelog, the `v0.x.y` release tags, and the README Releases section (#92, #93).

## [0.4.0] — 2026-10-10

Published 2026-10-10 01:44 UTC.

### Changed
- Version realignment only: 0.4.0 gives the Volume Surge indicator — which shipped early inside the 0.3.1 tarball, see below — its honest version number (#91). No code changes beyond the bump.

## [0.3.1] — 2026-10-09

Published 2026-10-09 23:41 UTC. **Note:** the tarball was built after the Volume Surge merge landed on `main`, so this patch release also ships 0.4.0's headline feature under the 0.3.1 label. The `v0.3.1` tag points at the published content.

### Added
- Volume Surge indicator (`VSURGE`), with a configurable palette via `extendData` and a scaling benchmark (#90).

### Fixed
- Indicator persistence (#86): studies the user adds or removes at runtime (name, pane, calc params) now survive symbol, interval, price-scale, and Heikin-Ashi switches instead of resetting to the `indicators` prop (#87).
- Canvas legends no longer draw under an overlaid `<ChartHeader>`: the header measures its own height (ResizeObserver) and drives the new `setLegendOffset` handle method so price-pane legend rows start below it; a `legendOffset` prop on `SonrChart` overrides for custom headers (#88).

### Changed
- The Indicators menu is alphabetized by symbol (#85).

## [0.3.0] — 2026-10-08

Published 2026-10-08 01:55 UTC.

### Added
- The volume-trend header row is toggleable from the Indicators menu (`VOLTREND`): its on/off state lives on the chart handle (`get`/`set`/`subscribeVolumeTrendEnabled`), with `ChartHeader`'s `volumeTrend` prop seeding it on (#83).

## [0.2.0] — 2026-10-05

Published 2026-10-05 20:45 UTC.

### Added
- Volume-trend readout (#79): a "Vol trend — Increasing / Decreasing / Mixed" row in `ChartHeader`, classifying the last N bars' volume; lookback editable live in the settings dialog; `subscribeVolumeTrend` on the chart handle (#80).
- Trading-halt badge (#78): the `halted` prop pins a rounded pill to the top of the price pane against the y-axis — canvas-drawn, so it pans with nothing and lands in snapshots (#81).

## [0.1.0] — 2026-10-01

Published 2026-10-01 00:35 UTC as the first public scoped release, `@rioaxyz/sonrchart` (#77).

Initial feature set, including: candlestick charting on KLineChart 10 with dark/light/custom themes; drawing tools (built-in plus brush, shapes, text, and the extended family) with undo/redo, templates, lock/hide, and an object tree; indicators with study templates and a config menu; session tinting, pattern markers, watermark, compare series, and the trade-review box overlay (#76) sharing the candle pane under an explicit z-order (#75); static price lines and draggable order lines; price-scale modes and axis labels; symbol search, resolution, and metadata; timezone and custom-resolution support; snapshots, save/load state, and keyboard shortcuts; `ChartHeader` / `ChartToolbar` / `SonrChartShell` chrome and the homegrown icon set.

[Unreleased]: https://github.com/rioaxyz/sonrchart/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/rioaxyz/sonrchart/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/rioaxyz/sonrchart/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/rioaxyz/sonrchart/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rioaxyz/sonrchart/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rioaxyz/sonrchart/releases/tag/v0.1.0
