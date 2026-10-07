import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {COLD_SNOW_SURFACE as S,coldSnowDrift,createTerrainSurface} from '../assets/terrain-realism.js';

const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
const worldFromCell=(u,v)=>{const a=(u+17.3)*S.across,b=(v-41.9)*S.along;return [S.windX*a-S.windZ*b,S.windZ*a+S.windX*b];};

test('powder relief remains deterministic, finite and small throughout the basin',()=>{
 near(Math.hypot(S.windX,S.windZ),1);
 let min=Infinity,max=-Infinity,slopes=[];
 for(let x=-500;x<=500;x+=17.31)for(let z=-500;z<=500;z+=21.17){
  const d=coldSnowDrift(x,z);assert.deepEqual(d,coldSnowDrift(x,z));assert.ok(Object.values(d).every(Number.isFinite));
  min=Math.min(min,d.height);max=Math.max(max,d.height);slopes.push(Math.hypot(d.dx,d.dz));
  assert.ok(Math.abs(d.height)<=S.depth/2+1e-12);
  assert.ok(Math.hypot(d.dx,d.dz)<=Math.hypot(1.5*S.depth/S.across,1.5*S.depth/S.along)+1e-12);
 }
 assert.ok(max-min>.10,'The bounded relief must still create visible variation');
 assert.ok(slopes.some(s=>s>.025),'Relief is not silently flattened');
 assert.ok(S.textureMetres>=2&&S.textureMetres<=2.5,'Photographed two-metre snow keeps its physical grain scale');
});

test('analytic snow gradients agree with independent world-space height differences',()=>{
 const eps=1e-4;
 for(let i=0;i<800;i++){
  const x=Math.sin(i*2.399)*490,z=Math.cos(i*1.317)*490,d=coldSnowDrift(x,z);
  near(d.dx,(coldSnowDrift(x+eps,z).height-coldSnowDrift(x-eps,z).height)/(2*eps),2e-8);
  near(d.dz,(coldSnowDrift(x,z+eps).height-coldSnowDrift(x,z-eps).height)/(2*eps),2e-8);
 }
});

test('height and normal gradients remain continuous across both wind-cell boundaries',()=>{
 const eps=1e-6;
 for(let i=-70;i<=70;i+=3)for(let j=-30;j<=30;j+=5)for(const axis of [0,1]){
  const a=[i,j+.371],b=[i,j+.371];if(axis){a[0]+=.371;b[0]+=.371;a[1]-=.371;b[1]-=.371;}
  a[axis]-=eps;b[axis]+=eps;
  const left=coldSnowDrift(...worldFromCell(...a)),right=coldSnowDrift(...worldFromCell(...b));
  near(left.height,right.height,2e-7);near(left.dx,right.dx,2e-6);near(left.dz,right.dz,2e-6);
 }
});

