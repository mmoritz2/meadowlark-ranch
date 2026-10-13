// Final graded ribbon facts. Each event/difficulty keeps one latest receipt and
// its confirmed best; old ribbon fields are retained for save compatibility.
const DIFFICULTIES=new Set(['novice','open','elite']);
const fields=['id','eventId','diff','rib','stars','gold','accuracy','time','faults','refusals','lineOff','at','saved'];
export function createRibbonAward(result,{id,at=Date.now()}={}){
 const eventId=result?.ev?.id,diff=result?.diff||'open';
 if(typeof id!=='string'||!id||id.length>160||typeof eventId!=='string'||!eventId||eventId.length>100||!DIFFICULTIES.has(diff))return null;
 const {rib,stars}=result,accuracy=result.acc??0,time=result.t??0,faults=result.faults??0,refusals=result.refusals??0,lineOff=result.lineOff??0;
 if(![rib,stars,accuracy,time,faults,refusals,lineOff,at].every(Number.isFinite)||!Number.isInteger(rib)||rib<0||rib>6||!Number.isInteger(stars)||stars<1||stars>3||accuracy<0||accuracy>1||time<0||faults<0||refusals<0||lineOff<0||at<=0)return null;
 return Object.freeze({id,eventId,diff,rib,stars,gold:result.gold===true,accuracy,time,faults,refusals,lineOff,at,saved:true});
}
function valid(receipt){return !!receipt&&receipt.saved===true&&!!createRibbonAward({ev:{id:receipt.eventId},diff:receipt.diff,rib:receipt.rib,stars:receipt.stars,gold:receipt.gold,acc:receipt.accuracy,t:receipt.time,faults:receipt.faults,refusals:receipt.refusals,lineOff:receipt.lineOff},{id:receipt.id,at:receipt.at});}
export function verifiedRibbonAward(save,receipt){
 if(!valid(receipt))return null;
 const row=save?.ribbonAwards?.byDifficulty?.[receipt.eventId+':'+receipt.diff],stored=row?.last;
 if(save?.ribbonAwards?.version!==1||!valid(stored)||!fields.every(k=>stored[k]===receipt[k]))return null;
 return Object.freeze(Object.fromEntries(fields.map(k=>[k,stored[k]])));
}
export function recordRibbonAward(save,receipt){
 if(!save||!valid(receipt))return false;
 const key=receipt.eventId+':'+receipt.diff,candidate=save.ribbonAwards?.byDifficulty?.[key];
 const prior=save.ribbonAwards?.version===1&&valid(candidate?.last)&&Number.isFinite(candidate.bestRib)&&candidate.bestRib>=candidate.last.rib&&candidate.bestRib<=6&&typeof candidate.bestGold==='boolean'?candidate:null;
 if(prior?.last?.id===receipt.id)return false;
 const record=save.ribbonAwards=save.ribbonAwards?.version===1?save.ribbonAwards:{version:1,byDifficulty:{}};
 record.byDifficulty=record.byDifficulty||{};
 record.byDifficulty[key]={last:{...receipt},bestRib:Math.max(Number.isFinite(prior?.bestRib)?prior.bestRib:0,receipt.rib),bestGold:prior?.bestGold===true||receipt.gold};
 // These legacy fields remain high-water marks, never a render-time migration.
 save.ribbonsBy=save.ribbonsBy||{};save.ribbonGold=save.ribbonGold||{};
 save.ribbonsBy[key]=Math.max(save.ribbonsBy[key]||0,receipt.rib);
 if(receipt.gold)save.ribbonGold[receipt.eventId]=true;
 return true;
}
