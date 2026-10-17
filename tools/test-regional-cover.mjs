import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const productRoot=process.env.REGIONAL_SOURCE_ROOT||new URL('../',import.meta.url).pathname;
const fixtureRoot=new URL('./fixtures/regional-cover-8aa2e72/',import.meta.url);
const fixture=JSON.parse(fs.readFileSync(new URL('actual-layout.json',fixtureRoot)));
const {layout}=fixture;
const tracks=[fixture.cloverRoute,{id:'marsh',w:2.7,pts:layout.marshTrack},{id:'ochre',w:2.35,pts:layout.ochreTrack},{id:'riverwest',w:2.0,pts:layout.riverWestTrack}];
const moduleURL=f=>pathToFileURL(productRoot+'assets/'+f).href;
const helper=await import(moduleURL('regional-cover-composition.mjs')+'?v=regional-cover-2');
const {createRegionalCoverField,regionalCoverLayoutFromWorld,regionalCoverRuns,composeRegionalCover,tintRegionalCover}=helper;
// Raw production imports share exactly the refresh/consumer singleton URL.
const proto=await import(moduleURL('pastoral-cover.mjs')+'?v='+fixture.pastoralQuery);
const refresh=await import(moduleURL('pastoral-cover-refresh.mjs'));
const T=await import(moduleURL('vendor/three/build/three.module.js'));
const meadow=await import(moduleURL('meadow-cover.js'));
const mixed=await import(moduleURL('mixed-sward.mjs'));
const h=bytes=>createHash('sha256').update(bytes).digest('hex');
const face=Math.atan2(layout.chalk.x,layout.chalk.z),ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
const chalkAt=(x,z)=>{const dx=x-layout.chalk.x,dz=z-layout.chalk.z;return Math.abs(dx*ax+dz*az)<layout.chalk.len/2&&Math.abs(dx*ox+dz*oz)<layout.chalk.depth/2;};
const wetAt=(x,z)=>Math.abs(z-120)<10.5||Math.hypot(x-310,z-300)<12;
const options={layout,terrainH:()=>0,wetAt,chalkAt,preserveAt:()=>false,forestPoints:[]};
const field=createRegionalCoverField(options);
const centre=[(layout.ochrePost[0]+layout.ochreBarn[0])*.5,(layout.ochrePost[1]+layout.ochreBarn[1])*.5];
const common={terrainH:()=>0,riverZ:()=>120,riverLevel:()=>-2,streamX:()=>8,wetAt,chalkAt,forestPoints:[],countrysideTracks:tracks};
test('layout adapter reads actual full-precision placed owners and copies arrays',()=>{
 const G={world:{things:[{id:'q:willow:boathouse',x:layout.willowDoor[0],z:layout.willowDoor[1]},{id:'q:ochre:post',x:layout.ochrePost[0],z:layout.ochrePost[1]},{id:'q:ochre:barn',x:layout.ochreBarn[0],z:layout.ochreBarn[1]}]},vistas:{SCARP:layout.chalk,LAND:[{id:'wrenfell',x:-280,z:-90},{id:'ninesisters',x:-40,z:330}]},quartersPkg:{willowSettlement:{routes:layout.willowRoutes}},worldPaths:{tracks}};
 const got=regionalCoverLayoutFromWorld(G);assert.deepEqual(got,layout);got.marshTrack[0][0]+=1;assert.notEqual(got.marshTrack[0][0],layout.marshTrack[0][0]);
 G.world.things.pop();assert.throws(()=>regionalCoverLayoutFromWorld(G),/ochre:barn/);
});

test('authored runs form bounded bent approaches and preserve the live anchors',()=>{
 const runs=regionalCoverRuns(layout);assert.equal(runs.length,12);assert.ok(runs.every(r=>r.length>2&&r.nodes.length>=2));
 assert.deepEqual(runs.find(r=>r.id==='ochre-arrival').nodes.at(-1),layout.ochrePost);
 assert.deepEqual(runs.find(r=>r.id==='willowmere-dry-arrival').nodes.at(-1),layout.willowDoor);
 assert.ok(runs.find(r=>r.id==='keep-approach').nodes.length>=8);
 assert.ok(field.stats.gridBytes<2_000_000);assert.ok(field.stats.activeVertices>1000);
});

