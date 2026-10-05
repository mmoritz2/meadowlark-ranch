import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const moduleFrom=async path=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(path,import.meta.url),'utf8')).toString('base64'));
const THREE=await moduleFrom('../assets/vendor/three/build/three.module.js');
const {createNPCCharacters,npcAppearance,npcUpdateInterval}=await moduleFrom('../assets/npc-characters.js');
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
