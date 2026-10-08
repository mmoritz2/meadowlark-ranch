// CPU model review against exact fcdfbd4 source receipts; no renderer or writes.
// Run: node --test tools/test-lupin-model.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {ORIGINAL,PROTOTYPE,REJECTED_PROTOTYPE,LUPIN_SOURCE_PINS,lupinConstructorSource,restoreLupinModelSource} from './fixtures/lupin-model-source.mjs';
const ROOT=process.env.QA_LUPIN_ROOT||dirname(dirname(fileURLToPath(import.meta.url)));
const PIN_MODULE=LUPIN_SOURCE_PINS.module,PIN_HTML=LUPIN_SOURCE_PINS.html;
const OLD_QUERY='./assets/meadow-cover.js?v=west-meadow-sward-1',NEW_QUERY='./assets/meadow-cover.js?v=lupin-cups-2';

const hash=s=>createHash('sha256').update(s).digest('hex');
const file=join(ROOT,'assets/meadow-cover.js'),source=readFileSync(file,'utf8'),html=readFileSync(join(ROOT,'ranch3d.html'),'utf8');
// Explicit ignored-prototype mode evaluates v2 in memory while the visually
// rejected v1 remains frozen for native capture. Default validates actual v2.
const draft=process.env.QA_LUPIN_V2_DRAFT==='1';
const declaredSource=draft?source.replace(REJECTED_PROTOTYPE,PROTOTYPE):source;
assert.equal(lupinConstructorSource(declaredSource),PROTOTYPE,'Actual v2 constructor required unless explicit prototype mode');
const baseline=restoreLupinModelSource(declaredSource),active=baseline.replace(ORIGINAL,PROTOTYPE);
assert.equal(hash(baseline),PIN_MODULE,'Restoring only the function must recover pinned module bytes');
const declaredHtml=draft?html.replace('./assets/meadow-cover.js?v=lupin-cups-1',NEW_QUERY):html;
assert.equal(declaredHtml.split(NEW_QUERY).length,2,'Actual v2 query required unless explicit prototype mode');
const baselineHtml=declaredHtml.replace(NEW_QUERY,OLD_QUERY);
assert.equal(hash(baselineHtml),PIN_HTML,'Restoring only the import query must recover pinned HTML bytes');
assert.equal(baselineHtml.split(OLD_QUERY).length,2);
const activeHtml=baselineHtml.replace(OLD_QUERY,NEW_QUERY);
const T=await import(pathToFileURL(join(ROOT,'assets/vendor/three/build/three.module.js')).href);
const load=async s=>{
 const resolved=s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_m,_q,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(file)).href));
 return import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
};
const old=await load(baseline),candidate=await load(active),rejected=await load(baseline.replace(ORIGINAL,REJECTED_PROTOTYPE));
function make(module){
 const previous=Math.random,stats={geometry:0,floatAttributes:0,color:0,random:0};
 Math.random=()=>{stats.random++;return .375;};
 const forbidden=class{constructor(){throw Error('Lupin must not create texture/material/scene resources');}};
 const cpu={...T,BufferGeometry:class extends T.BufferGeometry{constructor(...a){super(...a);stats.geometry++;}},
  Float32BufferAttribute:class extends T.Float32BufferAttribute{constructor(...a){super(...a);stats.floatAttributes++;}},
  Color:class extends T.Color{constructor(...a){super(...a);stats.color++;}},
  Texture:forbidden,TextureLoader:forbidden,Mesh:forbidden,InstancedMesh:forbidden,MeshStandardMaterial:forbidden,MeshPhysicalMaterial:forbidden};
 try{return {geometry:module.createLupinGeometry(cpu),stats};}finally{Math.random=previous;}
}
const a=make(old),b=make(candidate),oldg=a.geometry,g=b.geometry;
const at=(attribute,i)=>new T.Vector3().fromBufferAttribute(attribute,i),near=(x,y,e=1e-7)=>assert(Math.abs(x-y)<=e,x+' differs from '+y);
const vectorNear=(x,y,e=2e-7)=>assert(x.distanceTo(y)<=e,JSON.stringify(x.toArray())+' differs from '+JSON.stringify(y.toArray()));
const vec=(x,y,z)=>new T.Vector3(x,y,z);
const rim=[[0,-1],[Math.sqrt(3)/2,-.5],[Math.sqrt(3)/2,.5],[0,1],[-Math.sqrt(3)/2,.5],[-Math.sqrt(3)/2,-.5]];
const triangles=geometry=>Array.from({length:geometry.index.count/3},(_,i)=>new T.Triangle(...[0,1,2].map(k=>at(geometry.attributes.position,geometry.index.array[i*3+k]))));
const faces=triangles(g),stemFaces=triangles(oldg).slice(0,10);
function surface(f){
 const ring=Math.floor(f/3),flower=f%3,t=ring/9,angle=ring*1.23+flower*Math.PI*2/3,scale=1-t*.72,pitch=.28;
 const c=Math.cos(angle),s=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch),width=.053*scale,height=.042*scale,depth=.008*scale,radial=.045*scale,y=.33+t*.44;
 const sector=2*Math.PI/5,sectorOffset=((angle%sector)+sector)%sector-sector/2,shape=Math.cos(Math.PI/5)/Math.cos(sectorOffset),taper=.008/.78;
 const reach=(radial-height*sp+depth*cp-.012*shape+shape*taper*(y+height*cp+depth*sp))/(cp+shape*taper*sp);
 const rootY=y+height*cp+(depth-reach)*sp;
 const S=vec(s,0,-c),V=vec(-c*sp,cp,-s*sp),N=vec(c*cp,sp,s*cp),origin=vec(.028*rootY/.78+c*radial,y,s*radial);
 // Independent numerical differentiation of positions, not copied normal algebra.
 const point=(u,v)=>origin.clone().addScaledVector(S,u).addScaledVector(V,v).addScaledVector(N,depth*((u/width)**2+(v/height)**2)-reach*(v/height));
 const normal=(u,v)=>{
  const e=1e-6,du=point(u+e,v).sub(point(u-e,v)).multiplyScalar(1/(2*e)),dv=point(u,v+e).sub(point(u,v-e)).multiplyScalar(1/(2*e));
  return du.cross(dv).normalize();
 };
 return {point,normal,width,height,N,S,V};
}
const bytes=geometry=>Object.values(geometry.attributes).reduce((sum,x)=>sum+x.array.byteLength,0)+geometry.index.array.byteLength;

