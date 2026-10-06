/* Real club participation and plans. Counters are retained snapshots, never
 * increments from the wire: duplicate/out-of-order packets cannot add points.
 * The existing broker remains an honour-system service, not authentication. */
export const id='club-activities';
export const ACTIVITY_GOALS=[
 {id:'events',icon:'🏇',label:'Ride for the club',description:'Finish 6 events together this week.',target:6,reward:{coins:500,gems:2}},
 {id:'ribbons',icon:'🎀',label:'Ribbon collection',description:'Earn 20 event ribbons together this week.',target:20,reward:{coins:600,gems:2}},
 {id:'rides',icon:'🥾',label:'Explore together',description:'Complete 3 trail rides this week.',target:3,reward:{coins:400,gems:2}},
 {id:'gathering',icon:'🌿',label:'Gather for the ranch',description:'Pick 30 wild foods together this week.',target:30,reward:{coins:300,gems:1}},
];
const KEYS=['events','ribbons','rides','gathering'], WEIGHTS={events:12,ribbons:2,rides:20,gathering:2};
const safeKey=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&v!=='prototype'&&!Object.prototype.hasOwnProperty.call(Object.prototype,v);
const clean=(v,max)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
const count=v=>Number.isFinite(v)&&v>=0?Math.min(10000,Math.floor(v)):null;
const blank=()=>Object.fromEntries(KEYS.map(k=>[k,0]));
const clone=v=>JSON.parse(JSON.stringify(v));

