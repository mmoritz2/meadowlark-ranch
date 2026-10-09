// Bake albedo and object-normal views from the existing CC0 tree scans.
// The matching normal atlas lets a two-triangle distant tree catch real sunlight.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(process.env.TREE_BAKE_ROOT||process.cwd());
const sourceDir=path.join(root,'assets/models/world/realism');
const dest=path.resolve(root,process.env.TREE_BAKE_OUTPUT_DIR||'assets/models/world/realism'),scratch=path.resolve(root,process.env.TREE_BAKE_SCRATCH_DIR||'output/tree-bake');
// Default reproduces the shipped broadleaf pigment. Legacy rendering is an
// explicit diagnostic and cannot overwrite production atlases.
const albedoOnly=process.env.TREE_BAKE_ALBEDO_ONLY==='1',legacyPigment=process.env.TREE_BAKE_LEGACY_PIGMENT==='1';
const pigmentModule=legacyPigment?'':(process.env.TREE_BAKE_PIGMENT_MODULE||'assets/summer-leaf-pigment.mjs?v=summer-leaf-pigment-1');
const legacyIslandSurfaces=process.env.TREE_BAKE_LEGACY_ISLAND_SURFACES==='1';
const islandGeometryModule=legacyIslandSurfaces?'':(process.env.TREE_BAKE_ISLAND_GEOMETRY_MODULE||'assets/island-leaf-surfaces.mjs?v=island-leaf-surfaces-1');
const retainFrames=albedoOnly||process.env.TREE_BAKE_RETAIN_FRAMES==='1';
assert(!islandGeometryModule||/^assets\/[A-Za-z0-9_./-]+(?:\?v=[A-Za-z0-9_.-]+)?$/.test(islandGeometryModule),'Safe local island geometry module');
if(legacyIslandSurfaces)assert.notEqual(dest,sourceDir,'Legacy island geometry is diagnostic-only: use a separate output directory');
if(legacyPigment)assert.notEqual(dest,sourceDir,'Legacy pigment is diagnostic-only: use a separate output directory');
assert(!pigmentModule||/^assets\/[A-Za-z0-9_./-]+(?:\?v=[A-Za-z0-9_.-]+)?$/.test(pigmentModule),'Safe local pigment module URL');
const routeSpec=process.env.TREE_BAKE_ROUTES?JSON.parse(fs.readFileSync(path.resolve(process.env.TREE_BAKE_ROUTES),'utf8')):{};
const routeBodies=Object.entries(routeSpec).map(([file,p])=>{assert(!file.startsWith('/')&&!file.includes('..'),'Root-relative route path');return{file,path:path.resolve(p),body:fs.readFileSync(p)};});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalogPath=path.resolve(process.env.TREE_BAKE_CATALOG||(!albedoOnly&&fs.existsSync(path.join(dest,'tree-impostors.json'))?path.join(dest,'tree-impostors.json'):path.join(sourceDir,'tree-impostors.json')));
if(albedoOnly)assert.notEqual(dest,sourceDir,'Albedo-only requires a separate output directory so original coverage and normals remain available');
const prior=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const pigmentFile=pigmentModule.split('?')[0],pigmentBody=pigmentModule?(routeBodies.find(r=>r.file===pigmentFile)?.body||fs.readFileSync(path.join(root,pigmentFile))):null;
const pigmentProvenance=pigmentBody?{profile:'summer-leaf-pigment-1',helper:pigmentFile,helperSha256:sha(pigmentBody),operation:'Shared runtime/baker broadleaf-only linear-luminance-preserving summer pigment; 58% authored chroma blend, original texture contrast, alpha, wood, fruit and normals retained.',sourceLicenseUnchanged:true}:null;
const geometryFile=islandGeometryModule.split('?')[0],geometryBody=islandGeometryModule?(routeBodies.find(r=>r.file===geometryFile)?.body||fs.readFileSync(path.join(root,geometryFile))):null;
const geometryProvenance=geometryBody?{profile:'island-leaf-surfaces-1',helper:geometryFile,helperSha256:sha(geometryBody),operation:'Shared runtime/baker island leaf quad surface growth; original centers, UVs, topology, wood and source/view extrema retained. Both atlas channels and canopy shade rebuilt.'}:null;
const broadleafIDs=new Set(['tree_small_02','tree_small_02_mature_leaves','island_tree_01','orchard_apple','jacaranda_tree','upright_broadleaf_01']);
const baselineFile=file=>{const beside=path.join(path.dirname(catalogPath),file);return fs.existsSync(beside)?beside:path.join(sourceDir,file);};
const requested=process.argv.slice(2),jobs=requested.length?requested.map(id=>[id,['tree_small_02','island_tree_01','jacaranda_tree','orchard_apple','tree_small_02_mature_leaves','upright_broadleaf_01'].includes(id)?-1:0]):[['tree_small_02',-1],['fir_sapling_medium',0],['fir_sapling_medium',1],['fir_sapling_medium',2]];
// A color-only pass may reuse already-grown island surfaces, but cannot create,
// remove or revise that geometry under an older normal atlas. Bind the exact
// helper before writing outputs, then compare emitted stats during the bake.
if(albedoOnly)for(const [id,variant]of jobs)if(id==='island_tree_01'||id==='orchard_apple'){
 const previous=prior.trees.find(t=>t.id===id&&t.variant===variant);
 assert(previous,'Prior island catalog entry required for albedo-only '+id);
 if(geometryProvenance){
  assert(previous.leafSurfaces,'Albedo-only island requires a previous full-channel geometry bake '+id);
  for(const key of ['profile','helper','helperSha256'])assert.equal(previous.leafSurfaces[key],geometryProvenance[key],'Albedo-only island geometry binding mismatch: '+key);
 }else assert(!previous.leafSurfaces,'Albedo-only cannot remove geometry baked into existing normal atlas');
}
// Albedo-only is valid for color work, never a geometry/normal-source change.
if(albedoOnly)for(const r of routeBodies)if(/\.glb$|mature-leaf-patches\.mjs$|tree-normal-material\.mjs$/.test(r.file))assert.equal(sha(r.body),sha(fs.readFileSync(path.join(root,r.file))),'Albedo-only source geometry/normal owner must remain exact: '+r.file);
fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const receipt={mode:albedoOnly?'albedo-only':'full',root,destination:dest,catalog:{path:catalogPath,sha256:sha(fs.readFileSync(catalogPath))},pigmentModule,pigmentProvenance,islandGeometryModule,geometryProvenance,retainFrames,diagnosticLegacyPigment:legacyPigment,diagnosticLegacyIslandSurfaces:legacyIslandSurfaces,routes:routeBodies.map(({file,path,body})=>({file,path,sha256:sha(body)})),bakerSha256:sha(fs.readFileSync(__filename)),entries:[]};
fs.writeFileSync(scratch+'/index.html',`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three';
import {createMatchedTreeNormalMaterial} from '/tools/asset-gen/tree-normal-material.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createForageArt} from '/assets/forage-art.js?v=leafy-orchard-1';
import {createOrchardFruit} from '/assets/orchard-art.js?v=leafy-orchard-1';
import {prepareCanopyShade,patchCanopyShade} from '/assets/canopy-shading.js?v=canopy-depth-1';
${pigmentModule?"import {patchSummerLeafPigment} from '/"+pigmentModule+"';":''}
${islandGeometryModule?"import {applyIslandLeafSurfaces} from '/"+islandGeometryModule+"';":''}
import {MATURE_LEAF_ALIAS,createMatureLeafGeometry} from '/assets/mature-leaf-patches.mjs?v=mature-leaf-patches-1';
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
const loader=new GLTFLoader();
const existingFrames=${JSON.stringify(prior.trees.map(({id,variant,width,height,bottom,sourceHeight,viewCount,normalProfile})=>({id,variant,width,height,bottom,sourceHeight,viewCount,normalProfile})))};
// Symmetric framing about the retained source origin, including all eight bake views.
function treeViewHalfWidth(root){
 const point=new T.Vector3();let half=0;
 root.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
   if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))throw Error('Nonfinite tree view vertex');
   for(let frame=0;frame<8;frame++){const angle=frame*Math.PI/4;
    half=Math.max(half,Math.abs(point.x*Math.cos(angle)-point.z*Math.sin(angle)));
   }
  }
 });
 if(!(half>0&&Number.isFinite(half)))throw Error('Empty horizontal tree view extent');
 return half;
}
window.bakeTree=async(id,variant=-1)=>{
 const source=id==='orchard_apple'?'island_tree_01':id===MATURE_LEAF_ALIAS?'tree_small_02':id;
 const asset=await loader.loadAsync('/assets/models/world/realism/'+source+'.glb');
 let root=asset.scene;if(variant>=0){root=asset.scene.children[variant];root.removeFromParent();root.position.set(0,0,0);}
 const scene=new T.Scene();scene.add(root);root.updateMatrixWorld(true);
 if(id===MATURE_LEAF_ALIAS)root.traverse(o=>{if(o.isMesh&&o.material.name==='tree_small_02_leaves')o.geometry=createMatureLeafGeometry(T,o.geometry);});
 let islandSurfaceStats=null;
 ${islandGeometryModule?"if(source==='island_tree_01')root.traverse(o=>{if(o.isMesh&&o.material.name==='island_tree_01_leaves')islandSurfaceStats=applyIslandLeafSurfaces(T,o.geometry);});":''}
 // Shade the shared scan before adding original fruit, exactly as runtime does.
 const canopyShading=prepareCanopyShade(T,root);
 let orchardFruit=null;
 if(id==='orchard_apple'){
  let branch;root.traverse(o=>{if(o.isMesh&&o.material.name.endsWith('_branches'))branch=o;});
  const geo=branch.geometry.clone().applyMatrix4(branch.matrixWorld),size=new T.Box3().setFromObject(root).getSize(new T.Vector3());
  const fruit=createOrchardFruit({THREE:T,branchGeometry:geo,sourceHeight:size.y,forageArt:createForageArt({THREE:T})});root.add(fruit.root);orchardFruit=fruit.stats;geo.dispose();
 }
 root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
 const naturalFrame={width:treeViewHalfWidth(root)*2*1.10,height:size.y*1.06,bottom:bounds.min.y-size.y*.03};
 const retainedFrame=${retainFrames?'existingFrames.find(f=>f.id===id&&f.variant===variant)':'null'};
 if(${retainFrames?'true':'false'}&&!retainedFrame)throw Error('Missing original normal-aligned frame '+id);
 if(retainedFrame&&(retainedFrame.viewCount!==8||Math.abs(retainedFrame.sourceHeight-size.y)>1e-9))throw Error('Source height/view count changed; color-only cannot reuse normal atlas '+id);
 // Color-only never recomputes its orthographic frame. Older normal atlases
 // were authored with an earlier width policy, which must remain aligned.
 const {width,height,bottom}=retainedFrame||naturalFrame;
 const framingAudit={retained:!!retainedFrame,naturalFrame,renderedFrame:{width,height,bottom},rawGeometry:[]};
 const point=new T.Vector3();
 for(let view=0;view<8;view++){
  const angle=view*Math.PI/4,co=Math.cos(angle),si=Math.sin(angle),row={view,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,vertices:0,outside:0};
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const x=point.x*co-point.z*si,y=point.y;row.vertices++;row.minX=Math.min(row.minX,x);row.maxX=Math.max(row.maxX,x);row.minY=Math.min(row.minY,y);row.maxY=Math.max(row.maxY,y);
   if(x< -width/2||x>width/2||y<bottom||y>bottom+height)row.outside++;
  }});framingAudit.rawGeometry.push(row);
 }
 framingAudit.rawGeometryFits=framingAudit.rawGeometry.every(r=>r.outside===0);
 framingAudit.limit='Raw POSITION bounds include transparent leaf margins; a crossing reports pre-existing projected geometry clipping, not proof of opaque leaf-pixel loss. Color-only alpha is separately compared byte-for-byte; full-channel geometry work intentionally rebuilds coverage.';
 const camera=new T.OrthographicCamera(-width/2,width/2,bottom+height,bottom,.1,100);
 const meshes=[];root.traverse(o=>{if(o.isMesh){if(id==='pine_tree_01'&&/twig/.test(o.material.name))o.material.color.setRGB(1.7,2.1,1.5);meshes.push([o,o.material]);}});
 const results={width,height,bottom,sourceHeight:size.y,viewCount:8,framingAudit,islandSurfaceStats,...(id==='upright_broadleaf_01'?{normalProfile:'view-facing-material-v1'}:{}),...(orchardFruit?{orchardFruit}:{}),...(canopyShading?{canopyShading}:{})};
 const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
 const channelDiagnostics=[];
 for(const normal of ${albedoOnly?'[false]':'[false,true]'}){
  const tile=normal?512:variant<0?768:512;renderer.setSize(tile,tile);
  const atlas=document.createElement('canvas');atlas.width=tile*4;atlas.height=tile*2;const ctx=atlas.getContext('2d');
  for(const [o,old]of meshes){
   if(!normal){o.material=new T.MeshBasicMaterial({map:old.map,color:old.color,vertexColors:old.vertexColors,alphaTest:old.alphaTest,side:T.DoubleSide});
    if(${pigmentModule?'true':'false'}||o.geometry.attributes.canopyShade){o.material.onBeforeCompile=sh=>{${pigmentModule?'patchSummerLeafPigment(sh,old.name);':''}if(o.geometry.attributes.canopyShade)patchCanopyShade(sh);};o.material.customProgramCacheKey=()=> 'canopy-shade-bake-v1${pigmentModule?':summer-leaf-pigment-1':''}:'+!!o.geometry.attributes.canopyShade;}}

   else o.material=id==='upright_broadleaf_01'?createMatchedTreeNormalMaterial(T,old):new T.ShaderMaterial({uniforms:{albedo:{value:old.map},cutoff:{value:old.alphaTest||0},hasMap:{value:!!old.map}},side:T.DoubleSide,
    vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D albedo;uniform float cutoff;uniform bool hasMap;varying vec2 vUv;varying vec3 vN;void main(){float a=hasMap?texture2D(albedo,vUv).a:1.;if(a<cutoff)discard;vec3 n=normalize(vN);if(n.y<0.)n=-n;gl_FragColor=vec4(n*.5+.5,a);}'
   });
  }
  for(let i=0;i<8;i++){const a=i*Math.PI/4;camera.position.set(Math.sin(a)*30,0,Math.cos(a)*30);camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.render(scene,camera);ctx.drawImage(renderer.domElement,(i%4)*tile,Math.floor(i/4)*tile);}
  results[normal?'normal':'albedo']=atlas.toDataURL();
  // Capture programs while their temporary materials still own live programs.
  // Disposing first silently emptied this evidence in the previous tool.
  const programs=renderer.info.programs.map(p=>({linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),vertex:gl.getShaderParameter(p.vertexShader,gl.COMPILE_STATUS),fragment:gl.getShaderParameter(p.fragmentShader,gl.COMPILE_STATUS)}));
  if(!programs.length||programs.some(p=>!p.linked||!p.vertex||!p.fragment))throw Error('Missing or invalid live bake programs');
  const error=gl.getError();if(error!==0)throw Error('Bake channel GL error '+error);
  channelDiagnostics.push({channel:normal?'normals':'views',views:8,tile,gl:error,programs});
  for(const [o]of meshes)o.material.dispose();
 }
 for(const[o,m]of meshes){o.material=m;o.geometry.dispose();m.dispose();}
 results.bakeDiagnostics={renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,gl:gl.getError(),channels:channelDiagnostics,programs:channelDiagnostics.flatMap(c=>c.programs)};
 return results;
};
</script>`);
(async()=>{
 if(process.env.TREE_BAKE_PREFLIGHT_ONLY==='1'){fs.writeFileSync(path.join(dest,'bake-preflight.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({ready:true,mode:receipt.mode,destination:dest,routes:receipt.routes,pigmentModule}));return;}
 const QA=require(path.join(root,'tools/qa-platform.cjs'));
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__tree-bake-candidate.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(scratch,'index.html'))}));
  for(const entry of routeBodies)await page.route('**/'+entry.file+'*',r=>r.fulfill({contentType:entry.file.endsWith('.glb')?'model/gltf-binary':entry.file.endsWith('.webp')?'image/webp':entry.file.endsWith('.json')?'application/json':'text/javascript',body:entry.body}));
  await page.goto(QA.BASE+'/__tree-bake-candidate.html');await page.waitForFunction(()=>window.bakeTree);
  const entries=[];
  for(const [id,variant]of jobs){
   const {albedo,normal,bakeDiagnostics,framingAudit,islandSurfaceStats,...meta}=await page.evaluate(([id,v])=>bakeTree(id,v),[id,variant]);
   assert.equal(errors.length,0,errors.join('\n'));assert(bakeDiagnostics.renderer&&!/SwiftShader|llvmpipe/i.test(bakeDiagnostics.renderer),'Native GPU required');assert.equal(bakeDiagnostics.gl,0);assert.equal(bakeDiagnostics.channels.length,albedoOnly?1:2);assert(bakeDiagnostics.channels.every(c=>c.views===8&&c.gl===0&&c.programs.length>0&&c.programs.every(p=>p.linked&&p.vertex&&p.fragment)),'Each channel must capture nonempty live compiled/linked programs before disposal');
   const previous=prior.trees.find(t=>t.id===id&&t.variant===variant),binding={id,variant,diagnostics:bakeDiagnostics,framing:{},framingAudit,islandSurfaceStats,alpha:null,normal:null};
   if(islandSurfaceStats){assert(previous,'Island geometry bake requires prior source metadata');assert.equal(meta.sourceHeight,previous.sourceHeight,'Island source height remains exact');assert.equal(meta.bottom,previous.bottom,'Island source bottom remains exact');assert.equal(meta.height,previous.height,'Island vertical frame remains exact');}
   if(albedoOnly){assert(previous,'Prior catalog entry required for albedo-only '+id);if(islandSurfaceStats)assert.deepEqual(islandSurfaceStats,previous.leafSurfaces.stats,'Albedo-only emitted island geometry must match original normal atlas');for(const key of ['width','height','bottom','sourceHeight','viewCount']){assert(Number.isFinite(meta[key]));assert(Math.abs(meta[key]-previous[key])<1e-9,'Framing changed '+id+' '+key);binding.framing[key]={before:previous[key],after:meta[key]};}assert.equal(meta.normalProfile,previous.normalProfile,'Normal profile must stay exact');assert.deepEqual(meta.canopyShading,previous.canopyShading,'Canopy geometry/shading must stay exact');}
   const prefix=id+(variant>=0?'_'+variant:'');const files={};
   for(const [channel,data]of (albedoOnly?[['views',albedo]]:[['views',albedo],['normals',normal]])){
    const png=scratch+'/'+prefix+'_'+channel+'.png',file=prefix+'_'+channel+'.webp';fs.writeFileSync(png,Buffer.from(data.split(',')[1],'base64'));
    execFileSync('python3',['-c','from PIL import Image;import sys;Image.open(sys.argv[1]).save(sys.argv[2],"WEBP",lossless=True,method=6)',png,dest+'/'+file]);
    if(albedoOnly){const original=baselineFile(previous.views.file);assert.equal(sha(fs.readFileSync(original)),previous.views.sha256,'Prior albedo hash mismatch');binding.alpha=JSON.parse(execFileSync('python3',['-c','from PIL import Image;import sys,json,hashlib; a=Image.open(sys.argv[1]).convert("RGBA"); b=Image.open(sys.argv[2]).convert("RGBA"); assert a.size==b.size,"Atlas dimensions changed"; aa=a.getchannel("A").tobytes(); bb=b.getchannel("A").tobytes(); assert aa==bb,"Alpha coverage changed"; print(json.dumps({"width":a.width,"height":a.height,"sha256":hashlib.sha256(aa).hexdigest(),"exact":True}))',original,dest+'/'+file],{encoding:'utf8'}));}

    const bytes=fs.readFileSync(dest+'/'+file);files[channel]={file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
   }
   if(albedoOnly){const original=baselineFile(previous.normals.file),bytes=fs.readFileSync(original);assert.equal(sha(bytes),previous.normals.sha256,'Prior normal hash mismatch');assert.equal(bytes.length,previous.normals.bytes);const target=path.join(dest,previous.normals.file);if(path.resolve(original)!==path.resolve(target))fs.copyFileSync(original,target);assert.equal(sha(fs.readFileSync(target)),previous.normals.sha256);binding.normal={file:previous.normals.file,sha256:previous.normals.sha256,bytes:previous.normals.bytes,copiedExact:true};entries.push({...previous,views:files.views});}
   else entries.push({id,variant,...meta,...files,source:(id==='orchard_apple'?'island_tree_01':id==='tree_small_02_mature_leaves'?'tree_small_02':id)+'.glb',sourcePage:id==='upright_broadleaf_01'?'https://quaternius.com/packs/stylizednaturemegakit.html':'https://polyhaven.com/a/'+(id==='orchard_apple'?'island_tree_01':id==='tree_small_02_mature_leaves'?'tree_small_02':id),license:'CC0-1.0',...(id==='upright_broadleaf_01'?{sourcePages:['https://quaternius.com/packs/stylizednaturemegakit.html','https://polyhaven.com/a/tree_small_02','https://polyhaven.com/a/bark_brown_02'],originalAddition:'Deterministic upright tree with Quaternius CommonTree_3 wood, whole Tree Small 02 photographed leaf surfaces and tileable Bark Brown 02. Runtime and view bake share the generated GLB.'}:{}),...(id==='tree_small_02_mature_leaves'?{originalAddition:'Mature-only factor-2 XZ leaf surface patches around retained nearest-wood anchors, authored in mature-leaf-patches.mjs; wood, Y, UV and topology preserved. Shared by runtime and view bake.'}:{}),...(id==='orchard_apple'?{originalAddition:'Branch-attached apple geometry authored in orchard-art.js and forage-art.js; shared by runtime and view bake.'}:{})});
   const entry=entries.at(-1);if(islandSurfaceStats){assert(geometryProvenance);entry.leafSurfaces={...geometryProvenance,stats:islandSurfaceStats};}if(broadleafIDs.has(id)){if(pigmentProvenance)entry.pigment={...pigmentProvenance};else delete entry.pigment;}binding.pigment=entry.pigment||null;
   receipt.entries.push(binding);console.log(prefix,JSON.stringify({framing:meta,rawGeometryFits:framingAudit.rawGeometryFits,rawGeometryOutside:framingAudit.rawGeometry.map(r=>r.outside),normalPreserved:!!binding.normal,alphaExact:binding.alpha?.exact,renderer:bakeDiagnostics.renderer}));
  }
  const merged=[...prior.trees.filter(t=>!entries.some(e=>e.id===t.id&&e.variant===t.variant)),...entries];
  if(albedoOnly)fs.writeFileSync(dest+'/tree-impostors.json',JSON.stringify({...prior,trees:merged},null,2)+'\n');
  else fs.writeFileSync(dest+'/tree-impostors.json',JSON.stringify({processing:'Eight orthographic albedo and object-space normal views of the existing CC0 scans. Mature pine twig exposure matches the runtime material multiplier [1.7,2.1,1.5]; bark retains source color. Broadleaf albedo includes original leaf-area-based sky occlusion, also evaluated once for detailed runtime meshes. Broadleaf summer pigmentation uses the shared summer-leaf-pigment helper after the retained [0.82,1,0.66] base tint; per-entry metadata binds helper provenance. Island leaf surfaces use the shared bounded surface-growth helper before canopy occlusion; both channels share its geometry and original source material cutout threshold. Detailed runtime may use a lower cutoff as a separate mip-coverage policy. Live directional lighting is applied by the game. normalProfile view-facing-material-v1 uses face-visible source material normals with the runtime normal map scale and canopy normal blend, in source-world coordinates; accepted normal samples are opaque before MSAA coverage.',trees:merged},null,2)+'\n');
  receipt.outputCatalogSha256=sha(fs.readFileSync(path.join(dest,'tree-impostors.json')));fs.writeFileSync(path.join(dest,'bake-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
