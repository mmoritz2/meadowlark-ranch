// Matching albedo / object-normal views and model reviews of individual CC0 plants.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QA=require('../qa-platform.cjs');
const dest='assets/models/world/undergrowth',scratch='output/undergrowth-bake';fs.mkdirSync(scratch,{recursive:true});
fs.writeFileSync(scratch+'/index.html',`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';import {loadUndergrowthModels} from '/assets/undergrowth-models.js';
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
const templates=await loadUndergrowthModels(T);window.plants=templates;
window.bake=async(index)=>{
 const p=templates[index],scene=new T.Scene(),mesh=new T.Mesh(p.geo,p.mat);scene.add(mesh);const b=p.geo.boundingBox,positions=p.geo.attributes.position;let radius=0;for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getZ(i)));
 const width=radius*2.10,height=1.06,bottom=-.03,cam=new T.OrthographicCamera(-width/2,width/2,bottom+height,bottom,.1,100);
 const results={id:p.id,kind:p.kind,width,height,bottom,triangles:p.triangles,sourceHeight:p.sourceHeight,sourceBottom:p.sourceBottom,views:8};
 for(const normals of[false,true]){
  const tile=256,atlas=document.createElement('canvas');atlas.width=tile*4;atlas.height=tile*2;const ctx=atlas.getContext('2d');renderer.setSize(tile,tile);
  mesh.material=normals?new T.ShaderMaterial({uniforms:{albedo:{value:p.mat.map},cutoff:{value:p.mat.alphaTest}},side:T.DoubleSide,
   vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'uniform sampler2D albedo;uniform float cutoff;varying vec2 vUv;varying vec3 vN;void main(){float a=texture2D(albedo,vUv).a;if(a<cutoff)discard;vec3 n=normalize(vN);if(n.y<0.)n=-n;gl_FragColor=vec4(n*.5+.5,a);}'
  }):new T.MeshBasicMaterial({map:p.mat.map,color:p.mat.color,alphaTest:p.mat.alphaTest,side:T.DoubleSide});
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cam.position.set(Math.sin(a)*10,0,Math.cos(a)*10);cam.lookAt(0,0,0);cam.updateMatrixWorld();renderer.render(scene,cam);ctx.drawImage(renderer.domElement,(i%4)*tile,Math.floor(i/4)*tile);}
  results[normals?'normals':'albedo']=atlas.toDataURL('image/png');mesh.material.dispose();
 }
 mesh.material=p.mat;scene.background=new T.Color('#b9caca');scene.add(new T.HemisphereLight(0xe7f1ff,0x707355,1.8));const sun=new T.DirectionalLight(0xfff0d5,3);sun.position.set(-2,5,4);scene.add(sun);renderer.setSize(900,700);const camera=new T.PerspectiveCamera(35,900/700,.01,30);camera.position.set(1.1,1.5,Math.max(2.8,width*1.25));camera.lookAt(0,.5,0);renderer.render(scene,camera);results.preview=renderer.domElement.toDataURL('image/webp',.95);return results;
};
</script>`);
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e));page.on('console',m=>{if(m.type()==='error')console.error(m.text())});await page.goto(QA.BASE+'/'+scratch+'/index.html');await page.waitForFunction(()=>window.bake,null,{timeout:60000});const entries=[];
 for(let index=0;index<await page.evaluate(()=>plants.length);index++){const {albedo,normals,preview,...meta}=await page.evaluate(i=>bake(i),index),files={};
  for(const [channel,data]of[['albedo',albedo],['normals',normals]]){const file=meta.id+'-'+channel+'.png',bytes=Buffer.from(data.split(',')[1],'base64');fs.writeFileSync(dest+'/'+file,bytes);files[channel]={file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  fs.writeFileSync(scratch+'/'+meta.id+'.webp',Buffer.from(preview.split(',')[1],'base64'));entries.push({...meta,files});console.log(meta.id,JSON.stringify(meta));
 }
 fs.writeFileSync(dest+'/views.json',JSON.stringify({processing:'Eight unlit albedo and object-normal views of individual, rooted specimens and original three-shoot arrangements. Original source PBR maps and alpha masks retained on full models.',plants:entries},null,2)+'\n');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
