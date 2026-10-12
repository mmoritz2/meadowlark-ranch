import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createChalkDown} from '../assets/chalk-down.js';
import {createGrassTuftGeometry,createMeadowDistance} from '../assets/meadow-cover.js';
import {installMixedSward,MIXED_SWARD} from '../assets/mixed-sward.mjs';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import * as C from '../assets/chalk-grazing.mjs?v=chalk-grazing-1';
import {refreshChalkCover,installChalkCoverRefresh} from '../assets/chalk-cover-refresh.mjs';
const fixture=new URL('./fixtures/chalk-cover-519f/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,fixture));
const receipt=JSON.parse(read('receipt.json')),native=JSON.parse(read('chalk-surface-source.json'));
const currentFixture=new URL('./fixtures/chalk-cover-final-native/',import.meta.url),readCurrent=name=>fs.readFileSync(new URL(name,currentFixture)),currentNative=JSON.parse(readCurrent('chalk-surface-source.json'));
// Establish the untouched original texture/factory/9500-row construction body
// before using geometry first captured in the current combined native run.
const initialSeedBody=s=>{const start=s.indexOf('function meadowBladeTexture('),end=s.indexOf(' /* ===== near grass:',start);assert(start>=0&&end>start);return s.slice(start,end);};
assert.equal(initialSeedBody(fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8')),initialSeedBody(read('ranch3d.html').toString()));
const gridBytes=read('terrain-grid.f32'),grid=new Float32Array(gridBytes.buffer,gridBytes.byteOffset,gridBytes.byteLength/4);
const packedBytes=read('chalk-front-high-grass-seed.f32'),packed=new Float32Array(packedBytes.buffer,packedBytes.byteOffset,packedBytes.byteLength/4);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hash=array=>{let n=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))n=Math.imul(n^b,16777619);return(n>>>0).toString(16);};
function terrain(x,z){const gx=(x+500)*512/1000,gz=(z+500)*512/1000,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*513+ix,a=grid[i],b=grid[i+513],c=grid[i+514],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const down=createChalkDown({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},site:native.site,baseHeight:terrain,groundMaterial:new T.MeshStandardMaterial()});
const field=C.createChalkGrazingField(native.site),ground=(x,z)=>Math.max(terrain(x,z),down.heightAt(x,z));
const proof={base:receipt.base,scope:'Independent actual original geometry/native rows plus production field behavior; no GPU/art claim.',sourceHashes:receipt.files,checks:{}};
function withoutRandom(make){const prior=Math.random;let calls=0;Math.random=()=>{calls++;throw Error('Unexpected gameplay RNG');};try{return make();}finally{Math.random=prior;assert.equal(calls,0);}}

test('frozen fixtures bind actual published site and original full seed rows',()=>{
 for(const [file,expected] of Object.entries(receipt.files))assert.equal(sha(read(file)),expected);
 assert.deepEqual([native.site.x,native.site.z,native.site.len,native.site.depth,native.site.h],[-68.98,213.41,112,76,14]);
 assert.equal(grid.length,513**2);assert.equal(packed.length,9500*19);
 for(const row of native.seed.rows){const original=packed.subarray(row.index*19,row.index*19+19);assert.deepEqual(Array.from(original.subarray(0,16)),row.matrix);assert.deepEqual(Array.from(original.subarray(16,19)),row.color);}
 assert.equal(native.seed.rows.length,426);proof.checks.nativeFixtureRows=426;
});

test('the exact actual native Chalk physical surface reconstructs from its pinned base grid',()=>{
 const geometry=down.root.getObjectByName('vista:chalkscarp').geometry,expected=native.meshes.find(m=>m.name==='vista:chalkscarp');
 for(const name of ['position','normal','uv','chalkRelief'])assert.equal(hash(geometry.attributes[name].array),expected.attributes[name]);assert.equal(hash(geometry.index.array),expected.index);
 let error=0;for(const row of native.seed.rows)error=Math.max(error,Math.abs(ground(row.matrix[12],row.matrix[14])-row.ground));
 assert(error<1e-11);proof.checks.rebuiltNativeGroundMaximumError=error;
});

test('actual surveyed field is finite, compact, unequal and smooth without consuming world RNG',()=>withoutRandom(()=>{
 let short=0,left=0,right=0,damp=0,maxDifference=0;
 for(let u=-56;u<=56;u+=.7)for(let t=0;t<=1;t+=.013){const [x,z]=field.frame(u,t),a=field.at(x,z);assert(a.cut>=-1e-12&&a.cut<=1+1e-12&&a.uncut>=-1e-12&&a.uncut<=1+1e-12&&a.damp>=-1e-12&&a.damp<=1+1e-12);if(a.cut>.95)short++;if(a.uncut>.45)(u<0?left++:right++);if(a.damp>.2)damp++;
  for(const [dx,dz] of [[.001,0],[0,.001]]){const b=field.at(x+dx,z+dz);maxDifference=Math.max(maxDifference,Math.abs(b.cut-a.cut),Math.abs(b.uncut-a.uncut),Math.abs(b.damp-a.damp));}
 }
 assert(short>2500&&left>200&&right>40&&left>right*1.3&&damp>80);assert(maxDifference<.002);
 for(const [u,t]of[[-56,.5],[56,.5],[0,0],[0,1],[-70,.4],[0,-.2],[0,1.2]]){const p=field.at(...field.frame(u,t));assert.equal(p.cut,0);assert.equal(p.uncut,0);assert.equal(p.damp,0);}
 proof.checks.fieldSupport={short,left,right,damp,maxDifference};
}));

test('real mare triangle interiors and open leg space receive a coherent short face',()=>{
 const g=down.root.getObjectByName('Chalk Mare | ground cutting').geometry,p=g.attributes.position;let strong=0,total=0,min=1;
 for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3,c=field.at(x,z).cut;min=Math.min(min,c);strong+=c>.97;total++;}
 assert(strong/total>.99,'complete original chalk silhouette must retain short surrounding cover');
 // These are physical across/down coordinates of open ground below the barrel,
 // independent of the field expression and outside the actual mare cutting.
 const [x,z]=field.frame(-5,.1585);assert(!down.isChalk(x,z));assert(field.at(x,z).cut>.99);
 proof.checks.originalMareTriangles={strong,total,min,openLegGroundCut:field.at(x,z).cut};
});

