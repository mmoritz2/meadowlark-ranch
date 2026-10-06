/* Read-only care plans and receipts. The existing care action owns all rewards. */
const n=v=>Number.isFinite(v)?v:0;
const clip=(v,min,max)=>Math.max(min,Math.min(max,v));
const plain=v=>String(v||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
export function bondingPlan(h,{personality={},bondGain=(h,v)=>v,names=[]}={}){
 const bond=clip(n(h?.bond),0,100),level=Math.min(5,Math.floor(bond/20)),next=level<5?(level+1)*20:null;
 const actions=[['groom','Groom',3],['pet','Pet',2],['water','Water',1]].map(([id,label,base])=>({id,label,gain:Math.min(100-bond,Math.max(0,bondGain(h,base,id))),preference:n(personality[id])||1}));
 const likes=[['groom','grooming'],['pet','petting'],['feed','treats'],['ride','riding'],['ribbon','ribbons']].filter(([key])=>personality[key]>1).sort((a,b)=>personality[b[0]]-personality[a[0]]).slice(0,2).map(([,label])=>label);
 const whistle=Number.isFinite(personality.whistleLv)?personality.whistleLv:1;
 return {bond,level,name:names[level]||'Bond level '+level,next,nextName:next===null?null:names[level+1]||'Bond level '+(level+1),remaining:next===null?0:next-bond,
  nextBenefit:next===null?'Your horse trusts you completely.':(level<whistle&&level+1>=whistle?'Answers the pasture whistle · ':'')+((level+1)*2)+'% less stamina used',
  preference:likes.length?'Bonds especially well through '+likes.join(' and ')+'.':'Build trust through care and rides together.',actions};
}

export function foodTrainingPlan(h,food,{statCap,statCeil,statNeed,multiplier=()=>1,bondGain=(h,v)=>v,have=0}={}){
 const stat=food?.stat;if(!stat||!statNeed||!statCap||!statCeil)return null;
 const value=n(h.stats?.[stat]),progress=n(h.sxp?.[stat]),cap=Math.min(statCap(h),statCeil(h,stat)),need=statNeed(value),capped=value>=cap;
 // Feeding increases bond before the normal stat-XP multiplier is applied.
 const fed={...h,bond:Math.min(100,n(h.bond)+bondGain(h,n(food.bond),'feed'))};
 const gain=capped?0:Math.max(0,Math.round(n(food.sxp)*multiplier(fed,stat)));
 const remaining=capped?0:Math.max(0,need-progress),count=gain>0?Math.max(1,Math.ceil(remaining/gain)):null;
 return {stat,value,progress,cap,need,capped,gain,remaining,count,have:Math.max(0,Math.floor(n(have))),percent:capped?100:clip(100*progress/Math.max(1,need),0,100)};
}

export function careReceipt(before,after,{action,food,statLabels={},maxLevel=50}={}){
 if(!before||!after||before.id!==after.id)return null;
 const gains=[],bond=Math.max(0,n(after.bond)-n(before.bond)),a=before.level||1,b=after.level||1;
 if(bond)gains.push('+'+bond+' bond');
 if(b>a)gains.push('Level '+a+' → '+b);
 // XP resets on each level, and is discarded at the maximum level.
 if(b<maxLevel){let xp=n(after.xp)-n(before.xp);for(let level=a;level<b;level++)xp+=50+level*50;if(xp>0)gains.push('+'+xp+' horse XP');}
 for(const key of Object.keys({...before.stats,...after.stats})){
  const from=n(before.stats?.[key]),to=n(after.stats?.[key]),label=plain(statLabels[key]||key);
  if(to>from)gains.push(label+' '+from+' → '+to);
  else if(food?.stat===key){const xp=n(after.sxp?.[key])-n(before.sxp?.[key]);if(xp>0)gains.push('+'+xp+' '+label.toLowerCase()+' XP');}
 }
 const verb=food?'Fed '+plain(food.label||action):({groom:'Groomed',pet:'Petted',water:'Watered'})[action]||'Cared for';
 return {horseId:after.id,horseName:after.name,title:verb+(food?' to ':' ')+after.name,gains,bond,level:b};
}
