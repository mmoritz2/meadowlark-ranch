import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createOuterLandscape,outerDistance} from '../assets/outer-landscape.js';
import {regionalProfileAt} from '../assets/regional-landscape.mjs';
import {selectOuterWoodland,outerGroveWeight,OUTER_WOODLAND_LIMIT} from '../assets/outer-woodland.mjs';

// Exercise the production outer mesh, with a sloping, uneven inner boundary.
const heightAt=(x,z)=>.002*x-.004*z+Math.sin(z*.012)*.3;
const geometry=new T.PlaneGeometry(1000,1000,512,512);geometry.rotateX(-Math.PI/2);
const position=geometry.attributes.position,colors=[];
for(let i=0;i<position.count;i++){position.setY(i,heightAt(position.getX(i),position.getZ(i)));colors.push(.91,.96,.89);}
geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
const ground=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true}));
const art=createOuterLandscape({THREE:T,scene:new T.Scene(),heightAt,groundMesh:ground});
const mesh=art.mesh.geometry,sites=art.woodlandSites;

// Independent XZ interpolation of the actual emitted face, without trusting
// the placement helper's saved barycentric weights or analytic terrain height.
function surfaceAt(root){
 const ids=Array.from(mesh.index.array.slice(root.triangle*3,root.triangle*3+3));
 const vertices=ids.map(id=>new T.Vector3().fromBufferAttribute(mesh.attributes.position,id));
 const [a,b,c]=vertices,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
 const u=((b.z-c.z)*(root.x-c.x)+(c.x-b.x)*(root.z-c.z))/den;
 const v=((c.z-a.z)*(root.x-c.x)+(a.x-c.x)*(root.z-c.z))/den,w=1-u-v;
 const normal=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
 if(normal.y<0)normal.negate();
 return{weights:[u,v,w],y:u*a.y+v*b.y+w*c.y,normal};
}

test('forest placement is deterministic without consuming the in-basin random stream',()=>{
 const previous=Math.random;let calls=0;
 Math.random=()=>{calls++;throw Error('Outer woodland consumed ambient RNG');};
 try{assert.deepEqual(selectOuterWoodland({positions:mesh.attributes.position.array,index:mesh.index.array,regionalProfileAt}),sites);}
 finally{Math.random=previous;}
 assert.equal(calls,0);
});

test('every root touches an actual emitted face outside riding space, including square corners',()=>{
 for(const root of sites){
  for(const key of ['x','y','z','height','yaw','slope'])assert(Number.isFinite(root[key]),key);
  assert(Number.isInteger(root.triangle)&&root.triangle>=0&&root.triangle<mesh.index.count/3);
  const surface=surfaceAt(root);assert(surface.weights.every(w=>w>=-1e-9&&w<=1+1e-9));
  assert(Math.abs(root.y-surface.y)<1e-7,'root floats above or sinks under its real face');
  assert(outerDistance(root.x,root.z)>58&&Math.max(Math.abs(root.x),Math.abs(root.z))>540);
  assert(surface.normal.y>0&&Math.hypot(surface.normal.x,surface.normal.z)/surface.normal.y<=.52+1e-9);
  assert(surface.normal.distanceTo(new T.Vector3(...root.normal))<1e-9,'saved normal disagrees with emitted face');
  assert(root.height>3&&root.height<=27);
 }
});

test('mature mixed northern stands stay within the existing atlas and submitted geometry budget',()=>{
 assert(sites.length>1500&&sites.length<=OUTER_WOODLAND_LIMIT&&sites.length<=4200);
 assert(sites.length*2<=8400,'each outer atlas card submits two triangles');
 const allowed=new Set(['mature-pine','canopy-broadleaf','woodland-broadleaf']),buckets=new Set();
 for(const root of sites){assert(allowed.has(root.source));buckets.add(`${root.source}:${root.x<0}:${root.z<0}`);}
 assert(buckets.size<=12,'consumer groups by source and X/Z quadrant');
 const north=sites.filter(s=>s.z<-550);assert(north.length>700);
 assert.equal(new Set(north.map(s=>s.source)).size,3,'northern forest needs broadleaf edges as well as conifers');
 assert(north.filter(s=>s.height>18).length>north.length*.5,'northern trees need mature crown scale');
});

test('forest cores have nearby crowns while trunks retain separation',()=>{
 let overlapping=0;
 for(const root of sites){
  let nearest=Infinity;
  for(const other of sites)if(other!==root)nearest=Math.min(nearest,Math.hypot(root.x-other.x,root.z-other.z));
  assert(nearest>=4.6,'coincident trunks are not a forest mass');
  if(root.grove>.8&&nearest<11)overlapping++;
 }
 assert(overlapping>sites.length*.3,'core trees must read as stands rather than isolated dots');
});

test('broad glades and the southwest valley remain open, with lower dry woodland',()=>{
 let open=0,total=0;
 for(let z=-890;z<=890;z+=10)for(let x=-890;x<=890;x+=10){
  const d=outerDistance(x,z);if(d<82||d>335)continue;
  total++;if(outerGroveWeight(x,z)<.04)open++;
 }
 assert(open/total>.35,'separate woodland bodies with broad open ground');
 for(const root of sites){
  const region=regionalProfileAt(root.x,root.z);assert(region.valley<.78);
  assert(outerGroveWeight(root.x,root.z)>=.065,'a tree stands outside the shared ground mask');
  if(region.dry>.7)assert(root.height<=9.8);
 }
});
