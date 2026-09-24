import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketStatus, marketStatus, minutesToNextBoundary, formatDuration, sessionProgress } from "../src/MarketStatus";

// Build UTC instants for known ET wall-clock moments. Winter is EST (UTC-5),
// summer is EDT (UTC-4) — proving the phase tracks the ET calendar, not a fixed
// offset. Reference dates: 2026-01-05 is a Monday (EST); 2026-07-06 is a Monday
// (EDT); 2026-01-03/04 are Sat/Sun.
const utc = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo, d, h, mi);

describe("marketStatus() pure helper", () => {
  it("classifies the regular EST session (09:30–16:00 ET)", () => {
    // 14:30 UTC = 09:30 ET on 2026-01-05 (EST) — the open boundary is inclusive.
    expect(marketStatus(utc(2026, 0, 5, 14, 30))).toBe("open");
    // Midday.
    expect(marketStatus(utc(2026, 0, 5, 18, 0))).toBe("open");
    // 15:59 ET (20:59 UTC) is still open.
    expect(marketStatus(utc(2026, 0, 5, 20, 59))).toBe("open");
  });

  it("marks pre-market 04:00–09:30 ET", () => {
    // 08:00 ET = 13:00 UTC.
    expect(marketStatus(utc(2026, 0, 5, 13, 0))).toBe("pre");
    // 04:00 ET (09:00 UTC) is the inclusive lower boundary.
    expect(marketStatus(utc(2026, 0, 5, 9, 0))).toBe("pre");
    // 03:59 ET (08:59 UTC) is before pre-market → closed.
    expect(marketStatus(utc(2026, 0, 5, 8, 59))).toBe("closed");
    // 09:29 ET (14:29 UTC) is the last pre-market minute.
    expect(marketStatus(utc(2026, 0, 5, 14, 29))).toBe("pre");
  });

  it("marks after-hours 16:00–20:00 ET", () => {
    // 16:00 ET (21:00 UTC) — regular close flips to after-hours.
    expect(marketStatus(utc(2026, 0, 5, 21, 0))).toBe("after");
    // 19:59 ET is 00:59 UTC on the NEXT calendar day.
    expect(marketStatus(utc(2026, 0, 6, 0, 59))).toBe("after");
    // 20:00 ET (01:00 UTC next day) — after-hours ends → closed.
    expect(marketStatus(utc(2026, 0, 6, 1, 0))).toBe("closed");
  });

  it("is closed overnight, including the ET-midnight boundary", () => {
    // 00:00 ET = 05:00 UTC — exercises the hour "24"→0 normalization.
    expect(marketStatus(utc(2026, 0, 5, 5, 0))).toBe("closed");
    // 02:30 ET.
    expect(marketStatus(utc(2026, 0, 5, 7, 30))).toBe("closed");
  });

  it("treats weekends as closed regardless of time-of-day", () => {
    // Saturday 2026-01-03 at what would be regular hours.
    expect(marketStatus(utc(2026, 0, 3, 15, 0))).toBe("closed");
    // Sunday 2026-01-04.
    expect(marketStatus(utc(2026, 0, 4, 15, 0))).toBe("closed");
  });

  it("applies EDT (UTC-4) in summer without hand-rolled offsets", () => {
    // 09:30 ET during DST = 13:30 UTC on Monday 2026-07-06 → open.
    expect(marketStatus(utc(2026, 6, 6, 13, 30))).toBe("open");
    // The winter open instant (14:30 UTC) would be 10:30 ET in summer — still open,
    // but 13:00 UTC is 09:00 ET in summer → pre-market (would be 08:00/pre in EST too).
    expect(marketStatus(utc(2026, 6, 6, 13, 0))).toBe("pre");
    // 13:29 UTC = 09:29 ET (EDT) → last pre-market minute.
    expect(marketStatus(utc(2026, 6, 6, 13, 29))).toBe("pre");
  });
});

describe("market countdown helpers", () => {
  it("minutesToNextBoundary counts to the phase's next edge", () => {
    // 13:00 ET open → 16:00 close is 180 min away.
    expect(minutesToNextBoundary(utc(2026, 0, 5, 18, 0))).toBe(180);
    // 08:00 ET pre → 09:30 open is 90 min away.
    expect(minutesToNextBoundary(utc(2026, 0, 5, 13, 0))).toBe(90);
    // 17:00 ET after → 20:00 close is 180 min away.
    expect(minutesToNextBoundary(utc(2026, 0, 5, 22, 0))).toBe(180);
  });

  it("closed on Friday night counts to Monday's open (skips the weekend)", () => {
    // 2026-01-09 is a Friday; 21:00 ET (02:00 UTC Sat) is closed. Next open is
    // Monday 2026-01-12 09:30 ET → Sat + Sun full days + to Monday 09:30.
    const mins = minutesToNextBoundary(utc(2026, 0, 10, 2, 0));
    // 3h to Sat midnight + 48h (Sat+Sun) + 9.5h = 60.5h = 3630 min.
    expect(mins).toBe(3630);
  });

  it("formatDuration reads naturally", () => {
    expect(formatDuration(356)).toBe("5 hours and 56 minutes");
    expect(formatDuration(56)).toBe("56 minutes");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(61)).toBe("1 hour and 1 minute");
    expect(formatDuration(0)).toBe("0 minutes");
    expect(formatDuration(1500)).toBe("1 day and 1 hour");
  });

  it("sessionProgress spans 04:00–20:00 ET", () => {
    expect(sessionProgress(4 * 60)).toBe(0);
    expect(sessionProgress(20 * 60)).toBe(1);
    expect(sessionProgress(12 * 60)).toBeCloseTo(0.5, 5);
    expect(sessionProgress(0)).toBe(0); // before 04:00 clamps
  });
});

describe("<MarketStatus> component", () => {
  afterEach(() => vi.useRealTimers());

  it("renders the phase label + status class for a fixed instant", () => {
    render(<MarketStatus now={utc(2026, 0, 5, 18, 0)} />);
    const badge = screen.getByRole("button", { name: "Open" });
    expect(badge).toHaveTextContent("Open");
    expect(badge.className).toContain("sonr-mkt-open");
  });

  it("honors label overrides and a custom className", () => {
    render(<MarketStatus now={utc(2026, 0, 5, 13, 0)} labels={{ marketPre: "Pré-marché" }} className="host-badge" />);
    const badge = screen.getByRole("button", { name: "Pré-marché" });
    expect(badge.className).toContain("sonr-mkt-pre");
    expect(badge.className).toContain("host-badge");
  });

  it("opens a popover with the countdown message and timezone", async () => {
    render(<MarketStatus now={utc(2026, 0, 5, 18, 0)} />); // 13:00 ET → open
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const pop = screen.getByRole("dialog");
    expect(pop).toHaveTextContent("market is open");
    expect(pop).toHaveTextContent("It'll close in 3 hours"); // 13:00 → 16:00
    expect(pop).toHaveTextContent("Exchange timezone: New York (UTC-5)"); // January = EST
  });

  it("ticks on a 30s interval when uncontrolled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(utc(2026, 0, 5, 8, 59)); // 03:59 ET → closed
    render(<MarketStatus />);
    expect(screen.getByRole("button")).toHaveTextContent("Closed");
    act(() => {
      vi.setSystemTime(utc(2026, 0, 5, 9, 1)); // 04:01 ET → pre-market
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Pre-market");
  });
});
