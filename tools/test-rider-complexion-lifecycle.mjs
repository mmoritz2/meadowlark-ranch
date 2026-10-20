import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';

const runtime=process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const topSource=readFileSync(path.join(runtime,'assets/rider-model.js'),'utf8');
const url=(file,query='')=>pathToFileURL(path.join(runtime,file)).href+query;
const T=await import(url('assets/vendor/three/build/three.module.js'));
const lifecycleURL=url('assets/rider-material-lifecycle.js','?v=character-polish-20261009');
const {createRiderMaterialLifecycle,riderMaterialLifecycle15}=await import(lifecycleURL);
const {createRiderAOReception}=await import(url('assets/rider-ao-reception.js','?v=character-polish-20261009'));
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');

// Use the actual production entry point, complexion finish, lifecycle and AO
// receiver. Only the asset-heavy inner construction and hair fitting are stubs.
const baseURL=moduleURL(`
import {riderMaterialLifecycle15} from ${JSON.stringify(lifecycleURL)};
export function createRiderLibrary(options){
 const lifecycle=options.riderMaterialLifecycle||riderMaterialLifecycle15;
 return {materialLifecycle:lifecycle,build(kit){
  const rig=options.makeTestRig(kit),result=lifecycle.trackRig(rig);
  options.afterInnerBuild(result,lifecycle);return result;
 }};
}`);
const hairURL=moduleURL(`
export function installSideflow7(_T,rig){
 const setLook=rig.setLook,dispose=rig.dispose;rig.sideflowInstalled=true;
 rig.setLook=function(...args){rig.sideflowLookCalls++;return setLook.apply(this,args);};
 rig.dispose=function(...args){rig.sideflowDisposeCalls++;return dispose.apply(this,args);};
 return rig;
}`);
// The separate Long98 fixture is intentionally lifecycle-only. Actual Long
// geometry/material enrollment is exercised by the integrated asset CPU/native
// tests. This stub may install only after the final complexion rig is tracked.
const long98URL=moduleURL(`
import assert from 'node:assert/strict';
export function installLong98(_T,rig,lifecycle){
 assert(lifecycle?.has(rig),'Long98 must receive the final tracked complexion rig');
 rig.long98Installed=true;return rig;
}`);
const rewritten=topSource.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_all,quote,spec)=>{
 const [file,query]=spec.split('?');let target;
 if(file==='./rider-model-braids.js')target=baseURL;
 else if(file==='./rider-long-framing.js')target=hairURL;
 else if(file==='./rider-long98.js')target=long98URL;
 else if(file==='./rider-complexion.mjs')target=url('assets/rider-complexion.mjs',query?'?'+query:'');
 else if(['./rider-swept-crown.mjs','./rider-neck-normals.mjs'].includes(file))target=url('assets/'+file.slice(2),query?'?'+query:'');
 else if(file==='./rider-material-lifecycle.js')target=url('assets/rider-material-lifecycle.js',query?'?'+query:'');
 else throw Error('Unreviewed production entry point dependency '+spec);
 return 'from '+JSON.stringify(target);
});
const {createRiderLibrary}=await import(moduleURL(rewritten));

function makeTestRig(kit){
 const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 const root=new T.Group(),body=new T.Mesh(geometry,new T.MeshStandardMaterial()),face=new T.Mesh(geometry,new T.MeshPhysicalMaterial()),eyes=new T.Mesh(geometry,new T.MeshPhysicalMaterial());
 root.add(body,face,eyes);face.name='Rider_Head';eyes.name='Eyes_Stylized';
 const rig={root,body,face,eyes,kit:{body:kit.body,headAsset:{config:{target:[.034233,.099,.065],mouth:.0374}}},u:{uSkin:{value:new T.Color('#e2ae88')},uEye:{value:new T.Color('#4a7ec0')},uFaceBind:{value:new T.Matrix4()}},mats:[body.material,face.material,eyes.material],sideflowLookCalls:0,sideflowDisposeCalls:0,lookCalls:0,disposeCalls:0,disposed:false};
 rig.setLook=function(){this.lookCalls++;};
 rig.dispose=function(){this.disposeCalls++;this.disposed=true;for(const m of this.mats)m.dispose();this.root.clear();geometry.dispose();};
 return rig;
}
function receiverFor(){
 const renderPass={scene:new T.Scene(),render(){}},originalRender=renderPass.render;
 const receiver=createRiderAOReception({THREE:T,renderPass,contactPass:{uniforms:{riderAOReceptionEnabled:{value:0}},enabled:true}});
 return {receiver,renderPass,originalRender};
}
function compile(material){
 const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};
 material.onBeforeCompile(shader);return shader;
}
function assertMarked(material,rig){
 const shader=compile(material);
 assert(shader.uniforms.uRiderAOReceiver,'Changed rider material must retain receiver uniform');
 assert(shader.fragmentShader.includes('gl_FragColor.a=-32.0'),'Changed rider material must retain receiver metadata marker');
 assert.equal(shader.uniforms.uSkin,rig.u.uSkin);assert.equal(shader.uniforms.uEye,rig.u.uEye);
 assert(material.customProgramCacheKey().includes('rider-ao-reception'),'Changed program key retains receiver ownership');
}