test('actual original 426 seed heights use positive bounded short response and exterior neutrality',()=>withoutRandom(()=>{
 let changed=0,neutral=0,oldBuried=0,minimum=1;
 for(const row of native.seed.rows){const m=row.matrix,x=m[12],z=m[14],height=Math.hypot(m[4],m[5],m[6]),s=field.heightScale(x,z,height),q=field.at(x,z);assert(s>0&&s<=1);assert.equal(s,field.heightScale(x,z,height));if(q.cut===0||height<=q.cap){assert.equal(s,1);neutral++;}else{changed++;minimum=Math.min(minimum,s);}if(row.heightOffset<-.1)oldBuried++;}
 assert(changed>150&&neutral>150&&oldBuried>200);assert(minimum>.08);assert.equal(field.heightScale(0,0,1),1);assert.equal(field.heightScale(...field.frame(0,.3),0),1);
 proof.checks.nativeOriginalSeedResponse={changed,neutral,oldBuried,minimum};
}));

test('existing native-resolution landcover changes blue only and is idempotent across redraws',()=>withoutRandom(()=>{
 const size=1024,data=new Uint8ClampedArray(size*size*4);for(let i=0;i<data.length;i++)data[i]=(i*37+11)%256;const before=data.slice(),identity=data,changed=field.applyGrazingPixels(data,size);assert(changed>1000);assert.equal(data,identity);
 let outside=0;for(let i=0;i<data.length;i++){if(i%4!==2)assert.equal(data[i],before[i]);else if(data[i]!==before[i]){const k=Math.floor(i/4),x=-500+(k%size+.5)*1000/size,z=-500+(Math.floor(k/size)+.5)*1000/size;assert(field.at(x,z).cut>0);assert(data[i]>before[i]);}else outside++;}
 const after=data.slice();assert.equal(field.applyGrazingPixels(data,size),0);assert.deepEqual(data,after);proof.checks.blueOnly={changed,outside};
}));

