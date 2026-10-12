import test from 'node:test';
import assert from 'node:assert/strict';
import {fallsRelief,fallsTerrainHeight,HOLLOWPEAK,fallsRadius} from '../assets/falls-landscape.js';

// A metre-scale finite difference measures the visible face itself. The old
// repeated shelf cuts produced peaks above 3.5 m/m² in every one of these cuts.
test('front buttress lips round into continuous worn faces rather than repeat square shelf cuts',()=>{
 for(const x of [-174,-173,-170,-122,-120,-119,-116]) {
  let maximumCurvature=0,reliefMaximum=0;
  for(let z=-250;z< -225;z+=.05){
   const d=.05,h=fallsRelief(x,z);
   const curvature=Math.abs((fallsRelief(x,z+d)-2*h+fallsRelief(x,z-d))/(d*d));
   assert(Number.isFinite(h+curvature));
   maximumCurvature=Math.max(maximumCurvature,curvature);reliefMaximum=Math.max(reliefMaximum,h);
  }
  assert(maximumCurvature<1.4,`Square shoulder lip at x=${x}: ${maximumCurvature} m/m²`);
  assert(reliefMaximum>8,'The shoulder remains a substantial directional rock face');
 }
});

test('dry shoulder shapes leave the protected channel and the Frostpine approach intact',()=>{
 const trail=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
 for(let i=1;i<trail.length;i++)for(let t=0;t<=1;t+=.01){
  const a=trail[i-1],b=trail[i],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  assert.equal(fallsTerrainHeight(x,z,3),3,'Protected approach changed');
 }
 for(const basin of [HOLLOWPEAK.pool,HOLLOWPEAK.tarn])for(let a=0;a<Math.PI*2;a+=.071){
  const r=fallsRadius(a,basin),x=basin.x+Math.cos(a)*r*.8,z=basin.z+Math.sin(a)*r*.8*basin.aspect;
  assert(fallsTerrainHeight(x,z,3)<basin.level+.4,'The physical pool bed intersects its water');
 }
});

test('shoulder field stays finite, bounded and deterministic without consuming the scene random stream',()=>{
 const previous=Math.random;
 try {
  Math.random=()=>assert.fail('Terrain shaping consumed scene RNG');
  for(let z=-324;z< -211;z+=1.71)for(let x=-205;x< -96;x+=1.33){
   const h=fallsRelief(x,z);assert(Number.isFinite(h)&&h>=0&&h<64);
   assert.equal(fallsRelief(x,z),h);
   if(x<=-202||x>=-100||z<=-321||z>=-214) {
    // Other alpine ridges may still own a height, but falls cannot invent a
    // front bank beyond its existing local envelope.
    if(z>=-253)assert.equal(h,0);
   }
  }
 } finally {Math.random=previous;}
});
