import { describe, expect, it } from "vitest";
import { etSession } from "../src/indicators";

// Build a UTC epoch-ms for a given US-Eastern wall-clock time on a date, so the
// tests read in ET regardless of the machine's timezone. EDT is UTC-4 (summer),
// EST is UTC-5 (winter).
function etMs(dateISO: string, hh: number, mm: number, offsetHours: number): number {
  // dateISO like "2026-07-15"; offset is +4 (EDT) or +5 (EST) to reach UTC.
  return Date.parse(`${dateISO}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`) + offsetHours * 3600_000;
}

describe("etSession — session boundaries (summer / EDT, UTC-4)", () => {
  const d = "2026-07-15";
  const at = (h: number, m: number) => etSession(etMs(d, h, m, 4));

  it("before 04:00 ET is closed", () => expect(at(3, 59)).toBe("closed"));
  it("04:00 ET starts pre-market", () => expect(at(4, 0)).toBe("pre"));
  it("09:29 ET is still pre-market", () => expect(at(9, 29)).toBe("pre"));
  it("09:30 ET starts regular hours", () => expect(at(9, 30)).toBe("regular"));
  it("15:59 ET is still regular", () => expect(at(15, 59)).toBe("regular"));
  it("16:00 ET starts after-hours", () => expect(at(16, 0)).toBe("post"));
  it("19:59 ET is still after-hours", () => expect(at(19, 59)).toBe("post"));
  it("20:00 ET is closed", () => expect(at(20, 0)).toBe("closed"));
});

describe("etSession — DST correctness (winter / EST, UTC-5)", () => {
  const d = "2026-01-15";
  const at = (h: number, m: number) => etSession(etMs(d, h, m, 5));

  it("09:30 ET is regular in winter too", () => expect(at(9, 30)).toBe("regular"));
  it("04:00 ET is pre-market in winter too", () => expect(at(4, 0)).toBe("pre"));
  it("16:00 ET is after-hours in winter too", () => expect(at(16, 0)).toBe("post"));
});

// The per-UTC-hour offset cache must stay correct across the DST switch itself.
// 2026 transitions: spring-forward Sun Mar 8 (EST→EDT), fall-back Sun Nov 1.
describe("etSession — across DST transitions (offset-cache correctness)", () => {
  it("09:30 ET is regular on both sides of spring-forward", () => {
    // Mar 6 (EST, UTC-5) and Mar 9 (EDT, UTC-4) — same ET wall time, different offset.
    expect(etSession(etMs("2026-03-06", 9, 30, 5))).toBe("regular");
    expect(etSession(etMs("2026-03-09", 9, 30, 4))).toBe("regular");
  });
  it("09:30 ET is regular on both sides of fall-back", () => {
    expect(etSession(etMs("2026-10-30", 9, 30, 4))).toBe("regular"); // EDT
    expect(etSession(etMs("2026-11-02", 9, 30, 5))).toBe("regular"); // EST
  });
  it("agrees with a pure-Intl classifier across a full year (sampled)", () => {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const ref = (ts: number) => {
      const p = fmt.formatToParts(new Date(ts));
      const h = Number(p.find((x) => x.type === "hour")!.value);
      const m = Number(p.find((x) => x.type === "minute")!.value);
      const mm = h * 60 + m;
      return mm >= 240 && mm < 570 ? "pre" : mm >= 570 && mm < 960 ? "regular" : mm >= 960 && mm < 1200 ? "post" : "closed";
    };
    let mism = 0;
    for (let ts = Date.UTC(2026, 0, 1); ts < Date.UTC(2027, 0, 1); ts += 13 * 60_000) {
      if (etSession(ts) !== ref(ts)) mism++;
    }
    expect(mism).toBe(0);
  });
});
