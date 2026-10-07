// Original field composition, shared by visible terrain and rideable ground.
// Compact C2-continuous rises keep distant regions, buildings and arenas intact.
export const FIELD_RISES = [
  {x:65,z:-158,rx:84,rz:70,h:12,yaw:-.32},
  {x:178,z:38,rx:82,rz:75,h:13,yaw:.35},
  {x:56,z:230,rx:95,rz:72,h:14,yaw:-.30},
  {x:240,z:128,rx:81,rz:63,h:10,yaw:.48},
  // Lower off-centre shoulders make ridges and saddles rather than four domes.
  {x:22,z:-183,rx:70,rz:45,h:5,yaw:.25},
  {x:209,z:51,rx:68,rz:46,h:4,yaw:-.45},
  {x:13,z:247,rx:75,rz:46,h:4,yaw:.30},
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
    const dx=x-c.x,dz=z-c.z,co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0);
    const r2=((dx*co+dz*si)/c.rx)**2+((dz*co-dx*si)/c.rz)**2;
    if(r2<1)height+=c.h*(1-r2)**3;
  }
  if(!height)return 0;
  let keep=1;
  for(const [ax,az,r] of FIELD_ANCHORS)keep=Math.min(keep,smooth(r,r+64,Math.hypot(x-ax,z-az)));
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

// Open pasture between tree groups makes the foreground slopes and village
// readable from the saddle. Irregular margins retain woods around the fields.
export const MEADOW_OPENINGS=[
  {id:'clover',x:65,z:-145,rx:54,rz:39,yaw:-.25},
  {id:'village-approach',x:64,z:-98,rx:23,rz:37,yaw:.08},
  {id:'east-pasture',x:172,z:34,rx:43,rz:48,yaw:.32},
  {id:'north-meadow',x:53,z:231,rx:54,rz:33,yaw:-.25},
  {id:'riverside',x:237,z:133,rx:40,rz:28,yaw:.45},
];
export function meadowOpeningAt(x,z){
  let opening=0;
  for(const c of MEADOW_OPENINGS){
    const dx=x-c.x,dz=z-c.z,co=Math.cos(c.yaw),si=Math.sin(c.yaw);
    const d=Math.hypot((dx*co+dz*si)/c.rx,(dz*co-dx*si)/c.rz);
    const edge=d+Math.sin(x*.13+Math.sin(z*.08))*.055+Math.sin(z*.16)*.035;
    opening=Math.max(opening,1-smooth(.64,1.05,edge));
  }
  return opening;
}
export const inMeadowOpening=(x,z)=>meadowOpeningAt(x,z)>.5;
