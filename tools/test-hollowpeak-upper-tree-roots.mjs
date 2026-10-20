import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {planUpperHollowpeakTreeRoots,retireUpperHollowpeakTrees,HOLLOWPEAK_UPPER_TREE_PROFILE} from '../assets/hollowpeak-upper-tree-roots.mjs';
const root=process.env.HOLLOWPEAK_UPPER_TREE_SOURCE_ROOT||new URL('../',import.meta.url).pathname;
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js'))),{activeWorldTree}=await import(pathToFileURL(path.join(root,'assets/countryside-vista-owners.mjs')));
const meta=JSON.parse(fs.readFileSync(new URL('./fixtures/hollowpeak-upper-roots-v6/actual-trees.json',import.meta.url))),sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const sources={};
for(const s of meta.sources){
 const file=s.key==='mature-pine'?'pine_tree_01.glb':'fir_sapling_medium.glb',variant=s.key==='mature-pine'?0:Number(s.key.slice(-1)),buffer=fs.readFileSync(path.join(root,'assets/models/world/realism',file)),length=buffer.readUInt32LE(12),gltf=JSON.parse(buffer.subarray(20,20+length)),bin=20+length+8,node=gltf.nodes[gltf.scenes[gltf.scene??0].nodes[variant]],parts=[];
 assert.ok(!node.matrix&&!node.rotation&&!node.scale,'Resident collection rotation/scale is identity after gallery translation removal');
 for(const [k,p] of gltf.meshes[node.mesh].primitives.entries()){
  const a=gltf.accessors[p.attributes.POSITION],v=gltf.bufferViews[a.bufferView],start=bin+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12,array=new Float32Array(a.count*3);assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
  for(let i=0;i<a.count;i++)for(let j=0;j<3;j++)array[i*3+j]=buffer.readFloatLE(start+i*stride+j*4);
  assert.equal(sha(array),s.parts[k].positionSHA256,'Exact resident native source '+s.key+' part '+k);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(array,3));geo.computeBoundingBox();parts.push({name:s.parts[k].name,mat:{name:gltf.materials[p.material].name},geo,bounds:geo.boundingBox});
 }
 sources[s.key]={key:s.key,parts};
}
const tile=meta.terrain,step=tile.step;
function heightAt(x,z){const gx=(x-tile.origin)/step-tile.ix0,gz=(z-tile.origin)/step-tile.iz0,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*tile.nx+ix;assert.ok(ix>=0&&iz>=0&&ix<tile.nx-1&&iz<tile.nz-1,'Actual native physical terrain footprint');const a=tile.heights[i],b=tile.heights[i+tile.nx],c=tile.heights[i+tile.nx+1],d=tile.heights[i+1];return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);}
const makeTrees=()=>meta.rows.map(r=>({...r,source:sources[r.source],matrix:new T.Matrix4().fromArray(r.matrix),floraOwner:undefined}));
const sourceHashes=()=>Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,s.parts.map(p=>sha(p.geo.attributes.position.array))]));
function footGaps(tree,packed=false){const e=packed?tree.matrix.elements.map(Math.fround):tree.matrix.elements,parts=tree.source.parts.filter(p=>!/leaves|twig|fruit/i.test(p.mat.name));let low=Infinity;for(const p of parts){const a=p.geo.attributes.position;for(let i=0;i<a.count;i++)low=Math.min(low,a.getY(i)*e[5]+e[13]);}const gaps=[];for(const p of parts){const a=p.geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),wy=y*e[5]+e[13];if(wy<=low+.2200001)gaps.push(wy-heightAt(x*e[0]+z*e[8]+e[12],x*e[2]+z*e[10]+e[14]));}}return gaps;}

