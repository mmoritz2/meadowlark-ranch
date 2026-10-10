import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createOuterLandscape,foothillHeight,outerDistance} from '../assets/outer-landscape.js';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import {regionWeightsAt} from '../assets/regional-landscape.mjs';

function snapshotGeometry(geometry){
 const snapshot={attributes:{},index:null};
 for(const [name,a] of Object.entries(geometry.attributes))snapshot.attributes[name]={itemSize:a.itemSize,normalized:a.normalized,count:a.count,array:a.array.slice()};
 if(geometry.index){const a=geometry.index;snapshot.index={itemSize:a.itemSize,normalized:a.normalized,count:a.count,array:a.array.slice()};}
 return snapshot;
}
function assertGeometrySnapshot(geometry,snapshot){
 assert.deepEqual(Object.keys(geometry.attributes).sort(),Object.keys(snapshot.attributes).sort());
 for(const [name,before] of Object.entries(snapshot.attributes)){
  const now=geometry.attributes[name];
  assert.equal(now.itemSize,before.itemSize,name);assert.equal(now.normalized,before.normalized,name);assert.equal(now.count,before.count,name);
  assert.deepEqual(now.array,before.array,`${name} array changed`);
 }
 assert.equal(Boolean(geometry.index),Boolean(snapshot.index));
 if(snapshot.index){assert.equal(geometry.index.itemSize,snapshot.index.itemSize);assert.equal(geometry.index.normalized,snapshot.index.normalized);assert.equal(geometry.index.count,snapshot.index.count);assert.deepEqual(geometry.index.array,snapshot.index.array,'index array changed');}
}
function geometryDigest(geometry,names,count){
 const digest=createHash('sha256');
 for(const name of names){const a=geometry.attributes[name],array=a.array;digest.update(new Uint8Array(array.buffer,array.byteOffset,count*a.itemSize*array.BYTES_PER_ELEMENT));}
 return digest.digest('hex');
}
// This lookup is indexed from the source mesh itself, independently of the
// outer landscape's ring order and grid-to-source-index calculation.
function sourceBoundaryByPosition(geometry){
 const position=geometry.attributes.position,boundary=new Map();
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=position.getZ(i);
  if(Math.max(Math.abs(x),Math.abs(z))===500)boundary.set(`${x}:${z}`,i);
 }
 return boundary;
}
function seededAmbientRandom(seed,build){
 const previous=Math.random;let state=seed>>>0;
 Math.random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 try{return build();}finally{Math.random=previous;}
}
// Independent XZ barycentric interpolation over the emitted triangles. Bins
// make checking every root inexpensive without sampling only a few trees.
function triangleSampler(geometry,cellSize=32){
 const position=geometry.attributes.position,index=geometry.index,triangles=[],bins=new Map();
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],vertices=ids.map(id=>({x:position.getX(id),y:position.getY(id),z:position.getZ(id)}));
  const id=triangles.length;triangles.push(vertices);
  const minX=Math.floor(Math.min(...vertices.map(v=>v.x))/cellSize),maxX=Math.floor(Math.max(...vertices.map(v=>v.x))/cellSize);
  const minZ=Math.floor(Math.min(...vertices.map(v=>v.z))/cellSize),maxZ=Math.floor(Math.max(...vertices.map(v=>v.z))/cellSize);
  for(let bx=minX;bx<=maxX;bx++)for(let bz=minZ;bz<=maxZ;bz++){
   const key=`${bx}:${bz}`;let bin=bins.get(key);if(!bin){bin=[];bins.set(key,bin);}bin.push(id);
  }
 }
 return(x,z)=>{
  const heights=[];
  for(const id of bins.get(`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`)||[]){
   const [a,b,c]=triangles[id],denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
   const wa=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/denominator;
   const wb=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/denominator,wc=1-wa-wb;
   if(wa>=-1e-9&&wb>=-1e-9&&wc>=-1e-9)heights.push(wa*a.y+wb*b.y+wc*c.y);
  }
  return heights;
 };
}

const scene=new T.Scene(),geometry=new T.PlaneGeometry(1000,1000,512,512),heightAt=(x,z)=>.002*x-.004*z+Math.sin(z*.012)*.3;
geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position,colors=[];
for(let i=0;i<p.count;i++){p.setY(i,heightAt(p.getX(i),p.getZ(i)));colors.push(.91+p.getX(i)*.00001,.96,.89);}
geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
const ground=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true}));ground.material.defaultAttributeValues={chalkRelief:[0]};
const sourceSnapshot=snapshotGeometry(geometry),sourceBoundary=sourceBoundaryByPosition(geometry);
const art=createOuterLandscape({THREE:T,scene,heightAt,groundMesh:ground});art.mesh.updateMatrixWorld(true);

