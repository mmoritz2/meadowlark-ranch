import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.WORLD_HORSE_SOURCE_ROOT?pathToFileURL(process.env.WORLD_HORSE_SOURCE_ROOT+'/'):new URL('../',import.meta.url);
const THREE=await import(new URL('assets/vendor/three/build/three.module.js',root));
const lifecycle=await import(new URL('../assets/world-horse-lifecycle.mjs?v=ranch-actors-2',import.meta.url));
const game=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const from=(a,b)=>{const s=game.indexOf(a),e=game.indexOf(b,s+a.length);assert(s>=0&&e>s,'production boundaries');return game.slice(s,e);};
function fixture(){
 const scene=new THREE.Group(),ready=new Map(),pending=[],calls={instances:0,disposed:0,custom:[],tack:0,tackIds:[]};let clock=10000;
 const model={key:'bay',profile:{nativeBreed:true,nativeKind:'horse'}};
 const BREED_MODELS={get:k=>ready.get(k),load(k){return new Promise((resolve,reject)=>pending.push({key:k,resolve(){ready.set(k,{...model,key:k});resolve(ready.get(k));},reject}));}};
 const bindings={...lifecycle,THREE,scene,performance:{now:()=>clock},BREED_MODELS,RIG:{ready:true,modelKey:'bay'},myHorses:[],BREEDS3:[],
  instantiateArtistBreed(asset){calls.instances++;const group=new THREE.Group(),skin=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());group.add(skin);return {...asset,scene:group,skin,bones:[new THREE.Bone()]};},
  rigCalibrate(){},initGameHero(){},configureArtistCustomization(r,h){calls.custom.push(h);},syncCollectionTack(r,m,h,ids){calls.tack++;calls.tackIds.push(ids);r.collectionPieces=ids?.saddle?{saddle:{id:ids.saddle}}:{};},applyNativeRemoteMode(){},
  disposeMountedRig(){calls.disposed++;},console:{warn(){}},fitArtistFeatures(){}};
 const source='let worldRigCount=0;'+from('const WORLD_RIDER_TACK=','let worldRigCount=0;')+from('function undressRig(ent){','function placeWorldHorseRider(ent,bob=0)')+from('function disposeHorseEnt(b){','function resetBarn()')+';return {dressWithRig,undressRig,disposeHorseEnt,count:()=>worldRigCount};';
 const api=Function(...Object.keys(bindings),source)(...Object.values(bindings));
 function actor(){const group=new THREE.Group(),proc=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),rider=new THREE.Group(),riderMesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());rider.add(riderMesh);group.add(proc,rider);scene.add(group);return {parts:{group},rider:{g:rider},proc,riderMesh};}
 return {api,actor,ready,pending,calls,model,scene,setClock:v=>clock=v};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('visible visitor owns its rider and adoption preserves rider meshes with one approved body',()=>{
 const f=fixture();f.ready.set('bay',f.model);const a=f.actor();
 // Read the actual visitor entity constructor, so this catches the former lost rd.
 const constructor=game.match(/visitors\.push\(\{([^;]+)\}\);/)[1];
 const bindings={parts:a.parts,rd:a.rider,c:{body:'#885533',mane:'#221100'},WAY:[[1,2]],wi:0,THREE};
 const entity=Function(...Object.keys(bindings),'return ({'+constructor+'});')(...Object.values(bindings));
 assert.equal(entity.rider,a.rider);
 f.api.dressWithRig(entity,entity.parts,entity.colors,{saddle:true,keep:[entity.rider?.g]});
 assert.equal(a.riderMesh.visible,true);assert.equal(a.proc.visible,false);assert.equal(f.calls.instances,1);
 assert.deepEqual(f.calls.tackIds[0],{saddle:'tc_classicwestern_saddle',pad:'tc_classicwestern_pad',bridle:'tc_classicwestern_bridle'});
 f.api.dressWithRig(entity,entity.parts,entity.colors,{saddle:true,keep:[entity.rider?.g]});assert.equal(f.calls.instances,1);assert.equal(f.api.count(),1);
});
test('one pending download dresses one actor after its approved breed arrives',async()=>{
 const f=fixture(),a=f.actor();
 f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});
 assert.equal(f.pending.length,1);assert.equal(f.calls.instances,0);f.pending[0].resolve();await flush();
 assert.equal(a.rig.key,'grey');assert.equal(f.calls.instances,1);assert.equal(a.rigPending,false);
});
test('borrowed approved body changes to its own breed once without double-counting',async()=>{
 const f=fixture(),a=f.actor();f.ready.set('bay',f.model);
 f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});assert.equal(a.rig.key,'bay');assert.equal(a.rigStandIn,'grey');assert.equal(f.api.count(),1);
 f.pending[0].resolve();await flush();assert.equal(a.rig.key,'grey');assert.equal(a.rigStandIn,null);assert.equal(f.calls.instances,2);assert.equal(f.calls.disposed,1);assert.equal(f.api.count(),1);
});
test('retirement cancels pending adoption even if the removed group is reparented',async()=>{
 const f=fixture(),a=f.actor();f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});
 f.api.disposeHorseEnt(a);f.scene.add(a.parts.group);f.pending[0].resolve();await flush();
 assert.equal(f.calls.instances,0);assert.equal(a.rigPending,false);f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});assert.equal(f.calls.instances,0);
});
test('retired native rig is disposed once, clears ownership, and cannot redress after later same-tick calls',()=>{
 const f=fixture(),a=f.actor();f.ready.set('bay',f.model);f.api.dressWithRig(a,a.parts,{});
 f.api.disposeHorseEnt(a);f.api.disposeHorseEnt(a);f.api.dressWithRig(a,a.parts,{});
 assert.equal(f.calls.disposed,1);assert.equal(f.api.count(),0);assert.equal(a.rig,null);assert.equal(a.parts.group.parent,null);assert.equal(f.calls.instances,1);
});
test('an old result cannot clear a newer load on a reused bounty entity',()=>{
 const f=fixture(),a=f.actor(),old=lifecycle.beginWorldHorseLoad(a,a.parts);lifecycle.retireWorldHorse(a);
 const next=f.actor();a.parts=next.parts;const current=lifecycle.beginWorldHorseLoad(a,a.parts);
 assert.equal(lifecycle.settleWorldHorseLoad(a,old),false);assert.equal(a.rigPending,true);assert.equal(a.rigLoadRequest,current);
 assert.equal(lifecycle.settleWorldHorseLoad(a,current),true);assert.equal(a.rigPending,false);
});
test('failed download retries after its backoff and retirement resets retry ownership',async()=>{
 const f=fixture(),a=f.actor();f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});f.pending[0].reject(new Error('fixture offline'));await flush();
 assert.equal(a.rigRetryAt,16000);f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});assert.equal(f.pending.length,1);
 f.setClock(17000);f.api.dressWithRig(a,a.parts,{}, {breed:'grey'});assert.equal(f.pending.length,2);f.api.disposeHorseEnt(a);assert.equal(a.rigTried,false);assert.equal(a.rigRetryAt,0);
});

