// A separate cached sun-depth pass for the countryside. It never adds another
// scene light or shadow sampler to the already-full riding terrain program.
export const OUTER_SUN_SHADOW_PROFILE='outer-sun-shadow-4';
const SUN_STEP=Math.cos(.35*Math.PI/180);
const FADE_START=950,FADE_END=1050;

export function patchOuterSunShadow(shader,uniforms,lightsChunk){
 const anchor='#include <lights_fragment_begin>',directional='getDirectionalLightInfo( directionalLight, directLight );';
 if(shader.fragmentShader.split(anchor).length!==2||lightsChunk.split(directional).length!==2)return false;
 const declarations=`
 // OUTER_SUN_SHADOW_V4: genuine depth occlusion of the existing directional key.
 uniform sampler2D outerSunDepth;
 uniform mat4 outerSunMatrix;
 uniform vec2 outerSunTexel;
 uniform float outerSunEnabled;
 uniform float outerSunNormalBias;
 // PCF compares different raster texel centres. On a sloping receiver each
 // centre has a different expected depth; one centre-depth comparison creates
 // a visible parallel grid even with a small constant/normal bias.
 float outerSunDepthTap(vec3 coord,vec2 planeGradient,vec2 sampleUV){
  float expectedDepth=coord.z+dot(planeGradient,sampleUV-coord.xy)-.00001;
  return step(expectedDepth,texture2D(outerSunDepth,sampleUV).r);
 }
 float outerSunVisibility(const in vec3 surfacePosition,const in vec3 surfaceInputNormal){
  // Derivatives precede all nonuniform coverage returns. The unshifted position
  // describes the actual rasterized triangle, not the smoothed shading normal.
  vec4 rawProjected=outerSunMatrix*vec4(surfacePosition,1.0);
  vec3 rawCoord=rawProjected.xyz/(abs(rawProjected.w)>1e-6?rawProjected.w:1.0);
  vec3 dx=dFdx(rawCoord),dy=dFdy(rawCoord);
  float determinant=dx.x*dy.y-dx.y*dy.x;
  vec2 planeGradient=vec2(0.0);
  if(abs(determinant)>1e-12)planeGradient=clamp(vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/determinant,vec2(-4.0),vec2(4.0));
  vec3 faceNormal=cross(dFdx(surfacePosition),dFdy(surfacePosition));
  float faceLength2=dot(faceNormal,faceNormal);
  if(dot(faceNormal,surfaceInputNormal)<0.0)faceNormal=-faceNormal;
  if(outerSunEnabled<=0.0)return 1.0;
  float reach=length(max(abs(surfacePosition.xz)-vec2(500.0),vec2(0.0)));
  float domain=smoothstep(26.0,58.0,reach)*(1.0-smoothstep(${FADE_START.toFixed(1)},${FADE_END.toFixed(1)},max(abs(surfacePosition.x),abs(surfacePosition.z))));
  if(domain<=0.0)return 1.0;
  float normalLength2=dot(surfaceInputNormal,surfaceInputNormal);
  vec3 surfaceNormal=faceLength2>1e-12?faceNormal*inversesqrt(faceLength2):(normalLength2>1e-8?surfaceInputNormal*inversesqrt(normalLength2):vec3(0.0,1.0,0.0));
  vec4 projected=outerSunMatrix*vec4(surfacePosition+surfaceNormal*outerSunNormalBias,1.0);
  if(abs(projected.w)<1e-6)return 1.0;
  vec3 coord=projected.xyz/projected.w;
  if(any(lessThanEqual(coord,vec3(0.0)))||any(greaterThanEqual(coord,vec3(1.0))))return 1.0;
  // Interpolate four comparisons at the neighbouring texel centres, instead
  // of moving a fixed box stencil between five quantized visibility levels.
  // Each comparison still uses its own receiver-plane-corrected depth.
  vec2 texelPosition=coord.xy/outerSunTexel-.5;
  vec2 fraction=fract(texelPosition);
  vec2 sample00=(floor(texelPosition)+.5)*outerSunTexel;
  float a=outerSunDepthTap(coord,planeGradient,sample00);
  float b=outerSunDepthTap(coord,planeGradient,sample00+vec2(outerSunTexel.x,0.0));
  float c=outerSunDepthTap(coord,planeGradient,sample00+vec2(0.0,outerSunTexel.y));
  float d=outerSunDepthTap(coord,planeGradient,sample00+outerSunTexel);
  float visibility=mix(mix(a,b,fraction.x),mix(c,d,fraction.x),fraction.y);
  return mix(1.0,visibility,domain*outerSunEnabled);
 }
 `;
 // Three expands the loop index before GLSL preprocessing. Only directional
 // light zero (the world's existing sun/moon key) receives this visibility.
 const lights=lightsChunk.replace(directional,`${directional}
  #if UNROLLED_LOOP_INDEX == 0
   directLight.color*=outerSunVisibility(terrainPosition,terrainNormal);
  #endif`);
 shader.fragmentShader=declarations+shader.fragmentShader.replace(anchor,lights);
 Object.assign(shader.uniforms,uniforms);return true;
}

