/* Render every hairstyle with and without a helmet, on both character bodies. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(__dirname,'../output/appearance');fs.mkdirSync(out,{recursive:true});
const game=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8'),rj=game.match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:920}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().startsWith('HAIR '))console.log(m.text());});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__hair_qa.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:24px;background:#ece7dd;font:14px system-ui;color:#292c28}h1{font:600 26px Georgia;margin:0 0 6px}p{margin:0 0 20px;color:#636859}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{background:#dad5c7;border-radius:10px;overflow:hidden;text-align:center}.card img{width:100%;display:block}.label{padding:8px;font-weight:600}#helmet,#details,#palette{display:none}#palette{grid-template-columns:repeat(4,1fr)}#details{grid-template-columns:repeat(3,1fr)}</style><h1>Meadowlark · More ways to wear your hair</h1><p>30 hairstyles · natural colours · helmet-compatible</p><div class="grid" id="bare"></div><div class="grid" id="helmet"></div><div class="grid" id="details"></div><div class="grid" id="palette"></div><script>window.RJ=${rj};</script>`}));
  await page.goto(QA.BASE+'/__hair_qa.html');
  const result=await page.evaluate(async()=>{
   const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js');
   const {createRiderLibrary,RIDER_HAIR}=await import('/assets/rider-model.js?v=rider-appearance-3');
   const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(280,300);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#dad5c7');scene.add(new THREE.HemisphereLight(0xfff8e9,0x596450,2));
   const key=new THREE.DirectionalLight(0xfff3e2,2.8);key.position.set(2,3,4);scene.add(key);
   const rim=new THREE.DirectionalLight(0xb7c6e3,1.4);rim.position.set(-2,2,-3);scene.add(rim);
   const cam=new THREE.PerspectiveCamera(30,280/300,.05,20);cam.position.set(0,1.64,1.58);cam.lookAt(0,1.53,0);
   const checks=[],images=[];
   for(const body of ['f','m']){
    const kit=await lib.kit(body);await lib.outfitFor(kit,'flannel');
    const fit={body,helmet:'none',hair:'#765a46',shirt:'#659c99',outfit:'flannel'};
    const rig=lib.build(kit,fit);await Promise.resolve();await Promise.resolve();scene.add(rig.root);rig.root.rotation.y=.55;
    rig.action('idle').setEffectiveWeight(1);rig.mixer.update(.05);cam.position.set(0,1.64+kit.proportionLift,1.58);cam.lookAt(0,1.53+kit.proportionLift,0);
    // Reverse the second body's choices to catch stale buffers shared between styles.
    const styles=RIDER_HAIR.filter(h=>h.body.includes(body));if(body==='m')styles.reverse();
    for(const h of styles){
     console.log('HAIR '+body+' '+h.id);
     for(const helmet of [false,true]){
      rig.setLook({...fit,hairStyle:h.id,helmet:helmet?'#2e2e38':'none'});renderer.render(scene,cam);
      let finite=true,vertices=0;rig.hair.traverse(m=>{if(m.isMesh){vertices+=m.geometry.attributes.position.count;finite=finite&&Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&(!m.geometry.attributes.tangent||Array.from(m.geometry.attributes.tangent.array).every(Number.isFinite));}});
      // Validate the rendered tangent basis, including the interleaved source meshes.
      rig.hair.traverse(m=>{if(!m.isMesh||!m.material.isMeshPhysicalMaterial)return;const g=m.geometry,n=g.attributes.normal,t=g.attributes.tangent;if(!t)throw Error('Missing hair tangents: '+h.id);const used=new Set(g.index?g.index.array:Array.from({length:t.count},(_,i)=>i));for(const i of used){const len=Math.hypot(t.getX(i),t.getY(i),t.getZ(i));if(len>1e-5&&Math.abs((n.getX(i)*t.getX(i)+n.getY(i)*t.getY(i)+n.getZ(i)*t.getZ(i))/len)>.002)throw Error('Hair tangent does not follow its surface: '+h.id);}});
      const hair=rig.hair;rig.setLook({...fit,hairStyle:h.id,helmet:helmet?'#2e2e38':'none',hair:'#68422d'});
      checks.push({body,style:h.id,helmet,finite,vertices,colourOnly:hair===rig.hair});
      if(body==='f'){
       const img=renderer.domElement.toDataURL('image/png');images.push({id:h.id+(helmet?'-helmet':''),img});
       const card=document.createElement('div');card.className='card';const image=new Image();image.src=img;card.append(image);
       const label=document.createElement('div');label.className='label';label.textContent=h.label;card.append(label);document.getElementById(helmet?'helmet':'bare').append(card);
       if(!helmet&&['ponytail','braid','bun','lowpony','sidebraid','twintails','curly','coils','croppedcoils','twists'].includes(h.id)){
        for(const [angle,name]of [[0,'front'],[1.57,'side'],[Math.PI,'back']]){
         rig.root.rotation.y=angle;cam.position.set(0,1.64+kit.proportionLift,.98);cam.lookAt(0,1.56+kit.proportionLift,0);renderer.render(scene,cam);
         const close=renderer.domElement.toDataURL('image/png');images.push({id:h.id+'-'+name,img:close});
         const detail=document.createElement('div');detail.className='card';detail.innerHTML='<img src="'+close+'"><div class="label">'+h.label+' · '+name+'</div>';document.getElementById('details').append(detail);
        }
        rig.root.rotation.y=.55;cam.position.set(0,1.64+kit.proportionLift,1.58);cam.lookAt(0,1.53+kit.proportionLift,0);
       }

      }
     }
    }
    if(body==='f'){
     for(const style of ['ponytail','curly'])for(const [name,color]of [['Soft black','#221b1a'],['Chestnut','#68422d'],['Golden blond','#c3a064'],['Silver','#c2beb4']]){
      rig.setLook({...fit,hairStyle:style,helmet:'none',hair:color});rig.root.rotation.y=.65;cam.position.set(0,1.64+kit.proportionLift,1.03);cam.lookAt(0,1.56+kit.proportionLift,0);renderer.render(scene,cam);
      const img=renderer.domElement.toDataURL('image/png');images.push({id:style+'-'+name.toLowerCase().replace(/ /g,'-'),img});
      const card=document.createElement('div');card.className='card';card.innerHTML='<img src="'+img+'"><div class="label">'+style+' · '+name+'</div>';document.getElementById('palette').append(card);
     }
     cam.position.set(0,1.64+kit.proportionLift,1.58);cam.lookAt(0,1.53+kit.proportionLift,0);
    }
    scene.remove(rig.root);rig.dispose();
   }
   renderer.dispose();return {checks,images};
  });
  await page.screenshot({path:path.join(out,'hairstyles.png'),fullPage:true});
  await page.evaluate(()=>{document.getElementById('bare').style.display='none';document.getElementById('helmet').style.display='grid';});
  await page.screenshot({path:path.join(out,'hairstyles-helmets.png'),fullPage:true});
  await page.evaluate(()=>{document.getElementById('helmet').style.display='none';document.getElementById('details').style.display='grid';});
  await page.screenshot({path:path.join(out,'hairstyles-detail.png'),fullPage:true});
  await page.evaluate(()=>{document.getElementById('details').style.display='none';document.getElementById('palette').style.display='grid';});
  await page.screenshot({path:path.join(out,'hair-colours.png'),fullPage:true});
  for(const {id,img} of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));
  delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,'hair-report.json'),JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);assert.equal(result.checks.filter(c=>c.body==='f'&&!c.helmet).length,30);
  assert.deepEqual(result.checks.filter(c=>!c.finite||c.vertices<100||!c.colourOnly),[]);
  console.log('PASS: '+result.checks.length+' hairstyle/body/helmet combinations render, and colour changes reuse the hair.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