test('outside regions, water, physical chalk and existing field ownership are exact zero',()=>{
 for(const p of [[0,0],[220,-110],[-300,-320],[0,120],[310,300],[layout.chalk.x,layout.chalk.z]])assert.equal(field.at(...p).weight,0,String(p));
 const protectedField=createRegionalCoverField({...options,preserveAt:(x,z)=>x<-260&&z<-60});
 assert.equal(protectedField.at(-280,-76).weight,0);assert.ok(field.at(-280,-76).weight>.8);
 const trees=createRegionalCoverField({...options,forestPoints:[{x:-280,z:-76,s:1}]});assert.equal(trees.at(-280,-76).weight,0);assert.ok(trees.at(-274,-76).weight>.5);
});

test('core and irregular higher margins differ without changing root eligibility',()=>{
 const q=field.at(-280,-76);assert.ok(q.weight>.9&&q.cut>.9&&q.cap<.42);
 let margin=0,maxCap=0;for(let x=-320;x<-230;x+=2)for(let z=-130;z<-45;z+=2){const p=field.at(x,z);if(p.weight>.7&&p.cut<.3){margin++;maxCap=Math.max(maxCap,p.cap);}}
 assert.ok(margin>10);assert.ok(maxCap>.7);assert.ok(field.at(...centre).dry>.99);
});

test('steep ground excludes the new presentation and all functions avoid RNG',()=>{
 const random=Math.random;Math.random=()=>{throw Error('Ambient RNG touched');};try{const steep=createRegionalCoverField({...options,terrainH:x=>x*2});assert.equal(steep.at(-280,-76).weight,0);assert.ok(createRegionalCoverField(options).stats.activeVertices>0);}finally{Math.random=random;}
});

test('dry grass becomes locally straw coloured while outside colours remain exact',()=>{
 const source=new Float32Array([.18,.32,.09]),outside=source.slice();assert.equal(tintRegionalCover(outside,field.at(0,0)),false);assert.deepEqual(outside,source);
 const dry=source.slice();assert.equal(tintRegionalCover(dry,field.at(...centre)),true);assert.ok(dry[0]>dry[1]&&dry[1]>dry[2]);
 const object={r:source[0],g:source[1],b:source[2]};tintRegionalCover(object,field.at(...centre));assert.ok(Math.abs(object.r-dry[0])<1e-7);
});

test('landcover writes blue only, retains dry ground, protects every exterior texel',()=>{
 const size=256,data=new Uint8ClampedArray(size*size*4);for(let i=0;i<data.length;i+=4)data.set([73,29,7,255],i);
 const before=data.slice(),changed=field.applyGrazingPixels(data,size);assert.ok(changed>100);
 for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++){const i=(iz*size+ix)*4,q=field.at(-500+(ix+.5)*1000/size,-500+(iz+.5)*1000/size);assert.equal(data[i],before[i]);assert.equal(data[i+1],before[i+1]);assert.equal(data[i+3],before[i+3]);if(q.weight===0||q.dry>0)assert.equal(data[i+2],before[i+2]);}
});

test('composition is a stable pointwise height ceiling with unchanged outside object',()=>{
 const base={cut:0,cap:Infinity},q=field.at(-280,-76);assert.equal(composeRegionalCover(base,field.at(0,0)),base);
 const changed=composeRegionalCover(base,q);assert.ok(changed.cap<.42&&changed.cut>.9);assert.deepEqual(composeRegionalCover(changed,q),changed);
});

test('integrated prototype keeps all three existing networks and exact exterior responses',()=>{
 const base=proto.createPastoralCoverField(common),candidate=proto.createPastoralCoverField({...common,regionalLayout:layout});assert.deepEqual(candidate.composition.runs,base.composition.runs);assert.equal(candidate.composition.runs.length,3);
 let originalPoints=0,exterior=0,changed=0;
 for(let x=-450;x<=450;x+=5)for(let z=-450;z<=450;z+=5){const a=base.at(x,z),b=candidate.at(x,z),q=candidate.regional.at(x,z);if(base.composition.at(x,z).weight>0){originalPoints++;assert.equal(q.weight,0);assert.deepEqual(b,a);}if(q.weight===0){exterior++;assert.deepEqual(b,a);}else if(b.cap<a.cap)changed++;}
 assert.ok(originalPoints>50&&exterior>25000&&changed>100);
});

