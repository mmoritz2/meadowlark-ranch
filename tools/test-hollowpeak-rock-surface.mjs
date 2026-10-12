import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {hollowpeakRockSurface,applyHollowpeakRockSurface} from '../assets/hollowpeak-rock-surface.mjs';
import {createFallsLandscape,fallsTerrainHeight,HOLLOWPEAK} from '../assets/falls-landscape.js';

test('rock exposure stays finite and bounded, follows slope, and preserves wet rock',()=>{
 for(const curvature of [-3,-.7,0,.65,3])for(const relief of [0,.1,.7,4,40]) {
  let previous=0;
  for(let slope=0;slope<=6;slope+=.025){const a=hollowpeakRockSurface({slope,curvature,relief,wet:false});assert(a.cover>=0&&a.cover<=1&&Number.isFinite(a.cover));assert(a.cover>=previous-1e-12);assert(a.weather>=0&&a.weather<=1);previous=a.cover;}
 }
 assert.equal(hollowpeakRockSurface({slope:.05,curvature:-.5,relief:20,wet:false}).cover,0,'gentle cold shelf reveals the existing ground');
 assert.equal(hollowpeakRockSurface({slope:1.2,curvature:.5,relief:20,wet:false}).cover,1,'steep scoured wall remains stone');
 assert.equal(hollowpeakRockSurface({slope:0,curvature:0,relief:0,wet:false}).cover,0,'no invented rock outside support');
 assert(hollowpeakRockSurface({slope:0,curvature:0,relief:0,wet:true}).cover>=.94,'water-bank coverage is retained');
 assert(hollowpeakRockSurface({slope:.5,curvature:.5,relief:20,wet:false}).cover>hollowpeakRockSurface({slope:.5,curvature:-.5,relief:20,wet:false}).cover,'convex shoulders scour before sheltered shelves');
});

test('exposure response is continuous across its thresholds',()=>{
 for(let slope=0;slope<1.5;slope+=.017)for(let c=-1;c<1;c+=.073){const a=hollowpeakRockSurface({slope,curvature:c,relief:2,wet:false}),b=hollowpeakRockSurface({slope:slope+1e-5,curvature:c+1e-5,relief:2,wet:false});assert(Math.abs(a.cover-b.cover)<.0001);assert(Math.abs(a.weather-b.weather)<.0001);}
});

test('actual surface vertices stay on the shared terrain and only valid faces are submitted',()=>{
 const heightAt=(x,z)=>fallsTerrainHeight(x,z,.7),scene=new T.Scene(),colliders=[];
 const a=createFallsLandscape({THREE:T,scene,heightAt,terrainStep:2,waterMaterial:new T.MeshPhysicalMaterial(),colliders,loadTextures:false});
 const g=a.rock.geometry,p=g.attributes.position,n=g.attributes.normal;
 for(let i=0;i<p.count;i++){assert(Math.abs(p.getY(i)-heightAt(p.getX(i),p.getZ(i))-.012)<.00001);assert(Number.isFinite(g.attributes.rockWeather.getX(i)));}
 for(const i of new Set(g.index.array)){assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);}
 const a0=new T.Vector3(),a1=new T.Vector3(),a2=new T.Vector3();for(let i=0;i<g.index.count;i+=3){a0.fromBufferAttribute(p,g.index.getX(i));a1.fromBufferAttribute(p,g.index.getX(i+1));a2.fromBufferAttribute(p,g.index.getX(i+2));assert(a1.sub(a0).cross(a2.sub(a0)).y>0,'rock triangle follows upward terrain winding');}
 assert.equal(a.rock.castShadow,false);assert.equal(a.shadow.castShadow,true);assert.equal(a.waters.length,3);
 assert.equal(a.pool.geometry.attributes.position.getY(0),Math.fround(HOLLOWPEAK.pool.level));assert.equal(a.tarn.geometry.attributes.position.getY(0),Math.fround(HOLLOWPEAK.tarn.level));
 assert.equal(a.rock.material.depthWrite,false);assert.equal(a.rock.material.polygonOffset,true);
});

test('shader uses matched triplanar channels, derivative normal frames and shared ARM',()=>{
 const m=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()});applyHollowpeakRockSurface(m);
 const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);
 assert(s.vertexShader.includes('mountainWeather=rockWeather'));
 for(const source of ['hollowRockTri(map)','hollowRockTri(roughnessMap)','dFdx(rockWorld)','dFdy(rockWorld)','dFdx(uv)','dFdy(uv)','hollowRockARM.r','hollowRockARM.g'])assert(s.fragmentShader.includes(source));
 assert.equal((s.fragmentShader.match(/uniform sampler/g)||[]).length,(T.ShaderLib.standard.fragmentShader.match(/uniform sampler/g)||[]).length,'no additional texture bindings');
 assert(s.fragmentShader.includes('n*max(mapN.z,.08)'),'unperturbed normal map keeps the actual geometric normal');
 assert(s.fragmentShader.includes('diffuseColor.a*=mountainCover'));
 assert(s.fragmentShader.includes('rockColour.rgb=mix(vec3(mineralValue),rockColour.rgb,.42)'),'photographed chroma is retained rather than replaced with gray');
 assert.equal(m.customProgramCacheKey(),'hollowpeak-rock-surface-2');
});
