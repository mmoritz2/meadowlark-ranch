import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createFollowCamera} from '../assets/follow-camera.js';
import {createRidingCamera} from '../assets/riding-camera.mjs';
const source=fs.readFileSync(new URL('../assets/features/course-guide.js',import.meta.url),'utf8');
const HER=new Function('return '+source.match(/const HER=(\[.*\]);/)[1])();
const input=(p={})=>({active:true,x:0,z:0,groundY:0,height:0,heading:0,speed:0,dt:1/60,aspect:16/9,mountScale:1,mountId:'Bramble',zoom:1,orbitYaw:0,orbitPitch:0,...p});
function subjectPoints(p){const scale=p.mountScale||1,sn=Math.sin(p.heading),cs=Math.cos(p.heading),out=[];for(const b of HER)for(const x of[-b[0],b[0]])for(const y of[b[1],b[2]])for(const z of[b[3],b[4]])out.push(new THREE.Vector3(p.x+(x*cs+z*sn)*scale,p.groundY+(p.height||0)+y*scale,p.z+(-x*sn+z*cs)*scale));return out;}
function visible(cam,p,label,margin=1){cam.updateMatrixWorld();for(const at of subjectPoints(p)){const ndc=at.clone().project(cam);assert(Math.abs(ndc.x)<margin&&Math.abs(ndc.y)<margin&&ndc.z>-1&&ndc.z<1,`${label}: subject projected ${ndc.toArray()}`);}}
function rig({aspect=16/9,solids=[]}={}){const composition=createRidingCamera(),collision=createFollowCamera({THREE,groundHeight:()=>0});for(const s of solids)collision.register(s);const cam=new THREE.PerspectiveCamera(52,aspect,.1,1000),anchor=new THREE.Vector3(),wanted=new THREE.Vector3(),safe=new THREE.Vector3(),ray=new THREE.Raycaster();let frame;
 return {cam,composition,step(p){frame=composition.update(p);assert(frame.active);anchor.set(frame.anchor.x,frame.anchor.y,frame.anchor.z);wanted.set(frame.desired.x,Math.max(.7,frame.desired.y),frame.desired.z);collision.frame(anchor,wanted,safe,Math.min(.1,p.dt));if(frame.snap)cam.position.copy(safe);else cam.position.lerp(safe,frame.blend);collision.resolve(anchor,cam.position,cam.position);const at=composition.aim(cam.position);cam.fov=frame.fov;cam.updateProjectionMatrix();cam.lookAt(at.x,at.y,at.z);cam.updateMatrixWorld();const direction=cam.position.clone().sub(anchor);ray.set(anchor,direction.normalize());ray.far=anchor.distanceTo(cam.position);assert.equal(ray.intersectObjects(solids).length,0,'independent rendered triangle ray from rider remains clear');return frame;}};
}
function box(w,h,d,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.position.set(x,y,z);return m;}
test('reuses output/vectors, leaves frozen inputs untouched and rejects invalid or inactive ownership',()=>{
 const c=createRidingCamera(),p=Object.freeze(input()),a=c.update(p),look=a.look,anchor=a.anchor,desired=a.desired;assert.equal(c.update(p),a);assert.equal(a.look,look);assert.equal(a.anchor,anchor);assert.equal(a.desired,desired);assert.equal(c.aim(Object.freeze({x:0,y:3,z:-6})),look);
 for(const bad of[input({active:false}),input({x:NaN}),input({heading:Infinity}),input({dt:-1})])assert.equal(c.update(bad).active,false);assert(c.update(input()).snap);
});
test('continuous physical travel opens lookahead without a7m/s threshold, stopped obstacles do not maintain speed framing',()=>{
 const c=createRidingCamera();let z=0;for(let n=0;n<180;n++)c.update(input());const idle={...c.update(input())};for(let n=0;n<240;n++){z+=10/60;c.update(input({z,speed:10}));}const moving={...c.update(input({z:z+10/60,speed:10}))};assert(moving.lead>idle.lead+.8);assert(moving.fov>idle.fov+1);assert(moving.distance>idle.distance);
 const before=moving.fov;let out;for(let n=0;n<240;n++)out=c.update(input({z,speed:10}));assert(out.fov<before-1,'motionless rider with requested speed does not keep speed effect');
 const small=createRidingCamera();small.update(input({speed:6.99}));const lo=small.update(input({z:6.99/60,speed:6.99})).fov;const hi=small.update(input({z:(6.99+7.01)/60,speed:7.01})).fov;assert(Math.abs(hi-lo)<.02,'no FOV step across previous threshold');
});
test('mount change/teleport cuts stale composition, while a bounded long frame stays finite',()=>{
 const c=createRidingCamera();c.update(input());for(let n=1;n<100;n++)c.update(input({z:n*.15,speed:9}));assert.equal(c.update(input({z:15,speed:9})).snap,false);
 const big=c.update(input({x:200,z:80,mountId:'Shire',mountScale:1.4}));assert(big.snap);assert.equal(big.anchor.x,200);assert.equal(big.anchor.z,80);assert(big.distance>8);assert(c.update(input({x:200,z:80,mountId:'Shire',mountScale:1.4,dt:2})).snap);for(const n of[big.distance,big.pitch,big.fov,big.desired.x,big.look.y])assert(Number.isFinite(n));c.reset();assert(c.update(input()).snap);
});
test('normal desktop and portrait composition keeps original horse/rider hull visible at halt, canter, turns and jump height',()=>{
 for(const aspect of[16/9,390/844])for(const scale of[.65,1,1.45]){
  const r=rig({aspect});let x=0,z=0,heading=0;
  for(let n=0;n<600;n++){const speed=n<120?0:n<300?7:10,turn=n>=300&&n<510?.65:0;heading+=turn/60;x+=Math.sin(heading)*speed/60;z+=Math.cos(heading)*speed/60;const height=n>530?Math.sin((n-530)/70*Math.PI)*1.1:0,p=input({aspect,mountScale:scale,x,z,heading,speed,height});r.step(p);visible(r.cam,p,`aspect${aspect} scale${scale} frame${n}`,1.01);}
 }
});
test('user orbit/zoom stays authoritative and side views keep rider head and feet visible',()=>{
 for(const aspect of[16/9,390/844]){const c=createRidingCamera(),wide=c.update(input({aspect,orbitYaw:1.2,manualOrbit:true,zoom:1.4}));assert.equal(wide.lead,0);const yaw=Math.atan2(-wide.desired.x,-wide.desired.z);assert(Math.abs(yaw-1.2)<1e-8);const distance=wide.distance;c.reset();assert(c.update(input({aspect,orbitYaw:1.2,manualOrbit:true,zoom:.7})).distance<distance*.6);}
 const r=rig({aspect:390/844});for(let n=0;n<200;n++){const p=input({aspect:390/844,orbitYaw:.6,manualOrbit:true,zoom:1.2});r.step(p);visible(r.cam,p,'manual portrait',1.01);}
});
test('collision-retracted view reduces lead immediately and never moves safe camera to improve composition',()=>{
 const c=createRidingCamera();let f;for(let n=0;n<180;n++)f=c.update(input({z:n/6,speed:10}));const far={x:f.anchor.x,y:3,z:f.anchor.z-7},near={x:f.anchor.x,y:2.4,z:f.anchor.z-3},before=JSON.stringify(near);const farAim={...c.aim(far)},nearAim={...c.aim(near)};assert(Math.hypot(nearAim.x-f.anchor.x,nearAim.z-f.anchor.z)<Math.hypot(farAim.x-f.anchor.x,farAim.z-f.anchor.z));assert.equal(JSON.stringify(near),before);assert.equal(f.anchor.z,179/6,'collision origin remains rider, not forward aim');
});
test('actual follow-camera wall/corner sweeps keep independent rider sightline clear through turns in both aspects',()=>{
 for(const aspect of[16/9,390/844])for(const sign of[-1,1]){
  const solids=[box(6,5,.2,0,2.5,-3),box(.2,5,5,3*sign,2.5,-5.5)],r=rig({aspect,solids});let last=null,maxStep=0;
  for(let n=0;n<420;n++){const x=(-6+n*.025)*sign,z=.8,heading=Math.PI/2*sign+.25*Math.sin(n/100),p=input({aspect,x,z,heading,speed:1.5});const f=r.step(p);if(last)maxStep=Math.max(maxStep,r.cam.position.distanceTo(last));last=r.cam.position.clone();assert(Number.isFinite(f.look.y));visible(r.cam,p,'corner'+n,1.05);}
  assert(maxStep<.5,'bounded wall/corner transition '+maxStep);
 }
});
function cameraRegistration(text=source){const source=text,start=source.indexOf(" G.on('camera',c=>{");assert(start>=0);let depth=0,quote=null,comment=null;for(let n=source.indexOf('(',start);n<source.length;n++){const c=source[n],next=source[n+1];if(comment==='line'){if(c==='\n')comment=null;continue;}if(comment==='block'){if(c==='*'&&next==='/'){comment=null;n++;}continue;}if(quote){if(c==='\\'){n++;continue;}if(c===quote)quote=null;continue;}if(c==='/'&&next==='/'){comment='line';n++;continue;}if(c==='/'&&next==='*'){comment='block';n++;continue;}if(c==='\''||c==='"'||c==='`'){quote=c;continue;}if(c==='(')depth++;if(c===')'&&--depth===0)return source.slice(start,n+1);}throw Error('actual registration boundary');}
function actualHook({aspect=16/9,scale=1,solids=[],text=source,ground=()=>0,waterSurface=null}={}){const source=text;const G={on(k,fn){this.hook=fn;},camera:new THREE.PerspectiveCamera(52,aspect,.1,1000),horse:{RIG:()=>({profile:{}}),ridden:()=>({id:'Bramble'})}},player={pos:{x:0,z:0},heading:0,speed:0,y:0,mesh:{scale:{x:1}}},F={u:0,head:null,yaw:0,pitch:0,zoom:1,occ:1,drag:null,placed:false,own:false,broke:0,frames:0,nudgeP:0,nudgeO:0,wantP:0,wantO:0,hidden:false,walk:1};const CAM=new Function('return '+source.slice(source.indexOf(' const CAM={')+11,source.indexOf('\n };',source.indexOf(' const CAM={'))+3))();
 let lastFrame;const mountedCamera=createRidingCamera(),events=[],helper={update(i){events.push(i.active?'horse':'legacy');return lastFrame=mountedCamera.update(i);},aim:p=>mountedCamera.aim(p),reset:()=>mountedCamera.reset()},W={groundH:ground,loonLake:{waterAt:()=>waterSurface===null?null:{surface:waterSurface}},followCamera:createFollowCamera({THREE,groundHeight:ground})},_seen=new THREE.Vector3();let foreign=false,time=0;for(const solid of solids)W.followCamera.register(solid);
 const env={G,player,F,CAM,W,THREE,mountedCamera:helper,mountedCameraInput:{},_seen,followInput:{update(){},suspend(){},grace:0},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),angDiff:a=>Math.atan2(Math.sin(a),Math.cos(a)),foreignCam:()=>foreign,clearPeople(){},nextSight:()=>false,T:{},hidesBehindHer:()=>false,herScale:()=>scale,HER_H:2.47,inCanopy:()=>0,sightBlocked:()=>false,eyeCost:()=>0,tickPeople(){},_eye:new THREE.Vector3(),_look:new THREE.Vector3(),_anchor:new THREE.Vector3()};new Function(...Object.keys(env),cameraRegistration(source))(...Object.values(env));
 return {G,F,player,events,env,get frame(){return lastFrame;},foreign:v=>foreign=v,tick(dt=1/60){_seen.copy(G.camera.position);return G.hook({dt,t:time+=dt,sp:Math.abs(player.speed),grounded:true,camLook:new THREE.Vector3(),camDesired:new THREE.Vector3(),camSafe:new THREE.Vector3()});}};
}
test('actual installed owner uses the new helper for groundhorse and retains foreign/onfoot/dragon/flight ownership',()=>{
 const r=actualHook();assert.equal(r.tick(),true);assert.deepEqual(r.events,['horse']);assert.equal(r.F.broke,0);r.player.speed=8;r.player.pos.z+=.1;assert.equal(r.tick(),true);assert.equal(r.F.own,true);
 r.foreign(true);const before=r.G.camera.position.clone(),calls=r.events.length;assert.equal(r.tick(),false);assert.equal(r.events.length,calls);assert(r.G.camera.position.equals(before));
 r.foreign(false);r.G.horse.RIG=()=>({profile:{nativeDragon:true,nativeKind:'black-dragon'}});assert.equal(r.tick(),true);assert.equal(r.events.at(-1),'legacy');r.G.horse.RIG=()=>({profile:{}});r.player.flying=true;assert.equal(r.tick(),true);assert.equal(r.events.at(-1),'legacy');r.player.flying=false;r.player.onFoot=true;assert.equal(r.tick(),true);assert.equal(r.events.at(-1),'legacy');
});
test('production hook does not shake a halted scene just because requested speed is high; rider position/save stay untouched',()=>{
 const r=actualHook();r.player.speed=10;for(let n=0;n<600;n++)assert.equal(r.tick(),true);const before=JSON.stringify(r.player),a=r.G.camera.quaternion.clone();assert.equal(r.tick(),true);assert.equal(JSON.stringify(r.player),before);assert(a.angleTo(r.G.camera.quaternion)<1e-5);assert(r.G.camera.fov<53,'no motion means speed effect settles');assert.equal(r.F.broke,0);
});

