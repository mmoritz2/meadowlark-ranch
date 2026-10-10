// A finished herd keeps one immutable proof until its reward receipt is durable.
// The controller owns crossings/time; this module owns records and retry identity.
export const ROUNDUP_MODES=Object.freeze({
 beginner:Object.freeze({name:'Gentle Roundup',n:3,time:150}),
 full:Object.freeze({name:'Full Herd',n:5,time:150}),
});
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const count=v=>Number.isFinite(v)?Math.max(0,Math.floor(v)):0;
const ranks={none:0,bronze:1,silver:2,gold:3};
const rank=v=>Object.hasOwn(ranks,v)?ranks[v]:0;
const round=v=>Math.round(v*100)/100;
const fields=['runId','mode','total','penned','time','remaining','score','medal','pay','gems','keys','at'];
export function createRoundupFinish({runId,mode,penned,time,remaining,at}={}){
 const def=Object.hasOwn(ROUNDUP_MODES,mode)?ROUNDUP_MODES[mode]:null;
 if(!def||typeof runId!=='string'||!runId.trim()||runId.length>160||!Number.isInteger(penned)||penned<0||penned>def.n||
  !Number.isFinite(time)||time<0||time>def.time+.05||!Number.isFinite(remaining)||remaining<0||remaining>def.time||
  !Number.isFinite(at)||at<=0||Math.abs(Math.min(time,def.time)+remaining-def.time)>.06)return null;
 const all=penned===def.n;if(!all&&remaining>0)return null;
 return Object.freeze({runId,mode,name:def.name,total:def.n,penned,time:round(Math.min(time,def.time)),remaining,at,
  score:penned*300+(all?Math.round(remaining*5):0),medal:all?(remaining>=def.time*.35?'gold':'silver'):penned?'bronze':'none',
  pay:penned*130+(all?(mode==='full'?250:150):0),gems:all?(mode==='full'?2:1):0,keys:all&&mode==='full'?1:0});
}
function receiptFor(s,proof){
 const records=object(s?.roundupRewards?.receipts),r=records&&Object.hasOwn(records,proof.runId)?records[proof.runId]:null;
 if(!r)return null;
 if(r.saved!==true||!fields.every(k=>r[k]===proof[k]))throw Error('This roundup already has a different saved result.');
 return r;
}
function read(storage){try{return storage.fresh();}catch{return null;}}
function confirmed(storage,proof){
 const saved=read(storage),result=receiptFor(saved,proof);
 return result?{ok:true,result,saved}:null;
}
function record(s,proof){
 s.roundupBest=object(s.roundupBest)||{};const old=object(s.roundupBest[proof.mode])||{};
 const previousBestScore=count(old.score),previousBestTime=Number.isFinite(old.time)&&old.time>0?old.time:null;
 const previousBestMedal=rank(old.medal)?old.medal:'none';
 const newBestScore=proof.score>previousBestScore,newBestTime=proof.penned===proof.total&&(!previousBestTime||proof.time<previousBestTime),newBestMedal=rank(proof.medal)>rank(previousBestMedal);
 s.roundupBest[proof.mode]={...old,plays:count(old.plays)+1,score:Math.max(previousBestScore,proof.score),
  penned:Math.max(count(old.penned),proof.penned),time:newBestTime?proof.time:previousBestTime,
  medal:newBestMedal?proof.medal:previousBestMedal,lastRunId:proof.runId};
 return {previousBestScore,previousBestTime,previousBestMedal,newBestScore,newBestTime,newBestMedal};
}
// apply mutates this same draft and returns receipt details. No notification or
// scene cleanup belongs here; a swallowed storage exception is not confirmation.
export function saveRoundupFinish(storage,pending,apply){
 const proof=createRoundupFinish(pending?.proof);
 if(!proof||!fields.every(k=>pending.proof[k]===proof[k])||!storage||typeof storage.fresh!=='function'||typeof storage.sync!=='function'||typeof apply!=='function')return {ok:false,reason:'The completed roundup is unavailable.'};
 let reason='Your roundup could not be saved. Keep this tab open and retry.';
 try{
  const existing=confirmed(storage,proof);if(existing)return existing;
  try{storage.sync(s=>{
   try{
    if(!object(s))throw Error('Your ranch save is unavailable.');
    if(receiptFor(s,proof))return;
    const best=record(s,proof),details=apply(s,proof);
    if(!object(details))throw Error('The roundup did not produce a reward receipt.');
    const result=JSON.parse(JSON.stringify({...details,...proof,...best,saved:true}));
    const state=object(s.roundupRewards)||{},receipts=object(state.receipts)||{};
    s.roundupRewards={...state,version:1,receipts:{...receipts,[proof.runId]:result},lastResult:result};
   }catch(error){reason=error?.message||reason;throw error;}
  });}catch(error){reason=error?.message||reason;}
  // Even a wrapper that throws after writing may have saved the exact receipt.
  return confirmed(storage,proof)||{ok:false,reason};
 }catch(error){return {ok:false,reason:error?.message||reason};}
}
