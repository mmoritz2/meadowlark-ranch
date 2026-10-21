import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,hash} from './snowpeak-boulder-fixture.mjs';
import {replaceSnowpeakBoulderContact as apply} from '../assets/snowpeak-boulder-contact.mjs';
import {install as installCandidate} from '../assets/features/course-clear.js';
// Control is the CURRENT source with only this optional wrapper inverted.
// No legacy HTML/file checkout or duplicated clearing algorithm is committed.
const clearSource=fs.readFileSync(new URL('../assets/features/course-clear.js',import.meta.url),'utf8');
const beforeHook=" function clear(routes){\n  const boulderContact=G.photoscans?.snowpeakBoulderContact;\n  boulderContact?.beforeCourseClear?.();\n  try{";
const afterHook="  stats.ms=Math.round(performance.now()-t0);\n  }finally{boulderContact?.afterCourseClear?.();}\n }";
assert.equal(clearSource.split(beforeHook).length-1,1);assert.equal(clearSource.split(afterHook).length-1,1);
const parentSource=clearSource.replace(beforeHook,' function clear(routes){').replace(afterHook,'  stats.ms=Math.round(performance.now()-t0);\n }');
const {install:installOriginal}=await import('data:text/javascript;base64,'+Buffer.from(parentSource).toString('base64'));
function world(){
 const f=fixture();f.G.tables={RACE_ROUTES:{lane:[[-220,-300],[-220,-280]]},EVENTS3:[]};f.G.on=()=>{};
 return f;
}
function bridge(f){
 const text=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8'),begin=text.indexOf('  state.installSnowpeakBoulderContact='),end=text.indexOf('  let youngOuterSources',begin),state={};
 new Function('state','outerRockParts','replaceSnowpeakBoulderContact','G',text.slice(begin,end))(state,[null,null,null,f.piece],apply,f.G);f.G.photoscans=state;return()=>state.installSnowpeakBoulderContact({source:f.source,runtime:f.runtime});
}
const snapshot=f=>{const{ms,...stats}=f.G.courseClear.stats;return{stats,circles:f.world.colliders.map(c=>({...c})),visible:f.mesh.visible,positionBytes:hash(new Uint8Array(f.mesh.geometry.attributes.position.array.buffer)),surfaces:f.solidWorld.surfaceStats(),support:f.groundSurfaces.length};};
test('initial actual course clear with absent hooks retains original behavior',()=>{
 const prior=globalThis.window;globalThis.window={};try{const a=world(),b=world();installOriginal(a.G);installCandidate(b.G);assert.deepEqual(snapshot(a),snapshot(b));assert.equal(a.G.courseClear.courseDist(-220,-290),b.G.courseClear.courseDist(-220,-290));}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('actual rebuild restores original before source rules; repeated retained/cleared rebuilds leak no contact/resources',()=>{
 const prior=globalThis.window;globalThis.window={};try{
  const f=world(),original=f.mesh.geometry,material=f.mesh.material,install=bridge(f);installCandidate(f.G);let s=install();assert.equal(s.status,'applied-same-mesh-triangle-body-support');
  let disposed=0,beforeChecks=0,afterChecks=0;
  f.G.worldPaths={fieldWallArt:{beforeCourseClear(){beforeChecks++;assert.equal(f.mesh.geometry,original);assert.equal(f.mesh.material,material);assert.equal(f.circle.precise,undefined);assert.equal(f.solidWorld.surfaceStats().triangles,0);assert.equal(f.groundSurfaces.length,0);},afterCourseClear(){afterChecks++;assert.equal(f.mesh.geometry,original);assert.equal(f.solidWorld.surfaceStats().triangles,0);assert.equal(f.groundSurfaces.length,0);}}};
  for(let i=0;i<3;i++){
   s.geometry.addEventListener('dispose',()=>disposed++);f.G.courseClear.rebuild();s=f.G.photoscans.snowpeakBoulderContact;assert.equal(s.status,'applied-same-mesh-triangle-body-support');assert.equal(f.solidWorld.surfaceStats().triangles,4499);assert.equal(f.groundSurfaces.length,1);assert.equal(f.world.colliders.filter(c=>c===f.circle).length,1);
  }
  assert.equal(disposed,3);assert.equal(beforeChecks,3);assert.equal(afterChecks,3);
  s.geometry.addEventListener('dispose',()=>disposed++);
  const{x,z}=f.mesh.position;f.G.tables.RACE_ROUTES.lane=[[x-10,z],[x+10,z]];f.G.courseClear.rebuild();
  assert.equal(f.mesh.geometry,original);assert.equal(f.mesh.material,material);assert.equal(f.mesh.visible,false);assert(!f.world.colliders.includes(f.circle));assert.equal(f.solidWorld.surfaceStats().triangles,0);assert.equal(f.groundSurfaces.length,0);assert.equal(f.G.photoscans.snowpeakBoulderContact.status,'retained-original');assert.equal(disposed,4);
  f.G.courseClear.rebuild();assert.equal(f.solidWorld.surfaceStats().triangles,0);assert.equal(f.groundSurfaces.length,0);assert.equal(disposed,4);
 }finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('course clear finally restores admitted contact after an existing source callback throws',()=>{
 const prior=globalThis.window;globalThis.window={};try{const f=world(),install=bridge(f);installCandidate(f.G);install();f.world.grassSubmission={restoreAll(){throw Error('existing clear failed');}};assert.throws(()=>f.G.courseClear.rebuild(),/existing clear failed/);assert.equal(f.G.photoscans.snowpeakBoulderContact.status,'applied-same-mesh-triangle-body-support');assert.equal(f.solidWorld.surfaceStats().triangles,4499);assert.equal(f.groundSurfaces.length,1);assert.equal(f.circle.precise,true);}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('rollback failure prevents actual clear from consuming a non-original owner',()=>{
 const prior=globalThis.window;globalThis.window={};try{const f=world(),install=bridge(f);installCandidate(f.G);const s=install(),geometry=s.geometry;let clearRead=false;f.world.grassSubmission={restoreAll(){clearRead=true;}};s.rollback=()=>{throw Error('rollback failed before clear');};assert.throws(()=>f.G.courseClear.rebuild(),/rollback failed before clear/);assert.equal(clearRead,false);assert.equal(f.mesh.geometry,geometry);assert.equal(f.solidWorld.surfaceStats().triangles,4499);assert.equal(f.groundSurfaces.length,1);}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('unrelated collider splice changes index without breaking owner rollback/rebuild',()=>{
 const prior=globalThis.window;globalThis.window={};try{const f=world(),install=bridge(f);installCandidate(f.G);const s=install();assert.equal(s.circleIndex,1);f.world.colliders.splice(0,1);assert.equal(f.world.colliders.indexOf(f.circle),0);f.G.courseClear.rebuild();const next=f.G.photoscans.snowpeakBoulderContact;assert.equal(next.status,'applied-same-mesh-triangle-body-support');assert.equal(next.circleIndex,0);assert.equal(f.world.colliders.length,2);assert.equal(f.solidWorld.surfaceStats().triangles,4499);assert.equal(f.groundSurfaces.length,1);}finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('external source-circle removal cleans owned contact without resurrecting pruned records',()=>{
 const f=fixture(),s=apply(f);f.world.colliders.splice(f.world.colliders.indexOf(f.circle),1);s.rollback();assert(!f.world.colliders.includes(f.circle));assert.equal(f.circle.precise,undefined);assert.equal(f.solidWorld.surfaceStats().triangles,0);assert.equal(f.groundSurfaces.length,0);assert.equal(f.mesh.geometry,s.before.geometry);
});
