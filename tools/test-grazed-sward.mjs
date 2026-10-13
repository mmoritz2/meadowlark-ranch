import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {grazedSwardWeight,selectsGrazedSward} from '../assets/grazed-sward.mjs';
import {GRAZED_SWARD,createGrazedSwardGeometry,historicalSource} from './grass-arch-historical-factories.mjs';
import {meadowSwardGrazingAt} from '../assets/pastoral-fields.mjs';

test('Historical d5 morphology: short turf keeps 70 triangles with 12 broader curved leaves, 34 fine leaves and real physical normals',()=>{
 const g=createGrazedSwardGeometry(T),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,c=g.attributes.color;
 assert.equal(g.index.count/3,70);assert.equal(g.userData.grazedSward.leaves,46);assert.equal(p.count,162);
 assert.equal(g.userData.grazedSward.profile,'grazed-sward-6');assert.equal(g.userData.grazedSward.broadLeaves,12);
 assert.equal(g.boundingBox.min.y,0);assert(g.boundingBox.max.y>.50&&g.boundingBox.max.y<.54);
 for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}
 for(let i=0;i<p.count;i++){assert(Math.hypot(p.getX(i),p.getZ(i))<GRAZED_SWARD.maximumRadius);assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);}
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]);assert(ids.every(j=>j<p.count));const[a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),face=new T.Vector3().crossVectors(b.sub(a),c.sub(a));assert(face.length()>1e-6);face.normalize();for(const j of ids)assert(face.dot(new T.Vector3().fromBufferAttribute(n,j))>.75);}
 let at=0;const anchors=new Set();
 for(let leaf=0;leaf<46;leaf++){const stride=leaf<12?5:3,tip=at+stride-1;assert.equal(p.getY(at),0);assert.equal(p.getY(at+1),0);assert.equal(uv.getY(at),0);assert.equal(uv.getY(tip),1);assert.equal(uv.getX(tip),.5);assert(c.getY(at)<.30&&c.getY(at+2)>c.getY(at)*2);anchors.add(((p.getX(at)+p.getX(at+1))/2).toFixed(4)+','+((p.getZ(at)+p.getZ(at+1))/2).toFixed(4));const width=new T.Vector3().fromBufferAttribute(p,at).distanceTo(new T.Vector3().fromBufferAttribute(p,at+1));if(leaf<12){assert(width>.019&&width<.024);const mid=new T.Vector3().fromBufferAttribute(p,at+2).distanceTo(new T.Vector3().fromBufferAttribute(p,at+3));assert(mid>.027&&mid<.033);}else assert(width>.008&&width<.011);at+=stride;}
 assert.equal(anchors.size,7);g.dispose();
});
test('Historical d5 morphology: geometry is repeatable without changing global placement randomness or allocating new textures',()=>{
 const a=createGrazedSwardGeometry(T),b=createGrazedSwardGeometry(T);for(const k of Object.keys(a.attributes))assert.deepEqual(a.attributes[k].array,b.attributes[k].array);assert.deepEqual(a.index.array,b.index.array);a.dispose();b.dispose();
 const src=fs.readFileSync(new URL('../assets/grazed-sward.mjs',import.meta.url),'utf8');assert(!src.includes('Math.random'));assert(!src.includes('Material('));assert(!src.includes('Texture('));assert(!src.includes('fetch('));
});
test('short turf is confined to grazed interiors and leaves uncut wild and golden bands exact',()=>{
 for(const[x,z]of [[88,-157],[65,-145]])assert.equal(grazedSwardWeight(x,z),1);
 for(const[x,z]of [[0,-240],[95,-172],[200,-240],[50,100]])assert.equal(grazedSwardWeight(x,z),0);
 let boundary=0;
 for(let z=-205;z<-90;z+=.7)for(let x=20;x<135;x+=.7){const g=meadowSwardGrazingAt(x,z),w=grazedSwardWeight(x,z);assert(w>=0&&w<=1);if(g<=GRAZED_SWARD.maskStart)assert.equal(w,0);if(g>=GRAZED_SWARD.maskFull)assert.equal(w,1);if(w>0&&w<1)boundary++;assert.equal(selectsGrazedSward(x,z,.5),selectsGrazedSward(x,z,.5));assert(Math.abs(grazedSwardWeight(x+.001,z)-w)<.005);}
 assert(boundary>100);
});

