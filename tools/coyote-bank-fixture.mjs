import {legacyRiverBankHeight} from '../assets/riverbank-terrain.mjs?v=river-banks-1';
import fs from 'node:fs';import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as old from './fixtures/coyote-banks-11fb567/assets/canyon-landscape.js';
import {normalizeCoyoteMacroSource} from './coyote-macroform-source-guard.mjs';
const next=await import('data:text/javascript;base64,'+Buffer.from(normalizeCoyoteMacroSource(fs.readFileSync(new URL('../assets/canyon-landscape.js',import.meta.url),'utf8'),'assets/canyon-landscape.js')).toString('base64'));
// Exact804 counterfactual retains the prior West/East bank contract. Actual
// new North/Oasis physics and all source bodies are tested separately.
import {pastureRise} from '../assets/pastoral-fields.mjs';
import {oasisTerrainHeight} from '../assets/oasis-art.js';
import {fallsTerrainHeight} from '../assets/falls-landscape.js';
const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),code=html.slice(html.indexOf('function ihash(ix,iz){'),html.indexOf('/* ===== Roads ====='));
const raw=r=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',code+'return rawH;')(T,pastureRise,r,oasisTerrainHeight,fallsTerrainHeight,legacyRiverBankHeight),oldRaw=raw(old.canyonRelief),newRaw=raw(next.canyonRelief);
const buf=fs.readFileSync(new URL('./fixtures/coyote-banks-11fb567/terrain-grid.f32',import.meta.url)),before=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),after=Float32Array.from(before),n=513,step=1000/512,changed=[];
let maxBaseError=0,maxWholeRawDifference=0,maxDelta=0;const previous=Math.random;Math.random=()=>{throw Error('numeric terrain used scene RNG');};
try{for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const x=ix*step-500,z=iz*step-500,i=iz*n+ix,was=oldRaw(x,z),now=newRaw(x,z);maxWholeRawDifference=Math.max(maxWholeRawDifference,Math.abs(Math.fround(was)-before[i]));if(now!==was){maxBaseError=Math.max(maxBaseError,Math.abs(Math.fround(was)-before[i]));after[i]=now;}if(after[i]!==before[i]){changed.push(i);maxDelta=Math.max(maxDelta,Math.abs(after[i]-before[i]));}}}finally{Math.random=previous;}
function sample(a,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,k=iz*n+ix,h=a[k],b=a[k+n],c=a[k+n+1],d=a[k+1];return fx+fz<=1?h+(d-h)*fx+(b-h)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const sha=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const digest=a=>crypto.createHash('sha256').update(a).digest('hex');
export const fixture={digest,T,old,next,before,after,n,step,changed,oldRaw,newRaw,oldHeight:(x,z)=>sample(before,x,z),height:(x,z)=>sample(after,x,z),maxBaseError,maxWholeRawDifference,maxDelta,sha,routes:JSON.parse(fs.readFileSync(new URL('./fixtures/coyote-banks-11fb567/routes.json',import.meta.url)))};
