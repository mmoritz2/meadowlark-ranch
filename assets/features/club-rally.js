import {RALLY_MILESTONES,blankRallyCounts,rallyCounts,mergeRallyCounts,safeRallyKey,cleanRallyText,sanitizeRallySave,mergeRallyParticipant,creditRallyRun,rallyView,applyRallyClaim} from './club-rally-rules.mjs?v=club-rally-1';
export const id='club-rally';
export function install(G){
 const S=G.save,N=G.net,now=()=>Date.now(),week=()=>G.time.isoWeekKey(),me=()=>safeRallyKey(N.net.id)?N.net.id:'',name=()=>cleanRallyText(N.myName(),14)||'Rider';
 const bindings={rush:null,rescue:null,roundup:null},trails=new WeakMap(),finishedTrails=new WeakSet(),pending=new Map();
 let trailBinding=null,serial=0,lastWeek=week();
 S.ensure(s=>{s.clubRally=sanitizeRallySave(s.clubRally);});
 function context(s=S.fresh()){
  const c=G.clubs?.identity(s)||{},code=safeRallyKey(c.code)?c.code:'';
  return {code,clubName:cleanRallyText(c.name,48)||'Riding club',week:week(),id:me(),joined:!!code&&!c.canCreate&&!c.pendingJoin&&!!c.founder&&!!me(),connected:!!N.net.client?.connected};
 }
 const snapshot=()=>{const s=S.fresh();return rallyView(s?.clubRally,context(s));};
 const notify=()=>G.run('clubRallyChanged',snapshot());
 function subscribe(){const c=context();if(c.code)N.subscribe('srf1/'+c.code+'/clubrally/#');}
 function publish(){
  const s=S.fresh(),c=context(s);if(!c.joined)return false;
  const counts=sanitizeRallySave(s?.clubRally).clubs[c.code]?.weeks[c.week]?.riders[me()]?.counts||blankRallyCounts();
  // Absolute membership topics keep working when the rider visits the Commons.
  return N.publish('srf1/'+c.code+'/clubrally/'+c.week+'/'+me(),{week:c.week,counts},{retain:true});
 }
 const sameContext=b=>{const c=context();return !!b&&c.joined&&b.code===c.code&&b.week===c.week&&b.id===c.id;};
 function begin(kind,definition,baseline,extra={}){
  const c=context();bindings[kind]=c.joined?{...c,definition,baseline,...extra}:null;
 }
 G.on('rushStart',r=>{
  const c=G.course?.get(),a=G.ranchRush?.snapshot?.().active;
  if(!r||!a||r.id!==a.id||c?.ev?.id!==r.id||!c.ev.rush)return;
  const old=S.fresh()?.ranchRush?.records?.[r.id];begin('rush',r.id,{plays:old?.plays||0,lastRunId:old?.lastRunId||''},{course:c});
 });
 G.on('rescueStart',r=>{
  const a=G.rescueRide?.snapshot?.().active;if(!r||!a||r.id!==a.id||a.stage!=='find'||a.clues!==0||a.elapsed!==0)return;
  const old=S.fresh()?.rescueRides;begin('rescue',r.id,{plays:old?.completions||0,lastRunId:old?.lastRunId||''});
 });
 G.on('roundupStart',r=>{
  const a=G.roundup?.state?.();if(!r||!a?.active||r.mode!==a.mode||a.elapsed!==0||a.countdown<=0)return;
  const old=S.fresh()?.roundupBest?.[r.mode];begin('roundup',r.mode,{plays:old?.plays||0,lastRunId:old?.lastRunId||''});
 });
 function credit(binding,kind,result,runId){
  if(!sameContext(binding))return false;
  let receipt=null;
  S.sync(s=>{const c=context(s);if(!c.joined||c.code!==binding.code||c.week!==binding.week||c.id!==binding.id)return;
   const r=creditRallyRun(s.clubRally,{...c,name:name(),kind,runId,result,at:now()});
   if(r.receipt){s.clubRally=r.save;receipt=r.receipt;}
  });
  if(!receipt)return false;
  const persisted=sanitizeRallySave(S.fresh()?.clubRally).clubs[binding.code]?.weeks[binding.week];
  if(!persisted?.seen.includes(receipt.key))return false;
  publish();notify();G.run('clubRallyContribution',receipt);return true;
 }
 function finish(kind,r){
  const b=bindings[kind];if(!sameContext(b)||!r||typeof r!=='object')return;
  const s=S.fresh();let genuine=false;
  if(kind==='rush'){
   const old=s?.ranchRush?.records?.[r.id];
   genuine=r===G.ranchRush?.lastResult&&r.id===b.definition&&old?.lastRunId===r.runId&&old.plays>b.baseline.plays;
  }else if(kind==='rescue'){
   const old=s?.rescueRides;
   genuine=r===G.rescueRide?.snapshot?.().lastResult&&r.id==='clover'&&r.id===b.definition&&old?.lastRunId===r.runId&&old.completions>b.baseline.plays;
  }else{
   const old=s?.roundupBest?.[r.mode],a=G.roundup?.state?.();
   genuine=r===a?.lastResult&&!a.active&&r.mode===b.definition&&old?.lastRunId===r.runId&&old.plays>b.baseline.plays&&Number.isInteger(r.penned)&&r.penned<=r.total;
  }
  if(!genuine||r.runId===b.baseline.lastRunId)return;
  // Consume before broadcasting; nested listeners cannot credit the same finish.
  bindings[kind]=null;credit(b,kind,r,r.runId);
 }
 for(const kind of ['rush','rescue','roundup'])G.on(kind+'Finish',r=>finish(kind,r));
 G.on('rescueCancel',()=>{bindings.rescue=null;});G.on('roundupCancel',()=>{bindings.roundup=null;});
 function validTrail(r){
  if(!r||typeof r!=='object'||!Array.isArray(r.pts)||r.pts.length<2||r.pts.length>24)return false;
  const route=G.social?.EXPEDITIONS?.find(e=>e.id===r.exped);
  // Both solo and live club expeditions use these authored routes. A custom
  // two-pin trail, or an expedition label on substituted stops, earns no rally.
  return !!route&&Array.isArray(route.stops)&&r.pts.length===route.stops.length&&r.pts.every((p,i)=>Array.isArray(p)&&Number.isFinite(p[1])&&Number.isFinite(p[2])&&p[1]===route.stops[i][1]&&p[2]===route.stops[i][2]);
 }
 G.on('trailStart',r=>{
  if(!validTrail(r)||r!==G.trail?.ride||trails.has(r))return;
  const c=context();if(!c.joined)return;
  const b={...c,ride:r,baseline:S.fresh()?.stats?.trails||0,runId:'trail-'+now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2,7),invalid:false};
  trails.set(r,b);trailBinding=b;
 });
 G.on('trailDone',r=>{
  const b=validTrail(r)&&trails.get(r);
  if(!b||b.invalid||finishedTrails.has(r)||r!==G.trail?.ride||r.idx!==r.pts.length||!(r.t>0)||!sameContext(b)||(S.fresh()?.stats?.trails||0)<=b.baseline)return;
  finishedTrails.add(r);if(trailBinding===b)trailBinding=null;credit(b,'trail',{name:r.name||'Trail ride'},b.runId);
 });
 function invalidate(){for(const k of Object.keys(bindings))bindings[k]=null;if(trailBinding)trailBinding.invalid=true;trailBinding=null;}
 function member(s,code,id){
  const c=G.clubs?.identity(s),r=s?.clubRecords?.[code];
  if(!c||c.code!==code||!c.founder||c.pendingJoin||c.canCreate)return null;
  const row=r?.members?.[id];if(row?.left)return null;
  if(row&&typeof row.n==='string')return cleanRallyText(row.n,14)||'Rider';
  return c.founderId===id?cleanRallyText(c.founder,14)||'Rider':null;
 }
 function receive(topic,m,queue=true){
  const t=topic.split('/'),c=context();
  if(t.length!==5||t[0]!=='srf1'||t[1]!==c.code||t[2]!=='clubrally'||!c.joined||t[3]!==c.week||m.week!==c.week||!safeRallyKey(t[4])||m.id!==t[4]||m.id===me()||!rallyCounts(m.counts))return false;
  const s=S.fresh(),label=member(s,c.code,m.id);
  let waiting=pending.get(topic);
  if(waiting&&now()-waiting.at>120000){pending.delete(topic);waiting=null;}
  const counts=mergeRallyCounts(waiting?.m.counts,m.counts);if(!counts)return false;
  // Retained scores can precede the member card in either order. Keep maxima,
  // and keep the original expiry so repeats cannot hold an unknown rider forever.
  if(!label){if(queue&&(waiting||pending.size<32))pending.set(topic,{m:{id:m.id,week:m.week,counts},at:waiting?.at??now()});return false;}
  let changed=false;
  S.sync(v=>{const fresh=context(v),nm=member(v,c.code,m.id);if(!nm||!fresh.joined||fresh.code!==c.code||fresh.week!==c.week)return;
   const r=mergeRallyParticipant(v.clubRally,{...fresh,id:m.id,name:nm,counts});if(r.changed){v.clubRally=r.save;changed=true;}
  });
  pending.delete(topic);if(changed)notify();return changed;
 }
 function flush(){
  for(const [topic,row]of pending){if(now()-row.at>120000||topic.split('/')[1]!==context().code)pending.delete(topic);else receive(topic,row.m,false);}
 }
 G.on('message',(topic,m)=>{
  if(typeof topic!=='string'||!m||typeof m!=='object'||Array.isArray(m))return;
  const t=topic.split('/');if(t[0]!=='srf1'||t[1]!==context().code)return;
  if(t[2]==='clubrally'){receive(topic,m);return true;}
  // Core clubs handles the preceding metadata/member hook before this listener.
  if(t[2]==='meta'||t[2]==='members')flush();
 });
 function claim(tier){
  const before=context();let result={ok:false,reason:'This reward could not be saved. Please try again.'};
  S.sync(s=>{const c=context(s);if(c.code!==before.code||c.week!==before.week)return;result=applyRallyClaim(s,tier,c,(v,r)=>G.money.payReward(v,r),now());});
  if(!result.ok)return result;
  const saved=sanitizeRallySave(S.fresh()?.clubRally),index=RALLY_MILESTONES.findIndex(m=>m.id===tier);
  if(!(saved.claims[result.week]&(1<<index)))return {ok:false,reason:'Your reward could not be saved. Please try again.'};
  G.money.refreshWallet();G.sGem?.();notify();G.run('clubRallyClaim',result);return result;
 }
 function busy(){
  if(G.course?.get()||G.course?.drillActive?.()||G.roundup?.state?.().active||G.rescueRide?.snapshot?.().active||G.trail?.ride)return 'Finish or leave your current activity first.';
  const p=G.horse?.player,rig=G.horse?.RIG?.(),action=rig?.heroMotion?.state,parked=G.onFoot?.state?.()?.horse;
  if(p?.flying||(p?.y||0)>.2)return 'Land before starting a club rally activity.';
  if(G.worldPkg?.vehicle?.())return 'Finish your ferry or balloon ride first.';
  if(G.onFoot?.on||p?.onFoot)return 'Mount your horse first.';
  if(G.social?.spectate||G.social?.tour)return 'Leave spectating or the ranch tour first.';
  if(rig&&(!rig.ready||rig.loadingBreed))return 'Your horse is still getting ready.';
  if(rig?.emote||action?.action||action?.transitioning||parked?.pending||parked?.departure)return 'Let your horse finish its action first.';
  return '';
 }
 function start(kind,id){
  if(!context().joined)return {ok:false,reason:'Join or create a club first.'};
  const reason=busy();if(reason)return {ok:false,reason};let ok=false;
  if(kind==='rush')ok=!!G.ranchRush?.start(id||'rush-pasture');
  else if(kind==='rescue'&&(!id||id==='clover'))ok=!!G.rescueRide?.start();
  else if(kind==='roundup'&&(!id||['beginner','full'].includes(id)))ok=!!G.roundup?.start(id||'beginner');
  else if(kind==='trail'){
   const r=G.social?.EXPEDITIONS?.find(r=>r.id===(id||'basin'));
   if(!r)return {ok:false,reason:'This trail route is unavailable.'};
   for(const p of r.stops){const locked=G.worldPkg?.lockedRegionsAt?.(p[1],p[2])||[];if(locked.length)return {ok:false,reason:G.worldPkg.lockText?.(locked[0])||'Unlock this trail’s region first.'};}
   // Starting a solo contribution does not post a chat message or summon peers.
   ok=!!G.trail?.start(r.stops.map(p=>p.slice()),name(),{name:r.name,exped:r.id,soloExpedition:true});
  }
  if(ok){G.hidePanels?.();G.seFrame?.settle();return {ok:true};}
  return {ok:false,reason:'This activity could not start. Finish any horse action and try again.'};
 }
 function sync(){subscribe();publish();flush();notify();}
 G.on('clubChanged',()=>{invalidate();pending.clear();sync();});
 G.on('connect',sync);G.on('boot',sync);G.on('clubRoom',subscribe);
 G.on('interval30',()=>{if(week()!==lastWeek){lastWeek=week();invalidate();notify();}publish();flush();});
 G.on('state',s=>{s.clubRally=snapshot();});
 G.clubRally={snapshot,claim,start,publish,milestones:RALLY_MILESTONES};subscribe();
}
