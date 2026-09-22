// Minimal monochrome default styling for the toolbar chrome (issues #3/#4/#17/#18).
//
// The library ships its controls as bare class names so hosts can theme them —
// but with no styling at all the buttons are nearly invisible, and a consumer
// can't tell the functionality is even there. So we inject a neutral black-and-
// white default at runtime that makes every control legible and obviously
// clickable out of the box.
//
// Overridability is the whole point: every selector is wrapped in :where(), which
// contributes ZERO specificity. Any consumer rule on the same class — even a
// plain `.sonr-iv-btn { ... }` — outranks these defaults with no !important
// needed. The <style> is also prepended to <head>, so on an exact-specificity
// tie the consumer's later-loaded rule still wins by source order.

const STYLE_ID = "sonr-chart-default-styles";

const CSS = `
:where(.sonr-toolbar-wrap){position:relative;flex:0 0 auto;}
:where(.sonr-chart-toolbar){display:flex;align-items:center;gap:8px;padding:4px 8px;background:#fff;color:#000;border-bottom:1px solid #000;overflow-x:auto;overflow-y:hidden;white-space:nowrap;font-family:inherit;scrollbar-width:none;}
:where(.sonr-chart-toolbar)::-webkit-scrollbar{height:0;width:0;display:none;}
:where(.sonr-scroll-hint){position:absolute;top:0;bottom:1px;width:26px;display:flex;align-items:center;border:none;cursor:pointer;color:#000;font-size:16px;line-height:1;padding:0;opacity:0;pointer-events:none;transition:opacity .12s;z-index:5;}
:where(.sonr-scroll-hint.left){left:0;justify-content:flex-start;padding-left:4px;background:linear-gradient(to right,#fff 55%,rgba(255,255,255,0));}
:where(.sonr-scroll-hint.right){right:0;justify-content:flex-end;padding-right:4px;background:linear-gradient(to left,#fff 55%,rgba(255,255,255,0));}
:where(.sonr-toolbar-wrap:hover .sonr-scroll-hint){opacity:1;pointer-events:auto;}
:where(.sonr-interval-group,.sonr-indicator-menu,.sonr-candle-menu,.sonr-scale-menu,.sonr-session-group,.sonr-drawing-toolbar){display:inline-flex;align-items:center;gap:4px;}
:where(.sonr-indicator-menu,.sonr-candle-menu,.sonr-scale-menu,.sonr-session-group,.sonr-drawing-toolbar){padding-left:8px;border-left:1px solid #000;}
:where(.sonr-iv-btn,.sonr-ind-btn,.sonr-menu-trigger,.sonr-session-btn,.sonr-draw-btn,.sonr-snapshot-btn,.sonr-settings-btn,.sonr-tb-btn){appearance:none;-webkit-appearance:none;background:#fff;color:#000;border:1px solid #000;border-radius:3px;cursor:pointer;font:inherit;font-size:11px;line-height:18px;padding:0 6px;white-space:nowrap;}
:where(.sonr-iv-btn:hover,.sonr-ind-btn:hover,.sonr-menu-trigger:hover,.sonr-session-btn:hover,.sonr-draw-btn:hover,.sonr-snapshot-btn:hover,.sonr-settings-btn:hover,.sonr-tb-btn:hover){background:#e6e6e6;}
:where(.sonr-iv-btn.on,.sonr-ind-btn.on,.sonr-session-btn.on,.sonr-draw-btn.on,.sonr-settings-btn.on,.sonr-tb-btn.on){background:#000;color:#fff;}
:where(.sonr-draw-btn:disabled){opacity:0.35;cursor:default;}
:where(.sonr-icon-btn,.sonr-icon-trigger){display:inline-flex;align-items:center;justify-content:center;gap:3px;padding:0 5px;}
:where(.sonr-snapshot-btn){margin-left:auto;}
:where(.sonr-set-overlay){position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2147483001;}
:where(.sonr-set-panel){display:flex;flex-direction:column;width:460px;max-width:92vw;max-height:80vh;background:#fff;color:#000;border:1px solid #000;border-radius:8px;overflow:hidden;font-family:inherit;}
:where(.sonr-set-head){display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #000;}
:where(.sonr-set-title){font-weight:700;font-size:13px;}
:where(.sonr-set-close){appearance:none;background:none;border:none;cursor:pointer;color:#000;font-size:14px;line-height:1;padding:2px 6px;}
:where(.sonr-set-body){display:flex;min-height:220px;}
:where(.sonr-set-nav){display:flex;flex-direction:column;gap:2px;padding:8px;border-right:1px solid #000;min-width:130px;}
:where(.sonr-set-navbtn){appearance:none;background:none;border:none;border-radius:4px;cursor:pointer;color:#000;font:inherit;font-size:12px;text-align:left;padding:5px 8px;}
:where(.sonr-set-navbtn:hover){background:#e6e6e6;}
:where(.sonr-set-navbtn.on){background:#000;color:#fff;}
:where(.sonr-set-content){flex:1;padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;}
:where(.sonr-set-row){display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;}
:where(.sonr-set-label){color:#000;}
:where(.sonr-set-empty){color:#555;font-size:12px;margin:0;}
:where(.sonr-set-note){color:#555;font-size:11px;line-height:1.4;margin:0 0 2px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;}
:where(.sonr-menu-trigger){display:inline-flex;align-items:center;gap:4px;}
:where(.sonr-menu-caret){font-size:9px;opacity:0.7;}
:where(.sonr-menu-dropdown){display:flex;flex-direction:column;min-width:180px;max-height:60vh;overflow-y:auto;background:#fff;color:#000;border:1px solid #000;border-radius:4px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:4px;z-index:2147483000;}
:where(.sonr-menu-option){display:flex;align-items:center;gap:8px;background:none;border:none;border-radius:3px;color:#000;cursor:pointer;font:inherit;font-size:12px;line-height:22px;padding:2px 8px;text-align:left;white-space:nowrap;}
:where(.sonr-menu-option:hover){background:#e6e6e6;}
:where(.sonr-menu-option.on){font-weight:700;}
:where(.sonr-menu-check){display:inline-block;width:12px;flex:0 0 12px;}
:where(.sonr-menu-name){font-weight:700;min-width:38px;}
:where(.sonr-menu-label){color:#555;font-size:11px;}
:where(.sonr-menu-label-wide){color:#000;font-size:12px;}
`;

/** Inject the default toolbar stylesheet once. No-op on the server, when already
 *  injected, or if the host opted out via `data-sonr-no-default-styles` on
 *  <html> (for consumers that ship a full theme and want nothing shipped). */
export function ensureDefaultStyles(): void {
  if (typeof document === "undefined") return;
  if (document.documentElement.hasAttribute("data-sonr-no-default-styles")) return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.prepend(el);
}
