// Shared herd packets contain simulation state only: no payout or save fields.
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const inBounds=(p,b,margin=0)=>finitePoint(p)&&p.x>=b.x1-margin&&p.x<=b.x2+margin&&p.z>=b.z1-margin&&p.z<=b.z2+margin;
const validBounds=b=>b&&[b.x1,b.x2,b.z1,b.z2].every(Number.isFinite)&&b.x1<b.x2&&b.z1<b.z2;
export function sharedHerdRiders(list,bounds,localId){
 if(!Array.isArray(list)||!validBounds(bounds))return null;
 const rows=[],ids=new Set([localId]);
 for(const r of list.slice(0,16)){
  if(typeof r?.id!=='string'||!r.id.trim()||r.id.length>100||ids.has(r.id)||!inBounds(r,bounds,20))continue;
  ids.add(r.id);rows.push({id:r.id,x:r.x,z:r.z});if(rows.length===3)break;
 }
 return rows;
}
export function sharedHerdPressure(horse,riders,radius=14){
 if(!finitePoint(horse)||!Array.isArray(riders)||!Number.isFinite(radius)||radius<=0)return null;
 let x=0,z=0,nearest=radius,count=0;
 for(const r of riders.slice(0,4)){
  if(!finitePoint(r))continue;
  const dx=horse.x-r.x,dz=horse.z-r.z,d=Math.hypot(dx,dz);if(d>=radius||d<.001)continue;
  const weight=(1-d/radius)**2;x+=dx/d*weight;z+=dz/d*weight;nearest=Math.min(nearest,d);count++;
 }
 const strength=Math.hypot(x,z);if(!count||strength<.00001)return null;
 // A virtual pressure source lets the same collision-safe solo steering respect
 // the combined rear/flank influence without changing the horse's speed budget.
 return {rider:{x:horse.x-x/strength*nearest,z:horse.z-z/strength*nearest},distance:nearest,count};
}
export function validateSharedHerdSnapshot(value,{sessionId,bounds,names,pen,previous}={}){
 if(!value||!validBounds(bounds)||!Array.isArray(names)||names.length!==5||value.sessionId!==sessionId||value.host!==true||value.active!==true||value.total!==5||
  typeof value.finished!=='boolean'||typeof value.paused!=='boolean'||!Number.isFinite(value.countdown)||value.countdown<0||value.countdown>3||
  !Number.isFinite(value.elapsed)||value.elapsed<0||value.elapsed>86400||!Number.isInteger(value.penned)||value.penned<0||value.penned>5||
  value.finished!==(value.penned===5)||!Array.isArray(value.horses)||value.horses.length!==5||value.countdown>0&&value.elapsed>0)return null;
 if(previous&&(value.elapsed<previous.elapsed||value.penned<previous.penned||value.countdown>previous.countdown||previous.finished&&!value.finished))return null;
 const horses=[];let penned=0;
 for(let i=0;i<5;i++){
  const h=value.horses[i],old=previous?.horses?.[i];
  if(h?.name!==names[i]||typeof h.penned!=='boolean'||!inBounds(h,bounds,-2)||!Number.isFinite(h.heading)||Math.abs(h.heading)>1e6||!Number.isFinite(h.phase)||Math.abs(h.phase)>1e8||old?.penned&&!h.penned)return null;
  if(h.penned&&(!finitePoint(pen)||Math.hypot(h.x-pen.x,h.z-pen.z)>pen.r+.1))return null;
  if(old&&Math.hypot(h.x-old.x,h.z-old.z)>6*Math.max(0,value.elapsed-previous.elapsed)+1)return null;
  if(h.penned)penned++;horses.push({name:h.name,x:h.x,z:h.z,heading:h.heading,phase:h.phase,penned:h.penned});
 }
 if(penned!==value.penned)return null;
 return {sessionId,host:true,active:true,total:5,countdown:value.countdown,elapsed:value.elapsed,penned,finished:value.finished,paused:value.paused,horses};
}