test('actual installed hook retains whole rider projection and rendered wall clearance through a turn',()=>{
 for(const aspect of[16/9,390/844])for(const scale of[.7,1.4]){
  const solids=[box(5,5,.2,0,2.5,-3)],r=actualHook({aspect,scale,solids}),ray=new THREE.Raycaster();
  for(let n=0;n<300;n++){r.player.pos.x=-5+n*.025;r.player.pos.z=.8;r.player.heading=Math.PI/2+.3*Math.sin(n/80);r.player.speed=1.5;assert.equal(r.tick(),true);assert.equal(r.F.broke,0);visible(r.G.camera,{...input(),x:r.player.pos.x,z:.8,heading:r.player.heading,mountScale:scale},'production hook'+n,1.05);const anchor=r.env._anchor,direction=r.G.camera.position.clone().sub(anchor);ray.set(anchor,direction.normalize());ray.far=anchor.distanceTo(r.G.camera.position);assert.equal(ray.intersectObjects(solids).length,0,'production collision-recheck keeps rendered subject sightline');}
 }
});
test('dragon and flight camera positions/FOV remain identical to raw17a owner through movement and orbit',()=>{
 const old=execFileSync('git',['show','17a656b0c98e9c70c8cc8c45af5c58d252809ca4:assets/features/course-guide.js'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 for(const profile of[{nativeDragon:true,nativeKind:'black-dragon'},{nativeDragon:true,nativeKind:'european-dragon'},{}]){const a=actualHook(),b=actualHook({text:old});a.G.horse.RIG=b.G.horse.RIG=()=>({profile});a.player.flying=b.player.flying=!profile.nativeDragon;
  for(let n=0;n<150;n++){for(const r of[a,b]){r.player.pos.x=n*.03;r.player.pos.z=n*.1;r.player.heading=n*.005;r.player.speed=8;r.player.y=r.player.flying?6:0;r.F.yaw=.2;r.F.zoom=1.1;assert.equal(r.tick(),true);assert.equal(r.F.broke,0);}assert(a.G.camera.position.distanceTo(b.G.camera.position)<1e-10);assert.deepEqual(a.G.camera.quaternion.toArray(),b.G.camera.quaternion.toArray());assert.equal(a.G.camera.fov,b.G.camera.fov);}
 }
});

test('actual slow-frame owner supplies raw elapsed time for physical speed and long-gap reset',()=>{
 const r=actualHook();assert(r.tick());r.player.speed=4;for(let n=0;n<40;n++){r.player.pos.z+=1;assert(r.tick(.25));}assert(r.frame.lead<1.3,'four actual metres per second is not camera-gallop at250ms');assert.equal(r.env.mountedCameraInput.dt,.25);assert(r.tick(1));assert.equal(r.frame.snap,true,'actual long gap reaches reset policy');assert.equal(r.F.broke,0);
});
test('actual native jump follows rendered root lift when player.y is zero, with one damping pass',(t)=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets/models/horse-motions/manifest.json',import.meta.url),'utf8')),keys=manifest.breeds.black.nativeJump.actorLiftM;
 assert(Math.max(...keys.map(k=>k[1]))>.6,'actual shipped native jump curve');
 for(const aspect of[16/9,390/844]){
  const r=actualHook({aspect}),reference=actualHook({aspect});for(const a of[r,reference]){a.G.horse.RIG=()=>({profile:{nativeBreed:true,nativeKind:'horse'}});a.player.mesh.position={y:0};for(let n=0;n<180;n++)assert(a.tick());}
  let projectionDrift=0,heightError=0;
  for(const [time,lift] of keys){r.player.y=0;reference.player.y=lift;for(const a of[r,reference]){a.player.mesh.position.y=lift;assert(a.tick());assert.equal(a.F.broke,0);}const damped=Math.min(2,lift)*.8+Math.max(0,lift-2);heightError=Math.max(heightError,Math.abs(r.env.mountedCameraInput.height-damped));
   const head=new THREE.Vector3(0,lift+2.47,0),a=head.clone().project(r.G.camera),b=head.clone().project(reference.G.camera);projectionDrift=Math.max(projectionDrift,Math.abs(a.y-b.y));visible(r.G.camera,{...input(),aspect,height:lift},'actual native jump '+time,1.03);}
  t.diagnostic(JSON.stringify({aspect,nativeRenderedVsPlayerLiftProjectionDrift:projectionDrift,maxDampedHeightError:heightError}));assert(projectionDrift<.02,'identical rendered jump should retain the same rider framing whether player.y mirrors lift: '+projectionDrift);assert(heightError<1e-9,'rendered lift is damped exactly once');
  r.player.mesh.position.y=0;for(let n=0;n<180;n++)assert(r.tick());visible(r.G.camera,{...input(),aspect},'native landing',1.01);
 }
});

test('swimming camera matches raw579 upstream water-surface framing instead of the submerged bed',()=>{
 const old=execFileSync('git',['show','579b5cfc56f4163e1f28a4e6768d7e3e0e692945:assets/features/course-guide.js'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 for(const aspect of[16/9,390/844]){const ground=(x,z)=>-1.4-.02*z,surface=.7,a=actualHook({aspect,ground,waterSurface:surface}),b=actualHook({aspect,ground,waterSurface:surface,text:old});
  for(let n=0;n<180;n++){for(const r of[a,b]){r.player.swim=true;r.player.mesh.position={y:surface};r.player.pos.x=n*.02;r.player.pos.z=n*.04;r.player.speed=2.4;r.player.heading=.3;r.F.yaw=.2;r.F.zoom=1.1;assert(r.tick());assert.equal(r.F.broke,0);}assert.equal(a.events.at(-1),'legacy');assert.deepEqual(a.G.camera.position.toArray(),b.G.camera.position.toArray());assert.deepEqual(a.G.camera.quaternion.toArray(),b.G.camera.quaternion.toArray());assert.equal(a.G.camera.fov,b.G.camera.fov);assert(Math.abs(a.env._anchor.y-(surface+1.45))<1e-9,'anchor follows upstream lake surface, not bed');}
 }
});
