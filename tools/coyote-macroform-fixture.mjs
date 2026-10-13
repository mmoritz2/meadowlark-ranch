import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as old from './fixtures/coyote-macro-8042555/canyon-landscape.js';
import * as next from '../assets/canyon-landscape.js';
import {pastureRise} from '../assets/pastoral-fields.mjs';
import {oasisTerrainHeight} from '../assets/oasis-art.js';
import {fallsTerrainHeight} from '../assets/falls-landscape.js';
import {configureRiverBanks,riverBankTerrainHeight,legacyRiverBankHeight} from '../assets/riverbank-terrain.mjs?v=river-banks-1';
const fixture=new URL('./fixtures/coyote-8042555/',import.meta.url),contract=JSON.parse(fs.readFileSync(new URL('source.json',fixture))),buf=fs.readFileSync(new URL('../coyote-macro-8042555/terrain-grid.f32',fixture));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),arraySHA=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));assert.equal(sha(buf),contract.gridSHA256);
const before=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),after=before.slice(),n=513,step=1000/512,oldRaw=new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',contract.snippets.rawTerrain+'return rawH;')(T,pastureRise,old.canyonRelief,oasisTerrainHeight,fallsTerrainHeight,riverBankTerrainHeight),newRaw=new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',contract.snippets.rawTerrain+'return rawH;')(T,pastureRise,next.canyonRelief,oasisTerrainHeight,fallsTerrainHeight,riverBankTerrainHeight);
configureRiverBanks({terrainStep:step,rawHeightAt:(x,z)=>oldRaw(x,z,fallsTerrainHeight,old.canyonRelief,legacyRiverBankHeight),heightAt:(x,z)=>oldHeight(x,z)});
const changed=[];let maxBaseError=0,maxDelta=0;
const noRNG=fn=>{const previous=Math.random;Math.random=()=>assert.fail('Numeric macroform/decision ground consumed gameplay or renderer RNG');try{return fn();}finally{Math.random=previous;}};
noRNG(()=>{for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const i=iz*n+ix,x=ix*step-500,z=iz*step-500,a=oldRaw(x,z),b=newRaw(x,z);if(a!==b){maxBaseError=Math.max(maxBaseError,Math.abs(Math.fround(a)-before[i]));assert.equal(Math.fround(a),before[i],'Actual original contact grid and old source agree at every changed cell');after[i]=b;}if(before[i]!==after[i]){changed.push(i);maxDelta=Math.max(maxDelta,Math.abs(before[i]-after[i]));}}});
function sample(a,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,k=iz*n+ix,A=a[k],B=a[k+n],C=a[k+n+1],D=a[k+1];return fx+fz<=1?A+(D-A)*fx+(B-A)*fz:C+(B-C)*(1-fx)+(D-C)*(1-fz);}
const oldHeight=(x,z)=>sample(before,x,z),height=(x,z)=>sample(after,x,z),oldPlan=old.createCanyonPlacementPlan({terrainStep:step,rawHeightAt:(x,z)=>oldRaw(x,z,fallsTerrainHeight,old.canyonPlanningRelief,legacyRiverBankHeight),heightAt:oldHeight}),plan=noRNG(()=>next.createCanyonPlacementPlan({terrainStep:step,rawHeightAt:(x,z)=>newRaw(x,z,fallsTerrainHeight,next.canyonPlanningRelief,legacyRiverBankHeight),macroRawHeightAt:(x,z)=>newRaw(x,z,fallsTerrainHeight,next.canyonMacroPlanningRelief),heightAt:height}));
export {T,old,next,contract,fixture,oldRaw,newRaw,before,after,n,step,changed,maxBaseError,maxDelta,noRNG,arraySHA,sha,oldHeight,height,oldPlan,plan};
