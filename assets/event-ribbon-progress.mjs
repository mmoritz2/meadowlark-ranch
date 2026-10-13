import {verifiedRibbonAward} from './ribbon-awards.mjs?v=final-ribbon-1';
// Read-only event progress. Final judged receipts are authoritative for new
// rounds; conflicting older per-difficulty counters are retained as history.
const count=v=>Number.isFinite(v)&&v>=0?Math.min(6,Math.floor(v)):0;
function confirmedRecord(save,eventId,diff){
 const record=save.ribbonAwards?.version===1?save.ribbonAwards.byDifficulty?.[eventId+':'+diff]:null,last=record?.last;
 if(!last||last.eventId!==eventId||last.diff!==diff||!verifiedRibbonAward(save,last)||!Number.isFinite(record.bestRib)||record.bestRib<last.rib||record.bestRib>6||typeof record.bestGold!=='boolean')return null;
 return record;
}
export function eventRibbonProgress(save={},eventId,difficulties=[]){
 save=save&&typeof save==='object'&&!Array.isArray(save)?save:{};
 const by=save.ribbonsBy||{},aggregate=count(save.ribbons?.[eventId]),legacyGold=save.ribbonGold?.[eventId]===true;
 const confirmed=difficulties.map(d=>confirmedRecord(save,eventId,d.k));
 const raw=difficulties.map(d=>count(by[eventId+':'+d.k]));
 const per=raw.map((n,i)=>Math.min(4,confirmed[i]?Math.max(count(confirmed[i].bestRib),legacyGold?Math.min(n,aggregate):0):Math.min(n,aggregate)));
 if(!per.some(Boolean)&&aggregate){const open=Math.max(0,difficulties.findIndex(d=>d.k==='open'));if(per.length)per[open]=Math.min(4,aggregate);}
 const perGold=confirmed.map(r=>!!r?.bestGold),knownGold=perGold.filter(Boolean).length;
 // A global historical gold does not identify which difficulty earned it.
 const golds=knownGold|| (legacyGold?1:0),gold=golds>0;
 const historical=raw.map((n,i)=>n>per[i]&&!confirmed[i]);
 return {per,perGold,historical,best:Math.max(aggregate,...per,0),gold,golds,sum:per.reduce((a,b)=>a+b,0),max:4*difficulties.length};
}
