// CPU-only proposal tests: actual source methods, geometry, physics and camera. No native admission.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {register} from 'node:module';
register(new URL('./fixtures/three-workshop-loader.mjs',import.meta.url));
const T=await import('../assets/vendor/three/build/three.module.js');
const {createSolidWorld}=await import('../assets/solid-collisions.js');
const {mergeGeometries}=await import('../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js');
const {createArrivalArt}=await import('../assets/ranch-arrival-art.js');
const {setQuarterPrimitiveUV}=await import('../assets/quarter-surfaces.mjs');
const {createQuarterSignJoinery,planQuarterSignSeat}=await import('../assets/quarter-sign-joinery.mjs');
const baseline=fs.readFileSync(new URL('./fixtures/quarter-sign-before-joinery.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../assets/features/world-quarters.js',import.meta.url),'utf8');
const priorDocument=globalThis.document;
globalThis.document={createElement(){return{width:0,height:0,getContext(){return{fillRect(){},strokeRect(){},fillText(){}};}};}};
test.after(()=>{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;});
const THREE={...T,TextureLoader:class{load(){return new T.Texture();}}};
const section=(s,a,b)=>{assert.equal(s.split(a).length,2,a);const i=s.indexOf(a),j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
let epoch=0;
async function helpers(){const n=++epoch;return{...await import('../assets/regional-workshops.mjs?fixture='+n),...await import('../assets/frostpine-village.mjs?fixture='+n)};}
function seeded(fn){const prior=Math.random;let state=0x4d4c4553,draws=0;Math.random=()=>{draws++;return(state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296;};try{const result=fn();return{result,draws,state};}finally{Math.random=prior;}}
function make(h,candidate=true,{floor=()=>8,failMerge=0,absent=false}={}){
 const scene=new T.Scene(),P={objs:[],draws:0,mergedFrom:0,colliders:0},solidWorld=createSolidWorld({THREE:T}),materials=new Map(),own=o=>(P.objs.push(o),o);
 const mt=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.92}));return materials.get(c);};
 const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,9);
 const put=(g,c,x,y,z,w,ht,d,geo)=>{const m=new T.Mesh(geo,mt(c));m.position.set(x,y,z);m.scale.set(w,ht,d);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const bx=(g,c,x,y,z,w,ht,d)=>put(g,c,x,y,z,w,ht,d,box),cy=(g,c,x,y,z,r,ht)=>put(g,c,x,y,z,r,ht,r,cylinder);
 const W={solidWorld,groundH:(x,z)=>floor(x,z),arrivalArt:createArrivalArt({THREE})};if(absent)W.arrivalArt.buildSign=undefined;
 W.ranchBuilderArt={materials:Object.fromEntries(['aged','oak','iron','steel'].map((k,i)=>[k,mt('#'+String(i+334455))]))};
 W.ranchArchitecture={sidingMaterial:mt('#112233'),roofMaterial:mt('#221133'),materials:new Map([['Ranch | window recess',mt('#111111')]])};
 let cameraCalls=0;W.followCamera={obstacleCount:0,register(root){cameraCalls++;this.obstacleCount+=root.userData.solidParts.length;solidWorld.register(root,{primitives:true});}};
 const workshop=h.createRegionalWorkshopArt({G:{THREE:T,world:W}}),tokens=[],prepare=workshop.prepareBake;workshop.prepareBake=root=>{const token=prepare(root);if(token)tokens.push({...token});return token;};
 let merges=0;const disposed=[];const quarterSigns=createQuarterSignJoinery({THREE:T,W,scene,own,setQuarterPrimitiveUV,mergeGeometries(gs,g){if(failMerge&&++merges===failMerge)throw Error('injected private merge failure');const out=mergeGeometries(gs,g);out?.addEventListener('dispose',()=>disposed.push(out.uuid));return out;}});
 const code=candidate?section(source,' function indexed(g){',' const G_BOX=')+section(source,' function bake(g,shadow,prepared=false){',' /* Anything that repeats.')+section(source,' function signboard(','\n /* ================= 6.'):baseline;
 const kit=new Function('THREE','W','scene','P','workshop','own','mergeGeometries','setQuarterPrimitiveUV','mt','cy','bx','quarterSigns',code+';return{bake,signboard};')(THREE,W,scene,P,workshop,own,mergeGeometries,setQuarterPrimitiveUV,mt,cy,bx,quarterSigns);
 return{...kit,scene,P,W,solidWorld,quarterSigns,workshop,tokens,disposed,get cameraCalls(){return cameraCalls;},box,bx};
}
async function build(candidate,{route='plain',count=1,shared=false,finalize=true,...options}={}){const h=await helpers();return seeded(()=>{
 const k=make(h,candidate,options),g=new T.Group();g.position.set(300,8,-300);g.rotation.y=-.7;k.scene.add(g);
 const before=k.bx(g,'#ffeedd',-8,.8,0,1,1,.4);before.name='retained-before';
 const signs=[];for(let i=0;i<count;i++){const r=new T.Group();k.signboard(r,'SITE '+i,3.6+i*.1);r.position.set(i*12,0,0);r.rotation.y=i*.2;g.add(r);signs.push(r);}
 const after=k.bx(g,shared?'#6b5334':'#aaccbb',-9,.8,0,1,1,.4);after.name='retained-after';
 if(route.includes('workshop')){const q=new T.Group(),geo=new T.BoxGeometry(1,1,1),mat=new T.MeshStandardMaterial();for(let i=0;i<12;i++)q.add(new T.Mesh(geo,mat));g.add(q);k.tokens.length=0;/* actual wrapper triggers on the queued original group */k.workshopQueue=q;}
 // Reconstruct the real workshop queue from its returned installer through a small fixture hook below.
 const marker=route.includes('workshop')?g.children.find(o=>o.children.length===12):null;
 if(marker)k.workshop.queue(marker,'mill');
 g.updateMatrixWorld(true);const matrices=signs.map(r=>r.matrixWorld.elements.slice()),ids=signs.map(r=>({root:r.uuid,children:r.children.slice()}));
 const budget=route.includes('frost')?h.frostpineBakeBudget(g):null;
 const meshes=budget?h.frostpinePrivateResources(()=>k.bake(g,true)):k.bake(g,true);if(budget)for(let i=0;i<budget.randomDraws;i++)Math.random();
 const preFinalizeDrawsMarker=new T.Mesh(k.box,after.material).uuid;
 const stats=candidate&&finalize?k.quarterSigns.finalize():null;
 const sentinel=new T.Mesh(k.box,after.material).uuid;
 return{...k,signs,matrices,ids,meshes,budget,stats,sentinel,preFinalizeDrawsMarker};
 });}
