import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createWaterfallArt} from '../assets/waterfall-art.js';
import {HOLLOWPEAK_DESIGN as D} from '../assets/hollowpeak-design.mjs';
import {cascadeSpread} from '../assets/cascade-flow.mjs';
import {configureHollowpeakImpactFoam,HOLLOWPEAK_IMPACT_FOAM_PROFILE} from '../assets/hollowpeak-impact-foam.mjs';

// CPU contracts against the resident factory and design. Native appearance and
// continuous motion still require rendered inspection; no saved arrays are used.
function fixture(){
  const art=createWaterfallArt({THREE:T}),f=D.fall;
  const flow={x:f.x,z:f.z,top:f.top,bottom:f.bottom,width:f.width,run:f.run,name:'Hollowpeak connected falls'};
  const fall=art.fall({...flow,flowProfile:'hollowpeak-cataract-2'});
  const impact=()=>art.impact({x:f.landing[0],y:D.pool.level+.045,z:f.landing[2],radius:f.impactRadius});
  const foam=impact(),other=art.impact({x:30,y:1,z:40,radius:2.4});
  const upper=art.impact({x:30,y:3,z:35,radius:1.7,heightAt:()=>2,surfaceOffset:.1});
  for(const o of [fall,foam,other,upper])o.updateMatrixWorld(true);
  return {art,fall,foam,other,upper,flow,args:{foam,fall,flow,landing:f.landing,time:art.time}};
}
function compile(material){
  const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader,{});return shader;
}
function noRandom(run){
  const previous=Math.random;let calls=0;
  Math.random=()=>{calls++;throw Error('Impact configuration/compile must not consume RNG');};
  try{return run();}finally{Math.random=previous;assert.equal(calls,0);}
}
const materialSnapshot=m=>({json:JSON.stringify(m.toJSON()),compile:m.onBeforeCompile,key:m.customProgramCacheKey});
function assertMaterialUnchanged(m,before){
  assert.equal(JSON.stringify(m.toJSON()),before.json);
  assert.equal(m.onBeforeCompile,before.compile);assert.equal(m.customProgramCacheKey,before.key);
}
const pose=o=>[...o.position,...o.quaternion,...o.scale,...o.matrix.elements,...o.matrixWorld.elements];
function meshSnapshot(mesh){
  return {mesh,geometry:mesh.geometry,material:mesh.material,parent:mesh.parent,
    attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,{ref:a,array:a.array,values:a.array.slice(),itemSize:a.itemSize,normalized:a.normalized}])),
    index:mesh.geometry.index,indexArray:mesh.geometry.index.array,indexValues:mesh.geometry.index.array.slice(),indexMeta:[mesh.geometry.index.itemSize,mesh.geometry.index.normalized],pose:pose(mesh),
    flags:[mesh.visible,mesh.renderOrder,mesh.castShadow,mesh.receiveShadow]};
}
function assertMeshUnchanged(mesh,before){
  assert.equal(mesh,before.mesh);assert.equal(mesh.geometry,before.geometry);assert.equal(mesh.material,before.material);assert.equal(mesh.parent,before.parent);
  assert.deepEqual(Object.keys(mesh.geometry.attributes),Object.keys(before.attributes));
  for(const [key,a] of Object.entries(before.attributes)){
    const now=mesh.geometry.attributes[key];assert.equal(now,a.ref);assert.equal(now.array,a.array);
    assert.deepEqual(now.array,a.values);assert.equal(now.itemSize,a.itemSize);assert.equal(now.normalized,a.normalized);
  }
  assert.equal(mesh.geometry.index,before.index);assert.equal(mesh.geometry.index.array,before.indexArray);assert.deepEqual(mesh.geometry.index.array,before.indexValues);
  assert.deepEqual([mesh.geometry.index.itemSize,mesh.geometry.index.normalized],before.indexMeta);assert.deepEqual(pose(mesh),before.pose);
  assert.deepEqual([mesh.visible,mesh.renderOrder,mesh.castShadow,mesh.receiveShadow],before.flags);
}
const compact=s=>s.replace(/\s+/g,'');
function fieldBody(source,name){
  const body=source.match(new RegExp('float '+name+'\\(vec2 p\\)\\{([^}]+)\\}'))?.[1];assert(body,name+' must exist');return compact(body.replace(/fallHash|foamHash/g,'hash'));
}
function currentCore(source){
  const block=source.match(/float currentBend=[\s\S]*?float sideCurrent=[^;]+;/)?.[0];assert(block,'whole-width main/side current core must exist');return compact(block.replace(/fallNoise|foamNoise/g,'noise'));
}

