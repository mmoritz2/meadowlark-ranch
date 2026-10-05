/* Inspect the roots, garment silhouette and jewelry from front, side and back. */
const fs=require('node:fs'),path=require('node:path'),QA=require('./qa-platform.cjs');
const stage=process.env.FIT_STAGE||'after',out=path.resolve(__dirname,'../output/character-fit');fs.mkdirSync(out,{recursive:true});
const rj=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__fitting.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{font:14px system-ui;background:#dfd9ca;margin:0;padding:18px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}img{width:100%}.card{background:#ece7db;text-align:center;padding-bottom:8px}</style><h2>Character fitting · ${stage}</h2><div class="grid"></div><script>window.RJ=${rj}</script>`}));
 await page.goto(QA.BASE+'/__fitting.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary}=await import('/assets/rider-model.js');
  const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),kit=await lib.kit('f'),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,420);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const sc=new THREE.Scene();sc.background=new THREE.Color('#dfd9ca');sc.add(new THREE.HemisphereLight(0xfff8ec,0x626952,2));const light=new THREE.DirectionalLight(0xfff3df,2.4);light.position.set(2,3,4);sc.add(light);const fill=new THREE.DirectionalLight(0xb8c9e7,1.5);fill.position.set(-2,2,-3);sc.add(fill);
  const cam=new THREE.PerspectiveCamera(30,360/420,.03,20),fit={body:'f',helmet:'none',hairStyle:'lowbun',hair:'#68422d',outfit:'flannel',shirt:'#77998a',pants:'#435f80',neckwear:'none'};
  await lib.outfitFor(kit,'flannel');const rig=lib.build(kit,fit);await Promise.resolve();await Promise.resolve();sc.add(rig.root);rig.action('idle').setEffectiveWeight(1);rig.mixer.update(.05);
  const images=[];
  const shot=(id,label,angle,y,d)=>{rig.root.rotation.y=angle;cam.position.set(0,y+.03,d);cam.lookAt(0,y,0);sc.traverse(m=>{if(m.isSkinnedMesh){const a=m.geometry.attributes.skinIndex;for(let i=0;i<a.count;i++)for(const get of ['getX','getY','getZ','getW'])if(!m.skeleton.bones[a[get](i)])throw Error('Invalid joint '+a[get](i)+' on '+m.name+' of '+m.skeleton.bones.length+' bones at '+i);}});renderer.render(sc,cam);const img=renderer.domElement.toDataURL('image/png');images.push({id,img});const card=document.createElement('div');card.className='card';card.innerHTML='<img src="'+img+'"><div>'+label+'</div>';document.querySelector('.grid').append(card);};
  for(const style of ['sidebraid','twinbraids','crownbraid','braid','lowpony','twists']){
   rig.setLook({...fit,hairStyle:style});for(const [angle,name]of [[1.25,'side'],[2.7,'back']])shot(style+'-'+name,style+' · '+name,angle,1.57,1.35);
  }
  for(const outfit of ['flannel','denim','cable','show','polo','cardigan']){
   await lib.outfitFor(kit,outfit);rig.setLook({...fit,outfit,neckwear:'layered'});await Promise.resolve();await Promise.resolve();
   for(const [angle,name]of [[.12,'front'],[1.4,'side']])shot(outfit+'-'+name,outfit+' · '+name,angle,1.30,1.65);
  }
  for(const motion of ['walk','jog','seat']){
   rig.setLook({...fit,outfit:'denim',hairStyle:'twinbraids',neckwear:'layered'});await Promise.resolve();await Promise.resolve();
   rig.action('idle').setEffectiveWeight(0);
   if(motion==='seat'){for(const [n,p]of kit.seat.local){rig.bones[n].position.copy(p.p);rig.bones[n].quaternion.copy(p.q);}}
   else{rig.action(motion).setEffectiveWeight(1);rig.mixer.update(.3);rig.action(motion).setEffectiveWeight(0);}
   for(const [angle,name]of [[.12,'front'],[1.4,'side']])shot(motion+'-'+name,motion+' · '+name,angle,1.3,1.9);
  }
  const counts={};for(const geo of rig.outfit?.meshes||[]){counts[geo.name]=geo.geometry.attributes.position.count;}
  rig.dispose();renderer.dispose();return {images,counts};
 });
 await page.screenshot({path:path.join(out,stage+'.png'),fullPage:true});for(const {id,img}of result.images)fs.writeFileSync(path.join(out,stage+'-'+id+'.png'),Buffer.from(img.split(',')[1],'base64'));
 fs.writeFileSync(path.join(out,stage+'-report.json'),JSON.stringify({errors,counts:result.counts},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('Rendered fitting review: '+path.join(out,stage+'.png'));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
