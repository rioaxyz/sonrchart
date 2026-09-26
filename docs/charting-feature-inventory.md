# sonrchart — Feature Roadmap (remaining)

> **How to read this:** this is the *remaining* target surface for `sonrchart` —
> the features from the original full-charting inventory that are **not yet
> built**. Anything already shipped (candle styles, the curated drawing set with
> magnet + undo/redo, the full indicator library + inputs editor + custom
> indicators + templates, symbol search + spread operators, compare,
> sessions/timezone, price-scale modes, crosshair + date/time readout,
> export/import persistence, the toolbar/settings/legend chrome, theming, on-chart
> trade lines, snapshot, and the symbol/interval watermark) has been removed from
> the lists below. It stays a roadmap, not a commitment: most of what's left is
> aspirational, and a curated subset done well beats the whole catalog done
> vaguely. The **Coverage** table near the bottom shows the still-open categories
> against the [KLineChart](https://github.com/klinecharts/KLineChart) base.

> **Reconciled 2026-09-25.** The three remaining roadmap issues — #34 (exotic
> drawing families), #38 (custom resolutions + timezone), #39 (symbol metadata) —
> have been implemented and closed. This pass also brings the doc back in line
> with what shipped in PRs #59–#68. Notation:
>
> - ~~struck~~ **✓ shipped** — implemented (issue/PR noted).
> - ~~struck~~ — **user did not decide to implement** — was in an issue's scope
>   but deliberately deferred; the reason follows.
> - un-struck bullets are genuine future roadmap (never scoped into an issue).

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

