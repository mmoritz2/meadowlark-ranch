import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import {loadHollowpeakCohortPayload} from '../assets/hollowpeak-cohort-payload.mjs';
import {createShoreContact,GRID} from '../assets/canonical-water-fit.mjs';
import {createShoreContact as legacy} from './fixtures/hollowpeak-shore-contact-legacy.mjs';

const packet=await readFile(new URL('../assets/hollowpeak-cohort-1.bin',import.meta.url));
const payload=await loadHollowpeakCohortPayload({cryptoImpl:webcrypto,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>packet.buffer.slice(packet.byteOffset,packet.byteOffset+packet.byteLength)})});
const g=payload.shoreGeometry,p=g.position,I=g.index,S=GRID.step;
const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const compare=(a,b,x,z)=>assert(Object.is(a(x,z),b(x,z)),`exact support at ${x},${z}: ${a(x,z)} vs ${b(x,z)}`);
const saved=Object.fromEntries(Object.entries(g).map(([k,a])=>[k,hash(a)]));
const next=(x,d)=>{if(!Number.isFinite(x))return x;const a=new Float64Array([x]),u=new BigUint64Array(a.buffer);if(x===0)return d>0?Number.MIN_VALUE:-Number.MIN_VALUE;u[0]+=(x>0)===(d>0)?1n:-1n;return a[0];};

test('authenticated actual shore retains exact results on every face and its edge neighborhood',t=>{
 const a=legacy(g),b=createShoreContact(g);let samples=0;
 const W=[[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5],[.13,.29,.58]];
 for(let f=0;f<I.length;f+=3){
  const ids=[I[f]*3,I[f+1]*3,I[f+2]*3];
  for(const w of W){const x=w.reduce((v,k,i)=>v+k*p[ids[i]],0),z=w.reduce((v,k,i)=>v+k*p[ids[i]+2],0);compare(a,b,x,z);samples++;}
  const x=(p[ids[0]]+p[ids[1]])/2,z=(p[ids[0]+2]+p[ids[1]+2])/2;
  for(const e of [-1e-7,-1e-11,1e-11,1e-7]){compare(a,b,x+e,z-e);samples++;}
 }
 assert.equal(I.length/3,6352);for(const[k,v]of Object.entries(g))assert.equal(hash(v),saved[k]);t.diagnostic(JSON.stringify({actualTriangles:I.length/3,exactSamples:samples}));
});

test('owner-grid boundaries, one-ULP neighbors, query epsilon and outside grid remain exact',t=>{
 const a=legacy(g),b=createShoreContact(g),cells=new Set();let samples=0;
 for(let f=0;f<I.length/3;f++)cells.add(g.owners[f*3]+','+g.owners[f*3+1]);
 const E=[-S*1.0001e-9,-S*.9999e-9,-1e-12,0,1e-12,S*.9999e-9,S*1.0001e-9];
 for(const c of cells){const[ix,iz]=c.split(',').map(Number),x=ix*S-500,z=iz*S-500;
  for(const e of E)for(const d of E){compare(a,b,x+e,z+d);samples++;}
  for(const X of [next(x,-1),x,next(x,1)])for(const Z of [next(z,-1),z,next(z,1)]){compare(a,b,X,Z);samples++;}
 }
 for(let i=0;i<=128;i++)for(let j=0;j<=128;j++){compare(a,b,-280+i*2,-420+j*2);samples++;}
 for(const x of [-Infinity,-1e10,-500,-0,0,500,1e10,Infinity,NaN])for(const z of [-Infinity,-500,0,500,Infinity,NaN])compare(a,b,x,z);
 t.diagnostic(JSON.stringify({ownerCells:cells.size,exactSamples:samples}));
});

function synthetic(){const X=-500+200*S,Z=-500+200*S;return{position:new Float32Array([X,1,Z,X+S,2,Z,X,3,Z+S,X,5,Z,X+S,6,Z,X,7,Z+S,X,9,Z,X,9,Z,X,9,Z]),index:new Uint32Array([0,1,2,5,4,3,6,7,8]),owners:new Uint16Array([200,200,0,200,200,0,200,200,0])};}

test('overlap order, opposite winding, degenerate faces and metadata preserve the original contract',()=>{
 const g=synthetic(),a=legacy(g),b=createShoreContact(g),X=g.position[0],Z=g.position[2];
 for(let i=-2;i<=12;i++)for(let j=-2;j<=12;j++)compare(a,b,X+S*i/10,Z+S*j/10);
 assert(Number.isFinite(b(X+.2,Z+.2)));assert.equal(b.profile,a.profile);assert.equal(b.registered,a.registered);assert.equal(b.physicalAdmissionAccepted,a.physicalAdmissionAccepted);
});

test('live positions and indices retain updates without a support-height snapshot',()=>{
 const g=synthetic(),a=legacy(g),b=createShoreContact(g),X=g.position[0]+.2,Z=g.position[2]+.2,old=b(X,Z);
 for(let i=1;i<g.position.length;i+=3)g.position[i]+=2;assert.notEqual(b(X,Z),old);compare(a,b,X,Z);
 [g.index[0],g.index[2]]=[g.index[2],g.index[0]];compare(a,b,X,Z);
 g.index[3]=g.index[4]=g.index[5]=0;compare(a,b,X,Z);g.position[1]=NaN;compare(a,b,X,Z);
});

test('construction and queries do not consume world randomness or change input buffers',()=>{
 const old=Math.random;Math.random=()=>{throw Error('No world RNG');};try{const b=createShoreContact(g);for(let i=0;i<40;i++)b(-151+i/20,-232+i/20);}finally{Math.random=old;}
 for(const[k,v]of Object.entries(g))assert.equal(hash(v),saved[k]);
});
