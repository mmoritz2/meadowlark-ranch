import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {hollowpeakSnowWeight,hollowpeakSnowAt,hollowpeakSnowAttribute,hollowpeakSnowRockCover,HOLLOWPEAK_SNOW_PROFILE} from '../assets/hollowpeak-snow.mjs';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import {createFallsLandscape,fallsTerrainHeight} from '../assets/falls-landscape.js';

const x=-150,z=-310;
test('snow follows actual shelter and scouring, not merely an upward normal or altitude',()=>{
 const flat=()=>25,crest=(a,b)=>25-((a-x)**2+(b-z)**2)*.018,hollow=(a,b)=>15+((a-x)**2+(b-z)**2)*.012;
 assert(hollowpeakSnowAt(x,z,hollow)>.9,'connected protected hollow accumulates snow');
 assert(hollowpeakSnowAt(x,z,crest)<.05,'equally upward but exposed crest is scoured');
 assert(hollowpeakSnowAt(x,z,flat)>.5,'cold horizontal bench can retain snow');
 assert.equal(hollowpeakSnowAt(x,z,()=>1),0,'low thawed flat is not a solid white climate disc');
 assert.equal(hollowpeakSnowAt(x,z,(a)=>20+2*(a-x)),0,'steep wall cannot retain a snow carpet');
});

test('compact visual support avoids both outside sampling and any random stream',()=>{
 let calls=0;const old=Math.random;Math.random=()=>{throw Error('Snow must not consume RNG');};
 try{for(const [a,b] of [[0,0],[500,-500],[-350,-210],[-150,-460],[0,-210]]){
  assert.equal(hollowpeakSnowWeight(a,b),0);assert.equal(hollowpeakSnowAt(a,b,()=>{calls++;return 0;}),0);
 }}finally{Math.random=old;}
 assert.equal(calls,0);
});

test('deposition is finite, continuous and bounded on smooth connected terrain',()=>{
 const height=(a,b)=>13+3*Math.sin(a*.041)*Math.cos(b*.039)+.05*(a+150);
 let maximumStep=0,min=1,max=0;
 for(let a=-265;a<-42;a+=2.37)for(let b=-428;b<-98;b+=3.11){
  const f=hollowpeakSnowAt(a,b,height),g=hollowpeakSnowAt(a+.001,b+.001,height);
  assert(Number.isFinite(f)&&f>=0&&f<=1);maximumStep=Math.max(maximumStep,Math.abs(f-g));min=Math.min(min,f);max=Math.max(max,f);
 }
 assert(maximumStep<.001,'small movement cannot jump across deposit boundaries');assert(max-min>.6,'field retains actual exposed/deposited contrast');
});

test('attribute construction preserves every vertex and uses one scalar, with a coherent rock complement',()=>{
 const g=new T.PlaneGeometry(1000,1000,32,32);g.rotateX(-Math.PI/2);const p=g.attributes.position,before=p.array.slice();
 const height=(a,b)=>15+((a-x)**2+(b-z)**2)*.012;
 const attr=hollowpeakSnowAttribute(p,height);assert.equal(attr.byteLength,p.count*4);assert.deepEqual(p.array,before);
 for(let i=0;i<p.count;i++)assert.equal(attr[i],Math.fround(hollowpeakSnowAt(p.getX(i),p.getZ(i),height)));
 for(const cover of [0,.1,.5,.94,1])for(const snow of [0,.25,.5,1]){
  const q={cover,relief:15,curvature:.8,wet:false},a=hollowpeakSnowRockCover(q,snow,1);
  assert(Number.isFinite(a)&&a>=0&&a<=1);assert.equal(hollowpeakSnowRockCover(q,snow,0),cover);
  assert.equal(hollowpeakSnowRockCover({...q,wet:true},snow,1),cover,'wet banks remain exact');
  if(snow===1)assert.equal(a,0,'retained deposit is exposed by the rock skin');
  if(snow===0)assert(a>=cover,'scoured ridge keeps its rock');
 }
});

function compileSurface(){
 const saved=globalThis.document,paths=[];let pixels;
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:p=>{pixels=p;},getImageData:()=>pixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 try{
  const THREE={...T,TextureLoader:class{load(p){paths.push(p);const t=new T.Texture();t.name=p;return t;}}};
  const surface=createTerrainSurface({THREE,renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()});
  const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
  surface.material.onBeforeCompile(shader);return {surface,shader,paths};
 }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
}
test('actual Standard terrain shader uses the shared field once before powder and preserves texture ownership',()=>{
 const {surface,shader,paths}=compileSurface(),v=shader.vertexShader,f=shader.fragmentShader;
 assert.equal((v.match(/attribute float hollowSnow;/g)||[]).length,1);
 assert.equal((f.match(/HOLLOWPEAK_SNOW_DEPOSITS_V1/g)||[]).length,1);
 assert(f.indexOf('snow=mix(snow,hollowDeposit,hollowWeight);')<f.indexOf('float coldPowder=snow;'));
 assert(f.includes('hollowpeakSnowWeight(p)*step(0.0,terrainHollowSnow)'));
 assert(f.includes('thawLitter=max(thawLitter,snowRegion*hollowWeight*(1.0-hollowDeposit));'));
 assert.deepEqual(surface.material.defaultAttributeValues.hollowSnow,[-1],'other shared material users keep baseline snow');
 assert(f.includes('#ifndef OUTER_LANDSCAPE\n        // HOLLOWPEAK_SNOW_DEPOSITS_V1'));
 assert.equal(paths.length,10);assert.equal(paths.filter(p=>p.includes('snow')).length,1);
 assert.equal(Object.keys(shader.uniforms).length,14,'existing terrain uniform ownership is unchanged');
 assert(surface.material.customProgramCacheKey().includes(HOLLOWPEAK_SNOW_PROFILE));
 assert.equal(surface.material.transparent,false);assert.equal(surface.material.depthWrite,true);
 assert.equal((f.match(/float snow=/g)||[]).length,1);
});

test('actual Hollowpeak skin remains on the physical terrain with finite coverage and water unaffected',()=>{
 const heightAt=(a,b)=>fallsTerrainHeight(a,b,.7),scene=new T.Scene(),colliders=[];
 const art=createFallsLandscape({THREE:T,scene,heightAt,terrainStep:1000/512,waterMaterial:new T.MeshPhysicalMaterial(),colliders,loadTextures:false});
 const g=art.rock.geometry,p=g.attributes.position,c=g.attributes.rockCover,n=g.attributes.normal;
 for(let i=0;i<p.count;i++){
  assert(Math.abs(p.getY(i)-heightAt(p.getX(i),p.getZ(i))-.012)<1e-5);
  assert(c.getX(i)>=0&&c.getX(i)<=1&&Number.isFinite(c.getX(i)));
 }
 for(const i of new Set(g.index.array))assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
 assert.equal(art.waters.length,3);assert.equal(art.rock.castShadow,false);assert.equal(art.shadow.castShadow,true);
 assert.equal(art.pool.geometry.attributes.position.getY(0),Math.fround(-.1));assert.equal(art.tarn.geometry.attributes.position.getY(0),Math.fround(16.2));
 assert.equal(art.rock.material.depthWrite,false);assert(art.rock.material.polygonOffset);
});
