/* Ranch Rush scoring is independent of the riding controller: only course-engine crossings
   count. The elapsed clock is real riding time, so clock pickups cannot make PB splits run
   backwards. Currency remains entirely with the ordinary course finish transaction. */
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const RUSH_DEFINITIONS = freeze([
  {id:'rush-pasture',name:'Pasture Dash',subtitle:'Find your rhythm',description:'Follow the glowing gates and hold a clean chain around the home pasture.',route:'rush-pp',minutes:'30–60 sec',obstacles:6,fences:0,fenceLegs:[],targetTime:30,reward:150,town:'Home Ranch',medals:{bronze:300,silver:850,gold:1200}},
  {id:'rush-river',name:'River Run',subtitle:'Add a little airtime',description:'Chase the riverside gates and clear two low logs. Good jumps keep your chain alive.',route:'rr',minutes:'40–75 sec',obstacles:8,fences:2,fenceLegs:[1,3],targetTime:40,reward:210,town:'Loon Lake',medals:{bronze:500,silver:1350,gold:1850}},
  {id:'rush-trail',name:'Trailblazer',subtitle:'Put it all together',description:'Ride the open Barleyfold trail, link three log jumps, and beat your own best splits.',route:'xc1',minutes:'50–90 sec',obstacles:10,fences:3,fenceLegs:[1,3,5],targetTime:50,reward:270,town:'Barleyfold',medals:{bronze:600,silver:1650,gold:2350}},
]);
// The original pp south leg runs through permanent hay bales at (-90,-35) and
// (-88.6,-33.8). Its early gate trigger can cut that corner even tighter. This
// separate route keeps four metres inside the south fence and below both bales.
// Register before course-clear so its existing mowing pass includes this line.
export const RUSH_ROUTE_OVERRIDES = freeze({
  'rush-pp':[[-60,16],[-100,14],[-102,-41],[-70,-41],[-42,-34],[-40,2]],
});
export const RUSH_VERSION = 1;
const BY_ID = new Map(RUSH_DEFINITIONS.map(d => [d.id,d]));
const finite = (n, fallback=0) => typeof n==='number' && Number.isFinite(n) ? n : fallback;
const clamp = (n,min,max) => Math.max(min,Math.min(max,finite(n)));
const round = n => Math.round(n*100)/100;
const obj = value => value && typeof value==='object' && !Array.isArray(value) ? value : {};
const int = (n,max=1000000) => Math.floor(clamp(n,0,max));

