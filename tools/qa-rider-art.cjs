/* Repeatable close-up and full-body art review, using the production rider. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const stage=process.env.ART_STAGE||'after',out=path.resolve(__dirname,'../output/character-art');fs.mkdirSync(out,{recursive:true});
const RJ=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__art.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:20px;background:#e5e0d5;color:#28352f;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#d8d5c9;text-align:center;padding-bottom:8px}img{width:100%;display:block}</style><h2>Character art · ${stage}</h2><div class="grid"></div><script>window.RJ=${RJ}</script>`}));await page.goto(QA.BASE+'/__art.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary}=await import('/assets/rider-model.js');
  const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(420,520);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const sc=new THREE.Scene();sc.background=new THREE.Color('#d8d5c9');sc.add(new THREE.HemisphereLight(0xfff5e7,0x6c7868,2));const key=new THREE.DirectionalLight(0xfff3e8,2.3);key.position.set(2,3,4);sc.add(key);const fill=new THREE.DirectionalLight(0xd2ddec,1);fill.position.set(-2,2,-3);sc.add(fill);
  const camera=new THREE.PerspectiveCamera(28,420/520,.02,20),images=[],checks=[];
  for(const body of ['f','m']){
   const kit=await lib.kit(body);
   const asset=kit.headAsset;
   if(!asset?.mesh.userData.artistHead||!kit.skin.geometry.userData.headReplaced)throw Error('Artist-authored head replacement missing');
   for(const mesh of [kit.skin,asset.mesh,asset.eyes,asset.brows]){
    const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
    for(let i=0;i<si.count;i++){
     let sum=0;for(const get of ['getX','getY','getZ','getW']){const joint=si[get](i),weight=sw[get](i);if(joint>=mesh.skeleton.bones.length||weight<0||!Number.isFinite(weight))throw Error('Invalid head/body binding');sum+=weight;}
     if(Math.abs(sum-1)>.0001)throw Error('Unnormalized head/body weights');
    }
   }
   const head=asset.mesh.skeleton.bones.findIndex(b=>b.name==='Head'),inverse=asset.inverse,p=asset.mesh.geometry.attributes.position,si=asset.mesh.geometry.attributes.skinIndex,sw=asset.mesh.geometry.attributes.skinWeight;
   for(let i=0;i<p.count;i++){const local=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(inverse);if(local.y>.035){let headWeight=0;for(const get of ['getX','getY','getZ','getW'])if(si[get](i)===head)headWeight+=sw[get](i);if(headWeight<.9999)throw Error('Face deforms with unrelated body joints');}}
   const probe=new THREE.Mesh(asset.local,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();probe.updateMatrixWorld(true);const bp=asset.brows.geometry.attributes.position;
   for(let i=0;i<bp.count;i++){const v=new THREE.Vector3().fromBufferAttribute(bp,i).applyMatrix4(inverse);ray.set(new THREE.Vector3(v.x,v.y,.35),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(probe,false)[0],gap=hit?v.z-hit.point.z:Infinity;if(gap<-.00001||gap>.003)throw Error('Eyebrow is detached from the new face');}probe.material.dispose();
   const base={body,outfit:'polo',hairStyle:'ponytail',helmet:'none',hair:'#68422d',skin:'#e2ae88',shirt:'#659c99',pants:'#e8d9b8',eyes:'hazel',earrings:'none',neckwear:'none'};await lib.outfitFor(kit,base.outfit);const rig=lib.build(kit,base);await Promise.resolve();await Promise.resolve();sc.add(rig.root);rig.action('idle').setEffectiveWeight(1);rig.mixer.update(.1);
   const lashes=rig.root.getObjectByName('rider-eyelashes');if(body==='f'){if(!lashes||lashes.parent!==rig.bones.Head||lashes.geometry.userData.lashRoots.length<28)throw Error('Upper lashes missing or detached');if(!Array.from(lashes.geometry.attributes.position.array).every(Number.isFinite))throw Error('Invalid eyelash geometry');}else if(lashes)throw Error('Female lashes added to the male body');
   const shot=(id,label,fit,angle,y,d)=>{rig.root.rotation.y=angle;camera.position.set(0,y+.015,d);camera.lookAt(0,y,.012);rig.root.updateMatrixWorld(true);let valid=true;rig.root.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();const a=m.geometry.attributes.position;for(let i=0;i<a.count;i+=17){const p=m.getVertexPosition(i,new THREE.Vector3());if(![p.x,p.y,p.z].every(Number.isFinite))valid=false;}}});if(!valid)throw Error('Invalid pose: '+id);renderer.render(sc,camera);const img=renderer.domElement.toDataURL('image/png');images.push({id:body+'-'+id,img});checks.push({body,id,valid});const c=document.createElement('div');c.className='card';c.innerHTML='<img src="'+img+'">'+body+' · '+label;document.querySelector('.grid').append(c);};
   for(const [id,skin,angle]of [['portrait','#e2ae88',.08],['three-quarter','#e2ae88',.68],['profile','#e2ae88',1.42],['deep-skin','#744c3a',.25]]){rig.setLook({...base,skin});shot(id,id,base,angle,rig.bones.Head.getWorldPosition(new THREE.Vector3()).y+.055,.90);}
   for(const [id,style,outfit,col,helmet]of [['braid','braid','flannel','#b34a4a','none'],['bun','bun','show','#28394b','none'],['waves','waves','cable','#e8d9b8','none'],['riding','ponytail','riding','#3d4a6e','#2e2e38']]){
    const f={...base,hairStyle:style,outfit,shirt:col,helmet};await lib.outfitFor(kit,outfit);rig.setLook(f);await Promise.resolve();await Promise.resolve();shot(id,id,f,.28,1.29+kit.proportionLift,1.90);
   }
   sc.remove(rig.root);rig.dispose();
  }
  renderer.dispose();return {images,checks};
 });
 await page.screenshot({path:path.join(out,stage+'.png'),fullPage:true});for(const {id,img}of result.images)fs.writeFileSync(path.join(out,stage+'-'+id+'.png'),Buffer.from(img.split(',')[1],'base64'));delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,stage+'.json'),JSON.stringify(result,null,2));assert.deepEqual(errors,[]);console.log('PASS: '+result.checks.length+' portrait, skin-tone and outfit views. '+path.join(out,stage+'.png'));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