test('Historical d5 morphology: mixed broad and fine grazed leaves increase ground-plane fullness within bounded upright spread',()=>{
 const g=createGrazedSwardGeometry(T),p=g.attributes.position;let projection=0;
 for(let i=0;i<g.index.count;i+=3){const[a,b,c]=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,g.index.array[i+j]));projection+=Math.abs(new T.Vector3().crossVectors(b.sub(a),c.sub(a)).y)*.5;}
 // Sum of true triangle projections is a design-area measurement, not a claim
 // of pixel coverage: overlap, source scale, slope and view still affect that.
 assert(projection>.058&&projection<.071);let at=0;
 for(let leaf=0;leaf<46;leaf++){const stride=leaf<12?5:3,root=new T.Vector3().fromBufferAttribute(p,at).add(new T.Vector3().fromBufferAttribute(p,at+1)).multiplyScalar(.5),tip=new T.Vector3().fromBufferAttribute(p,at+stride-1);const width=new T.Vector3().fromBufferAttribute(p,at).distanceTo(new T.Vector3().fromBufferAttribute(p,at+1));assert(width/root.distanceTo(tip)<(leaf<12?.065:.06));at+=stride;}
 g.dispose();
});

// Recover the pinned original whole factory through the same exact approved
// source literals as the full guard. No hand-built legacy geometry substitutes
// for its actual leaf positions, constructors or projected ground area.
test('Historical d5 morphology: broader profile retains all 34 fine leaves and all 46 physical centerlines/heights/UV/colors/indices',()=>{
 const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/pastoral-cover-source-7fbd127.json',import.meta.url)));let source=historicalSource('assets/grazed-sward.mjs');
 for(const c of contract.changes.filter(c=>c.file==='assets/grazed-sward.mjs').reverse()){assert.equal(source.split(c.after).length-1,1);source=source.replace(c.after,c.before);}
 const start=source.indexOf('export function createGrazedSwardGeometry');assert(start>0);const factory=new Function('GRAZED_SWARD','return ('+source.slice(start).replace(/^export /,'')+');')(GRAZED_SWARD);
 const withCounter=make=>{const previous=Math.random;let calls=0;Math.random=()=>{calls++;return .31;};try{return{geometry:make(),calls};}finally{Math.random=previous;}};
 const old=withCounter(()=>factory(T)),now=withCounter(()=>createGrazedSwardGeometry(T)),a=old.geometry,b=now.geometry;assert.equal(now.calls,old.calls);assert.equal(b.index.count,a.index.count);assert.deepEqual(b.index.array,a.index.array);
 for(const name of['color','uv'])assert.deepEqual(b.attributes[name].array,a.attributes[name].array);const pa=a.attributes.position,pb=b.attributes.position;let at=0,changed=0;
 for(let leaf=0;leaf<46;leaf++){const stride=leaf<12?5:3;for(let i=at;i<at+stride;i++)assert.equal(pb.getY(i),pa.getY(i));
  const tip=at+stride-1;for(const axis of['X','Y','Z'])assert.equal(pb['get'+axis](tip),pa['get'+axis](tip));
  if(leaf>=12){for(const name of['position','normal'])assert.deepEqual(b.attributes[name].array.subarray(at*3,(at+stride)*3),a.attributes[name].array.subarray(at*3,(at+stride)*3));}
  else{let leafChanged=false;for(const offset of[0,2]){const i=at+offset;for(const axis of['X','Y','Z'])assert(Math.abs((pb['get'+axis](i)+pb['get'+axis](i+1))/2-(pa['get'+axis](i)+pa['get'+axis](i+1))/2)<1e-8);if(pb.getX(i)!==pa.getX(i)||pb.getZ(i)!==pa.getZ(i))leafChanged=true;}assert(leafChanged);changed++;}at+=stride;
 }
 assert.equal(changed,12);const projection=g=>{const p=g.attributes.position;let area=0;for(let i=0;i<g.index.count;i+=3){const[a,b,c]=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,g.index.array[i+j]));area+=Math.abs(new T.Vector3().crossVectors(b.sub(a),c.sub(a)).y)/2;}return area;};
 assert(projection(b)>projection(a)*1.4&&projection(b)<projection(a)*1.8);a.dispose();b.dispose();
});
