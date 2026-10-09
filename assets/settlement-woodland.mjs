// Original authored woodland margins. Uses no shared random world stream.
// The open riding meadows remain open. These lines join the existing scattered
// trees into wooded shoulders behind Cottonwood and the neighbouring pastures.
export const SETTLEMENT_WOODLAND_BELTS=Object.freeze([
 {id:'cottonwood-left-frame',seed:5,points:[[42,-91],[48,-91],[46,-84]],cap:3,width:3.2,height:12.5,allowMeadowMargin:true},
 {id:'cottonwood-right-frame',seed:6,points:[[76,-95],[77,-87],[81,-81]],cap:3,width:3.2,height:12.0,allowMeadowMargin:true},
 {id:'cottonwood-back',seed:0,points:[[28,-15],[44,-10],[62,-6],[78,0],[97,8]],cap:8,width:6.4,height:12.6},
 {id:'western-field-back',seed:1,points:[[-118,-69],[-94,-73],[-70,-76],[-47,-83]],cap:6,width:6.4,height:12.4},
 {id:'western-river-shoulder',seed:2,points:[[-117,31],[-106,54],[-85,72],[-58,81],[-34,82]],cap:10,width:7.0,height:12.1},
 {id:'clover-far-shoulder',seed:3,points:[[104,-196],[126,-193],[147,-181],[166,-164]],cap:8,width:7.6,height:13.2},
 {id:'eastern-field-back',seed:4,points:[[219,19],[227,39],[234,59],[247,79]],cap:8,width:7.0,height:12.5},
].map(b=>Object.freeze({...b,points:Object.freeze(b.points.map(p=>Object.freeze(p)))})));
export const SETTLEMENT_WOODLAND_MAX=46;
export function terrainAwareWoodEnvelope({x,z,height,sourceHeight,sourceBottom,sourceRadius=0,boxes,heightAt,terrainStep}){
 if(![x,z,height,sourceHeight,sourceBottom,sourceRadius,terrainStep].every(Number.isFinite)||height<=0||sourceHeight<=0||terrainStep<=0)throw Error('Invalid woodland envelope input');
 const scale=height/sourceHeight,rootY=heightAt(x,z);
 let fullRadius=sourceRadius;
 for(const b of boxes)for(const bx of[b.min[0],b.max[0]])for(const bz of[b.min[2],b.max[2]])fullRadius=Math.max(fullRadius,Math.hypot(bx,bz)*scale);
 // Every enclosed mesh-grid vertex plus the enclosing cells is conservative
 // for the piecewise planar terrain, including a hill directly under a branch.
 // Solid objects retain separate full-envelope rejection at the call site.
 const step=terrainStep,x0=Math.floor((x-fullRadius+500)/step)*step-500,x1=Math.ceil((x+fullRadius+500)/step)*step-500;
 const z0=Math.floor((z-fullRadius+500)/step)*step-500,z1=Math.ceil((z+fullRadius+500)/step)*step-500;
 let highest=rootY;
 for(let px=x0;px<=x1+step*.01;px+=step)for(let pz=z0;pz<=z1+step*.01;pz+=step)highest=Math.max(highest,heightAt(px,pz));
 if(!Number.isFinite(rootY+highest))throw Error('Invalid woodland ground height');
 const clearanceHeight=highest-rootY+4.20;
 let radius=1.35;
 for(const box of boxes){
  const low=(box.min[1]-sourceBottom)*scale-.07;
  if(low>clearanceHeight)continue;
  for(const bx of[box.min[0],box.max[0]])for(const bz of[box.min[2],box.max[2]])radius=Math.max(radius,Math.hypot(bx,bz)*scale);
 }
 return {radius,fullRadius,maxGroundRise:highest-rootY,clearanceHeight};
}
const hash=(a,b,c)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,1442695041);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
function along(points,distance){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(distance<=length||i===points.length-1){const t=Math.max(0,Math.min(1,distance/length));return{x:a[0]+dx*t,z:a[1]+dz*t,nx:-dz/length,nz:dx/length};}
  distance-=length;
 }
 throw Error('Woodland belt requires two distinct points');
}
export function settlementWoodlandCandidates(belts=SETTLEMENT_WOODLAND_BELTS){
 const result=[];
 belts.forEach(belt=>{
  const k=belt.seed;
  const length=belt.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-belt.points[i][0],p[1]-belt.points[i][1]),0);
  const stations=Math.floor(length/6.8);
  for(let j=0;j<=stations;j++)for(let row=0;row<3;row++){
   const s=along(belt.points,(j+.15+hash(k,j,61)*.32)*length/(stations+1));
   const off=(row-1)*belt.width*.55+(hash(k,j*3+row,73)-.5)*1.4;
   const index=j*3+row,variation=hash(k,index,79),upright=hash(k,index,83)>.42;
   result.push({belt:belt.id,allowMeadowMargin:!!belt.allowMeadowMargin,x:s.x+s.nx*off,z:s.z+s.nz*off,height:belt.height*(.85+variation*.22),yaw:hash(k,index,89)*Math.PI*2,upright,
    // Evaluate central trees first, then the loose outer edge; no regular row survives.
    priority:row===1?0:1,station:j});
  }
 });
 return result.sort((a,b)=>a.priority-b.priority||a.station-b.station||a.belt.localeCompare(b.belt));
}
export function settlementWoodlandPlants(trees){
 const plants=[];
 for(let i=0;i<trees.length;i++)for(let k=0;k<7;k++){
  const tree=trees[i],angle=k*2.399963229728653+tree.yaw,radius=3.8+hash(i,k,101)*2.4;
  const fern=k%3===0;
  plants.push([fern?'fern_02':k%2?'shrub_03':'shrub_04',tree.x+Math.cos(angle)*radius,tree.z+Math.sin(angle)*radius,
   fern?.65+hash(i,k,103)*.24:1.15+hash(i,k,107)*.60,angle+.7]);
 }
 return plants;
}
