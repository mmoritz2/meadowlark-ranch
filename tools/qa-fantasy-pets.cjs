/* Fantasy pets: the Emberling, the Mossglow Fawn, the Cinder Chick, the Canyon Wyvern and the Gryphling (assets/features/pet-fantasy.js,
   their PETS3 rows in market-summon-keys-pets.js, the Emberling's and the fawn's real bodies in
   assets/models/pets/manifest.json).

   What it proves, in the real game at 1280x800:
     1. data: the three species, portraits and PETS3 rows (name, rarity, where it comes from, a note, wings
        for the flyers) exist; each real model has its licence, creator and source in the manifest and a row
        in ATTRIBUTION.md, and its file is under 4 MB;
     2. for each pet, following you: the right animal, in the scene; for the two with a real body, the real
        body is what you see (loaded, the drawn one hidden), the right size (height within 10% of the
        manifest's), standing on the grass (its lowest point within a few centimetres of the ground: no
        sinking, no floating) while it stands, walks and gallops beside you, facing the way it goes (head in
        front of the tail), playing a real clip (never a bind pose), and its legs keeping up with the ground
        (the stride cadence the game asks for is not capped below what the speed needs, so the feet do not
        slide); the Emberling flutters low (its Fly clip) when its legs cannot keep up;
     3. flight on a pegasus: the Emberling and the Cinder Chick take off, fly beside you (the Emberling with
        its own Fly clip) within a few metres, and are down beside the horse after landing;
     4. menus: the stable and the market's Pets tab list them with their portraits; the Cinder Chick shows as
        an Ember season call outside its season;
     5. no page errors.
   Screenshots (close and at riding distance, standing and running, and in flight) go to QA_SHOTS.

   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-fantasy-pets.cjs
           PETS=emberling runs one pet; QA_SHOTS=<dir> saves screenshots. */
const QA=require('./qa-platform.cjs');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=QA;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const ALL=['emberling','mossfawn','cinderchick','wyvern','gryphling'],REAL=['emberling','mossfawn','wyvern'],FLY=['emberling','cinderchick','wyvern','gryphling'];
const ONLY=process.env.PETS?process.env.PETS.split(','):ALL, SHOTS=process.env.QA_SHOTS||'';
if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const t0=Date.now(), stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 1500 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},1500000).unref();
const errors=[];
const ROOT=path.resolve(__dirname,'..');
const HOME={x:-100,z:400,h:Math.PI};

/* ---- 1. data, from the files ----------------------------------------------------------------- */
const man=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/pets/manifest.json'),'utf8'));
const attr=fs.readFileSync(path.join(ROOT,'assets/models/pets/ATTRIBUTION.md'),'utf8');
for(const k of REAL){const e=man.pets[k];
 const f=e&&e.file&&path.join(ROOT,'assets/models/pets',e.file),size=f&&fs.existsSync(f)?fs.statSync(f).size:0;
 check(k+': manifest entry with licence, creator and source, file present and under 4 MB',!!(e&&e.license&&e.licenseUrl&&e.creator&&e.creatorUrl&&e.sourceUrl&&e.credit&&size>0&&size<4*1048576&&size===e.bytes),{file:e&&e.file,bytes:size,license:e&&e.license});
 check(k+': credited in ATTRIBUTION.md',!!(e&&attr.includes(e.sourceUrl)&&attr.includes(e.file)),e&&e.sourceUrl);}

