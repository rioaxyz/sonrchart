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
