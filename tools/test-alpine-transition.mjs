import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hollowpeakFoothillThaw,HOLLOWPEAK_SNOW_GLSL} from '../assets/hollowpeak-snow.mjs';

test('low front foothills fully thaw while raised or distant northern deposits remain',()=>{
 for(const x of [-250,-160,-60])for(const z of [-270,-240,-160]){
  assert.equal(hollowpeakFoothillThaw(x,z,2),1);
  assert.equal(hollowpeakFoothillThaw(x,z,19),0);
 }
 assert.equal(hollowpeakFoothillThaw(-150,-360,2),0);
 assert(hollowpeakFoothillThaw(-150,-316,11)>.1);
 assert(hollowpeakFoothillThaw(-150,-316,11)<.5);
});

test('the thaw front is continuous, bounded and removes snow without making fresh contour ribbons',()=>{
 let largest=0;
 for(let z=-390;z<=-130;z+=1.73)for(let h=-8;h<=72;h+=.719){
  const a=hollowpeakFoothillThaw(-150,z,h),b=hollowpeakFoothillThaw(-150,z+.001,h+.001);
  assert(Number.isFinite(a)&&a>=0&&a<=1);
  largest=Math.max(largest,Math.abs(a-b));
  for(const previous of [0,.25,.5,1]){
   const next=previous*(1-a);
   assert(next>=0&&next<=previous,'thaw cannot create a white ridge or new snow island');
  }
 }
 assert(largest<.00012);
});

test('one shared CPU and shader field stays independent of terrain generation and random state',()=>{
 const before=Math.random;
 Math.random=()=>assert.fail('material field consumed RNG');
 try{for(let i=0;i<1000;i++)hollowpeakFoothillThaw(i*.8-500,i*.41-500,i*.1-20);}
 finally{Math.random=before;}
 assert.match(HOLLOWPEAK_SNOW_GLSL,/smoothstep\(-356\.0,-276\.0,p\.y\)\*\(1\.0-smoothstep\(4\.0,18\.0,height\)\)/);
 assert.doesNotMatch(HOLLOWPEAK_SNOW_GLSL,/texture|sampler|uniform|time|camera/);
});

test('only the riding terrain changes and shared photographed cold ground still owns the thaw',()=>{
 const source=readFileSync(new URL('../assets/terrain-realism.js',import.meta.url),'utf8');
 const begin=source.indexOf('// HOLLOWPEAK_SNOW_DEPOSITS_V1'),end=source.indexOf('#endif',begin),part=source.slice(begin,end);
 assert(part.includes('snow*=1.0-foothillThaw;'));
 assert(part.includes('thawLitter=max(thawLitter,snowRegion*foothillThaw);'));
 assert(source.indexOf('float foothillThaw=')<source.indexOf('float coldPowder=snow;'));
 assert(source.includes('if(canopy>0.003||bank>0.003||wear>0.004||thawLitter>0.003) earth=texture2D(terrainForest,earthUV).rgb;'));
 assert(source.includes('vec3 edgeGround=earth*vec3(.89,.92,.91)'));
 assert(!part.includes('texture2D'),'composition adds no texture sample');
 assert(source.slice(source.lastIndexOf('#ifndef OUTER_LANDSCAPE',begin),begin).includes('#ifndef OUTER_LANDSCAPE'));
});