test('every source geometry array is preserved and the Float32 seam matches its independently indexed edge exactly',()=>{
 assert.equal(ground.geometry,geometry);assertGeometrySnapshot(geometry,sourceSnapshot);
 const outer=art.mesh.geometry,pos=outer.attributes.position,seamPositions=new Set();
 assert.equal(sourceBoundary.size,2048);assert.equal(art.edgeCount,2049);
 for(let i=0;i<art.edgeCount;i++){
  const key=`${pos.getX(i)}:${pos.getZ(i)}`,sourceId=sourceBoundary.get(key);assert.notEqual(sourceId,undefined,`seam vertex ${i} is absent from source edge`);seamPositions.add(key);
  for(const name of ['position','color','normal']){
   const actual=outer.attributes[name].array,expected=sourceSnapshot.attributes[name].array;
   assert(actual instanceof Float32Array);
   for(let component=0;component<3;component++)assert.equal(actual[i*3+component],expected[sourceId*3+component],`${name} seam vertex ${i}, component ${component}`);
  }
 }
 assert.equal(seamPositions.size,sourceBoundary.size);
 for(const name of ['position','color','normal'])assert.deepEqual(outer.attributes[name].array.slice(0,3),outer.attributes[name].array.slice((art.edgeCount-1)*3,art.edgeCount*3));
 for(let i=0;i<pos.count;i++)assert(Math.max(Math.abs(pos.getX(i)),Math.abs(pos.getZ(i)))>=500);
 assert.equal(art.mesh.matrixAutoUpdate,false);assert.equal(art.mesh.castShadow,false);
});

test('the first three bands retain their legacy heights and colors exactly',()=>{
 // Baseline fixture bands at distances 0, 4, and 12m contain 5,123 vertices.
 // Their snapshot deliberately excludes normals outside the shared edge,
 // because normals there can respond to relief in a neighboring outer band.
 assert.equal(geometryDigest(art.mesh.geometry,['position','color'],5123),'2e18be9b5e301c164148dd208ee74684fccfc46abfabbcfa994eb13570b18cc5');
});

test('the exact annulus budget covers the whole area without gaps or inverted triangles',()=>{
 const g=art.mesh.geometry,p=g.attributes.position,idx=g.index;let area=0;
 assert.equal(p.count,21538);assert.equal(idx.count/3,40448);assert.equal(art.stats.vertices,21538);assert.equal(art.stats.triangles,40448);assert.equal(art.edgeCount,2049);assert.equal(art.stats.draws,1);
 for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),cross=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert(cross>0);area+=cross*.5;}
 assert(Math.abs(area-4*(1700**2-500**2))<.1);
 for(let a=.037;a<Math.PI*2;a+=.29)for(const d of[2,9,35,95,180,390,740,1150]){
  const radius=(500+d)/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),x=Math.cos(a)*radius,z=Math.sin(a)*radius;
  assert.equal(new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0)).intersectObject(art.mesh).length,1);
 }
 for(const [name,a] of Object.entries(g.attributes))for(const value of a.array)assert(Number.isFinite(value),`${name} has a nonfinite value`);
});

test('outer heights stay finite and within the authored relief envelope',()=>{
 const position=art.mesh.geometry.attributes.position;
 for(let i=0;i<position.count;i++){const y=position.getY(i);assert(Number.isFinite(y));assert(y>=-30&&y<=80,`outer vertex ${i} height ${y} is outside [-30, 80]`);}
});

test('geometry and woodland output are deterministic with different ambient random streams',()=>{
 const build=()=>createOuterLandscape({THREE:T,scene:new T.Scene(),heightAt,groundMesh:ground});
 const a=seededAmbientRandom(0x12345678,build),b=seededAmbientRandom(0x9abcdef0,build);
 assertGeometrySnapshot(a.mesh.geometry,snapshotGeometry(art.mesh.geometry));assertGeometrySnapshot(b.mesh.geometry,snapshotGeometry(a.mesh.geometry));
 assert.deepEqual(a.woodlandSites,art.woodlandSites);assert.deepEqual(b.woodlandSites,a.woodlandSites);assert.deepEqual(a.stats,b.stats);
 assertGeometrySnapshot(geometry,sourceSnapshot);
});

