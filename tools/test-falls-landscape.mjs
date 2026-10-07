import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {HOLLOWPEAK as F,alpineRelief,alpineSnowAt,fallsRelief,fallsTerrainHeight,fallsContainsWater,fallsExcludesDryPlants,createFallsLandscape} from '../assets/falls-landscape.js';
import {createWaterfallArt} from '../assets/waterfall-art.js';
import {createRiverMaterial} from '../assets/terrain-realism.js';
const step=1000/512,n=513,heights=Float32Array.from({length:n*n},(_,i)=>fallsTerrainHeight(i%n*step-500,Math.floor(i/n)*step-500,-.6));
function ground(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*n+ix,a=heights[i],b=heights[i+n],c=heights[i+n+1],d=heights[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const colliders=[],art=createFallsLandscape({THREE:T,scene:new T.Scene(),heightAt:ground,terrainStep:step,waterMaterial:createRiverMaterial({THREE:T,map:null}),colliders,loadTextures:false});
test('the mountain connects the upper catchment to the falls while preserving riding approaches',()=>{
 assert(fallsRelief(-168,-256)>18);assert(fallsRelief(-129,-266)>20);
 for(const [x,z] of [[0,0],[-169,-186],[-138,-204],[-92,-173],[-150,-216],[-160,-215],[-187,-236],[-200,-245],[-250,-275]])assert.equal(fallsTerrainHeight(x,z,3),3);
 assert(art.triangles>1000&&art.triangles<18000);assert(art.shadow.castShadow&&art.rock.receiveShadow);
 for(const o of art.group.children)for(const a of Object.values(o.geometry.attributes))assert([...a.array].every(Number.isFinite));
});
test('rock faces use the exact triangles of the riding surface',()=>{
 art.group.updateMatrixWorld(true);const g=art.rock.geometry,p=g.attributes.position,idx=g.index;let count=0;
 for(let i=0;i<idx.count;i+=Math.max(3,Math.floor(idx.count/100/3)*3)){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],x=ids.reduce((n,j)=>n+p.getX(j),0)/3,z=ids.reduce((n,j)=>n+p.getZ(j),0)/3;
  const hit=new T.Raycaster(new T.Vector3(x,80,z),new T.Vector3(0,-1,0)).intersectObject(art.rock)[0];assert(hit);assert(Math.abs(hit.point.y-ground(x,z)-.012)<.001);count++;
 }assert(count>90);
});
test('source stream and airborne water stay above interpolated terrain',()=>{
 const sheet=createWaterfallArt({THREE:T}).fall({x:F.x,z:F.z,top:F.top,bottom:F.level+.04,width:F.width,run:F.run}).children[0];
 for(const [name,mesh,edge] of [['stream',art.stream,.12],['fall',sheet,.12]]){const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;let clearance=Infinity;
  for(let i=0;i<p.count;i++){const across=name==='stream'?uv.getY(i):uv.getX(i);if(across<edge||across>1-edge)continue;clearance=Math.min(clearance,p.getY(i)-ground(p.getX(i),p.getZ(i)));}
  assert(clearance>.02,`${name} intersects terrain by ${-clearance}m`);
 }
 for(const p of[F.pool,F.tarn]){assert(p.level-ground(p.x,p.z)>.8);assert(fallsContainsWater(p.x,p.z));assert(fallsExcludesDryPlants(p.x,p.z,ground));}
});
test('mountain collisions have finite flight clearance and leave the Frostpine trail open',()=>{
 assert(colliders.length>60&&colliders.length<700);
 for(const c of colliders){assert(Number.isFinite(c.x+c.z+c.topY));assert(c.terrainCliff&&c.landform);assert(c.topY>ground(c.x,c.z)+2);assert(Math.hypot(c.x+150,c.z+222)>7);}
});

test('the northern divide rises behind the source and leaves the settled valley floor untouched',()=>{
 assert(alpineRelief(-194,-348)>35);assert(alpineRelief(-108,-324)>20);
 for(const [x,z] of [[-150,-222],[-147,-284],[-160,-215],[-187,-236],[-214,-253],[-238,-268],[-256,-278],[-292,-326],[-303,-319],[-288,-310],[-280,-328]])assert.equal(alpineRelief(x,z),0);
 for(const [x,z] of [[-164,-345],[-108,-324],[-187,-308]])assert(alpineSnowAt(x,z)>.9);
 for(const [x,z] of [[0,0],[47,-50],[310,300],[-220,130]])assert.equal(alpineSnowAt(x,z),0);
});
