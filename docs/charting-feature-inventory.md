# Charting Feature Inventory — TradingView Advanced Charts v36.0.0

> **Roadmap note (sonrchart):** this inventory maps the TradingView Advanced Charts
> feature surface that `sonrchart` works toward. It's the target feature list for this
> library — the "Coverage" table near the bottom shows what KLineChart gives us for free
> vs. what we build here on top. Not everything here is a commitment; it's the menu.


## What this is

`lib/tv-advanced-charts/` contains **TradingView Advanced Charts v36.0.0** (the licensed
"Charting Library" bundle: `charting_library/` + a ~30k-line `charting_library.d.ts`
type surface). It is the current production chart engine embedded in Sonr.

This document inventories what that widget actually does — its chart types, drawing
tools, indicator handling, symbol/data model, layouts, scales, interactions,
persistence, UI chrome, theming, and trading hooks — so we can decide whether to
rebuild a charting wrapper on top of one of two OSS bases:

- **Lightweight Charts (LWC)** — TradingView's own Apache-2.0 rendering core. Minimal:
  a canvas that draws series and scales, plus a small API for markers and price lines.
  No indicators, no drawing tools, no symbol UI, no persistence, no study/pane UI.
- **KLineChart** — MIT-licensed. Ships ~50+ built-in technical indicators, a built-in
  drawing/annotation tool set (roughly 15–25 shapes), multi-pane rendering, tooltips,
  and theming — but a much smaller tool catalog than TV and less UI polish.

The feature lists below are drawn directly from the bundle's own featureset flags (147),
line-tool types (118), the `ChartStyle` enum, and the public widget/chart API method
names. The final two sections map that surface onto LWC and KLineChart.

---

## Chart types / series styles

The `ChartStyle` enum exposes the full TradingView series-type catalog. `setChartType` /
`chartType` switch between them at runtime; `supportedChartTypes` reports what's enabled.

- Standard OHLC types: **Candles** (`Candle`), **Bars** (`Bar`), **Hollow Candles**
  (`HollowCandle`), **Heikin Ashi** (`HeikinAshi`), **HLC Bars** (`HLCBars`).
- Price-line types: **Line**, **Line with Markers** (`LineWithMarkers`), **Step Line**
  (`Stepline`), **Area** (`Area`), **HLC Area** (`HLCArea`), **Baseline** (two-color
  around a reference level), **Column** (histogram-style), **High-Low** (`HiLo`).
- Alternative/aggregation charts that recompute bars independently of time:
  **Renko**, **Kagi**, **Point & Figure** (`PnF`), **Line Break** (`LineBreak`),
  **Range** bars, and **Volume Candles** (`VolCandle`).
- High-Low style has its own toggles for a last-price line/axis label
  (`chart_style_hilo`, `chart_style_hilo_last_price`).

That's ~18 distinct rendering modes, several of which (Renko, Kagi, PnF, Line Break,
Range) are non-time-linear aggregations, not just restyled OHLC.

## Drawing & annotation tools

118 `LineTool*` types are registered. (A handful of the 118 are internal
state/command entries — templates, sync, z-order, style toggles — not user shapes; the
groups below cover the actual drawing catalog.) `selectLineTool` / `selectedLineTool`
drive them programmatically; `createShape`, `createMultipointShape`,
`createAnchoredShape` place them from the API; `getAllShapes` / `getShapeById` /
`removeAllShapes` manage them. Grouped:

- **Trend / line tools (~15):** trend line, ray, extended line, horizontal line,
  horizontal ray, vertical line, cross line, info line, trend angle, parallel channel,
  regression trend, disjoint angle, flat-bottom channel, arrow, path/polyline.
- **Fibonacci (~11):** retracement, extension (trend-based), Fib channel, Fib time zone,
  trend-based Fib time, Fib circles, Fib spiral, Fib speed/resistance fan, Fib
  speed/resistance arcs, Fib wedge.
- **Gann (~5):** Gann fan, Gann square, Gann complex, Gann fixed, plus square/box variants.
- **Pitchfork family (~7):** standard, Schiff, modified Schiff, inside pitchfork,
  pitchfan, with in-place type switching.
