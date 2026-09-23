// CSS custom-property (CSS variable) read/write helpers (issue #46).
//
// Small SSR-safe utilities so a host can drive chart-related CSS variables
// without hand-rolling getComputedStyle/setProperty and the `--` prefixing.
// Both default their target to `document.documentElement` (`:root`).

// Ensure a leading `--` so callers can pass either "brand" or "--brand".
function toVar(name: string): string {
  return name.startsWith("--") ? name : `--${name}`;
}

/**
 * Read a CSS custom property's computed value. Returns "" when the variable is
 * unset or when there is no `document` (SSR). `name` may include or omit `--`.
 */
export function getCSSCustomProperty(name: string, el?: Element | null): string {
  if (typeof document === "undefined") return "";
  const target = el ?? document.documentElement;
  if (!target) return "";
  const prop = toVar(name);
  const computed = getComputedStyle(target).getPropertyValue(prop).trim();
  if (computed) return computed;
  // Fall back to an inline declaration (jsdom's getComputedStyle doesn't always
  // surface inline custom properties; real browsers fold them into `computed`).
  const inline = (target as HTMLElement).style?.getPropertyValue(prop);
  return inline ? inline.trim() : "";
}

/**
 * Write a CSS custom property (inline `style`). No-op under SSR. `name` may
 * include or omit `--`. Defaults to `:root` (document.documentElement).
 */
export function setCSSCustomProperty(name: string, value: string, el?: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  const target = el ?? document.documentElement;
  if (!target) return;
  target.style.setProperty(toVar(name), value);
}
