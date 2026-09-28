/* Feature package 'no-emoji' — nothing on the page is an emoji.

   The look this game is after has drawn icons and plain words, and none of the little pictures a
   phone keyboard offers. Our words were written with them throughout: about four thousand, in the
   panels, the toasts, the buttons, the dialogs, the tabs, the quest rows. They are dealt with here,
   on their way to the screen, instead of rewritten at source:
     - an emoji that carries meaning becomes a small drawn icon of the same thing: coins, gems, keys,
       pass points and race tickets, ribbons, stars, a lock, full and empty bond hearts, the friend
       heart, a crown, the medals, a trophy, a clock, a tick and a cross, the foods;
     - an emoji that stood alone in a control or an icon slot (a pencil on an edit button, a speaker
       on the sound button, a quest's picture) becomes a line icon of the same thing in the control's
       own colour;
     - every other one is hidden, with the space beside it.
   The emoji itself is never deleted from the page: it stays inside the icon (or on its own), at zero
   size. So the text of every element reads exactly as its renderer wrote it, and the code that reads
   text back out of the page (the bond hearts counted in the status card, prices parsed out of shop
   rows, the medals read back as ranks, the ticks read back as done, change checks that compare
   text) goes on working without a line of it changing.

   Text drawn on canvases (name plates, signs, the maps) is cleaned by the small script at the top of
   ranch3d.html, which has to run before anything draws. This package does the page: text, the
   tooltips and labels, the data attributes that styles print, alerts, and anything added later.
   What a player is typing (inputs, text areas, editable text) is left alone. A QA run keeps the
   emojis unless it asks for ?emoji=0; ?emoji=1 keeps them anywhere. Nothing runs at import time. */
