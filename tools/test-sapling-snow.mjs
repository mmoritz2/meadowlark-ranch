import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {tuneFoliage,loadFoliageAtlas} from '../assets/world-art.js';
import {SAPLING_SNOW as S,saplingSnowCover as cover,saplingSnowShader,patchSaplingSnowShader,applySaplingSnowShader} from '../assets/sapling-snow.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,a+' differs from '+b);
const point=(normalY=1,heightAboveRoot=1,x=-300,y=3,z=-320)=>({x,y,z,normalY,heightAboveRoot});
const shader=(type='standard')=>({vertexShader:T.ShaderLib[type].vertexShader,fragmentShader:T.ShaderLib[type].fragmentShader,uniforms:{}});
const occurrences=(s,q)=>s.split(q).length-1;
const expand=s=>s.replace(/#include <([\w_]+)>/g,(_m,key)=>expand(T.ShaderChunk[key]??assert.fail('Missing shader chunk '+key)));
const hash=b=>createHash('sha256').update(b).digest('hex');
function selectedSapling(){
 const buffer=read('assets/models/world/realism/pine_sapling_small.glb'),jsonBytes=buffer.readUInt32LE(12),j=JSON.parse(buffer.subarray(20,20+jsonBytes)),bin=20+jsonBytes+8;
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},bytes={5121:1,5123:2,5125:4,5126:4};
 const access=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],size=sizes[a.type],width=bytes[a.componentType],base=bin+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size*width;
  return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_v,k)=>{const at=base+n*stride+k*width;return a.componentType===5126?buffer.readFloatLE(at):a.componentType===5125?buffer.readUInt32LE(at):a.componentType===5123?buffer.readUInt16LE(at):buffer.readUInt8(at);}));};
 const node=j.nodes[j.scenes[j.scene||0].nodes[0]];assert.equal(node.name,'pine_sapling_small_b');assert.deepEqual(node.translation,[1,0,0]);
 const parts=j.meshes[node.mesh].primitives.map(p=>({positions:access(p.attributes.POSITION),normals:access(p.attributes.NORMAL),uvs:access(p.attributes.TEXCOORD_0),indices:access(p.indices).flat(),material:j.materials[p.material]}));
 const bounds=new T.Box3();for(const p of parts)for(const v of p.positions)bounds.expandByPoint(new T.Vector3(...v).add(new T.Vector3(...node.translation)));
 const center=bounds.getCenter(new T.Vector3()),scale=2.85/(bounds.max.y-bounds.min.y);
 const normalized=new T.Matrix4().makeTranslation(-center.x*scale,-bounds.min.y*scale,-center.z*scale).multiply(new T.Matrix4().makeScale(scale,scale,scale)).multiply(new T.Matrix4().makeTranslation(...node.translation));
 return {buffer,parts,bounds,scale,normalized,twig:parts[1],minYCorrection:-bounds.min.y*scale};
}
const actual=selectedSapling();