for(const route of['plain','workshop','frost','workshop-frost'])for(const count of[1,2])test('actual extracted bake preserves source constructors, later UUID slots and ambient RNG: '+route+'/'+count,async()=>{
 const a=await build(false,{route,count}),b=await build(true,{route,count});assert.equal(b.draws,a.draws);assert.equal(b.state,a.state);assert.equal(b.result.preFinalizeDrawsMarker,a.result.preFinalizeDrawsMarker);assert.equal(b.result.sentinel,a.result.sentinel);assert.deepEqual(b.result.budget,a.result.budget);assert.deepEqual(b.result.tokens,a.result.tokens);
 assert.equal(a.result.meshes.length-b.result.meshes.length,count+1,'Only omitted text bins and sign-only timber bin disappear');
 const retain=k=>k.meshes.filter(m=>m.material.color.getHexString()!=='6b5334'&&!m.material.map).map(m=>[m.material.uuid,m.uuid,m.geometry.uuid]);assert.deepEqual(retain(b.result),retain(a.result));
 assert.equal(b.result.stats.finalized,count);assert.equal(b.result.stats.errors.length,0);assert.equal(b.result.cameraCalls,count);assert.equal(b.result.solidWorld.stats().parts,count*4);assert.equal(b.result.solidWorld.stats().owners,count);
 for(const[i,r]of b.result.signs.entries()){assert.equal(r.parent,b.result.scene);assert.deepEqual(r.matrixWorld.elements,b.result.matrices[i]);assert.equal(r.uuid,b.result.ids[i].root);assert.equal(r.children.length,2);assert.equal(r.userData.solidParts.length,4);assert.equal(r.userData.quarterSign.status,'final-static-body-and-camera');assert.equal(r.userData.quarterSign.plan.supportQueries<=2048,true);}
 const prior=b.result.cameraCalls;b.result.quarterSigns.finalize();assert.equal(b.result.cameraCalls,prior);
});
test('retained shared timber bin keeps its geometry/Mesh UUIDs at the original slot',async()=>{const a=await build(false,{shared:true}),b=await build(true,{shared:true});assert.equal(a.draws,b.draws);assert.equal(a.state,b.state);assert.equal(a.result.meshes.length-b.result.meshes.length,1);const pick=k=>k.meshes.find(m=>m.material.color.getHexString()==='6b5334');assert.equal(pick(a.result).uuid,pick(b.result).uuid);assert.equal(pick(a.result).geometry.uuid,pick(b.result).geometry.uuid);});
test('actual original early source/root pose survives two-mesh private final build; independent post bases follow late support',async()=>{
 let raised=false;const floor=(x,z)=>8+(raised?1.1:0)+.1*(x-300)+.04*(z+300);const k=(await build(true,{finalize:false,floor})).result;const before=k.signs[0].matrixWorld.elements.slice(),prior=Math.random;raised=true;const s=k.quarterSigns.finalize();assert.equal(Math.random,prior);assert.equal(s.finalized,1);assert.deepEqual(k.signs[0].matrixWorld.elements,before);const r=k.signs[0],p=r.userData.quarterSign.plan;assert(p.postBaseY[0]!==p.postBaseY[1]);assert(p.minimumSampledBoardClearance>=.319999999999);assert(p.rise>1);for(let i=0;i<2;i++){const part=r.userData.solidParts.find(b=>Math.abs(b.matrix[12]-p.postX[i])<1e-12),m=part.matrix;const low=m[13]+m[5]*part.min[1];assert(Math.abs(low-p.postBaseY[i])<1e-12);const x=p.samples.find(s=>s.localX===p.postX[i]&&s.localZ===0);assert(Math.abs(before[13]+low-x.y+.015)<1e-12);}
});
test('finite floor preparation failure preserves original five visible meshes and creates no fake floor or contact',async()=>{
 let valid=true;const k=(await build(true,{finalize:false,floor:()=>valid?8:NaN})).result;valid=false;const prior=Math.random,s=k.quarterSigns.finalize(),r=k.signs[0];assert.equal(Math.random,prior);assert.equal(s.retained,1);assert.equal(s.finalized,0);assert.equal(s.errors.length,0);assert.equal(r.parent,k.scene);assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().parts,0);let visible=0;r.traverse(o=>{if(o.isMesh&&o.visible)visible++;});assert.equal(visible,5);assert.equal(r.userData.quarterSign.status,'retained-original-render-only');assert.equal(k.W.groundSurfaces,undefined);assert.equal(k.quarterSigns.finalRoots().length,0);
});
test('failed second private merge disposes first result, restores RNG, and retains source render without camera/body',async()=>{
 const k=(await build(true,{finalize:false,failMerge:2})).result,prior=Math.random,s=k.quarterSigns.finalize();assert.equal(Math.random,prior);assert.equal(s.retained,1);assert.equal(k.disposed.length,1);assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().owners,0);assert.equal(s.records[0].reason,'injected private merge failure');
});
test('source child-transform mutation rejects without reparenting, clearing, resetting or registering unknown ownership',async()=>{
 const k=(await build(true,{finalize:false})).result,r=k.signs[0],parent=r.parent,children=r.children.slice();r.children[1].position.x+=.1;r.updateWorldMatrix(true,true);const matrix=r.children[1].matrix.elements.slice(),s=k.quarterSigns.finalize();assert.equal(s.finalized,0);assert.equal(s.retained,0);assert.equal(s.errors[0].phase,'source-identity');assert.equal(s.records[0].status,'rejected-source-changed-no-mutation');assert.equal(r.parent,parent);assert.deepEqual(r.children,children);assert.deepEqual(r.children[1].matrix.elements,matrix);assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().owners,0);
});
test('partial static camera publication is surfaced as irreversible failure and never falsely retried/rolled back',async()=>{
 const k=(await build(true,{finalize:false})).result;let calls=0;k.W.followCamera.register=root=>{calls++;k.W.followCamera.obstacleCount++;throw Error('injected partial camera publication');};const s=k.quarterSigns.finalize(),r=k.signs[0];assert.equal(s.finalized,0);assert.equal(s.errors[0].phase,'irreversible-static-camera-registration');assert.equal(s.errors[0].rollbackClaimed,false);assert.equal(r.userData.quarterSign.status,'registration-failed-no-retry');assert.equal(r.children.length,2);assert.equal(calls,1);k.quarterSigns.finalize();assert.equal(calls,1);
});
test('absent buildSign is neither omitted nor promoted; original source fallback constructor/RNG path stays exact',async()=>{const a=await build(false,{absent:true}),b=await build(true,{absent:true});assert.equal(a.draws,b.draws);assert.equal(a.state,b.state);assert.equal(a.result.sentinel,b.result.sentinel);assert.equal(b.result.stats.captured,0);assert.equal(b.result.stats.finalized,0);assert.equal(a.result.meshes.length,b.result.meshes.length);});
test('bounded planner rejects excessive rise, nonfinite/tilted pose and excessive requested clearance',()=>{const m=new T.Matrix4().elements;assert.throws(()=>planQuarterSignSeat({matrixWorld:m,width:3.6,groundH:()=>3}),/unadmitted/);assert.throws(()=>planQuarterSignSeat({matrixWorld:m,width:3.6,groundH:()=>NaN}),/not finite/);assert.throws(()=>planQuarterSignSeat({matrixWorld:m,width:3.6,groundH:()=>0,clearance:4}),/required/);const tilt=new T.Matrix4().makeRotationX(.1).elements;assert.throws(()=>planQuarterSignSeat({matrixWorld:tilt,width:3.6,groundH:()=>0}),/Upright/);const p=planQuarterSignSeat({matrixWorld:m,width:3.6,groundH:()=>0,clearance:.4});assert(Math.abs(p.minimumSampledBoardClearance-.41)<1e-12);});
test('source integration orders finalization after actual Willow/Frost support and uses exactly one registration owner',()=>{
 const willow=source.indexOf('P.willowmereArt=buildWillowmereArt'),frost=source.indexOf('W.groundSurfaces.push(P.frostpineArt.supportAt)'),finish=source.indexOf('P.signJoinery=quarterSigns.finalize()');assert(willow>=0&&frost>willow&&finish>frost);assert(!section(source,' function signboard(','\n /* ================= 6.').includes('register('));const helper=fs.readFileSync(new URL('../assets/quarter-sign-joinery.mjs',import.meta.url),'utf8');assert.equal(helper.split('W.followCamera.register(r.root)').length,2);assert(!helper.includes('solidWorld.register('));assert(!helper.includes('groundSurfaces.push'));assert(source.includes("quarter-sign-joinery.mjs?v=quarter-sign-final-support-4"));
});

