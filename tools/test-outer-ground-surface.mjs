import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import {patchOuterRegions} from '../assets/outer-landscape.js';
import {patchOuterGroundSurface,OUTER_GROUND_CACHE,OUTER_GROUND_PHOTOS,OUTER_SWARD_PROFILE,outerSwardReliefAt} from '../assets/outer-ground-surface.mjs';

const helperSource=readFileSync(new URL('../assets/outer-ground-surface.mjs',import.meta.url),'utf8');
const shader=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}});
// Texture creation is CPU-only; the real terrain hook composes the same shader
// source and retains the actual resident uniform objects.
const savedDocument=globalThis.document;let pixels,terrain;
const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:p=>{pixels=p;},getImageData:()=>pixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
globalThis.document={createElement:()=>({getContext:()=>context})};
try{terrain=createTerrainSurface({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()}).material;}
finally{if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;}
const base=shader();terrain.onBeforeCompile(base);
const outer={...base,uniforms:{...base.uniforms}};assert.equal(patchOuterRegions(outer),true);

const count=(source,word)=>source.split(word).length-1;
test('real terrain and regional hooks compose the stochastic outer surface once',()=>{
 for(const marker of ['OUTER_GROVE_GROUND_V1','OUTER_GROUND_RELIEF_V2','OUTER_GROUND_STOCHASTIC_V3','OUTER_GROUND_GRAIN_V4','OUTER_SWARD_V5'])assert.equal(count(outer.fragmentShader,marker),1);
 assert.equal(count(outer.fragmentShader,'float outerGroveWeight(vec2 '),1);
 assert.equal(count(outer.fragmentShader,'vec3 outerGroundAlbedo('),1);
 assert.equal(OUTER_GROUND_CACHE,'outer-ground-sward-5');
 const again={...outer};assert.equal(patchOuterRegions(again),false);assert.equal(again.fragmentShader,outer.fragmentShader);
 assert.equal(patchOuterGroundSurface(again),false);assert.equal(again.fragmentShader,outer.fragmentShader);
});

test('surface hook keeps existing texture ownership, opaque output and main terrain response',()=>{
 assert.deepEqual(Object.keys(outer.uniforms),Object.keys(base.uniforms));
 for(const name of Object.keys(base.uniforms))assert.equal(outer.uniforms[name],base.uniforms[name]);
 assert.equal(outer.vertexShader,base.vertexShader);
 assert(!/uniform\s+sampler|TextureLoader|new\s+\w*Texture/.test(helperSource));
 assert(!/gl_FragColor|diffuseColor\.a|discard\s*;|emissive/.test(helperSource));
 assert.equal(terrain.transparent,false);assert.equal(terrain.opacity,1);assert.equal(terrain.depthWrite,true);
 const repeat=shader();terrain.onBeforeCompile(repeat);assert.equal(repeat.fragmentShader,base.fragmentShader);assert.equal(repeat.vertexShader,base.vertexShader);
});

test('missing or duplicated source anchors fail atomically in the complete hook chain',()=>{
 for(const anchor of ['      vec2 uv = p / 1.4;','        turf = texture2D(map,uv).rgb;','      vec3 turf;','      float quarters = amber+marsh+tundra+ochre;','      soilWeight*=soilReady;','      if(bank>0.003||canyon>0.003) sand=texture2D(terrainSoil,soilUV).rgb*1.45;','#include <normal_fragment_maps>']){
  assert.equal(count(base.fragmentShader,anchor),1,anchor);
  for(const replacement of ['',anchor+'\n'+anchor]){
   const broken={...base,fragmentShader:base.fragmentShader.replace(anchor,replacement)},initial=broken.fragmentShader;
   assert.equal(patchOuterRegions(broken),false);assert.equal(broken.fragmentShader,initial);
  }
 }
});

