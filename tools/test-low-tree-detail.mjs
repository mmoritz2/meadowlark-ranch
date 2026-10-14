import {activeWorldTree} from '../assets/countryside-vista-owners.mjs';
// Executes the actual runtime updater, without a renderer or GPU. Portable when
// placed in tools/; TREE_DETAIL_REPO/RUNTIME may bind a frozen scratch candidate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
function inferRoot(){let p=path.dirname(fileURLToPath(import.meta.url));while(!fs.existsSync(path.join(p,'ranch3d.html'))){const next=path.dirname(p);if(next===p)throw Error('Set TREE_DETAIL_REPO');p=next;}return p;}
const ROOT=path.resolve(process.env.TREE_DETAIL_REPO||inferRoot());
const runtimePath=path.resolve(process.env.TREE_DETAIL_RUNTIME||path.join(ROOT,'assets/world-photoscans.js'));
const runtime=fs.readFileSync(runtimePath,'utf8');
const start=runtime.indexOf('  let previousSelection=new Set()');
const end=runtime.indexOf('  state.ready=(async()=>{',start);
assert(start>=0&&end>start,'actual updateTrees source owner required');
const updater=runtime.slice(start,end);
const actualCrownHelpers=runtime.slice(runtime.indexOf('// Pure CPU projection of existing leaf geometry bounds.'),runtime.indexOf('export function installWorldPhotoscans(')).replace(/export (?=function )/g,'');
const T=await import(pathToFileURL(path.join(ROOT,'assets/vendor/three/build/three.module.js')));
const construct=new Function('THREE','H','G','renderer','trees','treeMeshes','treeCards','state','WHITE','activeWorldTree',actualCrownHelpers+updater+'\nreturn {update:updateTrees,selected:()=>[...previousSelection],mode:()=>previousMode};');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/world/realism/manifest.json'),'utf8'));
const COST={pine:manifest.find(r=>r.id==='pine_tree_01').output.triangles,island:manifest.find(r=>r.id==='island_tree_01').output.triangles,jacaranda:manifest.find(r=>r.id==='jacaranda_tree').output.triangles};
const WHITE=new T.Color(0xffffff),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function fixture(rows,{tier='low',reserve=0,xr=false}={}){
 const trees=rows.map((r,i)=>Object.freeze({id:r.id??i,x:r.x,z:r.z??0,source:Object.freeze({key:r.source??'pine',triangles:r.triangles??COST[r.source??'pine']}),matrix:new T.Matrix4().makeTranslation(r.x,i*.013,r.z??0),tint:new T.Color(r.tint??0xc3d2a7)}));
 const treeMeshes=[],treeCards=[],geometry=new T.BoxGeometry(1,1,1),bySource=new Map(),position={value:tier},renderer={xr:{isPresenting:xr}},state={villageEvergreens:{triangles:reserve*.4},willows:{triangles:reserve*.3},thunderOak:{triangles:reserve*.3}};
 for(const t of trees){if(!bySource.has(t.source.key))bySource.set(t.source.key,[]);bySource.get(t.source.key).push(t);}
 function mesh(records,name){const m=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({name}),records.length);m.setColorAt(0,WHITE);return {mesh:m,records};}
 for(const [key,records]of bySource){treeMeshes.push(mesh(records,key+'_bark'),mesh(records,key+'_twig'));treeCards.push(mesh(records,key+'_views'));}
 const H={player:{pos:new T.Vector3(0,0,0)}},G={gfx:{get:()=>position.value}},api=construct(T,H,G,renderer,trees,treeMeshes,treeCards,state,WHITE,activeWorldTree);
 const identities=trees.map(t=>({record:t,source:t.source,matrix:t.matrix,values:t.matrix.toArray(),tint:t.tint.toArray()}));
 const resources=[...treeMeshes,...treeCards].map(({mesh:m})=>({m,geometry:m.geometry,material:m.material,instanceMatrix:m.instanceMatrix,instanceColor:m.instanceColor,position:digest(bytes(m.geometry.attributes.position.array)),index:digest(bytes(m.geometry.index.array))}));
 function step({tier:next,at,xr:presenting}={}){if(next)position.value=next;if(at)H.player.pos.set(at[0],0,at[1]??0);if(presenting!==undefined)renderer.xr.isPresenting=presenting;const random=Math.random;try{Math.random=()=>{throw Error('tree updater consumed source/world RNG');};api.update();}finally{Math.random=random;}
  for(const r of identities){assert.equal(trees.find(t=>t.id===r.record.id),r.record);assert.equal(r.record.source,r.source);assert.equal(r.record.matrix,r.matrix);assert.deepEqual(r.matrix.toArray(),r.values);assert.deepEqual(r.record.tint.toArray(),r.tint);}
  for(const r of resources){assert.equal(r.m.geometry,r.geometry);assert.equal(r.m.material,r.material);assert.equal(r.m.instanceMatrix,r.instanceMatrix);assert.equal(r.m.instanceColor,r.instanceColor);assert.equal(digest(bytes(r.geometry.attributes.position.array)),r.position);assert.equal(digest(bytes(r.geometry.index.array)),r.index);}
  return api.selected().map(t=>t.id);
 }
 function assertPartitions(){const selected=new Set(api.selected());for(const bank of [treeMeshes,treeCards])for(const {mesh,records}of bank){const detailed=bank===treeMeshes,expected=records.filter(t=>detailed?selected.has(t):!selected.has(t));assert.equal(mesh.count,expected.length);assert.equal(mesh.visible,mesh.count>0);for(let i=0;i<expected.length;i++){const matrix=new T.Matrix4(),color=new T.Color();mesh.getMatrixAt(i,matrix);mesh.getColorAt(i,color);assert.deepEqual(matrix.toArray(),Array.from(Float32Array.from(expected[i].matrix.elements)));const tint=detailed&&!/leaves|twig/.test(mesh.material.name)?WHITE:expected[i].tint||WHITE;assert.deepEqual(color.toArray(),Array.from(Float32Array.from(tint.toArray())));}}assert.equal(state.activeTrees+state.distantTrees,trees.length);}
 return {step,assertPartitions,state,api,treeMeshes,treeCards,trees,resources};
}
test('Low chooses four nearest source models, with complementary cards and unchanged source resources/roots/RNG',()=>{
 const f=fixture([{id:'far',x:24,source:'jacaranda'},{id:'nearest',x:3,source:'island'},{id:'next',x:-8,source:'pine'},{id:'third',x:14,source:'pine'},{id:'fourth',x:-21,source:'island'},{id:'outside',x:27,source:'pine'}]);
 assert.deepEqual(f.step(),['nearest','next','third','fourth']);f.assertPartitions();assert.equal(f.state.activeTreeTriangles,2*COST.island+2*COST.pine);assert.equal(f.state.treeTriangleBudget,750000);
 const rebuilds=f.state.detailRebuilds,versions=f.resources.map(r=>[r.m.instanceMatrix.version,r.m.instanceColor.version]);assert.deepEqual(f.step(),['nearest','next','third','fourth']);assert.equal(f.state.detailRebuilds,rebuilds);assert.deepEqual(f.resources.map(r=>[r.m.instanceMatrix.version,r.m.instanceColor.version]),versions);
});
test('Low admission ends at 26 m while an incumbent stays until 31 m, then must re-enter 26 m',()=>{
 const f=fixture([{id:'boundary',x:26}]);assert.deepEqual(f.step(),[]);assert.deepEqual(f.step({at:[.001,0]}),['boundary']);assert.deepEqual(f.step({at:[-4.999,0]}),['boundary']);assert.deepEqual(f.step({at:[-5,0]}),[]);assert.deepEqual(f.step({at:[-1,0]}),[]);assert.deepEqual(f.step({at:[1,0]}),['boundary']);f.assertPartitions();
});
test('incumbent weighting keeps equally distant riding neighbours and admits an appreciably closer newcomer',()=>{
 const f=fixture([{id:'right',x:10},{id:'left',x:-10},{id:'nearRight',x:9},{id:'nearLeft',x:-9},{id:'new',x:10.05}]);assert.deepEqual(f.step(),['nearRight','nearLeft','right','left']);assert.deepEqual(new Set(f.step({at:[-.05,0]})),new Set(['nearRight','nearLeft','right','left']));assert.deepEqual(new Set(f.step({at:[5,0]})),new Set(['nearRight','nearLeft','right','new']));f.assertPartitions();
});
test('fixed 750k Low budget includes authored reservations, skips expensive models and never silently adds detail',()=>{
 const f=fixture([{id:'expensive',x:1,source:'jacaranda'},{id:'small',x:2,source:'pine'},{id:'nextSmall',x:3,source:'island'}],{reserve:550000});assert.deepEqual(f.step(),['small','nextSmall']);assert(f.state.activeTreeTriangles<=750000);assert.equal(f.state.activeTreeTriangles,550000+COST.pine+COST.island);f.assertPartitions();
 const capped=fixture([{id:'nearest',x:1},{id:'other',x:2}],{reserve:650000});assert.deepEqual(capped.step(),['nearest']);assert(capped.state.activeTreeTriangles<=750000);capped.assertPartitions();
 const unaffordable=fixture([{id:'costly',x:1,triangles:750001},{id:'refill',x:2}]);assert.deepEqual(unaffordable.step(),['refill']);unaffordable.assertPartitions();
});
test('High 12/58 m and Medium 6/40 m keep their existing budgets and boundary policy',()=>{
 for(const [tier,count,range,cap]of [['high',12,58,1800000],['medium',6,40,750000]]){const f=fixture(Array.from({length:20},(_,i)=>({id:i,x:i+1})),{tier});assert.equal(f.step().length,count);assert.equal(f.state.treeTriangleBudget,cap);assert(f.state.activeTreeTriangles<=cap);f.assertPartitions();const boundary=fixture([{id:'edge',x:range}],{tier});assert.deepEqual(boundary.step(),[]);assert.deepEqual(boundary.step({at:[.001,0]}),['edge']);}
});
test('XR disables all detailed models and shadows; exiting restores bounded detail without changing root matrices',()=>{
 const f=fixture(Array.from({length:5},(_,i)=>({x:i+1})));assert.equal(f.step().length,4);assert.deepEqual(f.step({xr:true}),[]);f.assertPartitions();assert(f.treeMeshes.every(r=>!r.mesh.visible&&!r.mesh.castShadow));assert(f.treeCards.every(r=>r.mesh.visible&&!r.mesh.castShadow));assert.equal(f.step({xr:false}).length,4);f.assertPartitions();assert(f.treeMeshes.every(r=>r.mesh.castShadow));
});
test('quality transitions rebuild complementary batches while preserving counts and model identity',()=>{
 const f=fixture(Array.from({length:16},(_,i)=>({id:i,x:i+1})));for(const [tier,count]of [['low',4],['medium',6],['high',12],['low',4]]){assert.equal(f.step({tier}).length,count);f.assertPartitions();assert.equal(f.api.mode(),tier+':false');assert(f.state.activeTreeTriangles<=f.state.treeTriangleBudget);}assert.equal(f.state.detailRebuilds,4);
});
