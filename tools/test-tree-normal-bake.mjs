import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createMatchedTreeNormalMaterial} from './asset-gen/tree-normal-material.mjs';
import {treeImpostor} from '../assets/tree-impostors.js';

function source(name='test_leaves'){const m=new T.MeshStandardMaterial({name,map:new T.Texture(),normalMap:new T.Texture(),normalScale:new T.Vector2(.8,1.2),alphaTest:.38});m.map.repeat.set(2,3);m.map.offset.set(.2,.3);return m;}
function shader(){return {uniforms:{},vertexShader:T.ShaderLib.normal.vertexShader,fragmentShader:T.ShaderLib.normal.fragmentShader};}
const renderer={getContext:()=>({getContextAttributes:()=>({antialias:true})}),getRenderTarget:()=>null,capabilities:{maxSamples:4}};
test('matched bake keeps original source maps and exact alpha UV transform, adjusting only cloned leaf normal scale',()=>{const old=source(),mat=createMatchedTreeNormalMaterial(T,old),sh=shader();mat.onBeforeCompile(sh);assert.equal(mat.normalMap,old.normalMap);assert.deepEqual(old.normalScale.toArray(),[.8,1.2]);assert.deepEqual(mat.normalScale.toArray(),[.8*.55,1.2*.55]);assert.equal(mat.side,T.DoubleSide);assert.equal(sh.uniforms.bakeAlbedo.value,old.map);assert.equal(sh.uniforms.bakeCutoff.value,.38);assert.deepEqual(sh.uniforms.bakeAlbedoTransform.value.elements,old.map.matrix.elements);assert.notEqual(sh.uniforms.bakeAlbedoTransform.value,old.map.matrix);});
test('wood retains its material normal scale and receives no leaf canopy blend',()=>{const old=source('test_trunk'),mat=createMatchedTreeNormalMaterial(T,old),sh=shader();mat.onBeforeCompile(sh);assert.deepEqual(mat.normalScale.toArray(),old.normalScale.toArray());assert(!sh.fragmentShader.includes('mix(normal,canopyUp,.42)'));});
test('bake shader uses Three face-visible normal-map result, exact leaf blend and opaque accepted samples',()=>{const mat=createMatchedTreeNormalMaterial(T,source()),sh=shader();mat.onBeforeCompile(sh);assert(sh.fragmentShader.includes('#include <normal_fragment_begin>'));assert(sh.fragmentShader.includes('#include <normal_fragment_maps>'));assert(sh.fragmentShader.includes('mix(normal,canopyUp,.42)'));assert(sh.fragmentShader.includes('normal*mat3(viewMatrix)'));assert(sh.fragmentShader.includes('bakeNormalLength2>1e-6'));assert(sh.fragmentShader.includes('gl_FragColor = vec4(bakeWorldNormal*.5+.5,1.0);'));assert(!sh.fragmentShader.includes('if(n.y<0.)'));assert(sh.fragmentShader.includes('if(bakeAlpha<bakeCutoff)discard;'));assert(sh.vertexShader.includes('vBakeAlbedoUv=(bakeAlbedoTransform*vec3(uv,1.0)).xy;'));});
test('view-normal row transform recovers source-world direction in all eight atlas cameras',()=>{for(let i=0;i<8;i++){const camera=new T.OrthographicCamera(-2,2,10,-1,.1,100),a=i*Math.PI/4;camera.position.set(Math.sin(a)*30,0,Math.cos(a)*30);camera.lookAt(0,0,0);camera.updateMatrixWorld();const v=new T.Vector3(.23,-.51,.71).normalize(),rot=new T.Matrix3().setFromMatrix4(camera.matrixWorldInverse),view=v.clone().applyMatrix3(rot),world=view.applyMatrix3(rot.clone().transpose());assert(world.distanceTo(v)<1e-12);}});
test('only flagged new atlas skips legacy upward normal bias and uses separate cache program',()=>{function compile(profile){const obj=treeImpostor({THREE:T,albedo:new T.Texture(),normals:new T.Texture(),width:4,height:10,bottom:-.5,normalProfile:profile}),sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};obj.mat.onBeforeCompile(sh,renderer);return {obj,sh};}const old=compile(),fresh=compile('view-facing-material-v1'),unknown=compile('unknown');assert(old.sh.fragmentShader.includes('treeN=mix(treeN,vec3(treeN.x,.8,treeN.z),.30);'));assert(unknown.sh.fragmentShader.includes('treeN=mix(treeN,vec3(treeN.x,.8,treeN.z),.30);'));assert(!fresh.sh.fragmentShader.includes('treeN=mix(treeN,vec3(treeN.x,.8,treeN.z),.30);'));assert.notEqual(old.obj.mat.customProgramCacheKey(),fresh.obj.mat.customProgramCacheKey());for(const {obj,sh}of [old,fresh]){assert.equal(obj.mat.alphaToCoverage,true);assert.equal(obj.mat.blendSrcAlpha,T.ZeroFactor);assert.equal(obj.mat.blendDstAlpha,T.OneFactor);assert.equal(obj.mat.alphaTest,.22);assert(sh.fragmentShader.includes('treeLength2>1e-6'));assert(sh.fragmentShader.includes('canopyLength2>1e-6'));assert(sh.fragmentShader.includes('treeViewDir*max(.08-dot(normal,treeViewDir),0.0)'));assert(sh.fragmentShader.includes('gl_FragColor.a=foliageMultisample?foliageCoverageAlpha:1.0;'));}});

test('coverage mode follows the active render target without allowing alpha holes on single-sample output',()=>{
 let target=null;const activeRenderer={getContext:()=>({getContextAttributes:()=>({antialias:true})}),getRenderTarget:()=>target,capabilities:{maxSamples:4}};
 const obj=treeImpostor({THREE:T,albedo:new T.Texture(),normals:new T.Texture(),width:4,height:10,bottom:-.5,normalProfile:'view-facing-material-v1'});
 const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};obj.mat.onBeforeCompile(sh,activeRenderer);
 assert.equal(sh.uniforms.foliageMultisample.value,true);target={samples:0};assert.equal(sh.uniforms.foliageMultisample.value,false);target={samples:4};assert.equal(sh.uniforms.foliageMultisample.value,true);activeRenderer.capabilities.maxSamples=0;assert.equal(sh.uniforms.foliageMultisample.value,false);
 assert(sh.fragmentShader.includes('else if(diffuseColor.a<alphaTest)discard;'));
 assert(sh.fragmentShader.includes('gl_FragColor.a=foliageMultisample?foliageCoverageAlpha:1.0;'));
});
test('upright atlas metadata declares the matched normal profile and exact published texture bytes',()=>{
 const directory=new URL('../assets/models/world/realism/',import.meta.url);
 const catalog=JSON.parse(fs.readFileSync(new URL('tree-impostors.json',directory),'utf8'));
 const entry=catalog.trees.find(t=>t.id==='upright_broadleaf_01'&&t.variant===-1);
 assert(entry);assert.equal(entry.normalProfile,'view-facing-material-v1');assert.equal(entry.viewCount,8);
 assert(entry.width>0&&entry.height>0&&Number.isFinite(entry.bottom));
 for(const channel of ['views','normals']){
  const metadata=entry[channel];assert.equal(metadata.file.split('/').length,1);
  const bytes=fs.readFileSync(new URL(metadata.file,directory));assert.equal(bytes.length,metadata.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),metadata.sha256);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
 }
});
