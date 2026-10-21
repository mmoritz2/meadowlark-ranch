import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const checkout=new URL('../',import.meta.url),asset=f=>new URL('assets/'+f,checkout);
const T=await import(asset('vendor/three/build/three.module.js'));
// Resolve Three's browser import map for the unmodified discovery factory.
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utils=data((await readFile(asset('vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8')).replace("from 'three';",'from '+JSON.stringify(asset('vendor/three/build/three.module.js').href)+';'));
const artSource=await readFile(asset('discovery-art.js'),'utf8');
const {createDiscoveryArt}=await import(data(artSource.replace("'./vendor/three/examples/jsm/utils/BufferGeometryUtils.js'",JSON.stringify(utils))));
const {createSolidWorld}=await import(asset('solid-collisions.js'));
const {prepareHollowpeakRuntime}=await import(asset('hollowpeak-field-runtime.mjs'));
const {finalizeHollowpeakAnchorGrounding:apply,SNOWPEAK_RUNTIME_PLAN:plan}=await import(asset('hollowpeak-anchor-grounding.mjs'));
const {snowpeakResidentSignature}=await import(asset('snowpeak-chest-grounding.mjs'));
const bytes=await readFile(asset('hollowpeak-cohort-1.bin'));
const hash=heights=>createHash('sha256').update(new Uint8Array(heights.buffer)).digest('hex');

async function fixture(opened=false){
 const runtime=await prepareHollowpeakRuntime({heights:new Float32Array(513*513),outsideHeightAt:()=>0,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})});
 const art=createDiscoveryArt({THREE:T,materials:{aged:new T.MeshStandardMaterial(),iron:new T.MeshStandardMaterial(),cloth:new T.MeshStandardMaterial()}}),{root,lid}=art.chest(3),scene=new T.Scene();
 root.position.set(-177,runtime.queries.design.heightAt(-177,-238),-238);root.rotation.y=Math.atan2(177,238);if(opened)lid.rotation.x=-1.2;scene.add(root);
 const solidWorld=createSolidWorld({THREE:T});assert.equal(solidWorld.register(root),1);
 const thing={kind:'chest',id:'snowpeak',g:root,lid,x:-177,z:-238,tier:3},world={groundH:runtime.queries.ownedSupportHeightAt,solidWorld,things:[thing],fallsLandscape:{ownedQueries:runtime.queries},hollowpeakRuntime:runtime};
 // Isolated component admission fixture; native gameplay verifies real owners.
 Object.assign(runtime,{status:'ready',ecology:{status:'applied',trees:{status:'applied'}},collision:{legacyReplaced:true}});
 return{G:{world},runtime,thing,root,lid,solidWorld,scene};
}
const pose=f=>({p:f.root.position.toArray(),q:f.root.quaternion.toArray(),s:f.root.scale.toArray(),matrix:f.root.matrixWorld.toArray(),lid:f.lid.rotation.x,stats:f.solidWorld.stats(),marker:f.root.userData.snowpeakGrounding});

for(const opened of [false,true])test('real source chest retains geometry, contact and '+(opened?'opened':'closed')+' lid through the late fit',async()=>{
 const f=await fixture(opened),resources=[];f.root.traverse(m=>{if(m.isMesh)resources.push([m,m.geometry,m.material]);});
 const signature=snowpeakResidentSignature(f.root),stats=f.solidWorld.stats(),field=hash(f.runtime.heights),children=f.scene.children.slice(),lid=f.lid.rotation.x,random=Math.random;
 let result;try{Math.random=()=>{throw Error('Late fit consumed ambient RNG');};result=apply(f);}finally{Math.random=random;}
 assert.equal(result.status,'applied-same-owner');assert.equal(result.localCanonicalNodesVerified,72);assert.deepEqual(f.solidWorld.stats(),stats);assert.deepEqual(f.scene.children,children);assert.deepEqual(snowpeakResidentSignature(f.root),signature);assert.equal(hash(f.runtime.heights),field);assert.equal(f.lid.rotation.x,lid);assert.equal(f.G.world.things[0],f.thing);
 for(const[m,g,material]of resources){assert.equal(m.geometry,g);assert.equal(m.material,material);}
 assert(f.root.matrixWorld.elements.every((v,i)=>Math.abs(v-plan.matrix[i])<1e-12));assert(f.solidWorld.hasParts(f.root));assert.equal(apply(f).status,'already-applied');
 const witness={x:-177,z:-238};assert(f.solidWorld.resolve(witness,{bottom:plan.rootY+.03,top:plan.rootY+.44,radius:.12})>0);
});

const invalid=[['phase',f=>{f.runtime.status='waiting';}],['authentication',f=>{f.runtime.payload.authenticated=false;}],['field identity',f=>{f.runtime.payload.finalFieldSHA256='0'.repeat(64);}],['ecology',f=>{f.runtime.ecology.trees.status='waiting';}],['terrain contacts',f=>{f.runtime.collision.legacyReplaced=false;}],['duplicate owner',f=>{f.G.world.things.push(f.thing);}],['changed local support',f=>{f.runtime.heights[134*513+165]+=.01;}],['new composed support',f=>{f.G.world.groundH=()=>99;}]];
for(const[label,mutate]of invalid)test('rejects '+label+' before changing the existing chest',async()=>{
 const f=await fixture();mutate(f);const before=pose(f);assert.throws(()=>apply(f));assert.deepEqual(pose(f),before);
});

test('a once-failing actual registration restores the original pose and contact',async()=>{
 const f=await fixture(),before=pose(f),register=f.solidWorld.register.bind(f.solidWorld);let fail=true;
 f.solidWorld.register=(...args)=>{const n=register(...args);if(fail){fail=false;throw Error('injected registration fault');}return n;};
 assert.throws(()=>apply(f),error=>{assert.match(error.cause?.message??'',/injected registration fault/);assert.equal(error.rollbackRestored,true);assert.equal(error.originalPoseRestored,true);return true;});assert.deepEqual(pose(f),before);assert(f.solidWorld.hasParts(f.root));
});
