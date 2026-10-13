import test from 'node:test';
import {normalizeGrassArchSource} from './grass-arch-source-guard.cjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createMeadowLupinGeometry as create, MEADOW_LUPIN_HEIGHT} from '../assets/meadow-flowers.mjs';
import {createMeadowLupinGeometry as original} from './fixtures/lupin-original-e8b5cf4.mjs';
const receipt=JSON.parse(readFileSync(new URL('./fixtures/lupin-source-e8b5cf4.json',import.meta.url)));
const sha=s=>createHash('sha256').update(s).digest('hex');
const source=readFileSync(new URL('../assets/meadow-flowers.mjs',import.meta.url),'utf8');
const oldSource=readFileSync(new URL('./fixtures/lupin-original-e8b5cf4.mjs',import.meta.url),'utf8');
const vertex=(g,id,attr='position')=>new T.Vector3().fromBufferAttribute(g.attributes[attr],id);
function eachPair(fn){const a=original(T),b=create(T);try{fn(a,b);}finally{a.dispose();b.dispose();}}
function floats(g,first,count,attr='position'){return g.attributes[attr].array.slice(first*3,(first+count)*3);}
function tuples(g,first,count){const p=g.attributes.position.array,c=g.attributes.color.array;return Array.from({length:count},(_,i)=>[...p.slice((first+i)*3,(first+i+1)*3),...c.slice((first+i)*3,(first+i+1)*3)].join(',')).sort();}

test('only the original prototype and canonical child cache edge change; all planting policy and caller bytes stay exact',()=>{
 assert.equal(sha(oldSource),receipt.originalSHA256['assets/meadow-flowers.mjs']);
 assert.equal(source.slice(0,source.indexOf('// Original rounded pea raceme:')),oldSource.slice(0,oldSource.indexOf('// Long raceme lupin:')));
 let cover=normalizeGrassArchSource(readFileSync(new URL('../assets/meadow-cover.js',import.meta.url),'utf8'),'assets/meadow-cover.js');
 for(const c of receipt.sourceChanges){assert.equal(c.file,'assets/meadow-cover.js');assert.equal(cover.split(c.after).length,2);cover=cover.replace(c.after,c.before);}
 assert.equal(sha(cover),receipt.originalSHA256['assets/meadow-cover.js']);
 const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),s=html.indexOf('const cell=lupinCells[slot];cell.count=0;'),e=html.indexOf('for(let k=0;k<NG_FR;k++)',s);
 assert(s>=0&&e>s);assert.equal(sha(html.slice(s,e)),receipt.callerLupinFillSHA256);
 assert(!/Math\.random|new\s+THREE\.(?:Mesh|Texture|.*Material)|fetch\(/.test(source));
});

test('all rounded surfaces are finite, nondegenerate, physically wound and smoothly shaded without opposing vertex normals',()=>eachPair((a,g)=>{
 assert.equal(g.index.count/3,646);assert.equal(g.attributes.position.count,784);assert.deepEqual(Object.keys(g.attributes).sort(),['color','normal','position']);
 for(const attr of Object.values(g.attributes))assert([...attr.array].every(Number.isFinite));
 for(let i=0;i<g.attributes.normal.count;i++)assert(Math.abs(vertex(g,i,'normal').length()-1)<2e-6);
 let minDot=1,petalArea=0;
 for(let k=0;k<g.index.count;k+=3){const ids=Array.from(g.index.array.slice(k,k+3)),[p,q,r]=ids.map(i=>vertex(g,i)),n=q.sub(p).cross(r.sub(p));assert(n.length()>3e-5,'every authored triangle has positive area');
  if(g.userData.meadowFlowers.ranges.some(r=>r.kind!=='leaf'&&k>=r.indexStart&&k<r.indexStart+r.indexCount))petalArea+=n.length()/2;
  n.normalize();for(const id of ids)minDot=Math.min(minDot,n.dot(vertex(g,id,'normal')));
 }
 assert(minDot>.35,'a smoothed corner never opposes the actual surface');assert(petalArea>.105&&petalArea<.125,'dense small real petals rather than large purple panels');
}));

test('small curved petals replace broad triangle shelves, with unequal wings and a connected cupped keel',()=>eachPair((a,g)=>{
 const R=g.userData.meadowFlowers.ranges;
 for(let flower=0;flower<24;flower++){
  const patch=R.filter(r=>r.owner===flower&&r.kind!=='leaf');assert.deepEqual(patch.map(r=>r.kind),['banner','left-wing','right-wing','keel']);
  assert.deepEqual(patch.map(r=>r.indexCount/3),[8,5,5,5]);
  const root=new T.Vector3(...new Float32Array(g.userData.meadowFlowers.flowerRoots[flower]));
  const old=tuples(a,76+flower*18,18).map(s=>s.split(',').slice(0,3).map(Number));
  assert(old.some(p=>new T.Vector3(...p).distanceTo(root)<1e-12),'old stalk attachment is retained');
  for(const r of patch){assert(vertex(g,r.vertexStart).distanceTo(root)<1e-12);const ids=Array.from({length:r.vertexCount},(_,i)=>r.vertexStart+i),center=vertex(g,ids.at(-1)),boundary=ids.slice(0,-1).map(i=>vertex(g,i));
   let maxNormalSpread=0;for(const i of ids)for(const j of ids)maxNormalSpread=Math.max(maxNormalSpread,1-vertex(g,i,'normal').dot(vertex(g,j,'normal')));
   assert(maxNormalSpread>.4&&maxNormalSpread<1.05,'petal has real curved shading, not a flat coloured polygon');
   const plane=boundary[1].clone().sub(root).cross(boundary[2].clone().sub(root)).normalize();assert(Math.abs(center.clone().sub(root).dot(plane))>2e-4,'raised centre is not coplanar with the old root/shoulder');
   assert(center.distanceTo(root)<.08&&Math.max(...boundary.map(p=>p.distanceTo(root)))<.095,'individual floret remains small');
  }
  const left=patch[1],right=patch[2];assert.notDeepEqual(floats(g,left.vertexStart,left.vertexCount),floats(g,right.vertexStart,right.vertexCount),'unequal curved wings');
 }
}));

