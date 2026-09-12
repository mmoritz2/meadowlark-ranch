/* Feature package 'social-play' — everything two riders do together.

   The Commons (an opt-in public world on top of the private club code), richer remote riders
   (height, flight, emote and competition state), a four-room chat with slash commands, the
   word filter with blocking, reporting and honour-system bans, a real friends handshake with
   requests and teleport-to-friend, named trail rides with dropped pins and six expeditions,
   synced group emotes with a countdown, spectating from the grandstand or over a rider's
   shoulder, co-operative foraging with a weekly club basket and forage gifting, and ranch
   tours with likes and a showcase board.

   Everything rides on what is already there: the /pos packet (netPos hook), the chat topic
   piggy-back (chat hook), retained /lb-style topics for the slow state, and the existing
   trail-ride loop. The broker is public and unauthenticated, so every remote string is
   truncated, nothing is trusted, and the panel says so in plain words.

   Owned by this package: this file, assets/chat-filter.js, and the five small hot spots in
   ranch3d.html (chatMsg line cap, poseRigBones remote emote, the remote cap, the Escape hook,
   G.trail). See assets/features/index.js for the contract. Nothing runs at import time. */
import {createChatFilter} from '../chat-filter.js';

export const id='social-play';

export function install(G){
 const {$,toast}=G, S=G.save, M=G.money, T=G.tables, U=G.ui, W=G.world, H=G.horse, N=G.net, X=G.xp, Q=G.quest;
 const THREE=G.THREE;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const nm14=v=>String(v==null?'':v).slice(0,14);
 const enc=encodeURIComponent, dec=v=>{try{return decodeURIComponent(v);}catch(e){return String(v||'');}};
 const now=()=>Date.now();
 const me=()=>N.myName();
 /* MQTT topic segments cannot carry / + or #, and a player name can. */
 const topicName=()=>(me().replace(/[^A-Za-z0-9_.\- ]/g,'').replace(/\s+/g,'_').slice(0,14))||'Rider';
 const week=()=>G.time.weekKey();
 const today=()=>G.time.dateKey();

 /* ======================= 1. Tables ======================= */
 const COMMONS='meadowlark-commons';          // the one public room, joined on purpose, never by default
 const FRIEND_MAX=50;                         // a friends list, not a phone book
 const POS_CULL=210;                          // in the Commons, ignore riders this far away
 const MUTE_MS=30*60e3;                       // a report mute lasts half an hour
 const REPORT_WINDOW=10*60e3, REPORT_VOTES=2; // two different riders inside ten minutes
 const GIFT_CAP=3;                            // forage gifts you can RECEIVE in a day
 const TOUR=[128,64];                         // the showcase paddock: a friend's ranch is rebuilt here
 const SEAT={x:-31.5,y:3.4,z:0,lx:0,lz:0};    // the grandstand seat above the arena

 /* The four chat rooms. 'club' is the existing topic so nothing about the old chat changes. */
 const CHAT_ROOMS={
  commons:{id:'commons',label:'🌍 Commons',tag:'🌍',topic:()=>'srf1/'+COMMONS+'/chat',note:'Every rider who opted into the public world.'},
  club:   {id:'club',   label:'🏠 Club',   tag:'🏠',topic:()=>'chat',note:'Only riders who have your club code.'},
  local:  {id:'local',  label:'📍 Local',  tag:'📍',topic:()=>'loc/'+regionIdx(),note:'Whoever is in the same corner of the Basin as you.'},
  party:  {id:'party',  label:'🎉 Party',  tag:'🎉',topic:()=>'party',note:'Your trail-ride or party group.'},
 };
 const ROOM_ORDER=['commons','club','local','party'];

 /* Six expeditions: long multi-region rides with a reward that scales with how far they go.
    Coordinates are the same landmarks the trail stops and the fast-travel bar use. */
 const EXPEDITIONS=[
  {id:'basin',   name:'Kestrel Basin Loop',      icon:'🌾',regions:2,km:0.3,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌊 Loon Lake',20,16],['🐴 Home Pasture',-70,-10],['🏠 Meadowlark Ranch',0,5]],
   blurb:'An easy morning circuit — the lake, the pasture and home for lunch.',r:{c:300,g:1,p:20}},
  {id:'cottonwood',name:'Cottonwood Post Run',   icon:'🏘️',regions:3,km:0.5,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌲 Hollowpeak Pines',-30,-58],['🏘️ Cottonwood Village',47,-50],['🏠 Meadowlark Ranch',0,5]],
   blurb:'Carry the post through the pines to the village and back.',r:{c:450,g:2,p:28}},
  {id:'riverside',name:'Riverside Crossing',     icon:'🌉',regions:3,km:0.7,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌊 Loon Lake',20,16],['🌉 River bridge',0,118],['🌉 Riverside Crossing',0,120]],
   blurb:'North along the water to the old bridge at Riverside.',r:{c:550,g:2,k:1,p:34}},
  {id:'barleyfold',name:'Barleyfold Harvest Haul',icon:'🌾',regions:3,km:1.2,
   stops:[['🏠 Meadowlark Ranch',0,5],['🏘️ Cottonwood Village',47,-50],['🌾 Barleyfold Farms',220,-110],['🏘️ Cottonwood Village',47,-50]],
   blurb:'Out to Otto at Barleyfold for the harvest, and back before dark.',r:{c:700,g:3,k:1,p:42}},
  {id:'coyote',  name:'Coyote Canyon Expedition',icon:'🏜️',regions:3,km:1.4,
   stops:[['🏠 Meadowlark Ranch',0,5],['🐴 Home Pasture',-70,-10],['🏜️ Coyote Canyon',-220,130],['🐴 Home Pasture',-70,-10]],
   blurb:'The long haul south-west into the canyon. Take water.',r:{c:850,g:4,k:1,p:50}},
  {id:'hollowpeak',name:'Hollowpeak Falls Ascent',icon:'🏔️',regions:4,km:1.8,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌲 Hollowpeak Pines',-30,-58],['🏔️ Hollowpeak Heights',-160,-210],['💦 Hollowpeak Falls',-150,-232]],
   blurb:'The hardest ride in the Basin: up through the pines to the falls.',r:{c:1100,g:5,k:2,p:64}},
 ];

 /* The weekly co-op goals. Everyone in the club contributes; everyone claims. */
 const COOP_GOALS=[
  {id:'basket',icon:'🧺',label:'Club basket',desc:'Forage 30 wild things between you this week',goal:30,r:{c:400,g:2,k:1}},
  {id:'pantry',icon:'🫙',label:'Winter pantry',desc:'Forage 80 between you this week',goal:80,r:{c:900,g:4,k:1}},
 ];

 /* Slash commands, in the order /help lists them. */
 const SLASH=[
  ['/help','list these commands'],
  ['/w <name> <message>','whisper one rider'],
  ['/me <action>','* Ada scratches Clover\'s ears'],
  ['/room <commons|club|local|party>','switch room'],
  ['/emote <rear|bow|liedown|nuzzle|toss>','your horse performs'],
  ['/dance <emote>','invite everyone nearby into a synced emote'],
  ['/sync <name> <emote>','invite one rider into a synced emote'],
  ['/friend <name>','send a friend request'],
  ['/join <name>','ride to a friend who is online'],
  ['/watch <name>','spectate a rider'],
  ['/gift <name> <item>','send a friend one piece of forage'],
  ['/tour <name>','tour a club mate\'s ranch'],
  ['/trail','open the ride planner'],
  ['/block <name>','stop seeing that rider'],
  ['/report <name>','report them to everyone here'],
  ['/who','who is riding nearby'],
 ];

 const filter=createChatFilter({});

 /* ======================= 2. Save shape ======================= */
 S.ensure(s=>{
  s.pubWorld=s.pubWorld||false;              // opted into the Commons
  s.pubChat=s.pubChat||false;                // reads the Commons chat room without riding there
  s.clubPriv=s.clubPriv||'';                 // the private code we came from
  s.friends=s.friends||{};
  s.friendReq=s.friendReq||{in:{},out:{}};
  s.blocked=s.blocked||{};
  s.tempMute=s.tempMute||{};
  s.reports=s.reports||[];
  s.chatRoom=s.chatRoom||'club';
  s.coopClaims=s.coopClaims||{};
  s.giftDay=s.giftDay||''; s.giftN=s.giftN||0;
  s.likesGiven=s.likesGiven||{};
  s.ranchLikes=s.ranchLikes||0;
  s.expDone=s.expDone||{};
  s.stats=s.stats||{}; s.life=s.life||{};
 });

 /* ======================= 3. Small helpers ======================= */
 function regionIdx(x,z){
  const p=H.player.pos;
  const rg=W.regionAt(x==null?p.x:x,z==null?p.z:z);
  const i=T.REGIONS.indexOf(rg);
  return i<0?T.REGIONS.length-1:i;
 }
 function regionName(x,z){const rg=W.regionAt(x==null?H.player.pos.x:x,z==null?H.player.pos.z:z);return rg?rg.name:'🌾 Kestrel Basin';}
 function online(){return !!(N.net.client&&N.net.client.connected);}
 function inCommons(){return N.net.club===COMMONS;}
 function ranchPts(s){let n=0;for(const d of (s.decor||[])){const c=T.DECOR_CAT[d.t];if(c)n+=c.pts||0;}return n;}
 function isBlocked(s,name){return !!(s&&s.blocked&&s.blocked[name]);}
 function isMuted(s,name){return isBlocked(s,name)||!!(s&&s.tempMute&&s.tempMute[name]>now());}
 function friendsOf(s){return Object.keys(s.friends||{});}
 function remoteByName(name){return Object.values(N.remotes).find(r=>r.name===name)||null;}
 function stat(key,n){S.sync(s=>{s.stats=s.stats||{};s.stats[key]=(s.stats[key]||0)+(n||1);});}

 /* ======================= 4. Chat: the feed, the rooms, the filter ======================= */
 G.chatLines=30;                              // read by chatMsg in ranch3d.html
 let chatRoom=(S.fresh()||{}).chatRoom||'club';

 const style=document.createElement('style');
 style.textContent=
  '#chatFeed{max-height:min(38vh,320px);overflow-y:auto;scrollbar-width:thin}'
 +'#chatFeed .spLine{pointer-events:auto}'
 +'#chatFeed .spLine button{font-family:inherit;font-size:11px;font-weight:700;margin-left:6px;padding:2px 8px;border-radius:9px;border:0;background:#ffd166;color:#4a3526;cursor:pointer}'
 +'#chatTabs{position:fixed;left:16px;bottom:calc(148px + env(safe-area-inset-bottom));z-index:9;display:none;gap:4px;flex-wrap:wrap;width:min(360px,72vw)}'
 +'#chatTabs button{font-family:var(--font,inherit);font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;border:1.5px solid var(--line-2,#d9cdb8);background:var(--paper,#fff8ea);color:#6b5946;cursor:pointer}'
 +'#chatTabs button.on{background:#ffd166;border-color:#e0ab2e;color:#4a3526}'
 +'#specHud,#tourHud{position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:11;display:none;gap:8px;align-items:center;background:rgba(42,32,24,0.88);color:#fff8ea;'
 +'padding:8px 14px;border-radius:14px;font-size:13px;font-weight:700;max-width:min(520px,92vw)}'
 +'#specHud button,#tourHud button{font-family:inherit;font-size:12px;font-weight:700;padding:3px 10px;border-radius:9px;border:0;background:#ffd166;color:#4a3526;cursor:pointer}'
 +'body.freecam #chatTabs,body.freecam #specHud,body.freecam #tourHud{display:none!important}';
 document.head.appendChild(style);

 const tabBar=document.createElement('div'); tabBar.id='chatTabs';
 const chatBar=$('chatBar'); if(chatBar&&chatBar.parentNode)chatBar.parentNode.insertBefore(tabBar,chatBar);
 const specHud=document.createElement('div'); specHud.id='specHud'; document.body.appendChild(specHud);
 const tourHud=document.createElement('div'); tourHud.id='tourHud'; document.body.appendChild(tourHud);

 function drawTabs(){
  const s=S.fresh()||{};
  tabBar.innerHTML=ROOM_ORDER.map(k=>{
   const r=CHAT_ROOMS[k];
   const off=(k==='commons'&&!s.pubChat&&!s.pubWorld);
   return '<button data-room="'+k+'" class="'+(chatRoom===k?'on':'')+'" title="'+esc(r.note)+'">'+r.label+(off?' 🔒':'')+'</button>';
  }).join('');
  tabBar.querySelectorAll('[data-room]').forEach(b=>{b.onclick=()=>setRoom(b.dataset.room);});
  tabBar.style.display=(chatBar&&chatBar.style.display==='flex')?'flex':'none';
 }
 function setRoom(k){
  if(!CHAT_ROOMS[k])return;
  const s=S.fresh()||{};
  if(k==='commons'&&!s.pubChat&&!s.pubWorld){
   S.sync(sv=>{sv.pubChat=true;});
   N.subscribe('srf1/'+COMMONS+'/chat');
   toast('🌍 Global chat on. Everyone reading this room is a stranger — be kind, share nothing private.');
  }
  chatRoom=k; S.sync(sv=>{sv.chatRoom=k;}); drawTabs();
  sysLine('💬','Talking in '+CHAT_ROOMS[k].label+' — '+CHAT_ROOMS[k].note);
 }
 /* A feed line that can carry a button (the synced-emote invitation, mostly). */
 function feedNode(html){
  const feed=$('chatFeed'); if(!feed)return null;
  const d=document.createElement('div'); d.className='spLine'; d.innerHTML=html;
  feed.appendChild(d);
  while(feed.children.length>(G.chatLines||8))feed.removeChild(feed.firstChild);
  feed.scrollTop=feed.scrollHeight;
  setTimeout(()=>{if(d.parentNode)d.style.opacity='0.5';},20000);
  return d;
 }
 function sysLine(icon,text){feedNode('<b>'+esc(icon)+'</b> '+esc(text));}
 function roomLine(room,name,text){
  const r=CHAT_ROOMS[room]||CHAT_ROOMS.club;
  N.chatMsg((room==='club'?'':r.tag+' ')+name,text);
 }
 /* Outbound. Everything the player types passes the filter first. */
 function say(text,room,extra){
  const t0=String(text||'').slice(0,120);
  if(!t0)return;
  const cl=filter.clean(t0);
  if(cl.flagged)toast('🛡️ Kept it kind — '+(cl.level==='hard'?'that word':'that one')+' was filtered before it left your ranch.');
  const t=cl.text;
  const rm=CHAT_ROOMS[room||chatRoom]||CHAT_ROOMS.club;
  if(rm.id==='club'){N.sendChat(t,extra);return;}
  if(!N.publish(rm.topic(),Object.assign({t},extra||{}))){toast('🌐 Connect to a club first (🌐 in the dock).');return;}
  roomLine(rm.id,me(),t);
  try{N.showBubble(H.player,t);}catch(e){}
 }
 /* A piggy-back with no text at all: a friend request, a gift, a like. */
 function ping(extra,room){
  const rm=CHAT_ROOMS[room||'club'];
  return N.publish(rm.topic(),Object.assign({t:''},extra||{}));
 }

 /* ---- slash commands ---- */
 function slash(v){
  const sp=v.indexOf(' '), cmd=(sp<0?v:v.slice(0,sp)).toLowerCase(), rest=(sp<0?'':v.slice(sp+1)).trim();
  const s=S.fresh()||{};
  const firstWord=()=>{const i=rest.indexOf(' ');return i<0?rest:rest.slice(0,i);};
  const afterWord=()=>{const i=rest.indexOf(' ');return i<0?'':rest.slice(i+1).trim();};
  switch(cmd){
   case '/help':
    sysLine('💡','Chat commands — '+SLASH.length+' of them:');
    SLASH.forEach(c=>sysLine('·',c[0]+'  —  '+c[1]));
    return true;
   case '/w': case '/whisper': {
    const to=nm14(firstWord()), msg=afterWord();
    if(!to||!msg){sysLine('💡','/w <name> <message>');return true;}
    const cl=filter.clean(msg.slice(0,120));
    if(N.publish('chat',{t:cl.text,to}))feedNode('<b>→ '+esc(to)+':</b> '+esc(cl.text));
    else toast('🌐 Connect first.');
    return true; }
   case '/me': {
    if(!rest){sysLine('💡','/me <action>');return true;}
    say('* '+me()+' '+rest,chatRoom,{me:1}); return true; }
   case '/room': { if(CHAT_ROOMS[rest])setRoom(rest); else sysLine('💡','/room commons | club | local | party'); return true; }
   case '/emote': {
    const k=rest.toLowerCase();
    if(!T.EMOTES[k]){sysLine('💡','/emote '+Object.keys(T.EMOTES).join(' | '));return true;}
    H.horseEmote(k); return true; }
   case '/dance': { startSync(T.EMOTES[rest.toLowerCase()]?rest.toLowerCase():'rear',null); return true; }
   case '/sync': {
    const to=nm14(firstWord()), k=afterWord().toLowerCase()||'rear';
    if(!to){sysLine('💡','/sync <name> <emote>');return true;}
    startSync(T.EMOTES[k]?k:'rear',to); return true; }
   case '/friend': { if(rest)sendFriend(nm14(rest),'req'); else sysLine('💡','/friend <name>'); return true; }
   case '/join':   { if(rest)gotoFriend(nm14(rest)); else sysLine('💡','/join <name>'); return true; }
   case '/watch':  { const r=remoteByName(nm14(rest)); if(r)startSpectate(r.id); else toast('🔭 '+(rest||'That rider')+' is not riding nearby.'); return true; }
   case '/gift':   { const to=nm14(firstWord()), it=afterWord().toLowerCase(); if(to&&it)sendGift(to,it); else sysLine('💡','/gift <name> <carrot|apple|lettuce|pumpkin|orange|truffle>'); return true; }
   case '/tour':   { if(rest)startTour(nm14(rest)); else sysLine('💡','/tour <name>'); return true; }
   case '/trail':  { U.openOnline(); return true; }
   case '/block':  { if(rest)setBlocked(nm14(rest),!isBlocked(s,nm14(rest))); return true; }
   case '/report': { if(rest)reportRider(nm14(rest)); return true; }
   case '/who': {
    const rs=Object.values(N.remotes);
    sysLine('👥',rs.length?rs.map(r=>r.name+(r.horseName?' on '+r.horseName:'')).join(', '):'Nobody nearby yet.');
    return true; }
   default:
    sysLine('💡','No such command — type /help');
    return true;
  }
 }

 /* Take over the send button and the emote strip so the filter and the rooms apply. */
 const chatIn=$('chatIn'); if(chatIn)chatIn.maxLength=120;
 const sendBtn=$('chatSend');
 if(sendBtn)sendBtn.onclick=()=>{
  const el=$('chatIn'); const v=(el.value||'').trim(); if(!v)return;
  el.value='';
  if(v[0]==='/'){slash(v);return;}
  say(v);
 };
 document.querySelectorAll('#chatBar [data-emote]').forEach(b=>{b.onclick=()=>say(b.dataset.emote);});
 const chatBtn=$('chatBtn');
 if(chatBtn){const prev=chatBtn.onclick;chatBtn.onclick=e=>{if(prev)prev(e);drawTabs();};}
 drawTabs();

 /* ======================= 5. Moderation ======================= */
 function remoteIdOf(name){return Object.keys(N.remotes).find(k=>N.remotes[k].name===name)||null;}
 function setBlocked(name,on){
  if(!name)return;
  S.sync(s=>{s.blocked=s.blocked||{};if(on)s.blocked[name]=1;else delete s.blocked[name];});
  if(on){const id=remoteIdOf(name);if(id){try{G.scene.remove(N.remotes[id].parts.group);}catch(e){}delete N.remotes[id];}}
  toast(on?'🚫 '+name+' blocked — you will not see them or their chat.':'✅ '+name+' unblocked.');
  refreshOnline();
 }
 const repVotes={};                            // name -> [{by,at}]
 function reportRider(name,why){
  if(!name||name===me())return;
  S.sync(s=>{s.reports=s.reports||[];s.reports.push({who:name,at:now(),why:String(why||'').slice(0,40)});if(s.reports.length>30)s.reports.shift();});
  ping({rep:{who:name,why:String(why||'chat').slice(0,24)}});
  tallyReport(name,N.net.id);
  toast('🚩 Reported '+name+'. Nobody reads these but the riders here — block them too if they keep it up.');
 }
 function tallyReport(name,by){
  const a=(repVotes[name]=repVotes[name]||[]).filter(v=>now()-v.at<REPORT_WINDOW);
  if(!a.some(v=>v.by===by))a.push({by,at:now()});
  repVotes[name]=a;
  if(a.length>=REPORT_VOTES){
   S.sync(s=>{s.tempMute=s.tempMute||{};s.tempMute[name]=now()+MUTE_MS;});
   toast('🔇 '+name+' muted here for 30 minutes — '+a.length+' riders reported them.');
   refreshOnline();
  }
 }
 /* The club owner (whoever's code the room is) may publish a ban; everyone honours it locally.
    It is the honour system — the broker cannot enforce anything — and the panel says so. */
 /* "Owner" is simply: this is your own private room, not the Commons. The broker cannot
    verify that, so a ban is a request every honest client honours — the panel says so. */
 function amOwner(){const s=S.fresh()||{};return !!(N.net.club&&!s.pubWorld&&N.net.club!==COMMONS);}
 function banRider(name){
  if(!name)return;
  ping({ban:name});
  setBlocked(name,true);
  toast('⛔ '+name+' banned from club "'+(N.net.club||'')+'" — every rider here who honours the ban drops them.');
 }

 /* ======================= 6. Friends ======================= */
 function sendFriend(name,kind){
  const s=S.fresh()||{};
  if(!name||name===me())return;
  if(kind==='req'&&friendsOf(s).length>=FRIEND_MAX){toast('💚 Your friends list is full ('+FRIEND_MAX+').');return;}
  if(!ping({fr:{k:kind,to:name}})){toast('🌐 Connect to a club first.');return;}
  if(kind==='req'){S.sync(sv=>{sv.friendReq.out[name]=now();});toast('💌 Friend request sent to '+name+'.');}
  if(kind==='acc'){S.sync(sv=>{sv.friends[name]=true;delete sv.friendReq.in[name];});toast('💚 '+name+' is a friend now!');G.sChime();}
  if(kind==='rm'){S.sync(sv=>{delete sv.friends[name];delete sv.friendReq.out[name];delete sv.friendReq.in[name];});toast('🤍 Removed '+name+'.');}
  refreshOnline();
 }
 function declineFriend(name){S.sync(sv=>{delete sv.friendReq.in[name];});toast('Declined '+name+'.');refreshOnline();}
 function onFriendMsg(m,from){
  const fr=m.fr||{};
  if(nm14(fr.to)!==me())return;
  const k=String(fr.k||'').slice(0,4);
  if(k==='req'){
   S.sync(sv=>{sv.friendReq.in[from]=now();});
   toast('💌 '+from+' wants to be friends — open 🌐 Club to accept.'); G.sChime();
  }else if(k==='acc'){
   S.sync(sv=>{sv.friends[from]=true;delete sv.friendReq.out[from];});
   toast('💚 '+from+' accepted your friend request!'); G.sChime();
  }else if(k==='rm'){
   S.sync(sv=>{delete sv.friends[from];delete sv.friendReq.in[from];delete sv.friendReq.out[from];});
  }
  refreshOnline();
 }
 function gotoFriend(name){
  if(G.course.get()){toast('Finish the round first.');return;}
  const r=remoteByName(name);
  if(!r){toast('🧭 '+name+' is not riding right now.');return;}
  H.player.pos.x=r.x+2.5; H.player.pos.z=r.z+2.5; H.player.speed=0;
  toast('🧭 Rode over to '+name+' in '+regionName(r.x,r.z)+'.');
  Q.dailyEvt('ft',1);
 }
 function friendStatus(s,name){
  if(remoteByName(name))return {k:'online',label:'🟢 riding nearby'};
  if(N.lbData&&Object.values(N.lbData).some(bd=>bd&&bd[name]!==undefined))return {k:'boards',label:'📋 on the boards'};
  return {k:'offline',label:'⚪ offline'};
 }

 /* ======================= 7. The Commons and richer remotes ======================= */
 function setCommons(on){
  S.sync(s=>{
   if(on){ if(s.club&&s.club!==COMMONS)s.clubPriv=s.club; s.club=COMMONS; s.pubWorld=true; s.pubChat=true; }
   else { s.pubWorld=false; if(s.clubPriv)s.club=s.clubPriv; else if(s.club===COMMONS)s.club=''; }
  });
  toast(on?'🌍 Riding into the Commons — anyone in the world can see you here. Names only, nothing private.'
         :'🏠 Back in your private club.');
  try{N.netConnect();}catch(e){}
  refreshOnline();
 }
 function applyRemoteCap(){
  const q=(S.fresh()||{}).quality||'high';
  G.remoteMax=q==='high'?24:q==='medium'?16:10;
 }
 applyRemoteCap();
 G.on('interval30',()=>applyRemoteCap());

 /* Everything the old /pos packet was missing. */
 G.on('netPos',(p,s,h)=>{
  const RIG=H.RIG(), c=G.course.get();
  p.y=+(H.player.y||0).toFixed(2);
  p.fl=H.player.flying?1:0;
  p.he=(RIG&&RIG.emote)?[String(RIG.emote.type).slice(0,10),+(RIG.emote.t||0).toFixed(2)]:0;
  p.crs=c?[String(c.ev&&c.ev.name||'a round').slice(0,24),c.idx|0,+(c.t||0).toFixed(1),c.faults||0]:0;
  p.rg=regionIdx();
  p.rp=ranchPts(s||{});
  if(G.trail&&G.trail.ride)p.tr2=[String(G.trail.ride.name||'trail').slice(0,24),G.trail.ride.idx|0,G.trail.ride.pts.length];
 });
 /* Drop the packets we do not want to spend a rider slot on. */
 G.on('message',(topic,m)=>{
  const s=S.fresh()||{};
  const from=nm14(m&&m.n);
  if(topic.endsWith('/pos')){
   if(isMuted(s,from))return true;
   if(inCommons()&&typeof m.x==='number'&&!N.remotes[m.id]
      &&Math.hypot(m.x-H.player.pos.x,m.z-H.player.pos.z)>POS_CULL)return true;   // too far to matter: keep the slot
   return undefined;
  }
  if(topic.indexOf('/coop/')>=0){onCoop(topic,m);return true;}
  if(topic.indexOf('/ranch/')>=0){onRanchData(topic,m);return true;}
  if(topic.indexOf('/loc/')>=0){onRoomChat('local',topic,m,from,s);return true;}
  if(topic.endsWith('/party')){onRoomChat('party',topic,m,from,s);return true;}
  if(topic==='srf1/'+COMMONS+'/chat'&&!inCommons()){onRoomChat('commons',topic,m,from,s);return true;}
  return undefined;
 });
 function onRoomChat(room,topic,m,from,s){
  if(isMuted(s,from))return;
  if(room==='local'){const want='/loc/'+regionIdx();if(topic.slice(-want.length)!==want)return;}   // only the region you are standing in
  if(m.to&&nm14(m.to)!==me())return;
  handlePiggy(m,from,s);
  const t=String(m.t||'').slice(0,120);
  if(!t)return;
  roomLine(room,from,filter.clean(t).text);
  const r=remoteByName(from); if(r){try{N.showBubble(r,t);}catch(e){}}
 }
 /* Remote rider enrichment. */
 G.on('remote',(m,r)=>{
  if(typeof m.y==='number'){if(r.y==null)r.y=m.y;r.ty=m.y;}else{if(r.y==null)r.y=0;r.ty=0;}
  r.fly=!!m.fl;
  r.crs=Array.isArray(m.crs)?[String(m.crs[0]).slice(0,24),m.crs[1]|0,+m.crs[2]||0,m.crs[3]|0]:null;
  r.trail=Array.isArray(m.tr2)?[String(m.tr2[0]).slice(0,24),m.tr2[1]|0,m.tr2[2]|0]:null;
  r.ranchPts=typeof m.rp==='number'?m.rp:r.ranchPts;
  if(Array.isArray(m.he)&&T.EMOTES[m.he[0]]){
   const E=T.EMOTES[m.he[0]];
   if(r.emKey!==m.he[0]+':'+Math.floor((+m.he[1]||0)*2)){
    r.emKey=m.he[0]+':'+Math.floor((+m.he[1]||0)*2);
    r.em={type:m.he[0],t:+m.he[1]||0,dur:E.dur};
    if(r.rig)r.rig.emote=r.em;                 // poseRigBones reads cal.emote for remotes
    try{N.showBubble(r,E.label);}catch(e){}
   }
  }else if(!m.he&&r.em&&r.em.t>=r.em.dur){r.em=null;if(r.rig)r.rig.emote=null;r.emKey='';}
 });
 G.on('remoteTick',(r,dt,t)=>{
  if(r.ty||r.y){
   r.y=(r.y||0)+((r.ty||0)-(r.y||0))*Math.min(1,dt*8);
   if(Math.abs(r.y)>0.01)r.parts.group.position.y+=r.y;
  }
  const em=r.em;
  if(em){em.t+=dt;if(em.t>=em.dur){r.em=null;r.emKey='';if(r.rig)r.rig.emote=null;}}
 });
 G.on('state',o=>{
  const s=S.fresh()||{};
  o.net={online:online(),club:N.net.club||null,commons:inCommons(),remotes:Object.keys(N.remotes).length,
   room:chatRoom,friends:friendsOf(s).length,requests:Object.keys(s.friendReq&&s.friendReq.in||{}).length,
   blocked:Object.keys(s.blocked||{}).length};
  o.social={spectating:spec?(spec.seat?'grandstand':(N.remotes[spec.id]?N.remotes[spec.id].name:'?')):null,
   tour:tour?tour.name:null,
   ride:(G.trail&&G.trail.ride)?{name:G.trail.ride.name||'Trail ride',idx:G.trail.ride.idx,stops:G.trail.ride.pts.length,exped:G.trail.ride.exped||null}:null,
   coop:coopTotal(),synced:s.stats&&s.stats.synced||0,tours:s.stats&&s.stats.tours||0};
 });

 /* ======================= 8. The one chat handler ======================= */
 function handlePiggy(m,from,s){
  let handled=false;
  if(m.fr){onFriendMsg(m,from);handled=true;}
  if(m.sync){onSync(m,from,s);handled=true;}
  if(m.gift){onGift(m,from);handled=true;}
  if(m.like){onLike(m,from);handled=true;}
  if(m.fg){onForageMsg(m,from);handled=true;}
  if(m.trp){onTrailProgress(m,from);handled=true;}
  if(m.rep&&m.rep.who){tallyReport(nm14(m.rep.who),String(m.id||from).slice(0,16));handled=true;}
  if(m.ban){onBan(m,from);handled=true;}
  if(m.tr){onTrailOffer(m,from);handled=true;}
  return handled;
 }
 G.on('chat',(m,from)=>{
  const s=S.fresh()||{};
  if(isMuted(s,from))return true;                       // blocked or muted: nothing of theirs lands
  if(m.party)return undefined;                          // ranch parties stay with the built-in handler
  const handled=handlePiggy(m,from,s);
  if(m.to&&nm14(m.to)!==me())return true;               // a whisper for someone else
  const raw=String(m.t==null?'':m.t).slice(0,120);
  if(!raw)return handled?true:undefined;
  const cl=filter.clean(raw);
  if(handled||m.to||m.me||cl.flagged){
   N.chatMsg((m.to?'🔒 ':'')+from,cl.text);
   const r=remoteByName(from); if(r&&!m.to){try{N.showBubble(r,cl.text);}catch(e){}}
   return true;
  }
  return undefined;                                     // a clean club line: the built-in prints it
 });
 function onBan(m,from){
  const who=nm14(m.ban);
  if(who!==me()){ if(remoteByName(who))toast('⛔ '+from+' banned '+who+' from this club.'); return; }
  toast('⛔ '+from+' banned you from club "'+(N.net.club||'')+'".');
 }

 /* ======================= 9. Trail rides and expeditions ======================= */
 let rideName='';
 function routeLen(pts){let d=0;for(let i=1;i<pts.length;i++)d+=Math.hypot(pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);return d;}
 function startRide(pts,opts){
  if(!G.trail){toast('Trail rides are not available.');return false;}
  if(!pts||pts.length<2){toast('A ride needs at least two stops.');return false;}
  const o=Object.assign({name:rideName||'Trail ride'},opts||{});
  if(G.trail.start(pts,me(),o)){
   G.trail.announce(pts,{nm:o.name,ex:o.exped||0,to:o.to||0,t:'🥾 '+me()+' started '+o.name+': '+pts.map(p=>p[0]).join(' → ')});
   return true;
  }
  return false;
 }
 function onTrailOffer(m,from){
  const pts=(m.tr||[]).slice(0,12).map(p=>[String(p[0]).slice(0,20),+p[1]||0,+p[2]||0]);
  if(pts.length<2)return;
  if(Array.isArray(m.to)&&m.to.length&&!m.to.map(nm14).includes(me()))return;      // invited riders only
  const name=String(m.nm||'').slice(0,24)||'a trail ride';
  G.trail.offer={pts,by:from,name,exped:String(m.ex||'').slice(0,16)||null};
  toast('🥾 '+from+' started '+name+' — open 🌐 Club to join');
  refreshOnline();
 }
 function onTrailProgress(m,from){
  const r=G.trail&&G.trail.ride; if(!r)return;
  r.roster=r.roster||{};
  r.roster[from]=Math.max(0,Math.min(r.pts.length,(m.trp&&m.trp.idx)|0));
 }
 G.on('trailStop',(r,p)=>{ ping({trp:{idx:r.idx},t:''}); });
 /* We own the payout: expeditions pay their own reward, custom rides pay by distance. */
 G.on('trailDone',r=>{
  const pts=r.pts, stops=pts.length, len=routeLen(pts);
  const ex=r.exped?EXPEDITIONS.find(e=>e.id===r.exped):null;
  const reward=ex?Object.assign({},ex.r):{c:Math.max(40*stops,Math.round(0.6*len)),p:12+6*stops};
  let coins=0;
  S.sync(sv=>{
   M.payReward(sv,reward);
   sv.stats=sv.stats||{}; sv.stats.trails=(sv.stats.trails||0)+1;
   if(ex){sv.stats.expeditions=(sv.stats.expeditions||0)+1;sv.expDone=sv.expDone||{};sv.expDone[ex.id]=(sv.expDone[ex.id]||0)+1;}
   X.addSP(sv,ex?6:3,'trail');
   coins=sv.coins;
  });
  M.refreshWallet(); G.sGem();                                 // payReward already paid the 🎟️ in reward.p
  Q.dailyEvt('trail',1); if(ex)Q.dailyEvt('exped',1);
  toast((ex?ex.icon+' '+ex.name+' complete!':'🥾 '+(r.name||'Trail ride')+' done! '+stops+' stops · '+Math.round(len)+' m')
   +' · +'+M.rewardLabel(reward));
  ping({t:(ex?ex.icon+' finished the '+ex.name+'!':'🥾 finished '+(r.name||'a trail ride')+'!')});
  return true;                                          // we paid: the built-in reward is skipped
 });

 /* ======================= 10. Synced emotes ======================= */
 const pending=[];                                      // scheduled synced emotes
 function startSync(type,to){
  if(!T.EMOTES[type])type='rear';
  const at=now()+2600;
  if(!ping({sync:{type,at,to:to||0},t:'✨ wants to '+T.EMOTES[type].label+' together'+(to?' with '+to:'')})){
   toast('🌐 Connect to a club first.');return;
  }
  scheduleEmote(type,at,to||'everyone nearby');
  toast('🤝 Invited '+(to||'everyone nearby')+' — '+T.EMOTES[type].label+' in 3…');
 }
 function onSync(m,from,s){
  const sy=m.sync||{}, type=String(sy.type||'').slice(0,10);
  if(!T.EMOTES[type])return;
  const to=sy.to?nm14(sy.to):'';
  if(to&&to!==me())return;
  const at=Math.max(now()+400,Math.min(now()+9000,+sy.at||0));
  const near=remoteByName(from);
  const dist=near?Math.hypot(near.x-H.player.pos.x,near.z-H.player.pos.z):999;
  const auto=(s.friends&&s.friends[from])||(to===me()&&dist<25);
  if(auto&&dist<40){scheduleEmote(type,at,from);sysLine('🤝',from+' — '+T.EMOTES[type].label+' together, get ready!');return;}
  const d=feedNode('<b>🤝 '+esc(from)+'</b> wants to '+esc(T.EMOTES[type].label)+' with you <button>Join</button>');
  if(d)d.querySelector('button').onclick=()=>{d.remove();scheduleEmote(type,at,from);};
 }
 function scheduleEmote(type,at,withWho){
  pending.push({type,at,who:withWho||'',fired:false});
  G.sChime();
 }
 function tickSync(){
  if(!pending.length)return;
  const t=now();
  for(let i=pending.length-1;i>=0;i--){
   const p=pending[i];
   if(t>=p.at){
    pending.splice(i,1);
    if(H.horseEmote(p.type,{force:true})){
     stat('synced',1);
     toast('💃 Synced '+(T.EMOTES[p.type]?T.EMOTES[p.type].label:p.type)+' with '+(p.who||'the club')+'!');
     Q.dailyEvt('synced',1);
    }
   }else if(!p.warned&&p.at-t<1200){p.warned=true;toast('🤝 …3, 2, 1');}
  }
 }

 /* ======================= 11. Spectating ======================= */
 let spec=null;
 function startSpectate(remoteId,seat){
  if(G.course.get()){toast('Finish your round first.');return;}
  spec={id:remoteId||null,seat:!!seat||!remoteId,snap:true};
  H.player.speed=0;
  G.hidePanels();
  drawSpecHud();
  Q.dailyEvt('spectate',1);
  stat('spectated',1);
  toast(spec.seat?'👁️ In the grandstand — Esc to leave.':'👁️ Watching '+((N.remotes[spec.id]||{}).name||'a rider')+' — Esc to stop.');
 }
 function stopSpectate(){ if(!spec)return; spec=null; specHud.style.display='none'; toast('👁️ Back on your own horse.'); }
 function drawSpecHud(){
  if(!spec){specHud.style.display='none';return;}
  const r=spec.id?N.remotes[spec.id]:null;
  let txt;
  if(r){
   txt='👁️ Watching <b>'+esc(r.name)+'</b>'+(r.horseName?' on '+esc(r.horseName):'');
   if(r.crs)txt+=' · '+esc(r.crs[0])+' · fence '+(r.crs[1]+1)+' · '+r.crs[2].toFixed(1)+'s'+(r.crs[3]?' · '+r.crs[3]+' faults':' · clear');
   else if(r.trail)txt+=' · 🥾 '+esc(r.trail[0])+' '+(r.trail[1]+1)+'/'+r.trail[2];
   else txt+=' · '+esc(regionName(r.x,r.z));
  }else{
   const rs=Object.values(N.remotes);
   txt='👁️ Grandstand'+(rs.length?' · '+rs.length+' rider'+(rs.length===1?'':'s')+' in the arena':' · the arena is quiet');
  }
  specHud.innerHTML='<span>'+txt+'</span><button data-sx="next">⇄ Next</button><button data-sx="stop">Leave</button>';
  specHud.style.display='flex';
  specHud.querySelectorAll('[data-sx]').forEach(b=>{b.onclick=()=>{
   if(b.dataset.sx==='stop'){stopSpectate();return;}
   const ids=Object.keys(N.remotes); if(!ids.length){spec.seat=true;spec.id=null;drawSpecHud();return;}
   const i=ids.indexOf(spec.id); spec.id=ids[(i+1)%ids.length]; spec.seat=false; spec.snap=true; drawSpecHud();
  };});
 }
 G.on('camera',c=>{
  if(!spec)return;
  let tx,ty,tz,lx,ly,lz;
  const r=spec.id?N.remotes[spec.id]:null;
  if(!r){spec.seat=true;spec.id=null;}
  if(spec.seat){
   tx=SEAT.x; tz=SEAT.z; ty=W.groundH(SEAT.x,SEAT.z)+SEAT.y;
   lx=SEAT.lx; lz=SEAT.lz; ly=W.groundH(lx,lz)+1.5;
  }else{
   const gp=r.parts.group.position;
   lx=gp.x; ly=gp.y+1.5; lz=gp.z;
   tx=gp.x+Math.sin(r.heading+Math.PI)*9; tz=gp.z+Math.cos(r.heading+Math.PI)*9;
   ty=Math.max(W.groundH(tx,tz)+3.2,gp.y+2.6);
  }
  const want=new THREE.Vector3(tx,ty,tz), look=new THREE.Vector3(lx,ly,lz);
  if(spec.snap){spec.snap=false;G.camera.position.copy(want);c.camLook.copy(look);}
  else{G.camera.position.lerp(want,1-Math.exp(-4*c.dt));c.camLook.lerp(look,1-Math.exp(-5*c.dt));}
  G.camera.lookAt(c.camLook.x,c.camLook.y,c.camLook.z);
  return true;
 });
 G.on('ride',R=>{ if(spec||tour){R.target=0;R.noJump=true;} });
 /* The grandstand itself: an interactable on the arena's west side. */
 W.addThing({kind:'grandstand',id:'arena-stand',x:-28.5,z:0,reach:4.5,
  label:()=>spec?'👁️ Watching from the grandstand (Esc to leave)':'👁️ Sit in the grandstand and watch (E)',
  use:()=>{ if(spec)stopSpectate(); else startSpectate(null,true); }});
 W.mapMarkers.push({x:-28.5,z:0,glyph:'👁️',label:'Grandstand'});

 /* ======================= 12. Co-operative foraging ======================= */
 const coopData={};                                     // week -> {name:count}
 function coopWeek(){return coopData[week()]=coopData[week()]||{};}
 function coopTotal(){const w=coopWeek();return Object.keys(w).reduce((n,k)=>n+(w[k]||0),0);}
 function coopMine(){const s=S.fresh()||{};return (s.life&&s.life.forage)||0;}
 function publishCoop(){
  const w=week();
  N.publish('srf1/{club}/coop/'+w+'/'+topicName(),{n:me(),v:coopWeek()[me()]||0},{retain:true});
 }
 function onCoop(topic,m){
  const tp=topic.split('/');                            // srf1/<club>/coop/<week>/<name>
  const wk=tp[3]||week(), name=nm14(m.n||tp[4]||'Rider');
  if(typeof m.v!=='number')return;
  const s=S.fresh()||{}; if(isBlocked(s,name))return;
  (coopData[wk]=coopData[wk]||{})[name]=Math.max(0,Math.min(9999,Math.round(m.v)));
  refreshQuests();
 }
 /* Picking forage: tell the club so their copy of the same bush empties too. */
 G.on('forage',(item,f)=>{
  const w=coopWeek(); w[me()]=(w[me()]||0)+1;
  if(f&&f.g)ping({fg:[String(item).slice(0,12),+f.g.position.x.toFixed(0),+f.g.position.z.toFixed(0)]});
  publishCoop();
 });
 function onForageMsg(m,from){
  if(!Array.isArray(m.fg))return;
  const it=String(m.fg[0]||'').slice(0,12), x=+m.fg[1]||0, z=+m.fg[2]||0;
  const f=(W.forage||[]).find(f=>f.item===it&&f.g&&f.g.visible&&Math.hypot(f.g.position.x-x,f.g.position.z-z)<3.5);
  if(!f)return;
  f.g.visible=false; f.t=(40+Math.random()*30);
  if(Math.hypot(H.player.pos.x-x,H.player.pos.z-z)<40)toast('🧺 '+from+' picked '+(T.FOODS3[it]?T.FOODS3[it].emoji+' '+it:it)+' beside you.');
 }
 function claimCoop(goalId){
  const g=COOP_GOALS.find(g=>g.id===goalId); if(!g)return;
  const wk=week();
  if(coopTotal()<g.goal){toast('🧺 Not there yet — '+coopTotal()+'/'+g.goal+'.');return;}
  let ok=false;
  S.sync(s=>{ s.coopClaims=s.coopClaims||{}; const k=wk+':'+g.id; if(s.coopClaims[k])return; s.coopClaims[k]=true; M.payReward(s,g.r); ok=true; });
  if(!ok){toast('Already claimed this week.');return;}
  M.refreshWallet(); G.sGem(); toast(g.icon+' '+g.label+' claimed — '+M.rewardLabel(g.r));
  refreshQuests();
 }
 /* Gifting forage to a friend. */
 const GIFTABLE=['carrot','apple','lettuce','pumpkin','orange','truffle','hay'];
 function sendGift(to,item){
  const s=S.fresh()||{};
  if(!to||to===me())return;
  if(!GIFTABLE.includes(item)){toast('🎁 You can send '+GIFTABLE.join(', ')+'.');return;}
  if(((s.items||{})[item]||0)<1){toast('🎁 You have no '+item+' to send.');return;}
  if(!ping({gift:{item,to}})){toast('🌐 Connect to a club first.');return;}
  S.sync(sv=>{sv.items[item]=Math.max(0,(sv.items[item]||0)-1);sv.life=sv.life||{};sv.life.help=(sv.life.help||0)+1;});
  Q.dailyEvt('help',1); stat('helped',1); M.refreshWallet();
  toast('🎁 Sent '+to+' one '+item+'.');
  refreshOnline();
 }
 function onGift(m,from){
  const g=m.gift||{}; if(nm14(g.to)!==me())return;
  const item=String(g.item||'').slice(0,12);
  if(!GIFTABLE.includes(item))return;
  let ok=false;
  S.sync(s=>{
   const d=today();
   if(s.giftDay!==d){s.giftDay=d;s.giftN=0;}
   if(s.giftN>=GIFT_CAP)return;
   s.giftN++; s.items[item]=(s.items[item]||0)+1; ok=true;
  });
  if(ok){M.refreshWallet();G.sChime();toast('🎁 '+from+' sent you a '+item+'!');}
 }

 /* ======================= 13. Ranch showcase and tours ======================= */
 const ranchData={};                                    // name -> {pts,d:[[t,x,z,r],…],likes}
 let lastRanchPub=0;
 function publishRanch(force){
  if(!online())return;
  if(!force&&now()-lastRanchPub<5000)return;
  lastRanchPub=now();
  const s=S.fresh()||{};
  const d=(s.decor||[]).slice(0,300).map(x=>[String(x.t).slice(0,16),+(+x.x).toFixed(1),+(+x.z).toFixed(1),+(+(x.ry||0)).toFixed(2)]);
  N.publish('srf1/{club}/ranch/'+topicName(),{n:me(),pts:ranchPts(s),lk:s.ranchLikes||0,rn:String(s.ranchName||'Meadowlark Ranch').slice(0,24),d},{retain:true});
 }
 function onRanchData(topic,m){
  const name=nm14(m.n||topic.split('/').pop()||'Rider');
  const s=S.fresh()||{}; if(isBlocked(s,name)||name===me())return;
  const d=(Array.isArray(m.d)?m.d:[]).slice(0,300)
   .map(x=>[String(x[0]||'').slice(0,16),+x[1]||0,+x[2]||0,+x[3]||0])
   .filter(x=>T.DECOR_CAT[x[0]]&&Math.abs(x[1])<300&&Math.abs(x[2])<300);
  ranchData[name]={pts:Math.max(0,Math.min(99999,m.pts|0)),likes:Math.max(0,Math.min(99999,m.lk|0)),
   ranchName:String(m.rn||'').slice(0,24)||(name+"'s ranch"),d};
  refreshOnline();
 }
 let tour=null;                                         // {name, meshes:[], back:{x,z}}
 function startTour(name){
  const rd=ranchData[name];
  if(!rd){toast('🏡 No ranch on show for '+name+' yet.');return;}
  if(G.course.get()){toast('Finish the round first.');return;}
  endTour(true);
  const meshes=[];
  for(const p of rd.d){
   const g=W.buildDecorMesh(p[0],false); if(!g)continue;
   const x=TOUR[0]+p[1], z=TOUR[1]+p[2];
   g.position.set(x,W.groundH(x,z),z); g.rotation.y=p[3]||0;
   g.userData.tour=true;                                // no collider on purpose: nothing to get stuck on
   G.scene.add(g); meshes.push(g);
  }
  const banner=G.nameSprite('🏡 '+(rd.ranchName||name));
  banner.position.set(TOUR[0],W.groundH(TOUR[0],TOUR[1])+5.2,TOUR[1]);
  banner.scale.set(4.6,1.1,1); banner.userData.tour=true;
  G.scene.add(banner); meshes.push(banner);
  tour={name,meshes,back:{x:H.player.pos.x,z:H.player.pos.z},liked:false};
  H.player.pos.x=TOUR[0]; H.player.pos.z=TOUR[1]-12; H.player.speed=0;
  stat('tours',1); Q.dailyEvt('tour',1);
  drawTourHud();
  toast('🏡 Touring '+name+"'s ranch — "+rd.d.length+' pieces · '+rd.pts+' builder points');
 }
 function endTour(quiet){
  if(!tour)return;
  for(const m of tour.meshes){G.scene.remove(m);try{m.traverse&&m.traverse(o=>{if(o.isMesh&&o.geometry&&o.userData.tourGeo)o.geometry.dispose();});}catch(e){}}
  if(!quiet&&tour.back){H.player.pos.x=tour.back.x;H.player.pos.z=tour.back.z;}
  tour=null; tourHud.style.display='none';
  if(!quiet)toast('🏡 Back home.');
 }
 function drawTourHud(){
  if(!tour){tourHud.style.display='none';return;}
  const rd=ranchData[tour.name]||{};
  tourHud.innerHTML='<span>🏡 <b>'+esc(rd.ranchName||tour.name)+'</b> · '+(rd.pts|0)+' builder points · ⭐ '+(rd.likes|0)+'</span>'
   +'<button data-tx="like">⭐ Like</button><button data-tx="leave">Leave</button>';
  tourHud.style.display='flex';
  tourHud.querySelectorAll('[data-tx]').forEach(b=>{b.onclick=()=>{ if(b.dataset.tx==='like')likeRanch(tour.name); else endTour(); };});
 }
 function likeRanch(name){
  const s=S.fresh()||{};
  if((s.likesGiven||{})[name]===week()){toast('⭐ You already liked '+name+"'s ranch this week.");return;}
  S.sync(sv=>{sv.likesGiven=sv.likesGiven||{};sv.likesGiven[name]=week();});
  ping({like:name,t:'⭐ liked '+name+"'s ranch"});
  if(ranchData[name])ranchData[name].likes=(ranchData[name].likes|0)+1;
  G.sChime(); toast('⭐ Liked '+name+"'s ranch!");
  drawTourHud();
 }
 function onLike(m,from){
  if(nm14(m.like)!==me())return;
  S.sync(s=>{s.ranchLikes=(s.ranchLikes||0)+1;});
  G.sChime(); toast('⭐ '+from+' liked your ranch!');
  publishRanch(true); N.publishMyBoards();
 }
 W.addBoard({k:'ranchlikes',g:'ranch',label:'🏡 Ranch likes',rate:0.4,cap:999,val:s=>s.ranchLikes||0});

 /* ======================= 14. The 🌐 Club panel section ======================= */
 function refreshOnline(){const p=$('onlinePanel');if(p&&p.style.display==='flex'){U.openOnline();U.openOnline();}}
 function refreshQuests(){const p=$('questPanel');if(p&&p.style.display==='flex')U.renderQuests();}

 U.onlineSection(s=>{
  s=s||S.fresh()||{};
  const riders=Object.values(N.remotes);
  const fr=friendsOf(s), reqIn=Object.keys((s.friendReq||{}).in||{}), reqOut=Object.keys((s.friendReq||{}).out||{});
  const H3=t=>'<b style="font-size:13px;margin-top:8px">'+t+'</b>';
  const note=t=>'<span style="font-size:11px;color:#8c7a63">'+t+'</span>';
  let h='';

  /* --- the Commons --- */
  h+=H3('🌍 The Commons')
   +'<div class="crow" style="gap:6px"><span style="font-size:12px;flex:1">'
   +(s.pubWorld?'You are riding in the <b>public Commons</b> — every rider in the world who opted in shares this world with you.'
              :'One public room everybody can join. Strangers, open chat, no moderators. Your private club code stays saved.')
   +'</span><button data-fx="sp:commons:'+(s.pubWorld?'0':'1')+'" '+(s.pubWorld?'':'class="claimBtn"')+'>'
   +(s.pubWorld?'🏠 Back to my club':'🌍 Ride the Commons')+'</button></div>'
   +note('Riders nearby: '+riders.length+' of '+(G.remoteMax||12)+' · riders further than '+POS_CULL+' m away are not drawn. Never share a real name, an address or an age here.');

  /* --- friends --- */
  h+=H3('💚 Friends ('+fr.length+'/'+FRIEND_MAX+')');
  if(reqIn.length)h+=reqIn.map(n=>'<div class="evrow">💌 <b>'+esc(n)+'</b><span>wants to be friends</span>'
   +'<button class="claimBtn" data-fx="sp:acc:'+enc(n)+'">Accept</button><button data-fx="sp:dec:'+enc(n)+'">Decline</button></div>').join('');
  h+=fr.length?fr.map(n=>{
   const st=friendStatus(s,n);
   return '<div class="evrow">💚 <b>'+esc(n)+'</b><span>'+st.label+'</span>'
    +(st.k==='online'?'<button data-fx="sp:goto:'+enc(n)+'">🧭 Ride to</button><button data-fx="sp:watch:'+enc(n)+'">👁️ Watch</button>':'')
    +(ranchData[n]?'<button data-fx="sp:tour:'+enc(n)+'">🏡 Visit</button>':'')
    +'<button data-fx="sp:gift:'+enc(n)+'">🎁 Gift</button>'
    +'<button data-fx="sp:unfriend:'+enc(n)+'">🤍</button></div>';
  }).join(''):note('No friends yet — befriend a rider below, or type /friend &lt;name&gt; in chat.');
  if(reqOut.length)h+=note('Waiting on: '+reqOut.map(esc).join(', '));

  /* --- riders here, with the social actions --- */
  h+=H3('🤝 Riders here now ('+riders.length+')');
  h+=riders.length?riders.map(r=>'<div class="evrow">🐴 <b>'+esc(r.name)+'</b><span>'
   +(r.crs?'🏆 '+esc(r.crs[0]):r.trail?'🥾 '+esc(r.trail[0]):esc(regionName(r.x,r.z)))+'</span>'
   +(s.friends[r.name]?'':'<button data-fx="sp:req:'+enc(r.name)+'">💌 Request</button>')
   +'<button data-fx="sp:watch:'+enc(r.name)+'">👁️</button>'
   +'<button data-fx="sp:sync:'+enc(r.name)+'">🤝</button>'
   +'<button data-fx="sp:block:'+enc(r.name)+'">🚫</button>'
   +'<button data-fx="sp:report:'+enc(r.name)+'">🚩</button>'
   +(amOwner()?'<button data-fx="sp:ban:'+enc(r.name)+'">⛔</button>':'')+'</div>').join('')
   :note('Nobody in sight. Share your club code, or ride the Commons.');

  /* --- named rides, pins, expeditions --- */
  const ride=G.trail&&G.trail.ride, draft=(G.trail&&G.trail.draft)||[], offer=G.trail&&G.trail.offer;
  h+=H3('🧭 Ride planner');
  h+='<div class="crow"><span class="lbl">Ride name</span><input id="spRideName" maxlength="24" value="'+esc(rideName)+'" placeholder="Sunrise loop"></div>'
   +'<div class="crow" style="gap:6px"><button data-fx="sp:pin">📍 Drop a pin here</button>'
   +'<button data-fx="sp:namesave">💾 Name it</button>'
   +'<button data-fx="sp:startnamed" '+(draft.length>=2?'class="claimBtn"':'disabled')+'>🥾 Start named ride</button></div>'
   +note('Pins use where you are standing: '+esc(regionName())+' ('+Math.round(H.player.pos.x)+', '+Math.round(H.player.pos.z)+'). '
    +(draft.length?'Draft: '+draft.map(p=>esc(p[0])).join(' → '):'The stop buttons above build the draft too.'));
  if(offer&&!ride)h+='<div class="evrow">🥾 <b>'+esc(offer.by)+'</b><span>'+esc(offer.name||'a ride')+' · '+offer.pts.map(p=>esc(p[0])).join(' → ')+'</span><button class="claimBtn" data-fx="sp:joinoffer">Join</button></div>';
  if(ride){
   const ro=ride.roster||{}, names=Object.keys(ro);
   h+='<div class="evrow">🥾 <b>'+esc(ride.name||'Trail ride')+'</b><span>stop '+(ride.idx+1)+'/'+ride.pts.length+' · next '+esc(ride.pts[Math.min(ride.idx,ride.pts.length-1)][0])+'</span></div>';
   h+=note('Riding with you: '+(names.length?names.map(n=>esc(n)+' ('+(ro[n]+1)+'/'+ride.pts.length+')').join(', '):'just you so far'));
  }
  h+=H3('🗺️ Expeditions');
  h+=EXPEDITIONS.map(e=>'<div class="evrow">'+e.icon+' <b>'+esc(e.name)+'</b><span>'+esc(e.blurb)+' · '+e.stops.length+' stops · '+e.regions+' regions · '+M.rewardLabel(e.r)
   +((s.expDone||{})[e.id]?' · done '+s.expDone[e.id]+'×':'')+'</span><button data-fx="sp:exped:'+e.id+'" '+(ride?'disabled':'class="claimBtn"')+'>Ride</button></div>').join('');

  /* --- ranch showcase --- */
  const shown=Object.keys(ranchData).sort((a,b)=>(ranchData[b].pts|0)-(ranchData[a].pts|0)).slice(0,12);
  h+=H3('🏡 Ranch showcase');
  h+='<div class="crow" style="gap:6px"><span style="font-size:12px;flex:1">Your ranch: '+ranchPts(s)+' builder points · ⭐ '+(s.ranchLikes||0)+' likes</span><button data-fx="sp:showranch">📤 Show mine</button></div>';
  h+=shown.length?shown.map(n=>'<div class="evrow">🏡 <b>'+esc(n)+'</b><span>'+esc(ranchData[n].ranchName||'')+' · '+(ranchData[n].pts|0)+' pts · ⭐ '+(ranchData[n].likes|0)+'</span>'
   +'<button class="claimBtn" data-fx="sp:tour:'+enc(n)+'">🏡 Visit</button></div>').join('')
   :note('No ranches on show yet — press “Show mine” and ask a club mate to do the same.');

  /* --- moderation --- */
  const blocked=Object.keys(s.blocked||{}), muted=Object.keys(s.tempMute||{}).filter(n=>s.tempMute[n]>now());
  h+=H3('🛡️ Safety and moderation');
  h+=note('There are no human moderators here and the broker is public and unauthenticated: anyone can type any name. '
   +'The word filter cleans what you send and what you read, 🚫 Block hides a rider for good, and 🚩 Report asks everyone present to mute them. '
   +'Two reports inside ten minutes mutes them here for thirty minutes. Bans are honour-system: your game honours them, a modified one need not.');
  h+='<div class="crow" style="gap:6px"><span style="font-size:12px;flex:1">Blocked: '+(blocked.length?blocked.map(esc).join(', '):'nobody')
   +(muted.length?' · muted: '+muted.map(esc).join(', '):'')+'</span>'
   +(blocked.length?'<button data-fx="sp:unblockall">Clear blocks</button>':'')+'</div>';
  h+='<div class="crow" style="gap:6px"><span style="font-size:12px;flex:1">Chat rooms: '+ROOM_ORDER.map(k=>CHAT_ROOMS[k].label).join(' · ')
   +' — tabs appear above the chat bar. '+SLASH.length+' slash commands; type /help.</span><button data-fx="sp:openchat">💬 Open chat</button></div>';
  return h;
 });

 U.action('sp',(a,btn)=>{
  const k=a[0], arg=a[1]!==undefined?dec(a.slice(1).join(':')):'';
  const s=S.fresh()||{};
  if(k==='commons')setCommons(a[1]==='1');
  else if(k==='req')sendFriend(arg,'req');
  else if(k==='acc')sendFriend(arg,'acc');
  else if(k==='dec')declineFriend(arg);
  else if(k==='unfriend')sendFriend(arg,'rm');
  else if(k==='goto')gotoFriend(arg);
  else if(k==='watch'){const r=remoteByName(arg);if(r){const id=Object.keys(N.remotes).find(i=>N.remotes[i]===r);startSpectate(id);}else toast('👁️ '+arg+' is not riding nearby.');}
  else if(k==='sync'){U.nameDialog({title:'Synced emote with '+arg+' — which one?\n'+Object.keys(T.EMOTES).join(', '),def:'rear',max:12,onDone:v=>{if(v)startSync(v.toLowerCase(),arg);}});}
  else if(k==='block')setBlocked(arg,!isBlocked(s,arg));
  else if(k==='report')reportRider(arg,'chat');
  else if(k==='ban')U.confirm({title:'Ban '+arg+' from this club?',body:'Every rider here who honours the ban stops seeing them. It cannot be enforced by the broker.',onYes:()=>banRider(arg)});
  else if(k==='unblockall'){S.sync(sv=>{sv.blocked={};});toast('✅ Block list cleared.');refreshOnline();}
  else if(k==='openchat'){const b=$('chatBar');b.style.display='flex';drawTabs();$('chatIn').focus();}
  else if(k==='namesave'){const el=$('spRideName');rideName=(el&&el.value||'').slice(0,24);toast('🏷️ Next ride: '+(rideName||'Trail ride'));}
  else if(k==='pin'){
   const d=(G.trail&&G.trail.draft)||[];
   if(d.length>=9){toast('A ride takes up to 9 stops.');return;}
   d.push(['📍 '+regionName().replace(/^\S+\s/,''),+H.player.pos.x.toFixed(0),+H.player.pos.z.toFixed(0)]);
   G.trail.draft=d; toast('📍 Pin dropped — '+d.length+' stop'+(d.length===1?'':'s')+' in the draft.'); refreshOnline();
  }
  else if(k==='startnamed'){
   const el=$('spRideName'); if(el)rideName=(el.value||'').slice(0,24);
   const d=(G.trail&&G.trail.draft)||[];
   if(startRide(d.map(p=>p.slice()),{to:friendsOf(s).length?friendsOf(s).slice(0,12):0}))G.trail.draft=[];
   refreshOnline();
  }
  else if(k==='joinoffer'){const o=G.trail&&G.trail.offer;if(o){G.trail.start(o.pts,o.by,{name:o.name,exped:o.exped});refreshOnline();}}
  else if(k==='exped'){
   const e=EXPEDITIONS.find(e=>e.id===a[1]); if(!e)return;
   rideName=e.name;
   if(startRide(e.stops.map(p=>p.slice()),{exped:e.id,name:e.name})){G.hidePanels();}
  }
  else if(k==='showranch'){publishRanch(true);toast('📤 Your ranch is on show to the club — '+ranchPts(s)+' builder points.');}
  else if(k==='tour')startTour(arg);
  else if(k==='endtour')endTour();
  else if(k==='gift'){
   U.nameDialog({title:'Send '+arg+' one piece of forage:\n'+GIFTABLE.join(', '),def:'carrot',max:12,onDone:v=>{if(v)sendGift(arg,v.toLowerCase());}});
  }
  else if(k==='coop')claimCoop(a[1]);
 });

 /* ======================= 15. The Co-op quest tab ======================= */
 U.questTab({id:'coop',label:'🧺 Co-op',render(s){
  const w=coopWeek(), names=Object.keys(w).sort((a,b)=>w[b]-w[a]), total=coopTotal();
  let h='<span style="font-size:12px;color:#8c7a63">Everything the club forages this week counts once, for everybody. '
   +'Pick berries beside a club mate and you both see the bush empty.</span>';
  h+=COOP_GOALS.map(g=>{
   const claimed=(s.coopClaims||{})[week()+':'+g.id];
   const pct=Math.min(100,Math.round(100*total/g.goal));
   return '<div class="qrow'+(claimed?' claimed':'')+'"><span class="qico">'+g.icon+'</span><span class="qmain"><b>'+g.label+'</b>'
    +'<span style="font-size:11px;color:#8c7a63;font-weight:600">'+g.desc+'</span>'
    +'<span class="qbar"><span class="qfill" style="width:'+pct+'%"></span></span></span>'
    +'<span style="font-size:11px;color:#8c7a63">'+total+'/'+g.goal+'</span>'
    +(claimed?'<span style="font-size:11px">✅</span>':'<button class="claimBtn" data-fx="sp:coop:'+g.id+'" '+(total>=g.goal?'':'disabled')+'>Claim</button>')
    +'</div>';
  }).join('');
  h+='<b style="font-size:13px;margin-top:6px">🧺 Contributors this week</b>';
  h+=names.length?names.map(n=>'<div class="evrow">'+(n===me()?'🫵':'🧺')+' <b>'+esc(n)+'</b><span>'+w[n]+' picked</span></div>').join('')
   :'<span style="font-size:12px;color:#8c7a63">Nothing picked yet this week. Carrots, lettuce, pumpkins, oranges and truffles all count.</span>';
  h+='<b style="font-size:13px;margin-top:6px">🎁 Helping friends</b>'
   +'<span style="font-size:12px;color:#8c7a63">Send a friend one piece of forage from 🌐 Club, or type /gift &lt;name&gt; &lt;item&gt;. '
   +'You can receive '+GIFT_CAP+' gifts a day; sending is unlimited and costs you the item. '
   +'Sent so far: '+((s.life&&s.life.help)||0)+' · received today: '+((s.giftDay===today()?s.giftN:0)||0)+'/'+GIFT_CAP+'.</span>';
  return h;
 }});

 /* ======================= 16. Quests, achievements, hooks ======================= */
 Q.addDaily({type:'exped',icon:'🗺️',label:'Finish an expedition',goal:1,r:{c:300,g:3,p:30,k:1}});
 Q.addDaily({type:'help',icon:'🤝',label:'Help a friend with forage',goal:1,r:{c:80,g:1,p:10}});
 Q.addDaily({type:'spectate',icon:'👁️',label:'Watch a rider or sit in the grandstand',goal:1,r:{c:50,g:1,p:5}});
 Q.addDaily({type:'tour',icon:'🏡',label:"Tour a club mate's ranch",goal:1,r:{c:80,g:1,p:10}});
 Q.addDaily({type:'synced',icon:'💃',label:'Do a synced emote with someone',goal:1,r:{c:100,g:2,p:12}});

 /* s.friends became an object long ago; the old achievement read .length off it and could
    never be claimed. Fix it in place rather than shipping a second, duplicate row. */
 const f1=Q.ACHS.find(a=>a.id==='friend1');
 if(f1)f1.v=s=>Object.keys(s.friends||{}).length;
 Q.addAch({id:'friend5',social:true,icon:'💚',label:'Good company',desc:'Make 5 friends',v:s=>Object.keys(s.friends||{}).length,goal:5,r:{g:2}});
 Q.addAch({id:'exped1',social:true,icon:'🧭',label:'Expedition leader',desc:'Finish an expedition',v:s=>(s.stats&&s.stats.expeditions)||0,goal:1,r:{g:2,k:1}});
 Q.addAch({id:'exped6',social:true,icon:'🗺️',label:'Every trail in the Basin',desc:'Finish all six expeditions at least once',v:s=>Object.keys(s.expDone||{}).length,goal:EXPEDITIONS.length,r:{g:6,k:2}});
 Q.addAch({id:'sync1',social:true,icon:'💃',label:'In step',desc:'Do a synced emote with another rider',v:s=>(s.stats&&s.stats.synced)||0,goal:1,r:{g:1}});
 Q.addAch({id:'tour1',social:true,icon:'🏡',label:'House guest',desc:"Tour a club mate's ranch",v:s=>(s.stats&&s.stats.tours)||0,goal:1,r:{c:150}});
 Q.addAch({id:'liked10',social:true,icon:'⭐',label:'Cute and cosy',desc:'Collect 10 likes on your ranch',v:s=>s.ranchLikes||0,goal:10,r:{g:3}});
 Q.addAch({id:'help10',social:true,icon:'🤝',label:'Good neighbour',desc:'Send 10 pieces of forage to friends',v:s=>(s.life&&s.life.help)||0,goal:10,r:{g:2,k:1}});
 Q.addAch({id:'spect5',social:true,icon:'👁️',label:'From the grandstand',desc:'Spectate five times',v:s=>(s.stats&&s.stats.spectated)||0,goal:5,r:{c:200}});

 /* Escape leaves spectating or a tour before it closes the panels. */
 G.on('escape',()=>{
  if(spec){stopSpectate();return true;}
  if(tour){endTour();return true;}
  tabBar.style.display='none';
  return undefined;
 });

 /* Per-frame: cheap, and everything early-returns when nothing social is happening. */
 let hudT=0;
 G.on('tick',(dt,t)=>{
  if(pending.length)tickSync();
  if(spec)H.player.speed=0;
  if(spec||tour){
   hudT+=dt;
   if(hudT>0.4){hudT=0; if(spec)drawSpecHud(); if(tour)drawTourHud();}
  }
 });
 G.on('region',()=>{
  if(!online())return;
  N.subscribe('loc/'+regionIdx());
  if(chatRoom==='local')drawTabs();
 });
 G.on('connect',()=>{
  N.subscribe('loc/'+regionIdx());
  N.subscribe('party');
  N.subscribe('srf1/{club}/coop/#');
  N.subscribe('srf1/{club}/ranch/#');
  const s=S.fresh()||{};
  if(s.pubChat||s.pubWorld)N.subscribe('srf1/'+COMMONS+'/chat');
  setTimeout(()=>{publishCoop();publishRanch(true);},2000);
 });
 G.on('interval30',()=>{publishRanch();publishCoop();});

 /* Boot: the module installs after the save has been read, so anything that had to look at
    the save (rooms, the remote cap, the Commons club swap) re-runs here. */
 G.on('boot',s=>{
  s=s||S.fresh()||{};
  chatRoom=s.chatRoom||'club';
  applyRemoteCap();
  drawTabs();
  if(s.pubWorld&&s.club!==COMMONS)S.sync(sv=>{if(sv.club!==COMMONS){sv.clubPriv=sv.club||'';sv.club=COMMONS;}});
  let first=false; S.sync(sv=>{first=S.flag(sv,'sp-welcome');});
  if(first)setTimeout(()=>toast('🤝 New in the club: friends with requests, four chat rooms, six expeditions, ranch tours and synced emotes. Press 💬 for the room tabs, 🌐 for the rest.'),9000);
 });

 /* QA surface: the headless script drives these directly instead of the broker. */
 G.social={COMMONS,CHAT_ROOMS,EXPEDITIONS,COOP_GOALS,SLASH,GIFTABLE,filter,ranchData,coopData,
  get room(){return chatRoom;},setRoom,say,slash,
  sendFriend,declineFriend,gotoFriend,friendStatus,setBlocked,reportRider,banRider,amOwner,
  startRide,startSync,scheduleEmote,tickSync,get pending(){return pending;},
  startSpectate,stopSpectate,get spectate(){return spec;},
  startTour,endTour,likeRanch,publishRanch,get tour(){return tour;},
  claimCoop,coopTotal,sendGift,setCommons,regionIdx,ranchPts,FRIEND_MAX,GIFT_CAP,TOUR,SEAT};
}
