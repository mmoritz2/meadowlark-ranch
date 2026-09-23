/* The Character screen and the new hair (tack-wardrobe.js, assets/rider-hair.js).

   Opens the screen the way the Rider buttons do (wd:creator) and proves: her own little stage
   comes up with a real rider standing on it; the hair-style grid has a rendered clay bust for every
   style her body can wear; picking a style, a colour and a bare head shows on her at once and is not
   saved until SAVE; the dice changes her; the body switch swaps the styles on offer; UNDO goes back
   to what is saved; SAVE writes it all, dresses the real rider and closes; Escape closes without
   saving; and closing gives the GL context back. Also that a bare head gets a cap and a fringe, and
   a helmet gets neither.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-character.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const url=QA.BASE+'/ranch3d.html?qa=character&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 300 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},300000).unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
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
  out.installed=!!(W&&W.openChar&&document.getElementById('seChar'));
  const before=saved();
  /* 1. open */
  G.ui.dispatch('wd:creator'); await frames(10); await wait(400); await frames(4);
  const st=W.charState();
  out.open={on:document.getElementById('seChar').classList.contains('on'),rider:st.rider,canvas:!!q('canvas'),cards:document.querySelectorAll('#seChar .ch-card').length,
   imgs:document.querySelectorAll('#seChar .ch-card img').length,thumbs:st.thumbs,cats:document.querySelectorAll('#seChar .ch-cat').length,head:(q('.ch-head')||{}).textContent};
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
  const du=W.charState().draft; out.undo={body:du.body,hairStyle:du.hairStyle,helmet:du.helmet,matches:du.hairStyle===(before.hairStyle||'loose')&&(du.helmet||null)===(before.helmet||null)};
  /* 4. SAVE writes it and dresses the real rider */
  q('[data-ch="style:curly"]').click(); await frames(2); q('[data-ch="tab:helmet"]').click(); await frames(2); q('[data-ch="pick:helmet:none"]').click(); await frames(2);
  document.getElementById('chName').value='Juniper';
  q('[data-ch="save"]').click(); await frames(6);
  const sv4=saved(), R=G.horse.player.rider;
  out.save={closed:!document.getElementById('seChar').classList.contains('on'),style:sv4.hairStyle,helmet:sv4.helmet,made:sv4.made,name:G.save.fresh().playerName,
   hair:R&&R._twHair&&R._twHair.name,cap:!!(R&&R._twHair&&R._twHair.getObjectByName('haircap')),bare:R&&R.mesh&&R.mesh.material.userData.u.uHelmHide.value,
   released:W.charState().rider===false};
  /* 5. Escape closes without saving */
  G.ui.dispatch('wd:creator'); await frames(8);
  q('[data-ch="tab:style"]').click(); await frames(2);   // it opens on the tab you left it on
  q('[data-ch="style:bob"]').click(); await frames(2);
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true})); await frames(4);
  out.esc={closed:!document.getElementById('seChar').classList.contains('on'),style:saved().hairStyle};
  /* 6. a helmet gets neither cap nor fringe */
  G.ui.dispatch('wd:wear:helmet:#2e2e38'); await frames(4);
  const R2=G.horse.player.rider; out.helmet={hair:R2._twHair&&R2._twHair.name,cap:!!(R2._twHair&&R2._twHair.getObjectByName('haircap')),bare:R2.mesh.material.userData.u.uHelmHide.value};
  return out;
 });
 check('the Character screen is installed',r.installed);
 check('it opens with her standing on her own stage and a clay bust for every style',r.open.on&&r.open.rider&&r.open.canvas&&r.open.notBackdrop>0.03&&r.open.cards===7&&r.open.imgs===7&&r.open.thumbs>=7&&r.open.cats===7&&/hair style/i.test(r.open.head||''),r.open);
 check('picks show on the draft and are not saved until SAVE',r.picks.draft.hairStyle==='curly'&&r.picks.draft.helmet==='none'&&(!r.picks.hairCol||r.picks.draft.hair===r.picks.hairCol)&&r.picks.savedStyle!=='curly'&&r.picks.savedHelmet!=='none'&&r.picks.preview,r.picks);
 check('the dice changes her',r.dice);
 check('the body switch offers the other body\'s styles',r.body.draftBody==='m'&&r.body.crop&&!r.body.braid,r.body);
 check('UNDO goes back to what is saved',r.undo.matches,r.undo);
 check('SAVE writes it, names her, dresses the real rider bareheaded with a cap, and closes',r.save.closed&&r.save.style==='curly'&&r.save.helmet==='none'&&r.save.made===true&&r.save.name==='Juniper'&&r.save.hair==='hair-curly'&&r.save.cap&&r.save.bare===1&&r.save.released,r.save);
 check('Escape closes it without saving',r.esc.closed&&r.esc.style==='curly',r.esc);
 check('under a helmet there is no cap',r.helmet.hair==='hair-curly'&&!r.helmet.cap&&r.helmet.bare===0,r.helmet);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
