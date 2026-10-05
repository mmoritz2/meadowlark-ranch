/* Existing local characters only; no game save, multiplayer or remote downloads. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-horses-main/review/npc-characters';fs.mkdirSync(out,{recursive:true});
const rj=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===new URL(QA.BASE).origin?route.continue():route.abort();});
 await page.route('**/__npc_qa.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset=utf-8><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:16px;background:#dedbd1;color:#29392f;font:15px system-ui}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.card{text-align:center}img{width:100%}</style><h2>Meadowlark residents · existing character library</h2><div class=grid></div><script>window.RJ=${rj}</script>`}));
 await page.goto(QA.BASE+'/__npc_qa.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js');
  const {createRiderLibrary}=await import('/assets/rider-model.js'),{createNPCCharacters}=await import('/assets/npc-characters.js?v=npc-characters-1');
  const library=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),warnings=[];
  const system=createNPCCharacters({THREE,riderLibrary:library,onError:(m,e)=>warnings.push(m+':'+e.message)});
  const ids=['wren','june','ada','otto','bea','ilse'],entries=ids.map((id,i)=>{const g=new THREE.Group();g.position.x=i*3;const placeholder=new THREE.Group(),tag=new THREE.Sprite();tag.visible=false;g.add(placeholder,tag);return {def:{id},g,placeholder,tag};});
  const player={x:7.5,z:4},step=(dt=.05,talkingId=null)=>system.update(dt,{entries,player,ready:true,talkingId});
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dedbd1');for(const e of entries)scene.add(e.g);
  scene.add(new THREE.HemisphereLight(0xfff8eb,0x616a55,2));const sun=new THREE.DirectionalLight(0xfff3df,2.5);sun.position.set(4,8,6);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xbbd1ef,1);fill.position.set(-4,3,-3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#aeaa9a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
  const until=performance.now()+30000;while(system.stats().active<ids.length&&performance.now()<until){step();await new Promise(r=>setTimeout(r,40));}
  if(system.stats().active!==ids.length)throw Error(JSON.stringify(system.stats()));
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,500);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const cam=new THREE.PerspectiveCamera(30,.72,.03,40),v=new THREE.Vector3(),images=[],checks=[];
  function sample(e){
   const rig=system.get(e.def.id);rig.root.updateMatrixWorld(true);const bones=Object.values(rig.bones);let finite=bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),minFootY=Infinity,maxY=-Infinity,vertices=0;
   for(const m of rig.outfit.meshes){m.skeleton.update();const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/200))){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);finite&&=[v.x,v.y,v.z].every(Number.isFinite);maxY=Math.max(maxY,v.y);vertices++;}
    if(/Feet/.test(m.name))for(let i=0;i<pos.count;i++){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);minFootY=Math.min(minFootY,v.y);}
   }
   return {bones:bones.length,finite,minFootY,maxY,vertices};
  }
  for(const e of entries){
   let lowest=Infinity,highest=-Infinity;const heads=[];
   for(let i=0;i<70;i++){step(.05,i>20&&i<55?e.def.id:null);const s=sample(e);if(!s.finite)throw Error('Nonfinite '+e.def.id);lowest=Math.min(lowest,s.minFootY);highest=Math.max(highest,s.minFootY);heads.push(system.get(e.def.id).bones.Head.quaternion.toArray());}
   const originZ=e.g.position.z;e.def.folk=true;let walkLow=Infinity,walkHigh=-Infinity;
   for(let i=0;i<50;i++){e.g.position.z+=.045;step(.05);const s=sample(e);walkLow=Math.min(walkLow,s.minFootY);walkHigh=Math.max(walkHigh,s.minFootY);}
   e.g.position.z=originZ;e.def.folk=false;
   for(let i=0;i<30;i++)step();
   for(const other of entries)other.g.visible=other===e;
   cam.position.set(e.g.position.x+.3,1.1,4.15);cam.lookAt(e.g.position.x,.90,0);renderer.render(scene,cam);
   const img=renderer.domElement.toDataURL('image/png');images.push({id:e.def.id+'-standing',img});
   const card=document.createElement('div');card.className='card';card.innerHTML='<img src="'+img+'"><b>'+e.def.id+'</b>';document.querySelector('.grid').append(card);
   for(let i=0;i<20;i++)step(.05,e.def.id);
   cam.position.set(e.g.position.x+1.2,1.45,2.25);cam.lookAt(e.g.position.x,1.30,0);renderer.render(scene,cam);
   if(['wren','june'].includes(e.def.id))images.push({id:e.def.id+'-talking',img:renderer.domElement.toDataURL('image/png')});
   checks.push({id:e.def.id,...sample(e),lowestFoot:lowest,highestFoot:highest,walkLow,walkHigh,visualSoleOffset:system.get(e.def.id).root.position.y,headRange:Math.max(...heads.map(q=>q[1]))-Math.min(...heads.map(q=>q[1])),placeholderHidden:!e.placeholder.visible,rootUnchanged:e.g.position.x===ids.indexOf(e.def.id)*3&&e.g.position.y===0});
   for(const other of entries)other.g.visible=true;
  }
  const drawCalls=renderer.info.render.calls;system.dispose();renderer.dispose();return {checks,images,warnings,drawCalls};
 });
 await page.screenshot({path:path.join(out,'residents.png'),fullPage:true});for(const {id,img}of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));delete result.images;
 result.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(result.warnings,[]);assert.ok(result.checks.every(c=>c.finite&&c.placeholderHidden&&c.rootUnchanged));
 assert.ok(result.checks.every(c=>c.lowestFoot>-.005&&c.highestFoot<.035&&c.walkLow>-.005&&c.walkHigh<.035),'Native idle/talk feet stay close to ground');
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
