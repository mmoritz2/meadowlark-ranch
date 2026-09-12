/* Headless check for the 'social-play' package.
   Boots ranch3d.html?qa=social-play, waits for the horse, then exercises all nine features
   through window.__features (G) and G.social, feeding synthetic MQTT messages straight into
   G.net.onMessage so nothing ever touches the public broker.

   Usage:  QA_URL=http://127.0.0.1:8446 NODE_PATH=$(npm root -g) node tools/qa-social-play.cjs
   Same shape as tools/qa-features.cjs. */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=social-play&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');

 /* Give ourselves a name so myName() is stable, and stand in a fake connected broker so the
    outbound publishes succeed and go nowhere. Every inbound message is fed to netOnMessage
    by hand, so nothing in this script ever reaches the real EMQX. */
 const stub=()=>page.evaluate(()=>{
  const G=window.__features;
  G.save.sync(s=>{s.playerName='QaRider';s.items=s.items||{};s.items.carrot=9;});
  G.net.net.club='qa';
  G.net.net.client={connected:true,sent:[],publish(t,p){this.sent.push([t,p]);},subscribe(){},unsubscribe(){},end(){},on(){}};
 });
 await stub();
 const waitRemote=id=>page.waitForFunction(i=>!!window.__features.horse.remotes[i],id,{timeout:60000,polling:120});
 const pos=(id,o)=>page.evaluate(([id,o])=>window.__features.net.onMessage('srf1/qa/pos',JSON.stringify(Object.assign({id,n:'Ada',x:0,z:0,h:0,sp:0,b:'bay'},o))),[id,o]);

 /* ---------- 0. installed ---------- */
 const boot=await page.evaluate(()=>{
  const G=window.__features;
  return {has:!!G,installed:G.installed.includes('social-play'),err:G.errors.filter(e=>e.id==='social-play'),
   social:!!G.social,trail:!!G.trail,chatLines:G.chatLines,remoteMax:G.remoteMax};
 });
 check('package installed',boot.has&&boot.installed&&boot.err.length===0,boot.err);
 check('G.social + G.trail exposed',boot.social&&boot.trail);
 check('chat scrollback raised and remote cap scaled',boot.chatLines===30&&boot.remoteMax>=10,{lines:boot.chatLines,cap:boot.remoteMax});

 /* ---------- 1. chat-moderation: the filter ---------- */
 const filt=await page.evaluate(()=>{
  const f=window.__features.social.filter;
  return {kind:f.clean('kindness and courage 123'),num:f.clean('meet me at 7:30 by the 3 oaks'),
   rude:f.clean('you idiot'),pad:f.clean('what the f-u-c-k'),grass:f.clean('the grass is classic')};
 });
 check('filter leaves kindness, courage and numbers alone',
  filt.kind.text==='kindness and courage 123'&&!filt.kind.flagged&&!filt.num.flagged,[filt.kind.text,filt.num.text]);
 check('filter stars a personal attack (soft)',filt.rude.flagged&&filt.rude.level==='soft'&&filt.rude.text.indexOf('*')>0,filt.rude.text);
 check('filter catches a padded word (hard)',filt.pad.flagged&&filt.pad.level==='hard',filt.pad.text);
 check('filter never touches grass/classic',!filt.grass.flagged,filt.grass.text);

 /* An inbound rude line is starred in the feed; a blocked rider is silent. */
 const mod=await page.evaluate(async()=>{
  const G=window.__features, feed=()=>document.getElementById('chatFeed');
  const topic='srf1/qa/chat';
  G.net.onMessage(topic,JSON.stringify({id:'troll1',n:'Troll',t:'you idiot'}));
  const starred=feed().lastChild.textContent;
  const before=feed().children.length;
  G.social.setBlocked('Troll',true);
  G.net.onMessage(topic,JSON.stringify({id:'troll1',n:'Troll',t:'hello again'}));
  const after=feed().children.length;
  const blocked=!!G.save.fresh().blocked.Troll;
  /* Two different reporters inside ten minutes mutes a rider locally. */
  G.net.onMessage(topic,JSON.stringify({id:'a1',n:'Ada',t:'',rep:{who:'Rowdy',why:'chat'}}));
  G.net.onMessage(topic,JSON.stringify({id:'b1',n:'Bo',t:'',rep:{who:'Rowdy',why:'chat'}}));
  const muted=(G.save.fresh().tempMute||{}).Rowdy>Date.now();
  const n0=feed().children.length;
  G.net.onMessage(topic,JSON.stringify({id:'r9',n:'Rowdy',t:'still here'}));
  const n1=feed().children.length;
  return {starred,grew:after>before,blocked,muted,mutedSilent:n1===n0};
 });
 check('inbound rude line arrives starred',mod.starred.indexOf('*')>0,mod.starred);
 check('blocking a rider swallows their chat',mod.blocked&&!mod.grew);
 check('two reports mute a rider for 30 min',mod.muted&&mod.mutedSilent);

 /* ---------- 2. text-chat: rooms and slash commands ---------- */
 const chat=await page.evaluate(()=>{
  const G=window.__features, feed=()=>document.getElementById('chatFeed');
  document.getElementById('chatBtn').click();
  const tabs=document.getElementById('chatTabs');
  const tabCount=tabs?tabs.querySelectorAll('[data-room]').length:0;
  const el=document.getElementById('chatIn');
  el.value='/help'; document.getElementById('chatSend').onclick();
  const helpText=Array.from(feed().children).map(c=>c.textContent).join('\n');
  G.social.setRoom('local');
  const room=G.social.room;
  const idx=G.social.regionIdx();
  G.net.onMessage('srf1/qa/loc/'+idx,JSON.stringify({id:'a2',n:'Ada',t:'hi from here'}));
  const localLine=feed().lastChild.textContent;
  G.net.onMessage('srf1/qa/loc/'+((idx+1)%11),JSON.stringify({id:'a3',n:'Ada',t:'far away'}));
  const afterFar=feed().lastChild.textContent;
  G.net.onMessage('srf1/qa/party',JSON.stringify({id:'a4',n:'Ada',t:'party time'}));
  const partyLine=feed().lastChild.textContent;
  /* A whisper addressed to somebody else never shows. */
  const n0=feed().children.length;
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'a5',n:'Ada',t:'psst',to:'Someone Else'}));
  const n1=feed().children.length;
  G.social.setRoom('club');
  return {tabCount,helpHasW:helpText.indexOf('/w <name>')>=0,cmds:G.social.SLASH.length,
   room,localLine,afterFar,partyLine,whisperHidden:n1===n0,max:el.maxLength};
 });
 check('four room tabs above the chat bar',chat.tabCount===4,chat.tabCount);
 check('/help lists every slash command',chat.helpHasW&&chat.cmds>=16,chat.cmds);
 check('room switch writes chatRoom',chat.room==='local');
 check('a Local line is prefixed with its room',chat.localLine.indexOf('📍')===0,chat.localLine);
 check('Local drops chatter from another region',chat.afterFar===chat.localLine,chat.afterFar);
 check('a Party line is prefixed with its room',chat.partyLine.indexOf('🎉')===0,chat.partyLine);
 check("someone else's whisper never shows",chat.whisperHidden);
 check('chat input takes 120 characters',chat.max===120,chat.max);

 /* ---------- 3. shared-open-world: a remote rider with height and emote ---------- */
 await pos('q1',{x:5,z:8,y:0.8,fl:0,he:['bow',0],crs:['Cottonwood Preliminary',3,12.5,0],rp:64});
 await waitRemote('q1');
 const remote=await page.evaluate(async()=>{
  const G=window.__features;
  G.net.onMessage('srf1/qa/pos',JSON.stringify({id:'q1',n:'Ada',x:5,z:8,h:0,sp:0,b:'bay',y:0.8,fl:0,
   he:['bow',0],crs:['Cottonwood Preliminary',3,12.5,0],rp:64}));
  await window.advanceTime(600);
  const r=G.horse.remotes.q1;
  const st=JSON.parse(window.render_game_to_text());
  return r?{n:1,name:r.name,y:+r.y.toFixed(2),groupY:+r.parts.group.position.y.toFixed(2),
   ground:+G.world.groundH(5,8).toFixed(2),em:r.em&&r.em.type,rigEm:!!(r.rig&&r.rig.emote),
   crs:r.crs,netRemotes:st.net&&st.net.remotes,netClub:st.net&&st.net.club,social:!!st.social}:{n:0};
 });
 check('a synthetic /pos packet builds a remote rider',remote.n===1&&remote.name==='Ada',remote);
 check('remote height is replicated above the ground',remote.groupY>remote.ground+0.5,{y:remote.groupY,ground:remote.ground});
 check('remote horse emote is replicated',remote.em==='bow',remote.em);
 check('remote competition state is replicated',Array.isArray(remote.crs)&&remote.crs[0].indexOf('Cottonwood')===0,remote.crs);
 check('render_game_to_text carries net{} and social{}',remote.netRemotes===1&&remote.social,{r:remote.netRemotes});

 /* The Commons toggle swaps the club and keeps the private code. */
 const commons=await page.evaluate(()=>{
  const G=window.__features;
  G.save.sync(s=>{s.club='mr-private';s.pubWorld=false;s.clubPriv='';});
  G.social.setCommons(true);
  const a=G.save.fresh();
  G.social.setCommons(false);
  const b=G.save.fresh();
  return {on:a.club,priv:a.clubPriv,pub:a.pubWorld,off:b.club,offPub:b.pubWorld,COMMONS:G.social.COMMONS};
 });
 check('the Commons toggle joins the public room',commons.on===commons.COMMONS&&commons.pub===true&&commons.priv==='mr-private',commons);
 check('leaving the Commons restores the private code',commons.off==='mr-private'&&commons.offPub===false,commons);
 await stub();   // setCommons() called netConnect(), which replaced our fake client

 /* ---------- 4. friends-list ---------- */
 await page.evaluate(()=>{const G=window.__features;for(const k of Object.keys(G.horse.remotes)){G.scene.remove(G.horse.remotes[k].parts.group);delete G.horse.remotes[k];}});
 await pos('q2',{x:40,z:40});
 await waitRemote('q2');
 const friends=await page.evaluate(()=>{
  const G=window.__features, mine=G.net.myName();
  G.save.sync(s=>{s.friends={Ada:true};s.friendReq={in:{Bo:Date.now()},out:{}};});
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'c1',n:'Cy',t:'',fr:{k:'req',to:mine}}));
  const req=Object.keys(G.save.fresh().friendReq.in);
  G.social.sendFriend('Cy','acc');
  const nowFriends=Object.keys(G.save.fresh().friends);
  G.social.gotoFriend('Ada');
  const p=JSON.parse(window.render_game_to_text()).player;
  const ach=G.quest.ACHS.find(a=>a.id==='friend1');
  const ach5=G.quest.ACHS.find(a=>a.id==='friend5');
  const st=G.social.friendStatus(G.save.fresh(),'Ada');
  return {req,nowFriends,x:p.x,z:p.z,ach1:ach&&ach.v({friends:{Ada:true,Cy:true}}),has5:!!ach5,
   status:st.k,cap:G.social.FRIEND_MAX};
 });
 check('an inbound friend request lands in friendReq.in',friends.req.indexOf('Cy')>=0,friends.req);
 check('accepting makes them a friend',friends.nowFriends.indexOf('Cy')>=0&&friends.nowFriends.indexOf('Ada')>=0,friends.nowFriends);
 check('ride-to-friend teleports beside them',Math.abs(friends.x-40)<6&&Math.abs(friends.z-40)<6,{x:friends.x,z:friends.z});
 check('friend status reads online for a nearby rider',friends.status==='online',friends.status);
 check('the friend1 achievement counts an object again',friends.ach1===2&&friends.has5,friends.ach1);
 check('friends are capped',friends.cap===50,friends.cap);

 /* The panel shows the friends section. */
 const panel=await page.evaluate(()=>{
  const G=window.__features;
  G.save.sync(s=>{s.friendReq={in:{Bo:Date.now()},out:{}};});
  document.getElementById('netBtn').click();
  const p=document.getElementById('onlinePanel');
  const txt=p.textContent;
  const hasGoto=!!p.querySelector('[data-fx^="sp:goto:"]');
  const hasExped=!!p.querySelector('[data-fx="sp:exped:hollowpeak"]');
  const hasPin=!!p.querySelector('[data-fx="sp:pin"]');
  const hasBlock=!!p.querySelector('[data-fx^="sp:block:"]');
  p.style.display='none';
  return {txt,hasGoto,hasExped,hasPin,hasBlock};
 });
 check('🌐 Club lists friends with a pending request',panel.txt.indexOf('Friends')>0&&panel.txt.indexOf('Bo')>0&&panel.txt.indexOf('wants to be friends')>0);
 check('🌐 Club offers ride-to, block, pins and all six expeditions',panel.hasGoto&&panel.hasBlock&&panel.hasPin&&panel.hasExped);
 check('🌐 Club states there is no human moderation',panel.txt.indexOf('no human moderators')>0);
 check('🌐 Club shows the Commons and the showcase',panel.txt.indexOf('The Commons')>0&&panel.txt.indexOf('Ranch showcase')>0);

 /* ---------- 5. trail-rides-and-expeditions ---------- */
 const trail=await page.evaluate(async()=>{
  const G=window.__features;
  const coins0=JSON.parse(window.render_game_to_text()).wallet.coins;
  G.social.startRide([['A',0,5],['B',20,16]],{name:'QA Loop'});
  const named=G.trail.ride&&G.trail.ride.name;
  G.horse.player.pos.set(0,0,5); await window.advanceTime(260);
  const mid=G.trail.ride?G.trail.ride.idx:-1;
  G.horse.player.pos.set(20,0,16); await window.advanceTime(260);
  const done=G.trail.ride===null;
  const s=G.save.fresh();
  const coins1=JSON.parse(window.render_game_to_text()).wallet.coins;
  /* And an expedition: teleport through every stop. */
  const ex=G.social.EXPEDITIONS[0];
  G.social.startRide(ex.stops.map(p=>p.slice()),{exped:ex.id,name:ex.name});
  for(const st of ex.stops){G.horse.player.pos.set(st[1],0,st[2]);await window.advanceTime(240);}
  const s2=G.save.fresh();
  const coins2=JSON.parse(window.render_game_to_text()).wallet.coins;
  /* An invitation addressed to somebody else is ignored. */
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'z1',n:'Zed',t:'',tr:[['A',1,1],['B',2,2]],nm:'Private',to:['Nobody']}));
  const ignored=!G.trail.offer||G.trail.offer.name!=='Private';
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'z1',n:'Zed',t:'',tr:[['A',1,1],['B',2,2]],nm:'Open ride'}));
  const accepted=G.trail.offer&&G.trail.offer.name==='Open ride';
  return {named,mid,done,trails:s.stats.trails,coinsCustom:coins1-coins0,
   exped:s2.stats.expeditions,expDone:Object.keys(s2.expDone||{}),coinsExped:coins2-coins1,
   ignored,accepted,exReward:ex.r.c,n:G.social.EXPEDITIONS.length};
 });
 check('a named ride runs and completes',trail.named==='QA Loop'&&trail.mid===1&&trail.done,trail);
 check('a custom ride pays by distance',trail.trails>=1&&trail.coinsCustom>=80,{coins:trail.coinsCustom,trails:trail.trails});
 check('six expeditions ship',trail.n===6,trail.n);
 check('an expedition pays its own reward',trail.exped===1&&trail.coinsExped>=trail.exReward,{got:trail.coinsExped,want:trail.exReward});
 check('the expedition is logged for the achievement',trail.expDone.length===1,trail.expDone);
 check('an invite-only ride ignores riders it was not sent to',trail.ignored&&trail.accepted);

 /* ---------- 6. synced-emotes ---------- */
 const sync=await page.evaluate(async()=>{
  const G=window.__features, mine=G.net.myName();
  G.horse.player.speed=0;
  /* Zed is not a friend and is nowhere near, so this one must wait for a Join click. */
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'a9',n:'Zed',t:'',sync:{type:'rear',at:Date.now()+500,to:mine}}));
  const pend0=G.social.pending.length;
  const feed=document.getElementById('chatFeed');
  const btn=feed.querySelector('.spLine button');
  if(btn)btn.click();
  const pend1=G.social.pending.length;
  await new Promise(r=>setTimeout(r,900));
  await window.advanceTime(200);
  const RIG=G.horse.RIG();
  const s=G.save.fresh();
  return {pend0,pend1,emote:RIG.emote&&RIG.emote.type,synced:(s.stats||{}).synced||0,
   ach:!!G.quest.ACHS.find(a=>a.id==='sync1')};
 });
 check('a synced-emote invitation offers a Join button',sync.pend0===0&&sync.pend1===1,sync);
 check('accepting fires the emote at the agreed moment',sync.emote==='rear',sync.emote);
 check('a synced emote is counted and has an achievement',sync.synced>=1&&sync.ach,sync.synced);

 /* ---------- 7. spectating ---------- */
 await pos('q5',{x:60,z:60,crs:['Basin Derby',3,12.5,1]});
 await waitRemote('q5');
 const spectate=await page.evaluate(async()=>{
  const G=window.__features;
  document.activeElement&&document.activeElement.blur();
  document.getElementById('chatBar').style.display='none';
  const spec0=(G.save.fresh().stats||{}).spectated||0;
  G.horse.player.pos.set(-27,0,0); G.horse.player.speed=0;
  await window.advanceTime(400);
  const ctx=(document.getElementById('ctx')||{}).textContent||'';
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  await window.advanceTime(400);
  const seat=!!(G.social.spectate&&G.social.spectate.seat);
  const camSeat=JSON.parse(window.render_game_to_text()).camera;
  G.social.startSpectate('q5');
  await window.advanceTime(600);
  const cam=JSON.parse(window.render_game_to_text()).camera;
  const hud=document.getElementById('specHud');
  const hudTxt=hud.textContent, hudShown=hud.style.display==='flex';
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));
  await window.advanceTime(200);
  const stopped=G.social.spectate===null;
  const st=JSON.parse(window.render_game_to_text());
  return {ctx,seat,camSeatX:camSeat.x,dist:Math.hypot(cam.x-60,cam.z-60),hudTxt,hudShown,stopped,
   spectated:((G.save.fresh().stats||{}).spectated||0)-spec0,state:st.social.spectating};
 });
 check('the grandstand is an interactable near the arena',spectate.ctx.indexOf('grandstand')>=0,spectate.ctx);
 check('E takes the grandstand seat and moves the camera there',spectate.seat&&spectate.camSeatX<-28,spectate.camSeatX);
 check('watching a rider puts the camera on them',spectate.dist<12,spectate.dist);
 check('the spectate HUD names the rider and their round',spectate.hudShown&&spectate.hudTxt.indexOf('Ada')>0&&spectate.hudTxt.indexOf('faults')>0,spectate.hudTxt);
 check('Escape stops spectating',spectate.stopped&&spectate.state===null);
 check('spectating is counted',spectate.spectated>=2,spectate.spectated);

 /* ---------- 8. cooperative-foraging ---------- */
 const coop=await page.evaluate(async()=>{
  const G=window.__features, mine=G.net.myName(), wk=G.time.weekKey();
  const f=G.world.forage.find(f=>f.g&&f.g.visible);
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'a7',n:'Ada',t:'',fg:[f.item,+f.g.position.x.toFixed(0),+f.g.position.z.toFixed(0)]}));
  const hidden=f.g.visible===false;
  G.net.onMessage('srf1/qa/coop/'+wk+'/Ada',JSON.stringify({n:'Ada',v:31}));
  const total=G.social.coopTotal();
  const coins0=JSON.parse(window.render_game_to_text()).wallet.coins;
  G.social.claimCoop('basket');
  const coins1=JSON.parse(window.render_game_to_text()).wallet.coins;
  const claimed=!!G.save.fresh().coopClaims[wk+':basket'];
  const twice=(G.social.claimCoop('basket'),JSON.parse(window.render_game_to_text()).wallet.coins);
  /* A gift from a friend credits the item, capped per day. */
  const before=(G.save.fresh().items||{}).lettuce||0;
  for(let i=0;i<5;i++)G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'a8',n:'Ada',t:'',gift:{item:'lettuce',to:mine}}));
  const after=(G.save.fresh().items||{}).lettuce||0;
  /* Sending one costs the sender and counts toward the helper achievement. */
  const carrots0=(G.save.fresh().items||{}).carrot||0;
  G.social.sendGift('Ada','carrot');
  const s=G.save.fresh();
  /* The 🧺 Co-op quest tab renders the contributors. */
  document.getElementById('questBtn').click();
  const tab=document.querySelector('[data-q="tab:coop"]');
  if(tab)tab.click();
  const qp=document.getElementById('questPanel');
  const qtxt=qp.textContent;
  qp.style.display='none';
  return {hidden,total,paid:coins1-coins0,claimed,noDouble:twice===coins1,
   gained:after-before,cap:G.social.GIFT_CAP,sent:(s.life||{}).help||0,carrotsSpent:carrots0-((s.items||{}).carrot||0),
   tab:!!tab,qHasAda:qtxt.indexOf('Ada')>0,qHasBasket:qtxt.indexOf('Club basket')>0};
 });
 check("a club mate's pick empties the same bush here",coop.hidden);
 check('the retained co-op topic totals the club',coop.total>=31,coop.total);
 check('the weekly basket pays once',coop.claimed&&coop.paid>=400&&coop.noDouble,{paid:coop.paid});
 check('received gifts are capped per day',coop.gained===coop.cap,{gained:coop.gained,cap:coop.cap});
 check('sending a gift costs the item and counts as help',coop.carrotsSpent===1&&coop.sent>=1,coop);
 check('the 🧺 Co-op quest tab lists goals and contributors',coop.tab&&coop.qHasBasket&&coop.qHasAda);

 /* ---------- 9. ranch-showcase ---------- */
 const showcase=await page.evaluate(async()=>{
  const G=window.__features;
  G.net.onMessage('srf1/qa/ranch/Ada',JSON.stringify({n:'Ada',pts:60,lk:4,rn:'Willow Hollow',
   d:[['haybale',3,7,0],['bench',-2,9,0.7],['lantern',5,4,0]]}));
  const known=!!G.social.ranchData.Ada;
  G.social.startTour('Ada');
  await window.advanceTime(200);
  const meshes=G.scene.children.filter(o=>o.userData&&o.userData.tour).length;
  const hud=document.getElementById('tourHud');
  const hudShown=hud.style.display==='flex', hudTxt=hud.textContent;
  const p=JSON.parse(window.render_game_to_text()).player;
  const nearPaddock=Math.hypot(p.x-G.social.TOUR[0],p.z-G.social.TOUR[1])<30;
  G.social.likeRanch('Ada');
  const liked=!!G.save.fresh().likesGiven.Ada;
  G.social.endTour();
  await window.advanceTime(120);
  const left=G.scene.children.filter(o=>o.userData&&o.userData.tour).length;
  const s=G.save.fresh();
  /* An inbound like on OUR ranch counts. */
  G.net.onMessage('srf1/qa/chat',JSON.stringify({id:'a6',n:'Ada',t:'',like:G.net.myName()}));
  const mine=G.save.fresh().ranchLikes;
  const board=G.tables.BOARDS.find(b=>b.k==='ranchlikes');
  return {known,meshes,hudShown,hudTxt,nearPaddock,liked,left,tours:(s.stats||{}).tours||0,
   mine,board:!!board,boardVal:board&&board.val({ranchLikes:7}),state:JSON.parse(window.render_game_to_text()).social.tour};
 });
 check("a retained ranch topic registers a club mate's build",showcase.known);
 check('a tour rebuilds every piece in the showcase paddock',showcase.meshes===4&&showcase.nearPaddock,showcase.meshes);
 check('the tour HUD names the ranch',showcase.hudShown&&showcase.hudTxt.indexOf('Willow Hollow')>0,showcase.hudTxt);
 check('liking is recorded once a week',showcase.liked);
 check('leaving a tour disposes every piece and counts the visit',showcase.left===0&&showcase.tours>=1&&showcase.state===null,showcase);
 check('an inbound like lands on our ranch and on a board',showcase.mine>=1&&showcase.board&&showcase.boardVal===7,showcase);

 /* ---------- 10. quests, achievements and the save shape ---------- */
 const meta=await page.evaluate(()=>{
  const G=window.__features, s=G.save.fresh();
  const dq=['exped','help','spectate','tour','synced'].filter(t=>G.quest.DAILYQ.some(r=>r.type===t));
  const ach=['friend5','exped1','exped6','sync1','tour1','liked10','help10','spect5'].filter(id=>G.quest.ACHS.some(a=>a.id===id));
  const fields=['pubWorld','pubChat','clubPriv','friendReq','blocked','tempMute','reports','chatRoom',
   'coopClaims','giftDay','giftN','likesGiven','ranchLikes','expDone'].filter(k=>s[k]===undefined);
  return {dq,ach,missing:fields};
 });
 check('six new dailies are registered',meta.dq.length===5,meta.dq);
 check('eight new achievements are registered',meta.ach.length===8,meta.ach);
 check('every new save field has an ensure default',meta.missing.length===0,meta.missing);

 /* ---------- old saves ---------- */
 const oldSave=await page.evaluate(async()=>{
  const G=window.__features, KEY=G.save.KEY;
  const raw=JSON.parse(localStorage.getItem(KEY));
  ['pubWorld','pubChat','clubPriv','friendReq','blocked','tempMute','reports','chatRoom','coopClaims',
   'giftDay','giftN','likesGiven','ranchLikes','expDone'].forEach(k=>delete raw[k]);
  localStorage.setItem(KEY,JSON.stringify(raw));
  G.save.sync(()=>{});
  const s=G.save.fresh();
  return ['pubWorld','friendReq','blocked','coopClaims','likesGiven','ranchLikes','expDone'].filter(k=>s[k]===undefined);
 });
 check('a save without the new fields is repaired on the next sync',oldSave.length===0,oldSave);

 const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 console.log('\nstate.net    '+JSON.stringify(state.net));
 console.log('state.social '+JSON.stringify(state.social));
 const real=errors.filter(e=>!/favicon|mqtt|broker|WebSocket|ERR_/i.test(e));
 check('no page errors',real.length===0,real.slice(0,4));

 const bad=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-bad.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(_){}process.exit(2);});
