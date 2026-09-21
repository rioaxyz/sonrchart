# sonrchart — Feature Roadmap

> **How to read this:** this is the target feature surface for `sonrchart` — the
> full menu of capabilities a serious financial charting component can offer,
> organized by category. It is a roadmap, not a commitment: most of what's listed
> is aspirational, and a curated subset done well beats the whole catalog done
> vaguely. The **Coverage** table near the bottom shows which of these
> [KLineChart](https://github.com/klinecharts/KLineChart) (our rendering base)
> gives us for free versus what `sonrchart` builds on top.


## What this is

An inventory of the capabilities a full-featured charting *application* exposes —
chart types, drawing tools, indicator handling, symbol/data model, layouts,
scales, interactions, persistence, UI chrome, theming, and trading hooks. It was
compiled by surveying the feature surface of a mature commercial charting widget,
so it's a realistic ceiling to measure `sonrchart` against rather than a wishlist
invented from scratch.

`sonrchart` is built on **KLineChart** (MIT) as its rendering base — it ships
~50+ built-in technical indicators, a built-in drawing/annotation tool set
(roughly 15–25 shapes), multi-pane rendering, tooltips, and theming out of the
box. The gap between that and the full surface below is exactly the work this
library takes on.

The feature lists below were compiled from a mature charting widget's own capability
flags (147), drawing-tool types (118), its chart-style catalog, and its public
widget/chart API surface — so the categories are grounded in a real product, not
guessed at. The final two sections map that surface onto the KLineChart base and
what sonrchart builds on top.

---

## Chart types / series styles

A full series-type catalog, switchable at runtime, with the host able to control
which types are enabled.

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

- A **full built-in study library** as the ceiling (100+ indicators — moving
  averages, MACD, RSI, Bollinger, Ichimoku, volume profile,
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
- **Watermark** support and logo/branding placement controls.

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
- **Trade-from-chart** actions — add / cancel / edit / modify / close / reverse
  order and position commands, plus depth-of-market order placement and a
  broker/account-manager surface. These are the heaviest tier of trading
  integration; at minimum, the on-chart line adapters above (order/position/
  execution) cover most of what a chart needs, and orders/positions can be
  included in exported snapshots.

## Export / snapshot

- **Screenshots**: both a hosted-image capture and a client-side canvas capture,
  with a header button and optional inclusion of trading drawings.
- **Data export**: `exportData` returns the chart's series/study data.
- **Drag-to-export** (`chart_drag_export`, `setDragExportEnabled`).

---

## Coverage: what the base gives us vs. what sonrchart builds

`sonrchart` renders on **KLineChart**. This table maps each roadmap category to
what the base provides today and what this library takes on to reach the surface
above.

Legend: **Free** = works out of the box in KLineChart · **Partial** = primitives
exist, sonrchart assembles/extends them · **Build** = not in the base, sonrchart
implements it.

| Category | KLineChart base | sonrchart's job |
|---|---|---|
| Standard series (candle/bar/line/area/baseline/histogram) | **Free** | wire props, theme |
| Hollow candle / Heikin Ashi / step / HLC | **Free / Partial** | expose the ones we want |
| Renko / Kagi / PnF / Line Break / Range | **Build** | precompute + custom render if needed |
| Drawing & annotation tools | **Partial** (~15–25 shapes: lines, Fib, rays, shapes, text) | curate a set; add Gann/Elliott/harmonic/pitchfork if wanted |
| Built-in technical indicators | **Free** (~50+ built in) | surface a config UI |
| Custom indicators | **Free** (register-indicator API) | ship Sonr's own (pattern context, etc.) |
| Study templates / indicator sets | **Build** | save/restore named sets |
| Multi-pane studies | **Free** (native sub-panes) | layout + defaults |
| Symbol search UI | **Build** | host-provided; the DataSource resolves symbols |
| Compare / multi-symbol overlay | **Partial** | add extra series manually |
| Resolutions incl. seconds/tick | **Free** (data-driven) | interval → period mapping (done) |
| Sessions / pre-post market / timezones | **Partial** | session tinting + timezone (done: ET) |
| Multi-chart layouts (grids) | **Build** | host owns the grid + cross-chart sync |
| Price scale: log / percent / invert / multi-scale | **Partial** (log/percent yes) | expose modes; multi-scale if needed |
| Crosshair / magnet | Crosshair **Free**; magnet **Build** | magnet-to-OHLC snapping |
| Zoom / scroll / pinch / keyboard | Zoom/scroll **Free**; keyboard **Build** | keyboard shortcuts |
| Save / load layouts, drawings, templates | **Build** | serialize overlays + settings |
| Undo / redo | **Build** | history stack |
| Header / left toolbar / legend / dialogs | **Partial** (built-in tooltip/legend) | toolbars & dialogs are ours (or the host's) |
| Theming (light/dark, overrides) | **Free** (styles object) | Sonr palette baked in (done) |
| Custom CSS / custom buttons | **Build** | it's our DOM — trivial |
| Trading on-chart lines (entry/stop/target, orders) | **Build** | `priceLines` prop (done); draggable order lines later |
| Screenshot / snapshot | **Partial** (canvas export) | expose a capture helper |
| Data export | **Partial** | the host holds the data |

**Reading the table:** the base hands us the expensive middle for free —
candles, ~50+ indicators, sub-panes, tooltips, theming, and a starter drawing
set. What's left is either genuinely optional (Renko/Kagi/PnF, the exotic
drawing families, multi-chart grids) or squarely `sonrchart`'s value-add: the
trade-plan overlays, a curated indicator/drawing surface, persistence, and the
Sonr look. "Done" markers above are already shipped in the current scaffold.

## Bottom line

A full charting product is an *application*, not just a renderer — most of its
weight is the indicator library, the deep drawing catalog with
templates/magnet/grouping, multi-chart layouts, persistence, and the surrounding
toolbars, legend, and dialogs. `sonrchart` deliberately doesn't chase all of it.

The base (KLineChart) already covers the hardest-to-build middle — rendering,
indicators, sub-panes, and theming — so this library spends its effort where it
matters for Sonr: **the trade plan drawn on the price, a curated and well-themed
feature set, and a clean data seam** rather than a general-purpose everything-chart.
This inventory is the map of what's *possible*; the product decides how much of it
is worth building. Own the glass, not the ocean.
