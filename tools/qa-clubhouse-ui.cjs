/* Club hub UI smoke: one isolated browser, real form actions, local message fixtures,
 * and blocked websocket traffic so QA never publishes a test club. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUT||path.join(__dirname,'../review/clubhouse-ui'));
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1365,height:950},timezoneId:'UTC'}),errors=[],report={errors};
 page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket('**',ws=>ws.close());
 const ready=()=>window.__features?.clubHub&&window.__features?.clubActivities;
 const tab=async k=>{await page.evaluate(()=>{const p=document.getElementById('clubHubPanel');if(p.style.display!=='flex')__features.clubHub.open();});await page.locator('#clubHubPanel .ch-nav[data-tab="'+k+'"]').click();};
 const shot=async n=>page.screenshot({path:path.join(out,n+'.png')});
 try{
  fs.mkdirSync(out,{recursive:true});
  await page.goto(QA.BASE+'/ranch3d.html?qa=clubhouse-ui&emoji=0',{timeout:120000});
  await page.waitForFunction(ready,null,{timeout:120000});
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{s.rider.made=true;});G.wardrobe?.closeChar();G.clubs.leaveClub();document.getElementById('netBtn').click();});
  assert.equal(await page.locator('#clubHubPanel').isVisible(),true,'existing club button opens hub');
  assert.equal(await page.locator('#clubHubPanel .ch-nav').count(),6);
  await tab('manage');
  await page.locator('#chIdentityForm [name=name]').fill('Meadowlight Riders');
  await page.locator('#chIdentityForm [name=motto]').fill('Every trail, together.');
  await page.locator('.ch-crest-picker label[title=star]').click();
  await page.locator('.ch-color-picker label').nth(1).click();
  await page.locator('#chIdentityForm button[type=submit]').click();
  report.identity=await page.evaluate(()=>__features.clubs.identity());
  assert.equal(report.identity.name,'Meadowlight Riders');assert.equal(report.identity.crest,'star');assert.equal(report.identity.color,'#436b99');
  assert.ok(report.identity.code);assert.equal(report.identity.pub,false);
  report.fixture=await page.evaluate(()=>{
   const G=__features,C=G.clubs,code=C.identity().code,wk=C.CW();
   G.save.sync(s=>G.run('starPoints',s,165));
   G.run('message','srf1/'+code+'/members/qa-ava',{n:'Ava',id:'qa-ava',sp:195,wk,last:Date.now(),h:3});
   G.run('message','srf1/'+code+'/members/qa-luna',{n:'Luna',id:'qa-luna',sp:110,wk,last:Date.now()-300000,h:2});
   G.run('message','srf1/dir/qa-real-club',{nm:'Riverbend Riders',pub:true,mem:3,sp:420,wk});
   G.run('message','srf1/clubs/qa-real-club',{nm:'Riverbend Riders',mem:3,sp:420,wk});
   for(let i=0;i<6;i++)G.run('courseFinish',{ev:{id:'qa'},c:{qa:i},RB:{rib:4}});
   G.clubHub.refresh();return {total:C.clubTotal(),members:C.memberRows(),goals:G.clubActivities.snapshot().goals};
  });
  assert.equal(report.fixture.total,470);assert.equal(report.fixture.members.length,3);
  await shot('clubhouse-desktop');
  await tab('manage');
  await page.locator('#chNotice').fill('Saturday trail ride: meet at the Home Pasture gate.');
  await page.locator('#chNoticeForm button').click();
  assert.equal(await page.evaluate(()=>__features.save.fresh().clubNotice.t),'Saturday trail ride: meet at the Home Pasture gate.');
  await shot('manage-desktop');
  await tab('members');
  await page.locator('[data-chub=role][data-member=Ava]').click();
  assert.equal(await page.evaluate(()=>__features.clubs.memberRows().find(r=>r.name==='Ava').role),'officer');
  await shot('members-desktop');
  await tab('activities');
  const before=await page.evaluate(()=>({c:__features.save.fresh().coins,g:__features.save.fresh().gems}));
  await page.locator('[data-chub=claim-goal][data-goal=events]').click();
  report.claim=await page.evaluate(()=>({c:__features.save.fresh().coins,g:__features.save.fresh().gems,goal:__features.clubActivities.snapshot().goals.find(g=>g.id==='events')}));
  assert.equal(report.claim.c-before.c,500);assert.equal(report.claim.g-before.g,2);assert.ok(report.claim.goal.claimed);
  await page.locator('.ch-schedule summary').click();
  await page.locator('#chRideForm [name=title]').fill('Sunset at Loon Lake');
  const date=new Date(Date.now()+3600000).toISOString().slice(0,16);
  await page.locator('#chRideForm [name=startsAt]').fill(date);
  await page.locator('#chRideForm [name=meetingPoint]').fill('Home Pasture gate');
  await page.locator('#chRideForm [name=notes]').fill('An easy trail for everyone.');
  await page.locator('#chRideForm button').click();
  report.ride=await page.evaluate(()=>__features.clubActivities.snapshot().rides[0]);
  assert.equal(report.ride.title,'Sunset at Loon Lake');
  if(!report.ride.going)await page.locator('[data-chub=rsvp]').click();
  assert.equal(await page.evaluate(()=>__features.clubActivities.snapshot().rides[0].going),true);
  await shot('activities-desktop');
  await tab('rewards');
  assert.equal(await page.locator('.ch-tier-picker button').count(),5);
  await page.locator('[data-tier="5"]').click();
  assert.equal(await page.locator('.ch-loot').first().locator('div').count(),5);
  await shot('rewards-desktop');
  await tab('rankings');
  assert.match(await page.locator('.ch-content').innerText(),/NPC valley rivals/i);
  assert.match(await page.locator('.ch-content').innerText(),/Riverbend Riders/);
  await shot('rankings-desktop');
  // Every narrow layout must stay inside its scroll container; only the nav rail scrolls sideways.
  await page.setViewportSize({width:390,height:844});
  report.phone={};
  for(const k of ['home','members','activities','rewards','rankings','manage']){
   await tab(k);report.phone[k]=await page.evaluate(()=>{const p=document.querySelector('#clubHubPanel .ch-main');return {width:p.clientWidth,scroll:p.scrollWidth};});
   assert.ok(report.phone[k].scroll<=report.phone[k].width+1,k+' phone has no horizontal overflow');
   if(['home','activities','manage'].includes(k))await shot(k+'-phone');
  }
  await page.setViewportSize({width:1365,height:950});
  await page.locator('#clubHubPanel .ch-top [data-chub=social]').click();
  assert.equal(await page.locator('#onlinePanel').isVisible(),true,'Ride & chat preserves legacy social screen');
  assert.equal(await page.locator('#clubHubPanel').isVisible(),false);
  await page.evaluate(()=>{__features.hidePanels();document.activeElement?.blur();});
  await page.keyboard.press('KeyK');
  assert.equal(await page.locator('#clubHubPanel').isVisible(),true,'K opens hub');
  await page.reload({timeout:120000});await page.waitForFunction(ready,null,{timeout:120000});
  report.reload=await page.evaluate(()=>{const G=__features;G.wardrobe?.closeChar();G.clubHub.open();return {identity:G.clubs.identity(),notice:G.save.fresh().clubNotice,goals:G.clubActivities.snapshot().goals,rides:G.clubActivities.snapshot().rides};});
  assert.equal(report.reload.identity.name,report.identity.name);assert.equal(report.reload.identity.color,report.identity.color);
  assert.equal(report.reload.notice.t,'Saturday trail ride: meet at the Home Pasture gate.');assert.ok(report.reload.goals.find(g=>g.id==='events').claimed);assert.equal(report.reload.rides[0].title,'Sunset at Loon Lake');
  assert.deepEqual(errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,phone:report.phone,code:report.identity.code}));
 }catch(e){report.pass=false;report.error=e.stack;throw e;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
