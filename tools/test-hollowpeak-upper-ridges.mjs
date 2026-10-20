import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const runtime=process.env.RANCH_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const owner=process.env.HOLLOWPEAK_UPPER_SOURCE||path.join(runtime,'assets/hollowpeak-upper-ridges.mjs');
const {sculptUpperHollowpeakRelief:sculpt,HOLLOWPEAK_UPPER_BOUNDS:bounds,HOLLOWPEAK_UPPER_MAX_RAISE:maxRaise}=await import(pathToFileURL(owner));
const T=await import(pathToFileURL(path.join(runtime,'assets/vendor/three/build/three.module.js')));
const physicalOwner=pathToFileURL(path.join(runtime,'assets/falls-landscape.js'));
const source=readFileSync(process.env.HOLLOWPEAK_FALLS_SOURCE||fileURLToPath(physicalOwner),'utf8');
const sourceFixture=JSON.parse(readFileSync(new URL('./fixtures/hollowpeak-upper-established-source.json',import.meta.url),'utf8'));
const marker='export function alpineRelief(x,z){',privateMarker='function establishedAlpineRelief(x,z){';
const importEdge="import {sculptUpperHollowpeakRelief} from './hollowpeak-upper-ridges.mjs?v=hollowpeak-upper-ridges-3';\n";
const snowMarker='export function alpineSnowAt(x,z)';
const wrapper='export function alpineRelief(x,z){return sculptUpperHollowpeakRelief(x,z,establishedAlpineRelief(x,z));}\n';
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'One exact integration edge: '+a);return s.replace(a,b);};
function integrate(s){return importEdge+once(once(s,marker,privateMarker),snowMarker,wrapper+snowMarker);}
function established(s){
 if(s.includes('sculptUpperHollowpeakRelief')){
  assert(s.startsWith(importEdge),'Known prepend-only sculpt import');
  s=s.slice(importEdge.length);s=once(s,wrapper+snowMarker,snowMarker);s=once(s,privateMarker,marker);
 }
 assert(!s.includes('establishedAlpineRelief')&&!s.includes('sculptUpperHollowpeakRelief'),'No unrecognised nested sculpt owner');
 assert.equal(s.split(marker).length,2);
 assert.equal(createHash('sha256').update(s).digest('hex'),sourceFixture.sha256,'Recovered established owner is byte-exact');
 return s;
}
const baselineSource=established(source);
// Construct both modules from the byte-exact established source, even when
// production already has the sculpt. Never wrap an integrated public sampler.
async function load(s){s=s.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_all,_q,spec)=>'from '+JSON.stringify(new URL(spec,physicalOwner).href));return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));}
const old=await load(baselineSource);
const candidate=await load(once(integrate(baselineSource),importEdge,`import {sculptUpperHollowpeakRelief} from ${JSON.stringify(pathToFileURL(owner).href)};\n`));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/hollowpeak-upper-native-v5.json',import.meta.url),'utf8'));
const step=1000/512,size=513,original=new Float32Array(size*size),after=new Float32Array(size*size),changed=[];
const rawBase=(x,z)=>3+2*Math.sin(x*.023)+1.5*Math.cos(z*.019);
let maxDrop=0,maxGain=0,maxBefore=-Infinity,maxAfter=-Infinity;
for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++){
 const x=ix*step-500,z=iz*step-500,i=iz*size+ix;
 original[i]=old.fallsTerrainHeight(x,z,rawBase(x,z));after[i]=candidate.fallsTerrainHeight(x,z,rawBase(x,z));
 maxBefore=Math.max(maxBefore,original[i]);maxAfter=Math.max(maxAfter,after[i]);
 if(original[i]!==after[i]){changed.push({ix,iz,x,z,i});maxDrop=Math.max(maxDrop,original[i]-after[i]);maxGain=Math.max(maxGain,after[i]-original[i]);}
}
function interpolate(values,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*size+ix,a=values[i],b=values[i+size],c=values[i+size+1],d=values[i+1];return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);}
const beforeHeight=(x,z)=>interpolate(original,x,z),height=(x,z)=>interpolate(after,x,z);
function assertIncidentVerticesUnchanged(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz);for(const dx of[0,1])for(const dz of[0,1]){const i=(iz+dz)*size+ix+dx;assert.equal(after[i],original[i],`Protected contact-cell support ${ix+dx},${iz+dz}`);}}

test('comparison recovers the same byte-exact established owner before or after the known integration',()=>{
 assert.equal(established(integrate(baselineSource)),baselineSource);
 assert.throws(()=>established(integrate(baselineSource).replace('establishedAlpineRelief(x,z));','establishedAlpineRelief(z,x));')),/One exact integration edge/);
});