Shipped: Candles, Bars (OHLC), Hollow Candles, Heikin Ashi, Area, plus the
custom-drawn **Line, Step Line, Baseline, Column, HLC bars, and High-Low** series
(#33 — rendered over hidden native candles). Still open:

- The remaining price-line variants: **Line with Markers** (`LineWithMarkers`) and
  **HLC Area** (`HLCArea`), plus High-Low's own last-price line/axis-label toggles
  (`chart_style_hilo`, `chart_style_hilo_last_price`).
- Alternative/aggregation charts that recompute bars independently of time:
  **Renko**, **Kagi**, **Point & Figure** (`PnF`), **Line Break** (`LineBreak`),
  **Range** bars, and **Volume Candles** (`VolCandle`). Several of these are
  non-time-linear aggregations, not just restyled OHLC — the real build cost here.

## Drawing & annotation tools

Shipped: a curated ~19-tool set (trend line, ray, extended line, horizontal,
vertical, price line, parallel channel, price channel, Fibonacci retracement,
text, note, tag, brush, highlighter, rectangle, ellipse, triangle, price range,
risk/reward) plus magnet snapping, undo/redo, and clear-all. The long tail of the
118 `LineTool*` catalog:

- **Trend / line tools:** ~~horizontal ray~~ **✓ #34**, ~~cross line~~ **✓ #34**,
  info line, trend angle, regression trend, disjoint angle, flat-bottom channel,
  ~~arrow~~ **✓ #34** (directional arrow with head), path/polyline.
- **Fibonacci:** ~~extension (trend-based)~~ **✓ #34**, ~~Fib time zone~~ **✓ #34**;
  ~~Fib channel, Fib circles, Fib spiral, Fib speed/resistance fan, Fib
  speed/resistance arcs, Fib wedge~~ — **user did not decide to implement** (in
  #34's scope; no KLineChart primitive, each a substantial standalone build).
- ~~**Gann (~5):** Gann fan, Gann square, Gann complex, Gann fixed, square/box
  variants~~ — **user did not decide to implement** (#34; no base primitive).
- ~~**Pitchfork family (~7):** standard, Schiff, modified Schiff, inside
  pitchfork, pitchfan, with in-place type switching~~ — **user did not decide to
  implement** (#34; no base primitive).
- ~~**Elliott Wave (~6):** impulse, triangle, triple combo, double combo,
  correction, change-degree control~~ — **user did not decide to implement**
  (#34; no base primitive).
- ~~**Harmonic / chart patterns (~8):** XABCD 5-point, ABCD, cypher, three
  drivers, head & shoulders, triangle pattern, general pattern shapes~~ — **user
  did not decide to implement** (#34; no base primitive).
- **Shapes:** ~~rectangle, ellipse, triangle~~ **✓ shipped (shapes.ts)**,
  ~~brush, highlighter~~ **✓ shipped**; still open — rotated rectangle, circle,
  arc, curve/Bezier (cubic and quadratic), polyline.
- **Arrows & markers:** ~~directional arrow~~ **✓ #34**; still open — arrow
  marker, flag mark, sign post.
- **Text & notes:** ~~anchored text, anchored note, tag~~ **✓ shipped
  (textOverlay.ts + curated set)**; still open — callout, comment, price label,
  absolute (non-anchored) text.
- **Measurement / projection:** ~~price range~~ **✓ shipped (shapes.ts)**,
  ~~risk/reward long~~ **✓ shipped**, ~~date range, date-and-price range~~
  **✓ #34**; ~~risk/reward short, risk/reward reverse, forecast/projection,
  prediction, time cycles, sine line~~ — **user did not decide to implement**
  (#34; niche, no base primitive).
- **Volume-profile tool:** fixed-range volume profile
  (`LineToolFixedRangeVolumeProfile`) — still open.
- **Tooling around drawings:** ~~clone/duplicate, z-order (bring to
  front/back), lock/hide all, copy/paste~~ **✓ shipped (#35)**, ~~per-tool
  save/load state via export/import~~ **✓ shipped**; still open — per-tool style
  templates (save/apply defaults) with a template picker, per-drawing
  sync-in-layout / no-sync, drawing group management, label background colors.

## Technical indicators / studies

Shipped: a dropdown config UI over the **full KLineChart built-in library** (28
indicators — MA/EMA/SMA/BBI/BOLL/SAR/DMA overlays + VOL/MACD/RSI/KDJ/BIAS/BRAR/
CCI/DMI/CR/PSY/TRIX/OBV/VR/WR/MTM/EMV/ROC/PVT/AO in sub-panes + custom
VWAP/session/pattern/watermark), custom-indicator registration, per-indicator
color override **and a per-study inputs editor** (edit each indicator's
`calcParams`), multi-pane sub-panes, and named indicator-set templates
(`getIndicatorSet` / `applyIndicatorSet`). Still open:

- Study status-line / legend display options for symbol, resolution, inputs, and
  n/a handling (`study_symbol_ticker_description`, `dont_show_boolean_study_arguments`,
  `hide_last_na_study_output`, etc.).

## Symbol & data

Shipped: DataSource seam (history + live) with symbol resolution, a **symbol-search
dialog** (`searchSymbols` on the DataSource) with **spread/expression pass-through**
(`AAPL/MSFT`, `1/x`), compare / multi-symbol overlay, seconds resolutions, ET
timezone, and pre/post-market session tinting.

- ~~**Custom resolutions** (`custom_resolutions`) beyond the current interval
  set~~ **✓ #38** — `resolutions.ts` parses any span of
  seconds/minutes/hours/days/weeks/months/years.
- ~~**Tick** resolution (`tick_resolution`)~~ — **user did not decide to
  implement** (#38; KLineChart aggregates by period and has no tick mode — a
  genuine tick stream needs a custom series).
- ~~**Configurable time zones** beyond the baked-in ET: a timezone menu, custom
  aliased timezones, and `getTimezoneApi`~~ **✓ #38** — `timezone` prop +
  handle + `<TimezoneMenu>` + `DEFAULT_TIMEZONES` + `getTimezoneApi()`.
- ~~**Symbol metadata / logos**: symbol info dialog~~ **✓ shipped (#64)**;
  ~~currency/unit on price (`pricescale_currency`, `pricescale_unit`), long
  descriptions, price source, and symbol/exchange logos in legend and search~~
  **✓ #39** — currency/unit decorate the legend + crosshair pill + info dialog;
  logos in the info dialog and search; description + price source in the dialog.
  ~~Per-gridline y-axis **tick** currency prefix~~ — **user did not decide to
  implement** (#39; KLineChart's `Formatter` has no y-axis price hook and its one
  global hook `thousandsSeparator.format` also runs on volume/%-change, so a raw
  prefix there would corrupt those columns).

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
inside-labels; ~~price-scale labels (last value, high/low, countdown-to-bar-close)~~
**✓ shipped (#41)**. Still open:

- Remaining scale modes: **indexed-to-100** (`ToggleIndexedTo100`) and an explicit
  **auto-scale** toggle UI (`ToggleAutoScale`).
- **Multiple price scales**: move scales left/right, merge all scales
  (`MergeAllScalesToLeft/Right`), independent per-study scales.
- Remaining price-scale labels: average close, bid/ask, symbol name, prev close,
  no-overlap.
- **Right-margin control** in absolute or percentage terms
  (`chart_property_page_right_margin_editor`, `show_percent_option_for_right_margin`).
- **Time-scale controls**: user-facing visible-range get/set (`setVisibleRange`,
  `setTimeFrame`), ~~zoom-out / fit~~ **✓ shipped (NavControlBar #45)**, fixed
  left edge (`fix_left_edge`), lock-on-resize, price-to-bar-ratio lock
  (`setPriceToBarRatioLocked`), and time-scale marks / countdown.

## Interactions

Shipped: crosshair (with the date/time axis readout) and magnet-to-OHLC snapping;
scroll/zoom come from the base; ~~keyboard shortcuts (escape/undo/redo/delete
with `onShortcut`)~~ **✓ shipped (#14)**; ~~go-to-date~~ **✓ shipped
(GoToDateDialog #45)**. Still open:

- Remaining **keyboard shortcuts**: insert-indicator (`/`), symbol-search-on-keypress,
  interval dialog on key press, save shortcut, and accessible-keyboard / ARIA
  description modes.
- **select-a-bar** (`requestSelectBar`).
- **Context menus** on pane, scales, and legend — each independently disable-able —
  plus an `onContextMenu` customization hook.

## Persistence

Shipped: undo/redo history and direct state serialize/restore (`exportState` /
`importState`, covering drawings + indicators + price scale), named indicator
templates, and ~~a save/load dialog~~ **✓ shipped (SaveLoadDialog #45)**. Still open:

- **Save / load full chart layouts to a server**: `saveChartToServer` /
  `loadChartFromServer` / `getSavedCharts` / `removeChartFromServer`.
- **localStorage-backed settings** (`use_localstorage_for_settings`,
  `save_chart_properties_to_local_storage`).
- **Named chart templates** (`chart_template_storage`) and per-drawing-tool templates.
- Optional **separate storage for drawings** and server-side line-tool reloading
  (`saveload_separate_drawings_storage`, `reloadLineToolsFromServer`).

## UI chrome

Shipped: the header toolbar (with hideable sections), the drawing toolbar, the
built-in legend/OHLC readout, the settings dialog, and the symbol/interval
watermark. ~~Data window, object tree, watchlist, market-status badge,
navigation/control bar, symbol-info / go-to-date / save-load / confirm dialogs~~
**✓ shipped (#45 / #64)**. Still open:

- Remaining **legend / data window** features: per-source rows, value-based
  coloring, in-place edit of symbol/resolution
  (`legend_inplace_edit`, `legend_bar_change_colors_based_on_value`).
- **Bottom timeframes toolbar** — ~~lookback ranges~~ **✓ shipped (TimeframeBar
  #45)**; resolution-picker variant still open.
- **Right widget panel** (`widgetbar`) beyond the watchlist, and a **news** widget
  hook (`news`).
- **Logo / branding** placement controls beyond the shipped `BrandMark`.

## Theming & customization

Shipped: light/dark, the Sonr palette, deep style overrides via the `styles`
prop, runtime monochrome defaults, custom header buttons (`ToolbarButton`),
the settings color pickers, ~~named custom themes (`customThemes`) and CSS
custom-property get/set (`getCSSCustomProperty`/`setCSSCustomProperty`)~~
**✓ shipped (#46)**. Still open:

- **Localization** (`getLanguage`) and full number/date/time formatter hooks
  (`dateFormat`, `timeHoursFormat`, `mainSeriesPriceFormatter`, `priceFormatter`)
  beyond the crosshair date format + currency/unit price formatting already
  customized.
- `addCustomCSSFile`.

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
work remaining (fully-shipped categories, and those closed by #34/#38/#39, have
been dropped).

Legend: **Free** = works out of the box in KLineChart · **Partial** = primitives
exist, sonrchart would assemble/extend them · **Build** = not in the base.

| Category | KLineChart base | remaining work |
|---|---|---|
| Line-with-markers / HLC-Area series | **Free / Partial** | the two remaining price-line variants |
| Renko / Kagi / PnF / Line Break / Range | **Build** | precompute + custom render |
| ~~Exotic drawing families (Gann / Elliott / harmonic / pitchfork)~~ | **Build** | **user did not decide to implement** (#34) — no base primitive |
| Remaining shapes (arc / circle / Bézier / polyline) + volume profile | **Build** | tail of the shape catalog |
| Indicator status-line / legend display options | **Free** | display flags (library + inputs editor shipped) |
| ~~Custom resolutions / timezone menu~~ | **Partial** | **✓ #38** |
| ~~Symbol metadata / logos / currency-unit~~ | **Build** | **✓ #39** (per-tick axis currency deferred) |
| Multi-chart layouts (grids) + cross-chart sync | **Build** | host owns the grid today |
| Multiple price scales / indexed-100 / right-margin | **Partial** | beyond log/percent/invert |
| Remaining time-scale controls (fix-left / ratio-lock / visible-range API) | **Partial** | surface the API |
| Remaining keyboard shortcuts / context menus | **Build** | shortcut + menu layer |
| Server / localStorage layout save-load + templates | **Build** | beyond in-memory export/import |
| Advanced legend / data window (in-place edit) / news / widgetbar | **Partial** | richer chrome (or host's) |
| Localization / formatter hooks | **Free / Build** | beyond the shipped formatters |
| Trade-from-chart broker actions (DOM, account manager) | **Build** | heaviest trading tier |
| Data export / drag-to-export | **Partial** | expose a helper |

## Bottom line

A full charting product is an *application*, not just a renderer. `sonrchart` has
now shipped the core surface — candles + styles, a curated drawing set (now with
an opt-in extended family from #34) with magnet/undo/redo, the full indicator
library with an inputs editor, custom studies and templates, symbol search with
spread operators, compare, sessions, **configurable resolutions + timezone
(#38)**, **symbol metadata with currency/unit + logos (#39)**, price-scale modes
+ labels, the crosshair readout, export/import persistence, the
toolbar/settings/legend chrome plus the data window / object tree / watchlist /
dialogs, theming with named custom themes, on-chart trade lines, snapshot, and
the watermark.

What's left above is either genuinely optional (Renko/Kagi/PnF, the deferred
exotic drawing families, multi-chart grids, broker actions) or incremental depth
on surfaces that already exist (more series types, richer scales and chrome,
server-side persistence). This inventory is the map of what's still *possible*;
the product decides how much of it is worth building. Own the glass, not the
ocean.
