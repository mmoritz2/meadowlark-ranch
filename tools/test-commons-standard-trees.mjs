import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {terrainAwareWoodEnvelope} from '../assets/settlement-woodland.mjs';
import {UPRIGHT_HYBRID_WOOD_BOXES as uprightBoxes} from '../assets/upright-broadleaf-wood-proxies.mjs';
import {WOODLAND_WOOD_BOXES as broadBoxes} from '../assets/woodland-edge-wood-proxies.mjs';
import {COMMONS_STANDARDS_PROFILE,COMMONS_STANDARDS_LIMIT,COMMONS_STANDARD_SITES,commonsStandardCandidates,commonsTreeCell,withCommonsStandardResources} from '../assets/commons-standard-trees.mjs';
import {createSolidWorld} from '../assets/solid-collisions.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),before=fs.readFileSync(new URL('./fixtures/commons-landscape-2fbab/world-photoscans.js',import.meta.url),'utf8'),after=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');
test('four immutable authored standards frame the open centre with no placement RNG',()=>{
 const previous=Math.random;Math.random=()=>{throw Error('Placement consumed global RNG');};try{assert.deepEqual(commonsStandardCandidates(),commonsStandardCandidates());}finally{Math.random=previous;}
 assert.equal(COMMONS_STANDARD_SITES.length,4);assert.equal(COMMONS_STANDARDS_LIMIT,4);assert(Object.isFrozen(COMMONS_STANDARD_SITES)&&COMMONS_STANDARD_SITES.every(Object.isFrozen));
 for(const s of commonsStandardCandidates()){assert(Math.hypot(s.x-43,s.z-222)>18);assert(s.height>=9.5&&s.height<=11.5);assert(s.allowMeadowMargin);assert(s.x>=32&&s.x<=64&&s.z>=211&&s.z<=252);}
});
test('frozen parent source and actual current owner retain every original clearance and wood registration',()=>{
 assert.equal(createHash('sha256').update(before).digest('hex'),'550aa52860da6e113dd6f5302a7cf2933498bb00430cd61ccf97c67e7da3bfd2');
 for(const [start,end]of [['    function settlementRiderRadius(', '    for(const site of settlementWoodlandCandidates())'],['    edge.collision=', '    commonsStandards.trees=']]){
  const oldEnd=end==='    commonsStandards.trees='?before.indexOf('    W.nearGroundCover?.invalidate?.();'):before.indexOf(end);
  const oldBody=before.slice(before.indexOf(start),oldEnd),currentBody=after.slice(after.indexOf(start),after.indexOf(end));
  assert.equal(currentBody.trimEnd(),oldBody.trimEnd());
 }
 assert(after.includes('const ride=settlementRiderRadius(site,source,woodRadius),rejection=settlementFootRejection(site,source,ride.fullRadius,ride);'));
 assert(after.includes('authoredWoodlandEdge:true,authoredCommonsStandard:true'));assert(!after.includes('source=t.source'));
});
test('actual admission hook respects all existing rejection callbacks and commits only accepted roots',()=>{
 const begin=after.indexOf('    // Four authored standards frame'),end=after.indexOf('    state.villageEvergreens=',begin),body=after.slice(begin,end)+'return commonsStandards;';assert(begin>0&&end>begin);
 const run=new Function('state','COMMONS_STANDARDS_PROFILE','COMMONS_STANDARDS_LIMIT','commonsStandardCandidates','uprightSource','matureLeafSource','edgeWoodRadius','settlementRiderRadius','settlementFootRejection','add','trees','edge',body),upright={},mature={},old={x:200,z:200},trees=[old],edge={trees:[]},seen=[];
 const previous=Math.random;Math.random=()=>{throw Error('Admission consumed global RNG');};let state;
 try{state=run({},COMMONS_STANDARDS_PROFILE,COMMONS_STANDARDS_LIMIT,commonsStandardCandidates,upright,mature,()=>4,(site,source)=>({radius:2,fullRadius:4,maxGroundRise:.5}),(site,source,full,ride)=>{seen.push({id:site.id,source,full,ride});return site.id==='west-inner-crown'?'protected course':null;},t=>trees.push(t),trees,edge);}finally{Math.random=previous;}
 assert.equal(seen.length,4);assert.equal(state.trees.length,3);assert.equal(state.skipped.length,1);assert.equal(state.skipped[0].reason,'protected course');assert.equal(trees[0],old);assert.deepEqual(trees.slice(1),edge.trees);assert(state.trees.every(t=>t.authoredCommonsStandard&&t.authoredWoodlandEdge&&t.woodRadius===4&&t.riderWoodRadius===2));
});
test('new source/cell batches use private UUIDs while all old batch UUIDs and ambient future remain exact',()=>{
 const oldStart=before.indexOf('    for(const records of cells.values()){'),oldEnd=before.indexOf('    edge.collision=',oldStart),newStart=after.indexOf('    for(const records of cells.values()){'),newEnd=after.indexOf('    edge.collision=',newStart);
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3)),wood=new T.MeshBasicMaterial(),leaves=new T.MeshBasicMaterial();wood.name='wood';leaves.name='leaves';const source={key:'upright-broadleaf',card:{geo:geometry,mat:leaves},parts:[{name:'wood',geo:geometry,mat:wood},{name:'leaves',geo:geometry,mat:leaves}]},oldRows=[{x:20,z:220,source},{x:30,z:230,source}],newSame={x:48,z:241,source,authoredCommonsStandard:true},newCell={x:130,z:241,source,authoredCommonsStandard:true},identity=new T.Matrix4(),WHITE=new T.Color('white');
 for(const r of [...oldRows,newSame,newCell])r.matrix=identity;
 const make=(current)=>{
  const cells=new Map([['upright-broadleaf:0,3',current?[...oldRows,newSame]:oldRows]]);if(current)cells.set('upright-broadleaf:2,3',[newCell]);
  const treeCards=[],treeMeshes=[],instances=(p,matrices,name)=>{const mesh=new T.InstancedMesh(p.geo,p.mat,matrices.length);mesh.name=name;for(let i=0;i<matrices.length;i++)mesh.setMatrixAt(i,matrices[i]);return mesh;},previous=Math.random;let seed=13671,calls=0;
  Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{new Function('cells','instances','WHITE','zero','treeCards','treeMeshes','commonsNewCells','commonsTreeCell','withCommonsStandardResources',current?after.slice(newStart,newEnd):before.slice(oldStart,oldEnd))(cells,instances,WHITE,identity,treeCards,treeMeshes,['upright-broadleaf:2,3'],commonsTreeCell,withCommonsStandardResources);const used=calls,future=Array.from({length:24},()=>Math.random());return{cards:treeCards.map(r=>r.mesh.uuid),models:treeMeshes.map(r=>r.mesh.uuid),buffers:[...treeCards,...treeMeshes].map(r=>({positions:Array.from(r.mesh.geometry.attributes.position.array),matrices:Array.from(r.mesh.instanceMatrix.array),colors:Array.from(r.mesh.instanceColor.array),material:r.mesh.material.uuid,geometry:r.mesh.geometry.uuid})),calls:used,future};}finally{Math.random=previous;}
 };
 const a=make(false),b=make(true);assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);assert.equal(b.cards[0],a.cards[0]);assert.deepEqual(b.models.slice(0,2),a.models);assert.equal(new Set([...b.cards,...b.models]).size,6);for(const [oldIndex,newIndex]of [[0,0],[1,2],[2,3]]){const old=a.buffers[oldIndex],current=b.buffers[newIndex];assert.equal(current.geometry,old.geometry);assert.equal(current.material,old.material);assert.deepEqual(current.positions,old.positions);assert.deepEqual(current.matrices.slice(0,old.matrices.length),old.matrices);assert.deepEqual(current.colors.slice(0,old.colors.length),old.colors);}
 const previous=Math.random;assert.throws(()=>withCommonsStandardResources('throw',()=>{throw Error('sentinel');}),/sentinel/);assert.equal(Math.random,previous);
});
// The view catalog includes atlas padding. Runtime placement uses these actual
// original GLB bounds; mature leaf refinement retains every source Y coordinate.
function sourceBounds(id){
 const data=fs.readFileSync(new URL('../assets/models/world/realism/'+id+'.glb',import.meta.url)),doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString()),total=new T.Box3();
 const visit=(index,parent)=>{const n=doc.nodes[index],local=new T.Matrix4();if(n.matrix)local.fromArray(n.matrix);else local.compose(new T.Vector3(...(n.translation||[0,0,0])),new T.Quaternion(...(n.rotation||[0,0,0,1])),new T.Vector3(...(n.scale||[1,1,1])));const world=parent.clone().multiply(local);if(n.mesh!==undefined)for(const p of doc.meshes[n.mesh].primitives){const a=doc.accessors[p.attributes.POSITION];total.union(new T.Box3(new T.Vector3(...a.min),new T.Vector3(...a.max)).applyMatrix4(world));}for(const c of n.children||[])visit(c,world);};
 for(const n of doc.scenes[doc.scene||0].nodes)visit(n,new T.Matrix4());return total;
}
const sourceCatalog=JSON.parse(fs.readFileSync(new URL('../assets/models/world/realism/tree-impostors.json',import.meta.url),'utf8'));
function originalSource(upright){const id=upright?'upright_broadleaf_01':'tree_small_02',alias=upright?id:'tree_small_02_mature_leaves',meta=sourceCatalog.trees.find(t=>t.id===alias&&t.variant===-1),bounds=sourceBounds(id);assert(Math.abs(bounds.max.y-bounds.min.y-meta.sourceHeight)<1e-7);return{key:upright?'upright-broadleaf':'mature-leaf-broadleaf',bounds,meta};}
test('actual wood registration appends 3978 real source boxes, preserves old owner and records, and blocks wood while the commons mouth stays clear',()=>{
 const uprightSource=originalSource(true),broadSource=originalSource(false),groundH=(x,z)=>11+(x-43)*.015+(z-222)*.005;
 const makeTree=s=>{const source=s.upright?uprightSource:broadSource,scale=s.height/source.meta.sourceHeight,q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),s.yaw),matrix=new T.Matrix4().compose(new T.Vector3(s.x,groundH(s.x,s.z)-source.bounds.min.y*scale-.07,s.z),q,new T.Vector3(scale,scale,scale));return{...s,source,matrix};};
 const body=after.slice(after.indexOf('    edge.collision='),after.indexOf('    if(pastoral.trees.length)',after.indexOf('    edge.collision=')));
 const run=(extra)=>{const previous=Math.random;let seed=53143,calls=0;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{const group=new T.Group(),identity=new T.Matrix4(),old=[{x:180,z:200,height:10,yaw:.4,upright:true},{x:202,z:225,height:10,yaw:1.2,upright:false}].map(makeTree),edge={trees:[...old,...extra.map(makeTree)]},world={colliders:[{x:300,z:300,r:1}],forestPoints:[{x:300,z:300,s:1}],solidWorld:createSolidWorld({THREE:T})},G={followCam:{invalidateTrees(){}}};
   new Function('THREE','edge','group','identity','uprightSource','UPRIGHT_HYBRID_WOOD_BOXES','WOODLAND_WOOD_BOXES','UPRIGHT_HYBRID_WOOD_SOURCE_SHA','WOODLAND_WOOD_SOURCE_SHA','W','G',body)(T,edge,group,identity,uprightSource,uprightBoxes,broadBoxes,'upright','broad',world,G);
   return{group,edge,world,calls};
  }finally{Math.random=previous;}
 };
 const baseline=run([]),current=run(commonsStandardCandidates()),oldOwner=baseline.group.children[0],owner=current.group.children[0],oldParts=oldOwner.userData.solidParts,newParts=owner.userData.solidParts;
 assert.equal(current.calls,baseline.calls);assert.equal(current.group.uuid,baseline.group.uuid);assert.equal(owner.uuid,oldOwner.uuid);assert.equal(current.group.children.length,baseline.group.children.length);assert.deepEqual(newParts.slice(0,oldParts.length),oldParts);assert.equal(newParts.length-oldParts.length,3978);assert.equal(current.edge.collision.registeredParts,current.edge.collision.parts);assert.equal(current.edge.collision.registeredParts-baseline.edge.collision.registeredParts,3978);assert.deepEqual(current.world.colliders.slice(0,baseline.world.colliders.length),baseline.world.colliders);assert.deepEqual(current.world.forestPoints.slice(0,baseline.world.forestPoints.length),baseline.world.forestPoints);assert.equal(current.world.colliders.length-baseline.world.colliders.length,4);assert.equal(current.world.forestPoints.length-baseline.world.forestPoints.length,4);
 for(const tree of current.edge.trees.slice(2)){const h=groundH(tree.x,tree.z),position=new T.Vector3(tree.x,0,tree.z),contacts=current.world.solidWorld.resolve(position,{bottom:h+.1,top:h+2.65,radius:.55});assert(contacts>0,tree.id+' physical trunk contact');assert(Math.hypot(position.x-tree.x,position.z-tree.z)>.1);}
 for(const [x,z]of [[43,222],[58,238],[61,239],[64,239],[74,249]]){const h=groundH(x,z),position=new T.Vector3(x,0,z);assert.equal(current.world.solidWorld.resolve(position,{bottom:h+.1,top:h+2.65,radius:.55}),0,'open commons mouth '+x+','+z);assert.equal(position.x,x);assert.equal(position.z,z);}
});
