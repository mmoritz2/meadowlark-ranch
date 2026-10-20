import {HOLLOWPEAK_UPPER_BOUNDS} from './hollowpeak-upper-ridges.mjs?v=hollowpeak-upper-ridges-3';
export const HOLLOWPEAK_UPPER_TREE_PROFILE='hollowpeak-upper-source-roots-1';
const BAND=.22,EXPOSED=.25,EMBED=.02502,MAXIMUM=1;
const ordinaryKeys=new Set(['x','z','r','height']);
const wood=p=>!/leaves|twig|fruit/i.test(p.mat?.name||p.name||'');
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
// All incident triangles of permitted canonical vertices, not an analytic
// point rectangle. Feet crossing the final cell must use the same policy.
function physicalEnvelope(bounds,step){
 const first=v=>Math.floor((v+500)/step)+1,last=v=>Math.ceil((v+500)/step)-1;
 return{x0:(first(bounds.x0)-1)*step-500,x1:(last(bounds.x1)+1)*step-500,z0:(first(bounds.z0)-1)*step-500,z1:(last(bounds.z1)+1)*step-500};
}
const overlaps=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;

// Boot-only, pure source-foot measurement. The caller applies a fit before
// card/full/medium/shadow/contact construction; this function mutates nothing.
export function planUpperHollowpeakTreeRoots(tree,heightAt,{terrainStep=1000/512,bounds=HOLLOWPEAK_UPPER_BOUNDS}={}){
 if(typeof heightAt!=='function'||!Number.isFinite(terrainStep)||terrainStep<=0)throw Error('Invalid upper Hollowpeak physical support');
 if(!/^(mature-pine|pine-[012])$/.test(tree?.source?.key||'')||tree.authoredVillage||tree.authoredOrchard||tree.authoredWoodlandEdge||tree.pastoralGrove)return null;
 const e=tree.matrix?.elements,parts=tree.source.parts.filter(wood),envelope=physicalEnvelope(bounds,terrainStep);
 if(!e||e.length!==16||!e.every(Number.isFinite)||e[1]!==0||e[4]!==0||e[6]!==0||e[9]!==0||!(e[5]>0))throw Error('Upper Hollowpeak roots require the shared upright source matrix');
 // Source wood bounds can conservatively reject distant trees before reading
 // their vertices. Missing resident bounds use the exact foot path below.
 if(parts.length&&parts.every(p=>p.bounds)){
  const b={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};
  for(const p of parts)for(const x of[p.bounds.min.x,p.bounds.max.x])for(const z of[p.bounds.min.z,p.bounds.max.z]){const wx=x*e[0]+z*e[8]+e[12],wz=x*e[2]+z*e[10]+e[14];b.x0=Math.min(b.x0,wx);b.x1=Math.max(b.x1,wx);b.z0=Math.min(b.z0,wz);b.z1=Math.max(b.z1,wz);}
  if(!overlaps(b,envelope))return null;
 }
 let low=Infinity;
 for(const p of parts){const a=p.geo.attributes.position;for(let i=0;i<a.count;i++)low=Math.min(low,a.getY(i)*e[5]+e[13]);}
 if(!Number.isFinite(low))return null;
 const b={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};let minimum=Infinity,maximum=-Infinity,samples=0,worst=null;
 for(const p of parts){const a=p.geo.attributes.position;for(let i=0;i<a.count;i++){
  const sy=a.getY(i),y=sy*e[5]+e[13];if(y>low+BAND+1e-7)continue;
  const sx=a.getX(i),sz=a.getZ(i),x=sx*e[0]+sz*e[8]+e[12],z=sx*e[2]+sz*e[10]+e[14],ground=heightAt(x,z),gap=y-ground;
  if(!Number.isFinite(gap))throw Error('Nonfinite actual upper Hollowpeak wood-foot support');
  b.x0=Math.min(b.x0,x);b.x1=Math.max(b.x1,x);b.z0=Math.min(b.z0,z);b.z1=Math.max(b.z1,z);samples++;minimum=Math.min(minimum,gap);
  if(gap>maximum){maximum=gap;worst={part:p.name,index:i,point:[x,y,z],ground};}
 }}
 if(!overlaps(b,envelope)||maximum<=EXPOSED)return null;
 const sinkM=maximum+EMBED,maximumBurialM=maximum-minimum+EMBED;
 // The existing one-metre seating bound applies to both sides of the real
 // root foot. A short permitted translation must not bury uphill wood by 2m.
 const action=sinkM<=MAXIMUM&&maximumBurialM<=MAXIMUM?'fit':'retire';
 return{profile:HOLLOWPEAK_UPPER_TREE_PROFILE,action,reason:action==='fit'?'exposed source foot fits both sides of the one-metre root bound':sinkM>MAXIMUM?'source foot needs more than one metre downward seating':'seating would bury uphill source wood deeper than one metre',source:tree.source.key,bandM:BAND,samples,footBounds:b,physicalEnvelope:envelope,maxBeforeM:maximum,minBeforeM:minimum,footGapSpreadM:maximum-minimum,sinkM,maximumBurialM,maximumAllowedM:MAXIMUM,originalY:e[13],fittedY:e[13]-sinkM,originalMatrix:Array.from(e),worst};
}

