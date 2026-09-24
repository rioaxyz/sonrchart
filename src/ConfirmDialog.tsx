import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ensureDefaultStyles } from "./defaultStyles";

// A small, self-contained confirmation dialog used to guard destructive toolbar
// actions (e.g. clearing all drawings). Portal-rendered so it escapes any
// overflow clip; Escape or an overlay click cancels, and the confirm button is
// focused on open so Enter confirms. Styling is class-based (`.sonr-confirm-*`)
// with neutral defaults injected by ensureDefaultStyles — a host theme overrides
// them (see the scanner's blue/teal treatment).

export function ConfirmDialog({
  open,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(ensureDefaultStyles, []);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="sonr-confirm-overlay" onMouseDown={onCancel}>
      <div
        className="sonr-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sonr-confirm-icon" aria-hidden>
          ?
        </div>
        <div className="sonr-confirm-body">
          <p className="sonr-confirm-msg">{message}</p>
          <div className="sonr-confirm-actions">
            <button type="button" className="sonr-confirm-btn sonr-confirm-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button ref={okRef} type="button" className="sonr-confirm-btn sonr-confirm-ok" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
