// Native-GPU material regression for pale distant canopies. No game boot needed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/tree-lighting');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__qa/tree-lighting.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Canopy lighting regression</title>'}));
 if(process.env.QA_TREE_SHADER)await page.route('**/assets/tree-impostors.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.QA_TREE_SHADER,'utf8')}));
 await page.goto(QA.BASE+'/__qa/tree-lighting.html');
 const result=await page.evaluate(async()=>{
  const T=await import('/assets/vendor/three/build/three.module.js'),{treeImpostor}=await import('/assets/tree-impostors.js');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(96,96);renderer.setClearColor(0,1);renderer.toneMapping=T.NoToneMapping;
  const target=new T.WebGLRenderTarget(96,96,{type:T.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
  const albedo=new T.DataTexture(new Uint8Array([9,24,4,255]),1,1);albedo.needsUpdate=true;
  const normalData=new Float32Array([.5,.9,.2,1]),normals=new T.DataTexture(normalData,1,1,T.RGBAFormat,T.FloatType);normals.needsUpdate=true;
  const {geo,mat}=treeImpostor({THREE:T,albedo,normals,width:2,height:2,bottom:-1});
  const tree=new T.InstancedMesh(geo,mat,1);tree.setMatrixAt(0,new T.Matrix4());tree.setColorAt(0,new T.Color(0xffffff));tree.frustumCulled=false;
  const scene=new T.Scene(),sun=new T.DirectionalLight(0xffe9d0,3.35),hemi=new T.HemisphereLight(0xc5d6ef,0x898467,.94);sun.position.set(.176,.695,-.697);scene.add(tree,sun,hemi);
  const camera=new T.PerspectiveCamera(45,1,.1,20);camera.position.set(0,0,3);camera.lookAt(0,0,0);
  const read=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint16Array(96*96*4);renderer.readRenderTargetPixels(target,0,0,96,96,p);let invalid=0,partial=0;const mean=[0,0,0];
   for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;if(p[i+3]<0x3c00)partial++;}
   for(let y=40;y<56;y++)for(let x=40;x<56;x++)for(let c=0;c<3;c++)mean[c]+=T.DataUtils.fromHalfFloat(p[(y*96+x)*4+c])/256;
   return{mean,invalid,partial,greenToRed:mean[1]/Math.max(mean[0],1e-8)};};
  const cases=[];for(const y of[-.8,0,.8])for(const z of[-.6,0,.6]){
   normalData.set([.5,y*.5+.5,z*.5+.5,1]);normals.needsUpdate=true;
   for(const yaw of[0,Math.PI*.5,Math.PI]){tree.setMatrixAt(0,new T.Matrix4().makeRotationY(yaw));tree.instanceMatrix.needsUpdate=true;cases.push({y,z,yaw,...read()});}
  }
  tree.setMatrixAt(0,new T.Matrix4());tree.instanceMatrix.needsUpdate=true;normalData.set([.5,.9,.2,1]);normals.needsUpdate=true;
  const lit=read(),cameraSweep=[];normalData.set([.5,1,.5,1]);normals.needsUpdate=true;
  for(let i=-10;i<=10;i++){camera.position.y=i*.03;camera.lookAt(0,0,0);cameraSweep.push(read());}
  const cameraJump=Math.max(...cameraSweep.slice(1).map((row,i)=>Math.abs(row.mean[1]-cameraSweep[i].mean[1])));
  camera.position.y=0;camera.lookAt(0,0,0);normalData.set([.5,.9,.2,1]);normals.needsUpdate=true;sun.intensity=0;hemi.intensity=.05;const night=read();
  const gl=renderer.getContext().getError();geo.dispose();mat.userData.scanDepth.dispose();mat.dispose();target.dispose();albedo.dispose();normals.dispose();renderer.dispose();renderer.forceContextLoss();return{cases,lit,night,cameraSweep,cameraJump,gl};
 });
 const samples=[...result.cases,...result.cameraSweep,result.lit,result.night];
 const checks={smoothCameraLighting:result.cameraJump<.005,finiteNormals:samples.every(r=>r.invalid===0),opaqueCoverage:samples.every(r=>r.partial===0),leafPigmentSurvivesSun:result.cases.every(r=>r.greenToRed>1.3),dayRemainsLit:result.lit.mean[1]>.008,respondsToNight:result.night.mean[1]<result.lit.mean[1]*.25,noErrors:!errors.length&&result.gl===0};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,...result,errors},null,2));console.log(JSON.stringify({checks,cases:result.cases.length,cameraJump:result.cameraJump,minGreenToRed:Math.min(...result.cases.map(r=>r.greenToRed)),errors}));assert(Object.values(checks).every(Boolean),'Canopy lighting regression failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