const clamp=v=>Math.max(0,Math.min(1,v)),smoothstep=(a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x);};
test('albedo keeps exact seam sampling and completes de-tiling on the first visible outer slopes',()=>{
 const fragment=outer.fragmentShader;
 assert(fragment.includes('float outerTileBlend=smoothstep(15.0,60.0,length(max(abs(p)-vec2(500.0),vec2(0.0))));'));
 assert(fragment.includes('float outerSurfaceBlend=smoothstep(15.0,145.0,'));
 assert(fragment.includes('if(outerTileBlend<=0.0)turf=texture2D(map,uv).rgb;'));
 assert(fragment.includes('if(outerTileBlend<=0.0)sand=texture2D(terrainSoil,soilUV).rgb;'));
 assert(fragment.includes('if(outerTileBlend<1.0)turf=mix(texture2D(map,uv).rgb,turf,outerTileBlend);'));
 assert(fragment.includes('if(outerTileBlend<1.0)sand=mix(texture2D(terrainSoil,soilUV).rgb,sand,outerTileBlend);'));
 for(const distance of [0,4,12,15])assert.equal(smoothstep(15,60,distance),0);
 for(const distance of [60,65,77,145,1000])assert.equal(smoothstep(15,60,distance),1);
});

const fract=x=>x-Math.floor(x),smooth=x=>x*x*(3-2*x);
function hash(x,y){let a=fract(x*.1031),b=fract(y*.1030),c=fract(x*.0973);const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;return[fract((a+b)*c),fract((a+c)*b)];}
const rotate=([x,y],n)=>n===0?[x,y]:n===1?[-y,x]:n===2?[-x,-y]:[y,-x];
function stencil(q){const cell=q.map(v=>Math.floor(v*.42)),f=q.map(v=>smooth(fract(v*.42))),rows=[];for(let y=0;y<2;y++)for(let x=0;x<2;x++){
 const corner=[cell[0]+x,cell[1]+y],seed=hash(corner[0]+17.3,corner[1]+41.7),turn=Math.floor(seed[0]*4),scale=.90+.20*seed[1];
 rows.push({key:corner.join(','),weight:(x?f[0]:1-f[0])*(y?f[1]:1-f[1]),seed,turn,scale,uv:rotate(q.map(v=>v*scale),turn).map((v,i)=>v+seed[i]*61.7)});
}return rows;}

test('the audited four-sample stencil is convex and shares samples across cell boundaries',()=>{
 for(const text of ['cell=floor(q*.42),f=fract(q*.42)','f=f*f*(3.0-2.0*f)','tHash2(cell+corner+vec2(17.3,41.7))','turn=floor(seed.x*4.0),scale=.90+.20*seed.y','turfQuarterTurn(q*scale,turn)+seed*61.7','float weight=(x==1?f.x:1.0-f.x)*(y==1?f.y:1.0-f.y);'])assert(helperSource.includes(text),text);
 const orientations=new Set();
 for(let y=-12;y<=12;y++)for(let x=-12;x<=12;x++)for(const offset of [.01,.31,.99]){
  const rows=stencil([x/.42+offset,y/.42+.63]);assert(Math.abs(rows.reduce((s,r)=>s+r.weight,0)-1)<1e-12);
  for(const r of rows){assert(r.weight>=0&&r.weight<=1);assert(r.uv.every(Number.isFinite));orientations.add(r.turn);assert(r.scale>=.9&&r.scale<1.1);}
  assert(Math.abs(rows.reduce((s,r)=>s+r.weight*.37,0)-.37)<1e-12,'constant textures must retain their energy');
 }
 assert.deepEqual([...orientations].sort(),[0,1,2,3]);
 const texture=([x,y])=>.5+.19*Math.sin(x*2*Math.PI)+.17*Math.cos(y*2*Math.PI),sample=q=>stencil(q).reduce((s,r)=>s+r.weight*texture(r.uv),0);
 for(let i=-16;i<=16;i++)for(const axis of [0,1])for(const phase of [.1,.37,.87]){
  const a=[phase/.42,phase/.42],b=[...a];a[axis]=i/.42-1e-7;b[axis]=i/.42+1e-7;
  const shared=new Map(stencil(a).filter(r=>r.weight>1e-10).map(r=>[r.key,r]));
  for(const r of stencil(b).filter(r=>r.weight>1e-10)){const prior=shared.get(r.key);assert(prior);assert.deepEqual(prior.seed,r.seed);assert.equal(prior.turn,r.turn);assert.equal(prior.scale,r.scale);}
  assert(Math.abs(sample(a)-sample(b))<1e-5,'cell boundary must not introduce a color jump');
 }
});

