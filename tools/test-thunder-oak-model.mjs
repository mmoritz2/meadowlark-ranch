import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import(threeURL),{createThunderOakGeometry}=await import('../assets/thunder-oak-art.js');
const flat=createThunderOakGeometry(T),slope=createThunderOakGeometry(T,(x,z)=>.15*x-.09*z);
const keys=['bark','heart','leaves','farLeaves'];
const near=(a,b,t=1e-5)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);

test('weathered oak surfaces remain finite, nondegenerate and normal-consistent on flat/sloping ground',()=>{
 const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),N=new T.Vector3(),M=new T.Vector3();
 for(const tree of[flat,slope])for(const key of keys){const g=tree[key],p=g.attributes.position,n=g.attributes.normal;
  for(const attr of Object.values(g.attributes))assert(Array.from(attr.array).every(Number.isFinite));
  for(let i=0;i<n.count;i++)near(M.fromBufferAttribute(n,i).length(),1);
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));A.fromBufferAttribute(p,ids[0]);B.fromBufferAttribute(p,ids[1]);C.fromBufferAttribute(p,ids[2]);A.crossVectors(B.sub(A),C.sub(A));assert(A.length()>1e-9,'nondegenerate triangle');N.set(0,0,0);for(const j of ids)N.add(M.fromBufferAttribute(n,j));assert(A.dot(N)>0,'winding agrees with normals');}
 }
});

test('two torn split faces remain closed to their bark edges',()=>{
 for(const tree of[flat,slope])for(let side=0;side<2;side++)for(let k=0;k<47;k++)for(const j of[0,1]){
  const a=side*47*26+k*26+j*25,b=side*(47*11+36)+k*11+j*10;
  const x=new T.Vector3().fromBufferAttribute(tree.bark.attributes.position,a),y=new T.Vector3().fromBufferAttribute(tree.heart.attributes.position,b);assert(x.distanceTo(y)<1e-6);
 }
});

test('terrain fit is applied to original low wood without moving roots horizontally',()=>{
 const a=flat.bark.attributes.position,b=slope.bark.attributes.position;let fitted=0;
 const smooth=v=>{const t=Math.max(0,Math.min(1,(v-.05)/1.10));return t*t*(3-2*t);};
 for(let i=0;i<a.count;i++)if(a.getY(i)<1.15){
  near(a.getX(i),b.getX(i));near(a.getZ(i),b.getZ(i));
  near(b.getY(i),a.getY(i)+(.15*a.getX(i)-.09*a.getZ(i))*(1-smooth(a.getY(i))),2e-6);fitted++;
 }
 assert(fitted>1000);
 for(const proxy of slope.proxies){assert([...proxy.min,...proxy.max,...proxy.matrix].every(Number.isFinite));assert(proxy.max.every((v,i)=>v>=proxy.min[i]));}
});

test('near/far leaves share crown positions, normal/wind data and the existing submission budget',()=>{
 assert.deepEqual(flat.leaves.attributes.position.array,flat.farLeaves.attributes.position.array);
 assert.deepEqual(flat.leaves.attributes.normal.array,flat.farLeaves.attributes.normal.array);
 assert.deepEqual(flat.leaves.attributes.oakFlex.array,flat.farLeaves.attributes.oakFlex.array);
 assert.equal(flat.stats.leaves,2700);assert.equal(flat.stats.woodTriangles,29376);
 assert.equal(flat.stats.leafTriangles,48600);assert.equal(flat.stats.farLeafTriangles,21600);
 assert(flat.bark.boundingBox.max.y<14&&flat.bark.boundingBox.max.y>12);
 const first=createThunderOakGeometry(T);assert.deepEqual(flat.bark.attributes.position.array,first.bark.attributes.position.array);assert.deepEqual(flat.proxies,first.proxies);
});

test('late model construction retains the historic1048 global RNG draws',()=>{
 const original=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};
 try{createThunderOakGeometry(T);assert.equal(calls,1048);}finally{Math.random=original;}
});
