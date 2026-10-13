import fs from 'node:fs';import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as old from './fixtures/coyote-macro-8042555/canyon-landscape.js';
import * as next from '../assets/canyon-landscape.js';
import {pastureRise} from '../assets/pastoral-fields.mjs';
import {oasisTerrainHeight} from '../assets/oasis-art.js';
import {fallsTerrainHeight} from '../assets/falls-landscape.js';
import {legacyRiverBankHeight,riverBankTerrainHeight,configureRiverBanks} from '../assets/riverbank-terrain.mjs?v=river-banks-1';
const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),code=html.slice(html.indexOf('function ihash(ix,iz){'),html.indexOf('/* ===== Roads ====='));
const raw=(r,river=riverBankTerrainHeight)=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',code+'return rawH;')(T,pastureRise,r,oasisTerrainHeight,fallsTerrainHeight,river);
const legacyRaw=raw(old.canyonRelief,legacyRiverBankHeight);
const riverReference=configureRiverBanks({rawHeightAt:legacyRaw,heightAt:(x,z)=>oldRaw(x,z),terrainStep:1000/512});
const oldRaw=raw(old.canyonRelief),newRaw=raw(next.canyonRelief),planningRaw=raw(next.canyonPlanningRelief,legacyRiverBankHeight),macroPlanningRaw=raw(next.canyonMacroPlanningRelief);
const buf=fs.readFileSync(new URL('./fixtures/coyote-macro-8042555/terrain-grid.f32',import.meta.url)),before=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),after=Float32Array.from(before),n=513,step=1000/512,changed=[];
let maxBaseError=0,maxDelta=0,maxWholeRawDifference=0;const random=Math.random;Math.random=()=>{throw Error('Numeric macro height used scene RNG');};
try{for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const x=ix*step-500,z=iz*step-500,i=iz*n+ix,was=oldRaw(x,z),now=newRaw(x,z);maxWholeRawDifference=Math.max(maxWholeRawDifference,Math.abs(Math.fround(was)-before[i]));if(now!==was){maxBaseError=Math.max(maxBaseError,Math.abs(Math.fround(was)-before[i]));after[i]=now;}if(after[i]!==before[i]){changed.push(i);maxDelta=Math.max(maxDelta,Math.abs(after[i]-before[i]));}}}finally{Math.random=random;}
function sample(a,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,k=iz*n+ix,A=a[k],B=a[k+n],C=a[k+n+1],D=a[k+1];return fx+fz<=1?A+(D-A)*fx+(B-A)*fz:C+(B-C)*(1-fx)+(D-C)*(1-fz);}
const sha=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const digest=a=>crypto.createHash('sha256').update(a).digest('hex');
export const fixture={T,old,next,before,after,n,step,changed,oldRaw,newRaw,riverReference,planningRaw,macroPlanningRaw,maxBaseError,maxDelta,maxWholeRawDifference,oldHeight:(x,z)=>sample(before,x,z),height:(x,z)=>sample(after,x,z),sha,digest,routes:JSON.parse(fs.readFileSync(new URL('./fixtures/coyote-macro-8042555/routes.json',import.meta.url)))};
