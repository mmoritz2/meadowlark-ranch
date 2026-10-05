/* Exercise the actual game's claim callback in an isolated DOM/save fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./qa-platform.cjs');
const html=fs.readFileSync(path.join(__dirname,'../ranch3d.html'),'utf8');
const openDlg=html.slice(html.indexOf('function openDlg(){'),html.indexOf('function makeNPC(def)'));
const baseCSS=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const focus=fs.readFileSync(path.join(__dirname,'../assets/features/dialogue-focus.js'),'utf8').replace('export const id=','const id=').replace('export function install','function install');
const receipt=fs.readFileSync(path.join(__dirname,'../assets/features/mission-receipt.js'),'utf8').replace('export const id=','const id=').replace('export function install','function install');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']});
 try{
  const page=await browser.newPage();await page.setContent('<style>'+baseCSS+'</style><div id="dlg" style="display:none"></div>');
  await page.addScriptTag({content:`
   const $=id=>document.getElementById(id),s={coins:100,gems:2,keys:0,named:true,story:{name:'Willow'}};
   let storyIdx=0,storyProg=1,payouts=0,claims=0,activations=0;
   const STORY=[{type:'carrots',goal:1,label:'Gather carrots',npc:'wren',reward:{c:10,g:2,k:1},text:'Gather.'},{type:'care',goal:1,label:'Feed Willow',reward:{c:20},npc:'wren'}];
   const NPC_DEFS=[{id:'wren',name:'Grandpa Wren',icon:'',idle:'Hello'}],nearNPC={def:NPC_DEFS[0]},npcList=[nearNPC];
   const hooks={},G={on(n,f){hooks[n]=f;},run(n,...a){if(n==='missionClaim')claims++;return hooks[n]?.(...a);},$,
    dialogue:{setSpeaker(){}},riding:{releaseAll(){},lock(){}},save:{fresh:()=>s},money:{rewardLabel},storyQuests:{cine:{on:false}},
    storyGuidance:{describe:()=>({title:'Feed Willow',hint:'Give her a carrot.',action:'care',label:'Open feeding'}),activateCurrent(){activations++;}}};
   function freshSave(){return s;}function syncSave(f){f(s);}function missionDone(){return storyProg>=STORY[storyIdx].goal;}
   function storyText(s){return s;}function npcShort(d){return d.name;}function saveStory(){}function toast(){}function bindFx(){}
   function refreshWallet(){}function refreshTack(){}function reloadHorses(){}function sGem(){}function mulOf(){return 1.5;}
   function rewardLabel(r){return Object.entries(r).map(([k,v])=>k+':'+v).join(', ')+' · Common tack · 5 carrots · 2 apples · +20 XP';}
   function payReward(s,r){payouts++;s.coins+=r.c||0;s.gems+=Math.round((r.g||0)*2);s.keys+=r.k||0;}
   ${openDlg}\n(()=>{${receipt}\ninstall(G);})();\n(()=>{${focus}\ninstall(G);})();
   window.openTest=()=>openDlg();window.snapshot=()=>({payouts,claims,activations,storyIdx,coins:s.coins,gems:s.gems,keys:s.keys});
  `});
  await page.evaluate(()=>{openTest();window.oldClaim=document.getElementById('dlgBtn').onclick;});
  await page.locator('#dlgBtn').click();assert.deepEqual(await page.evaluate(()=>snapshot()),{payouts:1,claims:1,activations:0,storyIdx:1,coins:115,gems:6,keys:1});
  assert.match(await page.locator('.mission-receipt-reward').innerText(),/c:15, g:4, k:1/,'receipt uses actual multiplied wallet deltas');
  await page.evaluate(()=>{oldClaim();oldClaim();});assert.equal(await page.evaluate(()=>snapshot().payouts),1);assert(await page.locator('#missionNext').isVisible(),'stale claims preserve the receipt');
  for(const viewport of [{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(30);
   assert(await page.locator('#dlg').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'receipt fits without hidden heading or buttons at '+viewport.width);
   const b=await page.locator('#dlgBtn').boundingBox();assert(b.y>=0&&b.y+b.height<=viewport.height);
  }
  await page.locator('#missionNext').click();assert.equal(await page.evaluate(()=>snapshot().activations),1);assert.equal(await page.evaluate(()=>snapshot().payouts),1);
  assert.equal(await page.locator('#dlg').evaluate(el=>el.style.display),'none');
  console.log('Paid reward receipt, coin/gem multipliers, stale/double claims and next-task action passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