test('upper sculpt changes substantial existing relief, keeps the main summit and bounds its saddle bridge',(t)=>{
 assert(changed.length>500&&changed.length<2000);assert(maxDrop>10&&maxDrop<25);
 for(let i=0;i<after.length;i++){assert(Number.isFinite(after[i]));assert(after[i]<=original[i]+maxRaise+1e-5);}
 assert(maxGain>1&&maxGain<=maxRaise+1e-5,'Only a bounded upper saddle bridge is added to the same physical grid');
 assert(maxAfter<=maxBefore,'The existing maximum summit height is not exceeded');
 {const x=-194,z=-355,a=old.alpineRelief(x,z),b=sculpt(x,z,a);assert(a-b>=0&&a-b<2,'The established off-center main summit remains recognisable');}
 for(const p of fixture.probes){const h=p.visualSkin;if(!h)continue;const[x,,z]=h.point,a=old.alpineRelief(x,z),delta=sculpt(x,z,a)-a;
  if(p.pixel.id==='western-dome-upper'||p.pixel.id==='western-dome-crown')assert(delta< -5,'Native attributed dome face receives a substantial geometric change');
  if(['central-cleft','front-triangular-buttress','front-ledge'].includes(p.pixel.id)){assert.equal(delta,0);for(const c of h.support)assertIncidentVerticesUnchanged(c.position[0],c.position[2]);}
 }
 t.diagnostic(JSON.stringify({changedCanonicalVertices:changed.length,maxCanonicalDrop:maxDrop,maxCanonicalGain:maxGain,maximumHeightBefore:maxBefore,maximumHeightAfter:maxAfter,changedRows:[Math.min(...changed.map(p=>p.iz)),Math.max(...changed.map(p=>p.iz))]}));
});

test('all changed canonical vertices and incident triangles stay inside the dry support and outside protected probe stencils',()=>{
 assert.equal(step,fixture.step);
 for(const p of changed){
  assert(p.ix>=142&&p.ix<=214);assert(p.iz>=63&&p.iz<=87);
  assert(p.x-step>=-225&&p.x+step<=-80);assert(p.z-step>=-380);
  assert(p.z+step+6< -321,'Even the curvature probe of an incident southern cell is protected');
  assert(old.alpineRelief(p.x,p.z)>10,'The exact compact foot and ten-metre basal band remain unchanged');
 }
 // The analytic hem ends at -329; its canonical incident-cell halo ends at
 // row88 (-328.125), still beyond every protected fall/curvature support.
 for(let z=-328.125;z<=-214;z+=.37)for(const x of[-224,-210,-202,-194,-175,-150,-125,-100,-81])assertIncidentVerticesUnchanged(x,z);
 for(let x=-250;x<=-65;x+=.73)for(const z of[-321,-320,-319])for(const offset of[-6,-1,0,1,6])assertIncidentVerticesUnchanged(x,z+offset);
});

test('bounds and low-relief contact transitions are continuous and invoke no ambient random source',()=>{
 const previous=Math.random;let draws=0;Math.random=()=>{draws++;return .123;};
 try{
  for(let z=-500;z<=500;z+=5)for(let x=-500;x<=500;x+=5)for(const h of[-5,0,3,6,10,10.00001,16,20,30,35,42,60,120,Number.MAX_VALUE]){const y=sculpt(x,z,h);assert(Number.isFinite(y));assert(y<=h+maxRaise);if(h<=10||x<=bounds.x0||x>=bounds.x1||z<=bounds.z0||z>=bounds.z1)assert.equal(y,h);if(h>10)assert(y>=6);if(h>=42)assert(y<=h,'Bridge cannot raise the existing high summit');}
  assert.equal(draws,0);
 }finally{Math.random=previous;}
 for(const h of[NaN,Infinity,-Infinity])assert.throws(()=>sculpt(-194,-348,h),/Finite/);
 const e=1e-4;
 for(const[x,z,dx,dz]of[[bounds.x0,-350,1,0],[bounds.x1,-350,1,0],[-194,bounds.z0,0,1],[-194,bounds.z1,0,1]]){
  const a=sculpt(x-dx*e,z-dz*e,50),b=sculpt(x+dx*e,z+dz*e,50);assert(Math.abs(a-b)<1e-7,'No relief seam at the exact compact boundary');
 }
 const a=sculpt(-194,-345,10),b=sculpt(-194,-345,10+e);assert.equal(a,10);assert(Math.abs((b-a)/e-1)<1e-3,'No first-derivative cusp appears above preserved basal relief');
});

test('current watercourse constants and complete protected route/water contact cells remain exact',()=>{
 assert.deepEqual(candidate.HOLLOWPEAK,old.HOLLOWPEAK);assert.deepEqual(candidate.ALPINE_BOUNDS,old.ALPINE_BOUNDS);
 const route=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
 for(let k=1;k<route.length;k++){const a=route[k-1],b=route[k],length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;for(let t=0;t<=1;t+=.02)for(const offset of[-3,0,3])assertIncidentVerticesUnchanged(a[0]+(b[0]-a[0])*t+nx*offset,a[1]+(b[1]-a[1])*t+nz*offset);}
 for(const p of [old.HOLLOWPEAK.pool,old.HOLLOWPEAK.tarn])for(let a=0;a<Math.PI*2;a+=.1)for(const scale of[0,.5,1,1.55])assertIncidentVerticesUnchanged(p.x+Math.cos(a)*p.r*scale,p.z+Math.sin(a)*p.r*p.aspect*scale);
 for(const[x,z]of old.HOLLOWPEAK.channel)for(const dx of[-6,-3,0,3,6])for(const dz of[-6,0,6])assertIncidentVerticesUnchanged(x+dx,z+dz);
});

