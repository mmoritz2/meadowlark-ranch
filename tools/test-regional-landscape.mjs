import assert from 'node:assert/strict';
import test from 'node:test';
import {REGIONAL_SECTORS,REGIONAL_WEIGHTS_GLSL,regionalAngle,regionWeights,regionWeightsAt,regionalProfile,regionalProfileAt,regionalShoulder} from '../assets/regional-landscape.mjs';
const TAU=Math.PI*2,near=(a,b,epsilon=1e-10)=>assert.ok(Math.abs(a-b)<epsilon,`${a} vs ${b}`);
const angles=Array.from({length:2049},(_,i)=>-Math.PI+i/2048*TAU);

test('compass and named regional anchors agree with world coordinates',()=>{
 near(regionalAngle(1,0),0);near(regionalAngle(0,-1),-Math.PI/2);near(regionalAngle(0,1),Math.PI/2);near(Math.abs(regionalAngle(-1,0)),Math.PI);
 assert.ok(regionWeightsAt(-160,-210).north>.98,'Hollowpeak remains alpine');assert.ok(regionWeightsAt(-300,-320).north>.99,'Frostpine remains alpine');
 assert.ok(regionWeightsAt(-220,130).dry>.95,'Coyote core is dry');assert.ok(regionWeightsAt(-330,300).dry>.60,'Ochre shoulder stays dry');
 assert.ok(regionWeightsAt(220,-110).pastoral>.99,'Barleyfold remains low pastoral country');
});
test('periodic angular seams preserve both values and slopes',()=>{
 for(const phase of[0,.65,2.7,4.2])for(const layer of[0,1,2]){
  for(const a of angles){const p=regionalProfile(a,{phase,layer}),q=regionalProfile(a+TAU,{phase,layer});for(const key of Object.keys(p))near(p[key],q[key],1e-11);}
  const h=1e-7,a=regionalProfile(-Math.PI,{phase,layer}),b=regionalProfile(Math.PI,{phase,layer}),left=regionalProfile(Math.PI-h,{phase,layer}),right=regionalProfile(-Math.PI+h,{phase,layer});
  for(const key of Object.keys(a)){near(a[key],b[key],1e-12);near((a[key]-left[key])/h,(right[key]-b[key])/h,.003);}
 }
});
test('regional profiles and weights stay finite, bounded and normalized',()=>{
 const ranges={north:[0,1],dry:[0,1],pastoral:[0,1],valley:[0,1],heightScale:[.025,1.3],massifScale:[.23,1.04],crestShift:[-.04,.04],shoulderPower:[1.15,2.1],plateau:[0,.58],erosionScale:[0,.19],foldScale:[0,.065],radialWarp:[-48,48],foothillScale:[.18,1.24],foothillRoughness:[.08,1.4],woodlandDensity:[.035,.84]};
 for(const a of angles)for(const phase of[0,.65,2.7,4.2])for(const layer of[0,1,2]){
  const p=regionalProfile(a,{phase,layer});near(p.north+p.dry+p.pastoral,1,1e-12);
  for(const[key,[min,max]]of Object.entries(ranges))assert.ok(Number.isFinite(p[key])&&p[key]>=min-1e-12&&p[key]<=max+1e-12,key+'='+p[key]);
  assert.ok(p.plateau<=p.dry*.58+1e-12,'Shelves stay in dry sectors');
 }
});
test('height and morphology distinguish mountains, dry shelves, green rolls and open saddles',()=>{
 for(const phase of[0,.65,2.7,4.2])for(const layer of[0,1,2]){
  const north=regionalProfile(-1.575,{phase,layer}),dry=regionalProfile(2.8,{phase,layer}),green=regionalProfile(1.7,{phase,layer}),saddle=regionalProfile(2.175,{phase,layer}),east=regionalProfile(.38,{phase,layer});
  assert.ok(north.heightScale>dry.heightScale*1.4);assert.ok(dry.heightScale>green.heightScale*1.3);assert.ok(saddle.heightScale<green.heightScale*.30);assert.ok(east.heightScale<.13&&east.heightScale<green.heightScale*.8);
  assert.ok(dry.plateau>.50&&green.plateau===0);assert.ok(dry.foothillRoughness>green.foothillRoughness*2);assert.ok(saddle.foothillScale<green.foothillScale*.5);assert.ok(saddle.woodlandDensity<green.woodlandDensity*.5);
 }
});
test('named north peaks are retained while southwest and eastern ranges lower',()=>{
 const horn=regionalProfile(Math.PI/2-2.98),wolf=regionalProfile(Math.PI/2-2.30),barrowSummit=regionalProfile(2.275),easternFields=regionalProfile(.53);
 assert.ok(horn.massifScale>1);assert.ok(wolf.massifScale>.95);assert.ok(barrowSummit.massifScale<.30);assert.ok(easternFields.massifScale<.34);
 for(const a of[2.00,2.10,2.20,2.30,2.35])assert.ok(regionWeights(a).valley>.99,'SW valley stays open across its authored core');
});
test('shoulders have bounded monotonic rise and different dry/pastoral cross sections',()=>{
 const dry=regionalProfile(2.8),green=regionalProfile(1.7);
 assert.ok(regionalShoulder(.5,dry)>regionalShoulder(.5,green)+.20,'Dry shoulder reaches a broad shelf sooner');
 for(const p of[regionalProfile(-1.575),dry,green,regionalProfile(2.175)]){
  near(regionalShoulder(0,p),0);near(regionalShoulder(1,p),1);let before=0;
  for(let i=0;i<=100;i++){const v=regionalShoulder(i/100,p);assert.ok(v>=before-1e-12&&v>=0&&v<=1);before=v;}
 }
});
test('GLSL sector constants and Float32 weight evaluation agree with JS',()=>{
 const windows=Object.fromEntries([...REGIONAL_WEIGHTS_GLSL.matchAll(/float (\w+)=regionalWindow\(angle,([\d.-]+),([\d.]+),([\d.]+)\)/g)].map(([,name,c,k,e])=>[name,[+c,+k,+e]]));
 assert.equal(Object.keys(windows).length,6);
 const code=REGIONAL_WEIGHTS_GLSL.replace(/\/\/[^\n]*/g,'');
 assert.ok(!/\b(?:atan|sin|cos)\s*\(/.test(code),'Only the consumer computes atan; sector masks require no trigonometry');
 assert.equal((code.match(/\bmod\s*\(/g)||[]).length,1,'Angular normalization occurs once');
 const f=Math.fround,pi=f(Math.PI),tau=f(TAU),wrap=a=>{a=f(a);if(a>=-pi&&a<=pi)return a;const shifted=f(a+pi);return f(f(shifted-f(tau*Math.floor(f(shifted/tau))))-pi);};
 const win=(a,[c,k,e])=>{const direct=f(Math.abs(f(a-f(c)))),d=f(Math.min(direct,f(tau-direct))),t=f(Math.max(0,Math.min(1,f(f(d-f(k))/f(f(e)-f(k))))));return f(1-f(f(f(t*t)*t)*f(f(t*f(f(t*6)-15))+10)));};
 for(const a of [...angles,...angles.map(a=>a+TAU),...angles.map(a=>a-TAU)]){const wrapped=wrap(a),values=Object.fromEntries(Object.entries(windows).map(([name,sector])=>[name,win(wrapped,sector)])),arid=f(1-f(f(1-values.western)*f(1-f(.62*values.ochreWindow)))),actual=[values.north,f(f(1-values.north)*arid),f(f(1-values.north)*f(1-arid)),f(1-f(f(f(1-values.southwest)*f(1-f(.72*values.eastWindow)))*f(1-f(.55*values.southeast))))],expected=regionWeights(a);[expected.north,expected.dry,expected.pastoral,expected.valley].forEach((v,i)=>near(v,actual[i],Math.abs(a)<=Math.PI?5e-6:2e-5));}
});
test('no random-stream consumption, repeatable coordinate wrappers and explicit invalid inputs',()=>{
 const random=Math.random;Math.random=()=>{throw new Error('World RNG consumed');};try{
  for(const [x,z]of[[-800,420],[-700,-900],[800,700],[0,0]])assert.deepEqual(regionalProfileAt(x,z,{phase:4.2,layer:2}),regionalProfile(regionalAngle(x,z),{phase:4.2,layer:2}));
  assert.deepEqual(regionalProfile(2.8),regionalProfile(2.8));
 }finally{Math.random=random;}
 for(const f of[()=>regionWeights(NaN),()=>regionalProfile(Infinity),()=>regionalProfile(0,{phase:NaN}),()=>regionalProfile(0,{layer:Infinity}),()=>regionalAngle(1,NaN)])assert.throws(f);
 assert.ok(Object.isFrozen(REGIONAL_SECTORS)&&Object.values(REGIONAL_SECTORS).every(Object.isFrozen));
});
