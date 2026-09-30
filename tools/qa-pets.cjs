/* Pets: every companion is its own animal, shows up when it follows you, and the winged ones fly with
   you (assets/features/pet-models.js, the pets section of ranch3d.html, market-summon-keys-pets.js, the
   pet part of world.js tickFollowers).

   What it proves, in the real game at 1280x800 (and again on a 390x844 phone):
     1. models: all fifteen pets build as their own animal — the kind of body (four legs, a bunny, a bird
        with two legs and two wings), at most 30 meshes and 3 shadow casters each, a body shape of their
        own, shared geometry between two of the same pet, no geometry leak when the pet is rebuilt ten
        times; every painted marking really reaches the surface (a duckling's olive cap and back, a
        tabby's bands); the chick and the duckling are a bright yellow, not mustard;
     2. cost: following a pet reads no pixels back from the GPU, and moving it costs well under a
        millisecond a frame;
     3. portraits: G.petArt.svg(key,size) draws a different picture for every pet;
     4. following, for every pet, switched on from the stable's Follow button or the market's Pets tab:
        the right animal, in the scene, and actually seen — drawn pixels that win the depth test against
        the horse and the grass, inside the picture, near the rider — standing (two of the last three
        looks), a straight gallop, a ten-second gallop with a held left and a held right turn, after
        stopping, after a fast travel (a different destination for each pet, all of them between them:
        seen on two of the three looks in the last 1.5 s), on foot, at a course start and after
        cancelling it;
     5. every fast-travel point in turn for the dog, the chick and the owl; Willowmere (the pet stands on
        the boardwalk's planks, not in the water under them), the Pasture, a Cottonwood street, the barn;
     6. the three pairs (glimmer fox and lumen, hare and frost, owl and pegasus) keep glowing through a held
        gallop turn;
     7. after a reload the saved pet comes back as itself (it used to come back as a puppy for 11 of 15);
     8. flight on a pegasus: the owl, the duckling and the chick take off, stay within a few metres of the
        rider in 3D through a climb, a cruise and a turn, never inside the horse's wings, bank into the
        turn, and are on the ground beside the horse soon after landing (the Land button's instant drop and
        a Shift dive); a dog runs along underneath and is back at the rider's side a moment after landing;
     9. the stable and the market list pets with their portraits (a round picture, not stretched);
    10. on a phone: standing, galloping and stopping; the owl's flight; a landing beside a pegasus (the
        birds seen, not behind its wings); a cancelled course (the pet seen and not under the buttons);
    11. no page errors.

   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-pets.cjs
           PETS=dog,owl runs the per-pet sections on a few pets; SECTIONS=models,follow,places,pairs,flight,
           menus,reload,mobile runs only those; SKIP=... skips some; QA_SHOTS=<dir> saves screenshots. */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const ONLY=process.env.PETS?process.env.PETS.split(','):null, SKIP=(process.env.SKIP||'').split(','), SHOTS=process.env.QA_SHOTS||'';
