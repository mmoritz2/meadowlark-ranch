import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {loadCrownInputs} from './broadleaf-depth-test-fixture.mjs';
import {COUNTRYSIDE_VISTA_OWNERS as S,activeWorldTree,planCountrysideVista,retireCountrysideVistaTrees} from '../assets/countryside-vista-owners.mjs';
import {createMediumCanopyController} from '../assets/island-medium-canopy.mjs';
const raw=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8'),inputs=loadCrownInputs();
const prefix=raw.slice(raw.indexOf('function multiplyCrownMatrices('),raw.indexOf('export function installWorldPhotoscans(')).replaceAll('export ','');
const selector=new Function('activeWorldTree',prefix+';return selectMiddleCrownModels;')(activeWorldTree);
function fixture(){
 const trees=inputs.trees.map(t=>({...t,kind:'oak',matrix:new T.Matrix4().fromArray(t.matrix.elements),tint:new T.Color(1,1,1)}));
 const geo=new T.BoxGeometry(.1,.2,.1),mat=new T.MeshBasicMaterial(),canopy=new T.InstancedMesh(geo,mat,trees.length),trunk=new T.InstancedMesh(geo,mat,trees.length),owners=[],colliders=[],forestPoints=[];
 trees.forEach((t,i)=>{canopy.setMatrixAt(i,t.matrix);trunk.setMatrixAt(i,t.matrix);const c={x:t.x,z:t.z,r:Math.max(.55,t.height*.055),height:t.height},p={x:t.x,z:t.z,s:t.height/8},o={kind:'oak',x:t.x,z:t.z,height:t.height,canopy,canopyIndex:i,trunk,trunkIndex:i,collider:c,forestPoint:p};owners.push(o);colliders.push(c);forestPoints.push(p);Object.assign(t,{stem:trunk,stemIndex:i,leaves:canopy,index:i,floraOwner:o});});
 let invalidations=0;const G={THREE:T,world:{colliders,forestPoints},floraPkg:{treeOwners:owners,bank:{oak:{im:canopy,n:trees.length},trunk:{im:trunk,n:trees.length}}},followCam:{invalidateTrees(){invalidations++;}}};
 return{G,trees,canopy,trunk,zero:new T.Matrix4().makeScale(0,0,0),invalidations:()=>invalidations};
}
const snapshot=f=>({circles:f.G.world.colliders.slice(),forest:f.G.world.forestPoints.slice(),canopy:f.canopy.instanceMatrix.array.slice(),trunk:f.trunk.instanceMatrix.array.slice(),tree:JSON.stringify(f.trees.map(t=>({x:t.x,z:t.z,height:t.height,matrix:t.matrix.toArray(),source:t.source.key,tint:t.tint.toArray()})))});
function noRNG(fn){const previous=Math.random;Math.random=()=>{throw Error('Unexpected ambient RNG');};try{return fn();}finally{Math.random=previous;}}
test('all seven actual-roster sites retire atomically with exactly paired source/circle/forest owners; every other owner and row stays exact',()=>{
 const f=fixture(),old=snapshot(f),ids=new Set(S.map(s=>s.id)),uuids=[f.canopy.uuid,f.trunk.uuid,f.canopy.geometry.uuid,f.canopy.material.uuid];assert(planCountrysideVista(f.G,f.trees,f.zero).ok);
 const result=noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero));assert.equal(result.status,'applied');assert.equal(result.count,7);assert.equal(result.removedSolidParts,0);assert.equal(result.newResources,0);assert.equal(f.invalidations(),1);
 assert.deepEqual(f.G.world.colliders,old.circles.filter((_,i)=>!ids.has(i)));assert.deepEqual(f.G.world.forestPoints,old.forest.filter((_,i)=>!ids.has(i)));
 for(let i=0;i<f.trees.length;i++){assert.equal(activeWorldTree(f.trees[i]),!ids.has(i)&&!f.trees[i].retiredFallsFlora);for(const[mesh,before]of[[f.canopy,old.canopy],[f.trunk,old.trunk]])assert.deepEqual(Array.from(mesh.instanceMatrix.array.subarray(i*16,i*16+16)),ids.has(i)?f.zero.toArray():Array.from(before.subarray(i*16,i*16+16)));}
 assert.equal(snapshot(f).tree,old.tree);assert.deepEqual([f.canopy.uuid,f.trunk.uuid,f.canopy.geometry.uuid,f.canopy.material.uuid],uuids);
 const after=snapshot(f),again=noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero));assert.equal(again.status,'already-applied');assert.deepEqual(snapshot(f),after);assert.equal(f.invalidations(),1);
});
test('missing/duplicate/shared/foreign or registered owner causes zero writes, including the last target failure',()=>{
 const mutators=[f=>{f.trees[S.at(-1).id].floraOwner=null;},f=>{f.trees.push(f.trees[S.at(-1).id]);},f=>{f.trees[S.at(-1).id].floraOwner.collider.precise=true;},f=>{const a=f.trees[S[0].id].floraOwner,b=f.trees[S.at(-1).id].floraOwner;b.collider=a.collider;},f=>{f.trees[S.at(-1).id].retiredCountrysideVista='other';},f=>{f.G.world.forestPoints.splice(S.at(-1).id,1);},f=>{f.zero.identity();},f=>{f.trees[S[0].id].retiredCountrysideVista='barleyfold-glade-vista-1';}];
 for(const mutate of mutators){const f=fixture();mutate(f);const old=snapshot(f),flags=f.trees.map(t=>t.retiredCountrysideVista);const result=noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero));assert.equal(result.status,'blocked');assert.equal(result.count,0);assert.deepEqual(snapshot(f),old);assert.deepEqual(f.trees.map(t=>t.retiredCountrysideVista),flags);assert.equal(f.invalidations(),0);}
});
function updater(f,{xr=false,quality='low',far=false}={}){
 const a=raw.indexOf('  let previousSelection=new Set()'),b=raw.indexOf('  state.ready=(async()=>{',a),body=raw.slice(a,b),factory=new Function('THREE','H','G','state','trees','treeMeshes','treeCards','renderer','WHITE','selectMiddleCrownModels','activeWorldTree',body+';return{update:updateTrees,force(){previousMode=null;},selection:()=>[...previousSelection],near:()=>[...previousNearSelection],middle:()=>[...previousCrownSelection],planning:()=>[...previousMiddleSelection]};');
 const camera=new T.PerspectiveCamera(55,1.6,.1,1500);camera.position.set(far?0:155,8,far?0:-145);camera.lookAt(210,8,-118);camera.updateMatrixWorld();
 const H={player:{pos:new T.Vector3(far?0:155,0,far?0:-145),heading:1}},G={gfx:{get:()=>quality},camera},renderer={xr:{isPresenting:xr}},state={villageEvergreens:{triangles:406764}};
 const groups=[...new Set(f.trees.map(t=>t.source.key))].map(k=>f.trees.filter(t=>t.source.key===k));
 const mesh=()=>({count:0,geometry:{index:{count:6}},material:{name:'source_leaves'},matrices:[],colors:[],setMatrixAt(i,m){this.matrices[i]=m;},setColorAt(i,c){this.colors[i]=c;},instanceMatrix:{version:0,set needsUpdate(v){if(v)this.version++;}},instanceColor:{version:0,set needsUpdate(v){if(v)this.version++;}},computeBoundingSphere(){}});
 const models=groups.map(records=>{const m=mesh();m.geometry.index.count=records[0].source.triangles*3;return{records,mesh:m};}),cards=groups.map(records=>({records,mesh:mesh()})),api=factory(T,H,G,state,f.trees,models,cards,renderer,new T.Color(1,1,1),selector,activeWorldTree);
 return{api,models,cards,state,G,H,renderer,setMode(q,x){quality=q;renderer.xr.isPresenting=x;}};
}
test('raw current original updater repacks retired far rows on unchanged-camera Low and XR, while all full/card tiers remain a disjoint active partition',()=>{
 for(const mode of[{quality:'high'},{quality:'low',far:true},{quality:'low',xr:true}]){const f=fixture(),u=updater(f,mode);noRNG(()=>u.api.update());const before=new Set(u.api.selection());if(mode.far||mode.xr)assert(S.every(s=>!before.has(f.trees[s.id])));
  noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero));u.api.force();noRNG(()=>u.api.update());const set=new Set(u.api.selection());assert([...set].every(activeWorldTree));let count=set.size;
  for(const {records,mesh}of u.cards){const want=records.filter(t=>activeWorldTree(t)&&!set.has(t));assert.equal(mesh.count,want.length);for(let i=0;i<want.length;i++)assert.equal(mesh.matrices[i],want[i].matrix);count+=mesh.count;}
  assert.equal(count,f.trees.filter(activeWorldTree).length);assert(u.state.activeTreeTriangles<=u.state.treeTriangleBudget);assert.equal(u.state.distantTrees,f.trees.filter(activeWorldTree).length-set.size);
 }
});
function actualMediumParts(){
 const b=fs.readFileSync(new URL('../assets/models/world/realism/island_tree_01_medium.glb',import.meta.url)),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
 const read=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];assert(C&&n&&!v.byteStride&&!a.sparse);return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*n).slice();};
 const parts=j.meshes[0].primitives.map(p=>{const geo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(read(p.attributes.POSITION),3)).setIndex(new T.BufferAttribute(read(p.indices),1)),mat=new T.MeshStandardMaterial({name:j.materials[p.material].name});geo.computeBoundingBox();return{geo,mat,bounds:geo.boundingBox,name:mat.name};});assert.equal(parts.reduce((n,p)=>n+p.geo.index.count/3,0),8355);return parts;
}
test('actual 8355-triangle medium controller partitions active roster after original bank writes through High/Low/XR/High transitions',()=>{
 const f=fixture(),u=updater(f,{quality:'high'});u.api.update();const parts=actualMediumParts(),G={THREE:T,gfx:u.G.gfx,camera:u.G.camera,renderer:u.renderer,horse:{player:u.H.player},photoscans:u.state},group=new T.Group();
 const controller=createMediumCanopyController(G,{trees:f.trees,treeMeshes:u.models,treeCards:u.cards,group,originalSelection:()=>({selected:u.api.selection(),near:u.api.near(),middle:u.api.middle(),planningMiddle:u.api.planning()})},{parts,triangles:8355});controller.update();assert(controller.snapshot().mediumCount>0,'actual eligible medium instances exercise complete buffers');
 const uuids=group.children.map(o=>[o.uuid,o.geometry.uuid,o.material.uuid]);noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero));
 for(const [quality,xr]of[['high',false],['low',false],['low',true],['high',false]]){
  u.setMode(quality,xr);u.api.force();noRNG(()=>u.api.update());noRNG(()=>controller.update());
  if(!xr)assert(controller.snapshot().mediumCount>0);else assert.equal(controller.snapshot().mediumCount,0);
  assert.equal(controller.snapshot().farCount+controller.snapshot().fullCount+controller.snapshot().mediumCount,f.trees.filter(activeWorldTree).length);assert(controller.selection().selected.every(activeWorldTree));assert(controller.selection().medium.every(activeWorldTree));assert(controller.snapshot().triangleCount<=controller.snapshot().triangleBudget);
  assert.deepEqual(group.children.map(o=>[o.uuid,o.geometry.uuid,o.material.uuid]),uuids);
  for(const row of u.cards){const matrices=Array.from({length:row.mesh.count},(_,i)=>row.mesh.matrices[i]);for(const s of S)assert(!matrices.includes(f.trees[s.id].matrix));}
  for(const row of controller.mediumMeshes){const matrix=new T.Matrix4();for(let i=0;i<row.mesh.count;i++){row.mesh.getMatrixAt(i,matrix);assert(!S.some(s=>Math.abs(matrix.elements[12]-s.x)<1e-4&&Math.abs(matrix.elements[14]-s.z)<1e-4));}}
 }
});

