import test from 'node:test';
import assert from 'node:assert/strict';
import {coyoteDryWeight,coyoteCoverDryWeight} from '../assets/biome-weights.mjs';
import {meadowCoverWeight,hasMeadowCover,hasSeedMeadowCover} from '../assets/meadow-biomes.js';
import {meadowGrowthAt,meadowBladeColor} from '../assets/meadow-cover.js';
import {meadowGrazingAt} from '../assets/pastoral-fields.mjs';

const close=(actual,expected,why)=>assert.ok(Math.abs(actual-expected)<1e-12,`${why}: ${actual} != ${expected}`);
const riverAt=x=>120+Math.sin(x*.012)*45;
function withRelief(provider,fn){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'__chalkReliefAt');
 try{if(provider===undefined)delete globalThis.__chalkReliefAt;else globalThis.__chalkReliefAt=provider;return fn();}
 finally{if(previous)Object.defineProperty(globalThis,'__chalkReliefAt',previous);else delete globalThis.__chalkReliefAt;}
}
// Frozen pre-foothill seed acceptance. It is independent of the new ecotone:
// changing visible cover must not change which world-generator RNG calls run.
function oldRamp(a,b,d){const u=d<=a?0:d>=b?1:(d-a)/(b-a);return 3*u*u-2*u*u*u;}
function oldAcceptance(x,z){
 let bits=Math.imul(Math.floor(x*47),374761393)^Math.imul(Math.floor(z*47),668265263);
 bits=Math.imul(bits^(bits>>>13),1274126177);
 const draw=((bits^(bits>>>16))>>>0)/4294967296;
 return draw<Math.min(oldRamp(100,170,Math.hypot(x+220,z-130)),oldRamp(92,158,Math.hypot(x+160,z+210)));
}
// Frozen pre-foothill palette and growth noise; evaluate it separately rather
// than deriving expected values from the newly modified grass functions.
function oldPatch(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 function sample(a,b){let n=Math.imul(a,374761393)^Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
 const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const lo=sample(ix,iz)*(1-u)+sample(ix+1,iz)*u;
 const hi=sample(ix,iz+1)*(1-u)+sample(ix+1,iz+1)*u;
 return lo*(1-v)+hi*v;
}
function oldGrowth(x,z){
 const stand=.65*oldPatch(x/11+3.4,z/11-8.2)+.35*oldPatch(x/29-5.1,z/29+2.7),grazed=meadowGrazingAt(x,z);
 return (.42+stand*.95)*(1-grazed)+(.23+stand*.33)*grazed;
}
function oldPalette(x,z,variation){
 const patch=oldPatch(x/18+8.7,z/18-3.1);
 const dry=Math.max(0,Math.min(1,(oldPatch(x/24-7.4,z/24+6.8)-.42)*3.5))*(1-meadowGrazingAt(x,z)*.85);
 return [.225+patch*.029-dry*.075,.55+variation*.08-dry*.08,.15+variation*.035+dry*.055];
}
function paletteAt(x,z,variation=.5){
 const color={hsl:null,setHSL(...values){this.hsl=values;return this;}};
 assert.equal(meadowBladeColor(color,x,z,variation),color,'palette retains the caller-owned color');
 return color.hsl;
}

test('dry weights are deterministic, finite and bounded across the whole world and relief range',()=>{
 for(let x=-510;x<=510;x+=9.13)for(let z=-510;z<=510;z+=11.27)for(const relief of[-3,0,.12,.61,1.2,1.7,4]){
  const w=coyoteDryWeight(x,z,relief);
  assert.ok(Number.isFinite(w)&&w>=0&&w<=1);
  assert.equal(coyoteDryWeight(x,z,relief),w);
 }
 for(let i=0;i<80;i++){
  const a=i*Math.PI*2/80;
  for(const r of[190,210,450,1000])assert.equal(coyoteDryWeight(-220+Math.cos(a)*r,130+Math.sin(a)*r),0,'distant landscape retains its biome');
 }
 assert.equal(coyoteDryWeight(-220,130),1,'dry basin interior is fully dry');
});

test('the river keeps wet banks green and dries continuously beyond the bank',()=>{
 for(const x of[-235,-220,-205])for(const side of[-1,1]){
  const center=riverAt(x);
  for(const d of[0,3,8.9,9])assert.equal(coyoteDryWeight(x,center+side*d),0,'wet channel margin');
  const values=[9.01,10,12,14,17,19.99,20,23].map(d=>coyoteDryWeight(x,center+side*d));
  for(let i=0;i<values.length;i++){
   assert.ok(values[i]>0&&values[i]<=1);
   if(i)assert.ok(values[i]>=values[i-1],'bank drying does not reverse through the moisture band');
  }
  assert.equal(values.at(-1),1,'dry basin resumes beyond the bank');
  assert.ok(values[0]<.0001&&values[5]>.9999,'river fade meets both banks without a visible step');
 }
});

test('raised Chalk relief suppresses drought smoothly and the cover wrapper reads its provider',()=>{
 const x=-220,z=130,heights=[-1,0,.12,.13,.5,1,1.69,1.7,4],values=heights.map(h=>coyoteDryWeight(x,z,h));
 assert.equal(values[0],1);assert.equal(values[2],1);assert.equal(values.at(-1),0);
 for(let i=1;i<values.length;i++)assert.ok(values[i]<=values[i-1],'raised turf becomes progressively greener');
 assert.ok(values[3]>.999&&values[6]<.001,'relief endpoints are continuous');
 withRelief(undefined,()=>assert.equal(coyoteCoverDryWeight(x,z),coyoteDryWeight(x,z)));
 withRelief((px,pz)=>{assert.equal(px,x);assert.equal(pz,z);return 2;},()=>assert.equal(coyoteCoverDryWeight(x,z),0));
 withRelief(()=>.8,()=>assert.equal(coyoteCoverDryWeight(x,z),coyoteDryWeight(x,z,.8)));
});

test('foothill edges are irregular and continuous across the former circular boundary',()=>{
 const ring=[];let fractional=0;
 for(let i=0;i<160;i++){
  const a=i*Math.PI*2/160,x=-220+Math.cos(a)*135,z=130+Math.sin(a)*135;
  if(Math.abs(z-riverAt(x))>20){const w=coyoteDryWeight(x,z);ring.push(w);if(w>0&&w<1)fractional++;}
  for(const r of[96,130,149.999,150,150.001,172,190]){
   const px=-220+Math.cos(a)*r,pz=130+Math.sin(a)*r,w=coyoteDryWeight(px,pz);
   assert.ok(Math.abs(w-coyoteDryWeight(px+.001,pz))<.001,'no east/west seam');
   assert.ok(Math.abs(w-coyoteDryWeight(px,pz+.001))<.001,'no north/south seam');
  }
 }
 assert.ok(fractional>60,'a broad transition contains intermediate moisture');
 assert.ok(Math.max(...ring)-Math.min(...ring)>.25,'equal-radius sites are not a circular painted ring');
});

test('seed meadow acceptance exactly retains the legacy generator contract',()=>{
 let accepted=0,rejected=0,visibleChanges=0;
 withRelief(undefined,()=>{
  for(let x=-450.37;x<450;x+=3.17)for(let z=-450.29;z<450;z+=4.13){
   const expected=oldAcceptance(x,z),actual=hasSeedMeadowCover(x,z);
   assert.equal(actual,expected,`legacy seed selection at ${x},${z}`);
   actual?accepted++:rejected++;
   const visible=hasMeadowCover(x,z);assert.equal(typeof visible,'boolean');assert.equal(hasMeadowCover(x,z),visible);
   if(visible!==actual)visibleChanges++;
   const weight=meadowCoverWeight(x,z);assert.ok(Number.isFinite(weight)&&weight>=0&&weight<=1);
   if(weight===0)assert.equal(visible,false);if(weight===1)assert.equal(visible,true);
  }
 });
 assert.ok(accepted>1000&&rejected>1000&&visibleChanges>50,'fixture exercises acceptance, rejection and changed visible cover');
 withRelief(()=>2,()=>{for(const [x,z]of[[-220,130],[-130,180],[-320,80],[-160,-210],[0,0]])assert.equal(hasSeedMeadowCover(x,z),oldAcceptance(x,z),'raised turf cannot shift RNG consumption');});
});

test('outside the mask, grass growth and palette retain their previous values',()=>{
 let checked=0;
 withRelief(undefined,()=>{
  for(let x=-450.11;x<=450;x+=13.27)for(let z=-450.29;z<=450;z+=17.13){
   if(coyoteDryWeight(x,z)!==0)continue;
   close(meadowGrowthAt(x,z),oldGrowth(x,z),'outside-mask growth');
   for(const variation of[0,.25,.5,1]){
    const actual=paletteAt(x,z,variation),expected=oldPalette(x,z,variation);
    actual.forEach((v,i)=>close(v,expected[i],'outside-mask palette'));
   }
   checked++;
  }
 });
 assert.ok(checked>2000,'covers farmland, woodland, cold quarters and other distant regions');
});

test('dry-core grass is shorter and warmer while wet and raised turf retain green growth',()=>{
 withRelief(undefined,()=>{
  const x=-220,z=130,original=oldGrowth(x,z),growth=meadowGrowthAt(x,z),color=paletteAt(x,z),green=oldPalette(x,z,.5);
  assert.ok(growth>original*.5&&growth<original*.75,'dry plants remain visible but substantially shorter');
  assert.ok(color[0]<green[0]-.05&&color[1]<green[1]&&color[2]>green[2],'dry foliage tends toward brighter olive/straw');
  const wet=riverAt(x);close(meadowGrowthAt(x,wet),oldGrowth(x,wet),'wet-bank growth');
  paletteAt(x,wet).forEach((v,i)=>close(v,oldPalette(x,wet,.5)[i],'wet-bank palette'));
 });
 withRelief(()=>2,()=>{
  for(const [x,z]of[[-220,130],[-170,110],[-260,170]]){
   close(meadowGrowthAt(x,z),oldGrowth(x,z),'raised Chalk growth');
   paletteAt(x,z).forEach((v,i)=>close(v,oldPalette(x,z,.5)[i],'raised Chalk palette'));
   assert.equal(meadowCoverWeight(x,z),1,'raised Chalk supports meadow cover');
  }
 });
});
