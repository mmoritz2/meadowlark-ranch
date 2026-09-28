/* Feature package 'se-frame' — every menu in the one frame, the way the riding game this one is
   modelled on frames all of its own; and its main menu.

   Its menus are one family. The game world stays on screen behind them, dimmed. A strip across the
   top carries a round back button, the menu's icon and name, the coins and gems, and a round close.
   A menu with sections has a dark column of them down the left, the open one a cream block. The
   content sits in cards, gold for the thing to do and cream for the rest, under serif capitals.
   Ours were a narrow cream card in the middle of the screen, each drawn a little differently.

   This package redraws no menu: every renderer still writes its own rows and binds its own buttons.
   It changes the frame round them and how their parts are dressed:
     - the panel goes full screen over the dimmed world, with the shared strip across the top;
     - its row of tabs becomes the left column (the same buttons, so a click is still the menu's);
     - its rows become cream cards, its main buttons gold, its section heads serif capitals.
   The ☰ menu becomes the reference's main menu: a full screen of big parchment tiles, each a brown
   drawing with its name and what it is for, the player's badge across the top and the small
   settings beside it.

   It is also the kit the rebuilt screens use (se-events and the rest): the drawings, the coin and
   gem, the top strip, and cover(), which lets a screen stand in for a panel whenever that panel
   opens, from anywhere, so every way into a menu arrives at its new face. The Market (se-market),
   the Horse Overview (se-care) and the Character screen have frames of their own and are left alone.
   Every drawing here is this package's own. Nothing runs at import time. */
