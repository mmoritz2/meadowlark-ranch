/* Isolated actual source-wing material review. Does not edit the loader, Studio,
 * source files, derivative GLB, profile, joints, or shared motion adapter. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/feather-wing-material-qa');
const file=path.join(root,'assets/models/horse-imports/cgcookie-wings/game/wings.glb'),before=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const injection=String.raw`
window.__featherMaterialQA={
 freeze(){paused=true;draw();},
 async fingerprints(){
  const rows=[];for(const component of instance.components){component.scene.traverse(mesh=>{if(mesh.isMesh){const row={mesh:mesh.name,attributes:{},indices:Array.from(mesh.geometry.index.array),bones:mesh.skeleton.bones.map(b=>({name:b.name,position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray()}))};for(const name of ['position','normal','skinIndex','skinWeight'])row.attributes[name]=Array.from(mesh.geometry.attributes[name].array);rows.push(row);}});}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 },
 async apply(){paused=true;const before=await this.fingerprints();this.packages=instance.components.map(c=>applyFeatherWingMaterial({THREE,root:c.scene,profile:c.profile}));const after=await this.fingerprints();draw();return{before,after,unchanged:before===after,reports:this.packages.map(p=>p.report),inspect:breedStudioInspect()};},
 rest(){motion.set('rest');accessories.update(0);frameBody();draw();return breedStudioInspect();},
 fly(){if(!accessories.open)accessories.toggle();for(let i=0;i<150;i++)simulate(1/120);frameBody();draw();return breedStudioInspect();},
 ground(){if(accessories.open)accessories.toggle();motion.set('stand');for(let i=0;i<150;i++)simulate(1/120);frameBody();draw();return breedStudioInspect();},
 detail(){
  motion.set('rest');accessories.update(0);horse.updateMatrixWorld(true);const component=instance.components[0],mesh=component.scene.getObjectByName('RealLongFeathersL');
  if(!mesh)throw Error('Expected real source long-feather mesh');horse.traverse(o=>{if(o.isMesh)o.visible=o===mesh;});mesh.geometry.setDrawRange(24*96,96);
  const box=new THREE.Box3(),p=new THREE.Vector3();mesh.skeleton.update();for(let i=24*96;i<25*96;i++){mesh.getVertexPosition(mesh.geometry.index.getX(i),p);p.applyMatrix4(mesh.matrixWorld);box.expandByPoint(p);}
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.02,1,.10).normalize().multiplyScalar(size*2.1));camera.lookAt(center);draw();return{sourceFeather:24,originalSourceTrianglesShown:32,bounds:{min:box.min.toArray(),max:box.max.toArray()},viewOnlySubset:true};
 },
 shader(){renderer.compile(scene,camera);const meshes=[];for(const c of instance.components)c.scene.traverse(m=>{if(m.isMesh)meshes.push({name:m.name,material:m.material.name,alphaTest:m.material.alphaTest,opaque:!m.material.transparent,authoredCoordinates:!!m.geometry.attributes.sourceFeatherCoordinates,matchedAlphaDepth:!!m.customDepthMaterial,matchedAlphaDistance:!!m.customDistanceMaterial});});return{meshes,glError:renderer.getContext().getError()};}
};`;
let browser;
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM||undefined,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(['blob:','data:'].includes(u.protocol)||u.hostname==='127.0.0.1')return route.continue();blocked.push(u.href);return route.abort();});
 await page.route('**/breeds.html*',route=>{
  let html=fs.readFileSync(path.join(root,'breeds.html'),'utf8');html=html.replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport {applyFeatherWingMaterial} from './assets/feather-wing-material.js';");
  html=html.replace('createBreedLibrary({THREE,GLTFLoader,clone})',"createBreedLibrary({THREE,GLTFLoader,clone,manifestURL:new URL('./assets/models/horse-imports/prepared-manifest.json',location.href)})");
  html=html.replace('</script></body>',injection+'\n</script></body>');return route.fulfill({contentType:'text/html',body:html});
 });
 // The live loader already applies this adaptation. Disable only that call in
 // this isolated served response so the before/after comparison applies once.
 await page.route('**/assets/breed-models.js*',route=>{
  const loader=fs.readFileSync(path.join(root,'assets/breed-models.js'),'utf8'),call='const appearance=applyFeatherWingMaterial({THREE,root:wing,profile:component.profile});materials.push(...appearance.materials);';
  if(!loader.includes(call))throw Error('Expected integrated per-instance feather material call');
  return route.fulfill({contentType:'text/javascript',body:loader.replace(call,'const appearance=null;')});
 });
 await page.goto(QA.BASE+'/breeds.html?horse=pegasus',{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__featherMaterialQA&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
 await page.evaluate(()=>__featherMaterialQA.freeze());await page.screenshot({path:path.join(out,'before-neutral.png')});
 const application=await page.evaluate(()=>__featherMaterialQA.apply()),shader=await page.evaluate(()=>__featherMaterialQA.shader()),poses={};
 for(const pose of ['rest','fly','ground']){poses[pose]=await page.evaluate(p=>__featherMaterialQA[p](),pose);await page.screenshot({path:path.join(out,'authored-'+pose+'.png')});}
 const detail=await page.evaluate(()=>__featherMaterialQA.detail());await page.screenshot({path:path.join(out,'authored-real-feather-detail.png')});
 const after=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),feathers=shader.meshes.filter(m=>m.authoredCoordinates),structural=shader.meshes.filter(m=>!m.authoredCoordinates);
 const checks={gameWingGlbUnmodified:before===after,allSourcePositionIndexNormalSkinAndJointValuesUnchanged:application.unchanged,all96RealFeathersMeasured:application.reports.length===1&&application.reports[0].feathers.length===96,onlyLongFeatherCardsUseAlpha:feathers.length===2&&feathers.every(m=>m.alphaTest===.45&&m.opaque),opaqueSourceShoulderAndShaftMeshes:structural.length===2&&structural.every(m=>m.alphaTest===0&&m.opaque),matchingAlphaCutoutShadows:feathers.every(m=>m.matchedAlphaDepth&&m.matchedAlphaDistance),finiteActualSourcePoses:Object.values(poses).every(p=>p.finite&&p.vertices>0),noShaderOrPageErrors:errors.length===0&&shader.glError===0,noExternalRequests:blocked.length===0};
 const report={checks,errors,blocked,sourceWingGlbSha256:before,integratedMaterialDisabledOnlyInIsolatedBeforeAfterResponse:true,application,shader,poses,detail,appearance:'Explicit newly authored material; absent original maps remain absent. No replacement feather geometry or image-generation tool. Source shoulder volume and sparse long feather layout remain source limitations.',visualReview:'pending actual PNG inspection'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks,errors}));await browser.close();if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