async function newPage(){
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,4).join(' | ')));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 return page;
}
async function boot(page){
 await page.goto(QA.BASE+'/ranch3d.html?qa=fantasypets&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1200);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
 await page.evaluate(()=>{
  const G=window.__features,T=G.THREE,p=G.horse.player;
  const key=(c,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c,bubbles:true}));
  window.__qcam=null;G.on('camera',()=>{const c=window.__qcam;if(!c)return;const cam=G.camera;cam.position.set(c.pos[0],c.pos[1],c.pos[2]);cam.lookAt(c.look[0],c.look[1],c.look[2]);return true;});
  const v=new T.Vector3(),hv=new T.Vector3(),tv=new T.Vector3();
  /* the real body's lowest point against the ground under the pet, and where its head is against its tail */
  function realProbe(c){const P=c.parts,R=P.real;if(!R||R.state!=='ready')return null;const I=R.inst;I.root.updateMatrixWorld(true);
   let lo=Infinity;I.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible){const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i+=7){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(v.y<lo)lo=v.y;}}});
   const g=P.group.position,gy=G.petModels.standY?G.petModels.standY(g.x,g.z):G.world.groundH(g.x,g.z);
   let face=null;const hb=I.bones.head||I.bones.neck;let tail=null;I.model.traverse(o=>{if(!tail&&o.isBone&&/tail/i.test(o.name))tail=o;});if(!tail)I.model.traverse(o=>{if(!tail&&o.isBone&&/pelvis|hips/i.test(o.name))tail=o;});
   if(hb&&tail){hb.getWorldPosition(hv);tail.getWorldPosition(tv);const h=c.heading;face=+((hv.x-tv.x)*Math.sin(h)+(hv.z-tv.z)*Math.cos(h)).toFixed(3);}
   const info=I.info();return {lowest:+(lo-gy).toFixed(3),face,clip:info.state,weights:info.weights,dims:info.dims,shown:!P.bodyPivot.visible&&I.root.visible};}
  /* how much the game caps the stride cadence below what the pet's speed needs (0: the feet keep up) */
  function slip(c){const P=c.parts,R=P.real,st=c.st;if(!R||R.state!=='ready'||!st)return null;const I=R.inst,S=P.spec,w=I.info().weights,spd=st.spd||0;
   if((w.fly||0)+(w.glide||0)>0.5||st.skim>0.08||c.airborne)return {air:true};
   if(spd<0.3)return {still:true};
   const trot=I.has('trot'),GT=S.realGait||{},ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
   let wW=1,wT=0,wR=0;if(trot){const a=ss(GT.trot?GT.trot[0]:1.3,GT.trot?GT.trot[1]:2.2,spd),b=ss(GT.run?GT.run[0]:4.6,GT.run?GT.run[1]:6.4,spd);wW=1-a;wT=a*(1-b);wR=a*b;}else{const a=ss(GT.run?GT.run[0]:1.8,GT.run?GT.run[1]:3.4,spd);wW=1-a;wR=a;}
   const kW=I.pick('walk'),kT=trot?I.pick('trot'):null,kR=I.pick('run');const sW=I.stride(kW)||S.len*1.3,sT=kT?(I.stride(kT)||S.len*1.9):0,sR=kR?(I.stride(kR)||S.len*2.8):0,str=(sW*wW+sT*wT+sR*wR)/Math.max(1e-3,wW+wT+wR);
   const dom=wR>0.5?kR:wT>0.5?kT:kW,nat=1/Math.max(0.1,I.dur(dom)),need=spd/Math.max(0.05,str),got=Math.min(Math.max(need,nat*0.5),nat*(GT.rateHi||2.6));
   return {spd:+spd.toFixed(2),need:+need.toFixed(2),got:+got.toFixed(2),slip:+Math.max(0,1-got/need).toFixed(2),clip:dom};}
  function sample(tag){const c=G.pets.comp(),o={tag,sp:+Math.abs(p.speed||0).toFixed(1)};if(!c)return Object.assign(o,{comp:false});
   const g=c.parts.group;let q=g;o.inScene=false;while(q){if(q===G.scene){o.inScene=true;break;}q=q.parent;}
   o.key=c.key;o.model=c.parts.key;o.real=c.parts.real?c.parts.real.state:'none';o.air=c.st?c.st.air:'ground';o.alt=+(c.alt||0).toFixed(2);
   o.dist=+Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z).toFixed(2);const ry=G.world.groundH(p.pos.x,p.pos.z)+(p.y||0);o.d3=+Math.hypot(g.position.x-p.pos.x,g.position.y-(ry+1),g.position.z-p.pos.z).toFixed(2);
   o.skim=c.st?+(c.st.skim||0).toFixed(2):0;o.spd=c.st?+(c.st.spd||0).toFixed(2):0;o.drawn=c.parts.bodyPivot.visible;
   const rp=realProbe(c);if(rp)Object.assign(o,rp);const sl=slip(c);if(sl)o.slip=sl;
   if(c.parts.extra){o.fx=Object.keys(c.parts.extra).filter(k=>['fireGlow','sneeze','trail','flies','petals','spots','crest','plumes','burst','dust'].includes(k));}
   return o;}
  const run=(keys,ms,every,tag)=>{const out=[];for(const k of keys)key(k,true);const n=Math.max(1,Math.round(ms/every));for(let i=0;i<n;i++){window.advanceTime(every);out.push(sample(tag));}for(const k of keys)key(k,false);return out;};
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const ride=b=>{G.save.sync(s=>{let h=s.horses.find(x=>x.breed===b);if(!h){h=G.horse.grantHorse(s,b,{name:'QA '+b,bond:60});}s.horses.splice(s.horses.indexOf(h),1);s.horses.unshift(h);});
   G.horse.reloadHorses();const sel=document.getElementById('horseSel');sel.value='0';sel.onchange();};
  /* a camera close to the pet, three-quarters from the front */
  const close=()=>{const c=G.pets.comp();if(!c)return;const g=c.parts.group.position,h=c.heading,S=c.parts.spec,d=Math.max(1.7,S.h*3.2);window.__qcam={pos:[g.x+Math.sin(h+0.8)*d,g.y+Math.max(0.95,S.h*1.6),g.z+Math.cos(h+0.8)*d],look:[g.x,g.y+S.h*0.45,g.z]};};
  window.__QF={G,p,key,sample,run,reset,ride,close,home:G.horse.ridden().breed};
 });
}
/* the model loads asynchronously (fetch and parse need real time, advanceTime alone does not give it any) */
async function waitReal(page,k){for(let i=0;i<120;i++){const st=await page.evaluate(()=>{window.advanceTime(100);const c=window.__features.pets.comp();return c&&c.parts?(c.parts.real?c.parts.real.state:'check'):'none';});
  if(!['check','loading','swap'].includes(st))return st;await page.waitForTimeout(150);}return 'timeout';}
