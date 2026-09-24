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
:where(.sonr-set-subhead){font-weight:700;font-size:12px;margin:4px 0 2px;}
:where(.sonr-set-ind){display:flex;flex-direction:column;gap:6px;padding:8px 0;border-bottom:1px solid #e6e6e6;}
:where(.sonr-set-inputs){display:flex;align-items:center;flex-wrap:wrap;gap:6px;}
:where(.sonr-set-inputs-label){color:#555;font-size:11px;}
:where(.sonr-set-num){appearance:textfield;-moz-appearance:textfield;width:52px;background:#fff;color:#000;border:1px solid #000;border-radius:3px;font:inherit;font-size:12px;line-height:18px;padding:1px 4px;}
:where(.sonr-set-btn){align-self:flex-start;}
:where(.sonr-set-tpl-save){display:flex;align-items:center;gap:6px;}
:where(.sonr-set-tpl-save .sonr-search-input){flex:1;width:auto;}
:where(.sonr-set-tpl-row){display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;}
:where(.sonr-set-tpl-actions){display:inline-flex;align-items:center;gap:6px;}
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
:where(.sonr-draw-menu){display:inline-flex;align-items:center;}
:where(.sonr-draw-opt-icon){display:inline-flex;align-items:center;justify-content:center;width:16px;flex:0 0 16px;}
:where(.sonr-search){display:inline-flex;align-items:center;}
:where(.sonr-search-input){appearance:none;-webkit-appearance:none;background:#fff;color:#000;border:1px solid #000;border-radius:3px;font:inherit;font-size:11px;line-height:18px;padding:0 6px;width:120px;}
:where(.sonr-search-input::placeholder){color:#888;}
:where(.sonr-search-dropdown){display:flex;flex-direction:column;min-width:200px;max-height:60vh;overflow-y:auto;background:#fff;color:#000;border:1px solid #000;border-radius:4px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:4px;z-index:2147483000;}
:where(.sonr-search-option){display:flex;align-items:baseline;gap:8px;background:none;border:none;border-radius:3px;color:#000;cursor:pointer;font:inherit;font-size:12px;line-height:22px;padding:2px 8px;text-align:left;white-space:nowrap;}
:where(.sonr-search-option:hover,.sonr-search-option.active){background:#e6e6e6;}
:where(.sonr-search-expr){border-bottom:1px solid #ccc;}
:where(.sonr-search-sym){font-weight:700;min-width:44px;}
:where(.sonr-search-name){color:#555;font-size:11px;overflow:hidden;text-overflow:ellipsis;}
:where(.sonr-search-ex){color:#888;font-size:10px;margin-left:auto;}
:where(.sonr-search-msg){color:#555;font-size:12px;padding:4px 8px;}
:where(.sonr-confirm-overlay){position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);}
:where(.sonr-confirm){display:flex;gap:14px;align-items:flex-start;max-width:520px;margin:0 16px;padding:22px 24px;background:#fff;color:#000;border:1px solid #000;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.3);}
:where(.sonr-confirm-icon){flex:0 0 32px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #000;font-weight:700;font-size:16px;}
:where(.sonr-confirm-body){display:flex;flex-direction:column;gap:16px;}
:where(.sonr-confirm-msg){margin:0;font-size:15px;line-height:1.4;}
:where(.sonr-confirm-actions){display:flex;gap:10px;justify-content:flex-end;}
:where(.sonr-confirm-btn){appearance:none;font:inherit;font-size:13px;font-weight:600;padding:8px 18px;border-radius:8px;cursor:pointer;border:1px solid #000;background:#fff;color:#000;}
:where(.sonr-confirm-ok){background:#000;color:#fff;}
:where(.sonr-text-input){appearance:none;-webkit-appearance:none;transform:translateY(-50%);min-width:80px;background:#fff;color:#2962ff;border:1px solid #2962ff;border-radius:3px;font:inherit;font-size:12px;line-height:18px;padding:1px 4px;outline:none;box-shadow:0 2px 8px rgba(0,0,0,0.25);}
:where(.sonr-panel){display:flex;flex-direction:column;min-width:180px;font-size:12px;color:#000;}
:where(.sonr-panel-title){font-weight:700;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#555;padding:6px 8px 4px;}
:where(.sonr-panel-empty){color:#888;padding:4px 8px 8px;font-style:italic;}
:where(.sonr-panel-list){list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
:where(.sonr-panel-row){display:flex;align-items:center;gap:6px;padding:2px 8px;min-height:24px;}
:where(.sonr-panel-row:hover){background:rgba(0,0,0,0.05);}
:where(.sonr-panel-row.off .sonr-panel-label){opacity:0.45;}
:where(.sonr-panel-label){flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
:where(.sonr-panel-locate){appearance:none;background:none;border:none;margin:0;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left;}
:where(.sonr-panel-actions){display:inline-flex;align-items:center;gap:2px;flex:0 0 auto;}
:where(.sonr-panel-btn){display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;background:none;border:none;border-radius:3px;color:#555;cursor:pointer;}
:where(.sonr-panel-btn:hover){background:rgba(0,0,0,0.1);color:#000;}
:where(.sonr-panel-btn[aria-pressed="true"]){color:#000;}
:where(.sonr-timeframe-bar){display:flex;align-items:center;gap:8px;padding:3px 8px;background:#fff;color:#000;border-top:1px solid #000;font-family:inherit;}
:where(.sonr-timeframe-list){display:flex;align-items:center;gap:2px;flex:1 1 auto;overflow-x:auto;scrollbar-width:none;}
:where(.sonr-timeframe-list::-webkit-scrollbar){height:0;width:0;display:none;}
:where(.sonr-timeframe-btn){appearance:none;background:none;border:none;border-radius:3px;color:#555;cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:20px;padding:0 8px;white-space:nowrap;}
:where(.sonr-timeframe-btn:hover){background:#e6e6e6;color:#000;}
:where(.sonr-timeframe-btn.on){background:#000;color:#fff;}
:where(.sonr-timeframe-slot){display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;}
/* --- GoToDateDialog --- */
:where(.sonr-gotodate-overlay){position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);}
:where(.sonr-gotodate){display:flex;flex-direction:column;gap:12px;max-width:360px;margin:0 16px;padding:18px 20px;background:#fff;color:#000;border:1px solid #000;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.3);font-family:inherit;}
:where(.sonr-gotodate-title){font-weight:700;font-size:13px;}
:where(.sonr-gotodate-form){display:flex;align-items:center;gap:8px;}
:where(.sonr-gotodate-input){appearance:none;-webkit-appearance:none;background:#fff;color:#000;border:1px solid #000;border-radius:3px;font:inherit;font-size:12px;line-height:18px;padding:2px 6px;}
:where(.sonr-gotodate-go){appearance:none;font:inherit;font-size:13px;font-weight:600;padding:6px 16px;border-radius:8px;cursor:pointer;border:1px solid #000;background:#000;color:#fff;}
:where(.sonr-gotodate-go:disabled){opacity:0.4;cursor:default;}
/* --- NavControlBar --- */
:where(.sonr-navbar){display:inline-flex;align-items:center;gap:2px;padding:2px;background:#fff;color:#000;border:1px solid #000;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.18);font-family:inherit;}
:where(.sonr-nav-btn){display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;appearance:none;-webkit-appearance:none;background:none;border:none;border-radius:4px;color:#555;cursor:pointer;font:inherit;}
:where(.sonr-nav-btn:hover){background:#e6e6e6;color:#000;}
:where(.sonr-nav-btn:active){background:#d9d9d9;}
/* --- SymbolInfoDialog --- */
:where(.sonr-syminfo-overlay){position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);}
:where(.sonr-syminfo){display:flex;flex-direction:column;width:340px;max-width:92vw;max-height:80vh;background:#fff;color:#000;border:1px solid #000;border-radius:8px;overflow:hidden;font-family:inherit;}
:where(.sonr-syminfo-head){display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #000;}
:where(.sonr-syminfo-title){font-weight:700;font-size:13px;}
:where(.sonr-syminfo-close){appearance:none;background:none;border:none;cursor:pointer;color:#000;font-size:14px;line-height:1;padding:2px 6px;}
:where(.sonr-syminfo-body){padding:12px 14px;overflow-y:auto;}
:where(.sonr-syminfo-dl){display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:12px;}
:where(.sonr-syminfo-dt){color:#555;font-weight:600;white-space:nowrap;}
:where(.sonr-syminfo-dd){color:#000;margin:0;text-align:right;overflow-wrap:anywhere;}
:where(.sonr-syminfo-msg){color:#555;font-size:12px;padding:4px 0;}
/* --- MarketStatus --- */
:where(.sonr-mkt){display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;font:inherit;font-size:11px;line-height:16px;font-weight:600;border:1px solid currentColor;white-space:nowrap;}
:where(.sonr-mkt-dot){width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto;}
:where(.sonr-mkt-label){color:inherit;}
:where(.sonr-mkt-open){color:#22a06b;}
:where(.sonr-mkt-pre){color:#d9920a;}
:where(.sonr-mkt-after){color:#d9920a;}
:where(.sonr-mkt-closed){color:#888;}
:where(button.sonr-mkt){appearance:none;-webkit-appearance:none;background:none;cursor:pointer;}
:where(.sonr-mkt-pop){width:300px;max-width:92vw;background:#fff;border:1px solid #000;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.3);padding:14px 16px;font-size:13px;z-index:2147483001;}
:where(.sonr-mkt-pop-head){display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;}
:where(.sonr-mkt-pop-msg){margin:8px 0 14px;line-height:1.45;color:#111;}
:where(.sonr-mkt-timeline){display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px 10px;}
:where(.sonr-mkt-day){font-size:11px;font-weight:700;color:#555;}
:where(.sonr-mkt-track){position:relative;height:6px;border-radius:3px;background:#e2e2e2;}
:where(.sonr-mkt-fill){position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#22a06b;}
:where(.sonr-mkt-handle){position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #22a06b;transform:translate(-50%,-50%);}
:where(.sonr-mkt-ticks){grid-column:2;display:flex;justify-content:space-between;font-size:10px;color:#888;}
:where(.sonr-mkt-tz){margin-top:12px;font-size:11px;color:#888;text-align:center;}
:where(.sonr-hd){display:inline-flex;align-items:center;gap:10px;font-family:inherit;font-size:12px;color:#000;white-space:nowrap;}
:where(.sonr-hd-sym){font-weight:700;color:#000;}
:where(.sonr-hd-ohlc){display:inline-flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums;}
:where(.sonr-hd-cell){display:inline-flex;align-items:baseline;gap:3px;}
:where(.sonr-hd-k){color:#888;font-size:11px;}
:where(.sonr-hd-v){color:#555;}
:where(.sonr-hd-up){color:#22a06b;}
:where(.sonr-hd-down){color:#d23c3c;}
/* --- SaveLoadDialog --- */
:where(.sonr-sl-overlay){position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);}
:where(.sonr-sl-panel){display:flex;flex-direction:column;width:520px;max-width:92vw;max-height:82vh;background:#fff;color:#000;border:1px solid #000;border-radius:8px;overflow:hidden;font-family:inherit;}
:where(.sonr-sl-head){display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #000;}
:where(.sonr-sl-title){font-weight:700;font-size:13px;}
:where(.sonr-sl-close){appearance:none;background:none;border:none;cursor:pointer;color:#000;font-size:14px;line-height:1;padding:2px 6px;}
:where(.sonr-sl-body){display:flex;flex-direction:column;gap:14px;padding:12px 14px;overflow-y:auto;}
:where(.sonr-sl-section){display:flex;flex-direction:column;gap:6px;}
:where(.sonr-sl-section-head){display:flex;align-items:center;justify-content:space-between;gap:8px;}
:where(.sonr-sl-section-actions){display:inline-flex;align-items:center;gap:6px;}
:where(.sonr-sl-label){font-weight:700;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#555;}
:where(.sonr-sl-textarea){width:100%;box-sizing:border-box;min-height:120px;resize:vertical;background:#fff;color:#000;border:1px solid #000;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.45;padding:8px;white-space:pre;overflow:auto;}
:where(.sonr-sl-textarea[readonly]){background:#f5f5f5;}
:where(.sonr-sl-error){margin:0;color:#c0392b;font-size:11px;line-height:1.4;}
:where(.sonr-sl-actions){display:flex;justify-content:flex-end;}
:where(.sonr-sl-btn){appearance:none;-webkit-appearance:none;background:#fff;color:#000;border:1px solid #000;border-radius:3px;cursor:pointer;font:inherit;font-size:11px;line-height:18px;padding:2px 10px;white-space:nowrap;}
:where(.sonr-sl-btn:hover){background:#e6e6e6;}
:where(.sonr-sl-load){background:#000;color:#fff;font-weight:600;padding:4px 16px;}
:where(.sonr-sl-load:hover){background:#222;}
/* --- Watchlist --- */
:where(.sonr-watchlist){display:flex;flex-direction:column;min-width:180px;font-size:12px;color:#000;}
:where(.sonr-watchlist-add){position:relative;padding:2px 8px 6px;}
:where(.sonr-watchlist-add .sonr-search-input){width:100%;box-sizing:border-box;}
:where(.sonr-watchlist-results){position:absolute;left:8px;right:8px;top:100%;z-index:2147483000;display:flex;flex-direction:column;background:#fff;color:#000;border:1px solid #000;border-radius:4px;box-shadow:0 6px 20px rgba(0,0,0,0.25);padding:4px;max-height:50vh;overflow-y:auto;}
:where(.sonr-watchlist-list){list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
:where(.sonr-watchlist-row){display:flex;align-items:center;gap:4px;padding-right:6px;}
:where(.sonr-watchlist-row:hover){background:rgba(0,0,0,0.05);}
:where(.sonr-watchlist-pick){flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:none;cursor:pointer;color:inherit;font:inherit;text-align:left;padding:4px 8px;}
:where(.sonr-watchlist-sym){font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
:where(.sonr-watchlist-quote){display:inline-flex;align-items:baseline;gap:8px;flex:0 0 auto;}
:where(.sonr-watchlist-last){font-variant-numeric:tabular-nums;}
:where(.sonr-watchlist-chg){font-variant-numeric:tabular-nums;font-size:11px;min-width:52px;text-align:right;}
:where(.sonr-watchlist-chg-up){color:#0a9d57;}
:where(.sonr-watchlist-chg-down){color:#d23c3c;}
:where(.sonr-watchlist-chg-flat){color:#888;}
:where(.sonr-watchlist-remove){flex:0 0 auto;opacity:0;}
:where(.sonr-watchlist-row:hover .sonr-watchlist-remove){opacity:1;}
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