test('every woodland root matches an actual mesh triangle and remains outside riding space',()=>{
 assert(art.woodlandSites.length>250&&art.woodlandSites.length<4500);
 const sample=triangleSampler(art.mesh.geometry);
 for(let i=0;i<art.woodlandSites.length;i++){
  const root=art.woodlandSites[i];for(const name of ['x','y','z','height','yaw'])assert(Number.isFinite(root[name]),`root ${i} ${name} is nonfinite`);
  const heights=sample(root.x,root.z);assert(heights.length>0,`root ${i} has no triangle beneath it`);
  assert(heights.every(y=>Math.abs(root.y-y)<1e-6),`root ${i} does not touch the actual triangle surface`);
  assert(Math.max(Math.abs(root.x),Math.abs(root.z))>540);
 }
 assertGeometrySnapshot(geometry,sourceSnapshot);
});


// Sample the actual geometry in authored compass cores, independently of the
// regional helper. Distinct silhouette and palette should be visible on the
// emitted surface, not only in profile configuration values.
function directionAt(x,z){
 const a=Math.atan2(z,x);
 return a> -2.3&&a< -.9?'north':a>2.65&&a<2.95?'dry':a>1.5&&a<1.65?'pastoral':a>2.1&&a<2.25?'valley':null;
}
function directionalSurface(){
 const geometry=art.mesh.geometry,position=geometry.attributes.position,color=geometry.attributes.color,index=geometry.index;
 const groups=Object.fromEntries(['north','dry','pastoral','valley'].map(k=>[k,{vertices:0,height:0,minHeight:Infinity,maxHeight:-Infinity,r:0,g:0,b:0,trees:0,area:0}]));
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=position.getZ(i),d=outerDistance(x,z),k=directionAt(x,z);if(!k||d<145||d>410)continue;
  const group=groups[k];group.vertices++;group.height+=position.getY(i);group.minHeight=Math.min(group.minHeight,position.getY(i));group.maxHeight=Math.max(group.maxHeight,position.getY(i));group.r+=color.getX(i);group.g+=color.getY(i);group.b+=color.getZ(i);
 }
 for(const root of art.woodlandSites){const k=directionAt(root.x,root.z);if(k)groups[k].trees++;}
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((n,j)=>n+position.getX(j),0)/3,z=ids.reduce((n,j)=>n+position.getZ(j),0)/3,d=outerDistance(x,z),k=directionAt(x,z);if(!k||d<58||d>400)continue;
  const [a,b,c]=ids;groups[k].area+=Math.abs((position.getX(b)-position.getX(a))*(position.getZ(c)-position.getZ(a))-(position.getZ(b)-position.getZ(a))*(position.getX(c)-position.getX(a)))*.5;
 }
 for(const group of Object.values(groups)){assert(group.vertices>25&&group.area>25000);for(const key of ['height','r','g','b'])group[key]/=group.vertices;group.density=group.trees/group.area;}
 return groups;
}

test('authored outer directions create lower pastoral hills, a visible open saddle, and warm/cool material contrast',()=>{
 const {north,dry,pastoral,valley}=directionalSurface();
 assert(north.maxHeight>dry.maxHeight*1.1,'Northern divides retain height above the dry shoulders');
 assert(north.maxHeight-north.minHeight>30,'Northern divides must retain distinct low drainage corridors');
 assert(dry.height>pastoral.height*1.3,'Pastoral hills must stay below the western relief');
 assert(valley.height<pastoral.height*.6,'The southwest saddle must open the skyline');
 assert(dry.r-dry.b>.25,'Dry shoulders need a warm mineral tint');
 assert(north.b>north.g,'The north should carry a cool pale tint');
 assert(pastoral.g-pastoral.b>.07,'Pastoral hills retain muted green turf');
 for(let z=-500;z<=500;z+=125)for(let x=-500;x<=500;x+=125)assert.equal(foothillHeight(x,z,heightAt),heightAt(x,z),'Regional relief must never alter an in-basin height');
});

// Authored groves can put a glade in any one narrow compass slice. Measure
// woodland over the entire outer planting annulus using climate area weights:
// actual emitted tree counts / actual projected mesh area, not density settings.
function regionalWoodlandDensity(){
 const keys=['north','dry','pastoral','valley'];
 const groups=Object.fromEntries(keys.map(key=>[key,{trees:0,area:0}]));
 for(const root of art.woodlandSites){
  const weights=regionWeightsAt(root.x,root.z);
  for(const key of keys)groups[key].trees+=weights[key];
 }
 const geometry=art.mesh.geometry,position=geometry.attributes.position,index=geometry.index;
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  const x=ids.reduce((sum,id)=>sum+position.getX(id),0)/3,z=ids.reduce((sum,id)=>sum+position.getZ(id),0)/3;
  const distance=outerDistance(x,z);if(distance<58||distance>400)continue;
  const [a,b,c]=ids;
  const area=Math.abs((position.getX(b)-position.getX(a))*(position.getZ(c)-position.getZ(a))-(position.getZ(b)-position.getZ(a))*(position.getX(c)-position.getX(a)))*.5;
  const weights=regionWeightsAt(x,z);
  for(const key of keys)groups[key].area+=area*weights[key];
 }
 for(const group of Object.values(groups)){assert(group.area>25000);group.density=group.trees/group.area;}
 return groups;
}