const shot=async(page,name)=>{if(!SHOTS)return null;const f=path.join(SHOTS,name+'.png');try{await page.screenshot({path:f,timeout:60000});return f;}catch(e){console.log('(screenshot '+name+' skipped: '+e.message.split('\n')[0]+')');return null;}};
const shots=[];
(async()=>{
 browser=await chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await newPage();
 stage('boot');await boot(page);
 /* ---- data in the page ---- */
 const data=await page.evaluate(keys=>{const G=window.__features;const rows=G.pets.PETS3;
  return Object.fromEntries(keys.map(k=>{const r=rows.find(x=>x.key===k)||null;return [k,{species:!!G.petModels.SPECIES[k],kind:G.petModels.SPECIES[k]&&G.petModels.SPECIES[k].kind,art:G.petArt.has(k),svgLen:G.petArt.svg(k,64).length,row:r&&{name:r.name,rar:r.rar,src:r.src,season:r.season||null,note:r.note,wings:!!r.wings,emoji:r.emoji}}];}));},ALL);
 const paw=await page.evaluate(()=>window.__features.petArt.svg('nosuchpet',64).length);
 /* built like every other pet (the rules tools/qa-pets.cjs holds the fifteen to): four legs or two, two wings for a
    flyer, at most 30 meshes and 3 shadow casters, every painted marking reaching the surface */
 const mod=await page.evaluate(keys=>{const G=window.__features,SP=G.petModels.SPECIES,out={};
  for(const k of keys){const P=G.pets.make(k),S=SP[k];let meshes=0,shadow=0;P.group.traverse(o=>{if(o.isMesh){meshes++;if(o.castShadow)shadow++;}});
   const weak=[];const cov=(geo,prims,tag)=>{if(!geo||!prims)return;const pos=geo.attributes.position;for(const q of prims){if(!q[8])continue;const [x0,y0,z0,r,sx,sy,sz]=[q[0],q[1],q[2],q[3],q[4]||1,q[5]||1,q[6]||1];let n09=0,n15=0;
     for(let i=0;i<pos.count;i++){const dx=(pos.getX(i)-x0)/sx,dy=(pos.getY(i)-y0)/sy,dz=(pos.getZ(i)-z0)/sz,d=Math.sqrt(dx*dx+dy*dy+dz*dz)/r;if(d<0.8)n09++;if(d<1.25)n15++;}
     const c=n15?n09/n15:0;if(n09<3||c<0.1)weak.push([tag,q[7],n09,+c.toFixed(2)]);}};
   cov(P.body.geometry,S.body,'body');const hm=P.headGroup.children.find(o=>o.isMesh&&o.geometry.attributes.position.count>500);if(hm&&S.head&&S.head.prims)cov(hm.geometry,S.head.prims,'head');
   out[k]={kind:S.kind,legs:P.legs.length,wings:(P.wings||[]).length,meshes,shadow,weak};}
  return out;},ALL);
 for(const k of ALL){const m=mod[k];check(k+': drawn body built like every pet (legs '+(m.kind==='bird'?2:4)+', '+(FLY.includes(k)?'two wings':'no wings')+', at most 30 meshes and 3 shadow casters, every painted marking on the surface)',m.legs===(m.kind==='bird'?2:4)&&m.wings===(FLY.includes(k)?2:0)&&m.meshes<=30&&m.shadow<=3&&m.weak.length===0,m);}
 const pass=await page.evaluate(()=>{const T=window.__features.tables;return {free25:T.PASS_FREE[24]&&T.PASS_FREE[24].pet||null};});
 check('the Gryphling is a Trail Pass reward (free track, tier 25)',pass.free25==='gryphling',pass);
 for(const k of ALL){const d=data[k];check(k+': species sheet, own portrait and PETS3 row (name, rarity, source, note'+(FLY.includes(k)?', wings':'')+')',d.species&&d.art&&d.svgLen!==paw&&d.row&&d.row.name&&d.row.rar&&d.row.src&&d.row.note&&(!FLY.includes(k)||d.row.wings)&&!/[\u{1F300}-\u{1FAFF}]/u.test(d.row.name+d.row.note+(d.row.emoji||'')),d);}
 const pre=await page.evaluate(async()=>{const G=window.__features;G.save.sync(s=>{s.petList=(s.petList||[]).filter(k=>k!=='cinderchick');});G.hidePanels();G.ui.openShop('pets');await new Promise(r=>setTimeout(r,300));
  const r=document.querySelector('#shopPanel [data-pet-row="cinderchick"]');let season=null;try{season=G.time.seasonNow().def.id;}catch(e){}const out={season,text:r?r.textContent.replace(/\s+/g,' ').trim().slice(0,200):'',call:!!(r&&r.querySelector('[data-fx="shop:summon"]'))};G.hidePanels();return out;});
 check('the Cinder Chick answers the pet call only in the Ember season (marked as an Ember season call out of it)',pre.season==='ember'?pre.call:(!pre.call&&/Ember season call only/.test(pre.text)),pre);
 await page.evaluate(keys=>{const G=window.__features;G.save.sync(s=>{s.petList=s.petList||[];for(const k of keys)if(!s.petList.includes(k))s.petList.push(k);});},ALL);
 const per={};
 for(const k of ONLY){
  stage('follow '+k);
  await page.evaluate(([k,H])=>{const Q=window.__QF,G=Q.G;G.hidePanels();window.__qcam=null;if(G.horse.ridden().breed!==Q.home)Q.ride(Q.home);Q.reset(H.x,H.z,H.h);G.pets.setActive(k);Q.run([],600,300,'settle');},[k,HOME]);
  const rs=await waitReal(page,k);
  const r=await page.evaluate(([k,H])=>{const Q=window.__QF,G=Q.G;Q.reset(H.x,H.z,H.h);const stand=Q.run([],5000,500,'stand');return {active:G.pets.active(),stand};},[k,HOME]);r.realState=rs;
  const st=r.stand,last=st[st.length-1];
  if(REAL.includes(k)){
   check(k+': follows you as its real animal (model loaded, drawn body hidden)',r.active===k&&last.key===k&&last.inScene&&last.real==='ready'&&last.shown===true,{active:r.active,real:last.real,shown:last.shown});
   const hs=st.filter(o=>o.lowest!=null&&o.spd<0.3&&o.air==='ground'&&!(o.skim>0.02));   // once it has settled beside you
   check(k+': standing on the grass (lowest point within 4 cm of the ground, never below it by more than 2 cm)',hs.length&&hs.every(o=>o.lowest>-0.02&&o.lowest<0.04),hs.map(o=>o.lowest));
   check(k+': standing plays a real clip (idle or sit), not a bind pose',hs.length&&hs.slice(-4).every(o=>['idle','sit','eat','lie'].includes(o.clip)),hs.slice(-4).map(o=>o.clip));
  }else{
   check(k+': follows you as its drawn animal, with its effects',r.active===k&&last.key===k&&last.inScene&&last.drawn&&last.fx&&last.fx.length>=(k==='cinderchick'?3:1),{active:r.active,fx:last.fx});
  }
  await page.evaluate(()=>{window.advanceTime(200);});
  shots.push(await shot(page,k+'-riding-standing'));
  await page.evaluate(()=>{window.__QF.close();window.advanceTime(50);});
  shots.push(await shot(page,k+'-close-standing'));
  /* a walk, then a gallop */
  const mv=await page.evaluate(([k,H])=>{const Q=window.__QF,G=Q.G;window.__qcam=null;Q.reset(H.x,H.z,H.h);Q.run([],1500,500,'pre');
   const walk=Q.run(['KeyW'],4000,250,'walk');const gal=Q.run(['KeyW','ShiftLeft'],5000,250,'gallop');return {walk,gal};},[k,HOME]);
  shots.push(await shot(page,k+'-riding-running'));
  await page.evaluate(()=>{const Q=window.__QF;Q.key('KeyW',true);Q.key('ShiftLeft',true);window.advanceTime(300);Q.close();window.advanceTime(34);});
  shots.push(await shot(page,k+'-close-running'));
  await page.evaluate(()=>{const Q=window.__QF;Q.key('KeyW',false);Q.key('ShiftLeft',false);window.__qcam=null;window.advanceTime(2000);});
  const moving=mv.walk.slice(4).concat(mv.gal.slice(4));
  if(REAL.includes(k)){
   const g=moving.filter(o=>o.lowest!=null&&o.air==='ground'&&!(o.skim>0.02));   // on its feet (not lifting into a low flight)
   const air=k==='mossfawn'?0.3:0.05;   // the fawn bounds: a moment in the air in every stride of its run
   check(k+': feet on the grass while it moves on foot (never below the ground by more than 3 cm, touching down in most samples'+(air>0.05?', airborne only in the bound':'')+')',g.length===0?moving.every(o=>o.skim>0.08||o.air!=='ground'):(g.every(o=>o.lowest>-0.03&&o.lowest<air)&&g.filter(o=>o.lowest<0.04).length>=g.length*(air>0.05?0.2:0.4)),{n:g.length,lows:g.map(o=>o.lowest)});
   const f=moving.filter(o=>o.face!=null&&o.spd>0.5);
   check(k+': faces the way it goes (head in front of the tail)',f.length&&f.every(o=>o.face>0),f.map(o=>o.face).slice(0,12));
   const cl=moving.filter(o=>o.clip);
   check(k+': moving plays its own gait clips (walk, trot, run, or fly when it flutters)',cl.length&&cl.every(o=>['walk','trot','run','fly','glide','idle','swim'].includes(o.clip))&&cl.some(o=>['walk','trot','run','fly'].includes(o.clip)),[...new Set(cl.map(o=>o.clip))]);
   const sl=moving.map(o=>o.slip).filter(s=>s&&s.slip!=null);
   const bad=sl.filter(s=>s.slip>(s.spd>12?0.2:0.05));
   check(k+': the legs keep up with the ground on foot (the cadence the speed needs, up to 12 m/s; at a flat-out gallop above that, within 20%)',bad.length===0,{onFoot:sl.length,air:moving.filter(o=>o.slip&&o.slip.air).length,worst:sl.sort((a,b)=>b.slip-a.slip).slice(0,3)});
   const d=last.dims;const want={emberling:0.7,mossfawn:0.72,wyvern:0.55}[k];
   check(k+': the right size (height within 10% of '+want+' m)',d&&Math.abs(d.h-want)/want<0.1,d);
   if(k==='emberling'||k==='wyvern')check(k+': flutters low beside you on its Fly clip when its legs cannot keep up',moving.some(o=>o.skim>0.1&&o.clip==='fly'),moving.map(o=>[o.spd,o.skim,o.clip]).slice(-6));
  }else{
   check(k+': keeps up beside you through a walk and a gallop',moving.slice(-4).every(o=>o.dist<6),moving.slice(-4).map(o=>o.dist));
  }
  per[k]={stand:last,moving:moving.slice(-3)};
 }
 /* ---- 3. flight on a pegasus ---- */
 for(const k of FLY.filter(k=>ONLY.includes(k))){
  stage('flight '+k);
  await page.evaluate(([k,H])=>{const Q=window.__QF,G=Q.G;G.hidePanels();window.__qcam=null;if(!G.horse.ridden().wings)Q.ride('pegasus');Q.reset(H.x,H.z,H.h);if(G.pets.active()!==k)G.pets.setActive(k);Q.run([],600,300,'settle');},[k,HOME]);
  await waitReal(page,k);
  const F=await page.evaluate(([k,H])=>{const Q=window.__QF,G=Q.G,p=Q.p;Q.reset(H.x,H.z,H.h);Q.run([],3000,1000,'stand');
   const S=[];const fs=(keys,ms,tag)=>{const r=Q.run(keys,ms,250,tag);for(const o of r){o.flying=!!p.flying;o.py=+(p.y||0).toFixed(2);S.push(o);}};
   fs(['KeyW','Space'],750,'takeoff');fs(['KeyW'],2000,'cruise');fs(['KeyW','Space'],250,'climb');fs(['KeyW'],2500,'cruise');fs(['KeyW','KeyA'],2000,'turn');
   const air=S.filter(o=>o.flying&&o.tag!=='takeoff');
   return {horse:G.horse.ridden().breed,airN:air.length,flyFrac:+(air.filter(o=>o.air==='fly').length/Math.max(1,air.length)).toFixed(2),near:+(air.filter(o=>o.d3<=6).length/Math.max(1,air.length)).toFixed(2),clips:[...new Set(air.map(o=>o.clip).filter(Boolean))],topY:Math.max(...S.map(o=>o.py))};},[k,HOME]);
  shots.push(await shot(page,k+'-flying'));
  const L=await page.evaluate(()=>{const Q=window.__QF,G=Q.G,p=Q.p;const b=document.getElementById('flyBtn');if(b)b.click();let out=null;for(let i=0;i<32;i++){window.advanceTime(250);const o=Q.sample('land');o.flying=!!p.flying;out=o;}return {flying:out.flying,air:out.air,alt:out.alt,dist:out.dist};});
  check(k+': takes off and flies beside you on a pegasus'+(REAL.includes(k)?' with its own Fly clip':''),F.airN>4&&F.flyFrac>0.6&&F.near>0.8&&(!REAL.includes(k)||F.clips.includes('fly')),F);
  check(k+': down beside the horse after landing',!L.flying&&L.air==='ground'&&L.alt<0.2&&L.dist<6,L);
  await page.evaluate(()=>{const Q=window.__QF;Q.ride(Q.home);});
 }
 /* ---- 4. menus ---- */
 stage('menus');
 const menus=await page.evaluate(async keys=>{const G=window.__features,out={};
  G.hidePanels();G.ui.openStable();await new Promise(r=>setTimeout(r,300));
  const sp=document.getElementById('stablePanel');out.stable=Object.fromEntries(keys.map(k=>{const b=sp&&sp.querySelector('[data-pet="'+k+'"]');const row=b&&b.closest('.evrow');return [k,!!(row&&row.querySelector('svg'))];}));
  G.hidePanels();G.ui.openShop('pets');await new Promise(r=>setTimeout(r,300));
  const mp=document.getElementById('shopPanel');out.market=Object.fromEntries(keys.map(k=>{const r=mp&&mp.querySelector('[data-pet-row="'+k+'"]');return [k,{row:!!r,svg:!!(r&&r.querySelector('svg.pet-svg')),text:r?r.textContent.replace(/\s+/g,' ').trim().slice(0,160):''}];}));
  let season=null;try{season=G.time.seasonNow().def.id;}catch(e){}out.season=season;
  G.hidePanels();return out;},ALL);
 check('the stable lists each new pet with its portrait',ALL.every(k=>menus.stable[k]),menus.stable);
 check('the market Pets tab lists each new pet with its portrait',ALL.every(k=>menus.market[k].row&&menus.market[k].svg),menus.market);
 check('no page errors',errors.length===0,errors.slice(0,6));
 console.log('SHOTS '+JSON.stringify(shots.filter(Boolean)));
 const fails=checks.filter(c=>!c.ok).length;console.log('RESULT '+(checks.length-fails)+'/'+checks.length+' passed');
 await browser.close();process.exit(fails?1:0);
})().catch(async e=>{console.error(e);try{await browser.close();}catch(x){}process.exit(2);});
