/* Ordinary CPU benchmark of the approved actual dragon live adapter.
 * Registered source and receipt remain unchanged; no generative tools.
 * Texture stubs only isolate numerical motion cost from rendering. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const threeUrl=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href;
const THREE=await import(threeUrl);
const dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utilsUrl=dataUrl(source('assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js').replace("from 'three'",`from '${threeUrl}'`));
const loaderUrl=dataUrl(source('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js').replace("from 'three'",`from '${threeUrl}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utilsUrl}'`));
const {GLTFLoader}=await import(loaderUrl);
const {createDragonMotion}=await import(pathToFileURL(path.join(root,'assets/dragon-horse-motion.js')).href);
const base=path.join(root,'assets/models/horse-imports/black-dragon/game');
const profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json')));
const loader=new GLTFLoader();
loader.register(parser=>({name:'DRAGON_GEOMETRY_ONLY',loadTexture(index){return Promise.resolve(new THREE.Texture());}}));
const bytes=fs.readFileSync(path.join(base,'dragon.glb'));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let skin;gltf.scene.traverse(o=>{if(o.name==='HorseBody')skin=o;});
if(!skin?.isSkinnedMesh)throw new Error('Actual dragon body missing');
gltf.scene.updateMatrixWorld(true);
const motion=createDragonMotion({THREE,root:gltf.scene,skin,heightM:profile.heightM,profile});

if(!source('assets/dragon-horse-motion.js').includes('skin.skeleton.update();keepAppendagesAboveGround();'))throw new Error('Appendage guard timing control no longer matches adapter');
const noGuardUrl=dataUrl(source('assets/dragon-horse-motion.js').replace("'./artist-horse-motion.js'",JSON.stringify(pathToFileURL(path.join(root,'assets/artist-horse-motion.js')).href)).replace('skin.skeleton.update();keepAppendagesAboveGround();','skin.skeleton.update();'));
const {createDragonMotion:createWithoutGuard}=await import(noGuardUrl);
const output=[];
for(const kind of ['withoutAppendageGuard','current']){
 // Parse and construct before timing; these do not count as live step cost.
 const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');let body;model.scene.traverse(o=>{if(o.name==='HorseBody')body=o;});
 const adapter=(kind==='current'?createDragonMotion:createWithoutGuard)({THREE,root:model.scene,skin:body,heightM:profile.heightM,profile});
 for(const gait of ['stand','gallop','flight']){
  adapter.reset();adapter.set(gait==='flight'?'stand':gait);if(gait==='flight')adapter.setFlight({flying:true,altitude:3,verticalSpeed:0,speedMps:6});for(let i=0;i<120;i++)adapter.update(1/60);
  const before=performance.now();for(let i=0;i<1000;i++)adapter.update(1/60);const elapsed=performance.now()-before;
  output.push({kind,gait,steps:1000,dt:1/60,totalMs:elapsed,meanUpdateMs:elapsed/1000});
 }
}
const report={gameSha256:crypto.createHash('sha256').update(bytes).digest('hex'),motionCodeSha256:crypto.createHash('sha256').update(source('assets/dragon-horse-motion.js')).digest('hex'),groundCoreCodeSha256:crypto.createHash('sha256').update(source('assets/artist-horse-motion.js')).digest('hex'),nodeVersion:process.version,scope:'1000 positive 1/60 s updates after 120 warmup steps; parsing and adapter construction excluded; control removes appendage guard only and retains the same full claw core',results:output,interpretation:'Single-process Node CPU timing, not a browser GPU/frame budget guarantee. Order/JIT noise may affect the control. Compare matched gait rows; the complete live cost includes the core claw correction and the exact wing/tail surface guard.',fixture:'tools/benchmark-imported-dragon.mjs'};
fs.writeFileSync(path.join(base,'performance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'assets/models/horse-imports/black-dragon/game/performance.json',results:output.map(({kind,gait,meanUpdateMs})=>({kind,gait,meanUpdateMs}))}));
