// Original authored eastward glade vista onto the existing Barleyfold buildings.
// These are complete ordinary flora owners, never a density resample or new route.
export const COUNTRYSIDE_VISTA_PROFILE='barleyfold-glade-vista-1';
export const COUNTRYSIDE_VISTA_OWNERS=Object.freeze([
 [1368,158.32872009277344,-140.91221618652344,'mature-leaf-broadleaf'],
 [1370,164.41490173339844,-138.62144470214844,'mature-leaf-broadleaf'],
 [1372,153.454833984375,-135.97653198242188,'canopy-broadleaf'],
 [1374,157.38206481933594,-144.8621368408203,'mature-leaf-broadleaf'],
 [1379,161.9994659423828,-134.9749298095703,'broadleaf'],
 [1383,157.77740478515625,-148.09954833984375,'mature-leaf-broadleaf'],
 [1973,156.82107543945312,-135.1766815185547,'canopy-broadleaf'],
].map(([id,x,z,source])=>Object.freeze({id,x,z,source})));
export const activeWorldTree=t=>!t.retiredFallsFlora&&!t.retiredCountrysideVista;
const allowedCircleKeys=new Set(['x','z','r','height']);
const row=(mesh,index)=>Array.from(mesh.instanceMatrix.array.subarray(index*16,index*16+16));
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
// Pure validation: all seven exact owners or no change. The actual source-owner
// references, not a nearby coordinate match, establish physics responsibility.
export function planCountrysideVista(G,trees,zero){
 const W=G.world,F=G.floraPkg,fail=reason=>({ok:false,reason,matches:[]});
 if(!Array.isArray(trees)||!Array.isArray(F?.treeOwners)||!Array.isArray(W?.colliders)||!Array.isArray(W?.forestPoints)||typeof G.followCam?.invalidateTrees!=='function'||!zero?.elements?.every(Number.isFinite))return fail('Missing complete world ownership');
 const zeroRow=zero.toArray(),matches=[];
 if(zeroRow.length!==16||!zeroRow.every((v,i)=>v===(i===15?1:0)))return fail('Unexpected hidden source matrix');
 for(const spec of COUNTRYSIDE_VISTA_OWNERS){
  const candidates=trees.filter(t=>t.x===spec.x&&t.z===spec.z);
  if(candidates.length!==1||trees[spec.id]!==candidates[0])return fail('Unknown, duplicate or reordered scan owner '+spec.id);
  const t=candidates[0],o=t.floraOwner;
  if(!o||F.treeOwners.filter(v=>v===o).length!==1||trees.filter(v=>v.floraOwner===o).length!==1)return fail('Missing or shared flora owner '+spec.id);
  const canopy=F.bank?.[o.kind],trunk=F.bank?.trunk,c=o.collider,p=o.forestPoint;
  if(!['oak','birch','blossom'].includes(o.kind)||t.kind!==o.kind||t.source?.key!==spec.source||t.pastoralGrove||t.authoredWoodlandEdge||t.authoredOrchard||t.authoredVillage||t.retiredFallsFlora)return fail('Unexpected tree role '+spec.id);
  if(Math.fround(o.x)!==t.x||Math.fround(o.z)!==t.z||!Number.isFinite(o.height)||o.height<=3||!c||!p||c.x!==o.x||c.z!==o.z||c.r!==Math.max(.55,o.height*.055)||c.height!==o.height||Object.keys(c).some(k=>!allowedCircleKeys.has(k))||p.x!==o.x||p.z!==o.z||p.s!==o.height/8)return fail('Unowned or registered wood physics '+spec.id);
  if(t.stem!==o.trunk||t.leaves!==o.canopy||t.stemIndex!==o.trunkIndex||t.index!==o.canopyIndex||canopy?.im!==o.canopy||trunk?.im!==o.trunk||!o.canopy?.isInstancedMesh||!o.trunk?.isInstancedMesh||!Number.isInteger(o.canopyIndex)||!Number.isInteger(o.trunkIndex)||o.canopyIndex<0||o.canopyIndex>=canopy.n||o.trunkIndex<0||o.trunkIndex>=trunk.n)return fail('Unmatched paired renderer '+spec.id);
  const retired=t.retiredCountrysideVista===COUNTRYSIDE_VISTA_PROFILE;
  if(t.retiredCountrysideVista&&!retired)return fail('Foreign retirement '+spec.id);
  if(retired){
   if(!o.countrysideVistaRetired||W.colliders.includes(c)||W.forestPoints.includes(p)||!equal(row(o.canopy,o.canopyIndex),zeroRow)||!equal(row(o.trunk,o.trunkIndex),zeroRow))return fail('Incomplete previous retirement '+spec.id);
  }else if(o.countrysideVistaRetired||W.colliders.filter(v=>v===c).length!==1||W.forestPoints.filter(v=>v===p).length!==1)return fail('Missing or duplicate physical owner '+spec.id);
  if(matches.some(m=>m.c===c||m.p===p||(m.o.canopy===o.canopy&&m.o.canopyIndex===o.canopyIndex)||(m.o.trunk===o.trunk&&m.o.trunkIndex===o.trunkIndex)))return fail('Shared paired owner or physics '+spec.id);
  matches.push({spec,t,o,c,p,retired});
 }
 const count=matches.filter(m=>m.retired).length;
 if(count!==0&&count!==matches.length)return fail('Partial earlier retirement');
 return{ok:true,alreadyApplied:count===matches.length,matches};
}
export function retireCountrysideVistaTrees(G,trees,zero){
 const plan=planCountrysideVista(G,trees,zero);
 if(!plan.ok)return{profile:COUNTRYSIDE_VISTA_PROFILE,status:'blocked',reason:plan.reason,retired:[],count:0};
 if(plan.alreadyApplied)return{profile:COUNTRYSIDE_VISTA_PROFILE,status:'already-applied',count:7,retired:plan.matches.map(m=>({id:m.spec.id,x:m.t.x,z:m.t.z,source:m.t.source.key}))};
 const W=G.world,retired=plan.matches.map(({spec,t,o,c,p})=>({id:spec.id,x:t.x,z:t.z,source:t.source.key,kind:o.kind,height:o.height,originalCollider:{...c},originalForestPoint:{...p},canopyRow:o.canopyIndex,trunkRow:o.trunkIndex,canopyCapacity:o.canopy.instanceMatrix.count,trunkCapacity:o.trunk.instanceMatrix.count}));
 // Nothing above mutates. All ownership gates have passed before the first write.
 for(const {t,o,c,p} of plan.matches){
  o.canopy.setMatrixAt(o.canopyIndex,zero);o.trunk.setMatrixAt(o.trunkIndex,zero);
  o.canopy.instanceMatrix.needsUpdate=o.trunk.instanceMatrix.needsUpdate=true;
  W.colliders.splice(W.colliders.indexOf(c),1);W.forestPoints.splice(W.forestPoints.indexOf(p),1);
  t.retiredCountrysideVista=COUNTRYSIDE_VISTA_PROFILE;o.countrysideVistaRetired=true;
 }
 G.followCam.invalidateTrees();
 return{profile:COUNTRYSIDE_VISTA_PROFILE,status:'applied',count:retired.length,retired,removedCircles:7,removedForestPoints:7,removedSolidParts:0,newResources:0,terrainOrRouteChanges:0};
}