const {gameHeroSeat}=await import(new URL('assets/game-hero-horse.js',root));
const breedSeat=Function('gameHeroSeat','BREED_MODELS','THREE','RIG',from('function breedSeat(rig=RIG){','function riderSeat(){')+';return breedSeat;')(gameHeroSeat,{mountPoint:rig=>rig.legacySeat?.clone()},THREE,{});
const placeWorldHorseRider=Function('breedSeat',from('function placeWorldHorseRider(ent,bob=0){','function tickRig(ent,sp,dt,t,graze)')+';return placeWorldHorseRider;')(breedSeat);
function seatedActor(scale=1){
 const mount=new THREE.Group(),scene=new THREE.Group(),bone=new THREE.Bone(),follower=new THREE.Object3D(),rider=new THREE.Group();
 mount.position.set(17,3,-11);mount.rotation.y=.83;mount.scale.setScalar(scale);scene.scale.setScalar(.921);bone.position.set(.03,1.38,-.1);follower.position.set(.012,.051,-.038);bone.add(follower);scene.add(bone);mount.add(scene,rider);
 return {parts:{group:mount},rider:{g:rider},bone,rig:{scene,profile:{nativeBreed:true,nativeKind:'horse'},nativeSeatFollower:follower,heroSeat:new THREE.Vector3(),collectionPieces:{saddle:{id:'free'}}}};
}
test('world native riders follow the live native seat in placed and scaled actors without duplicate stride bob',()=>{
 for(const scale of [.65,1,1.4]){const a=seatedActor(scale);let previous=null,moved=false;
  for(let i=0;i<41;i++){
   a.bone.position.y=1.38+Math.sin(i*.23)*.07;a.bone.position.x=.03+Math.sin(i*.19)*.035;a.bone.rotation.z=Math.sin(i*.17)*.05;
   a.parts.group.updateMatrixWorld(true);const contact=gameHeroSeat(a.rig,a.parts.group).clone();
   placeWorldHorseRider(a,Math.sin(i*.43)*.05);const expected=contact.clone().add(new THREE.Vector3(0,.11/scale,-.02/scale));assert.ok(a.rider.g.position.distanceTo(expected)<1e-12);
   const withBob=a.rider.g.position.clone();placeWorldHorseRider(a,9);assert.deepEqual(a.rider.g.position.toArray(),withBob.toArray());
   if(previous&&contact.distanceTo(previous)>.001)moved=true;previous=contact;
  }assert.equal(moved,true,'the actual seat follower changes; this is not a static anchor check');
 }
});
test('bareback world riders use the live body contact with the player bareback fit',()=>{
 const a=seatedActor(.8),body=new THREE.Vector3(.02,1.44,-.07);a.rig.collectionPieces={};a.rig.nativeRider={barebackSeatLocal:()=>body.clone()};placeWorldHorseRider(a,.4);
 assert.ok(a.rider.g.position.distanceTo(body.clone().add(new THREE.Vector3(0,.09/.8,-.02/.8)))<1e-12);
});
test('legacy non-native rider fit and stride bob remain exact',()=>{
 const a=seatedActor();a.rig.profile={nativeBreed:false};const contact=a.rig.legacySeat=new THREE.Vector3(.01,1.41,-.16);placeWorldHorseRider(a,.037);
 assert.deepEqual(a.rider.g.position.toArray(),[0,contact.y+.18+.037,contact.z+.02]);
});
test('explicit NPC display tack never equips an owned horse or a wild actor',()=>{
 for(const opts of [{saddle:true,mine:true,seed:7},{wild:true}]){const f=fixture(),a=f.actor();f.ready.set('bay',f.model);f.api.dressWithRig(a,a.parts,{},opts);assert.equal(f.calls.tackIds[0],null);}
});
const {getTackPiece}=await import(new URL('assets/tack-collection.mjs',root));
test('NPC display IDs resolve to the existing free source equipment without inventing owned inventory',()=>{
 const ids=Function(from('const WORLD_RIDER_TACK=','let worldRigCount=0;')+'return WORLD_RIDER_TACK;')();
 const collectionPieces=Function('getTackPiece','tackInv','G',from('function collectionPieces(h,remoteIds=null){','function disposeCollectionTack(rig){')+';return collectionPieces;')(getTackPiece,[],{});
 const shown=collectionPieces({bareback:false},ids);assert.deepEqual(Object.keys(shown),['saddle','pad','bridle']);
 for(const [slot,piece] of Object.entries(shown)){assert.equal(piece.slot,slot);assert.equal(piece.design.nativeOriginal,true);assert.equal(piece.premiumProduct,undefined);}
 assert.deepEqual(collectionPieces({id:7}),{});assert.deepEqual(collectionPieces({id:7,foal:true},ids),{});
});
