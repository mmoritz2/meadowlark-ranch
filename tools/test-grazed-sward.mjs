import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {GRAZED_SWARD,createGrazedSwardGeometry,grazedSwardWeight,selectsGrazedSward} from '../assets/grazed-sward.mjs';
import {meadowSwardGrazingAt} from '../assets/pastoral-fields.mjs';

test('short turf keeps the rich-root triangle budget with finite grounded, narrow blades and real normals',()=>{
 const g=createGrazedSwardGeometry(T),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,c=g.attributes.color;
 assert.equal(g.index.count/3,70);assert.equal(g.userData.grazedSward.leaves,46);assert.equal(p.count,162);
 assert.equal(g.boundingBox.min.y,0);assert(g.boundingBox.max.y>.50&&g.boundingBox.max.y<.54);
 for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}
 for(let i=0;i<p.count;i++){assert(Math.hypot(p.getX(i),p.getZ(i))<GRAZED_SWARD.maximumRadius);assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);}
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.array[i+j]);assert(ids.every(j=>j<p.count));const[a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),face=new T.Vector3().crossVectors(b.sub(a),c.sub(a));assert(face.length()>1e-6);face.normalize();for(const j of ids)assert(face.dot(new T.Vector3().fromBufferAttribute(n,j))>.75);}
 let at=0;const anchors=new Set();
 for(let leaf=0;leaf<46;leaf++){const stride=leaf<12?5:3,tip=at+stride-1;assert.equal(p.getY(at),0);assert.equal(p.getY(at+1),0);assert.equal(uv.getY(at),0);assert.equal(uv.getY(tip),1);assert.equal(uv.getX(tip),.5);assert(c.getY(at)<.30&&c.getY(at+2)>c.getY(at)*2);anchors.add(((p.getX(at)+p.getX(at+1))/2).toFixed(4)+','+((p.getZ(at)+p.getZ(at+1))/2).toFixed(4));const width=new T.Vector3().fromBufferAttribute(p,at).distanceTo(new T.Vector3().fromBufferAttribute(p,at+1));assert(width>.013&&width<.019);at+=stride;}
 assert.equal(anchors.size,7);g.dispose();
});
test('geometry is repeatable without changing global placement randomness or allocating new textures',()=>{
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

test('grazed blades span a larger low turf footprint without becoming broad paddles',()=>{
 const g=createGrazedSwardGeometry(T),p=g.attributes.position;let projection=0;
 for(let i=0;i<g.index.count;i+=3){const[a,b,c]=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,g.index.array[i+j]));projection+=Math.abs(new T.Vector3().crossVectors(b.sub(a),c.sub(a)).y)*.5;}
 // Sum of true triangle projections is a design-area measurement, not a claim
 // of pixel coverage: overlap, source scale, slope and view still affect that.
 assert(projection>.14&&projection<.18);let at=0;
 for(let leaf=0;leaf<46;leaf++){const stride=leaf<12?5:3,root=new T.Vector3().fromBufferAttribute(p,at).add(new T.Vector3().fromBufferAttribute(p,at+1)).multiplyScalar(.5),tip=new T.Vector3().fromBufferAttribute(p,at+stride-1);const width=new T.Vector3().fromBufferAttribute(p,at).distanceTo(new T.Vector3().fromBufferAttribute(p,at+1));assert(width/root.distanceTo(tip)<.06);at+=stride;}
 g.dispose();
});