test('one main summit feeds a long falling shoulder rather than preserving every prior satellite peak',()=>{
 const shoulder=[[-194,-355],[-185,-361],[-177,-363],[-168,-354],[-158,-347],[-146,-340],[-139,-334],[-127,-336]];
 const heights=shoulder.map(([x,z])=>sculpt(x,z,old.alpineRelief(x,z)));
 for(let k=1;k<heights.length;k++)assert(heights[k]<heights[k-1]-1,'The eastern crest descends toward its broad lower shoulder');
 assert(heights[0]-sculpt(-211,-351,old.alpineRelief(-211,-351))>12,'The old left knob is clearly subordinate');
 assert(old.alpineRelief(-158,-347)-heights[4]>10,'The former eastern summit becomes a lower shoulder');
 let last=Infinity;
 for(let k=1;k<shoulder.length;k++)for(let t=0;t<=1;t+=.02){
  const a=shoulder[k-1],b=shoulder[k],x=a[0]*(1-t)+b[0]*t,z=a[1]*(1-t)+b[1]*t,h=old.alpineRelief(x,z),y=sculpt(x,z,h);
  assert(y-last<.1,'The high connection has no deep V followed by a renewed satellite peak');last=y;
 }
 // An otherwise level source isolates the new sculpt's own broad face shape.
 // Five one-metre steps should read as one sloping face, not the rapidly
 // varying radial curvature that made the first prototype smooth cones.
 const h=[-353,-352,-351,-350,-349].map(z=>sculpt(-194,z,60)),slopes=h.slice(1).map((v,i)=>h[i]-v);
 assert(Math.min(...slopes)>1&&Math.max(...slopes)<1.5);
 assert(Math.max(...slopes)-Math.min(...slopes)<.1,'The directional face continues through several physical cells');
});

test('the real rock/shadow builder retains its mesh budget and derives both surfaces from the revised physical grid',(t)=>{
 const water=new T.MeshPhysicalMaterial();water.userData.plainShader=()=>{};
 function build(module,sample){const scene=new T.Scene(),colliders=[],previous=Math.random;let draws=0;Math.random=()=>{draws++;return .42;};try{return{landscape:module.createFallsLandscape({THREE:T,scene,heightAt:sample,terrainStep:step,waterMaterial:water,colliders,loadTextures:false}),colliders,draws};}finally{Math.random=previous;}}
 const a=build(old,beforeHeight),b=build(candidate,height),A=a.landscape,B=b.landscape;
 try{
  assert.equal(a.draws,b.draws);assert.equal(A.group.children.length,B.group.children.length);
  for(const name of['rock','shadow']){const pa=A[name].geometry.attributes.position,pb=B[name].geometry.attributes.position;assert.equal(pa.count,pb.count);for(let i=0;i<pb.count;i++){assert.equal(pa.getX(i),pb.getX(i));assert.equal(pa.getZ(i),pb.getZ(i));assert(Math.abs(pb.getY(i)-height(pb.getX(i),pb.getZ(i))-.012)<1e-4);}}
  assert.deepEqual(A.shadow.geometry.index.array,B.shadow.geometry.index.array,'Full terrain shadow triangle budget is exact');
  for(const key of['pool','tarn','stream'])for(const attribute of Object.keys(A[key].geometry.attributes))assert.deepEqual(A[key].geometry.attributes[attribute].array,B[key].geometry.attributes[attribute].array,'Fixed water geometry is exact');
  assert.equal(a.colliders.length,b.colliders.length,'Low contour occupancy is unchanged');
  let topChanges=0,maxTopDrop=0,maxTopGain=0;for(let i=0;i<a.colliders.length;i++){const ca={...a.colliders[i]},cb={...b.colliders[i]};assert(cb.topY<=ca.topY+maxRaise+1e-5);maxTopDrop=Math.max(maxTopDrop,ca.topY-cb.topY);maxTopGain=Math.max(maxTopGain,cb.topY-ca.topY);if(ca.topY!==cb.topY)topChanges++;delete ca.topY;delete cb.topY;assert.deepEqual(ca,cb,'Barrier XZ/radius/flags and order are exact');}assert(topChanges>0,'Live cliff tops follow the actual revised relief');
  t.diagnostic(JSON.stringify({cliffBarriers:a.colliders.length,changedLiveTopHeights:topChanges,maxLiveTopDrop:maxTopDrop,maxLiveTopGain:maxTopGain,rockVertices:A.rock.geometry.attributes.position.count,shadowTriangles:A.shadow.geometry.index.count/3}));
 }finally{for(const L of[A,B])L.group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});water.dispose();}
});