for(const kind of ['injected','default'])test(`${kind} lifecycle registers only the final complexion materials and hair methods`,()=>{
 const lifecycle=kind==='injected'?createRiderMaterialLifecycle():riderMaterialLifecycle15;
 assert.equal(lifecycle.inspect().liveRigs,0);
 const owner=receiverFor(),subscription=lifecycle.connectReceiver(owner.receiver),inner=[];
 let rig;
 try{
  const lib=createRiderLibrary({THREE:T,...(kind==='injected'?{riderMaterialLifecycle:lifecycle}:{}),makeTestRig,afterInnerBuild(value,innerLifecycle){inner.push({rig:value,registered:lifecycle.has(value),innerLifecycle});}});
  assert.equal(lib.materialLifecycle,lifecycle,'Public registry identity is retained');
  const before=lifecycle.inspect().stats.tracked;
  rig=lib.build({body:kind==='injected'?'f':'m'});
  if(topSource.includes('./rider-long98.js'))assert.equal(rig.long98Installed,true,'Actual Long98 entry must invoke the lifecycle-only fixture');
  assert.equal(inner.length,1);assert.equal(inner[0].rig,rig);assert.equal(inner[0].registered,false,'The inner factory must defer AO registration');
  assert.equal(lifecycle.inspect().stats.tracked-before,1,'The final rig is tracked exactly once');
  assert.equal(lifecycle.inspect().liveRigs,1);assert.equal(owner.receiver.inspect().registeredRigs,1);
  assert.equal(owner.receiver.inspect().stats.registrations,1);assert.equal(owner.receiver.inspect().materials,3);
  assert.equal(rig.sideflowInstalled,true);assert(rig.face.material.userData.riderNaturalSkin);assert(rig.eyes.material.userData.riderNaturalEyes);
  assert.equal(rig.face.material,rig.mats[1]);assert.equal(rig.eyes.material,rig.mats[2]);
  assertMarked(rig.face.material,rig);assertMarked(rig.eyes.material,rig);
  const face=rig.face.material,eyes=rig.eyes.material,revision=lifecycle.inspect().rigs[0].revision;
  rig.setLook({skin:'#744c3a'});
  assert.equal(rig.lookCalls,1);assert.equal(rig.sideflowLookCalls,1);
  assert.equal(lifecycle.inspect().rigs[0].revision,revision+1,'The final public method has exactly one lifecycle wrapper');
  assert.equal(owner.receiver.inspect().stats.registrations,2);assert.equal(rig.face.material,face);assert.equal(rig.eyes.material,eyes);
  assertMarked(face,rig);assertMarked(eyes,rig);
  let disposals=0;for(const m of rig.mats)m.addEventListener('dispose',()=>disposals++);
  rig.dispose();assert.equal(rig.disposeCalls,1);assert.equal(rig.sideflowDisposeCalls,1);assert.equal(disposals,3);
  assert.equal(lifecycle.has(rig),false);assert.equal(lifecycle.inspect().liveRigs,0);assert.equal(owner.receiver.inspect().registeredRigs,0);assert.equal(owner.receiver.inspect().materials,0);
 }finally{
  if(rig&&!rig.disposed)rig.dispose();subscription.dispose();
  assert.equal(owner.renderPass.render,owner.originalRender);
  if(kind==='injected')lifecycle.dispose();
 }
});

test('a receiver attached after construction wraps the same finished materials without a second tracking owner',()=>{
 const lifecycle=createRiderMaterialLifecycle(),inner=[],lib=createRiderLibrary({THREE:T,riderMaterialLifecycle:lifecycle,makeTestRig,afterInnerBuild:rig=>inner.push(rig)}),rig=lib.build({body:'f'}),face=rig.face.material,eyes=rig.eyes.material;
 const owner=receiverFor();let subscription;
 if(topSource.includes('./rider-long98.js'))assert.equal(rig.long98Installed,true,'Late receiver keeps the same installed Long98 rig');
 try{
  assert.equal(inner.length,1);assert.equal(lifecycle.inspect().liveRigs,1);const tracked=lifecycle.inspect().stats.tracked;
  subscription=lifecycle.connectReceiver(owner.receiver);
  assert.equal(lifecycle.inspect().stats.tracked,tracked);assert.equal(owner.receiver.inspect().stats.registrations,1);
  assert.equal(rig.face.material,face);assert.equal(rig.eyes.material,eyes);assertMarked(face,rig);assertMarked(eyes,rig);
 }finally{rig.dispose();subscription?.dispose();lifecycle.dispose();}
});
