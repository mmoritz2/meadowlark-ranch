/* Compare the production garments at matching scales, with real animation and skin weights. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const stage=process.env.TAILOR_STAGE||'after',out=path.resolve(__dirname,'../output/runway',stage);fs.mkdirSync(out,{recursive:true});
const RJ=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/__tailoring.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:20px;background:#e8e4db;color:#28352d;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{text-align:center;background:#dcd9cd;border-radius:8px;overflow:hidden}img{width:100%;display:block}.label{padding:9px}</style><h2>Equestrian wardrobe · ${stage}</h2><div class="grid"></div><script>window.RJ=${RJ}</script>`}));
await page.goto(QA.BASE+'/__tailoring.html');
const result=await page.evaluate(async()=>{
 const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary,RIDER_OUTFITS}=await import('/assets/rider-model.js');
 const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,600);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const sc=new THREE.Scene();sc.background=new THREE.Color('#dcd9cd');sc.add(new THREE.HemisphereLight(0xfff8ec,0x65715f,2));const key=new THREE.DirectionalLight(0xfff3e8,2.3);key.position.set(2,3,4);sc.add(key);const fill=new THREE.DirectionalLight(0xcbd9ed,1.1);fill.position.set(-2,2,-3);sc.add(fill);
 const cam=new THREE.PerspectiveCamera(28,.8,.02,20),images=[],checks=[];
 for(const body of ['f','m']){
 const kit=await lib.kit(body);await lib.outfitFor(kit,'polo');const rig=lib.build(kit,{body,outfit:'polo',helmet:'none',hairStyle:'waves'});await new Promise(r=>setTimeout(r,40));sc.add(rig.root);
 const shot=(id,angle,y,d)=>{rig.root.rotation.y=angle;cam.position.set(0,y+.02,d);cam.lookAt(0,y,0);rig.root.updateMatrixWorld(true);
 for(const m of rig.outfit?.meshes||[]){const g=m.geometry,sw=g.attributes.skinWeight,si=g.attributes.skinIndex;m.skeleton.update();for(let i=0;i<sw.count;i++){
 const sum=sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i);if(Math.abs(sum-1)>.002)throw Error('Unnormalized cloth weights: '+m.name);
 for(const get of ['getX','getY','getZ','getW'])if(!m.skeleton.bones[si[get](i)])throw Error('Invalid clothing joint');
 if(i%37===0){const v=m.getVertexPosition(i,new THREE.Vector3());if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Invalid animated cloth vertex');}
 }}
 renderer.render(sc,cam);const img=renderer.domElement.toDataURL('image/png');images.push({id:body+'-'+id,img});checks.push(body+'-'+id);const c=document.createElement('div');c.className='card';c.innerHTML='<img src="'+img+'"><div class="label">'+body+' · '+id+'</div>';document.querySelector('.grid').append(c);};
 for(const id of ['show','polo','quilted','denim']){
 const o=RIDER_OUTFITS.find(o=>o.id===id);await lib.outfitFor(kit,id);rig.setLook({body,outfit:id,shirt:o.palette[0],pants:o.palette[1],boots:o.palette[2],helmet:'none',hairStyle:'waves',hair:'#68422d',neckwear:'none'});await Promise.resolve();await Promise.resolve();rig.mixer.stopAllAction();rig.action('idle').play().setEffectiveWeight(1);rig.mixer.update(.1);
 shot(id+'-front',.12,1.30,2.2);if(body==='f'){
 shot(id+'-detail',.15,1.37,1.68);shot(id+'-back',3.0,1.30,2.15);shot(id+'-full',.12,.94,4.25);shot(id+'-side',1.50,.94,4.25);const head=new THREE.Vector3();rig.bones.Head.getWorldPosition(head);shot(id+'-portrait',.15,head.y+.065,.88);
 if(['show','polo','quilted','denim'].includes(id)){rig.action('idle').setEffectiveWeight(0);for(const [n,p]of kit.seat.local){rig.bones[n].position.copy(p.p);rig.bones[n].quaternion.copy(p.q);}shot(id+'-seated',1.3,1.16,2.9);}
 }
 }
 sc.remove(rig.root);rig.dispose();
 }
 renderer.dispose();return {images,checks};
});
await page.screenshot({path:path.join(out,'overview.png'),fullPage:true});for(const {id,img}of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));assert.deepEqual(errors,[]);console.log('PASS: '+result.checks.length+' tailoring views with normalized weights and valid animated geometry. '+out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