test('gradients are captured before material branches and retain anisotropy after rotation',()=>{
 const fragment=outer.fragmentShader;
 for(const [declaration,branch]of [['vec2 outerTurfDx=dFdx(uv),outerTurfDy=dFdy(uv);','if(outerTileBlend<=0.0)turf'],['vec2 outerSoilDx=dFdx(soilUV),outerSoilDy=dFdy(soilUV);','if(bank>0.003||canyon>0.003||outerBank>0.003)']])assert(fragment.indexOf(declaration)>=0&&fragment.indexOf(declaration)<fragment.indexOf(branch));
 for(const text of ['#ifdef texture2DGradEXT','turfQuarterTurn(qDx*scale*mipScale,turn)','turfQuarterTurn(qDy*scale*mipScale,turn)','float mipScale=exp2(.65*smoothstep(.08,.65,footprint))'])assert(helperSource.includes(text));
 for(const q of [[.1,.002],[2,0],[0,0],[.04,-.9]])for(let orientation=0;orientation<4;orientation++)for(const scale of [.9,1,1.1])for(const mipScale of [1,2**.65]){
  const transformed=rotate(q.map(v=>v*scale*mipScale),orientation);assert(transformed.every(Number.isFinite));assert(Math.abs(Math.hypot(...transformed)-Math.hypot(...q)*scale*mipScale)<1e-12);
 }
});

