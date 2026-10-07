// Render original wardrobe treatments of the existing CC0 Quaternius characters.
// Albedo and posed world normals keep distant residents responsive to live lighting.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QA=require('../qa-platform.cjs');
const root=path.resolve(__dirname,'../..'),dest=path.join(root,'assets/models/npc-distance');fs.mkdirSync(dest,{recursive:true});
const defs=JSON.parse(fs.readFileSync(path.join(__dirname,'npc-distance-definitions.json'))),RJ=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__npc_bake.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script>window.RJ=${RJ}</script>`}));
 await page.goto(QA.BASE+'/__npc_bake.html');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary}=await import('/assets/rider-model.js'),{createNPCCharacters,npcAppearance}=await import('/assets/npc-characters.js');
  const library=createRiderLibrary({THREE:T,GLTFLoader,clone,RJ}),renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(64,128);renderer.setClearColor(0,0);renderer.toneMapping=T.NoToneMapping;
  window.bakeNPC=async def=>{
   const scene=new T.Scene(),g=new T.Group(),entry={def,g};scene.add(g);const system=createNPCCharacters({THREE:T,riderLibrary:library,limit:1});
   const step=dt=>system.update(dt,{entries:[entry],player:{x:0,z:5},ready:true});
   while(!system.get(def.id)){step(.05);await new Promise(r=>setTimeout(r,20));if(system.stats().failed.length)throw Error('NPC failed: '+def.id);}
   const rig=system.get(def.id);for(let i=0;i<30;i++)step(.05);
   const poses=def.folk?3:1,width=1.35,height=2.2,bottom=-.055,atlases=[false,true].map(()=>{const c=document.createElement('canvas');c.width=256;c.height=256*poses;return c;});
   const camera=new T.OrthographicCamera(-width/2,width/2,bottom+height,bottom,.1,30),v=new T.Vector3(),materials=new Map();
   rig.root.traverse(o=>{if(o.isMesh&&!materials.has(o.material)){const m=o.material;materials.set(m,{compile:m.onBeforeCompile,key:m.customProgramCacheKey,coverage:m.alphaToCoverage});m.alphaToCoverage=false;}});
   let maxEdgeAlpha=0;
   for(let pose=0;pose<poses;pose++){
    if(pose){for(let i=0;i<35;i++){g.position.z+=.065;step(.05);}rig.action('walk').time=(pose===1?.12:.62)*rig.action('walk').getClip().duration;rig.mixer.update(0);}
    g.position.set(0,0,0);rig.root.position.y=0;g.updateMatrixWorld(true);let min=Infinity;
    for(const m of rig.outfit.meshes.filter(m=>/Feet/.test(m.name))){m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);min=Math.min(min,v.y);}}
    rig.root.position.y=.003-min;g.updateMatrixWorld(true);
    for(let channel=0;channel<2;channel++){
     const normal=channel===1;renderer.outputColorSpace=normal?T.LinearSRGBColorSpace:T.SRGBColorSpace;
     for(const[m,original]of materials){m.onBeforeCompile=(sh,r)=>{original.compile.call(m,sh,r);sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',normal?'gl_FragColor=vec4(inverseTransformDirection(normal,viewMatrix)*.5+.5,diffuseColor.a);':'gl_FragColor=diffuseColor;');};m.customProgramCacheKey=()=>original.key.call(m)+'-npc-bake-'+channel;m.needsUpdate=true;}
     const ctx=atlases[channel].getContext('2d');for(let view=0;view<8;view++){const a=view*Math.PI/4;camera.position.set(Math.sin(a)*10,0,Math.cos(a)*10);camera.lookAt(0,0,0);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,view%4*64,(pose*2+Math.floor(view/4))*128);}
    }
   }
   for(const atlas of atlases){const ctx=atlas.getContext('2d');for(let row=0;row<poses*2;row++)for(let col=0;col<4;col++){const data=ctx.getImageData(col*64,row*128,64,128).data;for(let y=0;y<128;y++)for(let x=0;x<64;x++)if(x===0||x===63||y===0||y===127)maxEdgeAlpha=Math.max(maxEdgeAlpha,data[(y*64+x)*4+3]);}}
   for(const[m,o]of materials){m.onBeforeCompile=o.compile;m.customProgramCacheKey=o.key;m.alphaToCoverage=o.coverage;}
   const images=atlases.map(a=>a.toDataURL());system.dispose();return{id:def.id,appearance:npcAppearance(def),width,height,bottom,poses,views:8,tile:[64,128],maxEdgeAlpha,images};
  };
 });
 const entries=[];for(const def of defs){const {images,...meta}=await page.evaluate(def=>bakeNPC(def),def);meta.files={};for(let i=0;i<2;i++){const kind=i?'normals':'albedo',file=def.id+'-'+kind+'.png',bytes=Buffer.from(images[i].split(',')[1],'base64');fs.writeFileSync(path.join(dest,file),bytes);meta.files[kind]={file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}entries.push(meta);console.log(def.id,meta.poses,meta.maxEdgeAlpha);if(meta.maxEdgeAlpha>0)throw Error('Atlas clipping '+def.id);}
 if(errors.length)throw Error(errors.join('\n'));
 const sources=['ranch3d.html','assets/npc-characters.js','assets/rider-model.js','assets/rider-face.js','assets/rider-tailoring.js','assets/rider-clothes.js','assets/rider-proportions.js','assets/rider-hairstyles.js','assets/rider-heads.js','assets/rider-head-surface.js','assets/models/rider/stylized-f-head.glb','assets/models/rider/stylized-m-head.glb'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version:1,source:'Existing CC0 Quaternius bodies, outfits and animations, CC0 Blender Studio Human Base Meshes heads, and original Meadowlark tailoring, hair, face treatments and NPC appearances.',sources,entries},null,2)+'\n');console.log('Baked',entries.length,'residents');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
