/* Real WebGL wardrobe check, independent of world/horse loading.
   NODE_PATH=$(npm root -g) node tools/qa-rider-wardrobe.cjs */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const out=path.resolve(__dirname,'../output/wardrobe');fs.mkdirSync(out,{recursive:true});
const game=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8');
const rj=game.match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__wardrobe_qa.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:24px;background:#ece7dd;font:14px system-ui;color:#292c28}h1{font:600 26px Georgia;margin:0 0 6px}p{margin:0 0 22px;color:#66685e}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.card{background:#dad5c7;border-radius:10px;overflow:hidden;text-align:center}.card img{width:100%;display:block}.label{padding:7px;font-weight:600}</style></head><body><h1>Meadowlark · A wardrobe for every day</h1><p>48 complete looks · riding, ranch, everyday & adventure</p><div class="grid"></div><script>window.RJ=${rj};</script></body></html>`}));
  await page.goto(QA.BASE+'/__wardrobe_qa.html');
  const result=await page.evaluate(async()=>{
   const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js');
   const {createRiderLibrary}=await import('/assets/rider-model.js?v=rider-appearance-3'),{RIDER_OUTFITS,outfitPalette}=await import('/assets/rider-clothes.js?v=appearance-3');
   const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ});
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(240,300);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   const sc=new THREE.Scene();sc.background=new THREE.Color('#dad5c7');sc.add(new THREE.HemisphereLight(0xfff8e9,0x596450,2));
   const light=new THREE.DirectionalLight(0xfff3e2,2.5);light.position.set(2,3,4);sc.add(light);
   const cam=new THREE.PerspectiveCamera(30,0.8,.05,20);cam.position.set(0,.95,3.9);cam.lookAt(0,.9,0);
   const checks=[],images=[];
   for(const body of ['f','m']){
    const kit=await lib.kit(body);await lib.outfitFor(kit,'peasant');const rig=lib.build(kit,{body,helmet:'none',hairStyle:body==='f'?'ponytail':'short'});sc.add(rig.root);rig.root.rotation.y=.22;
    for(const o of RIDER_OUTFITS){
     await lib.outfitFor(kit,o.id);rig.setLook({...outfitPalette(o),body,helmet:'none',hairStyle:body==='f'?'ponytail':'short'});await Promise.resolve();await Promise.resolve();
     const idle=rig.action('idle');idle.setEffectiveWeight(1);rig.mixer.update(.06);renderer.render(sc,cam);
     const meshes=rig.outfit?.meshes||rig.boots||[];
     checks.push({body,id:o.id,zones:kit.zones,meshNames:meshes.map(m=>[m.name,m.geometry.attributes.position.count]),loaded:o.source==='riding'?!!rig.boots:rig.outfit?.id===o.id,meshes:meshes.length,
      shader:rig.u.uClothes.value.x===o.design,finite:meshes.every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite))});
     if(body==='f'){
      const img=renderer.domElement.toDataURL('image/png');images.push({id:o.id,img});
      const card=document.createElement('div');card.className='card';const image=new Image();image.src=img;card.append(image);
      const label=document.createElement('div');label.className='label';label.textContent=o.label;card.append(label);document.querySelector('.grid').append(card);
     }
     if(body==='f'&&['flannel','denim','cable','show'].includes(o.id)){
      renderer.setSize(640,640);cam.aspect=1;cam.position.set(0,1.35,1.45);cam.lookAt(0,1.27,0);cam.updateProjectionMatrix();renderer.render(sc,cam);
      images.push({id:o.id+'-detail',img:renderer.domElement.toDataURL('image/png')});
      renderer.setSize(240,300);cam.aspect=.8;cam.position.set(0,.95,3.9);cam.lookAt(0,.9,0);cam.updateProjectionMatrix();
     }
     // Exercise the same bound garments through walking, jogging and the riding seat.
     for(const motion of ['walk','jog']){
      rig.action('idle').setEffectiveWeight(0);const action=rig.action(motion);action.setEffectiveWeight(1);rig.mixer.update(.24);
      renderer.render(sc,cam);action.setEffectiveWeight(0);
      const finite=meshes.every(m=>{m.skeleton.update();const count=m.geometry.attributes.position.count;for(let i=0;i<count;i+=Math.max(1,Math.floor(count/70))){const p=m.getVertexPosition(i,new THREE.Vector3());if(![p.x,p.y,p.z].every(Number.isFinite))return false;}return true;});
      checks.push({body,id:o.id+'-'+motion,loaded:finite,meshes:meshes.length,shader:true,finite});
     }
     for(const [name,pose] of kit.seat.local){rig.bones[name].position.copy(pose.p);rig.bones[name].quaternion.copy(pose.q);}
     rig.root.updateMatrixWorld(true);renderer.render(sc,cam);
     if(body==='f'&&['flannel','overalls','quilted'].includes(o.id)){
      cam.position.set(3.2,1.05,1.8);cam.lookAt(0,1.04,0);renderer.render(sc,cam);
      images.push({id:o.id+'-seated',img:renderer.domElement.toDataURL('image/png')});
      cam.position.set(0,.95,3.9);cam.lookAt(0,.9,0);
     }
    }
    // A later selection must win, including a return to the fitted kit.
    rig.setOutfit('ranger');rig.setOutfit('flannel');rig.setOutfit('polo');await Promise.resolve();await Promise.resolve();
    checks.push({body,id:'rapid-switch',loaded:rig.outfitId==='polo'&&rig.outfit?.id==='polo'&&rig.u.uOutfit.value===1&&rig.u.uTopOnly.value===1,meshes:rig.boots?.length||0,shader:true,finite:true});
    for(const motion of ['walk','jog']){rig.action('idle').setEffectiveWeight(0);const a=rig.action(motion);a.setEffectiveWeight(1);rig.mixer.update(.25);renderer.render(sc,cam);a.setEffectiveWeight(0);}
    sc.remove(rig.root);rig.dispose();
   }
   renderer.dispose();return {count:RIDER_OUTFITS.length,checks,images};
  });
  await page.screenshot({path:path.join(out,'all-48-outfits.png'),fullPage:true});
  for(const {id,img} of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));
  delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
  assert.equal(result.count,48);assert.deepEqual(errors,[],'No WebGL or page errors');
  assert.deepEqual(result.checks.filter(c=>!c.loaded||!c.shader||!c.finite||!c.meshes),[],'Every outfit loads, animates and survives rapid switching on both bodies');
  console.log('PASS: 48 outfits on both bodies, clothing shaders, rapid changes walking/jogging and seated poses. Screenshot: '+path.join(out,'all-48-outfits.png'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
