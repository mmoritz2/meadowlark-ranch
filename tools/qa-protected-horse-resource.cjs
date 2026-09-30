/* Finite .mkr prototype QA: byte retention, authenticated rejection, confined
 * resources, then fresh localhost-only GLTFLoader parsing/rendering. Demo bundles
 * stay in ignored output; fixture plaintext stays in /private/tmp. No activation. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const pack=require('./asset-gen/pack-protected-horse-resource.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/protected-horse-resource-qa'),temp=fs.mkdtempSync('/private/tmp/protected-horse-resource-');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const worker=fs.readFileSync(path.join(root,'assets/protected-horse-resource.js'),'utf8'),checks={},rejections=[],sources={},demos={};
let browser,server;const savedFetch=globalThis.fetch;
function record(name,value){checks[name]=!!value;}
async function rejection(name,operation){try{await operation();record(name,false);}catch(error){record(name,true);rejections.push({name,error:error.message});}}
function resourcePath(relative){return path.join(root,relative);}
function writeDemo(name,result){fs.writeFileSync(path.join(out,name+'.mkr'),result.bytes);fs.writeFileSync(path.join(out,name+'.mkr.json'),JSON.stringify({...result.descriptor,file:name+'.mkr',packingReport:result.packingReport},null,2)+'\n');demos[name]=result;}

async function main(){
 fs.mkdirSync(out,{recursive:true});
 const api=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
 if(!globalThis.crypto?.subtle)globalThis.crypto=crypto.webcrypto;
 async function readMemory(result,options={}){
  globalThis.fetch=async()=>new Response(options.bytes||result.bytes,{headers:{'Content-Length':String((options.bytes||result.bytes).length)}});
  let memory;const parsed=await api.loadProtectedHorseResource({loader:{async parseAsync(buffer,base){memory=Buffer.from(buffer);record('loaderUsesNoExternalBaseURL',base==='');return {memoryOnly:true};}},url:'https://memory.test/demo.mkr',keyBase64:options.keyBase64||result.descriptor.keyBase64,expectedSha256:options.expectedSha256,maxBytes:options.maxBytes});
  return {bytes:memory,parsed};
 }
 const skeletonPath=resourcePath('assets/models/horse-imports/horse-skeleton/game/skeleton-animated.glb'),skeletonBytes=fs.readFileSync(skeletonPath);
 sources.skeleton={file:path.relative(root,skeletonPath),sha256:hash(skeletonBytes)};
 const skeleton=pack.packProtectedHorseResource({inputPath:skeletonPath});writeDemo('skeleton',skeleton);
 const roundtrip=await readMemory(skeleton,{expectedSha256:skeleton.descriptor.sha256});record('embeddedGLBExactRoundtrip',roundtrip.bytes.equals(skeletonBytes));
 record('ciphertextDoesNotExposeGLBHeader',!skeleton.bytes.subarray(64,68).equals(Buffer.from('glTF')));
 for(const [name,index]of [['ciphertextCorruptionRejected',skeleton.bytes.length-1],['tagCorruptionRejected',48],['nonceCorruptionRejected',24]]){const bytes=Buffer.from(skeleton.bytes);bytes[index]^=1;await rejection(name,()=>readMemory(skeleton,{bytes}));}
 const wrongVersion=Buffer.from(skeleton.bytes);wrongVersion.writeUInt16LE(2,8);await rejection('wrongVersionRejected',()=>readMemory(skeleton,{bytes:wrongVersion}));
 await rejection('wrongKeyRejected',()=>readMemory(skeleton,{keyBase64:crypto.randomBytes(32).toString('base64')}));
 await rejection('truncatedEnvelopeRejected',()=>readMemory(skeleton,{bytes:skeleton.bytes.subarray(0,-1)}));
 await rejection('expectedCiphertextHashMismatchRejected',()=>readMemory(skeleton,{expectedSha256:'0'.repeat(64)}));
 await rejection('loaderResourceLimitRejected',()=>readMemory(skeleton,{maxBytes:1024}));
 const second=pack.packProtectedHorseResource({inputPath:skeletonPath,keyBase64:skeleton.descriptor.keyBase64});record('freshNonceChangesCiphertext',!second.bytes.equals(skeleton.bytes)&&!second.bytes.subarray(24,36).equals(skeleton.bytes.subarray(24,36)));

 // Stage the actual permitted BlueMesh derivative's existing maps locally.
 // Only JSON URI locations change; every source bufferView/map byte is checked.
 const bluePath=resourcePath('assets/models/horse-imports/bluemesh-draft/game/breeds/shire/shire-animated.glb'),blueBytes=fs.readFileSync(bluePath),blueSource=pack.parseGLB(blueBytes),blueDoc=structuredClone(blueSource.doc),maps=[];
 sources.bluemesh={file:path.relative(root,bluePath),sha256:hash(blueBytes)};
 for(const [i,image]of (blueDoc.images||[]).entries())if(image.uri&&!image.uri.startsWith('data:')){
  const file=path.resolve(path.dirname(bluePath),decodeURIComponent(image.uri));if(!file.startsWith(root+path.sep))throw Error('QA source map escapes project');
  const data=fs.readFileSync(file),name='map-'+i+path.extname(file);fs.writeFileSync(path.join(temp,name),data);image.uri=name;maps.push({index:i,sha256:hash(data),bytes:data.length});
 }
 record('actualBlueMeshExternalMapsExercised',maps.length>0);
 const staged=path.join(temp,'bluemesh.glb');fs.writeFileSync(staged,pack.makeGLB(blueDoc,blueSource.bin));
 const blueProfile=JSON.parse(fs.readFileSync(path.join(path.dirname(bluePath),'profile.json'),'utf8'));
 const neutralBytes=fs.readFileSync(path.resolve(path.dirname(bluePath),blueProfile.neutralCoatFile));fs.writeFileSync(path.join(temp,'neutral.png'),neutralBytes);
 const blue=pack.packProtectedHorseResource({inputPath:staged,neutralCoatPath:'neutral.png'});writeDemo('bluemesh',blue);
 const embedded=await readMemory(blue,{expectedSha256:blue.descriptor.sha256}),reparsed=pack.parseGLB(embedded.bytes);
 record('allOriginalGeometryAnimationBufferViewsByteIdentical',(blueSource.doc.bufferViews||[]).every((view,i)=>{const next=reparsed.doc.bufferViews[i];return next.byteLength===view.byteLength&&reparsed.bin.subarray(next.byteOffset||0,(next.byteOffset||0)+next.byteLength).equals(blueSource.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));}));
 record('allOriginalExternalImageBytesIdentical',maps.every(image=>{const view=reparsed.doc.bufferViews[reparsed.doc.images[image.index].bufferView];return view.byteLength===image.bytes&&hash(reparsed.bin.subarray(view.byteOffset,view.byteOffset+view.byteLength))===image.sha256;}));
 record('embeddedModelHasNoExternalResourceURIs',reparsed.doc.buffers.every(b=>!b.uri)&&reparsed.doc.images.every(i=>!i.uri));
 const neutralImage=reparsed.doc.images[reparsed.doc.textures[blue.descriptor.neutralCoatTexture].source],neutralView=reparsed.doc.bufferViews[neutralImage.bufferView];
 record('actualNeutralCoatEmbeddedByteIdentical',reparsed.bin.subarray(neutralView.byteOffset,neutralView.byteOffset+neutralView.byteLength).equals(neutralBytes)&&blue.descriptor.neutralCoatSha256===hash(neutralBytes));
 const unsafe=path.join(temp,'unsafe.gltf');
 for(const [name,uri]of [['parentTraversalRejected','../outside.bin'],['remoteURIRejected','https://example.invalid/model.bin'],['encodedTraversalRejected','%2e%2e/outside.bin'],['absoluteURIRejected','/private/tmp/outside.bin']]){fs.writeFileSync(unsafe,JSON.stringify({asset:{version:'2.0'},buffers:[{uri,byteLength:4}]}));await rejection(name,()=>pack.embedLocalModel(unsafe));}
 fs.writeFileSync(path.join(temp,'target.bin'),Buffer.alloc(4));fs.symlinkSync('target.bin',path.join(temp,'link.bin'));fs.writeFileSync(unsafe,JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'link.bin',byteLength:4}]}));await rejection('symlinkResourceRejected',()=>pack.embedLocalModel(unsafe));
 await rejection('packerResourceLimitRejected',()=>pack.embedLocalModel(skeletonPath,{maxBytes:1024}));
 await rejection('neutralCoatTraversalRejected',()=>pack.embedLocalModel(staged,{neutralCoatPath:'../outside.png'}));
 await rejection('neutralCoatWrongImageSignatureRejected',()=>pack.embedLocalModel(staged,{neutralCoatPath:'target.bin'}));
 globalThis.fetch=savedFetch;

 const requests=[],blocked=[],errors=[];
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#242832}canvas{display:block}</style><script type="importmap">${JSON.stringify({imports:{three:'/assets/vendor/three/build/three.module.js','three/addons/':'/assets/vendor/three/examples/jsm/'}})}</script><script type="module">
 import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {clone} from 'three/addons/utils/SkeletonUtils.js';import {loadProtectedHorseResource} from '/assets/protected-horse-resource.js';import {createBreedLibrary} from '/assets/breed-models.js';
 const descriptors=${JSON.stringify(Object.fromEntries(Object.entries(demos).map(([name,d])=>[name,d.descriptor])))},renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
 window.demoLoad=async name=>{const gltf=await loadProtectedHorseResource({loader:new GLTFLoader(),url:'/demo/'+name+'.mkr',keyBase64:descriptors[name].keyBase64,expectedSha256:descriptors[name].sha256}),scene=new THREE.Scene();scene.background=new THREE.Color(0x242832);scene.add(gltf.scene,new THREE.HemisphereLight(0xeaf3ff,0x60533c,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);scene.add(light);gltf.scene.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),distance=Math.max(size.x,size.y,size.z)*2.1,camera=new THREE.PerspectiveCamera(35,1200/900,.01,distance*20);camera.position.copy(center).add(new THREE.Vector3(-.9,.33,1).normalize().multiplyScalar(distance));camera.lookAt(center);renderer.render(scene,camera);
 const meshes=[],textures=new Set();let finite=true;gltf.scene.traverse(mesh=>{if(mesh.isMesh){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)finite=finite&&Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i));meshes.push({name:mesh.name,vertices:p.count,joints:mesh.skeleton?.bones.length||0});for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 const result={name,meshes,finite,clipNames:gltf.animations.map(a=>a.name),textureCount:textures.size,decodedTextures:[...textures].map(t=>({width:t.image?.width,height:t.image?.height})),bounds:{min:box.min.toArray(),max:box.max.toArray()},webglError:renderer.getContext().getError()};return result;};
 window.libraryLoad=async()=>{const library=createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('/demo/manifest.json',location.href)}),asset=await library.load('bay'),first=library.instantiate(asset),second=library.instantiate(asset);return {nativeLibrary:true,neutralDecoded:asset.neutralCoatMap?.image?.width>0&&asset.neutralCoatMap?.image?.height>0,neutralSRGB:asset.neutralCoatMap?.colorSpace===THREE.SRGBColorSpace,neutralShared:first.neutralCoatMap===second.neutralCoatMap,privateBones:first.bones[0]!==second.bones[0],privateMaterials:first.baseMat!==second.baseMat,sharedGeometry:first.skin.geometry===second.skin.geometry,externalNeutralURL:!!asset.profile.neutralCoatURL,clips:asset.animations.length};};window.ready=true;
 </script>`;
 const protectedProfile={...blueProfile,file:'bluemesh.mkr',sha256:blue.descriptor.sha256,protectedResource:blue.descriptor,available:true};delete protectedProfile.neutralCoatFile;
 const libraryManifest={requireExplicitMapping:true,breeds:{bay:protectedProfile},aliases:{}};
 server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');requests.push(url.pathname);if(url.pathname==='/demo.html'){res.setHeader('Content-Type','text/html');return res.end(html);}if(url.pathname==='/demo/manifest.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(libraryManifest));}const demo=/^\/demo\/(skeleton|bluemesh)\.mkr$/.exec(url.pathname);if(demo){res.setHeader('Content-Type','application/octet-stream');return res.end(demos[demo[1]].bytes);}if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}const allowed=['/assets/protected-horse-resource.js','/assets/breed-models.js','/assets/horse-hair-volume.js','/assets/feather-wing-material.js'].includes(url.pathname)||url.pathname.startsWith('/assets/vendor/three/');if(!allowed||url.pathname.includes('..')){res.writeHead(404);return res.end('Not served');}const file=path.join(root,decodeURIComponent(url.pathname));if(!file.startsWith(path.join(root,'assets')+path.sep)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 const QA=require('./qa-platform.cjs');browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});const page=await browser.newPage({viewport:{width:1200,height:900}});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(['blob:','data:'].includes(url.protocol)||url.origin===base)return route.continue();blocked.push(url.href);return route.abort();});
 await page.goto(base+'/demo.html',{waitUntil:'load'});await page.waitForFunction(()=>window.ready,null,{timeout:30000});const browserSamples=[];
 for(const name of ['skeleton','bluemesh']){const sample=await page.evaluate(name=>window.demoLoad(name),name);browserSamples.push(sample);await page.screenshot({path:path.join(out,name+'.png')});record(name+'ActualBrowserParsedAndRendered',sample.finite&&sample.meshes.length>0&&sample.clipNames.length>=9&&sample.webglError===0&&sample.meshes.some(m=>m.joints===40));}
 const blueBrowser=browserSamples.find(s=>s.name==='bluemesh');record('browserEmbeddedMapsDecoded',blueBrowser.textureCount>0&&blueBrowser.decodedTextures.every(t=>t.width>0&&t.height>0));
 const librarySample=await page.evaluate(()=>window.libraryLoad());record('productionLibraryProtectedLoadAndPrivateClones',librarySample.nativeLibrary&&librarySample.privateBones&&librarySample.privateMaterials&&librarySample.sharedGeometry&&librarySample.clips>=9);
 record('productionLibraryEmbeddedNeutralDecodedAndShared',librarySample.neutralDecoded&&librarySample.neutralSRGB&&librarySample.neutralShared&&!librarySample.externalNeutralURL);
 record('noPlaintextGLBOrImageHTTPRequests',!requests.some(p=>/\.(glb|gltf|png|jpg|jpeg|webp)$/i.test(p)));record('noExternalBrowserRequests',blocked.length===0);record('noBrowserErrors',errors.length===0);
 record('originalSourcesUnmodified',Object.values(sources).every(s=>hash(fs.readFileSync(path.join(root,s.file)))===s.sha256));
 record('codecFilesUnmodifiedDuringQA',fs.readFileSync(path.join(root,'assets/protected-horse-resource.js'),'utf8')===worker);
 const report={allChecksPass:Object.values(checks).every(Boolean),checks,rejections,sources,sourceMaps:maps,browserSamples,librarySample,requests,blocked,errors,codecSha256:hash(Buffer.from(worker)),packerSha256:hash(fs.readFileSync(path.join(root,'tools/asset-gen/pack-protected-horse-resource.cjs'))),breedLibrarySha256:hash(fs.readFileSync(path.join(root,'assets/breed-models.js'))),demos:Object.fromEntries(Object.entries(demos).map(([name,d])=>[name,{file:name+'.mkr',bytes:d.bytes.length,sha256:d.descriptor.sha256,packingReport:d.packingReport}])),fixtureFolder:temp,defaultCatalogActivated:false,scope:'Permitted CC BY4 derived skeleton and BlueMesh examples only; production-library format and neutral-coat delivery verification, not actual CGTrader horse QA or license certification.',limitations:['Runtime keys and decrypted memory are discoverable; not strong client DRM.','External neutralCoatFile URLs remain unsupported; explicit local neutral coats can now be embedded.','Normal GLTFLoader may create transient revoked embedded-image blob URLs.','No CGTrader production bundles were created in this test.']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks,allChecksPass:report.allChecksPass,report:path.join(out,'report.json')}));if(!report.allChecksPass)process.exitCode=1;
}
main().catch(error=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,rejections,fixtureFolder:temp},null,2)+'\n');console.error(error);process.exitCode=1;}).finally(async()=>{globalThis.fetch=savedFetch;if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
