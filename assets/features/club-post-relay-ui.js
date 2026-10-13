/* Clubhouse, riding prompts and actor-attached cargo for the two-courier relay.
   The host controller owns all eligibility, ownership and record decisions. */
export const id='club-post-relay-ui';
export function install(G){
 const R=G.clubPostRelay,U=G.ui,T=G.THREE,W=G.world,H=G.horse;
 if(!R||!U||!T||!W||!H)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seconds=v=>(Number.isFinite(v)?Math.max(0,v):0).toFixed(1)+' s';
 const snap=()=>R.snapshot(),people=c=>c?.roster||[];
 const rider=(c,id)=>people(c).find(r=>r.id===id)?.name||'Your teammate';
 const button=(action,label,{disabled=false,primary=false,attrs=''}={})=>'<button type="button" data-fx="relaypost:'+action+'"'+(primary?' class="primary"':'')+(disabled?' disabled':'')+(attrs?' '+attrs:'')+'>'+esc(label)+'</button>';
 let receipt=null,resultTimer=0,resultStamp='',ridingId=null,tick=0,art=null,artState=null;
 const style=document.createElement('style');style.id='clubPostRelayStyle';style.textContent=`
 .ch-post{margin:0 0 24px;padding:24px;border:1px solid #b9baa2;border-radius:12px;background:linear-gradient(120deg,#eee6ca,#fffaf0);color:#304f3c;min-width:0;overflow-wrap:anywhere}.ch-post *{box-sizing:border-box}.ch-post h2{margin:6px 0 10px;font:600 30px Georgia,serif}.ch-post h3{margin:0 0 8px;font-size:17px}.ch-post p{line-height:1.55;margin:8px 0}.ch-post-kicker{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:800}.ch-post-note{font-size:13px;color:#5c6d55}.ch-post-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ch-post button,.post-relay-result button,#clubPostRelayHud button{font:700 13px system-ui;min-height:44px;padding:9px 13px;border:1px solid #879c77;border-radius:8px;background:#fffbee;color:#304f3c;cursor:pointer;touch-action:manipulation;white-space:normal}.ch-post button.primary,.post-relay-result button.primary{background:#315d43;color:#fff9e9;border-color:#315d43}.ch-post button:disabled,.post-relay-result button:disabled,#clubPostRelayHud button:disabled{opacity:.55;cursor:default}.ch-post button:focus-visible,.post-relay-result button:focus-visible,#clubPostRelayHud button:focus-visible{outline:3px solid #d4aa4f;outline-offset:3px}.ch-post-party{margin-top:18px;padding-top:16px;border-top:1px solid #c8c5aa}.ch-post-roster{list-style:none;padding:0;margin:12px 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}.ch-post-roster li{padding:10px 0;border-bottom:1px solid #cbcbb5;min-width:0}.ch-post-roster strong,.ch-post-roster small{display:block}.ch-post-roster small{font-size:12px;margin-top:4px}.ch-post-message{padding:10px 12px;border-left:3px solid #b29855;background:#fff5d7;font-size:13px;line-height:1.5}.ch-post-lobbies{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px;margin-top:18px}.ch-post-lobby{padding:16px;border:1px solid #c7cbb2;border-radius:10px;background:#fffdf5}.ch-post-lobby button{width:100%}.ch-post-path{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;margin:14px 0}.ch-post-path span{background:#f5f0df;border:1px solid #d4ceb8;border-radius:6px;padding:6px 9px}
 #clubPostRelayHud{position:fixed;left:18px;bottom:115px;width:min(355px,calc(100vw - 36px));padding:13px 15px;border:1px solid #e3ce9755;border-radius:13px;background:#193e34f5;color:#fff9e9;z-index:8;box-sizing:border-box;font:13px/1.45 system-ui;box-shadow:0 8px 24px #173b342b;overflow-wrap:anywhere}#clubPostRelayHud[hidden],#clubPostRelayHud [hidden]{display:none!important}#clubPostRelayHud strong{display:block;font-size:17px;margin:4px 0 6px}#clubPostRelayHud .post-relay-top{display:flex;justify-content:space-between;gap:10px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#e8d8ad}#clubPostRelayHud .post-relay-cargo{font-size:12px;color:#dce8d0}#clubPostRelayHud p{margin:8px 0 11px}#clubPostRelayHud .post-relay-controls{display:flex;gap:8px;flex-wrap:wrap}#clubPostRelayHud button{background:#eddbab;border-color:#e4d09c}#clubPostRelayHud button.secondary{background:transparent;color:#fff9e9;border-color:#e3e6cf66}#clubPostRelayRoutes{display:flex;gap:8px;margin:0 0 9px}#clubPostRelayRoutes button{flex:1;background:transparent;color:#fff9e9}#clubPostRelayRoutes button[aria-pressed="true"]{background:#eddbab;color:#304f3c}.club-post-relay-riding :is(#questTrack,#sgFocus,#seGoal,#seWay,#rushQuick){display:none!important}body.se-screen-open #clubPostRelayHud,body.club-hub-open #clubPostRelayHud,body.freecam #clubPostRelayHud,body.posing #clubPostRelayHud{display:none!important}
 #clubPostRelayResultPanel{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;transform:none!important;margin:0!important;padding:24px!important;box-sizing:border-box;border:0!important;border-radius:0!important;background:radial-gradient(ellipse at top right,#e5ecd4,transparent 60%),#faf4e7!important;color:#304f3c!important;z-index:14!important;overflow:auto!important}#clubPostRelayResultPanel>.mk-x{display:none!important}.post-relay-result{width:min(620px,100%);margin:auto;font-family:system-ui;min-width:0;overflow-wrap:anywhere}.post-relay-result h1{font:600 clamp(32px,7vw,48px)/1.1 Georgia,serif;margin:12px 0}.post-relay-result>p{font-size:15px;line-height:1.6;color:#556b54}.post-relay-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.post-relay-stats>div{padding:18px;border:1px solid #c9cfb7;border-radius:10px;background:#fffdf5}.post-relay-stats strong{display:block;font-size:30px;font-variant-numeric:tabular-nums}.post-relay-stats small{display:block;margin-top:6px;font-size:12px;line-height:1.4}.post-relay-team{padding:16px;border-radius:10px;background:#e8eedc;line-height:1.7}.post-relay-save{padding:14px 16px;border-left:3px solid #769754;background:#e8eedc;margin-top:16px;font-size:14px;line-height:1.55}.post-relay-save.pending{border-color:#b29855;background:#fff0cf}.post-relay-result .ch-post-actions>button{flex:1 1 130px}
 @media(max-width:700px){.ch-post{padding:17px}.ch-post h2{font-size:25px}.ch-post-roster{grid-template-columns:1fr}.ch-post-actions>button{flex:1 1 120px}#clubPostRelayHud{top:calc(134px + env(safe-area-inset-top));bottom:auto;left:14px;width:min(355px,calc(100vw - 28px));padding:10px 13px}#clubPostRelayHud strong{font-size:16px}#clubPostRelayHud p{margin:6px 0 8px}#clubPostRelayResultPanel{padding:20px!important}.post-relay-stats{gap:8px}.post-relay-stats>div{padding:14px 12px}.post-relay-stats strong{font-size:25px}.post-relay-result .ch-post-actions{flex-direction:column}.post-relay-result .ch-post-actions>button{flex:auto;width:100%}}
 @media(max-height:520px) and (min-width:600px){#clubPostRelayHud{top:10px;bottom:auto;left:50%;transform:translateX(-50%);width:310px;padding:8px 11px;font-size:11px}#clubPostRelayHud strong{font-size:15px;margin:2px 0}#clubPostRelayHud p{margin:5px 0}#clubPostRelayRoutes{margin-bottom:5px}#clubPostRelayHud button{min-height:36px;padding:6px 8px;font-size:11px}.post-relay-stats{margin:14px 0}.post-relay-stats>div{padding:12px}.post-relay-result h1{font-size:32px}}
 `;document.head.append(style);
 function roster(c){return '<ul class="ch-post-roster">'+people(c).map(r=>'<li><strong>'+esc(r.name)+(r.id===c.hostId?' · Host':'')+'</strong><small>'+esc(r.online===false?'Offline':c.status==='waiting'?(r.ready?'Ready':'Getting ready'):r.id===c.firstId?'Wren ↔ Pines courier':'Pines ↔ Ada courier')+'</small></li>').join('')+'</ul>';}
 function section(){
  const s=snap(),c=s.current,available=s.connected&&!!s.code;
  let body='';
  if(c){
   let actions='';
   if(c.status==='waiting'){
    actions=button('ready',c.ready?'Not ready':'Ready',{disabled:!s.connected,primary:!c.ready,attrs:'aria-pressed="'+!!c.ready+'"'});
    if(c.hosted)actions+=button('start','Start post relay',{disabled:!c.canStart,primary:true})+button('start-other','Teammate rides first',{disabled:!c.canStart});
   }else if(c.status==='riding')actions=button('return','Return to the relay',{primary:true});
   else if(c.status==='finished'&&s.lastResult)actions=button('result','View shared time',{primary:true});
   actions+=button('leave',c.hosted?(c.status==='waiting'?'Close gathering':'End relay'):'Leave relay',{disabled:s.lastResult?.saved===false});
   body='<div class="ch-post-party"><h3>'+esc(c.status==='waiting'?'Gather two couriers':c.status==='finished'?'Reply delivered':'Your courier team')+'</h3>'+roster(c)+(c.status==='waiting'?'<p class="ch-post-message">Choose Ready to take a courier leg when the host starts. The host rides Wren’s leg first, or chooses Teammate rides first to swap roles.</p>':'')+'<div class="ch-post-actions">'+actions+'</div></div>';
  }else body='<div class="ch-post-actions">'+button('host','Host post relay',{disabled:!available,primary:true})+(s.lastResult?button('result','Last post relay'):'')+'</div>';
  const lobbies=(s.lobbies||[]).filter(l=>l.id!==c?.id);
  return '<section class="ch-post" aria-label="Cottonwood club post relay"><span class="ch-post-kicker">Two riders · One pouch</span><h2>The Cottonwood relay</h2><p>Carry Wren’s post to the Pines and pass it to your teammate. They ride to Ada and bring her reply back. Take the pouch home together and beat your shared time.</p><div class="ch-post-path"><span>Wren → Pines</span><span>Offer & accept</span><span>Pines → Ada → Pines</span><span>Offer & accept</span><span>Pines → Wren</span></div><p class="ch-post-note">Both couriers must stop together for each handoff. Your shared time has its own personal record.</p>'+(!available?'<p class="ch-post-message">'+esc(s.reason||'Connect with your club to gather a teammate.')+'</p>':'')+(s.notice?'<p class="ch-post-message" role="status">'+esc(s.notice)+'</p>':'')+body+(lobbies.length?'<div class="ch-post-lobbies">'+lobbies.map(l=>'<article class="ch-post-lobby"><h3>Ride with '+esc(l.host)+'</h3><p class="ch-post-note">'+people(l).length+' / 2 couriers</p>'+roster(l)+button('join','Join post relay',{disabled:!available||!!c||!l.canJoin,primary:true,attrs:'data-relay-id="'+esc(l.id)+'"'})+'</article>').join('')+'</div>':'')+'</section>';
 }
 function sectionKey(){const s=snap(),c=s.current;return JSON.stringify({connected:s.connected,code:s.code,reason:s.reason,notice:s.notice,lobbies:(s.lobbies||[]).map(l=>({id:l.id,host:l.host,status:l.status,canJoin:l.canJoin,roster:l.roster})),current:c&&{id:c.id,hosted:c.hosted,status:c.status,ready:c.ready,canStart:c.canStart,roster:c.roster,firstId:c.firstId,stage:c.stage},result:s.lastResult});}
 function rideView(){G.hidePanels();G.riding?.releaseAll();document.activeElement?.blur?.();G.seFrame?.settle();}
 function command(action,el){
  if(action==='return'){rideView();return;}
  if(action==='result'){showResult(snap().lastResult||receipt);return;}
  if(action==='close'||action==='activities'){
   if(snap().lastResult?.saved===false){G.toast('Retry saving your shared time first.');return;}
   if(snap().current?.status==='finished'){const out=R.leave();if(out?.ok===false){G.toast(out.reason);return;}}
   G.hidePanels();if(action==='activities')G.clubHub?.open('activities');G.seFrame?.settle();return;
  }
  let out;
  if(action==='join')out=R.join(el?.dataset.relayId);
  else if(action==='ready')out=R.ready(!snap().current?.ready);
  else if(action==='start-other'){const c=snap().current,other=people(c).find(r=>r.id!==c.hostId);out=R.start({firstId:other?.id});}
  else if(action==='action')out=R.interact();
  else if(action==='save')out=R.retrySave();
  else if(['host','start','leave','again'].includes(action))out=R[action]();
  else return;
  if(out===false||out?.ok===false)G.toast(out?.reason||'The post relay could not be updated. Try again.');
  if(action==='again'&&out!==false&&out?.ok!==false){clearTimeout(resultTimer);G.hidePanels();G.clubHub?.open('activities');}
  paint();G.seFrame?.settle();
 }
 U.action('relaypost',([action],el)=>command(action,el));
 function renderResult(){const r=snap().lastResult||receipt;if(!r)return '';const saved=r.saved===true,team=(r.participants||[]).map(p=>typeof p==='string'?p:p.name).join(' · ');
  return '<div class="post-relay-result"><span class="ch-post-kicker">Cottonwood post relay · Together</span><h1>The reply is home.</h1><p>Two courier legs, two handoffs, one delivery. Switch roles and find a faster rhythm on your next ride.</p><div class="post-relay-stats"><div><strong>'+seconds(r.elapsed)+'</strong><small>Your shared time · 2 handoffs</small></div><div><strong>'+(saved&&r.bestTime?seconds(r.bestTime):'—')+'</strong><small>Your personal best'+(!saved?' · waiting to save':'')+'</small></div></div><div class="post-relay-team">'+esc(team)+'<br>'+Math.round(r.distance||0)+' m carried</div><div class="post-relay-save'+(saved?'':' pending')+'" role="status">'+esc(saved?(r.newBest?'New personal best · saved':'Your shared time is saved.'):(r.reason||'Your time is waiting to save. Keep this tab open and retry.'))+'</div><div class="ch-post-actions">'+(!saved?button('save','Retry save',{primary:true}):'')+button('again','Ride again',{disabled:!saved,primary:saved})+button('activities','Back to club',{disabled:!saved})+button('close','Free ride',{disabled:!saved})+'</div></div>';
 }
 U.panel({id:'clubPostRelayResultPanel',title:'Cottonwood relay complete',render:renderResult});
 const panel=document.getElementById('clubPostRelayResultPanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Cottonwood relay result');
 G.seFrame?.screens.add(()=>panel.style.display==='flex');new MutationObserver(()=>G.seFrame?.settle()).observe(panel,{attributes:true,attributeFilter:['style']});
 function refreshResult(){if(panel.style.display!=='flex')return;const focused=panel.contains(document.activeElement)?document.activeElement?.dataset.fx:null,scroll=panel.scrollTop;U.rerender('clubPostRelayResultPanel');panel.scrollTop=scroll;if(focused)[...panel.querySelectorAll('[data-fx]')].find(b=>b.dataset.fx===focused&&!b.disabled)?.focus({preventScroll:true});}
 function showResult(r){if(!r)return;receipt=r;clearTimeout(resultTimer);resultTimer=setTimeout(()=>{const s=snap();if(s.lastResult?.runId!==r.runId||s.current?.status==='riding'||s.current?.status==='waiting')return;U.open('clubPostRelayResultPanel');G.riding?.releaseAll();G.seFrame?.settle();},0);}
 const hud=document.createElement('aside');hud.id='clubPostRelayHud';hud.hidden=true;hud.setAttribute('aria-label','Cottonwood relay progress');hud.innerHTML='<div class="post-relay-top"><span>Cottonwood post relay</span><span class="post-relay-time"></span></div><strong class="post-relay-title"></strong><div class="post-relay-cargo"></div><p class="post-relay-cue" role="status"></p><div id="clubPostRelayRoutes" role="group" aria-label="Courier route"><button type="button" data-route="road">Meadow road</button><button type="button" data-route="woodland">Woodland jump</button></div><div class="post-relay-controls"><button type="button" data-relay-action="action"></button><button type="button" class="secondary" data-relay-action="leave">End relay</button></div>';document.body.append(hud);
 const fields={time:hud.querySelector('.post-relay-time'),title:hud.querySelector('.post-relay-title'),cargo:hud.querySelector('.post-relay-cargo'),cue:hud.querySelector('.post-relay-cue')},actionButton=hud.querySelector('[data-relay-action="action"]'),routes=hud.querySelector('#clubPostRelayRoutes');
 hud.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.route){const out=R.setRoute(b.dataset.route);if(out===false||out?.ok===false)G.toast(out?.reason||'This route is unavailable.');paint();}else command(b.dataset.relayAction,b);if(e.detail>0)b.blur();});
 hud.addEventListener('keydown',e=>{if(e.target.closest('button')&&['Enter','Space'].includes(e.code))e.stopPropagation();});
 const titles={collect:'Collect Wren’s post',outbound:'Ride to the Pines',passPost:'Pass the post at the Pines',deliver:'Ride the post to Ada',backToPines:'Bring the reply to the Pines',passReply:'Pass the reply at the Pines',home:'Bring the reply to Wren',finished:'The reply is home'};
 function paint(){
  const s=snap(),c=s.current,live=c?.status==='riding';
  if(live&&ridingId!==c.id){ridingId=c.id;clearTimeout(resultTimer);rideView();}else if(!live)ridingId=null;
  hud.hidden=!live;document.body.classList.toggle('club-post-relay-riding',!!live);
  if(live){
   const i=c.interaction,carrier=c.carrierId===c.localId?'You':rider(c,c.carrierId),own=c.carrierId===c.localId,meters=c.guide?Math.round(Math.hypot(H.player.pos.x-c.guide.x,H.player.pos.z-c.guide.z)):null;
   let cue=i?.reason||'Follow your trail marker.';
   if(c.startupWaiting||c.waitingForRiders)cue='Gathering your teammate. Your shared clock starts when both riders are here.';
   else if(c.waitingForHost)cue='Waiting for the host. Your shared clock is paused.';
   else if(c.paused)cue='Your team is paused. Close open screens and return to riding.';
   else if(c.stage==='outbound')cue=own?'Ride through the Pines, then stop beside your teammate.':'Ride to the Pines and meet the courier for the first handoff.';
   else if(c.stage==='deliver'||c.stage==='backToPines')cue=own?(c.route==='woodland'?'Follow the woodland trail. Jump the low log before reaching it.':'Follow the Meadow road to '+(c.stage==='deliver'?'Ada. Stop beside her to exchange the post.':'the Pines. Stop beside your teammate.')):'Meet your teammate at the Pines for the reply handoff.';
   else if(c.stage==='home')cue=own?'Ride home and stop beside Wren to deliver Ada’s reply.':'Ride home with the courier to Wren.';
   if(c.offer&&['passPost','passReply'].includes(c.stage))cue=c.offer.to===c.localId?'Your teammate offered the pouch. Stay stopped together and accept it.':'Pouch offered. Stay stopped beside your teammate while they accept.';
   const values={time:seconds(c.elapsed),title:titles[c.stage]||'Ride together',cargo:c.cargo?(carrier+' '+(own?'carry':'carries')+' the '+c.cargo+(meters!==null?' · '+meters+' m to '+(c.guide.label||'your marker'):'')):'The pouch is waiting with Wren',cue};
   for(const [key,value]of Object.entries(values))if(fields[key].textContent!==value)fields[key].textContent=value;
   actionButton.hidden=!i?.action;actionButton.disabled=!i?.eligible;actionButton.textContent=i?.label||'Follow the trail';actionButton.title=i?.reason||'';
   routes.hidden=!(own&&c.stage==='deliver');for(const b of routes.querySelectorAll('button')){b.setAttribute('aria-pressed',String(c.route===b.dataset.route));b.disabled=!!c.paused||b.dataset.route==='woodland'&&c.woodlandAvailable===false;}
  }
  artState=live?c:null;if(live){if(!art)makeArt();updateArt(c);}else disposeArt();
  const stamp=JSON.stringify(s.lastResult);if(stamp!==resultStamp){resultStamp=stamp;refreshResult();if(s.lastResult?.saved===false&&!live&&c?.status!=='waiting')showResult(s.lastResult);}
 }
 const map={x:0,z:0,glyph:'✉',label:'Cottonwood relay',kind:'post',hidden:()=>snap().current?.status!=='riding'},mini={x:0,z:0,col:'#e7cb8b',r:4,hidden:map.hidden};W.mapMarkers?.push(map);W.miniMarkers?.push(mini);
 function makeArt(){
  const group=new T.Group();group.name='Cottonwood shared relay';const leather=new T.MeshStandardMaterial({color:0x96633a,roughness:.9}),trim=new T.MeshStandardMaterial({color:0x4a3222,roughness:.9}),paper=new T.MeshStandardMaterial({color:0xf3e4b9,roughness:.9}),bark=new T.MeshStandardMaterial({color:0x715239,roughness:1}),cut=new T.MeshStandardMaterial({color:0xc39b68,roughness:1});
  const parcel=new T.Group();parcel.name='Shared courier pouch';const box=(w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;parcel.add(o);};box(.36,.3,.18,leather);box(.375,.1,.2,leather,0,.11,.015);box(.055,.32,.195,trim);box(.13,.075,.008,paper,.105,.04,.108);group.add(parcel);
  const crate=new T.Mesh(new T.BoxGeometry(.52,.42,.38),bark);crate.name='Wren relay post crate';crate.castShadow=crate.receiveShadow=true;group.add(crate);
  const ring=new T.Mesh(new T.RingGeometry(4.4,4.5,64),new T.MeshBasicMaterial({color:0xe9ca7e,transparent:true,opacity:.75,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);
  const straps=[-1,1].map(()=>{const o=new T.Mesh(new T.BoxGeometry(.04,1,.018),trim);o.name='Relay pouch saddle strap';o.castShadow=true;group.add(o);return o;});
  const log=new T.Group();log.name='Relay woodland log';const timber=new T.Mesh(new T.CylinderGeometry(.25,.25,3.4,12),[bark,cut,cut]);timber.rotation.x=Math.PI/2;timber.position.y=.25;timber.castShadow=timber.receiveShadow=true;log.add(timber);for(const z of [-1.705,1.705])for(const radius of [.07,.135,.2]){const grain=new T.Mesh(new T.TorusGeometry(radius,.006,4,22),bark);grain.position.set(.008,.25,z);log.add(grain);}log.position.set(-7,W.groundH(-7,-53),-53);group.add(log);G.scene.add(group);
  art={group,parcel,crate,ring,straps,log,wall:{x1:-7,z1:-54.7,x2:-7,z2:-51.3,clubPostRelay:true},wallAdded:false,materials:[leather,trim,paper,bark,cut,ring.material],seat:new T.Vector3(),anchor:new T.Vector3(),end:new T.Vector3(),dir:new T.Vector3(),up:new T.Vector3(0,1,0)};
 }
 function showLog(show){if(!art)return;art.log.visible=show;if(show&&!art.wallAdded&&W.walls){W.walls.push(art.wall);art.wallAdded=true;}else if(!show&&art.wallAdded){const n=W.walls.indexOf(art.wall);if(n>=0)W.walls.splice(n,1);art.wallAdded=false;}}
 function disposeArt(){if(!art)return;showLog(false);G.scene.remove(art.group);const geometries=new Set();art.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();for(const m of art.materials)m.dispose();art=null;}
 function updateArt(c){
  if(!art||!c)return;const target=c.target||c.stations?.pines,guide=c.guide||target;
  if(guide){map.x=mini.x=guide.x;map.z=mini.z=guide.z;const arrow=G.trail.arrow;if(arrow){arrow.visible=true;arrow.position.set(guide.x,W.groundH(guide.x,guide.z)+2.8,guide.z);}}
  if(target){art.ring.visible=true;art.ring.position.set(target.x,W.groundH(target.x,target.z)+.065,target.z);}else art.ring.visible=false;
  showLog(['deliver','backToPines'].includes(c.stage)&&(c.stage==='backToPines'?c.returnRoute:c.route)==='woodland');
  const w=c.stations?.wren,waiting=!c.carrierId&&c.stage==='collect';art.crate.visible=waiting&&!!w;
  if(waiting&&w){const ground=W.groundH(w.x+1,w.z);art.crate.position.set(w.x+1,ground+.21,w.z);art.parcel.position.set(w.x+1,ground+.57,w.z);art.parcel.rotation.y=0;art.parcel.visible=true;for(const strap of art.straps)strap.visible=false;return;}
  const local=c.carrierId===c.localId,p=H.player,remote=!local&&c.carrierId?G.net?.remotes?.[c.carrierId]:null,rig=local?H.RIG?.():remote?.rig;
  // A missing remote stays missing: no surrogate rider or duplicate pouch.
  const visible=!!c.carrierId&&(local?!p.onFoot&&!!rig?.ready:!!remote?.parts?.group?.parent&&remote.lastSeen<1.8&&!!rig?.scene?.parent&&rig.ready!==false&&!rig.loadingBreed);
  art.parcel.visible=visible;for(const strap of art.straps)strap.visible=visible;if(!visible)return;
  const follower=rig.nativeSeatFollower||rig.nativeContacts?.seatFollower,heading=(local?p.heading:remote.heading)||0;
  if(follower?.getWorldPosition)follower.getWorldPosition(art.seat);
  else if(local)art.seat.set(p.pos.x,W.groundH(p.pos.x,p.pos.z)+1.7,p.pos.z);
  else{remote.parts.group.getWorldPosition(art.seat);art.seat.y+=1.7;}
  const cosine=Math.cos(heading),sine=Math.sin(heading),shape=rig.profile?.nativeVariant,lateral=Math.max(.26,Math.min(.52,.24*(shape?.sculptTargets?.barrel_width||1)*(shape?.actorScale||1)+.09));
  const offset=(v,x,y,z)=>v.set(art.seat.x+cosine*x+sine*z,art.seat.y+y,art.seat.z-sine*x+cosine*z);
  offset(art.parcel.position,lateral,-.27,-.36);art.parcel.rotation.y=heading+Math.PI/2;
  for(let i=0;i<art.straps.length;i++){const strap=art.straps[i],aft=-.36+(i===0?-.12:.12);offset(art.anchor,lateral-.19,-.025,aft);offset(art.end,lateral,-.12,aft);art.dir.copy(art.end).sub(art.anchor);strap.position.copy(art.anchor).add(art.end).multiplyScalar(.5);strap.scale.y=art.dir.length();strap.quaternion.setFromUnitVectors(art.up,art.dir.normalize());}
 }
 G.on('clubPostRelayChanged',paint);G.on('clubPostRelayFinish',r=>{paint();showResult(r);});
 G.on('remoteTick',()=>{if(art&&artState)updateArt(artState);});
 G.on('tick',dt=>{tick+=dt;if(tick>=.2){tick=0;paint();}else if(art&&artState)updateArt(artState);});
 G.clubPostRelayUI={section,sectionKey,showResult:()=>showResult(snap().lastResult||receipt),state:()=>({open:panel.style.display==='flex',receiptId:(snap().lastResult||receipt)?.runId||null,art:art?{parcelVisible:art.parcel.visible,carrierId:snap().current?.carrierId,logVisible:art.log.visible}:null})};paint();
}
