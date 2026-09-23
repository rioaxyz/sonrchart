# sonrchart — Feature Roadmap (remaining)

> **How to read this:** this is the *remaining* target surface for `sonrchart` —
> the features from the original full-charting inventory that are **not yet
> built**. Anything already shipped (candle styles, the curated drawing set with
> magnet + undo/redo, the indicator dropdown + custom indicators + templates,
> compare, sessions/timezone, price-scale modes, crosshair + date/time readout,
> export/import persistence, the toolbar/settings/legend chrome, theming, on-chart
> trade lines, snapshot, and the symbol/interval watermark) has been removed from
> the lists below. It stays a roadmap, not a commitment: most of what's left is
> aspirational, and a curated subset done well beats the whole catalog done
> vaguely. The **Coverage** table near the bottom shows the still-open categories
> against the [KLineChart](https://github.com/klinecharts/KLineChart) base.

## What this is

An inventory of the capabilities a full-featured charting *application* exposes,
narrowed to what `sonrchart` has **not** implemented yet. It was compiled by
surveying the feature surface of a mature commercial charting widget (147
capability flags, 118 drawing-tool types, its chart-style catalog, and its public
API), so it's a realistic ceiling to measure the remaining gap against rather
than a wishlist invented from scratch.

`sonrchart` is built on **KLineChart** (MIT) as its rendering base — candles,
~50+ built-in technical indicators, multi-pane rendering, tooltips, and theming
come from the base and are already wired up. What's below is the delta between
that (plus everything sonrchart has since built) and the full surface.

---

## Chart types / series styles

Shipped: Candles, Bars (OHLC), Hollow Candles, Heikin Ashi, Area. Still open:

- Additional price-line types: **Line**, **Line with Markers** (`LineWithMarkers`),
  **Step Line** (`Stepline`), **HLC Area** (`HLCArea`), **HLC Bars** (`HLCBars`),
  **Baseline** (two-color around a reference level), **Column** (histogram-style),
  **High-Low** (`HiLo`) — with High-Low's own last-price line/axis-label toggles
  (`chart_style_hilo`, `chart_style_hilo_last_price`).
- Alternative/aggregation charts that recompute bars independently of time:
  **Renko**, **Kagi**, **Point & Figure** (`PnF`), **Line Break** (`LineBreak`),
  **Range** bars, and **Volume Candles** (`VolCandle`). Several of these are
  non-time-linear aggregations, not just restyled OHLC — the real build cost here.

## Drawing & annotation tools

Shipped: a curated ~11-tool set (trend line, ray, extended line, horizontal,
vertical, price line, parallel channel, price channel, Fibonacci retracement,
note, tag) plus magnet snapping, undo/redo, and clear-all. The long tail of the
118 `LineTool*` catalog is still open:

- **Trend / line tools:** horizontal ray, cross line, info line, trend angle,
  regression trend, disjoint angle, flat-bottom channel, arrow, path/polyline.
- **Fibonacci (~10):** extension (trend-based), Fib channel, Fib time zone,
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
- **Text & notes:** anchored/absolute text, callout, comment, anchored note,
  price label, text note.
- **Measurement / projection (~9):** price range, date range, date-and-price range,
  risk/reward long, risk/reward short, risk/reward reverse, forecast/projection,
  prediction, time cycles, sine line.
- **Volume-profile tool:** fixed-range volume profile (`LineToolFixedRangeVolumeProfile`).
- **Tooling around drawings still to add:** clone, per-tool templates
  (save/apply/apply-defaults), line-style/font-size toggles, label background
  colors, group management, per-drawing sync-in-layout / no-sync, lock/hide all
  (`lockAllDrawingTools`, `hideAllDrawingTools`), z-order (bring to front/back,
  forward/backward), and copy/paste (`datasource_copypaste`).

## Technical indicators / studies

Shipped: a dropdown config UI over a curated set (VOL/MA/EMA/BOLL/SAR/MACD/RSI/KDJ
+ custom VWAP/session/pattern/watermark), custom-indicator registration,
per-indicator color override, multi-pane sub-panes, and named indicator-set
templates (`getIndicatorSet` / `applyIndicatorSet`). Still open:

- **Surface more of the base library** — KLineChart ships ~50+ indicators; only a
  curated subset is exposed today. The full ceiling is 100+ (Ichimoku, pivots,
  volume profile, etc.).
- **Per-study inputs UI**: editing an indicator's calculation parameters/inputs
  (not just its color), i.e. `getStudyInputs` / `getStudyStyles` equivalents.
- Study status-line / legend display options for symbol, resolution, inputs, and
  n/a handling (`study_symbol_ticker_description`, `dont_show_boolean_study_arguments`,
  `hide_last_na_study_output`, etc.).

## Symbol & data

Shipped: DataSource seam (history + live) with symbol resolution, compare /
multi-symbol overlay, seconds resolutions, ET timezone, and pre/post-market
session tinting. Still open:

- **Symbol search** dialog backed by a datafeed `searchSymbols`
  (`SearchSymbolResultItem`), with a configurable request delay, hotkey search
  (`symbol_search_hot_key`), arbitrary input, and a `symbol_search_complete` hook.
- **Spread / expression operators** in search (e.g. `AAPL/MSFT`, `1/x`, `^`) —
  toggleable for symbol, compare, and study search (`show_spread_operators`).
- **Tick** resolution (`tick_resolution`) and arbitrary **custom resolutions**
  (`custom_resolutions`) beyond the current interval set.
- **Configurable time zones** beyond the baked-in ET: a timezone menu, custom
  aliased timezones, and `getTimezoneApi`.
- **Symbol metadata / logos**: symbol info dialog, currency/unit on the price axis
  (`pricescale_currency`, `pricescale_unit`), long descriptions, price source, and
  symbol/exchange logos in legend and search.

## Multi-chart layouts & panes

Sub-panes within a chart are shipped (via KLineChart + `paneHeights`). Still open:

- **Multi-chart layouts** (grids of independent charts): `layout`, `setLayout`,
  `chartsCount`, `activeChart`, `setActiveChart`, plus `resetLayoutSizes` /
  `setLayoutSizes` and `unloadUnusedCharts`. (Today the host owns any grid.)
- Cross-chart **synchronization** of symbol, interval, crosshair, date range, and
  time (`symbolSync`, `intervalSync`, `crosshairSync`, `dateRangeSync`,
  `timeSync`) — and "draw on all charts" (`drawOnAllChartsEnabled`).
- `maximizeChart` / `restoreChart`, pane context menu, and pane-buttons visibility.

## Time scale / price scale

Shipped: price-scale type (regular / logarithmic / percentage) plus invert and
inside-labels. Still open:

- Remaining scale modes: **indexed-to-100** (`ToggleIndexedTo100`) and an explicit
  **auto-scale** toggle UI (`ToggleAutoScale`).
- **Multiple price scales**: move scales left/right, merge all scales
  (`MergeAllScalesToLeft/Right`), independent per-study scales.
- Price-scale labels: last value, high/low, average close, bid/ask, symbol name,
  prev close, countdown-to-bar-close, no-overlap.
- **Right-margin control** in absolute or percentage terms
  (`chart_property_page_right_margin_editor`, `show_percent_option_for_right_margin`).
- **Time-scale controls**: user-facing visible-range get/set (`setVisibleRange`,
  `setTimeFrame`), zoom-out / fit, fixed left edge (`fix_left_edge`),
  lock-on-resize, price-to-bar-ratio lock (`setPriceToBarRatioLocked`), and
  time-scale marks / countdown.

## Interactions

Shipped: crosshair (with the date/time axis readout) and magnet-to-OHLC snapping;
scroll/zoom come from the base. Still open:

- **Keyboard shortcuts**: insert-indicator (`/`), symbol-search-on-keypress,
  interval dialog on key press, save shortcut, `onShortcut` registration, and
  accessible-keyboard / ARIA description modes.
- **Go-to-date**, select-a-bar (`requestSelectBar`), and navigation/control-bar buttons.
- **Context menus** on pane, scales, and legend — each independently disable-able —
  plus an `onContextMenu` customization hook.

## Persistence

Shipped: undo/redo history and direct state serialize/restore (`exportState` /
`importState`, covering drawings + indicators + price scale) and named indicator
templates. Still open:

- **Save / load full chart layouts to a server**: `saveChartToServer` /
  `loadChartFromServer` / `getSavedCharts` / `removeChartFromServer`, with
  save-as / load / confirm dialogs.
- **localStorage-backed settings** (`use_localstorage_for_settings`,
  `save_chart_properties_to_local_storage`).
- **Named chart templates** (`chart_template_storage`) and per-drawing-tool templates.
- Optional **separate storage for drawings** and server-side line-tool reloading
  (`saveload_separate_drawings_storage`, `reloadLineToolsFromServer`).

## UI chrome

Shipped: the header toolbar (with hideable sections), the drawing toolbar, the
built-in legend/OHLC readout, the settings dialog, and the symbol/interval
watermark. Still open:

- **Legend / data window** advanced features: per-source rows, show/hide eye,
  format cog, delete, object-tree mode, in-place edit of symbol/resolution, market
  status, and value-based coloring (`legend_inplace_edit`, `display_market_status`,
  `legend_bar_change_colors_based_on_value`, …).
- **Bottom bars**: timeframes toolbar and navigation/control bar.
- **Right widget panel / watchlist** (`widgetbar`, `watchList`), **object tree**
  (`show_object_tree`), and a **news** widget hook (`news`).
- **Dialogs**: symbol info, go-to-date, save-as / load, confirm/notice, and
  dialog-movement constraints.
- **Logo / branding** placement controls.

## Theming & customization

Shipped: light/dark, the Sonr palette, deep style overrides via the `styles`
prop, runtime monochrome defaults, custom header buttons (`ToolbarButton`), and
the settings color pickers. Still open:

- **Multiple named custom color themes** (`customThemes`,
  `library_custom_color_themes`) beyond light/dark.
- **CSS custom-property get/set** at runtime (`getCSSCustomPropertyValue`,
  `setCSSCustomProperty`) and `addCustomCSSFile`.
- **Localization** (`getLanguage`) and full number/date/time formatter hooks
  (`dateFormat`, `timeHoursFormat`, `mainSeriesPriceFormatter`, `priceFormatter`)
  beyond the crosshair date format already customized.

## Trading-related UI hooks

Shipped: on-chart order/position/reference lines — static `priceLines` and
draggable `orderLines` (entry / stop / target), plus pattern-context execution
markers. Still open:

- **Trade-from-chart** actions — add / cancel / edit / modify / close / reverse
  order and position commands, plus depth-of-market order placement and a
  broker/account-manager surface. This is the heaviest tier of trading
  integration and squarely optional for a chart component.

## Export / snapshot

Shipped: a client-side canvas snapshot helper (`downloadSnapshot`, with optional
inclusion of overlays). Still open:

- **Data export**: an `exportData`-style helper returning the chart's
  series/study data (today the host already holds the data).
- **Drag-to-export** (`chart_drag_export`, `setDragExportEnabled`).

---

## Coverage: still-open categories vs. the KLineChart base

`sonrchart` renders on **KLineChart**. This table lists only the categories with
work remaining (fully-shipped categories have been dropped).

Legend: **Free** = works out of the box in KLineChart · **Partial** = primitives
exist, sonrchart would assemble/extend them · **Build** = not in the base.

| Category | KLineChart base | remaining work |
|---|---|---|
| Line / step / baseline / HLC / column / high-low styles | **Free / Partial** | expose the remaining series types |
| Renko / Kagi / PnF / Line Break / Range | **Build** | precompute + custom render |
| Exotic drawing families (Gann / Elliott / harmonic / pitchfork / measurement) | **Build** | add if wanted; long tail of the 118-tool catalog |
| Drawing templates / clone / z-order / copy-paste / lock-hide | **Build** | tooling around the shipped drawing set |
| Wider indicator library + per-study inputs UI | **Free** (~50+ built in) | surface more; add an inputs editor |
| Symbol search UI + spread operators | **Build** | host-provided search dialog |
| Tick resolution / custom resolutions / timezone menu | **Partial** | beyond the current interval set + ET |
| Symbol metadata / logos / currency-unit axis | **Build** | info dialog + axis units |
| Multi-chart layouts (grids) + cross-chart sync | **Build** | host owns the grid today |
| Multiple price scales / scale labels / right-margin / indexed-100 | **Partial** | beyond log/percent/invert |
| Time-scale controls (fit / fix-left / ratio-lock / go-to-date) | **Partial** | surface the UI |
| Keyboard shortcuts / context menus | **Build** | shortcut + menu layer |
| Server / localStorage layout save-load + templates | **Build** | beyond in-memory export/import |
| Advanced legend / data window / watchlist / news / object tree | **Partial** | richer chrome (or host's) |
| Named custom themes / CSS custom-props / localization / formatters | **Free / Build** | beyond light-dark + style overrides |
| Trade-from-chart broker actions (DOM, account manager) | **Build** | heaviest trading tier |
| Data export / drag-to-export | **Partial** | expose a helper |

## Bottom line

A full charting product is an *application*, not just a renderer. `sonrchart` has
now shipped the core surface — candles + styles, a curated drawing set with
magnet/undo/redo, the indicator dropdown with custom studies and templates,
compare, sessions/timezone, price-scale modes, the crosshair readout, export/
import persistence, the toolbar/settings/legend chrome, theming, on-chart trade
lines, snapshot, and the watermark.

What's left above is either genuinely optional (Renko/Kagi/PnF, the exotic drawing
families, multi-chart grids, broker actions) or incremental depth on surfaces that
already exist (more series types, a wider indicator library with an inputs editor,
richer scales and chrome, server-side persistence). This inventory is the map of
what's still *possible*; the product decides how much of it is worth building.
Own the glass, not the ocean.