export function install(G){
 const S=G.save,N=G.net,week=()=>G.time.isoWeekKey(),now=()=>Date.now();
 const code=(s=S.fresh())=>{const c=G.clubs?.identity(s)?.code||'';return safeKey(c)?c:'';};
 const me=()=>safeKey(N.net.id)?N.net.id:'local-rider';
 const name=()=>clean(N.myName(),14)||'Rider';
 const route=id=>(G.social?.EXPEDITIONS||[]).find(r=>r.id===id);
 function ensure(s){s.clubActivities=s.clubActivities||{clubs:{}};s.clubActivities.clubs=s.clubActivities.clubs||{};}
 S.ensure(ensure);
 function record(s,c,create=false){
  ensure(s);if(!c)return null;let r=s.clubActivities.clubs[c];
  if(!r&&create)r=s.clubActivities.clubs[c]={weeks:{},participants:{},claims:{},rides:{},rsvps:{}};
  if(r){r.weeks=r.weeks||{};r.participants=r.participants||{};r.claims=r.claims||{};r.rides=r.rides||{};r.rsvps=r.rsvps||{};}
  return r||null;
 }
 function prune(r){
  for(const w of Object.keys(r.weeks).sort().reverse().slice(8))delete r.weeks[w];
  // Claims remain permanent so leaving/rejoining cannot pay the same week twice.
  for(const [rid,ride]of Object.entries(r.rides))if(ride.startsAt<now()-86400000){delete r.rides[rid];delete r.rsvps[rid];}
 }
 function notify(){G.run('clubActivityChanged');}
 function subscribe(){const c=code();if(!c)return;for(const topic of ['clubactivity/#','clubrides/#','clubrsvp/#'])N.subscribe('srf1/'+c+'/'+topic);}
 function publish(){
  const s=S.fresh(),c=code(s),r=record(s,c);if(!r)return false;
  const mine=r.weeks[week()]?.[me()]||blank(),xp=r.participants[me()]?.xp||0;
  return N.publish('srf1/'+c+'/clubactivity/'+week()+'/'+me(),{week:week(),counts:mine,xp},{retain:true});
 }
 function contribute(delta){
  let added=false;
  S.sync(s=>{const c=code(s);if(!c)return;const r=record(s,c,true),w=r.weeks[week()]||(r.weeks[week()]={}),v=w[me()]||(w[me()]=blank());
   let xp=0;for(const k of KEYS){const n=count(delta[k])||0,add=Math.min(n,10000-v[k]);v[k]+=add;xp+=add*WEIGHTS[k];}
   if(!xp)return;r.participants[me()]={name:name(),xp:Math.min(1e9,(r.participants[me()]?.xp||0)+xp),seenAt:now()};prune(r);added=true;});
  if(added){publish();notify();}return added;
 }
 const finishedCourses=new WeakSet(),finishedTrails=new WeakSet();
 G.on('courseFinish',o=>{if(!o||!o.ev||!o.c||typeof o.c!=='object'||finishedCourses.has(o.c))return;finishedCourses.add(o.c);contribute({events:1,ribbons:Math.min(6,count(o.RB?.rib)||0)});});
 G.on('trailDone',ride=>{if(!ride||typeof ride!=='object'||!Array.isArray(ride.pts)||ride.pts.length<2||finishedTrails.has(ride))return;finishedTrails.add(ride);contribute({rides:1});});
 G.on('forage',item=>{if(typeof item==='string'&&item)contribute({gathering:1});});
 function snapshot(){
  const s=S.fresh(),c=code(s),r=record(s,c),wk=week(),rows=r?.weeks[wk]||{},mine=rows[me()]||blank(),total=blank();
  for(const row of Object.values(rows))for(const k of KEYS)total[k]+=count(row[k])||0;
  const xp=Object.values(r?.participants||{}).reduce((n,p)=>n+(Number.isFinite(p.xp)?Math.max(0,p.xp):0),0);
  const level=Math.min(50,1+Math.floor((Math.sqrt(1+8*xp/100)-1)/2)),nextXp=level>=50?null:100*level*(level+1)/2;
  const goals=ACTIVITY_GOALS.map(g=>{const claimed=!!r?.claims[wk+':'+g.id];return {...g,reward:{...g.reward},progress:total[g.id],mine:mine[g.id]||0,claimed,ready:!!c&&!claimed&&total[g.id]>=g.target&&mine[g.id]>0};});
  const rides=Object.values(r?.rides||{}).filter(x=>!x.deleted&&x.startsAt>=now()-3600000).sort((a,b)=>a.startsAt-b.startsAt).slice(0,10).map(x=>{
   const votes=r.rsvps[x.id]||{};return{id:x.id,title:x.title,startsAt:x.startsAt,meetingPoint:x.meetingPoint,notes:x.notes,host:x.host,creator:x.creator,routeId:x.routeId||null,routeName:route(x.routeId)?.name||'',going:!!votes[me()]?.going,count:Object.values(votes).filter(v=>v.going).length,canEdit:x.creator===me()};});
  return{code:c,week:wk,goals,level: c?level:0,xp,nextXp,xpScope:'Recorded club activity',contributors:Object.keys(r?.participants||{}).length,rides,canSchedule:!!c&&!!G.clubs?.canManage(s)};
 }
 function claim(goalId){
  const c=code(),state=snapshot(),wk=state.week,g=state.goals.find(g=>g.id===goalId);if(!c)return{ok:false,reason:'Join a club first.'};
  if(!g)return{ok:false,reason:'Unknown goal.'};if(g.claimed)return{ok:false,reason:'Already claimed this week.'};
  if(!g.mine)return{ok:false,reason:'Contribute to this goal before claiming.'};if(!g.ready)return{ok:false,reason:'The club has not completed this goal yet.'};
  let paid=false;S.sync(s=>{if(code(s)!==c||week()!==wk)return;const r=record(s,c,true),key=wk+':'+goalId;if(r.claims[key])return;r.claims[key]=true;G.money.payReward(s,{c:g.reward.coins,g:g.reward.gems});paid=true;});
  if(paid){G.money.refreshWallet();G.toast(g.icon+' '+g.label+' reward claimed!');notify();}return{ok:paid,...(!paid?{reason:'Already claimed.'}:{})};
 }
 function publishRide(ride){return N.publish('srf1/'+code()+'/clubrides/'+ride.id,{...ride,id:me()},{retain:true});}
 function schedule(input){
  const s=S.fresh(),c=code(s);if(!c)return{ok:false,reason:'Join a club first.'};input=input||{};
  const r=record(s,c,true),old=input.id?r.rides[input.id]:null;
  if(input.id&&!old)return{ok:false,reason:'Ride not found.'};
  if(old?old.creator!==me():!G.clubs?.canManage(s))return{ok:false,reason:old?'Only the host can edit this ride.':'Club leaders and officers can schedule rides.'};
  const routeId=Object.hasOwn(input,'routeId')?input.routeId:old?.routeId;
  if(routeId!=null&&routeId!==''&&(!safeKey(routeId)||!route(routeId)))return{ok:false,reason:'Choose an available club trail.'};
  const title=clean(input.title,48),meetingPoint=clean(input.meetingPoint,64),notes=clean(input.notes,180),startsAt=Number(input.startsAt);
  if(!title||!meetingPoint||!Number.isFinite(startsAt)||startsAt<now()-60000||startsAt>now()+30*86400000)return{ok:false,reason:'Choose a title, meeting point, and a time within the next 30 days.'};
  if(!old&&Object.values(r.rides).filter(x=>!x.deleted&&x.startsAt>now()-3600000).length>=10)return{ok:false,reason:'The club already has 10 upcoming rides.'};
  const rid=old?.id||me()+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  if(!safeKey(rid))return{ok:false,reason:'Could not create ride identifier.'};
  const ride={id:rid,title,meetingPoint,notes,startsAt,routeId:routeId||null,host:old?.host||name(),creator:me(),revision:(old?.revision||0)+1,deleted:false};
  S.sync(v=>{if(code(v)!==c)return;const d=record(v,c,true);d.rides[rid]=ride;prune(d);});publishRide(ride);notify();return{ok:true,id:rid};
 }
 function cancel(rid){
  const s=S.fresh(),c=code(s),ride=record(s,c)?.rides[rid];if(!ride||ride.creator!==me())return{ok:false,reason:'Only the host can cancel this ride.'};
  const updated={...ride,deleted:true,revision:ride.revision+1};S.sync(v=>{record(v,c,true).rides[rid]=updated;});publishRide(updated);notify();return{ok:true};
 }
 function rsvp(rid,going=true){
  const s=S.fresh(),c=code(s),ride=record(s,c)?.rides[rid];if(!ride||ride.deleted||ride.startsAt<now()-3600000)return{ok:false,reason:'This ride is no longer available.'};
  const vote={going:!!going,at:now()};S.sync(v=>{const r=record(v,c,true);r.rsvps[rid]=r.rsvps[rid]||{};r.rsvps[rid][me()]=vote;});N.publish('srf1/'+c+'/clubrsvp/'+rid+'/'+me(),vote,{retain:true});notify();return{ok:true};
 }
 // Retained topics have no delivery order. Hold at most ten validated plans
 // briefly until the core has accepted founder/role metadata for this club.
 const pendingRides=new Map();
 function acceptRide(topic,m,queue=true){
  const t=topic.split('/'),c=code();
  if(t.length!==4||t[1]!==c||!safeKey(t[3])||m.id!==m.creator||!safeKey(m.creator)||m.creator===me()||!Number.isInteger(m.revision)||m.revision<1||!Number.isFinite(m.startsAt)||m.startsAt<now()-86400000||m.startsAt>now()+30*86400000)return false;
  if(m.routeId!=null&&m.routeId!==''&&(!safeKey(m.routeId)||!route(m.routeId)))return false;
  const title=clean(m.title,48),meetingPoint=clean(m.meetingPoint,64);if(!title||!meetingPoint)return false;
  const incoming={id:m.id,n:clean(m.n,14),creator:m.creator,revision:m.revision,title,meetingPoint,notes:clean(m.notes,180),startsAt:m.startsAt,routeId:m.routeId||null,host:clean(m.host||m.n,14),deleted:!!m.deleted};
  let accepted=false;S.sync(s=>{const r=record(s,c,true),old=r.rides[t[3]];
   if(old&&(old.creator!==m.creator||old.revision>=m.revision))return;
   if(!old&&!G.clubs?.canManageName(m.n,m.id,s)){const prior=pendingRides.get(topic);if(queue&&(prior||pendingRides.size<10)&&(!prior||(prior.m.creator===m.creator&&prior.m.revision<m.revision)))pendingRides.set(topic,{m:incoming,at:now()});return;}
   if(!old&&Object.values(r.rides).filter(x=>!x.deleted&&x.startsAt>now()-3600000).length>=10)return;
   r.rides[t[3]]={...incoming,id:t[3]};delete r.rides[t[3]].n;prune(r);accepted=true;
  });if(accepted)pendingRides.delete(topic);return accepted;
 }
 function expirePending(){for(const [topic,row]of pendingRides)if(topic.split('/')[1]!==code()||now()-row.at>120000)pendingRides.delete(topic);}
 function flushPending(){expirePending();for(const [topic,row]of pendingRides)acceptRide(topic,row.m,false);}
 G.on('message',(topic,m)=>{
  if(typeof topic!=='string'||!m||typeof m!=='object')return;
  const t=topic.split('/'),c=code();if(t[0]!=='srf1'||!c||t[1]!==c)return;
  // clubs-boards is installed first and has already processed this metadata.
  if(t[2]==='meta'){flushPending();notify();return;}
  if(t[2]==='clubactivity'){
   if(t.length!==5||t[3]!==week()||m.week!==week()||!safeKey(t[4])||m.id!==t[4]||m.id===me()||!m.counts||typeof m.counts!=='object')return true;
   const counts=blank();for(const k of KEYS){const n=count(m.counts[k]);if(n===null)return true;counts[k]=n;}
   if(!Number.isFinite(m.xp)||m.xp<0||m.xp>1e9)return true;
   S.sync(s=>{const r=record(s,c,true);if(!r.participants[m.id]&&Object.keys(r.participants).length>=128)return;const w=r.weeks[week()]||(r.weeks[week()]={}),v=w[m.id]||(w[m.id]=blank());for(const k of KEYS)v[k]=Math.max(v[k],counts[k]);r.participants[m.id]={name:clean(m.n,14)||'Rider',xp:Math.max(r.participants[m.id]?.xp||0,Math.floor(m.xp)),seenAt:now()};prune(r);});notify();return true;
  }
  if(t[2]==='clubrides'){
   acceptRide(topic,m);notify();return true;
  }
  if(t[2]==='clubrsvp'){
   if(t.length!==5||!safeKey(t[3])||!safeKey(t[4])||m.id!==t[4]||m.id===me()||typeof m.going!=='boolean'||!Number.isFinite(m.at)||m.at>now()+60000||m.at<now()-31*86400000)return true;
   S.sync(s=>{const r=record(s,c,true);if(r.rides[t[3]]?.deleted)return;if(!r.rsvps[t[3]]&&Object.keys(r.rsvps).length>=20)return;const votes=r.rsvps[t[3]]||(r.rsvps[t[3]]={});if(!votes[m.id]&&Object.keys(votes).length>=128)return;if((votes[m.id]?.at||0)<=m.at)votes[m.id]={going:m.going,at:m.at};});notify();return true;
  }
 });
 function sync(){subscribe();publish();const r=record(S.fresh(),code());if(!r)return;for(const ride of Object.values(r.rides))if(ride.creator===me()&&ride.startsAt>=now()-86400000)publishRide(ride);for(const [rid,votes]of Object.entries(r.rsvps)){const mine=votes[me()];if(mine)N.publish('srf1/'+code()+'/clubrsvp/'+rid+'/'+me(),mine,{retain:true});}}
 G.on('connect',sync);G.on('clubChanged',()=>{pendingRides.clear();sync();notify();});G.on('clubRoom',()=>{subscribe();});G.on('interval30',()=>{expirePending();publish();});G.on('boot',sync);
 G.clubActivities={snapshot,claim,schedule,cancel,rsvp,publish,goals:clone(ACTIVITY_GOALS)};
 subscribe();
}
