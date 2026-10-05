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
   The main menu is a ranch journal: persistent categories and search, the current adventure
   over an illustrated valley, and compact destinations with clear labels.

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
  gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S12 9 12 9zM12 9c1.5-3 5-4 5-1.5S12 9 12 9z"/>',
  calendar:'<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  trophy:'<path d="M8 4h8v4.5a4 4 0 0 1-8 0zM8 6H5.2a2.8 2.8 0 0 0 3.1 3.9M16 6h2.8a2.8 2.8 0 0 1-3.1 3.9M12 12.5V16M9 20h6M10 16h4v4h-4z"/>',
  egg:'<path d="M12 3c-3.6 0-6.5 6-6.5 10a6.5 6.5 0 0 0 13 0C18.5 9 15.6 3 12 3z"/>',
  compass:'<circle cx="12" cy="12" r="8.6"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  pin:'<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  paw:'<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 5.5 0 2 2 2.5 5.5 1.5 3.5 1 5.5.5 5.5-1.5 0-2-2.5-5.5-5.5-5.5z"/>',
  food:'<path d="M12 8c-3-2.5-7-1-7 3.5S8 20 12 20s7-4 7-8.5S15 5.5 12 8z"/><path d="M12 8c0-2 1-3.5 2.5-4"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2M10 2.5h4"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
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
.se-strip .se-ttl{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto;overflow:hidden}
/* the words shrink before the coins do: a long event name ends in an ellipsis, never under the coin pill; the pills
   themselves never shrink (squeezed, the count slid under its own coin: 325 read as 25) */
.se-strip .se-ttl>span{min-width:0;overflow:hidden}
.se-strip .se-pill,.se-strip .se-circ{flex:none}
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
body.se-screen-open #toasts{z-index:14!important;top:auto!important;bottom:calc(22px + env(safe-area-inset-bottom))!important}
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
.se-fr>.mk-panel-head{position:static!important;margin-top:0!important;margin-bottom:10px!important;padding:7px 14px!important;border-radius:10px!important;min-height:0!important;
 background:rgba(26,24,52,.72)!important;border:1px solid rgba(255,255,255,.16)!important;color:#f3efff!important;font:800 14px/1.3 Nunito,system-ui,sans-serif!important;
 display:flex!important;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:none!important;backdrop-filter:none!important}
