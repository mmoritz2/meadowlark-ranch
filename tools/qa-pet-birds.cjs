/* The realistic small birds: the duckling (the AI duckling scan, stood up on legs and webbed feet the bird rig draws, small
   downy stub wings) and the chick (kenchoo's rigged chick: its own idle, a scurry and a flight baked on its own bones),
   both through assets/pet-bird-rig.js (assets/pet-autorig.js "template": "bird").
   Proves, for each of them, with its entry in assets/models/pets/manifest.json:
     1. its file ships (under 4 MB, bytes and sha256 as listed, textures at most 2048) and is credited in ATTRIBUTION.md
        and in the manifest's credit;
     2. through assets/pet-library.js it is skinned (weights summing to one on valid bones, no NaN in any clip) and has
        the clips the game drives (idle, walk = the waddle or the scurry, takeoff, fly, land), fitted to its size;
     3. the clips are sound: the idle stands on its feet on the grass through the whole cycle (no float, nothing under it)
        with the wings folded; the walk and the run, measured on the soles (the lowest vertices of each foot, not the ankle
        bone): each foot is down at least 35% of the cycle, a planted sole slides under 15% of the body's travel and its
        spot wanders under 10% of the stride, the swing lifts it between 6% and 20% of the hip's height, and nothing sinks;
        no skin tears in any clip (every edge of the body against its length in the idle, 8 phases a clip: none over 4
        times as long and 1.5 cm longer, and under 0.5% of them over 2.5 times); in flight the wings are out and beat;
        the land clip ends folded and standing;
     4. in the real game, beside a pegasus: the real bird replaces the drawn one and stands with its idle; walking with the
        horse at its walk it stays on its feet (no skim into the air); walking and running with the horse, moving to its
        spot and walking slowly, on flat ground and on a slope, each sole on the grass (within 8 mm of the terrain under
        it) slides under 15% of the body's travel, the net drift reported apart, and under 35% over every frame on the
        grass whatever the gait's weight (setting off, stopping, turning on the spot); beside a galloping horse it
        flap-runs in the air and is on its feet again once the horse pulls up; its legs never turn over faster than 12.5
        strides a second; lifted it is always in a flying pose and on the grass never in one; it takes off in its takeoff pose at once, flies beside the horse through a cruise, a
        climb and a turn with its wings out, nothing shows through its body, and lands with its land clip and stands;
     5. no page errors, and no console errors or warnings from the pet code.
   A parked bird ("available": false) is switched on in the page's copy of the manifest for this run only
   (QA_BIRDS_SHIPPED=1 tests the manifest exactly as shipped). PETS=duck or PETS=chick picks one; SHOTS=<dir> saves
   pictures (close and riding distance, standing, walking, taking off, flying beside the pegasus, landing).
   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-pet-birds.cjs */
const QA=require('./qa-platform.cjs');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=QA;
const ROOT=path.resolve(__dirname,'..');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now(),stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 1200 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},1200000).unref();
const MF=path.join(ROOT,'assets/models/pets/manifest.json'),manifest=JSON.parse(fs.readFileSync(MF,'utf8'));
const KEYS=(process.env.PETS||'duck,chick').split(',').map(s=>s.trim()).filter(Boolean);
const SHOTS=process.env.SHOTS||'';if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
/* each bird's parts: its body mesh, the bones that carry its feet, wing tips, head and body (prefixes, as three.js names them) */
/* (legs: the mesh the soles are on, '@body' for the body itself, its foot vertices picked by soleBones; hip: the bone whose height the lift is held to) */
const PARTS={
 duck:{body:'duck-body',legs:'duck-legs',hip:'ab_thighL',footL:'ab_footL',footR:'ab_footR',tipL:'ab_wing3L',tipR:'ab_wing3R',head:'ab_head',core:'ab_body',title:'Duckling'},
 chick:{body:null,legs:'@body',soleBones:['Ankle_','Toes_'],hip:'Hip_L',footL:'Ankle_L',footR:'Ankle_R',tipL:'Wristw_L',tipR:'Wristw_R',head:'Head_M',core:'Root_M',title:'Baby Chick Rebuilt'}};
/* the soles: at the idle's first frame, the foot's vertices within 6 mm of its lowest point, left (+x) and right; run in the page */
const SOLES=`(function(model,THREE,PT,body){const v=new THREE.Vector3(),cand=[],GC=['getX','getY','getZ','getW'];model.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(model.matrixWorld).invert(),sc=model.matrixWorld.getMaxScaleOnAxis();
 model.traverse(m=>{if(!m.isSkinnedMesh)return;if(PT.legs==='@body'?m!==body:m.name!==PT.legs)return;const si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight,P=m.geometry.attributes.position,bn=m.skeleton.bones;
  for(let i=0;i<P.count;i++){if(PT.soleBones){let bj=0,bw=-1;for(let c=0;c<4;c++){const w=sw[GC[c]](i);if(w>bw){bw=w;bj=si[GC[c]](i);}}if(!PT.soleBones.some(p=>bn[bj].name.startsWith(p)))continue;}
   m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);const l=v.clone().applyMatrix4(inv);cand.push([m,i,l.x,l.y*sc]);}});
 /* (each foot by its own lowest point, in the bird's own frame, so a bird standing across a slope still gets both soles) */
 const S={L:[],R:[]};for(const sd of ['L','R']){const c=cand.filter(q=>sd==='L'?q[2]>0:q[2]<=0),lo=Math.min(...c.map(q=>q[3]));for(const q of c)if(q[3]<lo+0.006)S[sd].push([q[0],q[1]]);}
 S.at=s=>{let x=0,z=0,y=1e9;for(const [m,i] of S[s]){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);x+=v.x;z+=v.z;y=Math.min(y,v.y);}const n=S[s].length||1;return [x/n,y,z/n];};return S;})`;
