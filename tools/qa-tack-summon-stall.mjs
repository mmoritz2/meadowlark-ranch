// Real Three geometry and source-layout check; no browser, canvas, models or network.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const THREE=await import(threeURL);
const {installTackSummonStall,TACK_SUMMON_STALL:P}=await import('../assets/features/tack-summon-stall.js');
const source=await readFile(new URL('../ranch3d.html',import.meta.url),'utf8');
function object(name){const match=source.match(new RegExp('const '+name+'=(\\{[^;]+\\});'));assert(match,name+' source placement');return Function('return ('+match[1]+')')();}
const summon=object('SUMMON_STALL'),barn=object('BARN_ROW'),pasture=object('PAST');
const paths=Function('return ('+source.match(/const PATHS=(\[[\s\S]*?\]);/)[1]+')')();
const pathWidth=Number(source.match(/const PATH_W=([\d.]+)/)[1]);
const scene=new THREE.Scene(),buildings=[],things=[],colliders=[],mapMarkers=[],miniMarkers=[];
const G={THREE,scene,nameSprite(text){const sprite=new THREE.Sprite(new THREE.SpriteMaterial());sprite.userData.text=text;return sprite;},world:{things,colliders,mapMarkers,miniMarkers,
 addBuilding(o){buildings.push(o);const group=o.build();group.position.set(o.x,.27,o.z);group.rotation.y=o.rot;scene.add(group);if(o.r)colliders.push({x:o.x,z:o.z,r:o.r});return group;},
 addThing(t){things.push(t);if(t.g&&!t.g.parent)scene.add(t.g);return t;},
}};
let opened=0;
const handle=installTackSummonStall(G,()=>++opened);
assert.equal(buildings.length,1);assert.equal(things.length,1);assert.equal(colliders.length,1);assert.equal(mapMarkers.length,1);assert.equal(miniMarkers.length,1);
assert.equal(handle.thing.label(),'Summon tack (E)');assert.equal(handle.marker.label,'Tack Summoning Stall');assert.equal(handle.thing.tick,undefined);assert.equal(handle.root.parent,scene);
assert.equal(handle.thing.use(),1);assert.equal(opened,1);
const again=installTackSummonStall(G,()=>opened+=10);assert.equal(again,handle);handle.thing.use();assert.equal(opened,11,'repeated installation replaces callback without duplicating scenery');
assert.equal(buildings.length,1);assert.equal(things.length,1);assert.equal(mapMarkers.length,1);assert.equal(scene.children.length,1);
assert.throws(()=>installTackSummonStall(G,null),TypeError);
const meshes=[];handle.root.traverse(o=>{assert(!o.isLight,'static emissive accents add no per-frame light cost');if(o.isMesh)meshes.push(o);});
assert.equal(meshes.length,9);assert.equal(handle.root.userData.tackSummonStall.stats.meshes,meshes.length);
let triangles=0;const bounds=new THREE.Box3(),localBounds=new THREE.Box3();handle.root.updateMatrixWorld(true);
for(const mesh of meshes){
 const a=mesh.geometry.attributes;assert.equal(a.position.count,a.normal.count);assert.equal(a.position.count,a.uv.count);
 assert([...a.position.array,...a.normal.array,...a.uv.array].every(Number.isFinite));
 for(let i=0;i<a.normal.count;i++){const n=new THREE.Vector3().fromBufferAttribute(a.normal,i).length();assert(n>.95&&n<1.05,'unit surface normals');}
 mesh.geometry.computeBoundingBox();assert(!mesh.geometry.boundingBox.isEmpty());localBounds.union(mesh.geometry.boundingBox);bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
 triangles+=a.position.count/3;assert(mesh.castShadow&&mesh.receiveShadow);
}
assert.equal(triangles,handle.root.userData.tackSummonStall.stats.triangles);assert(triangles<16000,'small stall geometry budget');
assert(localBounds.max.x-localBounds.min.x<P.width+.06);assert(localBounds.max.z-localBounds.min.z<P.depth+.06);assert(localBounds.max.y<2.5);
for(const x of[localBounds.min.x,localBounds.max.x])for(const z of[localBounds.min.z,localBounds.max.z])assert(Math.hypot(x,z)<P.radius,'whole physical footprint stays inside blocker');
assert.equal(handle.root.position.y,.27,'uses world terrain placement');assert(P.reach>P.radius+.55+.5,'horse can interact without penetrating blocker');
const label=handle.root.getObjectByName('Tack Summoning Stall label');assert(label?.isSprite);assert.equal(label.userData.text,P.label);
function rectOverlap(a,b){return a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;}
const b={minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z};
const stall={minX:summon.x-2.55,maxX:summon.x+2.55,minZ:summon.z-1.9,maxZ:summon.z+1.9};
assert(!rectOverlap(b,stall),'separate from existing horse summoning shell');assert(Math.hypot(P.x-summon.x,P.z-summon.z)>P.radius+2.7+.55,'horse stall collider stays separate');
assert(!rectOverlap(b,{minX:summon.x-1.5,maxX:summon.x+1.5,minZ:summon.z-4.7,maxZ:summon.z-1.5}),'horse door/summoning approach stays open');
for(let i=0;i<barn.n;i++){const z=barn.z0+i*barn.step;assert(!rectOverlap(b,{minX:barn.x-1.35,maxX:barn.x+1.45,minZ:z-1.82,maxZ:z+1.82}),'separate from every barn-row roof');}
assert(b.minX>pasture.x2+.55,'outside pasture fence');assert(b.maxX< -25-.55,'outside the arena rail, including rider clearance');
assert(Math.abs(P.z+9)>P.radius+.55+.25,'pasture gate centerline retains a horse-width passage');
assert(Math.hypot(P.x+30,P.z-3.2)>P.radius+2.6,'clear of nearest grandstand collision region');
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
let roadDistance=Infinity;for(const path of paths)for(let i=1;i<path.length;i++)roadDistance=Math.min(roadDistance,segmentDistance([P.x,P.z],path[i-1],path[i]));
assert(roadDistance>P.radius+pathWidth,'existing source roads remain unobstructed');
console.log('PASS tack summoning stall:',JSON.stringify({x:P.x,z:P.z,meshes:meshes.length,triangles,roadDistance:+roadDistance.toFixed(2),bounds:b}));
console.log('PASS finite geometry, static lighting, idempotent callback, accessible interaction, label/map markers and source-layout clearance');
