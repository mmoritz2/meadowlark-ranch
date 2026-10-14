// Historical comparison only: reconstruct and SHA-bind the prior full source, then
// execute its frozen 5 KB updater excerpt. Actual candidate tests import/read raw
// assets/world-photoscans.js directly and never execute this projection as current.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
const dir=new URL('./fixtures/broadleaf-depth-60cb73c/',import.meta.url);
export const broadleafFixture=JSON.parse(fs.readFileSync(new URL('fixture.json',dir)));
export const broadleafSourceEdits=JSON.parse(fs.readFileSync(new URL('source-edits.json',dir)));
export const sourceRoot=new URL('../',import.meta.url);
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export function rawBroadleafSource(){return fs.readFileSync(new URL('assets/world-photoscans.js',sourceRoot),'utf8');}
export function historicalParentComparison(rawCurrent){
 assert.equal(sha256(fs.readFileSync(new URL('source-edits.json',dir))),broadleafFixture.sourceEditsSHA256);
 assert.equal(sha256(rawCurrent),broadleafFixture.candidateSourceSHA256);
 // This inverse is solely the explicit historical/source-scope adapter. It never
 // feeds candidate behavior, uploads, helper imports, materials or shader tests.
 let parent=rawCurrent;for(const edit of broadleafSourceEdits.changes.toReversed()){
  assert.equal(parent.split(edit.after).length-1,1);parent=parent.replace(edit.after,edit.before);
 }
 assert.equal(sha256(parent),broadleafFixture.parentSourceSHA256);
 const updater=fs.readFileSync(new URL('parent-updateTrees.js.txt',dir),'utf8');
 assert.equal(sha256(updater),broadleafFixture.parentUpdateBlockSHA256);
 const a=parent.indexOf('  let previousSelection=new Set()'),b=parent.indexOf('  state.ready=(async()=>{',a);
 assert(a>0&&b>a);assert.equal(parent.slice(a,b),updater);
 return {source:parent,updater};
}
export function capturedBroadleafRoster(){
 const bytes=fs.readFileSync(new URL('actual-tree-roster.json',dir));assert.equal(sha256(bytes),broadleafFixture.capturedRosterFixtureSHA256);
 const raw=JSON.parse(bytes);assert.equal(raw.format,'lossless-yaw-scale-matrix-columns-1');assert.equal(raw.rows.length,broadleafFixture.capturedRosterCount);
 const trees=raw.rows.map(row=>{assert.equal(row.length,11);const[x,z,height,sourceIndex,retired,m0,m2,m5,m8,m10,m13]=row,[source,cost]=raw.sourceCatalog[sourceIndex];assert([x,z,height,cost,m0,m2,m5,m8,m10,m13].every(Number.isFinite));assert(retired===0||retired===1);return{x,z,height,source,cost,matrix:[m0,0,m2,0,0,m5,0,0,m8,0,m10,0,x,m13,z,1],retiredFallsFlora:!!retired};});
 return {authoredTriangles:raw.authoredTriangles,player:raw.player,direction:raw.direction,trees};
}
export function verifyBroadleafModelInputs(){for(const[id,expected]of Object.entries(broadleafFixture.modelGLBSHA256))assert.equal(sha256(fs.readFileSync(new URL('assets/models/world/realism/'+id+'.glb',sourceRoot))),expected);}

function residentCrownSources(){
 const sources={},provenance=[];
 for(const[id,key,collection]of[['tree_small_02','broadleaf',false],['pine_tree_01','mature-pine',true],['island_tree_01','canopy-broadleaf',false],['jacaranda_tree','woodland-broadleaf',false],['upright_broadleaf_01','upright-broadleaf',false]]){
  const bytes=fs.readFileSync(new URL('assets/models/world/realism/'+id+'.glb',sourceRoot));let json,bin;for(let o=12;o<bytes.length;){const n=bytes.readUInt32LE(o),t=bytes.readUInt32LE(o+4),b=bytes.subarray(o+8,o+8+n);if(t===0x4e4f534a)json=JSON.parse(b);if(t===0x004e4942)bin=b;o+=8+n;}
  const accessor=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView];if(a.sparse||a.componentType!==5126||a.type!=='VEC3')throw Error('Expected resident float32 POSITION');const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12,data=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);return{a,read:(i,k)=>data.getFloat32(start+i*stride+k*4,true)};};
  const matrices=json.nodes.map(n=>n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation||[0,0,0]),new T.Quaternion().fromArray(n.rotation||[0,0,0,1]),new T.Vector3().fromArray(n.scale||[1,1,1]))),parts=[];
  const visit=(i,parent)=>{const n=json.nodes[i],world=new T.Matrix4().multiplyMatrices(parent,matrices[i]);if(n.mesh!==undefined)for(const primitive of json.meshes[n.mesh].primitives){const transform=world.clone();if(collection)transform.setPosition(0,0,0);const e=transform.elements,{a,read}=accessor(primitive.attributes.POSITION),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let v=0;v<a.count;v++){const x=read(v,0),y=read(v,1),z=read(v,2),p=[Math.fround(e[0]*x+e[4]*y+e[8]*z+e[12]),Math.fround(e[1]*x+e[5]*y+e[9]*z+e[13]),Math.fround(e[2]*x+e[6]*y+e[10]*z+e[14])];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}const material=json.materials[primitive.material].name;parts.push({mat:{name:material},bounds:{min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]}}});}for(const c of n.children||[])visit(c,world);};
  const sceneRoots=json.scenes[json.scene||0].nodes;
  if(collection)visit(sceneRoots[0],new T.Matrix4());else for(const i of sceneRoots)visit(i,new T.Matrix4());
  sources[key]={key,parts};provenance.push({id,key,sha256:sha256(bytes),parts:parts.map(p=>({material:p.mat.name,bounds:p.bounds}))});
 }
 sources['mature-leaf-broadleaf']={...sources.broadleaf,key:'mature-leaf-broadleaf'};
 return{sources,provenance};
}
export function loadCrownInputs(){
 verifyBroadleafModelInputs();const bytes=fs.readFileSync(new URL('crown-inputs.json',dir));assert.equal(sha256(bytes),broadleafFixture.crownInputsSHA256);const frozen=JSON.parse(bytes),{sources,provenance}=residentCrownSources();assert.deepEqual(provenance,frozen.provenance,'Actual current resident GLB POSITION bounds/transforms match frozen native-replay input');const capture=capturedBroadleafRoster(),trees=capture.trees.map((t,id)=>({...t,id,source:{...sources[t.source],key:t.source,triangles:t.cost},matrix:{elements:t.matrix}}));return{trees,views:frozen.views,capture,provenance,rosterSHA256:frozen.rosterSHA256,nativeReportSHA256:frozen.nativeReportSHA256};
}