test('integrated matrix response is idempotent, rooted, XZ-exact and leaves source rows alone',()=>{
 const candidate=proto.configurePastoralCover({...common,regionalLayout:layout}),source=new Float32Array([1,0,0,0,0,3,0,0,0,0,1,0,-280,2,-76,1]),a=source.slice(),sourceHash=h(Buffer.from(source.buffer));
 const geo={boundingBox:{min:{x:-.4,y:0,z:-.4},max:{x:.4,y:1,z:.4}}};assert.ok(candidate.at(-280,-76).cap<.42);
 assert.ok(proto.respondPastoralGrassMatrix(a,0,geo,()=>2)<1);assert.equal(a[12],source[12]);assert.equal(a[14],source[14]);assert.equal(a[13],2);
 for(const i of [0,2,4,6,8,10])assert.equal(a[i],source[i]);const once=a.slice();assert.equal(proto.respondPastoralGrassMatrix(a,0,geo,()=>2),1);assert.deepEqual(a,once);assert.equal(h(Buffer.from(source.buffer)),sourceHash);
});

test('raw source inverse, final singleton import and controlled prechange field checksum are exact',()=>{
 const edits=JSON.parse(fs.readFileSync(new URL('source-edits.json',fixtureRoot)));
 for(const[file,e]of Object.entries(edits)){let s=fs.readFileSync(productRoot+file,'utf8');assert.equal(h(s),e.afterSHA256);for(const c of e.changes.toReversed()){assert.equal(s.split(c.after).length-1,c.occurrences);s=s.replace(c.after,c.before);}assert.equal(h(s),e.beforeSHA256);assert.equal(e.beforeSHA256,fixture.expectedFunctionalPreimages[file]);}
 assert.equal(helper.REGIONAL_COVER_PROFILE,fixture.expectedHelperProfile);
 assert.ok(fs.readFileSync(productRoot+'assets/pastoral-cover-refresh.mjs','utf8').includes('pastoral-cover.mjs?v='+fixture.pastoralQuery));
 const base=proto.createPastoralCoverField(common),hash=createHash('sha256');let count=0;
 for(let x=-450;x<=450;x+=5)for(let z=-450;z<=450;z+=5){hash.update(JSON.stringify([x,z,base.at(x,z)]));count++;}
 assert.equal(count,fixture.controlledBaselineField.samples);assert.equal(hash.digest('hex'),fixture.controlledBaselineField.sha256);
});