// The exact current native target records also exercise non-Float32 authoring
// coordinates/heights and the separate blossom bank through actual ownership gates.
test('all seven exact current native ordinary-owner records admit with their real bank indices and double coordinates',()=>{
 const native=JSON.parse(fs.readFileSync(new URL('./fixtures/countryside-vista-3fa6665/native-owner-inputs.json',import.meta.url))),f=fixture(),extra=new T.InstancedMesh(f.canopy.geometry,f.canopy.material,f.trees.length);
 f.G.floraPkg.bank.blossom={im:extra,n:f.trees.length};f.G.floraPkg.treeOwners=[];f.G.world.colliders=[];f.G.world.forestPoints=[];
 for(const n of native.rows){const t=f.trees[n.tree.id],v=n.tree.floraOwner,c={...n.collider},p={...n.forest},kind=v.canopyName.replace('flora_',''),canopy=f.G.floraPkg.bank[kind].im,o={kind,x:c.x,z:c.z,height:c.height,canopy,canopyIndex:v.canopyIndex,trunk:f.trunk,trunkIndex:v.trunkIndex,collider:c,forestPoint:p};
  assert.equal(t.x,n.tree.x);assert.equal(t.z,n.tree.z);assert.equal(t.source.key,n.tree.source);canopy.setMatrixAt(o.canopyIndex,t.matrix);f.trunk.setMatrixAt(o.trunkIndex,t.matrix);Object.assign(t,{kind,floraOwner:o,stem:f.trunk,stemIndex:o.trunkIndex,leaves:canopy,index:o.canopyIndex});f.G.floraPkg.treeOwners.push(o);f.G.world.colliders.push(c);f.G.world.forestPoints.push(p);
 }
 assert.equal(planCountrysideVista(f.G,f.trees,f.zero).ok,true);assert.equal(noRNG(()=>retireCountrysideVistaTrees(f.G,f.trees,f.zero)).count,7);assert.equal(f.G.world.colliders.length,0);assert.equal(f.G.world.forestPoints.length,0);
});