test('one existing impact material preserves resources, other impacts, geometry and the live clock without RNG or uniform additions',()=>{
  const x=fixture(),m=x.foam.material,owners=[x.fall.children[0],x.foam,x.other,x.upper],before=owners.map(meshSnapshot);
  const old=compile(m),others=[x.other,x.upper].map(o=>({state:materialSnapshot(o.material),shader:compile(o.material)}));
  const oldState=m.toJSON(),clock=x.art.time,fallChild=x.fall.children[0],effects=x.art.effectGroups,mists=x.art.mistMaterials;
  const fallPose=pose(x.fall),fallState=materialSnapshot(fallChild.material),fallShader=compile(fallChild.material);
  const {state,shader}=noRandom(()=>({state:configureHollowpeakImpactFoam(x.args),shader:compile(m)}));
  assert.equal(state.profile,HOLLOWPEAK_IMPACT_FOAM_PROFILE);assert.equal(state.material,m);assert.equal(state.sharedTime,clock);assert.equal(x.art.time,clock);
  assert.equal(x.foam.material,m);assert.equal(x.fall.children.length,1);assert.equal(x.fall.children[0],fallChild);
  assert.deepEqual(pose(x.fall),fallPose);assertMaterialUnchanged(fallChild.material,fallState);
  const afterFall=compile(fallChild.material);assert.equal(afterFall.vertexShader,fallShader.vertexShader);assert.equal(afterFall.fragmentShader,fallShader.fragmentShader);assert.equal(afterFall.uniforms.waterfallTime,clock);
  assert.equal(x.art.effectGroups,effects);assert.equal(x.art.mistMaterials,mists);assert.equal(effects.length,0);assert.equal(mists.length,0);
  assert.equal(m.opacity,.52);assert.equal(m.color.getHex(),0xc0d2cf);
  const nextState=m.toJSON();for(const key of ['opacity','color','userData']){delete oldState[key];delete nextState[key];}assert.deepEqual(nextState,oldState);
  assert.deepEqual(Object.keys(shader.uniforms),Object.keys(old.uniforms));
  for(const key of Object.keys(old.uniforms))assert.equal(shader.uniforms[key],old.uniforms[key]);
  assert.equal(shader.uniforms.waterfallTime,clock);
  for(let i=0;i<2;i++){
    const control=[x.other,x.upper][i],now=compile(control.material);assertMaterialUnchanged(control.material,others[i].state);
    assert.equal(now.vertexShader,others[i].shader.vertexShader);assert.equal(now.fragmentShader,others[i].shader.fragmentShader);
    assert.deepEqual(Object.keys(now.uniforms),Object.keys(others[i].shader.uniforms));assert.equal(now.uniforms.waterfallTime,clock);
    assert.equal(control.material.customProgramCacheKey(),'aerated-impact-v3-natural-footprint');assert.notEqual(m.customProgramCacheKey(),control.material.customProgramCacheKey());
  }
  owners.forEach((o,i)=>assertMeshUnchanged(o,before[i]));
  const g=fallChild.geometry,rate=g.attributes.cascadeSpeed.array[0];
  assert(g.attributes.cascadeSpeed.array instanceof Float32Array);assert(g.attributes.cascadeSpeed.array.every(v=>Object.is(v,rate)));
  assert.equal(rate,Math.fround(x.fall.userData.waterfallArt.rate));assert.equal(state.binding.actualFloat32Rate,rate);
  const toe=Array.from({length:g.attributes.uv.count},(_,i)=>i).filter(i=>g.attributes.uv.getY(i)===1);
  assert.equal(state.binding.toeVertices,toe.length);assert(toe.length>1);assert(toe.every(i=>g.attributes.cascadeMotion.getX(i)===0));
  assert.equal(state.binding.toeHalfWidthM,x.flow.width*cascadeSpread(x.flow,1));assert.equal(state.binding.axis,'+Z');
  assert(state.binding.maximumPackedPositionResidualM<=state.binding.packingToleranceM);
  noRandom(()=>x.art.update(12.75));assert.equal(shader.uniforms.waterfallTime.value,12.75);assert.equal(compile(x.other.material).uniforms.waterfallTime,clock);
});

