/* Extract the actual collision, native-pose and reward seams. Only audio/story
 * outputs and the native pose boundary are spies; collision uses production
 * proxies and grounded resolution. No renderer, network or game-save fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {resolveGroundedContact} from '../assets/grounded-contact.mjs';
import {ridingTravelCredit} from '../assets/riding-distance.mjs';
import {normalizeRidingDistanceSource} from './riding-distance-source-guard.cjs';
import {normalizeRibbonAwardSource} from './ribbon-award-source-guard.cjs';
import {normalizeReviewedWorldSource} from './reviewed-riding-source-guard.cjs';
import {normalizeStarterTackSource,normalizePublishedCacheSource} from './starter-tack-source-guard.cjs';
const root=new URL('../',import.meta.url),source=fs.readFileSync(new URL('ranch3d.html',root),'utf8');
const sha=v=>createHash('sha256').update(v).digest('hex');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,'Production seam exists: '+a);return source.slice(start,end);}
const travel=section(' solidWorld.updateDynamic();',' const winged='),drive=section('function driveRig(','/* Breed colour is done in the shader now'),sample=section(' driveRig(sp,grounded,t,dt);',' driveRider(sp,t,dt);');
const ground=source.match(/^ if\(ridingTravel\.ground>0\)distAcc\+=ridingTravel\.ground;$/m)?.[0];assert(ground,'Lifetime credit uses the measured ground seam');
const credit=section(' if(ridingTravel.gallop>0){',' /* drinking at water */');
const flush=section('  s.stats.dist=(s.stats.dist||0)+Math.round(distAcc);','  s.lastSeen=Date.now();');
function fixture({x=0,z=0,speed=10,heading=0,native=true,solid=false,walls=[],colliders=[],heightAt=()=>0,distAcc=0,rideDistAcc=0}={}){
 const scene=new THREE.Scene(),solidWorld=createSolidWorld({THREE});
 if(solid){const owner=new THREE.Group();scene.add(owner);owner.userData.solidParts=[{min:[-8,-.1,0],max:[8,3,.2],matrix:new THREE.Matrix4().toArray()}];solidWorld.register(owner);}
 const player={pos:new THREE.Vector3(x,0,z),mesh:new THREE.Group(),speed,heading,y:0,vy:0,onFoot:false,flying:false,turnSm:0};
 const events=[],G={horse:{},worldPkg:{vehicle:()=>false}},RIG={ready:native,attachedTo:player.mesh,profile:{nativeBreed:native},heroMotion:native?{state:{gait:'stand',grounded:true},mode:'stand'}:null,heroJumpAge:null,heroJumpExtra:0,heroJumpGrace:0};
 const ctx=vm.createContext({THREE,solidWorld,resolveGroundedContact,ridingTravelCredit,player,RIG,G,colliders,walls,groundH:heightAt,distAcc,rideDistAcc,
  myHorses:[{id:'horse-one'},{id:'horse-two'}],rideIdx:0,ridingIntent:{locked:false},nativeCap:native?{native:true}:null,mission:{type:'gallop'},pose:{gait:'gallop',grounded:true},TACK:{},
  tickGameHero(rig){rig.heroMotion.state={...ctx.pose};rig.heroMotion.mode=ctx.pose.gait;return ctx.pose;},syncNativeActionEmote(){},hideProceduralBody(){},
  questEvt:(type,value)=>events.push({type,value,kind:'quest'}),dailyEvt:(type,value)=>{assert(Number.isFinite(value)&&value>0,'A zero event would become one in production dailyEvt');events.push({type,value,kind:'daily'});},trainXp:value=>events.push({kind:'xp',value})});
 vm.runInContext(drive+`\nfunction frame(dt,afterMovement){const turn=0,yawRate=0,agMul=1;\n${travel}\nif(afterMovement)afterMovement();const sp=Math.abs(player.speed),grounded=player.y<=0,t=0;\n${sample}\n${ground}\nconst m=mission;\n${credit}\nreturn G.horse.frameTravel;}\nfunction flushLifetime(s){${flush}}`,ctx);
 return {ctx,player,RIG,G,events,step:(dt=.1,afterMovement=null)=>ctx.frame(dt,afterMovement),flush:s=>ctx.flushLifetime(s)};
}
const near=(actual,expected,tolerance=1e-8)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const allZero=travel=>{for(const k of ['travel','ground','gallop','bond'])assert.equal(travel[k],0,k);};

