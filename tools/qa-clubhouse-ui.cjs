/* Purple club interface integration. Isolated save; every websocket is blocked and
 * the in-game broker seam is mocked, so no test clubs/messages reach other players. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUT||path.join(__dirname,'../review/clubhouse-reference'));
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:940},timezoneId:'UTC'}),errors=[],report={errors};
 await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const ready=()=>window.__features?.clubHub&&window.__features?.clubMembership&&window.__features?.clubChat;
 const show=async k=>page.evaluate(k=>{__features.wardrobe?.closeChar();__features.clubHub.open(k);},k);
 const tab=async k=>{await page.evaluate(()=>{if(document.getElementById('clubHubPanel').style.display!=='flex')__features.clubHub.open();});await page.locator('.ch-nav[data-tab="'+k+'"]').click();};
 const shot=async n=>page.screenshot({path:path.join(out,n+'.png'),style:'#toasts{display:none!important}'});
 try{
  fs.mkdirSync(out,{recursive:true});await page.goto(QA.BASE+'/ranch3d.html?qa=club-reference&emoji=0',{timeout:120000});await page.waitForFunction(ready,null,{timeout:120000});
  await page.evaluate(()=>{const G=__features;G.save.sync(s=>{s.rider.made=true;});G.wardrobe.closeChar();G.clubs.leaveClub();window.__qaPublished=[];G.net.publish=(topic,payload,opts)=>{__qaPublished.push({topic,payload,opts});return true;};G.net.netConnect=()=>{};document.getElementById('netBtn').click();});
  assert.equal(await page.locator('#clubHubPanel').isVisible(),true);assert.equal(await page.locator('.ch-nav[data-tab]').count(),6);
  assert.equal(await page.locator('.ch-welcome-card').count(),2);await shot('unjoined-desktop');
  await page.locator('[data-chub=tab][data-tab=manage]').click();
  await page.locator('#chIdentityForm [name=name]').fill('Meadowlight Riders');await page.locator('#chIdentityForm [name=motto]').fill('Every trail, together.');
  await page.locator('.ch-crest-picker label[title=star]').click();await page.locator('.ch-color-picker label').nth(1).click();await page.locator('#chIdentityForm button[type=submit]').click();
  report.identity=await page.evaluate(()=>__features.clubs.identity());assert.equal(report.identity.crest,'star');assert.equal(report.identity.color,'#436b99');assert.equal(report.identity.name,'Meadowlight Riders');
  report.fixture=await page.evaluate(()=>{
   const G=__features,C=G.clubs,code=C.identity().code,wk=C.CW(),prev=new Date(Date.parse(wk+'T00:00:00Z')-604800000).toISOString().slice(0,10);
   G.net.net.client={connected:true,publish(){},subscribe(){},end(){}};G.net.net.club='meadowlark-commons';
   G.save.sync(s=>{G.run('starPoints',s,165);const last={week:prev,total:360,rank:2,ownSP:140,n:3,rewardPolicy:2,claimed:false};s.clubWeekLast=last;s.clubRecords[code].last={...last};});
   G.run('message','srf1/'+code+'/members/qa-ava',{n:'Ava',id:'qa-ava',sp:195,allTime:555,wk,last:Date.now(),lastWeek:{week:prev,sp:120}});
   G.run('message','srf1/'+code+'/members/qa-luna',{n:'Luna',id:'qa-luna',sp:110,allTime:470,wk,last:Date.now()-300000,lastWeek:{week:prev,sp:100}});
   G.run('message','srf1/dir/qa-riverbend',{id:'qa-owner',n:'RiverOwner',fid:'qa-owner',f:'RiverOwner',nm:'Riverbend Riders',pub:true,mem:3,sp:420,allTime:1200,lastWeek:{week:prev,total:440},level:3,crest:'leaf',color:'#497657',wk});
   G.run('message','srf1/clubs/qa-riverbend',{id:'qa-owner',n:'RiverOwner',nm:'Riverbend Riders',mem:3,sp:420,allTime:1200,lastWeek:{week:prev,total:440},level:3,crest:'leaf',color:'#497657',wk});
   G.run('message','srf1/qa-riverbend/meta',{id:'qa-owner',n:'RiverOwner',f:'RiverOwner',fid:'qa-owner',nm:'Riverbend Riders',mo:'Along the river',crest:'leaf',color:'#497657',pub:true,at:Date.now(),rev:1});
   // Seed completed activity data: emitting courseFinish also opens the unrelated result screen.
   G.save.sync(s=>{const r=s.clubActivities.clubs[code]||(s.clubActivities.clubs[code]={weeks:{},participants:{},claims:{},rides:{},rsvps:{}});r.weeks[wk]={[G.net.net.id]:{events:6,ribbons:24,rides:0,gathering:0}};r.participants[G.net.net.id]={name:G.net.myName(),xp:120,seenAt:Date.now()};});
   G.clubHub.open('home');return {code,wk,prev,total:C.clubTotal(),members:C.memberRows(),periods:Object.fromEntries(['week','all','last'].map(p=>[p,C.clubRows(undefined,p)]))};
  });
  assert.equal(report.fixture.total,470);assert.equal(report.fixture.members.length,3);assert.equal(report.fixture.members.find(r=>r.name==='Ava').lastSP,120);
  await show('manage');await page.locator('#chNotice').fill('Saturday trail ride: meet at the Home Pasture gate.');await page.locator('#chNoticeForm button').click();
  assert.equal(await page.evaluate(()=>__features.save.fresh().clubNotice.t),'Saturday trail ride: meet at the Home Pasture gate.');
  await show('home');assert.equal(await page.locator('.ch-home-cards>section').count(),3);assert.match(await page.locator('.ch-member-table').innerText(),/Owner/);
  // A club message must use membership, even while the world-room is Commons.
  await page.locator('#chChatForm input').fill('Ready for our club ride!');await page.locator('#chChatForm button').click();
  report.chat=await page.evaluate(()=>({rows:__features.clubChat.rows(),sent:__qaPublished.filter(p=>p.payload.clubChat)}));
  assert.equal(report.chat.rows.at(-1).t,'Ready for our club ride!');assert.equal(report.chat.sent.at(-1).topic,'srf1/'+report.fixture.code+'/chat');
  await page.evaluate(()=>__features.run('message','srf1/'+__features.clubs.identity().code+'/chat',{id:'qa-ava',n:'Ava',mid:'qa-message-1',t:'See you at the gate!',at:Date.now()}));
  assert.match(await page.locator('.ch-chat-log').innerText(),/See you at the gate!/);await shot('my-club-desktop');
  await tab('members');await page.locator('[data-chub=role][data-member=Ava]').click();assert.equal(await page.evaluate(()=>__features.clubs.memberRows().find(r=>r.name==='Ava').role),'officer');
  await page.evaluate(()=>{const G=__features,at=Date.now();G.run('message','srf1/'+G.clubs.identity().code+'/clubapply/qa-applicant',{id:'qa-applicant',n:'Mira',req:'qa-mira-request',status:'pending',rev:1,at,createdAt:at});G.clubHub.refresh();});
  await page.locator('[data-chub=review][data-applicant=qa-applicant][data-accept=true]').click();
  assert.equal(await page.evaluate(()=>__qaPublished.filter(p=>p.topic.endsWith('/clubdecision/qa-applicant')).at(-1).payload.status),'accepted');
  await tab('rankings');report.periods={};
  for(const period of ['all','week','last']){await page.locator('[data-period="'+period+'"]').click();report.periods[period]=await page.locator('.ch-rank-board tbody tr').count();assert.equal(report.periods[period],2);assert.doesNotMatch(await page.locator('.ch-rank-board').innerText(),/Hollowpeak Highriders/);}
  await page.locator('[data-period=week]').click();await shot('leaderboard-desktop');
  await tab('rewards');assert.match(await page.locator('.ch-four-rewards').innerText(),/4 random rewards/i);assert.match(await page.locator('.ch-champion-poster').innerText(),/top 50 real clubs/);assert.match(await page.locator('.ch-champion-poster').innerText(),/100 Star Points/);
  await page.locator('.ch-odds summary').click();await shot('rewards-desktop');
  await page.locator('[data-chub=claim-chest]').click();report.chest=await page.evaluate(()=>__features.save.fresh().clubWeekLast);assert.equal(report.chest.rewards.length,4);assert.ok(report.chest.claimed);
  await show('activities');const before=await page.evaluate(()=>({coins:__features.save.fresh().coins,gems:__features.save.fresh().gems}));await page.locator('[data-chub=claim-goal][data-goal=events]').click();
  report.goal=await page.evaluate(()=>({coins:__features.save.fresh().coins,gems:__features.save.fresh().gems,goal:__features.clubActivities.snapshot().goals.find(g=>g.id==='events')}));assert.equal(report.goal.coins-before.coins,500);assert.equal(report.goal.gems-before.gems,2);assert.ok(report.goal.goal.claimed);
  await tab('earn');assert.equal(await page.locator('.ch-earn-card').count(),5);await shot('earn-star-points-desktop');
  await tab('search');await page.locator('[data-chub=apply][data-code=qa-riverbend]').click();
  report.pending=await page.evaluate(()=>__features.clubMembership.applications().outgoing.find(r=>r.code==='qa-riverbend'));assert.equal(report.pending.status,'pending');assert.equal(await page.evaluate(()=>__features.clubs.identity().code),report.fixture.code);
  await page.evaluate(()=>{const G=__features,r=G.clubMembership.applications().outgoing.find(r=>r.code==='qa-riverbend');G.run('message','srf1/qa-riverbend/meta',{id:'qa-owner',n:'RiverOwner',f:'RiverOwner',fid:'qa-owner',nm:'Riverbend Riders',mo:'Along the river',crest:'leaf',color:'#497657',pub:true,at:Date.now(),rev:1});G.run('message','srf1/qa-riverbend/clubdecision/'+G.net.net.id,{id:'qa-owner',n:'RiverOwner',to:G.net.net.id,req:r.requestId,appRevision:r.revision,status:'accepted',at:Date.now()+1});G.clubHub.refresh();});
  report.accepted=await page.evaluate(()=>__features.clubMembership.applications().outgoing.find(r=>r.code==='qa-riverbend'));assert.equal(report.accepted.status,'accepted');assert.equal(await page.evaluate(()=>__features.clubs.identity().code),report.fixture.code,'acceptance must not move the player');
  await shot('applications-desktop');
  await page.setViewportSize({width:390,height:844});report.phone={};
  for(const k of ['home','rankings','rewards','earn','search','members','manage','activities']){await show(k);report.phone[k]=await page.evaluate(()=>{const p=document.getElementById('clubHubPanel'),m=p.querySelector('.ch-main');return {width:m.clientWidth,scroll:m.scrollWidth,headerTop:p.querySelector('.ch-top').getBoundingClientRect().top,pseudo:getComputedStyle(p,'::before').display};});assert.ok(report.phone[k].scroll<=report.phone[k].width+1,k+' no phone overflow');assert.equal(report.phone[k].headerTop,0);assert.equal(report.phone[k].pseudo,'none');if(['home','rewards'].includes(k))await shot(k+'-phone');}
  await page.setViewportSize({width:1440,height:940});await show('search');await page.locator('[data-chub=accepted-join][data-code=qa-riverbend]').first().click();assert.equal(await page.evaluate(()=>__features.clubs.identity().code),'qa-riverbend');
  await page.locator('.ch-nav[data-chub=social]').click();assert.equal(await page.locator('#onlinePanel').isVisible(),true);assert.equal(await page.locator('#clubHubPanel').isVisible(),false);
  await page.evaluate(()=>{__features.hidePanels();document.activeElement?.blur();});await page.keyboard.press('KeyK');assert.equal(await page.locator('#clubHubPanel').isVisible(),true);
  await page.reload({timeout:120000});await page.waitForFunction(ready,null,{timeout:120000});
  report.reload=await page.evaluate(()=>{const G=__features;G.wardrobe.closeChar();G.clubHub.open();return {code:G.clubs.identity().code,applications:G.clubMembership.applications(),previous:G.save.fresh().clubRecords};});
  assert.equal(report.reload.code,'qa-riverbend');assert.equal(report.reload.applications.outgoing.find(r=>r.code==='qa-riverbend').status,'joined');assert.ok(report.reload.previous[report.fixture.code].last.claimed);
  assert.deepEqual(errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,periods:report.periods,phone:report.phone}));
 }catch(e){report.pass=false;report.error=e.stack;throw e;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
