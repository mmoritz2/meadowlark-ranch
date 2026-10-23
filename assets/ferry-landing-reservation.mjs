import {FERRY_BANK_APPROACH} from './ferry-bank-approach.mjs?v=ferry-bank-approach-2';
export const FERRY_LANDING_RESERVATION='farbank-procedural-landing-1';
const unique=(a,o)=>a.filter(v=>v===o).length===1;
const ordinary=(o,keys)=>o&&Object.keys(o).every(k=>keys.includes(k));
// Actual dock frame when available. Early users conservatively reserve both
// possible bank directions from the same authored farbank definition.
export function maximumFerryLandingCorridors({dock=null,riverZ}={}){
 let docks;if(dock){if(![dock.x,dock.z,dock.yaw,dock.width,dock.length].every(Number.isFinite)||dock.width!==2.6||dock.length!==7.8)throw Error('Unexpected authored ferry dock');docks=[dock];}
 else{if(typeof riverZ!=='function')throw Error('Ferry river reference required');const z=riverZ(134);if(!Number.isFinite(z))throw Error('Nonfinite ferry river reference');docks=[{x:134,z:z+5.5,yaw:0,width:2.6,length:7.8},{x:134,z:z-5.5,yaw:Math.PI,width:2.6,length:7.8}];}
 return docks.map(d=>{const a=d.length/2-FERRY_BANK_APPROACH.overlap,b=d.length/2+FERRY_BANK_APPROACH.maxRun,c=Math.cos(d.yaw),s=Math.sin(d.yaw);return{x1:d.x+a*s,z1:d.z+a*c,x2:d.x+b*s,z2:d.z+b*c,radius:d.width/2+.6};});
}
export function ferryLandingReserved(corridors,x,z,radius=0){
 if(!Array.isArray(corridors)||corridors.length<1||corridors.length>2||![x,z,radius].every(Number.isFinite)||radius<0)throw Error('Invalid ferry reservation point');
 return corridors.some(q=>{const dx=q.x2-q.x1,dz=q.z2-q.z1,t=Math.max(0,Math.min(1,((x-q.x1)*dx+(z-q.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-q.x1-dx*t,z-q.z1-dz*t)<=q.radius+radius;});
}
// Boot-only paired retirement after the original layout/constructor consumers.
// No collider is selected by proximity alone; only local source references below
// may be retired. Fixed/user/registered/upgraded owners are left for the planner.
export function retireFerryLandingProceduralOwners({G,trees,rocks,zero}){
 const W=G.world,F=G.floraPkg,floor=G.photoscans?.forestFloor,dock=G.worldPkg?.FERRY?.docks.find(d=>d.id==='farbank')?.g,meta=dock?.userData.sceneryArt;
 if(!dock||meta?.kind!=='dock'||!Array.isArray(trees)||trees.length>8192||!Array.isArray(rocks)||rocks.length>256||!Array.isArray(W.colliders)||!Array.isArray(W.forestPoints)||typeof G.followCam?.invalidateTrees!=='function'||typeof W.solidWorld?.hasParts!=='function'||typeof W.solidWorld?.hasSurface!=='function')throw Error('Missing exact ferry source ownership');
 const corridors=maximumFerryLandingCorridors({dock:{x:dock.position.x,z:dock.position.z,yaw:dock.rotation.y,width:meta.width,length:meta.length}}),zeroRow=zero?.elements;
 if(!zeroRow||zeroRow.length!==16||zeroRow.some((v,i)=>v!==(i===15?1:0)))throw Error('Expected original zero source matrix');
 const plans=[],protectedOwners=[],seenC=new Set(),seenP=new Set(),seenRows=new Set(),seenRoots=new Set();
 const unsupported=(mesh)=>!mesh||W.solidWorld.hasParts(mesh)||W.solidWorld.hasSurface(mesh)||(mesh.userData.solidParts?.length||0)>0;
 const bankRow=(mesh,index)=>{if(!mesh?.isInstancedMesh||!(mesh.instanceMatrix?.array instanceof Float32Array)||mesh.instanceMatrix.itemSize!==16||!Number.isInteger(index)||index<0||index>=mesh.instanceMatrix.count||unsupported(mesh))throw Error('Unregistered exact renderer row required');const key=mesh.uuid+':'+index;if(seenRows.has(key))throw Error('Shared ferry renderer row');seenRows.add(key);return{mesh,index};};
 const physics=(c,p)=>{if(!unique(W.colliders,c)||seenC.has(c)||p&&(!unique(W.forestPoints,p)||seenP.has(p)))throw Error('Missing/shared ferry physical owner');seenC.add(c);if(p)seenP.add(p);};
 for(const t of trees){
  const o=t.floraOwner,p=t.seedOwner,c=o?.collider??p?.col;if(!c||!ferryLandingReserved(corridors,c.x,c.z,c.r))continue;
  if(t.root||t.authoredOrchard||t.authoredVillage||t.authoredWoodlandEdge||t.pastoralGrove||c.precise||c.trunk||t.retiredFerryLanding){protectedOwners.push({kind:'tree',x:c.x,z:c.z,reason:'fixed/upgraded/already-retired source'});continue;}
  if(!ordinary(c,['x','z','r','height']))throw Error('Foreign ferry tree circle');
  let point,rows;
  if(o){if(!unique(F?.treeOwners||[],o)||trees.filter(v=>v.floraOwner===o).length!==1||t.kind!==o.kind||t.x!==Math.fround(o.x)||t.z!==Math.fround(o.z)||c.x!==o.x||c.z!==o.z||c.r!==Math.max(.55,o.height*.055)||c.height!==o.height||o.canopy!==F.bank?.[o.kind]?.im||o.trunk!==F.bank?.trunk?.im||t.stem!==o.trunk||t.leaves!==o.canopy||t.stemIndex!==o.trunkIndex||t.index!==o.canopyIndex)throw Error('Unmatched flora ferry owner');point=o.forestPoint;if(!point||point.x!==o.x||point.z!==o.z||point.s!==o.height/8)throw Error('Unmatched flora ferry camera point');rows=[bankRow(o.canopy,o.canopyIndex),bankRow(o.trunk,o.trunkIndex)];}
  else{const heights={oak:6.2,birch:6.6,blossom:6.2,pine:7.4,snowpine:7.2};if(!p||trees.filter(v=>v.seedOwner===p).length!==1||!Object.hasOwn(heights,t.kind)||c.x!==p.x||c.z!==p.z||c.r!==.8||c.height!==p.s*heights[t.kind]||t.x!==p.x||t.z!==p.z||t.stem?.userData.treePoints!==t.leaves?.userData.treePoints||t.stem.userData.treePoints[t.index]!==p)throw Error('Unmatched seed ferry owner');point=p;rows=[bankRow(t.stem,t.index),bankRow(t.leaves,t.index)];}
  physics(c,point);plans.push({kind:'tree',t,c,point,rows});
 }
 for(const root of rocks){const p=root?.userData.scanPlacement,c=p?.col;if(!c||!ferryLandingReserved(corridors,c.x,c.z,c.r))continue;
  if(!ordinary(c,['x','z','r','precise'])||c.x!==p.x||c.z!==p.z||c.r!==.9*p.s||root.parent!==G.scene||root.position.x!==p.x||root.position.z!==p.z||seenRoots.has(root))throw Error('Unmatched ordinary ferry rock owner');seenRoots.add(root);physics(c,null);
  if(c.precise||unsupported(root)){protectedOwners.push({kind:'rock',x:c.x,z:c.z,reason:c.precise?'precise/upgraded circle':'registered body or authored parts'});continue;}
  plans.push({kind:'rock',root,c});}
 if(floor){if(!Array.isArray(floor.logs)||floor.logs.length>64||!Array.isArray(floor.banks)||!Array.isArray(floor.members))throw Error('Malformed original forest floor');for(const t of floor.logs){const c=t.collider;if(!c||!ferryLandingReserved(corridors,c.x,c.z,c.r))continue;const bank=floor.banks.filter(b=>Array.isArray(b.records)&&b.records.includes(t));if(t.role!=='log'||c.x!==t.x||c.z!==t.z||c.r!==1.25||!ordinary(c,['x','z','r','precise'])||!unique(floor.logs,t)||!unique(floor.members,t)||bank.length!==1||!unique(bank[0].records,t))throw Error('Unmatched forest log ferry owner');const b=bank[0],mesh=b.mesh,a=mesh?.instanceMatrix;
  if(!mesh?.isInstancedMesh||!(a?.array instanceof Float32Array)||a.itemSize!==16||!Number.isInteger(mesh.count)||mesh.count<0||mesh.count>a.count||b.records.length>a.count||floor.banks.filter(v=>v.mesh===mesh).length!==1)throw Error('Malformed/shared forest log renderer');physics(c,null);
  if(c.precise||unsupported(mesh)||b.records.length!==1||mesh.count!==1){protectedOwners.push({kind:'log',x:c.x,z:c.z,reason:c.precise?'precise/upgraded circle':unsupported(mesh)?'registered body or authored parts':'batched or differently submitted source bank'});continue;}
  const row=bankRow(mesh,0);plans.push({kind:'log',t,c,rows:[row],root:mesh});}}
 // All requested source pairs are authenticated before any source or physics write.
 const retired=[];for(const p of plans){if(p.rows)for(const {mesh,index}of p.rows){const a=mesh.instanceMatrix.array,k=index*16;a.fill(0,k,k+16);a[k+15]=1;mesh.instanceMatrix.needsUpdate=true;}if(p.root)p.root.visible=false;if(p.kind==='log')p.root.count=0;if(p.t)p.t.retiredFerryLanding=FERRY_LANDING_RESERVATION;W.colliders.splice(W.colliders.indexOf(p.c),1);if(p.point)W.forestPoints.splice(W.forestPoints.indexOf(p.point),1);retired.push({kind:p.kind,x:p.c.x,z:p.c.z,r:p.c.r});}
 if(plans.length)G.followCam.invalidateTrees();
 return{profile:FERRY_LANDING_RESERVATION,status:'applied',corridors,retired,protectedOwners,removedCircles:plans.length,removedForestPoints:plans.filter(p=>p.point).length,newResources:0,sourceRowsAndCapacitiesPreserved:true,plannerChecksChanged:false};
}
