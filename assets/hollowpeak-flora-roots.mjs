import {fallsRelief,fallsContainsWater} from './falls-landscape.js?v=hollowpeak-cascades-1';
const FRONT=Object.freeze({x0:-202,x1:-100,z0:-270,z1:-224});
const ordinaryKeys=['x','z','r','height'];
// Flora tree() supplies the exact renderer rows and original double-coordinate
// physics objects. No proximity search, inferred scan height or layout redraw.
export function retireSteepFallsFloraTrees(G,trees,zero){
 const W=G.world,F=G.floraPkg,retired=[],stats={examined:0,eligible:0,unowned:0,retired};
 if(!Array.isArray(F?.treeOwners)||!Array.isArray(W?.colliders)||!Array.isArray(W?.forestPoints)
  ||typeof W.terrainH!=='function'||typeof W.hollowpeakPlacement?.heightAt!=='function')return stats;
 const records=new Map();for(const t of trees||[])if(t.floraOwner){if(records.has(t.floraOwner))records.set(t.floraOwner,null);else records.set(t.floraOwner,t);}
 for(const o of F.treeOwners){
  if(!['pine','cold'].includes(o.kind))continue;stats.examined++;
  const {x,z,height}=o;
  if(!Number.isFinite(x+z+height)||height<=3||x<=FRONT.x0||x>=FRONT.x1||z<=FRONT.z0||z>=FRONT.z1)continue;
  if(fallsRelief(x,z)<=3||fallsContainsWater(x,z,2))continue;
  const h=W.terrainH,planned=W.hollowpeakPlacement.heightAt(x,z),ground=h(x,z),grade=Math.hypot(h(x+1,z)-h(x-1,z),h(x,z+1)-h(x,z-1))*.5;
  if(!Number.isFinite(planned+ground+grade)||Math.abs(ground-planned)<=1e-5||grade<=1.8+1e-6)continue;
  stats.eligible++;
  const t=records.get(o),canopy=F.bank?.[o.kind],trunk=F.bank?.trunk,c=o.collider,p=o.forestPoint;
  const colliderIndex=W.colliders.indexOf(c),forestIndex=W.forestPoints.indexOf(p);
  const owned=canopy&&trunk&&c&&p&&o.canopy?.isInstancedMesh&&o.trunk?.isInstancedMesh
   &&typeof zero?.toArray==='function'&&t&&!t.retiredFallsFlora
   &&/^(mature-pine|pine-[123])$/.test(t.source?.key||'')&&t.kind===o.kind&&t.stem===o.trunk&&t.leaves===o.canopy
   &&t.stemIndex===o.trunkIndex&&t.index===o.canopyIndex&&t.x===Math.fround(x)&&t.z===Math.fround(z)
   &&o.canopy===canopy?.im&&o.trunk===trunk?.im&&Number.isInteger(o.canopyIndex)&&Number.isInteger(o.trunkIndex)
   &&o.canopyIndex>=0&&o.canopyIndex<canopy.n&&o.trunkIndex>=0&&o.trunkIndex<trunk.n
   &&colliderIndex>=0&&forestIndex>=0&&c.x===x&&c.z===z&&c.r===Math.max(.55,height*.055)&&c.height===height
   &&Object.keys(c).every(k=>ordinaryKeys.includes(k))&&p.x===x&&p.z===z&&p.s===height/8;
  if(!owned){stats.unowned++;continue;}
  const row=(mesh,index)=>Array.from(mesh.instanceMatrix.array.subarray(index*16,index*16+16));
  const evidence={x,z,scanX:t.x,scanZ:t.z,kind:o.kind,height,grade,plannedHeight:planned,ground,
   canopyRow:o.canopyIndex,trunkRow:o.trunkIndex,canopyRows:canopy.n,trunkRows:trunk.n,
   canopyCapacity:o.canopy.instanceMatrix.count,trunkCapacity:o.trunk.instanceMatrix.count,
   originalCanopyMatrix:row(o.canopy,o.canopyIndex),originalTrunkMatrix:row(o.trunk,o.trunkIndex),
   collider:{...c},forestPoint:{...p},reason:'owned flora conifer on the changed bare steep falls front'};
  // Validation is complete before any owner changes. Original batches may be
  // fallback-visible, so explicitly suppress both paired rows as well as scans.
  o.canopy.setMatrixAt(o.canopyIndex,zero);o.trunk.setMatrixAt(o.trunkIndex,zero);
  o.canopy.instanceMatrix.needsUpdate=o.trunk.instanceMatrix.needsUpdate=true;
  W.colliders.splice(colliderIndex,1);W.forestPoints.splice(forestIndex,1);
  t.retiredFallsFlora=true;retired.push(evidence);
 }
 return stats;
}
