# Lore

## The name

**Sonr** is *sonar* with the vowels trimmed — a scanner that listens to the
market the way sonar listens to the deep. Send a ping into the noise, wait for
the returns, read what's moving out there before it surfaces.

**sonrchart** is where those returns are painted. If the scanner is the ear,
this is the eye: the surface where a ticker's shape becomes legible — the
candles, the levels, the plan drawn right on the price.

## Why it exists

Sonr started with a borrowed chart. It worked, but it belonged to someone else:
a licensed widget with terms, a black box we couldn't open, a dependency we
didn't own. For a product that lives and dies on how clearly you can read a
setup, renting the most important surface felt wrong.

So sonrchart was pulled out into its own repository — not to reinvent
candlesticks, but to *own the glass*. Built on
[KLineChart](https://github.com/klinecharts/KLineChart) (MIT), it inherits a
solid rendering core and a library of indicators for free, and adds only what
Sonr actually needs on top: the console's palette, a clean React seam, and the
trade plan — entry, stop, target — drawn where your eye already is.

## The one idea

Everything hard about a charting library is *the data* — where bars come from,
how they stream, how history paginates. sonrchart refuses to know any of that.
It takes a single `DataSource` and asks two questions: *what are the bars?* and
*tell me when a new one arrives.* Whoever mounts the chart answers. The library
stays a pure surface; the host stays in control of its own feed.

That's the whole philosophy: **own the glass, not the ocean.**

## House style

- **Green is up, red is down.** Not configurable out of spite — configurable,
  but this is home.
- **Measured, not marketed.** Sonr's charts sit next to accuracy numbers that
  are graded against real fills and change when they should. The chart should
  never flatter a setup the data doesn't support.
- **Small surface, sharp edges.** A curated set of features done well beats a
  hundred done vaguely. The feature inventory in `docs/` is a menu, not a
  mandate.

---

*Send the ping. Read the return.*
