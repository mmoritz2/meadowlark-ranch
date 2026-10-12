import {northValleyRelief} from './north-valley-relief.mjs?v=world-cohesion-1';
import {northPastureAt} from './north-pasture.mjs?v=north-pasture-2';
import {fieldSwardAt,FIELD_SWARD_RECOVERY} from './field-sward-bands.mjs?v=field-sward-bands-3';

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
// A low connected field ridge brings the Clover foot toward Cottonwood.
// Town foundations and the Grand Loop retain a full terrain-cell footing halo.
const CLOVER_APPROACH_BOUNDS={minX:38,maxX:104,minZ:-137,maxZ:-83};
const CLOVER_RACE=[[98,-30],[90,-110],[-20,-150]];
function cloverRaceDistance(x,z){
  let distance=Infinity;
  for(let k=1;k<CLOVER_RACE.length;k++){
    const a=CLOVER_RACE[k-1],b=CLOVER_RACE[k],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return distance;
}
export function cloverApproachRelief(x,z){
  const b=CLOVER_APPROACH_BOUNDS;
  if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)return 0;
  const bump=(cx,cz,rx,rz,yaw)=>{
    const dx=x-cx,dz=z-cz,co=Math.cos(yaw),si=Math.sin(yaw);
    const r2=((dx*co+dz*si)/rx)**2+((dz*co-dx*si)/rz)**2;
    return r2<1?(1-r2)**3:0;
  };
  const west=bump(57,-105,28,23,.35),east=bump(76,-98,24,20,-.32);
  const ridge=3.3*(1-(1-west)*(1-east*.70));
  const swale=.72*bump(73,-109,24,9,.45);
  let keep=smooth(b.minX,b.minX+7,x)*(1-smooth(b.maxX-7,b.maxX,x));
  keep*=smooth(b.minZ,b.minZ+8,z)*(1-smooth(b.maxZ-8,b.maxZ,z));
  // Authored village roads/plots fit within this real reserved rectangle.
  const townDistance=Math.hypot(Math.max(22-x,0,x-86),Math.max(-80-z,0,z+25));
  keep*=smooth(4.5,12,townDistance);
  keep*=smooth(6.8,18,cloverRaceDistance(x,z));
  return (ridge-swale)*keep;
}
export function pastureRise(x,z) {
  let height=0;
  for(const c of FIELD_RISES){
    const dx=x-c.x,dz=z-c.z,co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0);
    const r2=((dx*co+dz*si)/c.rx)**2+((dz*co-dx*si)/c.rz)**2;
    if(r2<1)height+=c.h*(1-r2)**3;
  }
  if(!height)return cloverApproachRelief(x,z)+northValleyRelief(x,z);
  let keep=1;
  for(const [ax,az,r] of FIELD_ANCHORS)keep=Math.min(keep,smooth(r,r+64,Math.hypot(x-ax,z-az)));
  return height*keep+cloverApproachRelief(x,z)+northValleyRelief(x,z);
}
// Elliptical flower colonies have irregular edges but no cell-grid boundaries.
export const FLOWER_DRIFTS=[
  [-73,54,11,6],[-41,61,8,5],[44,-115,9,16],[88,-167,13,7],
  [140,38,9,20],[204,59,14,8],[33,208,16,6],[80,253,13,6],
  [215,115,12,6],[262,141,8,12],[147,-121,7,17],
];
// Recover a fuller west sward without changing the shared grazing mask that
// suppresses old flower cards and ferns. The compact field has C2-soft margins.
export const WEST_MEADOW_SWARD_RECOVERY=.76;
export const WEST_MEADOW_FLOWER_DRIFT=Object.freeze([-69,36,8,18]);
export function westMeadowSwardAt(x,z){
  const west=Math.hypot((x+54)/22,(z-43)/16)+Math.sin(x*.18+z*.11)*.06;
  return 1-smooth(.55,1.12,west);
}
// Recover compact, authored flower-bed margins inside the open pastures.
// The terrain/tree/fern grazing mask stays independent: these are taller sward
// and blossom patches, not a new landscape layout or a continuous field ring.
export const MEADOW_MARGIN_RECOVERY=.85;
export const MEADOW_MARGIN_DRIFTS=Object.freeze(FLOWER_DRIFTS.slice(2,10).map(d=>Object.freeze([...d])));
export function meadowMarginAt(x,z){
  let mask=0;
  for(const [cx,cz,rx,rz] of MEADOW_MARGIN_DRIFTS){
    const dx=(x-cx)/(rx*1.25),dz=(z-cz)/(rz*1.25);
    // The irregularity below is bounded by .18, so this is exact support.
    if(Math.abs(dx)>=1.30||Math.abs(dz)>=1.30)continue;
    const d=Math.hypot(dx,dz);
    if(d>=1.30)continue;
    const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;
    mask=Math.max(mask,1-smooth(.50,1.12,edge));
  }
  return mask;
}
function flowerMarginGrazingAt(x,z){
  const grazing=meadowGrazingAt(x,z);
  if(grazing===0)return 0;
  const recovery=Math.max(WEST_MEADOW_SWARD_RECOVERY*westMeadowSwardAt(x,z),MEADOW_MARGIN_RECOVERY*meadowMarginAt(x,z));
  return grazing*(1-recovery);
}
// Grass alone recovers along the uncut seed-bearing ribbons. The original
// grazing policy still owns terrain, trees, ferns and every flower colony.
export function meadowSwardGrazingAt(x,z){
  const original=flowerMarginGrazingAt(x,z)*(1-FIELD_SWARD_RECOVERY*fieldSwardAt(x,z).cover);
  const pasture=northPastureAt(x,z);
  return Math.max(original*(1-pasture.uncut*.85),pasture.cut);
}
export function meadowBloomAt(x,z){
  let mask=0;
  for(const [cx,cz,rx,rz] of FLOWER_DRIFTS){
    const d=Math.hypot((x-cx)/rx,(z-cz)/rz);
    const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;
    mask=Math.max(mask,1-smooth(.50,1.12,edge));
  }
  const grazing=meadowGrazingAt(x,z),marginGrazing=grazing*(1-MEADOW_MARGIN_RECOVERY*meadowMarginAt(x,z)),legacy=mask*(1-.96*marginGrazing);
  // The west colony keeps its established recovery. Other authored beds use
  // the compact meadow margins above, leaving the original layout intact.
  const [cx,cz,rx,rz]=WEST_MEADOW_FLOWER_DRIFT;
  const d=Math.hypot((x-cx)/rx,(z-cz)/rz);
  const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;
  const colony=1-smooth(.50,1.12,edge);
  if(colony===0)return legacy;
  const recovered=flowerMarginGrazingAt(x,z);
  return Math.max(legacy,colony*(1-.96*recovered));
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

// Grazed interiors are low enough to read the ground from the saddle. The west
// meadow keeps its existing trees; this mask changes plants, never collision.
// A soft boundary is shared by every grass LOD and the flower colonies.
export function meadowGrazingAt(x,z){
  const west=Math.hypot((x+54)/22,(z-43)/16)+Math.sin(x*.18+z*.11)*.06;
  // The cultivated orchard is mown beneath its fruit trees. This only changes
  // cover height; trunks, picking sites, terrain and taller field margins stay put.
  const orchard=Math.hypot((x-70)/18,(z+50)/18)+Math.sin(x*.24+z*.19)*.035;
  return Math.max(meadowOpeningAt(x,z),1-smooth(.55,1.12,west),1-smooth(.72,1.13,orchard),1-smooth(2.8,5.8,Math.hypot(x-58,z+66)));
}
