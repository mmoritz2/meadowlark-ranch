/* Nothing on screen is an emoji (assets/features/no-emoji.js, and the canvas part at the top of
   ranch3d.html).

   Boots the game with the cleaning on (?emoji=0; a QA run otherwise keeps the emojis) and proves:
   no visible text on the page holds an emoji, on the world screen or in any of the main menus
   (the ☰ menu, Journey, My Horses, Horse Care, Events and an event's page, Leaderboards, the
   Riding Club, the Market); the page title has none; coins and gems in reward lines are drawn
   icons; a toast written with emojis arrives as words and icons; a control whose only content was
   an emoji gets a drawn icon instead of going blank; canvas text is drawn without them (a label
   with an emoji draws exactly what the label without it draws) and a glyph on its own still draws
   a mark; and riding an event from the new Events screen still works with the cleaning on. Then,
   in a second page without ?emoji=0, that a QA run keeps the emojis (the package stays out).

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-no-emoji.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 300 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},300000).unref();
async function boot(page,url){
 await page.goto(url,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await boot(page,QA.BASE+'/ranch3d.html?qa=no-emoji&emoji=0&fresh='+Date.now());
 const r=await page.evaluate(async()=>{
  const G=window.__features,$=id=>document.getElementById(id),out={};
  const wait=ms=>new Promise(res=>setTimeout(res,ms));
  const until=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await wait(80);}return false;};
  const RE=new RegExp(window.__noEmoji.SEQ,'u');
  const shown=el=>{if(!el||!el.getClientRects().length)return false;for(let e=el;e&&e!==document.documentElement;e=e.parentElement){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0'||parseFloat(cs.fontSize)===0)return false;}return true;};   // a zero-size emoji kept in the text for the code that reads it is not shown
  const left=()=>{const o=[];const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);for(let n=tw.nextNode();n;n=tw.nextNode()){const e=n.parentElement;if(!e||['SCRIPT','STYLE','TEXTAREA'].includes(e.tagName))continue;if(RE.test(n.nodeValue)&&shown(e))o.push((e.id||String(e.className).slice(0,30)||e.tagName)+': '+n.nodeValue.trim().slice(0,30));}
   for(const el of document.querySelectorAll('[title],[placeholder],[aria-label]'))for(const a of ['title','placeholder','aria-label']){const v=el.getAttribute(a);if(v&&RE.test(v)&&shown(el))o.push('@'+a+' '+v.slice(0,30));}
   return o;};
  const esc=async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));await wait(200);G.hidePanels();const m=$('seMenu');if(m)m.classList.remove('on');await wait(150);};
  out.installed=G.installed.includes('no-emoji')&&!!G.noEmoji;
  out.world=left(); out.title={t:document.title,ok:!RE.test(document.title)};
  const screens={};
  $('seMenuBtn').click(); await wait(400); screens.menu=left(); await esc();
  for(const id of ['questBtn','stableBtn','careBtn','eventsBtn','lbBtn','netBtn','shopBtn']){const b=$(id);if(!b)continue;b.click();await wait(700);screens[id]=left();
   if(id==='questBtn')out.coins={coin:!!$('questPanel').querySelector('i.noe-coin'),gem:!!$('questPanel').querySelector('i.noe-gem'),textKept:/\d\u{1FA99}/u.test($('questPanel').textContent)};
   if(id==='eventsBtn'){G.seEvents.openPage('h1');await wait(500);screens.eventPage=left();}
   await esc();}
  out.screens=screens;
  /* a toast written with emojis */
  G.toast('🏆 Clear round! +150🪙 +2💎');
  await until(()=>[...document.querySelectorAll('#toasts *')].some(e=>/Clear round/.test(e.textContent)),70000);   // toasts queue, one at a time, and boot has several
  const t=[...document.querySelectorAll('#toasts *')].filter(e=>/Clear round/.test(e.textContent)).sort((a,b)=>a.textContent.length-b.textContent.length).map(e=>e.closest('.toast')||e).pop();
  out.toast=t?{text:t.innerText.trim(),coin:!!t.querySelector('i.noe-coin'),gem:!!t.querySelector('i.noe-gem'),emoji:[...t.querySelectorAll('*')].concat([t]).some(e=>[...e.childNodes].some(c=>c.nodeType===3&&RE.test(c.nodeValue)&&parseFloat(getComputedStyle(e).fontSize)>0))}:null;
  /* a control whose only content was an emoji */
  const b=document.createElement('button'); b.textContent='✏️'; b.style.cssText='position:fixed;left:-200px;top:0'; document.body.appendChild(b); await wait(100);
  out.control={icon:!!b.querySelector('i.noe'),kept:b.textContent==='✏️'}; b.remove();
  /* canvas: a label with an emoji draws what the label without it draws; a glyph alone draws a mark */
  const draw=txt=>{const c=document.createElement('canvas');c.width=220;c.height=40;const x=c.getContext('2d');x.font='bold 20px Nunito, sans-serif';x.fillStyle='#000';x.textBaseline='middle';x.fillText(txt,10,20);return c;};
  const px=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0,h=0;for(let i=3;i<d.length;i+=4){if(d[i]>0){s++;h=(h*31+i)>>>0;}}return {s,h};};
  const a=px(draw('Petal & Pail 🛍️ store')), a2=px(draw('Petal & Pail store')), g=px(draw('🔒'));
  const cm=document.createElement('canvas').getContext('2d'); cm.font='20px sans-serif';
  out.canvas={same:a.s===a2.s&&a.h===a2.h,markDrawn:g.s>20,measure:Math.abs(cm.measureText('Hi 🐴').width-cm.measureText('Hi').width)<0.01};
  /* riding an event from the new screen still works with the cleaning on */
  $('eventsBtn').click(); await until(()=>G.seEvents.state.on,3000); G.seEvents.openPage('h1'); await wait(200);
  const ride=document.querySelector('#seEv [data-sev="ride"]'); if(ride)ride.click();
  out.ride=await until(()=>!!G.course.get(),4000);
  try{G.course.cancelCourse();}catch(e){}
  await until(()=>!G.course.get(),3000);
  out.count=G.noEmoji.count();
  return out;
 });
 check('no-emoji installed',r.installed);
 check('the world screen shows no emoji, and the page title has none',r.world.length===0&&r.title.ok,{world:r.world.slice(0,6),title:r.title.t});
 const bad=Object.entries(r.screens).filter(([k,v])=>v.length).map(([k,v])=>k+': '+v.slice(0,4).join(' | '));
 check('no emoji in the ☰ menu, Journey, My Horses, Horse Care, Events, an event page, Leaderboards, the Club or the Market',bad.length===0&&Object.keys(r.screens).length>=9,bad.length?bad:Object.keys(r.screens));
 check('coins and gems in reward lines are drawn icons, and the text the game reads back still holds them',r.coins&&r.coins.coin&&r.coins.gem&&r.coins.textKept,r.coins);
 check('a toast written with emojis arrives as words and icons',r.toast&&!r.toast.emoji&&r.toast.coin&&r.toast.gem&&/Clear round! \+150/.test(r.toast.text),r.toast);
 check('a control whose only content was an emoji gets a drawn icon instead of going blank (its text unchanged)',r.control.icon&&r.control.kept,r.control);
 check('canvas text is drawn without emojis, a lone glyph still draws a mark, and measuring agrees',r.canvas.same&&r.canvas.markDrawn&&r.canvas.measure,r.canvas);
 check('riding an event from the new Events screen still works with the cleaning on',r.ride);
 /* a QA run without ?emoji=0 keeps them */
 const p2=await browser.newPage({viewport:{width:1000,height:700}});
 p2.on('pageerror',e=>errors.push('PAGEERROR(p2) '+e.message));
 await boot(p2,QA.BASE+'/ranch3d.html?qa=no-emoji-off&fresh='+Date.now());
 const r2=await p2.evaluate(()=>({installed:window.__features.installed.includes('no-emoji'),api:!!window.__features.noEmoji,on:window.__noEmoji.on}));
 check('a QA run keeps the emojis unless it asks for ?emoji=0',!r2.api&&r2.on===false,r2);
 check('no page errors',errors.length===0,errors.slice(0,5));
 const nbad=checks.filter(c=>!c.ok).length;
 console.log(nbad?('FAILED '+nbad+'/'+checks.length):('passed '+checks.length+'/'+checks.length));
 await browser.close(); process.exit(nbad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