test('actual Float32 rate, profile, flow and toe guards reject before material mutation, and repeated configuration is rejected',()=>{
  const x=fixture(),g=x.fall.children[0].geometry,m=x.foam.material;
  function reject(args,pattern){const before=materialSnapshot(m);noRandom(()=>assert.throws(()=>configureHollowpeakImpactFoam(args),pattern));assertMaterialUnchanged(m,before);}
  const rates=g.attributes.cascadeSpeed.array,saved=rates[1];rates[1]=Math.fround(saved+.01);
  try{reject(x.args,/identical actual Float32/);}finally{rates[1]=saved;}
  const rateAttribute=g.attributes.cascadeSpeed;g.setAttribute('cascadeSpeed',new T.BufferAttribute(new Float64Array(rates),1));
  try{reject(x.args,/resident Float32/);}finally{g.setAttribute('cascadeSpeed',rateAttribute);}
  const meta=x.fall.children[0].material.userData.hollowpeakFallingWater,profile=meta.profile;meta.profile='unknown';
  try{reject(x.args,/stranded-2/);}finally{meta.profile=profile;}
  reject({...x.args,flow:{...x.flow,run:x.flow.run+1}},/flow metadata/);
  const toe=Array.from({length:g.attributes.uv.count},(_,i)=>i).find(i=>g.attributes.uv.getY(i)===1),positions=g.attributes.position.array,z=toe*3+2,oldZ=positions[z];
  positions[z]=Math.fround(oldZ+.01);try{reject(x.args,/toe geometry/);}finally{positions[z]=oldZ;}
  const motion=g.attributes.cascadeMotion.array,oldMotion=motion[toe];motion[toe]=.01;
  try{reject(x.args,/zero actual toe/);}finally{motion[toe]=oldMotion;}
  noRandom(()=>configureHollowpeakImpactFoam(x.args));reject(x.args,/unmodified existing/);
});

test('emitted foam reuses the exact fall noise/current core and preserves the old shader outside its bounded density mask',()=>{
  const x=fixture(),old=compile(x.foam.material),fall=compile(x.fall.children[0].material);
  const state=noRandom(()=>configureHollowpeakImpactFoam(x.args)),shader=noRandom(()=>compile(x.foam.material));
  assert.equal(fieldBody(old.fragmentShader,'foamHash'),fieldBody(fall.fragmentShader,'fallHash'));
  assert.equal(fieldBody(old.fragmentShader,'foamNoise'),fieldBody(fall.fragmentShader,'fallNoise'));
  assert.equal(currentCore(shader.fragmentShader),currentCore(fall.fragmentShader));
  assert(shader.fragmentShader.includes('float fallTravel=1.0-waterfallTime*'+Number(state.binding.actualFloat32Rate).toPrecision(17)+';'));
  const alpha='diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*max(core,scattered);';
  const start=shader.fragmentShader.indexOf('// Same accepted current field at the actual toe (s=1).'),end=shader.fragmentShader.indexOf('*directionGate;',start)+'*directionGate;'.length;
  assert(start>=0&&end>start);
  assert.equal((shader.fragmentShader.slice(0,start)+alpha+shader.fragmentShader.slice(end)).replace('varying vec2 impactWorldXZ;\n',''),old.fragmentShader);
  assert.equal(shader.vertexShader.replace('varying vec2 impactWorldXZ;\n','').replace('\nimpactWorldXZ=(modelMatrix*vec4(position,1.0)).xz;',''),old.vertexShader);
  const body=compact(shader.fragmentShader);
  assert(body.includes('floatimpactBody=clamp((.58*mainCurrent+.32*sideCurrent)*bubbles+.12*scattered,0.0,.60);'));
  assert(body.includes('floatdirectionGate=smoothstep(-1.0,-.1,impactDelta.y)*(1.0-smoothstep(.9,2.6,impactDelta.y));'));
  assert(body.includes('diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*min(max(core,scattered),impactBody)*directionGate;'));
  // Both smoothstep factors stay in [0,1], and min retains the old density
  // ceiling. The .60 mask times the existing .52 opacity caps alpha at .312.
  assert.equal(x.foam.material.opacity*.60,.312);
});
