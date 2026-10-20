import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createNPCCharacters,npcAppearance,npcUpdateInterval} from '../assets/npc-characters.js';
const settle=()=>new Promise(r=>setTimeout(r,0));
function fixture(options={}){
 const calls={kit:0,build:0,dispose:0,outfits:[]},kit={seat:{relax:new Map()}},entries=[];
 const library={async kit(){calls.kit++;return kit;},async outfitFor(k,id){calls.outfits.push(id);if(options.reject)throw Error('offline');},build(k,fit){
  calls.build++;const root=new THREE.Group(),bones={};
  const body=new THREE.Mesh(),brows=new THREE.Mesh();body.name='body';body.castShadow=true;brows.name='brows';brows.castShadow=false;root.add(body,brows);for(const n of ['neck_01','Head']){bones[n]=new THREE.Bone();root.add(bones[n]);}
  const actions={};return {root,bones,kit:k,fit,actions,action(n){return actions[n]??={time:0,timeScale:1,weight:0,setEffectiveWeight(w){this.weight=w;return this;},getClip(){return {duration:3};}};},
   mixer:{update(dt){this.elapsed=(this.elapsed||0)+dt;}},dispose(){calls.dispose++;}};
 }};
 const system=createNPCCharacters({THREE,riderLibrary:library,onError(){},...options});
 const add=(id,x=0,extra={})=>{const g=new THREE.Group(),fallback=new THREE.Group(),tag=new THREE.Sprite();g.add(fallback,tag);g.position.set(x,2,0);const e={def:{id,...extra},g};entries.push(e);return {e,fallback,tag};};
 const player={x:0,z:0};const update=(extra={})=>system.update(.1,{entries,player,ready:true,...extra});
 return {system,calls,entries,add,update,player};
}

test('known NPCs have stable, distinct existing wardrobe recipes and no riding helmet',()=>{
 const a=npcAppearance({id:'wren'}),b=npcAppearance({id:'june'});
 assert.equal(a.body,'m');assert.equal(a.hairStyle,'beard');assert.notEqual(a.outfit,b.outfit);assert.equal(a.helmet,'none');
 assert.deepEqual(npcAppearance({id:'new-npc'}),npcAppearance({id:'new-npc'}));
 assert.equal(npcUpdateInterval(2),1/30);assert.equal(npcUpdateInterval(30),1/15);assert.equal(npcUpdateInterval(60),1/6);
});
test('no assets load before horse ready; one nearest NPC builds at a time and preserves interaction root/name tag',async()=>{
 const f=fixture(),far=f.add('june',30),near=f.add('wren',3),rider=f.add('mia',1,{rider:true});
 f.update({ready:false});await settle();assert.equal(f.calls.kit,0);
 f.update();assert.equal(f.system.stats().pending,'wren');assert.equal(near.fallback.visible,true);
 await settle();assert.equal(f.calls.build,1);assert.equal(near.fallback.visible,false);assert.equal(near.tag.visible,true);assert.equal(near.tag.parent,near.e.g);
 assert.deepEqual(near.e.g.position.toArray(),[3,2,0]);assert.equal(f.system.get('mia'),null);assert.equal(rider.fallback.visible,true);
 f.update();await settle();assert.ok(f.system.get('june'));assert.equal(f.system.stats().registered,2);f.system.dispose();
});
test('asset failure retains original character and avoids a retry every frame',async()=>{
 const f=fixture({reject:true}),n=f.add('wren');f.update();await settle();
 for(let i=0;i<5;i++)f.update();await settle();assert.equal(f.calls.kit,1);assert.equal(n.fallback.visible,true);assert.equal(n.tag.visible,true);assert.deepEqual(f.system.stats().failed,['wren']);
});
test('bounded cached characters can replace a distant NPC without changing quest entries',async()=>{
 const f=fixture({limit:1}),a=f.add('wren',2),b=f.add('june',40);f.update();await settle();assert.ok(f.system.get('wren'));
 f.player.x=40;f.update();await settle();assert.equal(f.system.get('wren'),null);assert.ok(f.system.get('june'));assert.equal(f.system.stats().active,1);
 assert.equal(a.fallback.visible,true);assert.equal(b.fallback.visible,false);assert.equal(f.entries.length,2);assert.equal(f.calls.dispose,1);f.system.dispose();
});
test('talk blending is bounded and walking NPC path transforms remain owned by the world',async()=>{
 const f=fixture(),n=f.add('wren',2);f.update();await settle();const rootYaw=n.e.g.rotation.y;
 for(let i=0;i<15;i++)f.update({talkingId:'wren'});
 const rig=f.system.get('wren');assert.ok(rig.actions.talk.weight>.9);assert.equal(n.e.g.rotation.y,rootYaw);
 assert.ok(Math.abs(rig.actions.idle.weight+rig.actions.talk.weight+rig.actions.walk.weight-1)<1e-9);
 for(let i=0;i<15;i++)f.update();assert.ok(rig.actions.talk.weight<.01);
 const folk=f.add('folk',0,{folk:true});f.update();await settle();
 for(let i=0;i<15;i++){folk.e.g.position.z+=.09;folk.e.g.rotation.y=.25;f.update({talkingId:'folk'});}
 const walk=f.system.get('folk');assert.ok(walk.actions.walk.weight>.95);assert.equal(folk.e.g.rotation.y,.25);assert.equal(walk.root.rotation.y,0);f.system.dispose();
});
test('disposing while a kit is loading prevents a late replacement',async()=>{
 const f=fixture(),n=f.add('wren');f.update();f.system.dispose();await settle();assert.equal(f.calls.build,0);assert.equal(n.fallback.visible,true);
});

