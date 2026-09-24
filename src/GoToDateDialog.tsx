import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ensureDefaultStyles } from "./defaultStyles";
import type { SonrChartHandle } from "./SonrChart";
import { mergeLabels, type Labels } from "./labels";

// Go-to-date dialog (issue #45): a small portal dialog with a
// <input type="datetime-local"> + a Go button that scrolls the chart to the
// chosen moment. Modeled on ConfirmDialog — portal-rendered so it escapes any
// overflow clip; Escape or an overlay click cancels, and the input is focused
// on open so the user can type/pick immediately. Styling is class-based
// (`.sonr-gotodate-*`) with neutral defaults injected by ensureDefaultStyles.

// Parse a native datetime-local value ("YYYY-MM-DDTHH:mm[:ss]") into epoch ms.
// The input yields local wall-clock time with no zone, so Date's local parsing
// is the intended interpretation. Returns null for an empty/unparseable value.
export function parseLocalDateTime(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function GoToDateDialog({
  chartRef,
  open,
  onClose,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  open: boolean;
  onClose: () => void;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = mergeLabels(labels);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Reset the field each time the dialog is reopened.
  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const submit = () => {
    const ms = parseLocalDateTime(value);
    if (ms === null) return; // nothing chosen — keep the dialog open
    chartRef.current?.scrollToTimestamp?.(ms);
    onClose();
  };

  const title = L.goToDate ?? "Go to date";
  const goLabel = L.goToDateGo ?? "Go";

  return createPortal(
    <div className="sonr-gotodate-overlay" onMouseDown={onClose}>
      <div
        className="sonr-gotodate"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sonr-gotodate-title">{title}</div>
        <form
          className="sonr-gotodate-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={inputRef}
            type="datetime-local"
            className="sonr-gotodate-input"
            aria-label={title}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="sonr-gotodate-go" disabled={!value}>
            {goLabel}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
