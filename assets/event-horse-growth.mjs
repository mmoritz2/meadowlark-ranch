/* Read-only observed-ride progress from two persisted snapshots. Rewards, caps and entry
 * remain owned by the production XP and course systems. */
const validId=id=>typeof id==='string'&&id.trim().length>0||typeof id==='number'&&Number.isFinite(id);
const limit=n=>Number.isInteger(n)&&n>=1&&n<=100?n:50;
const threshold=level=>50+level*50;
export function horseProgressSnapshot(horse,{maxLevel=50}={}){
 const max=limit(maxLevel),h=horse;
 if(!h||!validId(h.id)||!Number.isInteger(h.level)||h.level<1||h.level>max||!Number.isFinite(h.xp)||h.xp<0||
  (h.level===max?h.xp!==0:h.xp>=threshold(h.level)))return null;
 return Object.freeze({horseId:h.id,name:typeof h.name==='string'&&h.name.trim()?h.name:'Your horse',level:h.level,xp:h.xp,
  bond:Number.isFinite(h.bond)&&h.bond>=0&&h.bond<=100?h.bond:null});
}
export function horseFinishGrowth(before,after,{maxLevel=50}={}){
 const max=limit(maxLevel);
 if(!before||!after||before.horseId!==after.horseId||after.level<before.level)return null;
 // Revalidate caller-supplied snapshots; no malformed/missing readback may
 // become a saved growth claim or a invented maximum-level reward.
 const b=horseProgressSnapshot({id:before.horseId,name:before.name,level:before.level,xp:before.xp,bond:before.bond},{maxLevel:max});
 const a=horseProgressSnapshot({id:after.horseId,name:after.name,level:after.level,xp:after.xp,bond:after.bond},{maxLevel:max});
 if(!b||!a)return null;
 let gained=a.xp-b.xp;
 for(let level=b.level;level<a.level;level++)gained+=threshold(level);
 if(!Number.isFinite(gained)||gained<0)return null;
 const atMax=a.level===max,need=atMax?0:threshold(a.level);
 return Object.freeze({horseId:a.horseId,name:a.name,before:b,after:a,levels:a.level-b.level,horseXp:gained,
  atMax,nextLevelXp:need,remaining:atMax?0:Math.max(0,need-a.xp),percent:atMax?100:a.xp/need*100,
  bondGain:a.bond!==null&&b.bond!==null?Math.max(0,a.bond-b.bond):0});
}
export function nextHorseChallenge({event,difficulty,events=[],difficulties=[],horse,ready}={}){
 if(!event||!horse||typeof ready!=='function'||event.friendly||event.rush||['dance','fr'].includes(event.id))return null;
 const di=difficulties.findIndex(d=>d.k===difficulty);
 if(di<0)return null;
 const eligible=(ev,index)=>{try{return ready(ev,index,horse)===true;}catch{return false;}};
 // A harder grade on the same course is the clearest next riding skill step.
 for(let index=di+1;index<difficulties.length;index++)if(eligible(event,index))return Object.freeze({eventId:event.id,difficulty:index,
  label:'Try '+difficulties[index].label+' '+event.name,harder:true});
 // Keep the riding discipline familiar; do not send an all-gate racer straight
 // into a judged pattern, a championship qualifier or an unavailable region.
 const sameKind=ev=>!!ev.race===!!event.race&&!!ev.dressage===!!event.dressage&&(ev.kind||'')===(event.kind||'')&&!!ev.xc===!!event.xc;
 const rows=events.filter(ev=>ev&&ev.id!==event.id&&!ev.friendly&&!ev.rush&&!ev.champ&&!ev.special&&sameKind(ev)&&(ev.lvl||1)>(event.lvl||1))
  .sort((a,b)=>(a.lvl||1)-(b.lvl||1));
 for(const ev of rows)if(eligible(ev,di))return Object.freeze({eventId:ev.id,difficulty:di,label:'Ride '+ev.name,harder:true});
 if(eligible(event,di))return Object.freeze({eventId:event.id,difficulty:di,label:'Ride again with '+(horse.name||'your horse'),harder:false});
 return null;
}
