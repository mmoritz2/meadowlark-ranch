/* Isolated browser acceptance. All WebSockets are blocked; peer packets remain
 * inside this page and the fresh browser owns a disposable save. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUT||'/private/tmp/meadowlark-club-together/browser');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:940}}),report={errors:[],checks:[]};
 const check=(v,label)=>{assert.ok(v,label);report.checks.push(label);},shot=async name=>page.screenshot({path:path.join(out,name+'.png'),style:'#toasts{display:none!important}'});
 const show=tab=>page.evaluate(tab=>__features.clubHub.open(tab),tab);
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  fs.mkdirSync(out,{recursive:true});await page.goto(QA.BASE+'/ranch3d.html?qa=club-together&emoji=0',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.clubFriends&&__features.clubRides&&__features.clubHub,null,{timeout:120000});
  await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:120000});
  report.fixture=await page.evaluate(()=>{
   const G=__features;advanceTime(0);G.save.sync(s=>{s.rider.made=true;s.nick='Rowan';});G.wardrobe.closeChar();G.clubs.leaveClub();
   window.__qaPackets=[];window.__qaConfirm=null;
   G.net.publish=(topic,payload,opts)=>{__qaPackets.push({topic,payload:{id:G.net.net.id,n:G.net.myName(),...payload},opts});return true;};
   G.net.netConnect=()=>{};G.net.net.client={connected:true,publish(t,p){__qaPackets.push({topic:t,payload:JSON.parse(p)});},subscribe(){},end(){}};
   G.clubs.createClub({name:'Meadowlight Riders',motto:'Every trail, together.',crest:'star',color:'#436b99',pub:true});
   const code=G.clubs.identity().code;G.net.net.club=code;G.run('connect');G.ui.confirm=o=>{__qaConfirm=o;};
   window.__qaPeer=(ready,rev=1)=>{const c=G.clubRides.snapshot().current;G.net.onMessage('srf1/'+code+'/clubride2/rider/'+c.id+'/qa-ava',JSON.stringify({id:'qa-ava',n:'Ava',ready,progress:0,finished:false,left:false,at:Date.now(),rev}));};
   window.__qaPresence=()=>{for(const [id,name,x,z]of [['qa-ava','Ava',8,7],['qa-luna','Luna',14,7]]){
    G.run('message','srf1/'+code+'/members/'+id,{id,n:name,sp:20,allTime:20,wk:G.clubs.CW(),last:Date.now()});
    G.net.onMessage('srf1/'+code+'/pos',JSON.stringify({id,n:name,x,z,b:'bay',h:0,sp:0}));
   }};
   __qaPresence();G.clubHub.open('activities');return {code};
  });
  await page.waitForFunction(()=>Object.keys(__features.net.remotes).length===2,null,{timeout:120000});
  check(await page.locator('.cs-route-card').count()===6,'Six real expedition routes render');
  check(await page.locator('[data-chub=social-host][data-route=basin]').isEnabled(),'Unlocked route can be hosted');
  await page.locator('[data-chub=social-host][data-route=basin]').click();
  await page.evaluate(()=>__qaPeer(false));await page.waitForFunction(()=>document.querySelector('.cs-current-roster')?.textContent.includes('Ava'));
  check(await page.locator('[data-chub=social-start]').isDisabled(),'Host waits for unready peer');
  check(await page.locator('[data-chub=social-leave]').count()===0,'Host only gets explicit end-for-everyone action');
  await shot('ride-waiting-desktop');
  await page.evaluate(()=>__qaPeer(true,2));await page.waitForFunction(()=>!document.querySelector('[data-chub=social-start]').disabled);
  await page.locator('[data-chub=social-start]').click();
  check(await page.locator('#clubHubPanel').isHidden(),'Starting a ride returns to the world');
  check(await page.evaluate(()=>__features.trail.ride?.clubRideId===__features.clubRides.snapshot().current.id),'Club ride starts the actual game trail');
  await page.evaluate(()=>{const G=__features,r=G.trail.ride;G.horse.player.pos.set(r.pts[0][1],0,r.pts[0][2]);advanceTime(17);G.clubHub.open('activities');});
  check(await page.evaluate(()=>__features.clubRides.snapshot().current.progress===1),'Reaching a real waypoint updates party progress');
  check((await page.locator('.cs-current-copy').innerText()).includes('1 / 4 stops complete'),'Progress appears in the ride screen');await shot('ride-progress-desktop');
  await page.locator('[data-chub=social-cancel]').click();check(await page.evaluate(()=>!!__qaConfirm&&!!__features.clubRides.snapshot().current),'Ending requires the in-game confirmation');
  await page.evaluate(()=>{__qaConfirm.onYes();__qaConfirm=null;});check(await page.evaluate(()=>!__features.trail.ride&&!__features.clubRides.snapshot().current),'End stops only this club trail');

  await page.evaluate(()=>{__qaPresence();__features.clubHub.open('friends');});
  await page.locator('[data-chub=social-request][data-name=Ava]').click();
  check(await page.evaluate(()=>!!__features.save.fresh().friendReq.out.Ava&&!__features.save.fresh().friends.Ava),'Request stays pending until peer accepts');
  await page.evaluate(()=>{const G=__features;G.net.onMessage('srf1/'+G.net.net.club+'/chat',JSON.stringify({id:'qa-ava',n:'Ava',t:'',fr:{k:'acc',to:G.net.myName()}}));});
  await page.waitForFunction(()=>!!document.querySelector('[data-chub=social-friend-join][data-name=Ava]'));
  check(await page.evaluate(()=>!!__features.save.fresh().friends.Ava),'Peer acceptance creates the friend');
  await page.evaluate(()=>{__qaPresence();const G=__features;G.net.onMessage('srf1/'+G.net.net.club+'/chat',JSON.stringify({id:'qa-luna',n:'Luna',t:'',fr:{k:'req',to:G.net.myName()}}));});
  await page.waitForFunction(()=>!!document.querySelector('[data-chub=social-accept][data-name=Luna]'));
  await page.locator('[data-chub=social-accept][data-name=Luna]').click();check(await page.evaluate(()=>!!__features.save.fresh().friends.Luna),'Incoming request can be accepted in Friends');
  await page.evaluate(()=>{__qaPresence();__features.clubHub.refresh();});await shot('friends-desktop');
  await page.locator('#chFriendsSearch input').fill('Ava');await page.locator('#chFriendsSearch button').click();
  check(await page.locator('.cs-rider').count()===1,'Friends search filters riders');
  check(await page.evaluate(()=>document.getElementById('clubHubPanel').contains(document.activeElement)),'Focus remains inside club dialog after search');
  await page.locator('#chFriendsSearch input').fill('');await page.locator('#chFriendsSearch button').click();
  await page.evaluate(()=>{__qaPresence();__features.clubHub.refresh();});
  const before=await page.evaluate(()=>({x:__features.horse.player.pos.x,z:__features.horse.player.pos.z}));
  await page.locator('[data-chub=social-friend-join][data-name=Ava]').click();
  check(await page.locator('#clubHubPanel').isHidden(),'Ride to friend closes menu');
  report.join=await page.evaluate(()=>({x:__features.horse.player.pos.x,z:__features.horse.player.pos.z}));
  check(Math.hypot(report.join.x-8,report.join.z-7)<=8.01&&Math.hypot(report.join.x-before.x,report.join.z-before.z)>.1,'Ride to friend finds a nearby clear landing');
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{delete s.friends.Ava;delete s.friendReq.out.Ava;});__qaPresence();G.net.openProfile('Ava');});
  await page.locator('[data-pf=friend]').click();check(await page.evaluate(()=>!!__features.save.fresh().friendReq.out.Ava&&!__features.save.fresh().friends.Ava),'Legacy profile uses mutual requests too');
  check(await page.locator('[data-pf=friend]').isDisabled(),'Profile shows a pending request');
  await page.evaluate(()=>{__features.net.net.client.connected=false;__features.clubHub.open('friends');});
  check(await page.locator('[data-chub=social-friend-join][data-name=Luna]').isDisabled(),'Offline friend cannot be joined');
  check((await page.locator('.cs-rider').allTextContents()).every(t=>t.includes('Offline')),'Disconnected presence is labeled offline');
  await page.evaluate(()=>{__features.net.net.client.connected=true;__qaPresence();__features.clubHub.open('home');});await shot('home-desktop');

  report.layouts={};
  for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);
   for(const tab of ['home','activities','friends']){
    await page.evaluate(()=>__qaPresence());await show(tab);
    const metrics=await page.evaluate(()=>{const p=document.getElementById('clubHubPanel'),m=p.querySelector('.ch-main'),hero=p.querySelector('.cs-home-hero'),img=p.querySelector('.cs-home-picture img');return {width:m.clientWidth,scroll:m.scrollWidth,focus:p.contains(document.activeElement),heroWidth:hero?.clientWidth,imageWidth:img?.clientWidth};});
    report.layouts[size.width+'x'+size.height+'-'+tab]=metrics;check(metrics.scroll<=metrics.width+1,tab+' fits '+size.width+'px');check(metrics.focus,tab+' opens with dialog focus');
    if(size.width===390)await shot(tab+'-phone');
   }
  }
  await page.setViewportSize({width:390,height:844});await show('activities');await page.locator('[data-chub=social-host][data-route=basin]').click();
  await page.evaluate(()=>__qaPeer(false));await page.waitForFunction(()=>document.querySelector('.cs-current-roster')?.textContent.includes('Ava'));await shot('ride-waiting-phone');
  const overflow=await page.evaluate(()=>{const m=document.querySelector('#clubHubPanel .ch-main');return m.scrollWidth-m.clientWidth;});check(overflow<=1,'Phone lobby fits the screen');
  await page.locator('[data-chub=social-ready]').click();check(await page.evaluate(()=>document.getElementById('clubHubPanel').contains(document.activeElement)),'Ready toggle preserves dialog focus');
  await page.evaluate(()=>__features.clubHub.close());
  await shot('ride-hud-phone');
  report.hud=await page.evaluate(()=>{
   const rect=id=>{const e=document.getElementById(id);return e&&getComputedStyle(e).display!=='none'?e.getBoundingClientRect().toJSON():null;};
   return Object.fromEntries(['clubRideStatus','seRidePace','seGoal','stickZone','seJump'].map(id=>[id,rect(id)]));
  });
  assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,checks:report.checks.length,layouts:report.layouts}));
 }catch(e){report.pass=false;report.error=e.stack;await shot('failure').catch(()=>{});throw e;}
 finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