export function medalForScore(definition,score) {
  if (!definition) return 'none';
  return ['gold','silver','bronze'].find(key => finite(score)>=definition.medals[key]) || 'none';
}
export function nextRushMedal(definition,score) {
  const key = ['bronze','silver','gold'].find(k => finite(score)<definition.medals[k]);
  return key ? {key,target:definition.medals[key],remaining:Math.max(0,definition.medals[key]-finite(score))} : null;
}
function safeSplits(value,maxCount=32) {
  if (!Array.isArray(value)) return [];
  let last=0;
  const result=[];
  for (const n of value.slice(0,maxCount)) {
    if (typeof n!=='number' || !Number.isFinite(n) || n<last || n<0 || n>3600) return [];
    result.push(round(n)); last=n;
  }
  return result;
}
export function sanitizeRushSave(value) {
  const src=obj(value), records={};
  if (src.version!==RUSH_VERSION) return {version:RUSH_VERSION,records};
  for (const def of RUSH_DEFINITIONS) {
    const raw=obj(obj(src.records)[def.id]);
    if (!Object.keys(raw).length) continue;
    const score=int(raw.bestScore,100000), time=finite(raw.bestTime);
    records[def.id]={plays:int(raw.plays),bestScore:score,bestTime:time>0&&time<=3600?round(time):null,
      medal:medalForScore(def,score),bestCombo:int(raw.bestCombo,32),splits:safeSplits(raw.splits),
      layout:typeof raw.layout==='string'?raw.layout.slice(0,600):'',
      lastRunId:typeof raw.lastRunId==='string'?raw.lastRunId.slice(0,80):''};
  }
  return {version:RUSH_VERSION,records};
}
export function createRushRun(id,{runId='',layout='',total=0,best=null}={}) {
  if (!BY_ID.has(id)) return null;
  return {id,runId:String(runId).slice(0,80),layout:String(layout).slice(0,600),total:int(total,32),
    score:0,combo:0,bestCombo:0,gates:0,cleanGates:0,cleanJumps:0,perfectJumps:0,penalties:0,
    completed:0,elapsed:0,splits:[],splitDelta:null,lastCue:'Ride through the first glowing gate',
    best:best&&best.layout===layout?best:null};
}
export function scoreRushCrossing(run,{kind='gate',grade='good',clean=true,time=run.elapsed}={}) {
  if (!run || run.completed>=run.total) return run;
  const fence=kind==='fence', isClean=fence ? grade==='perfect'||grade==='good' : !!clean;
  const combo=isClean ? run.combo+1 : 0;
  const base=fence ? grade==='perfect'?200:grade==='good'?150:grade==='fault'?25:90 : isClean?100:50;
  const multiplier=isClean?1+Math.min(4,combo-1)*0.25:1;
  const points=Math.round(base*multiplier), at=round(clamp(time,run.splits.at(-1)||0,3600));
  const completed=run.completed+1, previous=run.best?.splits?.[completed-1];
  const label=fence ? grade==='perfect'?'Perfect jump':grade==='good'?'Clean jump':grade==='fault'?'Log clipped':'Keep going — time your next jump' : isClean?'Clean gate':'Gate cleared — aim through the middle';
  return {...run,score:run.score+points,combo,bestCombo:Math.max(run.bestCombo,combo),completed,
    gates:run.gates+(fence?0:1),cleanGates:run.cleanGates+(!fence&&isClean?1:0),
    cleanJumps:run.cleanJumps+(fence&&isClean?1:0),perfectJumps:run.perfectJumps+(fence&&grade==='perfect'?1:0),
    penalties:run.penalties+(isClean?0:1),splits:[...run.splits,at],
    splitDelta:Number.isFinite(previous)?round(at-previous):null,
    lastCue:`${label} · +${points}${combo>1?` · ${combo} in a row`:''}`};
}
export function scoreRushRefusal(run) {
  return {...run,combo:0,penalties:run.penalties+1,lastCue:'Try again — jump as you approach the log'};
}
export function finishRushRun(run,{time=run.elapsed,pay=0}={}) {
  if (!run || run.completed!==run.total || !run.total || !(time>0) || !Number.isFinite(time) || time>3600) return null;
  const def=BY_ID.get(run.id);
  const timeBonus=Math.round(400*clamp(2-time/def.targetTime,0,1));
  const score=run.score+timeBonus, best=run.best;
  return {id:run.id,name:def.name,runId:run.runId,layout:run.layout,score,time:round(time),timeBonus,
    medal:medalForScore(def,score),bestCombo:run.bestCombo,cleanJumps:run.cleanJumps,perfectJumps:run.perfectJumps,
    gates:run.gates,cleanGates:run.cleanGates,penalties:run.penalties,splits:run.splits.slice(),splitDelta:run.splitDelta,
    newBestScore:!best||score>best.bestScore,newBestTime:!best?.bestTime||time<best.bestTime,
    previousBestScore:best?.bestScore||0,previousBestTime:best?.bestTime||null,pay:int(pay,100000)};
}
export function recordRushResult(value,result) {
  const save=sanitizeRushSave(value), def=BY_ID.get(result?.id);
  if (!def || !result.runId || !Number.isFinite(result.score) || result.score<0 || result.score>100000 ||
      !Number.isFinite(result.time) || result.time<=0 || result.time>3600) return {save,recorded:false};
  const old=save.records[def.id];
  if (old?.lastRunId===result.runId) return {save,recorded:false};
  const comparable=old?.layout===result.layout ? old : null;
  const improved=!comparable?.bestTime||result.time<comparable.bestTime;
  const bestScore=Math.max(comparable?.bestScore||0,result.score);
  save.records[def.id]={plays:Math.min(1000000,(old?.plays||0)+1),bestScore,
    bestTime:improved?round(result.time):comparable.bestTime,medal:medalForScore(def,bestScore),
    bestCombo:Math.max(comparable?.bestCombo||0,int(result.bestCombo,32)),
    splits:improved?safeSplits(result.splits):comparable.splits.slice(),layout:String(result.layout||'').slice(0,600),
    lastRunId:String(result.runId).slice(0,80)};
  return {save,recorded:true};
}