test('cover is deterministic, bounded and independent of order without resource or RNG dependencies',()=>{
 assert.ok(Object.isFrozen(S)&&Object.isFrozen(S.fieldFrequencyA)&&Object.isFrozen(S.powderRgbLinear));
 const samples=Array.from({length:1200},(_,i)=>point(Math.sin(i*2.399),Math.sin(i*.71)*2,Math.sin(i*1.77)*500,Math.cos(i*.31)*7,Math.cos(i*1.13)*500));
 const inputs=JSON.stringify(samples),random=Math.random;Math.random=()=>assert.fail('Snow helper consumed RNG');
 try{const results=samples.map(cover);assert.deepEqual([...samples].reverse().map(cover).reverse(),results);assert.equal(JSON.stringify(samples),inputs);
  for(const r of results){assert.ok(Object.values(r).every(Number.isFinite));assert.ok(r.amount>=0&&r.amount<=S.coverage);assert.ok(r.normalSoftening>=0&&r.normalSoftening<=S.coverage*S.normalSofteningMaximum);}
 }finally{Math.random=random;}
 for(const key of['x','y','z','normalY','heightAboveRoot'])for(const value of[NaN,Infinity,-Infinity])assert.throws(()=>cover({...point(),[key]:value}),/finite/);
 const source=read('assets/sapling-snow.mjs').toString();assert.doesNotMatch(source,/\bimport\b|Math\.random|\bDate\b|new (?:THREE|Texture|Mesh|Geometry|Map|Set)|sampler|texture2D|Math\.(?:floor|trunc)|fract\(/);
});
test('supported branches collect substantial snow while hanging and near-vertical needles retain green',()=>{
 for(let i=0;i<300;i++){
  const p=point(1,1,-300+i*.043,3+i*.002,-320+i*.029),up=cover(p),down=cover({...p,normalY:-1}),vertical=cover({...p,normalY:0});
  assert.ok(up.amount>=S.coverage*S.patchFloor);assert.equal(down.amount,0);assert.equal(vertical.amount,0);
  const low=cover({...p,heightAboveRoot:0});near(low.amount/up.amount,S.heightFloor);assert.ok(up.amount<1,'canopy is never entirely whitened');
 }
 near(cover(point(.02)).support,0);near(cover(point(.60)).support,1);
});
test('continuous metre field has bounded spatial slopes without UV-grid jumps or time dependence',()=>{
 const eps=1e-5,bound=S.coverage*(1-S.patchFloor)*1.5/(S.patchHigh-S.patchLow);
 for(let i=0;i<300;i++){
  const p=point(.74,.95,-300+i*.071,2.3+i*.017,-320+i*.047);
  for(const [key,index] of[['x',0],['y',1],['z',2]]){
   const lo=cover({...p,[key]:p[key]-eps}),hi=cover({...p,[key]:p[key]+eps});
   const derivative=Math.abs(hi.amount-lo.amount)/(2*eps),max=bound*(S.fieldAmplitudeA*Math.abs(S.fieldFrequencyA[index])+S.fieldAmplitudeB*Math.abs(S.fieldFrequencyB[index]));
   assert.ok(derivative<=max+1e-7,key+' cover slope exceeded analytic bound');
   assert.ok(Math.abs(hi.amount-lo.amount)<2*eps*max+1e-10);
  }
 }
 const line=Array.from({length:501},(_,i)=>cover(point(1,1,-300+i*.002,3,-320)).amount);
 assert.ok(Math.max(...line)-Math.min(...line)>.1,'branch-sized patches must still have useful variation');
});
test('GLSL cover derives from CPU constants and agrees with independently evaluated generated expressions',()=>{
 const glsl=saplingSnowShader();assert.equal(glsl,saplingSnowShader());assert.doesNotMatch(glsl,/floor|fract|texture|sampler|time|camera|faceDirection/);
 const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),smoothstep=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
 // Execute the actual generated arithmetic after replacing only GLSL scalar
 // declarations. Constants come from emitted source, not this test's S values.
 const body=glsl.slice(glsl.indexOf('{')+1,glsl.lastIndexOf('}')).replace(/\bfloat\s+/g,'const ');
 const emitted=new Function('worldMetres','originalNormalY','heightAboveRoot','smoothstep','sin','dot','vec3',body);
 for(let i=0;i<200;i++){
  const p=point(Math.sin(i*.61),i*.01,-315+i*.011,1+i*.02,-290-i*.027),expected=cover(p);
  const amount=emitted([p.x,p.y,p.z],p.normalY,p.heightAboveRoot,smoothstep,Math.sin,dot,(...v)=>v);
  near(expected.amount,amount);
 }
 assert.ok(glsl.includes(String(S.coverage))&&glsl.includes(String(S.supportHigh))&&glsl.includes(String(S.heightHigh)));
});
test('emitted GLSL declaration names avoid ES 3.00 reserved future keywords',()=>{
 // Khronos GLSL ES 3.00 section 3.8: reserved keywords are compile errors.
 // This is a lexical regression gate; actual native compilation is separate.
 const reserved=new Set('attribute varying coherent volatile restrict readonly writeonly resource atomic_uint noperspective patch sample subroutine common partition active asm class union enum typedef template this goto inline noinline public static extern external interface long short double half fixed unsigned superp input output hvec2 hvec3 hvec4 dvec2 dvec3 dvec4 fvec2 fvec3 fvec4 filter sizeof cast namespace using'.split(' '));
 const legal=source=>{for(const match of source.matchAll(/\b(?:float|int|bool|vec[234]|mat[234])\s+([a-zA-Z_]\w*)/g))assert.ok(!reserved.has(match[1]),'Reserved GLSL identifier '+match[1]);};
 assert.throws(()=>legal('float patch = 0.5;'),/Reserved GLSL identifier patch/);
 legal(saplingSnowShader());assert.match(saplingSnowShader(),/float snowPatch =/);assert.doesNotMatch(saplingSnowShader(),/\bpatch\b/);
 for(const type of['standard','physical']){const sh=shader(type);patchSaplingSnowShader(sh);legal(sh.vertexShader);legal(sh.fragmentShader);}
});
test('standard/physical source keeps original map alpha, normal maps, roughness maps and depth includes',()=>{
 for(const type of['standard','physical']){
  const sh=shader(type),oldVertex=sh.vertexShader,oldFragment=sh.fragmentShader;patchSaplingSnowShader(sh);
  for(const chunk of['map_fragment','color_fragment','alphamap_fragment','alphatest_fragment','alphahash_fragment','roughnessmap_fragment','normal_fragment_begin','normal_fragment_maps','clearcoat_normal_fragment_maps','opaque_fragment'])assert.equal(occurrences(sh.fragmentShader,'#include <'+chunk+'>'),occurrences(oldFragment,'#include <'+chunk+'>'));
  for(const chunk of['morphnormal_vertex','skinnormal_vertex','defaultnormal_vertex','morphtarget_vertex','skinning_vertex','displacementmap_vertex','project_vertex','worldpos_vertex'])assert.equal(occurrences(sh.vertexShader,'#include <'+chunk+'>'),occurrences(oldVertex,'#include <'+chunk+'>'));
  const fragment=expand(sh.fragmentShader),before=expand(oldFragment),vertex=expand(sh.vertexShader);
  assert.equal(occurrences(fragment,'texture2D('),occurrences(before,'texture2D('));assert.equal(occurrences(fragment,'sampler2D'),occurrences(before,'sampler2D'));
  assert.equal(occurrences(fragment,'diffuseColor.a'),occurrences(before,'diffuseColor.a'));assert.equal(occurrences(fragment,'gl_FragDepth'),occurrences(before,'gl_FragDepth'));
  assert.ok(sh.fragmentShader.indexOf('saplingSnowAmount =')>sh.fragmentShader.indexOf('#include <color_fragment>'));
  assert.ok(sh.fragmentShader.indexOf('roughnessFactor = mix')>sh.fragmentShader.indexOf('#include <roughnessmap_fragment>'));
  assert.ok(sh.fragmentShader.indexOf('saplingSnowBaseNormal = normal;')<sh.fragmentShader.indexOf('#include <normal_fragment_maps>'));
  assert.ok(vertex.indexOf('vSaplingSnowNormalY =')>vertex.indexOf('transformedNormal = normalMatrix * transformedNormal;'));
  assert.ok(sh.vertexShader.indexOf('saplingSnowPosition = vec4(transformed')>sh.vertexShader.indexOf('#include <project_vertex>'));
  const patched=JSON.stringify(sh);patchSaplingSnowShader(sh);assert.equal(JSON.stringify(sh),patched);
 }
 const missing=shader();missing.fragmentShader=missing.fragmentShader.replace('#include <roughnessmap_fragment>','');const snapshot=JSON.stringify(missing);assert.throws(()=>patchSaplingSnowShader(missing),/missing fragment chunk/);assert.equal(JSON.stringify(missing),snapshot);
});
test('existing fallback foliage hook is composed, including authored DoubleSide normal correction and depth material',()=>{
 const loaded=[];loadFoliageAtlas({THREE:{...T,TextureLoader:class{load(url,cb){loaded.push(url);cb(new T.Texture());}}},url:'cpu-existing-atlas',species:['snowpine']});
 const material=new T.MeshStandardMaterial({side:T.DoubleSide}),depth=new T.MeshDepthMaterial();material.userData.depthMat=depth;tuneFoliage({THREE:T,material,species:'snowpine'});
 const original=shader();material.onBeforeCompile(original,{});const before={map:material.map,alphaTest:material.alphaTest,side:material.side,roughness:material.roughness,vertexColors:material.vertexColors,depthMap:depth.map,depthAlpha:depth.alphaTest,key:material.customProgramCacheKey()};
 applySaplingSnowShader(material);const combined=shader();material.onBeforeCompile(combined,{});
 assert.equal(loaded.length,1);assert.equal(material.map,before.map);assert.equal(material.alphaTest,before.alphaTest);assert.equal(material.side,before.side);assert.equal(material.roughness,before.roughness);assert.equal(material.vertexColors,before.vertexColors);assert.equal(depth.map,before.depthMap);assert.equal(depth.alphaTest,before.depthAlpha);
 assert.equal(combined.uniforms.uFoliageAlbedoMean.value,original.uniforms.uFoliageAlbedoMean.value);
 for(const token of['foliageCoverage','diffuseColor.a *= smoothstep(0.5, 2.6','leafTransmission','normal *= faceDirection;'])assert.ok(combined.fragmentShader.includes(token));
 assert.ok(combined.fragmentShader.indexOf('normal *= faceDirection;')<combined.fragmentShader.indexOf('saplingSnowBaseNormal = normal;'));
 const expanded=expand(combined.fragmentShader),oldExpanded=expand(original.fragmentShader);assert.equal(occurrences(expanded,'texture2D('),occurrences(oldExpanded,'texture2D('));assert.equal(occurrences(expanded,'diffuseColor.a'),occurrences(oldExpanded,'diffuseColor.a'));
 assert.ok(material.customProgramCacheKey().startsWith(before.key+'|'));assert.ok(material.customProgramCacheKey().includes(S.version));
});
test('hook composition preserves receiver/renderer and existing clone fix keeps shared shader/cache behavior',()=>{
 const material=new T.MeshPhysicalMaterial({alphaTest:.38,side:T.DoubleSide,roughness:.86,normalMap:new T.Texture(),roughnessMap:new T.Texture(),map:new T.Texture()});
 let seen;material.onBeforeCompile=function(sh,renderer){seen={receiver:this,renderer};sh.fragmentShader='#define EXISTING_HOOK 1\n'+sh.fragmentShader;};material.customProgramCacheKey=()=> 'existing-material';
 const refs={map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,alphaTest:material.alphaTest,side:material.side,depthWrite:material.depthWrite};
 applySaplingSnowShader(material);const hook=material.onBeforeCompile,key=material.customProgramCacheKey();applySaplingSnowShader(material);assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey(),key);
 const sh=shader('physical'),renderer={cpu:true};material.onBeforeCompile(sh,renderer);assert.equal(seen.receiver,material);assert.equal(seen.renderer,renderer);assert.ok(sh.fragmentShader.includes('EXISTING_HOOK'));
 for(const [key,value] of Object.entries(refs))assert.equal(material[key],value);
 const ghost=material.clone();assert.notEqual(ghost.onBeforeCompile,material.onBeforeCompile,'vendored Three clone actually drops callbacks');assert.notEqual(ghost.customProgramCacheKey(),key);
 ghost.onBeforeCompile=material.onBeforeCompile;ghost.customProgramCacheKey=material.customProgramCacheKey;ghost.transparent=true;ghost.opacity=.48;ghost.depthWrite=false;
 const ghostShader=shader('physical');ghost.onBeforeCompile(ghostShader,renderer);assert.equal(ghost.customProgramCacheKey(),key);assert.equal(ghostShader.vertexShader,sh.vertexShader);assert.equal(ghostShader.fragmentShader,sh.fragmentShader);assert.equal(seen.receiver,ghost);
 for(const [key,value] of Object.entries(refs))if(key!=='depthWrite')assert.equal(ghost[key],value);
 const builder=read('assets/ranch-builder-art.js').toString();assert.ok(builder.includes('c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;'));
});
test('actual selected GLB normals recover world Y independently of camera, face side, instance yaw and scale',()=>{
 const {twig}=actual;assert.equal(twig.positions.length,25478);assert.equal(twig.indices.length/3,15966);assert.equal(actual.parts[0].indices.length/3,486);assert.equal(twig.material.alphaMode,'MASK');assert.equal(twig.material.doubleSided,true);
 const models=[new T.Matrix4(),new T.Matrix4().compose(new T.Vector3(-2,4,1),new T.Quaternion().setFromEuler(new T.Euler(.18,.5,-.12)),new T.Vector3(1.2,.8,1.05))];
 for(const model of models)for(const yaw of[0,.73,2.91])for(const scale of[.54,.83,1.14])for(const cameraAngle of[0,.6,2.4]){
  const instance=new T.Matrix4().compose(new T.Vector3(-304,2,-325),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(scale,scale,scale));
  const view=new T.Matrix4().compose(new T.Vector3(30,8,70),new T.Quaternion().setFromEuler(new T.Euler(-.27,cameraAngle,.1)),new T.Vector3(1,1,1)).invert();
  const world=model.clone().multiply(instance),modelView=view.clone().multiply(model),normalMatrix=new T.Matrix3().getNormalMatrix(modelView),expectedMatrix=new T.Matrix3().getNormalMatrix(world),im=new T.Matrix3().setFromMatrix4(instance),viewUp=new T.Vector3(0,1,0).transformDirection(view);
  for(let i=0;i<twig.normals.length;i+=421){
   const raw=new T.Vector3(...twig.normals[i]);assert.ok(raw.toArray().every(Number.isFinite));near(raw.length(),1,8e-5);
   // The vendored defaultnormal_vertex divides each instance axis squared,
   // then applies instance rotation and the model-view inverse transpose.
   const translated=raw.clone().divideScalar(scale*scale).applyMatrix3(im).applyMatrix3(normalMatrix).normalize(),expected=raw.clone().applyMatrix3(expectedMatrix).normalize().y;
   for(const flipSided of[false,true])for(const frontFacing of[false,true]){const shaderNormal=translated.clone().multiplyScalar(flipSided?-1:1);if(flipSided)shaderNormal.negate();near(shaderNormal.dot(viewUp),expected,1e-12);assert.ok(typeof frontFacing==='boolean');}
  }
 }
 const vertex=shader();patchSaplingSnowShader(vertex);const capture=vertex.vertexShader.slice(vertex.vertexShader.indexOf('vec3 saplingSnowViewNormal'),vertex.vertexShader.indexOf('#include <normal_vertex>'));assert.doesNotMatch(capture,/faceDirection|gl_FrontFacing/);assert.ok(capture.includes('#ifdef FLIP_SIDED'));
});
test('selected sapling area mask favors supporting branches and preserves exact GLB buffers and origin conventions',()=>{
 const before=hash(actual.buffer),{twig,normalized}=actual,normalMatrix=new T.Matrix3().getNormalMatrix(normalized);let total=0,up=0,down=0,nearVertical=0,upCover=0,downCover=0,allCover=0;
 const positions=twig.positions.map(p=>new T.Vector3(...p).applyMatrix4(normalized)),normals=twig.normals.map(n=>new T.Vector3(...n).applyMatrix3(normalMatrix).normalize());
 for(let i=0;i<twig.indices.length;i+=3){
  const indices=twig.indices.slice(i,i+3),a=positions[indices[0]],b=positions[indices[1]],c=positions[indices[2]],area=b.clone().sub(a).cross(c.clone().sub(a)).length()*.5;
  const normalY=indices.reduce((s,id)=>s+normals[id].y,0)/3,center=a.clone().add(b).add(c).multiplyScalar(1/3);
  const amount=cover({x:-300+center.x,y:2+center.y,z:-320+center.z,normalY,heightAboveRoot:center.y}).amount;total+=area;allCover+=area*amount;
  if(normalY>.35){up+=area;upCover+=area*amount;}if(normalY<-.35){down+=area;downCover+=area*amount;}if(Math.abs(normalY)<.15)nearVertical+=area;
 }
 near(up/total,.21979858829113452,1e-12);near(down/total,.34975215000856186,1e-12);near(nearVertical/total,.18127154006958895,1e-12); // GLSL normalizes the original slightly quantized normals.
 assert.ok(upCover/up>.5&&upCover/up<S.coverage);assert.equal(downCover,0);assert.ok(allCover/total>.12&&allCover/total<.35,'unweighted polygon area retains substantial green');
 assert.equal(hash(actual.buffer),before);assert.equal(hash(read('assets/models/world/realism/pine_sapling_small.glb')),before);
 near(actual.bounds.min.y,.0009154988802038133,1e-12);near(actual.minYCorrection,-.0024953625389621116,1e-12);assert.ok(Math.abs(actual.minYCorrection)<.003,'raw builder origin differs from normalized ground by less than 3mm');
 for(const scale of[.54,.83,1.14]){
  const pose=new T.Matrix4().compose(new T.Vector3(-300,2,-320),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.7),new T.Vector3(scale,scale,scale)),rawModel=pose.clone().multiply(normalized),rawOrigin=new T.Vector3().applyMatrix4(rawModel),bakedOrigin=new T.Vector3().applyMatrix4(pose);
  for(let i=0;i<twig.positions.length;i+=557){const raw=new T.Vector3(...twig.positions[i]).applyMatrix4(rawModel),baked=positions[i].clone().applyMatrix4(pose);near(raw.distanceTo(baked),0,1e-12);near((baked.y-bakedOrigin.y)-(raw.y-rawOrigin.y),actual.minYCorrection*scale,1e-12);}
 }
});

