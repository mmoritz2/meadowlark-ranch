import {CANYON_RIDGES,canyonMacroPlanningRelief} from './canyon-landscape.js?v=coyote-macroform-5';
// Boot placement uses original804 physical contour occupancy. Flora retains
// its separate older planning generation; mounted/NPC physics uses live owners.
export function createCoyoteBootPlanning(world){
 const owned=world.canyonLandscape?.barriers;
 if(!Array.isArray(owned)||!owned.length||!world.canyonPlacement?.macroGrids)return {barriers:[],collidersForPlanning:rows=>rows};
 const barriers=[],seen=new Set(),cell=2.5,level=2.2;
 for(const ridge of CANYON_RIDGES){
  const pad=Math.max(...ridge.points.map(p=>p[2]))*1.2+3;
  const minX=Math.min(...ridge.points.map(p=>p[0]))-pad,maxX=Math.max(...ridge.points.map(p=>p[0]))+pad;
  const minZ=Math.min(...ridge.points.map(p=>p[1]))-pad,maxZ=Math.max(...ridge.points.map(p=>p[1]))+pad;
  for(let z=minZ;z<maxZ;z+=cell)for(let x=minX;x<maxX;x+=cell){
   const corners=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]],h=corners.map(p=>canyonMacroPlanningRelief(...p));
   for(let i=0;i<4;i++){const j=(i+1)%4;if((h[i]>level)===(h[j]>level))continue;
    const t=(level-h[i])/(h[j]-h[i]),cx=corners[i][0]+(corners[j][0]-corners[i][0])*t,cz=corners[i][1]+(corners[j][1]-corners[i][1])*t,key=Math.round(cx*2)+','+Math.round(cz*2);
    if(seen.has(key))continue;seen.add(key);barriers.push({x:cx,z:cz,r:1.05});
   }
  }
 }
 const originals=new Set(owned);
 const collidersForPlanning=rows=>{
  // Preserve the original contour position in the list and every unrelated
  // object identity. A missing/removed owned group cannot add phantom circles.
  const out=[];let inserted=false;
  for(const row of rows){if(originals.has(row)){if(!inserted){out.push(...barriers);inserted=true;}}else out.push(row);}
  return inserted?out:rows;
 };
 return {profile:'coyote-boot-8042555',barriers,collidersForPlanning};
}
