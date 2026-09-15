/* ui2-merge — the repairs the four-way interface merge needed, and nothing else.

   ui2-horse, ui2-shop, ui2-compete and ui2-hud each restructure their own panels after the
   inline renderers have run.  Merged together they are consistent, but two panels fell
   between the lanes:

     • #eventsPanel and #lbPanel open with a bare <b> title that ui-kit promotes to
       .mk-panel-head.  Neither renderer ever wrote a close control, so once the compete
       pass had given them a real header the panel had a title bar with nothing in it —
       the only way out was the dock button.
     • #shopPanel's ✖ lives inside the horizontally scrolling tab strip.  With ui2-shop's
       wider tab row it scrolls to x≈2122 on a 1440 viewport — present in the DOM, 700px
       past the right edge of the screen.

   So: every open panel gets ONE pinned close affordance in the top-right corner, and any
   ✖ that has drifted outside its own panel's box is hidden rather than left to confuse.
   Presentation only — the button calls the game's own hidePanels(), no ids are added to
   the game namespace beyond .mk-x, and nothing is rebuilt.

   Must install LAST, after ui-kit and after the four ui2-* passes, so it judges the final
   shape of each panel rather than the renderer's first draft.                              */

export const id = 'ui2-merge';

const CSS = `
:where(.mk-x){
  position:absolute; top:10px; right:12px; z-index:40;
  width:36px; height:36px; min-width:36px; padding:0;
  display:flex; align-items:center; justify-content:center;
  font:600 15px/1 'Nunito',system-ui,sans-serif; color:#6b5844;
  background:#f6efe0; border:1px solid #d9c9ab; border-radius:12px;
  box-shadow:0 1px 2px rgba(60,42,24,.14); cursor:pointer;
  transition:background .12s ease, transform .12s ease;
}
:where(.mk-x):hover{ background:#efe4cf; }
:where(.mk-x):active{ transform:scale(.94); }
:where(.mk-x):focus-visible{ outline:2px solid #b8892e; outline-offset:2px; }
/* The lane the title leaves for the button is written onto the header element itself, in
   reserve() — these panels are re-rendered wholesale and a class does not survive that. */
@media (prefers-reduced-motion: reduce){ :where(.mk-x){ transition:none } }
@media (max-width:560px){ :where(.mk-x){ width:40px; height:40px; min-width:40px; top:8px; right:10px } }
`;

function style() {
  if (document.getElementById('ui2MergeCss')) return;
  const el = document.createElement('style');
  el.id = 'ui2MergeCss';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const XRE = /^\s*(?:✖|✕|×|✗)\s*$/;

/* Every panel the game or a package may have opened. */
function panels() {
  const out = [];
  document.querySelectorAll('.fpanel,[id$="Panel"]').forEach(p => {
    if (out.indexOf(p) < 0) out.push(p);
  });
  return out;
}

function visible(p) {
  if (!p || p.style.display === 'none') return false;
  const r = p.getBoundingClientRect();
  return r.width > 40 && r.height > 40;
}

/* A ✖ the player can actually reach: inside the panel's own box and on screen. */
function usableClose(p) {
  const pr = p.getBoundingClientRect();
  let stray = null;
  const all = p.querySelectorAll('button,.mk-x,[data-fx]');
  for (const b of all) {
    if (!XRE.test(b.textContent || '')) continue;
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const inside = r.left >= pr.left - 4 && r.right <= pr.right + 4 &&
                   r.top >= pr.top - 4 && r.bottom <= pr.bottom + 4;
    const onScreen = r.right > 0 && r.left < (window.innerWidth || 1e4);
    if (inside && onScreen) return { ok: b };
    stray = stray || b;
  }
  return { stray };
}

export function install(G) {
  style();

  const close = () => {
    try {
      if (typeof window.hidePanels === 'function') { window.hidePanels(); return; }
    } catch (e) {}
    try { G.hidePanels && G.hidePanels(); return; } catch (e) {}
    panels().forEach(p => { p.style.display = 'none'; });
  };

  /* Clear a lane for the pinned ✖ at the end of the title bar. Two of these headers are a
     whole sentence long, so the title wraps inside the reservation rather than truncating. */
  function reserve(p) {
    const hd = p.querySelector('.mk-panel-head') ||
               (p.firstElementChild && p.firstElementChild.tagName === 'B' ? p.firstElementChild : null);
    if (!hd || hd.dataset.mkXpad === '1') return;
    const pad = (window.innerWidth || 1024) <= 560 ? '60px' : '58px';
    hd.style.setProperty('padding-right', pad, 'important');
    hd.style.setProperty('box-sizing', 'border-box', 'important');
    hd.style.setProperty('white-space', 'normal', 'important');
    hd.style.setProperty('line-height', '1.3', 'important');
    hd.style.overflowWrap = 'anywhere';
    hd.dataset.mkXpad = '1';
  }

  function fix(p) {
    try {
      if (!visible(p)) return;
      const mine = p.querySelector('.mk-x');
      const found = usableClose(p);
      /* A panel that already carries OUR button keeps the header reservation. The sweep
         re-runs on every click and the renderers rewrite these panels wholesale, so the
         reservation is written onto the header element itself rather than parked on a
         class the next re-render would drop. */
      if (found.ok) { if (mine) reserve(p); return; }
      /* a ✖ that scrolled out of its own panel is worse than none — take it out of the
         tab order and out of the picture, and give the panel a reliable one instead. */
      if (found.stray && !found.stray.classList.contains('mk-x')) {
        found.stray.style.display = 'none';
        found.stray.setAttribute('aria-hidden', 'true');
      }
      if (p.querySelector('.mk-x')) { reserve(p); return; }
      const b = document.createElement('button');
      b.className = 'mk-x';
      b.type = 'button';
      b.textContent = '✖';
      b.title = 'Close';
      b.setAttribute('aria-label', 'Close panel');
      b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); close(); });
      /* the panel is positioned, so an absolute child pins to its corner and does not
         travel with the scrolling .mk-panel-body */
      const cs = getComputedStyle(p);
      if (cs.position === 'static') p.style.position = 'relative';
      p.appendChild(b);
      reserve(p);
    } catch (e) {}
  }

  function sweep() { panels().forEach(fix); }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sweep(); });
  }

  /* The four ui2 passes all restructure on their own animation frame, so run after them:
     one observer on the panel host, plus the open/toggle hooks the kit already wraps. */
  try {
    const mo = new MutationObserver(schedule);
    panels().forEach(p => mo.observe(p, { childList: true, subtree: false }));
    const host = document.body;
    if (host) mo.observe(host, { childList: true, subtree: false });
  } catch (e) {}

  try {
    const U = G.ui || {};
    ['open', 'toggle', 'rerender', 'openCare', 'openStable', 'openEvents', 'openQuests', 'openLB'].forEach(k => {
      const fn = U[k];
      if (typeof fn !== 'function' || fn.__ui2merge) return;
      const wrapped = function (...a) { const r = fn.apply(this, a); schedule(); return r; };
      wrapped.__ui2merge = true;
      U[k] = wrapped;
    });
  } catch (e) {}

  try { G.on && G.on('boot', schedule); } catch (e) {}
  /* a cheap safety net for panels opened by a path nothing above covers */
  try { document.addEventListener('click', schedule, true); } catch (e) {}
  schedule();
}
