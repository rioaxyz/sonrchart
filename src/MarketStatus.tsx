import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";
import { mergeLabels, type Labels } from "./labels";

// Market-status badge + detail popover (issue #45): a small pill reporting the
// current US-equities session phase (pre-market / open / after-hours / closed);
// clicking it opens a popover with a plain-language countdown to the next
// transition, a session timeline for the day, and the exchange timezone —
// modeled on TradingView's market-status popover.
//
// All session boundaries are wall-clock in America/New_York, derived from the
// epoch ms via Intl.DateTimeFormat (so EST/EDT is applied for us, no hand-rolled
// offsets). Weekends read as "closed"; holidays are NOT modeled.

/** The four US-equities session phases. */
export type MarketPhase = "pre" | "open" | "after" | "closed";

// Minutes-since-ET-midnight boundaries for the regular week.
const PRE_OPEN = 4 * 60; //  04:00 ET — pre-market opens
const REGULAR_OPEN = 9 * 60 + 30; //  09:30 ET — regular session opens
const REGULAR_CLOSE = 16 * 60; //  16:00 ET — regular session closes
const AFTER_CLOSE = 20 * 60; //  20:00 ET — after-hours ends
const DAY_MIN = 24 * 60;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const ET_OFFSET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" });

/** ET wall-clock parts for an instant. */
export function etClock(nowMs: number): { weekday: string; minutesOfDay: number } {
  let weekday = "";
  let hour = 0;
  let minute = 0;
  for (const part of ET_FORMAT.formatToParts(new Date(nowMs))) {
    if (part.type === "weekday") weekday = part.value;
    else if (part.type === "hour") hour = Number(part.value) % 24;
    else if (part.type === "minute") minute = Number(part.value);
  }
  return { weekday, minutesOfDay: hour * 60 + minute };
}

/**
 * Classify an instant into a US-equities session phase, evaluated in ET.
 * Weekends are "closed"; holidays are not modeled. Pure.
 */
export function marketStatus(nowMs: number): MarketPhase {
  const { weekday, minutesOfDay } = etClock(nowMs);
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  if (minutesOfDay >= PRE_OPEN && minutesOfDay < REGULAR_OPEN) return "pre";
  if (minutesOfDay >= REGULAR_OPEN && minutesOfDay < REGULAR_CLOSE) return "open";
  if (minutesOfDay >= REGULAR_CLOSE && minutesOfDay < AFTER_CLOSE) return "after";
  return "closed";
}

const isWeekdayIdx = (i: number): boolean => i >= 1 && i <= 5;

/** Minutes from now until the regular session next opens (skips weekends). */
function minutesToNextOpen(weekday: string, minutesOfDay: number): number {
  const idx = DAYS.indexOf(weekday);
  if (isWeekdayIdx(idx) && minutesOfDay < REGULAR_OPEN) return REGULAR_OPEN - minutesOfDay;
  let minutes = DAY_MIN - minutesOfDay; // to next ET midnight
  let d = (idx + 1) % 7;
  while (!isWeekdayIdx(d)) {
    minutes += DAY_MIN;
    d = (d + 1) % 7;
  }
  return minutes + REGULAR_OPEN;
}

/** Whole minutes from now until the next boundary that ends the current phase. */
export function minutesToNextBoundary(nowMs: number): number {
  const { weekday, minutesOfDay } = etClock(nowMs);
  switch (marketStatus(nowMs)) {
    case "pre":
      return REGULAR_OPEN - minutesOfDay;
    case "open":
      return REGULAR_CLOSE - minutesOfDay;
    case "after":
      return AFTER_CLOSE - minutesOfDay;
    case "closed":
      return minutesToNextOpen(weekday, minutesOfDay);
  }
}

/** "5 hours and 56 minutes", "56 minutes", "2 days, 3 hours and 1 minute". */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const d = Math.floor(mins / DAY_MIN);
  const h = Math.floor((mins % DAY_MIN) / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d !== 1 ? "s" : ""}`);
  if (h) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
  if (m || parts.length === 0) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** 0..1 position of `now` across the extended trading day (04:00–20:00 ET). */
export function sessionProgress(minutesOfDay: number): number {
  return Math.min(1, Math.max(0, (minutesOfDay - PRE_OPEN) / (AFTER_CLOSE - PRE_OPEN)));
}

function timezoneLabel(nowMs: number): string {
  const part = ET_OFFSET.formatToParts(new Date(nowMs)).find((p) => p.type === "timeZoneName");
  return `New York (${(part?.value ?? "GMT-5").replace("GMT", "UTC")})`;
}

function phaseText(phase: MarketPhase, L: Labels): string {
  switch (phase) {
    case "pre":
      return L.marketPre;
    case "open":
      return L.marketOpen;
    case "after":
      return L.marketAfter;
    case "closed":
      return L.marketClosed;
  }
}

// A plain-language message split into a lead and an emphasized countdown clause.
function phaseMessage(phase: MarketPhase, dur: string): { lead: string; strong: string } {
  switch (phase) {
    case "open":
      return { lead: "All's well — market is open. ", strong: `It'll close in ${dur}.` };
    case "pre":
      return { lead: "Pre-market is open. ", strong: `Regular trading opens in ${dur}.` };
    case "after":
      return { lead: "After-hours is open. ", strong: `Trading closes in ${dur}.` };
    case "closed":
      return { lead: "Market is closed. ", strong: `It opens in ${dur}.` };
  }
}

export interface MarketStatusProps {
  /** Fixed instant (epoch ms) to classify. Omit to track the live clock (the
   *  badge re-evaluates every 30s). */
  now?: number;
  labels?: Partial<Labels>;
  className?: string;
}

/**
 * Market-status pill (colored dot + phase). Click it to open a popover with a
 * countdown to the next session transition, a day timeline, and the exchange
 * timezone. Uncontrolled clock by default; pass `now` to pin a fixed instant.
 */
export function MarketStatus({ now, labels, className }: MarketStatusProps) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const [tick, setTick] = useState<number>(() => Date.now());
  const { open, toggle, pos, triggerRef, panelRef } = useDropdown();

  useEffect(() => {
    if (now !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [now]);

  const at = now ?? tick;
  const phase = marketStatus(at);
  const text = phaseText(phase, L);
  const { weekday, minutesOfDay } = etClock(at);
  const message = phaseMessage(phase, formatDuration(minutesToNextBoundary(at)));
  const progress = sessionProgress(minutesOfDay);
  const pct = `${(progress * 100).toFixed(1)}%`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-mkt sonr-mkt-${phase}${className ? ` ${className}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={text}
        title={text}
        onClick={toggle}
      >
        <span className="sonr-mkt-dot" aria-hidden />
        <span className="sonr-mkt-label">{text}</span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className={`sonr-mkt-pop sonr-mkt-${phase}`}
            role="dialog"
            aria-label={text}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            <div className="sonr-mkt-pop-head">
              <span className="sonr-mkt-dot" aria-hidden />
              {text}
            </div>
            <p className="sonr-mkt-pop-msg">
              {message.lead}
              <strong>{message.strong}</strong>
            </p>
            <div className="sonr-mkt-timeline">
              <span className="sonr-mkt-day">{(weekday || "").toUpperCase()}</span>
              <div className="sonr-mkt-track">
                <div className="sonr-mkt-fill" style={{ width: pct }} />
                <div className="sonr-mkt-handle" style={{ left: pct }} />
              </div>
              <div className="sonr-mkt-ticks">
                <span>04:00</span>
                <span>20:00</span>
              </div>
            </div>
            <div className="sonr-mkt-tz">
              {L.marketTimezone}: {timezoneLabel(at)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
