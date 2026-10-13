import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createCoursedFieldWallGeometry as create} from '../assets/coursed-field-wall.mjs';

const fixtureBytes=fs.readFileSync(new URL('./fixtures/rubble-field-wall-b1a73b1/actual-units.json',import.meta.url));
assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),'6bcdb527027826d94e02d909e9f1ee864590b924b5ff1b40e794a0a00dc4aa80','Original actual wall-unit fixture is exact');
const fixture=JSON.parse(fixtureBytes),records=fixture.records;
const record=(x,z,yaw)=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:[20,21,22,23,24]});
const synthetic=[0,.3,1.5,2.5,-3].map((yaw,i)=>record(Math.sin(i)*273,Math.cos(i)*238,yaw));
const groundFixtures=[()=>0,(x,z)=>3+x*.14-z*.098,(x,z)=>-3-x*.14+z*.098,(x,z)=>x*.60-z*.42,(x,z)=>x*.17+z*.11+.025*Math.abs(x*.7-z*.3)];
const bytes=d=>['positions','normals','uvs','colors','indices'].reduce((sum,k)=>sum+d[k].byteLength,0);
const point=(d,id)=>Array.from(d.positions.subarray(id*3,id*3+3));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);

function checkTriangles(d){
 assert(d.indices.every(i=>i<d.positions.length/3),'Every index names a resident vertex');
 for(const k of ['positions','normals','uvs','colors'])assert(d[k].every(Number.isFinite),k+' is finite');
 for(let at=0;at<d.indices.length;at+=3){
  const ids=Array.from(d.indices.subarray(at,at+3)),p=ids.map(i=>point(d,i));
  const N=cross(sub(p[1],p[0]),sub(p[2],p[0])),area=Math.hypot(...N);
  assert(area>1e-7,'No real stone face triangle is collapsed');
  for(const id of ids){const n=Array.from(d.normals.subarray(id*3,id*3+3));assert(Math.abs(Math.hypot(...n)-1)<1e-6,'Normals are unit length');assert(dot(N,n)>area*.999,'Every actual Float32 triangle agrees with its own outward normal');}
 }
}
function checkClosedStones(d){
 for(const unit of d.units){
  assert.equal(unit.indexCount,23*72,'Every unit owns all23 closed stones');
  for(let stone=0;stone<23;stone++){
   const start=unit.indexStart+stone*72,unique=new Map(),edges=new Map();
   const vertices=Array.from({length:72},(_,i)=>point(d,d.indices[start+i]));
   const centre=vertices.reduce((a,p)=>a.map((v,i)=>v+p[i]/72),[0,0,0]);let volume=0;
   for(let at=start;at<start+72;at+=3){
    const ps=Array.from(d.indices.subarray(at,at+3)).map(i=>point(d,i)),N=cross(sub(ps[1],ps[0]),sub(ps[2],ps[0]));
    assert(dot(N,sub(ps[0],centre))>0,'All faces point away from their own stone interior');
    const ids=ps.map(p=>{const key=p.join(',');if(!unique.has(key))unique.set(key,unique.size);return unique.get(key);});
    for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=edges.get(key)||{count:0,signed:0};e.count++;e.signed+=a<b?1:-1;edges.set(key,e);}
    volume+=dot(sub(ps[0],centre),cross(sub(ps[1],centre),sub(ps[2],centre)))/6;
   }
   assert.equal(unique.size,14);assert.equal(edges.size,36);assert([...edges.values()].every(e=>e.count===2&&e.signed===0),'Every welded edge has exactly two opposite faces');
   assert.equal(unique.size-edges.size+24,2,'Each stone has spherical closed topology');assert(volume>1e-6,'Every closed stone has positive physical volume');
  }
 }
}

// These gates import the actual runtime factory. Old creased-slab shape tests
// remain historical; the actual installer/lifecycle/collision tests stay live.
test('original actual163 wall records retain root, basis, legacy ownership and exact measured new budget',()=>{
 assert.equal(records.length,163);assert.equal(fixture.nativeOwner,'worldPaths:coursedFieldWalls');const before=structuredClone(records),d=create(records,()=>0);
 assert.deepEqual(records,before);assert.equal(d.units.length,163);assert.equal(d.triangles,89976);assert.equal(d.positions.length/3,269928);assert.equal(bytes(d),12956544);
 for(let i=0;i<records.length;i++){
  const r=records[i],u=d.units[i];for(const k of ['x','z','tx','tz','nx','nz','legacyRows'])assert.deepEqual(u[k],r[k],k+' owner is preserved');
  assert.equal(u.visible,true);assert.equal(u.halfLength,.575);assert.equal(u.halfDepth,.35);assert.equal(u.maxHeight,.952);
  assert.equal(u.indexStart,i*1656);assert.equal(u.indexCount,1656);assert.equal(u.triangles,552);
  assert.deepEqual(u.legacyRows,r.legacyRows,'Course-clear row identity stays authored');
 }
});

