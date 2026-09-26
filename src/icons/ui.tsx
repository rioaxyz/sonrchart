import { Icon } from "./Icon";

// UI & navigation icons — Lucide-style, 24×24 grid, 2px round stroke. Names are
// kept stable (EyeIcon, ClearIcon, GearIcon, …) so every existing `./icons`
// import resolves here unchanged. Chart/drawing glyphs live in ./chart.

/** Eye — drawings visible (lucide: eye). */
export function EyeIcon() {
  return (
    <Icon>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Eye with a slash — drawings hidden (lucide: eye-off). */
export function EyeOffIcon() {
  return (
    <Icon>
      <path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.7" />
      <path d="M6.6 6.6A13 13 0 0 0 2 12s3 7 10 7a9.8 9.8 0 0 0 2.4-.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}

/** Padlock, closed — a locked object (lucide: lock). */
export function LockIcon() {
  return (
    <Icon>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

/** Padlock, open — an unlocked object (lucide: lock-open). */
export function UnlockIcon() {
  return (
    <Icon>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.9-1" />
    </Icon>
  );
}

/** Two overlapping squares — duplicate / copy (lucide: copy). */
export function CopyIcon() {
  return (
    <Icon>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
    </Icon>
  );
}

/** Card with an up arrow — bring to front. */
export function FrontIcon() {
  return (
    <Icon>
      <rect x="5" y="9" width="14" height="12" rx="2" />
      <path d="M12 2v5" />
      <path d="M8.5 5.5 12 2l3.5 3.5" />
    </Icon>
  );
}

/** Card with a down arrow — send to back. */
export function BackIcon() {
  return (
    <Icon>
      <rect x="5" y="3" width="14" height="12" rx="2" />
      <path d="M12 22v-5" />
      <path d="M8.5 18.5 12 22l3.5-3.5" />
    </Icon>
  );
}

/** Trash can — clear all drawings (lucide: trash-2). */
export function ClearIcon() {
  return (
    <Icon>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  );
}

/** Curved arrow left — undo (lucide: undo-2). */
export function UndoIcon() {
  return (
    <Icon>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </Icon>
  );
}

/** Curved arrow right — redo (lucide: redo-2). */
export function RedoIcon() {
  return (
    <Icon>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h1" />
    </Icon>
  );
}

/** Cog — chart settings (lucide: settings). */
export function GearIcon() {
  return (
    <Icon>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Camera — save a snapshot (lucide: camera). */
export function CameraIcon() {
  return (
    <Icon>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </Icon>
  );
}

/** Calendar — go to date (lucide: calendar). */
export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
    </Icon>
  );
}

/** Stacked layers — the indicators/objects side-panel toggle (lucide: layers). */
export function ObjectsIcon() {
  return (
    <Icon>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </Icon>
  );
}

/** Pencil — the drawing-tools dropdown trigger (lucide: pencil). */
export function PencilIcon() {
  return (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  );
}

/** Magnifier with a plus — zoom in (lucide: zoom-in). */
export function ZoomInIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </Icon>
  );
}

/** Magnifier with a minus — zoom out (lucide: zoom-out). */
export function ZoomOutIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M8 11h6" />
    </Icon>
  );
}

/** Corner brackets — fit / reset the visible range to all data (lucide: maximize). */
export function FitIcon() {
  return (
    <Icon>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </Icon>
  );
}

/** Chevron to a bar — jump to the latest (realtime) bar (lucide: chevron-last). */
export function RealtimeIcon() {
  return (
    <Icon>
      <path d="M7 18l6-6-6-6" />
      <path d="M17 6v12" />
    </Icon>
  );
}