function makeMesh(name,points,geometry=new T.BoxGeometry(.3,1,.3)){
 geometry.computeBoundingBox();const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),points.length),matrix=new T.Matrix4(),q=new T.Quaternion();mesh.name=name;
 for(let i=0;i<points.length;i++){const [x,z]=points[i];matrix.compose(new T.Vector3(x,-.02,z),q,new T.Vector3(1,2.4,1));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color().setRGB(.18,.32,.09));}return mesh;
}
const arrayHash=a=>h(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const corePoints=[[-280,-76],[-38,342],centre,[290,282],[-48,146],[1,94]];

test('actual source near packing and static/flora matrix responses preserve roots, zero rows and source colours',()=>{
 proto.configurePastoralCover({...common,regionalLayout:layout});
 const source=makeMesh('source',corePoints),cell={count:corePoints.length,version:1,matrices:source.instanceMatrix.array.slice(),colors:source.instanceColor.array.slice()},matrixHash=arrayHash(cell.matrices),colorHash=arrayHash(cell.colors),near=makeMesh('near',corePoints);
 proto.applyPastoralSourceMesh(near,[cell],()=>0);let shortened=0;
 for(let row=0;row<cell.count;row++){const o=row*16;assert.equal(near.instanceMatrix.array[o+12],cell.matrices[o+12]);assert.equal(near.instanceMatrix.array[o+14],cell.matrices[o+14]);for(const k of[0,2,4,6,8,10])assert.equal(near.instanceMatrix.array[o+k],cell.matrices[o+k]);if(near.instanceMatrix.array[o+5]<cell.matrices[o+5])shortened++;}
 assert.ok(shortened>=4);assert.equal(arrayHash(cell.matrices),matrixHash);assert.equal(arrayHash(cell.colors),colorHash);
 const first=near.instanceColor.array.slice();proto.applyPastoralSourceMesh(near,[cell],()=>0);assert.deepEqual(near.instanceColor.array,first);
 const fixed=makeMesh('static',corePoints),retired=fixed.instanceMatrix.array;for(const k of[0,1,2,4,5,6,8,9,10])retired[k]=0;const zero=retired.slice(0,16);proto.applyPastoralGrassMesh(fixed,()=>0);assert.deepEqual(retired.slice(0,16),zero);
});

test('actual High/Low middle-distance consumer keeps exterior/XZ rows and applies short dry coloured cover',()=>{
 let changes=0;
 for(const quality of['high','low']){
  proto.configurePastoralCover(common);const scene=new T.Scene(),cover=meadow.createMeadowDistance({THREE:T,scene,canGrow:()=>true,heightAt:()=>0,managedAt:()=>0,low:quality==='low',getQuality:()=>quality});cover.tick(0,...centre);
  const before=cover.mesh.instanceMatrix.array.slice(),colors=cover.mesh.instanceColor.array.slice();proto.configurePastoralCover({...common,regionalLayout:layout});cover.invalidate();cover.tick(0,...centre);
  const after=cover.mesh.instanceMatrix.array;for(let row=0;row<cover.mesh.count;row++){const o=row*16,x=after[o+12],z=after[o+14],q=proto.pastoralCoverAt(x,z);assert.equal(x,before[o+12]);assert.equal(z,before[o+14]);if(!(q.regionalWeight>0)){assert.deepEqual(after.slice(o,o+16),before.slice(o,o+16));assert.deepEqual(cover.mesh.instanceColor.array.slice(row*3,row*3+3),colors.slice(row*3,row*3+3));}else if(q.regionalDry>.9&&q.regionalWeight>.9){if(after[o+5]<before[o+5])changes++;}}
  scene.remove(cover.mesh);cover.mesh.dispose();cover.mesh.geometry.dispose();cover.mesh.material.dispose();
 }
 assert.ok(changes>100);
});

test('actual mixed High/Low packing retains every source cell and height/palette response',async()=>{
 proto.configurePastoralCover({...common,regionalLayout:layout});const points=[];for(let z=-124;z<=-28;z+=8)for(let x=-328;x<=-232;x+=8)points.push([x,z]);
 const scene=new T.Scene(),near=makeMesh('near',points,meadow.createGrassTuftGeometry(T,{profile:'near-folded-v1'})),cell={count:points.length,version:1,matrices:near.instanceMatrix.array.slice(),colors:near.instanceColor.array.slice()},matrixHash=arrayHash(cell.matrices),colorHash=arrayHash(cell.colors);scene.add(near);
 const scanned=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name:'Trail edge | scanned meadow grass',map:new T.Texture()}));scene.add(scanned);let quality='high';
 const G={THREE:T,scene,gfx:{get:()=>quality},horse:{player:{pos:{x:-280,z:-76}}},world:{groundH:()=>0,nearGroundCover:{near,swardSource:{cells:[cell],key:()=>1,vr:()=>false,canBasal:()=>true,canAccent:()=>true}}},on(){},off(){}};
 const raw=fs.readFileSync(productRoot+'assets/models/world/grass_medium_02_specimens.glb'),state=mixed.installMixedSward(G,{fetchAsset:async()=>({ok:true,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)})});await state.ready;assert.deepEqual(state.errors,[]);
 for(const q of['high','low']){quality=q;state.tick(0,-280,-76,true);assert.equal(state.stats.sourceRoots,points.length);assert.ok(state.stats.submittedTriangles<=state.stats.budgetMaxTriangles);assert.equal(arrayHash(cell.matrices),matrixHash);assert.equal(arrayHash(cell.colors),colorHash);let core=0;
  for(const mesh of[near,...state.basalMeshes])for(let row=0;row<mesh.count;row++){const o=row*16,x=mesh.instanceMatrix.array[o+12],z=mesh.instanceMatrix.array[o+14],s=proto.pastoralCoverAt(x,z);if(s.regionalWeight>.9&&s.cut>.9){const b=mesh.geometry.boundingBox,height=Math.abs(mesh.instanceMatrix.array[o+1])*(b.max.x-b.min.x)+Math.abs(mesh.instanceMatrix.array[o+5])*(b.max.y-b.min.y)+Math.abs(mesh.instanceMatrix.array[o+9])*(b.max.z-b.min.z);assert.ok(height<=s.cap+1e-5);core++;}}
  assert.ok(core>5);
 }
 state.dispose();
});

