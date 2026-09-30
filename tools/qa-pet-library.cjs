/* Realistic pets, end to end, with the test fixtures (tools/fixtures/pets, made by make-fixtures.mjs: no
   download) listed in tools/fixtures/pets/manifest.test.json. The shipped list
   (assets/models/pets/manifest.json) lists the fox family (the Animated Fox, a resting body) and the dog,
   corgi, cat, piglet and goat (rigged models walked by the bone gait, section 8b), with others; the
   fixtures prove the whole path (assets/pet-library.js and its part of assets/features/pet-models.js)
   for the models still to come, and section 9 proves the shipped fox, fennec and glimmer fox.

   What it proves, in the real game at 1280x800:
     1. make() stays synchronous and drawn for all fifteen pets, and fetches nothing;
     2. the fixture fox loads (fitted to the fox's 0.52 m, turned from +X to face +Z, lifted off its
        floating floor onto the grass, root motion taken out), replaces the drawn body in the same group
        (the drawn one hidden, the contact shadow kept), and animates: bone transforms change over time;
     3. the clips follow the pet's speed: idle standing, walk as it sets off, run at a gallop; the gait
        clips share one stride phase; the model stays over its own origin (no root-motion drift);
     4. the pair glow and the rim reach the real materials; the glimmer fox is the fox model recoloured,
        from the same file loaded once;
     5. the fixture owl takes off with its take-off clip, flies beside a pegasus with its fly clip (the
        wings flapping), glides on the held fly clip (it has no glide clip), and lands back to idle;
     6. fallbacks: a broken file (dog), a pet listed as not available yet (cat, never fetched), a flyer
        with no fly clip (duck), debugFail: each keeps its drawn pet, with a warning and no error; the
        bunny with no hop clip hops with its walk clip and the drawn hop's arc;
     7. rebuilding a real pet does not leak geometry or textures; moving it stays cheap;
     8. portraits still draw; the shipped manifest lists the fox family and the bone-walked five, and a pet it
        does not list stays drawn; 8b. the bone-walked dog, corgi, cat, piglet and goat: stand, walk, trot and
        gallop by their bones, planted feet that do not slip, the pet's size, facing forward, feet on the grass;
     9. the shipped fox family (one fox.glb): galloping, the drawn pet runs and the sitting fox is hidden;
        stopped, the real fox sits in and plays its idle without moving over the ground, at its size, paws on
        the grass; it dissolves out as the pet moves off; the fennec's grown ears and coat, the glimmer
        fox's pale blue glow and halo;
    10. no page errors.
   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-pet-library.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now(),stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const errors=[],warns=[],requests=[];
const HOME={x:-100,z:400,h:Math.PI};
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,4).join(' | ')));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));if(m.type()==='warning'&&/pet models/.test(m.text()))warns.push(m.text().slice(0,200));});
 page.on('request',r=>{const u=r.url();if(/models\/pets\/|fixtures\/pets\/|pet-library/.test(u))requests.push(u.replace(/^https?:\/\/[^/]+\//,''));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('boot');
 await page.goto(QA.BASE+'/ranch3d.html?qa=petlib&petManifest=tools/fixtures/pets/manifest.test.json&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1200);
 stage('booted');
 await page.evaluate(()=>{
  const G=window.__features,p=G.horse.player;
  const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&G.wardrobe)G.wardrobe.closeChar();
  const key=(k,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:k,key:k,bubbles:true}));
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const ride=b=>{G.save.sync(s=>{let h=s.horses.find(x=>x.breed===b);if(!h){h=G.horse.grantHorse(s,b,{name:'QA '+b,bond:60});}s.horses.splice(s.horses.indexOf(h),1);s.horses.unshift(h);});G.horse.reloadHorses();const sel=document.getElementById('horseSel');sel.value='0';sel.onchange();};
  const comp=()=>G.pets.comp(),real=()=>G.petModels.real(comp());
  const T=G.THREE,_v=new T.Vector3();
  /* the real body's box in the pet's own frame (its skinned vertices, as posed now) */
  const box=()=>{const c=comp(),R=c.parts.real;if(!R||!R.inst)return null;const g=c.parts.group;g.updateMatrixWorld(true);const inv=new T.Matrix4().copy(g.matrixWorld).invert(),b=new T.Box3();
   R.inst.root.traverse(o=>{if(o.isSkinnedMesh){const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i+=3){o.getVertexPosition(i,_v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);b.expandByPoint(_v);}}});return b;};
  const boneSig=()=>{const c=comp(),R=c.parts.real;if(!R||!R.inst)return '';let s='';R.inst.model.traverse(o=>{if(o.isBone)s+=o.quaternion.toArray().map(v=>v.toFixed(3)).join(',')+o.position.toArray().map(v=>v.toFixed(3)).join(',')+';';});return s;};
  const local=(o)=>{const c=comp(),g=c.parts.group;g.updateMatrixWorld(true);return o.getWorldPosition(new T.Vector3()).applyMatrix4(new T.Matrix4().copy(g.matrixWorld).invert());};
  window.__PL={G,p,key,reset,ride,comp,real,box,boneSig,local};
 });
 /* wait (in game time and real time) until the pet's real body is settled */
 const settle=async(ms=8000)=>{let s=null;for(let i=0;i<ms/100;i++){s=await page.evaluate(()=>{window.advanceTime(100);return window.__PL.real();});if(s.state==='ready'||s.state==='failed'||s.state==='none')break;await page.waitForTimeout(40);}return s;};
 const activate=async k=>{await page.evaluate(([k,H])=>{const Q=window.__PL,G=Q.G;G.hidePanels();G.save.sync(s=>{s.petList=Array.from(new Set([...(s.petList||[]),k]));});Q.reset(H.x,H.z,H.h);if(G.pets.active()!==k)G.pets.setActive(k);else G.pets.rebuild();window.advanceTime(50);},[k,HOME]);return settle();};

 /* ---- 1. make() stays drawn and synchronous -------------------------------------------------------- */
 const M=await page.evaluate(()=>{const G=window.__features,out={handles:!!(G.petModels.real&&G.petModels.loadReal&&G.petModels.useManifest&&'debugFail' in G.petModels),installed:G.installed.includes('pet-models')};
  out.made=G.pets.PETS3.map(r=>{const P=G.pets.make(r.key);return {k:r.key,drawn:!!(P.body&&P.bodyPivot.visible),real:P.real===undefined};});return out;});
 await page.waitForTimeout(300);
 const glbAfterMake=requests.filter(u=>/\.glb/.test(u));
 check('pet-models installed with the real-body handles (real, loadReal, useManifest, debugFail)',M.installed&&M.handles,M);
 check('make() builds all fifteen (or more) drawn pets synchronously and fetches no model',M.made.length>=15&&M.made.every(m=>m.drawn&&m.real)&&glbAfterMake.length===0,{glb:glbAfterMake});

 /* ---- 2. the fixture fox --------------------------------------------------------------------------- */
 stage('fox');
 const L=await page.evaluate(()=>window.__PL.G.petModels.loadReal('fox'));
 check('the fixture fox loads: fitted to 0.52 m, clips mapped (idle, walk, run, and "Armature|Sit" as sit)',L&&Math.abs(L.dims.h-0.52)<0.012&&L.clips.idle==='Idle'&&L.clips.walk==='Walk'&&L.clips.run==='Run'&&L.clips.sit==='Sit'&&L.stats.joints===19,L);
 const s1=await activate('fox');
 const F=await page.evaluate(()=>{const Q=window.__PL,c=Q.comp(),P=c.parts,R=P.real,I=R&&R.inst;if(!I)return {state:R&&R.state,err:R&&R.err};
  const b=Q.box(),gy=Q.G.world.groundH(c.pos.x,c.pos.z);let skinned=0,visible=true;I.root.traverse(o=>{if(o.isSkinnedMesh)skinned++;});for(let e=I.root;e;e=e.parent)if(!e.visible)visible=false;
  const head=Q.local(I.bones.head),hips=Q.local(I.model.getObjectByName('Hips'));
  const txt=JSON.parse(render_game_to_text()).pet;
  return {state:R.state,inGroup:I.root.parent===P.group,drawnHidden:!P.bodyPivot.visible,shadow:!!(P.shadow&&P.shadow.parent===P.group&&P.shadow.visible),visible,skinned,
   h:+(b.max.y-b.min.y).toFixed(3),minY:+b.min.y.toFixed(3),len:+(b.max.z-b.min.z).toFixed(3),headZ:+head.z.toFixed(3),hipsZ:+hips.z.toFixed(3),specReal:!!P.spec.real,specLen:P.spec.len,txt:{real:txt.real,clip:txt.clip},info:I.info()};});
 check('the real fox replaces the drawn body in the same group (drawn body hidden, contact shadow kept, state in render_game_to_text)',s1.state==='ready'&&F.inGroup&&F.drawnHidden&&F.shadow&&F.visible&&F.skinned===1&&F.specReal&&F.txt.real==='ready',F);
 check('it stands the fox\'s height (within 8% of 0.52 m), faces +Z (head ahead of hips) and its feet are on the grass (-1..+3 cm)',Math.abs(F.h-0.52)/0.52<0.08&&F.headZ>F.hipsZ+0.1&&F.minY>-0.01&&F.minY<0.03,{h:F.h,minY:F.minY,headZ:F.headZ,hipsZ:F.hipsZ,yaw:F.info&&F.info.yaw});
 const A=await page.evaluate(()=>{const Q=window.__PL;for(let i=0;i<80&&Q.real().clip!=='idle';i++)window.advanceTime(100);const a=Q.boneSig();window.advanceTime(400);const b=Q.boneSig();window.advanceTime(400);const c=Q.boneSig();return {changed:a!==b&&b!==c,len:a.length,state:Q.real().clip};});
 check('it animates: bone transforms change over time (idle)',A.changed&&A.len>100&&A.state==='idle',A);

 /* ---- 3. speed drives the clips ------------------------------------------------------------------------ */
 const S=await page.evaluate(([H])=>{const Q=window.__PL,G=Q.G,p=Q.p;Q.reset(H.x,H.z,H.h);for(let i=0;i<30;i++)window.advanceTime(100);
  const out=[];const rootB=Q.comp().parts.real.inst.model.getObjectByName('Root'),r0=Q.local(rootB);let drift=0;
  const sample=tag=>{const c=Q.comp(),r=Q.real(),I=c.parts.real.inst,w=I.weights,d=I.dur.bind(I);const lp=Q.local(rootB);drift=Math.max(drift,Math.hypot(lp.x-r0.x,lp.z-r0.z));
   const ph=['walk','run'].filter(s=>w[s]>0.05).map(s=>+(I.actions[s].time/d(s)).toFixed(3));
   out.push({tag,spd:+(c.st.spd||0).toFixed(2),clip:r.clip,w:Object.fromEntries(Object.entries(w).filter(([,v])=>v>0.02).map(([k,v])=>[k,+v.toFixed(2)])),ph});};
  sample('still');
  Q.key('KeyW',true);for(let i=0;i<40;i++){window.advanceTime(100);sample('walk');}
  Q.key('ShiftLeft',true);for(let i=0;i<40;i++){window.advanceTime(100);sample('gallop');}
  Q.key('ShiftLeft',false);Q.key('KeyW',false);for(let i=0;i<60;i++){window.advanceTime(100);sample('stop');}
  return {out,drift:+drift.toFixed(3)};},[HOME]);
 const seq=S.out.map(o=>o.clip),iW=seq.indexOf('walk'),iR=seq.indexOf('run'),last=S.out[S.out.length-1];
 const both=S.out.filter(o=>o.ph.length===2),sync=both.every(o=>Math.abs(o.ph[0]-o.ph[1])<0.02||Math.abs(Math.abs(o.ph[0]-o.ph[1])-1)<0.02);
 check('the clips follow the pet\'s speed: resting standing (idle, or its sit clip when it picks the sit idle), walk as it sets off, run at a gallop, resting again after stopping',(seq[0]==='idle'||seq[0]==='sit')&&iW>0&&iR>iW&&S.out.some(o=>o.tag==='gallop'&&o.clip==='run'&&o.spd>6)&&(last.clip==='idle'||last.clip==='sit'),{first:S.out[0],walk:S.out[iW],run:S.out[iR],last,maxSpd:Math.max(...S.out.map(o=>o.spd))});
 check('blended gait clips share one stride phase (no scissoring), and the model does not drift off its origin (root motion stripped)',sync&&S.drift<0.12,{blendedFrames:both.length,sample:both.slice(0,3),off:both.filter(o=>!(Math.abs(o.ph[0]-o.ph[1])<0.02||Math.abs(Math.abs(o.ph[0]-o.ph[1])-1)<0.02)).slice(0,4),drift:S.drift});

 /* ---- 4. glow, rim, the glimmer fox ---------------------------------------------------------------------- */
 const Gw=await page.evaluate(()=>{const Q=window.__PL,I=Q.comp().parts.real.inst;return {mats:I.materials.length,glow:I.materials.every(m=>m.userData.petGlow),sheen:I.materials.some(m=>m.isMeshPhysicalMaterial&&m.sheen>0.3)};});
 check('the real materials carry the pet rim and the market\'s pair glow (and the manifest\'s sheen)',Gw.mats>0&&Gw.glow&&Gw.sheen,Gw);
 const s2=await activate('glimmerfox');
 const GF=await page.evaluate(()=>{const Q=window.__PL,P=Q.comp().parts,I=P.real&&P.real.inst;if(!I)return {state:P.real&&P.real.state};const m=I.materials[0];Q.G.renderer.render(Q.G.scene,Q.G.camera);return {state:P.real.state,key:m.customProgramCacheKey(),emissive:m.emissive&&m.emissive.getHexString(),halo:!!(P.extra.halo&&P.extra.halo.parent===P.group),h:I.dims.h};});
 const quadFetches=requests.filter(u=>/fixture-quad\.glb/.test(u));
 check('the glimmer fox is the fox model recoloured (tint and glow in its own material, halo kept, 8% larger), from the same file fetched once',s2.state==='ready'&&/tint/.test(GF.key)&&/petRealRim/.test(GF.key)&&GF.emissive==='8fe8ff'&&GF.halo&&Math.abs(GF.h-0.5616)<0.015&&quadFetches.length===1,{GF,quadFetches});

 /* ---- 5. the owl flies with a pegasus ------------------------------------------------------------------------ */
 stage('owl');
 await page.evaluate(()=>{const Q=window.__PL;Q.G.hidePanels();if(!Q.G.horse.ridden().wings)Q.ride('pegasus');});
 await page.waitForFunction(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}},null,{timeout:120000,polling:250});
 const s3=await activate('owl');
 const O=await page.evaluate(([H])=>{const Q=window.__PL,G=Q.G,p=Q.p;const out={horse:G.horse.ridden().breed,wings:!!G.horse.ridden().wings};Q.reset(H.x,H.z,H.h);for(let i=0;i<100&&!(i>=20&&Q.real().clip==='idle');i++)window.advanceTime(100);   // standing beside the horse, not still skimming in
  const wingQ=()=>{const b=Q.comp().parts.real.inst.model.getObjectByName('WingL1');return b?b.quaternion.toArray().map(v=>+v.toFixed(3)).join(','):'';};
  const S=[];const run=(keys,n,tag)=>{for(const k of keys)Q.key(k,true);for(let i=0;i<n;i++){window.advanceTime(100);const c=Q.comp(),g=c.parts.group,ry=G.world.groundH(p.pos.x,p.pos.z)+(p.y||0);S.push({tag,air:c.st.air,clip:Q.real().clip,wing:wingQ(),alt:+(c.alt||0).toFixed(2),flying:!!p.flying,d3:+Math.hypot(g.position.x-p.pos.x,g.position.y-(ry+1),g.position.z-p.pos.z).toFixed(2)});}for(const k of keys)Q.key(k,false);};
  run([],5,'stand');run(['KeyW','Space'],8,'takeoff');run(['KeyW'],25,'cruise');run(['KeyW','Space'],3,'climb');run(['KeyW'],40,'cruise2');
  const fb=document.getElementById('flyBtn');if(fb&&p.flying)fb.click();run([],50,'land');
  out.S=S;return out;},[HOME]);
 const air=O.S.filter(o=>o.flying&&o.air!=='takeoff'&&o.air!=='landing');
 const clipsSeen=[...new Set(O.S.map(o=>o.clip))];
 const flapping=new Set(O.S.filter(o=>o.clip==='fly').map(o=>o.wing)).size;
 check('the fixture owl is ready beside a pegasus, standing with its idle clip',s3.state==='ready'&&O.wings&&O.S[0].clip==='idle',{s3,horse:O.horse,first:O.S[0]});
 check('it takes off with its take-off clip and flies with its fly clip, the wings flapping (bone rotations change through the flight)',O.S.some(o=>o.clip==='takeoff')&&air.filter(o=>o.clip==='fly'||o.clip==='glide').length>=air.length*0.9&&flapping>=5&&air.length>=30,{clipsSeen,flapping,airN:air.length});
 check('it glides on its held fly clip (no glide clip of its own) and stays near the rider in the air (within 6 m on 90% of frames)',O.S.some(o=>o.clip==='glide')&&air.filter(o=>o.d3<=6).length>=air.length*0.9,{glides:O.S.filter(o=>o.clip==='glide').length,maxD3:Math.max(...air.map(o=>o.d3))});
 const lastO=O.S[O.S.length-1];
 check('it lands and is back on the ground with its idle or walk clip',lastO.air==='ground'&&(lastO.clip==='idle'||lastO.clip==='walk'),lastO);

 /* ---- 6. fallbacks ------------------------------------------------------------------------------------------- */
 stage('fallbacks');
 const drawn=()=>page.evaluate(()=>{const P=window.__PL.comp().parts;let skinned=0;P.group.traverse(o=>{if(o.isSkinnedMesh)skinned++;});return {bodyVisible:P.bodyPivot.visible,skinned,real:window.__PL.real()};});
 const sD=await activate('dog');await page.evaluate(()=>{for(let i=0;i<10;i++)window.advanceTime(100);});const dD=await drawn();
 check('a broken model file (dog) keeps the drawn dog, with a warning and no error',sD.state==='failed'&&dD.bodyVisible&&dD.skinned===0&&warns.some(w=>/dog/.test(w)),{sD,dD});
 const sC=await activate('cat');const dC=await drawn();
 check('a pet listed as not available yet (cat) stays drawn and its file is never fetched',sC.state==='none'&&dC.bodyVisible&&!requests.some(u=>/not-downloaded-yet/.test(u)),{sC});
 const sK=await activate('duck');const dK=await drawn();
 check('a flying pet whose model has no fly clip (duck) stays drawn',sK.state==='failed'&&/fly clip/.test(sK.err||'')&&dK.bodyVisible,{sK});
 await page.evaluate(()=>{window.__PL.G.petModels.debugFail='fox';});const sF=await activate('fox');const dF=await drawn();await page.evaluate(()=>{window.__PL.G.petModels.debugFail=null;});
 check('debugFail keeps the drawn fox',sF.state==='failed'&&dF.bodyVisible,{sF});
 const sB=await activate('bunny');
 const B=await page.evaluate(([H])=>{const Q=window.__PL,p=Q.p;Q.reset(H.x,H.z,H.h);for(let i=0;i<20;i++)window.advanceTime(100);const out=[];Q.key('KeyW',true);
  for(let i=0;i<40;i++){window.advanceTime(50);const c=Q.comp(),I=c.parts.real.inst;out.push({clip:Q.real().clip,air:+(c.parts.group.position.y-Q.G.world.groundH(c.pos.x,c.pos.z)).toFixed(3),hopAir:c.st.hopAir,ph:+(I.actions.walk.time/I.dur('walk')).toFixed(3),st:+(((c.st.ph%1)+1)%1).toFixed(3)});}Q.key('KeyW',false);return out;},[HOME]);
 const hopping=B.slice(8).filter(o=>o.hopAir>=0);   // after the first 0.4 s: the cross-fade from idle has finished
 check('the bunny with no hop clip hops with its walk clip in step with the game\'s hop, and keeps the drawn hop\'s arc',sB.state==='ready'&&hopping.length>10&&hopping.every(o=>o.clip==='walk'&&Math.min(Math.abs(o.ph-o.st),1-Math.abs(o.ph-o.st))<0.02)&&Math.max(...hopping.map(o=>o.air))>0.04,{sB,sample:hopping.slice(0,4),maxAir:Math.max(...hopping.map(o=>o.air))});

 /* ---- 7. rebuilds and cost ------------------------------------------------------------------------------------- */
 stage('cost');
 await activate('fox');
 const Mem=await page.evaluate(async()=>{const Q=window.__PL,G=Q.G,R=G.renderer;
  for(let i=0;i<2;i++){G.pets.rebuild();for(let k=0;k<30;k++){window.advanceTime(100);R.render(G.scene,G.camera);await new Promise(r=>setTimeout(r,20));if(Q.real().state==='ready')break;}}   // a warm-up: the drawn fox's shared shapes upload once, the first time it shows while the model is set up
  {const D=G.pets.make('fox'),pp=Q.p;D.group.position.set(pp.pos.x+1.5,G.world.groundH(pp.pos.x+1.5,pp.pos.z)||0,pp.pos.z);G.scene.add(D.group);D.group.traverse(o=>{o.frustumCulled=false;});R.render(G.scene,G.camera);G.scene.remove(D.group);}   // and a drawn fox rendered once for sure (a cached model can swap in before the drawn one is ever drawn)
  R.render(G.scene,G.camera);const m0={g:R.info.memory.geometries,t:R.info.memory.textures};
  for(let i=0;i<6;i++){G.pets.rebuild();for(let k=0;k<3;k++){window.advanceTime(100);R.render(G.scene,G.camera);await new Promise(r=>setTimeout(r,30));}}
  for(let k=0;k<30&&Q.real().state!=='ready';k++){window.advanceTime(100);await new Promise(r=>setTimeout(r,30));}
  R.render(G.scene,G.camera);return {before:m0,after:{g:R.info.memory.geometries,t:R.info.memory.textures},state:Q.real().state};});
 check('six rebuilds of the real fox leak no geometry or textures (shared, cached; skeletons and materials freed)',Mem.state==='ready'&&Mem.after.g-Mem.before.g<=2&&Mem.after.t-Mem.before.t<=1,Mem);
 const cost=await page.evaluate(([H])=>{const Q=window.__PL,G=Q.G,M2=G.petModels,om=M2.move,ts=[];M2.move=function(c,dt,t){const a=performance.now();const r=om(c,dt,t);ts.push(performance.now()-a);return r;};
  try{Q.reset(H.x,H.z,H.h);for(let i=0;i<60;i++)window.advanceTime(50);Q.key('KeyW',true);Q.key('ShiftLeft',true);for(let i=0;i<60;i++)window.advanceTime(50);Q.key('KeyW',false);Q.key('ShiftLeft',false);for(let i=0;i<60;i++)window.advanceTime(50);}finally{M2.move=om;}
  ts.sort((a,b)=>a-b);return {frames:ts.length,median:+ts[ts.length>>1].toFixed(3),p99:+ts[Math.floor(ts.length*0.99)].toFixed(3)};},[HOME]);
 check('moving a real pet (mixer, blend, head look) stays cheap: median under 0.8 ms, p99 under 3 ms',cost.frames>100&&cost.median<0.8&&cost.p99<3,cost);

 /* ---- 8. portraits, and the shipped manifest ---------------------------------------------------------------------- */
 const Pt=await page.evaluate(()=>{const G=window.__features;return G.pets.PETS3.map(r=>G.petArt.svg(r.key,56)).every(s=>/^<svg[^>]*width="56"/.test(s)&&s.length>400);});
 check('the drawn portraits still draw for every pet',Pt);
 const before=requests.length;
 const Sh=await page.evaluate(async()=>{const G=window.__features,keys=await G.petModels.useManifest(null),list=await G.petModels.realList();return {keys,list};});
 const unlisted=['duck','chick','raccoon','bunny','owl','lamb','snowhare'].find(k=>!Sh.list.includes(k))||'duck';
 const dS0=await activate(unlisted);await page.evaluate(()=>{for(let i=0;i<20;i++)window.advanceTime(100);});const dDog=await drawn();
 check('the shipped manifest lists the fox family and the bone-walked dog, corgi, cat, piglet and goat, and a pet it does not list ('+unlisted+') stays drawn with no model fetched',
  ['fennec','fox','glimmerfox','dog','corgi','cat','piglet','goat'].every(k=>Sh.list.includes(k))&&dS0.state==='none'&&dDog.bodyVisible&&!requests.slice(before).some(u=>/\.glb/.test(u))&&requests.slice(before).some(u=>/assets\/models\/pets\/manifest\.json/.test(u)),{Sh,dS0,after:requests.slice(before)});
 /* ---- 8b. the bone-walked pets (a rigged model with no gait clips, walked by its own bones: pet-library.js
    boneGait): each loads, stands on its idle clip, and walks, trots and gallops with the gait; at a steady
    trot the planted feet stay put (they slip under 3% of the pet's speed), every foot reaches its point,
    the feet are on the grass (not sunk, not floating), the body is the pet's size and faces the way it goes,
    and it is not in its bind pose ---------------------------------------------------------------------- */
 stage('bone-walked pets');
 for(const k of ['dog','corgi','cat','piglet','goat']){
  const sK=await activate(k);
  if(sK.state!=='ready'){check(k+': the bone-walked model loads',false,sK);continue;}
  const r=await page.evaluate((k)=>{const Q=window.__PL,G=Q.G,p=Q.p,c=Q.comp(),R=c.parts.real,I=R.inst,T=G.THREE,S=c.parts.spec,g=c.parts.group,out={};
   const low=()=>{g.updateMatrixWorld(true);const inv=new T.Matrix4().copy(g.matrixWorld).invert(),v=new T.Vector3();let mn=1e9;I.root.traverse(o=>{if(o.isSkinnedMesh){const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i+=7){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);mn=Math.min(mn,v.y);}}});return mn;};
   for(let i=0;i<30;i++)window.advanceTime(100);
   out.info=I.info();out.standLow=+low().toFixed(3);out.h=I.dims.h;out.want=+(S.h*(S.grow||1)).toFixed(3);
   /* the head ahead of the hips in the pet's own frame (+Z forward) */
   const hb=I.bones.head;out.headZ=hb?+Q.local(hb).z.toFixed(3):null;
   /* a steady trot beside the walking horse: W held, measured after it settles */
   /* steady: frames where the pace holds (under 2% change) and the gait is not crossing into the gallop */
   Q.key('KeyW',true);const prev=[null,null,null,null],slip=[];let miss=0,n=0,states={},lows=[],spd=0,last=0;
   for(let t=0;t<5000;t+=16){window.advanceTime(16);const v=c.st.spd,steady=Math.abs(v-last)<0.02*Math.max(0.5,v);last=v;if(t<2500)continue;const f=I.gait?I.gait.feet():[],gi=I.gait?I.gait.info():{};states[I.state]=(states[I.state]||0)+1;if(n%10===0)lows.push(low());
    if(!steady||!(gi.gG<0.05)){prev.fill(null);continue;}spd+=v;n++;
    f.forEach((q,i)=>{if(q.stance&&prev[i])slip.push(Math.hypot(q.world[0]-prev[i][0],q.world[2]-prev[i][2]));prev[i]=q.stance?q.world:null;if(q.stance)miss=Math.max(miss,q.miss);});}
   Q.key('KeyW',false);
   out.trotStates=states;out.spd=+(spd/Math.max(1,n)).toFixed(2);out.slipRel=+(slip.reduce((a,b)=>a+b,0)/Math.max(1,slip.length)/Math.max(0.05,out.spd*0.016)).toFixed(3);out.miss=+miss.toFixed(3);out.lowMin=+Math.min(...lows).toFixed(3);out.lowMax=+Math.max(...lows).toFixed(3);
   /* a gallop */
   Q.key('KeyW',true);Q.key('ShiftLeft',true);const gs={};for(let t=0;t<2500;t+=16){window.advanceTime(16);if(t>1200)gs[I.state]=(gs[I.state]||0)+1;}Q.key('ShiftLeft',false);Q.key('KeyW',false);out.gallopStates=gs;out.gait=I.gait?I.gait.info():null;
   for(let i=0;i<100&&!(i>=30&&I.state==='idle');i++)window.advanceTime(100);out.after=I.state;out.body=c.parts.bodyPivot.visible;
   return out;},k);
  const trotting=Object.keys(r.trotStates).some(s=>s==='trot'||s==='walk'),galloping=(r.gallopStates.run||0)>(r.gallopStates.walk||0);
  check(k+': the real body stands, then walks, trots and gallops with its bone gait (the drawn one hidden)',r.info&&r.info.clips.run==='boneGait'&&trotting&&galloping&&!r.body&&r.after==='idle',{clips:r.info&&r.info.clips,trot:r.trotStates,gallop:r.gallopStates,after:r.after});
  check(k+': at a steady trot the planted feet stay put (slip under 5% of the pace) and every planted foot reaches its point (within 3 cm)',r.slipRel<0.05&&r.miss<0.03,{slipRel:r.slipRel,miss:r.miss,spd:r.spd});
  check(k+': its size is the pet\'s, it faces the way it goes, and its feet are on the grass standing and trotting (not sunk; at most the trot\'s moment of suspension in the air)',Math.abs(r.h-r.want)<0.03&&r.headZ>0.05&&Math.abs(r.standLow)<0.03&&r.lowMin>-0.04&&r.lowMax<0.08,{h:r.h,want:r.want,headZ:r.headZ,standLow:r.standLow,lowMin:r.lowMin,lowMax:r.lowMax});
 }
 /* ---- 9. the shipped fox family: the Animated Fox is a sitting fox with a vertex-cache idle and no bones,
    so it is a resting body: it sits in where the pet settles and dissolves out when it moves off ---------- */
 stage('shipped fox family');
 const foxRest=await page.evaluate(async()=>{const m=await (await fetch('assets/models/pets/manifest.json',{cache:'no-store'})).json();return !!(m.pets&&m.pets.fox&&m.pets.fox.restOnly);});
 if(!foxRest)console.log('NOTE the shipped fox is no longer a resting body (its entry has no "restOnly": it is walked by its own skeleton now), so the resting-fox checks of section 9 are skipped here');
 const fam={};
 if(foxRest){
 for(const k of ['fox','fennec','glimmerfox']){
  const st=await activate(k);
  fam[k]=await page.evaluate(([k,H])=>{const Q=window.__PL,G=Q.G,c=Q.comp(),P=c.parts,R=P.real,I=R&&R.inst,out={state:R&&R.state,err:R&&R.err};if(!I)return out;
   const info=()=>G.petModels.real(Q.comp()).info||{};out.restOnly=I.restOnly;out.morph=info().morphFrames;out.ears=info().ears;out.dims=info().dims;
   const infl=()=>{let m=null;I.model.traverse(o=>{if(!m&&o.morphTargetInfluences&&o.morphTargetInfluences.length)m=o;});return m?Array.from(m.morphTargetInfluences).map(v=>v.toFixed(3)).join(','):'';};
   /* galloping: the drawn pet runs, the real one is hidden */
   Q.reset(H.x,H.z,H.h);Q.key('KeyW',true);Q.key('ShiftLeft',true);const run=[];for(let i=0;i<30;i++){window.advanceTime(100);run.push({spd:+c.st.spd.toFixed(2),shown:I.shown,drawn:P.bodyPivot.visible});}Q.key('KeyW',false);Q.key('ShiftLeft',false);
   out.runHidden=run.slice(10).every(o=>o.shown===0&&o.drawn&&!I.root.visible);out.runSpd=run[run.length-1].spd;
   /* stopped: after it has turned to face you it sits in, and plays its idle where it sat, without moving over the ground */
   let t=0,satAt=null;const seq=[];for(let i=0;i<120&&satAt==null;i++){window.advanceTime(100);t+=0.1;if(I.shown>=1&&!P.bodyPivot.visible)satAt=+t.toFixed(1);}
   out.satAt=satAt;out.clip=G.petModels.real(c).clip;
   const g=P.group,a=[g.position.x,g.position.z],root=I.root.getWorldPosition(new G.THREE.Vector3()),sig=new Set(),pos=[];
   for(let i=0;i<30;i++){window.advanceTime(100);sig.add(infl());const w=I.root.getWorldPosition(new G.THREE.Vector3());pos.push(Math.hypot(w.x-root.x,w.z-root.z));seq.push(I.shown);}
   out.poses=sig.size;out.drift=+Math.max(...pos).toFixed(3);out.stayed=seq.every(v=>v===1);
   out.box=(()=>{const b=new G.THREE.Box3().setFromObject(I.root,true),gy=G.world.groundH(g.position.x,g.position.z);return {bottom:+(b.min.y-g.position.y).toFixed(3),h:+(b.max.y-b.min.y).toFixed(3),gy:+(g.position.y-gy).toFixed(3)};})();
   /* moving off: it dissolves out within a fifth of a second, and the drawn pet runs */
   Q.key('KeyW',true);Q.key('ShiftLeft',true);let gone=null,moved=null,slid=0;for(let i=0;i<80&&gone==null;i++){window.advanceTime(25);if(moved==null&&c.st.spd>0.12)moved=i;if(moved!=null&&I.shown>0){const w=I.root.getWorldPosition(new G.THREE.Vector3());slid=Math.max(slid,Math.hypot(w.x-root.x,w.z-root.z));}if(moved!=null&&I.shown===0&&P.bodyPivot.visible)gone=(i-moved+1)*25;}Q.key('KeyW',false);Q.key('ShiftLeft',false);out.goneMs=gone;out.slidWhileFading=+slid.toFixed(3);
   out.tint=I.materials.some(m=>/tint/.test(m.customProgramCacheKey()));out.earsShader=I.materials.some(m=>/ears/.test(m.customProgramCacheKey()));out.dither=I.materials.every(m=>m.alphaHash);
   out.glow=I.materials.some(m=>m.emissive&&m.emissive.getHex()!==0&&m.emissiveIntensity>0.1);out.halo=!!(P.extra&&P.extra.halo&&P.extra.halo.parent===P.group);
   return out;},[k,HOME]);
 }
 const glbs=requests.slice(before).filter(u=>/\.glb/.test(u));
 check('the fox, the fennec and the glimmer fox each get the real Animated Fox body, a resting body (66 vertex-cache frames, no skeleton)',['fox','fennec','glimmerfox'].every(k=>fam[k].state==='ready'&&fam[k].restOnly&&fam[k].morph===66),fam);
 check('the model file is fetched once for all three (fox.glb)',glbs.length>=1&&glbs.every(u=>/assets\/models\/pets\/fox\.glb/.test(u))&&new Set(glbs.map(u=>u.split('?')[0])).size===1,glbs);
 check('galloping, the drawn pet runs and the sitting fox is hidden (it never slides)',['fox','fennec','glimmerfox'].every(k=>fam[k].runHidden&&fam[k].runSpd>4),Object.fromEntries(Object.entries(fam).map(([k,v])=>[k,{runHidden:v.runHidden,runSpd:v.runSpd}])));
 check('stopped, it sits in within 6 s, the drawn pet hidden, playing its own idle (the morph frames change) without moving over the ground',
  ['fox','fennec','glimmerfox'].every(k=>fam[k].satAt!=null&&fam[k].satAt<=6&&fam[k].clip==='sit'&&fam[k].poses>=5&&fam[k].drift<0.005&&fam[k].stayed),Object.fromEntries(Object.entries(fam).map(([k,v])=>[k,{satAt:v.satAt,clip:v.clip,poses:v.poses,drift:v.drift,stayed:v.stayed}])));
 check('sitting on the ground at its size (fox 0.62 m, fennec 0.44 m before its ears are grown in the shader, glimmer fox 0.67 m), paws on the grass',
  Math.abs(fam.fox.box.h-0.62)<0.03&&Math.abs(fam.fennec.box.h-0.44)<0.025&&Math.abs(fam.glimmerfox.box.h-0.67)<0.035&&['fox','fennec','glimmerfox'].every(k=>Math.abs(fam[k].box.bottom)<0.012),Object.fromEntries(Object.entries(fam).map(([k,v])=>[k,v.box])));
 check('moving off, it dissolves out within 0.2 s of the pet starting to move, staying where it sat (it does not slide), and the drawn pet runs on',['fox','fennec','glimmerfox'].every(k=>fam[k].goneMs!=null&&fam[k].goneMs<=200&&fam[k].slidWhileFading<0.01),Object.fromEntries(Object.entries(fam).map(([k,v])=>[k,{goneMs:v.goneMs,slid:v.slidWhileFading}])));
 check('the fennec is the fox with its ears grown and a sand-cream coat; the glimmer fox is the fox in pale blue with its glow and its halo',fam.fennec.earsShader&&fam.fennec.ears===2&&fam.fennec.tint&&!fam.fox.earsShader&&!fam.fox.tint&&fam.glimmerfox.tint&&fam.glimmerfox.glow&&fam.glimmerfox.halo&&['fox','fennec','glimmerfox'].every(k=>fam[k].dither),
  Object.fromEntries(Object.entries(fam).map(([k,v])=>[k,{ears:v.ears,earsShader:v.earsShader,tint:v.tint,glow:v.glow,halo:v.halo,dither:v.dither}])));
 }

 check('no page errors',errors.length===0,errors.slice(0,8));
 console.log('warnings (expected: dog, duck, fox debugFail): '+JSON.stringify(warns));
 const fails=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-fails.length)+'/'+checks.length+' checks passed'+(fails.length?' — FAILED: '+fails.map(f=>f.name).join(' | '):''));
 await browser.close();process.exit(fails.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
