import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.env.HOLLOWPEAK_UPPER_SOURCE_ROOT||new URL('../',import.meta.url).pathname,dependencies=process.env.HOLLOWPEAK_UPPER_DEPENDENCY_ROOT||root,read=f=>fs.readFileSync(path.join(dependencies,f)),sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=fs.readFileSync(path.join(root,'assets/world-photoscans.js'),'utf8');
const changes=[
 {before:'',after:"import {planUpperHollowpeakTreeRoots,retireUpperHollowpeakTrees} from './hollowpeak-upper-tree-roots.mjs?v=hollowpeak-upper-source-roots-1';\n"},
 {before:'',after:'      const upperPlan=planUpperHollowpeakTreeRoots(t,W.terrainH,{terrainStep:W.terrainStep});\n      if(upperPlan){t.upperHollowpeakRootPlan=upperPlan;if(upperPlan.action===\'fit\')t.matrix.elements[13]=upperPlan.fittedY;}\n'},
 {before:'',after:'    state.hollowpeakUpperTrees=retireUpperHollowpeakTrees(G,trees,zero);\n'},
 {before:'    if(state.hollowpeakCliffFlora.retired.length){',after:'    if(state.hollowpeakCliffFlora.retired.length||state.hollowpeakUpperTrees.retired.length){'},
];
function inverse(source){let result=source;for(const e of changes.toReversed()){assert.equal(result.split(e.after).length-1,1,'One exact V6 tree integration edit required');result=result.replace(e.after,e.before);}return result;}
const parent=inverse(runtime),declaration=read('tools/fixtures/final-environment-a129adc/source-contract.json');assert.equal(sha(declaration),'71710bb110a40fec5739b6aa61e817103406acb2925fdada2300c315dc292003');const contract=JSON.parse(declaration),proof={scope:'Current accepted pre-V6 photoscan cohort only. Original historical root-seating tests and fixtures are unchanged.',runtimeSHA256:sha(runtime),currentParentSHA256:sha(parent),declaredCurrentParentSHA256:contract.files['assets/world-photoscans.js'].afterSHA256,exactV6Edits:changes.length};

test('four counted upper-root edits recover the complete declared current parent without rewriting historical goldens',()=>{
 assert.equal(sha(parent),contract.files['assets/world-photoscans.js'].afterSHA256);let rebuilt=parent;for(const e of changes){if(e.before)rebuilt=rebuilt.replace(e.before,e.after);else if(e===changes[0])rebuilt=e.after+rebuilt;else if(e===changes[1])rebuilt=rebuilt.replace('      if(rootSeating){t.matrix.elements[13]=rootSeating.fittedY;t.rootSeating=rootSeating;}\n','$&'+e.after);else rebuilt=rebuilt.replace('    state.hollowpeakCliffFlora=retireSteepFallsFloraTrees(G,trees,zero);',e.after+'    state.hollowpeakCliffFlora=retireSteepFallsFloraTrees(G,trees,zero);');}assert.equal(rebuilt,runtime);
 for(const e of changes)assert.throws(()=>inverse(runtime.replace(e.after,'')),/One exact V6 tree integration edit required/);assert.throws(()=>inverse(changes[0].after+runtime),/One exact V6 tree integration edit required/);
 const protectedFixtures=Object.entries(contract.parentFixtureSHA256).filter(([f])=>f.startsWith('tools/fixtures/hollowpeak-root-seating-0ba4900/'));assert.equal(protectedFixtures.length,4);for(const[f,h]of protectedFixtures)assert.equal(sha(read(f)),h,'Original root-seating fixture remains exact: '+f);
});

test('current actual fit is in the shared-matrix loop before every cell/card/full owner',()=>{
 assert.equal(runtime.indexOf(changes[0].after),0);const start=runtime.indexOf('    for(const t of trees){\n      const scale=t.height/t.source.meta.sourceHeight,crownWidth=t.crownWidth||1;'),end=runtime.indexOf("    if(edge.trees.length&&typeof G.followCam?.invalidateTrees!=='function')",start),loop=runtime.slice(start,end);assert.ok(start>=0&&end>start);assert.equal(loop.split(changes[1].after).length-1,1);assert.ok(loop.indexOf(changes[1].after)>loop.indexOf('if(rootSeating){t.matrix.elements[13]=rootSeating.fittedY;t.rootSeating=rootSeating;}'));assert.ok(runtime.indexOf('const cells=new Map();for(const t of trees)',end)>end);
});

test('retirement remains in the settled source-ownership callback and refreshes normal LOD/camera/shade owners',()=>{
 const start=runtime.indexOf('  state.floraRetirementReady=Promise.resolve().then(()=>Promise.allSettled([state.ready,G.worldDetails?.ready,G.undergrowth?.ready])).then(()=>{'),end=runtime.indexOf('  // Preserve the original planner',start),callback=runtime.slice(start,end);assert.ok(start>=0&&end>start);assert.equal(callback.split(changes[2].after).length-1,1);assert.ok(callback.indexOf(changes[2].after)<callback.indexOf('state.hollowpeakCliffFlora=retireSteepFallsFloraTrees(G,trees,zero);'));assert.equal(callback.split(changes[3].after).length-1,1);assert.ok(callback.includes("scene.getObjectByName('Pasture terrain')?.material.userData.setTrees?.(W.forestPoints);"));assert.ok(callback.includes('G.followCam.invalidateTrees();previousMode=null;updateTrees();'));
 if(process.env.HOLLOWPEAK_UPPER_INTEGRATION_AUDIT)fs.writeFileSync(process.env.HOLLOWPEAK_UPPER_INTEGRATION_AUDIT,JSON.stringify(proof,null,2)+'\n');
});