test('owner publication failure before camera is surfaced without disposing published geometry or claiming rollback',async()=>{const k=(await build(true,{finalize:false})).result;const add=k.scene.add;k.scene.add=()=>{throw Error('injected owner publication failure');};const s=k.quarterSigns.finalize(),r=k.signs[0];assert.equal(s.errors[0].phase,'irreversible-static-owner-publication');assert.equal(s.errors[0].rollbackClaimed,false);assert.equal(s.finalized,0);assert.equal(s.retained,0);assert.equal(r.userData.quarterSign.status,'owner-publication-failed-no-retry');assert.equal(r.children.length,2);assert.equal(k.disposed.length,0);assert.equal(k.cameraCalls,0);k.scene.add=add;k.quarterSigns.finalize();assert.equal(k.cameraCalls,0);});

test('five historical native2 source poses and 35 actual floor nodes clear in an explicitly conservative observed-node fixture',async()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./fixtures/quarter-sign-native2-nodes.json',import.meta.url))),sites=data.sites,h=await helpers();
 const floor=(x,z)=>{const q=sites.reduce((a,b)=>Math.hypot(x-a.matrix[12],z-a.matrix[14])<Math.hypot(x-b.matrix[12],z-b.matrix[14])?a:b);return q.nodes.find(n=>Math.hypot(x-n.x,z-n.z)<1e-9)?.y??q.fillBetweenRecordedNodes;};
 const k=make(h,true,{floor}),g=new T.Group();k.scene.add(g);const roots=[];
 for(const q of sites){const r=new T.Group();k.signboard(r,q.text,q.width);r.matrixAutoUpdate=false;r.matrix.fromArray(q.matrix);g.add(r);roots.push(r);}
 g.updateMatrixWorld(true);k.bake(g,true);const stats=k.quarterSigns.finalize();assert.equal(stats.finalized,5);assert.equal(stats.errors.length,0);assert.equal(k.W.followCamera.obstacleCount,20);assert.equal(k.solidWorld.stats().parts,20);assert.equal(k.solidWorld.stats().owners,5);
 for(const[i,r]of roots.entries()){const q=sites[i],p=r.userData.quarterSign.plan;assert.deepEqual(r.matrixWorld.elements,q.matrix);assert.equal(r.children.length,2);for(const n of q.nodes.filter(n=>n.localX===0)){const point=new T.Vector3(n.x,0,n.z),before=point.toArray();assert.equal(k.solidWorld.resolve(point,{bottom:n.y+.38,top:n.y+2.65,radius:.55}),0);assert.deepEqual(point.toArray(),before);assert(q.matrix[13]+p.boardBottomY-n.y-2.65>=.31);}
 for(const n of q.nodes.filter(n=>n.localX!==0)){const part=r.userData.solidParts.find(b=>Math.abs(b.matrix[12]-n.localX)<1e-9),bottom=q.matrix[13]+part.matrix[13]+part.matrix[5]*part.min[1];assert(Math.abs(bottom-n.y+.015)<1e-10);}}
});