test('late configuration is neutral until actual site and is revision-idempotent without RNG',()=>withoutRandom(()=>{
 assert.equal(C.getChalkGrazingField(),null);assert.equal(C.getChalkGrazingRevision(),0);assert.equal(C.chalkGrazingAt(native.site.x,native.site.z).cut,0);
 const a=C.configureChalkGrazing(native.site);assert.equal(C.getChalkGrazingRevision(),1);assert.equal(C.configureChalkGrazing({...native.site}),a);assert.equal(C.getChalkGrazingRevision(),1);assert.deepEqual(a.site,field.site);
}));

function capturedCurrentSeedGeometry(){const source=currentNative.seed.geometry,g=new T.BufferGeometry();for(const[name,attribute]of Object.entries(source.attributes)){const a=new T.Float32BufferAttribute(attribute.array,attribute.itemSize);assert.equal(hash(a.array),attribute.hash);g.setAttribute(name,a);}g.setIndex(source.index);assert.equal(hash(g.index.array),source.indexHash);assert.equal(g.index.count/3,18);assert.equal(g.attributes.position.count,30);g.computeBoundingBox();assert.deepEqual(g.boundingBox.min.toArray(),source.bounds.min);assert.deepEqual(g.boundingBox.max.toArray(),source.bounds.max);return g;}
function nativeSeedMesh(){const geometry=capturedCurrentSeedGeometry(),mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),9500);mesh.setColorAt(0,new T.Color());for(let i=0;i<9500;i++){mesh.instanceMatrix.array.set(packed.subarray(i*19,i*19+16),i*16);mesh.instanceColor.array.set(packed.subarray(i*19+16,i*19+19),i*3);}return mesh;}
function residentTrailGrassGeometry(){const b=fs.readFileSync(new URL('../assets/models/world/grass_medium_02.glb',import.meta.url)),length=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+length)),bin=b.subarray(28+length),p=j.meshes[0].primitives[0],g=new T.BufferGeometry();assert.deepEqual(j.nodes,[{name:'grass_medium_02_a',mesh:0}]);const read=index=>{const a=j.accessors[index],v=j.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[a.type],bytes=a.componentType===5126?4:2,ArrayType=a.componentType===5126?Float32Array:Uint16Array,array=new ArrayType(a.count*width),stride=v.byteStride||width*bytes,offset=(v.byteOffset||0)+(a.byteOffset||0);for(let i=0;i<a.count;i++)for(let k=0;k<width;k++)array[i*width+k]=a.componentType===5126?bin.readFloatLE(offset+i*stride+k*bytes):bin.readUInt16LE(offset+i*stride+k*bytes);return new T.BufferAttribute(array,width);};for(const [name,key]of[['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']])g.setAttribute(name,read(p.attributes[key]));g.setIndex(read(p.indices));g.computeBoundingBox();const box=g.boundingBox.clone(),h=box.max.y-box.min.y;g.translate(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);g.scale(1/h,1/h,1/h);g.computeBoundingBox();return g;}
const basis=a=>Math.hypot(a[0],a[1],a[2])+Math.hypot(a[4],a[5],a[6])+Math.hypot(a[8],a[9],a[10]);
test('production seed refresh uses all actual original native rows, preserving exterior/zero state and real live contact',()=>{
 C.configureChalkGrazing(native.site);
 const mesh=nativeSeedMesh(),before=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor.array.slice(),geometry=mesh.geometry,index=geometry.index.array.slice(),count=mesh.count;
 // Represent an original course-cleared local positive source. The refresh
 // may not reconstruct it from the original capacity or re-seat its root.
 const clear=native.seed.rows.find(row=>field.at(row.matrix[12],row.matrix[14]).cut>.99&&!down.isChalk(row.matrix[12],row.matrix[14]));for(const col of [0,4,8])for(let axis=0;axis<3;axis++)mesh.instanceMatrix.array[clear.index*16+col+axis]=0;before.set(mesh.instanceMatrix.array.subarray(clear.index*16,clear.index*16+16),clear.index*16);
 const stats=withoutRandom(()=>C.refreshChalkSeedMesh(mesh,down,{terrainH:terrain,groundH:ground}));let exterior=0,live=0,cut=0,maxGroundError=0;
 for(let i=0;i<9500;i++){const p=before.subarray(i*16,i*16+16),q=mesh.instanceMatrix.array.subarray(i*16,i*16+16),h=down.heightAt(p[12],p[14]);for(const k of [3,7,11,12,14,15])assert.equal(q[k],p[k]);
  if(!Number.isFinite(h)||basis(p)<=1e-9){assert.deepEqual(q,p);exterior++;continue;}
  if(down.isChalk(p[12],p[14])){assert.equal(basis(q),0);cut++;continue;}assert(basis(q)>0);live++;
  if(h>terrain(p[12],p[14])+1e-5){const previousOffset=p[13]-terrain(p[12],p[14]),ratio=Math.hypot(q[0],q[1],q[2])/Math.hypot(p[0],p[1],p[2]),expected=ground(p[12],p[14])+previousOffset*ratio;maxGroundError=Math.max(maxGroundError,Math.abs(q[13]-expected));assert(Math.abs(q[13]-expected)<2e-6);}
 }
 assert(exterior>9000&&live>200&&cut>=10&&stats.reseated>200&&stats.alreadyZero>=1,JSON.stringify({exterior,live,cut,...stats}));assert.equal(mesh.count,count);assert.equal(mesh.geometry,geometry);assert.deepEqual(mesh.instanceColor.array,colors);assert.deepEqual(geometry.index.array,index);
 proof.checks.actualSeedAdapter={...stats,exterior,live,cut,maxGroundError};mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('a photographed static grass row already seated on the live down cannot receive a second rise',()=>{
 C.configureChalkGrazing(native.site);
 const [x,z]=field.frame(0,.45),h=ground(x,z),mesh=new T.InstancedMesh(residentTrailGrassGeometry(),new T.MeshStandardMaterial(),1);mesh.setColorAt(0,new T.Color());mesh.instanceMatrix.array.set(new T.Matrix4().makeScale(.36,.36,.36).setPosition(x,h-.025,z).elements);const before=mesh.instanceMatrix.array.slice();assert(!down.isChalk(x,z));
 withoutRandom(()=>C.refreshChalkSeedMesh(mesh,down,{terrainH:terrain,groundH:ground},{reseat:false}));const a=mesh.instanceMatrix.array,ratio=Math.hypot(a[0],a[1],a[2])/Math.hypot(before[0],before[1],before[2]);assert(Math.abs(a[13]-(h+(before[13]-h)*ratio))<2e-6,'already-live photographed source must stay rooted, not add the overlay twice');
 mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('newly captured original18-triangle seed geometry replays all9500 actual final native rows exactly',()=>{
 C.configureChalkGrazing(native.site);const mesh=nativeSeedMesh(),data=readCurrent('chalk-front-high-grass-seed.f32'),actual=new Float32Array(data.buffer,data.byteOffset,data.byteLength/4);assert.equal(actual.length,9500*19);
 const result=withoutRandom(()=>C.refreshChalkSeedMesh(mesh,down,{terrainH:terrain,groundH:ground}));for(let i=0;i<9500;i++){assert.deepEqual(mesh.instanceMatrix.array.subarray(i*16,i*16+16),actual.subarray(i*19,i*19+16));assert.deepEqual(mesh.instanceColor.array.subarray(i*3,i*3+3),actual.subarray(i*19+16,i*19+19));}
 assert.deepEqual(result,currentNative.coverResponse.seed);const normals=mesh.geometry.attributes.normal.array.slice();mesh.geometry.computeVertexNormals();assert.deepEqual(mesh.geometry.attributes.normal.array,normals);
 proof.checks.currentNativeSeedReplay={priorCaptureHadGeometry:false,originalCompleteConstructorBodyExact:true,currentCapturedVertices:30,currentCapturedTriangles:18,rows:9500,allMatrixColorBytesExact:true,actualResponse:result};mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('actual middle controller cached before configuration refreshes without movement and retains exterior/quality roots',()=>{
 C.configureChalkGrazing({...native.site,x:350,z:-350});const scene=new T.Scene();let quality='high',blue=0;
 const f=createMeadowDistance({THREE:T,scene,canGrow:(x,z)=>Math.floor(x/7)%5!==0,heightAt:ground,managedAt:()=>0,getQuality:()=>quality});f.tick(12,native.site.x,native.site.z);
 const original=f.mesh.instanceMatrix.array.slice(),colors=f.mesh.instanceColor.array.slice(),count=f.mesh.count,identity=f.mesh.instanceMatrix;const terrainMesh=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial());terrainMesh.name='Pasture terrain';terrainMesh.material.userData.refreshGrazing=()=>blue++;scene.add(terrainMesh);
 C.configureChalkGrazing(native.site);const calls=[],G={scene,vistas:{chalkDown:down},horse:{player:{pos:{x:native.site.x,z:native.site.z}}},world:{terrainH:terrain,groundH:ground,nearGroundCover:{invalidate(){calls.push('invalidate');f.invalidate();},tick(...args){calls.push('tick');f.tick(...args);}}}};
 const result=withoutRandom(()=>refreshChalkCover(G));assert.deepEqual(calls,['invalidate','tick']);assert.equal(blue,1);assert(result.nearRefreshed&&result.blueRefreshed);assert.equal(f.mesh.instanceMatrix,identity);assert.equal(f.mesh.count,count);assert.deepEqual(f.mesh.instanceColor.array,colors);
 let changed=0,exterior=0;for(let i=0;i<count;i++){const p=original.subarray(i*16,i*16+16),q=f.mesh.instanceMatrix.array.subarray(i*16,i*16+16);for(const k of[3,7,11,12,14,15])assert.equal(q[k],p[k]);assert.equal(basis(q)>0,basis(p)>0);if(field.at(p[12],p[14]).cut===0){assert.deepEqual(q,p);exterior++;}else if(basis(p)>0&&!q.every((v,k)=>v===p[k]))changed++;}
 assert(changed>1000&&exterior>30000);const stable=f.mesh.instanceMatrix.array.slice(),version=f.mesh.instanceMatrix.version;assert.equal(withoutRandom(()=>refreshChalkCover(G)),result);assert.equal(blue,1);assert.deepEqual(f.mesh.instanceMatrix.array,stable);withoutRandom(()=>f.tick(13,native.site.x,native.site.z));assert.equal(f.mesh.instanceMatrix.version,version);
 for(const tier of['low','medium','high']){quality=tier;withoutRandom(()=>f.tick(14,native.site.x,native.site.z));for(let i=0;i<count;i++)for(const k of[12,14,15])assert.equal(f.mesh.instanceMatrix.array[i*16+k],original[i*16+k]);assert.deepEqual(f.mesh.instanceColor.array,colors);}
 f.tick(15,native.site.x+60,native.site.z+48);f.tick(16,native.site.x,native.site.z);assert.deepEqual(f.mesh.instanceMatrix.array,stable);proof.checks.actualMiddleLateRefresh={changed,exterior,count,geometryTriangles:f.mesh.geometry.index.count/3,repeatRevisionAppliedOnce:true};f.mesh.dispose();f.mesh.geometry.dispose();f.mesh.material.dispose();terrainMesh.geometry.dispose();terrainMesh.material.dispose();
});

test('late dependency capture waits original course/mixed readiness then refreshes once with a forced mixed plan',async()=>{
 C.configureChalkGrazing(native.site);let unlockCourse,unlockMixed;const course=new Promise(resolve=>{unlockCourse=resolve;}),mixed=new Promise(resolve=>{unlockMixed=resolve;}),calls=[];
 const scene=new T.Scene(),G={scene,vistas:{chalkDown:down},horse:{player:{pos:{x:native.site.x,z:native.site.z}}},world:{terrainH:terrain,groundH:ground,nearGroundCover:{invalidate(){calls.push('invalidate');},tick(){calls.push('source refill');}}}};
 const ready=installChalkCoverRefresh(G);G.courseClear={ready:course};G.world.mixedSward={ready:mixed,refreshEligibility(){calls.push('mixed classify invalidated');},tick(t,x,z,force){assert.equal(force,true);calls.push('mixed forced plan');}};
 await Promise.resolve();await Promise.resolve();assert.deepEqual(calls,[]);unlockCourse();await course;await Promise.resolve();assert.deepEqual(calls,[]);
 const prior=Math.random;Math.random=()=>{throw Error('Late refresh RNG');};let result;try{unlockMixed();result=await ready;assert.deepEqual(calls,['invalidate','source refill','mixed classify invalidated','mixed forced plan']);assert.equal(refreshChalkCover(G),result);assert.equal(calls.length,4);}finally{Math.random=prior;}
 assert(result.mixedRefreshed);proof.checks.lateReady={microtaskDependencyCapture:true,originalCourseReadyWaited:true,mixedReadyWaited:true,forcedRefresh:true,idempotent:true};
});

function nativeNearCells(){const meta=JSON.parse(read('near-source.json')),b=read(meta.file),p=new Float32Array(b.buffer,b.byteOffset,b.byteLength/4),cells=[];let cursor=0;for(const count of meta.cellCounts){const matrices=new Float32Array(240*16),colors=new Float32Array(240*3);for(let i=0;i<count;i++){matrices.set(p.subarray(cursor*19,cursor*19+16),i*16);colors.set(p.subarray(cursor*19+16,cursor*19+19),i*3);cursor++;}cells.push({count,version:1,matrices,colors});}assert.equal(cursor,meta.rows);return cells;}
const cellsDigest=cells=>sha(Buffer.concat(cells.flatMap(c=>[Buffer.from(c.matrices.buffer),Buffer.from(c.colors.buffer)])));
test('actual native source-cell mixed cache and scanned prototype heights refresh at the same camera without source/RNG/budget drift',async()=>{
 C.configureChalkGrazing({...native.site,x:350,z:-350});const [px,pz]=field.frame(0,.25),cells=nativeNearCells(),capacity=cells.reduce((n,c)=>n+c.count,0),sourceHash=cellsDigest(cells),scene=new T.Scene(),near=new T.InstancedMesh(createGrassTuftGeometry(T,{profile:'near-folded-v1'}),new T.MeshStandardMaterial({vertexColors:true}),capacity);near.setColorAt(0,new T.Color());scene.add(near);
 const resident=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({name:'Trail edge | scanned meadow grass',map:new T.Texture()}));scene.add(resident);let quality='high',vr=false;const hooks=new Map(),G={THREE:T,scene,world:{groundH:ground,nearGroundCover:{near,swardSource:{cells,key:()=>1,vr:()=>vr,canBasal:(x,z)=>Math.hypot(x-px,z-pz)<24,canAccent:()=>true}}},horse:{player:{pos:{x:px,z:pz}}},gfx:{get:()=>quality},on:(k,f)=>hooks.set(k,f),off:(k,f)=>{if(hooks.get(k)===f)hooks.delete(k);}};
 const asset=fs.readFileSync(new URL('../assets/models/world/grass_medium_02_specimens.glb',import.meta.url)),buffer=asset.buffer.slice(asset.byteOffset,asset.byteOffset+asset.byteLength),state=installMixedSward(G,{fetchAsset:async()=>({ok:true,arrayBuffer:async()=>buffer})});G.world.mixedSward=state;await state.ready;assert.deepEqual(state.errors,[]);assert(state.basal);
 const oldGrazed=state.stats.grazedRoots,resources=[...state.basalMeshes,...state.meshes].map(m=>({mesh:m,geo:m.geometry,mat:m.material,matrix:m.instanceMatrix,color:m.instanceColor}));
 C.configureChalkGrazing(native.site);withoutRandom(()=>{state.refreshEligibility();state.tick(120,px,pz,true);});assert(state.stats.grazedRoots>oldGrazed+1000);assert.equal(cellsDigest(cells),sourceHash);assert(state.stats.submittedTriangles<=state.stats.budgetMaxTriangles);assert.equal(state.stats.sourceRoots,capacity);
 let strong=0,exterior=0,scanStrong=0,maximumStrongHeight=0;const roots=new Map();for(const c of cells)for(let row=0;row<c.count;row++)roots.set(c.matrices[row*16+12]+','+c.matrices[row*16+14],{matrix:c.matrices.subarray(row*16,row*16+16),color:c.colors.subarray(row*3,row*3+3)});
 for(const mesh of[near,...state.basalMeshes,...state.meshes])for(let i=0;i<mesh.count;i++){const a=mesh.instanceMatrix.array.subarray(i*16,i*16+16),original=roots.get(a[12]+','+a[14]);assert(original,'every actual draw keeps a native source root');const q=field.at(a[12],a[14]);assert(basis(a)>0);assert.equal(a[15],original.matrix[15]);assert(a[13]<=ground(a[12],a[14])+1e-5);
  const scan=state.meshes.includes(mesh);if(!scan){assert.deepEqual(mesh.instanceColor.array.subarray(i*3,i*3+3),original.color);if(q.cut===0){assert.deepEqual(a,original.matrix);exterior++;}}
  if(q.cut>.995){const p=mesh.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let k=0;k<p.count;k++){const y=a[1]*p.getX(k)+a[5]*p.getY(k)+a[9]*p.getZ(k);min=Math.min(min,y);max=Math.max(max,y);}const height=max-min;assert(height<=q.cap+.012,'all actual prototype surfaces obey the field cap, including old scan clamp floor');maximumStrongHeight=Math.max(maximumStrongHeight,height);strong++;if(scan)scanStrong++;}
 }
 assert(strong>1000&&exterior>10000&&scanStrong>0,JSON.stringify({strong,exterior,scanStrong,maximumStrongHeight,scanRoots:state.stats.scanRoots}));for(const r of resources){assert.equal(r.mesh.geometry,r.geo);assert.equal(r.mesh.material,r.mat);assert.equal(r.mesh.instanceMatrix,r.matrix);assert.equal(r.mesh.instanceColor,r.color);}
 const rebuilds=state.stats.timing.rebuilds,versions=resources.map(r=>r.matrix.version);withoutRandom(()=>state.tick(121,px,pz));assert.equal(state.stats.timing.rebuilds,rebuilds);assert.deepEqual(resources.map(r=>r.matrix.version),versions);
 for(const [tier,xr]of[['low',false],['low',true],['high',false]]){quality=tier;vr=xr;withoutRandom(()=>state.tick(122,px,pz));assert(state.stats.submittedTriangles<=state.stats.budgetMaxTriangles);assert.equal(cellsDigest(cells),sourceHash);}
 const result={nativeCells:cells.length,sourceRows:capacity,strong,exterior,scanStrong,maximumStrongHeight,oldGrazed,newGrazed:state.stats.grazedRoots,sourceUnchanged:true,resourceIdentities:true,unchangedFrameNoUploads:true};withoutRandom(()=>state.dispose());assert.equal(near.count,capacity);assert.equal(cellsDigest(cells),sourceHash);assert(!hooks.has('tick'));proof.checks.actualMixedLateRefresh=result;
 near.dispose();near.geometry.dispose();near.material.dispose();resident.geometry.dispose();resident.material.map.dispose();resident.material.dispose();
});

test('actual cached terrain redraw refreshes late blue while preserving original tree skirts/path channels and Texture identity',()=>{
 C.configureChalkGrazing({...native.site,x:1500,z:1500});let pixels=null;const clone=p=>({...p,data:p.data.slice()}),context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:p=>{pixels=clone(p);},getImageData:()=>clone(pixels),fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){this.points=[];},moveTo(x,y){this.points.push([x,y]);},lineTo(x,y){this.points.push([x,y]);},stroke(){const green=Number(this.strokeStyle.match(/rgba\(0,(\d+)/)[1]);for(const[x,y]of this.points){const i=(Math.floor(y)*1024+Math.floor(x))*4;if(i>=0&&i<pixels.data.length)pixels.data[i+1]=Math.max(pixels.data[i+1],green);}}};
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};let surface;try{surface=createTerrainSurface({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()});}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
 const [x,z]=field.frame(0,.25);surface.setTrees([{x,z,s:1}]);surface.setPaths([[[x-3,z],[x+3,z]]]);const before=pixels.data.slice(),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};surface.material.onBeforeCompile(shader);const textures=Object.values(shader.uniforms).filter(u=>u.value?.isTexture).map(u=>u.value),ids=textures.map(t=>t.uuid);
 C.configureChalkGrazing(native.site);withoutRandom(()=>surface.material.userData.refreshGrazing());let changed=0,red=0,green=0;for(let i=0;i<before.length;i++){if(i%4===2){assert(pixels.data[i]>=before[i]);if(pixels.data[i]>before[i])changed++;}else assert.equal(pixels.data[i],before[i]);if(i%4===0&&pixels.data[i]>0)red++;if(i%4===1&&pixels.data[i]>0)green++;}
 assert(changed>1000&&red>10&&green>0);assert.deepEqual(textures.map(t=>t.uuid),ids);const once=pixels.data.slice();withoutRandom(()=>surface.material.userData.refreshGrazing());assert.deepEqual(pixels.data,once);proof.checks.actualBlueRedraw={changed,red,green,existingSamplerCount:textures.length,identity:true,repeatExact:true};surface.material.dispose();
});

