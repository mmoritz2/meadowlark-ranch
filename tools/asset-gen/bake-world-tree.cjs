// Bake albedo and object-normal views from the existing CC0 tree scans.
// The matching normal atlas lets a two-triangle distant tree catch real sunlight.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const QA=require('../qa-platform.cjs');
const dest='assets/models/world/realism',scratch='output/tree-bake';fs.mkdirSync(scratch,{recursive:true});
fs.writeFileSync(scratch+'/index.html',`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
const loader=new GLTFLoader();
window.bakeTree=async(id,variant=-1)=>{
 const asset=await loader.loadAsync('/assets/models/world/realism/'+id+'.glb');
 let root=asset.scene;if(variant>=0){root=asset.scene.children[variant];root.removeFromParent();root.position.set(0,0,0);}
 const scene=new T.Scene();scene.add(root);root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
 const width=Math.max(size.x,size.z)*1.10,height=size.y*1.06,bottom=bounds.min.y-size.y*.03;
 const camera=new T.OrthographicCamera(-width/2,width/2,bottom+height,bottom,.1,100);
 const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push([o,o.material]);});
 const results={width,height,bottom,sourceHeight:size.y,viewCount:8};
 for(const normal of [false,true]){
  const tile=normal?512:variant<0?768:512;renderer.setSize(tile,tile);
  const atlas=document.createElement('canvas');atlas.width=tile*4;atlas.height=tile*2;const ctx=atlas.getContext('2d');
  for(const [o,old]of meshes){
   if(!normal)o.material=new T.MeshBasicMaterial({map:old.map,color:old.color,alphaTest:old.alphaTest,side:T.DoubleSide});
   else o.material=new T.ShaderMaterial({uniforms:{albedo:{value:old.map},cutoff:{value:old.alphaTest||0},hasMap:{value:!!old.map}},side:T.DoubleSide,
    vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D albedo;uniform float cutoff;uniform bool hasMap;varying vec2 vUv;varying vec3 vN;void main(){float a=hasMap?texture2D(albedo,vUv).a:1.;if(a<cutoff)discard;vec3 n=normalize(vN);if(n.y<0.)n=-n;gl_FragColor=vec4(n*.5+.5,a);}'
   });
  }
  for(let i=0;i<8;i++){const a=i*Math.PI/4;camera.position.set(Math.sin(a)*30,0,Math.cos(a)*30);camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.render(scene,camera);ctx.drawImage(renderer.domElement,(i%4)*tile,Math.floor(i/4)*tile);}
  results[normal?'normal':'albedo']=atlas.toDataURL();
  for(const [o]of meshes)o.material.dispose();
 }
 for(const[o,m]of meshes){o.material=m;o.geometry.dispose();m.dispose();}
 return results;
};
</script>`);
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e));
  await page.goto(QA.BASE+'/'+scratch+'/index.html');await page.waitForFunction(()=>window.bakeTree);
  const entries=[];
  for(const [id,variant]of [['tree_small_02',-1],['fir_sapling_medium',0],['fir_sapling_medium',1],['fir_sapling_medium',2]]){
   const {albedo,normal,...meta}=await page.evaluate(([id,v])=>bakeTree(id,v),[id,variant]);
   const prefix=id+(variant>=0?'_'+variant:'');const files={};
   for(const [channel,data]of [['views',albedo],['normals',normal]]){
    const png=scratch+'/'+prefix+'_'+channel+'.png',file=prefix+'_'+channel+'.webp';fs.writeFileSync(png,Buffer.from(data.split(',')[1],'base64'));
    execFileSync('python3',['-c','from PIL import Image;import sys;Image.open(sys.argv[1]).save(sys.argv[2],"WEBP",lossless=True,method=6)',png,dest+'/'+file]);
    const bytes=fs.readFileSync(dest+'/'+file);files[channel]={file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
   }
   entries.push({id,variant,...meta,...files,source:id+'.glb',sourcePage:'https://polyhaven.com/a/'+id,license:'CC0-1.0'});console.log(prefix,JSON.stringify(meta));
  }
  fs.writeFileSync(dest+'/tree-impostors.json',JSON.stringify({processing:'Eight orthographic albedo and object-space normal views of the existing CC0 scans. Live lighting is applied by the game.',trees:entries},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