test('palmate leaves meet actual preserved petioles, retain their original contacts and carry folded midribs',()=>eachPair((a,g)=>{
 assert.deepEqual(floats(g,0,20),floats(a,0,20),'five real stem faces unchanged');
 for(let whorl=0;whorl<2;whorl++){
  const oldPetiole=20+whorl*28,newPetiole=20+whorl*46;assert.deepEqual(floats(g,newPetiole,4),floats(a,oldPetiole,4));
  const joint=vertex(a,oldPetiole+3);
  for(let leaf=0;leaf<6;leaf++){
   const r=g.userData.meadowFlowers.ranges.find(r=>r.kind==='leaf'&&r.owner===whorl*6+leaf);assert.equal(r.indexCount/3,6);assert(vertex(g,r.vertexStart).distanceTo(joint)<1e-7);
   const oldLeaf=oldPetiole+4+leaf*4;
   for(const [oldIndex,newIndex]of [[0,0],[1,2],[2,3],[3,4]])assert.deepEqual(floats(g,r.vertexStart+newIndex,1),floats(a,oldLeaf+oldIndex,1));
   const center=vertex(g,r.vertexStart+6),sides=[vertex(g,r.vertexStart+2),vertex(g,r.vertexStart+4)];assert(center.y>Math.max(...sides.map(p=>p.y))+.013,'raised midrib makes a folded leaf');
  }
 }
 assert.deepEqual(tuples(g,g.attributes.position.count-24,24),tuples(a,a.attributes.position.count-24,24),'historic green terminal bud unchanged');
}));

test('computed course-clearance bounds, root, top and original green/lilac palette remain exact',()=>eachPair((a,g)=>{
 assert.deepEqual(g.boundingBox,a.boundingBox);assert.deepEqual(g.boundingSphere,a.boundingSphere);assert.equal(g.boundingBox.min.y,0);assert(Math.abs(g.boundingBox.max.y-MEADOW_LUPIN_HEIGHT)<1e-6);
 for(let i=0;i<g.attributes.position.count;i++)assert(vertex(g,i).distanceTo(g.boundingSphere.center)<=g.boundingSphere.radius+1e-15);
 const palette=geo=>new Set(Array.from({length:geo.attributes.color.count},(_,i)=>floats(geo,i,1,'color').join(',')));
 assert.deepEqual(palette(g),palette(a));
 for(let i=0;i<20;i++){const c=vertex(g,i,'color');assert(c.y>c.x&&c.y>c.z,'stem remains green');}
 for(const r of g.userData.meadowFlowers.ranges.filter(r=>r.kind!=='leaf')){const c=vertex(g,r.vertexStart,'color');assert(c.z>c.y,'purple pigment stays on petals');}
}));

test('one geometry allocation preserves UUID and future random stream; rebuilding is deterministic',()=>{
 const previous=Math.random;function run(factory){let state=91573,calls=0;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const g=factory(T);const own=calls,future=Array.from({length:24},()=>Math.random());return{g,own,future};}
 let a,b;try{a=run(original);b=run(create);}finally{Math.random=previous;}
 try{assert.equal(a.own,4);assert.equal(b.own,a.own);assert.equal(b.g.uuid,a.g.uuid);assert.deepEqual(b.future,a.future);const c=create(T);try{for(const key of ['position','normal','color'])assert.deepEqual(b.g.attributes[key].array,c.attributes[key].array);assert.deepEqual(b.g.index.array,c.index.array);}finally{c.dispose();}}finally{a.g.dispose();b.g.dispose();}
});

test('full active-prefix costs distinguish observed submissions from allocated High capacity',()=>eachPair((a,g)=>{
 const bytes=geo=>Object.values(geo.attributes).reduce((s,v)=>s+v.array.byteLength,0)+geo.index.array.byteLength;
 assert.equal(bytes(a),20580);assert.equal(bytes(g),32100);assert.equal(bytes(g)-bytes(a),11520);
 for(const rows of Object.values(receipt.costViews)){assert(rows>=0&&rows<=377);assert.equal(rows*(g.index.count-a.index.count)/3,rows*408);}
 assert.equal(receipt.costViews['colony-high']*g.index.count/3,243542);assert.equal(receipt.capacity*408,3518592);assert(receipt.capacity>20*receipt.costViews['colony-high'],'capacity is not a per-frame draw count');
}));
