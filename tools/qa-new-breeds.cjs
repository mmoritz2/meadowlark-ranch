/* new-breeds package check (assets/features/new-breeds.js).

   Boots ranch3d.html?qa=new-breeds and proves: every new breed exists with its label, rarity, stars,
   source, ceilings, mastery perks, named coats (the real breeds) or coat theme (the fantasy ones),
   a Market preview painting and a line of description; each one can be granted and ridden without an
   error and renders on the body it was aliased to in its intended colours (a real breed in its first
   named coat at the exact colours keeps its own mane dyed on), and makeHorse builds it;
   the Chameleon Mustang's coat follows the ground under it — its live coat colours measurably change
   between meadow grass, Coyote Canyon sand and Hollowpeak snow, shimmer as they change and settle
   within a few seconds, and the rendered horse itself changes colour on screen; it camouflages in the
   pasture too; a Chameleon foal of a mixed pairing keeps the live coat, Suffolk foals are never the
   Percheron's authored grey, two Chameleons do not share a blotch layout; the wild herd draws the
   Camargue white and a tamed one stays white; a body dye switches the camouflage off (and Horse Care
   says so) until the coat is its own again; it is bought for its gem price in the Market (with a
   confirmation, gems go down by the price and the horse arrives) and refused without enough gems, and
   the shop's buy refuses horses that are not on the shelf; the Starfall Call prints its chance and can
   hand it out; the Lusitano and the Firefly Arabian are in the summon pools, the Camargue is wild, a
   week of five riding days brings the Daybreak Haflinger once (directly, and through the week closing
   at start-up); My Horses groups the new breeds; saving and reloading keeps them all; and there are
   no page errors.

   Usage:  QA_PORT=8431 NODE_PATH=$(npm root -g) node tools/qa-new-breeds.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const base=QA.BASE;
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
const KEYS=['chameleon','connemara','suffolk','rockymtn','hanover','camargue','lusitano','firefly','opaline','daybreak'];
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[], netBad=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
 page.on('response',r=>{if(r.status()>=400)netBad.push(r.status()+' '+r.url());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(base+'/ranch3d.html?qa=new-breeds&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:180000,polling:250}); stage('horseReady');
 const waitReady=async()=>{await page.waitForTimeout(250);await page.waitForFunction(READY,null,{timeout:120000,polling:250});};
 await page.evaluate(()=>{const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&window.__features.wardrobe)window.__features.wardrobe.closeChar();});

 /* ---- 1. the rows ------------------------------------------------------------------------------ */
 const A=await page.evaluate(async(KEYS)=>{
  const G=window.__features,T=G.tables,R=G.horse.roster,NB=G.newBreeds,out={};
  out.installed=G.installed.includes('new-breeds'); out.errors=G.errors.slice();
  const bk=k=>T.BREEDS3.find(b=>b[0]===k), keys=T.BREEDS3.map(b=>b[0]);
  out.dup=keys.filter((k,i)=>keys.indexOf(k)!==i);
  out.rows=KEYS.map(k=>{const b=bk(k);if(!b)return {k,missing:true};const o=b[7];
   return {k,label:b[1],tier:b[2],coins:b[3],gems:b[4],src:G.horse.breedSrc(b),stars:R.starsN({breed:k}),lbl:G.horse.breedLabel(k),
    shop:G.horse.breedAvailable(b,'shop'),summon:G.horse.breedAvailable(b,'summon'),market:G.horse.breedAvailable(b,'market'),
    ceil:['speed','stamina','jump','accel','agility'].map(s=>G.xp.statCeil({breed:k},s)),perk5:!!(R.BREED_PERKS[k]&&R.BREED_PERKS[k][5]),mx:G.mastery?G.mastery.maxOf(k):null,
    coats:(R.COATS3[k]||[]).length,badMarks:(R.COATS3[k]||[]).filter(v=>v[4]&&T.MARKS[v[4]]===undefined).length,coat:o.coat||null,
    model:G.horse.breedModels.resolve(k),desc:!!NB.DESC[k],how:String(R.howToGet(b)||'')};});
  out.themes=['camo','firefly','opal','dawn'].map(t=>({t,cfg:!!T.FANTASY_CFG[t],base:!!T.COAT_BASE[t],coat:!!T.FANTASY_COAT[t],wing:!!T.WING_TINT[t]}));
  out.wild=(T.WILD_BREEDS||[]).filter(w=>w.breed==='camargue').map(w=>w.region);
  out.genes=G.breeding?['connemara','suffolk','rockymtn','hanover','camargue','lusitano'].filter(k=>!G.breeding.BREED_GENES[k]):['no breeding'];
  out.cost=G.breeding?G.breeding.breedCost({breed:'chameleon'},{breed:'connemara'}):null;
  out.costReal=G.breeding?G.breeding.breedCost({breed:'suffolk'},{breed:'connemara'}):null;
  /* the Market preview paintings: index.json lists them and each file is there */
  const idx=await fetch('assets/breed-thumbnails/index.json',{cache:'no-store'}).then(r=>r.json());
  out.thumbs=[];for(const k of KEYS){const r=await fetch('assets/breed-thumbnails/'+k+'.webp',{cache:'no-store'});out.thumbs.push([k,idx.includes(k),r.status]);}
  /* the ground reader. Trees are planted afresh each session (world-flora), so the open meadow spot is
     looked for rather than assumed: the first point in the basin meadows reading pure meadow grass. */
  const want=(()=>{const c=new G.THREE.Color(NB.GROUNDS.meadow[2]);return '#'+c.getHexString();})();
  out.spot=null;
  for(const [x0,z0] of [[80,-60],[60,-100],[20,-120],[0,-80],[40,-140],[100,20],[80,80]]){if(out.spot)break;for(let dx=0;dx<=12&&!out.spot;dx+=4)for(let dz=0;dz<=12&&!out.spot;dz+=4){const g=NB.groundAt(x0+dx,z0+dz);if(g.key==='meadow'&&g.base===want)out.spot=[x0+dx,z0+dz];}}
  if(!out.spot)out.spot=[80,-60];
  out.ground={grass:NB.groundAt(out.spot[0],out.spot[1]),desert:NB.groundAt(-230,140),snow:NB.groundAt(-150,-215),river:NB.groundAt(40,G.world.riverZ(40)+3),arena:NB.groundAt(0,0)};
  return out;
 },KEYS);
 check('package installed without error, no duplicate breed keys',A.installed&&A.errors.length===0&&A.dup.length===0,{errors:A.errors,dup:A.dup});
 const row=k=>A.rows.find(r=>r.k===k)||{};
 check('every new breed exists with a label, a rarity, a source and a line of description',A.rows.every(r=>!r.missing&&r.label&&r.lbl===r.label&&r.tier&&r.src&&r.desc&&r.how),A.rows.map(r=>[r.k,r.label,r.tier,r.src]));
 check('the Chameleon Mustang: Mythic, five stars, 100 gems on the shelf, never on the market board or in a summon pool',(()=>{const c=row('chameleon');return c.tier==='Mythic'&&c.stars===5&&c.gems===100&&c.coins===0&&c.src==='shop'&&c.shop&&!c.summon&&!c.market&&c.coat==='camo';})(),row('chameleon'));
 check('sources: four real breeds for coins in the shop, the Opaline Unicorn for gems, the Lusitano and Firefly from summons, the Camargue wild, the Daybreak from a week of riding',
  ['connemara','suffolk','rockymtn','hanover'].every(k=>row(k).shop&&row(k).coins>0&&row(k).gems===0)&&row('opaline').shop&&row('opaline').gems>0
  &&row('lusitano').summon&&!row('lusitano').shop&&row('firefly').summon&&!row('firefly').shop&&row('camargue').src==='wild'&&!row('camargue').shop&&!row('camargue').summon&&A.wild.includes('meadows')
  &&row('daybreak').src==='loyal'&&!row('daybreak').shop&&!row('daybreak').summon&&!row('daybreak').market&&/five different days/.test(row('daybreak').how),
  A.rows.map(r=>[r.k,r.src,r.shop,r.summon,r.market]));
 check('stars across the rarities: Common/Draft 2, Uncommon/Rare 3, Epic 4, Legendary/Mythic 5',
  row('connemara').stars===2&&row('suffolk').stars===2&&row('rockymtn').stars===3&&row('hanover').stars===3&&row('camargue').stars===3&&row('lusitano').stars===4&&['chameleon','firefly','opaline','daybreak'].every(k=>row(k).stars===5),A.rows.map(r=>[r.k,r.stars]));
 check('stat ceilings, mastery perks and the right mastery ladder (10 for a real breed, 5 for a fantasy one)',A.rows.every(r=>r.ceil.every(v=>v>=5&&v<=10)&&r.perk5)&&['connemara','suffolk','rockymtn','hanover','camargue','lusitano'].every(k=>row(k).mx===10)&&['chameleon','firefly','opaline','daybreak'].every(k=>row(k).mx===5),A.rows.map(r=>[r.k,r.ceil.join(''),r.mx]));
 check('named coats on the six real breeds (marks valid), a coat theme on the four fantasy ones, mirrored into every table',['connemara','suffolk','rockymtn','hanover','camargue','lusitano'].every(k=>row(k).coats>=3&&row(k).badMarks===0)&&['chameleon','firefly','opaline','daybreak'].every(k=>row(k).coat)&&A.themes.every(t=>t.cfg&&t.base&&t.coat&&t.wing),{coats:A.rows.map(r=>[r.k,r.coats]),themes:A.themes});
 check('each stands on an authored body; breeding knows their genes and their rarity cost',A.rows.every(r=>r.model&&r.model!==r.k&&r.model!=='bay'||r.k==='bay')&&A.genes.length===0&&A.cost&&A.cost.rarity==='Mythic'&&A.costReal&&A.costReal.rarity==='Draft',{models:A.rows.map(r=>[r.k,r.model]),genes:A.genes,cost:A.cost,costReal:A.costReal});
 check('a Market preview painting for every new breed',A.thumbs.every(t=>t[1]&&t[2]===200),A.thumbs);
 check('the ground reader: meadow, canyon sand, snow, riverbank and arena sand each have their own palette',A.ground.grass.key==='meadow'&&A.ground.desert.key==='desert'&&A.ground.snow.key==='snow'&&A.ground.river.key==='river'&&A.ground.arena.key==='arena'
  &&new Set([A.ground.grass.base,A.ground.desert.base,A.ground.snow.base,A.ground.river.base]).size===4,A.ground);

 /* ---- 2. grant, ride and render each ---------------------------------------------------------- */
 /* each real breed wears its first named coat at its exact colours, as the roster's coat button
    (applyVariant) puts it on: the case where a mane equal to the row's mane column used to switch the
    mane dye off and show the borrowed model's own hair */
 await page.evaluate((KEYS)=>{const G=window.__features,R=G.horse.roster;G.save.sync(s=>{s.unlocked=s.unlocked||{};for(const k of ['coyote','hollowpeak','barleyfold','falls'])s.unlocked[k]=Date.now();
   for(const k of KEYS){const h=G.horse.grantHorse(s,k,{src:'qa'});const v=(R.COATS3[k]||[])[0];if(!v)continue;
    h.variant=v[0];h.colors={body:v[2],mane:v[3]};if(v[4]){h.mark=v[4];if(v[5])h.markCol=v[5];else delete h.markCol;}else{delete h.mark;delete h.markCol;}h.mark2=null;}});G.horse.reloadHorses();
  document.querySelectorAll('#seHudRoot,#toasts,#questTrack,#mini,#seWay').forEach(e=>e.style.visibility='hidden');
  /* a side-on camera for the pictures: owns the camera only while window.__side is set */
  G.on('camera',o=>{if(!window.__side)return;const p=G.horse.player,h=p.heading,d=window.__side;const gy=G.world.groundH(p.pos.x,p.pos.z);G.camera.position.set(p.pos.x+Math.cos(h)*d,gy+1.5,p.pos.z-Math.sin(h)*d);G.camera.lookAt(p.pos.x,gy+1.05,p.pos.z);return true;});},KEYS);
 const ridden=[];
 for(const k of KEYS){
  await page.evaluate((k)=>{const G=window.__features;const i=G.horse.myHorses.findIndex(h=>h.breed===k);G.ranchSys.setRideIdx(i);G.horse.rebuildAll();},k);
  await waitReady();
  const r=await page.evaluate(({k,spot})=>{const G=window.__features,p=G.horse.player;p.pos.set(spot[0],0,spot[1]);p.speed=0;p.heading=0.4;
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));window.advanceTime(1200);window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.advanceTime(400);
   const st=JSON.parse(render_game_to_text()),R=G.horse.RIG(),m=R.skin.material,h=G.horse.ridden(),row=G.tables.BREEDS3.find(b=>b[0]===k),o=row[7];
   const parts=G.horse.makeHorse({colors:h.colors,horn:h.horn,wings:h.wings,dragon:h.dragon,coat:h.coat,tack:null,seed:h.id,breed:h.breed});let meshes=0;parts.group.traverse(x=>{if(x.isMesh)meshes++;});
   const dyes=[];R.scene.traverse(x=>{if(x.isMesh){for(const mm of [].concat(x.material)){const d=mm&&mm.userData&&mm.userData.artistGroomDye;if(d&&dyes.indexOf(d)<0)dyes.push(d);}}});
   const hex=c=>c?'#'+c.getHexString():null;
   return {k,breed:h.breed,requested:st.graphics.horseBreed,model:st.graphics.horseModel,moved:Math.hypot(p.pos.x-spot[0],p.pos.z-spot[1]),mat:m.name||m.type,
    col:m.userData&&m.userData.col?hex(m.userData.col):null,body:h.colors&&h.colors.body,mark:h.mark,coat:h.coat||null,want:o.coat||null,meshes,
    mane:dyes.length?hex(dyes[0].mane):null,maneOn:dyes.length?dyes[0].maneOverride:null,maneCol:o.maneCol||null,horseMane:h.colors&&h.colors.mane,variant:h.variant||null,horn:!!h.horn};},{k,spot:A.spot});
  ridden.push(r);
 }
 stage('ridden');
 const near=(a,b)=>{if(!a||!b)return false;const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const A1=p(a),B1=p(b);return Math.max(...A1.map((v,i)=>Math.abs(v-B1[i])))<=3;};
 check('each new breed can be ridden: it is the horse under the rider, on its own body, and it moves',ridden.every(r=>r.breed===r.k&&r.requested===r.k&&r.model===row(r.k).model&&r.moved>1),ridden.map(r=>[r.k,r.model,+r.moved.toFixed(1)]));
 check('the real breeds render in their own coat colour (the coat shader carries the horse\'s body colour and pattern)',ridden.filter(r=>!r.want).every(r=>near(r.col,r.body)&&r.mark!=null),ridden.filter(r=>!r.want).map(r=>[r.k,r.col,r.body,r.mark]));
 check('each real breed in its first named coat at the exact colours keeps its own mane dyed on (not the borrowed model\'s hair)',ridden.filter(r=>!r.want).every(r=>r.variant&&r.maneOn===1&&near(r.mane,r.horseMane)),ridden.filter(r=>!r.want).map(r=>[r.k,r.variant,r.horseMane,r.mane,r.maneOn]));
 check('the fantasy horses wear their themes (the Chameleon its live camouflage coat) and their own mane',ridden.filter(r=>r.want).every(r=>r.coat===r.want&&(r.k==='chameleon'?r.mat==='EquineFantasy_camo_live':r.mat==='EquineFantasy_'+r.want)&&(r.k==='chameleon'||(r.maneOn===1&&near(r.mane,r.maneCol))))&&ridden.find(r=>r.k==='opaline').horn,
  ridden.filter(r=>r.want).map(r=>[r.k,r.mat,r.mane,r.maneCol,r.maneOn]));
 check('makeHorse builds every one of them',ridden.every(r=>r.meshes>5),ridden.map(r=>[r.k,r.meshes]));

 /* ---- 3. the camouflage ---------------------------------------------------------------------- */
 await page.evaluate(()=>{const G=window.__features;const i=G.horse.myHorses.findIndex(h=>h.breed==='chameleon');G.ranchSys.setRideIdx(i);G.horse.rebuildAll();});
 await waitReady();
 const goTo=async(x,z,h)=>await page.evaluate(({x,z,h})=>{const G=window.__features,p=G.horse.player;p.pos.set(x,0,z);p.speed=0;p.heading=h;
   const trace=[];let glow=0;for(let i=0;i<24;i++){window.advanceTime(250);const c=G.newBreeds.camo();trace.push(c?c.off:null);glow=Math.max(glow,c?c.glow:0);}
   const c=G.newBreeds.camo();return {c,trace,glow,settleAt:(()=>{for(let i=0;i<trace.length;i++)if(trace[i]!=null&&trace[i]<0.01)return (i+1)*0.25;return null;})()};},{x,z,h});
 /* what is on screen: the horse with and without it drawn, the difference is the horse */
 const onScreen=async()=>{
  /* the camera placed, then both frames drawn at the same instant (a zero step), so the wind in the grass
     cannot pass for a difference */
  await page.evaluate(()=>{const G=window.__features,p=G.horse.player;window.__side=5.4;if(p.rider)p.rider.g.visible=false;const T=G.horse.TACK();if(T&&T.saddle)T.saddle.visible=false;if(T&&T.bridle)T.bridle.visible=false;window.advanceTime(16);window.advanceTime(0);});
  const clip={x:300,y:140,width:680,height:560};
  const a=(await page.screenshot({clip})).toString('base64');
  await page.evaluate(()=>{window.__features.horse.player.mesh.visible=false;window.advanceTime(0);});
  const b=(await page.screenshot({clip})).toString('base64');
  await page.evaluate(()=>{const G=window.__features,p=G.horse.player;p.mesh.visible=true;if(p.rider)p.rider.g.visible=true;const T=G.horse.TACK();if(T&&T.saddle)T.saddle.visible=true;if(T&&T.bridle)T.bridle.visible=true;window.__side=0;window.advanceTime(16);});
  return await page.evaluate(async({a,b})=>{const load=async s=>{const im=new Image();im.src='data:image/png;base64,'+s;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height).data;};
   const A1=await load(a),B1=await load(b);let n=0;const h=[0,0,0];for(let i=0;i<A1.length;i+=4){const d=Math.abs(A1[i]-B1[i])+Math.abs(A1[i+1]-B1[i+1])+Math.abs(A1[i+2]-B1[i+2]);if(d>40){n++;h[0]+=A1[i];h[1]+=A1[i+1];h[2]+=A1[i+2];}}
   return {n,rgb:h.map(v=>Math.round(v/Math.max(1,n)))};},{a,b});
 };
 const grass=await goTo(A.spot[0],A.spot[1],0.4); const grassPx=await onScreen();
 const desert=await goTo(-230,140,1.2); const desertPx=await onScreen();
 const snow=await goTo(-150,-215,0.3); const snowPx=await onScreen();
 const river=await goTo(40,await page.evaluate(()=>window.__features.world.riverZ(40)+3),1.57);
 stage('camouflage');
 const hx=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 const dist=(a,b)=>{const A1=hx(a),B1=hx(b);return Math.hypot(A1[0]-B1[0],A1[1]-B1[1],A1[2]-B1[2]);};
 const G1=grass.c,D1=desert.c,S1=snow.c,W1=river.c;
 check('the live coat is on the ridden horse and its colours are in the renderer (the uniform is the colour we set)',[G1,D1,S1].every(c=>c&&c.live&&c.bound&&c.uniform===c.base),{grass:G1&&[G1.live,G1.bound,G1.uniform,G1.base]});
 check('it reads the ground: meadow on grass, canyon sand in Coyote Canyon, snow at Hollowpeak, the water by the river',G1.ground==='meadow'&&D1.ground==='desert'&&S1.ground==='snow'&&W1.ground==='river',[G1.ground,D1.ground,S1.ground,W1.ground]);
 check('its coat colour measurably changes between grass, sand and snow (and the river)',dist(G1.base,D1.base)>60&&dist(D1.base,S1.base)>40&&dist(G1.base,S1.base)>80&&dist(G1.base,W1.base)>40,{grass:G1.base,desert:D1.base,snow:S1.base,river:W1.base});
 check('it blends over a second or two (not a jump) and settles within a few seconds, shimmering as it changes',[desert,snow].every(r=>r.settleAt!=null&&r.settleAt>=0.75&&r.settleAt<=4&&r.trace[0]>0.02&&r.glow>0.2)&&D1.settled&&S1.settled,
  {desert:{at:desert.settleAt,first:desert.trace[0],glow:desert.glow},snow:{at:snow.settleAt,first:snow.trace[0],glow:snow.glow}});
 const warm=p=>p.rgb[0]-p.rgb[1], lum=p=>p.rgb[0]*0.3+p.rgb[1]*0.59+p.rgb[2]*0.11;   // warm: red over green, which is sand against grass
 /* The scenes are lit by the game's own clock and weather (Hollowpeak's light varies most), so the colours are
    judged by their balance more than their brightness: green over red and blue on the grass, red well over
    blue in the canyon, blue over red and green in the snow, and paler in the snow than on the grass. */
 check('on screen the horse itself changes: green on the grass, warm sand in the canyon, pale in the snow',grassPx.n>3000&&desertPx.n>3000&&snowPx.n>3000&&grassPx.rgb[1]>=grassPx.rgb[0]&&grassPx.rgb[1]>grassPx.rgb[2]&&warm(desertPx)>warm(grassPx)+15&&desertPx.rgb[0]>desertPx.rgb[2]+20&&lum(snowPx)>lum(grassPx)+10&&snowPx.rgb[2]>snowPx.rgb[0]+10&&snowPx.rgb[2]>snowPx.rgb[1],{grass:grassPx,desert:desertPx,snow:snowPx});
 const herd=await page.evaluate(async()=>{const G=window.__features;
  G.save.sync(s=>{const i=s.horses.findIndex(h=>h.breed==='chameleon');s.horses[i].out=true;const j=s.horses.findIndex(h=>h.breed==='suffolk');s.horses[j].out=false;});G.horse.reloadHorses();
  const j=G.horse.myHorses.findIndex(h=>h.breed==='connemara');G.ranchSys.setRideIdx(j);G.horse.rebuildAll();
  const p=G.horse.player;p.pos.set(-60,0,-10);p.speed=0;
  let ent=null;for(let t=0;t<60;t++){window.advanceTime(250);ent=G.horse.herd().find(a=>G.horse.myHorses[a.idx]&&G.horse.myHorses[a.idx].breed==='chameleon');if(ent&&ent.rig&&G.newBreeds.stateOf(ent.rig.skin))break;await new Promise(r=>setTimeout(r,30));}
  const st=ent&&ent.rig?G.newBreeds.stateOf(ent.rig.skin):null;
  return {found:!!ent,rig:!!(ent&&ent.rig),st,at:ent?[+ent.pos.x.toFixed(1),+ent.pos.z.toFixed(1)]:null,ground:ent?G.newBreeds.groundAt(ent.pos.x,ent.pos.z).key:null,mat:ent&&ent.rig?ent.rig.skin.material.name:null};});
 check('out in the pasture it camouflages too (its own live coat, reading the ground it stands on)',herd.found&&herd.rig&&herd.st&&herd.st.live&&herd.mat==='EquineFantasy_camo_live'&&herd.st.ground===herd.ground,herd);

 /* ---- 3b. foals, a second Chameleon, the wild Camargue, taming, a dyed Chameleon ------------- */
 /* Foals are made on the live save with the game's timers held (no toasts), and the ones not kept are
    taken away again with the save's companion and foal queue put back as they were. */
 const FO=await page.evaluate(async()=>{const G=window.__features,H=G.horse,out={};let ids={};
  const st0=window.setTimeout; window.setTimeout=()=>0;
  try{G.save.sync(s=>{const keepC=s.companion,keepQ=s.foalq?JSON.parse(JSON.stringify(s.foalq)):s.foalq;
   const mk=k=>{const h=H.grantHorse(s,k,{src:'qa'});h.bond=80;return h;};
   const c1=mk('chameleon'),cn=mk('connemara'),s1=mk('suffolk'),s2=mk('suffolk');
   let fx=null;const cross=[];for(let i=0;i<80&&!fx;i++){const f=H.makeFoal(s,c1,cn,{src:'breed'});cross.push(f);if(f.breed==='chameleon'&&f.coat==='camo')fx=f;}
   const sf=[];for(let i=0;i<20;i++)sf.push(H.makeFoal(s,s1,s2,{src:'breed'}));
   out.cross=cross.length; out.fx=fx?{breed:fx.breed,coat:fx.coat,body:fx.colors.body,mark:fx.mark===undefined?'undef':fx.mark,mark2:fx.mark2||null}:null;
   out.suffolkMarks=sf.map(f=>f.mark==null?'undef':f.mark);
   const keepS=sf[0];
   s.horses=s.horses.filter(h=>!h.foal||h===fx||h===keepS);
   for(const f of [fx,keepS]){if(!f)continue;f.foal=false;f.born=Date.now()-9e8;}
   for(const h of s.horses)h.out=false; for(const h of [fx,keepS,c1])if(h)h.out=true;
   s.companion=keepC; s.foalq=keepQ;
   ids={fx:fx&&fx.id,sf:keepS.id,c1:c1.id,cn:cn.id};});}finally{window.setTimeout=st0;}
  H.reloadHorses();
  const j=H.myHorses.findIndex(h=>h.id===ids.cn);G.ranchSys.setRideIdx(j);H.rebuildAll();
  const p=H.player;p.pos.set(-60,0,-10);p.speed=0;
  const want=[ids.fx,ids.sf,ids.c1].filter(x=>x!=null);let found={};
  for(let t=0;t<120;t++){window.advanceTime(250);await new Promise(r=>setTimeout(r,30));found={};
   for(const a of H.herd()){const h=H.myHorses[a.idx];if(!h||!want.includes(h.id)||!a.rig||a.rigStandIn)continue;found[h.id]=a;}
   if(want.every(id=>found[id]&&(id===ids.sf||G.newBreeds.stateOf(found[id].rig.skin))))break;}
  const look=id=>{const a=found[id];if(!a)return null;const m=a.rig.skin.material,src=m.map&&m.map.image&&(m.map.image.currentSrc||m.map.image.src||'');
   return {mat:m.name||m.type,map:src?src.split('/').pop():null,model:a.rig.profile&&a.rig.profile.id,st:G.newBreeds.stateOf(a.rig.skin)};};
  out.crossFoal=look(ids.fx); out.suffolkFoal=look(ids.sf); out.second=look(ids.c1);
  out.ids=ids;
  return out;});
 check('a Chameleon Mustang foal from a mixed pairing (with a Connemara) keeps the live camouflage coat',FO.fx&&FO.fx.mark==='none'&&!FO.fx.mark2&&FO.crossFoal&&FO.crossFoal.mat==='EquineFantasy_camo_live'&&FO.crossFoal.st&&FO.crossFoal.st.live,{fx:FO.fx,look:FO.crossFoal&&{mat:FO.crossFoal.mat,live:FO.crossFoal.st&&FO.crossFoal.st.live},tries:FO.cross});
 check('Suffolk Punch foals always have a pattern set, so a grown one is a plain chestnut and not the Percheron\'s authored dapple grey',FO.suffolkMarks.every(m=>m!=='undef')&&FO.suffolkFoal&&FO.suffolkFoal.model==='percheron'&&/bay-study/.test(FO.suffolkFoal.map||'')&&!/percheron/i.test(FO.suffolkFoal.mat),{marks:FO.suffolkMarks.join(','),look:FO.suffolkFoal&&{mat:FO.suffolkFoal.mat,map:FO.suffolkFoal.map,model:FO.suffolkFoal.model}});
 check('two Chameleons in one pasture each have their own blotch layout',FO.second&&FO.second.st&&FO.crossFoal&&FO.crossFoal.st&&JSON.stringify(FO.second.st.seed)!==JSON.stringify(FO.crossFoal.st.seed),{a:FO.second&&FO.second.st&&FO.second.st.seed,b:FO.crossFoal&&FO.crossFoal.st&&FO.crossFoal.st.seed});
 /* the wild herd draws a horse from its breed alone (world.js: makeHorse, then dressWithRig with {breed}) */
 const WI=await page.evaluate(async()=>{const G=window.__features,H=G.horse,col={body:'#c9cac5',mane:'#e6e4de'};
  const parts=H.makeHorse({colors:col,seed:3,breed:'camargue'});parts.group.position.set(-52,G.world.groundH(-52,-6),-6);G.scene.add(parts.group);const e={parts};
  for(let t=0;t<300;t++){H.dressWithRig(e,parts,col,{breed:'camargue'});if(e.rig&&!e.rigStandIn)break;window.advanceTime(100);await new Promise(r=>setTimeout(r,50));}
  const m=e.rig&&e.rig.skin.material,src=m&&m.map&&m.map.image&&(m.map.image.currentSrc||m.map.image.src||'');
  const out={rig:!!e.rig,standIn:!!e.rigStandIn,model:e.rig&&e.rig.profile&&e.rig.profile.id,resolve:H.breedModels.resolve('camargue'),mat:m?(m.name||m.type):null,map:src?src.split('/').pop():null};
  try{G.ranchSys.disposeHorseEnt(e);}catch(x){} if(parts.group.parent)parts.group.parent.remove(parts.group);
  /* taming: 200 wild Camargues on a copy of the save (the game's timers held, so no toasts) */
  const s=JSON.parse(JSON.stringify(G.save.fresh())), lum=h=>{const n=parseInt(String(h).slice(1),16);return (((n>>16)&255)*0.299+((n>>8)&255)*0.587+(n&255)*0.114)/255;};
  const st0=window.setTimeout; window.setTimeout=()=>0; const coats={}; let pale=0,n=0;
  try{for(let i=0;i<200;i++){const h=H.grantHorse(s,'camargue',{src:'wild',colors:{body:'#c9cac5',mane:'#e6e4de'},bond:20});n++;if(lum(h.colors.body)>0.7&&lum(h.colors.mane)>0.7)pale++;const k=(h.wild&&h.wild.coat)||'-';coats[k]=(coats[k]||0)+1;}}finally{window.setTimeout=st0;}
  out.tame={n,pale,coats};
  return out;});
 check('the wild Camargue in the herd is drawn white (the Lipizzaner\'s authored pale grey), not a chestnut Haflinger',WI.rig&&!WI.standIn&&WI.model==='lipiz'&&WI.resolve==='lipiz'&&WI.mat&&!/haflinger/i.test(WI.mat)&&!/haflinger/i.test(WI.map||''),WI);
 check('a tamed Camargue stays a white horse every time (200 of 200), now and then in its own rare wild coat',WI.tame.n===200&&WI.tame.pale===200&&!WI.tame.coats['Mountain Dun']&&(WI.tame.coats['Salt-marsh White']||0)>40,WI.tame);
 /* a Chameleon whose body is dyed in Horse Style: no camouflage while the dye lasts, and Horse Care says so */
 await page.evaluate((ids)=>{const G=window.__features;const i=G.horse.myHorses.findIndex(h=>h.id===ids.c1);G.ranchSys.setRideIdx(i);G.horse.rebuildAll();},FO.ids);
 await waitReady();
 const DY=await page.evaluate(async()=>{const G=window.__features,NB=G.newBreeds,p=G.horse.player;p.pos.set(-230,0,140);p.speed=0;for(let i=0;i<8;i++)window.advanceTime(250);
  const before={camo:!!(NB.camo()&&NB.camo().live),riding:NB.ridingCamo()};
  G.save.sync(s=>{s.coins=(s.coins||0)+500;});G.money.refreshWallet();
  G.ui.openShop('style');await new Promise(r=>setTimeout(r,400));
  const bb=[...document.querySelectorAll('#shopPanel [data-dye^="body:"]')][1];const dye=bb?bb.dataset.dye:null;if(bb)bb.click();await new Promise(r=>setTimeout(r,400));
  G.hidePanels();for(let i=0;i<8;i++)window.advanceTime(250);
  const R=G.horse.RIG(),h=G.horse.ridden();
  const after={camo:NB.camo(),riding:NB.ridingCamo(),mat:R.skin.material.name||R.skin.material.type,body:h.colors.body,covered:NB.covered(h)};
  G.ui.openCare();await new Promise(r=>setTimeout(r,500));
  const cp=document.getElementById('carePanel');const t=cp?cp.textContent:'';const m=t.match(/Camouflage[^.:]*[.:]/);after.care=m?m[0]:null;
  G.hidePanels();window.resumeGame&&window.resumeGame();
  /* and back to its own coat: the camouflage returns */
  const b=G.tables.BREEDS3.find(x=>x[0]==='chameleon');G.save.sync(s=>{const x=s.horses.find(q=>q.id===h.id);x.colors.body=b[5];});G.horse.reloadHorses();G.horse.rebuildAll();
  return {dye,before,after};});
 await waitReady();
 const DY2=await page.evaluate(()=>{const G=window.__features,NB=G.newBreeds;for(let i=0;i<8;i++)window.advanceTime(250);const c=NB.camo();return {live:!!(c&&c.live),riding:NB.ridingCamo(),mat:G.horse.RIG().skin.material.name};});
 check('a body-dyed Chameleon has no camouflage while the dye lasts (no live coat, no wild-horse bonus) and Horse Care says it is hidden; its own coat brings it back',
  DY.before.camo&&DY.before.riding&&DY.dye&&DY.after.camo===null&&!DY.after.riding&&DY.after.mat!=='EquineFantasy_camo_live'&&DY.after.covered&&/hidden under the dye/.test(DY.after.care||'')&&DY2.live&&DY2.riding&&DY2.mat==='EquineFantasy_camo_live',{DY,DY2});

 /* ---- 4. buying it in the Market ------------------------------------------------------------ */
 await page.evaluate(()=>{const G=window.__features;G.save.sync(s=>{s.gems=99;});G.money.refreshWallet();G.hidePanels();window.resumeGame();
  document.querySelectorAll('#seHudRoot,#toasts,#questTrack,#mini,#seWay').forEach(e=>e.style.visibility='');});
 await page.click('#shopBtn'); await page.waitForTimeout(500);
 await page.evaluate(()=>{window.__features.ui.openShop('horses');}); await page.waitForTimeout(700);
 const ci=await page.evaluate(()=>window.__features.tables.BREEDS3.findIndex(b=>b[0]==='chameleon'));
 const n0=await page.evaluate(()=>window.__features.save.fresh().horses.length);
 const card=await page.evaluate((ci)=>{const b=document.querySelector('#shopPanel [data-buyh="'+ci+'"]');const r=b&&b.closest('.evrow');if(r)r.scrollIntoView({block:'center'});
  return {btn:b?b.textContent.trim():null,desc:!!(r&&r.querySelector('.nb-desc')),img:!!(r&&r.querySelector('img.mk-thumb-img[src*="chameleon.webp"]')),grid:document.getElementById('shopPanel').classList.contains('se-mk')};},ci);
 check('the Market card: 100 gems, a picture of the horse and its description',/100/.test(card.btn||'')&&card.desc&&card.img&&card.grid,card);
 await page.click('#shopPanel [data-buyh="'+ci+'"]'); await page.waitForTimeout(500);
 const poor=await page.evaluate(()=>({gems:window.__features.save.fresh().gems,n:window.__features.save.fresh().horses.length,ask:document.getElementById('nbConfirm').classList.contains('on')}));
 check('refused without enough gems: nothing spent, no horse, no confirmation',poor.gems===99&&poor.n===n0&&!poor.ask,poor);
 await page.evaluate(()=>{const G=window.__features;G.save.sync(s=>{s.gems=130;});G.money.refreshWallet();G.ui.openShop('horses');}); await page.waitForTimeout(600);
 await page.click('#shopPanel [data-buyh="'+ci+'"]'); await page.waitForTimeout(400);
 const ask1=await page.evaluate(()=>({ask:document.getElementById('nbConfirm').classList.contains('on'),txt:document.getElementById('nbConfirm').textContent,gems:window.__features.save.fresh().gems}));
 await page.click('#nbConfirm [data-nbc="no"]'); await page.waitForTimeout(300);
 const no=await page.evaluate(()=>({gems:window.__features.save.fresh().gems,n:window.__features.save.fresh().horses.length,ask:document.getElementById('nbConfirm').classList.contains('on')}));
 await page.click('#shopPanel [data-buyh="'+ci+'"]'); await page.waitForTimeout(400);
 await page.click('#nbConfirm [data-nbc="yes"]'); await page.waitForTimeout(700);
 const yes=await page.evaluate(()=>{const s=window.__features.save.fresh(),h=s.horses[s.horses.length-1];return {gems:s.gems,n:s.horses.length,breed:h.breed,coat:h.coat,src:h.src,ask:document.getElementById('nbConfirm').classList.contains('on')};});
 check('with enough gems it asks first; Not now spends nothing',ask1.ask&&/100 gems/.test(ask1.txt)&&ask1.gems===130&&no.gems===130&&no.n===n0&&!no.ask,{ask1,no});
 check('bought: gems go down by the price and the Chameleon Mustang arrives',yes.gems===30&&yes.n===n0+1&&yes.breed==='chameleon'&&yes.coat==='camo'&&yes.src==='shop'&&!yes.ask,yes);
 /* buyHorse3 itself refuses a horse that is not on the shelf (the VR shop reaches it with any row): a
    shop button pointed at the Lusitano, the Camargue and the Daybreak Haflinger, all priced nothing */
 const guard=await page.evaluate(async()=>{const G=window.__features,T=G.tables,out=[];
  for(const k of ['lusitano','camargue','daybreak','firefly']){G.ui.openShop('horses');await new Promise(r=>setTimeout(r,300));
   const s0=G.save.fresh(),n=s0.horses.length,c=s0.coins,g=s0.gems;
   const b=document.querySelector('#shopPanel [data-buyh]');if(!b){out.push([k,'no button']);continue;}
   b.dataset.buyh=String(T.BREEDS3.findIndex(x=>x[0]===k));b.click();await new Promise(r=>setTimeout(r,250));
   const s1=G.save.fresh();out.push([k,s1.horses.length-n,s1.coins-c,s1.gems-g]);}
  G.hidePanels();return out;});
 check('the shop\'s buy refuses summon, wild and earned horses outright (nothing given, nothing spent)',guard.every(r=>r.length===4&&r[1]===0&&r[2]===0&&r[3]===0),guard);

 /* ---- 5. summons, the week, My Horses ----------------------------------------------------- */
 const S=await page.evaluate(async()=>{const G=window.__features,T=G.tables,NB=G.newBreeds;G.hidePanels();
  const star=T.SUMMON_TIERS.find(t=>t.id==='starfall'), maj=T.SUMMON_TIERS.find(t=>t.id==='majestic'), myst=T.SUMMON_TIERS.find(t=>t.id==='mystic');
  const ids=(rar,t)=>G.summon.pool(rar,t).map(b=>b[0]);
  const out={lusitano:ids('Epic',star).includes('lusitano')&&ids('Epic',maj).includes('lusitano'),firefly:ids('Legendary',star).includes('firefly')&&ids('Legendary',myst).includes('firefly'),
   noCamo:!['Common','Uncommon','Rare','Epic','Legendary'].some(r=>ids(r,star).includes('chameleon')||ids(r,myst).includes('chameleon'))};
  G.ui.openShop('summon'); await new Promise(r=>setTimeout(r,400));
  out.chip=/Chameleon Mustang 0\.5% on every call/.test(document.getElementById('shopPanel').textContent);
  G.hidePanels();
  /* force the printed chance to prove the draw hands it out */
  const was=NB.ODDS.starfall; NB.ODDS.starfall=1; G.save.sync(s=>{s.gems=(s.gems||0)+30;});
  const n0=G.save.fresh().horses.length; G.summon.start(star); const s1=G.save.fresh(); NB.ODDS.starfall=was;
  out.drawn=s1.horses.length===n0+1&&s1.horses[s1.horses.length-1].breed==='chameleon';
  window.advanceTime(16000); out.summonDone=!G.summon.state.on;
  /* a week with five riding days brings the Daybreak Haflinger, once */
  let a=null,b=null,c=null;G.save.sync(s=>{a=NB.weekly(s,{week:'QA-W1',days:5});b=NB.weekly(s,{week:'QA-W1',days:6});c=NB.weekly(s,{week:'QA-W2',days:4});});
  out.weekly={first:a?a.breed:null,again:!!b,short:!!c,inbox:/Five days of riding/.test(JSON.stringify(G.save.fresh().inbox||[]))};
  /* My Horses groups them by breed */
  G.hidePanels(); window.resumeGame(); G.seHorses.open(); await new Promise(r=>setTimeout(r,900));
  const st=JSON.parse(render_game_to_text()).seHorses; out.sections=(st.sections||[]).map(x=>x.breed);
  out.cards=(st.sections||[]).filter(x=>['chameleon','connemara','suffolk','rockymtn','hanover','camargue','lusitano','firefly','opaline','daybreak'].includes(x.breed)).map(x=>[x.breed,x.cards,x.max]);
  G.seHorses.close();
  return out;});
 check('the Lusitano and the Firefly Arabian are in the summon pools, the Chameleon Mustang is not',S.lusitano&&S.firefly&&S.noCamo,S);
 check('the Starfall Call prints the Chameleon Mustang\'s chance, and the draw can hand it out',S.chip&&S.drawn&&S.summonDone,{chip:S.chip,drawn:S.drawn,done:S.summonDone});
 check('five riding days in a week bring the Daybreak Haflinger, once per week (four days do not)',S.weekly.first==='daybreak'&&!S.weekly.again&&!S.weekly.short&&S.weekly.inbox,S.weekly);
 check('My Horses shows a section for every new breed with its cards (five mastery steps for the fantasy ones)',KEYS.every(k=>S.sections.includes(k))&&S.cards.every(c=>c[1]>=1),{cards:S.cards});

 /* ---- 6. save and reload ------------------------------------------------------------------ */
 /* The week also closes on this reload, as it really does: the save's running week is set to an old one
    with five riding days, the game's start-up closes it (weekRoll), and the boot pass hands out exactly
    one Daybreak Haflinger for it. */
 const before=await page.evaluate(()=>{const G=window.__features;let b=null;G.save.sync(s=>{s.wk={week:'1999-1',sp:0,photos:0,events:0,days:5,lastDay:''};b=s.horses.map(h=>h.breed);});return b;});
 await page.goto(base+'/ranch3d.html?qa=new-breeds&reload='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(READY,null,{timeout:180000,polling:250}); stage('reloaded');
 const after=await page.evaluate(async(KEYS)=>{const G=window.__features,s=G.save.fresh();
  const i=G.horse.myHorses.findIndex(h=>h.breed==='chameleon');G.ranchSys.setRideIdx(i);G.horse.rebuildAll();
  for(let t=0;t<200;t++){const st=JSON.parse(render_game_to_text()).graphics;if(st.horseReady&&!st.horseLoading&&st.horseBreed==='chameleon')break;await new Promise(r=>setTimeout(r,100));}
  window.advanceTime(1000);
  return {breeds:s.horses.map(h=>h.breed),labels:KEYS.map(k=>G.horse.breedLabel(k)),errs:G.errors.length,installed:G.installed.includes('new-breeds'),camo:G.newBreeds.camo(),daybreak:s.horses.filter(h=>h.breed==='daybreak').length,
   wkLast:s.wkLast&&s.wkLast.week,excl:!!(s.roster&&s.roster.exclusives&&s.roster.exclusives['daybreak:1999-1'])};},KEYS);
 const dayBefore=before.filter(b=>b==='daybreak').length;
 check('saving and reloading keeps every new horse, their labels, and the live camouflage on the Chameleon',KEYS.every(k=>after.breeds.includes(k))&&after.breeds.length===before.length+1&&after.labels.every(l=>l&&l!=='Ranch Horse')&&after.errs===0&&after.camo&&after.camo.live,
  {n:[before.length,after.breeds.length],labels:after.labels,camo:after.camo&&after.camo.live});
 check('a week of five riding days closed at start-up brings exactly one Daybreak Haflinger (the real boot path)',after.wkLast==='1999-1'&&after.excl&&after.daybreak===dayBefore+1,{wkLast:after.wkLast,excl:after.excl,daybreak:[dayBefore,after.daybreak]});
 check('no console or page errors',errors.length===0&&netBad.length===0,{errors:errors.slice(0,6),http:netBad.slice(0,6)});
 const bad=checks.filter(c=>!c.ok).length;
 console.log(bad?('FAILED '+bad+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 await browser.close(); process.exit(bad?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
