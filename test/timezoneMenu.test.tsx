import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { TimezoneMenu } from "../src/TimezoneMenu";
import { timezoneLabel, getTimezoneApi, DEFAULT_TIMEZONES } from "../src/timezone";
import type { SonrChartHandle } from "../src/SonrChart";

function tzHandle(initial = "America/New_York") {
  let tz = initial;
  const subs = new Set<(t: string) => void>();
  const h = {
    getTimezone: () => tz,
    setTimezone: vi.fn((next: string) => {
      tz = next;
      subs.forEach((cb) => cb(tz));
    }),
    subscribeTimezone: (cb: (t: string) => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  } as unknown as SonrChartHandle;
  const ref = createRef<SonrChartHandle>();
  (ref as { current: SonrChartHandle }).current = h;
  return { h, ref };
}

describe("timezone helpers (#38)", () => {
  it("labels a known zone from the curated set and derives one for an unknown zone", () => {
    expect(timezoneLabel("America/New_York")).toBe("New York");
    expect(timezoneLabel("Etc/UTC")).toBe("UTC");
    expect(timezoneLabel("Pacific/Auckland")).toBe("Auckland"); // not in the set → city derived
    expect(timezoneLabel("Foo")).toBe("Foo");
  });

  it("getTimezoneApi merges custom aliases ahead of defaults and resolves labels", () => {
    const api = getTimezoneApi([{ value: "America/New_York", label: "HQ" }]);
    expect(api.timezones[0]).toEqual({ value: "America/New_York", label: "HQ" });
    // No duplicate for the overridden default.
    expect(api.timezones.filter((t) => t.value === "America/New_York")).toHaveLength(1);
    expect(api.timezones).toHaveLength(DEFAULT_TIMEZONES.length);
    expect(api.label("America/New_York")).toBe("HQ");
  });
});

describe("TimezoneMenu (#38)", () => {
  it("shows the current zone and opens the options", async () => {
    const { ref } = tzHandle("Europe/London");
    render(<TimezoneMenu chartRef={ref} />);
    const trigger = screen.getByRole("button", { name: /Timezone/ });
    expect(trigger).toHaveTextContent("London");
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "London" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Tokyo" })).toHaveAttribute("aria-checked", "false");
  });

  it("applies a picked zone through the handle and reflects the change", async () => {
    const { h, ref } = tzHandle("America/New_York");
    render(<TimezoneMenu chartRef={ref} />);
    await userEvent.click(screen.getByRole("button", { name: /Timezone/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Tokyo" }));
    expect(h.setTimezone).toHaveBeenCalledWith("Asia/Tokyo");
    // Subscription flips the trigger label; the menu closed on pick.
    expect(screen.getByRole("button", { name: /Timezone/ })).toHaveTextContent("Tokyo");
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });
});