test('real authored barn contact cannot earn story, daily, lifetime, XP or bond while the horse presses forward',()=>{
 const f=fixture({solid:true,z:-.552,rideDistAcc:199.9,distAcc:40});
 for(let i=0;i<40;i++)allZero(f.step());near(f.player.pos.z,-.552);assert.deepEqual(f.events,[]);assert.equal(f.ctx.rideDistAcc,199.9);assert.equal(f.ctx.distAcc,40);
});
test('real legacy rail and trunk footprints cannot award nominal gallop travel',()=>{
 for(const options of [{z:-.65,walls:[{x1:-8,z1:0,x2:8,z2:0}]},{z:-1.55,colliders:[{x:0,z:0,r:1,height:3}]}]){
  const f=fixture(options);for(let i=0;i<10;i++)allZero(f.step());assert.deepEqual(f.events,[]);
 }
});
test('wall sliding credits only the actual tangent displacement after all collision substeps',()=>{
 const f=fixture({solid:true,z:-.552,heading:Math.PI/4}),a=f.player.pos.clone(),r=f.step();
 near(f.player.pos.z,a.z);const moved=Math.hypot(f.player.pos.x-a.x,f.player.pos.z-a.z);assert(moved>.70&&moved<.71);near(r.travel,moved);near(r.ground,moved);near(r.gallop,moved);near(r.bond,moved);near(f.ctx.distAcc,moved);near(f.ctx.rideDistAcc,moved);assert.equal(f.events.length,2);for(const e of f.events)near(e.value,moved);
});
test('the terrain boundary produces no reward for an outward gallop',()=>{
 const f=fixture({x:455,heading:Math.PI/2});for(let i=0;i<10;i++)allZero(f.step());near(f.player.pos.x,455);assert.deepEqual(f.events,[]);
});
test('stationary scenery ejection and abnormal moving relocation are rejected rather than capped into rewards',()=>{
 for(const speed of [0,1]){const f=fixture({speed,colliders:[{x:0,z:0,r:10,height:3}]});allZero(f.step());assert(Math.hypot(f.player.pos.x,f.player.pos.z)>10);assert.deepEqual(f.events,[]);}
});
test('sampling is frame-local: fast travel between frames never contributes its relocation distance',()=>{
 const f=fixture();near(f.step().travel,1);f.player.pos.set(200,0,-200);near(f.step().travel,1);near(f.ctx.distAcc,2);near(f.ctx.rideDistAcc,2);assert.equal(f.events.length,4);
});
test('on-foot, vehicle, locked and replaced/missing horses cannot train or earn riding-distance credit',()=>{
 const cases=[f=>{f.player.onFoot=true;},f=>{f.G.worldPkg.vehicle=()=>({kind:'ferry'});},f=>{f.ctx.ridingIntent.locked=true;},f=>{f.ctx.myHorses=[];}];
 for(const configure of cases){const f=fixture();configure(f);allZero(f.step());assert.deepEqual(f.events,[]);}
 const replaced=fixture();allZero(replaced.step(.1,()=>{replaced.ctx.rideIdx=1;}));assert.deepEqual(replaced.events,[]);
 const dismounted=fixture();allZero(dismounted.step(.1,()=>{dismounted.player.onFoot=true;}));assert.deepEqual(dismounted.events,[]);
});
test('native requested gallop downgraded to a refreshed canter earns physical riding credit but no gallop goal',()=>{
 const f=fixture();f.RIG.nativeRequestedGait='gallopLeft';f.RIG.heroMotion.state={gait:'gallop',grounded:true};f.ctx.pose={gait:'canter',grounded:true};const r=f.step();assert.equal(f.RIG.heroMotion.mode,'canter');near(r.travel,1);near(r.ground,1);assert.equal(r.gallop,0);assert.deepEqual(f.events,[]);near(f.ctx.distAcc,1);near(f.ctx.rideDistAcc,1);
});
test('refreshed native takeoff height and grounded state prevent stale grounded goal credit while physical jumping still trains',()=>{
 const f=fixture({rideDistAcc:199.5});f.RIG.heroJumpAge=.6;f.RIG.heroJumpExtra=.5;f.ctx.pose={gait:'jump',grounded:false};const r=f.step();assert.equal(f.player.y,.5);near(r.travel,1);near(r.bond,1);assert.equal(r.ground,0);assert.equal(r.gallop,0);assert.equal(f.ctx.distAcc,0);assert.deepEqual(f.events,[{kind:'xp',value:8}]);near(f.ctx.rideDistAcc,.5);
});
test('a native landing cannot retroactively turn a frame that started airborne into grounded gallop',()=>{
 const f=fixture();f.player.y=.5;f.ctx.pose={gait:'gallop',grounded:true};const r=f.step();assert.equal(f.player.y,0);near(r.travel,1);near(r.bond,1);assert.equal(r.ground,0);assert.equal(r.gallop,0);assert.deepEqual(f.events,[]);
});
test('real horizontal flight retains riding XP policy but earns no ground, gallop or riding bond',()=>{
 const f=fixture({rideDistAcc:199.5});f.player.flying=true;f.player.y=5;f.ctx.pose={gait:'fly',grounded:false};const r=f.step();near(r.travel,1);assert.equal(r.ground,0);assert.equal(r.gallop,0);assert.equal(r.bond,0);assert.deepEqual(f.events,[{kind:'xp',value:8}]);
});
test('legacy gait threshold, reverse and coasting preserve actual physical travel semantics',()=>{
 const gallop=fixture({native:false});near(gallop.step().gallop,1);assert.equal(gallop.events.length,2);
 const trot=fixture({native:false,speed:6});near(trot.step().ground,.6);assert.deepEqual(trot.events,[]);
 const reverse=fixture({native:false,speed:-1.3});const r=reverse.step();near(r.travel,.13);near(r.ground,.13);assert.equal(r.gallop,0);assert.deepEqual(reverse.events,[]);
});
test('zero and invalid frame times/speeds cannot send a zero daily event or change distance accumulators',()=>{
 for(const configure of [f=>{},f=>{f.player.speed=NaN;}]){const f=fixture({distAcc:7,rideDistAcc:8});configure(f);allZero(f.step(0));assert.equal(f.ctx.distAcc,7);assert.equal(f.ctx.rideDistAcc,8);assert.deepEqual(f.events,[]);}
 for(const dt of [-.1,NaN]){const f=fixture({distAcc:7,rideDistAcc:8});allZero(f.step(dt));assert.equal(f.ctx.distAcc,7);assert.equal(f.ctx.rideDistAcc,8);assert.deepEqual(f.events,[]);}
});
test('the actual 200m XP and rounded lifetime save seams pay once from measured travel and retain the remainder',()=>{
 const f=fixture({rideDistAcc:199.5,distAcc:20.25});const first=f.step();assert(Object.isFrozen(first));near(first.travel,1);near(f.ctx.rideDistAcc,.5);assert.equal(f.events.filter(e=>e.kind==='xp').length,1);f.player.speed=0;allZero(f.step());assert.equal(f.events.filter(e=>e.kind==='xp').length,1);
 const saved={stats:{dist:100}};f.flush(saved);assert.equal(saved.stats.dist,121);assert.equal(f.ctx.distAcc,0);f.flush(saved);assert.equal(saved.stats.dist,121);
});
test('straight actual travel produces the same accumulated metres across different frame sizes',()=>{
 const a=fixture(),b=fixture();for(let i=0;i<10;i++)a.step(.1);for(let i=0;i<20;i++)b.step(.05);near(a.ctx.rideDistAcc,10);near(b.ctx.rideDistAcc,10);near(a.ctx.distAcc,b.ctx.distAcc);
});
test('the six exact approved source changes restore the actual8733008 baseline and original protected bodies',()=>{
 const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/riding-distance-8733008/contract.json',import.meta.url))),changes=JSON.parse(fs.readFileSync(new URL('./fixtures/riding-distance-8733008/source-changes.json',import.meta.url)));
 assert.equal(changes.length,6);assert.equal(contract.approvedSourceLiterals,6);assert(changes.every(c=>c.file==='ranch3d.html'&&c.occurrences===1));
 const original=execFileSync('git',['show',contract.baseline+':ranch3d.html'],{cwd:root,encoding:'utf8'});assert.equal(sha(original),contract.beforeSHA256);let authored=original;for(const c of changes){assert.equal(authored.split(c.before).length-1,c.occurrences);authored=authored.replace(c.before,c.after);}assert.equal(sha(authored),contract.sourceSHA256,'The original six-literal release is independently reproducible before later cache edges');assert.equal(normalizeReviewedWorldSource(source,'ranch3d.html'),normalizePublishedCacheSource(original,'ranch3d.html'));assert.equal(normalizeRidingDistanceSource(original,'ranch3d.html'),original);
 assert.equal(normalizeStarterTackSource(source,'ranch3d.html'),fs.readFileSync(new URL('./fixtures/starter-tack-2986289/ranch3d.html',import.meta.url),'utf8'));
 for(const c of changes){assert.throws(()=>normalizeRidingDistanceSource(source+'\n// duplicate '+c.after,'ranch3d.html'));assert.throws(()=>normalizeRidingDistanceSource(source.replace(c.after,c.after.replace('ridingTravel','unreviewedTravel')),'ranch3d.html'));}
 assert.throws(()=>normalizeRidingDistanceSource(source.replace('riding-distance.mjs?v=physical-ride-1','riding-distance.mjs?v=unreviewed-next'),'ranch3d.html'));
 assert.throws(()=>normalizeStarterTackSource(source+'\n// unrelated actor or authorization drift','ranch3d.html'));
});
