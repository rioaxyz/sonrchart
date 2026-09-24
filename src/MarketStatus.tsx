import { useEffect, useMemo, useState } from "react";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";

// Market-status badge (issue #45): a small pill that reports the current US
// equities session phase — pre-market, regular open, after-hours, or closed.
//
// The session boundaries are wall-clock in America/New_York, so the phase is
// correct year-round without hand-rolling UTC offsets: the ET clock is derived
// from the epoch ms via Intl.DateTimeFormat, which applies EST/EDT for us.
// Weekends read as "closed"; holidays are NOT modeled (a holiday weekday still
// shows its time-of-day phase — the host can suppress the badge if it tracks the
// exchange calendar).

/** The four US-equities session phases. */
export type MarketPhase = "pre" | "open" | "after" | "closed";

// Minutes-since-ET-midnight boundaries for the regular week.
const PRE_OPEN = 4 * 60; //  04:00 ET — pre-market opens
const REGULAR_OPEN = 9 * 60 + 30; //  09:30 ET — regular session opens
const REGULAR_CLOSE = 16 * 60; //  16:00 ET — regular session closes
const AFTER_CLOSE = 20 * 60; //  20:00 ET — after-hours ends

// A reusable ET formatter; hourCycle "h23" yields 00–23 (never a "24" at
// midnight), and the weekday narrows the weekend without any date math.
const ET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Classify an instant (epoch ms) into a US-equities session phase, evaluated in
 * America/New_York wall-clock time. Weekends are "closed"; holidays are not
 * modeled. Pure — depends only on its argument and the fixed ET calendar.
 */
export function marketStatus(nowMs: number): MarketPhase {
  let weekday = "";
  let hour = 0;
  let minute = 0;
  for (const part of ET_FORMAT.formatToParts(new Date(nowMs))) {
    if (part.type === "weekday") weekday = part.value;
    else if (part.type === "hour") hour = Number(part.value) % 24;
    else if (part.type === "minute") minute = Number(part.value);
  }
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const minutesOfDay = hour * 60 + minute;
  if (minutesOfDay >= PRE_OPEN && minutesOfDay < REGULAR_OPEN) return "pre";
  if (minutesOfDay >= REGULAR_OPEN && minutesOfDay < REGULAR_CLOSE) return "open";
  if (minutesOfDay >= REGULAR_CLOSE && minutesOfDay < AFTER_CLOSE) return "after";
  return "closed";
}

/** Resolve the display text for a phase, honoring label overrides with English
 *  fallbacks (the keys are listed in the integration spec for the lead to add to
 *  Labels; the `??` keeps the badge correct before and after that wiring). */
function phaseText(phase: MarketPhase, L: Labels): string {
  switch (phase) {
    case "pre":
      return L.marketPre ?? "Pre-market";
    case "open":
      return L.marketOpen ?? "Open";
    case "after":
      return L.marketAfter ?? "After-hours";
    case "closed":
      return L.marketClosed ?? "Closed";
  }
}

export interface MarketStatusProps {
  /** Fixed instant (epoch ms) to classify. Omit to track the live clock — the
   *  badge then re-evaluates every 30s using Date.now(). */
  now?: number;
  labels?: Partial<Labels>;
  className?: string;
}

/**
 * A small status pill (colored dot + label) reporting the current US-equities
 * session phase. Uncontrolled by default: pass nothing and it ticks itself on a
 * 30-second interval; pass `now` to pin it to a fixed instant (no interval).
 */
export function MarketStatus({ now, labels, className }: MarketStatusProps) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const [tick, setTick] = useState<number>(() => Date.now());

  // Live mode only: re-evaluate every 30s. A fixed `now` needs no timer.
  useEffect(() => {
    if (now !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [now]);

  const phase = marketStatus(now ?? tick);
  const text = phaseText(phase, L);

  return (
    <span
      className={`sonr-mkt sonr-mkt-${phase}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label={text}
      title={text}
    >
      <span className="sonr-mkt-dot" aria-hidden />
      <span className="sonr-mkt-label">{text}</span>
    </span>
  );
}
