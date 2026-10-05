/* Browser-only modal regression; no WebGL, save or network needed. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('./qa-platform.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/features/dialogue-focus.js'),'utf8').replace('export const id=','const id=').replace('export function install','function install');
const baseCSS=fs.readFileSync(require('node:path').join(__dirname,'../ranch3d.html'),'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390}});
  await page.setContent('<style>'+baseCSS+'</style><button id="ctx" style="display:block">Talk</button><div id="seHudRoot"><button id="seGaitLabel" aria-expanded="true">Canter</button><div id="seGaitChoices" class="on"></div></div><div id="dlg" style="display:none"></div>');
  await page.evaluate(()=>{
   window.calls={release:0,brake:false,claimed:0,keys:0};window.hooks={};
   window.G={riding:{releaseAll(){calls.release++;},brake(on){calls.brake=on;}},on(n,f){hooks[n]=f;}};
   window.addEventListener('keydown',e=>{if(e.key==='Escape'){dlg.style.display='none';return;}if(e.code==='KeyE'&&!G.dialogue?.active){openDialogue();return;}calls.keys++;});
   window.openDialogue=()=>{dlg.innerHTML='<b>Wren</b><p>Name your horse.</p><input id="nameIn" aria-label="Horse name" value="Kestrel"><button id="random">Random</button><button id="dlgBtn">Continue</button>';dlg.style.display='block';dlgBtn.onclick=()=>{calls.claimed++;dlg.style.display='none';};nameIn.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();dlgBtn.click();}};};
   ctx.onclick=openDialogue;
  });
  await page.addScriptTag({content:source+'\ninstall(G);'});
  await page.locator('#ctx').click();
  await page.waitForFunction(()=>document.activeElement.id==='nameIn');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'nameIn');
  assert.equal(await page.locator('#dlg').getAttribute('aria-labelledby'),'dialogueTitle');
  assert.equal(await page.locator('#ctx').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert(await page.evaluate(()=>G.dialogue.active&&calls.brake&&calls.release===1));
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'dlgBtn');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'nameIn');
  await page.locator('#nameIn').fill('Willow');await page.keyboard.press('w');
  assert.equal(await page.evaluate(()=>calls.keys),0,'typing cannot leak to riding shortcuts');
  assert(await page.evaluate(()=>{const r={target:15,noJump:false};hooks.ride(r);return r.target===0&&r.noJump;}));
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>calls.claimed),1);
  assert(await page.evaluate(()=>!G.dialogue.active&&!calls.brake&&document.activeElement.id==='ctx'));
  await page.locator('#ctx').click();await page.keyboard.press('Escape');assert(await page.evaluate(()=>!G.dialogue.active&&!calls.brake));
  await page.locator('#ctx').click();await page.locator('#dlgBtn').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>calls.claimed),2,'native button activation is preserved');
  await page.locator('#ctx').click();await page.keyboard.down('w');await page.locator('#dlgBtn').click();
  const beforeRepeat=await page.evaluate(()=>calls.keys);await page.keyboard.down('w');assert.equal(await page.evaluate(()=>calls.keys),beforeRepeat,'held movement cannot restart on autorepeat after closing');
  await page.keyboard.up('w');await page.keyboard.down('w');assert.equal(await page.evaluate(()=>calls.keys),beforeRepeat+1,'a fresh press restores normal input');await page.keyboard.up('w');
  await page.locator('#ctx').click();
  for(const viewport of [{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(viewport);const r=await page.locator('#dlg').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+.1&&r.y+r.height<=viewport.height+.1,'dialogue fits viewport');
  }
  await page.keyboard.press('Escape');await page.keyboard.press('e');
  await page.waitForFunction(()=>document.activeElement.id==='nameIn');assert.equal(await page.locator('#nameIn').inputValue(),'Kestrel','the Talk shortcut must not enter an extra letter in the horse name');
  console.log('Dialogue input isolation, held-key release, Tab loop, name Enter, button Space, Escape, focus restoration and phone bounds passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
