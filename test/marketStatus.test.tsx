import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MarketStatus, marketStatus } from "../src/MarketStatus";

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

describe("<MarketStatus> component", () => {
  afterEach(() => vi.useRealTimers());

  it("renders the phase label + status class for a fixed instant", () => {
    // 18:00 UTC on 2026-01-05 = 13:00 ET → open.
    render(<MarketStatus now={utc(2026, 0, 5, 18, 0)} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Open");
    expect(badge.className).toContain("sonr-mkt-open");
  });

  it("honors label overrides and a custom className", () => {
    render(
      <MarketStatus
        now={utc(2026, 0, 5, 13, 0)}
        labels={{ marketPre: "Pré-marché" }}
        className="host-badge"
      />,
    );
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Pré-marché");
    expect(badge.className).toContain("sonr-mkt-pre");
    expect(badge.className).toContain("host-badge");
  });

  it("ticks on a 30s interval when uncontrolled", () => {
    vi.useFakeTimers();
    // Freeze the live clock at a closed overnight instant, then advance across
    // the 04:00 ET boundary and confirm the badge re-evaluates.
    vi.setSystemTime(utc(2026, 0, 5, 8, 59)); // 03:59 ET → closed
    render(<MarketStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Closed");
    act(() => {
      vi.setSystemTime(utc(2026, 0, 5, 9, 1)); // 04:01 ET → pre-market
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Pre-market");
  });
});
