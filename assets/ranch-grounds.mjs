// Original groundskeeping around lived-in places. The compact masks describe
// lawns outside the arena, stable yard and cottage gardens, not entire fields.
// Every grass layer samples the same world coordinates before its normal LOD
// fade. No root positions, random draws, terrain or rideable surfaces change.
export const RANCH_GROUNDS_PROFILE='working-ranch-turf-2-barleyfold-arrival';
export const RANCH_TURF_HEIGHT=.32;
export const RANCH_TURF_REACH=.58;
export const RANCH_TURF_YARDS=Object.freeze([
 Object.freeze({id:'arena-lawns',x:-2,z:0,halfX:34,halfZ:26,feather:9}),
 Object.freeze({id:'entrance-green',x:-2,z:32,halfX:18,halfZ:8,feather:8}),
 Object.freeze({id:'stable-working-yard',x:-34,z:-11,halfX:11,halfZ:18,feather:8}),
 Object.freeze({id:'cottonwood-cottage-lawns',x:51,z:-35.5,halfX:8,halfZ:4.5,feather:4}),
 Object.freeze({id:'barleyfold-arrival-green',x:220,z:-110,halfX:5.5,halfZ:6,feather:4}),
 Object.freeze({id:'barleyfold-gate-approach',x:223,z:-131,halfX:2.5,halfZ:15,feather:3}),
]);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function ranchTurfAt(x,z){
 // Keep the established home-yard bound and the separate farm arrival corridor.
 if((x< -53||x>63||z< -44||z>48)&&(x<210.5||x>229.5||z< -149||z> -100))return 0;
 let turf=0;
 for(const q of RANCH_TURF_YARDS){
  const dx=Math.max(0,Math.abs(x-q.x)-q.halfX),dz=Math.max(0,Math.abs(z-q.z)-q.halfZ);
  if(dx>=q.feather||dz>=q.feather)continue;
  turf=Math.max(turf,1-smooth(Math.hypot(dx,dz)/q.feather));
 }
 return turf;
}
export function managedGroundsAt(x,z,original){return Math.max(original,ranchTurfAt(x,z));}
export function ranchTurfHeightAt(x,z){return 1-(1-RANCH_TURF_HEIGHT)*ranchTurfAt(x,z);}
export function ranchTurfReachAt(x,z){return 1-(1-RANCH_TURF_REACH)*ranchTurfAt(x,z);}
// The arena's sand never becomes a turf mask. Outside it, the same field that
// clips planted growth brings the photographed ground to maintained grass.
export function ranchLandcoverTurfAt(x,z){return Math.abs(x)<25&&Math.abs(z)<20?0:ranchTurfAt(x,z);}