const errors=[];
const HOME={x:-100,z:400,h:Math.PI};
(async()=>{
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const att=fs.readFileSync(path.join(ROOT,'assets/models/pets/ATTRIBUTION.md'),'utf8');
 /* ---- 1. files and credit ---------------------------------------------------------------------------------- */
 for(const k of KEYS){const E=manifest.pets[k]||{},f1=path.join(ROOT,'assets/models/pets',E.file||'@'),ok1=fs.existsSync(f1),PT=PARTS[k];
  check(k+': the manifest lists it with a bird autorig, takeoff, fly and land clips, licence, creator and source',E.autorig&&E.autorig.template==='bird'&&E.clips&&E.clips.fly&&E.clips.takeoff&&E.clips.land&&E.license&&E.creator&&E.sourceUrl,{available:E.available});
  check(k+': '+E.file+' ships under 4 MB and matches the manifest (bytes, sha256)',ok1&&fs.statSync(f1).size<4*1048576&&fs.statSync(f1).size===E.bytes&&sha(f1)===E.sha256,{bytes:ok1?fs.statSync(f1).size:0});
  check(k+': credited in ATTRIBUTION.md and in the manifest\'s credit',att.includes(PT.title)&&(E.credit||'').includes(PT.title)&&(k!=='chick'||(att.includes('FourthGreen')&&/FourthGreen/.test(E.credit||''))),{});}
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error'&&/pet|autorig|bird|duck|chick/i.test(m.text()))errors.push(m.text().slice(0,300));if(/pet models|autorig|bird rig/.test(m.text())&&m.type()==='warning')errors.push('WARN '+m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 if(!process.env.QA_BIRDS_SHIPPED)await page.route(/\/assets\/models\/pets\/manifest\.json(\?.*)?$/,r=>{const m=JSON.parse(fs.readFileSync(MF,'utf8'));for(const k of KEYS)if(m.pets[k])m.pets[k].available=true;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(m)});});
 stage('boot');
 await page.goto(QA.BASE+'/ranch3d.html?qa=birds&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1000);
 stage('booted');
 for(const KEY of KEYS){const E=manifest.pets[KEY]||{},PT=PARTS[KEY];
 /* ---- 2 and 3: the library on its own ------------------------------------------------------------------------ */
  const lib=await page.evaluate(async([KEY,PT,H0,SOLE_SRC])=>{
  const G=window.__features,THREE=G.THREE,r={};
  try{
   const [L,GL,SU]=await Promise.all([import('./assets/pet-library.js?qa='+Date.now()),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/SkeletonUtils.js')]);
   const m=await (await fetch('./assets/models/pets/manifest.json?'+Date.now())).json();
   const lib=L.createPetLibrary({THREE,GLTFLoader:GL.GLTFLoader,clone:SU.clone,manifest:m,manifestURL:new URL('./assets/models/pets/manifest.json',location.href)});await lib.ready;
   const a=await lib.load(KEY,{height:H0,mustFly:true});const I=lib.instantiate(a);
   r.src=Object.assign({},a.src);r.dims=I.dims;r.info=I.info();
   let skinned=0,bad=0;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;skinned++;const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,nb=o.skeleton.bones.length;
    const gc=(at,i,c)=>c===0?at.getX(i):c===1?at.getY(i):c===2?at.getZ(i):at.getW(i);for(let i=0;i<si.count;i+=3){let s=0;for(let c=0;c<4;c++){const wv=gc(sw,i,c);s+=wv;if(wv>0&&gc(si,i,c)>=nb)bad++;}if(Math.abs(s-1)>0.01)bad++;}});
   r.skinned=skinned;r.skinBad=bad;
   let texMax=0;I.model.traverse(o=>{if(!o.isMesh)return;for(const mt of [].concat(o.material))for(const kk of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(mt[kk]&&mt[kk].image)texMax=Math.max(texMax,mt[kk].image.width||0,mt[kk].image.height||0);});r.texMax=texMax;
   const root=I.root;root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
   const byPre=pre=>{let best=null;I.model.traverse(o=>{if(o.isBone&&(o.name===pre||o.name.startsWith(pre+'_')||o.name.startsWith(pre))&&(!best||o.name.length<best.name.length))best=o;});return best;};
   const bodyMesh=(()=>{let m=null;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;if(PT.body?o.name===PT.body:(!m||o.geometry.attributes.position.count>m.geometry.attributes.position.count))m=o;});return m;})();
   const all=[];I.model.traverse(o=>{if(o.isSkinnedMesh)all.push(o);});
   const v=new THREE.Vector3();
   const box=(ms,step)=>{const b=new THREE.Box3();for(const mm of [].concat(ms)){const P=mm.geometry.attributes.position;for(let i=0;i<P.count;i+=step){mm.getVertexPosition(i,v).applyMatrix4(mm.matrixWorld);b.expandByPoint(v);}}return b;};
   const pose=(s,ph)=>{const w={};w[s]=1;for(let z=0;z<3;z++)I.update(0.001,{w,phase:ph,phased:[s],snap:true});root.updateMatrixWorld(true);};
   const wp=pre=>byPre(pre).getWorldPosition(new THREE.Vector3());
   const span=()=>Math.abs(wp(PT.tipL).x-wp(PT.tipR).x);
   /* NaN anywhere in a clip */
   let nan=0;for(const s of ['idle','walk','takeoff','fly','land'])for(let i=0;i<8;i++){pose(s,i/8);I.model.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))nan++;});}r.nan=nan;
   /* idle over its whole cycle: the lowest point of the whole bird on the grass, wings folded */
   let lo=1e9,hi=-1e9,spanIdle=0;for(let i=0;i<16;i++){pose('idle',i/16);const b=box(all,7);lo=Math.min(lo,b.min.y);hi=Math.max(hi,b.min.y);spanIdle=Math.max(spanIdle,span());}
   pose('idle',0);const bw=box(bodyMesh,7);r.idle={lowMin:+lo.toFixed(4),lowMax:+hi.toFixed(4),span:+spanIdle.toFixed(3),bodyW:+(bw.max.x-bw.min.x).toFixed(3)};
   /* the walk and the run, on the soles: two cycles each, the body carried forward one stride per cycle (the library takes the
      clip's travel out, so a planted sole moves back by it); a sole is down within 6 mm of the grass */
   pose('idle',0);const SO=(0,eval)(SOLE_SRC)(I.model,THREE,PT,bodyMesh),hipH=byPre(PT.hip).getWorldPosition(new THREE.Vector3()).y;r.soles={L:SO.L.length,R:SO.R.length,hipH:+hipH.toFixed(3)};
   r.gait={};
   for(const st of ['walk','run']){if(!I.clips[st]||(st==='run'&&I.clips.run===I.clips.walk))continue;const S=I.stride(st),N=60;let down={L:0,R:0},lift=0,low=1e9,slide=0,trav=0,wander=0,net=0,frames=0,bodyLo=1e9;const prev={},grp={};
    for(let i=0;i<=2*N;i++){const ph=i/N;pose(st,ph%1);frames++;if(i%4===0)bodyLo=Math.min(bodyLo,box(all,9).min.y);
     for(const s of ['L','R']){const q=SO.at(s);q[2]+=S*ph;lift=Math.max(lift,q[1]);low=Math.min(low,q[1]);const on=q[1]<0.006;
      if(on){down[s]++;if(prev[s]&&prev[s].on){slide+=Math.hypot(q[0]-prev[s].q[0],q[2]-prev[s].q[2]);trav+=S/N;}(grp[s]=grp[s]||[]).push(q);}
      else if(grp[s]){const g=grp[s];if(g.length>2){wander=Math.max(wander,Math.max(...g.map(a=>a[2]))-Math.min(...g.map(a=>a[2])),Math.max(...g.map(a=>a[0]))-Math.min(...g.map(a=>a[0])));net=Math.max(net,Math.hypot(g[g.length-1][0]-g[0][0],g[g.length-1][2]-g[0][2]));}grp[s]=null;}
      prev[s]={q,on};}}
    r.gait[st]={stride:+S.toFixed(3),down:[+(down.L/frames).toFixed(2),+(down.R/frames).toFixed(2)],slideK:+(slide/Math.max(1e-6,trav)).toFixed(3),wanderK:+(wander/Math.max(1e-6,S)).toFixed(3),netDrift:+net.toFixed(4),lift:+lift.toFixed(3),liftK:+(lift/hipH).toFixed(3),soleLow:+low.toFixed(4),bodyLowest:+bodyLo.toFixed(4)};}
   /* the skin: every edge of the body against its length in the idle's first frame, every clip at 8 phases */
   {const g=bodyMesh.geometry,ix=g.index?g.index.array:[...Array(g.attributes.position.count).keys()],NV=g.attributes.position.count,ref=new Float32Array(NV*3),cur=new Float32Array(NV*3);
    const grab=a=>{for(let i=0;i<NV;i++){bodyMesh.getVertexPosition(i,v).applyMatrix4(bodyMesh.matrixWorld);a[3*i]=v.x;a[3*i+1]=v.y;a[3*i+2]=v.z;}};
    pose('idle',0);grab(ref);const seen=new Set(),ed=[];for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++){const a=ix[t+k],b=ix[t+(k+1)%3],key=a<b?a*1e6+b:b*1e6+a;if(!seen.has(key)){seen.add(key);ed.push(a,b);}}
    const len=(A,a,b)=>Math.hypot(A[3*a]-A[3*b],A[3*a+1]-A[3*b+1],A[3*a+2]-A[3*b+2]);r.stretch={edges:ed.length/2};
    for(const st of ['idle','walk','run','takeoff','fly','land']){if(!I.clips[st])continue;let mx=1,torn=0;for(let k=0;k<8;k++){pose(st,k/8);grab(cur);for(let e=0;e<ed.length;e+=2){const l0=len(ref,ed[e],ed[e+1]);if(l0<1e-5)continue;const l1=len(cur,ed[e],ed[e+1]);if(l1-l0>0.015){mx=Math.max(mx,l1/l0);if(l1/l0>2.5)torn++;}}}r.stretch[st]={max:+mx.toFixed(2),torn};}}
   /* flight: the span, and the beat */
   let tipLo=1e9,tipHi=-1e9,spanMax=0,spanMin=1e9;for(let i=0;i<16;i++){pose('fly',i/16);const t=wp(PT.tipL);tipLo=Math.min(tipLo,t.y);tipHi=Math.max(tipHi,t.y);const sp=span();spanMax=Math.max(spanMax,sp);spanMin=Math.min(spanMin,sp);}
   r.fly={spanMax:+spanMax.toFixed(3),spanMin:+spanMin.toFixed(3),beat:+(tipHi-tipLo).toFixed(3)};
   pose('takeoff',0.15);const toSpan=span();pose('land',0.999);const ldSpan=span(),ldLow=box(all,7).min.y;
   r.ends={takeoffSpan:+toSpan.toFixed(3),landEndSpan:+ldSpan.toFixed(3),landEndLow:+ldLow.toFixed(4)};
   I.dispose();
  }catch(e){r.error=String(e&&e.stack||e);}
  return r;},[KEY,PT,(E.fit&&E.fit.height)||0.5,SOLES]);
 if(lib.error){check(KEY+': loads and is rigged by the bird rig',false,lib.error);continue;}
 const h=lib.dims.h;
 check(KEY+': loads skinned (weights sum to one on valid bones, no NaN in any clip), textures at most 2048',lib.skinned>=1&&lib.skinBad===0&&lib.nan===0&&lib.texMax<=2048,{skinned:lib.skinned,bad:lib.skinBad,nan:lib.nan,texMax:lib.texMax,triangles:lib.info.triangles});
 check(KEY+': has the clips the game drives (idle, walk, takeoff, fly, land)',['idle','walk','takeoff','fly','land'].every(s=>lib.src[s]&&!/@/.test(lib.src[s])),lib.src);
 const want=(E.fit&&E.fit.height)||0.5;check(KEY+': fitted to its size ('+want+' m)',Math.abs(h-want)<0.02*want+0.005,lib.dims);
 check(KEY+' idle: on its feet on the grass through the whole idle (lowest point within 1.5 cm of the grass, never under it), wings folded (tip to tip within 1.3 body widths)',lib.idle.lowMin>-0.006&&lib.idle.lowMax<0.015&&lib.idle.span<1.3*lib.idle.bodyW,lib.idle);
 for(const st of ['walk','run']){const g=lib.gait[st];if(!g){if(st==='walk')check(KEY+' walk: measured on the soles',false,lib.soles);continue;}
  check(KEY+' '+st+' (soles): each foot down at least 35% of the cycle, a planted sole slides under 15% of the travel and wanders under 10% of the stride, the swing lifts it 6% to 20% of the hip height, nothing sinks',
   g.stride>0.03&&Math.min(...g.down)>=0.35&&g.slideK<0.15&&g.wanderK<0.1&&g.liftK>=0.06&&g.liftK<=0.2&&g.soleLow>-0.008&&g.bodyLowest>-0.012,Object.assign({soles:[lib.soles.L,lib.soles.R],hipH:lib.soles.hipH},g));}
 {const S=lib.stretch||{},cl=Object.keys(S).filter(k=>k!=='edges');check(KEY+': no skin tears in any clip (no edge over 4 times its idle length and 1.5 cm longer; under 0.5% of edges over 2.5 times)',cl.length>=5&&cl.every(k=>S[k].max<4&&S[k].torn<0.005*S.edges*8),S);}
 /* (a chick's wings are the smallest stubs: 1.45 body widths tip to tip is wide open for it; the duckling's 1.6) */
 const spanK=KEY==='chick'?1.45:1.6;
 check(KEY+' fly: the wings are out (tip to tip over '+spanK+' body widths at the widest) and beat (the tip rises and falls over 4 cm)',lib.fly.spanMax>spanK*lib.idle.bodyW&&lib.fly.beat>0.04,Object.assign({bodyW:lib.idle.bodyW},lib.fly));
 check(KEY+' takeoff and land: the wings are out early in the takeoff, folded at the end of the land clip, which stands on the grass',lib.ends.takeoffSpan>1.3*lib.idle.bodyW&&lib.ends.landEndSpan<1.3*lib.idle.bodyW&&Math.abs(lib.ends.landEndLow)<0.015,lib.ends);
 /* ---- 4: in the game ----------------------------------------------------------------------------------------- */
 await page.evaluate(([PT,SOLE_SRC])=>{const G=window.__features,p=G.horse.player;const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&G.wardrobe)G.wardrobe.closeChar();
  const key=(k,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:k,key:k,bubbles:true}));
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const ride=b=>{G.save.sync(s=>{let h=s.horses.find(x=>x.breed===b);if(!h){h=G.horse.grantHorse(s,b,{name:'QA '+b,bond:60});}s.horses.splice(s.horses.indexOf(h),1);s.horses.unshift(h);});G.horse.reloadHorses();const sel=document.getElementById('horseSel');sel.value='0';sel.onchange();};
  const comp=()=>G.pets.comp(),real=()=>G.petModels.real(comp()),RR=()=>{const c=comp();return c&&c.parts&&c.parts.real;};
  const T=G.THREE,_v=new T.Vector3();
  const bone=pre=>{const r=RR();if(!r||!r.inst)return null;let best=null;r.inst.model.traverse(o=>{if(o.isBone&&(o.name===pre||o.name.startsWith(pre))&&(!best||o.name.length<best.name.length))best=o;});return best;};
  const wp=nm=>{const b=bone(nm);if(!b)return null;b.getWorldPosition(_v);return [_v.x,_v.y,_v.z];};
  const span=()=>{const a=wp(PT.tipL),b=wp(PT.tipR);return a&&b?Math.hypot(a[0]-b[0],a[2]-b[2],a[1]-b[1]):0;};
  const info=()=>{const c=comp(),r=real();return {real:r.state,clip:r.clip,err:r.err,drawn:c.parts.bodyPivot.visible,air:c.st.air,alt:+(c.alt||0).toFixed(2),spd:+(c.st.spd||0).toFixed(2),flying:!!p.flying,span:+span().toFixed(3),d:+Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z).toFixed(2)};};
  let simT=0;
  const sample=()=>{const c=comp(),R=RR(),g=c.parts.group.position,W=R&&R.inst?R.inst.weights:{};const w={};for(const k in W)w[k]=+W[k].toFixed(3);
   return {t:+simT.toFixed(3),real:R?R.state:'none',drawn:c.parts.bodyPivot.visible,air:c.st.air,alt:+(c.alt||0),spd:+(c.st.spd||0),sk:R?R.sk||null:null,ph:R?R.phase:0,pc:R?R.popC||0:0,w,
    g:[g.x,g.y,g.z],hd:c.heading||0,fL:wp(PT.footL),fR:wp(PT.footR),sole:soleAt(),span:span(),d:Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z),flying:!!p.flying};};
  /* the soles (taken once it stands in its idle): each foot's lowest vertices, where they are and the terrain's height under them */
  let SO=null;const soles=()=>{const R=RR();if(!R||!R.inst)return null;let body=null;R.inst.model.traverse(o=>{if(!o.isSkinnedMesh)return;if(PT.body?o.name===PT.body:(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count))body=o;});
   SO=(0,eval)(SOLE_SRC)(R.inst.model,T,PT,body);return {L:SO.L.length,R:SO.R.length};};
  function soleAt(){if(!SO)return null;const o={};for(const s of ['L','R']){const q=SO.at(s);q.push(G.world.groundH(q[0],q[2]));o[s]=q;}return o;}
  const step=ms=>{window.advanceTime(ms);simT+=ms/1000;};
  const run=(keys,n,ms,tag)=>{const S=[];for(const k of keys)key(k,true);for(let i=0;i<n;i++){step(ms);S.push(Object.assign(sample(),{tag}));}for(const k of keys)key(k,false);return S;};
  const snap=(eye,at)=>{const cam=G.camera,o={p:cam.position.clone(),q:cam.quaternion.clone()};if(eye){cam.position.set(eye[0],eye[1],eye[2]);cam.lookAt(at[0],at[1],at[2]);cam.updateMatrixWorld();}G.renderer.render(G.scene,cam);const u=G.renderer.domElement.toDataURL('image/png');cam.position.copy(o.p);cam.quaternion.copy(o.q);return u;};
  window.__BIRD={G,p,key,reset,ride,comp,real,info,snap,sample,run,step,RR,bone,soles};},[PT,SOLES]);
 const shot=async(name,eyeFn)=>{if(!SHOTS)return;const u=await page.evaluate(([f])=>{const Q=window.__BIRD,c=Q.comp(),g=c.parts.group.position,h=c.heading;const e=(new Function('g','h','return ('+f+')(g,h)'))(g,h);return Q.snap(e?e[0]:null,e?e[1]:null);},[eyeFn?eyeFn.toString():'()=>null']);fs.writeFileSync(path.join(SHOTS,KEY+'-'+name+'.png'),Buffer.from(u.split(',')[1],'base64'));};
 const settle=async()=>{let s=null;for(let i=0;i<120;i++){s=await page.evaluate(()=>{window.advanceTime(100);return window.__BIRD.info();});if(s.real==='ready'||s.real==='failed'||s.real==='none')break;await page.waitForTimeout(100);}return s;};
 await page.evaluate(()=>{const Q=window.__BIRD;Q.G.hidePanels&&Q.G.hidePanels();if(!Q.G.horse.ridden().wings)Q.ride('pegasus');});
 await page.waitForFunction(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}},null,{timeout:120000,polling:250});
 await page.evaluate(([H,KEY])=>{const Q=window.__BIRD,G=Q.G;if(Q.p.flying){const fb=document.getElementById('flyBtn');if(fb)fb.click();for(let i=0;i<300&&Q.p.flying;i++)Q.step(50);}
  G.save.sync(s=>{s.petList=Array.from(new Set([...(s.petList||[]),KEY]));});Q.reset(H.x,H.z,H.h);if(G.pets.active()!==KEY)G.pets.setActive(KEY);else G.pets.rebuild();Q.key('KeyW',true);window.advanceTime(600);Q.key('KeyW',false);},[HOME,KEY]);
 const s0=await settle();
 check(KEY+' in game: the real bird loads and replaces the drawn one',s0.real==='ready'&&!s0.drawn,s0);
 const ground=w=>(w.idle||0)+(w.walk||0)+(w.run||0),lifted=w=>(w.takeoff||0)+(w.fly||0)+(w.glide||0);
 if(s0.real!=='ready')continue;
 const ID=await page.evaluate(([H])=>{const Q=window.__BIRD;Q.reset(H.x,H.z,H.h);let n=0;for(;n<300;n++){Q.step(33);const R=Q.RR(),c=Q.comp();if(R&&R.inst&&(R.inst.weights.idle||0)>0.99&&c.st.air==='ground'&&(c.alt||0)<0.01)break;}
  if(n>=300)return {unsettled:Q.sample()};return {settledIn:+(n*0.033).toFixed(2),S:Q.run([],300,33,'idle')};},[HOME]);
 if(!ID.S)check(KEY+' in game: settles into its idle on the grass (within 10 s)',false,ID.unsettled);
 else check(KEY+' in game: stands with its idle, the real body, on the grass',ID.S.every(o=>o.real==='ready'&&!o.drawn&&o.alt<0.02&&ground(o.w)>0.9),{settledIn:ID.settledIn,altMax:+Math.max(...ID.S.map(o=>o.alt)).toFixed(3)});
 await shot('stand-close',(g,h)=>[[g.x+Math.sin(h+0.6)*1.1,g.y+0.5,g.z+Math.cos(h+0.6)*1.1],[g.x,g.y+0.22,g.z]]);
 await shot('stand-close-back',(g,h)=>[[g.x+Math.sin(h+2.6)*1.1,g.y+0.6,g.z+Math.cos(h+2.6)*1.1],[g.x,g.y+0.22,g.z]]);
 await shot('stand-riding',null);
 /* walking with the horse (Ctrl+W, its walk), stopping, short moves to its spot, slow walks and a run, then the same on a slope
    (the nearest spot with a 8 to 25% grade, walked uphill and back down): every frame */
 const SOL=await page.evaluate(()=>window.__BIRD.soles());
 const WK=await page.evaluate(([H])=>{const Q=window.__BIRD,G=Q.G;let S=Q.run(['KeyW','ControlLeft'],240,17,'walk');S=S.concat(Q.run([],200,17,'stop'));
  const c=Q.comp(),p=Q.p;for(let n=0;n<10;n++){const a=n*1.7;c.pos.x+=Math.sin(a)*0.235;c.pos.z+=Math.cos(a)*0.235;S=S.concat(Q.run([],60,17,'nudge'));}
  for(const v of [0.3,0.6,1.0,1.6])for(let i=0;i<150;i++){p.speed=v;Q.step(17);S.push(Object.assign(Q.sample(),{tag:'slow'+v}));}
  const gh=(x,z)=>G.world.groundH(x,z);let best=null;
  for(let r=10;r<=120&&!best;r+=5)for(let k=0;k<24&&!best;k++){const a=k/24*Math.PI*2,x=H.x+Math.sin(a)*r,z=H.z+Math.cos(a)*r,gx=(gh(x+0.5,z)-gh(x-0.5,z)),gz=(gh(x,z+0.5)-gh(x,z-0.5)),gr=Math.hypot(gx,gz);
   if(gr>0.08&&gr<0.25){let ok=true;for(let d=-4;d<=4;d+=1){const x2=x+gx/gr*d,z2=z+gz/gr*d,g2=Math.hypot(gh(x2+0.5,z2)-gh(x2-0.5,z2),gh(x2,z2+0.5)-gh(x2,z2-0.5));if(g2<0.05||g2>0.35)ok=false;}if(ok)best={x,z,grade:+gr.toFixed(3),h:Math.atan2(gx,gz)};}}
  if(best){for(const [dir,tag] of [[0,'slope-up'],[Math.PI,'slope-down']]){Q.reset(best.x-Math.sin(best.h+dir)*3,best.z-Math.cos(best.h+dir)*3,best.h+dir);for(let i=0;i<120;i++)Q.step(33);for(let i=0;i<220;i++){p.speed=0.6;Q.step(17);S.push(Object.assign(Q.sample(),{tag}));}}}
  Q.reset(H.x,H.z,H.h);for(let i=0;i<120;i++)Q.step(33);
  return {S,slope:best};},[HOME]);
 const WKS=WK.slope;const WKF=WK.S;
 /* a gallop and a halt: a fast run kept up takes it into the air, flap-running low beside the horse, and it lands as the
    horse pulls up (a catch-up dash stays on its feet: the steady walk above) */
 const GL=await page.evaluate(([H])=>{const Q=window.__BIRD;Q.reset(H.x,H.z,H.h);for(let i=0;i<120;i++)Q.step(33);let S=Q.run(['KeyW','ShiftLeft'],300,17,'gallop');S=S.concat(Q.run([],300,17,'halt'));
  Q.reset(H.x,H.z,H.h);for(let i=0;i<120;i++)Q.step(33);return S;},[HOME]);
 /* each sole on the grass (within 8 mm of the terrain under it, the walk or the run in charge): its slide against the body's travel;
    the net drift of each stance (where the sole lifts against where it landed) apart from the frame-to-frame wobble */
 const isW=(a,b)=>ground(b.w)-(b.w.idle||0)>0.9&&ground(a.w)-(a.w.idle||0)>0.9&&b.alt<0.02&&b.air==='ground'&&!b.sk&&!a.sk&&a.sole&&b.sole;
 const slideOf=list=>{let slide=0,travel=0,wf=0,down=0,nets=[],grp={};
  for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i];if(!isW(a,b)){grp={};continue;}wf++;const bt=Math.hypot(b.g[0]-a.g[0],b.g[2]-a.g[2]);
   for(const s of ['L','R']){const ha=a.sole[s][1]-a.sole[s][3],hb=b.sole[s][1]-b.sole[s][3];
    if(ha<0.008&&hb<0.008){down++;slide+=Math.hypot(b.sole[s][0]-a.sole[s][0],b.sole[s][2]-a.sole[s][2]);travel+=bt;if(!grp[s])grp[s]=[a.sole[s],0];grp[s][1]+=bt;grp[s][2]=b.sole[s];}
    else if(grp[s]){if(grp[s][2]&&grp[s][1]>0.02)nets.push(Math.hypot(grp[s][2][0]-grp[s][0][0],grp[s][2][2]-grp[s][0][2])/grp[s][1]);grp[s]=null;}}}
  return {walkFrames:wf,downShare:+(down/Math.max(1,2*wf)).toFixed(2),travel:+travel.toFixed(3),slideK:+(travel>0.01?slide/travel:0).toFixed(3),netDriftK:nets.length?+(nets.reduce((x,y)=>x+y,0)/nets.length).toFixed(3):null};};
 /* and over every frame on the grass, whatever the gait's weight (setting off, stopping, turning on the spot, a nudge
    walked back if it was pushed far enough to step back), a jump of the pet (a teleport, the nudge itself) left out: the
    start, stop and pivot skids */
 const slideAll=list=>{let slide=0,travel=0,n=0;
  for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i];if(!(a.alt<0.02&&b.alt<0.02&&a.air==='ground'&&b.air==='ground'&&!a.sk&&!b.sk&&a.sole&&b.sole))continue;
   const bt=Math.hypot(b.g[0]-a.g[0],b.g[2]-a.g[2]);if(b.t-a.t>0.05||bt>(b.t-a.t)*(2*Math.max(a.spd,b.spd)+3))continue;n++;   // (consecutive frames only: not across a reset between two legs)
   for(const s of ['L','R']){if(a.sole[s][1]-a.sole[s][3]<0.008&&b.sole[s][1]-b.sole[s][3]<0.008){slide+=Math.hypot(b.sole[s][0]-a.sole[s][0],b.sole[s][2]-a.sole[s][2]);travel+=bt;}}}
  return {frames:n,travel:+travel.toFixed(3),slideK:+(travel>0.01?slide/travel:0).toFixed(3)};};
 const flat=slideOf(WKF.filter(o=>!/^slope/.test(o.tag))),slope=slideOf(WKF.filter(o=>/^slope/.test(o.tag)));
 const flatAll=slideAll(WKF.filter(o=>!/^slope/.test(o.tag))),slopeAll=slideAll(WKF.filter(o=>/^slope/.test(o.tag)));
 const byTag={};for(const tg of [...new Set(WKF.map(o=>o.tag.replace(/[0-9.]+$/,'')))])byTag[tg]=slideAll(WKF.filter(o=>o.tag.replace(/[0-9.]+$/,'')===tg)).slideK;
 check(KEY+' in game: walks and runs beside the horse and to its spot without skating (each sole on the grass slides under 15% of the body\'s travel, over at least half a metre)',flat.walkFrames>=20&&flat.travel>0.5&&flat.slideK<0.15,Object.assign({soles:SOL},flat));
 check(KEY+' in game: on a slope too (uphill and down, soles against the terrain under them: slide under 15% of the travel)',!!WKS&&slope.travel>0.3&&slope.slideK<0.15,Object.assign({slope:WKS},slope));
 check(KEY+' in game: setting off, stopping and turning on the spot too (every frame on the grass, whatever the gait\'s weight, jumps left out: slide under 35% of the travel, flat and on the slope)',flatAll.travel>0.5&&flatAll.slideK<0.35&&(!WKS||slopeAll.slideK<0.35),{flat:flatAll,slope:slopeAll,byTag});
 {const w=WKF.filter(o=>o.tag==='walk'&&o.t>WKF[0].t+2);const sk=w.filter(o=>o.sk).length;check(KEY+' in game: stays on its feet beside the horse at its steady walk (no skim into the air once the horse is walking; a sprint to catch up as it sets off may flap up)',w.length>50&&sk<=0.02*w.length,{frames:w.length,skimFrames:sk,spd:+Math.max(...w.map(o=>o.spd)).toFixed(2)});}
 {const g=GL.filter(o=>o.tag==='gallop'&&o.t>GL[0].t+1.5),up=g.filter(o=>o.sk||o.alt>0.05).length,h=GL.filter(o=>o.tag==='halt'),last=h.slice(-60);
  check(KEY+' in game: beside a galloping horse it flap-runs (in the air at least 90% of the gallop after its first 1.5 s) and is down on its feet again once the horse has pulled up',g.length>50&&up>=0.9*g.length&&last.every(o=>o.air==='ground'&&!o.sk&&o.alt<0.02&&ground(o.w)>0.9),{frames:g.length,upFrames:up,spd:+Math.max(...g.map(o=>o.spd)).toFixed(1),endAlt:+Math.max(...last.map(o=>o.alt)).toFixed(3)});}
 /* the legs' cadence on the grass (strides a second, from the stride phase): never faster than a screen at 30 frames a second can show well */
 {let hi=0,at=null;const all=WKF.concat(GL);for(let i=1;i<all.length;i++){const a=all[i-1],b=all[i];if(b.tag!==a.tag||!(b.air==='ground'&&a.air==='ground'&&!a.sk&&!b.sk&&b.alt<0.02))continue;const gw=o=>(o.w.walk||0)+(o.w.run||0);if(gw(a)<0.5||gw(b)<0.5)continue;let dp=b.ph-a.ph;dp-=Math.round(dp);const hz=Math.abs(dp)/Math.max(1e-3,b.t-a.t);if(hz>hi){hi=hz;at={tag:b.tag,spd:+b.spd.toFixed(2)};}}
  check(KEY+' in game: its legs never turn over faster than 12.5 strides a second on the grass',hi<=12.5,{maxHz:+hi.toFixed(1),at});}
 let upT=-1,bad=[],badG=[];for(const o of WKF.concat(GL)){if(o.sk==='up'&&upT<0)upT=o.t;if(!o.sk)upT=-1;
  if(o.air==='ground'&&o.alt>0.08&&!(upT>=0&&o.t-upT<0.1)&&ground(o.w)>0.2)bad.push({t:o.t,alt:+o.alt.toFixed(2),w:o.w,sk:o.sk});
  if(o.air==='ground'&&o.alt<0.01&&!o.sk&&lifted(o.w)>0.5)badG.push({t:o.t,alt:+o.alt.toFixed(3),w:o.w});}
 check(KEY+' in game: never shows a standing or walking pose lifted off the grass, nor a flying pose standing on it (walking, running, the gallop and the halt)',bad.length===0&&badG.length===0&&WKF.concat(GL).every(o=>o.real==='ready'&&!o.drawn),{lifted:bad.length,grounded:badG.length,first:bad[0]||badG[0]||null});
 const WF=await page.evaluate(()=>{const Q=window.__BIRD,p=Q.p;for(let i=0;i<900;i++){p.speed=0.6;Q.step(17);const s=Q.sample();if(i>60&&(s.w.walk||0)>0.95&&!s.sk&&s.ph>0.2&&s.ph<0.3)return s;}return null;});
 if(WF){await shot('walk-close',(g,h)=>[[g.x+Math.sin(h+1.4)*1.0,g.y+0.35,g.z+Math.cos(h+1.4)*1.0],[g.x,g.y+0.16,g.z]]);await shot('walk-riding',null);}
 /* running beside the horse at its walk */
 const RF=await page.evaluate(()=>{const Q=window.__BIRD;Q.key('KeyW',true);Q.key('ControlLeft',true);let s=null;for(let i=0;i<300;i++){Q.step(17);s=Q.sample();if(i>90&&(s.w.run||0)>0.8&&!s.sk)break;}return s;});
 if(RF&&(RF.w.run||0)>0.8){await shot('run-close',(g,h)=>[[g.x+Math.sin(h+1.4)*1.2,g.y+0.4,g.z+Math.cos(h+1.4)*1.2],[g.x,g.y+0.16,g.z]]);await shot('run-riding',null);}
 await page.evaluate(()=>{const Q=window.__BIRD;Q.key('KeyW',false);Q.key('ControlLeft',false);for(let i=0;i<60;i++)Q.step(50);});
 await page.evaluate(()=>{const Q=window.__BIRD;for(let i=0;i<40;i++)Q.step(100);});
 /* the flight: the takeoff, frame by frame, then a cruise, a climb and a turn */
 const TO=await page.evaluate(()=>{const Q=window.__BIRD;const S=Q.run([],10,17,'stand');return S.concat(Q.run(['KeyW','Space'],30,17,'takeoff'));});
 const tk=(TO.find(o=>o.air==='takeoff')||{}).t;const toW=TO.filter(o=>o.air==='takeoff'&&o.t-tk>=0.1&&o.t-tk<0.2);
 check(KEY+' in game: takes off in its takeoff pose at once (takeoff clip weight at least 0.8 a tenth of a second after the horse lifts)',tk!=null&&toW.length>0&&toW.every(o=>(o.w.takeoff||0)>=0.8),{t0:tk,w:toW.map(o=>o.w.takeoff||0)});
 await shot('takeoff-close',(g,h)=>[[g.x+Math.sin(h+1.2)*1.5,g.y+0.6,g.z+Math.cos(h+1.2)*1.5],[g.x,g.y+0.2,g.z]]);
 const FL=await page.evaluate(()=>{const Q=window.__BIRD;const S=[];const add=(k,n,t)=>{for(const o of Q.run(k,n,100,t))S.push(Object.assign(o,Q.info()));};add(['KeyW','Space'],5,'takeoff');add(['KeyW'],25,'cruise');add(['KeyW','Space'],3,'climb');add(['KeyW','KeyA'],20,'turn');add(['KeyW'],15,'cruise2');return S;});
 const air=FL.filter(o=>o.flying&&o.air==='fly');const clips=[...new Set(FL.map(o=>o.clip))];
 check(KEY+' in game: flies with its fly clip beside the horse',clips.includes('fly')&&air.length>10&&air.every(o=>['fly','glide','takeoff'].includes(o.clip)),{clips,air:air.length});
 const spanIdle=Math.max(...ID.S?ID.S.map(o=>o.span):[0]);
 check(KEY+' in game: its wings are out all through the flight (tip to tip wider than standing) and it stays the real body',air.length>0&&air.every(o=>o.span>spanIdle*1.05)&&FL.every(o=>o.real==='ready'&&!o.drawn),{spanIdle:+spanIdle.toFixed(3),spans:[+Math.min(...air.map(o=>o.span)).toFixed(3),+Math.max(...air.map(o=>o.span)).toFixed(3)]});
 check(KEY+' in game: keeps close to the horse through the cruise, climb and turn (within 8 m)',air.every(o=>o.d<8),{maxD:+Math.max(0,...air.map(o=>o.d)).toFixed(2)});
 /* the flying body: nothing shows through it (drawn double-sided it covers no more than drawn front-only); the bird's other
    meshes (the chick's six shells of down, the eyes, the duckling's wings) are hidden for it, so the body's own silhouette is
    measured: through the down the red body showed only as a speckle, a few hundred pixels at this size, and single stray
    pixels of that speckle (from one render to the next) read as 0.4 to 1.4% "see-through" where the body drawn alone, and
    the same frame read at full size, showed none */
 const FB=await page.evaluate(([PT])=>{const Q=window.__BIRD,G=Q.G,T=G.THREE,R=Q.RR();if(!R||!R.inst)return null;Q.run(['KeyW'],8,100,'look');
  let body=null;R.inst.model.traverse(o=>{if(!o.isSkinnedMesh)return;if(PT.body?o.name===PT.body:(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count))body=o;});
  const W=640,H=400,cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true}),cam=G.camera,o={p:cam.position.clone(),q:cam.quaternion.clone()};
  const grab=()=>{G.renderer.render(G.scene,cam);cx.drawImage(G.renderer.domElement,0,0,W,H);return cx.getImageData(0,0,W,H).data;};
  const ce=new T.Vector3();Q.bone(PT.core).getWorldPosition(ce);const h=Q.comp().heading||0;
  const look=(yaw,el,d)=>{const a=h+yaw;cam.position.set(ce.x+Math.sin(a)*Math.cos(el)*d,ce.y+Math.sin(el)*d,ce.z+Math.cos(a)*Math.cos(el)*d);cam.lookAt(ce);cam.updateMatrixWorld();};
  const flat={toneMapped:false,fog:false},red=new T.MeshBasicMaterial({color:0xff0000,side:T.FrontSide,...flat}),red2=new T.MeshBasicMaterial({color:0xff0000,side:T.DoubleSide,...flat});
  const mb=body.material,isR=(D,i)=>D[i]>200&&D[i+1]<40&&D[i+2]<40,out={see:[]},others=[];R.inst.model.traverse(o=>{if(o.isMesh&&o!==body&&o.visible)others.push(o);});
  try{for(const v of [[3.14,0.1],[3.14,-0.3],[2.6,-0.2],[2.0,-0.5],[0.6,0.3]]){look(v[0],v[1],1.0);for(const m of others)m.visible=false;body.material=red;const A=grab();body.material=red2;const B=grab();body.material=mb;for(const m of others)m.visible=true;let a=0,b=0;for(let i=0;i<A.length;i+=4){if(isR(A,i))a++;if(isR(B,i))b++;}
    out.see.push({view:v,front:a,double:b,share:+((b-a)/Math.max(1,b)).toFixed(4)});}}
  finally{body.material=mb;for(const m of others)m.visible=true;cam.position.copy(o.p);cam.quaternion.copy(o.q);cam.updateMatrixWorld();}
  out.air=Q.comp().st.air;return out;},[PT]);
 if(FB)check(KEY+' in game: flying, nothing shows through its body (the body drawn alone, double-sided, covers under 0.3% more pixels than drawn front-only, from five sides)',FB.air==='fly'&&FB.see.every(q=>q.double>300&&q.share<0.003),{air:FB.air,see:FB.see.map(q=>[q.front,q.double,q.share])});
 else check(KEY+' in game: the flying body measured',false,null);
 await shot('fly-riding',null);
 await shot('fly-close',(g,h)=>[[g.x+Math.sin(h+2.3)*1.5,g.y+0.8,g.z+Math.cos(h+2.3)*1.5],[g.x,g.y,g.z]]);
 await page.evaluate(()=>{window.__BIRD.step(70);});
 await shot('fly-close-side',(g,h)=>[[g.x+Math.sin(h-1.7)*1.3,g.y+0.25,g.z+Math.cos(h-1.7)*1.3],[g.x,g.y,g.z]]);
 /* with the pegasus in the picture: a camera off to the side and above, both of them in it */
 await shot('fly-pegasus',(g,h)=>{const p=window.__BIRD.p.pos;const mx=(g.x+p.x)/2,my=g.y+0.3,mz=(g.z+p.z)/2,dx=g.x-p.x,dz=g.z-p.z,l=Math.hypot(dx,dz)||1,s=(-dz/l)*Math.sin(h)+(dx/l)*Math.cos(h)>0?1:-1,nx=-dz/l*s,nz=dx/l*s;return [[mx+nx*6+Math.sin(h)*2.5,my+1.6,mz+nz*6+Math.cos(h)*2.5],[mx,my,mz]];});   // (from the side of the line between them, a little ahead, at the bird's height: the horse's own y is not a world height)
 /* the landing, frame by frame */
 const LD=await page.evaluate(()=>{const Q=window.__BIRD,S=[];const fb=document.getElementById('flyBtn');if(fb&&Q.p.flying)fb.click();
  for(let i=0;i<400;i++){Q.step(17);const s=Q.sample();S.push(s);if(!Q.p.flying&&S.filter(o=>o.air==='ground').length>150)break;}return S;});
 const td=LD.findIndex(o=>o.air==='ground'),tdT=td>=0?LD[td].t:null,landSeen=LD.some(o=>(o.w.land||0)>0.5);
 const okStand=o=>o.air==='ground'&&!o.sk&&o.alt<0.03&&o.d<6&&ground(o.w)>0.9;let runN=0,stood=null;
 if(td>=0)for(const o of LD){if(o.t<tdT||o.t-tdT>3)continue;runN=okStand(o)?runN+1:0;if(runN>=30&&stood==null)stood=+(o.t-tdT).toFixed(2);}
 check(KEY+' in game: lands beside the horse with its land clip and stands with its idle',landSeen&&td>=0&&stood!=null&&LD.every(o=>o.real==='ready'&&!o.drawn),{touchdownAt:tdT,stoodBy:stood,last:(()=>{const l=LD[LD.length-1];return {alt:+l.alt.toFixed(3),d:+l.d.toFixed(2),w:l.w};})()});
 if(SHOTS)fs.writeFileSync(path.join(SHOTS,KEY+'-frames.json'),JSON.stringify({walk:WKF,slope:WKS,gallop:GL,takeoff:TO,fly:FL,land:LD}));
 await shot('landed-close',(g,h)=>[[g.x+Math.sin(h-0.6)*1.1,g.y+0.5,g.z+Math.cos(h-0.6)*1.1],[g.x,g.y+0.22,g.z]]);
 await shot('landed-riding',null);
 }
 check('no page errors, and no console errors or warnings from the pet models (the birds, the bird rig, the autorig)',errors.length===0,errors.slice(0,8));
 const fails=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-fails.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(0)+' s');
 await browser.close();process.exit(fails.length?1:0);
})().catch(async e=>{console.error(e.stack||e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
