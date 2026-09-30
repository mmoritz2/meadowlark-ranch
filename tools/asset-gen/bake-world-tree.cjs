// Bake eight unlit albedo views of the CC0 tree for distant, live-lit impostors.
// Run with the local preview server. Nothing from a reference game is used.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const QA=require('../qa-platform.cjs');
const dest='assets/models/world/realism',scratch='output/tree-bake';fs.mkdirSync(scratch,{recursive:true});
fs.writeFileSync(scratch+'/index.html',`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(512,512);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(),asset=await new GLTFLoader().loadAsync('/assets/models/world/realism/tree_small_02.glb');
asset.scene.traverse(o=>{if(o.isMesh){const old=o.material;
 o.material=new T.MeshBasicMaterial({map:old.map,color:old.color,alphaTest:old.alphaTest,side:T.DoubleSide});}});
scene.add(asset.scene);
const camera=new T.OrthographicCamera(-3,3,4.8,-.2,.1,30);
const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;const ctx=atlas.getContext('2d');
for(let i=0;i<8;i++){
 const a=i*Math.PI/4;camera.position.set(Math.sin(a)*12,0,Math.cos(a)*12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 renderer.render(scene,camera);ctx.drawImage(renderer.domElement,(i%4)*512,Math.floor(i/4)*512);
}
window.bake={png:atlas.toDataURL(),width:6,height:5,bottom:-.2,views:8};
</script>`);
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e));
  await page.goto(QA.BASE+'/'+scratch+'/index.html');await page.waitForFunction(()=>window.bake,null,{timeout:60000});
  const {png,...meta}=await page.evaluate(()=>window.bake);
  const req=require('node:module').createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):__filename);
  const bytes=await req('sharp')(Buffer.from(png.split(',')[1],'base64')).webp({quality:94,alphaQuality:100}).toBuffer();
  fs.writeFileSync(dest+'/tree_small_02_views.webp',bytes);
  fs.writeFileSync(dest+'/tree-impostor.json',JSON.stringify({...meta,source:'tree_small_02.glb',sourcePage:'https://polyhaven.com/a/tree_small_02',license:'CC0-1.0',file:'tree_small_02_views.webp',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),processing:'Eight orthographic unlit albedo views. Lighting is applied in the game.'},null,2)+'\n');
  console.log('Baked 8 tree views:',bytes.length,'bytes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
