import test from 'node:test';
import assert from 'node:assert/strict';
import {createFingerpostBoardData} from '../assets/fingerpost-geometry.mjs';
const ARMS=[['HOLLOWPEAK',-160,-210],['FROSTPINE',-300,-320],['THE RANCH',0,0]];
const create=()=>createFingerpostBoardData({arms:ARMS,x:-157,z:-218});
test('closed boards preserve destinations, heights, directional yaw and physical dimensions',()=>{
 const d=create();assert.equal(d.boards.length,3);assert.equal(d.fasteners.length,12);assert(d.triangles<300);
 for(const[b,i]of d.boards.map((b,i)=>[b,i])){
  assert.equal(b.label,ARMS[i][0]);assert.equal(b.y,2.62-i*.50);assert.equal(b.yaw,Math.atan2(ARMS[i][1]+157,ARMS[i][2]+218));
  let lo=Infinity,hi=-Infinity;
  for(let k=b.indexStart;k<b.indexStart+b.indexCount;k++){
   const v=d.index[k],p=Array.from(d.position.slice(v*3,v*3+3)),w=(p[0]-b.center[0])*b.normal[0]+(p[2]-b.center[2])*b.normal[2];lo=Math.min(lo,w);hi=Math.max(hi,w);
  }
  assert(Math.abs(hi-lo-.07)<2e-7);
 }
});
test('every physical edge is closed and triangle normals face outwards at arbitrary post directions',()=>{
 for(const[x,z]of[[0,0],[-157,-218],[86,177],[260,-270]]){
  const d=createFingerpostBoardData({arms:ARMS,x,z}),edges=new Map(),key=i=>Array.from(d.position.slice(i*3,i*3+3)).map(v=>v.toFixed(5)).join(',');
  for(let i=0;i<d.index.length;i+=3){
   const ids=Array.from(d.index.slice(i,i+3)),p=ids.map(id=>Array.from(d.position.slice(id*3,id*3+3))),a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],n=Array.from(d.normal.slice(ids[0]*3,ids[0]*3+3));
   assert(cross.reduce((s,v,k)=>s+v*n[k],0)>1e-9);
   for(let e=0;e<3;e++){const q=[key(ids[e]),key(ids[(e+1)%3])].sort().join('|');edges.set(q,(edges.get(q)||0)+1);}
  }
  assert([...edges.values()].every(n=>n===2));
 }
});
test('front and reverse lettering have independent forward atlases and continuous metre-scaled grain',()=>{
 const d=create();for(const a of[d.position,d.normal,d.uv,d.grainUv])assert([...a].every(Number.isFinite));
 assert([...d.uv].every(v=>v>=0&&v<=1));
 for(let i=0;i<d.normal.length;i+=3)assert(Math.abs(Math.hypot(...d.normal.slice(i,i+3))-1)<1e-6);
 for(const b of d.boards){for(let k=b.indexStart;k<b.indexStart+b.indexCount;k++){const i=d.index[k],p=Array.from(d.position.slice(i*3,i*3+3)),n=Array.from(d.normal.slice(i*3,i*3+3)),along=p[0]*b.direction[0]+p[2]*b.direction[2],w=(p[0]-b.center[0])*b.normal[0]+(p[2]-b.center[2])*b.normal[2],end=Math.abs(n[0]*b.direction[0]+n[2]*b.direction[2]),up=Math.abs(n[1]),face=Math.abs(n[0]*b.normal[0]+n[2]*b.normal[2]);assert(Math.abs(d.grainUv[i*2]-((end>up+1e-6&&end>face+1e-6?w:along)/d.grainMetres+.15))<5e-7);}}
 for(let k=0;k<d.index.length;k+=3){const[a,b,c]=d.index.slice(k,k+3),u=i=>d.grainUv[i*2],v=i=>d.grainUv[i*2+1];assert(Math.abs((u(b)-u(a))*(v(c)-v(a))-(u(c)-u(a))*(v(b)-v(a)))>1e-10,'Every PBR grain triangle has a nonsingular chart');}
});
test('fingerpost mesh generation has no scene, collision or random side effects',()=>{
 const random=Math.random;Math.random=()=>{throw Error('RNG consumed');};try{const a=create(),b=create();assert.deepEqual(a,b);assert(!('solidParts'in a));}finally{Math.random=random;}
});

test('physical iron straps bridge the post gap and fasteners overlap their supports',()=>{
 const d=create();assert.equal(d.supports.length,d.fasteners.length);
 for(const[s,i]of d.supports.map((s,i)=>[s,i])){
  assert(Math.hypot(s.postContact[0],s.postContact[2])<.065,'Strap enters the existing post');
  const b=d.boards[s.arm],delta=s.boardContact.map((v,k)=>v-s.position[k]),local=[delta[0]*b.direction[0]+delta[2]*b.direction[2],delta[1],delta[0]*b.normal[0]+delta[2]*b.normal[2]];
  assert(local.every((v,k)=>Math.abs(v)<=s.size[k]/2+1e-7),'Strap reaches the board face');
  const f=d.fasteners[i],distance=f.position.map((v,k)=>v-s.position[k]).reduce((n,v,k)=>n+v*f.normal[k],0);
  assert(distance-.015/2<s.size[2]/2&&distance+.015/2>s.size[2]/2,'Bolt crosses the iron surface');
 }
});
