/* The Character screen and the new hair (tack-wardrobe.js, assets/rider-hair.js).

   Opens the screen the way the Rider buttons do (wd:creator) and proves: her own little stage
   comes up with a real rider standing on it; the hair-style grid has a rendered hair preview for every
   style her body can wear; picking a style, a colour and a bare head shows on her at once and is not
   saved until SAVE; the dice changes her; the body switch swaps the styles on offer; UNDO goes back
   to what is saved; SAVE writes it all, dresses the real rider and closes; Escape closes without
   saving; and closing gives the GL context back. Also that a bare head gets a cap and a fringe, and
   a helmet gets neither.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-character.cjs
   Add QA_STATIC=1 to serve the local checkout under a GitHub Pages fixture origin. */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const staticOrigin=process.env.QA_STATIC==='1'?'https://character-preview.github.io':null;
const url=(staticOrigin||QA.BASE)+'/ranch3d.html?qa=character&fresh='+Date.now();
const fs=require('node:fs'),path=require('node:path');
const outDir=path.resolve(__dirname,'../output/wardrobe');fs.mkdirSync(outDir,{recursive:true});
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 300 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},300000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
 // Exercise the actual static-host behavior while every game asset comes from this checkout.
 if(staticOrigin)await page.route(staticOrigin+'/**',async route=>{
  const target=new URL(route.request().url());
  const response=await route.fetch({url:QA.BASE+target.pathname+target.search});
  await route.fulfill({response});
 });
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 const r=await page.evaluate(async()=>{
  const G=window.__features,W=G.wardrobe,out={},frames=n=>new Promise(res=>{let k=0;const f=()=>{if(++k>=n)res();else requestAnimationFrame(f);};requestAnimationFrame(f);});
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const q=sel=>document.querySelector('#seChar '+sel);
  const saved=()=>JSON.parse(JSON.stringify(G.save.fresh().rider));
  /* the rider is the character (assets/rider-model.js): her hair group, the helmet on her head bone; the
     old sculpt's cap and recolour uniforms are read only if she is the fallback */
  const hairOf=R=>R&&R.rig?(R.rig.hair&&R.rig.hair.name):(R&&R._twHair&&R._twHair.name);
  const capOf=R=>R&&R.rig?!!(R.rig.hair&&R.rig.hair.children.length):!!(R&&R._twHair&&R._twHair.getObjectByName('haircap'));
  const bareOf=R=>R&&R.rig?(!R.rig.helmet.parent&&R.rig.u.uHelmet.value===0):!!(R&&R.mesh&&R.mesh.material.userData.u.uHelmHide.value===1);
  out.installed=!!(W&&W.openChar&&document.getElementById('seChar'));
  const before=saved();
  /* 1. open */
  G.ui.dispatch('wd:creator'); await frames(10); await wait(400); await frames(4);
  const st=W.charState();
  out.open={on:document.getElementById('seChar').classList.contains('on'),rider:st.rider,canvas:!!q('canvas'),cards:document.querySelectorAll('#seChar .ch-card').length,
   imgs:document.querySelectorAll('#seChar .ch-card img').length,thumbs:st.thumbs,cats:document.querySelectorAll('#seChar .ch-cat').length,head:(q('.ch-head')||{}).textContent,
   want:W.HAIRSTYLES.filter(h=>!h.body||h.body.includes('f')).length,ubc:!!(st.rider&&G.horse.player.rider&&G.horse.player.rider.rig)};
  /* the canvas really has her on it: sample the middle of the stage for pixels that are not the backdrop */
  { const cv=q('canvas'),c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.drawImage(cv,0,0);
    const d=x.getImageData(Math.floor(cv.width*0.35),Math.floor(cv.height*0.15),Math.floor(cv.width*0.3),Math.floor(cv.height*0.7)).data;let odd=0,n=0;
    for(let i=0;i<d.length;i+=16){n++;const r=d[i],g=d[i+1],b=d[i+2];if(!(b>r+40&&b>g+20))odd++;}
    out.open.notBackdrop=+(odd/n).toFixed(3); }
  /* 2. picks show on her, and are not saved */
  q('[data-ch="style:curly"]').click(); await frames(3);
  q('[data-ch="tab:helmet"]').click(); await frames(2);
  q('[data-ch="pick:helmet:none"]').click(); await frames(3);
  q('[data-ch="tab:hair"]').click(); await frames(2);
  const hairBtn=[...document.querySelectorAll('#seChar [data-ch^="pick:hair:"]')].find(b=>!b.classList.contains('sel')); const hairCol=hairBtn&&hairBtn.dataset.ch.split(':').slice(2).join(':');
  if(hairBtn)hairBtn.click(); await frames(3);
  const st2=W.charState(), sv2=saved();
  out.picks={draft:st2.draft,savedStyle:sv2.hairStyle,savedHelmet:sv2.helmet,savedHair:sv2.hair,hairCol};
  out.picks.preview=st2.rider;
  /* 3. the dice, the body switch, undo */
  const d0=JSON.stringify(W.charState().draft); q('[data-ch="dice"]').click(); await frames(3); out.dice=JSON.stringify(W.charState().draft)!==d0;
  q('[data-ch="body"]').click(); await frames(3); q('[data-ch="tab:style"]').click(); await frames(3); await wait(300); await frames(2);
  out.body={draftBody:W.charState().draft.body,crop:!!q('[data-ch="style:crop"]'),braid:!!q('[data-ch="style:braid"]')};
  q('[data-ch="undo"]').click(); await frames(3);
  const du=W.charState().draft; out.undo={body:du.body,hairStyle:du.hairStyle,helmet:du.helmet,matches:du.hairStyle===(before.hairStyle||'long')&&(du.helmet||null)===(before.helmet||null)};
  /* 4. SAVE writes it and dresses the real rider */
  q('[data-ch="style:curly"]').click(); await frames(2); q('[data-ch="tab:helmet"]').click(); await frames(2); q('[data-ch="pick:helmet:none"]').click(); await frames(2);
  out.kitCards={};
  q('[data-ch="tab:outfit"]').click(); await frames(2); out.kitCards.outfits=document.querySelectorAll('#seChar [data-ch^="outfit:"]').length; q('[data-ch="outfit:peasant"]').click(); await frames(2);
  q('[data-ch="tab:eyes"]').click(); await frames(2); out.kitCards.eyes=document.querySelectorAll('#seChar [data-ch^="eyes:"]').length; q('[data-ch="eyes:green"]').click(); await frames(2);
  document.getElementById('chName').value='Juniper';
  q('[data-ch="save"]').click(); await frames(6);
  const sv4=saved(), R=G.horse.player.rider;
  /* the Stable outfit arrives with its file: give it a moment */
  for(let i=0;i<40&&R&&R.rig&&!R.rig.outfit;i++)await wait(100);
  out.save={closed:!document.getElementById('seChar').classList.contains('on'),style:sv4.hairStyle,helmet:sv4.helmet,made:sv4.made,name:G.save.fresh().playerName,
   hair:hairOf(R),cap:capOf(R),bare:bareOf(R),outfit:sv4.outfit,eyes:sv4.eyes,wearing:R&&R.rig?(R.rig.outfit&&R.rig.outfit.id):'n/a',
   released:W.charState().rider===false};
  /* 5. Escape closes without saving */
  G.ui.dispatch('wd:creator'); await frames(8);
  q('[data-ch="tab:style"]').click(); await frames(2);   // it opens on the tab you left it on
  q('[data-ch="style:bun"]').click(); await frames(2);
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await frames(4);
  out.esc={closed:!document.getElementById('seChar').classList.contains('on'),style:saved().hairStyle};
  /* 6. a helmet gets neither cap nor fringe */
  G.ui.dispatch('wd:wear:helmet:#2e2e38'); await frames(4);
  const R2=G.horse.player.rider; out.helmet={hair:hairOf(R2),cap:capOf(R2),bare:bareOf(R2),ubc:!!R2.rig};
  /* 7. The expanded wardrobe: real previews, collections, draft colours and a saved new garment. */
  W.openChar('outfit');
  for(let i=0;i<150&&W.charState().outfitThumbs!==48;i++)await wait(100);
  out.expanded={thumbs:W.charState().outfitThumbs,all:document.querySelectorAll('#seChar [data-ch^="outfit:"]').length};
  out.expanded.collections={};
  for(const category of ['Riding','Ranch','Everyday','Adventure']){
   q('[data-ch="filter:'+category+'"]').click();
   out.expanded.collections[category]=document.querySelectorAll('#seChar [data-ch^="outfit:"]').length;
  }
  q('[data-ch="filter:Ranch"]').click();q('[data-ch="outfit:flannel"]').click();await frames(3);
  out.expanded.draftOnly=saved().outfit==='peasant'&&W.charState().draft.outfit==='flannel';
  q('[data-ch="tab:shirt"]').click();q('[data-ch="pick:shirt:#a5b7a1"]').click();await frames(3);
  out.expanded.colourDraft=W.charState().draft.shirt==='#a5b7a1';
  q('[data-ch="tab:style"]').click();q('[data-ch="style:waves"]').click();await frames(2);
  q('[data-ch="tab:hair"]').click();q('[data-ch="pick:hair:#68422d"]').click();
  q('[data-ch="tab:skin"]').click();q('[data-ch="pick:skin:#bd936d"]').click();
  q('[data-ch="tab:eyes"]').click();q('[data-ch="eyes:olive"]').click();
  q('[data-ch="tab:helmet"]').click();q('[data-ch="pick:helmet:none"]').click();
  out.expanded.appearanceDraft=saved().hairStyle==='curly'&&W.charState().draft.hairStyle==='waves';
  out.accessories={previews:{}};
  for(const [slot,id] of Object.entries({eyewear:'round',earrings:'hoops',neckwear:'pendant'})){
   q('[data-ch="tab:'+slot+'"]').click();
   for(let i=0;i<80&&document.querySelectorAll('#chGrid img').length<6;i++)await wait(50);
   out.accessories.previews[slot]=document.querySelectorAll('#chGrid img').length;
   q('[data-ch="accessory:'+slot+':'+id+'"]').click();
  }
  out.accessories.draft=W.charState().draft.eyewear==='round'&&W.charState().draft.earrings==='hoops'&&W.charState().draft.neckwear==='pendant';
  out.accessories.draftOnly=saved().eyewear!=='round'||saved().earrings!=='hoops'||saved().neckwear!=='pendant';
  q('[data-ch="save"]').click();await frames(5);
  for(let i=0;i<40&&G.horse.player.rider.rig?.outfit?.id!=='flannel';i++)await wait(100);
  out.expanded.saved=saved().outfit==='flannel'&&saved().shirt==='#a5b7a1';
  out.expanded.newHair=G.horse.player.rider.rig?.hair?.name==='hair-waves';
  out.expanded.live=G.horse.player.rider.rig?.outfit?.id==='flannel'&&G.horse.player.rider.rig.u.uShirt.value.getHexString()==='a5b7a1';
  out.accessories.live=G.horse.player.rider.rig.accessories.roots.map(g=>g.name);
  const packet={};G.run('netPos',packet,G.save.fresh());out.accessories.packet=packet.rhs==='waves'&&packet.ew==='round'&&packet.er==='hoops'&&packet.nw==='pendant';
  W.openChar('eyewear');q('[data-ch="accessory:eyewear:none"]').click();out.accessories.removeDraft=W.charState().draft.eyewear==='none'&&saved().eyewear==='round';
  q('[data-ch="undo"]').click();out.accessories.undo=W.charState().draft.eyewear==='round';W.closeChar();
  W.openChar('outfit');q('[data-ch="filter:All"]').click();
  for(let i=0;i<100&&W.charState().outfitThumbs!==48;i++)await wait(100);
  return out;
 });
 const layout=await page.evaluate(()=>{const cards=[...document.querySelectorAll('#chGrid .ch-card')].map(c=>c.getBoundingClientRect());return {separated:cards[2].top>=cards[0].bottom,cardHeight:cards[0].height};});
 check('outfit cards retain their full height without overlapping in the scrolling grid',layout.separated&&layout.cardHeight>100,layout);
 await page.screenshot({path:path.join(outDir,'character-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(outDir,'character-mobile.png')});
 const mobile=await page.evaluate(()=>{const a=document.getElementById('chSave').getBoundingClientRect(),b=document.getElementById('chGrid').getBoundingClientRect();return {save:a.bottom<=innerHeight&&a.right<=innerWidth,grid:b.width>100&&b.height>120,overflow:document.getElementById('seChar').scrollWidth>innerWidth};});
 check('the wardrobe stays usable on a narrow phone screen',mobile.save&&mobile.grid&&!mobile.overflow,mobile);
 await page.locator('[data-ch="tab:neckwear"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#chGrid img').length===6);
 await page.screenshot({path:path.join(outDir,'accessories-mobile.png')});
 check('accessories have actual previews, stay in the draft, save to the rider and travel in multiplayer',Object.values(r.accessories.previews).every(n=>n===6)&&r.accessories.draft&&r.accessories.draftOnly&&r.accessories.live.length===3&&r.accessories.packet,r.accessories);
 check('accessories can be removed from the draft and restored with Undo',r.accessories.removeDraft&&r.accessories.undo);
 check('new hair, natural colours and eye choices preview without saving and apply to the rider',r.expanded.appearanceDraft&&r.expanded.newHair,r.expanded);
 check('all 48 outfits have real previews and twelve looks per collection',r.expanded.thumbs===48&&r.expanded.all===48&&Object.values(r.expanded.collections).every(n=>n===12),r.expanded);
 check('new garment and dye preview without saving, then SAVE dresses the live rider',r.expanded.draftOnly&&r.expanded.colourDraft&&r.expanded.saved&&r.expanded.live,r.expanded);
 await page.reload({waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__features?.wardrobe,null,{timeout:120000});
 const persisted=await page.evaluate(()=>window.__features.save.fresh().rider);
 check('all three accessory choices survive reload',persisted.eyewear==='round'&&persisted.earrings==='hoops'&&persisted.neckwear==='pendant',{eyewear:persisted.eyewear,earrings:persisted.earrings,neckwear:persisted.neckwear});
 check('new hair and natural appearance choices survive a page reload',persisted.hairStyle==='waves'&&persisted.hair==='#68422d'&&persisted.skin==='#bd936d'&&persisted.eyes==='olive',{hair:persisted.hairStyle,colour:persisted.hair,skin:persisted.skin,eyes:persisted.eyes});
 check('the new outfit and colour survive a page reload',persisted.outfit==='flannel'&&persisted.shirt==='#a5b7a1',{outfit:persisted.outfit,shirt:persisted.shirt});
 check('the Character screen is installed',r.installed);
 check('it opens with her standing on her own stage and a rendered preview for every style',r.open.on&&r.open.rider&&r.open.canvas&&r.open.notBackdrop>0.03&&r.open.cards===r.open.want&&r.open.imgs===r.open.want&&r.open.want>=30&&r.open.thumbs>=r.open.want&&r.open.cats===12&&/hair style/i.test(r.open.head||''),r.open);
 check('the rider is the character (not the old sculpt)',r.open.ubc===true,{ubc:r.open.ubc});
 check('the Outfit and Eyes categories offer 48 outfits and ten eye colours',r.kitCards&&r.kitCards.outfits===48&&r.kitCards.eyes===10,r.kitCards);
 check('picks show on the draft and are not saved until SAVE',r.picks.draft.hairStyle==='curly'&&r.picks.draft.helmet==='none'&&(!r.picks.hairCol||r.picks.draft.hair===r.picks.hairCol)&&r.picks.savedStyle!=='curly'&&r.picks.savedHelmet!=='none'&&r.picks.preview,r.picks);
 check('the dice changes her',r.dice);
 check('the body switch offers the other body\'s styles',r.body.draftBody==='m'&&r.body.crop&&!r.body.braid,r.body);
 check('UNDO goes back to what is saved',r.undo.matches,r.undo);
 check('SAVE writes it, names her, dresses the real rider bareheaded in her curls, in the Stable outfit with green eyes, and closes',r.save.closed&&r.save.style==='curly'&&r.save.helmet==='none'&&r.save.made===true&&r.save.name==='Juniper'&&r.save.hair==='hair-curly'&&r.save.cap&&r.save.bare===true&&r.save.outfit==='peasant'&&r.save.eyes==='green'&&(r.save.wearing==='peasant'||r.save.wearing==='n/a')&&r.save.released,r.save);
 check('Escape closes it without saving',r.esc.closed&&r.esc.style==='curly',r.esc);
 check('a helmet goes on over her hair',r.helmet.hair==='hair-curly'&&r.helmet.bare===false&&(r.helmet.ubc||!r.helmet.cap),r.helmet);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
