/* Actual mounted draft-horse gait/contact checks in a disposable, offline save.
 * QA_PORT=8596 PLAYWRIGHT_PATH=/path/to/playwright node tools/qa-draft-horses.cjs
 * Does not alter published saves, connect to rider rooms, or purchase anything. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=process.env.QA_OUT||'/private/tmp/meadowlark-draft-horses';
const draftKeys=['percheron','shire','clyde','belgian','suffolk','glacier','rimewalker','tempest'];
const keys=process.env.QA_HORSES?process.env.QA_HORSES.split(',').filter(k=>draftKeys.includes(k)):draftKeys;
const barebackOnly=process.env.QA_FOCUS==='bareback';
const restOnly=process.env.QA_FOCUS==='rest';
const includeBareback=process.env.QA_DRAFT_BAREBACK!=='0';
const gaitSamples=3,gaitStepMs=300;
const feathered=new Set(['shire','clyde','tempest']);
const report={checks:[],failures:[],errors:[],horses:[],screenshots:[],selectedHorses:keys,focus:process.env.QA_FOCUS||'full',includeBareback,gaitSamples,gaitStepMs,scope:'Actual mounted native drafts in a disposable browser save, service workers and WebSockets blocked before boot. Full mode samples four keyboard gaits and representative jumps; bareback focus samples only rest/trot, and rest focus only saddled rest, on selected horses. Body motion previously exercised for 2s per gait; current 900ms contact samples focus on fitted tack and rider.'};
let browser;
function check(ok,label,detail){report.checks.push({label,ok:!!ok});if(!ok)report.failures.push({label,detail});console.log((ok?'PASS ':'FAIL ')+label);}
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=draft-horses',{timeout:120000});
 await page.waitForFunction(()=>window.__features?.clubHub&&__features.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:150000});
 await page.evaluate(()=>{const G=__features;advanceTime(0);G.wardrobe.closeChar();G.hidePanels();G.seFrame?.settle();G.audio.setMuted(true);G.riding.releaseAll();document.activeElement?.blur();G.net.publish=()=>false;G.net.netConnect=()=>{};
  window.__draftStep=ms=>{const render=G.renderer.render;G.renderer.render=function(s,c,...a){if(c!==G.camera)return render.call(this,s,c,...a);};try{advanceTime(ms);}finally{G.renderer.render=render;}};
 });
}
async function mount(page,key){
 const n=await page.evaluate(k=>__features.horse.myHorses.findIndex(h=>h.breed===k),key);
 if(n<0)throw Error('QA horse not granted: '+key);
 await page.selectOption('#horseSel',String(n),{force:true});
 await page.waitForFunction(k=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===k&&r.ready&&!r.loadingBreed&&r.attachedTo===G.horse.player.mesh;},key,{timeout:90000});
 const equip=await page.evaluate(()=>{const G=__features,p=G.horse.player;p.speed=0;p.y=0;p.vy=0;p.pos.set(-3,0,-3);p.heading=0;G.riding.releaseAll();const result=G.tackCollection.equipSet('classicwestern',G.horse.ridden().id);__draftStep(600);return result;});
 check(equip?.ok,key+' equips the original western saddle, pad and bridle',equip);
}
async function sample(page){return page.evaluate(()=>{
 const G=__features,r=G.horse.RIG(),p=G.horse.player,T=G.THREE,v=new T.Vector3();
 p.mesh.updateWorldMatrix(true,true);r.scene.updateWorldMatrix(true,true);
 let finite=r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),skinSamples=0;
 r.scene.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();const n=m.geometry.attributes.position.count;for(const i of [0,Math.floor(n/3),Math.floor(n/2),n-1]){m.getVertexPosition(i,v);finite&&=v.toArray().every(Number.isFinite);skinSamples++;}});
 const boots=Object.fromEntries(['L','R'].map(S=>{const foot=p.rider?.sk?.by?.['foot'+S],sole=foot?.userData.soleContact,tread=G.horse.TACK().saddle?.userData.stir?.[S],body=p.rider?.rig?.body;if(!sole?.vertices?.length||!tread||!body)return[S,null];body.updateMatrixWorld(true);body.skeleton.update();const mean=new T.Vector3(),q=new T.Vector3();for(const i of sole.vertices){body.getVertexPosition(i,q);mean.add(q.applyMatrix4(body.matrixWorld));}mean.multiplyScalar(1/sole.vertices.length);return[S,mean.distanceTo(tread.getWorldPosition(new T.Vector3()))];}));
 const inspect=G.horse.nativeRiderInspect?.(),reins=inspect?.reins;
 const distance=(a,b)=>Array.isArray(a)&&Array.isArray(b)?Math.hypot(...a.map((n,i)=>n-b[i])):null;
 const reinContacts=reins?.sides?Object.fromEntries(Object.entries(reins.sides).map(([key,side])=>[key,{bit:distance(side.mainStart,side.bit),hand:distance(side.mainEnd,side.hand)}])):{};
 const feather=r.groom?.feathers;let featherFinite=true,featherVertices=0;
 for(const m of feather?.meshes||[]){m.updateWorldMatrix(true,false);const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);featherFinite&&=v.toArray().every(Number.isFinite);featherVertices++;}}
 const legs=Object.fromEntries(['L','R'].map(S=>[S,Object.fromEntries(['thigh','shin','foot'].map(key=>[key,p.mesh.worldToLocal(p.rider.sk.by[key+S].getWorldPosition(new T.Vector3())).toArray()]))]));
 const legFit=Object.fromEntries(['L','R'].map(S=>{const b=p.rider.sk.by,foot=b['foot'+S],sole=foot?.userData.soleContact,tread=G.horse.TACK().saddle?.userData.stir?.[S];if(!sole||!tread)return[S,null];const hip=b['thigh'+S].getWorldPosition(new T.Vector3()),knee=b['shin'+S].getWorldPosition(new T.Vector3()),ankle=foot.getWorldPosition(new T.Vector3()),target=tread.getWorldPosition(new T.Vector3()),proxy=new T.Vector3().copy(sole.point).applyMatrix4(foot.matrixWorld),reach=hip.distanceTo(knee)+knee.distanceTo(ankle);return[S,{proxyError:proxy.distanceTo(target),skinnedError:boots[S],legLength:reach,hipToTread:hip.distanceTo(target),hipToAnkle:hip.distanceTo(ankle),ankleReachRatio:hip.distanceTo(ankle)/reach,proxy:proxy.toArray(),tread:target.toArray()}];}));
 return {key:r.requestedBreed,bones:r.bones.length,finite,skinSamples,mode:r.heroMotion.mode,y:p.y,speed:p.speed,seat:r.nativeSeatFollower.getWorldPosition(v).toArray(),rider:{skinned:!!p.rider?.sk,finite:p.rider?.g.matrixWorld.elements.every(Number.isFinite),legs},ridingMode:inspect?.mode,saddleVisible:inspect?.saddleVisible,nativeTack:!!G.horse.TACK().saddle?.userData.nativeAnchorCarrier,boots,legFit,reinComponentsIntact:!!reins?.nonReinComponentsIntact,reinContacts,reinsVisible:inspect?.reinsVisible,feathers:{count:feather?.meshes.length||0,finite:featherFinite,vertices:featherVertices,inspect:feather?.inspect()||null}};
 });}
function validPose(s){return s.bones===677&&s.finite&&s.skinSamples>0&&s.seat.every(Number.isFinite)&&s.rider.skinned&&s.rider.finite;}
function validContacts(s){return s.nativeTack&&Object.values(s.boots).every(d=>Number.isFinite(d)&&d<.01)&&s.reinComponentsIntact&&Object.keys(s.reinContacts).length===2&&Object.values(s.reinContacts).every(c=>Number.isFinite(c.bit)&&Number.isFinite(c.hand)&&c.bit<1e-6&&c.hand<1e-6);}
function validFeathers(s,key){return s.feathers.count===(feathered.has(key)?4:0)&&s.feathers.finite&&(!feathered.has(key)||s.feathers.vertices>0&&s.feathers.inspect.finiteAnchors);}
async function screenshot(page,key,gait,angle){
 const camera=await page.evaluate(angle=>{const G=__features,T=G.THREE,p=G.horse.player,origin=p.mesh.getWorldPosition(new T.Vector3()),target=origin.clone().add(new T.Vector3(0,1.7,0));const offset=angle==='side'?new T.Vector3(-6.8,2.8,.3):new T.Vector3(-5.8,3,5.8);G.camera.position.copy(origin).add(offset);G.camera.lookAt(target);G.camera.updateProjectionMatrix();G.composer.render();return {position:G.camera.position.toArray(),target:target.toArray()};},angle);
 const file=path.join(out,key+'-'+gait+'-'+angle+'.png');await page.screenshot({path:file});report.screenshots.push({key,gait,angle,file,camera});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});await context.routeWebSocket('**',ws=>ws.close());
 const page=await context.newPage();page.on('pageerror',e=>{report.errors.push(e.message);console.error('PAGE ERROR '+e.message);});page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|ERROR: 0:|WebGL.*(error|failed)/i.test(m.text()))report.errors.push(m.text());});
 try{
  await boot(page);
  await page.evaluate(keys=>{const G=__features;G.save.sync(s=>{s.rider.made=true;for(const key of keys)if(!s.horses.some(h=>h.breed===key))G.horse.grantHorse(s,key,{src:'qa'});for(const h of s.horses)h.out=false;});G.horse.reloadHorses();},keys);
  for(const key of keys){
   await mount(page,key);const horse={key,rest:await sample(page),gaits:[],jumps:[]};report.horses.push(horse);
   check(validPose(horse.rest),key+' rests on the complete finite 677-joint rig',horse.rest);
   if(!barebackOnly)check(validContacts(horse.rest),key+' resting skinned boot soles meet stirrups and reins meet hands/bit',horse.rest);
   check(validFeathers(horse.rest,key),key+' has the intended finite draft feathering',horse.rest.feathers);
   if(['belgian','shire'].includes(key))for(const angle of ['side','three-quarter'])await screenshot(page,key,'rest',angle);
   if(!barebackOnly&&!restOnly){await page.keyboard.down('ArrowUp');
   for(const [modifier,gait] of [['Control','walk'],['Alt','trot'],[null,'canter'],['Shift','gallop']]){
    if(modifier)await page.keyboard.down(modifier);
    await page.evaluate(()=>{const p=__features.horse.player;p.pos.set(-3,0,-3);p.heading=0;});
    const samples=[];for(let i=0;i<gaitSamples;i++){await page.evaluate(ms=>__draftStep(ms),gaitStepMs);samples.push(await sample(page));}
    horse.gaits.push({gait,samples});
    check(samples.at(-1).mode===gait&&samples.every(validPose),key+' '+gait+' animates all 677 joints with finite skin and rider',samples);
    check(samples.every(validContacts),key+' '+gait+' preserves skinned boot/stirrup and rein contacts',samples.map(s=>({mode:s.mode,boots:s.boots,reinContacts:s.reinContacts,nativeTack:s.nativeTack})));
    check(samples.every(s=>validFeathers(s,key)),key+' '+gait+' keeps all feather vertices and anchors finite',samples.map(s=>s.feathers));
    if(gait==='trot'&&['belgian','shire'].includes(key))for(const angle of ['side','three-quarter'])await screenshot(page,key,gait,angle);
    if(modifier)await page.keyboard.up(modifier);
   }}
   await page.keyboard.up('ArrowUp');
   if(includeBareback&&!restOnly&&['belgian','shire'].includes(key)){
    await page.evaluate(()=>{const G=__features,id=G.horse.ridden().id;G.save.sync(s=>{s.horses.find(h=>h.id===id).bareback=true;});G.horse.refreshTack();G.horse.dressSaddle();G.horse.player.speed=0;__draftStep(600);});
    horse.bareback=[await sample(page)];
    for(const angle of ['side','three-quarter'])await screenshot(page,key,'bareback-rest',angle);
    await page.keyboard.down('ArrowUp');await page.keyboard.down('Alt');
    for(let i=0;i<gaitSamples;i++){await page.evaluate(ms=>__draftStep(ms),gaitStepMs);horse.bareback.push(await sample(page));}
    for(const angle of ['side','three-quarter'])await screenshot(page,key,'bareback-trot',angle);
    await page.keyboard.up('ArrowUp');await page.keyboard.up('Alt');
    check(horse.bareback.every(s=>validPose(s)&&s.ridingMode==='bareback'&&!s.saddleVisible&&Object.values(s.rider.legs).every(leg=>Object.values(leg).flat().every(Number.isFinite)))&&horse.bareback.at(-1).mode==='trot',key+' bareback rest/trot keeps finite rider joints and hides the saddle (visual barrel clearance requires screenshot review)',horse.bareback);
    await page.evaluate(()=>{const G=__features,id=G.horse.ridden().id;G.save.sync(s=>{s.horses.find(h=>h.id===id).bareback=false;});G.horse.refreshTack();G.horse.dressSaddle();G.horse.player.speed=0;__draftStep(600);});
   }
   await page.keyboard.up('ArrowUp');await page.evaluate(()=>{const p=__features.horse.player;p.speed=0;p.pos.set(-3,0,-3);__draftStep(700);});
   if(!barebackOnly&&!restOnly&&['percheron','shire','tempest'].includes(key)){
    await page.keyboard.down('Space');await page.evaluate(()=>__draftStep(40));await page.keyboard.up('Space');
    for(let i=0;i<22;i++){await page.evaluate(()=>__draftStep(100));horse.jumps.push(await sample(page));}
    check(horse.jumps.some(s=>s.mode==='jump'&&s.y>.3)&&horse.jumps.at(-1).y===0&&horse.jumps.every(validPose),key+' jumps and lands with finite native skinning',horse.jumps);
    check(horse.jumps.every(validContacts),key+' keeps boot/stirrup and rein contacts through its jump',horse.jumps.map(s=>({y:s.y,boots:s.boots,reinContacts:s.reinContacts})));
    check(horse.jumps.every(s=>validFeathers(s,key)),key+' jump feather anchors and vertices remain finite');
   }
  }
  check(report.errors.length===0,'No JavaScript or shader errors',report.errors);
 }catch(e){report.fatal={message:e.message,stack:e.stack};throw e;}
 finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,out,errors:report.errors}));if(report.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