test('original sign constructors remain byte-exact apart from metadata capture and finalizer records incomplete five-owner admission',()=>{const actual=section(source,' function signboard(','\n /* ================= 6.').replace('  quarterSigns.capture(g,text,w);\n','');const old=baseline.slice(baseline.indexOf(' function signboard('));assert.equal(actual.trim(),old.trim());assert(source.includes('P.signJoinery.captured!==5||P.signJoinery.finalized!==5'));});

test('support callback mutation followed by nonfinite failure rejects original root without resetting/reparenting it',async()=>{
 let mutate=null;const k=(await build(true,{finalize:false,floor:()=>{if(mutate){const f=mutate;mutate=null;f();return NaN;}return 8;}})).result,r=k.signs[0],parent=r.parent,children=r.children.slice();mutate=()=>{r.position.x+=.25;};const changed=r.position.x+.25,s=k.quarterSigns.finalize();assert.equal(r.position.x,changed);assert.equal(r.parent,parent);assert.deepEqual(r.children,children);assert.equal(r.matrixAutoUpdate,true);assert.equal(s.retained,0);assert.equal(s.finalized,0);assert.equal(s.errors[0].phase,'source-identity');assert.equal(s.records[0].status,'rejected-source-changed-no-mutation');assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().owners,0);
});
test('merge callback source mutation plus thrown preparation failure rejects without graph overwrite or hidden retention',async()=>{
 const h=await helpers(),k=make(h,true),g=new T.Group(),r=new T.Group();k.scene.add(g);k.signboard(r,'MUTATING MERGE',3.6);r.position.y=8;g.add(r);g.updateMatrixWorld(true);k.bake(g,true);const parent=r.parent,children=r.children.slice(),geometry=children[1].geometry,clone=geometry.clone;geometry.clone=function(){r.position.z+=.5;throw Error('source-mutating clone failure');};const z=r.position.z+.5,s=k.quarterSigns.finalize();geometry.clone=clone;assert.equal(r.position.z,z);assert.equal(r.parent,parent);assert.deepEqual(r.children,children);assert.equal(s.retained,0);assert.equal(s.errors[0].phase,'source-identity');assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().parts,0);
});

test('final support recheck callback mutation with equal finite heights is rejected at the last publication boundary',async()=>{let mutate=null,queries=0;const k=(await build(true,{finalize:false,floor:()=>{queries++;if(mutate&&queries===196){mutate();}return 8;}})).result,r=k.signs[0],parent=r.parent,children=r.children.slice(),x=r.position.x+.4;mutate=()=>{r.position.x=x;};queries=0;const s=k.quarterSigns.finalize();assert(queries>=196);assert.equal(r.position.x,x);assert.equal(r.parent,parent);assert.deepEqual(r.children,children);assert.equal(s.retained,0);assert.equal(s.finalized,0);assert.equal(s.errors[0].phase,'source-identity');assert.equal(k.cameraCalls,0);assert.equal(k.solidWorld.stats().parts,0);});