export function installOuterSunShadows(G){
 const outer=G.world.outerLandscape;if(!outer||outer.sunShadows)return outer?.sunShadows;
 const state=outer.sunShadows={profile:OUTER_SUN_SHADOW_PROFILE,ready:false,disposed:false,failed:false,pending:null,errors:[],meshes:[],stats:null,updates:0,currentSun:null,requestedSun:[],mapRendered:false,update:()=>false,forceUpdate:()=>false};
 let renderTarget=null,ownedSolid=null,depthMaterials=[],installedMaterial=null,previousCompile=null,previousKey=null,compileHook=null,keyHook=null;
 let uniforms=null;
 state.dispose=()=>{
  if(state.disposed)return;state.disposed=true;if(uniforms)uniforms.outerSunEnabled.value=0;
  renderTarget?.dispose();for(const material of depthMaterials)material.dispose();ownedSolid?.dispose();
  for(const mesh of state.meshes){mesh.removeFromParent();if(mesh.isInstancedMesh){
   // WebGLObjects.dispose removes object.instanceMatrix from the GPU cache.
   // Restore the proxy-owned unused attribute before dispatching that event;
   // the resident tree owns the shared live instance buffer and its VAOs.
   mesh.instanceMatrix=mesh.userData.outerSunPrivateInstanceMatrix;mesh.dispose();
  }}state.meshes.length=0;
  if(installedMaterial?.onBeforeCompile===compileHook){installedMaterial.onBeforeCompile=previousCompile;installedMaterial.customProgramCacheKey=previousKey;installedMaterial.needsUpdate=true;}
  installedMaterial?.removeEventListener('dispose',state.dispose);
 };
 state.pending=(async()=>{
  await Promise.all([G.photoscans?.ready,G.worldDetails?.ready,G.undergrowth?.ready,G.world.ranchBuilderArt?.ready,G.quartersPkg?.saplingsReady,G.worldPkg?.oasisReady,G.worldPaths?.roadsideReady,outer.youngWoodland?.pending]);
  if(state.disposed)return state;
  const T=G.THREE,renderer=G.renderer;
  if(!renderer.capabilities.isWebGL2)throw Error('Outer sun depth requires WebGL2');
  const sources=[outer.mesh,outer.rockClusters?.mesh,...(G.photoscans?.outerWoodland?.meshes||[]),...(outer.youngWoodland?.meshes||[])].filter(Boolean);
  if(sources.length<3||!outer.rockClusters?.mesh)throw Error('Outer sun casters are not ready');
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,8000);
  const sun=new T.Vector3(),previousSun=new T.Vector3(),centre=new T.Vector3(0,60,0),corner=new T.Vector3();
  const biasMatrix=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  uniforms={outerSunDepth:{value:null},outerSunMatrix:{value:new T.Matrix4()},outerSunTexel:{value:new T.Vector2()},outerSunEnabled:{value:0},outerSunNormalBias:{value:.5}};
  const sunUniform={value:sun};
  ownedSolid=new T.MeshDepthMaterial({depthPacking:T.BasicDepthPacking,side:T.DoubleSide});ownedSolid.toneMapped=false;
  const byDepth=new Map();let triangles=0;
  for(const source of sources){
   source.updateWorldMatrix(true,false);let depth=ownedSolid;
   if(source.isInstancedMesh){
    const resident=source.customDepthMaterial;
    if(!resident?.map||resident.alphaTest<=0)throw Error('Outer sun tree caster lacks resident alpha depth');
    if(!byDepth.has(resident)){
     const clone=resident.clone();clone.userData={};clone.toneMapped=false;
     clone.onBeforeCompile=shader=>{
      resident.onBeforeCompile(shader);
      const face='vec3 toEye=cameraPosition-instanceMatrix[3].xyz;';
      if(shader.vertexShader.split(face).length!==2)throw Error('Outer sun card facing anchor missing');
      shader.uniforms.outerShadowDirection=sunUniform;
      shader.vertexShader='uniform vec3 outerShadowDirection;\n'+shader.vertexShader.replace(face,'vec3 toEye=outerShadowDirection;');
     };
     clone.customProgramCacheKey=()=>resident.customProgramCacheKey()+'-'+OUTER_SUN_SHADOW_PROFILE;
     byDepth.set(resident,clone);depthMaterials.push(clone);
    }
    depth=byDepth.get(resident);
   }
   const mesh=source.isInstancedMesh?new T.InstancedMesh(source.geometry,depth,source.count):new T.Mesh(source.geometry,depth);
   if(source.isInstancedMesh){mesh.userData.outerSunPrivateInstanceMatrix=mesh.instanceMatrix;mesh.instanceMatrix=source.instanceMatrix;mesh.count=source.count;mesh.boundingBox=source.boundingBox?.clone()||null;mesh.boundingSphere=source.boundingSphere?.clone()||null;}
   mesh.name='Sun depth | '+source.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(source.matrixWorld);mesh.matrixWorld.copy(source.matrixWorld);mesh.frustumCulled=source.frustumCulled;mesh.castShadow=false;mesh.receiveShadow=false;
   scene.add(mesh);state.meshes.push(mesh);triangles+=(source.geometry.index?.count||source.geometry.attributes.position.count)/3*(source.isInstancedMesh?source.count:1);
  }
  installedMaterial=outer.mesh.material;previousCompile=installedMaterial.onBeforeCompile;previousKey=installedMaterial.customProgramCacheKey;
  compileHook=function(shader,renderer){previousCompile.call(this,shader,renderer);if(!patchOuterSunShadow(shader,uniforms,T.ShaderChunk.lights_fragment_begin))throw Error('Outer sun ground shader anchor missing');};
  keyHook=function(){return previousKey.call(this)+'-'+OUTER_SUN_SHADOW_PROFILE;};
  installedMaterial.onBeforeCompile=compileHook;installedMaterial.customProgramCacheKey=keyHook;installedMaterial.needsUpdate=true;installedMaterial.addEventListener('dispose',state.dispose);
  const clearColor=new T.Color();let size=0,rendered=false;
  const makeTarget=next=>{
   renderTarget?.dispose();renderTarget=new T.WebGLRenderTarget(next,next,{format:T.RedFormat,type:T.UnsignedByteType,depthBuffer:true,stencilBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
   renderTarget.texture.name='Outer sun unused depth-pass color';renderTarget.texture.colorSpace=T.NoColorSpace;renderTarget.texture.generateMipmaps=false;
   renderTarget.depthTexture=new T.DepthTexture(next,next,T.UnsignedIntType);renderTarget.depthTexture.format=T.DepthFormat;renderTarget.depthTexture.minFilter=renderTarget.depthTexture.magFilter=T.NearestFilter;renderTarget.depthTexture.generateMipmaps=false;
   renderTarget.depthTexture.name='Outer countryside directional depth';uniforms.outerSunDepth.value=renderTarget.depthTexture;uniforms.outerSunTexel.value.set(1/next,1/next);size=next;rendered=false;
   state.target=renderTarget;state.stats.mapSize=next;state.stats.targetBytesApprox=next*next*5;
  };
  state.stats={casterDraws:state.meshes.length,casterTriangles:triangles,treeDraws:sources.filter(o=>o.isInstancedMesh).length,sharedGeometry:true,sharedInstanceBuffers:true,newGroundSamplers:1,newSceneLights:0,domain:[-FADE_END,FADE_END],updates:0,mapSize:0,targetBytesApprox:0};
  state.scene=scene;state.camera=camera;state.uniforms=uniforms;
  state.update=(direction,{force=false}={})=>{
   if(state.disposed||state.failed||!state.ready)return false;
   if(renderer.xr.isPresenting||renderer.getContext().isContextLost?.()){uniforms.outerSunEnabled.value=0;rendered=false;return false;}
   if(!direction||![direction.x,direction.y,direction.z].every(Number.isFinite)||direction.lengthSq()<1e-12){uniforms.outerSunEnabled.value=0;rendered=false;return false;}
   sun.copy(direction).normalize();sun.toArray(state.requestedSun);
   // Near-horizon rays need huge catchment outside this map. Fade gracefully
   // until the directional key is high enough for this bounded countryside pass.
   const elevation=Math.max(0,Math.min(1,(sun.y-.025)/.075));
   if(elevation<=0){uniforms.outerSunEnabled.value=0;rendered=false;return false;}
   const wanted=Math.min(G.gfx?.get()==='low'?1024:2048,renderer.capabilities.maxTextureSize);
   if(wanted!==size)makeTarget(wanted);
   if(!force&&rendered&&previousSun.dot(sun)>=SUN_STEP){uniforms.outerSunEnabled.value=elevation;return false;}
   camera.up.set(0,Math.abs(sun.y)>.98?0:1,Math.abs(sun.y)>.98?1:0);camera.position.copy(centre).addScaledVector(sun,4000);camera.lookAt(centre);camera.updateMatrixWorld(true);
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const x of [-1100,1100])for(const y of [-80,350])for(const z of [-1100,1100]){corner.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,corner.x);maxX=Math.max(maxX,corner.x);minY=Math.min(minY,corner.y);maxY=Math.max(maxY,corner.y);}
   camera.left=minX-24;camera.right=maxX+24;camera.bottom=minY-24;camera.top=maxY+24;camera.updateProjectionMatrix();
   uniforms.outerSunMatrix.value.copy(biasMatrix).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
   uniforms.outerSunNormalBias.value=.12+.35*Math.max(camera.right-camera.left,camera.top-camera.bottom)/size;
   const target=renderer.getRenderTarget(),cube=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),clearAlpha=renderer.getClearAlpha();
   renderer.getClearColor(clearColor);
   const old={autoClear:renderer.autoClear,color:renderer.autoClearColor,depth:renderer.autoClearDepth,stencil:renderer.autoClearStencil,xr:renderer.xr.enabled,shadows:renderer.shadowMap.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
   try{
    renderer.xr.enabled=false;renderer.shadowMap.enabled=false;renderer.autoClear=renderer.autoClearColor=renderer.autoClearDepth=renderer.autoClearStencil=true;
    // Render-target rectangles are already in physical pixels. The renderer
    // viewport/scissor setters instead change global logical rectangles and
    // multiply them by pixelRatio even with a target bound. Let target binding
    // select this target's full viewport and disabled scissor without touching
    // that separate screen state (essential at Low's fractional pixel ratio).
    renderer.setRenderTarget(renderTarget);renderer.setClearColor(0xffffff,1);renderer.render(scene,camera);
    previousSun.copy(sun);rendered=true;uniforms.outerSunEnabled.value=elevation;state.currentSun=sun.toArray();state.updates++;state.mapRendered=true;state.stats.updates=state.updates;state.stats.normalBias=uniforms.outerSunNormalBias.value;state.stats.span=[camera.right-camera.left,camera.top-camera.bottom];
   }catch(error){uniforms.outerSunEnabled.value=0;state.failed=true;state.errors.push(error.message);console.warn('Outer sun pass unavailable:',error);}
   finally{
    // Binding restores either the prior target's pixel rectangles, or the
    // untouched global logical rectangles scaled for the default framebuffer.
    renderer.setRenderTarget(target,cube,mip);renderer.setClearColor(clearColor,clearAlpha);
    renderer.autoClear=old.autoClear;renderer.autoClearColor=old.color;renderer.autoClearDepth=old.depth;renderer.autoClearStencil=old.stencil;renderer.xr.enabled=old.xr;renderer.shadowMap.enabled=old.shadows;renderer.shadowMap.autoUpdate=old.shadowAuto;renderer.shadowMap.needsUpdate=old.shadowNeeds;
   }
   return rendered;
  };
  state.forceUpdate=()=>state.update(sun,{force:true});
  state.ready=true;return state;
 })().catch(error=>{state.errors.push(error.message);state.failed=true;state.dispose();console.warn('Outer sun setup unavailable:',error);return state;});
 return state;
}