- **Elliott Wave (~6):** impulse, triangle, triple combo, double combo, correction, and
  a change-degree control.
- **Harmonic / chart patterns (~8):** XABCD 5-point pattern, ABCD, cypher, three drivers,
  head & shoulders, triangle pattern, and general pattern shapes.
- **Shapes (~8):** rectangle, rotated rectangle, ellipse, circle, triangle, arc,
  polyline, curve/Bezier (cubic and quadratic), brush, highlighter.
- **Arrows & markers (~7):** directional arrow marks (up/down/left/right), arrow marker,
  flag mark, sign post.
- **Text & notes (~7):** text, anchored/absolute text, callout, comment, note, anchored
  note, price label, text note.
- **Measurement / projection (~9):** price range, date range, date-and-price range,
  risk/reward long, risk/reward short, risk/reward reverse, forecast/projection,
  prediction, time cycles, sine line.
- **Volume-profile tool:** fixed-range volume profile (`LineToolFixedRangeVolumeProfile`).
- **Tooling around drawings:** clone, per-tool templates (save/apply/apply-defaults),
  line-style/font-size toggles, label background colors, group management, per-drawing
  sync-in-layout / no-sync, lock/hide all (`lockAllDrawingTools`, `hideAllDrawingTools`),
  z-order (bring to front/back, forward/backward), and copy/paste (`datasource_copypaste`).

This is the single biggest differentiator: ~100 genuine user-facing drawing tools with
templates, grouping, magnet snapping, and persistence.

## Technical indicators / studies

- Ships TradingView's **full built-in study library** (the same 100+ indicators as the
  public product — moving averages, MACD, RSI, Bollinger, Ichimoku, volume profile,
  pivots, etc.). `getStudiesList` enumerates them; `createStudy` adds one;
  `getAllStudies` / `getStudyById` / `removeAllStudies` manage them.
- **Custom indicators** via the Pine-like `custom_indicators_getter` /
  `CustomIndicator` interface — you can register your own study logic (`PineJS`).
- Per-study **inputs, styles, and overrides**: `getStudyInputs`, `getStudyStyles`,
  `applyStudiesOverrides`, `IStudyApi.applyOverrides`.
- **Study (indicator) templates**: save/load named indicator sets via
  `createStudyTemplate` / `applyStudyTemplate` / `loadChartTemplate`, with a header
  button (`study_templates`) and template storage (`chart_template_storage`).
- Studies render in **overlay** (same pane) or in **their own panes**, and can extend
  the time scale (`studies_extend_time_scale`).
- Study status-line / legend display options for symbol, resolution, inputs, and n/a
  handling (`study_symbol_ticker_description`, `dont_show_boolean_study_arguments`,
  `hide_last_na_study_output`, etc.).

## Symbol & data

- **Symbol search** dialog backed by a datafeed `searchSymbols` (`SearchSymbolResultItem`),
  with a configurable request delay, hotkey search (`symbol_search_hot_key`), arbitrary
  input, and a `symbol_search_complete` override hook.
- **Spread / expression operators** in search (e.g. `AAPL/MSFT`, `1/x`, `^`) — toggleable
  for symbol, compare, and study search (`show_spread_operators` and friends).
- **Compare / multi-symbol overlay**: add additional symbols to a chart (`CompareSymbol`,
  `compare_symbols`), with symbol labels and a secondary series that can extend the time
  scale (`secondary_series_extend_time_scale`).
- **Resolutions / intervals**: minute/hour/day/week/month plus custom resolutions
  (`custom_resolutions`), **seconds** (`seconds_resolution`), and **tick**
  (`tick_resolution`) resolution. `setResolution` / `resolution` / `getIntervals`.
- **Sessions**: regular vs **extended (pre/post-market)** sessions
  (`pre_post_market_sessions`, `mainSeriesProperties.sessionId`), session-break
  visibility, and a set-session action.
- **Time zones**: configurable per chart (`timezone`, "exchange" or IANA id), a timezone
  menu, custom aliased timezones, and `getTimezoneApi`.
- **Symbol metadata / logos**: symbol info dialog, currency/unit on the price axis
  (`pricescale_currency`, `pricescale_unit`), long descriptions, price source, and
  symbol/exchange logos in legend and search.

