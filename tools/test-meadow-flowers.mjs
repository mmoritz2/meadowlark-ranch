import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createMeadowLupinGeometry,MEADOW_FLOWER_BANKS,meadowFlowerBankAt,meadowFlowerHeightAt,MEADOW_LUPIN_HEIGHT,LEGACY_LUPIN_HEIGHT} from '../assets/meadow-flowers.mjs';
import {meadowSwardGrazingAt} from '../assets/pastoral-fields.mjs';

test('raceme has finite nondegenerate correctly oriented surfaces inside the existing triangle budget',()=>{
 const g=createMeadowLupinGeometry(T);
 try{
  assert.equal(g.index.count,238*3);assert.equal(g.attributes.position.count,532);
  assert.equal(g.userData.meadowFlowers.whorls,2);assert.equal(g.userData.meadowFlowers.leaflets,12);assert.equal(g.userData.meadowFlowers.florets,24);
  const p=g.attributes.position,n=g.attributes.normal;
  for(const attr of Object.values(g.attributes))assert([...attr.array].every(Number.isFinite));
  for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<2e-6);
  let petalArea=0,minFaceDot=1;
  for(let k=0;k<g.index.count;k+=3){
   const ids=Array.from(g.index.array.slice(k,k+3));
   const [a,b,c]=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));
   const cross=b.sub(a).cross(c.sub(a));assert(cross.length()>1e-8,'no collapsed stem, leaflet or petal');
   if(k/3>=38&&k/3<230)petalArea+=cross.length()*.5;
   cross.normalize();for(const i of ids)minFaceDot=Math.min(minFaceDot,cross.dot(new T.Vector3().fromBufferAttribute(n,i)));
  }
  assert(minFaceDot>0,'all vertex normals face their actual surface');assert(petalArea>.075&&petalArea<.13,'24 pea flowers have bounded real petal surfaces, not a colored stem');
  assert.equal(g.boundingBox.min.y,0);assert(Math.abs(g.boundingBox.max.y-MEADOW_LUPIN_HEIGHT)<1e-6);
  assert(g.boundingSphere.radius<.7);assert(g.boundingBox.max.x-g.boundingBox.min.x<.55);
  for(let whorl=0;whorl<2;whorl++){
   const petiole=20+whorl*28,joint=new T.Vector3().fromBufferAttribute(p,petiole+3);
   for(let leaf=0;leaf<6;leaf++)assert(joint.distanceTo(new T.Vector3().fromBufferAttribute(p,petiole+4+leaf*4))<1e-7);
  }
 }finally{g.dispose();}
});

test('flower colonies are finite unequal connected groups with open gaps and soft boundaries',()=>{
 assert.equal(MEADOW_FLOWER_BANKS.length,3);
 for(const bank of MEADOW_FLOWER_BANKS){
  assert(Object.isFrozen(bank)&&Object.isFrozen(bank.nodes));
  const [a,b,c,d]=bank.bounds;
  for(const [x,z] of bank.nodes)assert(meadowFlowerBankAt(x,z)>.99);
  for(let x=a-1;x<=b+1;x+=.35)for(let z=c-1;z<=d+1;z+=.35){
   const v=meadowFlowerBankAt(x,z);assert(v>=0&&v<=1&&Number.isFinite(v));
   assert.equal(v,meadowFlowerBankAt(x,z));
   assert(Math.abs(v-meadowFlowerBankAt(x+.001,z))<.004);
   assert(Math.abs(v-meadowFlowerBankAt(x,z+.001))<.004);
  }
 }
 for(const p of [[0,112],[0,128],[24,114],[0,0],[65,-145],[52,-143],[300,300],[-300,-300]])assert.equal(meadowFlowerBankAt(...p),0,'open gap, route, or remote field remains outside support');
 let wild=0,clear=0;
 for(let x=25;x<60;x+=.25)for(let z=-170;z<-145;z+=.25){
  const b=meadowFlowerBankAt(x,z),g=meadowSwardGrazingAt(x,z),density=b*(1-g);
  assert(density>=0&&density<=1);
  if(g===1){assert.equal(density,0);clear++;}if(density>.5)wild++;
 }
 assert(clear>30&&wild>30,'fixture covers clear grazed ground and a recovered tall shoulder');
});

test('height policy preserves old remote top heights and varies new flowering cores',()=>{
 for(const [x,z]of [[0,0],[65,-145],[-69,36],[147,-121]]){
  assert.equal(meadowFlowerBankAt(x,z),0);
  for(const sz of [.95,1.2,1.5])for(const stretch of [.85,1.025,1.2]){
   const old=sz*stretch*LEGACY_LUPIN_HEIGHT;
   const next=old+(meadowFlowerHeightAt(x,z,.5)-old)*meadowFlowerBankAt(x,z);
   assert.equal(next,old);assert(Math.abs(next/MEADOW_LUPIN_HEIGHT*MEADOW_LUPIN_HEIGHT-old)<1e-15);
  }
 }
 assert(meadowFlowerHeightAt(13,115,0)<meadowFlowerHeightAt(13,115,1));
 assert(meadowFlowerHeightAt(13,115,1)<=1.38+1e-12);
 assert(meadowFlowerHeightAt(16.5,115,0)<meadowFlowerHeightAt(13,115,0));
});

test('model creates only the existing one geometry and consumes only its UUID allocation',()=>{
 const original=Math.random;let expected=0,actual=0;
 try{
  Math.random=()=>{expected++;return .31;};const empty=new T.BufferGeometry();empty.dispose();
  Math.random=()=>{actual++;return .31;};const g=createMeadowLupinGeometry(T);g.dispose();
 }finally{Math.random=original;}
 assert.equal(actual,expected);assert.equal(actual,4);
 const source=readFileSync(new URL('../assets/meadow-flowers.mjs',import.meta.url),'utf8');
 assert(!/Math\.random|new\s+THREE\.(?:Mesh|Texture|.*Material)|fetch\(/.test(source));
 const a=createMeadowLupinGeometry(T),b=createMeadowLupinGeometry(T);
 for(const key of ['position','normal','color'])assert.deepEqual(a.attributes[key].array,b.attributes[key].array);a.dispose();b.dispose();
});

test('caller retains flower capacity, world-position candidates and physical clearance owners',()=>{
 const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 assert(html.includes("NG_LU=quality==='low'?16:44"));
 const start=html.indexOf('const cell=lupinCells[slot];cell.count=0;'),end=html.indexOf('for(let k=0;k<NG_FR;k++)',start),body=html.slice(start,end);
 for(const phrase of ['for(let k=0;k<NG_LU;k++)','const x=bx+h1*NG_CELL, z=bz+h2*NG_CELL;',"coldWoodlandWeights(x,z).weight>.08||biomeAt(x,z)!=='meadow'||!okClutter(x,z)",'v.set(x,groundH(x,z)-0.03,z)','bank*(1-meadowSwardGrazingAt(x,z))'])assert(body.includes(phrase),phrase);
 assert(!/Math\.random/.test(body));assert.equal((body.match(/cell.count\+\+/g)||[]).length,1);
});
