const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,ANGLE}=require('../../tools/qa-platform.cjs');
const base=path.resolve(__dirname,'../www'),output=path.resolve(__dirname,'../verification');fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(base,'.'+(rel==='/'?'/index.html':rel));if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:[ANGLE,'--ignore-gpu-blocklist']});
 let page;const errors=[],failed=[],external=[];
 try{
  page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  await page.route('**/*',route=>{const u=route.request().url();if(/^https?:/.test(u)&&!u.startsWith(url+'/')){external.push(u);return route.abort();}return route.continue();});
  await page.addInitScript(()=>{window.__socketAttempts=[];window.WebSocket=class{constructor(url){window.__socketAttempts.push(String(url));throw Error('Native edition attempted a network socket');}};});
  await page.goto(url+'/index.html?qa=mobile-native',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__features&&window.render_game_to_text,null,{timeout:120000});
  await page.waitForFunction(()=>JSON.parse(render_game_to_text()).graphics?.horseReady,null,{timeout:120000});
  const start=await page.evaluate(()=>JSON.parse(render_game_to_text()));
  assert.equal(start.graphics.quality,'medium');
  await page.evaluate(()=>{__features.gfx.apply('low');__features.save.sync(s=>{s.quality='low';s.qualityLocked=true;});});
  await page.evaluate(()=>{const G=window.__features;G.ui.openCare();G.ui.openEvents();G.ui.openStable();G.ui.open('settingsPanel');G.hidePanels();});
  const first=await page.evaluate(()=>{const p=MeadowlarkNative;return {mode:p.mode,native:p.native,social:__features.net.SOCIAL,save:JSON.parse(p.storage.getItem('starRanchFable_v1')),sockets:window.__socketAttempts,featureErrors:__features.errors};});
  assert.equal(first.social,false);assert.equal(first.featureErrors.length,0);assert.ok(first.save.horses.length);
  // Existing online player profiles must not reconnect in the native edition.
  await page.evaluate(()=>{const p=MeadowlarkNative,s=JSON.parse(p.storage.getItem('starRanchFable_v1'));s.playerName='Native Offline Test';s.coins=731;p.storage.setItem('starRanchFable_v1',JSON.stringify(s));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__features&&JSON.parse(render_game_to_text()).graphics?.horseReady,null,{timeout:120000});
  await page.waitForTimeout(3500);
  const after=await page.evaluate(()=>({social:__features.net.SOCIAL,save:JSON.parse(MeadowlarkNative.storage.getItem('starRanchFable_v1')),sockets:window.__socketAttempts,featureErrors:__features.errors,quality:__features.gfx.get()}));
  assert.equal(after.social,false);assert.equal(after.save.coins,731);assert.equal(after.sockets.length,0);assert.equal(after.featureErrors.length,0);
  assert.equal(after.quality,'low');
  await page.keyboard.down('w');
  await page.evaluate(()=>{__features.riding.brake(true);__features.horse.player.breathHold=true;});
  await page.waitForTimeout(150);
  const paused=await page.evaluate(()=>{dispatchEvent(new Event('pagehide'));return {frame:__features.renderer.info.render.frame,paused:MeadowlarkNative.paused};});
  assert.equal(paused.paused,true);
  await page.waitForTimeout(1200);
  const stopped=await page.evaluate(()=>({frame:__features.renderer.info.render.frame,breath:__features.horse.player.breathHold}));
  assert.equal(stopped.frame,paused.frame);assert.equal(stopped.breath,false);
  await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(250);
  // Input release preserves normal movement inertia; require it to settle, not teleport to a halt.
  await page.waitForFunction(()=>!MeadowlarkNative.paused&&Math.abs(__features.horse.player.speed)<0.1,null,{timeout:5000});
  const resumed=await page.evaluate(()=>({frame:__features.renderer.info.render.frame,paused:MeadowlarkNative.paused,riding:__features.riding.state(),speed:__features.horse.player.speed}));
  assert.equal(resumed.paused,false);assert.ok(resumed.frame>stopped.frame);assert.equal(resumed.riding.braking,false);assert.equal(resumed.riding.forward,false);assert.equal(resumed.riding.back,false);assert.ok(Math.abs(resumed.speed)<0.1);
  await page.keyboard.up('w');
  await page.screenshot({path:path.join(output,'staged-mobile.png')});
  const report={kind:'staged browser verification; not iOS device evidence',viewport:{width:844,height:390},horseReady:start.graphics.horseReady,saveReload:true,offlineExistingProfile:after.sockets.length===0,newInstallPreset:start.graphics.quality,savedPreset:after.quality,lifecycle:{pausedFrameStable:true,resumed:true,heldControlsReleased:true},errors,failed,external,sourceRevision:JSON.parse(fs.readFileSync(path.join(base,'bundle-manifest.json'))).sourceRevision};
  fs.writeFileSync(path.join(output,'smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));assert.equal(errors.length,0);assert.equal(failed.length,0);assert.equal(external.length,0);
 }catch(error){
  let state;try{state=await page?.evaluate(()=>{const s=window.render_game_to_text?JSON.parse(render_game_to_text()):null;return {url:location.href,game:s?{player:s.player,graphics:s.graphics,net:s.net}:null,load:document.getElementById('load')?.textContent,blocked:window.__gameModuleBlocked,featureErrors:window.__features?.errors};});}catch{}
  const report={kind:'staged browser smoke failure',message:error.message,errors,failed,external,state};fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify(report));throw error;
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
