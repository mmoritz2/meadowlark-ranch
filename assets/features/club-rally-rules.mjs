// The public club broker is an honour-system transport. These rules validate and
// merge bounded snapshots; they do not turn client-supplied scores into authority.
export const RALLY_MILESTONES=Object.freeze([
 {id:'bronze',name:'Bronze Club Trophy',target:60,reward:Object.freeze({c:200,g:1})},
 {id:'silver',name:'Silver Club Trophy',target:180,reward:Object.freeze({c:450,g:3})},
 {id:'gold',name:'Gold Club Trophy',target:400,reward:Object.freeze({c:800,g:5})}
].map(Object.freeze));
export const RALLY_COUNT_KEYS=Object.freeze(['rush','rescue','penned','trails','bronze','silver','gold']);
export const safeRallyKey=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&v!=='prototype'&&!Object.prototype.hasOwnProperty.call(Object.prototype,v);
export const cleanRallyText=(v,n=48)=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,n):'';
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const int=(n,max=10000)=>Number.isInteger(n)&&n>=0&&n<=max;
const runKey=v=>typeof v==='string'&&/^(rush|rescue|roundup|trail):[A-Za-z0-9_-]{1,100}$/.test(v);
export function validRallyWeek(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v&&d.getUTCDay()===1;
}
export const blankRallyCounts=()=>Object.fromEntries(RALLY_COUNT_KEYS.map(k=>[k,0]));
export function rallyCounts(value){
 const v=obj(value),r=blankRallyCounts();
 for(const k of RALLY_COUNT_KEYS){if(!int(v[k]))return null;r[k]=v[k];}
 return r.bronze+r.silver+r.gold<=r.rush?r:null;
}
export function rallyPoints(v){const c=rallyCounts(v);return c?10*c.rush+25*c.rescue+5*c.penned+20*c.trails+5*(c.bronze+2*c.silver+3*c.gold):0;}
export function mergeRallyCounts(a,b){
 const left=rallyCounts(a),right=rallyCounts(b);if(!right)return null;
 return rallyCounts(Object.fromEntries(RALLY_COUNT_KEYS.map(k=>[k,Math.max(left?.[k]||0,right[k])])));
}
export function rallyDelta(kind,result){
 const c=blankRallyCounts();
 if(kind==='rush'){
  if(!['none','bronze','silver','gold'].includes(result?.medal))return null;
  c.rush=1;if(result.medal!=='none')c[result.medal]=1;
 }else if(kind==='rescue')c.rescue=1;
 else if(kind==='roundup'){
  if(!int(result?.penned,5)||result.penned<1)return null;c.penned=result.penned;
 }else if(kind==='trail')c.trails=1;
 else return null;
 return c;
}
function contribution(value){
 const v=obj(value);
 if(!runKey(v.key)||!safeRallyKey(v.code)||!validRallyWeek(v.week)||!int(v.points,250)||v.points<1||!Number.isFinite(v.at)||v.at<0)return null;
 return {key:v.key,code:v.code,week:v.week,kind:v.key.split(':')[0],name:cleanRallyText(v.name,64)||'Club ride',points:v.points,at:v.at};
}
export function sanitizeRallySave(value){
 const v=obj(value),clubs={},claims={},trophies=[];
 for(const [week,mask]of Object.entries(obj(v.claims)))if(validRallyWeek(week)&&int(mask,7)&&mask)claims[week]=mask;
 for(const [code,raw]of Object.entries(obj(v.clubs)).filter(([c])=>safeRallyKey(c)).slice(-12)){
  const weeks={};
  for(const wk of Object.keys(obj(raw?.weeks)).filter(validRallyWeek).sort().slice(-3)){
   const r=obj(raw.weeks[wk]),riders={};
   for(const [id,p]of Object.entries(obj(r.riders)).slice(0,128)){
    const counts=rallyCounts(p?.counts);if(!safeRallyKey(id)||!counts)continue;
    riders[id]={name:cleanRallyText(p.name,14)||'Rider',counts};
   }
   const seen=Array.isArray(r.seen)?[...new Set(r.seen.filter(runKey))].slice(-512):[];
   const latest=contribution(r.latestContribution);
   weeks[wk]={riders,seen,latestContribution:latest?.code===code&&latest?.week===wk?latest:null};
  }
  clubs[code]={weeks};
 }
 for(const raw of Array.isArray(v.trophies)?v.trophies:[]){
  const t=obj(raw),i=RALLY_MILESTONES.findIndex(m=>m.id===t.tier);
  if(i<0||!safeRallyKey(t.code)||!validRallyWeek(t.week)||!((claims[t.week]||0)&(1<<i))||!Number.isFinite(t.at)||t.at<0)continue;
  if(trophies.some(x=>x.week===t.week&&x.tier===t.tier))continue;
  trophies.push({tier:t.tier,code:t.code,clubName:cleanRallyText(t.clubName,48)||'Riding club',week:t.week,at:t.at});
 }
 return {version:1,clubs,claims,trophies:trophies.sort((a,b)=>a.at-b.at).slice(-12)};
}
function weekRecord(save,code,week){
 if(!save.clubs[code]){
  const codes=Object.keys(save.clubs);if(codes.length>=12)delete save.clubs[codes[0]];
  save.clubs[code]={weeks:{}};
 }
 const weeks=save.clubs[code].weeks;
 if(!weeks[week])weeks[week]={riders:{},seen:[],latestContribution:null};
 for(const old of Object.keys(weeks).sort().slice(0,-3))delete weeks[old];
 return weeks[week];
}
export function mergeRallyParticipant(value,{code,week,id,name,counts}){
 const save=sanitizeRallySave(value),valid=rallyCounts(counts);
 if(!safeRallyKey(code)||!validRallyWeek(week)||!safeRallyKey(id)||!valid)return {save,changed:false};
 const r=weekRecord(save,code,week),old=r.riders[id];
 if(!old&&Object.keys(r.riders).length>=128)return {save,changed:false};
 const merged=mergeRallyCounts(old?.counts,valid);if(!merged)return {save,changed:false};
 const label=cleanRallyText(name,14)||'Rider',changed=!old||JSON.stringify(old.counts)!==JSON.stringify(merged)||old.name!==label;
 if(changed)r.riders[id]={name:label,counts:merged};return {save,changed};
}
export function creditRallyRun(value,{code,week,id,name,kind,runId,result,at=Date.now()}){
 const save=sanitizeRallySave(value),key=kind+':'+runId,delta=rallyDelta(kind,result);
 if(!safeRallyKey(code)||!validRallyWeek(week)||!safeRallyKey(id)||!runKey(key)||!delta||!Number.isFinite(at)||at<0)return {save,receipt:null};
 const r=weekRecord(save,code,week);if(r.seen.includes(key))return {save,receipt:null};
 if(!r.riders[id]&&Object.keys(r.riders).length>=128)return {save,receipt:null};
 const prior=r.riders[id]?.counts||blankRallyCounts(),counts={};
 for(const k of RALLY_COUNT_KEYS)counts[k]=prior[k]+delta[k];
 if(!rallyCounts(counts))return {save,receipt:null};
 r.riders[id]={name:cleanRallyText(name,14)||'Rider',counts};r.seen.push(key);r.seen=r.seen.slice(-512);
 const receipt={key,code,week,kind,name:cleanRallyText(result?.name,64)||({rush:'Ranch Rush',rescue:'Clover rescue',roundup:'Roundup',trail:'Trail ride'}[kind]),points:rallyPoints(delta),at};
 r.latestContribution=receipt;return {save,receipt};
}
export function rallyView(value,{code='',clubName='',week,id='',joined=false,connected=false}={}){
 const save=sanitizeRallySave(value),r=joined?save.clubs[code]?.weeks[week]:null,counts=blankRallyCounts();
 const contributors=Object.entries(r?.riders||{}).map(([pid,p])=>({id:pid,name:p.name,points:rallyPoints(p.counts),counts:{...p.counts},me:pid===id})).filter(p=>p.points>0).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
 for(const p of contributors)for(const k of RALLY_COUNT_KEYS)counts[k]+=p.counts[k];
 const total=contributors.reduce((n,p)=>n+p.points,0),mine=contributors.find(p=>p.me)?.points||0;
 const milestones=RALLY_MILESTONES.map((m,i)=>({...m,reward:{...m.reward},claimed:!!((save.claims[week]||0)&(1<<i)),ready:!!joined&&mine>=10&&total>=m.target&&!((save.claims[week]||0)&(1<<i))}));
 return {joined:!!joined,code,clubName,week,connected:!!connected,total,mine,counts,milestones,contributors,trophies:save.trophies.slice().reverse(),latestContribution:r?.latestContribution||null,nextMilestone:milestones.find(m=>!m.claimed)||null,
  lifetime:{trophies:Object.values(save.claims).reduce((n,m)=>n+((m&1)?1:0)+((m&2)?1:0)+((m&4)?1:0),0),bestTier:RALLY_MILESTONES.filter((_,i)=>Object.values(save.claims).some(m=>m&(1<<i))).at(-1)?.id||null}};
}
export function applyRallyClaim(save,tier,context,payReward,at=Date.now()){
 const state=rallyView(save.clubRally,context),i=RALLY_MILESTONES.findIndex(m=>m.id===tier),m=state.milestones[i];
 if(!state.joined)return {ok:false,reason:'Join a club before earning rally rewards.'};
 if(!m)return {ok:false,reason:'This trophy does not exist.'};
 if(m.claimed)return {ok:false,reason:'You already claimed this trophy this week.'};
 if(state.mine<10)return {ok:false,reason:'Earn at least 10 rally points for your club first.'};
 if(!m.ready)return {ok:false,reason:'Your club has not reached this milestone yet.'};
 const next=sanitizeRallySave(save.clubRally);next.claims[context.week]=(next.claims[context.week]||0)|(1<<i);
 next.trophies.push({tier,code:context.code,clubName:context.clubName,week:context.week,at});next.trophies=next.trophies.slice(-12);
 save.clubRally=next;payReward(save,m.reward);return {ok:true,tier,week:context.week,code:context.code,reward:{...m.reward}};
}
