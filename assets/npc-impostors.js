import {enableOpaqueFoliageCoverage,patchFoliageCoverage} from './tree-impostors.js?v=canopy-lighting-1';
// Original view bakes of the same dressed residents used by the nearby rig.
// Texture pairs load only around the player; unused pairs are evicted by byte budget.
// Nearby profiles stay pinned, so the cache target is soft if a crowded area requires more.
export function createNPCImpostors({THREE:T,maxBytes=20*1024*1024,range=150,onError=console.warn}){
 const base=new URL('./models/npc-distance/',import.meta.url),loader=new T.TextureLoader(),handles=new Set(),cache=new Map(),queue=[],failed=new Set(),mismatched=new Set();
 let manifest=null,loading=0,disposed=false,stamp=0,peakBytes=0;
 const fields=['body','outfit','hairStyle','hair','skin','eyes','shirt','pants','scale'];
 const geometry=new T.PlaneGeometry(1.35,2.2);geometry.translate(0,1.045,0);
 const ready=fetch(new URL('manifest.json?v=resident-distance-1',base)).then(r=>{if(!r.ok)throw Error('NPC view manifest '+r.status);return r.json();}).then(data=>{if(disposed)return;manifest=new Map(data.entries.map(e=>[e.id,e]));for(const h of handles)request(h);return data;}).catch(e=>{failed.add('manifest');onError('Distant resident views unavailable',e);});
 function material(item,pose){
  const m=new T.MeshStandardMaterial({name:'Resident distance | '+item.meta.id,map:item.albedo,alphaTest:.45,side:T.DoubleSide,roughness:1,envMapIntensity:.4});enableOpaqueFoliageCoverage(T,m);
  m.onBeforeCompile=(sh,renderer)=>{
   sh.uniforms.npcNormals={value:item.normals};sh.uniforms.npcRows={value:item.meta.poses*2};sh.uniforms.npcPose=pose;
   sh.vertexShader='uniform float npcRows;uniform float npcPose;varying vec2 npcHeading;\n'+sh.vertexShader;
   sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 npcEye=cameraPosition-modelMatrix[3].xyz;
    float npcAngle=atan(modelMatrix[2].x,modelMatrix[2].z);
    float localAngle=atan(npcEye.x,npcEye.z)-npcAngle;
    float frame=mod(floor((localAngle+6.2831853+.3926991)/.7853982),8.0);
    transformed.x=position.x*cos(localAngle);transformed.z=-position.x*sin(localAngle);
    vMapUv=(uv+vec2(mod(frame,4.0),npcRows-1.0-floor(frame/4.0)-npcPose*2.0))/vec2(4.0,npcRows);
    npcHeading=vec2(sin(npcAngle),cos(npcAngle));`);
   sh.fragmentShader='uniform sampler2D npcNormals;varying vec2 npcHeading;\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 npcN=texture2D(npcNormals,vMapUv).xyz*2.0-1.0;
    float npcLength2=dot(npcN,npcN);npcN=npcLength2>1e-6?npcN*inversesqrt(npcLength2):vec3(0.0,1.0,0.0);
    npcN=vec3(npcN.x*npcHeading.y+npcN.z*npcHeading.x,npcN.y,-npcN.x*npcHeading.x+npcN.z*npcHeading.y);
    normal=normalize(mat3(viewMatrix)*npcN);
    vec3 npcView=normalize(vViewPosition);normal=normalize(normal+npcView*max(.04-dot(normal,npcView),0.0));`);
   sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
    material.specularColor=vec3(.016);material.specularF90=.2;`);
   patchFoliageCoverage(sh,renderer);
  };
  m.customProgramCacheKey=()=> 'resident-distance-lit-1';return m;
 }
 function attach(h,item){
  if(h.mesh||disposed)return;h.item=item;h.pose={value:0};h.mesh=new T.Mesh(geometry,material(item,h.pose));h.mesh.name='Resident distance | '+h.entry.def.id;h.mesh.castShadow=false;h.mesh.receiveShadow=false;h.root.add(h.mesh);h.root.visible=false;
 }
 function bytes(){let n=0;for(const item of cache.values())if(item.loaded)n+=item.bytes;return n;}
 function drop(item){
  for(const h of handles)if(h.item===item){h.mesh?.material.dispose();h.mesh?.removeFromParent();h.mesh=null;h.item=null;h.pose=null;h.root.visible=false;}
  item.albedo?.dispose();item.normals?.dispose();cache.delete(item.meta.id);
 }
 function wanted(item){return [...handles].some(h=>h.wanted&&h.entry.def.id===item.meta.id);}
 function prune(){
  let size=bytes();peakBytes=Math.max(peakBytes,size);
  const unused=[...cache.values()].filter(item=>item.loaded&&!wanted(item)).sort((a,b)=>a.used-b.used);
  for(const item of unused){if(size<=maxBytes)break;size-=item.bytes;drop(item);}
 }
 function pump(){
  while(!disposed&&loading<2&&queue.length){const item=queue.shift();if(!wanted(item)){cache.delete(item.meta.id);continue;}loading++;
   Promise.allSettled([loader.loadAsync(new URL(item.meta.files.albedo.file+'?v='+item.meta.files.albedo.sha256.slice(0,12),base).href),loader.loadAsync(new URL(item.meta.files.normals.file+'?v='+item.meta.files.normals.sha256.slice(0,12),base).href)]).then(results=>{
    if(disposed||results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')r.value.dispose();if(!disposed){failed.add(item.meta.id);cache.delete(item.meta.id);onError('Distant resident view unavailable: '+item.meta.id);}return;}
    [item.albedo,item.normals]=results.map(r=>r.value);item.albedo.colorSpace=T.SRGBColorSpace;item.normals.colorSpace=T.NoColorSpace;
    for(const tex of[item.albedo,item.normals]){tex.anisotropy=2;tex.needsUpdate=true;}
    item.loaded=true;item.bytes=item.albedo.image.width*item.albedo.image.height*4*2*4/3;
    for(const h of handles)if(h.entry.def.id===item.meta.id)attach(h,item);prune();
   }).finally(()=>{loading--;pump();});
  }
 }
 function request(h){
  if(disposed||!manifest||!h.wanted||failed.has(h.entry.def.id)||mismatched.has(h.entry.def.id))return;
  const meta=manifest.get(h.entry.def.id);if(!meta||fields.some(k=>meta.appearance[k]!==h.fit[k])){mismatched.add(h.entry.def.id);return;}
  let item=cache.get(meta.id);if(!item){item={meta,loaded:false,used:++stamp};cache.set(meta.id,item);queue.push(item);pump();}
  item.used=++stamp;if(item.loaded)attach(h,item);
 }
 return {ready,
  create(entry,fit){const root=new T.Group();root.name='Resident distance views | '+entry.def.id;root.visible=false;entry.g.add(root);const h={root,entry,fit,mesh:null,item:null,show:false,wanted:false,stride:0};handles.add(h);
   return {root,range,get ready(){return !!h.mesh;},update(dt,{distance,show,speed=0}){h.wanted=distance<range;h.show=show;h.stride+=Math.max(0,dt)*speed/1.3;request(h);root.visible=show&&h.wanted&&!!h.mesh;if(h.pose)h.pose.value=h.item.meta.poses>1&&speed>.15?1+Math.floor(h.stride*2)%2:0;},dispose(){h.mesh?.material.dispose();root.removeFromParent();handles.delete(h);}};
  },
  endFrame:prune,
  stats:()=>({loaded:[...cache.values()].filter(i=>i.loaded).length,loading,queued:queue.length,bytes:bytes(),pinnedBytes:[...cache.values()].filter(i=>i.loaded&&wanted(i)).reduce((n,i)=>n+i.bytes,0),maxBytes,peakBytes,displayed:[...handles].filter(h=>h.root.visible).length,failed:[...failed],mismatched:[...mismatched]}),
  dispose(){disposed=true;queue.length=0;for(const item of [...cache.values()])drop(item);for(const h of handles)h.root.removeFromParent();handles.clear();geometry.dispose();},
 };
}