test('directional woodland leaves dry shoulders and valley gaps open without adding new tree resources',()=>{
 const groups=regionalWoodlandDensity();
 assert(groups.pastoral.density>groups.dry.density*2,'Dry shoulders need substantially fewer trees per surface area');
 assert(groups.valley.density<groups.pastoral.density*.65,'Valley gaps need less canopy than pastoral hills');
 const allowed=new Set(['mature-pine','canopy-broadleaf','woodland-broadleaf']);let northern=0,dry=0;const northernSources=new Map();
 for(const root of art.woodlandSites){
  assert(allowed.has(root.source));
  const direction=directionAt(root.x,root.z);
  if(direction==='north'){northern++;northernSources.set(root.source,(northernSources.get(root.source)||0)+1);}
  if(direction==='dry'){dry++;assert(root.height<=9.8+1e-9,'Sparse dry trees must have a lower stature');}
 }
 assert(northern>100&&dry>0);assert.equal(northernSources.size,3,'Northern groves mix existing conifer and broadleaf atlases');assert(northernSources.get('mature-pine')>northern*.5,'Conifers still lead the northern stands');
});

test('outer shader composes with the real terrain material while preserving its riding shader and texture resources',()=>{
 const originalDocument=globalThis.document;
 let maskPixels;const context={createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:p=>{maskPixels=p;},getImageData:()=>maskPixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
 const canvas={getContext:()=>context};
 globalThis.document={createElement:()=>canvas};
 try{
  const cpuThree={...T,TextureLoader:class{load(){return new T.Texture();}}};
  const {material}=createTerrainSurface({THREE:cpuThree,renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()});
  const shader=()=>({vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>\n#include <fog_fragment>',uniforms:{}});
  const before=shader();material.onBeforeCompile(before);
  const oldDefines={...material.defines},oldAttributes={...material.defaultAttributeValues},oldKey=material.customProgramCacheKey();
  const outer=createOuterLandscape({THREE:T,scene:new T.Scene(),heightAt,groundMesh:new T.Mesh(geometry,material)}),compiled=shader();
  outer.mesh.material.onBeforeCompile(compiled,{});
  assert(compiled.fragmentShader.includes('vec4 outerRegion=regionalWeights(atan(p.y,p.x));'),'The outer extension must consume shared directional weights');
  assert(!compiled.fragmentShader.includes('vec2 compass=normalize(p);'),'The old generic compass extension must be replaced');
  assert.equal((compiled.fragmentShader.match(/vec4 regionalWeights\(float angle\)/g)||[]).length,1,'Shared climate functions must be declared only once');
  assert(!compiled.fragmentShader.includes('outerDrift'),'Low northern foothills do not promote snow');
  assert(compiled.fragmentShader.includes('snow*=1.0-outerNorth;'));
  assert.equal((compiled.fragmentShader.match(/float outerGroveWeight\(vec2 p\)/g)||[]).length,1,'Ground and trees share one grove field');
  assert(compiled.fragmentShader.includes('float outerFogBlend='),'The original continuous seam fog still composes');
  assert.equal((compiled.fragmentShader.match(/bank\*=1\.0-extend;/g)||[]).length,1,'Outer bank attenuation must be applied once');
  assert.equal((compiled.fragmentShader.match(/wet\*=1\.0-extend;/g)||[]).length,1,'Outer wet attenuation must be applied once');
  assert.deepEqual(Object.keys(compiled.uniforms).sort(),Object.keys(before.uniforms).sort(),'No additional texture or uniform resources');
  for(const key of Object.keys(before.uniforms))assert.equal(compiled.uniforms[key],before.uniforms[key],`Uniform ${key} must remain shared with terrain`);
  assert.deepEqual({...material.defines},oldDefines);assert.deepEqual(material.defaultAttributeValues,oldAttributes);assert.equal(material.customProgramCacheKey(),oldKey);
  assert.equal(outer.mesh.material.defines.OUTER_LANDSCAPE,1);assert.equal(outer.mesh.material.defines.CHEAP_GROUND,1);
  assert.notEqual(outer.mesh.material.customProgramCacheKey(),oldKey);
  const after=shader();material.onBeforeCompile(after);assert.equal(after.vertexShader,before.vertexShader);assert.equal(after.fragmentShader,before.fragmentShader,'The riding shader must remain unchanged');
  assertGeometrySnapshot(geometry,sourceSnapshot);
 }finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
});
