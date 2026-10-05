/* Browser event ordering, with the real input resolver; no game save or GPU needed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./qa-platform.cjs');
const main=fs.readFileSync(path.join(__dirname,'../ranch3d.html'),'utf8');
const start=main.indexOf("addEventListener('keydown',e=>{",main.indexOf('window._k=keys;'));
const keyHandler=main.slice(start,main.indexOf("addEventListener('keyup'",start));
const read=n=>fs.readFileSync(path.join(__dirname,'../assets/',n),'utf8').replaceAll('export const ','const ').replaceAll('export function ','function ');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage();await page.setContent('<button id="menu">Menu</button><div id="seGaitChoices" class="on"></div><button id="seGaitLabel" aria-expanded="true"></button>');
  await page.addScriptTag({content:read('riding-input.js')+read('features/screen-input.js')+`
   const input=createRidingInput('gallop');window.keys={};window.calls=0;window.worldKeys=0;window.menuKeys=0;
   const $=id=>document.getElementById(id),freeCam=false,build={},player={},PANEL_HOTKEYS={};
   window.G={riding:{releaseAll(){for(const k in keys){window.dispatchEvent(new KeyboardEvent('keyup',{code:k,bubbles:true}));delete keys[k];}input.reset();},lock:(reason,on)=>input.lock(reason,on)},on(){},run(name){if(name==='key')worldKeys++;if(name==='screenKey')menuKeys++;}};
   window.intent=()=>input.resolve({keys});window.lock=(reason,on)=>input.lock(reason,on);
   install(G);${keyHandler}
   window.addEventListener('keyup',e=>delete keys[e.code]);
   menu.onclick=()=>document.body.classList.toggle('se-screen-open');
  `});
  await page.keyboard.down('w');assert(await page.evaluate(()=>intent().forward));
  await page.locator('#menu').click();assert(await page.evaluate(()=>intent().locked&&intent().braking&&!intent().forward));
  const worldBefore=await page.evaluate(()=>worldKeys);
  for(const key of ['f','t','z','6','7','8','ArrowRight'])await page.keyboard.press(key);
  assert.equal(await page.evaluate(()=>worldKeys),worldBefore,'menu keys must not reach dismount, wild mode, camera or emote hooks');
  assert(await page.evaluate(()=>menuKeys>=7),'menu navigation remains available');
  await page.evaluate(()=>lock('dialogue',true));await page.locator('#menu').click();assert(await page.evaluate(()=>intent().locked));
  await page.evaluate(()=>lock('dialogue',false));await page.keyboard.down('w');assert(!await page.evaluate(()=>intent().forward),'autorepeat cannot restart after menu closes');
  await page.keyboard.up('w');await page.keyboard.down('w');assert(await page.evaluate(()=>intent().forward),'fresh input restores riding');await page.keyboard.up('w');
  await page.locator('#menu').click();await page.keyboard.down('s');assert(!await page.evaluate(()=>intent().back));await page.locator('#menu').click();await page.keyboard.down('s');assert(!await page.evaluate(()=>intent().back));await page.keyboard.up('s');
  assert.equal(await page.evaluate(()=>intent().requested),'gallop');
  assert.equal(await page.locator('#seGaitLabel').getAttribute('aria-expanded'),'false');
  console.log('Screen stop, overlapping locks, held-key quarantine, reverse suppression and preserved gait passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