// Late exact-owner retirement preserves every original draw, site, source row
// and bank capacity. The existing activeWorldTree flag omits all scan tiers.
export function retireUpperHollowpeakTrees(G,trees,zero){
 const W=G.world,F=G.floraPkg,plans=[],blocked=[],retired=[];
 const stats={profile:HOLLOWPEAK_UPPER_TREE_PROFILE,retired,blocked,removedCircles:0,removedForestPoints:0,newResources:0,terrainOrRouteChanges:0};
 const candidates=trees.filter(t=>t.upperHollowpeakRootPlan?.action==='retire'&&!t.retiredUpperHollowpeak);
 if(!candidates.length)return stats;
 if(!Array.isArray(F?.treeOwners)||!Array.isArray(W?.colliders)||!Array.isArray(W?.forestPoints)||!zero?.toArray)throw Error('Missing upper Hollowpeak source ownership');
 const zeroRow=zero.toArray();if(zeroRow.length!==16||zeroRow.some((v,i)=>v!==(i===15?1:0)))throw Error('Unexpected upper Hollowpeak retired source matrix');
 for(const t of candidates){
  const p=t.upperHollowpeakRootPlan,o=t.floraOwner,c=o?.collider,f=o?.forestPoint,canopy=F.bank?.[o?.kind],trunk=F.bank?.trunk;
  const owned=p.profile===HOLLOWPEAK_UPPER_TREE_PROFILE&&equal(Array.from(t.matrix.elements),p.originalMatrix)
   &&!t.retiredFallsFlora&&!t.retiredCountrysideVista&&!t.root&&!t.authoredVillage&&!t.authoredOrchard&&!t.authoredWoodlandEdge&&!t.pastoralGrove
   &&/^(mature-pine|pine-[012])$/.test(t.source?.key||'')&&t.source.key===p.source&&o&&['cold','pine'].includes(o.kind)&&t.kind===o.kind
   &&F.treeOwners.filter(v=>v===o).length===1&&trees.filter(v=>v.floraOwner===o).length===1
   &&t.x===Math.fround(o.x)&&t.z===Math.fround(o.z)&&Number.isFinite(o.height)&&o.height>3
   &&canopy?.im===o.canopy&&trunk?.im===o.trunk&&o.canopy?.isInstancedMesh&&o.trunk?.isInstancedMesh
   &&t.stem===o.trunk&&t.leaves===o.canopy&&t.stemIndex===o.trunkIndex&&t.index===o.canopyIndex
   &&Number.isInteger(o.canopyIndex)&&Number.isInteger(o.trunkIndex)&&o.canopyIndex>=0&&o.canopyIndex<canopy.n&&o.trunkIndex>=0&&o.trunkIndex<trunk.n
   &&c&&f&&W.colliders.filter(v=>v===c).length===1&&W.forestPoints.filter(v=>v===f).length===1
   &&c.x===o.x&&c.z===o.z&&c.r===Math.max(.55,o.height*.055)&&c.height===o.height&&Object.keys(c).every(k=>ordinaryKeys.has(k))
   &&f.x===o.x&&f.z===o.z&&f.s===o.height/8;
  if(!owned){blocked.push({x:t.x,z:t.z,source:t.source?.key,reason:'missing unique original paired renderer and physical owner',plan:p});continue;}
  if(plans.some(v=>v.o===o||v.c===c||v.f===f)){blocked.push({x:t.x,z:t.z,reason:'shared upper Hollowpeak retirement owner'});continue;}
  plans.push({t,o,c,f,p});
 }
 // Validate the entire requested retirement before the first owner mutation.
 if(blocked.length)return stats;
 const row=(m,i)=>Array.from(m.instanceMatrix.array.subarray(i*16,i*16+16));
 for(const {t,o,c,f,p} of plans){
  retired.push({x:t.x,z:t.z,source:t.source.key,kind:o.kind,height:t.height,plan:p,canopyRow:o.canopyIndex,trunkRow:o.trunkIndex,canopyCapacity:o.canopy.instanceMatrix.count,trunkCapacity:o.trunk.instanceMatrix.count,originalCanopyMatrix:row(o.canopy,o.canopyIndex),originalTrunkMatrix:row(o.trunk,o.trunkIndex),collider:{...c},forestPoint:{...f}});
  o.canopy.setMatrixAt(o.canopyIndex,zero);o.trunk.setMatrixAt(o.trunkIndex,zero);o.canopy.instanceMatrix.needsUpdate=o.trunk.instanceMatrix.needsUpdate=true;
  W.colliders.splice(W.colliders.indexOf(c),1);W.forestPoints.splice(W.forestPoints.indexOf(f),1);
  t.retiredFallsFlora=true;t.retiredUpperHollowpeak=HOLLOWPEAK_UPPER_TREE_PROFILE;
 }
 stats.removedCircles=stats.removedForestPoints=retired.length;return stats;
}
