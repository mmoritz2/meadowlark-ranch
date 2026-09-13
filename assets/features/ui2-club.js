/* Feature package 'ui2-club' — the two screens the earlier interface pass did not reach:
   🌐 The Club (#onlinePanel) and 🏗️ Build (#buildPanel, plus the placement HUD).

   Both were the same kind of wrong.  The Club was five and a half screens of unbroken scroll
   with no tabs, fourteen identical <b> pseudo-headings doing all the structural work, three
   sections rendered twice by different owners a thousand pixels apart, and the club's own
   name — the one fact the screen exists to tell you — buried two sheet-heights down behind a
   settings form.  Build was a wall of fifty identical rows in which the price was eleven-pixel
   grey tail text, two of the eight shelves sat permanently off the right edge, and the
   placement HUD could not physically be wider than half the viewport, so a one-line
   instruction wrapped to six lines of pink paragraph over the world you were aiming at.

   What this file does, and does not do:

   1. It does NOT rewrite a renderer.  openOnline() and openBuild() both set p.innerHTML
      wholesale and bind every handler with .onclick at render time, and this package owns one
      file.  So it re-reads the DOM they produced and lays it out again, on the panel's
      mutation observer plus the G.ui open/rerender wrappers.  Original <button> nodes are
      MOVED, never cloned — a clone drops the onclick and the player gets a dead control.
   2. THE CLUB BECOMES FOUR TABS.  Clubhouse · Riders · Rides · Chat & safety.  The body's flat
      run of children is cut at each heading and routed by a selector that is actually present
      in the live DOM; anything no selector claims stays where it was rather than vanishing.
      The Clubhouse opens on a club identity card — crest, name, motto, founder — and the two
      duplicated sections (Riders here now, the roster) are merged into one list of one shape.
   3. ROWS BECOME A GRID.  .evrow is a nowrap flex line in which the name is `flex:0 1 auto`
      and the description is `flex:1 1 auto`, so the description absorbs all the slack, the
      name shrinks to a 40px column, and because a <b> may not break words its ink paints
      straight over the paragraph beside it.  Five of six expedition names did this on a phone.
      One grid — auto | minmax(9rem,1fr) | auto — fixes every one of them at once.  See the
      note at the top of the stylesheet: this is the third package to work around that rule.
   4. BUILD BECOMES A CATALOGUE.  Prices are pills you can read and cannot afford in colour,
      builder points are the currency the screen is actually about so they get their own pill,
      shelves carry their count and scroll into view, and the All shelf — 44 pieces in one
      column — is grouped into collapsible shelves so the thing is browsable rather than
      endless.
   5. THE HUD BECOMES A TOOLBAR.  An explicit max-content band instead of the shrink-to-fit
      that capped it at 50vw, the three controls on one row, the refusal reason from
      decorOk() actually shown instead of thrown away, and a session budget with a
      remove-the-last-one control, which is what turns Build from a menu into a mode.

   Everything is idempotent (data-c3 marks a transformed node), wrapped in try/catch per row,
   and degrades to leaving the DOM alone when a table, a hook or a node it expects is absent. */