test('strict restoration changes only the constructor and one HTML module query',()=>{
 assert.equal(active.replace(PROTOTYPE,ORIGINAL),baseline);
 assert.equal(activeHtml.replace(NEW_QUERY,OLD_QUERY),baselineHtml);
 assert.equal(hash(baseline),PIN_MODULE);assert.equal(hash(baselineHtml),PIN_HTML);
 for(const name of ['createGrassTuftGeometry','meadowGrowthAt','meadowBladeColor','createMeadowDistance'])assert.equal(candidate[name].toString(),old[name].toString());
});

test('one geometry, original attributes, RNG and constructor resources; 200 triangles with less memory',()=>{
 assert.deepEqual(a.stats,b.stats);assert.equal(b.stats.geometry,1);assert.equal(b.stats.color,1);assert.equal(b.stats.random,4);
 assert.deepEqual(Object.keys(g.attributes),Object.keys(oldg.attributes));
 assert.equal(g.attributes.position.count,265);assert.equal(g.index.count/3,200);assert.equal(g.index.array.constructor,Uint16Array);
 assert.equal(bytes(oldg),15276);assert.equal(bytes(g),10740);assert.equal(g.userData&&Object.keys(g.userData).length,0);
 for(const x of Object.values(g.attributes))assert([...x.array].every(Number.isFinite));
 assert([...g.index.array].every(i=>i>=0&&i<g.attributes.position.count));
});

test('stalk and fourteen leaf quads retain every vertex/color/normal/index exactly',()=>{
 for(const k of ['position','color','normal'])assert.deepEqual([...g.attributes[k].array.slice(0,76*3)],[...oldg.attributes[k].array.slice(0,76*3)]);
 assert.deepEqual([...g.index.array.slice(0,38*3)],[...oldg.index.array.slice(0,38*3)]);
 assert.equal(faces.slice(0,38).length,38);
});