export const id='se-frame';
export function install(G){
 const $=id=>document.getElementById(id);
 if(!document.body)return;
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const fmt=n=>Math.floor(Number(n)||0).toLocaleString('en-US');

 /* ---------------------------------------------------------------- drawings ---------------
    ART: 48x48 pictures in the reference's manner, a brown figure with light detail cut into it.
    {B} brown, {L} the light of the paper, {D} a darker brown. */
 const scallop=(cx,cy,r,n,pr)=>{let d='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2;d+='<circle cx="'+(cx+Math.cos(a)*r).toFixed(2)+'" cy="'+(cy+Math.sin(a)*r).toFixed(2)+'" r="'+pr+'"/>';}return d;};
 const HEAD='M11 26C10.5 20 12 14.5 16 11L17.5 5.5 20 9.5 22 6l1.5 4c4 1 7.5 3.5 10.5 6.5l6.5 5c1.5 1.3 1.1 3.9-1.1 4.4-2.2.5-4.4-.3-6.4-1.5l-3.5-1.7c-1.5 1.3-2 2.3-1.9 3.3z';
 const ART={
  head:'<path fill="{B}" d="'+HEAD+'"/><circle fill="{L}" cx="26" cy="15.4" r="1.35"/>',
  market:'<path fill="{B}" d="M7 13 11 6h26l4 7z"/><path fill="{B}" d="M6 13h36v4.5a4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 1-9 0z"/>'
   +'<path fill="{L}" opacity=".5" d="M15 13h4.5v4.5a2.25 2.25 0 0 1-4.5 0zM28.5 13H33v4.5a2.25 2.25 0 0 1-4.5 0z"/><path fill="{B}" d="M9 22h30v20H9z"/>'
   +'<rect fill="{L}" x="13" y="26" width="11" height="8" rx="1"/><path fill="{L}" d="M28 26h7v16h-7z"/><circle fill="{B}" cx="29.8" cy="34.5" r=".9"/><path stroke="{B}" stroke-width="2.6" stroke-linecap="round" d="M5 42.6h38"/>',
  horses:'<path fill="{D}" d="M4 24.5h32v3.2H4z"/><path fill="{B}" d="M6 27.7h28V43H6z"/><path stroke="{L}" stroke-width="1.8" d="M8.5 30.2l23 10.3M31.5 30.2l-23 10.3"/>'
   +'<path fill="{B}" d="'+HEAD+'"/><circle fill="{L}" cx="26" cy="15.4" r="1.35"/><circle fill="{D}" cx="39" cy="23.4" r=".85"/><path fill="none" stroke="{L}" stroke-width="1.3" stroke-linecap="round" d="M15.3 12.8c-1.6 3-2.1 6.2-2 9.6M18.2 12.2c-1.2 2.8-1.6 5.6-1.4 8.7"/>',
  events:'<rect fill="{B}" x="7" y="9" width="4.6" height="33" rx="1.2"/><rect fill="{B}" x="36.4" y="9" width="4.6" height="33" rx="1.2"/><path fill="{B}" d="M5.3 7.5h8l-1 3H6.3zM34.7 7.5h8l-1 3h-6z"/>'
   +'<path fill="{B}" d="M11 15h26v3.8H11zM11 22.6h26v3.8H11zM11 30.2h26V34H11z"/><path fill="{L}" d="M14.6 15h4v3.8h-4zM22 15h4v3.8h-4zM29.4 15h4v3.8h-4zM18.3 22.6h4v3.8h-4zM25.7 22.6h4v3.8h-4zM14.6 30.2h4V34h-4zM22 30.2h4V34h-4zM29.4 30.2h4V34h-4z"/>'
   +'<path stroke="{B}" stroke-width="3" stroke-linecap="round" d="M4 42.6h11M33 42.6h11"/>',
  journey:'<path fill="{B}" d="M24 16C19 12.5 12 11.5 5 12.5V37c7-1 14 0 19 3.5C29 37 36 36 43 37V12.5C36 11.5 29 12.5 24 16z"/>'
   +'<path fill="none" stroke="{L}" stroke-width="1.6" stroke-linecap="round" d="M24 17.5v21M9 18c4-.5 8 0 11 1.5M9 23c4-.5 8 0 11 1.5M9 28c4-.5 8 0 11 1.5M28 19.5c3-1.5 7-2 11-1.5M28 24.5c3-1.5 7-2 11-1.5M28 29.5c3-1.5 7-2 11-1.5"/>'
   +'<path fill="{B}" d="M38 1.5l1.3 3.4 3.4 1.3-3.4 1.3L38 11l-1.3-3.5-3.4-1.3 3.4-1.3zM10 2.5l.9 2.3 2.3.9-2.3.9L10 9l-.9-2.4-2.3-.9 2.3-.9zM44.5 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  season:'<path fill="{B}" d="M4 14a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v5a5 5 0 0 0 0 10v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a5 5 0 0 0 0-10z"/>'
   +'<path fill="none" stroke="{L}" stroke-width="3" stroke-linecap="round" d="M18 31v-7.5a6 6 0 0 1 12 0V31"/><path fill="{L}" d="M16.5 30.5h3.4v2.2h-3.4zM28.1 30.5h3.4v2.2h-3.4z"/><path stroke="{L}" stroke-width="1.4" stroke-dasharray="2 2.4" d="M9 15.5v17M39 15.5v17"/>',
  special:'<rect fill="{B}" x="6" y="10" width="36" height="31" rx="3"/><path fill="{D}" d="M6 13a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v5H6z"/><path stroke="{B}" stroke-width="3" stroke-linecap="round" d="M15 6v7M33 6v7"/>'
   +'<path fill="{L}" d="M24 22.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z"/>',
  training:'<path fill="{B}" d="'+HEAD+'" transform="translate(-3 6)"/><circle fill="{L}" cx="23" cy="21.4" r="1.3"/><path fill="{B}" d="M31 5l12 4.5-12 4.5-12-4.5z"/><path stroke="{B}" stroke-width="1.6" d="M41 10v6"/><circle fill="{B}" cx="41" cy="16.8" r="1.4"/>'
   +'<path fill="none" stroke="{B}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M33 43l5-5 5 5M33 37l5-5 5 5"/>',
  care:'<path fill="{B}" d="M24 22s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12z"/><rect fill="{B}" x="8" y="26" width="32" height="9.5" rx="4.75"/>'
   +'<path stroke="{L}" stroke-width="2" stroke-linecap="round" d="M13 30.75h22"/><path stroke="{B}" stroke-width="2.2" stroke-linecap="round" d="M11.5 37v5M15.5 37v5M19.5 37v5M23.5 37v5M27.5 37v5M31.5 37v5M35.5 37v5"/>',
  podium:'<path fill="{B}" d="M17 20h14v23H17zM4 28h13v15H4zM31 32h13v11H31z"/><path fill="none" stroke="{L}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22.5 26.5l2-1.5V36M8.5 33.5a2 2 0 1 1 3 1.7l-3 2.8h4M35.5 36h2a1.4 1.4 0 0 0 0-2.8h-.7h.7a1.4 1.4 0 0 0 0-2.8h-2"/>'
   +'<path fill="{B}" d="M24 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  club:'<circle fill="{B}" cx="17" cy="15" r="6.2"/><path fill="{B}" d="M4.5 41c0-8.4 5.3-13.6 12.5-13.6S29.5 32.6 29.5 41z"/><circle fill="{B}" cx="33.5" cy="17" r="5.2"/><path fill="{B}" d="M31.3 41c0-5.7-1.5-9.2-3.3-11.7 1.6-.9 3.4-1.4 5.5-1.4 6 0 10 4.6 10 13.1z"/>',
  foal:'<path fill="{B}" d="'+HEAD+'" transform="translate(-4 2) scale(.95)"/><path fill="{D}" d="'+HEAD+'" transform="translate(17 19) scale(.58)"/><circle fill="{L}" cx="20.5" cy="16.4" r="1.2"/><circle fill="{L}" cx="32.4" cy="28.2" r=".9"/>'
   +'<path fill="{B}" d="M40 3.5c1.6-1.6 4.2-.4 4 1.8-.2 2.4-4 4.5-4 4.5s-3.8-2.1-4-4.5c-.2-2.2 2.4-3.4 4-1.8z"/>',
  style:'<path fill="{D}" d="M17.5 27 12 44l6.2-3.6 3.3 5.6 3-13.2zM30.5 27 36 44l-6.2-3.6-3.3 5.6-3-13.2z"/><g fill="{B}">'+scallop(24,19,11.2,14,3.2)+'<circle cx="24" cy="19" r="11.4"/></g><circle fill="{L}" cx="24" cy="19" r="7.6"/><circle fill="{B}" cx="24" cy="19" r="5"/>',
  studio:'<path fill="{B}" d="M24 6C13 6 5 13.5 5 23c0 8.5 6.5 15 14 15 3 0 4-2 3.5-4-.6-2.3.6-4 3-4H30c7 0 13-4.5 13-11C43 12 34.5 6 24 6z"/><circle fill="{L}" cx="14" cy="21" r="3.1"/><circle fill="{L}" cx="21.5" cy="13.5" r="3.1"/><circle fill="{L}" cx="31.5" cy="13.8" r="3.1"/><circle fill="{L}" cx="36.3" cy="22.6" r="2.7"/>',
  race:'<path stroke="{B}" stroke-width="3.2" stroke-linecap="round" d="M9 44V5"/><path fill="{B}" d="M10.5 6H39l-4.5 8.5L39 23H10.5z"/><path fill="{L}" d="M15.5 6h5v4.2h-5zM25.5 6h5v4.2h-5zM20.5 10.2h5v4.3h-5zM30.5 10.2h4.8l-.8 1.5.8 1.5v1.3h-4.8zM15.5 14.5h5v4.3h-5zM25.5 14.5h5v4.3h-5zM20.5 18.8h5V23h-5zM30.5 18.8h5.3L37 21v2h-6.5z"/>',
  ranch:'<path fill="{B}" d="M3.5 22 24 7l20.5 15-1.7 2.4L24 11 5.2 24.4z"/><path fill="{B}" d="M7.5 22.5 24 10.5l16.5 12V43h-33z"/><path fill="{L}" d="M17 28h14v15H17z"/><path stroke="{B}" stroke-width="2" d="M17 28l14 15M31 28 17 43"/><path fill="{L}" d="M21 16.5h6v5.5h-6z"/>',
  inbox:'<rect fill="{B}" x="5" y="11" width="38" height="27" rx="3"/><path fill="none" stroke="{L}" stroke-width="2.4" stroke-linejoin="round" d="M7.5 13.8 24 27l16.5-13.2"/><path fill="none" stroke="{L}" stroke-width="1.6" opacity=".7" d="M7.5 35.5 19 25M40.5 35.5 29 25"/>',
  chat:'<path fill="{B}" opacity=".72" d="M38 15h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-2v5.5L33 33H24a3 3 0 0 1-3-3v-1h12a5 5 0 0 0 5-5z"/><path fill="{B}" d="M6 7h26a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H16l-7 6.5V27H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z"/>'
   +'<path stroke="{L}" stroke-width="2.2" stroke-linecap="round" d="M9.5 14h19M9.5 20h13"/>',
  emotes:'<circle fill="{B}" cx="24" cy="24" r="18.5"/><circle fill="{L}" cx="17.5" cy="20" r="2.5"/><circle fill="{L}" cx="30.5" cy="20" r="2.5"/><path fill="none" stroke="{L}" stroke-width="2.8" stroke-linecap="round" d="M15.5 28c2 4 5 6 8.5 6s6.5-2 8.5-6"/>',
  character:'<path fill="{B}" d="M7.5 44c0-9.2 7.2-15.5 16.5-15.5S40.5 34.8 40.5 44z"/><circle fill="{B}" cx="24" cy="18.5" r="8.6"/><path fill="{D}" d="M15 18a9 9 0 0 1 18 0zM31.5 16.6h6.3v2.3h-6.3z"/><path fill="none" stroke="{L}" stroke-width="1.6" d="M19.5 29.8 24 36l4.5-6.2"/>',
  collection:'<path fill="{B}" d="M11 5h24a3 3 0 0 1 3 3v34H13a4 4 0 0 1-4-4V7a2 2 0 0 1 2-2z"/><path fill="{L}" d="M13 36.5h25V40H13a1.75 1.75 0 0 1 0-3.5z"/><path fill="none" stroke="{L}" stroke-width="3" stroke-linecap="round" d="M18.5 29v-7a5.5 5.5 0 0 1 11 0v7"/><path fill="{L}" d="M16.8 28.4h3.4v2.2h-3.4zM27.8 28.4h3.4v2.2h-3.4z"/>',
  whistle:'<path fill="{B}" d="M4.5 27.5a10 10 0 0 0 19.6 3.3L43.5 24v-7.5H19A10 10 0 0 0 4.5 27.5z"/><circle fill="{L}" cx="14.5" cy="27.5" r="3.1"/><path fill="{B}" d="M26 16.5v-5.5h8.5v5.5z"/><path fill="none" stroke="{B}" stroke-width="2" stroke-linecap="round" d="M38 8c2 .6 3.6 2 4.3 4"/>',
  treasure:'<path fill="{B}" d="M6 19a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v4H6z"/><path fill="{B}" d="M6 24h36v17H6z"/><path fill="{L}" d="M6 22.4h36v3H6z"/><rect fill="{L}" x="20.5" y="21" width="7" height="8" rx="1.2"/><circle fill="{B}" cx="24" cy="24.6" r="1.3"/><path stroke="{L}" stroke-width="1.6" d="M16 12v29M32 12v29" opacity=".55"/>',
  map:'<path fill="{B}" d="M4 10l12-4 16 4 12-4v32l-12 4-16-4-12 4z"/><path fill="none" stroke="{L}" stroke-width="1.5" d="M16 6v32M32 10v32" opacity=".6"/><path fill="none" stroke="{L}" stroke-width="2" stroke-dasharray="2.6 2.6" stroke-linecap="round" d="M9 32c4-6 9-2 12-8s8-9 13-6"/><path stroke="{L}" stroke-width="2.4" stroke-linecap="round" d="M35 15.5l4 4M39 15.5l-4 4"/>',
  build:'<path fill="{B}" d="M29.5 7.5l11 11-4.2 4.2-11-11z"/><path fill="{B}" d="M27.2 14.8 7 35l6 6 20.2-20.2z"/><path stroke="{L}" stroke-width="2" d="M9.3 35.2 11.4 37.3"/><path fill="{D}" d="M22 4h8l3.5 3.5-5.5 5.5z"/>'
 };
 const art=(k,o)=>{o=o||{};const s=(ART[k]||ART.collection).replace(/\{B\}/g,o.b||'#7b5530').replace(/\{L\}/g,o.l||'#efe1bb').replace(/\{D\}/g,o.d||'#553619');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="'+(o.cls||'')+'">'+s+'</svg>';};
 const artUri=(k,o)=>'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(art(k,o))+'")';
 /* LINE: 24x24 line icons for the top strip and the small round buttons */
 const LINE={
  back:'<path d="M9.5 5.5 4.5 10.5l5 5"/><path d="M5 10.5h9a5.5 5.5 0 0 1 0 11h-3"/>',
  close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4 7.4l2.3 1.3M17.7 15.3 20 16.6M4 16.6l2.3-1.3M17.7 8.7 20 7.4"/><circle cx="12" cy="12" r="6.6"/>',
  photo:'<path d="M4 8h3.2l1.5-2h6.6L16.8 8H20v11H4z"/><circle cx="12" cy="13.4" r="3.4"/>',
  graphics:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  sound:'<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  refresh:'<path d="M19 8a8 8 0 1 0 1 6"/><path d="M19.5 3.5V8H15"/>',
  search:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',
  chevl:'<path d="M15 5l-7 7 7 7"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  hourglass:'<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  events:'<path d="M5 6v14M19 6v14M5 10.5h14M5 15h14M4 6h2M18 6h2"/>',
  journey:'<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>',
  horses:'<path d="M3 11l9-6 9 6M5 10v10h14V10M9 20v-6h6v6M9 14l6 6M15 14l-6 6"/>',
  podium:'<path d="M9 21V11h6v10M3 21v-6h6M15 21v-4h6v4M2 21h20"/><path d="M12 3.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 5.7l2-.3z"/>',
  club:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.1 2.8-4.6 5.5-4.6s4.9 1.5 5.5 4.6M15.8 5.4a2.6 2.6 0 0 1 0 5.2M17 14.4c2.1.4 3.4 1.9 3.9 4.4"/>',
  character:'<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.6-4.2 3.3-6.8 7-6.8s6.4 2.6 7 6.8"/>',
  collection:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  style:'<circle cx="12" cy="10" r="5.5"/><path d="M9 14.5 7 21l3-1.5 1.5 2.5M15 14.5l2 6.5-3-1.5-1.5 2.5"/>',
  studio:'<path d="M12 3.5c-5 0-9 3.6-9 8 0 4 3 7 6.4 7 1.4 0 1.9-.9 1.6-1.9-.3-1.1.3-1.9 1.4-1.9h2.4c3.4 0 6.2-2.1 6.2-5.3C21 6.4 17 3.5 12 3.5z"/>',
  race:'<path d="M5 21V4M5 4h13l-2.5 4L18 12H5"/>',
  inbox:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  emotes:'<circle cx="12" cy="12" r="8.6"/><path d="M8 13.6c1 1.6 2.3 2.4 4 2.4s3-.8 4-2.4"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  build:'<path d="M14.5 4.5l5 5-2 2-5-5z"/><path d="M13.5 7.5 4 17v3h3l9.5-9.5"/>',
  foal:'<path d="M8.5 20v-4.6C6.4 14.2 5.4 12 6 9.6L7.3 5l1.9 1.8 1.9-2.6c3.1.6 5.8 3.1 6.4 6.6l1.6 3.1-2.1 1.5-2-1.1c-1 .9-2.1 1.4-3.1 1.4V20"/>',
  season:'<path d="M3.5 7.5h17v3a2 2 0 0 0 0 3.8v3.2h-17v-3.2a2 2 0 0 0 0-3.8z"/><path d="M9.5 10.2c0 2.5 1.1 4.3 2.5 4.3s2.5-1.8 2.5-4.3"/>',
  market:'<path d="M4 9h16l-1.6-4H5.6zM5.6 11.6V20h12.8v-8.4M10 20v-5h4v5"/>',
  care:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  treasure:'<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4z"/><path d="M4 12h16M11 11h2v3h-2z"/>',
  map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2"/>',
  ticket:'<path d="M3.5 7.5h17v3a2 2 0 0 0 0 3.8v3.2h-17v-3.2a2 2 0 0 0 0-3.8z"/>'
 };
 const line=(k,col,sw)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="'+(col||'currentColor')+'" stroke-width="'+(sw||2.1)+'" stroke-linecap="round" stroke-linejoin="round">'+(LINE[k]||LINE.collection)+'</svg>';
 /* the coin (a horseshoe struck in it), the gem, the key and a ribbon rosette */
 const COIN='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#e9a927" stroke="#9c6a12" stroke-width="1.4"/><circle cx="16" cy="16" r="11.3" fill="#f7c948" stroke="#c98d1b" stroke-width="1.2"/>'
  +'<path d="M11.4 21v-5.6a4.6 4.6 0 0 1 9.2 0V21" fill="none" stroke="#b37a13" stroke-width="2.4" stroke-linecap="round"/><path d="M8 10.5a9.5 9.5 0 0 1 6-4.3" fill="none" stroke="#fff3c4" stroke-width="1.6" stroke-linecap="round" opacity=".85"/></svg>';
 const GEM='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M9 4.5h14l6.5 8.5L16 29 2.5 13z" fill="#ef4fa6" stroke="#9e1f63" stroke-width="1.3" stroke-linejoin="round"/>'
  +'<path d="M2.5 13h27M9 4.5l3.8 8.5 3.2-8.5 3.2 8.5L23 4.5M12.8 13 16 29l3.2-16" fill="none" stroke="#ffc2e2" stroke-width="1.1" stroke-linejoin="round"/><path d="M6 12l3-5.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".8"/></svg>';
 const KEY='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="11" cy="16" r="7" fill="#f2c84b" stroke="#9c6a12" stroke-width="1.4"/><circle cx="11" cy="16" r="2.6" fill="#7a5010"/><path d="M17.5 14.5h11v3h-2v3h-3v-3h-2v2h-2.5v-2h-1.5z" fill="#f2c84b" stroke="#9c6a12" stroke-width="1.2" stroke-linejoin="round"/></svg>';
 const RIBBON=(col,col2)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48"><path d="M13 26 7 46l7-4 4 6 3-16zM27 26l6 20-7-4-4 6-3-16z" fill="'+(col2||'#2f7d45')+'"/><g fill="'+(col||'#3fa35a')+'">'+scallop(20,18,13.5,16,3.3)
  +'<circle cx="20" cy="18" r="14"/></g><circle cx="20" cy="18" r="9.8" fill="#fff" opacity=".92"/><circle cx="20" cy="18" r="8" fill="'+(col||'#3fa35a')+'"/><path d="M16.2 22.5v-4.6a3.8 3.8 0 0 1 7.6 0v4.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';

 /* ---------------------------------------------------------------- the look -------------- */
 const TOP='clamp(50px,8.5vh,64px)', SIDE='clamp(92px,8.6vw,118px)';
 const xMask=encodeURIComponent(line('close','#000',3));
 if(!$('seFrameCss')){
  const st=document.createElement('style'); st.id='seFrameCss';
  st.textContent=`
:root{--sef-top:${TOP};--sef-side:${SIDE};--sef-serif:Georgia,'Times New Roman',serif;--sef-ink:#3b2a17;--sef-cream:#f1e8d3;--sef-cream2:#e3d5b3;--sef-gold1:#f6de84;--sef-gold2:#ddb341}
/* shared parts, for this package and the rebuilt screens */
.se-circ{width:clamp(36px,5.8vh,44px)!important;height:clamp(36px,5.8vh,44px)!important;flex:none;border-radius:50%!important;display:flex!important;align-items:center;justify-content:center;padding:7px!important;cursor:pointer;
 background:radial-gradient(circle at 38% 30%,#34539a,#1b2a5e)!important;border:2.5px solid #eef2fb!important;color:#fff!important;box-shadow:0 2px 4px rgba(0,0,0,.35)!important;min-height:0!important;min-width:0!important}
.se-circ svg{width:100%;height:100%;display:block}
.se-pill{position:relative;display:flex;align-items:center;justify-content:flex-end;height:clamp(26px,4vh,32px);min-width:clamp(84px,9vw,124px);padding:0 14px 0 34px;border-radius:17px;
 background:rgba(38,34,48,.92);border:2px solid rgba(255,255,255,.55);font:900 clamp(13px,2.1vh,17px)/1 Nunito,system-ui,sans-serif;color:#fff;margin-left:14px;font-variant-numeric:tabular-nums}
.se-pill>svg{position:absolute;left:-12px;top:50%;width:clamp(32px,5vh,40px);height:clamp(32px,5vh,40px);transform:translateY(-50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
.se-strip{position:fixed;left:0;right:0;top:0;height:${TOP};display:flex;align-items:center;gap:12px;padding:0 14px;z-index:11;font-family:Nunito,system-ui,sans-serif;color:#fff;
 background:linear-gradient(180deg,rgba(40,38,52,.8),rgba(40,38,52,.62));border-bottom:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.se-strip .se-ttl{display:flex;align-items:center;gap:10px;min-width:0}
.se-strip .se-ttl>svg{width:clamp(24px,4vh,32px);height:clamp(24px,4vh,32px);flex:none;color:#fff}
.se-strip .se-ttl b{display:block;font:800 clamp(17px,3vh,24px)/1.05 Nunito,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.se-strip .se-ttl small{display:block;font:700 clamp(10.5px,1.7vh,13px)/1.2 Nunito,system-ui,sans-serif;color:#e4def5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.se-strip .se-sp{flex:1}
.se-gold{background:linear-gradient(180deg,var(--sef-gold1),var(--sef-gold2))!important;color:#3a2a10!important;border:0!important;border-radius:8px!important;cursor:pointer;
 font:800 clamp(13px,2.1vh,17px)/1 var(--sef-serif)!important;letter-spacing:.4px;text-transform:uppercase;padding:10px 20px!important;min-height:0!important;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 0 rgba(120,80,0,.25),0 2px 4px rgba(0,0,0,.3)!important}
.se-cream{background:linear-gradient(180deg,#fbf5e6,#e9dcc0)!important;color:#3b2a17!important;border:0!important;border-radius:8px!important;cursor:pointer;
 font:800 clamp(13px,2.1vh,17px)/1 var(--sef-serif)!important;letter-spacing:.4px;text-transform:uppercase;padding:10px 20px!important;min-height:0!important;
 box-shadow:inset 0 -3px 0 rgba(90,60,20,.18),0 2px 4px rgba(0,0,0,.3)!important}
.se-gold:disabled,.se-cream:disabled{filter:grayscale(.7);opacity:.6;cursor:default}
.se-h{font:800 clamp(15px,2.6vh,20px)/1.15 var(--sef-serif);letter-spacing:.6px;text-transform:uppercase;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.se-dim{position:fixed;inset:0;background:rgba(16,16,26,.34);backdrop-filter:blur(2px) saturate(.6) brightness(.82);-webkit-backdrop-filter:blur(2px) saturate(.6) brightness(.82)}
body.se-screen-open #seHudRoot,body.se-screen-open #seWay,body.se-screen-open #seMarketLbl,body.se-screen-open #stickZone,body.se-screen-open #seMount,body.se-screen-open #hud,
body.se-screen-open #questTrack,body.se-screen-open #ctx,body.se-screen-open #mini,body.se-screen-open #mkMiniPlate,body.se-screen-open #seNorth,body.se-screen-open #statusCard,
body.se-screen-open #dock,body.se-screen-open #touch,body.se-screen-open #chatFeed,body.se-screen-open #hint{visibility:hidden!important}
body.se-screen-open #toasts{z-index:14!important}
body.se-screen-open #dlg{z-index:15!important}
.se-covered{opacity:0!important;pointer-events:none!important;animation:none!important}   /* opacity, not visibility: its text stays readable to the game and its tests */
.se-covered *{pointer-events:none!important}
/* ---------------- a panel in the frame ---------------- */
.se-fr{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;transform:none!important;margin:0!important;animation:seFrIn .16s ease!important;
 width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;
 display:flex!important;flex-direction:column!important;gap:0!important;padding:calc(${TOP} + 12px) 0 0 0!important;overflow:hidden!important;z-index:10!important;zoom:1!important;
 background:rgba(16,16,26,.36)!important;backdrop-filter:blur(2px) saturate(.6) brightness(.8);-webkit-backdrop-filter:blur(2px) saturate(.6) brightness(.8);color:var(--sef-ink)}
@keyframes seFrIn{from{opacity:0}to{opacity:1}}
.se-fr::before{display:none!important}
.se-fr.se-fr-tabs{padding-left:${SIDE}!important}
.se-fr>*{flex:none;width:min(940px,calc(100% - 32px))!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box}
.se-fr>.mk-panel-body{flex:1 1 auto!important;overflow-y:auto!important;overflow-x:hidden!important;max-height:none!important;padding:2px 4px 30px!important;
 background:transparent!important;border:0!important;box-shadow:none!important;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.35) transparent}
.se-fr:not(:has(>.mk-panel-body)){overflow-y:auto!important}
/* the menu's own head: its chips on a dark strip under the bar; its close goes (the bar has one) */
.se-fr>.mk-panel-head{position:static!important;margin-bottom:10px!important;padding:7px 14px!important;border-radius:10px!important;min-height:0!important;
 background:rgba(26,24,52,.72)!important;border:1px solid rgba(255,255,255,.16)!important;color:#f3efff!important;font:800 14px/1.3 Nunito,system-ui,sans-serif!important;
 display:flex!important;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:none!important;backdrop-filter:none!important}
.se-fr>.mk-panel-head *{color:#f3efff!important;font-family:Nunito,system-ui,sans-serif}
.se-fr>.mk-panel-head .chip{background:rgba(255,255,255,.14)!important;border:0!important;border-radius:14px!important;padding:3px 10px!important}
.se-fr>.mk-panel-head>button:last-child,.se-fr .mk-x{display:none!important}
/* tabs: the dark column down the left, a picture over each name */
.se-fr .mk-panel-body>.crow:has(> .tabbtn){position:fixed!important;left:0;top:${TOP};bottom:0;width:${SIDE}!important;z-index:2;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
 gap:0!important;margin:0!important;padding:0!important;overflow-y:auto!important;overflow-x:hidden!important;background:linear-gradient(180deg,#2a2760,#1d1b47)!important;
 box-shadow:3px 0 10px rgba(0,0,0,.35)!important;border:0!important;border-radius:0!important;-webkit-mask-image:none!important;mask-image:none!important;scrollbar-width:none}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn{position:relative;flex:none;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%!important;min-height:64px!important;
 margin:0!important;padding:8px 4px!important;border:0!important;border-radius:0!important;border-bottom:1px solid rgba(255,255,255,.07)!important;background:transparent!important;box-shadow:none!important;
 font-size:0!important;color:transparent!important;white-space:normal}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn>*:not(.pip):not(.badge){display:none!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn::before{content:attr(data-se-g);font-size:23px;line-height:1;color:#fff}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn::after{content:attr(data-se-l);font:800 11.5px/1.1 Nunito,system-ui,sans-serif;color:#e9e4ff;text-align:center;max-width:100%;overflow-wrap:anywhere}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn.on{background:linear-gradient(180deg,var(--sef-cream),var(--sef-cream2))!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn.on::after{color:var(--sef-ink)}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn:hover:not(.on){background:rgba(255,255,255,.08)!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn .pip,.se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn .badge{position:absolute;top:6px;right:8px;font-size:10px!important;color:#fff!important}
/* rows: cream cards */
.se-fr .qrow,.se-fr .evrow,.se-fr .c2-blk,.se-fr .passCard,.se-fr .ui2-srow,.se-fr .lbrow,.se-fr .mk-panel-body>.crow:not(:has(> .tabbtn)),.se-fr .mk-card{
 background:linear-gradient(180deg,#f7f0de,#ece0c3)!important;border:1.5px solid #d6c298!important;border-radius:10px!important;box-shadow:0 3px 8px rgba(0,0,0,.28)!important;color:var(--sef-ink)!important}
.se-fr .mk-panel-body>span,.se-fr .mk-panel-body>p,.se-fr .mk-panel-body>small{color:#efeafc!important;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.se-fr .mk-panel-body>div:not([class]){color:#efeafc}
.se-fr .mk-panel-body>div:not([class]) b{color:#fff}
.se-fr .mk-panel-body>div:not([class]) a{color:#ffe08a}
.se-fr .c2-sechead,.se-fr .mk-panel-body>.ph,.se-fr .mk-section{margin:14px 2px 2px!important;padding:0 0 5px!important;border:0!important;border-bottom:2px solid rgba(233,210,150,.55)!important;
 background:transparent!important;color:#fff!important;font:800 clamp(15px,2.5vh,19px)/1.2 var(--sef-serif)!important;letter-spacing:.7px;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,.5);box-shadow:none!important}
.se-fr button.claimBtn{background:linear-gradient(180deg,var(--sef-gold1),var(--sef-gold2))!important;color:#3a2a10!important;border:0!important;border-radius:8px!important;
 font:800 13.5px/1.1 var(--sef-serif)!important;letter-spacing:.3px;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 0 rgba(120,80,0,.25),0 2px 3px rgba(0,0,0,.25)!important}
.se-fr .mk-panel-body button:not(.claimBtn):not(.tabbtn):not(.se-circ){background:linear-gradient(180deg,#fdf8ea,#ecdfc2)!important;color:var(--sef-ink)!important;border:1px solid #cdb68a!important;border-radius:8px!important;
 font-weight:800!important;box-shadow:inset 0 -2px 0 rgba(90,60,20,.14),0 1px 2px rgba(0,0,0,.2)!important}
.se-fr button:disabled{opacity:.55;filter:grayscale(.5)}
.se-fr input,.se-fr select,.se-fr textarea{background:#fffaf0!important;color:var(--sef-ink)!important;border:1px solid #cdb68a!important;border-radius:8px!important}
#seFrameTop{display:none}
body.se-frame-open #seFrameTop{display:flex}
/* ---------------- the main menu (☰): a full screen of parchment tiles ---------------- */
#seMenu.se-main{z-index:60;background:#33286a!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;align-items:stretch!important;justify-content:stretch!important}
#seMenu.se-main::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.07;
 background-image:linear-gradient(45deg,#fff 1.5px,transparent 1.5px),linear-gradient(-45deg,#fff 1.5px,transparent 1.5px);background-size:34px 34px}
#seMenu.se-main .se-sheet{position:relative;width:100%!important;max-width:none!important;max-height:none!important;height:100%!important;border-radius:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
#seMenu.se-main .se-bar{position:relative;z-index:1;flex:none;height:${TOP};padding:0 14px 0 12px!important;gap:12px!important;background:linear-gradient(180deg,#6247b3,#4b3294)!important;border-bottom:0!important;
 box-shadow:0 2px 0 #c6a14e,0 3px 0 #6b4f16,0 6px 10px rgba(0,0,0,.35)}
#seMenu.se-main .se-bar::before,#seMenu.se-main .se-bar::after{content:'';position:absolute;bottom:-8px;width:18px;height:8px;background:#c6a14e;clip-path:polygon(0 0,100% 0,50% 100%)}
#seMenu.se-main .se-bar::before{left:4px}#seMenu.se-main .se-bar::after{right:4px}
#seMenu.se-main .sem-badge{position:relative;display:flex;align-items:center;gap:10px;padding-left:30px;min-width:0}
#seMenu.se-main .sem-badge>svg{position:absolute;left:-8px;top:50%;width:58px;height:58px;transform:translateY(-50%);opacity:.3}
#seMenu.se-main .sem-lv{position:relative;flex:none;width:34px;height:34px;border-radius:6px;background:linear-gradient(180deg,#2d2a55,#1a1838);border:2px solid #efe6c8;color:#fff;font:900 16px/30px Nunito,system-ui,sans-serif;text-align:center}
#seMenu.se-main #seMenuName{display:block;font:900 clamp(16px,2.8vh,21px)/1.05 Nunito,system-ui,sans-serif;color:#fff;white-space:nowrap}
#seMenu.se-main #seMenuSub{display:block;font:800 clamp(11px,1.8vh,13px)/1.3 Nunito,system-ui,sans-serif;color:#f5d77f;white-space:nowrap}
#seMenu.se-main .se-bar br{display:none}
#seMenu.se-main .sem-promo{margin-left:auto;display:flex;align-items:center;gap:10px;height:calc(${TOP} - 14px);padding:0 14px 0 8px;border-radius:8px;cursor:pointer;border:0;min-height:0;
 background:linear-gradient(90deg,#8a39c9,#b04fd6);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35);color:#fff;font-family:Nunito,system-ui,sans-serif;min-width:0;max-width:40vw;text-align:left}
#seMenu.se-main .sem-promo b{display:block;font:900 clamp(13px,2.2vh,17px)/1.05 var(--sef-serif);text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
#seMenu.se-main .sem-promo small{display:block;font:700 clamp(10px,1.6vh,12px)/1.2 Nunito,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;opacity:.95}
#seMenu.se-main .sem-promo i{flex:none;font-style:normal;background:#6fdc70;color:#15461b;border-radius:10px;padding:3px 8px;font:900 12px/1 Nunito,system-ui,sans-serif}
#seMenu.se-main .sem-util{display:flex;gap:8px}
#seMenu.se-main .se-x{margin-left:0!important;width:clamp(36px,5.8vh,44px)!important;height:clamp(36px,5.8vh,44px)!important;padding:9px!important;font-size:0!important;border:2.5px solid #fff!important;
 background:radial-gradient(circle at 38% 30%,#5d5d6e,#2f2f3c)!important}
#seMenu.se-main .se-x::before{content:'';display:block;width:100%;height:100%;background:#fff;
 -webkit-mask:url("data:image/svg+xml;charset=utf-8,${xMask}") center/contain no-repeat;mask:url("data:image/svg+xml;charset=utf-8,${xMask}") center/contain no-repeat}
#seMenu.se-main{--semH:clamp(136px,calc((100vh - ${TOP} - 118px) / 2),262px)}
#seMenu.se-main .se-tiles{flex:1;display:grid!important;grid-auto-flow:column!important;grid-template-rows:repeat(2,var(--semH))!important;grid-template-columns:none!important;
 grid-auto-columns:calc(var(--semH) * .8)!important;gap:clamp(10px,1.8vh,16px)!important;padding:10px 18px!important;
 overflow-x:auto!important;overflow-y:hidden!important;background:transparent!important;scrollbar-width:none;align-content:center}
#seMenu.se-main .se-tiles::-webkit-scrollbar{display:none}
#seMenu.se-main .se-tiles>button{position:relative;display:block!important;width:auto!important;height:var(--semH)!important;min-height:0!important;max-height:none;align-self:center;
 padding:0!important;border-radius:4px!important;cursor:pointer;overflow:hidden;font-size:0!important;color:transparent!important;text-shadow:none!important;
 border:1.5px solid #b89a60!important;box-shadow:inset 0 0 0 3px #efe2bd,inset 0 0 0 4px rgba(150,115,60,.55),0 4px 10px rgba(0,0,0,.4)!important;
 background:var(--sem-ic,none) center 34%/clamp(52px,10.5vh,86px) no-repeat,radial-gradient(120% 80% at 50% 35%,#efe3c2,#dfcb9d)!important}
#seMenu.se-main .se-tiles>button:hover{filter:brightness(1.05)}
#seMenu.se-main .se-tiles>button:active{transform:translateY(1px)}
#seMenu.se-main .se-tiles>button>*:not(.pip):not(.badge):not(.sem-keep){display:none!important}
#seMenu.se-main .se-tiles>button::before{content:attr(data-sem-t)!important;position:absolute!important;left:6px;right:6px;bottom:clamp(22px,4vh,32px);display:block!important;z-index:1;
 font:800 clamp(13px,2.3vh,18px)/1.05 var(--sef-serif)!important;color:#5a3b1a!important;text-transform:uppercase;letter-spacing:.3px;text-align:center;white-space:normal}
#seMenu.se-main .se-tiles>button::after{content:attr(data-sem-s)!important;position:absolute!important;left:6px;right:6px;bottom:clamp(8px,1.6vh,14px);display:block!important;z-index:1;
 font:700 clamp(9.5px,1.55vh,12px)/1.1 Nunito,system-ui,sans-serif!important;color:#7d5f39!important;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:none!important;letter-spacing:0}
#seMenu.se-main .se-tiles>button.sem-feat{background:var(--sem-ic,none) center 42%/clamp(56px,11vh,90px) no-repeat,radial-gradient(120% 80% at 50% 35%,#8d5a2c,#6a421f)!important;
 border-color:#e7c569!important;box-shadow:inset 0 0 0 3px #7b4d24,inset 0 0 0 4px #d9b454,0 4px 12px rgba(0,0,0,.45)!important}
#seMenu.se-main .se-tiles>button.sem-feat::before{bottom:clamp(24px,4.4vh,34px);color:#3a260c!important}
#seMenu.se-main .se-tiles>button.sem-feat::after{color:#6b4410!important}
#seMenu.se-main .se-tiles>button.sem-feat .sem-plate{position:absolute;left:-2px;right:-2px;bottom:4px;height:clamp(42px,7.6vh,58px);background:linear-gradient(180deg,#f7dc7c,#dcb244);box-shadow:0 1px 3px rgba(0,0,0,.4)}
#seMenu.se-main .se-tiles>button.sem-feat .sem-ribbon{position:absolute;left:-2px;right:-2px;top:8px;padding:5px 2px 6px;text-align:center;background:linear-gradient(180deg,#be3a30,#8f2019);
 font:800 clamp(11px,1.9vh,15px)/1 var(--sef-serif);color:#fff;text-transform:uppercase;letter-spacing:.4px;box-shadow:0 2px 3px rgba(0,0,0,.4);text-shadow:0 1px 0 rgba(0,0,0,.35)}
#seMenu.se-main .se-tiles>button .sem-tag{position:absolute;left:7px;top:7px;display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;background:rgba(80,56,28,.16);
 font:900 clamp(10px,1.7vh,13px)/1.2 Nunito,system-ui,sans-serif;color:#6a4a26}
#seMenu.se-main .se-tiles>button .sem-tag svg{width:15px;height:15px}
#seMenu.se-main .se-tiles>button .pip,#seMenu.se-main .se-tiles>button .badge{position:absolute!important;top:7px!important;right:7px!important;left:auto!important;min-width:20px;height:20px;padding:0 6px;border-radius:10px;
 background:#d93a33!important;color:#fff!important;border:1.5px solid #fff!important;font:900 11px/17px Nunito,system-ui,sans-serif!important;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.35)}
#seMenu.se-main .se-tiles>button.sem-util-tile{display:none!important}
#seMenu.se-main .sem-foot{flex:none;display:flex;align-items:center;gap:12px;padding:0 18px clamp(8px,1.6vh,14px);font:700 11px/1 Nunito,system-ui,sans-serif;color:rgba(235,228,255,.7)}
#seMenu.se-main .sem-track{flex:none;height:5px;margin:0 18px 8px;border-radius:3px;background:rgba(0,0,0,.35);overflow:hidden}
#seMenu.se-main .sem-track i{display:block;height:100%;width:30%;border-radius:3px;background:linear-gradient(90deg,#e9cf8a,#d2ad5a)}
#seMenu.se-main .sem-foot .sem-sp{flex:1}
@media (max-width:760px){
 .se-fr.se-fr-tabs{padding-left:0!important;padding-top:calc(${TOP} + 70px)!important}
 .se-fr .mk-panel-body>.crow:has(> .tabbtn){top:${TOP};bottom:auto;right:0;width:auto!important;height:62px;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important}
 .se-fr .mk-panel-body>.crow:has(> .tabbtn)>.tabbtn{width:auto!important;min-width:76px;min-height:62px!important;border-bottom:0!important;border-right:1px solid rgba(255,255,255,.07)!important}
 .se-pill{min-width:0;padding:0 10px 0 28px;margin-left:10px}.se-pill>svg{width:30px;height:30px;left:-10px}
 #seMenu.se-main .sem-util,#seMenu.se-main .sem-promo{display:none}
 #seMenu.se-main .se-tiles{grid-auto-columns:128px!important}}`;
  document.head.appendChild(st);
 }

 /* ---------------------------------------------------------------- the strip ---------------- */
 function pills(list){
  return (list||['coins','gems']).map(k=>'<span class="se-pill" data-se-pill="'+k+'" title="'+(k==='coins'?'Coins':k==='gems'?'Gems':'Keys')+'">'+(k==='coins'?COIN:k==='gems'?GEM:KEY)+'<b>0</b></span>').join('');
 }
 function paintPills(root){
  const s=G.save.fresh()||{};
  root.querySelectorAll('[data-se-pill]').forEach(p=>{const k=p.dataset.sePill;const v=k==='coins'?s.coins:k==='gems'?s.gems:s.keys;const b=p.querySelector('b');const t=fmt(v);if(b&&b.textContent!==t)b.textContent=t;});
 }
 const strips=new Set();
 /* bar({icon,title,sub,back,close,pills}) -> the element; back and close are functions */
 function bar(o){
  const el=document.createElement('div'); el.className='se-strip';
  el.innerHTML='<button class="se-circ" data-se="back" title="Back" aria-label="Back">'+line('back','#fff',2.6)+'</button>'
   +'<span class="se-ttl">'+line(o.icon||'events','#fff',1.9)+'<span><b class="se-ttl-b"></b><small class="se-ttl-s"></small></span></span><span class="se-sp"></span>'
   +pills(o.pills)+'<button class="se-circ" data-se="close" title="Close" aria-label="Close">'+line('close','#fff',2.8)+'</button>';
  const setTitle=(t,s,ic)=>{el.querySelector('.se-ttl-b').textContent=t||'';const sm=el.querySelector('.se-ttl-s');sm.textContent=s||'';sm.style.display=s?'':'none';
   if(ic){const svg=el.querySelector('.se-ttl>svg');if(svg)svg.outerHTML=line(ic,'#fff',1.9);}};
  setTitle(o.title,o.sub);
  el.addEventListener('click',e=>{const b=e.target.closest('[data-se]');if(!b)return;e.stopPropagation();const f=b.dataset.se==='back'?(o.back||o.close):(o.close||o.back);if(f)f();});
  el.setTitle=setTitle; el.paint=()=>paintPills(el);
  strips.add(el); paintPills(el);
  return el;
 }
 G.on('wallet',()=>{for(const s of strips)if(s.isConnected)paintPills(s);});

 /* ---------------------------------------------------------------- covers + frames ----------
    cover(id,{show(P),hide(),refresh(P)}) — a rebuilt screen stands in for panel id whenever the
    panel is open. The panel itself stays open underneath, hidden, so its renderer, its buttons and
    its re-render calls carry on exactly as before. classic(id) shows the panel itself, framed. */
 const COVERS={}, FRAMED={
  questPanel:['journey','My Journey'],eventsPanel:['events','Riding Events'],stablePanel:['horses','My Horses'],lbPanel:['podium','Leaderboards'],
  onlinePanel:['club','Riding Club'],profilePanel:['character','Rider Profile'],buildPanel:['build','Build'],summonPanel:['season','Summon'],moneyPanel:['wallet','Wallet'],
  breedPanel:['foal','Breeding'],catalogPanel:['collection','Collection'],emotePanel:['emotes','Emotes'],inboxPanel:['inbox','Inbox'],pvpPanel:['race','Race Club'],
  riderPanel:['character','Your Rider'],stylePanel:['style','Horse Style'],treePanel:['studio','Bloodlines'],sheetPanel:['events','Score Sheet'],resultPanel:['podium','Results'],
  ev2CardPanel:['events','Class'],ev2ResultPanel:['podium','Results'],ev2SheetPanel:['events','Score Sheet']
 };
 let current=null; const backTo={};
 const top=bar({icon:'journey',title:'',close:()=>closePanel(current),back:()=>goBack()}); top.id='seFrameTop'; document.body.appendChild(top);
 const isOpen=P=>!!P&&P.style.display!=='none'&&P.style.display!=='';
 function closePanel(P){
  if(!P)return;
  const x=P.querySelector(':scope>.mk-panel-head>button:last-child,:scope>.ph>button:last-child');
  if(x&&/✖|✕|×|close/i.test(x.textContent+' '+(x.title||'')+' '+(x.getAttribute('aria-label')||'')))x.click();
  if(isOpen(P))P.style.display='none';
 }
 function goBack(){const P=current;if(!P)return;const to=backTo[P.id];delete backTo[P.id];P._seGoingBack=true;closePanel(P);P._seGoingBack=false;if(to)setTimeout(()=>{try{to();}catch(e){}},0);}
 const EMO=/^((?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator})(?:️|⃣|\p{Emoji_Modifier}|‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*)\s*(.*)$/u;
 function splitTabs(P){
  P.querySelectorAll('.mk-panel-body>.crow>.tabbtn').forEach(b=>{
   const txt=[...b.childNodes].filter(n=>!(n.classList&&(n.classList.contains('pip')||n.classList.contains('badge')))).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
   if(b.dataset.seTxt===txt)return;
   const m=txt.match(EMO);
   b.dataset.seTxt=txt; b.dataset.seG=m?m[1]:'•'; b.dataset.seL=m?m[2]:txt;
  });
 }
 function frame(P){
  const def=FRAMED[P.id]||['collection','Menu'];
  P.classList.add('se-fr'); P.classList.toggle('se-fr-tabs',!!P.querySelector('.mk-panel-body>.crow>.tabbtn'));
  splitTabs(P);
  if(current!==P){current=P; top.setTitle(def[1],'',def[0]);}
  document.body.classList.add('se-frame-open','se-screen-open'); paintPills(top);
 }
 function unframe(P){
  P.classList.remove('se-fr','se-fr-tabs');
  if(current===P){current=null;document.body.classList.remove('se-frame-open');}
 }
 function anyScreen(){return !!document.querySelector('.se-fr')||Object.keys(COVERS).some(k=>COVERS[k].on)||[...screens].some(f=>f());}
 const screens=new Set();   // other full screens (se-events' own sub-views) that keep the HUD down
 function settle(){if(anyScreen())document.body.classList.add('se-screen-open');else document.body.classList.remove('se-screen-open');}
 function sync(P){
  const C=COVERS[P.id];
  if(isOpen(P)){
   if(C&&!C.classic){ unframe(P); P.classList.add('se-covered');
    if(!C.on){C.on=true;try{C.show(P);}catch(e){console.error('se cover '+P.id,e);}} }
   else { P.classList.remove('se-covered'); if(C&&C.on){C.on=false;try{C.hide();}catch(e){}} frame(P); }
  }else{
   P.classList.remove('se-covered'); unframe(P);
   if(C){ C.classic=false; if(C.on){C.on=false;try{C.hide();}catch(e){}} }
   if(backTo[P.id]&&!P._seGoingBack)setTimeout(()=>{if(!isOpen(P))delete backTo[P.id];},0);
  }
  settle();
 }
 const watched=new Set();
 function watch(P){
  if(watched.has(P))return; watched.add(P);
  new MutationObserver(muts=>{
   let style=false,kids=false; for(const m of muts){if(m.type==='attributes')style=true;else kids=true;}
   if(style)sync(P);
   if(kids){
    if(P.classList.contains('se-fr')){P.classList.toggle('se-fr-tabs',!!P.querySelector('.mk-panel-body>.crow>.tabbtn'));splitTabs(P);}
    else if(COVERS[P.id]&&COVERS[P.id].on&&COVERS[P.id].refresh){try{COVERS[P.id].refresh(P);}catch(e){}}
   }
  }).observe(P,{attributes:true,attributeFilter:['style'],childList:true,subtree:true});
  sync(P);
 }
 function scan(){for(const id of new Set([...Object.keys(FRAMED),...Object.keys(COVERS)])){const P=$(id);if(P)watch(P);}}
 scan(); setTimeout(scan,1200); setTimeout(scan,5000); G.on('interval30',scan);
 function cover(id,def){COVERS[id]=Object.assign({on:false,classic:false},COVERS[id]||{},def);const P=$(id);if(P){if(watched.has(P))sync(P);else watch(P);}return COVERS[id];}
 function classic(id,back){const C=COVERS[id];if(C)C.classic=true;if(back)backTo[id]=back;const P=$(id);if(P)sync(P);}
 function setBack(id,fn){if(fn)backTo[id]=fn;else delete backTo[id];}
 function takeBack(id){const f=backTo[id];delete backTo[id];return f||null;}

 /* ---------------------------------------------------------------- the main menu ------------ */
 const menu=$('seMenu'), tiles=$('seTiles');
 if(menu&&tiles){
  menu.classList.add('se-main');
  const bar0=menu.querySelector('.se-bar'), sheet=menu.querySelector('.se-sheet');
  if(bar0&&!bar0.querySelector('.sem-badge')){
   const nameWrap=$('seMenuName')&&$('seMenuName').parentElement;
   const badge=document.createElement('span'); badge.className='sem-badge';
   badge.innerHTML=art('head',{b:'#fff',l:'#5a3fa6'})+'<span class="sem-lv" id="semLv" title="Ranch level">1</span>';
   if(nameWrap){bar0.insertBefore(badge,nameWrap);badge.appendChild(nameWrap);}
   const promo=document.createElement('button'); promo.className='sem-promo'; promo.type='button'; promo.id='semPromo';
   promo.innerHTML='<i id="semPromoTag">NEW</i><span><b id="semPromoT">Golden horseshoes</b><small id="semPromoS">Hidden on rocks and in the water</small></span>';
   const util=document.createElement('span'); util.className='sem-util';
   util.innerHTML=[['photo','poseBtn','Photo mode'],['graphics','qualBtn','Graphics'],['sound','muteBtn','Sound'],['gear','settingsBtn','Settings']]
    .map(u=>'<button class="se-circ" data-sem-util="'+u[1]+'" title="'+u[2]+'" aria-label="'+u[2]+'">'+line(u[0],'#fff',2)+'</button>').join('');
   const x=bar0.querySelector('.se-x'); bar0.insertBefore(promo,x); bar0.insertBefore(util,x);
   util.addEventListener('click',e=>{const b=e.target.closest('[data-sem-util]');if(!b)return;e.stopPropagation();const t=$(b.dataset.semUtil);if(t){menu.classList.remove('on');setTimeout(()=>t.click(),0);}});
   promo.addEventListener('click',e=>{e.stopPropagation();menu.classList.remove('on');try{G.run('sePromo');}catch(err){}});
  }
  if(sheet&&!sheet.querySelector('.sem-track')){
   const tr=document.createElement('div'); tr.className='sem-track'; tr.innerHTML='<i></i>'; sheet.appendChild(tr);
   const ft=document.createElement('div'); ft.className='sem-foot'; ft.innerHTML='<span>Meadowlark Ranch</span><span class="sem-sp"></span><span id="semFootR"></span>'; sheet.appendChild(ft);
   const paintTrack=()=>{const sw=tiles.scrollWidth,cw=tiles.clientWidth,i=tr.querySelector('i');if(!sw||sw<=cw+2){i.style.width='100%';i.style.marginLeft='0';return;}
    i.style.width=(cw/sw*100).toFixed(1)+'%';i.style.marginLeft=(tiles.scrollLeft/sw*100).toFixed(1)+'%';};
   tiles.addEventListener('scroll',paintTrack,{passive:true}); window.addEventListener('resize',paintTrack);
   /* a mouse wheel scrolls the tiles sideways, the way they run */
   tiles.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){tiles.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
   menu._paintTrack=paintTrack;
  }
  /* the tiles: where to go (the HUD's own buttons, clicked for you), then anything else the dock held */
  const clickId=idn=>()=>{const b=$(idn);if(b)setTimeout(()=>b.click(),30);};
  const openTab=(btn,re)=>()=>{const b=$(btn);if(!b)return;setTimeout(()=>{b.click();setTimeout(()=>{const t=[...document.querySelectorAll('.tabbtn')].find(x=>x.offsetParent!==null&&re.test((x.dataset.seL||'')+' '+x.textContent));if(t)t.click();},80);},30);};
  const MAIN=[
   {k:'market',t:'Market',s:'Horses, pets and more',go:clickId('shopBtn'),feat:'Free gifts'},
   {k:'journey',t:'Journey',s:'Quests and adventure',go:clickId('questBtn')},
   {k:'horses',t:'My Horses',s:'Your stable of horses',go:clickId('stableBtn'),tag:()=>{const n=((G.save.fresh()||{}).horses||[]).length;return n?line('horses','#6a4a26',2.2)+n:'';}},
   {k:'season',t:'Season Pass',s:'Rewards all season',go:openTab('questBtn',/season/i)},
   {k:'events',t:'Events',s:'Test your riding skills',go:clickId('eventsBtn')},
   {k:'treasure',t:'Treasures',s:'Hidden round the valley',go:()=>{try{G.run('seTreasures');}catch(e){}},need:()=>!!G.treasures,
    tag:()=>{const s=G.save.fresh()||{};return G.treasures?Object.keys((s.treasure&&s.treasure.found)||{}).length+'/'+G.treasures.total:'';}},
   {k:'foal',t:'Breeding',s:'Raise unique foals',go:clickId('breedBtn'),need:'breedBtn'},
   {k:'care',t:'Horse Care',s:'Groom, feed and bond',go:clickId('careBtn')},
   {k:'ranch',t:'Ranch',s:'Build your ranch',go:clickId('buildBtn'),need:'buildBtn'},
   {k:'podium',t:'Leaderboards',s:'Rankings and rewards',go:clickId('lbBtn')},
   {k:'club',t:'Riding Club',s:'Ride with friends',go:clickId('netBtn')},
   {k:'race',t:'Race Club',s:'Race other riders',go:clickId('pvpBtn'),need:'pvpBtn'},
   {k:'character',t:'Character',s:'Your rider\'s look',go:clickId('charBtn'),need:'charBtn'},
   {k:'style',t:'Horse Style',s:'Dress up your horse',go:clickId('styleBtn'),need:'styleBtn'},
   {k:'studio',t:'Breed Studio',s:'Design a horse',go:clickId('breedStudioBtn'),need:'breedStudioBtn'},
   {k:'collection',t:'Collection',s:'Every breed and coat',go:clickId('catalogBtn'),need:'catalogBtn'},
   {k:'inbox',t:'Inbox',s:'Letters and gifts',go:clickId('inboxBtn'),need:'inboxBtn',pipOf:'inboxBtn'},
   {k:'chat',t:'Chat',s:'Talk to your club',go:clickId('chatBtn'),need:'chatBtn'},
   {k:'emotes',t:'Emotes',s:'Wave, laugh and dance',go:clickId('emoteBtn'),need:'emoteBtn'},
   {k:'whistle',t:'Whistle',s:'Call your horse',go:clickId('whistleBtn'),need:'whistleBtn'}
  ];
  const HANDLED=new Set(MAIN.map(m=>typeof m.need==='string'?m.need:null).filter(Boolean).concat(['shopBtn','stableBtn','eventsBtn','questBtn','careBtn','lbBtn','netBtn','poseBtn','qualBtn','muteBtn','settingsBtn']));
  const GUESS=[[/breed/i,'foal'],[/style|groom/i,'style'],[/race|pvp/i,'race'],[/chat/i,'chat'],[/mail|inbox|letter/i,'inbox'],[/emote/i,'emotes'],[/char|rider/i,'character'],[/build|ranch/i,'ranch'],[/cat|collect/i,'collection'],[/whistle/i,'whistle'],[/map/i,'map']];
  function dressTiles(){
   let prev=null;
   for(const m of MAIN){
    const have=!m.need||(typeof m.need==='function'?m.need():!!$(m.need));
    let t=tiles.querySelector(':scope>[data-sem-main="'+m.k+'"]');
    if(!have){if(t)t.style.display='none';continue;}
    if(!t){t=document.createElement('button');t.type='button';t.dataset.semMain=m.k;t.dataset.semT=m.t;t.dataset.semS=m.s;
     t.style.setProperty('--sem-ic',artUri(m.k,m.feat?{b:'#f3d77c',l:'#6a421f',d:'#e2bb52'}:null));
     if(m.feat){t.classList.add('sem-feat');t.innerHTML='<span class="sem-plate sem-keep"></span><span class="sem-ribbon sem-keep">'+esc(m.feat)+'</span>';}
     t.addEventListener('click',()=>{try{m.go();}catch(e){}});}
    t.style.display='';
    if(m.tag){let g=t.querySelector('.sem-tag');const h=m.tag();if(h){if(!g){g=document.createElement('span');g.className='sem-tag sem-keep';t.appendChild(g);}if(g.dataset.h!==h){g.dataset.h=h;g.innerHTML=h;}}else if(g)g.remove();}
    if(m.pipOf){const src=$(m.pipOf),sp=src&&src.querySelector('.pip,.badge');const txt=sp?sp.textContent.trim():'';let p=t.querySelector('.pip');
     if(txt&&txt!=='0'){if(!p){p=document.createElement('span');p.className='pip';t.appendChild(p);}p.textContent=txt;}else if(p)p.remove();}
    const want=prev?prev.nextSibling:tiles.firstChild; if(t!==want)tiles.insertBefore(t,want); prev=t;
   }
   for(const b of [...tiles.children]){
    if(b.dataset.semMain)continue;
    const idn=b.id||'';
    if(HANDLED.has(idn)){b.classList.add('sem-util-tile');continue;}
    if(b.dataset.semT)continue;
    const title=(b.dataset.mkLabel||b.getAttribute('aria-label')||b.title||((b.querySelector('.mk-dk-lbl')||{}).textContent)||b.textContent||'').replace(/\p{Extended_Pictographic}|️/gu,'').trim().split(/[—(,·]/)[0].trim()||'More';
    const k=(GUESS.find(g=>g[0].test(idn+' '+title))||[0,'collection'])[1];
    b.dataset.semT=title.slice(0,22); b.dataset.semS=(b.title&&b.title!==title)?b.title.replace(/\p{Extended_Pictographic}|️/gu,'').trim().slice(0,40):''; b.style.setProperty('--sem-ic',artUri(k));
   }
   if(menu._paintTrack)setTimeout(menu._paintTrack,0);
  }
  function paintHead(){
   try{
    const s=G.save.fresh()||{}, h=(G.horse&&G.horse.ridden&&G.horse.ridden())||{};
    let L=1; try{L=G.ranchSys&&G.ranchSys.ranchLevel?G.ranchSys.ranchLevel(s):1;}catch(e){}
    const lv=$('semLv'); if(lv)lv.textContent=String(L);
    const nm=$('seMenuName'); if(nm)nm.textContent=String(s.name||s.playerName||'Your ranch');
    const sub=$('seMenuSub'); if(sub)sub.textContent=h.name?('with '+h.name+' Lv. '+(h.level||1)):'';
    const fr=$('semFootR'); if(fr)fr.textContent=(s.horses||[]).length+' horses · ranch level '+L;
    const pr=G.run('sePromoInfo');
    if(pr){$('semPromoTag').textContent=pr.tag||'NEW';$('semPromoT').textContent=pr.t||'';$('semPromoS').textContent=pr.s||'';}
    else if(G.treasures){const n=Object.keys((s.treasure&&s.treasure.found)||{}).length;$('semPromoTag').textContent=n?(n+'/'+G.treasures.total):'NEW';
     $('semPromoT').textContent='Golden horseshoes';$('semPromoS').textContent=n>=G.treasures.total?'You found every one!':'Hidden on rocks and in the water';}
    else $('semPromo').style.display='none';
   }catch(e){}
  }
  new MutationObserver(()=>{if(menu.classList.contains('on')){dressTiles();paintHead();}}).observe(menu,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>dressTiles()).observe(tiles,{childList:true});
  dressTiles();
  G.on('sePromo',()=>{try{G.run('seTreasures');}catch(e){}});
 }

 /* ---------------------------------------------------------------- snapshots ---------------
    snap({key,pos,look,fov,up,w,h,marks}) — a picture of the world from any viewpoint: the event
    screens show each venue as it really stands. It is taken in a tick, one a frame, straight onto the
    game's canvas and copied off it; the frame's own render follows in the same animation frame, so
    the view is never on screen. marks are world [x,z] points, handed back as where they fall in the
    picture (0..1), for a course drawn over it. Every <img data-snap="key"> gets the picture. */
 const SNAP=new Map(), SQ=[];
 function snap(v){
  let e=SNAP.get(v.key); if(e)return e;
  e={key:v.key,url:null,pts:null,fns:[]}; SNAP.set(v.key,e); SQ.push(v); return e;
 }
 function paintSnap(el,e){if(!e||!e.url)return;if(el.tagName==='IMG'){if(el.getAttribute('src')!==e.url)el.src=e.url;}else el.style.backgroundImage='url("'+e.url+'")';el.classList.add('se-snapped');}
 function shoot(v){
  const THREE=G.THREE, r=G.renderer, cv=r&&r.domElement; if(!THREE||!cv||!cv.width)return;
  const W=v.w||640, H=v.h||400, cw=cv.width, ch=cv.height, ar=W/H;
  let sw=cw, sh=cw/ar; if(sh>ch){sh=ch;sw=ch*ar;}
  const cam=new THREE.PerspectiveCamera(v.fov||50,cw/ch,0.5,4000);
  if(v.up)cam.up.set(v.up[0],v.up[1],v.up[2]);
  cam.position.set(v.pos[0],v.pos[1],v.pos[2]); cam.lookAt(v.look[0],v.look[1],v.look[2]); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  r.render(G.scene,cam);
  const out=document.createElement('canvas'); out.width=W; out.height=H;
  out.getContext('2d').drawImage(cv,(cw-sw)/2,(ch-sh)/2,sw,sh,0,0,W,H);
  const e=SNAP.get(v.key); if(!e)return;
  e.url=out.toDataURL('image/jpeg',0.84);
  if(v.marks){const p=new THREE.Vector3(), gh=(G.world&&G.world.groundH)||(()=>0);
   e.pts=v.marks.map(m=>{p.set(m[0],gh(m[0],m[1])+0.3,m[1]).project(cam);const u=((p.x+1)/2*cw-(cw-sw)/2)/sw, w=((1-p.y)/2*ch-(ch-sh)/2)/sh;return [+u.toFixed(4),+w.toFixed(4)];});}
  const fns=e.fns; e.fns=[]; for(const f of fns){try{f(e);}catch(err){}}
  document.querySelectorAll('[data-snap]').forEach(el=>{if(el.dataset.snap===v.key)paintSnap(el,e);});
 }
 G.on('tick',()=>{if(!SQ.length||document.hidden)return;const v=SQ.shift();try{shoot(v);}catch(err){console.error('se snap',err);}});

 /* ---------------------------------------------------------------- QA + the kit ------------- */
 G.on('state',o=>{o.seFrame={framed:current?current.id:null,covers:Object.keys(COVERS).filter(k=>COVERS[k].on),
  menuTiles:tiles?[...tiles.children].filter(b=>b.offsetParent!==null&&b.dataset.semT).map(b=>b.dataset.semT):[]};});
 G.seFrame={art,artUri,line,COIN,GEM,KEY,RIBBON,bar,pills,paintPills,cover,classic,setBack,takeBack,settle,screens,snap,paintSnap,snaps:SNAP,
  frame:id=>{const P=$(id);if(P)frame(P);},framed:()=>current?current.id:null,covers:COVERS,isOpen,esc,fmt,ART,LINE};
}
