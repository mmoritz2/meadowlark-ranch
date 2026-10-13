import fs from 'node:fs';import {moduleAt,T,sha}from'./pastoral-production-fixture.mjs';
export const nativeFixture=new URL('./fixtures/pastoral-7fbd127/native/',import.meta.url),meta=JSON.parse(fs.readFileSync(new URL('world.json',nativeFixture))),gridBytes=fs.readFileSync(new URL('terrain-grid.f32',nativeFixture));
if(sha(gridBytes)!==meta.gridSHA)throw Error('Actual native current-grid fixture hash drift');
const grid=new Float32Array(gridBytes.buffer,gridBytes.byteOffset,gridBytes.byteLength/4),step=1000/512;
export const terrainH=(x,z)=>{const xx=(x+500)/step,zz=(z+500)/step,ix=Math.floor(xx),iz=Math.floor(zz),fx=xx-ix,fz=zz-iz,i=iz*513+ix,a=grid[i],b=grid[i+513],c=grid[i+514],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);};
const {createChalkDown}=await moduleAt('assets/chalk-down.js');
export const down=createChalkDown({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},site:meta.site,baseHeight:terrainH,groundMaterial:new T.MeshStandardMaterial()});
export const groundH=(x,z)=>Math.max(terrainH(x,z),down.heightAt(x,z));
export const worldOptions={terrainH,riverZ:x=>120+Math.sin(x*.012)*45,riverLevel:x=>.5-x*.009,streamX:z=>118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8,chalkAt:(x,z)=>Number.isFinite(down.heightAt(x,z)),forestPoints:meta.forestPoints};
