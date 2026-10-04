/* Actual WebGL fitting, animation, replacement and disposal checks for every accessory. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(__dirname,'../output/appearance');fs.mkdirSync(out,{recursive:true});
const rj=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__accessory_qa.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:24px;background:#ece7dd;font:15px system-ui;color:#292c28}h1{font:600 28px Georgia;margin:0 0 8px}p{margin:0 0 20px;color:#636859}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.card{background:#dad5c7;border-radius:10px;overflow:hidden;text-align:center}.card img{width:100%;display:block}.label{padding:8px;font-weight:600}</style><h1>Meadowlark · The finishing touches</h1><p>18 mix-and-match accessories · glasses, earrings, necklaces & scarves</p><div class="grid"></div><script>window.RJ=${rj};</script>`}));
  await page.goto(QA.BASE+'/__accessory_qa.html');
  const result=await page.evaluate(async()=>{
   const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js');
   const {createRiderLibrary}=await import('/assets/rider-model.js?v=rider-appearance-3'),{RIDER_ACCESSORIES}=await import('/assets/rider-accessories.js?v=appearance-1');
   const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(360,380);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#dad5c7');scene.add(new THREE.HemisphereLight(0xfff8e9,0x596450,2));
   const key=new THREE.DirectionalLight(0xfff3e2,2.8);key.position.set(2,3,4);scene.add(key);
   const cam=new THREE.PerspectiveCamera(30,360/380,.05,20),checks=[],images=[],heads=[];
   for(const body of ['f','m']){
    const kit=await lib.kit(body);await lib.outfitFor(kit,'flannel');heads.push({body,head:kit.head});
    const fit={body,helmet:'none',hairStyle:'lowbun',hair:'#68422d',shirt:'#3d4a6e',outfit:'flannel',eyewear:'none',earrings:'none',neckwear:'none'};
    const rig=lib.build(kit,fit);await Promise.resolve();await Promise.resolve();scene.add(rig.root);rig.action('idle').setEffectiveWeight(1);rig.mixer.update(.05);
    for(const [slot,items] of Object.entries(RIDER_ACCESSORIES))for(const item of items.filter(i=>i.id!=='none'))for(const helmet of [false,true]){
     const chosen={...fit,[slot]:item.id,helmet:helmet?'#2e2e38':'none'};rig.setLook(chosen);
     const neck=slot==='neckwear';rig.root.rotation.y=slot==='earrings'?.62:.12;
     cam.position.set(0,neck?1.48:1.67,neck?1.10:.82);cam.lookAt(0,neck?1.40:1.63,0);renderer.render(scene,cam);
     const current=rig.accessories,root=current.roots[0];let finite=true,meshes=0;
     root.traverse(m=>{if(m.isMesh){meshes++;finite=finite&&Array.from(m.geometry.attributes.position.array).every(Number.isFinite);}});
     rig.setLook({...chosen,hair:'#c4b18c'});
     checks.push({body,slot,id:item.id,helmet,meshes,finite,reuse:rig.accessories===current,parent:root.parent.name=== (neck?'spine_03':'Head')});
     if(body==='f'&&!helmet){
      const img=renderer.domElement.toDataURL('image/png');images.push({id:slot+'-'+item.id,img});
      const card=document.createElement('div');card.className='card';const image=new Image();image.src=img;card.append(image);const label=document.createElement('div');label.className='label';label.textContent=item.label;card.append(label);document.querySelector('.grid').append(card);
     }
     const geo=root.children[0].geometry,mat=root.children[0].material;let disposedGeo=false,disposedMat=false;geo.addEventListener('dispose',()=>disposedGeo=true);mat.addEventListener('dispose',()=>disposedMat=true);
     rig.setLook(fit);checks.at(-1).removed=root.parent===null&&rig.accessories.roots.length===0&&disposedGeo&&disposedMat;
    }
    const combo={...fit,eyewear:'round',earrings:'hoops',neckwear:'pendant'};rig.setLook(combo);
    for(const motion of ['walk','jog','seat']){
     if(motion==='seat'){for(const [n,p]of kit.seat.local){rig.bones[n].position.copy(p.p);rig.bones[n].quaternion.copy(p.q);}}
     else{rig.action('idle').setEffectiveWeight(0);rig.action(motion).setEffectiveWeight(1);rig.mixer.update(.3);rig.action(motion).setEffectiveWeight(0);}
     rig.root.updateMatrixWorld(true);renderer.render(scene,cam);
     for(const root of rig.accessories.roots){const b=new THREE.Box3().setFromObject(root);const assertFinite=Object.values(b.min).every(Number.isFinite)&&Object.values(b.max).every(Number.isFinite);if(!assertFinite)throw Error('Invalid animated accessory');}
    }
    rig.setLook({...combo,eyewear:'invalid',earrings:'invalid',neckwear:'invalid'});if(rig.accessories.roots.length)throw Error('Unknown accessories must be removed');
    scene.remove(rig.root);rig.dispose();
   }
   renderer.dispose();return {checks,images,heads};
  });
  await page.screenshot({path:path.join(out,'accessories.png'),fullPage:true});
  for(const {id,img}of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));
  delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,'accessory-report.json'),JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);assert.equal(result.checks.length,72);assert.deepEqual(result.checks.filter(c=>!c.finite||!c.meshes||!c.reuse||!c.parent||!c.removed),[]);
  console.log('PASS: 72 accessory/body/helmet combinations; walking, jogging, seated attachments; replacement and resource disposal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
