// ribbon-falls-2: historical Water installer reconstruction only; actual new Ribbon tests import raw current product.
import{normalizeRibbonFallsSource as ribbonParent}from'./ribbon-falls-source-guard.cjs';
import {normalizePastoralSource} from './pastoral-source-guard.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {T,repo,baseline,oldWater,runWater,sha} from './river-preservation-fixture.mjs';
const pkg=process.env.RIVER_BANK_PACKAGE||repo,load=p=>import(pathToFileURL(path.join(pkg,p)));
const {conformRiverBankGeometry,dressRiverBankMaterial}=await load('assets/riverbank-surface.mjs');
const newWater=ribbonParent(fs.readFileSync(path.join(pkg,'assets/features/world-water.js'),'utf8'),'assets/features/world-water.js'),approved=JSON.parse(fs.readFileSync(new URL('./fixtures/river-7908e80/approved-river-source-changes.json',import.meta.url)));
const reedChanges=JSON.parse(fs.readFileSync(new URL('./fixtures/river-7908e80/bank-rush-source-changes.json',import.meta.url))),hasRushes=newWater.includes(reedChanges.import);
const createBankRushGeometry=hasRushes?(await load('assets/bank-rushes.mjs')).createBankRushGeometry:null;
const cacheFile=new URL('./fixtures/river-7908e80/combined-cache-edges.json',import.meta.url),cacheEdges=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile)):[];
const proof={waterSHA:sha(newWater),surfaceSHA:sha(fs.readFileSync(path.join(pkg,'assets/riverbank-surface.mjs'))),scope:'Frozen Water bank/bed production source and constructor/layout comparison, plus actual riparian install. No browser/GPU/art claim.'};
const {exactSweptClearance}=await import(pathToFileURL(path.join(repo,'tools/terrain-water-contact.mjs')));
function restored(source,edits){for(const p of edits){assert.equal(source.split(p.after).length,2,'Exactly one approved source addition at '+p.newLine);source=source.replace(p.after,p.before);}return source;}
test('whole old source bodies survive only individually reviewed River owner and planning additions',()=>{
 for(const [file,edits]of Object.entries(approved)){let next=normalizePastoralSource(fs.readFileSync(path.join(pkg,file),'utf8'),file);const old=fs.readFileSync(new URL(file,baseline),'utf8');for(const [name,before,after]of cacheEdges)if(name===file&&next.includes(after))next=restored(next,[{before,after}]);if(file==='assets/features/world-water.js'&&hasRushes){next=restored(next,[{after:reedChanges.import,before:''}]);for(const name of ['geometry','comment','material'])next=restored(next,[reedChanges[name]]);}assert.equal(restored(next,edits),old,file);}
 if(cacheEdges.length){let index=normalizePastoralSource(fs.readFileSync(path.join(pkg,'assets/features/index.js'),'utf8'),'assets/features/index.js');for(const [name,before,after]of cacheEdges)if(name==='assets/features/index.js')index=restored(index,[{before,after}]);assert.equal(index,fs.readFileSync(new URL('assets/features/index.js',baseline),'utf8'));}
});
test('complete Water bank and grounded-bed installation preserves all original RNG, layouts, materials and unrelated owners',()=>{
 proof.installers=[];for(const seed of [928471,91,0x9e3779b9]){
  // Isolate the original synchronous layout here; the real deferred ramp
  // installer and actual dock/camera/triangle APIs run in the separate fixture.
  const a=runWater(oldWater,{seed}),b=runWater(newWater,{seed,bindings:{conformRiverBankGeometry,dressRiverBankMaterial,installFerryBankApproach(){},...(hasRushes?{createBankRushGeometry}:{})}});assert.equal(b.installCalls,a.installCalls);assert.deepEqual(b.future,a.future);assert.deepEqual(b.summary,a.summary);assert.equal(b.tickCalls,0);assert.equal(b.objects.length,a.objects.length);
  for(let i=0;i<a.objects.length;i++){const old=a.objects[i],next=b.objects[i];if(['Water | river bed','Water | riverbank north','Water | riverbank south'].includes(old.name)){const clean=o=>{o=structuredClone(o);delete o.geometry;return o;};assert.deepEqual(clean(next),clean(old),old.name);}else if(hasRushes&&old.name==='Water | bank reeds'){const clean=o=>{o=structuredClone(o);delete o.geometry;for(const m of o.materials){delete m.map;delete m.vertexColors;}return o;};assert.deepEqual(clean(next),clean(old));assert.equal(next.geometry.index.count/3,72);assert(next.materials[0].vertexColors&&next.materials[0].map===null);}else assert.deepEqual(next,old,old.name);}
  const surfaces=[b.G.waterPkg.riverBedSurface,...b.G.waterPkg.riverBankSurfaces];assert.equal(surfaces.length,3);assert(surfaces.every(s=>s.newGeometryObjects===0&&s.newDrawOwners===0&&s.triangles<=64000&&s.bytes<=6500000));assert.equal(surfaces[0].offsetM,.008);assert(surfaces[0].worldUV);proof.installers.push({seed,calls:b.installCalls,futureDraws:b.future.length,objects:b.objects.length,surfaces});
 }
});
test('borrowing the actual resident soil preserves original canvas alpha, texture/material identity and ready/error fallback without resources',()=>{
 const material=new T.MeshStandardMaterial({map:new T.Texture(),transparent:true,opacity:.74,vertexColors:true}),map=material.map,uuid=material.uuid,soil={color:{value:new T.Texture()},properties:{value:new T.Texture()},ready:{value:0}};
 const oldRandom=Math.random;Math.random=()=>assert.fail('Shared soil hook consumed resource/gameplay RNG');try{
  assert(dressRiverBankMaterial(material,soil));assert.equal(material.uuid,uuid);assert.equal(material.map,map);assert(material.transparent&&!material.alphaTest);assert.equal(material.opacity,.74);
  const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(sh);assert.equal(sh.uniforms.riverSoilColor,soil.color);assert.equal(sh.uniforms.riverSoilProperties,soil.properties);material.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,0);soil.color.value.image={width:1024,height:1024};soil.properties.value.image={width:1024,height:1024};material.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,1);soil.properties.value.image=null;material.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,0);
  assert(sh.fragmentShader.includes('diffuseColor.a*=bankCanvas.a'));assert(sh.fragmentShader.includes('mix(bankCanvas.rgb,bankMineral,riverSoilReady)'));assert(!/discard|gl_FragDepth/.test(sh.fragmentShader.replace(T.ShaderLib.standard.fragmentShader,'')));assert.equal((sh.fragmentShader.match(/texture2D\(riverSoilColor/g)||[]).length,3);assert.equal((sh.fragmentShader.match(/texture2D\(riverSoilProperties/g)||[]).length,3);proof.material={textureAllocations:0,sharedTextures:true,canvasAlpha:true,samples:6,readyFallback:true};
 }finally{Math.random=oldRandom;}
});
test('the actual original native river bed follows every terrain triangle interior at8mm without adding owners or consuming RNG',()=>{
 const native=JSON.parse(fs.readFileSync(new URL('./fixtures/river-7908e80/native-river-bed.json',import.meta.url))).owner,source=native.geometry,g=new T.BufferGeometry();for(const [name,a]of Object.entries(source.attributes))g.setAttribute(name,new T.Float32BufferAttribute(a.array,a.itemSize));g.setIndex(source.index);
 const mesh=new T.Mesh(g,new T.MeshStandardMaterial()),geometry=g,uuid=g.uuid,meshUUID=mesh.uuid,buffer=fs.readFileSync(new URL('./fixtures/river-7908e80/terrain-grid.f32',import.meta.url)),grid=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4),step=1000/512,n=513;
 const height=(x,z)=>{const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*n+ix,a=grid[i],b=grid[i+n],c=grid[i+n+1],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);};
 const previous=Math.random;Math.random=()=>assert.fail('Conforming shared river bed created a UUID or game random draw');let stats;try{stats=conformRiverBankGeometry({THREE:T,mesh,groundHeight:height,full:true,offsetM:.008,worldUV:true});}finally{Math.random=previous;}
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.geometry.uuid,uuid);assert.equal(mesh.uuid,meshUUID);assert.equal(stats.newDrawOwners,0);assert.equal(stats.newGeometryObjects,0);assert.equal(stats.oldTriangles,2128);assert(stats.triangles<64000&&stats.bytes<6500000);
 const p=g.attributes.position,uv=g.attributes.uv,index=g.index;let low=Infinity,high=-Infinity,maxUVError=0,samples=0;const observe=(x,y,z)=>{const d=y-height(x,z);low=Math.min(low,d);high=Math.max(high,d);samples++;};
 for(let i=0;i<p.count;i++){observe(p.getX(i),p.getY(i),p.getZ(i));maxUVError=Math.max(maxUVError,Math.abs(uv.getX(i)-p.getX(i)/2.53),Math.abs(uv.getY(i)-p.getZ(i)/2.53));}
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(const w of [[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]])observe(...[0,1,2].map(k=>ids.reduce((sum,id,j)=>sum+p.array[id*3+k]*w[j],0)));}
 const continuous=exactSweptClearance({position:p.array,index:index.array,step,height});assert(continuous.min>.0078);assert(low>.0078&&high<.0082);assert(maxUVError<.00002);proof.actualBed={...stats,samples,minM:low,maxM:high,maxUVError,continuous,source:'7908e80 actual native bed and full physical terrain grid; main bridge deck is intentionally not part of the underwater height sampler.'};
});
function riparian(source,changed){
 const priorRandom=Math.random,priorDocument=globalThis.document;let state=928471,calls=0;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};globalThis.document={};
 try{
  const oldH=(x,z)=>.5-x*.009-.85+Math.min(1,Math.abs(z-(120+Math.sin(x*.012)*45))/7)**2*1.45+Math.sin(x*.03)*.09;
  const liveH=changed?(x,z)=>oldH(x,z)+.75*Math.exp(-(((x-83)/38)**2))*Math.exp(-(((z-(120+Math.sin(x*.012)*45)-6.8)/1.8)**2)):oldH;
  const textureT={...T,TextureLoader:class{load(){return new T.Texture();}}},scene=new T.Scene(),install=new Function(source.replace(/\bexport /g,'')+'\nreturn installRiparian;')();
  const result=install({THREE:textureT,scene,terrainH:liveH,planningHeightAt:oldH,riverZ:x=>120+Math.sin(x*.012)*45,riverLevel:x=>.5-x*.009,pathDist:()=>100});const rows=[];scene.getObjectByName('Riverbank habitat').traverse(o=>{if(!o.isInstancedMesh)return;rows.push({name:o.name,uuid:o.uuid,count:o.count,matrix:o.instanceMatrix.array.slice(),color:o.instanceColor.array.slice(),geometry:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,sha(Buffer.from(a.array.buffer))]))});});return{calls,future:Array.from({length:24},Math.random),result,rows,oldH,liveH};
 }finally{Math.random=priorRandom;if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;}
}
test('actual riparian installer retains historical survivors/colour/constructor stream while accepted roots and rock orientation follow live soil',()=>{
 const a=riparian(fs.readFileSync(new URL('assets/riparian.js',baseline),'utf8'),false),b=riparian(fs.readFileSync(path.join(pkg,'assets/riparian.js'),'utf8'),true);assert.equal(a.calls,b.calls);assert.deepEqual(a.future,b.future);assert.equal(a.rows.length,b.rows.length);let moved=0,tilted=0;
 for(let i=0;i<a.rows.length;i++){const x=a.rows[i],y=b.rows[i];assert.equal(x.name,y.name);assert.equal(x.uuid,y.uuid);assert.equal(x.count,y.count);assert.deepEqual(x.color,y.color);assert.deepEqual(x.geometry,y.geometry);for(let k=0;k<x.count;k++){const o=k*16;assert.equal(x.matrix[o+12],y.matrix[o+12]);assert.equal(x.matrix[o+14],y.matrix[o+14]);if(x.matrix[o+13]!==y.matrix[o+13])moved++;for(const col of [0,4,8])assert(Math.abs(Math.hypot(...x.matrix.slice(o+col,o+col+3))-Math.hypot(...y.matrix.slice(o+col,o+col+3)))<1e-7);if(x.matrix[o+1]!==y.matrix[o+1])tilted++;}}
 assert(moved>0&&tilted>0);proof.riparian={owners:a.rows.length,calls:a.calls,futureSame:true,rootsMoved:moved,stoneTimberTilts:tilted};
});
test('audit is serializable and does not write output by default',()=>{if(process.env.RIVER_INSTALL_AUDIT_OUTPUT)fs.writeFileSync(process.env.RIVER_INSTALL_AUDIT_OUTPUT,JSON.stringify(proof,null,2)+'\n');});
