// Timezone support (issue #38). KLineChart renders the x-axis and crosshair time
// in a single IANA timezone (`chart.setTimezone`). sonrchart baked in ET; this
// module makes it configurable: a curated list of common zones for a menu, plus
// `getTimezoneApi()` so a host can discover/extend the set.
//
// Pure and framework-free — the list is data, the menu component consumes it.

/** One selectable timezone: an IANA name plus a short display label. */
export interface TimezoneOption {
  /** IANA timezone name, e.g. "America/New_York". Passed to chart.setTimezone. */
  value: string;
  /** Short display label, e.g. "New York". */
  label: string;
}

/** The chart's default timezone — US equities exchange time (ET). */
export const DEFAULT_TIMEZONE = "America/New_York";

/** Curated common trading timezones, roughly west→east. Hosts can pass their own
 *  set to <TimezoneMenu> or extend this via getTimezoneApi(). */
export const DEFAULT_TIMEZONES: TimezoneOption[] = [
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "America/Chicago", label: "Chicago" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Etc/UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Frankfurt" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "Mumbai" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
];

/** Human label for an IANA timezone, falling back to the raw name (with the
 *  "Area/City" prefix stripped and underscores spaced) when it isn't in the
 *  curated set. Pure. */
export function timezoneLabel(tz: string, options: TimezoneOption[] = DEFAULT_TIMEZONES): string {
  const hit = options.find((o) => o.value === tz);
  if (hit) return hit.label;
  const city = tz.includes("/") ? tz.slice(tz.lastIndexOf("/") + 1) : tz;
  return city.replace(/_/g, " ");
}

/**
 * Timezone API (issue #38 `getTimezoneApi`). Returns the curated timezone list
 * and a resolver, letting a host discover the built-in options and label an
 * arbitrary IANA zone. Accepts custom aliases (merged ahead of the defaults) so
 * a host can surface its own named zones.
 */
export function getTimezoneApi(customAliases: TimezoneOption[] = []): {
  timezones: TimezoneOption[];
  label: (tz: string) => string;
} {
  // Custom aliases win over a default with the same value.
  const seen = new Set(customAliases.map((o) => o.value));
  const timezones = [...customAliases, ...DEFAULT_TIMEZONES.filter((o) => !seen.has(o.value))];
  return { timezones, label: (tz: string) => timezoneLabel(tz, timezones) };
}