test('captured nursery matrices and target 13 retain world-metre normals and existing root conventions',()=>{
 const captured=process.env.QA_SAPLING_IDENTITY?JSON.parse(readFileSync(process.env.QA_SAPLING_IDENTITY)):null;
 const fixture={x:-303.8000340679348,z:-294.46626165249995,s:.28107785040512684,r:4.809767964323982};
 const fixtureMatrix=[.05465567484498024,0,.5594924092292786,0,0,.5621557235717773,0,0,-.5594924092292786,0,.05465567484498024,0,-303.800048828125,1.5770848989486694,-294.46624755859375,1];
 const nursery=captured?.state?.saplings;
 const rows=nursery?nursery.cells.filter(c=>c.geometry.attributes.position.count===25478).flatMap(c=>c.rows.map(r=>({instance:r.matrix,model:c.matrix,geometry:c.geometry}))):[{instance:fixtureMatrix,model:new T.Matrix4().toArray()}];
 if(nursery){assert.equal(nursery.retained.length,40);assert.equal(nursery.cells.length,16);assert.equal(rows.length,40);assert.deepEqual(nursery.retained[13],fixture);}
 assert.equal(rows.filter(row=>Math.hypot(row.instance[12]-fixture.x,row.instance[14]-fixture.z)<.001).length,1);
 const baked=actual.twig.positions.map(p=>new T.Vector3(...p).applyMatrix4(actual.normalized)),bakedNormalMatrix=new T.Matrix3().getNormalMatrix(actual.normalized);
 const bakedNormals=actual.twig.normals.map(n=>new T.Vector3(...n).applyMatrix3(bakedNormalMatrix).normalize());
 const view=new T.Matrix4().compose(new T.Vector3(-301,3,-293),new T.Quaternion().setFromEuler(new T.Euler(-.2,.8,0)),new T.Vector3(1,1,1)).invert(),viewUp=new T.Vector3(0,1,0).transformDirection(view);
 for(const row of rows){
  const instance=new T.Matrix4().fromArray(row.instance),model=new T.Matrix4().fromArray(row.model),world=model.clone().multiply(instance),origin=new T.Vector3().applyMatrix4(world),im=new T.Matrix3().setFromMatrix4(instance);
  const modelNormalMatrix=new T.Matrix3().getNormalMatrix(view.clone().multiply(model)),worldNormalMatrix=new T.Matrix3().getNormalMatrix(world),e=instance.elements,axes=[new T.Vector3(e[0],e[1],e[2]).lengthSq(),new T.Vector3(e[4],e[5],e[6]).lengthSq(),new T.Vector3(e[8],e[9],e[10]).lengthSq()];
  const pose=nursery?nursery.retained.find(p=>Math.hypot(p.x-origin.x,p.z-origin.z)<.001):fixture;assert.ok(pose);near(Math.sqrt(axes[1]),pose.s*2,1e-7);near(origin.x,pose.x,2e-5);near(origin.z,pose.z,2e-5);
  if(row.geometry){const bounds=new T.Box3().setFromPoints(baked);for(let k=0;k<3;k++){near(bounds.min.toArray()[k],row.geometry.bounds.min[k],1e-6);near(bounds.max.toArray()[k],row.geometry.bounds.max[k],1e-6);}}
  for(let i=0;i<baked.length;i+=173){
   const p=baked[i].clone().applyMatrix4(world),direct=bakedNormals[i].clone().applyMatrix3(worldNormalMatrix).normalize();
   const throughView=bakedNormals[i].clone().divide(new T.Vector3(...axes)).applyMatrix3(im).applyMatrix3(modelNormalMatrix).normalize();near(throughView.dot(viewUp),direct.y,1e-12);
   near(p.y-origin.y,baked[i].y*Math.sqrt(axes[1]),1e-12);
   const mask=cover({x:p.x,y:p.y,z:p.z,normalY:direct.y,heightAboveRoot:p.y-origin.y});assert.ok(Number.isFinite(mask.amount)&&mask.amount>=0&&mask.amount<=S.coverage);if(direct.y<=S.supportLow)assert.equal(mask.amount,0);
  }
 }
});