test('distant characters keep their body but stop casting shadows beyond 28m; original mesh flags restore',async()=>{
 const f=fixture(),n=f.add('wren',27);f.update();await settle();const rig=f.system.get('wren');
 const body=rig.root.getObjectByName('body'),brows=rig.root.getObjectByName('brows');
 assert.equal(body.castShadow,true);assert.equal(brows.castShadow,false);
 f.player.x=-1.01;f.update();assert.equal(body.castShadow,false);assert.equal(brows.castShadow,false);assert.equal(rig.root.visible,true);assert.equal(n.fallback.visible,false);
 f.player.x=-1;f.update();assert.equal(body.castShadow,true);assert.equal(brows.castShadow,false);f.system.dispose();
});

test('distance views retain residents through native rig handovers and cull beyond range',async()=>{
 const cards=new Map(),adapter={create(entry){const root=new THREE.Group();entry.g.add(root);const card={root,range:150,ready:true,update(dt,{distance,show}){root.visible=show&&distance<150;},dispose(){root.removeFromParent();}};cards.set(entry.def.id,card);return card;},endFrame(){},stats(){return{};},dispose(){}};
 const f=fixture({distantCharacters:adapter}),n=f.add('wren',100);f.update();await settle();const card=cards.get('wren');
 assert.equal(f.calls.build,0);assert.equal(card.root.visible,true);assert.equal(n.fallback.visible,false);assert.equal(f.system.hasModel('wren'),true);
 f.player.x=98;f.update();await settle();assert.ok(f.system.get('wren'));assert.equal(card.root.visible,false);assert.equal(n.fallback.visible,false);
 f.player.x=0;f.update();assert.equal(f.system.get('wren').root.visible,false);assert.equal(card.root.visible,true);assert.equal(n.fallback.visible,false);
 for(let i=0;i<40;i++)f.update();assert.equal(f.system.get('wren'),null);assert.equal(card.root.visible,true);
 f.player.x=300;f.update();assert.equal(card.root.visible,false);assert.equal(n.fallback.visible,false);assert.equal(n.tag.parent,n.e.g);
 f.system.dispose();assert.equal(card.root.parent,null);
});

// The connected wardrobe keeps footwear in rig.boots, not rig.outfit.meshes.
// Measure every drawn vertex independently of the runtime support helper.
function groundingFixture(id='wren',{legacy=false}={}){
 const entry={def:{id},g:new THREE.Group()},placeholder=new THREE.Group(),tag=new THREE.Sprite();entry.g.add(placeholder,tag);
 const ancestor=new THREE.Group();ancestor.add(entry.g);ancestor.position.set(7,4,-9);ancestor.rotation.y=.43;ancestor.scale.set(1.3,.8,1.1);
 entry.g.position.set(2,3,-1);entry.g.rotation.y=-.64;entry.g.scale.set(.9,1.2,1.05);
 const kit={connectedWardrobe:true},made=[];
 const library={async kit(){return kit;},build(){
  const root=new THREE.Group(),left=new THREE.Bone(),right=new THREE.Bone(),footGroup=new THREE.Group(),hiddenGroup=new THREE.Group();
  root.add(left,right,footGroup,hiddenGroup);footGroup.position.set(.02,.025,-.03);footGroup.rotation.x=.11;footGroup.scale.set(1.1,.9,1.03);hiddenGroup.visible=false;
  const skeleton=new THREE.Skeleton([left,right]),boots=[];
  const boot=(side,depth,parent,joint)=>{
   const geometry=new THREE.BoxGeometry(.14,.08,.32);geometry.translate(side*.15,depth,.075);
   const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
   for(let i=0;i<count;i++){indices[i*4]=joint;weights[i*4]=1;}
   geometry.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
   const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());mesh.name=side>0?'Resident_Boot_Shell':'Modern_Riding_Feet';
   if(side>0)mesh.userData.riderSurfaceRole='footwear';parent.add(mesh);root.updateMatrixWorld(true);mesh.bind(skeleton);boots.push(mesh);return mesh;
  };
  const l=boot(1,-.15,footGroup,0),r=boot(-1,-.15,footGroup,1),hidden=boot(1,-1.2,hiddenGroup,0);
  const rolled=boot(1,.35,footGroup,0);rolled.name='Riding_Boot_Rolled_Edge';rolled.userData.riderSurfaceRole='footwear';
  let elapsed=0;const actions={};
  const rig={root,bones:{},boots,outfit:{meshes:legacy?[l,r]:[]},action(k){return actions[k]??={time:0,timeScale:1,setEffectiveWeight(w){this.weight=w;return this;},getClip(){return {duration:3};}};},
   mixer:{update(dt){elapsed+=dt;left.rotation.x=Math.sin(elapsed*2)*.52;right.rotation.z=Math.cos(elapsed*1.7)*.24;right.position.y=Math.sin(elapsed*1.4)*.07;}},dispose(){for(const m of boots){m.geometry.dispose();m.material.dispose();}}};
  if(legacy){l.name='Legacy_Feet_L';r.name='Legacy_Feet_R';delete l.userData.riderSurfaceRole;}
  made.push({rig,boots,footGroup,hiddenGroup,hidden});return rig;
 }};
 const system=createNPCCharacters({THREE,riderLibrary:library,onError(m,e){throw e||Error(m);}}),player={x:2,z:2};
 const update=(dt=.05,talkingId=null)=>system.update(dt,{entries:[entry],player,ready:true,talkingId});
 function minimum(){
  ancestor.updateMatrixWorld(true);const inverse=entry.g.matrixWorld.clone().invert(),p=new THREE.Vector3();let low=Infinity,count=0;
  for(const mesh of made[0].boots){
   let visible=true,attached=false;for(let n=mesh;n;n=n.parent){if(!n.visible){visible=false;break;}if(n===made[0].rig.root){attached=true;break;}}
   if(!visible||!attached)continue;mesh.skeleton.update();const index=mesh.geometry.index;
   for(let i=0;i<index.count;i++){mesh.getVertexPosition(index.getX(i),p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);low=Math.min(low,p.y);count++;}
  }
  return {low,count};
 }
 return {system,entry,ancestor,made,update,minimum,placeholder,tag};
}

