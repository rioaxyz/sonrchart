// Keyboard-shortcut key mapping for the chart (#14). Kept pure and DOM-light so
// it is trivial to unit-test: `resolveShortcut` maps a keydown to an action, and
// the caller (SonrChart) decides whether to run the built-in + notify the host.

/** Built-in chart shortcut actions surfaced to the host via `onShortcut`. */
export type ShortcutAction = "escape" | "undo" | "redo" | "delete";

/** True when the event originates from a field where the user is typing — an
 *  input/textarea/select or a contenteditable element. Shortcuts must never
 *  hijack these (symbol search, settings inputs, etc.). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return el.isContentEditable === true;
}

/** Map a keydown to a built-in chart shortcut action, or null if none.
 *  Pure — reads only the event's key + modifiers, never the DOM or app state.
 *  The caller further gates "delete" on whether a drawing tool is armed. */
export function resolveShortcut(e: KeyboardEvent): ShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey; // Cmd (mac) or Ctrl (win/linux)
  const key = e.key;
  // Cancel an armed drawing.
  if (key === "Escape" || key === "Esc") return "escape";
  // Undo / redo. Cmd/Ctrl+Z; Shift flips it to redo. Ctrl/Cmd+Y is also redo.
  if (mod && (key === "z" || key === "Z")) return e.shiftKey ? "redo" : "undo";
  if (mod && (key === "y" || key === "Y")) return "redo";
  // Clear all drawings — only without a modifier (Cmd/Ctrl+Delete is a
  // different command and must not clobber the drawings).
  if (!mod && (key === "Delete" || key === "Backspace")) return "delete";
  return null;
}