export const id='ui2-club';
export function install(G){
 const $=G.$||(id2=>document.getElementById(id2));
 const T=G.tables||{}, K=(G.ui&&G.ui.k)||{}, S=G.save||{};
 const DC=T.DECOR_CAT||{}, BREEDS=T.BREEDS3||[];

 /* ================= 0. stylesheet =================
    Tokens only — no new colours.  One sheet for both screens because they share the row grid,
    the chip vocabulary and the section header, and a second sheet would drift from the first. */
 try{
  if(!document.getElementById('mkClubCss')){
   const st=document.createElement('style'); st.id='mkClubCss';
   st.textContent=`
/* ---------- the row grid ----------
   THE fix for the squashed-name bug, in one rule.  Column 1 holds the portrait or the glyph
   plate, column 2 is minmax(9rem,1fr) so a name can never be squeezed below nine characters,
   column 3 is minmax(0,auto) so the trailing control is pinned and cannot be pushed off the
   end.  Every leftover child of the original renderer lands in column 2 rather than
   auto-placing beside the buttons, which is what used to collapse the text column.
   NOTE for whoever owns ranch3d.html: ui2-compete, ui2-shop and now this file all carry a
   private copy of this grid because the .evrow>b rule -- flex:0 1 auto with min-width:0 -- lets a title shrink
   below its own ink.  The right place to fix that is the .evrow rule itself. */
.evrow.c3,.clubRow.c3{display:grid;grid-template-columns:auto minmax(9rem,1fr) minmax(0,auto);
 align-items:center;column-gap:var(--sp-3,12px);row-gap:5px;flex:0 0 auto;min-height:var(--tap,44px);
 padding:6px var(--sp-3,12px)}
.evrow.c3>*,.clubRow.c3>*{grid-column:2;min-width:0;white-space:normal;overflow-wrap:anywhere;width:auto}
.evrow.c3>.c3-face,.clubRow.c3>.c3-face{grid-column:1;grid-row:1/-1;align-self:center;
 width:40px;height:40px;min-width:40px;flex:none}
.evrow.c3>.c3-act,.clubRow.c3>.c3-act{grid-column:3;grid-row:1;justify-self:end;display:flex;align-items:center;
 gap:var(--sp-1,4px);flex-wrap:wrap;justify-content:flex-end;white-space:nowrap}
.evrow.c3>.c3-act>button,.clubRow.c3>.c3-act>button{margin:0;flex:none}
.c3-main{display:flex;flex-direction:column;gap:3px;min-width:0}
/* A title breaks between words, and inside a word only when the word genuinely cannot fit —
   never one letter per line, which is what overflow-wrap:anywhere on its own would give. */
.c3-title{font-family:var(--display,inherit);font-size:var(--fs-md,13.5px);font-weight:700;color:var(--ink,#3b2a1e);
 line-height:var(--lh-tight,1.2);overflow-wrap:break-word;word-break:normal;hyphens:auto;min-width:0}
.c3-meta{font-size:var(--fs-xs,11px);font-weight:600;color:var(--ink-2,#6b5a49);line-height:1.35;min-width:0;
 overflow-wrap:break-word;word-break:normal}
.c3-meta.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ---------- the portrait / glyph plate ---------- */
.c3-face{flex:none;display:inline-flex;align-items:center;justify-content:center;position:relative;
 width:40px;height:40px;border-radius:var(--r-xs,8px);background:var(--paper-2,#f6ecd9);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8);font-weight:800;font-size:16px;color:var(--ink-2,#6b5a49);overflow:hidden}
.c3-face .mk-thumb{border-radius:var(--r-xs,8px)}
.c3-face.on::after,.c3-face.off::after{content:"";position:absolute;right:-2px;bottom:-2px;width:11px;height:11px;
 border-radius:var(--r-full,999px);box-shadow:0 0 0 2px var(--paper-raised,#fff)}
.c3-face.on::after{background:var(--meadow,#5fb56a)}
.c3-face.off::after{background:var(--ink-3,#9a8770)}

/* ---------- labelled facts, used on both screens ---------- */
.c3-k{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3,#9a8770);line-height:1.3}
.c3-v{font-size:12.5px;font-weight:800;color:var(--ink,#3b2a1e);line-height:1.25;font-variant-numeric:tabular-nums}
.c3-specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(66px,1fr));gap:3px 10px;
 border-top:1px dashed var(--line,#e6d6b8);padding-top:5px;margin-top:2px}
.c3-spec{display:flex;flex-direction:column;gap:0;min-width:0}
.c3-note{margin:2px 0 0}
.c3-note>summary{cursor:pointer;list-style:none;font-size:var(--fs-xs,11px);font-weight:800;color:var(--ink-2,#6b5a49);
 padding:3px 0;display:flex;align-items:center;gap:5px}
.c3-note>summary::-webkit-details-marker{display:none}
.c3-note>summary::before{content:"›";display:inline-block;transition:transform .15s;font-weight:800;color:var(--ink-3,#9a8770)}
.c3-note[open]>summary::before{transform:rotate(90deg)}
.c3-noteBody{font-size:11.5px;line-height:1.5;color:var(--ink-2,#6b5a49);padding-bottom:3px}
@media (prefers-reduced-motion:reduce){.c3-note>summary::before{transition:none}}

/* ---------- section header: an eyebrow with a rule, not a bold sentence ---------- */
b.c3-sec,div.c3-sec{display:flex!important;align-items:center;gap:var(--sp-2,8px);flex:0 0 auto;
 margin:6px 2px 0;font-family:var(--display,inherit);font-size:12px;font-weight:600;
 letter-spacing:.04em;color:var(--ink-2,#6b5a49);text-transform:none}
.c3-sec::after{content:"";flex:1;height:1px;background:var(--line,#e6d6b8)}
.c3-secN{flex:none;font-size:9.5px;font-weight:800;letter-spacing:.08em;border-radius:var(--r-full,999px);
 padding:2px 7px;background:var(--paper-2,#f6ecd9);color:var(--ink-3,#9a8770);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8);font-variant-numeric:tabular-nums}

/* ================= the club ================= */
#onlinePanel .c3-tabs{position:sticky;top:0;z-index:5;margin:0 0 var(--sp-2,8px);
 background:linear-gradient(180deg,#fffdf7 76%,rgba(255,253,247,0));padding-bottom:var(--sp-1,4px)}
#onlinePanel .c3-pane{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}
#onlinePanel .c3-pane[hidden]{display:none!important}
#onlinePanel .c3-pane>*{flex:0 0 auto}
/* Blocked: a, b, c is a nowrap span at full row width — fine at "nobody", a sheet-wide
   overflow at four names.  It wraps here, and becomes chips when there is anything in it. */
#onlinePanel .c3-pane .crow>span:last-child{white-space:normal;overflow-wrap:anywhere}
#onlinePanel .c3-pane .crow{flex-wrap:wrap;row-gap:var(--sp-1,4px)}
#onlinePanel .c3-pane .crow:has(> .tabbtn){flex-wrap:nowrap}

.c3-id{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:var(--sp-1,4px) var(--sp-3,12px);
 align-items:center;border:1px solid var(--line,#e6d6b8);border-radius:var(--r-s,12px);
 padding:var(--sp-3,12px);background:var(--paper-raised,#fff);box-shadow:var(--e0,0 1px 2px rgba(50,32,10,.06))}
.c3-crest{grid-row:1/3;width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;
 font-family:var(--display,inherit);font-size:26px;font-weight:600;color:var(--ink,#3b2a1e);
 background:var(--paper-2,#f6ecd9);box-shadow:inset 0 0 0 2px var(--brass,#e0b25a)}
.c3-idName{font-family:var(--display,inherit);font-size:var(--fs-2xl,22px);font-weight:600;color:var(--ink,#3b2a1e);
 line-height:1.1;overflow-wrap:break-word;word-break:normal;min-width:0}
.c3-idMotto{font-size:var(--fs-sm,12.5px);font-style:italic;color:var(--ink-2,#6b5a49);line-height:1.35;min-width:0;grid-column:2/4}
.c3-idFoot{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:var(--sp-1,4px) var(--sp-2,8px);align-items:center;
 font-size:var(--fs-xs,11px);font-weight:700;color:var(--ink-3,#9a8770);border-top:1px dashed var(--line,#e6d6b8);padding-top:6px}
.c3-idEdit{grid-column:3;grid-row:1;justify-self:end;align-self:start}
.c3-idEdit button{min-height:36px;padding:6px 10px}
.c3-conn{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2,8px)}
.c3-dot{flex:none;display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs,11px);font-weight:800;
 border-radius:var(--r-full,999px);padding:4px 10px;background:var(--paper-2,#f6ecd9);color:var(--ink-2,#6b5a49);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.c3-dot::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ink-3,#9a8770)}
.c3-dot.on{background:var(--good-bg,#eaf5dc);color:var(--good,#3f8f4c);box-shadow:inset 0 0 0 1px #bfe0a4}
.c3-dot.on::before{background:var(--meadow,#5fb56a)}
.c3-code{display:inline-flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;
 border-radius:var(--r-full,999px);padding:3px 4px 3px 12px;background:var(--paper-2,#f6ecd9);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.c3-codeV{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:700;
 color:var(--ink,#3b2a1e);letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.c3-code button{min-height:32px;padding:4px 8px;font-size:12px;flex:none}
.c3-foot{position:sticky;bottom:-2px;z-index:4;display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;
 padding:var(--sp-2,8px) 0 4px;margin-top:2px;background:#fffdf7;border-top:1px solid var(--line,#e6d6b8)}
.c3-foot>button{flex:1 1 auto;min-height:var(--tap,44px)}
.c3-edit[hidden]{display:none!important}
.c3-edit{display:flex;flex-direction:column;gap:var(--sp-2,8px);border:1px dashed var(--line-2,#d4bf93);
 border-radius:var(--r-s,12px);padding:var(--sp-2,8px) var(--sp-3,12px);background:var(--paper-2,#f6ecd9)}
.c3-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:6px;margin-top:2px}
.c3-stat{border-radius:var(--r-xs,8px);padding:6px 9px;background:var(--paper-2,#f6ecd9);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8);display:flex;flex-direction:column;gap:1px;min-width:0}
.c3-statV{font-size:var(--fs-lg,15px);font-weight:800;color:var(--ink,#3b2a1e);font-variant-numeric:tabular-nums;line-height:1.15}
.c3-statK{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#9a8770);line-height:1.25}
/* the overflow popover: seven relationship controls do not belong on the face of a row */
.c3-more{position:relative;flex:none}
.c3-more>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
 min-width:36px;min-height:36px;border-radius:var(--r-s,12px);border:1.5px solid var(--line-2,#d4bf93);
 background:linear-gradient(#fffaf0,#f1e2c4);font-weight:800;color:var(--ink-2,#6b5a49)}
.c3-more>summary::-webkit-details-marker{display:none}
.c3-moreBody{position:absolute;right:0;top:calc(100% + 4px);z-index:20;display:flex;flex-direction:column;gap:4px;
 padding:6px;border-radius:var(--r-s,12px);background:var(--paper-raised,#fff);border:1px solid var(--line,#e6d6b8);
 box-shadow:var(--e2,0 10px 30px rgba(50,32,10,.22));min-width:132px}
.c3-moreBody button{width:100%;justify-content:flex-start;min-height:36px;font-size:12px}
.c3-chipRow{display:flex;flex-wrap:wrap;gap:var(--sp-1,4px);align-items:center}
#onlinePanel .clubChatLog{max-height:240px;overflow:auto}

/* ================= build ================= */
#buildPanel .c3-pane>*{flex:0 0 auto}
.c3-lvl{border:1px solid var(--line,#e6d6b8);border-radius:var(--r-s,12px);padding:var(--sp-2,8px) var(--sp-3,12px);
 background:var(--paper-raised,#fff);box-shadow:var(--e0,0 1px 2px rgba(50,32,10,.06));
 display:flex;flex-direction:column;gap:6px}
.c3-lvlTop{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap}
.c3-lvlBadge{flex:none;font-family:var(--display,inherit);font-size:var(--fs-lg,15px);font-weight:600;
 border-radius:var(--r-full,999px);padding:4px 12px;background:var(--brass-3,#fff0c2);color:#6b4e12;
 box-shadow:inset 0 0 0 1px #e8cf8a}
.c3-stars{flex:none;font-size:14px;letter-spacing:1px;line-height:1}
.c3-stars i{font-style:normal;color:var(--line-2,#d4bf93)}
.c3-stars b{font-weight:400;color:var(--brass-2,#c8952f)}
.c3-lvlNext{font-size:var(--fs-xs,11px);font-weight:800;color:var(--ink-2,#6b5a49);margin-left:auto;
 font-variant-numeric:tabular-nums;white-space:nowrap}
/* A five-state checklist rendered as inline spans breaks mid-phrase: "☆ a / completed decor
   set" across a line break, with the wrapped box overlapping both neighbours.  Each state is
   its own box, wide enough that the longest of them never breaks. */
.c3-check{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px}
.c3-check>span{display:flex;align-items:flex-start;gap:5px;font-size:var(--fs-xs,11px);font-weight:700;
 line-height:1.3;white-space:normal;margin:0!important;color:var(--ink-3,#9a8770)}
.c3-check>span.on{color:var(--good,#3f8f4c)}
.c3-shelf{position:relative;display:flex;align-items:center;gap:2px}
#onlinePanel .c3-tabShell{margin:0}
.c3-shelf>.crow{flex:1 1 auto;min-width:0}
.c3-arrow{flex:none;min-width:28px;min-height:34px;padding:0 6px;font-weight:800;line-height:1;
 border-radius:var(--r-full,999px);font-size:15px}
.c3-arrow[hidden]{display:none!important}
.c3-shelfN{opacity:.65;font-weight:800;font-size:9px;margin-left:4px;font-variant-numeric:tabular-nums}
.c3-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:6px;flex:0 0 auto}
.c3-group{flex:0 0 auto;border:1px solid var(--line,#e6d6b8);border-radius:var(--r-s,12px);
 background:var(--paper-raised,#fff);padding:2px var(--sp-2,8px)}
.c3-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:var(--sp-2,8px);
 font-family:var(--display,inherit);font-size:var(--fs-md,13.5px);font-weight:600;color:var(--ink,#3b2a1e);
 min-height:30px}
.c3-group>summary::-webkit-details-marker{display:none}
.c3-group>summary::after{content:"›";margin-left:auto;font-weight:800;color:var(--ink-3,#9a8770);
 transition:transform .15s;display:inline-block}
.c3-group[open]>summary::after{transform:rotate(90deg)}
.c3-group>.c3-grid{padding-top:var(--sp-2,8px)}
@media (prefers-reduced-motion:reduce){.c3-group>summary::after{transition:none}}
/* a piece: a plate you can see, a price you can read, and a full-width control you can hit */
.evrow.c3-piece{display:grid;grid-template-columns:auto minmax(0,1fr);grid-auto-rows:min-content;
 column-gap:var(--sp-2,8px);row-gap:5px;align-items:center;padding:6px;min-height:0;
 border-radius:var(--r-s,12px)}
.evrow.c3-piece:hover{transform:none;box-shadow:var(--e1,0 2px 6px rgba(50,32,10,.14))}
.evrow.c3-piece.cant{opacity:.55}
.c3-plate{grid-column:1;grid-row:1;width:44px;height:44px;border-radius:var(--r-xs,8px);display:flex;
 align-items:center;justify-content:center;font-size:24px;line-height:1;background:var(--paper-2,#f6ecd9);
 box-shadow:inset 0 0 0 1px var(--line,#e6d6b8),inset 0 -8px 14px rgba(50,32,10,.06);position:relative}
.c3-plate.coin{box-shadow:inset 0 0 0 2px var(--brass,#e0b25a),inset 0 -8px 14px rgba(50,32,10,.06)}
.c3-plate.gem{box-shadow:inset 0 0 0 2px var(--rar-epic,#9a6ae0),inset 0 -8px 14px rgba(50,32,10,.06)}
.c3-owned{position:absolute;right:-4px;top:-4px;font-size:9px;font-weight:800;border-radius:var(--r-full,999px);
 padding:1px 5px;background:var(--meadow-2,#3f8f4c);color:#fff;box-shadow:0 0 0 2px var(--paper-raised,#fff)}
.c3-pieceMain{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.c3-pieceName{font-family:var(--display,inherit);font-size:13px;font-weight:600;color:var(--ink,#3b2a1e);
 line-height:1.15;overflow-wrap:break-word;word-break:normal;hyphens:auto}
.c3-pill{display:inline-flex;align-items:center;gap:3px;border-radius:var(--r-full,999px);padding:2px 8px;
 font-size:10.5px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.4}
.c3-pill.coin{background:var(--brass-3,#fff0c2);color:#7a5a13;box-shadow:inset 0 0 0 1px #e8cf8a}
.c3-pill.gem{background:#f3ecfd;color:#5f3aa0;box-shadow:inset 0 0 0 1px #d9c9f5}
.c3-pill.pts{background:var(--meadow-3,#eaf5dc);color:var(--meadow-2,#3f8f4c);box-shadow:inset 0 0 0 1px #bfe0a4}
.c3-pill.set{background:var(--paper-2,#f6ecd9);color:var(--ink-2,#6b5a49);box-shadow:inset 0 0 0 1px var(--line,#e6d6b8)}
.c3-pill.short{background:var(--bad-bg,#fdeceb);color:var(--bad,#a33b37);box-shadow:inset 0 0 0 1px #efc0bd}
.evrow.c3-piece>.c3-act{grid-column:1/-1;grid-row:2;display:flex;gap:var(--sp-1,4px)}
.evrow.c3-piece>.c3-act>button{flex:1 1 auto;min-height:38px;margin:0;padding:6px 10px}
.evrow.c3-set{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px var(--sp-2,8px);align-items:center;
 padding:6px var(--sp-2,8px);min-height:0;border-radius:var(--r-xs,8px)}
.evrow.c3-set:hover{transform:none}
.evrow.c3-set>*{grid-column:1;min-width:0;white-space:normal;width:auto}
.c3-setBar{display:block;height:5px;border-radius:99px;background:var(--paper-3,#efe1c6);overflow:hidden}
.c3-setBar>i{display:block;height:100%;background:var(--meadow-2,#3f8f4c);border-radius:99px}
.c3-setN{grid-column:2!important;grid-row:1;justify-self:end;font-size:11px;font-weight:800;
 color:var(--ink-2,#6b5a49);font-variant-numeric:tabular-nums;white-space:nowrap}
#buildPanel .c3-foot{position:sticky;bottom:-2px;z-index:4;display:flex;flex-wrap:wrap;gap:var(--sp-2,8px);
 align-items:center;padding:var(--sp-2,8px) 0 4px;background:#fffdf7;border-top:1px solid var(--line,#e6d6b8)}
#buildPanel .c3-foot>button{min-height:var(--tap,44px)}

/* ================= the placement HUD =================
   left:50% with width:auto makes the shrink-to-fit box exactly 100% minus 50% wide, so the declared
   max-width:94vw was never once reached and a 101-character string wrapped to six lines on a
   phone.  width:max-content sizes to the content and the cap does the rest. */
#buildHud{width:max-content!important;max-width:min(720px,94vw)!important;text-align:left!important;
 padding:var(--sp-2,8px) var(--sp-3,12px)!important;display:none}
#buildHud.c3-on{display:flex!important;flex-direction:column;gap:6px}
.c3-hudRow{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:nowrap;min-width:0}
.c3-hudName{font-family:var(--display,inherit);font-size:var(--fs-md,13.5px);font-weight:600;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.c3-hudBtns{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:nowrap;flex:none;margin-left:auto}
#buildHud .c3-hudBtns button{margin:0!important;min-height:38px;white-space:nowrap}
.c3-hudState{display:flex;align-items:center;gap:6px;font-size:var(--fs-xs,11px);font-weight:800;
 border-radius:var(--r-full,999px);padding:3px 10px;flex:0 1 auto;min-width:0;
 background:var(--good-bg,#eaf5dc);color:var(--good,#3f8f4c)}
.c3-hudState.bad{background:var(--bad-bg,#fdeceb);color:var(--bad,#a33b37)}
.c3-hudState.snap{background:var(--brass-3,#fff0c2);color:#7a5a13}
.c3-hudState>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.c3-hudBudget{font-size:10.5px;font-weight:800;color:var(--ink-2,#6b5a49);font-variant-numeric:tabular-nums;
 white-space:nowrap;margin-left:auto}
#buildHud .c3-undo{margin:0!important;min-height:32px;padding:4px 9px;font-size:11px;white-space:nowrap}
.c3-hudKeys{font-size:10px;font-weight:700;color:var(--ink-3,#9a8770);white-space:nowrap}
@media (max-width:560px){
 .c3-hudRow{flex-wrap:wrap}
 .c3-hudBtns{margin-left:0;width:100%;justify-content:space-between}
 .c3-hudBudget{font-size:9.5px}
 .c3-hudState{font-size:10px;padding:3px 8px}
 #buildHud .c3-hudBtns button{flex:1 1 auto}
 .c3-hudKeys{display:none}
 .c3-idName{font-size:var(--fs-xl,18px)}
 .c3-idMotto{grid-column:1/-1}
}`;
   (document.head||document.documentElement).appendChild(st);
  }
 }catch(e){}

 /* ================= 1. helpers ================= */
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const txt=n=>((n&&n.textContent)||'').replace(/\s+/g,' ').trim();
 const num=n=>Number(n||0).toLocaleString('en-US');
 const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
 const fresh=()=>{try{return S.fresh&&S.fresh()||{};}catch(e){return {};}};
 const glyph1=v=>{try{return Array.from(String(v||'?').trim())[0]||'?';}catch(e){return '?';}};
 const hasCtl=n=>{try{return !!(n.querySelector&&n.querySelector('button,input,select,textarea,a'));}catch(e){return false;}};
 const online=()=>{try{return !!(G.net&&G.net.net&&G.net.net.client&&G.net.net.client.connected);}catch(e){return false;}};

 /* A face for a row: the breed painting when the game knows the mount, otherwise a plate
    carrying the rider's initial.  Never a bare emoji floating in a text run — a 40px plate in
    column one is what makes twenty rows scan as a list rather than a paragraph. */
 function face(name,breed,state){
  const d=el('span','c3-face'+(state==='on'?' on':state==='off'?' off':''));
  try{
   const b=breed&&BREEDS.find(x=>x&&x[0]===breed);
   if(breed&&K.thumb)d.innerHTML=K.thumb(breed,{size:40,rarity:b&&b[2],emoji:'🐴',alt:String(name||'')});
   else d.textContent=glyph1(name).toUpperCase();
  }catch(e){try{d.textContent=glyph1(name).toUpperCase();}catch(e2){}}
  return d;
 }
 function myBreed(){try{const h=G.horse&&G.horse.ridden&&G.horse.ridden();return (h&&h.breed)||'';}catch(e){return '';}}

 /* Long grey prose folds into a note.  Anything carrying a control is left alone: collapsing a
    paragraph that holds the only Connect button is how a screen loses its primary action. */
 function fold(node,title){
  try{
   if(!node||node.dataset&&node.dataset.c3)return false;
   if(hasCtl(node))return false;
   const t=txt(node); if(t.length<90)return false;
   const d=el('details','c3-note');
   d.dataset.c3='note';
   d.innerHTML='<summary>'+esc(title||'How this works')+'</summary><div class="c3-noteBody"></div>';
   const body=d.querySelector('.c3-noteBody');
   node.replaceWith(d); body.appendChild(node);
   if(node.style)node.style.margin='0';
   return true;
  }catch(e){return false;}
 }

 /* ================= 2. the generic row grid =================
    Takes whatever the renderer emitted — a leading emoji text node, <b>title</b>,
    <span>meta</span>, a handful of buttons — and lays it out again as the three-column grid.
    The buttons are moved; keep at most `keep` of them on the face of the row and fold the
    rest into a ⋯ popover, because seven relationship controls on one line is a toolbar, not
    a person. */
 function gridRow(row,o){
  o=o||{};
  try{
   if(!row||row.dataset.c3)return null;
   const kids=Array.from(row.childNodes);
   let lead='', title=null; const metas=[], acts=[], rest=[];
   for(const n of kids){
    if(n.nodeType===3){ const t=(n.nodeValue||'').trim(); if(t)lead+=t; continue; }
    if(n.nodeType!==1)continue;
    if(n.tagName==='BUTTON'||n.tagName==='SELECT'){acts.push(n);continue;}
    if(n.tagName==='B'&&!title){title=n;continue;}
    /* a <span> whose whole job is to hold buttons (the land tab does this) is an action cell */
    if(n.tagName==='SPAN'&&n.children.length&&Array.from(n.children).every(c=>c.tagName==='BUTTON')){
     Array.from(n.children).forEach(c=>acts.push(c)); n.remove(); continue;
    }
    if(n.classList&&n.classList.contains('cv')){
     Array.from(n.querySelectorAll('button')).forEach(c=>acts.push(c));
     const left=txt(n); if(left)metas.push(el('span',null,esc(left)));
     n.remove(); continue;
    }
    if(n.tagName==='SPAN'||n.tagName==='SMALL'){metas.push(n);continue;}
    rest.push(n);
   }
   if(!title&&!metas.length&&!acts.length)return null;

   const main=el('div','c3-main');
   const tEl=el('span','c3-title'); tEl.innerHTML=title?title.innerHTML:esc(lead||'—');
   main.appendChild(tEl);
   const metaWrap=el('span','c3-meta'+(o.clamp?' clamp':''));
   metas.forEach((m,i)=>{ if(i)metaWrap.appendChild(document.createTextNode(' · ')); metaWrap.appendChild(m);
    if(m.style){m.style.flex='none';m.style.fontSize='';m.style.color='';} });
   if(metas.length)main.appendChild(metaWrap);
   rest.forEach(n=>main.appendChild(n));

   const actWrap=el('div','c3-act');
   const keep=o.keep==null?2:o.keep;
   const head=acts.slice(0,keep), more=acts.slice(keep);
   head.forEach(b=>actWrap.appendChild(b));
   if(more.length){
    const d=el('details','c3-more');
    d.innerHTML='<summary title="More" aria-label="More actions">⋯</summary>';
    const body=el('div','c3-moreBody'); more.forEach(b=>body.appendChild(b));
    d.appendChild(body); actWrap.appendChild(d);
   }

   row.textContent='';
   row.classList.add('c3');
   row.dataset.c3=o.kind||'row';
   const f=o.face||(lead&&!o.noFace?(()=>{const s=el('span','c3-face');s.textContent=lead;return s;})():null);
   if(f)row.appendChild(f);
   row.appendChild(main);
   if(actWrap.childNodes.length)row.appendChild(actWrap);
   return {row,title:tEl,meta:metaWrap,act:actWrap,lead};
  }catch(e){try{row.dataset.c3='err';}catch(e2){}return null;}
 }

 /* ================= 3. the club ================= */
 const PANES=[
  {id:'club',  label:'🏛️ Clubhouse'},
  {id:'riders',label:'👥 Riders'},
  {id:'rides', label:'🥾 Rides'},
  {id:'exped', label:'🗺️ Trips'},
  {id:'chat',  label:'💬 Chat'},
 ];
 /* Selectors verified present in the DOM openOnline and the five onlineSection contributors
    produce.  A selector that stops matching costs its group its tab, not its existence — an
    unclaimed node falls through to the Clubhouse. */
 const CLAIM=[
  ['chat',  ['.clubChatLog','[data-fx="sp:openchat"]','[data-fx="sp:unblockall"]']],
  ['exped', ['[data-fx^="sp:exped:"]']],
  ['rides', ['[data-tr]','#spRideName','[data-fx^="sp:pin"]','[data-fx="sp:namesave"]','[data-fx="sp:startnamed"]',
             '[data-fx="sp:joinoffer"]','[data-fx="ranch:party"]','[data-fxin^="ranch:p"]',
             '[data-fx^="epvp:"]']],
  ['riders',['.clubRow','[data-fx^="sp:commons"]','[data-fx^="sp:acc:"]','[data-fx^="sp:dec:"]','[data-fx^="sp:req:"]',
             '[data-fx^="sp:unfriend:"]','[data-fx^="sp:gift:"]','[data-fx^="sp:goto:"]','[data-fx^="sp:watch:"]',
             '[data-fx^="sp:tour:"]','[data-fx^="sp:sync:"]','[data-fx^="sp:block:"]','[data-fx^="sp:report:"]',
             '[data-fx^="sp:ban:"]','[data-fx="sp:showranch"]','[data-friend]','[data-prof]','[data-fx^="clubs:prof:"]',
             '[data-fx^="clubs:mute:"]']],
  ['club',  ['#pname','#pclub','#pnameSave','#netGo','#netOff','#netInvite','#pidOnline','#clubNameIn','#clubMottoIn',
             '#noticeIn','.noticeCard','[data-fx^="clubs:"]','[data-fx="open:lbPanel"]','[data-fx^="acct:"]']],
 ];
 /* One line the flat run genuinely cannot place: it is prose, it sits under someone else's
    heading, and it describes the controls below it rather than the ones above. */
 const RESCUE=[[/public part(y|ies)|private parties/i,'rides','[data-fx="ranch:party"]']];
 const HEADS=[
  [/chat log|safety|moderation/i,'chat'],
  [/expedition/i,'exped'],
  [/trail ride|ride planner|ranch party|race the riders/i,'rides'],
  [/riders here|roster|friends|commons|showcase/i,'riders'],
  [/^\s*🏛️|notice board|club|this week/i,'club'],
 ];
 function claimOf(n){
  try{
   if(n.nodeType!==1)return null;
   for(const [pane,sels] of CLAIM){
    for(const sel of sels){ if((n.matches&&n.matches(sel))||(n.querySelector&&n.querySelector(sel)))return pane; }
   }
   if(n.tagName==='B'){ const t=txt(n); for(const [re,pane] of HEADS)if(re.test(t))return pane; }
  }catch(e){}
  return null;
 }
 const isHead=n=>{try{return n.nodeType===1&&n.tagName==='B';}catch(e){return false;}};

 let clubPane='club';

 /* ui-kit promotes the header and wraps the rest in a scrollable body.  If it has not run yet
    — or is not installed at all — do the same thing here rather than give up on the screen. */
 function bodyOf(p){
  try{
   let bd=p.querySelector(':scope > .mk-panel-body'); if(bd)return bd;
   const kids=Array.from(p.childNodes);
   const head=p.querySelector(':scope > .ph')||(p.firstElementChild&&p.firstElementChild.tagName==='B'?p.firstElementChild:null);
   if(!head)return null;
   head.classList.add('mk-panel-head');
   bd=el('div','mk-panel-body');
   let n=head.nextSibling;
   while(n){const next=n.nextSibling; if(!(n.nodeType===1&&n.classList.contains('mk-x')))bd.appendChild(n); n=next;}
   if(!bd.childNodes.length)return null;
   p.appendChild(bd); return bd;
  }catch(e){return null;}
 }

 function doClub(){
  const p=$('onlinePanel'); if(!p||p.style.display!=='flex')return;
  const bd=bodyOf(p); if(!bd||bd.dataset.c3)return;
  bd.dataset.c3='1';
  const s=fresh();

  /* --- route every top-level node to a pane ------------------------------------------ */
  const nodes=Array.from(bd.childNodes).filter(n=>n.nodeType===1||(n.nodeType===3&&(n.nodeValue||'').trim()));
  const owner=new Array(nodes.length).fill(null);
  nodes.forEach((n,i)=>{owner[i]=claimOf(n);});
  /* snapshot: the fill below writes into owner as it goes, and a node that inherited a pane
     must not then look like a node that claimed one — that is how a roster caption ended up
     two tabs away from the roster */
  const matched=owner.slice();
  /* An unmatched node belongs to the block above it: a caption follows its list, and a
     heading owns everything under it until the next heading.  Guessing forward instead —
     "this paragraph must introduce what comes next" — read well in one place and sent a
     roster's empty-state line and a ride planner's footnote two tabs away in three others,
     so the one genuine lead-in is rescued by name below rather than by heuristic. */
  for(let i=0;i<nodes.length;i++){
   if(owner[i])continue;
   let prev=null; for(let j=i-1;j>=0;j--)if(matched[j]){prev=matched[j];break;}
   let next=null; for(let j=i+1;j<nodes.length;j++)if(matched[j]){next=matched[j];break;}
   owner[i]=prev||next||'club';
  }

  const paneEl={};
  PANES.forEach(d=>{const e=el('div','c3-pane');e.dataset.pane=d.id;e.setAttribute('role','tabpanel');paneEl[d.id]=e;});
  nodes.forEach((n,i)=>{try{paneEl[owner[i]||'club'].appendChild(n);}catch(e){}});

  /* --- tab strip ---------------------------------------------------------------------- */
  const tabs=el('div','c3-tabs');
  const strip=el('div','crow'); strip.style.gap='4px';
  PANES.forEach(d=>{
   const b=el('button','tabbtn'+(clubPane===d.id?' on':''));
   b.type='button'; b.textContent=d.label; b.dataset.c3tab=d.id;
   b.setAttribute('role','tab');
   b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();setPane(d.id);});
   strip.appendChild(b);
  });
  tabs.appendChild(strip);
  bd.appendChild(tabs);
  const tabSync=scrollShell(strip,'c3-tabShell');
  PANES.forEach(d=>bd.appendChild(paneEl[d.id]));

  function setPane(pid){
   clubPane=pid;
   try{
    bd.querySelectorAll('[data-c3tab]').forEach(b=>b.classList.toggle('on',b.dataset.c3tab===pid));
    bd.querySelectorAll('.c3-pane').forEach(e=>{e.hidden=e.dataset.pane!==pid;});
    bd.scrollTop=0;
    const on=bd.querySelector('[data-c3tab].on');
    if(on)strip.scrollLeft=Math.max(0,on.offsetLeft-24);
    tabSync();
   }catch(e){}
  }
  setPane(paneEl[clubPane]?clubPane:'club');

  /* ranch.js opens its party planner with a status line and only then the controls, so
     backward fill leaves that one line in the Clubhouse. Move it to the block it describes. */
  try{
   for(const [re,to,near] of RESCUE){
    for(const pane of Object.keys(paneEl)){
     if(pane===to)continue;
     Array.from(paneEl[pane].children).forEach(n=>{
      if(hasCtl(n)||!re.test(txt(n)))return;
      const host=paneEl[to], anchor=near?host.querySelector(near):null;
      const at=anchor?(anchor.closest&&anchor.closest('.crow'))||anchor:null;
      if(at&&at.parentNode===host)host.insertBefore(n,at); else host.appendChild(n);
     });
    }
   }
  }catch(e){}

  /* --- per-pane work ------------------------------------------------------------------ */
  try{clubhouse(paneEl.club,s);}catch(e){}
  try{riders(paneEl.riders,s);}catch(e){}
  try{rides(paneEl.rides,s);}catch(e){}
  try{rides(paneEl.exped,s);}catch(e){}
  try{chatPane(paneEl.chat,s);}catch(e){}
  try{PANES.forEach(d=>sections(paneEl[d.id]));}catch(e){}
  /* moving the three connect buttons into the footer leaves their .crow behind as an empty
     30px band; the same happens to any strip a merge has emptied */
  try{
   PANES.forEach(d=>{
    const pane=paneEl[d.id]; if(!pane)return;
    Array.from(pane.children).forEach(n=>{
     if(n.dataset&&n.dataset.c3)return;
     if(n.children.length||txt(n))return;
     if(n.tagName==='INPUT'||n.tagName==='TEXTAREA'||n.tagName==='SELECT')return;
     n.remove();
    });
   });
  }catch(e){}
 }

 /* Move whole heading-groups into a deliberate order.  The renderers emit them in install
    order, which is an accident of the FEATURES array, not a reading order: the Riders tab
    opened on a one-name roster and buried "who is here right now" under it. */
 function order(pane,pats){
  try{
   if(!pane)return;
   const kids=Array.from(pane.children);
   const first=kids.findIndex(n=>n.tagName==='B');
   if(first<0)return;
   const groups=[]; let cur=null;
   for(let i=first;i<kids.length;i++){
    const n=kids[i];
    if(n.tagName==='B'){cur={head:n,nodes:[n]};groups.push(cur);}
    else if(cur)cur.nodes.push(n);
   }
   if(groups.length<2)return;
   const rank=g=>{const t=txt(g.head);for(let k=0;k<pats.length;k++)if(pats[k].test(t))return k;return pats.length;};
   const sorted=groups.map((g,ix)=>({g,ix,r:rank(g)})).sort((a,b)=>(a.r-b.r)||(a.ix-b.ix));
   const foot=pane.querySelector(':scope > .c3-foot');
   sorted.forEach(o=>o.g.nodes.forEach(n=>{if(foot)pane.insertBefore(n,foot);else pane.appendChild(n);}));
  }catch(e){}
 }

 /* Every remaining <b> that was a pseudo-heading becomes a real section header with its count
    lifted out of the label and into a chip. */
 function sections(pane){
  if(!pane)return;
  pane.querySelectorAll(':scope > b').forEach(b=>{
   try{
    if(b.dataset.c3)return;
    b.dataset.c3='sec';
    const t=txt(b);
    const m=/^(.*?)\s*\(([^)]+)\)\s*$/.exec(t);
    b.classList.add('c3-sec');
    b.textContent='';
    b.appendChild(document.createTextNode(m?m[1]:t));
    if(m)b.appendChild(el('span','c3-secN',esc(m[2])));
    b.style.fontSize=''; b.style.marginTop='';
   }catch(e){}
  });
 }

 /* ---- Clubhouse: who you are, where you are, and what the week is worth ---- */
 function clubhouse(pane,s){
  if(!pane)return;
  const meta=s.clubMeta||{}, code=String(s.club||'');
  const name=meta.name||code||'Your club';

  /* identity card, first thing on the first sheet */
  const card=el('div','c3-id'); card.dataset.c3='id';
  card.innerHTML='<span class="c3-crest" aria-hidden="true">'+esc(glyph1(name).toUpperCase())+'</span>'
   +'<span class="c3-idName">'+esc(name)+'</span>'
   +(meta.motto?'<span class="c3-idMotto">“'+esc(meta.motto)+'”</span>':'<span class="c3-idMotto" style="opacity:.6">No motto yet — give the gate sign a line.</span>')
   +'<span class="c3-idFoot">'+(meta.founder?'<span>Founded by '+esc(meta.founder)+'</span>':'<span>Unclaimed — name it and it is yours</span>')
     +(meta.created?'<span>· '+esc(new Date(meta.created).toLocaleDateString())+'</span>':'')
     +'<span>· '+(meta.pub?'🌍 Listed':'🔒 Private')+'</span></span>';
  const editWrap=el('span','c3-idEdit');
  const editBtn=el('button',null,'✏️ Edit'); editBtn.type='button'; editBtn.title='Rider name, club code, club name and motto';
  editWrap.appendChild(editBtn); card.appendChild(editWrap);
  pane.insertBefore(card,pane.firstChild);

  /* the four identity inputs live behind that one button, together, instead of 974px apart */
  const edit=el('div','c3-edit'); edit.dataset.c3='edit'; edit.hidden=true;
  ['#pname','#pclub','#clubNameIn','#clubMottoIn'].forEach(sel=>{
   try{const inp=pane.querySelector(sel)||document.querySelector('#onlinePanel '+sel);
    const row=inp&&inp.closest('.crow'); if(row&&row.parentNode)edit.appendChild(row);}catch(e){}
  });
  card.after(edit);
  editBtn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();
   edit.hidden=!edit.hidden; editBtn.textContent=edit.hidden?'✏️ Edit':'✔️ Done';
   if(!edit.hidden){const f=edit.querySelector('input');if(f)try{f.focus();}catch(e){}}
  });

  /* connection: one status pill, the code as a masked chip, the three controls as a footer */
  const conn=el('div','c3-conn'); conn.dataset.c3='conn';
  const dot=el('span','c3-dot'+(online()?' on':''),online()?'online in '+esc(code||'your club'):'offline');
  conn.appendChild(dot);
  if(code){
   const chip=el('span','c3-code');
   const val=el('span','c3-codeV'); val.textContent='•'.repeat(Math.min(12,Math.max(6,code.length)));
   const eye=el('button',null,'👁'); eye.type='button'; eye.title='Show the club code';
   const cp=el('button',null,'📋'); cp.type='button'; cp.title='Copy the club code';
   let shown=false;
   eye.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();shown=!shown;
    val.textContent=shown?code:'•'.repeat(Math.min(12,Math.max(6,code.length)));eye.textContent=shown?'🙈':'👁';});
   cp.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();
    try{ if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(code).then(()=>G.toast&&G.toast('📋 Club code copied.'),()=>{});
     else G.toast&&G.toast('Club code: '+code); }catch(e){}});
   chip.appendChild(val); chip.appendChild(eye); chip.appendChild(cp);
   conn.appendChild(chip);
  }
  edit.after(conn);

  /* the week card: three tiles in tabular figures instead of three identical grey pills */
  try{
   pane.querySelectorAll('.passCard').forEach(pc=>{
    const row=pc.querySelector('.crow'); if(!row)return;
    const chips=Array.from(row.querySelectorAll('.bE')); if(!chips.length)return;
    const grid=el('div','c3-stats');
    chips.forEach(c=>{
     const t=txt(c), m=/^([^\d]*[\d,]+)\s*(.*)$/.exec(t);
     const tile=el('div','c3-stat');
     tile.innerHTML='<span class="c3-statV">'+esc(m?m[1]:t)+'</span>'
      +'<span class="c3-statK">'+esc(m&&m[2]?m[2]:'this week')+'</span>';
     grid.appendChild(tile);
    });
    row.replaceWith(grid);
   });
  }catch(e){}

  /* clubs-boards prints the club name as a heading and the founder as a sentence; the card
     above now carries both, and a screen that says a thing twice says neither */
  try{
   Array.from(pane.children).forEach(n=>{
    if(n.tagName==='B'&&/^\s*🏛️/.test(txt(n)))n.remove();
    else if(meta.founder&&n.tagName==='SPAN'&&/^Founded by /.test(txt(n))){
     const rest=txt(n).replace(/^Founded by [^.]*\.\s*/,'');
     if(rest)n.textContent=rest; else n.remove();
    }
   });
  }catch(e){}
  /* the caption for the name field belongs with the name field */
  try{
   Array.from(pane.children).forEach(n=>{
    if(n.tagName==='SPAN'&&/what other riders see/i.test(txt(n)))edit.appendChild(n);
   });
  }catch(e){}

  /* what the club is worth this week is the second thing you want to know, after who it is */
  try{
   const wk=Array.from(pane.querySelectorAll('.passCard')).find(c=>/club week/i.test(txt(c)));
   if(wk)conn.after(wk);
  }catch(e){}

  /* the 45px club-code warning and the founding blurb are rules, not headlines */
  Array.from(pane.children).forEach(n=>{
   if(n.dataset&&n.dataset.c3)return;
   if(n.tagName==='SPAN'||n.tagName==='DIV'){
    const t=txt(n);
    if(/password|anyone who has it/i.test(t))fold(n,'🔑 Who can join?');
    else if(/export or import|Prestige/i.test(t))fold(n,'ℹ️ About this ranch');
    else fold(n,'How this works');
   }
  });

  /* the player id and the build number are reference, not news: they go last */
  try{
   const pid=pane.querySelector('#pidOnline');
   const row=pid&&pid.closest('.crow');
   if(row){const after=row.nextElementSibling;pane.appendChild(row);
    if(after&&(after.tagName==='SPAN'||after.classList.contains('c3-note')))pane.appendChild(after);}
  }catch(e){}

  /* the primary action, once, at the bottom, where a footer belongs */
  const foot=el('div','c3-foot'); foot.dataset.c3='foot';
  ['netGo','netInvite','netOff'].forEach(idn=>{try{const b=document.getElementById(idn);if(b)foot.appendChild(b);}catch(e){}});
  if(foot.childNodes.length){
   try{const go=foot.querySelector('#netGo'); if(go&&!go.classList.contains('claimBtn'))go.classList.add('claimBtn');}catch(e){}
   pane.appendChild(foot);
  }
 }

 /* ---- Riders: one list, one row shape, with faces ---- */
 function riders(pane,s){
  if(!pane)return;
  const fr=s.friends||{};

  /* The inline renderer and social-play both draw "Riders here now".  Merge them: every
     control from the earlier list moves onto the matching row of the later one, and the
     earlier heading goes.  With nobody online both are a note, and only one survives. */
  try{
   const heads=Array.from(pane.querySelectorAll(':scope > b')).filter(b=>/riders here now/i.test(txt(b)));
   if(heads.length>1){
    const last=heads[heads.length-1];
    const rowsOf=h=>{const out=[];let n=h.nextElementSibling;while(n&&n.tagName!=='B'){out.push(n);n=n.nextElementSibling;}return out;};
    const keepRows=rowsOf(last);
    const byName=new Map();
    keepRows.forEach(r=>{const b=r.querySelector('b');if(b)byName.set(txt(b).toLowerCase(),r);});
    heads.slice(0,-1).forEach(h=>{
     rowsOf(h).forEach(r=>{
      const b=r.querySelector('b');
      const hit=b&&byName.get(txt(b).toLowerCase());
      if(hit){Array.from(r.querySelectorAll('button')).forEach(btn=>hit.appendChild(btn));r.remove();}
      else if(!hasCtl(r))r.remove();                      // a duplicate "nobody yet" note
      else last.after(r);
     });
     h.remove();
    });
   }
  }catch(e){}

  /* The pill strip of roster names and the .clubRow roster are the same people twice. */
  try{
   const pills=Array.from(pane.querySelectorAll('.crow [data-prof]'));
   if(pills.length&&pane.querySelector('.clubRow')){
    const rows=Array.from(pane.querySelectorAll('.clubRow'));
    const byName=new Map(); rows.forEach(r=>{const b=r.querySelector('b');if(b)byName.set(txt(b).toLowerCase(),r);});
    pills.forEach(btn=>{
     const nm=(btn.dataset.prof||'').replace(/^💚\s*/,'').trim().toLowerCase();
     const hit=byName.get(nm)||byName.get(txt(btn).replace(/^💚\s*/,'').toLowerCase());
     if(hit){btn.textContent='👤';hit.appendChild(btn);}
    });
    Array.from(pane.querySelectorAll('.crow')).forEach(c=>{if(!hasCtl(c)&&!txt(c))c.remove();});
    Array.from(pane.children).forEach(n=>{
     if(n.tagName==='SPAN'&&/club roster — tap a name/i.test(txt(n)))n.remove();
    });
   }
  }catch(e){}

  /* every rider row, in one shape, with a face */
  const mount=new Map();
  try{ const R=(G.net&&G.net.remotes)||{};
   Object.keys(R).forEach(k=>{const r=R[k];if(r&&r.name)mount.set(String(r.name).toLowerCase(),r);});
  }catch(e){}
  let me=''; try{me=(G.net&&G.net.myName&&G.net.myName())||s.playerName||'';}catch(e){me=s.playerName||'';}

  pane.querySelectorAll('.evrow,.clubRow').forEach(row=>{
   try{
    if(row.dataset.c3)return;
    const b=row.querySelector(':scope > b');
    const nm=b?txt(b):'';
    const low=nm.toLowerCase();
    const isMe=row.classList.contains('me')||(!!me&&low===me.toLowerCase());
    const r=mount.get(low);
    const breed=isMe?myBreed():(r&&r.breed)||'';
    const state=isMe||r?'on':(fr[nm]?'off':null);
    gridRow(row,{kind:'rider',keep:2,face:face(nm||'?',breed,state)});
   }catch(e){try{row.dataset.c3='err';}catch(e2){}}
  });

  order(pane,[/riders here now/i,/friends/i,/roster/i,/commons/i,/showcase/i]);

  /* the Commons: a consequence stated as a fact, not a paragraph above the switch */
  Array.from(pane.children).forEach(n=>{
   if(n.dataset&&n.dataset.c3)return;
   if(n.tagName==='SPAN'&&txt(n).length>=90)fold(n,'🌍 What the Commons is');
  });
 }

 /* ---- Rides: one planner, and expeditions as cards ---- */
 function rides(pane,s){
  if(!pane)return;

  /* Two trail UIs, 1,960px apart, both building the same draft.  The stop rail and the draft
     line move under the Ride planner heading and the older heading goes. */
  try{
   const heads=Array.from(pane.querySelectorAll(':scope > b'));
   const planner=heads.find(b=>/ride planner/i.test(txt(b)));
   const trail=heads.find(b=>/trail rides/i.test(txt(b)));
   if(planner&&trail&&planner!==trail){
    const move=[]; let n=trail.nextElementSibling;
    while(n&&n.tagName!=='B'){const next=n.nextElementSibling;move.push(n);n=next;}
    let at=planner;
    move.forEach(x=>{at.after(x);at=x;});
    trail.remove();
   }
  }catch(e){}

  /* the nine stop buttons are a chip rail, not two wrapped rows of tiny buttons */
  try{
   const rail=Array.from(pane.querySelectorAll('.crow')).find(c=>c.querySelector('[data-tr^="add:"]'));
   if(rail&&!rail.dataset.c3){
    rail.dataset.c3='rail';
    rail.style.flexWrap='nowrap'; rail.style.overflowX='auto'; rail.style.gap='4px';
    rail.querySelectorAll('[data-tr^="add:"]').forEach(b=>{b.classList.add('tabbtn');b.style.flex='none';b.style.fontSize='12px';});
   }
  }catch(e){}

  order(pane,[/ride planner/i,/ranch party/i]);

  /* expeditions and the friendly-race card become cards of one shape */
  pane.querySelectorAll('.evrow').forEach(row=>{
   try{
    if(row.dataset.c3)return;
    const wide=row.querySelector(':scope > b[style*="width:100%"]');
    if(wide){                                              // the 165px row pretending to be a card
     row.dataset.c3='card';
     row.style.display='block'; row.style.minHeight='0';
     wide.classList.add('c3-sec'); wide.style.width='auto'; wide.dataset.c3='sec';
     Array.from(row.querySelectorAll(':scope > span')).forEach(sp=>{
      if(sp.querySelector('button')){sp.style.display='flex';sp.style.flexWrap='wrap';sp.style.gap='6px';sp.style.marginTop='6px';return;}
      fold(sp,'How this works');
     });
     return;
    }
    const g=gridRow(row,{kind:'ride',keep:1,clamp:true});
    if(!g)return;
    /* STOPS 4 · REGIONS 3 · PAYS … as labelled facts, and the blurb behind a note */
    const t=txt(g.meta);
    const m=/^(.*?)·\s*(\d+)\s*stops\s*·\s*(\d+)\s*regions\s*·\s*(.*)$/i.exec(t);
    if(m){
     const done=/·\s*done\s*(\d+)×/i.exec(m[4]);
     const pay=m[4].replace(/·\s*done\s*\d+×/i,'').trim();
     const specs=el('div','c3-chipRow');
     specs.innerHTML='<span class="mk-chip c3-pill set">📍 '+esc(m[2])+' stops</span>'
      +'<span class="mk-chip c3-pill set">🗺️ '+esc(m[3])+' regions</span>'
      +'<span class="mk-chip c3-pill coin">'+esc(pay)+'</span>'
      +(done?'<span class="mk-chip c3-pill pts">✓ '+esc(done[1])+'×</span>':'');
     g.meta.textContent=''; g.meta.classList.remove('clamp');
     const blurb=m[1].trim();
     if(blurb.length>=90){const d=el('details','c3-note');
      d.innerHTML='<summary>'+esc(blurb.slice(0,44).trim())+'…</summary><div class="c3-noteBody">'+esc(blurb)+'</div>';
      g.meta.appendChild(d);}
     else g.meta.appendChild(document.createTextNode(blurb));
     g.meta.appendChild(specs);
    }
   }catch(e){try{row.dataset.c3='err';}catch(e2){}}
  });

  Array.from(pane.children).forEach(n=>{
   if(n.dataset&&n.dataset.c3)return;
   if(n.tagName!=='SPAN'&&n.tagName!=='DIV')return;
   const t=txt(n); if(t.length<90)return;
   fold(n,/part(y|ies)/i.test(t)?'🎉 How a party works':/pin|stops|draft/i.test(t)?'🧭 How a ride is built':'How rides work');
  });
 }

 /* ---- Chat & safety: the two things you can actually do, above the rules ---- */
 function chatPane(pane,s){
  if(!pane)return;
  try{
   const blocked=Object.keys(s.blocked||{});
   Array.from(pane.querySelectorAll('.crow')).forEach(c=>{
    const sp=c.querySelector(':scope > span:last-child'); if(!sp)return;
    const t=txt(sp); if(!/^Blocked:/i.test(t))return;
    if(!blocked.length)return;
    const wrap=el('span','c3-chipRow');
    wrap.appendChild(el('span','c3-k','Blocked'));
    blocked.forEach(n=>wrap.appendChild(el('span','mk-chip','🚫 '+esc(n))));
    sp.replaceWith(wrap);
   });
  }catch(e){}
  Array.from(pane.children).forEach(n=>{
   if(n.dataset&&n.dataset.c3)return;
   if(n.tagName==='SPAN'||n.tagName==='DIV'){
    const t=txt(n);
    if(/moderators|word filter|honour-system/i.test(t))fold(n,'🛡️ Safety rules');
    else if(t.length>=90)fold(n,'How this works');
   }
  });
 }

 /* ================= 4. build ================= */
 const CAT_ORDER=['yard','garden','stable','indoor','build','seasonal','sets'];
 function priceOf(c){return c&&c.gems?{v:c.gems,cur:'gem',lbl:c.gems+'💎'}:{v:(c&&c.price)||0,cur:'coin',lbl:((c&&c.price)||0)+'🪙'};}
 function ptsOf(c){try{return (G.ranchSys&&G.ranchSys.decorPts)?G.ranchSys.decorPts(c):(c&&c.pts)||0;}catch(e){return (c&&c.pts)||0;}}

 function doBuild(){
  const p=$('buildPanel'); if(!p||p.style.display!=='flex')return;
  const bd=bodyOf(p); if(!bd||bd.dataset.c3)return;
  bd.dataset.c3='1';
  const s=fresh(), R=G.ranchSys||{};

  /* the header carries a title and nothing else — the chip is a fact, and facts belong in the
     body where there is room for their units */
  try{const hd=p.querySelector('.mk-panel-head')||p.querySelector('.ph');
   const chip=hd&&hd.querySelector('.chip'); if(chip)chip.remove();}catch(e){}   // the card below says all of it, with units

  try{levelCard(bd,s);}catch(e){}
  try{shelfStrip(bd);}catch(e){}
  try{catalogue(bd,s);}catch(e){}
  try{buildFooter(bd);}catch(e){}

  /* whatever is left — the Land and Ranches tabs, the sets header, stray notes — gets the
     same row grid and the same folding as everywhere else */
  bd.querySelectorAll('.evrow').forEach(row=>{try{ if(!row.dataset.c3)gridRow(row,{kind:'blk',keep:3});}catch(e){}});
  Array.from(bd.children).forEach(n=>{
   if(n.dataset&&n.dataset.c3)return;
   if((n.tagName==='SPAN'||n.tagName==='DIV')&&!hasCtl(n)&&txt(n).length>=90)fold(n,'How building works');
  });
 }

 /* Level, the bar with its cap, the star rules as a checklist, and — when both multipliers are
    still zero — what the next level actually buys, rather than two meaningless +0%. */
 function levelCard(bd,s){
  const R=G.ranchSys||{};
  let pts=0,L=1,next=null;
  try{pts=R.ranchPts?R.ranchPts(s):0;}catch(e){}
  try{L=R.ranchLevel?R.ranchLevel(s):1;}catch(e){}
  try{const LV=T.RANCH_LEVELS||[];next=LV[L]||null;}catch(e){}
  const meterRow=Array.from(bd.children).find(n=>n.querySelector&&n.querySelector('.cbar'));
  const starDiv=Array.from(bd.children).find(n=>n.querySelector&&n.querySelector('b')&&/star ranch/i.test(txt(n)));
  const checks=starDiv&&starDiv.querySelector('div');
  if(!meterRow&&!starDiv)return;

  const card=el('div','c3-lvl'); card.dataset.c3='lvl';
  /* the renderer draws five ⭐ and greys the unearned ones, so counting glyphs says five
     every time — the sentence beside them carries the real number */
  const sm=/(\d+)\s*-\s*star/i.exec(txt(starDiv||{}));
  const filled=Math.max(1,Math.min(5,sm?+sm[1]:1));
  const top=el('div','c3-lvlTop');
  top.innerHTML='<span class="c3-lvlBadge">🧱 Lv '+L+'</span>'
   +'<span class="c3-stars" role="img" aria-label="'+filled+' of 5 stars"><b>'+'★'.repeat(filled)+'</b><i>'+'☆'.repeat(5-filled)+'</i></span>'
   +'<span class="c3-lvlNext">'+(next?num(Math.max(0,next-pts))+' pts to go':'max level')+'</span>';
  card.appendChild(top);
  (meterRow||{}).dataset&&(meterRow.dataset.c3='meter');
  if(meterRow)card.appendChild(meterRow);

  /* the two multipliers, as facts, or one forward-looking line when they are both nothing */
  let stall=0,board=0;
  try{stall=Math.round(((R.ranchMul?R.ranchMul('stall'):1)-1)*100);}catch(e){}
  try{board=Math.round(((R.ranchMul?R.ranchMul('board'):1)-1)*100);}catch(e){}
  const perks=T.RANCH_PERKS||{};
  const tiles=el('div','c3-stats');
  if(stall||board){
   tiles.innerHTML='<div class="c3-stat"><span class="c3-statV">+'+stall+'%</span><span class="c3-statK">Stall XP</span></div>'
    +'<div class="c3-stat"><span class="c3-statV">+'+board+'%</span><span class="c3-statK">Boarders pay</span></div>';
  }else{
   const nxt=perks[L+1]||'a perk for you and for the horses in the stalls';
   tiles.innerHTML='<div class="c3-stat" style="grid-column:1/-1"><span class="c3-statV" style="font-size:12.5px;white-space:normal">'+esc(String(nxt))+'</span>'
    +'<span class="c3-statK">Next perk · Lv '+(L+1)+(next?' · '+num(Math.max(0,next-pts))+' points away':'')+'</span></div>';
  }
  card.appendChild(tiles);

  if(checks){
   checks.dataset.c3='check'; checks.className='c3-check'; checks.removeAttribute('style');
   checks.querySelectorAll(':scope > span').forEach(sp=>{
    const t=txt(sp); const on=/^✅/.test(t);
    sp.className=on?'on':''; sp.removeAttribute('style');
   });
   card.appendChild(checks);
  }
  if(starDiv){
   /* the sentence the stars and the tiles now say better */
   starDiv.dataset.c3='stars'; starDiv.remove();
  }
  bd.insertBefore(card,bd.firstChild);
 }

 /* A strip that scrolls sideways hides whatever is past its right edge behind a 16px mask
    fade, which is not an affordance — two of the eight decor shelves were invisible at rest
    and the biggest of them was one of the two.  This gives any such strip arrows that appear
    only when there is something to reach, and scrolls the active item into view. */
 function scrollShell(strip,klass){
  try{
   const wrap=el('div','c3-shelf'+(klass?' '+klass:''));
   strip.replaceWith(wrap);
   const lf=el('button','c3-arrow','‹'), rt=el('button','c3-arrow','›');
   lf.type=rt.type='button'; lf.title='Back'; rt.title='More';
   wrap.appendChild(lf); wrap.appendChild(strip); wrap.appendChild(rt);
   const sync=()=>{try{
    const over=strip.scrollWidth>strip.clientWidth+2;
    lf.hidden=!over||strip.scrollLeft<=2;
    rt.hidden=!over||strip.scrollLeft>=strip.scrollWidth-strip.clientWidth-2;
   }catch(e){}};
   lf.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();strip.scrollLeft-=160;setTimeout(sync,220);});
   rt.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();strip.scrollLeft+=160;setTimeout(sync,220);});
   strip.addEventListener('scroll',sync,{passive:true});
   sync(); setTimeout(sync,80); setTimeout(sync,400);
   return sync;
  }catch(e){return function(){};}
 }

 /* Each decor shelf carries its count, so the strip reads as a catalogue index rather than a
    row of words, and the shelf you are on scrolls itself into view when the panel reopens. */
 function shelfStrip(bd){
  const strip=Array.from(bd.querySelectorAll('.crow')).find(c=>c.querySelector('[data-fx^="ranch:cat:"]'));
  if(!strip||strip.dataset.c3)return;
  strip.dataset.c3='shelf';
  const counts={};
  try{
   Object.keys(DC).forEach(k=>{const c=DC[k]||{};const cat=c.cat||'yard';counts[cat]=(counts[cat]||0)+1;});
   counts.all=Object.keys(DC).length;
  }catch(e){}
  strip.querySelectorAll('[data-fx^="ranch:cat:"]').forEach(b=>{
   try{
    const k=(b.dataset.fx||'').split(':')[2];
    const n=counts[k];
    if(n&&!b.querySelector('.c3-shelfN'))b.appendChild(el('span','c3-shelfN',String(n)));
   }catch(e){}
  });
  const sync=scrollShell(strip);
  try{
   const on=strip.querySelector('.tabbtn.on');
   if(on)strip.scrollLeft=Math.max(0,on.offsetLeft-24);     // reopening on Seasonal must not hide Seasonal
  }catch(e){}
  sync();
 }

 /* 44 identical rows become cards, and the All shelf — which is all of them at once — is
    grouped into collapsible shelves so the catalogue is browsable instead of endless. */
 function catalogue(bd,s){
  const rows=Array.from(bd.querySelectorAll('.evrow')).filter(r=>r.querySelector('[data-fx^="ranch:place:"]'));
  const setRows=Array.from(bd.querySelectorAll('.evrow')).filter(r=>!r.querySelector('button')&&/^\d+\/\d+\s*·/.test(txt(r.querySelector('span'))||''));
  if(!rows.length&&!setRows.length)return;
  const coins=Math.floor(s.coins||0), gems=s.gems||0;
  const owned={}; try{(s.decor||[]).forEach(d=>{owned[d.t]=(owned[d.t]||0)+1;});}catch(e){}
  const labels={}; try{bd.querySelectorAll('[data-fx^="ranch:cat:"]').forEach(b=>{labels[(b.dataset.fx||'').split(':')[2]]=txt(b).replace(/\s*\d+$/,'');});}catch(e){}

  const made=[];
  rows.forEach(row=>{
   try{
    if(row.dataset.c3)return;
    const btn=row.querySelector('[data-fx^="ranch:place:"]');
    const t=(btn.dataset.fx||'').split(':')[2];
    const c=DC[t]||{};
    const pr=priceOf(c), pts=ptsOf(c);
    /* the author's own words for the set and the season, lifted out of the grey tail text */
    let setLbl='',seasonLbl='';
    try{
     const sp=row.querySelector('span');
     txt(sp).split('·').map(x=>x.trim()).forEach(seg=>{
      if(!seg||/🪙|💎/.test(seg)||/pts$/.test(seg)||/^placed ×/.test(seg))return;
      if(/^(🌸|☀️|🍂|❄️)/.test(seg))seasonLbl=seg; else if(!setLbl)setLbl=seg;
     });
    }catch(e){}
    const have=pr.cur==='gem'?gems:coins, short=Math.max(0,pr.v-have), can=short<=0;
    const n=owned[t]||0;
    row.textContent='';
    row.className='evrow c3-piece'+(can?'':' cant');
    row.dataset.c3='piece'; row.dataset.c3cat=c.cat||'yard';
    const plate=el('div','c3-plate '+pr.cur, esc(c.emoji||'🪵'));
    if(n)plate.appendChild(el('span','c3-owned','×'+n));
    const main=el('div','c3-pieceMain');
    main.innerHTML='<span class="c3-pieceName">'+esc(c.label||t)+'</span>'
     +'<span class="c3-chipRow"><span class="mk-chip c3-pill '+pr.cur+'">'+esc(pr.lbl)+'</span>'
     +(pts?'<span class="mk-chip c3-pill pts">+'+pts+' pts</span>':'')
     +(can?'':'<span class="mk-chip c3-pill short">need '+num(short)+' more</span>')
     +(setLbl?'<span class="mk-chip c3-pill set">🧩 '+esc(setLbl)+'</span>':'')
     +(seasonLbl?'<span class="mk-chip c3-pill set">'+esc(seasonLbl)+'</span>':'')+'</span>';
    const act=el('div','c3-act'); btn.textContent=n?'Place another':'Place'; act.appendChild(btn);
    row.appendChild(plate); row.appendChild(main); row.appendChild(act);
    made.push(row);
   }catch(e){try{row.dataset.c3='err';}catch(e2){}}
  });

  /* sets: four glyphs, a counter and the bonus, not six more identical strips */
  setRows.forEach(row=>{
   try{
    if(row.dataset.c3)return;
    const b=row.querySelector('b'), sp=row.querySelector('span');
    const m=/^(\d+)\/(\d+)\s*·\s*(.*)$/.exec(txt(sp)||'');
    const at=m?+m[1]:0, of=m?+m[2]:4, done=at>=of;
    row.textContent='';
    row.className='evrow c3-set'+(done?' done':'');
    row.dataset.c3='set';
    row.innerHTML='<span class="c3-title">'+(b?b.innerHTML:'Set')+'</span>'
     +'<span class="c3-setN">'+(done?'✅ ':'')+at+' / '+of+'</span>'
     +'<span class="c3-setBar"><i style="width:'+Math.round(100*Math.min(1,at/Math.max(1,of)))+'%"></i></span>'
     +'<span class="c3-meta">'+esc(m?m[3]:txt(sp))+'</span>';
   }catch(e){try{row.dataset.c3='err';}catch(e2){}}
  });
  /* the line that announced them is the shelf label now */
  let setLabel='🧩 Sets';
  try{
   const lead=Array.from(bd.children).find(n=>n.nodeType===1&&!n.dataset.c3&&/^🧩\s*Sets/.test(txt(n)));
   if(lead){setLabel=txt(lead).split('—')[0].trim()||setLabel;lead.remove();}
  }catch(e){}
  const setGroup=()=>{
   if(setRows.length<2)return null;
   const d=el('details','c3-group'); d.dataset.c3='group';
   d.innerHTML='<summary>'+esc(setLabel)+'<span class="c3-secN">'+setRows.length+'</span></summary>';
   const wrap=el('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.gap='4px';
   setRows.forEach(r=>wrap.appendChild(r)); d.appendChild(wrap); return d;
  };

  if(!made.length){const g=setGroup();if(g&&setRows[0])bd.appendChild(g);return;}
  const host=made[0].parentNode; if(!host)return;
  const anchor=made[0];
  const cats=Array.from(new Set(made.map(r=>r.dataset.c3cat)));
  if(cats.length<=1){
   const grid=el('div','c3-grid'); grid.dataset.c3='grid';
   host.insertBefore(grid,anchor); made.forEach(r=>grid.appendChild(r));
   const g=setGroup(); if(g)host.appendChild(g);
   return;
  }
  const holder=el('div'); holder.dataset.c3='groups';
  holder.style.display='flex'; holder.style.flexDirection='column'; holder.style.gap='8px';
  host.insertBefore(holder,anchor);
  let first=true;
  CAT_ORDER.concat(cats.filter(c=>CAT_ORDER.indexOf(c)<0)).forEach(cat=>{
   const mine=made.filter(r=>r.dataset.c3cat===cat); if(!mine.length)return;
   const d=el('details','c3-group'); d.dataset.c3='group'; if(first){d.open=true;first=false;}
   d.innerHTML='<summary>'+esc(labels[cat]||cat)+'<span class="c3-secN">'+mine.length+'</span></summary>';
   const grid=el('div','c3-grid'); mine.forEach(r=>grid.appendChild(r));
   d.appendChild(grid); holder.appendChild(d);
  });
  const g=setGroup(); if(g)holder.appendChild(g);
 }

 /* Move and Remove stay reachable at the foot of the sheet instead of 3,000px down. */
 function buildFooter(bd){
  try{
   const foot=Array.from(bd.querySelectorAll('.crow')).find(c=>c.querySelector('[data-fx="ranch:remove"]'));
   if(!foot||foot.dataset.c3)return;
   foot.dataset.c3='foot'; foot.classList.add('c3-foot');
   bd.appendChild(foot);
  }catch(e){}
 }

 /* ================= 5. the placement HUD ================= */
 const session={n:0,pts:0,stack:[]};
 let hudTick=0;

 function hudState(){
  try{
   const h=$('buildHud'); if(!h||!h.dataset.c3)return;
   const st=h.querySelector('.c3-hudState'); if(!st)return;
   const R=G.ranchSys||{}, b=R.build;
   if(!b){st.className='c3-hudState';st.innerHTML='<span>Pick a piece</span>';return;}
   if(b.remove){st.className='c3-hudState bad';st.innerHTML='<span>🧹 Click a piece to take it back — half its price returns</span>';return;}
   if(b.move&&!b.type){st.className='c3-hudState';st.innerHTML='<span>✋ Click a piece to pick it up</span>';return;}
   if(!b.type||!b.lastPt){st.className='c3-hudState';st.innerHTML='<span>Move the pointer over the ground</span>';return;}
   let why=null;
   try{why=R.decorOk?R.decorOk(b.type,b.lastPt[0],b.lastPt[1],b.moving):null;}catch(e){why=null;}
   let snapped=false;
   try{ if(G.ranch&&G.ranch.snap){const q=G.ranch.snap(DC[b.type],b.lastPt[0],b.lastPt[1],b.rot,b.moving);snapped=!!q;} }catch(e){}
   if(why){st.className='c3-hudState bad';st.innerHTML='<span>🚫 '+esc(why)+'</span>';}
   else if(snapped){st.className='c3-hudState snap';st.innerHTML='<span>🧲 Snaps into line — click to set it down</span>';}
   else {st.className='c3-hudState';st.innerHTML='<span>✔️ Click the ground to place it</span>';}
  }catch(e){}
 }

 function hudBudget(){
  try{
   const h=$('buildHud'); if(!h||!h.dataset.c3)return;
   const bg=h.querySelector('.c3-hudBudget'); if(!bg)return;
   const s=fresh();
   bg.textContent=session.n+' placed · +'+session.pts+' pts · '+num(Math.floor(s.coins||0))+'🪙 left';
   const un=h.querySelector('.c3-undo'); if(un)un.hidden=!session.stack.length;
  }catch(e){}
 }

 function doHud(){
  try{
   const h=$('buildHud'); if(!h)return;
   const showing=h.style.display&&h.style.display!=='none';
   if(!showing){h.classList.remove('c3-on');h.dataset.c3='';return;}
   if(h.dataset.c3==='1')return;
   const btns=Array.from(h.querySelectorAll('[data-bh]'));
   if(!btns.length&&!h.textContent.trim())return;
   h.dataset.c3='1';

   const R=G.ranchSys||{}, b=R.build||{};
   const c=b.type?(DC[b.type]||{}):null;
   const pr=c?priceOf(c):null, pts=c?ptsOf(c):0;
   let toNext=null;
   try{const s=fresh(), LV=T.RANCH_LEVELS||[], L=R.ranchLevel?R.ranchLevel(s):1, nx=LV[L];
    if(nx)toNext=Math.max(0,nx-(R.ranchPts?R.ranchPts(s):0));}catch(e){}

   const verb=b.moving?'Moving':b.remove?'Removing':b.move?'Move mode':'Placing';
   const row1=el('div','c3-hudRow');
   row1.innerHTML='<span class="c3-hudName">'+esc((c&&c.emoji)||'🏗️')+' '+esc(c?c.label:verb)+'</span>'
    +(pr&&!b.moving&&!b.remove?'<span class="mk-chip c3-pill '+pr.cur+'">'+esc(pr.lbl)+'</span>':'')
    +(pts&&!b.moving&&!b.remove?'<span class="mk-chip c3-pill pts">+'+pts+' pts</span>':'')
    +(toNext!=null&&pts&&!b.moving?'<span class="c3-hudKeys">→ Lv up in '+num(toNext)+' pts</span>':'');
   const bw=el('div','c3-hudBtns');
   btns.forEach(bt=>{
    const k=bt.dataset.bh;
    if(k==='rot'){bt.textContent='↻ Turn';bt.title='Turn 45° (R / Q)';}
    else if(k==='rotf'){bt.textContent='↻° Fine';bt.title='Turn 22.5° (Shift + R / Q)';}
    else if(!bt.textContent.trim())bt.textContent='Done';
    bt.title=bt.title||'Esc';
    bw.appendChild(bt);
   });
   const undo=el('button','c3-undo','↩ Remove last'); undo.type='button'; undo.hidden=true;
   bw.insertBefore(undo,bw.firstChild);
   row1.appendChild(bw);

   const row2=el('div','c3-hudRow');
   const st=el('div','c3-hudState','<span>…</span>');
   const bg=el('div','c3-hudBudget','');
   undo.title='Takes the last piece you placed back, for half its price';
   undo.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();
    try{
     const id2=session.stack.pop(); if(!id2)return;
     const o=((G.ranchSys&&G.ranchSys.decorObjs)||[]).find(x=>x&&x.d&&x.d.id===id2);
     if(o&&G.ranchSys.removeDecor){G.ranchSys.removeDecor(o);session.n=Math.max(0,session.n-1);}
     hudBudget();
    }catch(e){}});
   row2.appendChild(st); row2.appendChild(bg);
   row2.appendChild(el('span','c3-hudKeys','R / Q turn · Shift fine · Esc done'));

   h.textContent='';
   h.classList.add('c3-on');
   h.appendChild(row1); h.appendChild(row2);
   hudState(); hudBudget();
  }catch(e){}
 }

 /* ================= 6. wiring ================= */
 let pending=0;
 function pass(){
  pending=0;
  try{doClub();}catch(e){}
  try{doBuild();}catch(e){}
  try{doHud();}catch(e){}
 }
 function soon(){ if(pending)return; try{pending=requestAnimationFrame(pass);}catch(e){pass();} }

 try{
  for(const name of ['openOnline','openBuild','open','toggle','rerender']){
   const fn=G.ui&&G.ui[name]; if(typeof fn!=='function'||fn.__ui2club)continue;
   const wrapped=function(...a){const r=fn.apply(this,a);soon();return r;};
   wrapped.__ui2club=true; G.ui[name]=wrapped;
  }
 }catch(e){}
 try{
  const obs=new MutationObserver(ms=>{for(const m of ms){if(m.addedNodes&&m.addedNodes.length){soon();return;}}});
  const watch=()=>{for(const idn of ['onlinePanel','buildPanel','buildHud']){
   const e=document.getElementById(idn); if(e)try{obs.observe(e,{childList:true,subtree:true});}catch(e2){}}};
  watch(); G.on&&G.on('boot',()=>{watch();soon();}); setTimeout(watch,4000);
 }catch(e){}

 /* The HUD's state line is the only thing on screen while you aim, so it follows the pointer:
    the game's own handler already writes build.lastPt every move, which is a cheaper and more
    honest source than a second listener on the canvas. */
 try{
  G.on&&G.on('tick',(dt)=>{
   hudTick+=dt||0; if(hudTick<0.1)return; hudTick=0;
   const h=$('buildHud'); if(!h||!h.classList.contains('c3-on'))return;
   hudState();
  });
 }catch(e){}
 try{
  G.on&&G.on('decorPlaced',(d,c)=>{try{session.n++;session.pts+=ptsOf(c);if(d&&d.id)session.stack.push(d.id);hudBudget();}catch(e){}});
  G.on&&G.on('decorRemoved',(d)=>{try{const i=session.stack.indexOf(d&&d.id);if(i>=0)session.stack.splice(i,1);hudBudget();}catch(e){}});
 }catch(e){}

 /* Build was the one panel with no hotkey, and on a phone its dock button is at the top of the
    screen — a round trip for every piece.  B is free in KEYMAP and the dispatcher already
    refuses to fire a panel hotkey while an input has focus. */
 try{ if(G.ui&&G.ui.hotkey)G.ui.hotkey('KeyB',()=>{try{G.ui.openBuild();}catch(e){}}); }catch(e){}

 soon();
}
