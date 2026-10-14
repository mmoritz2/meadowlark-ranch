import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {register} from 'node:module';
// Match the resident import map before evaluating the raw current runtime module.
register('./broadleaf-depth-cpu-loader.mjs',import.meta.url);
const {selectMiddleCrownModels}=await import('../assets/world-photoscans.js');
import {loadCrownInputs,rawBroadleafSource,historicalParentComparison,broadleafSourceEdits} from './broadleaf-depth-test-fixture.mjs';
const source=rawBroadleafSource(),historical=historicalParentComparison(source),parent=historical.source,edits=broadleafSourceEdits,sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const rosterBytes=fs.readFileSync(new URL('./fixtures/broadleaf-depth-60cb73c/actual-tree-roster.json',import.meta.url)),capture=JSON.parse(JSON.stringify(loadCrownInputs().capture));
const inputs=loadCrownInputs(),authored=Object.values(capture.authoredTriangles).reduce((a,b)=>a+b,0),trees=inputs.trees.map(t=>({...t,tint:new T.Color(.7,.8,.5)}));
const report={scope:'CPU executes exact current and candidate updateTrees closures with actual captured source costs/placements and upload recorders. No renderer or native frame claim.',parentSHA256:sha(parent),candidateSHA256:sha(source),rosterSHA256:sha(rosterBytes),rosterCount:trees.length,frames:0,nearExact:0,planningExact:0,tierSwitches:0,xrFrames:0,retiredTransitions:0,maxHighTriangles:0,maxOtherTriangles:0,changedMiddleFrames:0};
function create(code){
 const a=code.indexOf('  let previousSelection=new Set()'),b=code.indexOf('  state.ready=(async()=>{',a);assert(a>=0&&b>a);
 const factory=new Function('THREE','H','G','state','trees','treeMeshes','treeCards','renderer','WHITE','selectMiddleCrownModels',code.slice(a,b)+';return{update:updateTrees,near:()=>[...previousNearSelection],planning:()=>[...previousMiddleSelection],middle:()=>typeof previousCrownSelection===\'undefined\'?[...previousMiddleSelection]:[...previousCrownSelection],selected:()=>[...previousSelection]};');
 let tier='high';const H={player:{pos:new T.Vector3(),heading:0}},direction=new T.Vector3(0,0,1),G={gfx:{get:()=>tier},camera:{projectionMatrix:new T.Matrix4().makePerspective(-.156,.156,.1,-.1,.1,5000),matrixWorldInverse:new T.Matrix4(),getWorldDirection:v=>v.copy(direction)}},renderer={xr:{isPresenting:false}},state={villageEvergreens:{triangles:authored}};
 function mesh(records){return{count:records.length,material:{name:'audit_leaves'},matrices:[],colors:[],setMatrixAt(i,m){this.matrices[i]=m;},setColorAt(i,c){this.colors[i]=c;},instanceMatrix:{},instanceColor:{},computeBoundingSphere(){}};}
 const groups=[...new Set(trees.map(t=>t.source.key))].map(key=>trees.filter(t=>t.source.key===key)),models=groups.map(records=>({records,mesh:mesh(records)})),cards=groups.map(records=>({records,mesh:mesh(records)}));
 const api=factory(T,H,G,state,trees,models,cards,renderer,new T.Color(1,1,1),selectMiddleCrownModels),updaterSHA256=sha(api.update.toString());
 return {api,state,updaterSHA256,step({x,z,heading,quality,xr}){tier=quality;H.player.pos.set(x,0,z);H.player.heading=heading;direction.set(Math.sin(heading),0,Math.cos(heading));const eye=new T.Vector3(x,8,z),target=eye.clone().add(direction);G.camera.matrixWorldInverse.copy(new T.Matrix4().lookAt(eye,target,new T.Vector3(0,1,0)).setPosition(eye)).invert();renderer.xr.isPresenting=xr;const random=Math.random;Math.random=()=>{throw Error('Ambient RNG during updater');};try{api.update();}finally{Math.random=random;}
 const set=new Set(api.selected());assert.equal(set.size,api.selected().length);for(const [list,full]of[[models,true],[cards,false]])for(const{records,mesh}of list){const want=records.filter(t=>full?set.has(t):!t.retiredFallsFlora&&!set.has(t));assert.equal(mesh.count,want.length);for(let i=0;i<want.length;i++)assert.equal(mesh.matrices[i],want[i].matrix);assert.equal(mesh.castShadow,!xr);}
 assert.equal(state.activeTreeTriangles,authored+api.selected().reduce((n,t)=>n+t.source.triangles,0));assert(state.activeTreeTriangles<=state.treeTriangleBudget);assert(state.activeNearTrees<=(quality==='high'?12:quality==='low'?4:6));assert(state.activeMiddleTrees<=(quality==='high'?14:quality==='low'?6:10));assert(api.selected().every(t=>!t.retiredFallsFlora));if(xr)assert.equal(api.selected().length,0);return api.selected();}};
}
test('current source inverse and all five changes exactly bind the frozen prototype',()=>{assert.equal(sha(parent),edits.beforeSHA256);assert.equal(sha(source),edits.afterSHA256);assert.equal(edits.changes.length,5);let restored=source;for(const c of edits.changes.toReversed()){assert.equal(restored.split(c.after).length-1,1);restored=restored.replace(c.after,c.before);}assert.equal(restored,parent);});
test('actual 2818-tree roster preserves original near and planning histories through moving cameras quality changes retirement and XR',()=>{
 const a=create(historical.updater+'  state.ready=(async()=>{'),b=create(source),before=JSON.stringify(trees);report.parentUpdaterSHA256=a.updaterSHA256;report.candidateUpdaterSHA256=b.updaterSHA256;const retired=new Map();let previousTier;
 for(let i=0;i<220;i++){
  for(const[t,v]of retired)t.retiredFallsFlora=v;retired.clear();if(i%19===8){for(const t of a.api.near().slice(0,2)){retired.set(t,t.retiredFallsFlora);t.retiredFallsFlora=true;report.retiredTransitions++;}}
  const centers=[[65,-145],[74,249],[-7,10],[-250,100]],base=centers[Math.floor(i/55)],heading=i*.19,quality=['high','medium','low'][Math.floor(i/11)%3],xr=i%65>=60&&i%65<=63;if(previousTier!==quality)report.tierSwitches++;previousTier=quality;
  const input={x:base[0]+Math.sin(i*.13)*12,z:base[1]+Math.cos(i*.09)*10,heading,quality,xr};a.step(input);b.step(input);assert.deepEqual(b.api.near(),a.api.near());assert.deepEqual(b.api.planning(),a.api.planning());report.frames++;report.nearExact++;report.planningExact++;if(xr)report.xrFrames++;if(b.api.middle().some(t=>!a.api.middle().includes(t)))report.changedMiddleFrames++;const key=quality==='high'?'maxHighTriangles':'maxOtherTriangles';report[key]=Math.max(report[key],b.state.activeTreeTriangles);
 }
 for(const[t,v]of retired)t.retiredFallsFlora=v;assert.equal(JSON.stringify(trees),before);assert(report.retiredTransitions>0&&report.xrFrames>0&&report.changedMiddleFrames>0);
});
process.on('exit',()=>{if(process.env.BROADLEAF_DEPTH_HISTORY_AUDIT_OUTPUT)fs.writeFileSync(process.env.BROADLEAF_DEPTH_HISTORY_AUDIT_OUTPUT,JSON.stringify(report,null,2)+'\n');});