test('current connected boots ground every drawn sole under resident, mesh and ancestor transforms',async()=>{
 for(const id of ['wren','june']){
  const f=groundingFixture(id);const position=f.entry.g.position.clone(),rotation=f.entry.g.quaternion.clone(),scale=f.entry.g.scale.clone();
  f.update();await settle();assert.equal(f.made.length,1);assert.equal(f.made[0].rig.outfit.meshes.length,0);
  assert.ok(f.minimum().count>0);assert.ok(Math.abs(f.minimum().low-.003)<1e-7);
  let minLift=Infinity,maxLift=-Infinity;
  for(let i=0;i<90;i++){
   // Moving ancestors deliberately have stale matrixWorld until the system runs.
   f.ancestor.position.y+=.013;f.ancestor.rotation.y+=.007;
   f.update(.05,i>20&&i<55?id:null);const {low}=f.minimum();assert.ok(Math.abs(low-.003)<1e-7,'actual drawn sole at the interaction floor');
   const y=f.made[0].rig.root.position.y;minLift=Math.min(minLift,y);maxLift=Math.max(maxLift,y);
  }
  assert.ok(maxLift-minLift>.015,'grounding follows changing skeleton pose');
  assert.deepEqual(f.entry.g.position,position);assert.deepEqual(f.entry.g.quaternion.toArray(),rotation.toArray());assert.deepEqual(f.entry.g.scale,scale);
  assert.equal(f.placeholder.visible,false);assert.equal(f.tag.parent,f.entry.g);f.system.dispose();
 }
});

test('hidden and detached footwear never pulls the visible resident above the floor',async()=>{
 const f=groundingFixture();f.update();await settle();const {rig,hiddenGroup,hidden}=f.made[0];
 assert.ok(Math.abs(f.minimum().low-.003)<1e-7);const hiddenLift=rig.root.position.y;
 hiddenGroup.visible=true;f.update();assert.ok(Math.abs(f.minimum().low-.003)<1e-7);assert.ok(rig.root.position.y>hiddenLift+.6);
 hiddenGroup.visible=false;f.update();assert.ok(Math.abs(f.minimum().low-.003)<1e-7);assert.ok(rig.root.position.y<hiddenLift+.1);
 hiddenGroup.visible=true;hidden.removeFromParent();f.update();assert.ok(Math.abs(f.minimum().low-.003)<1e-7);assert.ok(rig.root.position.y<hiddenLift+.1);
 for(const mesh of f.made[0].boots)mesh.visible=false;const before=rig.root.position.y;f.update();assert.equal(rig.root.position.y,before,'no finite support leaves a stable root');
 f.system.dispose();
});

test('legacy Feet-named skinned footwear remains supported without a surface-role marker',async()=>{
 const f=groundingFixture('wren',{legacy:true});f.update();await settle();
 for(let i=0;i<20;i++){f.update();assert.ok(Math.abs(f.minimum().low-.003)<1e-7);}
 f.system.dispose();
});