## Multi-chart layouts & panes

- **Multi-chart layouts** (grids of independent charts): `layout`, `setLayout`,
  `chartsCount`, `activeChart`, `activeChartIndex`, `setActiveChart`, plus
  `resetLayoutSizes` / `setLayoutSizes` and `unloadUnusedCharts`.
- **Multiple panes** within a chart for studies: `getPanes`, `getAllPanesHeight`,
  `setAllPanesHeight`, `maximizeChart` / `restoreChart`, pane context menu and
  pane-buttons visibility.
- Cross-chart **synchronization** of symbol, interval, crosshair, date range, and time
  (`symbolSync`, `intervalSync`, `crosshairSync`, `dateRangeSync`, `timeSync`) — and
  "draw on all charts" (`drawOnAllChartsEnabled`).

## Time scale / price scale

- **Price scale modes** (via menu actions and per-series toggles): regular, **logarithmic**,
  **percentage**, **indexed-to-100**, **invert scale**, and **auto-scale**
  (`Chart.PriceScale.ToggleLogarithmic`, `TogglePercentage`, `ToggleIndexedTo100`,
  `ToggleInvertScale`, `ToggleAutoScale`).
- **Multiple price scales**: move scales left/right, merge all scales
  (`MergeAllScalesToLeft/Right`), independent per-study scales.
- Price-scale labels: last value, high/low, average close, bid/ask, symbol name, prev
  close, countdown-to-bar-close, no-overlap.
- **Right-margin control** in absolute or percentage terms
  (`chart_property_page_right_margin_editor`, `show_percent_option_for_right_margin`).
- **Time scale**: visible range get/set (`getVisibleRange`, `setVisibleRange`,
  `getVisibleBarsRange`, `setTimeFrame`), zoom out / fit, fixed left edge
  (`fix_left_edge`), lock-on-resize, price-to-bar ratio lock (`setPriceToBarRatio`,
  `setPriceToBarRatioLocked`), and time-scale marks / countdown.

## Interactions

- **Crosshair** with cross-chart move events (`crossHairMoved`, `onHoveredSourceChanged`)
  and a **magnet mode** for snapping drawings to OHLC (`magnetEnabled`, `magnetMode`).
- **Scroll & zoom**: mouse-drag scroll, horizontal mouse-wheel scroll, wheel scaling,
  pinch-zoom, axis-drag scaling, on-touch drag scroll and touch zoom/move buttons —
  each individually toggleable (`chart_scroll`, `chart_zoom`, `mouse_wheel_scale`,
  `pinch_scale`, etc.). `setScrollEnabled` / `setZoomEnabled`.
- **Keyboard shortcuts**: insert-indicator (`/`), symbol-search-on-keypress, interval
  dialog on key press, save shortcut, `onShortcut` registration, and accessible-keyboard
  and ARIA description modes.
- **Go-to-date**, select-a-bar (`requestSelectBar`), and navigation/control bar buttons.
- **Context menus** on pane, scales, and legend — each independently disable-able —
  plus an `onContextMenu` customization hook.

## Persistence

- **Save / load full chart layouts** two ways: to your server
  (`saveChartToServer` / `loadChartFromServer` / `getSavedCharts` /
  `removeChartFromServer`, with save-as / load / confirm dialogs) and to **localStorage**
  (`use_localstorage_for_settings`, `save_chart_properties_to_local_storage`).
- **Serialize state directly**: `save` / `load` (full layout JSON), plus
  `getLineToolsState` / `applyLineToolsState` for drawings and
  `createStudyTemplate` / `applyStudyTemplate` for indicator sets.
- **Templates**: chart templates (`chart_template_storage`), indicator/study templates,
  and per-drawing tool templates.
- **Undo/redo** with history (`undoRedoState`, `clearUndoHistory`, `header_undo_redo`).
- Optional **separate storage for drawings** and server-side line-tool reloading
  (`saveload_separate_drawings_storage`, `reloadLineToolsFromServer`).

## UI chrome

- **Header toolbar** with individually hideable sections: symbol search, resolutions,
  chart type, indicators, compare, undo/redo, quick search, screenshot, fullscreen,
  settings, and save/load (`header_*` featuresets).