test('actual native wood feet distinguish six bounded fits, five unsuitable placements and five untouched owners',()=>{
 const trees=makeTrees(),before=sourceHashes(),original=Math.random;let plans;
 try{Math.random=()=>{throw Error('Ambient RNG consumed');};plans=trees.map(t=>planUpperHollowpeakTreeRoots(t,heightAt,{terrainStep:step}));}finally{Math.random=original;}
 assert.deepEqual(plans.filter(Boolean).filter(p=>p.action==='fit').map(p=>p.originalMatrix[12]),trees.filter(t=>[2390,2485,2486,2489,2490,2495].includes(t.id)).map(t=>t.x));
 assert.deepEqual(trees.filter((t,i)=>plans[i]?.action==='retire').map(t=>t.id),[2389,2399,2439,2487,2488]);
 assert.deepEqual(trees.filter((t,i)=>!plans[i]).map(t=>t.id),[47,2411,2493,2494,2496]);
 for(let i=0;i<trees.length;i++)assert.deepEqual(trees[i].matrix.elements,meta.rows[i].matrix,'Pure plan leaves shared transform intact');assert.deepEqual(sourceHashes(),before);
 const shortSinkDeepBurial=plans[trees.findIndex(t=>t.id===2488)];assert.ok(shortSinkDeepBurial.sinkM<1&&shortSinkDeepBurial.maximumBurialM>2.4);assert.match(shortSinkDeepBurial.reason,/uphill source wood/);
});

test('fitted shared transforms retain source XZ/yaw/scale and physical contact after Float32 instance packing',()=>{
 const trees=makeTrees(),hashes=sourceHashes();let fitted=0;
 for(const t of trees){const p=planUpperHollowpeakTreeRoots(t,heightAt,{terrainStep:step});if(p?.action!=='fit')continue;const before=t.matrix.elements.slice();t.matrix.elements[13]=p.fittedY;
  for(let i=0;i<16;i++)if(i!==13)assert.equal(t.matrix.elements[i],before[i]);const gaps=footGaps(t),packed=footGaps(t,true);assert.ok(Math.max(...gaps)<=-.0250199);assert.ok(Math.max(...packed)<=-.025);assert.ok(Math.min(...packed)>=-1);
  const geometry=t.source.parts[0].geo,material=new T.MeshBasicMaterial(),full=new T.InstancedMesh(geometry,material,1),card=new T.InstancedMesh(geometry,material,1);full.setMatrixAt(0,t.matrix);card.setMatrixAt(0,t.matrix);assert.deepEqual(full.instanceMatrix.array,card.instanceMatrix.array);assert.equal(full.instanceMatrix.array[13],Math.fround(p.fittedY));full.dispose();card.dispose();material.dispose();fitted++;
 }assert.equal(fitted,6);assert.deepEqual(sourceHashes(),hashes);
});

function ownedWorld(){
 const trees=makeTrees(),geometry=new T.BoxGeometry(1,1,1),material=new T.MeshBasicMaterial(),canopy=new T.InstancedMesh(geometry,material,680),trunk=new T.InstancedMesh(geometry,material,2750),zero=new T.Matrix4().makeScale(0,0,0),W={colliders:[],forestPoints:[]},F={treeOwners:[],bank:{cold:{im:canopy,n:680},trunk:{im:trunk,n:2750}}};
 for(const t of trees){const original=meta.rows.find(r=>r.id===t.id);if(original.owner){const o={...original.owner,canopy,trunk,collider:{...original.owner.collider},forestPoint:{...original.owner.forestPoint}};t.floraOwner=o;t.stem=trunk;t.leaves=canopy;t.stemIndex=o.trunkIndex;t.index=o.canopyIndex;F.treeOwners.push(o);W.colliders.push(o.collider);W.forestPoints.push(o.forestPoint);canopy.setMatrixAt(o.canopyIndex,t.matrix);trunk.setMatrixAt(o.trunkIndex,t.matrix);}const p=planUpperHollowpeakTreeRoots(t,heightAt,{terrainStep:step});if(p)t.upperHollowpeakRootPlan=p;}
 const unrelatedCircle={x:-190,z:-350,r:.6,height:8},unrelatedPoint={x:-190,z:-350,s:1};W.colliders.push(unrelatedCircle);W.forestPoints.push(unrelatedPoint);
 return{G:{world:W,floraPkg:F},trees,zero,canopy,trunk,unrelatedCircle,unrelatedPoint,dispose(){canopy.dispose();trunk.dispose();geometry.dispose();material.dispose();}};
}