test('twenty-seven connected six-triangle cup fans have consistent outward winding and no degeneracy',()=>{
 for(let f=0;f<27;f++){
  const base=76+f*7,part=faces.slice(38+f*6,38+(f+1)*6),ids=[...g.index.array.slice((38+f*6)*3,(38+(f+1)*6)*3)],edges=new Map(),params=surface(f);
  assert.equal(new Set(ids).size,7);assert.equal(ids.filter(v=>v===base).length,6);
  for(let k=0;k<6;k++){
   assert.deepEqual(ids.slice(k*3,k*3+3),[base,base+1+k,base+1+(k+1)%6]);
   const tri=part[k],fn=tri.getNormal(new T.Vector3());assert(tri.getArea()>1e-9);assert(fn.dot(params.N)>0);
   for(const vertex of ids.slice(k*3,k*3+3))assert(fn.dot(at(g.attributes.normal,vertex))>.75,'Normal disagrees with winding');
   const row=ids.slice(k*3,k*3+3);for(let j=0;j<3;j++){const pair=[row[j],row[(j+1)%3]].sort((a,b)=>a-b).join(':');edges.set(pair,(edges.get(pair)||0)+1);}
  }
  assert.equal([...edges.values()].filter(n=>n===1).length,6);assert.equal([...edges.values()].filter(n=>n===2).length,6);
 }
 for(const tri of faces)assert(tri.getArea()>1e-10,'Every original/new triangle remains nondegenerate');
});

test('actual normals are unit/finite and agree with independent finite-difference cup derivatives',()=>{
 for(let i=0;i<g.attributes.normal.count;i++)near(at(g.attributes.normal,i).length(),1,1e-6);
 for(let f=0;f<27;f++){
  const part=surface(f);
  for(const [k,[ru,rv]]of [[0,0],...rim].entries()){
   const u=ru*part.width,v=rv*part.height,index=76+f*7+k;
   vectorNear(at(g.attributes.position,index),part.point(u,v),8e-8);
   assert(at(g.attributes.normal,index).dot(part.normal(u,v))>1-2e-7);
  }
 }
});

test('rear rim of each flower contacts an actual baseline stalk triangle; original envelope retained',()=>{
 const closest=new T.Vector3();
 for(let f=0;f<27;f++){
  const anchor=at(g.attributes.position,76+f*7+4);
  const distance=Math.min(...stemFaces.map(tri=>tri.closestPointToPoint(anchor,closest).distanceTo(anchor)));
  assert(distance<8e-8,'Rear rim floats from actual stem by '+distance);
 }
 for(const key of ['min','max'])vectorNear(g.boundingBox[key],oldg.boundingBox[key],1e-7);
 for(let i=0;i<g.attributes.position.count;i++){const p=at(g.attributes.position,i);assert(oldg.boundingBox.clone().expandByScalar(1e-7).containsPoint(p));}
 assert(g.attributes.position.getY(0)===0);
});

test('flower colors stay within the original purple palette component bounds and are continuous at shared vertices',()=>{
 const oldColor=oldg.attributes.color.array.slice(76*3),min=[0,1,2].map(k=>Math.min(...Array.from({length:oldColor.length/3},(_,i)=>oldColor[i*3+k]))),max=[0,1,2].map(k=>Math.max(...Array.from({length:oldColor.length/3},(_,i)=>oldColor[i*3+k])));
 for(let i=76;i<265;i++)for(let k=0;k<3;k++){const value=g.attributes.color.array[i*3+k];assert(value>=min[k]-1e-7&&value<=max[k]+1e-7);}
 for(let f=0;f<27;f++)for(let j=0;j<7;j++){
  const index=76+f*7+j,occurrences=[...g.index.array].filter(v=>v===index);
  assert(occurrences.length>=2);assert(at(g.attributes.color,index).toArray().every(Number.isFinite));
 }
});

test('prototype is deterministic and leaves baseline/source/geometry unmutated',()=>{
 const again=make(candidate);for(const key of Object.keys(g.attributes))assert.deepEqual([...g.attributes[key].array],[...again.geometry.attributes[key].array]);
 assert.deepEqual([...g.index.array],[...again.geometry.index.array]);assert.deepEqual(again.stats,b.stats);
 assert.equal(readFileSync(file,'utf8'),source);assert.equal(readFileSync(join(ROOT,'ranch3d.html'),'utf8'),html);
 const oldAgain=make(old);for(const key of Object.keys(oldg.attributes))assert.deepEqual([...oldg.attributes[key].array],[...oldAgain.geometry.attributes[key].array]);
});