- **Left drawing toolbar** (`left_toolbar`, `side_toolbar_in_fullscreen_mode`,
  `hide_left_toolbar_by_default`).
- **Legend / data window** with per-source rows, show/hide eye, format cog, delete,
  object-tree mode, in-place edit of symbol/resolution, market status, and
  value-based coloring (`legend_widget`, `legend_inplace_edit`, `display_market_status`,
  `legend_bar_change_colors_based_on_value`, …).
- **Bottom bars**: timeframes toolbar and navigation/control bar.
- **Right widget panel / watchlist** (`widgetbar`, `watchList`,
  `show_right_widgets_panel_by_default`), **object tree** (`show_object_tree`), and
  a **news** widget hook (`news`).
- **Dialogs**: properties/settings pages, confirm/notice dialogs, symbol info, go-to-date,
  save-as / load, and dialog-movement constraints.
- **Watermark** (`watermark`) and the "charts by TradingView" logo controls
  (`adaptive_logo`, `move_logo_to_main_pane`).

## Theming & customization

- **Themes**: light/dark theme switching (`changeTheme`, `getTheme`) and full custom
  color themes (`customThemes`, `library_custom_color_themes`).
- **CSS injection**: `addCustomCSSFile` plus CSS custom-property get/set
  (`getCSSCustomPropertyValue`, `setCSSCustomProperty`).
- **Overrides**: deep `applyOverrides` of chart/series/scale properties, plus
  study overrides.
- **Custom UI**: `createButton` / `createDropdown` / `removeButton` to add app buttons
  into the header; navigation/pane-button visibility control.
- Localization (`getLanguage`), number/date/time formats (`dateFormat`, `timeHoursFormat`,
  `mainSeriesPriceFormatter`, `priceFormatter`), and border/padding chrome flags.

## Trading-related UI hooks

- **On-chart order/position primitives**: `createOrderLine`, `createPositionLine`,
  `createExecutionShape` — draggable order lines, position lines, and execution markers.
- **Trade-from-chart** actions and DOM order placement exist as command IDs
  (`Trading.AddOrder`, `Trading.CancelOrder`, `Trading.ClosePosition`,
  `Trading.EditOrder`, `Trading.ModifyPosition`, `Trading.ReversePosition`,
  `Trading.DOMPlace*Order`) and a broker/Account-Manager terminal surface. Note these
  belong to the **Trading Terminal** tier; Advanced Charts exposes the on-chart line
  adapters and can include orders/positions in screenshots (`snapshot_trading_drawings`).

## Export / snapshot

- **Screenshots**: `takeScreenshot` (TradingView-hosted image) and
  `takeClientScreenshot` (client-side canvas), with a header button and
  optional inclusion of trading drawings.
- **Data export**: `exportData` returns the chart's series/study data.
- **Drag-to-export** (`chart_drag_export`, `setDragExportEnabled`).

---

## Coverage: what to build vs. what you get free

Legend: **Free** = works out of the box · **Partial** = primitives exist, you assemble/
extend it · **Build** = not provided, you implement it yourself.