test('late retirement removes only complete source-owned pairs and every tier recognizes the existing active flag',()=>{
 const c=ownedWorld(),beforeC=c.G.world.colliders.slice(),beforeF=c.G.world.forestPoints.slice(),beforeCanopy=c.canopy.instanceMatrix.array.slice(),beforeTrunk=c.trunk.instanceMatrix.array.slice(),hashes=sourceHashes(),random=Math.random;let stats;
 try{Math.random=()=>{throw Error('Retirement consumed RNG');};stats=retireUpperHollowpeakTrees(c.G,c.trees,c.zero);}finally{Math.random=random;}
 assert.equal(stats.blocked.length,0);assert.equal(stats.retired.length,5);assert.equal(stats.removedCircles,5);assert.equal(stats.removedForestPoints,5);assert.equal(stats.newResources,0);
 const retired=c.trees.filter(t=>t.retiredUpperHollowpeak===HOLLOWPEAK_UPPER_TREE_PROFILE);assert.equal(retired.length,5);for(const t of retired){assert.equal(activeWorldTree(t),false);assert.ok(!c.G.world.colliders.includes(t.floraOwner.collider)&&!c.G.world.forestPoints.includes(t.floraOwner.forestPoint));}
 assert.equal(c.canopy.instanceMatrix.count,680);assert.equal(c.trunk.instanceMatrix.count,2750);const zero=c.zero.toArray(),retiredCanopy=new Set(retired.map(t=>t.index)),retiredTrunk=new Set(retired.map(t=>t.stemIndex));
 for(let i=0;i<680;i++)assert.deepEqual(Array.from(c.canopy.instanceMatrix.array.subarray(i*16,i*16+16)),retiredCanopy.has(i)?zero:Array.from(beforeCanopy.subarray(i*16,i*16+16)));
 for(let i=0;i<2750;i++)assert.deepEqual(Array.from(c.trunk.instanceMatrix.array.subarray(i*16,i*16+16)),retiredTrunk.has(i)?zero:Array.from(beforeTrunk.subarray(i*16,i*16+16)));
 assert.deepEqual(c.G.world.colliders,beforeC.filter(v=>!retired.some(t=>t.floraOwner.collider===v)));assert.deepEqual(c.G.world.forestPoints,beforeF.filter(v=>!retired.some(t=>t.floraOwner.forestPoint===v)));assert.ok(c.G.world.colliders.includes(c.unrelatedCircle)&&c.G.world.forestPoints.includes(c.unrelatedPoint));
 assert.ok(c.trees.find(t=>t.id===47)&&activeWorldTree(c.trees.find(t=>t.id===47)));assert.deepEqual(sourceHashes(),hashes);assert.equal(retireUpperHollowpeakTrees(c.G,c.trees,c.zero).retired.length,0);c.dispose();
});

test('missing, shared or tagged physical ownership blocks the entire retirement before mutation',()=>{
 for(const failure of['tagged','missing','shared']){const c=ownedWorld(),victim=c.trees.find(t=>t.id===2389),circle=victim.floraOwner.collider;
  if(failure==='tagged')circle.precise=true;else if(failure==='missing')c.G.world.colliders.splice(c.G.world.colliders.indexOf(circle),1);else c.G.world.colliders.push(circle);
  const matrix=c.canopy.instanceMatrix.array.slice(),trunk=c.trunk.instanceMatrix.array.slice(),colliders=c.G.world.colliders.slice(),points=c.G.world.forestPoints.slice(),stats=retireUpperHollowpeakTrees(c.G,c.trees,c.zero);
  assert.ok(stats.blocked.length>0);assert.equal(stats.retired.length,0);assert.deepEqual(c.canopy.instanceMatrix.array,matrix);assert.deepEqual(c.trunk.instanceMatrix.array,trunk);assert.deepEqual(c.G.world.colliders,colliders);assert.deepEqual(c.G.world.forestPoints,points);assert.ok(c.trees.every(activeWorldTree));c.dispose();
 }
});