export const id='no-emoji';
export function install(G){
 const NE=window.__noEmoji;
 if(!NE||!NE.on||!document.body)return;
 const RE=new RegExp(NE.SEQ,'gu'), TEST=new RegExp(NE.SEQ,'u');
 const has=s=>typeof s==='string'&&TEST.test(s);
 const norm=e=>e.replace(/[️‍⃣]/g,'').replace(/\p{Emoji_Modifier}/gu,'');

 /* ---------------------------------------------------------------- icons ---------------------
    COLOR: full-colour drawings, 32 units square, for things that mean something. */
 const scal=(cx,cy,r,n,pr)=>{let d='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2;d+='<circle cx="'+(cx+Math.cos(a)*r).toFixed(2)+'" cy="'+(cy+Math.sin(a)*r).toFixed(2)+'" r="'+pr+'"/>';}return d;};
 const star=(cx,cy,R,r)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r:R;d+=(i?'L':'M')+(cx+Math.cos(a)*q).toFixed(2)+' '+(cy+Math.sin(a)*q).toFixed(2);}return d+'Z';};
 const HEART='M16 28S3.5 20.5 3.5 11.8A6.3 6.3 0 0 1 16 8.6a6.3 6.3 0 0 1 12.5 3.2C28.5 20.5 16 28 16 28z';
 const COLOR={
  coin:'<circle cx="16" cy="16" r="15" fill="#e9a927" stroke="#9c6a12" stroke-width="1.4"/><circle cx="16" cy="16" r="11.3" fill="#f7c948" stroke="#c98d1b" stroke-width="1.2"/><path d="M11.4 21v-5.6a4.6 4.6 0 0 1 9.2 0V21" fill="none" stroke="#b37a13" stroke-width="2.4" stroke-linecap="round"/>',
  gem:'<path d="M9 4.5h14l6.5 8.5L16 29 2.5 13z" fill="#ef4fa6" stroke="#9e1f63" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 13h27M9 4.5l3.8 8.5 3.2-8.5 3.2 8.5L23 4.5M12.8 13 16 29l3.2-16" fill="none" stroke="#ffc2e2" stroke-width="1.1" stroke-linejoin="round"/>',
  key:'<circle cx="10.5" cy="16" r="7" fill="#d9dde6" stroke="#6b7280" stroke-width="1.4"/><circle cx="10.5" cy="16" r="2.6" fill="#6b7280"/><path d="M17 14.5h12v3h-2v3.5h-3v-3.5h-2v2.3h-2.5v-2.3H17z" fill="#d9dde6" stroke="#6b7280" stroke-width="1.2" stroke-linejoin="round"/>',
  pass:'<path d="M3 8h26v5a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6z" fill="#f2c14e" stroke="#9c6a12" stroke-width="1.3"/><path d="'+star(16,16,6.5,2.9)+'" fill="#fff6d6" stroke="#9c6a12" stroke-width="1"/>',
  ticket:'<path d="M3 9h26v4.5a2.5 2.5 0 0 0 0 5V23H3v-4.5a2.5 2.5 0 0 0 0-5z" fill="#8a5cd6" stroke="#4d2d8f" stroke-width="1.3"/><path d="M11 9v14" stroke="#e8dcff" stroke-width="1.4" stroke-dasharray="2 2"/>',
  ribbon:'<path d="M11 17 6.5 30l5-3 3 4.5 2.5-11zM21 17l4.5 13-5-3-3 4.5-2.5-11z" fill="#2f7d45"/><g fill="#3fae5a">'+scal(16,12.5,9.6,14,2.6)+'<circle cx="16" cy="12.5" r="10"/></g><circle cx="16" cy="12.5" r="6.8" fill="#fff" opacity=".9"/><circle cx="16" cy="12.5" r="5.4" fill="#3fae5a"/>',
  star:'<path d="'+star(16,16.5,14,6.2)+'" fill="#f5c542" stroke="#a8740f" stroke-width="1.4" stroke-linejoin="round"/>',
  dust:'<path d="M14 3l2.2 6.3L22.5 11.5l-6.3 2.2L14 20l-2.2-6.3-6.3-2.2 6.3-2.2zM24 18l1.2 3.3 3.3 1.2-3.3 1.2L24 27l-1.2-3.3-3.3-1.2 3.3-1.2z" fill="#c9a7ff" stroke="#6b3fb8" stroke-width="1.2" stroke-linejoin="round"/>',
  lock:'<rect x="6" y="14" width="20" height="15" rx="3" fill="#8d93a8" stroke="#4b5064" stroke-width="1.4"/><path d="M10.5 14v-3.5a5.5 5.5 0 0 1 11 0V14" fill="none" stroke="#4b5064" stroke-width="3"/><circle cx="16" cy="21" r="2.2" fill="#3a3e50"/>',
  heart:'<path d="'+HEART+'" fill="#e5484d" stroke="#9b1c22" stroke-width="1.4" stroke-linejoin="round"/>',
  heart0:'<path d="'+HEART+'" fill="#fbf7f0" stroke="#b9aa94" stroke-width="1.8" stroke-linejoin="round"/>',
  heartg:'<path d="'+HEART+'" fill="#3fae5a" stroke="#23733a" stroke-width="1.4" stroke-linejoin="round"/>',
  heartp:'<path d="'+HEART+'" fill="#ff6fa8" stroke="#b8336d" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 12a3 3 0 0 1 3-3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  btok:'<path d="M12 25S3 19.5 3 13.2A4.6 4.6 0 0 1 12 11a4.6 4.6 0 0 1 9 2.2C21 19.5 12 25 12 25z" fill="#ff6fa8" stroke="#b8336d" stroke-width="1.3"/><path d="M21 21s-5-3-5-6.6A2.8 2.8 0 0 1 21 13a2.8 2.8 0 0 1 5 1.4C26 18 21 21 21 21z" fill="#c9a7ff" stroke="#6b3fb8" stroke-width="1.2"/>',
  crown:'<path d="M4 11l6 5 6-10 6 10 6-5-2.5 14h-19z" fill="#f2c14e" stroke="#9c6a12" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16" cy="20" r="2" fill="#e5484d"/>',
  trophy:'<path d="M9 4h14v9a7 7 0 0 1-14 0z" fill="#f0c040" stroke="#8a5e12" stroke-width="1.4"/><path d="M9 7H5a4 4 0 0 0 5 5M23 7h4a4 4 0 0 1-5 5" fill="none" stroke="#c8962a" stroke-width="2"/><path d="M14 20h4v4h-4zM10 24h12v4H10z" fill="#c8962a" stroke="#8a5e12" stroke-width="1.2"/>',
  gold:'<path d="M10 2h5l3 9h-5zM22 2h-5l-3 9h5z" fill="#3b6fd6"/><circle cx="16" cy="20" r="9.5" fill="#f0c040" stroke="#8a5e12" stroke-width="1.4"/><path d="M14.6 16.5 16.5 15v10" fill="none" stroke="#8a5e12" stroke-width="2" stroke-linecap="round"/>',
  silver:'<path d="M10 2h5l3 9h-5zM22 2h-5l-3 9h5z" fill="#3b6fd6"/><circle cx="16" cy="20" r="9.5" fill="#cfd4dc" stroke="#6b7280" stroke-width="1.4"/><path d="M13.6 17.2a2.6 2.6 0 1 1 3.9 2.2l-3.9 3.6h5.2" fill="none" stroke="#6b7280" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  bronze:'<path d="M10 2h5l3 9h-5zM22 2h-5l-3 9h5z" fill="#3b6fd6"/><circle cx="16" cy="20" r="9.5" fill="#d08b4c" stroke="#7a4a1c" stroke-width="1.4"/><path d="M13.8 16.3h4l-2.4 3a2.6 2.6 0 1 1-2 4" fill="none" stroke="#7a4a1c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  clock:'<circle cx="16" cy="18" r="11.5" fill="#f4f1ea" stroke="#4a4f63" stroke-width="2"/><path d="M16 11v7l4.5 3" fill="none" stroke="#4a4f63" stroke-width="2.2" stroke-linecap="round"/><path d="M13 3.5h6M16 3.5v3" stroke="#4a4f63" stroke-width="2.2" stroke-linecap="round"/>',
  check:'<circle cx="16" cy="16" r="13.5" fill="#43a856" stroke="#23733a" stroke-width="1.4"/><path d="M9.5 16.5l4.5 4.5 8.5-9.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  cross:'<circle cx="16" cy="16" r="13.5" fill="#d9534f" stroke="#962b28" stroke-width="1.4"/><path d="M11 11l10 10M21 11 11 21" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  warn:'<path d="M16 3 30 28H2z" fill="#f5c542" stroke="#a8740f" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 11v8M16 23v.5" stroke="#5a3a00" stroke-width="2.8" stroke-linecap="round"/>',
  target:'<circle cx="16" cy="16" r="13" fill="#fff" stroke="#d9534f" stroke-width="2"/><circle cx="16" cy="16" r="8.5" fill="#d9534f"/><circle cx="16" cy="16" r="4.5" fill="#fff"/><circle cx="16" cy="16" r="2" fill="#d9534f"/>',
  gift:'<rect x="4" y="12" width="24" height="16" rx="2" fill="#d9534f" stroke="#962b28" stroke-width="1.3"/><rect x="3" y="9" width="26" height="5" rx="1.5" fill="#e8665f" stroke="#962b28" stroke-width="1.3"/><path d="M16 9v19" stroke="#f2c14e" stroke-width="3"/><path d="M16 9c-2-4-7-5-7-2s7 2 7 2zM16 9c2-4 7-5 7-2s-7 2-7 2z" fill="#f2c14e" stroke="#9c6a12" stroke-width="1"/>',
  fire:'<path d="M16 30c-6 0-10-4-10-9.5 0-6 5-8.5 6.4-15.5 3 2.4 4 5.4 3.8 8.4 1.8-1.4 2.8-3.6 3-6.1 3.8 3.2 6.8 7.6 6.8 13.2 0 5.5-4 9.5-10 9.5z" fill="#f28a2e" stroke="#b3500f" stroke-width="1.3"/><path d="M16 28c-2.6 0-4.4-1.7-4.4-4.2 0-2.6 2.2-3.8 2.8-6.8 2.6 1.8 5.6 4 5.6 6.8 0 2.5-1.6 4.2-4 4.2z" fill="#ffd166"/>',
  bolt:'<path d="M18 2 6 18h8l-2 12 12-16h-8z" fill="#f5c542" stroke="#a8740f" stroke-width="1.3" stroke-linejoin="round"/>',
  carrot:'<path d="M9 27c-2-2 3-11 8-15l4 4c-4 5-10 13-12 11z" fill="#f28a2e" stroke="#b3500f" stroke-width="1.3" stroke-linejoin="round"/><path d="M11 20l2 1M13 17l2 1.2M15.5 14.5l1.8 1" stroke="#b3500f" stroke-width="1.1"/><path d="M19 13c0-4 2-7 4-8M20 14c3-2 6-2 8-1M19.5 13.5c1-3 4-5 7-5" fill="none" stroke="#3f8f4c" stroke-width="2.2" stroke-linecap="round"/>',
  apple:'<path d="M16 10c-4-3-11-1-11 6s5 12 8 12c1.5 0 2-1 3-1s1.5 1 3 1c3 0 8-5 8-12s-7-9-11-6z" fill="#e5484d" stroke="#9b1c22" stroke-width="1.3"/><path d="M16 10c0-3 1-5 3-6" fill="none" stroke="#6b4a26" stroke-width="1.8" stroke-linecap="round"/><path d="M17 7c2-2 5-2 6-1-1 2-4 3-6 1z" fill="#3fae5a"/>',
  hay:'<rect x="4" y="9" width="24" height="16" rx="3" fill="#e9c46a" stroke="#a8740f" stroke-width="1.3"/><path d="M4 15h24M4 20h24" stroke="#c99a3b" stroke-width="1"/><path d="M11 9v16M21 9v16" stroke="#8a5a2b" stroke-width="2"/>',
  lettuce:'<path d="M16 28c-6 0-11-4-11-10 0-3 2-5 4-6 0-3 3-6 7-6s7 3 7 6c2 1 4 3 4 6 0 6-5 10-11 10z" fill="#7cc66b" stroke="#3f8f4c" stroke-width="1.3"/><path d="M16 12v14M16 18l-4-3M16 21l4-3" stroke="#3f8f4c" stroke-width="1.3" fill="none"/>',
  pumpkin:'<ellipse cx="16" cy="18" rx="12" ry="9.5" fill="#f28a2e" stroke="#b3500f" stroke-width="1.3"/><path d="M16 9c-3 3-3 15 0 18M16 9c3 3 3 15 0 18M9 11c-2 4-2 11 0 14M23 11c2 4 2 11 0 14" fill="none" stroke="#c9641c" stroke-width="1.2"/><path d="M16 9c0-2 1-4 3-5" stroke="#3f8f4c" stroke-width="2.2" stroke-linecap="round"/>',
  orange:'<circle cx="16" cy="18" r="10.5" fill="#f5a623" stroke="#b36b0f" stroke-width="1.3"/><path d="M16 7.5c2-2.5 5-3 7-2-1 2.5-4 3.5-7 2z" fill="#3fae5a"/><circle cx="12.5" cy="14.5" r="1.5" fill="#fff" opacity=".6"/>',
  mushroom:'<path d="M4 15c0-6 5-10 12-10s12 4 12 10z" fill="#8a5a2b" stroke="#5a3715" stroke-width="1.3"/><path d="M12 15h8l1 11h-10z" fill="#f1e3c8" stroke="#a88a5c" stroke-width="1.2"/><circle cx="11" cy="10" r="1.6" fill="#f1e3c8"/><circle cx="19" cy="9" r="1.3" fill="#f1e3c8"/>',
  bowl:'<path d="M4 15h24c0 7-5 12-12 12S4 22 4 15z" fill="#c98a4b" stroke="#7a4a1c" stroke-width="1.3"/><path d="M5 15c2-4 6-5 11-5s9 1 11 5" fill="#f1e3c8" stroke="#a88a5c" stroke-width="1.2"/>',
  water:'<path d="M16 3c4 6 9 11 9 16a9 9 0 0 1-18 0c0-5 5-10 9-16z" fill="#4aa3df" stroke="#1f6fa8" stroke-width="1.3"/><path d="M11.5 19a4.5 4.5 0 0 0 3 4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  soap:'<rect x="4" y="12" width="22" height="13" rx="5" fill="#9ad3f5" stroke="#3f8fc6" stroke-width="1.3"/><circle cx="23" cy="8" r="3" fill="#dff2fd" stroke="#3f8fc6" stroke-width="1"/><circle cx="27" cy="13" r="2" fill="#dff2fd" stroke="#3f8fc6" stroke-width="1"/>',
  xp:'<path d="'+star(16,16,14,9)+'" fill="#7bc4ff" stroke="#2a6db0" stroke-width="1.3" stroke-linejoin="round"/>'
 };
 /* always an icon, wherever it stands */
 const ALWAYS={
  '\u{1FA99}':'coin','\u{1F4B0}':'coin','\u{1F48E}':'gem','\u{1F5DD}':'key','\u{1F511}':'key','\u{1F39F}':'pass','\u{1F3AB}':'ticket','\u{1F380}':'ribbon','\u{1F397}':'ribbon',
  '⭐':'star','\u{1F31F}':'star','\u{1F512}':'lock','\u{1F510}':'lock','❤':'heart','♥':'heart','\u{1F90D}':'heart0','\u{1F5A4}':'heart0','\u{1F49A}':'heartg','\u{1F497}':'heartp','\u{1F496}':'heartp',
  '\u{1F451}':'crown','\u{1F947}':'gold','\u{1F948}':'silver','\u{1F949}':'bronze','✅':'check','☑':'check','❌':'cross','❎':'cross','⚠':'warn',
  '⏱':'clock','⏳':'clock','⌛':'clock','⏰':'clock','\u{1F955}':'carrot','\u{1F34E}':'apple','\u{1F96C}':'lettuce','\u{1F383}':'pumpkin','\u{1F34A}':'orange','\u{1F344}':'mushroom','\u{1F963}':'bowl'
 };
 /* an icon beside a number, or alone in its place; elsewhere hidden like any other decoration */
 const NEAR={'✨':'dust','\u{1F3AF}':'target','\u{1F33E}':'hay','\u{1F381}':'gift','\u{1F3C6}':'trophy','\u{1F4A7}':'water','\u{1F9FC}':'soap','\u{1F9EC}':'btok','\u{1F49E}':'btok','\u{1F525}':'fire','⚡':'bolt','\u{1F495}':'heartp'};
 /* LINE: icons for an emoji that stood alone in a control, drawn in the control's own colour */
 const L={
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',search:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4 7.4l2.3 1.3M17.7 15.3 20 16.6M4 16.6l2.3-1.3M17.7 8.7 20 7.4"/><circle cx="12" cy="12" r="6.6"/>',
  sound:'<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',mute:'<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  photo:'<path d="M4 8h3.2l1.5-2h6.6L16.8 8H20v11H4z"/><circle cx="12" cy="13.4" r="3.4"/>',film:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v12M17 6v12M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  sliders:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  trash:'<path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',play:'<path d="M8 5l11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
  close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.01"/>',
  refresh:'<path d="M19 8a8 8 0 1 0 1 6"/><path d="M19.5 3.5V8H15"/>',back:'<path d="M9.5 5.5 4.5 10.5l5 5"/><path d="M5 10.5h9a5.5 5.5 0 0 1 0 11h-3"/>',
  home:'<path d="M3 11l9-7 9 7M5.5 9.5V20h13V9.5M10 20v-6h4v6"/>',map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  book:'<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  horse:'<path d="M8.5 20v-4.6C6.4 14.2 5.4 12 6 9.6L7.3 5l1.9 1.8 1.9-2.6c3.1.6 5.8 3.1 6.4 6.6l1.6 3.1-2.1 1.5-2-1.1c-1 .9-2.1 1.4-3.1 1.4V20"/>',
  foal:'<path d="M9 20v-3.5c-1.4-1-2.2-2.4-2.2-4.3 0-2.9 2.1-5.3 4.8-5.9L12.6 5l.8 2.3c1.8.5 3.1 1.9 3.6 3.8l1.2 1.4-1.1 1.1-1.7-.4-1 1.2.4 2.4V20"/>',
  food:'<path d="M12 8c-3-2.5-7-1-7 3.5S8 20 12 20s7-4 7-8.5S15 5.5 12 8z"/><path d="M12 8c0-2 1-3.5 2.5-4"/>',brush:'<rect x="4" y="10" width="16" height="5" rx="2.5"/><path d="M6 15v4M9 15v4M12 15v4M15 15v4M18 15v4M9 10V7h6v3"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',smile:'<circle cx="12" cy="12" r="8.6"/><path d="M8 13.6c1 1.6 2.3 2.4 4 2.4s3-.8 4-2.4M9 9.5v.01M15 9.5v.01"/>',
  laugh:'<circle cx="12" cy="12" r="8.6"/><path d="M7.5 12.5h9a4.5 4.5 0 0 1-9 0zM8.5 9l1.5-1 1.5 1M12.5 9l1.5-1 1.5 1"/>',
  wave_hand:'<path d="M7 13V6.5a1.5 1.5 0 0 1 3 0V12M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L7 13"/>',
  party:'<path d="M4 20l5-13 8 8z"/><path d="M13 4v2M18 6l-1.5 1.5M20 11h-2M16 3.5l.5 1M21 8l-1 .5"/>',masks:'<path d="M4 5h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M11 10h9v5a4.5 4.5 0 0 1-9 0"/><path d="M6.5 8.5h.01M10 8.5h.01M13.5 13.5h.01M17 13.5h.01"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S12 9 12 9zM12 9c1.5-3 5-4 5-1.5S12 9 12 9z"/>',calendar:'<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pin:'<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  fish:'<path d="M3 12c3-4.5 9-6 13-2.5L20 7v10l-4-2.5C12 18 6 16.5 3 12z"/><path d="M8.5 11.2v.01"/>',egg:'<path d="M12 3c-3.6 0-6.5 6-6.5 10a6.5 6.5 0 0 0 13 0C18.5 9 15.6 3 12 3z"/>',
  compass:'<circle cx="12" cy="12" r="8.6"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',music:'<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="16" r="2.2"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  palette:'<path d="M12 3.5c-5 0-9 3.6-9 8 0 4 3 7 6.4 7 1.4 0 1.9-.9 1.6-1.9-.3-1.1.3-1.9 1.4-1.9h2.4c3.4 0 6.2-2.1 6.2-5.3C21 6.4 17 3.5 12 3.5z"/><path d="M8 10v.01M12 7.5v.01M16 10v.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8"/>',moon:'<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M11 21l2-6-2.5-2.5L12 8l3 3 3 1M10.5 12.5 8 14M13 15l3 6"/>',stand:'<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7.5v7M9 10h6M10 21l2-6.5 2 6.5"/>',
  flag:'<path d="M5 21V4M5 4h13l-2.5 4L18 12H5"/>',
  paw:'<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 5.5 0 2 2 2.5 5.5 1.5 3.5 1 5.5.5 5.5-1.5 0-2-2.5-5.5-5.5-5.5z"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.1 2.8-4.6 5.5-4.6s4.9 1.5 5.5 4.6M15.8 5.4a2.6 2.6 0 0 1 0 5.2M17 14.4c2.1.4 3.4 1.9 3.9 4.4"/>',
  globe:'<circle cx="12" cy="12" r="8.6"/><path d="M3.5 12h17M12 3.4c2.5 2.4 3.6 5.3 3.6 8.6s-1.1 6.2-3.6 8.6c-2.5-2.4-3.6-5.3-3.6-8.6S9.5 5.8 12 3.4z"/>',
  shop:'<path d="M4 9h16l-1.6-4H5.6zM5.6 11.6V20h12.8v-8.4M10 20v-5h4v5"/>',wave:'<path d="M2.5 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 3-2M2.5 18.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 3-2"/>',
  tree:'<path d="M12 3 6 11h3l-4 6h14l-4-6h3zM12 17v4"/>',mountain:'<path d="M2.5 19.5 9 8l4 6 2.5-3.5 6 9z"/>',hammer:'<path d="M14.5 4.5l5 5-2 2-5-5z"/><path d="M13.5 7.5 4 17v3h3l9.5-9.5"/>',
  shirt:'<path d="M8 4 3.5 7l2 4L8 10v10h8V10l2.5 1 2-4L16 4c-.8 1.5-2.2 2.2-4 2.2S8.8 5.5 8 4z"/>',inbox:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  tray:'<path d="M3 13h5l1.5 3h5l1.5-3h5v6H3zM5.5 13 8 5h8l2.5 8"/>',wind:'<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  swirl:'<path d="M12 12a2 2 0 1 1 2-2 4 4 0 0 1-4 4 6 6 0 0 1-6-6 8 8 0 0 1 8-6 10 10 0 0 1 9.5 7"/>',
  jump:'<path d="M3 20h18M6 20v-6M18 20v-6M6 16h12"/><path d="M4 11c2.5-6 13.5-6 16 0"/><path d="M17 8.3l3 2.7 2-3.2"/>',
  rocket:'<path d="M12 3c3 2 4.5 5.5 4.5 9.5L12 17l-4.5-4.5C7.5 8.5 9 5 12 3z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M8 13l-3 3 2.5.5M16 13l3 3-2.5.5M10.5 18.5 12 21l1.5-2.5"/>',
  medal:'<path d="M8 3h3l2 6h-3zM16 3h-3l-2 6h3z"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.5l.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2z"/>',
  scissors:'<circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="M8.5 15.5 18 4M15.5 15.5 6 4"/>',dna:'<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6M8.5 7h7M8.5 17h7"/>',
  umbrella:'<path d="M3 12a9 9 0 0 1 18 0zM12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3v1"/>',
  trophy:'<path d="M8 4h8v4.5a4 4 0 0 1-8 0zM8 6H5.2a2.8 2.8 0 0 0 3.1 3.9M16 6h2.8a2.8 2.8 0 0 1-3.1 3.9M12 12.5V16M9 20h6M10 16h4v4h-4z"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',lightbulb:'<path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.2 1 2.1h5c0-.9.4-1.7 1-2.1A6 6 0 0 0 12 3z"/>',
  fast:'<path d="M4 6l7 6-7 6M12 6l7 6-7 6"/>',wings:'<path d="M12 14c-3.5-5-7.5-6-9-6 1 4.5 4 7 9 7s8-2.5 9-7c-1.5 0-5.5 1-9 6zM12 15v5"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',shield:'<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/>',tools:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M9 9V6h6v3M3 14h18"/>',
  bottle:'<path d="M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
  unicorn:'<path d="M8.5 20v-4.6C6.4 14.2 5.4 12 6 9.6L7.3 5l1.9 1.8 1.9-2.6c3.1.6 5.8 3.1 6.4 6.6l1.6 3.1-2.1 1.5-2-1.1c-1 .9-2.1 1.4-3.1 1.4V20M13 5.5 16.5 1.5"/>',
  dot:'<circle cx="12" cy="12" r="4.5"/>'
 };
 const LINE_OF={
  '✏':'edit','\u{1F58A}':'edit','\u{1F4DD}':'edit','\u{1F50D}':'search','\u{1F50E}':'search','⚙':'gear','\u{1F527}':'gear','\u{1F6E0}':'gear','\u{1F39A}':'sliders','\u{1F39B}':'sliders',
  '\u{1F50A}':'sound','\u{1F509}':'sound','\u{1F508}':'sound','\u{1F507}':'mute','\u{1F4F7}':'photo','\u{1F4F8}':'photo','\u{1F4F9}':'photo','\u{1F5BC}':'photo','\u{1F3AC}':'film','\u{1F3A5}':'film',
  '\u{1F5D1}':'trash','➕':'plus','➖':'minus','▶':'play','⏯':'play','⏸':'pause','⏹':'stop','\u{1F6D1}':'stop','ℹ':'info','❓':'help','❔':'help','❗':'info','❕':'info',
  '\u{1F504}':'refresh','\u{1F501}':'refresh','\u{1F503}':'refresh','↩':'back','⬅':'back','\u{1F519}':'back','✖':'close',
  '\u{1F3E0}':'home','\u{1F3E1}':'home','\u{1F3D8}':'home','\u{1F3DA}':'home','\u{1F5FA}':'map','\u{1F9ED}':'compass','\u{1F4CD}':'pin','\u{1F4CC}':'pin','\u{1F4CB}':'copy',
  '\u{1F4D6}':'book','\u{1F4DC}':'book','\u{1F4D3}':'book','\u{1F4D2}':'book','\u{1F4DA}':'book','\u{1F4C4}':'book','\u{1F4D1}':'book','\u{1F4F0}':'book',
  '\u{1F434}':'horse','\u{1F40E}':'horse','\u{1F3C7}':'horse','\u{1F3A0}':'horse','\u{1F984}':'unicorn','\u{1F37C}':'foal','\u{1FABD}':'wings',
  '\u{1F33F}':'tree','\u{1F331}':'tree','\u{1F333}':'tree','\u{1F332}':'tree','\u{1F334}':'tree','\u{1F342}':'tree','\u{1F341}':'tree',
  '\u{1F36C}':'food','\u{1F37D}':'food','\u{1F952}':'food','\u{1F349}':'food','\u{1F34F}':'food','\u{1F366}':'food','\u{1F9C1}':'food','\u{1F35E}':'food','\u{1F9FA}':'food',
  '\u{1FAAE}':'brush','\u{1F6BF}':'brush','\u{1FAE7}':'brush','\u{1F9FD}':'brush',
  '\u{1F4AC}':'chat','\u{1F5E8}':'chat','\u{1F44B}':'wave_hand','\u{1F600}':'smile','\u{1F60A}':'smile','\u{1F642}':'smile','\u{1F604}':'smile','\u{1F973}':'party','\u{1F483}':'smile','\u{1F602}':'laugh','\u{1F923}':'laugh',
  '\u{1F389}':'party','\u{1F38A}':'party','\u{1F3AD}':'masks',
  '\u{1F4C5}':'calendar','\u{1F5D3}':'calendar','\u{1F4C6}':'calendar','\u{1F3A3}':'fish','\u{1F41F}':'fish','\u{1F420}':'fish','\u{1F95A}':'egg','\u{1F423}':'egg','\u{1F3B5}':'music','\u{1F3B6}':'music','\u{1F3B8}':'music','\u{1F3BB}':'music',
  '\u{1F441}':'eye','\u{1F440}':'eye','\u{1F3A8}':'palette','\u{1F58C}':'palette','☀':'sun','\u{1F31E}':'sun','\u{1F324}':'sun','\u{1F305}':'sun','\u{1F319}':'moon','\u{1F303}':'moon','\u{1F30C}':'moon',
  '\u{1F6B6}':'walk','\u{1F9CD}':'stand','\u{1F3C1}':'flag','\u{1F6A9}':'flag','\u{1F43E}':'paw','\u{1F415}':'paw','\u{1F408}':'paw','\u{1F407}':'paw','\u{1F98A}':'paw','\u{1F436}':'paw','\u{1F431}':'paw','\u{1F430}':'paw',
  '\u{1F4AB}':'sparkle','\u{1F465}':'users','\u{1F46A}':'users','\u{1F91D}':'users','\u{1F310}':'globe','\u{1F30D}':'globe','\u{1F30E}':'globe','\u{1F30F}':'globe',
  '\u{1F6CD}':'shop','\u{1F6D2}':'shop','\u{1F3EA}':'shop','\u{1F3EC}':'shop','\u{1F30A}':'wave','\u{1F3D4}':'mountain','⛰':'mountain','\u{1F3D5}':'mountain','\u{1F3DC}':'mountain','\u{1F3D7}':'hammer','\u{1F528}':'hammer',
  '\u{1F455}':'shirt','\u{1F97C}':'shirt','\u{1F3BD}':'shirt','\u{1F454}':'shirt','\u{1F9E2}':'shirt','\u{1F4EC}':'inbox','\u{1F4EE}':'inbox','\u{1F4E9}':'inbox','✉':'inbox','\u{1F4E5}':'tray','\u{1F4E6}':'tray',
  '\u{1F4A8}':'wind','\u{1F300}':'swirl','⤴':'jump','⤵':'jump','\u{1FA9C}':'jump','\u{1F680}':'rocket','⏩':'fast','⏭':'fast','\u{1F3C5}':'medal','\u{1F396}':'medal','✂':'scissors',
  '\u{1F302}':'umbrella','☂':'umbrella','☔':'umbrella','\u{1F514}':'bell','\u{1F4A1}':'lightbulb','\u{1F6E1}':'shield','\u{1F9F0}':'tools','\u{1F9F4}':'bottle','\u{1F9C3}':'bottle'
 };
 const uri=svg=>'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)+'")';
 const colorUri={}, lineUri={};
 for(const k in COLOR)colorUri[k]=uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'+COLOR[k]+'</svg>');
 for(const k in L)lineUri[k]=uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+L[k]+'</svg>');
 const iconOf=e=>ALWAYS[e]?{c:ALWAYS[e]}:NEAR[e]?{c:NEAR[e]}:LINE_OF[e]?{l:LINE_OF[e]}:null;
 if(!document.getElementById('noEmojiCss')){
  const st=document.createElement('style'); st.id='noEmojiCss';
  st.textContent='i.noe{display:inline-block;width:1.08em;height:1.08em;vertical-align:-.2em;margin:0 .1em;background:center/contain no-repeat;font-style:normal;flex:none;overflow:hidden;line-height:0}'
   +'i.noe-l{background:currentColor!important;-webkit-mask:var(--noe) center/contain no-repeat;mask:var(--noe) center/contain no-repeat}'
   +'.noe-t{font-size:0!important;line-height:0!important;letter-spacing:0!important;color:transparent!important;text-shadow:none!important}'
   +Object.keys(colorUri).map(k=>'i.noe-'+k+'{background-image:'+colorUri[k]+'}').join('')
   /* emojis that styles print from attributes or strings */
   +'#shopPanel .s2-row.s2-locked .s2-title::after{content:""!important;display:inline-block;width:.9em;height:.9em;vertical-align:-.1em;background:'+colorUri.lock+' center/contain no-repeat}'
   +'#statusCard .scb::before{content:""!important;display:inline-block;width:11px;height:11px;background:'+colorUri.heartp+' center/contain no-repeat}'
   +'#statusCard .scb[data-ico^="\u{1F955}"]::before{background-image:'+colorUri.carrot+'}#statusCard .scb[data-ico^="\u{1F4A7}"]::before{background-image:'+colorUri.water+'}#statusCard .scb[data-ico^="\u{1F9FC}"]::before{background-image:'+colorUri.soap+'}'
   +'#dock button.mk-dk-raw::before,#seMenu .se-tiles>button.mk-dk-raw::before{content:""!important;width:1.1em;height:1.1em;background:currentColor;-webkit-mask:var(--noe,'+lineUri.dot+') center/contain no-repeat;mask:var(--noe,'+lineUri.dot+') center/contain no-repeat}';
  document.head.appendChild(st);
 }
 const WORDS={coin:'coins',gem:'gems',key:'keys',pass:'pass points',ticket:'race tickets',ribbon:'ribbons',star:'stars',dust:'dust',lock:'locked',heart:'bond',heart0:'empty',heartg:'friend',heartp:'love',btok:'breeding tokens',crown:'first',trophy:'trophy',
  gold:'gold',silver:'silver',bronze:'bronze',clock:'time',check:'done',cross:'no',warn:'warning',target:'accuracy',gift:'gift',fire:'streak',bolt:'energy',carrot:'carrots',apple:'apples',hay:'hay',lettuce:'lettuce',pumpkin:'pumpkins',orange:'oranges',mushroom:'truffles',bowl:'oat mash',water:'water',soap:'grooming',xp:'XP'};
 /* the icon, holding the emoji itself at zero size so the element's text is what its renderer wrote */
 function iconEl(ic,raw){
  const i=document.createElement('i');
  if(ic.c){i.className='noe noe-'+ic.c;i.setAttribute('aria-label',WORDS[ic.c]||ic.c);}
  else{i.className='noe noe-l';i.style.setProperty('--noe',lineUri[ic.l]||lineUri.dot);i.setAttribute('aria-label',ic.l);}
  i.setAttribute('role','img'); i.dataset.noe=ic.c||ic.l;
  const t=document.createElement('span'); t.className='noe-t'; t.setAttribute('aria-hidden','true'); t.textContent=raw; i.appendChild(t);
  return i;
 }
 const hiddenEl=raw=>{const t=document.createElement('span');t.className='noe-t';t.setAttribute('aria-hidden','true');t.textContent=raw;return t;};

 /* ---------------------------------------------------------------- cleaning ------------------ */
 const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','NOSCRIPT','CODE','PRE']);
 const skipEl=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(SKIP.has(e.tagName)||e.isContentEditable)return true;const c=e.classList;if(c&&(c.contains('noe-t')||c.contains('noe')))return true;if(e.dataset&&e.dataset.noeKeep!=null)return true;}return false;};
 const OPTION_WORDS={'\u{1F3C7}':'Riding · ','\u{1F33F}':'At grass · ','⛓':'Hitched · ','❤':'♥','⭐':'★'};
 const ICONISH=/(^|[\s_-])(qico|c2-qIco|ico|ic|icon|glyph|scPortrait|gaitEl|emoji|av|avatar)([\s_-]|$)|tab/i;
 let cleaned=0;
 function cleanText(n){
  const t=n.nodeValue; if(!t||!has(t))return;
  const p=n.parentNode; if(!p||p.nodeType!==1||skipEl(p))return;
  cleaned++;
  const tag=p.tagName, inSvg=p instanceof SVGElement;
  if(tag==='OPTION'||tag==='TITLE'||inSvg){
   let s=t; for(const e in OPTION_WORDS)s=s.split(e+'️').join(OPTION_WORDS[e]).split(e).join(OPTION_WORDS[e]);
   n.nodeValue=NE.clean(s,true)||(inSvg?'':'•'); return;
  }
  /* the parts: words, and the emojis between them */
  const parts=[]; let last=0, m; RE.lastIndex=0;
  while((m=RE.exec(t))){if(m.index>last)parts.push(t.slice(last,m.index));parts.push({raw:m[0],e:norm(m[0])});last=m.index+m[0].length;}
  if(last<t.length)parts.push(t.slice(last));
  const words=parts.filter(x=>typeof x==='string').join('');
  const alone=!/\S/.test(words);
  const onlyChild=alone&&[...p.childNodes].every(c=>c===n||(c.nodeType===3&&!/\S/.test(c.nodeValue))||(c.nodeType===1&&(c.classList.contains('pip')||c.classList.contains('badge')||c.classList.contains('noe')||c.classList.contains('noe-t'))));
  const slot=onlyChild&&(tag==='BUTTON'||tag==='A'||ICONISH.test((p.id||'')+' '+(typeof p.className==='string'?p.className:'')+' '+((p.parentElement&&typeof p.parentElement.className==='string'&&p.parentElement.className)||'')));
  const inChat=!!(p.closest&&p.closest('#chatFeed,#chatLog,.chatMsg,.chat-line,.bubble'));
  const frag=document.createDocumentFragment();
  for(let i=0;i<parts.length;i++){
   const x=parts[i];
   if(typeof x==='string'){if(x)frag.appendChild(document.createTextNode(x));continue;}
   const prev=parts[i-1], next=parts[i+1];
   const near=(typeof prev==='string'&&/[\d%]\s?$/.test(prev))||(typeof next==='string'&&/^\s?[\d+×x]/.test(next))||(prev===undefined&&next===undefined)
    ||(prev&&typeof prev!=='string'&&!!iconOf(prev.e))||(next&&typeof next!=='string'&&!!iconOf(next.e));
   let ic=ALWAYS[x.e]?{c:ALWAYS[x.e]}:(NEAR[x.e]&&(near||slot))?{c:NEAR[x.e]}:null;
   if(!ic&&(slot||inChat||(onlyChild&&LINE_OF[x.e])))ic=LINE_OF[x.e]?{l:LINE_OF[x.e]}:NEAR[x.e]?{c:NEAR[x.e]}:(slot||inChat)?{l:'dot'}:null;
   if(ic){frag.appendChild(iconEl(ic,x.raw));continue;}
   /* hidden, together with one space beside it so no gap is left behind */
   let raw=x.raw;
   if(typeof next==='string'&&/^[  ]/.test(next)){raw+=next[0];parts[i+1]=next.slice(1);}
   else if(frag.lastChild&&frag.lastChild.nodeType===3&&/[  ]$/.test(frag.lastChild.nodeValue)){const tl=frag.lastChild;tl.nodeValue=tl.nodeValue.slice(0,-1);raw=' '+raw;if(!tl.nodeValue)frag.removeChild(tl);}
   frag.appendChild(hiddenEl(raw));
  }
  p.replaceChild(frag,n);
 }
 const ATTRS=['title','placeholder','aria-label','alt','data-mk-glyph','data-mk-label','data-se-lbl','data-se-l','data-sem-t','data-sem-s','data-tip','data-label','data-se-g'];
 function cleanAttr(el,a){
  const v=el.getAttribute(a); if(!v||!has(v))return;
  if(a==='data-mk-glyph'){const e=norm((v.match(RE)||[''])[0]);const ic=iconOf(e);el.style.setProperty('--noe',lineUri[(ic&&ic.l)||'dot']);}
  let s=v; if(/⭐/.test(s)&&!s.replace(RE,'').trim())s=s.replace(/⭐️?/g,'★');   // a label made of stars keeps them, as text stars
  const c=NE.clean(s,true); if(c!==v)el.setAttribute(a,c);
 }
 const REJECT=n=>n.nodeType===1&&(SKIP.has(n.tagName)||(n.classList&&(n.classList.contains('noe-t')||n.classList.contains('noe'))));
 function cleanTree(root){
  if(!root)return;
  if(root.nodeType===3){cleanText(root);return;}
  if(root.nodeType!==1&&root.nodeType!==11)return;
  if(root.nodeType===1){if(REJECT(root)||skipEl(root))return;for(const a of ATTRS)if(root.hasAttribute(a))cleanAttr(root,a);}
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>REJECT(n)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const texts=[];
  for(let n=tw.nextNode();n;n=tw.nextNode()){
   if(n.nodeType===3){if(has(n.nodeValue))texts.push(n);}
   else for(const a of ATTRS)if(n.hasAttribute(a))cleanAttr(n,a);
  }
  for(const t of texts)cleanText(t);
 }
 const mo=new MutationObserver(muts=>{
  try{
   for(const m of muts){
    if(m.type==='childList'){for(const n of m.addedNodes)if(n.isConnected)cleanTree(n);}
    else if(m.type==='characterData'){if(m.target.isConnected)cleanText(m.target);}
    else if(m.type==='attributes'){if(m.target.isConnected)cleanAttr(m.target,m.attributeName);}
   }
  }catch(e){console.error('no-emoji',e);}
  mo.takeRecords();   // what was just done here is not news
 });
 cleanTree(document.body);
 mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
 if(has(document.title))document.title=NE.clean(document.title);
 /* the browser's own boxes: only the message; a prompt's default (a save code, an invite link) is left as it is */
 for(const fn of ['alert','confirm','prompt']){const o=window[fn];if(typeof o==='function')window[fn]=function(msg,...rest){return o.call(window,typeof msg==='string'?NE.clean(msg,true):msg,...rest);};}

 G.noEmoji={clean:s=>NE.clean(s,true),has,count:()=>cleaned,ALWAYS,NEAR,LINE_OF,colorUri,lineUri,icon:k=>iconEl(COLOR[k]?{c:k}:{l:k},'')};
 G.on('state',o=>{o.noEmoji={on:true,cleaned};});
}