test('shared fixture rejects unknown/missing/duplicated constructors and never erases unrelated edits',()=>{
 assert.equal(lupinConstructorSource(baseline),ORIGINAL);assert.equal(lupinConstructorSource(active),PROTOTYPE);
 assert.equal(restoreLupinModelSource(baseline),baseline);assert.equal(restoreLupinModelSource(active),baseline);
 assert.throws(()=>restoreLupinModelSource(active.replace('pitch=.28','pitch=.29')),/Unknown lupin/);
 assert.throws(()=>restoreLupinModelSource(baseline.replace(ORIGINAL,REJECTED_PROTOTYPE)),/Unknown lupin/);
 assert.throws(()=>restoreLupinModelSource(baseline.replace('petal<3','petal<4')),/Unknown lupin/);
 assert.throws(()=>restoreLupinModelSource('not a module'),/Exactly one/);
 assert.throws(()=>restoreLupinModelSource(active+'\n'+ORIGINAL),/Exactly one/);
 assert.throws(()=>restoreLupinModelSource(active.replace('\n\n// A bounded ring','\n\n// an unknown boundary')),/boundary/);
 assert.notEqual(hash(restoreLupinModelSource(active+'\n// unrelated source edit')),PIN_MODULE);
 assert.notEqual(hash(activeHtml.replace(NEW_QUERY,'./assets/meadow-cover.js?v=unreviewed-model')),PIN_HTML);
});

// Projected triangle area is a CPU silhouette proxy, not a native visual gate.
// Sample eight azimuths and three low riding-view pitches without a renderer.
function flowerProfile(geometry){
 const tri=triangles(geometry).slice(38),area=tri.reduce((sum,t)=>sum+t.getArea(),0),projected=[];
 for(let yaw=0;yaw<8;yaw++)for(const pitch of[0,.08,.18]){
  const rotation=new T.Quaternion().setFromEuler(new T.Euler(pitch,yaw*Math.PI/4,0,'YXZ'));
  projected.push(tri.reduce((sum,t)=>{
   const [a,b,c]=[t.a,t.b,t.c].map(p=>p.clone().applyQuaternion(rotation));
   return sum+Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
  },0));
 }
 const p=geometry.attributes.position;
 const perRow=(p.count-76)/9;
 const rows=[202,265].includes(p.count)?Array.from({length:9},(_,r)=>{
  const heights=Array.from({length:perRow},(_,i)=>p.getY(76+r*perRow+i));return[Math.min(...heights),Math.max(...heights)];
 }):[];
 return {area,projected,mean:projected.reduce((a,b)=>a+b,0)/projected.length,rows,gaps:rows.slice(1).map((r,i)=>r[0]-rows[i][1])};
}
test('twenty-seven smaller v2 cups regain bounded upright coverage without widening the old stalk envelope',()=>{
 const prior=make(rejected),oldProfile=flowerProfile(oldg),v1=flowerProfile(prior.geometry),v2=flowerProfile(g);
 assert(v2.mean/oldProfile.mean>.95&&v2.mean/oldProfile.mean<.97,'Recover most original purple profile with bounded width');
 assert(v2.mean/v1.mean>2.65&&v2.mean/v1.mean<2.75);
 assert(v2.area/oldProfile.area>1.09&&v2.area/oldProfile.area<1.11);
 for(let i=0;i<v2.projected.length;i++)assert(v2.projected[i]>v1.projected[i]*2.5);
 assert(v1.gaps.every(gap=>gap>.015));
 assert(v2.gaps.slice(0,3).every(gap=>gap<0&&gap>-.012),'Lower whorls overlap slightly, without a wide petal disc');
 assert(v2.gaps.slice(3).every(gap=>gap>0&&gap<.024),'Upper whorls remain separate with shorter gaps');
 // Base cup profile grows predominantly upright: width +3.9%, vertical span +77.3%.
 const span=row=>row[1]-row[0];assert(span(v2.rows[0])/span(v1.rows[0])>1.76&&span(v2.rows[0])/span(v1.rows[0])<1.79);
 near(v2.mean,.03753251269156007,1e-10);
 assert.deepEqual(b.stats,prior.stats);
 assert.equal(g.attributes.position.count,265);assert.equal(g.index.count/3,200);
 near(327*(g.index.count-oldg.index.count)/3,17658,0);
});
