import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as old from './fixtures/hollowpeak-contours-6edee7c/assets/falls-landscape.js';
import * as candidate from '../assets/falls-landscape.js';
const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const {pastureRise}=await import('../assets/pastoral-fields.mjs'),{canyonRelief}=await import('../assets/canyon-landscape.js'),{oasisTerrainHeight}=await import('../assets/oasis-art.js');
const code=html.slice(html.indexOf('function ihash(ix,iz){'),html.indexOf('/* ===== Roads ====='));
const preFalls=new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight',code+'return rawH;')(T,pastureRise,canyonRelief,oasisTerrainHeight,(x,z,h)=>h);
const buf=fs.readFileSync(new URL('./fixtures/hollowpeak-contours-6edee7c/terrain-grid.f32',import.meta.url)),before=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),after=new Float32Array(before),n=513,step=1000/512,delta=new Float64Array(n*n);
let changed=0,maxChange=0,maxBaseError=0,oldReconstructed=0;
const random=Math.random;Math.random=()=>{throw Error('Terrain shaping consumed scene RNG');};
try{for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const x=ix*step-500,z=iz*step-500;if(x<=-274||x>=-32||z<=-414||z>=-214)continue;const i=iz*n+ix,base=preFalls(x,z),was=old.fallsTerrainHeight(x,z,base),now=candidate.fallsTerrainHeight(x,z,base),d=now-was;delta[i]=d;if(d){after[i]=now;changed++;maxChange=Math.max(maxChange,Math.abs(d));}maxBaseError=Math.max(maxBaseError,Math.abs(before[i]-Math.fround(was)));oldReconstructed++;}}
finally{Math.random=random;}
function sample(heights,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*n+ix,a=heights[i],b=heights[i+n],c=heights[i+n+1],d=heights[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
export const fixture={T,old,candidate,before,after,delta,n,step,baseHeight:preFalls,oldHeight:(x,z)=>sample(before,x,z),height:(x,z)=>sample(after,x,z),stats:{changed,maxChange,maxBaseError,oldReconstructed},sha:a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex')};
