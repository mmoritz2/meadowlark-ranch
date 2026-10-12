import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createFallsLandscape,fallsTerrainHeight} from '../assets/falls-landscape.js';
import {hollowpeakRockSurface,applyHollowpeakRockSurface,HOLLOWPEAK_ROCK_GLSL} from '../assets/hollowpeak-rock-surface.mjs';

const args=()=>({THREE:T,scene:new T.Scene(),heightAt:(x,z)=>fallsTerrainHeight(x,z,.7),terrainStep:2,waterMaterial:new T.MeshPhysicalMaterial(),colliders:[],loadTextures:false});

test('the actual shared-terrain vertices distinguish sheltered feet from scoured shoulders without changing cover',()=>{
 const a=createFallsLandscape(args()),field=a.rock.geometry.attributes.rockLandform;
 let feet=0,upper=0,scoured=0,sheltered=0;
 for(let i=0;i<field.count;i++){
  const toe=field.getX(i),scour=field.getY(i);
  assert(Number.isFinite(toe)&&toe>=0&&toe<=1);
  assert(Number.isFinite(scour)&&scour>=0&&scour<=1);
  if(toe>.9)feet++;if(toe<.1)upper++;if(scour>.9)scoured++;if(scour<.1)sheltered++;
 }
 assert(feet>100&&upper>100&&scoured>100&&sheltered>100,'treatment addresses distinct actual landform regions');
 for(const slope of [0,.5,1,3])for(const curvature of [-4,-.5,0,.5,4])for(const relief of [0,3,7,11,35]){
  const dry=hollowpeakRockSurface({slope,curvature,relief,wet:false}),wet=hollowpeakRockSurface({slope,curvature,relief,wet:true});
  assert.equal(wet.toe,0,'wet marble banks never become vegetated foot deposits');
  assert(wet.cover>=.94&&wet.weather===1);
  for(const value of [dry.toe,dry.scoured,wet.scoured])assert(Number.isFinite(value)&&value>=0&&value<=1);
 }
});

test('triplanar detail keeps physical scale and changes no texture binding or sample budget',()=>{
 const material=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()});
 applyHollowpeakRockSurface(material);
 const sh={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 material.onBeforeCompile(sh);
 assert(HOLLOWPEAK_ROCK_GLSL.includes('return p/6.8+'));
 assert.equal((HOLLOWPEAK_ROCK_GLSL.match(/texture2D\(/g)||[]).length,3);
 assert.equal((sh.fragmentShader.match(/texture2D\(normalMap/g)||[]).length,3);
 assert(!sh.fragmentShader.includes('discard;'),'coverage remains continuous on the terrain skin');
 assert(sh.fragmentShader.indexOf('float wetRock=')<sh.fragmentShader.indexOf('float roughnessFactor='));
 assert(sh.fragmentShader.indexOf('float scour=')<sh.fragmentShader.indexOf('vec2 rockDetail='));
 assert(sh.fragmentShader.includes('attribute')===false,'all new landform data is interpolated through varyings');
 assert.equal((sh.fragmentShader.match(/uniform sampler/g)||[]).length,(T.ShaderLib.standard.fragmentShader.match(/uniform sampler/g)||[]).length);
});