const RUN=sec=>(!process.env.SECTIONS||process.env.SECTIONS.split(',').includes(sec))&&!SKIP.includes(sec);
const t0=Date.now(), stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 4800 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},4800000).unref();
const errors=[];
async function newPage(mobile){
 const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,4).join(' | ')));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 return page;
}
async function boot(page,reload){
 if(reload)await page.reload({waitUntil:'load',timeout:120000});
 else await page.goto(QA.BASE+'/ranch3d.html?qa=pets&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1200);
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});
 await probe(page);
}
/* in-page helpers: step the game, press keys, and measure the pet on screen */
async function probe(page){
 await page.evaluate(()=>{
  const G=window.__features,T=G.THREE,p=G.horse.player;
  const key=(c,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:c,key:c,bubbles:true}));
  const inScene=o=>{let q=o;while(q){if(q===G.scene)return true;q=q.parent;}return false;};
  const shown=o=>{for(let e=o;e;e=e.parent)if(!e.visible)return false;return true;};
  const box=new T.Box3(),v=new T.Vector3();
  const petMeshes=g=>{const a=[];g.traverse(o=>{if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial)a.push(o);});return a;};
  const others=g=>{const a=[];g.traverse(o=>{if(o!==g&&(o.isSprite||o.isPoints||o.isLine||(o.isMesh&&!(o.material&&o.material.isMeshStandardMaterial))))a.push(o);});return a;};
  /* a camera of our own, when a check needs one (the close-up colour check) */
  window.__qcam=null;G.on('camera',()=>{const c=window.__qcam;if(!c)return;const cam=G.camera;cam.position.set(c.pos[0],c.pos[1],c.pos[2]);cam.lookAt(c.look[0],c.look[1],c.look[2]);if(Math.abs(cam.fov-(c.fov||45))>0.01){cam.fov=c.fov||45;cam.updateProjectionMatrix();}return true;});
  /* pixel truth: the pet painted flat magenta in a real render of the scene, then alone */
  const MAG=new T.MeshBasicMaterial({color:0xff00ff,toneMapped:false,fog:false});
  let RT=null,BUF=null;
  function count(){const R=G.renderer,w=RT.width,h=RT.height;R.readRenderTargetPixels(RT,0,0,w,h,BUF);let n=0,y0=1e9,y1=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(BUF[i]>200&&BUF[i+1]<70&&BUF[i+2]>200){n++;if(y<y0)y0=y;if(y>y1)y1=y;}}return {n,y0,y1};}
  function pix(c){
   const R=G.renderer,cam=G.camera,g=c.parts.group,sc=G.scene,W=Math.round(innerWidth/2),H=Math.round(innerHeight/2);
   if(!RT||RT.width!==W||RT.height!==H){RT=new T.WebGLRenderTarget(W,H);BUF=new Uint8Array(W*H*4);}
   const ms=petMeshes(g),ex=others(g),old=ms.map(m=>m.material),exv=ex.map(m=>m.visible);
   ms.forEach(m=>m.material=MAG);ex.forEach(m=>m.visible=false);
   const prevT=R.getRenderTarget(),prevAuto=R.shadowMap.autoUpdate,bg=sc.background;R.shadowMap.autoUpdate=false;const out={};
   try{R.setRenderTarget(RT);R.clear();R.render(sc,cam);const full=count();
    const vis=sc.children.map(o=>o.visible);sc.children.forEach(o=>o.visible=(o===g));sc.background=null;R.clear();R.render(sc,cam);const alone=count();
    sc.children.forEach((o,i)=>o.visible=vis[i]);sc.background=bg;
    out.visPx=full.n;out.silPx=alone.n;out.visFrac=alone.n?+(full.n/alone.n).toFixed(2):0;out.hPx=alone.n?(alone.y1-alone.y0+1)*2:0;}
   finally{R.setRenderTarget(prevT);R.shadowMap.autoUpdate=prevAuto;ms.forEach((m,i)=>m.material=old[i]);ex.forEach((m,i)=>m.visible=exv[i]);sc.background=bg;}
   return out;}
  function screen(c){const cam=G.camera,g=c.parts.group;g.updateMatrixWorld(true);box.makeEmpty();for(const m of petMeshes(g))box.expandByObject(m);
   const W=innerWidth,H=innerHeight;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,behind=0;
   for(let i=0;i<8;i++){v.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z);const vc=v.clone().applyMatrix4(cam.matrixWorldInverse);if(vc.z>0)behind++;v.project(cam);
    const sx=(v.x+1)/2*W,sy=(1-v.y)/2*H;x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);}
   const area=Math.max(1,(x1-x0)*(y1-y0)),vis=Math.max(0,Math.min(W,x1)-Math.max(0,x0))*Math.max(0,Math.min(H,y1)-Math.max(0,y0));
   return {inView:behind?0:+(vis/area).toFixed(2),rect:[Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)]};}
  /* how much of the pet's box the page's own buttons and panels cover: a 3x3 grid of points, which hit the canvas */
  function uiCover(rect){const cv=G.renderer.domElement;let hit=0,n=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const x=rect[0]+(rect[2]-rect[0])*(0.2+0.3*i),y=rect[1]+(rect[3]-rect[1])*(0.2+0.3*j);if(x<0||y<0||x>innerWidth||y>innerHeight)continue;n++;const e=document.elementFromPoint(x,y);if(e===cv)hit++;}return n?+(1-hit/n).toFixed(2):1;}
  function sample(tag,noPix){
   const c=G.pets.comp(),o={tag,px:+p.pos.x.toFixed(1),pz:+p.pos.z.toFixed(1),sp:+Math.abs(p.speed||0).toFixed(1),onFoot:!!p.onFoot};
   if(!c)return Object.assign(o,{comp:false});
   const g=c.parts.group,gy=G.world.groundH(p.pos.x,p.pos.z),ry=gy+(p.y||0);
   o.key=c.key;o.model=c.parts.key||null;o.kind=c.parts.spec?c.parts.spec.kind:null;o.inScene=inScene(g);o.shown=shown(g);
   o.dist=+Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z).toFixed(2);o.d3=+Math.hypot(g.position.x-p.pos.x,g.position.y-(ry+1),g.position.z-p.pos.z).toFixed(2);
   o.alt=+(c.alt||0).toFixed(2);o.air=c.st?c.st.air:'ground';o.combo=+(c.combo||0).toFixed(2);
   const h=p.heading;o.lx=+((g.position.x-p.pos.x)*-Math.cos(h)+(g.position.z-p.pos.z)*Math.sin(h)).toFixed(2);o.lz=+((g.position.x-p.pos.x)*Math.sin(h)+(g.position.z-p.pos.z)*Math.cos(h)).toFixed(2);
   o.footY=+(g.position.y-G.world.groundH(g.position.x,g.position.z)).toFixed(2);
   const s=screen(c);o.inView=s.inView;o.rect=s.rect;o.ui=uiCover(s.rect);
   if(!noPix)Object.assign(o,pix(c));
   o.seen=!!(o.inScene&&o.shown&&o.inView>=0.9&&(noPix||(o.visPx>=60&&o.visFrac>=0.35)));
   return o;}
  const run=(keys,ms,every,tag,noPix)=>{const out=[];for(const k of keys)key(k,true);const n=Math.max(1,Math.round(ms/every));for(let i=0;i<n;i++){window.advanceTime(every);out.push(sample(tag,noPix));}for(const k of keys)key(k,false);return out;};
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const frac=a=>+(a.filter(o=>o.seen).length/Math.max(1,a.length)).toFixed(2);
  const ride=b=>{G.save.sync(s=>{let h=s.horses.find(x=>x.breed===b);if(!h){h=G.horse.grantHorse(s,b,{name:'QA '+b,bond:60});}s.horses.splice(s.horses.indexOf(h),1);s.horses.unshift(h);});
   G.horse.reloadHorses();const sel=document.getElementById('horseSel');sel.value='0';sel.onchange();};
  window.__QP={G,p,key,sample,run,reset,pix,screen,inScene,shown,frac,ride,uiCover,homeBreed:(window.__QP&&window.__QP.homeBreed)||G.horse.ridden().breed};
  /* a flight on a pegasus with pet k: take off, climb, cruise, a turn, then land (the Land button or a Shift dive) */
  window.__QP.fly=function(k,land,H){
   const Q=window.__QP,G=Q.G,p=Q.p,out={};
   G.hidePanels();
   if(!G.horse.ridden().wings)Q.ride('pegasus');
   out.horse=G.horse.ridden().breed;out.wings=!!G.horse.ridden().wings;
   Q.reset(H.x,H.z,H.h);
   if(G.pets.active()!==k)G.pets.setActive(k);
   Q.run([],3000,1000,'stand',true);
   const S=[];const fs=(keys,ms,tag)=>{const r=Q.run(keys,ms,250,tag,true);for(const o of r){const g=G.pets.comp().parts.group,h=p.heading,rx=-Math.cos(h),rz=Math.sin(h),fx=Math.sin(h),fz=Math.cos(h),ry=G.world.groundH(p.pos.x,p.pos.z)+(p.y||0);
     const lx=(g.position.x-p.pos.x)*rx+(g.position.z-p.pos.z)*rz,lz=(g.position.x-p.pos.x)*fx+(g.position.z-p.pos.z)*fz,ly=g.position.y-ry;
     o.local=[+lx.toFixed(2),+ly.toFixed(2),+lz.toFixed(2)];o.inWings=!!p.flying&&Math.abs(lx)<2.65+0.1&&lz>-1.28&&lz<0.59&&ly>0.29&&ly<3.09;o.py=+(p.y||0).toFixed(2);o.flying=!!p.flying;
     o.bank=+g.rotation.z.toFixed(2);o.roll=+p.mesh.rotation.z.toFixed(2);S.push(o);}return r;};
   fs(['KeyW','Space'],750,'takeoff');
   fs(['KeyW'],2000,'cruise');
   fs(['KeyW','Space'],250,'climb');
   fs(['KeyW'],2000,'cruise');
   fs(['KeyW','KeyA'],2500,'turn');
   fs(['KeyW'],1250,'cruise');
   out.topY=Math.max(...S.map(o=>o.py));
   const air=S.filter(o=>o.flying&&o.tag!=='takeoff');
   out.airN=air.length;out.near=+(air.filter(o=>o.d3<=6).length/Math.max(1,air.length)).toFixed(2);out.maxD3=Math.max(...air.map(o=>o.d3));
   out.inWings=S.filter(o=>o.inWings).length;
   out.aloft=+(air.filter(o=>o.air==='fly'&&o.alt>4).length/Math.max(1,air.length)).toFixed(2);
   const turning=S.filter(o=>o.tag==='turn'&&Math.abs(o.roll)>0.2);out.turnN=turning.length;out.bankMatch=+(turning.filter(o=>Math.sign(o.bank)===Math.sign(o.roll)&&Math.abs(o.bank)>0.1).length/Math.max(1,turning.length)).toFixed(2);
   out.bankMax=+Math.max(...turning.map(o=>Math.abs(o.bank)),0).toFixed(2);out.bankSpread=turning.length?+(Math.max(...turning.map(o=>o.bank))-Math.min(...turning.map(o=>o.bank))).toFixed(2):0;
   out.inView=+(air.filter(o=>o.inView>=0.9).length/Math.max(1,air.length)).toFixed(2);
   out.comboEnd=S[S.length-1].combo;
   /* land */
   const L=[];
   if(land==='button'){document.getElementById('flyBtn').click();}
   let tDown=null,tNear=null;
   const keys=land==='dive'?['ShiftLeft']:[];
   for(const k2 of keys)Q.key(k2,true);
   let tLanded=null;const after=[];
   for(let i=0;i<32;i++){window.advanceTime(250);const o=Q.sample('land',true);o.flying=!!p.flying;L.push(o);
    if(tLanded==null&&!p.flying)tLanded=i*0.25+0.25;
    if(tLanded!=null){const since=(i*0.25+0.25)-tLanded;if(tDown==null&&o.air==='ground'&&o.alt<0.1)tDown=since;if(tNear==null&&o.dist<=(k==='dog'?6:4))tNear=since;
     if(since>=1.5&&since<=4.5&&i%2===0)after.push(Q.sample('landed',false));}}
   for(const k2 of keys)Q.key(k2,false);
   const last=L[L.length-1];
   out.landed=tLanded;out.down=tDown;out.near6=tNear;out.last={air:last.air,alt:last.alt,dist:last.dist,inView:last.inView};
   out.final=Q.sample('landed');out.afterSeen=Q.frac(after);out.afterUi=Math.max(0,...after.map(o=>o.ui));
   return out;
  };
 });
}
const HOME={x:-100,z:400,h:Math.PI};   // an open meadow, riding south: seven clear seconds of gallop before anything is in the way
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await newPage(false);
 stage('boot'); await boot(page); stage('booted');

 /* ---- 1. install, models, markings, colour ------------------------------------------------ */
 const M=await page.evaluate(()=>{
  const G=window.__features,out={installed:G.installed.includes('pet-models'),errs:G.errors.filter(e=>/pet/.test(e.id||'')),handles:!!(G.petModels&&G.petArt&&G.pets.portrait&&G.petModels.glow)};
  out.keys=G.pets.PETS3.map(p=>p.key);out.rows=G.pets.PETS3.map(p=>({key:p.key,kind:p.kind||null,wings:!!p.wings}));
  out.models={};const bodies=new Set();
  for(const k of out.keys){const P=G.pets.make(k);let meshes=0,shadow=0;P.group.traverse(o=>{if(o.isMesh){meshes++;if(o.castShadow)shadow++;}});
   out.models[k]={key:P.key,kind:P.spec&&P.spec.kind,legs:P.legs.length,wings:(P.wings||[]).length,meshes,shadow,body:P.body&&P.body.geometry.uuid,h:P.spec&&P.spec.h};
   if(P.body)bodies.add(P.body.geometry.uuid);}
  out.distinctBodies=bodies.size;
  const a=G.pets.make('fox'),b=G.pets.make('fox');out.shared=a.body.geometry===b.body.geometry&&a.legs.length===b.legs.length;
  /* every painted marking reaches the surface: of the surface just round it (inside 1.25 times its size), at
     least a tenth is inside its full-colour core — a marking that only grazes the surface (the duckling's old
     cap and back) paints nothing there */
  const SP=G.petModels.SPECIES;out.paint=[];
  for(const k of out.keys){const S=SP[k];if(!S)continue;const P=G.pets.make(k);
   const cov=(geo,prims,tag)=>{if(!geo||!prims)return;const pos=geo.attributes.position;for(const q of prims){if(!q[8])continue;const [x0,y0,z0,r,sx,sy,sz]=[q[0],q[1],q[2],q[3],q[4]||1,q[5]||1,q[6]||1];let n09=0,n15=0;
     for(let i=0;i<pos.count;i++){const dx=(pos.getX(i)-x0)/sx,dy=(pos.getY(i)-y0)/sy,dz=(pos.getZ(i)-z0)/sz,d=Math.sqrt(dx*dx+dy*dy+dz*dz)/r;if(d<0.8)n09++;if(d<1.25)n15++;}
     out.paint.push({k,tag,c:q[7],n09,n15,cover:n15?+(n09/n15).toFixed(2):0});}};
   cov(P.body.geometry,S.body,'body');
   const hm=P.headGroup.children.find(o=>o.isMesh&&o.geometry.attributes.position.count>500);if(hm&&S.head&&S.head.prims)cov(hm.geometry,S.head.prims,'head');
   if(S.tail&&S.tail.fused&&P.tail){const tm=P.tail.children.find(o=>o.isMesh&&o.geometry.attributes.position.count>200);if(tm)cov(tm.geometry,S.tail.fused,'tail');}}
  /* ten rebuilds of the follower do not leak geometry or materials */
  G.save.sync(s=>{s.petList=out.keys.slice();s.companion=null;});
  if(G.pets.active()!=='owl')G.pets.setActive('owl');window.advanceTime(50);
  G.renderer.render(G.scene,G.camera);const m0={g:G.renderer.info.memory.geometries,t:G.renderer.info.memory.textures};
  for(let i=0;i<10;i++){G.pets.rebuild();window.advanceTime(20);}
  G.renderer.render(G.scene,G.camera);out.mem={before:m0,after:{g:G.renderer.info.memory.geometries,t:G.renderer.info.memory.textures}};
  out.portraits={};for(const k of out.keys){const s=G.petArt.svg(k,56);out.portraits[k]={ok:/^<svg[^>]*width="56"/.test(s)&&s.length>400,len:s.length,h:s.length+':'+s.slice(120,180)};}
  out.portraitList=G.petArt.list().length;out.pawFallback=/^<svg/.test(G.petArt.svg('nobody',30));
  return out;
 });
 check('pet-models installed with no install error, handles exported',M.installed&&M.errs.length===0&&M.handles,M.errs);
 const WING=['duck','chick','owl'],BUN=['bunny','snowhare'];
 const kindOf=k=>WING.includes(k)?'bird':BUN.includes(k)?'bunny':'quad';
 check('fifteen pets, each row marked with its kind and the three birds with wings',M.keys.length===15&&M.rows.every(r=>r.kind===kindOf(r.key)&&r.wings===WING.includes(r.key)),M.rows.filter(r=>r.kind!==kindOf(r.key)||r.wings!==WING.includes(r.key)));
 check('every pet builds as its own animal: birds on two legs with two wings, the rest on four',M.keys.every(k=>{const m=M.models[k];return m.key===k&&m.kind===kindOf(k)&&m.legs===(m.kind==='bird'?2:4)&&m.wings===(m.kind==='bird'?2:0);}),M.models);
 check('every pet is at most 30 meshes (merged small parts) with at most 3 shadow casters',M.keys.every(k=>M.models[k].meshes<=30&&M.models[k].shadow<=3),Object.fromEntries(M.keys.map(k=>[k,[M.models[k].meshes,M.models[k].shadow]])));
 check('fifteen different body shapes, and two of the same pet share theirs',M.distinctBodies===15&&M.shared,{distinct:M.distinctBodies,shared:M.shared});
 check('ten rebuilds of the follower leak no geometry or textures',M.mem.after.g-M.mem.before.g<=2&&M.mem.after.t-M.mem.before.t<=1,M.mem);
 const weak=M.paint.filter(q=>q.n09<3||q.cover<0.1);
 check('every painted marking reaches the surface (the duckling\'s cap and back, the tabby\'s bands, the raccoon\'s rings)',M.paint.length>=50&&weak.length===0,{n:M.paint.length,weak,duck:M.paint.filter(q=>q.k==='duck'),cat:M.paint.filter(q=>q.k==='cat').map(q=>q.cover)});
 check('a drawn portrait for every pet, all different, and a paw for an unknown one',M.keys.every(k=>M.portraits[k].ok)&&new Set(M.keys.map(k=>M.portraits[k].h)).size===15&&M.portraitList>=15&&M.pawFallback,M.portraits);

 /* the chick's and the duckling's lit yellow, from a close-up at noon: the top of the bird in the picture */
 if(RUN('models')){
  const col={};
  for(const k of ['chick','duck','cat']){
   const set=await page.evaluate(k=>{const G=window.__features,Q=window.__QP;G.hidePanels();if(G.pets.active())G.pets.setActive(G.pets.active());Q.reset(-12,-8,0);
    try{window._setDay&&window._setDay(0.5);}catch(e){}const x=8,z=5,gy=G.world.groundH(x,z);   /* the open arena: full sun, no tree's shade */const P=G.pets.make(k);P.group.position.set(x,gy,z);P.group.rotation.set(0,0.7,0);G.scene.add(P.group);window.__qm=P;
    window.__qcam={pos:[x,gy+0.6,z+1.5],look:[x,gy+P.spec.h*0.5,z],fov:40};window.advanceTime(200);window.__qrect=null;return true;},k);
   await page.waitForTimeout(150);
   await page.evaluate(()=>{const P=window.__qm;window.__qrect=window.__QP.screen({parts:P}).rect;});
   await page.waitForTimeout(150);const shot1=await page.screenshot({type:'png'});if(SHOTS)require('fs').writeFileSync(SHOTS+'/qa-pets-colour-'+k+'.png',shot1);
   await page.evaluate(()=>{const P=window.__qm,T=window.__features.THREE;const m=new T.MeshBasicMaterial({color:0xff00ff,toneMapped:false,fog:false});P.body.material=m;window.advanceTime(50);});   // the fur of the body only: not the beak, the eyes or the tuft
   await page.waitForTimeout(120);const shot2=await page.screenshot({type:'png'});if(SHOTS)require('fs').writeFileSync(SHOTS+'/qa-pets-colour-'+k+'-mask.png',shot2);
   col[k]=await page.evaluate(async([a,b])=>{const G=window.__features,P=window.__qm;G.scene.remove(P.group);window.__qcam=null;window.__qm=null;
    const load=async s=>{const im=new Image();im.src='data:image/png;base64,'+s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height);};
    const A=await load(a),B=await load(b);let y0=1e9,y1=-1;const W=A.width,dpr=W/innerWidth,rc=(window.__qrect||[0,0,innerWidth,innerHeight]).map(v=>v*dpr);   // only inside the model's own box on screen (the lupins by the fence are purple too, and move in the wind)
    const isM=i=>{const px=(i/4)%W,py=(i/4/W)|0;return px>=rc[0]&&px<=rc[2]&&py>=rc[1]&&py<=rc[3];}
    const isM0=i=>B.data[i]>100&&B.data[i+2]>100&&B.data[i+1]<80&&Math.abs(B.data[i]-B.data[i+2])<70&&(Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]))>60;   // purple in the masked picture (the grade shifts pure magenta) and changed from the plain one
    const isMM=i=>isM(i)&&isM0(i);
    const rows=new Map();for(let i=0;i<B.data.length;i+=4){if(isMM(i)){const y=(i/4/W)|0;rows.set(y,(rows.get(y)||0)+1);}}
    for(const [y,c] of rows)if(c>=8){if(y<y0)y0=y;if(y>y1)y1=y;}   // rows with a real run of body in them (a stray purple flower is not the cat)
    let r=0,g=0,bl=0,n=0;const lim=y0+(y1-y0)*0.4;
    for(let i=0;i<B.data.length;i+=4){const y=(i/4/W)|0;if(y>lim)break;if(y>=y0&&(rows.get(y)||0)>=8&&isMM(i)){r+=A.data[i];g+=A.data[i+1];bl+=A.data[i+2];n++;}}
    r/=n||1;g/=n||1;bl/=n||1;const mx=Math.max(r,g,bl),mn=Math.min(r,g,bl);let h=0;if(mx>mn){if(mx===r)h=60*(((g-bl)/(mx-mn))%6);else if(mx===g)h=60*((bl-r)/(mx-mn)+2);else h=60*((r-g)/(mx-mn)+4);}if(h<0)h+=360;
    let nm0=0,nin=0;for(let i=0;i<B.data.length;i+=4){if(isM0(i))nm0++;if(isMM(i))nin++;}
    return {n,nm0,nin,rc:rc.map(Math.round),y0,y1,rgb:[Math.round(r),Math.round(g),Math.round(bl)],hue:+h.toFixed(1),value:+(mx/255).toFixed(2),sat:mx?+((mx-mn)/mx).toFixed(2):0};},[shot1.toString('base64'),shot2.toString('base64')]);
  }
  console.log('   lit colour: '+JSON.stringify(col));
  /* The world is graded to a mean value of about 0.58 (look-grade.js: Cineon at exposure 0.62), which caps
     the brightest lit surfaces near 0.8; the birds used to come out olive (hue 52-55, green as strong as red). */
  check('the chick and the duckling are a clear chick-yellow in the light, not olive or mustard (hue 42-50°, saturation at least 0.5, value at least 0.72)',['chick','duck'].every(k=>col[k].n>200&&col[k].hue>=42&&col[k].hue<=50&&col[k].sat>=0.5&&col[k].value>=0.72),col);
  check('the kitten reads as a warm grey tabby, not blue (red at least as strong as blue on its lit back)',col.cat.n>200&&col.cat.rgb[0]>=col.cat.rgb[2],col.cat);
 }

 /* ---- 2. cost: no pixels read back, a cheap frame -------------------------------------------- */
 if(RUN('models')){
  const cost=await page.evaluate(([H])=>{const G=window.__features,Q=window.__QP;G.hidePanels();
   const R=G.renderer,o2=R.readRenderTargetPixels;let reads=0;R.readRenderTargetPixels=function(...a){reads++;return o2.apply(R,a);};
   const M2=G.petModels,om=M2.move,ts=[];M2.move=function(c,dt,t){const a=performance.now();const r=om(c,dt,t);ts.push(performance.now()-a);return r;};
   try{if(G.pets.active()!=='dog')G.pets.setActive('dog');Q.reset(H.x,H.z,H.h);Q.run([],6000,1000,'still',true);Q.run(['KeyW','ShiftLeft'],3000,1000,'run',true);Q.run([],3000,1000,'still',true);}
   finally{R.readRenderTargetPixels=o2;M2.move=om;}
   ts.sort((a,b)=>a-b);return {reads,frames:ts.length,median:+ts[ts.length>>1].toFixed(3),p99:+ts[Math.floor(ts.length*0.99)].toFixed(3),max:+ts[ts.length-1].toFixed(2)};},[HOME]);
  check('following a pet reads no pixels back from the GPU, and moves it in well under a millisecond a frame',cost.reads===0&&cost.frames>300&&cost.median<0.6&&cost.p99<3,cost);
 }

 /* ---- 3. following, every pet --------------------------------------------------------- */
 const keys=M.keys.filter(k=>!ONLY||ONLY.includes(k)), fkeys=RUN('follow')?keys:[];
 const per={};
 const FT=await page.evaluate(()=>{const T=window.__features.tables;return T.FT.map((f,i)=>({i,name:f[0].replace(/[^\x20-\x7e]/g,'').trim(),x:f[1],z:f[2]}));});
 const ev=await page.evaluate(()=>{const G=window.__features;const e=G.tables.EVENTS3.find(x=>x.id==='h1')||G.tables.EVENTS3.find(x=>!x.race&&!x.dressage&&!x.kind);return e?e.id:null;});
 const ftSeen=a=>a.slice(-3).filter(o=>o.seen&&o.dist<=4.5).length>=2;   // seen on two of the three looks in the last 1.5 s
 for(let i=0;i<fkeys.length;i++){
  const k=fkeys[i];const R=per[k]={};
  R.via=i%2?'market':'stable';
  await page.evaluate(([k,H])=>{const Q=window.__QP,G=Q.G;G.hidePanels();if(G.horse.ridden().breed!==Q.homeBreed)Q.ride(Q.homeBreed);if(G.pets.active())G.pets.setActive(G.pets.active());Q.reset(H.x,H.z,H.h);},[k,HOME]);
  if(R.via==='stable'){
   await page.evaluate(()=>{window.__features.ui.openStable();});
   const b=await page.$('#stablePanel [data-pet="'+k+'"]');R.button=!!b;if(b)await page.evaluate(k=>document.querySelector('#stablePanel [data-pet="'+k+'"]').click(),k);
  }else{
   await page.evaluate(()=>{window.__features.ui.openShop('pets');});
   const b=await page.$('#shopPanel [data-petfollow="'+k+'"]');R.button=!!b;if(b)await page.evaluate(k=>document.querySelector('#shopPanel [data-petfollow="'+k+'"]').click(),k);
  }
  await page.evaluate(()=>{const G=window.__features;G.hidePanels();try{if(G.seHorses)G.seHorses.close();}catch(e){}});
  await page.waitForTimeout(250);                                  // the full-screen menus close on their own observer, a task later
  const s0=await page.evaluate(()=>{const Q=window.__QP,G=Q.G;const st=Q.run([],4000,500,'stand');return {active:G.pets.active(),standAll:st.slice(-3),stand:st[st.length-1],cam:(()=>{const c=G.camera.position,p=Q.p;return +Math.hypot(c.x-p.pos.x,c.z-p.pos.z).toFixed(2);})()};});
  if(SHOTS)await page.screenshot({path:SHOTS+'/qa-pets-'+k+'-stand.png'});
  const s=await page.evaluate(([k,H,FT,ev,fi])=>{
   const Q=window.__QP,G=Q.G,p=Q.p,out={};
   const GAL=['KeyW','ShiftLeft'];
   const gal=Q.run(GAL,5000,500,'gallop');out.gallop=gal[gal.length-1];out.gallopSeen=Q.frac(gal.slice(4));out.gallopMaxD=Math.max(...gal.slice(4).map(o=>o.dist));out.gallopSp=out.gallop.sp;
   /* ten seconds more: two straight, four held left, four held right */
   const tn=[...Q.run(GAL,2000,250,'straight'),...Q.run([...GAL,'KeyA'],4000,250,'heldA'),...Q.run([...GAL,'KeyD'],4000,250,'heldD')];
   out.turnSeen=Q.frac(tn);out.turnMaxD=Math.max(...tn.map(o=>o.dist));out.turnMiss=tn.map(o=>o.seen?1:0).join('');
   out.stop=Q.run([],2500,2500,'stop').pop();
   /* fast travel: the bar's own button, each pet to a different destination */
   const f=FT[fi%FT.length];
   const btn=document.querySelector('#ftBar [data-ft="'+f.i+'"]');if(btn&&btn.onclick)btn.onclick();else p.pos.set(f.x,0,f.z);
   out.ftName=f.name;out.ftAll=Q.run([],4000,500,'fast travel');out.ft=out.ftAll[out.ftAll.length-1];try{const c=G.pets.comp();out.ft.idle=c.st&&c.st.idle?c.st.idle.name:null;}catch(e){}
   /* on foot */
   Q.reset(H.x,H.z,H.h);Q.run([],1500,1500,'settle',true);
   try{G.onFoot.dismount();}catch(e){out.footErr=String(e);}
   Q.run(['KeyW'],2000,2000,'walk',true);out.foot=Q.run([],2500,2500,'on foot').pop();
   try{G.onFoot.mount();}catch(e){}
   Q.run([],800,800,'remount',true);
   /* a course start and a cancel */
   Q.reset(H.x,H.z,H.h);Q.run([],1500,1500,'settle',true);
   const E=G.tables.EVENTS3.find(x=>x.id===ev);
   try{G.course.startCourse(E,1);}catch(e){out.courseErr=String(e);}
   out.courseOn=!!G.course.get();out.course=Q.run([],3500,3500,'course start').pop();
   try{G.course.cancelCourse();}catch(e){}
   out.cancel=Q.run([],3500,3500,'course cancelled').pop();
   return out;
  },[k,HOME,FT,ev,i]);
  Object.assign(R,s0,s);
  const brief=o=>o?{seen:o.seen,inView:o.inView,visPx:o.visPx,visFrac:o.visFrac,hPx:o.hPx,dist:o.dist,model:o.model}:null;
  console.log('   '+k+' via '+R.via+': '+JSON.stringify({camBack:R.cam,stand:R.standAll.map(o=>o.seen?1:0).join(''),gallopSeen:R.gallopSeen,sp:R.gallopSp,turn:[R.turnSeen,R.turnMiss],stop:brief(R.stop),ft:[R.ftName,R.ftAll.map(o=>o.seen?1:0).join(''),R.ft.dist],foot:brief(R.foot),course:brief(R.course),cancel:brief(R.cancel)}));
 }
 const ok=(o,maxD)=>!!(o&&o.seen&&o.dist<=maxD);
 if(fkeys.length){
 check('every pet switches on from the stable or the market as the right animal, in the scene',keys.every(k=>per[k].button&&per[k].active===k&&per[k].stand.key===k&&per[k].stand.model===k&&per[k].stand.inScene&&per[k].stand.shown),Object.fromEntries(keys.map(k=>[k,{via:per[k].via,button:per[k].button,active:per[k].active,model:per[k].stand.model}])));
 check('standing: every pet seen in the picture beside the rider (two of the last three looks)',keys.every(k=>per[k].standAll.filter(o=>ok(o,3.5)).length>=2),Object.fromEntries(keys.filter(k=>per[k].standAll.filter(o=>ok(o,3.5)).length<2).map(k=>[k,per[k].standAll.map(o=>({seen:o.seen,inView:o.inView,visFrac:o.visFrac,dist:o.dist}))])));
 check('galloping: every pet keeps up and stays in the picture (seen on 80% of the last three seconds)',keys.every(k=>per[k].gallopSeen>=0.8&&per[k].gallopMaxD<=5&&per[k].gallopSp>9),Object.fromEntries(keys.map(k=>[k,{seen:per[k].gallopSeen,maxD:per[k].gallopMaxD,sp:per[k].gallopSp}])));
 const tAvg=+(keys.reduce((a,k)=>a+per[k].turnSeen,0)/keys.length).toFixed(2);
 check('a ten-second gallop with a held left and a held right turn: every pet seen on at least 70% of it, 80% on average, and never left behind',tAvg>=0.8&&keys.every(k=>per[k].turnSeen>=0.7&&per[k].turnMaxD<=6),{avg:tAvg,per:Object.fromEntries(keys.map(k=>[k,{seen:per[k].turnSeen,maxD:per[k].turnMaxD,miss:per[k].turnMiss}]))});
 check('after a gallop and a stop: every pet seen beside the rider',keys.every(k=>ok(per[k].stop,4)),Object.fromEntries(keys.filter(k=>!ok(per[k].stop,4)).map(k=>[k,per[k].stop])));
 check('after a fast travel (every destination between them): every pet back beside the rider and seen on two of the last three looks',keys.every(k=>ftSeen(per[k].ftAll)),Object.fromEntries(keys.map(k=>[k,{to:per[k].ftName,looks:per[k].ftAll.map(o=>o.seen?1:0).join(''),dist:per[k].ft.dist,visFrac:per[k].ft.visFrac,inView:per[k].ft.inView,at:[per[k].ft.lx,per[k].ft.lz],idle:per[k].ft.idle}])));
 check('on foot: every pet seen beside her',keys.every(k=>ok(per[k].foot,3.5)&&per[k].foot.onFoot),Object.fromEntries(keys.filter(k=>!(ok(per[k].foot,3.5)&&per[k].foot.onFoot)).map(k=>[k,per[k].foot])));
 check('at a course start: every pet seen beside the rider at the start line',keys.every(k=>per[k].courseOn&&ok(per[k].course,4.5)),Object.fromEntries(keys.filter(k=>!(per[k].courseOn&&ok(per[k].course,4.5))).map(k=>[k,Object.assign({on:per[k].courseOn,err:per[k].courseErr},per[k].course)])));
 check('after cancelling the course: every pet seen beside the rider',keys.every(k=>ok(per[k].cancel,4.5)),Object.fromEntries(keys.filter(k=>!ok(per[k].cancel,4.5)).map(k=>[k,per[k].cancel])));
 check('a pet on screen is big enough to read: 40 px tall for the chick, 56 for the rest, standing',keys.every(k=>per[k].stand.hPx>=(k==='chick'?40:56)),Object.fromEntries(keys.map(k=>[k,per[k].stand.hPx])));
 }

 /* ---- 4. places: every fast-travel point, the boardwalk, the Pasture, a town street, the barn, the river ---- */
 if(RUN('places')){
  stage('places');
  const all={};
  for(const k of ['dog','chick','owl'].filter(k=>!ONLY||ONLY.includes(k))){
   all[k]=await page.evaluate(([k,FT,H])=>{const Q=window.__QP,G=Q.G,p=Q.p,out=[];G.hidePanels();if(G.pets.active()!==k)G.pets.setActive(k);Q.reset(H.x,H.z,H.h);Q.run([],2000,2000,'pre',true);
    for(const f of FT){const btn=document.querySelector('#ftBar [data-ft="'+f.i+'"]');if(btn&&btn.onclick)btn.onclick();else p.pos.set(f.x,0,f.z);
     const a=Q.run([],4000,500,'ft '+f.name);const c=G.pets.comp(),L=a[a.length-1];out.push({name:f.name,looks:a.map(o=>o.seen?1:0).join(''),ok:a.slice(-3).filter(o=>o.seen&&o.dist<=4.5).length>=2,dist:L.dist,visFrac:L.visFrac,inView:L.inView,at:[L.lx,L.lz],idle:c.st&&c.st.idle?c.st.idle.name:null,footY:L.footY,rider:[+p.pos.x.toFixed(1),+p.pos.z.toFixed(1)]});}
    return out;},[k,FT,HOME]);
   console.log('   every fast-travel point, '+k+': '+JSON.stringify(all[k].map(o=>o.name+':'+o.looks)));
  }
  const fk=Object.keys(all);
  if(fk.length)check('every fast-travel point ('+FT.length+'), for the dog, the chick and the owl: the pet is back and seen on two of the last three looks',fk.every(k=>all[k].length===FT.length&&all[k].every(o=>o.ok)),Object.fromEntries(fk.map(k=>[k,all[k].filter(o=>!o.ok)])));
  const pl=await page.evaluate(([H])=>{const Q=window.__QP,G=Q.G,p=Q.p,out={};G.hidePanels();if(G.pets.active()!=='dog')G.pets.setActive('dog');
   /* Willowmere: stood on the boardwalk, the pet is on the planks beside the rider, not in the water under them */
   const W=Q.G.tables.FT.find(f=>/Willowmere/.test(f[0]));Q.reset(W[1],W[2],0);
   const w=Q.run([],4000,500,'willowmere');const c=G.pets.comp(),dk=G.petModels.deckAt(c.pos.x,c.pos.z),gy=G.world.groundH(c.pos.x,c.pos.z);
   out.willow={looks:w.map(o=>o.seen?1:0).join(''),seen:w.slice(-3).filter(o=>o.seen).length>=2,onDeck:dk!=null,petY:+(c.parts.group.position.y-gy).toFixed(2),deckY:dk!=null?+(dk-gy).toFixed(2):null,dist:w[w.length-1].dist};
   /* the Pasture and a Cottonwood street: arrive, ride on with turns, stop */
   /* the Cottonwood street is the one running north-east from (40,-75), buildings along both sides for 28 m */
   for(const [nm,x,z,h] of [['pasture',-70,-10,0.6],['cottonwood',40,-75,0.785]]){Q.reset(x,z,h);const a=Q.run([],3000,500,nm+' arrive');
    const b=[...Q.run(['KeyW'],3000,250,nm+' trot'),...Q.run(['KeyW','KeyA'],1000,250,nm+' A'),...Q.run(['KeyW'],1000,250,nm+' trot'),...Q.run(['KeyW','KeyD'],1000,250,nm+' D'),...Q.run(['KeyW'],1000,250,nm+' trot')];const s=Q.run([],3000,500,nm+' stop');
    out[nm]={arrive:a.slice(-3).filter(o=>o.seen).length>=2,arriveLooks:a.map(o=>o.seen?1:0).join(''),ride:Q.frac(b),stop:s.slice(-3).filter(o=>o.seen).length>=2,stopLooks:s.map(o=>o.seen?1:0).join('')};}
   /* the barn at (-16,-14): parked with its spot inside the walls, the pet settles outside them, still, and seen */
   const barn=(G.world.colliders||[]).filter(c=>Math.hypot(c.x+16,c.z+14)<3).sort((a,b)=>b.r-a.r)[0]||{x:-16,z:-14,r:4.4};
   Q.reset(barn.x+barn.r+0.9,barn.z,0);Q.run([],4000,4000,'barn settle',true);
   const c2=G.pets.comp();let path=0,rev=0,last=null,lastD=null;
   for(let i=0;i<120;i++){window.advanceTime(1000/60);const x=c2.pos.x,z=c2.pos.z;if(last){const dx=x-last[0],dz=z-last[1];path+=Math.hypot(dx,dz);if(lastD&&dx*lastD[0]+dz*lastD[1]<-1e-6)rev++;if(Math.hypot(dx,dz)>1e-5)lastD=[dx,dz];}last=[x,z];}
   const bs=Q.run([],1500,500,'barn');
   out.wall={path:+path.toFixed(3),reversals:rev,inside:+(barn.r-Math.hypot(c2.pos.x-barn.x,c2.pos.z-barn.z)).toFixed(2),seen:bs.filter(o=>o.seen).length>=2};
   /* standing in the middle of the river: the pet swims with its head above the water, never walks the bed */
   const rx=-100,rz=G.world.riverZ(rx);Q.reset(rx,rz,0);Q.run([],4000,4000,'river',true);
   const c3=G.pets.comp(),g=c3.parts.group,lv=G.world.riverLevel(c3.pos.x),bed=G.world.terrainH(c3.pos.x,c3.pos.z);
   out.river={depth:+(lv-bed).toFixed(2),top:+(g.position.y+c3.parts.spec.h*0.85-lv).toFixed(2),aboveBed:+(g.position.y-bed).toFixed(2),dist:+Math.hypot(c3.pos.x-p.pos.x,c3.pos.z-p.pos.z).toFixed(2),swim:!!(c3.st&&c3.st.swim)};
   Q.reset(H.x,H.z,H.h);
   return out;},[HOME]);
  console.log('   places: '+JSON.stringify(pl));
  check('Willowmere: the pet stands on the boardwalk\'s planks beside the rider (not in the water under them) and is seen',pl.willow.onDeck&&pl.willow.petY>=pl.willow.deckY-0.1&&pl.willow.seen,pl.willow);
  check('the Pasture and a Cottonwood street: seen on arrival, most of a ride with turns, and after stopping',['pasture','cottonwood'].every(n=>pl[n].arrive&&pl[n].ride>=0.6&&pl[n].stop),{pasture:pl.pasture,cottonwood:pl.cottonwood});
  check('with its spot inside the barn the pet settles outside the walls, still, and is seen',pl.wall.path<0.15&&pl.wall.reversals<=2&&pl.wall.inside<0.05&&pl.wall.seen,pl.wall);
  check('in the river the pet swims with its head above the water, off the river bed',pl.river.depth>0.5&&pl.river.top>0.05&&pl.river.aboveBed>0.1&&pl.river.dist<4,pl.river);
 }

 /* ---- 5. the pairs keep glowing through a held turn --------------------------------------- */
 if(RUN('pairs')){
  stage('pairs');
  const pr={};
  for(const [b,k] of [['lumen','glimmerfox'],['frost','snowhare'],['pegasus','owl']]){
   if(ONLY&&!ONLY.includes(k))continue;
   pr[k]=await page.evaluate(([b,k,H])=>{const Q=window.__QP,G=Q.G;G.hidePanels();Q.ride(b);Q.reset(H.x,H.z,H.h);if(G.pets.active()!==k)G.pets.setActive(k);Q.run([],4000,1000,'pair stand',true);
    const GAL=['KeyW','ShiftLeft'];Q.run(GAL,2000,500,'pair gal',true);const t=[...Q.run([...GAL,'KeyA'],4000,250,'pair A',true),...Q.run([...GAL,'KeyD'],4000,250,'pair D',true)];
    const inTurn=t.filter((o,i)=>i%16>=4);const out={breed:G.horse.ridden().breed,combo:+(inTurn.reduce((a,o)=>a+o.combo,0)/inTurn.length).toFixed(2),min:Math.min(...inTurn.map(o=>o.combo))};Q.ride(Q.homeBreed);return out;},[b,k,HOME]);
  }
  console.log('   pairs: '+JSON.stringify(pr));
  const pk=Object.keys(pr);
  if(pk.length)check('the three pairs keep glowing through a held gallop turn (average glow at least 0.85)',pk.every(k=>pr[k].combo>=0.85),pr);
 }

 /* ---- 6. flight ------------------------------------------------------------------------ */
 stage('flight');
 const flights={};
 for(const [k,land] of [['owl','button'],['duck','dive'],['chick','button'],['dog','button']]){
  if((ONLY&&!ONLY.includes(k))||!RUN('flight'))continue;
  flights[k]=await page.evaluate(([k,land,H])=>window.__QP.fly(k,land,H),[k,land,HOME]);
  console.log('   flight '+k+': '+JSON.stringify(flights[k]));
  if(SHOTS)await page.screenshot({path:SHOTS+'/qa-pets-flight-'+k+'-landed.png'});
 }
 const F=flights;
 if(F.owl||F.duck||F.chick){
  const birds=['owl','duck','chick'].filter(k=>F[k]);
  check('the rider really flew a winged horse (above 12 m)',birds.every(k=>F[k].wings&&F[k].topY>12),Object.fromEntries(birds.map(k=>[k,{horse:F[k].horse,topY:F[k].topY}])));
  check('owl, duckling and chick take off and fly at the rider\'s height (aloft on 85% of the flight)',birds.every(k=>F[k].aloft>=0.85),Object.fromEntries(birds.map(k=>[k,F[k].aloft])));
  check('each bird stays within 6 m of the rider in 3D on 90% of the flight, turn included',birds.every(k=>F[k].near>=0.9),Object.fromEntries(birds.map(k=>[k,{near:F[k].near,maxD3:F[k].maxD3}])));
  check('never inside the horse\'s open wings',birds.every(k=>F[k].inWings===0),Object.fromEntries(birds.map(k=>[k,F[k].inWings])));
  check('the birds bank with the horse through the turn, easing with it rather than pinned at a hard tilt',birds.every(k=>F[k].turnN>=4&&F[k].bankMatch>=0.6&&F[k].bankMax<=0.62),Object.fromEntries(birds.map(k=>[k,{n:F[k].turnN,match:F[k].bankMatch,max:F[k].bankMax,spread:F[k].bankSpread}])));
  check('the birds are in the picture through most of the flight',birds.every(k=>F[k].inView>=0.8),Object.fromEntries(birds.map(k=>[k,F[k].inView])));
  check('after landing (the Land button\'s drop and a Shift dive) each bird is on the ground beside the horse within 3.5 s',birds.every(k=>F[k].down!=null&&F[k].down<=3.5&&F[k].last.air==='ground'&&F[k].last.dist<=4),Object.fromEntries(birds.map(k=>[k,{down:F[k].down,last:F[k].last}])));
  check('a landed bird is seen beside the horse, and not behind its wings for long (seen on 70% of the looks 1.5-4.5 s after landing)',birds.every(k=>F[k].final.seen&&F[k].final.dist<=4&&F[k].afterSeen>=0.7),Object.fromEntries(birds.map(k=>[k,{seen:F[k].final.seen,dist:F[k].final.dist,visFrac:F[k].final.visFrac,after:F[k].afterSeen}])));
  if(F.owl)check('the owl and the pegasus still light each other up at the end of the flight',F.owl.comboEnd>0.85,F.owl.comboEnd);
 }
 if(F.dog)check('a dog runs along underneath and is back within 6 m of the rider within 3 s of landing, and seen',F.dog.near6!=null&&F.dog.near6<=3&&F.dog.final.seen,{near6:F.dog.near6,last:F.dog.last,final:{seen:F.dog.final.seen,dist:F.dog.final.dist}});

 /* ---- 7. menus: the stable and the market list pets with their portraits ------------------ */
 if(RUN('menus')){
 const menus=await page.evaluate(async()=>{
  const G=window.__features,out={};
  G.hidePanels();G.ui.openStable();await new Promise(r=>setTimeout(r,200));
  const sp=document.getElementById('stablePanel');const rows=[...sp.querySelectorAll('[data-pet]')].map(b=>b.closest('.evrow'));
  const ports=[...sp.querySelectorAll('.pet-port')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}).filter(w=>w[0]>0);
  out.stable={rows:rows.length,withArt:rows.filter(r=>r&&r.querySelector('svg')).length,owned:(G.save.fresh().petList||[]).length,round:ports.every(w=>Math.abs(w[0]-w[1])<=2&&w[0]<=40),ports:ports.slice(0,4)};
  G.hidePanels();G.ui.openShop('pets');await new Promise(r=>setTimeout(r,300));
  const mp=document.getElementById('shopPanel');const mrows=[...mp.querySelectorAll('[data-pet-row]')];
  out.market={rows:mrows.length,withArt:mrows.filter(r=>r.querySelector('svg.pet-svg')).length,keys:new Set(mrows.map(r=>r.dataset.petRow)).size};
  G.hidePanels();
  return out;
 });
 await page.waitForTimeout(250);
 check('the stable lists every owned pet with its portrait, each a round picture (not stretched into a pill)',menus.stable.rows===menus.stable.owned&&menus.stable.withArt===menus.stable.rows&&menus.stable.rows>0&&menus.stable.round,menus.stable);
 check('the market Pets tab shows every pet with its portrait',menus.market.withArt>=15&&menus.market.keys>=15,menus.market);
 }

 /* ---- 8. reload: the saved pet comes back as itself -------------------------------------- */
 if(RUN('reload')){
  stage('reload');
  const rel={};
  const rpage=await newPage(false);
  await boot(rpage);
  for(const k of keys){
   await rpage.evaluate(k=>{const G=window.__features;G.save.sync(s=>{s.petList=G.pets.PETS3.map(p=>p.key);s.activePet=k;s.companion=null;s.lastPos=null;});},k);
   await boot(rpage,true);
   rel[k]=await rpage.evaluate(([k,H])=>{const Q=window.__QP,G=Q.G;Q.reset(H.x,H.z,H.h);const a=Q.run([],6000,500,'after reload');const o=a[a.length-1];return {active:G.pets.active(),key:o.key,model:o.model,seen:a.slice(-3).filter(q=>q.seen&&q.dist<=3.5).length>=2,looks:a.slice(-3).map(q=>q.seen?1:0).join(''),dist:o.dist,inView:o.inView,visPx:o.visPx,visFrac:o.visFrac};},[k,HOME]);
  }
  console.log('   reload: '+JSON.stringify(rel));
  check('after a reload every saved pet comes back as itself, not a puppy',keys.every(k=>rel[k].active===k&&rel[k].key===k&&rel[k].model===k),Object.fromEntries(keys.map(k=>[k,rel[k].model])));
  check('after a reload every pet is seen beside the rider (two of the last three looks)',keys.every(k=>rel[k].seen),Object.fromEntries(keys.filter(k=>!rel[k].seen).map(k=>[k,rel[k]])));
  await rpage.context().close();
 }

 /* ---- 9. a phone held upright ------------------------------------------------------------- */
 if(RUN('mobile')){
  stage('mobile');
  const mp=await newPage(true);
  await boot(mp);
  const mob={};
  for(const k of ['dog','chick','owl','goat'].filter(k=>!ONLY||ONLY.includes(k))){
   mob[k]=await mp.evaluate(([k,H])=>{const Q=window.__QP,G=Q.G;G.save.sync(s=>{s.petList=G.pets.PETS3.map(p=>p.key);s.companion=null;});G.hidePanels();Q.reset(H.x,H.z,H.h);
    if(G.pets.active()!==k)G.pets.setActive(k);
    const st=Q.run([],4000,500,'stand');const gal=Q.run(['KeyW','ShiftLeft'],5000,500,'gallop');const st2=Q.run([],3000,500,'stop');
    return {stand:{seen:st.slice(-3).filter(o=>o.seen).length>=2,looks:st.slice(-3).map(o=>o.seen?1:0).join(''),dist:st[st.length-1].dist},gallopSeen:Q.frac(gal.slice(4)),stop:{seen:st2.slice(-3).filter(o=>o.seen).length>=2,looks:st2.slice(-3).map(o=>o.seen?1:0).join(''),dist:st2[st2.length-1].dist}};},[k,HOME]);
  }
  /* a cancelled course: seen, and not under the buttons and the prompt */
  const cc={};
  for(const k of ['dog','chick','owl','goat'].filter(k=>!ONLY||ONLY.includes(k))){
   cc[k]=await mp.evaluate(([k,H,ev])=>{const Q=window.__QP,G=Q.G;G.hidePanels();Q.reset(H.x,H.z,H.h);if(G.pets.active()!==k)G.pets.setActive(k);Q.run([],1500,1500,'settle',true);
    const E=G.tables.EVENTS3.find(x=>x.id===ev);try{G.course.startCourse(E,1);}catch(e){}Q.run([],3000,1000,'count',true);try{G.course.cancelCourse();}catch(e){}
    const a=Q.run([],5000,500,'cancelled');const last=a.slice(-3);return {looks:last.map(o=>o.seen?1:0).join(''),ui:last.map(o=>o.ui),ok:last.filter(o=>o.seen&&o.ui<=0.34).length>=2,dist:a[a.length-1].dist};},[k,HOME,ev]);
  }
  const mflights={};
  for(const k of ['owl','chick'].filter(k=>!ONLY||ONLY.includes(k)))mflights[k]=await mp.evaluate(([k,H])=>window.__QP.fly(k,'button',H),[k,HOME]);
  console.log('   phone: '+JSON.stringify({mob,cc,flights:Object.fromEntries(Object.keys(mflights).map(k=>[k,{near:mflights[k].near,inView:mflights[k].inView,inWings:mflights[k].inWings,down:mflights[k].down,final:{seen:mflights[k].final.seen,dist:mflights[k].final.dist,visFrac:mflights[k].final.visFrac},after:mflights[k].afterSeen,afterUi:mflights[k].afterUi}]))}));
  const mk=Object.keys(mob);
  if(mflights.owl){const mf=mflights.owl;check('on a phone the owl flies above and behind the rider, in the picture, and lands beside the horse',mf.near>=0.9&&mf.inView>=0.7&&mf.inWings===0&&mf.down!=null&&mf.down<=3.5&&mf.final.seen,{near:mf.near,inView:mf.inView,inWings:mf.inWings,down:mf.down,final:{seen:mf.final.seen,dist:mf.final.dist}});}
  const mfk=Object.keys(mflights);
  if(mfk.length)check('on a phone a bird that lands beside a pegasus is seen, not hidden behind its wings (70% of the looks 1.5-4.5 s after landing)',mfk.every(k=>mflights[k].afterSeen>=0.7),Object.fromEntries(mfk.map(k=>[k,mflights[k].afterSeen])));
  if(mk.length)check('on a phone held upright pets are seen standing, galloping and after stopping',mk.every(k=>mob[k].stand.seen&&mob[k].gallopSeen>=0.7&&mob[k].stop.seen),mob);
  const ck=Object.keys(cc);
  if(ck.length)check('on a phone, after cancelling a course, the pet is seen beside the rider and not under the buttons',ck.every(k=>cc[k].ok),cc);
  await mp.context().close();
 }

 stage('done');
 /* A reload revokes the model textures still loading on the page before it. The one error let through by
    name is se-horses.js's (My Horses, not a pet file): it awaits renderer.compileAsync on a portrait it may
    put away first when the screen is opened and closed quickly. three.js reports it from inside compileAsync's
    own timer (checkMaterialsReady), and se-horses.js:417 is the only caller of compileAsync in the game, so
    only an 'isReady' error with that frame on its stack is let through. */
 const hard=errors.filter(e=>!/Breed model unavailable|favicon|WebGL|GPU stall|THREE.WebGLRenderer|net::ERR|Failed to load resource|mqtt|WebSocket|GLTFLoader: Couldn't load texture blob/i.test(e)&&!(/reading 'isReady'/.test(e)&&/checkMaterialsReady/.test(e)));
 check('no page errors',hard.length===0,hard.slice(0,6));
 const bad=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-bad.length)+'/'+checks.length+' checks passed');
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(_){}process.exit(2);});
