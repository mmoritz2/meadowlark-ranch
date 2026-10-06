// Original field composition, shared by visible terrain and rideable ground.
// Compact C2-continuous rises keep distant regions, buildings and arenas intact.
export const FIELD_RISES = [
  {x:65,z:-158,rx:62,rz:55,h:9},
  {x:178,z:38,rx:61,rz:64,h:10},
  {x:56,z:230,rx:74,rz:59,h:11},
  {x:240,z:128,rx:67,rz:48,h:8},
];
export const FIELD_ANCHORS = [
  [0,0,72],[-71,-10,56],[47,-50,40],[215,-105,64],
  [-6,-116,37],[206,-38,37],[-92,-173,37],[-238,220,37],
  [-76,172,78],[310,300,53],[300,-300,53],
];
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
export function pastureRise(x,z) {
  let height=0;
  for(const c of FIELD_RISES){
    const r2=((x-c.x)/c.rx)**2+((z-c.z)/c.rz)**2;
    if(r2<1)height+=c.h*(1-r2)**3;
  }
  if(!height)return 0;
  let keep=1;
  for(const [ax,az,r] of FIELD_ANCHORS)keep=Math.min(keep,smooth(r,r+42,Math.hypot(x-ax,z-az)));
  return height*keep;
}
// Elliptical flower colonies have irregular edges but no cell-grid boundaries.
export const FLOWER_DRIFTS=[
  [-52,44,17,9],[-76,51,19,12],[57,-123,16,23],[83,-161,20,11],
  [165,36,24,15],[42,213,27,13],[209,113,18,12],[147,-121,10,25],
];
export function meadowBloomAt(x,z){
  let mask=0;
  for(const [cx,cz,rx,rz] of FLOWER_DRIFTS){
    const d=Math.hypot((x-cx)/rx,(z-cz)/rz);
    const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;
    mask=Math.max(mask,1-smooth(.50,1.12,edge));
  }
  return mask;
}
