/* The authored surface and rebound skeleton must agree before animation starts. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage();await page.route('**/__proportions.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script>'}));await page.goto(QA.BASE+'/__proportions.html');
 const checks=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{refineRiderProportions}=await import('/assets/rider-proportions.js'),checks=[];
  for(const body of ['f','m']){
   const {scene}=await new GLTFLoader().loadAsync('/assets/models/rider/rider-'+body+'.glb');scene.updateMatrixWorld(true);let skin;const meshes=[];scene.traverse(m=>{if(m.isSkinnedMesh){meshes.push(m);if(/superhero/i.test(m.name))skin=m;}});
   const before=new Map(meshes.map(m=>[m,m.geometry.attributes.position.clone()])),weights=new Map(meshes.map(m=>[m,[m.geometry.attributes.skinIndex,m.geometry.attributes.skinWeight]]));
   const head=skin.skeleton.bones.find(b=>b.name==='Head'),oldHead=head.getWorldPosition(new THREE.Vector3()),beforeJoint=skin.skeleton.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
   refineRiderProportions(THREE,scene,skin,body);scene.updateMatrixWorld(true);
   let maxBindError=0,maxFootChange=0,maxChange=0,maxJointChange=0;
   for(const m of meshes){m.skeleton.update();const p=m.geometry.attributes.position,old=before.get(m),w=weights.get(m);if(w[0]!==m.geometry.attributes.skinIndex||w[1]!==m.geometry.attributes.skinWeight)throw Error('Proportions changed skin weights');
    for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),was=new THREE.Vector3().fromBufferAttribute(old,i),delta=v.distanceTo(was);maxChange=Math.max(maxChange,delta);if(was.y<.12)maxFootChange=Math.max(maxFootChange,delta);maxBindError=Math.max(maxBindError,v.distanceTo(m.getVertexPosition(i,new THREE.Vector3())));}
   }
   skin.skeleton.bones.forEach((b,i)=>{maxJointChange=Math.max(maxJointChange,b.getWorldPosition(new THREE.Vector3()).distanceTo(beforeJoint[i]));});
   const once=skin.geometry.attributes.position.array.slice();refineRiderProportions(THREE,scene,skin,body);if(once.some((v,i)=>v!==skin.geometry.attributes.position.array[i]))throw Error('Repeated preparation reshapes the model twice');
   checks.push({body,maxBindError,maxFootChange,maxChange,maxJointChange,heightGain:head.getWorldPosition(new THREE.Vector3()).y-oldHead.y});
  }return checks;
 });
 const out=path.resolve(__dirname,'../output/runway/proportions.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(checks,null,2));
 for(const c of checks){assert(c.maxBindError<1e-5,'Rebound skeleton deforms the bind surface');assert(c.maxFootChange<1e-6,'Foot contact geometry changed');if(c.body==='m')assert(c.maxChange===0&&c.maxJointChange===0,'Male proportions changed');else assert(c.heightGain>.07&&c.heightGain<.12,'Female height is outside the intended range');}
 console.log('PASS: skin, eyes and brows match their rebound skeleton; foot contacts and male proportions are preserved; preparation is idempotent.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
