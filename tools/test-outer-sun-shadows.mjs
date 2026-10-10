import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {treeImpostor} from '../assets/tree-impostors.js';
import {installOuterSunShadows,patchOuterSunShadow} from '../assets/outer-sun-shadows.mjs';
function rendererFixture({pixelRatio=.81,offscreen=true}={}){
 // Model Three r164's distinct logical screen and physical render-target
 // rectangles. setViewport/setScissor scale unconditionally by pixelRatio;
 // setRenderTarget selects its own pixel rectangles without changing globals.
 const original=new T.WebGLRenderTarget(640,480);original.viewport.set(11,13,509,307);original.scissor.set(19,23,401,251);original.scissorTest=false;
 const values={target:offscreen?original:null,cube:2,mip:1,viewport:new T.Vector4(3,4,600,700),scissor:new T.Vector4(7,8,400,500),scissorTest:true,color:new T.Color(.1,.2,.3),alpha:.4,currentViewport:new T.Vector4(),currentScissor:new T.Vector4(),currentScissorTest:false};
 const bind=()=>{values.currentViewport.copy(values.target?values.target.viewport:values.viewport.clone().multiplyScalar(pixelRatio).floor());values.currentScissor.copy(values.target?values.target.scissor:values.scissor.clone().multiplyScalar(pixelRatio).floor());values.currentScissorTest=values.target?values.target.scissorTest:values.scissorTest;};bind();
 const r={capabilities:{isWebGL2:true,maxTextureSize:4096},xr:{enabled:true,isPresenting:false},shadowMap:{enabled:true,autoUpdate:false,needsUpdate:true},autoClear:false,autoClearColor:false,autoClearDepth:true,autoClearStencil:false,renderCalls:0,passViewports:[],getContext:()=>({isContextLost:()=>false}),
 getRenderTarget:()=>values.target,getActiveCubeFace:()=>values.cube,getActiveMipmapLevel:()=>values.mip,getViewport:v=>v.copy(values.viewport),getCurrentViewport:v=>v.copy(values.currentViewport),getScissor:v=>v.copy(values.scissor),getScissorTest:()=>values.scissorTest,getClearColor:c=>c.copy(values.color),getClearAlpha:()=>values.alpha,
 setRenderTarget:(v,c=0,m=0)=>{values.target=v;values.cube=c;values.mip=m;bind();},setViewport:(...v)=>{values.viewport.copy(v.length===1?v[0]:new T.Vector4(...v));values.currentViewport.copy(values.viewport).multiplyScalar(pixelRatio).floor();},setScissor:(...v)=>{values.scissor.copy(v.length===1?v[0]:new T.Vector4(...v));values.currentScissor.copy(values.scissor).multiplyScalar(pixelRatio).floor();},setScissorTest:v=>{values.scissorTest=v;values.currentScissorTest=v;},setClearColor:(c,a=1)=>{values.color.set(c);values.alpha=a;},
 render(scene,camera){this.renderCalls++;this.passViewports.push(values.currentViewport.toArray());assert.equal(this.xr.enabled,false);assert.equal(this.shadowMap.enabled,false);assert.equal(values.currentScissorTest,false);assert.deepEqual(values.currentViewport.toArray(),[0,0,values.target.width,values.target.height]);assert(camera.isOrthographicCamera);assert.equal(scene.children.length,3);if(this.fail)throw Error('synthetic pass failure');}};
 r.snapshot=()=>({target:values.target,cube:values.cube,mip:values.mip,viewport:values.viewport.toArray(),scissor:values.scissor.toArray(),scissorTest:values.scissorTest,currentViewport:values.currentViewport.toArray(),currentScissor:values.currentScissor.toArray(),currentScissorTest:values.currentScissorTest,color:values.color.toArray(),alpha:values.alpha,autoClear:r.autoClear,autoClearColor:r.autoClearColor,autoClearDepth:r.autoClearDepth,autoClearStencil:r.autoClearStencil,xr:r.xr.enabled,shadow:{...r.shadowMap}});return r;
}
function fixture(options){
 const renderer=rendererFixture(options),ground=new T.Mesh(new T.PlaneGeometry(2200,2200),new T.MeshStandardMaterial()),rock=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());ground.geometry.rotateX(-Math.PI/2);ground.name='Outer ground';rock.name='Scanned rocks';
 ground.material.onBeforeCompile=s=>{s.vertexShader='base-vertex\n'+s.vertexShader;s.fragmentShader='varying vec3 terrainPosition;varying vec3 terrainNormal;\n'+s.fragmentShader;};ground.material.customProgramCacheKey=()=> 'base-outer';
 const card=treeImpostor({THREE:T,albedo:new T.Texture(),normals:new T.Texture(),width:5,height:7,bottom:-.2});const tree=new T.InstancedMesh(card.geo,card.mat,2);tree.name='Outer woodland';tree.customDepthMaterial=card.mat.userData.scanDepth;tree.setMatrixAt(0,new T.Matrix4().makeTranslation(-550,5,-640));tree.setMatrixAt(1,new T.Matrix4().makeTranslation(400,10,-610));
 let resolve;const ready=new Promise(r=>resolve=r);const outer={mesh:ground,rockClusters:{mesh:rock}},G={THREE:T,renderer,world:{outerLandscape:outer},photoscans:{ready,outerWoodland:{meshes:[tree]}},gfx:{get:()=> 'high'}};return{G,outer,ground,rock,tree,card,resolve};
}
test('scoped shader changes only the directional key and fails atomically',()=>{
 const u={outerSunEnabled:{value:0}},shader={uniforms:{before:{value:1}},fragmentShader:'#include <lights_fragment_begin>'};assert(patchOuterSunShadow(shader,u,T.ShaderChunk.lights_fragment_begin));
 assert.equal(shader.fragmentShader.split('directLight.color*=outerSunVisibility').length-1,1);assert(shader.fragmentShader.indexOf('getDirectionalLightInfo')<shader.fragmentShader.indexOf('directLight.color*=outerSunVisibility'));assert(shader.fragmentShader.includes('#if UNROLLED_LOOP_INDEX == 0'));assert(!shader.fragmentShader.includes('reflectedLight.indirectDiffuse*='));
 assert.equal((shader.fragmentShader.match(/outerSunDepthTap\(coord/g)||[]).length,4);assert(shader.fragmentShader.includes('vec2 sample00=(floor(texelPosition)+.5)*outerSunTexel;'));assert(shader.fragmentShader.includes('mix(mix(a,b,fraction.x),mix(c,d,fraction.x),fraction.y)'));assert(!shader.fragmentShader.includes('outerSunTexel*.60'));assert.equal((shader.fragmentShader.match(/texture2D\(outerSunDepth/g)||[]).length,1);assert(shader.fragmentShader.indexOf('dFdx(rawCoord)')<shader.fragmentShader.indexOf('if(outerSunEnabled<=0.0)'));assert(shader.fragmentShader.includes('dot(planeGradient,sampleUV-coord.xy)'));assert(shader.fragmentShader.includes('surfaceInputNormal'));assert(shader.fragmentShader.includes('abs(projected.w)<1e-6'));assert(shader.fragmentShader.includes('smoothstep(26.0,58.0'));
 const bad={uniforms:{},fragmentShader:'unchanged'},before=structuredClone(bad);assert.equal(patchOuterSunShadow(bad,u,T.ShaderChunk.lights_fragment_begin),false);assert.deepEqual(bad,before);
});
test('late casters share sources; parallel card depth, cached updates and failure restore renderer state',async()=>{
 const{G,outer,ground,tree,card,resolve}=fixture(),beforeCompile=ground.material.onBeforeCompile,beforeKey=ground.material.customProgramCacheKey;
 const originalRandom=Math.random;Math.random=()=>{throw Error('early resource allocation');};let state;try{state=installOuterSunShadows(G);}finally{Math.random=originalRandom;}assert.equal(state.ready,false);resolve();await state.pending;assert.equal(state.ready,true);assert.deepEqual(state.errors,[]);assert.equal(state.meshes.length,3);
 assert.equal(state.meshes[0].geometry,ground.geometry);assert.equal(state.meshes[2].geometry,tree.geometry);assert.equal(state.meshes[2].instanceMatrix,tree.instanceMatrix);
 const depth=state.meshes[2].material;assert.notEqual(depth,tree.customDepthMaterial);assert.equal(depth.map,card.mat.map);assert.equal(depth.alphaTest,.22);
 const shader={vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader,uniforms:{}};depth.onBeforeCompile(shader);assert(shader.vertexShader.includes('vec3 toEye=outerShadowDirection;'));assert(!shader.vertexShader.includes('cameraPosition-instanceMatrix[3].xyz'));assert(shader.uniforms.outerShadowDirection);
 const old=G.renderer.snapshot(),sun=new T.Vector3(.3,.75,.5).normalize();assert.equal(state.update(sun),true);assert.deepEqual(G.renderer.snapshot(),old);assert.equal(state.stats.mapSize,2048);assert.equal(state.stats.newGroundSamplers,1);assert.equal(state.stats.targetBytesApprox,2048*2048*5);
 assert.equal(state.update(sun),false);assert.equal(G.renderer.renderCalls,1);state.forceUpdate();assert.equal(G.renderer.renderCalls,2);assert.equal(state.mapRendered,true);
 const compiledA={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};ground.material.onBeforeCompile(compiledA,G.renderer);const oldDepth=state.target.depthTexture;
 G.gfx.get=()=> 'low';state.update(sun);assert.equal(state.stats.mapSize,1024);assert.deepEqual(G.renderer.snapshot(),old);
 const compiledB={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};ground.material.onBeforeCompile(compiledB,G.renderer);
 for(const key of Object.keys(state.uniforms)){assert.equal(compiledA.uniforms[key],state.uniforms[key]);assert.equal(compiledB.uniforms[key],state.uniforms[key]);}
 assert.notEqual(state.target.depthTexture,oldDepth);assert.equal(compiledA.uniforms.outerSunDepth.value,state.target.depthTexture);assert.equal(compiledB.uniforms.outerSunTexel.value.x,1/1024);assert.equal(compiledB.uniforms.outerSunEnabled.value,1);
 state.update(new T.Vector3(NaN,1,1));assert.equal(state.uniforms.outerSunEnabled.value,0);state.update(new T.Vector3(0,1,0),{force:true});assert(state.uniforms.outerSunMatrix.value.elements.every(Number.isFinite));
 G.renderer.fail=true;const warn=console.warn;console.warn=()=>{};try{state.update(new T.Vector3(1,1,0),{force:true});}finally{console.warn=warn;}
 assert.equal(state.failed,true);assert.equal(state.uniforms.outerSunEnabled.value,0);assert.equal(state.errors.length,1);assert.deepEqual(G.renderer.snapshot(),old);
 let disposedInstance=null;state.meshes[2].addEventListener('dispose',event=>{disposedInstance=event.target.instanceMatrix;});let sharedDisposed=0;for(const r of [ground.geometry,tree.geometry,tree.material,tree.customDepthMaterial,card.mat.map])r.addEventListener('dispose',()=>sharedDisposed++);state.dispose();state.dispose();assert.equal(sharedDisposed,0);assert.notEqual(disposedInstance,tree.instanceMatrix);assert.equal(ground.material.onBeforeCompile,beforeCompile);assert.equal(ground.material.customProgramCacheKey,beforeKey);
});
test('pending disposal allocates no pass and leaves ground hooks untouched',async()=>{
 const{G,ground,resolve}=fixture(),compile=ground.material.onBeforeCompile,state=installOuterSunShadows(G);state.dispose();resolve();await state.pending;assert.equal(state.ready,false);assert.equal(state.meshes.length,0);assert.equal(ground.material.onBeforeCompile,compile);
});

test('target pixels stay independent of screen pixel ratio, restoring both rectangle spaces',async()=>{
 for(const pixelRatio of [.81,1,2])for(const offscreen of [false,true]){
  const {G,resolve}=fixture({pixelRatio,offscreen}),before=G.renderer.snapshot(),state=installOuterSunShadows(G);resolve();await state.pending;
  const sun=new T.Vector3(.3,.75,.5).normalize();assert.equal(state.update(sun),true);assert.deepEqual(G.renderer.snapshot(),before);
  G.gfx.get=()=> 'low';assert.equal(state.update(sun),true);assert.deepEqual(G.renderer.snapshot(),before);assert.deepEqual(G.renderer.passViewports,[[0,0,2048,2048],[0,0,1024,1024]]);
  G.renderer.fail=true;const warn=console.warn;console.warn=()=>{};try{state.forceUpdate();}finally{console.warn=warn;}assert(state.failed);assert.deepEqual(G.renderer.snapshot(),before);state.dispose();
 }
});
