import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import crypto from 'node:crypto';
export const repo=path.resolve(process.env.RIVER_TEST_REPO||fileURLToPath(new URL('../',import.meta.url)));
const moduleAt=p=>import(pathToFileURL(path.join(repo,p)));
export const T=await moduleAt('assets/vendor/three/build/three.module.js');
const {createGeology}=await moduleAt('assets/geology.js'),{createSceneryArt}=await moduleAt('assets/scenery-art.js'),{createWaterfallArt}=await moduleAt('assets/waterfall-art.js');
export const baseline=new URL('./fixtures/river-7908e80/',import.meta.url);
export const oldWater=fs.readFileSync(new URL('assets/features/world-water.js',baseline),'utf8');
export const nextWater=fs.readFileSync(process.env.RIVER_WATER_RUNTIME||path.join(repo,'assets/features/world-water.js'),'utf8');
export const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export const bytes=a=>a?sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength)):null;
function canvas(){const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});return{width:0,height:0,getContext:()=>ctx};}
const riverZ=x=>120+Math.sin(x*.012)*45,riverLevel=x=>.50-x*.009,streamX=z=>118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8;
// Mixed dry/wet and sloping actual-production predicate inputs, deliberately
// including private-random root and puddle acceptance on both river banks.
const ground=(x,z)=>riverLevel(x)-.85+Math.min(1,Math.abs(z-riverZ(x))/7)**2*1.45+Math.sin(x*.03)*.09+Math.sin(z*.017)*.08;
export function runWater(source,{seed=928471,bindings={},heightAt=ground}={}){
 const oldRandom=Math.random,oldDocument=globalThis.document,oldWindow=globalThis.window;let state=seed>>>0,calls=0;
 const random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 Math.random=random;globalThis.document={createElement:name=>{if(name!=='canvas')throw Error('Unexpected DOM allocation: '+name);return canvas();}};globalThis.window={_weather:{mode:'clear'}};
 try{
  const scene=new T.Scene(),colliders=[{x:86,z:riverZ(86)+9,r:1.2}],mapMarkers=[],miniMarkers=[],groundSurfaces=[],events=[],materialCache=new Map();
  const smat=c=>{if(!materialCache.has(c))materialCache.set(c,new T.MeshStandardMaterial({color:c}));return materialCache.get(c);};
  const box=(w,h,d,c,x,y,z,parent)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),smat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const tube=(r1,r2,len,c,x,y,z,parent)=>{const m=new T.Mesh(new T.CylinderGeometry(r1,r2,len,12),smat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const materials=Object.fromEntries(['aged','oak','iron','steel','cloth','leather'].map(name=>[name,new T.MeshStandardMaterial({name})]));
  const world={groundH:heightAt,terrainH:heightAt,riverZ,riverLevel,streamX,box,tube,colliders,mapMarkers,miniMarkers,groundSurfaces,mats:{plankBrownMat:materials.aged}};
  world.sceneryArt=createSceneryArt({THREE:T,materials,groundH:heightAt,groundSurfaces});world.geology=createGeology({THREE:T,groundH:heightAt,loadTextures:false});world.waterfallArt=createWaterfallArt({THREE:T});world.addFT=x=>events.push(['FT',x]);world.addRegion=x=>events.push(['region',x]);
  const G={THREE:T,scene,world,on:(id,fn)=>events.push(['event',id]),floraPkg:{bank:{}}};
  const sourceNoImports=source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
  const install=new Function(...Object.keys(bindings),sourceNoImports+'\nreturn install;')(...Object.values(bindings));install(G);scene.updateMatrixWorld(true);
  const installCalls=calls,future=Array.from({length:24},random),objects=[];
  scene.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry,materials=Array.isArray(o.material)?o.material:[o.material];objects.push({name:o.name,parent:o.parent?.name,uuid:o.uuid,matrix:o.matrixWorld.toArray(),visible:o.visible,count:o.isInstancedMesh?o.count:null,capacity:o.instanceMatrix?.count||null,instance:bytes(o.instanceMatrix?.array),color:bytes(o.instanceColor?.array),geometry:Object.fromEntries([...Object.entries(geometry.attributes).map(([name,a])=>[name,{itemSize:a.itemSize,count:a.count,bytes:a.array.byteLength,hash:bytes(a.array)}]),['index',geometry.index?{count:geometry.index.count,bytes:geometry.index.array.byteLength,hash:bytes(geometry.index.array)}:null]]),materials:materials.map(m=>({uuid:m.uuid,type:m.type,name:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest,vertexColors:m.vertexColors,map:m.map?.uuid||null})),cast:o.castShadow,receive:o.receiveShadow});});
  // The original package tick must not create geometry, resources or UUIDs.
  const tickBefore=calls;for(let i=0;i<300;i++)G.waterPkg.tick(1/60,i/60);const tickCalls=calls-tickBefore;
  return{scene,G,world,installCalls,future,tickCalls,objects,summary:{counts:G.waterPkg.counts,ford:G.waterPkg.ford,weir:G.waterPkg.weir,falls:G.waterPkg.falls,lake:G.waterPkg.lake,spring:G.waterPkg.spring,skipped:G.waterPkg.skipped,clearedCover:G.waterPkg.clearedCover,puddles:G.waterPkg.puddles,jetty:G.waterPkg.jetty?.position.toArray(),colliders,mapMarkers,miniMarkers,events},sourceHash:sha(source)};
 }finally{Math.random=oldRandom;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
}
