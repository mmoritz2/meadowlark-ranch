/* Production facade/queue orchestration with actual THREE transforms and spy
 * motion/feather boundaries. No browser, network, saved game or source mutation.
 * The helper's physical deformation is covered separately by feather geometry QA. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';

const source=fs.readFileSync(new URL('../assets/game-hero-horse.js',import.meta.url),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,`production seam ${start} is present`);
 return source.slice(a,b).replaceAll('export function','function');
}
const production=[
 section('const pendingNativeFeatherGrooms=','import {captureNativeActionSeat}'),
 section('export function initGameHero(','export function disposeMountedRig('),
 section('export function disposeMountedRig(','export function heroGroomFacade('),
 section('export function tickGameHero(','export function gameHeroSeat('),
 section('export function nativeGroomFacade(','// The approved groom')
].join('\n');
const events=[],created=[],motionOptions=[];
let finishSource=()=>{};
const make=new Function('createNativeDraftFeathers','finishNativeSourceGrooms','createNativeHorseMotion','captureNativeActionSeat','tickNativeHorse',production+'\nreturn {nativeGroomFacade,initGameHero,tickGameHero,disposeMountedRig,finishNativeHorseGrooms};');
const api=make(
 ({scene,profile})=>{
  if(profile?.noFeathers)return null;
  const mesh=new THREE.Object3D();mesh.name='private feather spy';scene.add(mesh);
  const helper={meshes:[mesh],updates:[],resets:0,disposed:false,colors:null,
   update(dt,state){
    assert(!this.disposed,'a disposed helper cannot receive deferred work');
    scene.updateWorldMatrix(true,true);
    const point=scene.getObjectByName('pastern')?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
    this.updates.push({dt,state,point:point.toArray()});events.push(['feather',this]);
   },
   reset(){this.resets++;},
   setColors(options){this.colors=options;},
   inspect(){return {frames:this.updates.length,resets:this.resets};},
   dispose(){this.disposed=true;scene.remove(mesh);}
  };created.push(helper);return helper;
 },
 ()=>{events.push(['source']);finishSource();},
 options=>{
  motionOptions.push(options);
  return {set(mode){this.mode=mode;},dispose(){this.disposed=true;}};
 },
 ()=>{},
 (rig,speed,dt,turn)=>{rig.lastNativeInput={speed,dt,turn};return rig.testState;}
);
let checks=0;
function check(ok,message){assert(ok,message);checks++;}
function eq(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
function rig({noFeathers=false}={}){
 const scene=new THREE.Group(),mount=new THREE.Group(),pastern=new THREE.Object3D();
 pastern.name='pastern';scene.add(pastern);mount.add(scene);
 const out={profile:{nativeBreed:true,noFeathers},scene,nativeRoot:scene,animations:[],testState:{gait:'walk',speedMps:1.6,phase01:.2}};
 api.initGameHero(THREE,out);return {...out,mount,pastern};
}

// Real gameplay entry point installs a deferred facade for each private actor.
const a=rig(),b=rig(),ha=a.groom.feathers,hb=b.groom.feathers;
check(motionOptions.every(o=>o.deferGroom===true),'source motion retains its own deferred pose queue');
check(a.hairMane===a.groom.mane&&a.hairTail===a.groom.tail,'native hair controls retain facade groups');
a.testState={gait:'stand',action:{id:'graze'},speedMps:0,phase01:.7};
api.tickGameHero(a,6,.01,.3);
b.testState={gait:'canter',speedMps:5,phase01:.2};api.tickGameHero(b,5,.006);
b.testState={gait:'canter',speedMps:5,phase01:.4};api.tickGameHero(b,5,.014);
eq(ha.updates.length+hb.updates.length,0,'no native addon update before final actor transforms');
// Both actor movement and deferred source changes happen after tickGameHero.
a.mount.position.set(7,2,-4);a.pastern.position.set(.2,.5,.3);
finishSource=()=>{a.pastern.position.y=.9;};events.length=0;
api.finishNativeHorseGrooms();
eq(events.map(e=>e[0]),['source','feather','feather'],'source pose finishes before both addon samples');
eq(ha.updates.length,1,'one actor gets exactly one feather update');
eq(hb.updates.length,1,'multiple same-frame actor steps coalesce');
check(Math.abs(hb.updates[0].dt-.02)<1e-12,'coalescing retains simulated elapsed time');
check(hb.updates[0].state===b.testState,'coalescing retains latest native pose state');
check(ha.updates[0].state===a.testState,'native authoritative zero action speed is not overwritten by requested travel');
eq(ha.updates[0].point,[7.2,2.9,-3.7],'feathers sample final actor and final source pose');
eq(a.lastNativeInput,{speed:6,dt:.01,turn:.3},'native motion still receives unscaled simulation delta and input');
api.finishNativeHorseGrooms();
eq(ha.updates.length+hb.updates.length,2,'a second flush never double advances a drained actor');
finishSource=()=>{};

// A paused/photo frame may refresh a pose with zero elapsed time, never add time.
api.tickGameHero(a,0,0);api.finishNativeHorseGrooms();
eq(ha.updates.at(-1).dt,0,'photo pause zero delta stays zero through queue');
const beforeBad=ha.updates.length;
for(const dt of [NaN,Infinity,-1])a.groom.update(dt,a.testState);
api.finishNativeHorseGrooms();eq(ha.updates.length,beforeBad,'invalid deltas cannot poison deferred time');

// Reset and disposal remove stale work. The next pose starts a fresh history.
a.groom.update(.1,{phase01:.9});a.groom.reset();api.finishNativeHorseGrooms();
eq(ha.updates.length,beforeBad,'reset drops old pending pose');
eq(ha.resets,1,'reset reaches physical helper');
a.groom.update(.025,{phase01:0});api.finishNativeHorseGrooms();
eq(ha.updates.at(-1).dt,.025,'new pose after reset has no accumulated previous time');
b.groom.update(.2,b.testState);const beforeDispose=hb.updates.length;
api.disposeMountedRig(b);api.finishNativeHorseGrooms();
eq(hb.updates.length,beforeDispose,'rig disposal drops pending work before final frame');
check(hb.disposed&&b.nativeMotion.disposed,'rig disposal releases both source motion and private feathers');
b.groom.update(.02,b.testState);api.finishNativeHorseGrooms();
eq(hb.updates.length,beforeDispose,'a stale disposed facade cannot requeue work');

// Breed Studio/review facades are intentionally immediate and not in the queue.
const previewScene=new THREE.Group(),preview=api.nativeGroomFacade({THREE,scene:previewScene,profile:{}}),hp=preview.feathers;
const previewState={gait:'trot',phase01:.6,speedMps:3};preview.update(.008,previewState);
eq(hp.updates.length,1,'standalone preview updates immediately');
check(hp.updates[0].state===previewState,'standalone actual pose state is preserved');
api.finishNativeHorseGrooms();eq(hp.updates.length,1,'preview is not also updated by global finisher');
preview.reset();eq(hp.resets,1,'deterministic preview seek resets physical history');
preview.mane.visible=false;check(preview.meshes.every(m=>!m.visible),'Hair toggle covers private feathers');
preview.update(0,previewState);eq(hp.updates.at(-1).dt,0,'hidden hair does not manufacture elapsed time');
preview.mane.visible=true;check(preview.meshes.every(m=>m.visible),'Hair toggle restores private feathers');
const colors={maneColor:'#ff00bb'};preview.setColors(colors);check(hp.colors===colors,'existing fantasy color forwarding remains intact');
eq(preview.stats.feathers,{frames:2,resets:1},'inspect getter reflects latest physical state');
preview.dispose();check(hp.disposed,'standalone facade releases private resources');

// Unfeathered natives keep their source groom, do not allocate queue entries.
const ordinary=rig({noFeathers:true});api.tickGameHero(ordinary,1.6,.016);
const beforeEmpty=created.reduce((n,h)=>n+h.updates.length,0);api.finishNativeHorseGrooms();
eq(created.reduce((n,h)=>n+h.updates.length,0),beforeEmpty,'no-addon native does not advance another actor');
eq(ordinary.groom.stats.feathers,null,'unfeathered native stats remain null');
ordinary.groom.reset();api.disposeMountedRig(ordinary);api.disposeMountedRig(a);

// Production call sites must use the wrapper wherever they use tickGameHero.
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
for(const file of ['ranch3d.html','assets/tack-studio.js']){
 const text=read(file),imports=[...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)];
 check(imports.some(m=>m[1].includes('tickGameHero')&&m[1].includes('finishNativeHorseGrooms')&&m[2].includes('game-hero-horse.js')),file+' uses game-hero finisher with native tick');
}
console.log(`Native feather integration: PASS ${checks} checks (actual facade/tick/lifecycle code, final-pose ordering, multi-actor flush, pause/reset/disposal, immediate preview and production callers).`);