function refreshFixture(){
 const scene=new T.Scene(),seed=makeMesh('seed',corePoints),staticGrass=makeMesh('Trail edge | meadow tussocks',corePoints),tuft=makeMesh('flora tuft',corePoints),reed=makeMesh('reed',corePoints),fern=makeMesh('fern',corePoints),forest=makeMesh('forest',corePoints);for(const m of[seed,staticGrass,tuft,reed,fern,forest])scene.add(m);
 const counts={near:0,mixed:0,blue:0};const terrain=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshStandardMaterial());terrain.name='Pasture terrain';terrain.material.userData.refreshGrazing=()=>counts.blue++;scene.add(terrain);
 const W={...common,groundH:()=>0,seedGrass:seed,forestPoints:[],things:[{id:'q:willow:boathouse',x:layout.willowDoor[0],z:layout.willowDoor[1]},{id:'q:ochre:post',x:layout.ochrePost[0],z:layout.ochrePost[1]},{id:'q:ochre:barn',x:layout.ochreBarn[0],z:layout.ochreBarn[1]}],colliders:[{x:1,z:2,r:3}],walls:[{x1:1,z1:2,x2:3,z2:4}],nearGroundCover:{invalidate(){},tick(){counts.near++;}},mixedSward:{refreshEligibility(){},tick(){counts.mixed++;}}};
 const G={scene,world:W,horse:{player:{pos:{x:-280,z:-76}}},worldPaths:{tracks},vistas:{SCARP:layout.chalk,LAND:[{id:'wrenfell',x:layout.keep[0],z:layout.keep[1]},{id:'ninesisters',x:layout.sisters[0],z:layout.sisters[1]}],chalkDown:{heightAt:(x,z)=>chalkAt(x,z)?0:NaN}},quartersPkg:{pondContains:wetAt,willowSettlement:{routes:layout.willowRoutes}},floraPkg:{refreshPastoralCover:()=>({tuft:proto.applyPastoralGrassMesh(tuft,()=>0)})}};return{G,W,counts,seed,staticGrass,tuft,reed,fern,forest};
}
test('late actual refresh changes grass roles only, retains physics/RNG/resources and handles regional failure with all original fields',async()=>{
 const f=refreshFixture(),retained=[f.reed,f.fern,f.forest].map(m=>[arrayHash(m.instanceMatrix.array),arrayHash(m.instanceColor.array)]),physical=JSON.stringify([f.W.colliders,f.W.walls,f.W.things,f.W.forestPoints]),children=f.G.scene.children.length;
 const random=Math.random;Math.random=()=>{throw Error('Late presentation consumed ambient RNG');};try{refresh.installPastoralCoverRefresh(f.G);await f.W.countrysideFieldsReady;}finally{Math.random=random;}
 assert.equal(f.W.regionalCover.stats.runs,12);assert.equal(f.G.scene.children.length,children);assert.equal(JSON.stringify([f.W.colliders,f.W.walls,f.W.things,f.W.forestPoints]),physical);assert.deepEqual([f.reed,f.fern,f.forest].map(m=>[arrayHash(m.instanceMatrix.array),arrayHash(m.instanceColor.array)]),retained);assert.ok(f.counts.near>0&&f.counts.mixed>0&&f.counts.blue>0);
 const bad=refreshFixture();bad.W.things.pop();const warn=console.warn;console.warn=()=>{};try{refresh.installPastoralCoverRefresh(bad.G);await bad.W.countrysideFieldsReady;}finally{console.warn=warn;}assert.match(bad.W.regionalCoverError,/ochre:barn/);assert.equal(bad.W.regionalCover,null);assert.equal(proto.getPastoralCoverField().composition.runs.length,3);
});