| Category | Lightweight Charts | KLineChart |
|---|---|---|
| Standard series (candle/bar/line/area/baseline/histogram) | **Free** | **Free** |
| Hollow candle / Heikin Ashi / step / HLC | **Build** (Heikin Ashi = precompute) | **Free / Partial** (HA built in; some via transform) |
| Renko / Kagi / PnF / Line Break / Range | **Build** | **Build** (not built in) |
| Drawing & annotation tools (~100) | **Build** (only markers + price lines exist) | **Partial** (~15–25 shapes: lines, Fib, rays, shapes, text; no Gann/Elliott/harmonic/pitchfork) |
| Built-in technical indicators | **Build** (none — bring your own math + rendering) | **Free** (~50+ built in) |
| Custom indicators | **Partial** (compute yourself, render as series) | **Free** (register custom indicator API) |
| Study templates / indicator sets | **Build** | **Build** (no template system) |
| Multi-pane studies | **Partial** (v4 panes API exists; you wire study UI) | **Free** (native sub-panes) |
| Symbol search UI | **Build** | **Build** (no symbol UI — it's a renderer) |
| Compare / multi-symbol overlay | **Partial** (add extra series manually) | **Partial** (multiple series manually) |
| Resolutions incl. seconds/tick | **Free** (you supply data at any granularity) | **Free** (data-driven) |
| Sessions / pre-post market / timezones | **Partial** (time scale is generic; session logic is yours) | **Partial** (same — you handle sessions) |
| Multi-chart layouts (grids) | **Build** (one chart per instance; you build the grid + sync) | **Build** (same) |
| Price scale: log / percent / invert / multi-scale | **Partial** (log + autoscale free; percent/indexed/multi = build) | **Partial** (log/percent yes; fewer scale modes than TV) |
| Crosshair / magnet | Crosshair **Free**; magnet **Build** | Crosshair **Free**; magnet **Build** |
| Zoom / scroll / pinch / keyboard | Zoom/scroll **Free**; keyboard shortcuts **Build** | Zoom/scroll **Free**; keyboard **Build** |
| Save / load layouts, drawings, templates | **Build** (no persistence) | **Build** (you serialize overlays yourself) |
| Undo / redo | **Build** | **Build** |
| Header / left toolbar / legend / dialogs / watchlist | **Build** (headless canvas) | **Partial** (built-in tooltip/legend; toolbars & dialogs are yours) |
| Theming (light/dark, overrides) | **Partial** (options API; no theme presets) | **Free** (styles object, light/dark) |
| Custom CSS / custom buttons | **Build** (it's your DOM anyway) | **Build** (your DOM) |
| Trading on-chart order/position lines | **Build** (price lines can approximate) | **Build** |
| Screenshot / snapshot | **Partial** (`takeScreenshot` to canvas) | **Partial** (canvas export) |
| Data export | **Partial** (you hold the data) | **Partial** (you hold the data) |

**Reading the table:** TV's surface is enormous — roughly 100 drawing tools, 100+
indicators, ~18 series types, multi-chart grids with sync, full persistence, a complete
header/left/legend/dialog chrome, and trading line adapters. Neither OSS base reproduces
the *UI chrome*, *persistence*, *symbol search*, *multi-chart grids*, or *the deep
drawing catalog* — those are "build" on both. The decisive split is **indicators and
basic drawings**: KLineChart hands you those for free; LWC hands you nothing above raw
series rendering.

## Bottom line

The TradingView widget is a full charting *application*, not a chart *renderer* — most
of its value is the indicator library, the ~100 drawing tools with templates/magnet/
grouping, multi-chart layouts, persistence, and the surrounding toolbars, legend, search,
and dialogs. Any OSS rebuild reproduces the chrome, persistence, symbol search, and
multi-chart/sync layer ourselves regardless of base; that work is roughly equal on both.

The real tradeoff is what you inherit underneath that shell:

- **KLineChart** gets you materially closer, faster: ~50+ indicators, a starter set of
  ~15–25 drawing tools, native sub-panes, tooltips, and light/dark theming out of the
  box. The cost is polish and ceiling — the drawing catalog is a fraction of TV's (no
  Gann/Elliott/harmonic/pitchfork), the alternative chart types (Renko/Kagi/PnF) aren't
  there, and you'll invest in theming and extending it to feel first-class. It's the
  better base if the goal is "recognizable TradingView-like chart with indicators and a
  handful of drawings, soon."

- **Lightweight Charts** is a cleaner, smaller, TradingView-authored rendering core with
  excellent series/scale fidelity and a v4 panes API — but it gives you *nothing* above
  rendering: every indicator's math and rendering, every drawing tool, magnet, and all
  persistence is yours to build. It's the better base if we want a tightly controlled,
  minimal chart we own end-to-end and only need a small, curated feature set (Sonr's own
  pattern overlays, a few indicators, price/markers) rather than a broad
  general-purpose charting product.

In short: **KLine minimizes near-term build at the cost of extension/theming work and a
lower ceiling; LWC minimizes surface area and maximizes control at the cost of building
indicators and drawings from scratch.** The choice hinges on how much of TV's *breadth*
(many indicators + many drawing tools) Sonr actually needs versus a curated, owned set.