test('all actual163 wall solids are closed, outward, positive-volume and finite',()=>{
 const d=create(records,(x,z)=>x*.14-z*.098);checkTriangles(d);checkClosedStones(d);
});

test('arbitrary yaw, both grades, steep grade and a ground crease retain finite physical faces and original collision envelope',()=>{
 for(const ground of groundFixtures){
  const d=create(synthetic,ground);checkTriangles(d);checkClosedStones(d);
  for(let j=0;j<synthetic.length;j++){
   const r=synthetic[j],u=d.units[j];let low=Infinity,high=-Infinity;
   for(let at=u.indexStart;at<u.indexStart+u.indexCount;at++){
    const [x,y,z]=point(d,d.indices[at]),dx=x-r.x,dz=z-r.z,h=y-ground(x,z);
    assert(Math.abs(dx*r.tx+dz*r.tz)<=.57504,'Every actual face stays within the old end caps');assert(Math.abs(dx*r.nx+dz*r.nz)<=.35004,'No rendered shoulder escapes the old collision width');
    assert(h>=-.059&&h<=.95204,'A shallow buried foundation and source top height bound every corner');low=Math.min(low,h);high=Math.max(high,h);
   }
   assert(low<-.050&&high>.87,'The complete foundation and full wall height are still present');
  }
 }
});

test('complete stone bearings follow the local ground while their relative profile stays unchanged across positive and negative grade',()=>{
 const r=record(0,0,.73),flat=create([r],()=>0);
 for(const ground of groundFixtures.slice(1)){
  const d=create([r],ground);assert.deepEqual(d.indices,flat.indices,'Ground grade changes no topology or owning index spans');
  for(let id=0;id<d.positions.length/3;id++){
   const [x,y,z]=point(d,id),[fx,fy,fz]=point(flat,id);assert.equal(x,fx);assert.equal(z,fz);assert(Math.abs(y-ground(x,z)-fy)<3e-5,'Per-corner drape prevents the old full-unit height staircase');
  }
 }
});

test('actual factory is deterministic, consumes zero RNG and never mutates authored source records',()=>{
 const rows=[...records.slice(0,4),...synthetic],snapshot=structuredClone(rows),rng=Math.random;let calls=0,d;
 Math.random=()=>{calls++;throw Error('Unexpected wall placement RNG');};
 try{d=create(rows,(x,z)=>x*.12-z*.09);}finally{Math.random=rng;}
 assert.equal(calls,0);assert.deepEqual(rows,snapshot);assert.deepEqual(d,create(rows,(x,z)=>x*.12-z*.09));
 const empty=create([],()=>{throw Error('Empty input has no footing samples');});assert.equal(empty.triangles,0);assert.equal(bytes(empty),0);assert.deepEqual(empty.units,[]);
});

test('invalid actual record coordinates and bases fail before producing invalid geometry',()=>{
 const r=records[0];for(const key of ['x','z','tx','tz','nx','nz'])for(const value of [NaN,Infinity,-Infinity,undefined,'invalid']){
  const bad={...r,[key]:value};assert.throws(()=>create([bad],()=>0),/Invalid field wall record/);assert.deepEqual(bad,{...r,[key]:value});
 }
 assert.throws(()=>create([{...r,tx:0,tz:0,nx:0,nz:0}],()=>0),/Degenerate rubble stone/,'A collapsed finite basis never emits invalid triangles');
});

test('invalid or failed footing callbacks cannot emit NaN geometry or alter owned source records',()=>{
 const rows=[structuredClone(records[0])],snapshot=structuredClone(rows);
 for(const invalid of [NaN,Infinity,-Infinity,undefined,'invalid'])assert.throws(()=>create(rows,()=>invalid),/Invalid rubble wall footing/);
 const sentinel=new Error('Authored ground unavailable');assert.throws(()=>create(rows,()=>{throw sentinel;}),error=>error===sentinel,'The real footing error propagates without fallback placement');
 assert.deepEqual(rows,snapshot);checkTriangles(create(rows,()=>0));
});
