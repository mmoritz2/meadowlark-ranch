import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {install} from '../assets/features/course-clear.js';

function meshAt(scene,name,x=0,z=0,{fine=false}={}){
 const geometry=new THREE.PlaneGeometry(.20,1.2),mesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial(),1);
 mesh.name=name;mesh.userData.fineGroundCover=fine;
 mesh.setMatrixAt(0,new THREE.Matrix4().makeScale(4,4,4).setPosition(x,0,z));scene.add(mesh);return mesh;
}
function world({cover='Living pasture grass',fine=false,body='Hay stack',ownTrunk=false,zone=false,arena=false}={}){
 const scene=new THREE.Scene(),callbacks=new Map(),collider={x:0,z:0,r:.8};
 const coverMesh=meshAt(scene,cover,0,0,{fine});
 // A merged stack/rock has a physical proxy near its end. Its geometric centre
 // is1.5m away, outside objectsNear's small local proxy lookup; solidOver still
 // proves the proxy lies inside the real solid. Grass cannot make it a trunk.
 const solid=new THREE.Mesh(new THREE.BoxGeometry(4,2,3),new THREE.MeshBasicMaterial());solid.name=body;solid.position.set(1.5,1,0);scene.add(solid);
 if(ownTrunk)coverMesh.name='Seed tree | oak trunk';
 const W={colliders:[collider],nearGroundCover:{invalidate(){W.invalidated=(W.invalidated||0)+1;}}};
 const routes=zone?{test:[[100,100],[110,100]]}:{test:[[-10,0],[10,0]]};
 const G={THREE,scene,world:W,tables:{RACE_ROUTES:routes,EVENTS3:arena?[{at:[0,0]}]:[]},on(key,fn){callbacks.set(key,fn);}};
 if(zone)G.vistas={clearZones:[()=>true]};
 return {G,W,scene,coverMesh,collider,callbacks};
}
function run(w){const old=globalThis.window;globalThis.window={};try{install(w.G);}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}return w;}
const matrixOf=m=>{const v=new THREE.Matrix4();m.getMatrixAt(0,v);return v;};

test('large decorative grass and flowers cannot remove adjacent hay and rock proxies, while remaining mown',()=>{
 const names=['Living pasture grass','Middle distance pasture','Modelled meadow lupins','Seeded pasture flower clumps','flora_tuft','flora_petal','flora_brack','flora_reed','flora_fern','Living shoreline bulrushes',''];
 for(const body of ['Hay stack','Geology boulder'])for(const cover of names){const w=run(world({cover,body}));assert(w.W.colliders.includes(w.collider),body+' proxy must survive '+cover);if(cover==='flora_petal')assert.notEqual(matrixOf(w.coverMesh).determinant(),0,'existing petal/character name exclusion stays intact');else assert.equal(matrixOf(w.coverMesh).determinant(),0,'decorative cover remains mown: '+cover);}
});

test('fineGroundCover overrides a vegetation-like name on the owner or its parent',()=>{
 for(const inherited of [false,true]){const w=world({cover:'foliage_scan_oak',fine:!inherited});if(inherited){const group=new THREE.Group();group.userData.fineGroundCover=true;group.add(w.coverMesh);w.scene.add(group);}run(w);assert(w.W.colliders.includes(w.collider));assert.equal(matrixOf(w.coverMesh).determinant(),0);}
});

test('a named actual trunk still clears its collider and source row from the course',()=>{
 const w=run(world({ownTrunk:true}));assert.equal(w.W.colliders.length,0);assert.equal(matrixOf(w.coverMesh).determinant(),0);assert(w.G.courseClear.stats.collidersCleared>0);
});

test('decorative cover cannot justify collider removal in landmark clear zones or arena clearing',()=>{
 for(const extra of [{zone:true},{arena:true}]){const w=run(world(extra));assert(w.W.colliders.includes(w.collider));assert.equal(matrixOf(w.coverMesh).determinant(),0);}
});

test('every clear restores registered source prefixes, captures direct mowing and refreshes owner cells',()=>{
 const w=world(),calls=[];w.W.grassSubmission={restoreAll(){calls.push('restore');assert.notEqual(matrixOf(w.coverMesh).determinant(),0);},captureAll(){calls.push('capture');assert.equal(matrixOf(w.coverMesh).determinant(),0);}};
 w.W.nearGroundCover.invalidate=()=>calls.push('invalidate');run(w);assert.deepEqual(calls,['restore','capture','invalidate']);
 w.W.grassSubmission.restoreAll=()=>{calls.push('restore');w.coverMesh.setMatrixAt(0,new THREE.Matrix4().makeScale(4,4,4));};w.G.courseClear.rebuild();assert.deepEqual(calls,['restore','capture','invalidate','restore','capture','invalidate']);
});

test('startup readiness waits for the existing boot delayed clearing to finish',async()=>{
 const w=world(),oldTimeout=globalThis.setTimeout,pending=[];globalThis.setTimeout=(fn,ms)=>{pending.push({fn,ms});return 1;};
 try{run(w);let settled=false;w.G.courseClear.ready.then(()=>{settled=true;});await Promise.resolve();assert(!settled);assert.equal(w.G.courseClear.stats.startupComplete,false);w.callbacks.get('boot')();assert.equal(pending.length,1);assert.equal(pending[0].ms,400);assert(!settled);pending[0].fn();await w.G.courseClear.ready;assert(settled);assert.equal(w.G.courseClear.stats.startupComplete,true);assert(w.W.invalidated>=2);}
 finally{globalThis.setTimeout=oldTimeout;}
});


test('unnamed original seed wood is recognized by explicit species and layer metadata',()=>{
 for(const species of ['oak','birch','blossom','pine','snowpine']){const w=world({cover:''});w.coverMesh.userData.treePoints=[{x:0,z:0}];w.coverMesh.userData.treeSpecies=species;w.coverMesh.userData.treeLayer='wood';run(w);
 assert.equal(w.W.colliders.length,0,'seed '+species+' proxy clears with explicit metadata even without mesh display name');assert.equal(matrixOf(w.coverMesh).determinant(),0);}
 const soft=world({cover:'',fine:true});soft.coverMesh.userData.treePoints=[{x:0,z:0}];soft.coverMesh.userData.treeSpecies='oak';soft.coverMesh.userData.treeLayer='wood';run(soft);assert(soft.W.colliders.includes(soft.collider),'explicit fine cover still overrides source metadata');
});