.se-fr>.mk-panel-head *{color:#f3efff!important;font-family:Nunito,system-ui,sans-serif}
.se-fr>.mk-panel-head .chip{background:rgba(255,255,255,.14)!important;border:0!important;border-radius:14px!important;padding:3px 10px!important}
/* a button the head keeps (Rename on the care sheet) is a chip on the dark strip: light ink on its old cream face could not be read */
.se-fr>.mk-panel-head button{background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:14px!important;box-shadow:none!important;padding:3px 10px!important;min-height:0!important}
.se-fr>.mk-panel-head>button:last-child,.se-fr .mk-x{display:none!important}
/* tabs: the dark column down the left, a picture over each name */
.se-fr .mk-panel-body>.crow.se-tabcol{position:fixed!important;left:0;top:${TOP};bottom:0;width:${SIDE}!important;z-index:2;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
 gap:0!important;margin:0!important;padding:0!important;overflow-y:auto!important;overflow-x:hidden!important;background:linear-gradient(180deg,#2a2760,#1d1b47)!important;
 box-shadow:3px 0 10px rgba(0,0,0,.35)!important;border:0!important;border-radius:0!important;-webkit-mask-image:none!important;mask-image:none!important;scrollbar-width:none}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn{position:relative;flex:none;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%!important;min-height:64px!important;
 margin:0!important;padding:8px 4px!important;border:0!important;border-radius:0!important;border-bottom:1px solid rgba(255,255,255,.07)!important;background:transparent!important;box-shadow:none!important;
 font-size:0!important;color:transparent!important;white-space:normal}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn>*:not(.pip):not(.badge){display:none!important}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn::before{content:'';width:25px;height:25px;background:#f3efff;-webkit-mask:var(--se-tic) center/contain no-repeat;mask:var(--se-tic) center/contain no-repeat}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn.on::before{background:#4a3519}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn::after{content:attr(data-se-l);font:800 11.5px/1.1 Nunito,system-ui,sans-serif;color:#e9e4ff;text-align:center;max-width:100%;overflow-wrap:anywhere}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn.on{background:linear-gradient(180deg,var(--sef-cream),var(--sef-cream2))!important}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn.on::after{color:var(--sef-ink)}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn:hover:not(.on){background:rgba(255,255,255,.08)!important}
.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn .pip,.se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn .badge{position:absolute;top:6px;right:8px;font-size:10px!important;color:#fff!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn):not(.se-tabcol){background:rgba(22,20,44,.8)!important;border-radius:10px!important;padding:6px 10px!important;gap:6px!important;flex-wrap:wrap!important;border:0!important;box-shadow:none!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn):not(.se-tabcol)>.lbl,.se-fr .mk-panel-body>.crow:has(> .tabbtn):not(.se-tabcol)>span{color:#f1ecff!important;background:none!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn):not(.se-tabcol)>.tabbtn{background:linear-gradient(180deg,#fdf8ea,#ecdfc2)!important;color:#3b2a17!important;border:0!important;border-radius:14px!important;padding:4px 12px!important;min-height:0!important;font-weight:800!important}
.se-fr .mk-panel-body>.crow:has(> .tabbtn):not(.se-tabcol)>.tabbtn.on{background:linear-gradient(180deg,var(--sef-gold1),var(--sef-gold2))!important;color:#3a2a10!important}
/* rows: cream cards */
.se-fr .qrow,.se-fr .evrow,.se-fr .c2-blk,.se-fr .passCard,.se-fr .ui2-srow,.se-fr .lbrow,.se-fr .clubRow,.se-fr .mk-panel-body>.crow:not(:has(> .tabbtn)),.se-fr .mk-card{
 background:linear-gradient(180deg,#f7f0de,#ece0c3)!important;border:1.5px solid #d6c298!important;border-radius:10px!important;box-shadow:0 3px 8px rgba(0,0,0,.28)!important;color:var(--sef-ink)!important}
/* the club ladder's rows were bare brown words on the dimmed world; as cards they read, and your own club keeps its green */
.se-fr .clubRow{padding:6px 10px!important;font-size:13px}
.se-fr .clubRow.me{background:linear-gradient(180deg,#e9f5dc,#d3e8bd)!important;border-color:#94c06e!important}
/* words that sit straight on the world, outside any card, get a dark plate of their own and light ink, whatever colour
   their renderer wrote them in (they were written for a cream panel, and brown on a dimmed meadow cannot be read).
   A class-less wrapper that holds cards of its own is structure, not a note: it stays clear, and its cards keep theirs. */
.se-fr .mk-panel-body>:is(span,p,small,a,b,strong,.bGroup,.sub,.ladSheet,details,.ev2card,.ladCard),.se-fr .mk-panel-body>div:not([class]):not(:has(> div[class])),#onlinePanel.se-fr .c3-pane>:is(span,p,small,b:not(.c3-sec),details,.c3-note,.sub,div:not([class])){
 background:rgba(22,20,44,.82)!important;border-radius:8px!important;padding:7px 12px!important;color:#f1ecff!important;text-shadow:none!important;box-shadow:0 2px 6px rgba(0,0,0,.25);opacity:1!important}
:is(.se-fr .mk-panel-body>:is(span,p,small,a,b,strong,.bGroup,.sub,.ladSheet,details,.ev2card,.ladCard),.se-fr .mk-panel-body>div:not([class]):not(:has(> div[class])),#onlinePanel.se-fr .c3-pane>:is(span,p,small,b:not(.c3-sec),details,.c3-note,.sub,div:not([class]))) :is(span,b,i,em,small,strong,p,div,label,summary,td,th,li):not(button *):not(.chip):not(.badge):not(.pip):not(.noe):not(.noe-t):not(.mk-card *):not(.evrow *):not(.qrow *):not(.c3-group *):not(.c3-card *):not(.passCard *):not(.lbrow *):not(.c2-blk *):not(.ui2-srow *):not(.clubRow *){color:#f1ecff!important}
:is(.se-fr .mk-panel-body>:is(span,p,small,a,b,strong,.bGroup,.sub,.ladSheet,details,.ev2card,.ladCard),.se-fr .mk-panel-body>div:not([class]):not(:has(> div[class])),#onlinePanel.se-fr .c3-pane>:is(span,p,small,b:not(.c3-sec),details,.c3-note,.sub,div:not([class]))) :is(.me,.you,.mine,[data-me]){color:#ffd970!important}
.se-fr .mk-panel-body>div:not([class]):has(> div[class]){background:transparent!important;padding:0!important;box-shadow:none!important;color:inherit}
.se-fr .mk-panel-body>:is(b,strong,.bGroup){display:block;font:800 clamp(14px,2.3vh,17px)/1.25 var(--sef-serif)!important;letter-spacing:.5px;text-transform:uppercase;color:#f3d77f!important}
.se-fr .mk-panel-body>.ph>span,.se-fr .mk-panel-body>.ph>b{color:#fff!important}
.se-fr .mk-panel-body a,.se-fr .mk-panel-body>div:not([class]) a{color:#ffd970!important;text-decoration-color:rgba(255,217,112,.5)}
#onlinePanel.se-fr .c3-pane>.crow>span,#onlinePanel.se-fr .c3-pane>.crow>.lbl,#onlinePanel.se-fr #pidOnline{color:#f1ecff!important}
/* a Build group is a white box of its own inside the plate: its header and the icons on its pieces keep the card's dark ink */
.se-fr .c3-group{color:var(--sef-ink)!important}
.se-fr .c3-group>summary,.se-fr .c3-group>summary *{color:var(--sef-ink)!important}
/* the club's section heads and notes are gold and light only where they sit on the world; inside a cream card they keep dark ink */
#onlinePanel.se-fr b.c3-sec:not(.evrow *):not(.mk-card *):not(.c3-card *):not(.passCard *){color:#f3d77f!important;font:800 clamp(14px,2.3vh,17px)/1.25 var(--sef-serif)!important;letter-spacing:.5px;text-transform:uppercase;text-shadow:0 1px 2px #000}
#onlinePanel.se-fr .c3-note:not(.evrow *):not(.mk-card *):not(.c3-card *):not(.passCard *)>summary,#onlinePanel.se-fr .c3-note:not(.evrow *):not(.mk-card *):not(.c3-card *):not(.passCard *) .c3-noteBody{color:#f1ecff!important}
#onlinePanel.se-fr :is(.evrow,.mk-card,.c3-card,.passCard) :is(b.c3-sec,.c3-note>summary,.c3-noteBody){color:var(--sef-ink)!important;text-shadow:none!important}
/* the care sheet (More care…) was drawn for a cream page, section heads, meters and all, with no cards of its own: in
   the frame its words sat brown on the dimmed world. It keeps its page, as one card. Its head's own close goes (the bar has one). */
#carePanel.se-fr>.mk-panel-body{background:linear-gradient(180deg,#f7f0de,#ece0c3)!important;border:1.5px solid #d6c298!important;border-radius:12px!important;
 box-shadow:0 3px 10px rgba(0,0,0,.3)!important;padding:14px 16px 20px!important;flex:0 1 auto!important;margin-bottom:18px!important;color:var(--sef-ink)}
#carePanel.se-fr .mk-panel-body>div:not([class]){background:transparent!important;color:#6b5842!important;box-shadow:none!important;padding:0!important}
#carePanel.se-fr .mk-panel-body>div:not([class]) *{color:inherit!important}
.se-fr>.mk-panel-head button[title="Close"],.se-fr>.mk-panel-head button[aria-label^="Close"]{display:none!important}
/* a locked or not-yet row is shown as a muted card, not a see-through one */
.se-fr .qrow[style*="opacity"],.se-fr .evrow[style*="opacity"]{opacity:1!important;background:linear-gradient(180deg,#e7ddc8,#d9ccb0)!important;color:#5a4a38!important}
.se-fr .mk-panel-body>div:not([class]):empty,.se-fr .mk-panel-body>span:empty{display:none!important}
.se-fr .c2-sechead,.se-fr .mk-panel-body>.ph,.se-fr .mk-section{margin:14px 2px 2px!important;padding:0 0 5px!important;border:0!important;border-bottom:2px solid rgba(233,210,150,.55)!important;
 background:transparent!important;color:#fff!important;font:800 clamp(15px,2.5vh,19px)/1.2 var(--sef-serif)!important;letter-spacing:.7px;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,.5);box-shadow:none!important}
.se-fr button.claimBtn{background:linear-gradient(180deg,var(--sef-gold1),var(--sef-gold2))!important;color:#3a2a10!important;border:0!important;border-radius:8px!important;
 font:800 13.5px/1.1 var(--sef-serif)!important;letter-spacing:.3px;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 0 rgba(120,80,0,.25),0 2px 3px rgba(0,0,0,.25)!important}
.se-fr .mk-panel-body button:not(.claimBtn):not(.tabbtn):not(.se-circ){background:linear-gradient(180deg,#fdf8ea,#ecdfc2)!important;color:var(--sef-ink)!important;border:1px solid #cdb68a!important;border-radius:8px!important;
 font-weight:800!important;box-shadow:inset 0 -2px 0 rgba(90,60,20,.14),0 1px 2px rgba(0,0,0,.2)!important}
.se-fr button:disabled{opacity:.55;filter:grayscale(.5)}
.se-fr input,.se-fr select,.se-fr textarea{background:#fffaf0!important;color:var(--sef-ink)!important;border:1px solid #cdb68a!important;border-radius:8px!important}
/* the faint grey-browns written inline all over the game fail on a cream card; they read one step darker everywhere */
[style*="color:#b8a98a"],[style*="color:#b8a888"],[style*="color: #b8a98a"],[style*="color:#b0a080"]{color:#6f5f4b!important}
[style*="color:#8c7a63"],[style*="color: #8c7a63"],[style*="color:#9a8770"]{color:#5e4e3c!important}
#seFrameTop{display:none}
body.se-frame-open #seFrameTop{display:flex}
/* A ranch journal: navigation stays put, the current adventure leads the home screen. */
#seMenu.se-main{z-index:60;background:rgba(13,30,25,.6)!important;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);padding:28px;align-items:center!important;justify-content:center!important}
#seMenu.se-main .se-sheet{display:grid!important;grid-template-columns:184px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;width:min(1100px,100%)!important;height:690px!important;max-height:calc(100dvh - 56px)!important;min-height:0;border:1px solid #f2ecdc66!important;border-radius:20px!important;background:#f8f5ec!important;box-shadow:0 28px 100px #061c1aaa!important;overflow:hidden}
#seMenu.se-main .se-bar{grid-column:2;grid-row:1;background:transparent!important;border:0!important;padding:24px 30px 16px!important;gap:18px;align-items:center;box-shadow:none}
#seMenu.se-main .se-bar>span:first-child{min-width:0;flex:1}
#seMenu.se-main .se-bar b{font:400 29px/1.2 Georgia,serif;color:#203f35;letter-spacing:-.7px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#seMenu.se-main .se-bar small{display:block;font:12px/1.5 system-ui,sans-serif;color:#768174;margin-top:5px}
#seMenu.se-main .se-bar br{display:none}
#seMenu.se-main .se-x{width:auto;min-width:112px;height:42px;min-height:42px;padding:0 14px;border:1px solid #d4dacc;border-radius:8px;background:transparent;color:#355646;font:600 12px/1 system-ui;white-space:nowrap;flex:none;box-shadow:none!important}
.sem-controls{grid-column:1;grid-row:1 / 4;padding:30px 16px 20px;display:flex;flex-direction:column;gap:24px;min-width:0;background:#1e4135;color:#f3eedc;border-right:1px solid #173b2e}
.sem-brand{text-align:center;display:flex;flex-direction:column;align-items:center;gap:9px;padding:0 0 22px;border-bottom:1px solid #c7d5be24}
.sem-brand>svg{width:49px;height:49px;opacity:.95}
.sem-brand strong{font:600 11px/1.2 system-ui;letter-spacing:2px}.sem-brand small{font:10px/1.4 system-ui;letter-spacing:4px;color:#d2d3b5}
.sem-categories{display:flex;gap:7px;flex-direction:column}
.sem-categories button{display:flex;align-items:center;gap:11px;background:transparent!important;color:#d6dfca!important;border:1px solid transparent!important;box-shadow:none!important;border-radius:8px!important;min-height:46px;padding:10px 12px;font:500 13px/1.2 system-ui;text-align:left;white-space:nowrap}
.sem-categories button svg{width:19px;height:19px;opacity:.75;flex:none}
.sem-categories button:hover{background:#ffffff0b!important;color:#fff!important}
.sem-categories button[aria-pressed="true"]{background:#e9dfb6!important;color:#234838!important;border-color:#e9dfb6!important;font-weight:650}
.sem-search-label{margin-top:auto;display:block;position:relative;width:100%}
.sem-search-label>span{font:10px/1.4 system-ui;letter-spacing:1px;text-transform:uppercase;color:#bcccb4;display:block;margin:0 0 8px 3px}
.sem-search{width:100%;min-width:0;border:1px solid #d0dac64a!important;border-radius:8px!important;background:#17392e!important;color:#fcf9ee!important;font:12px/1.3 system-ui!important;padding:12px 10px!important;height:42px;box-shadow:none!important}
.sem-search::placeholder{color:#b9c8b2}.sem-search::-webkit-search-cancel-button{filter:grayscale(1) brightness(2)}
.sem-side-note{font:11px/1.6 system-ui;color:#b9c8b2;text-align:center}
.sem-body{grid-column:2;grid-row:2;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 30px 22px;scrollbar-width:thin;scrollbar-color:#bdcab6 transparent}
.sem-hero{position:relative;isolation:isolate;min-height:190px;overflow:hidden;border:1px solid #dbdec7;border-radius:12px;background:#e6e5ce;padding:23px;display:flex;align-items:center}
.sem-hero[hidden]{display:none!important}
.sem-hero-art{position:absolute;inset:0 0 0 auto;width:67%;z-index:-1;pointer-events:none}
.sem-hero-art>svg{display:block;width:100%;height:100%;object-fit:cover}
.sem-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#e6e5ce 25%,#e6e5cee0 39%,#e6e5ce00 66%);z-index:-1;pointer-events:none}
.sem-hero-copy{max-width:55%}.sem-eyebrow{display:block;font:700 9px/1.4 system-ui;letter-spacing:1.4px;text-transform:uppercase;color:#5a7056}
.sem-hero h2{font:400 clamp(24px,2.6vw,32px)/1.1 Georgia,serif;letter-spacing:-.65px;color:#243f30;margin:9px 0 10px;text-wrap:balance}
.sem-hero p{font:12px/1.5 system-ui;color:#5e7057;margin:0 0 17px;text-wrap:pretty}
.sem-ride{display:inline-flex;align-items:center;gap:24px;min-height:42px;padding:11px 16px!important;background:#214e3b!important;border:1px solid #214e3b!important;border-radius:7px!important;box-shadow:0 3px 0 #163a2e20!important;color:#fffbee!important;font:600 12px/1 system-ui!important}
.sem-ride:hover{background:#306047!important;transform:translateY(-1px)}
.sem-ridden{position:absolute;right:16px;bottom:14px;border:1px solid #eceddb66;border-radius:6px;padding:7px 10px;background:#163d2cbd;color:#fffbee;font:11px/1.3 system-ui;backdrop-filter:blur(5px)}
.sem-section{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:23px 0 13px}
.sem-section h2{font:400 20px/1.2 Georgia,serif;color:#294b3d;margin:0}.sem-section span{font:11px/1.4 system-ui;color:#7c8677;text-align:right}
#seMenu.se-main .se-tiles{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:none!important;grid-auto-flow:row!important;grid-auto-columns:auto!important;gap:10px!important;padding:0!important;overflow:visible!important;min-height:0;align-content:start;background:transparent!important}
#seMenu.se-main .se-tiles>button{position:relative;display:grid!important;grid-template-columns:40px minmax(0,1fr) 14px!important;grid-template-rows:auto auto!important;align-items:center!important;align-content:center!important;justify-content:normal!important;column-gap:13px!important;row-gap:4px!important;min-height:78px!important;height:auto!important;width:auto!important;padding:13px!important;background:#fffdf7!important;color:#244c40!important;border:1px solid #dee1d2!important;border-radius:10px!important;box-shadow:0 2px 2px #25422a03!important;text-align:left;overflow:hidden;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
#seMenu.se-main .se-tiles>button:hover{background:#f2f5e8!important;border-color:#a8b99a!important;transform:translateY(-2px);box-shadow:0 5px 12px #3045290a!important}
#seMenu.se-main .se-tiles>button::before,#seMenu.se-main .se-tiles>button::after{display:none!important;content:none!important}
#seMenu.se-main .sem-icon{display:flex!important;align-items:center;justify-content:center;grid-column:1;grid-row:1 / 3;width:40px;height:44px;padding:8px;border-radius:10px;background:#eaf0df;color:#5c7750}
#seMenu.se-main .sem-icon svg{width:100%;height:100%}
#seMenu.se-main [data-sem-main="journey"] .sem-icon{background:#f4e8c9}#seMenu.se-main [data-sem-main="events"] .sem-icon{background:#e5ecf2}#seMenu.se-main [data-sem-main="market"] .sem-icon{background:#f2e3d9}#seMenu.se-main [data-sem-main="character"] .sem-icon{background:#eee4ee}
#seMenu.se-main .sem-title{grid-column:2;grid-row:1;display:block!important;font:650 14px/1.25 system-ui,sans-serif!important;color:#2a4939!important;letter-spacing:0!important;text-transform:none!important}
#seMenu.se-main .sem-description{grid-column:2;grid-row:2;display:block!important;font:12px/1.4 system-ui,sans-serif!important;color:#7b8475!important;letter-spacing:0!important;text-transform:none!important}
#seMenu.se-main .sem-arrow{grid-column:3;grid-row:1 / 3;color:#9ba78f;font:17px/1 system-ui}
#seMenu.se-main .se-tiles>button.sem-util-tile,#seMenu.se-main .se-tiles>button[hidden]{display:none!important}
#seMenu.se-main .se-tiles .pip{position:absolute!important;top:4px!important;right:4px!important;left:auto!important;background:#be8848!important;border:2px solid #fffdf7!important;box-shadow:none!important;font:600 9px/14px system-ui!important;min-width:18px;height:18px;padding:0 3px;color:#fff}
.sem-empty{grid-column:1/-1;padding:32px 15px;font:13px/1.6 system-ui;color:#6e7c64;text-align:center;border:1px dashed #b9c7ac;border-radius:10px;margin:0}.sem-empty[hidden]{display:none}
.sem-foot{grid-column:2;grid-row:3;display:flex;align-items:center;gap:16px;padding:10px 30px;border-top:1px solid #e0e3d4;font:11px/1.5 system-ui;color:#7a8570;background:#f8f5ec}
.sem-foot .sem-sp{flex:1}.sem-foot button{border:0!important;box-shadow:none!important;background:none!important;color:#456545!important;padding:7px 0!important;min-height:36px!important;font:600 12px/1.3 system-ui!important}
#seMenu button:focus-visible,#seMenu input:focus-visible{outline:3px solid #c39342!important;outline-offset:3px!important}
@media(prefers-reduced-motion:reduce){#seMenu.se-main .se-tiles>button,.sem-ride{transition:none!important;transform:none!important}}
@media(max-width:760px){
 #seMenu.se-main{padding:12px}#seMenu.se-main .se-sheet{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;max-height:calc(100dvh - 24px)!important;height:800px!important;border-radius:15px!important}
 #seMenu.se-main .se-bar{grid-column:1;grid-row:1;padding:20px 20px 15px!important;gap:12px!important}
 #seMenu.se-main .se-bar b{font-size:23px}#seMenu.se-main .se-bar small{font-size:11px}
 #seMenu.se-main .se-x{min-width:0;width:38px;height:38px;min-height:38px;font-size:0;padding:0}.se-x::after{content:'×';font:25px/1 system-ui}
 .sem-controls{grid-column:1;grid-row:2;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:0 20px 14px;background:transparent;border:0;border-bottom:1px solid #e0e3d4}
 .sem-brand,.sem-side-note,.sem-search-label>span{display:none}.sem-search-label{grid-row:1;margin:0}
 .sem-search{height:38px;background:#efeee2!important;color:#365642!important;border-color:#d9ddcc!important;font-size:12px!important;padding:10px 12px!important}.sem-search::placeholder{color:#839078}
 .sem-categories{flex-direction:row;gap:5px;justify-content:space-between}.sem-categories button{justify-content:center;gap:0;flex:1;padding:9px 5px;min-height:40px;color:#5e745d!important;font-size:11px;font-weight:600}.sem-categories button svg{display:none}.sem-categories button[aria-pressed="true"]{background:#284e3a!important;color:#fffbed!important;border-color:#284e3a!important}
 .sem-body{grid-column:1;grid-row:3;padding:16px 20px 20px}.sem-hero{min-height:177px;padding:20px}.sem-hero-copy{max-width:65%}.sem-hero h2{font-size:24px}.sem-hero p{font-size:10px;margin-bottom:13px}.sem-hero-art{width:85%;right:-35px}.sem-hero::after{background:linear-gradient(90deg,#e6e5ce 12%,#e6e5cee8 28%,#e6e5ce00 72%)}.sem-ridden{display:none}.sem-ride{font-size:11px!important;padding:10px 12px!important;min-height:38px;gap:14px}.sem-eyebrow{font-size:8px}
 .sem-section{margin-top:19px}.sem-section h2{font-size:19px}.sem-section span{display:none}
 #seMenu.se-main .se-tiles{grid-template-columns:minmax(0,1fr)!important;gap:8px!important}
 #seMenu.se-main .se-tiles>button{min-height:72px!important;padding:13px!important;grid-template-columns:36px minmax(0,1fr) 14px!important;column-gap:12px!important}
 #seMenu.se-main .sem-icon{width:36px;height:38px;padding:7px}#seMenu.se-main .sem-description{font-size:10px!important}
 #seMenu[data-menu-view="home"] #seTiles{grid-template-columns:repeat(2,minmax(0,1fr))!important}
 #seMenu[data-menu-view="home"] #seTiles>button{grid-template-columns:28px minmax(0,1fr)!important;grid-template-rows:1fr!important;gap:8px!important;min-height:76px!important;padding:12px 10px!important}
 #seMenu[data-menu-view="home"] #seTiles .sem-icon{grid-row:1;width:28px;height:34px;padding:4px;background:transparent}
 #seMenu[data-menu-view="home"] #seTiles .sem-title{font-size:12px!important;grid-row:1}
 #seMenu[data-menu-view="home"] #seTiles :is(.sem-description,.sem-arrow){display:none!important}
 .sem-foot{grid-column:1;grid-row:4;padding:9px 20px;gap:12px;font-size:10px}.sem-foot button{font-size:11px!important}
}
@media(max-height:540px) and (min-width:761px){#seMenu.se-main{padding:10px}#seMenu.se-main .se-sheet{max-height:calc(100dvh - 20px)!important;grid-template-columns:164px minmax(0,1fr)}.sem-controls{padding:18px 12px;gap:14px}.sem-brand{display:none}.sem-side-note{display:none}.sem-categories{gap:3px}.sem-categories button{min-height:40px}#seMenu.se-main .se-bar{padding:18px 24px 14px!important}.sem-body{padding:0 24px 18px}.sem-hero{min-height:170px;padding:20px}.sem-hero h2{font-size:26px}.sem-foot{padding:8px 24px}}
@media (max-width:760px){
 .se-fr.se-fr-tabs{padding-left:0!important;padding-top:calc(${TOP} + 70px)!important}
 .se-fr .mk-panel-body>.crow.se-tabcol{top:${TOP};bottom:auto;right:0;width:auto!important;height:62px;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important}
 .se-fr .mk-panel-body>.crow.se-tabcol>.tabbtn{width:auto!important;min-width:76px;min-height:62px!important;border-bottom:0!important;border-right:1px solid rgba(255,255,255,.07)!important}
 /* a phone's strip: the title gives way first (no subtitle, an ellipsis), then the pills come down a size */
 .se-strip{gap:8px;padding:0 10px}
 .se-strip .se-ttl{gap:6px}
 .se-strip .se-ttl small{display:none!important}
 .se-pill{min-width:0;height:26px;padding:0 8px 0 23px;margin-left:8px;font-size:13px}.se-pill>svg{width:26px;height:26px;left:-9px}
 /* The frame is a little narrower than the old sheet, and at 390px the Build catalogue fell from two columns of pieces to
    one: a third longer to scroll. A tighter gutter and a narrower column keep it at two. */
 .se-fr>*{width:calc(100% - 16px)!important}
 #buildPanel.se-fr .c3-grid{grid-template-columns:repeat(auto-fill,minmax(136px,1fr))!important}
 #buildPanel.se-fr .c3-group{padding:2px 6px!important}}`;
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
  riderPanel:['character','Your Rider'],stylePanel:['style','Horse Style'],treePanel:['studio','Bloodlines'],sheetPanel:['collection','Horse Sheet'],resultPanel:['podium','Event Card'],
  ev2CardPanel:['events','Class'],ev2ResultPanel:['podium','Results'],ev2SheetPanel:['events','Score Sheet'],
  /* More care… and Settings opened the old centred cream card with the whole live HUD still round it */
  carePanel:['care','Horse Care'],settingsPanel:['gear','Settings']
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
 const TAB_IC=[[/story|journey|chapter|book/i,'journey'],[/side|errand|odd job/i,'map'],[/welcome|gift|reward/i,'gift'],[/season|pass/i,'season'],[/daily|today|week/i,'calendar'],
  [/achiev|medal|trophy/i,'trophy'],[/collect|catalog|album|codex/i,'collection'],[/master|skill|star/i,'star'],[/foal|breed|lineage|blood/i,'foal'],[/co-?op|club|friend|team|member|online/i,'club'],
  [/hunt|egg/i,'egg'],[/horizon|explor|travel|region|world/i,'compass'],[/board|rank|leader|ladder|podium/i,'podium'],[/race|pvp|rival/i,'race'],[/event|show|class|compet/i,'events'],
  [/build|piece|decor|ranch|land|furniture/i,'build'],[/horse|stable|herd|stall/i,'horses'],[/style|dye|look|groom|coat/i,'style'],[/pet/i,'paw'],[/food|feed|recipe/i,'food'],[/care|health|bond/i,'heart'],
  [/setting|option|control/i,'gear'],[/chat|message/i,'chat'],[/emote|dance/i,'emotes'],[/inbox|mail|letter/i,'inbox'],[/wallet|money|coin|gem|bank/i,'wallet'],[/shop|market|store|buy/i,'market'],
  [/treasure|chest|find/i,'treasure'],[/map|route|trail/i,'map'],[/time|history|log/i,'clock'],[/all|list|overview|summary/i,'list']];
 const tabIcon=lbl=>{const m=TAB_IC.find(t=>t[0].test(lbl));return m?m[1]:'sparkle';};
 const tabUri={}; const tabMask=k=>tabUri[k]||(tabUri[k]='url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(line(k,'#000',2.1))+'")');
 function splitTabs(P){
  P.querySelectorAll('.mk-panel-body>.crow>.tabbtn').forEach(b=>{
   const txt=[...b.childNodes].filter(n=>!(n.classList&&(n.classList.contains('pip')||n.classList.contains('badge')))).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
   if(b.dataset.seTxt===txt)return;
   const m=txt.match(EMO);
   b.dataset.seTxt=txt; b.dataset.seL=(m?m[2]:txt).trim()||txt; b.style.setProperty('--se-tic',tabMask(tabIcon(b.dataset.seL)));
  });
  /* only the first row of tabs is the column down the left; a second row (a filter under it) stays where it is, as pills */
  const rows=[...P.querySelectorAll(':scope>.mk-panel-body>.crow')].filter(r=>r.querySelector(':scope>.tabbtn'));
  rows.forEach((r,i)=>r.classList.toggle('se-tabcol',i===0));
 }
 function frame(P){
  const def=FRAMED[P.id]||['collection','Menu'];
  P.classList.add('se-fr'); splitTabs(P); P.classList.toggle('se-fr-tabs',!!P.querySelector('.mk-panel-body>.crow.se-tabcol'));
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
 const coveredState=new WeakMap();
 function setCovered(P,covered){
  if(covered&&!coveredState.has(P)){coveredState.set(P,{inert:P.inert,aria:P.getAttribute('aria-hidden')});P.inert=true;P.setAttribute('aria-hidden','true');}
  else if(!covered&&coveredState.has(P)){const previous=coveredState.get(P);P.inert=previous.inert;if(previous.aria===null)P.removeAttribute('aria-hidden');else P.setAttribute('aria-hidden',previous.aria);coveredState.delete(P);}
 }
 function sync(P){
  const C=COVERS[P.id];
  if(isOpen(P)){
   if(C&&!C.classic){ unframe(P); P.classList.add('se-covered'); setCovered(P,true);
    if(!C.on){C.on=true;try{C.show(P);}catch(e){console.error('se cover '+P.id,e);}} }
   else { P.classList.remove('se-covered'); setCovered(P,false); if(C&&C.on){C.on=false;try{C.hide();}catch(e){}} frame(P); }
  }else{
   P.classList.remove('se-covered'); setCovered(P,false); unframe(P);
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
    if(P.classList.contains('se-fr')){splitTabs(P);P.classList.toggle('se-fr-tabs',!!P.querySelector('.mk-panel-body>.crow.se-tabcol'));}
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
  const sheet=menu.querySelector('.se-sheet'), bar0=menu.querySelector('.se-bar');
  const x=bar0.querySelector('.se-x'); x.textContent='Back to ranch'; x.setAttribute('aria-label','Back to ranch');
  let category='home', search='';
  const controls=document.createElement('div');controls.className='sem-controls';
  const categories=document.createElement('nav');categories.className='sem-categories';categories.setAttribute('aria-label','Menu categories');
  for(const [id,label,icon] of [['home','Home','build'],['horses','Horses','horses'],['explore','Explore','compass'],['more','More','list']]){
   const b=document.createElement('button');b.type='button';b.dataset.menuCategory=id;b.innerHTML=line(icon,'currentColor',1.8)+'<span>'+label+'</span>';b.setAttribute('aria-pressed',String(id===category));
   b.onclick=()=>{category=id;search='';input.value='';dressTiles();body.scrollTop=0;};categories.appendChild(b);
  }
  const input=document.createElement('input');input.className='sem-search';input.type='search';input.placeholder='Find a menu…';input.setAttribute('aria-label','Find a menu');input.autocomplete='off';
  input.oninput=()=>{search=input.value.trim().toLowerCase();dressTiles();};
  const brand=document.createElement('div');brand.className='sem-brand';brand.setAttribute('aria-hidden','true');brand.innerHTML=art('horses',{b:'#e7dab0',l:'#1e4135',d:'#b4c3a0'})+'<strong>MEADOWLARK</strong><small>RANCH</small>';
  const searchLabel=document.createElement('label');searchLabel.className='sem-search-label';searchLabel.innerHTML='<span>Find your way</span>';searchLabel.appendChild(input);
  const sideNote=document.createElement('div');sideNote.className='sem-side-note';sideNote.textContent='Your own little corner of the valley.';
  controls.append(brand,categories,searchLabel,sideNote);sheet.insertBefore(controls,tiles);
  const body=document.createElement('div');body.className='sem-body';sheet.insertBefore(body,tiles);
  const hero=document.createElement('section');hero.className='sem-hero';hero.setAttribute('aria-label','Current adventure');
  hero.innerHTML='<div class="sem-hero-art" aria-hidden="true"></div><div class="sem-hero-copy"><span class="sem-eyebrow">Your next adventure</span><h2 id="semGoal"></h2><p id="semChapter"></p><button type="button" class="sem-ride">Continue riding <span aria-hidden="true">→</span></button></div><span class="sem-ridden" id="semRidden"></span>';
  hero.querySelector('.sem-ride').onclick=()=>G.seHud?.close();
  const section=document.createElement('div');section.className='sem-section';section.innerHTML='<h2 id="semSectionTitle">Around the ranch</h2><span id="semSectionHint">Make the day your own</span>';
  body.append(hero,section,tiles);
  const empty=document.createElement('p');empty.className='sem-empty';empty.textContent='No matching menus. Try horses, quests or settings.';empty.setAttribute('role','status');empty.hidden=true;tiles.appendChild(empty);
  const footer=document.createElement('div');footer.className='sem-foot';footer.innerHTML='<span id="semFootR"></span><span class="sem-sp"></span><button type="button" data-sem-util="muteBtn">Sound</button><button type="button" data-sem-util="settingsBtn">Settings</button>';
  sheet.appendChild(footer);
  const closeForAction=()=>{if(G.seHud)G.seHud.close(false);else menu.classList.remove('on');};
  const clickId=id=>()=>{const b=$(id);if(b)setTimeout(()=>b.click(),0);};
  tiles.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.parentElement===tiles&&!b.dataset.semMain&&!b.classList.contains('sem-util-tile'))closeForAction();},true);
  footer.addEventListener('click',e=>{const b=e.target.closest('[data-sem-util]');if(!b)return;closeForAction();clickId(b.dataset.semUtil)();});
  const MAIN=[
   {k:'horses',t:'My horses',s:'Your stable and favourite rides',groups:['home','horses'],source:'stableBtn',go:clickId('stableBtn')},
   {k:'journey',t:'Journey',s:'Story, quests and daily goals',groups:['home','explore'],source:'questBtn',go:clickId('questBtn')},
   {k:'events',t:'Riding events',s:'Courses, races and challenges',groups:['home','explore'],source:'eventsBtn',go:clickId('eventsBtn')},
   {k:'market',t:'Market',s:'Horses, tack and supplies',groups:['home','more'],source:'shopBtn',go:clickId('shopBtn')},
   {k:'ranch',t:'Build your ranch',s:'Buildings, furniture and land',groups:['home','more'],source:'buildBtn',go:clickId('buildBtn')},
   {k:'character',t:'Your rider',s:'Clothes, hair and accessories',groups:['home','more'],source:'charBtn',go:clickId('charBtn')},
   {k:'care',t:'Horse care',s:'Feed, groom and build your bond',groups:['horses'],source:'careBtn',go:clickId('careBtn')},
   {k:'foal',t:'Breeding',s:'Pair horses and raise foals',groups:['horses'],source:'breedBtn',go:clickId('breedBtn')},
   {k:'style',t:'Horse style',s:'Coats, grooming and tack',groups:['horses'],source:'styleBtn',go:clickId('styleBtn')},
   {k:'collection',t:'Breed collection',s:'Discover every breed and coat',groups:['horses'],source:'catalogBtn',go:clickId('catalogBtn')},
   {k:'studio',t:'Breed studio',s:'Explore horse designs',groups:['horses'],source:'breedStudioBtn',go:clickId('breedStudioBtn')},
   {k:'whistle',t:'Call your horse',s:'Bring your horse to you',groups:['horses'],source:'whistleBtn',go:clickId('whistleBtn')},
   {k:'season',t:'Season pass',s:'Progress and seasonal rewards',groups:['explore'],go:()=>{G.hidePanels();G.ui.openLB();document.querySelector('#lbPanel [data-lbtab="pass"]')?.click();}},
   {k:'treasure',t:'Treasures',s:'Hidden finds around the valley',groups:['explore'],need:()=>!!G.treasures,go:()=>G.run('seTreasures')},
   {k:'map',t:'World map',s:'Find a trail or your next stop',groups:['explore'],source:'mini',go:clickId('mini')},
   {k:'podium',t:'Leaderboards',s:'Rankings and earned rewards',groups:['explore'],source:'lbBtn',go:clickId('lbBtn')},
   {k:'club',t:'Riding club',s:'Ride together with friends',groups:['more'],source:'netBtn',need:()=>!!G.net?.SOCIAL,go:clickId('netBtn')},
   {k:'race',t:'Race club',s:'Challenge other riders',groups:['more'],source:'pvpBtn',go:clickId('pvpBtn')},
   {k:'inbox',t:'Inbox',s:'Letters, news and gifts',groups:['more'],source:'inboxBtn',go:clickId('inboxBtn'),pipOf:'inboxBtn'},
   {k:'chat',t:'Club chat',s:'Talk to your riding club',groups:['more'],source:'chatBtn',need:()=>!!G.net?.SOCIAL,go:clickId('chatBtn')},
   {k:'emotes',t:'Emotes',s:'Wave, laugh and dance',groups:['more'],source:'emoteBtn',go:clickId('emoteBtn')},
   {k:'account',t:G.commerce?.storeLabel||'Account & VIP',s:G.commerce?.isStaticStore?'Gem packs and VIP plans':'Gem store and cloud backups',groups:['more'],need:()=>!!G.commerce,go:()=>G.ui.dispatch('store')},
   {k:'photo',t:'Photo mode',s:'Capture a moment on the trail',groups:['explore'],source:'poseBtn',go:clickId('poseBtn')},
   {k:'graphics',t:'Graphics',s:'Adjust detail and performance',groups:['more'],source:'qualBtn',go:clickId('qualBtn')},
   {k:'settings',t:'Settings',s:'Sound, controls and preferences',groups:['more'],source:'settingsBtn',go:clickId('settingsBtn')},
  ];
  const HANDLED=new Set(MAIN.map(m=>m.source).filter(Boolean).concat(['muteBtn']));
  function content(b,k,title,sub){
   const icon=document.createElement('span');icon.className='sem-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=art(k,{b:'#416951',l:'#fffdf8',d:'#244b3e'});
   const label=document.createElement('span');label.className='sem-title';label.textContent=title;
   const description=document.createElement('span');description.className='sem-description';description.textContent=sub;
   const arrow=document.createElement('span');arrow.className='sem-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';
   const badges=[...b.querySelectorAll(':scope>.pip,:scope>.badge')];b.replaceChildren(icon,label,description,arrow,...badges);b.setAttribute('aria-label',title);
  }
  function dressTiles(){
   let count=0;
   for(const m of MAIN){
    const source=m.source?$(m.source):null;
    const have=(!m.source||!!source)&&(!m.need||m.need())&&(!source||(!source.hidden&&source.style.display!=='none'));
    let b=tiles.querySelector(':scope>[data-sem-main="'+m.k+'"]');
    if(!b&&have){b=document.createElement('button');b.type='button';b.dataset.semMain=m.k;b.dataset.semT=m.t;b.dataset.semS=m.s;content(b,m.k,m.t,m.s);
     b.onclick=()=>{closeForAction();m.go();};tiles.insertBefore(b,empty);}
    if(!b)continue;
    const show=have&&(search?(m.t+' '+m.s).toLowerCase().includes(search):m.groups.includes(category));b.hidden=!show;if(show)count++;
    if(m.pipOf){const src=$(m.pipOf)?.querySelector('.pip,.badge');const txt=src?.textContent.trim()||'';let pip=b.querySelector('.pip');
     if(txt&&txt!=='0'){if(!pip){pip=document.createElement('span');pip.className='pip';b.appendChild(pip);}if(pip.textContent!==txt)pip.textContent=txt;}else if(pip)pip.remove();}
   }
   for(const b of [...tiles.children]){
    if(b.tagName!=='BUTTON'||b.dataset.semMain)continue;
    if(HANDLED.has(b.id)){b.classList.add('sem-util-tile');b.setAttribute('aria-hidden','true');b.tabIndex=-1;continue;}
    if(!b.dataset.semT){const title=(b.dataset.mkLabel||b.getAttribute('aria-label')||b.title||b.textContent||'More').replace(/\p{Extended_Pictographic}|️/gu,'').trim().split(/[—(,·]/)[0].trim();
     b.dataset.semT=title;b.dataset.semS='More ranch options';content(b,'collection',title,'More ranch options');}
    const show=search?(b.dataset.semT+' '+b.dataset.semS).toLowerCase().includes(search):category==='more';b.hidden=!show;if(show)count++;
   }
   for(const b of categories.children)b.setAttribute('aria-pressed',String(!search&&b.dataset.menuCategory===category));
   empty.hidden=!!count;
   menu.dataset.menuView=search?'search':category;
   hero.hidden=!!search||category!=='home';
   $('semSectionTitle').textContent=search?'Search results':({home:'Around the ranch',horses:'A life with horses',explore:'Out in the valley',more:'A little of everything'}[category]);
   $('semSectionHint').textContent=search?count+' destinations':'Make the day your own';
  }
  function ranchScene(){
   const horse=G.seEvents?.horseSvg?.('stand',405,218,1.27,{body:'#70533b',dark:'#473c2c',mane:'#302e23',noRider:true})||'';
   return '<svg viewBox="0 0 600 330" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">'
    +'<defs><linearGradient id="semSky" x2="0" y2="1"><stop stop-color="#e6d9b2"/><stop offset="1" stop-color="#eeead2"/></linearGradient></defs>'
    +'<path fill="url(#semSky)" d="M0 0h600v330H0z"/><circle cx="400" cy="75" r="36" fill="#fcf4d4"/><circle cx="400" cy="75" r="48" fill="none" stroke="#faf0d1" opacity=".4"/>'
    +'<path d="M0 189 112 89 188 149 282 59 397 152 478 107 600 180V330H0Z" fill="#b9c3a7"/><path d="m282 59-35 75 38-17 39 32z" fill="#d8dbc0"/>'
    +'<path d="M0 210Q136 128 277 179T600 166V330H0Z" fill="#88a182"/><path d="M0 251Q152 181 325 211T600 180V330H0Z" fill="#6d8b65"/>'
    +'<path d="M207 202q89-9 39 53t101 75h143q-200-60-190-90t-93-38" fill="#c7c59c"/><path d="M0 298Q155 227 293 278T600 251V330H0Z" fill="#516e4f"/>'
    +'<g transform="translate(133 134)"><path d="M0 65h95V12L47-16 0 12Z" fill="#d6c7a3"/><path d="m-9 12 56-38 58 38h-16L47-12 7 12Z" fill="#385a49"/><path d="M32 65V29h32v36" fill="#587363"/><path d="m36 34 24 26m0-26L36 60" stroke="#c9c9a8" stroke-width="2"/><path d="M7 29h13v13H7zm68 0h13v13H75z" fill="#78907b"/></g>'
    +'<g fill="#385d48"><path d="m511 70-34 89h68z"/><path d="m548 101-26 71h53z"/><path d="m491 122-20 56h41z"/></g><g stroke="#6c7650" stroke-width="5"><path d="M511 128v79m38-60v64m-57-44v44"/></g>'
    +'<g stroke="#dad6ac" fill="none" stroke-width="4" opacity=".8"><path d="m310 231 280-27m-277 40 277-29"/><path d="m326 221 2 35m55-41 2 35m55-41 2 35m55-41 2 35m55-41 2 35"/></g>'
    +'<ellipse cx="401" cy="269" rx="67" ry="9" fill="#355038" opacity=".3"/>'+horse
    +'<g fill="#d6cf91" opacity=".8"><circle cx="319" cy="300" r="2"/><circle cx="340" cy="310" r="2"/><circle cx="544" cy="279" r="2"/><circle cx="555" cy="291" r="2"/><circle cx="183" cy="277" r="2"/></g>'
    +'<g fill="none" stroke="#65795b" stroke-width="2"><path d="M300 50q7-6 14 0 7-6 14 0m131 60q5-5 11 0 5-5 10 0"/></g></svg>';
  }
  function paintHead(){
   const s=G.save.fresh()||{},h=G.horse?.ridden?.()||{};
   $('seMenuName').textContent=s.ranchName||s.name||s.playerName||'Meadowlark Ranch';
   $('seMenuSub').textContent='A little room to roam.';
   const n=(s.horses||[]).length;$('semFootR').textContent=n+' '+(n===1?'horse':'horses')+' at home';
   footer.querySelector('[data-sem-util="muteBtn"]').textContent=G.audio?.muted?.()?'Sound off':'Sound on';
   const goal=($('questTrack')?.textContent||'').replace(/\p{Extended_Pictographic}|️/gu,'').split('·').map(v=>v.trim()).filter(Boolean);
   const quest=G.quest,mission=quest?.STORY?.[quest.storyIdx?.()];
   $('semGoal').textContent=mission?.label||goal.at(-1)||'Take the long way home.';
   $('semChapter').textContent=mission?.ch||(goal.length>2?goal.slice(1,-1).join(' · '):'There is always another trail to discover.');
   $('semRidden').textContent=h.name?'In the saddle with '+h.name:'Welcome to the valley';
   if(!hero.querySelector('.sem-hero-art>svg'))hero.querySelector('.sem-hero-art').innerHTML=ranchScene();
  }
  new MutationObserver(()=>{if(menu.classList.contains('on')){category='home';search='';input.value='';dressTiles();paintHead();body.scrollTop=0;}}).observe(menu,{attributes:true,attributeFilter:['class']});
  new MutationObserver(dressTiles).observe(tiles,{childList:true});
  dressTiles();
  G.on('sePromo',()=>G.run('seTreasures'));
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
  /* The picture is a W:H band cropped out of the middle of the canvas. With the canvas's own vertical field the band
     only gets sh/ch of it, which on a portrait phone (a 1.6:1 band out of a 390x844 canvas) is a quarter of the view: the
     course map was a zoomed patch of grass with every fence outside it. Widen the field so the band itself spans v.fov. */
  const fov=(v.fov||50), full=sh<ch-0.5?2*Math.atan(Math.tan(fov*Math.PI/360)*ch/sh)*180/Math.PI:fov;
  const cam=new THREE.PerspectiveCamera(full,cw/ch,0.5,4000);
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