test('original seed constructor stream, sequential flora admissions and full ground shader remain byte-exact',()=>{
 const oldHTML=read('ranch3d.html').toString(),html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),oldFlora=read('assets/features/world-flora.js').toString(),flora=fs.readFileSync(new URL('../assets/features/world-flora.js',import.meta.url),'utf8'),oldTerrain=read('assets/terrain-realism.js').toString(),terrainSource=fs.readFileSync(new URL('../assets/terrain-realism.js',import.meta.url),'utf8');
 const between=(s,a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert(start>=0&&end>start,a+' actual source block');return s.slice(start,end);};
 assert.equal(between(html,'function meadowBladeTexture('," /* ===== near grass:"),between(oldHTML,'function meadowBladeTexture('," /* ===== near grass:"));
 assert.equal(between(flora,'export function install(G){',' /* ---- 6j.'),between(oldFlora,'export function install(G){',' /* ---- 6j.'));
 assert.equal(between(terrainSource,'  material.onBeforeCompile = sh => {','  function setTrees('),between(oldTerrain,'  material.onBeforeCompile = sh => {','  function setTrees('));
 proof.checks.originalFullSourceBodies={seedTextureGeometryAcceptanceAndDraws:true,sequentialFloraPlanningOccupancyAndDraws:true,completeTerrainShader:true};
});

test('independent receipt is serializable and file export is explicit only',()=>{const json=JSON.stringify(proof,null,2)+'\n';assert(JSON.parse(json).checks.nativeFixtureRows===426);if(process.env.CHALK_INDEPENDENT_AUDIT_OUTPUT)fs.writeFileSync(process.env.CHALK_INDEPENDENT_AUDIT_OUTPUT,json);});