function shaderFixture(){
 const paths=[],original=globalThis.document,canvas={getContext:()=>({fillRect(){}})};
 globalThis.document={createElement:()=>canvas};
 try{
  const cpuThree={...T,TextureLoader:class{load(path){paths.push(path);const texture=new T.Texture();texture.name=path;return texture;}}};
  const grass=new T.Texture(),bump=new T.Texture(),surface=createTerrainSurface({THREE:cpuThree,renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass,bump});
  const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>',uniforms:{}};
  surface.material.onBeforeCompile(shader);
  return {paths,surface,shader,grass,bump};
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}
// Resolve only the two material switches; the fixture contains no unrelated
// preprocessor branches. This lets CPU QA inspect the code sent to every tier.
function tierCode(code,{outer=false,cheap=false}={}){
 const flags={OUTER_LANDSCAPE:outer,CHEAP_GROUND:cheap},stack=[],out=[];let active=true;
 for(const line of code.split('\n')){
  const m=line.trim().match(/^#(ifdef|ifndef) (\w+)$/);
  if(m){assert.ok(m[2] in flags,`Unexpected shader switch ${m[2]}`);const take=m[1]==='ifdef'?flags[m[2]]:!flags[m[2]];stack.push({parent:active,take});active=active&&take;}
  else if(line.trim()==='#else'){const f=stack.at(-1);assert.ok(f);active=f.parent&&!f.take;}
  else if(line.trim()==='#endif'){const f=stack.pop();assert.ok(f);active=f.parent;}
  else if(active)out.push(line);
 }
 assert.equal(stack.length,0);return out.join('\n');
}

test('one snow replacement keeps existing material texture slots and static vertex behavior',()=>{
 const {paths,surface,shader,grass,bump}=shaderFixture(),m=surface.material;
 assert.equal(paths.length,10,'The new source replaces one existing load, not an additional texture');
 assert.equal(paths.filter(p=>p.includes('snow')).length,1);
 assert.equal(shader.uniforms.terrainSnow.value.name,'./assets/textures/cold/snow_02_diff_2k.webp');
 assert.equal(shader.uniforms.terrainSnow.value.colorSpace,T.SRGBColorSpace);assert.equal(shader.uniforms.terrainSnow.value.wrapS,T.RepeatWrapping);
 assert.deepEqual(Object.keys(shader.uniforms).sort(),['terrainRock','terrainForest','forestMask','meadowDetail','stoneDetail','litterDetail','meadowARM','stoneARM','litterARM','wetWeather','terrainSoil','terrainSnow'].sort());
 assert.equal(m.map,grass);assert.equal(m.bumpMap,bump);assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);
 assert.deepEqual(Object.keys(m.userData).sort(),['setPaths','setTrees','wetWeather']);
 assert.equal(m.customProgramCacheKey(),'terrain-biomes-v16-cold-snow');
 assert.deepEqual(m.defaultAttributeValues.chalkRelief,[0]);
 assert.equal(shader.vertexShader,'attribute float chalkRelief; varying float terrainChalkRelief; varying vec3 terrainPosition; varying vec3 terrainNormal;\n#include <begin_vertex>\n      terrainChalkRelief = chalkRelief;\n      terrainPosition = (modelMatrix * vec4(position,1.0)).xyz;\n      terrainNormal = normalize(mat3(modelMatrix) * normal);');
});

test('cold changes keep original climate footprints, other biomes and outer surface logic',()=>{
 const {shader}=shaderFixture(),source=readFileSync(new URL('../assets/terrain-realism.js',import.meta.url),'utf8');
 // These unchanged deployed shader regions guard the real requested boundary:
 // no pasture, riverbank, rocky slope or distant-quarter redesign in this pass.
 for(const [a,b,hash]of [
  ['      /* Read the surface','      /* One fetch, two fields','984da4e491a521bda73924dd2b4a356f0572380028053f4e9cb0285162038fa6'],
  ['      /* The jitter','      float canyon','07b6cb9e012786e1f6595197b3504c76c5094ab9c24706cf6ce0d8d744b227ee'],
  ['      /* The four quarters','      // Moist ground','c31e8585b1b5f25dccc59b32db6cb345b7860c0a1923b918e513db46108bb722']
 ]){const start=source.indexOf(a);assert.ok(start>=0);assert.equal(createHash('sha256').update(source.slice(start,source.indexOf(b,start))).digest('hex'),hash);}
 for(const mask of [
  'float alpineClimate=1.0-smoothstep(.65,1.10,length((p-vec2(-150.0,-333.0))/vec2(100.0,92.0)));',
  'float snowRegion = 1.0-smoothstep(88.0,158.0, length(p-vec2(-160.0,-210.0))+ecoA*0.8);',
  'float winterCore=1.0-smoothstep(66.0,112.0,length(p-vec2(-160.0,-210.0)));',
  'float tundra = 1.0-smoothstep(80.0,128.0, length(p-vec2(-300.0,-320.0))+ecoB*0.85+ecoA*0.40);'
 ])assert.ok(shader.fragmentShader.includes(mask));
 for(const cheap of [false,true])for(const outer of [false,true]){
  const code=tierCode(shader.fragmentShader,{cheap,outer}),begin=code.indexOf('vec2 snowCell='),end=code.indexOf('/* Under the trees',begin),sampling=code.slice(begin,end);
  assert.equal((sampling.match(/texture2D\(terrainSnow,/g)||[]).length,cheap?2:1,'Low uses two samples; high uses one in a 2x2 loop');
  assert.equal(sampling.includes('for(int y=0;y<=1;y++)for(int x=0;x<=1;x++)'),!cheap);
  assert.equal(code.includes('vec3 powderField=coldSnowDrift(p);'),!outer,'Powder normals apply on both basin tiers only');
  assert.equal(code.includes('coldPowder=snow*(1.0-tundra*.88)+tundra*.88*(.66-.46*smoothstep(.06,.36,grade+rough*.3));'),!outer,'Frost normal cover follows the actual unchanged photographed-powder share');
  if(!outer)assert.ok(code.includes('normal=normalize(mix(normal,normalize(mat3(viewMatrix)*powderNormal),coldPowder));'));
  assert.equal(code.includes('float sheltered='),!outer);assert.equal(code.includes('vec3 edgeGround='),!outer);
  assert.equal(code.includes('roughnessFactor=mix(roughnessFactor,.97,snow);'),!outer);
  if(outer){assert.ok(code.includes('float lie=mix(.28+.55*drift,1.0,winterCore);'));assert.ok(code.includes('surface=mix(surface,c,snow*0.98);'));assert.ok(!code.includes('snowUV=mat2'));}
  else{assert.ok(code.includes('lie=mix(sheltered,1.0,winterCore);'));assert.ok(code.includes('thawLitter=snowRegion*(1.0-winterCore)'));assert.ok(code.includes('surface=mix(surface,c,snow);'));}
 }
});


test('sequential Frostpine powder share stays bounded and distinguishes scoured mineral slopes',()=>{
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const share=(snow,tundra,grade,rough=0)=>snow*(1-tundra*.88)+tundra*.88*(.66-.46*smooth(.06,.36,grade+rough*.3));
 near(share(1,0,0),1);near(share(0,0,0),0);near(share(0,1,0),.5808);near(share(0,1,1),.176);
 for(let snow=0;snow<=1.0001;snow+=.1)for(let tundra=0;tundra<=1.0001;tundra+=.1)for(let grade=0;grade<=1;grade+=.02)for(const rough of [-.33,0,.33]){
  const actual=share(snow,tundra,grade,rough),rockShare=.34+.46*smooth(.06,.36,grade+rough*.3);
  // Independent decomposition of the sequential material blend.
  near(actual,snow*(1-tundra*.88)+(1-rockShare)*tundra*.88);
  assert.ok(actual>=-1e-12&&actual<=1+1e-12);
 }
 assert.ok(share(0,1,.34)<share(0,1,.05)*.5,'Exposed mineral slopes must receive substantially less powder relief');
});


test('verified photographed snow exposure brightens powder without losing measured grain or exceeding white',()=>{
 const photo=readFileSync(new URL('../assets/textures/cold/snow_02_diff_2k.webp',import.meta.url));
 // Linear luminance statistics measured from this exact converted CC0 image.
 // The checksum makes these observations meaningful if the source changes.
 assert.equal(createHash('sha256').update(photo).digest('hex'),'4c1b5f76d77325221548088bef77a1b6a782fe958e2ab7b13373572701430f24');
 const sourceMean=.3801,sourceQuantiles=[.2201,.3251,.3886,.4256,.4460];
 const calibrate=value=>Math.max(0,Math.min(.98,value*S.albedoExposure));
 assert.ok(calibrate(sourceMean)>.68&&calibrate(sourceMean)<.75,'The actual photographed mean should read as winter powder');
 const grainBefore=sourceQuantiles.at(-1)-sourceQuantiles[0],grainAfter=calibrate(sourceQuantiles.at(-1))-calibrate(sourceQuantiles[0]);
 assert.ok(grainAfter>grainBefore*1.75,'Exposure must preserve and reveal the photographed grain');
 for(let value=0;value<=1.0001;value+=.0001){const result=calibrate(value);assert.ok(Number.isFinite(result)&&result>=0&&result<=.98);}
 near(calibrate(1),.98);near(calibrate(0),0);
 const {shader}=shaderFixture();
 for(const outer of [false,true])for(const cheap of [false,true]){
  const code=tierCode(shader.fragmentShader,{outer,cheap});
  assert.equal((code.match(/float snowValue=clamp\(dot\(snowTex,vec3\(\.2126,\.7152,\.0722\)\)\*1\.85,0\.0,\.98\);/g)||[]).length,1,'Every snow tier uses the same bounded exposure calibration');
 }
});