test('unmatched meadow micro-normals fade while matching litter/rock and finite analytic relief remain',()=>{
 const fragment=outer.fragmentShader;
 assert(fragment.includes('if(outerTileBlend<1.0)outerDetail=mix(texture2D(meadowDetail,uv).xyz*2.0-1.0,vec3(0.0,0.0,1.0),outerTileBlend);'));
 for(const text of ['texture2D(litterDetail,earthUV)','texture2D(stoneDetail,rockUVy)','outerTuft.yz*(.32/8.0)','outerFold.yz*(.60/30.0)','float outerDetailFade=(1.0-smoothstep(.12,.75,outerFootprint))*outerSurfaceBlend','outerGradient-=wn*dot(wn,outerGradient);','if(dot(outerTangent,outerTangent)<.0001)','vec3 outerRelief=normalize(wn-outerGradient+.24*outerDetailFade*'])assert(fragment.includes(text));
 // Each cubic field derivative is at most1.5 for corner values in[0,1].
 const c=OUTER_SWARD_PROFILE;
 const swardBound=c.height*(1.5/8*1.5/(c.crownHigh-c.crownLow)+1.5/30*(1-c.calm)*1.5/(c.groupHigh-c.groupLow));
 const gradientBound=Math.max(1.5*.32/8,swardBound)+1.5*.60/30;
 const forwardBound=1/Math.sqrt(1+(Math.SQRT2*(gradientBound+.24))**2);
 for(const raw of [[0,1,0],[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[.7,.2,.4]]){
  const n=new T.Vector3(...raw).normalize();
  for(const gx of [-gradientBound,0,gradientBound])for(const gz of [-gradientBound,0,gradientBound])for(const nx of [-1,0,1])for(const ny of [-1,0,1]){
   const g=new T.Vector3(gx,0,gz);g.addScaledVector(n,-g.dot(n));let tangent=new T.Vector3().crossVectors(new T.Vector3(0,0,1),n);if(tangent.lengthSq()<.0001)tangent.crossVectors(new T.Vector3(1,0,0),n);tangent.normalize();const bitangent=new T.Vector3().crossVectors(n,tangent).normalize();
   const relief=n.clone().sub(g).addScaledVector(tangent,.24*nx).addScaledVector(bitangent,.24*ny).normalize();assert(relief.toArray().every(Number.isFinite));assert(Math.abs(relief.length()-1)<1e-12);assert(relief.dot(n)>=forwardBound-1e-12);if(!gx&&!gz&&!nx&&!ny)assert(relief.distanceTo(n)<1e-12);
  }
 }
 for(const footprint of [.75,1,10,100])assert.equal(1-smoothstep(.12,.75,footprint),0);
});


test('grain response is tied to the measured source photos and remains an energy-preserving convex blend',()=>{
 const fragment=outer.fragmentShader;
 assert(fragment.includes('float resolved=1.0-smoothstep(.035,.20,footprint);'));
 assert(fragment.includes('return mix(average,sampled,mix(farContrast,nearContrast,resolved));'));
 for(const [name,photo]of Object.entries(OUTER_GROUND_PHOTOS)){
  const bytes=readFileSync(new URL('../assets/'+photo.source,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256,'Photo changed: recompute its decoded linear mean');
  assert(photo.mean.length===3&&photo.mean.every(v=>v>0&&v<1));
  assert(photo.farContrast>0&&photo.farContrast<=.04&&photo.nearContrast>.25&&photo.nearContrast<=1);
  assert(fragment.includes('vec3('+photo.mean.join(',')+')'));
  for(const footprint of [0,.035,.08,.15,.20,1,10]){
   const response=photo.farContrast+(photo.nearContrast-photo.farContrast)*(1-smoothstep(.035,.20,footprint));
   assert(response>=photo.farContrast-1e-12&&response<=photo.nearContrast+1e-12);
   if(footprint>=.20)assert.equal(response,photo.farContrast);
   for(const mean of photo.mean)for(const sample of [0,mean,.25,.5,1]){
    const result=mean+(sample-mean)*response;assert(result>=0&&result<=1);if(sample===mean)assert.equal(result,mean);
   }
  }
  const uv=name==='soil'?'soilUV':'uv',dx=name==='soil'?'outerSoilDx':'outerTurfDx',dy=name==='soil'?'outerSoilDy':'outerTurfDy',scale=Number.isInteger(photo.scale)?photo.scale+'.0':String(photo.scale);
  assert(fragment.includes(`${uv}*${scale},${dx}*${scale},${dy}*${scale}`),'UV and gradients must share the tighter grain scale');
 }
 assert.equal(count(helperSource,'texture2DGradEXT(source,sampleUV,'),1,'Grain isolation must not add another stencil');
 assert.equal(count(helperSource,'texture2D(source,sampleUV,log2(mipScale))'),1);
});


test('connected sward normal is the analytic gradient of its bounded material height',()=>{
 const c=OUTER_SWARD_PROFILE;let quiet=0,full=0,maxError=0,maxGradient=0;
 const eps=.0002;
 for(let i=0;i<1600;i++){
  const x=-1260+i*1.617,z=610+Math.sin(i*1.732)*460;
  for(const footprint of [0,.4,1.8,5,14]){
   const a=outerSwardReliefAt(x,z,footprint);
   assert(Object.values(a).every(Number.isFinite));
   assert(a.height>=0&&a.height<=c.height&&a.crown>=0&&a.crown<=1&&a.fullness>=0&&a.fullness<=1);
   assert(a.envelope>=c.calm&&a.envelope<=1);
   const dx=(outerSwardReliefAt(x+eps,z,footprint).height-outerSwardReliefAt(x-eps,z,footprint).height)/(2*eps);
   const dz=(outerSwardReliefAt(x,z+eps,footprint).height-outerSwardReliefAt(x,z-eps,footprint).height)/(2*eps);
   maxError=Math.max(maxError,Math.abs(a.dx-dx),Math.abs(a.dz-dz));
   maxGradient=Math.max(maxGradient,Math.hypot(a.dx,a.dz));
   if(footprint>=14)assert.equal(Math.hypot(a.dx,a.dz),0,'subpixel fields cannot perturb the normal');
   if(!footprint){if(a.fullness===0)quiet++;if(a.fullness===1)full++;}
  }
 }
 assert(maxError<.00001,`height derivative mismatch ${maxError}`);
 assert(quiet>0&&full>0,'the cover must contain both calm and full intervals, not an all-over ripple multiplier');
 // Bind the GPU implementation to the same profile and product rule.
 for(const text of [`(value-${c.crownLow})/${c.crownHigh-c.crownLow}`,`(group-${c.groupLow})/${c.groupHigh-c.groupLow}`,`float envelope=mix(${c.calm},1.0,fullness);`,`(crownGradient*envelope+crown*envelopeGradient)*${c.height}`,'outerSwardReliefField.yz,outerPastureCover)'])assert(outer.fragmentShader.includes(text),text);
});

test('sward relief and its normal join continuously at local and group cells',()=>{
 for(const [metres,ox,oz]of [[8,7.3,29.1],[30,51.6,-11.4]])for(let cell=-80;cell<=80;cell+=3)for(const axis of ['x','z']){
  const x=axis==='x'?(cell-ox)*metres:632.173,z=axis==='z'?(cell-oz)*metres:-731.531;
  const eps=1e-6,a=outerSwardReliefAt(x-(axis==='x'?eps:0),z-(axis==='z'?eps:0)),b=outerSwardReliefAt(x+(axis==='x'?eps:0),z+(axis==='z'?eps:0));
  for(const key of ['height','dx','dz','fullness'])assert(Math.abs(a[key]-b[key])<1e-5,`${axis}/${cell}/${key}`);
 }
});

test('sward and mineral changes remain outer-only and respect material/weather sequencing',()=>{
 const source=outer.fragmentShader;
 for(const text of ['float outerMineral=outerSurfaceBlend*smoothstep(.30,.68,grade)','stone=max(stone,outerMineral*.66);','*(1.0-smoothstep(.02,.64,canopy))','*(1.0-smoothstep(.02,.65,canyon))*(1.0-clamp(soilWeight,0.0,1.0))','max(max(snow,coldPowder),max(rocky,quarters))','surface*=mix(vec3(1.0),outerCoverTone,outerSurfaceBlend*outerPastureCover);'])assert(source.includes(text),text);
 assert(source.indexOf('float outerMineral=')<source.indexOf('vec3 earth=vec3(0.0)'),'new rock masks must precede conditional resident sampling');
 assert(source.indexOf('float outerPastureCover=')<source.indexOf('vec2 outerHeightGradient='),'normal consumes final substrate cover');
 assert(source.indexOf('float outerPastureCover=')<source.indexOf('float pastureOther='),'existing small-scale sward sees the final outer material');
 assert(source.indexOf('surface*=mix(vec3(1.0),outerCoverTone')<source.indexOf('surface*=1.0-rainWet*.26;'),'rain stays final');
 assert.equal(count(helperSource,'outerGroundField(p/'),2,'reuse the existing two field evaluations');
 assert(!helperSource.includes('texture2D('+'terrainForest'),'shared grove surface retains its previous texture owner');
 assert(!base.fragmentShader.includes('OUTER_SWARD_V5'),'main riding terrain stays untouched');
 // Exact seam: new cover/normal/mineral response all carry surfaceBlend.
 for(const distance of [0,5,14.999,15]){
  const blend=smoothstep(15,145,distance);assert.equal(blend,0);
  for(const grade of [0,.3,.7,1.5])assert.equal(blend*smoothstep(.30,.68,grade),0);
 }
 const cover=(snow,rock,quarters,canopy,bank,wear,canyon,soil)=>
 (1-smoothstep(.04,.65,Math.max(snow,rock,quarters)))*(1-smoothstep(.02,.64,canopy))*(1-smoothstep(.02,.62,Math.max(wear,bank)))*(1-smoothstep(.02,.65,canyon))*(1-clamp(soil));
 assert.equal(cover(0,0,0,0,0,0,0,0),1);
 for(let i=0;i<8;i++){const values=Array(8).fill(0);values[i]=1;assert.equal(cover(...values),0,'full alternate substrate must retain its own response');}
});
