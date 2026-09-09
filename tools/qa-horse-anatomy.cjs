// Same-camera anatomy review in the actual gallery renderer. Optional fixture
// directory holds a manifest and GLBs for reviewing a saved or candidate build.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/horse-anatomy-qa');
const fixture=process.argv[3];
const keys=(process.argv[4]||'bay,chestnut,sunset,thoro,black,marwari,vanner,clyde').split(',');
const selfShadow=process.argv[5]!=='off';
const normalMap=process.argv[6]!=='off';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],states=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(fixture){
  await page.route('**/models/breeds/*',r=>{const name=path.basename(new URL(r.request().url()).pathname);let file=path.join(fixture,name);if(name==='manifest.json'&&!fs.existsSync(file))file=path.join(fixture,'preview-manifest.json');return fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.json')?'application/json':name.endsWith('.glb')?'model/gltf-binary':'image/png'}):r.continue();});
 }
 await page.route('**/breeds.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('breeds.html','utf8')
  .replace("await select('bay')","await select('"+keys[0]+"')")
  .replace('natural.normalScale.set(.18,.18);','natural.normalScale.set(.18,.18);'+(normalMap?'':'natural.normalMap=null;'))
  .replace('groom=createBreedGroom','window.__anatomyInstance=inst;inst.scene.traverse(o=>{if(o.isMesh)o.receiveShadow='+selfShadow+';});groom=createBreedGroom')
  .replace('window.advanceTime=ms=>{',`window.__anatomyView=(angle,close,hair)=>{
   const inst=window.__anatomyInstance,scale=inst.profile.withersM/1.45;
   controls.resetMotion();controls.autoRotate=false;
   for(const m of groom.meshes)m.visible=hair;
   const point=name=>lib.mountPoint(inst,inst.profile.anchors[name]).multiplyScalar(scale);
   const center=close?point('poll').lerp(point('muzzle'),.52):new THREE.Vector3(0,withers*.54,0);
   const distance=close?1.6*withers/1.5:4.8*withers/1.5;
   const offset=angle==='front'?new THREE.Vector3(0,.045,1):angle==='side'?new THREE.Vector3(-1,.045,0):new THREE.Vector3(-.82,.12,.78).normalize();
   controls.minDistance=.35;controls.maxDistance=20;controls.target.copy(center);camera.position.copy(center).addScaledVector(offset,distance);controls.update();renderer.render(scene,camera);
   return {breed:selectedKey,vertices:body.geometry.attributes.position.count,groom:groom.stats,head:center.toArray(),camera:camera.position.toArray(),finite:inst.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};
  };window.advanceTime=ms=>{`)}));
 await page.goto('http://127.0.0.1:8431/breeds.html');
 await page.waitForFunction(()=>window.render_game_to_text&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000,polling:200});
 for(const key of keys){
  await page.locator(`[data-key="${key}"]`).click();
  await page.waitForFunction(k=>JSON.parse(render_game_to_text()).breed===k&&!JSON.parse(render_game_to_text()).loading,key,{timeout:90000,polling:200});
  for(const [angle,close,hair,surface] of [['side',false,false,'clay'],['side',true,false,'clay'],['front',true,false,'coat'],['quarter',true,true,'coat'],['quarter',false,true,'coat']]){
   await page.selectOption('#surface',surface);const state=await page.evaluate(args=>__anatomyView(...args),[angle,close,hair]);
   await page.waitForTimeout(120);await page.locator('#stage').screenshot({path:path.join(out,`${key}-${close?'head':'body'}-${angle}-${surface}.png`)});
   states.push({angle,close,hair,surface,...state});
  }
 }
 const checks={coverage:states.length===keys.length*5,finite:states.every(s=>s.finite),noErrors:errors.length===0};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,states},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();
 if(Object.values(checks).some(v=>!v))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
