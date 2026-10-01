/* The autorigged pets (assets/pet-autorig.js): the models that came with no skeleton, given one at load.
   Proves, with the shipped manifest (assets/models/pets/manifest.json):
     1. each autorigged pet loads through assets/pet-library.js and gets a skeleton: one or more
        SkinnedMeshes on 21 bones, skin weights that sum to one on valid bones, no vertex-cache frames left,
        not a resting-only body, the clips it needs (idle and walk, trot, run; the hares idle and a hop),
        fitted to its size;
     2. its gaits are sound, measured on the clips themselves as the game plays them (phased by the stride):
        every paw that is on the ground stays put while the body travels one stride (no skating), the paws
        reach the ground and never go under it, the head leads (it faces the way it walks), the idle stands
        on four legs (no T-pose, not the sitting bind pose), the fox's sit clip sits;
     3. in the real game each one replaces the drawn pet and stays the real body while it walks, gallops and
        stops (no flip to the drawn pet), with the clip that fits its speed; the hares hop with their hop; the paws
        hold the grass as the game drives them beside a walking and a galloping horse (the hares per hop, the rest per stride);
     4. no page errors.
   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-pet-autorig.cjs
   PETS=fox,lamb limits the list; an entry with "available": false (parked, the drawn pet shows) is skipped unless PETS names it and QA_PARKED=1. */
const QA=require('./qa-platform.cjs');
const fs=require('fs'),path=require('path');
const {chromium}=QA;
const ROOT=path.resolve(__dirname,'..');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now(),stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 1500 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},1500000).unref();   // seven pets with their paws tracked frame by frame take 5 to 14 minutes on a busy machine
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/pets/manifest.json'),'utf8'));
const entry=k=>{const P=manifest.pets;let e=P[k],out={};const chain=[];while(e){chain.unshift(e);e=e.base?P[e.base]:null;}for(const c of chain)for(const x in c)out[x]=c[x]&&typeof c[x]==='object'&&!Array.isArray(c[x])&&out[x]&&typeof out[x]==='object'?Object.assign({},out[x],c[x]):c[x];return out;};
/* the four-legged autorigs (quadruped, hare); a bird (the owl) has its own rig and its own check, tools/qa-pet-owl.cjs */
const isQuad=k=>{const a=entry(k).autorig;return !!a&&a.template!=='bird';};
const ALL=Object.keys(manifest.pets).filter(k=>isQuad(k)&&entry(k).available!==false);
const PARKED=Object.keys(manifest.pets).filter(k=>isQuad(k)&&entry(k).available===false);
const PETS=(process.env.PETS?process.env.PETS.split(','):ALL).filter(k=>ALL.includes(k)||(process.env.QA_PARKED&&PARKED.includes(k)));
const HEIGHT={fox:.52,fennec:.40,glimmerfox:.562,lamb:.60,snowhare:.42,bunny:.38,owl:.50,raccoon:.44};
const errors=[];
(async()=>{
 check('the manifest lists autorigged pets',PETS.length>0,{autorigged:ALL,parked:PARKED});
 for(const k of PETS){const e=entry(k),f=path.join(ROOT,'assets/models/pets',e.file||'');const ok=fs.existsSync(f);const b=ok?fs.statSync(f).size:0;
  check(k+': its file ships, under 4 MB, and matches the manifest (bytes), with licence, creator and source',ok&&b<4*1048576&&(!e.bytes||e.bytes===b)&&e.license&&e.creator&&e.sourceUrl,{file:e.file,bytes:b});
  const att=fs.readFileSync(path.join(ROOT,'assets/models/pets/ATTRIBUTION.md'),'utf8');check(k+': credited in ATTRIBUTION.md',att.includes(e.title||'@@'),{title:e.title});}
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));if(/pet models|autorig/.test(m.text())&&m.type()==='warning')errors.push('WARN '+m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 /* QA_PARKED=1 with PETS naming a parked pet: the page's copy of the manifest has it switched on for this run only */
 const ON=PETS.filter(k=>PARKED.includes(k));
 if(ON.length)await page.route(/\/assets\/models\/pets\/manifest\.json(\?.*)?$/,r=>{const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/pets/manifest.json'),'utf8'));for(const k of ON){let e=m.pets[k];while(e&&e.base)e=m.pets[e.base];if(e)e.available=true;if(m.pets[k])m.pets[k].available=true;}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(m)});});
 stage('boot');
 await page.goto(QA.BASE+'/ranch3d.html?qa=autorig&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1000);
 stage('booted');
 /* ---- 1 and 2: the library on its own, with the game's THREE ------------------------------------- */
 const lib=await page.evaluate(async([PETS,HEIGHT])=>{
  const G=window.__features,THREE=G.THREE;
  const [L,GL,SU]=await Promise.all([import('./assets/pet-library.js?qa='+Date.now()),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/SkeletonUtils.js')]);
  const lib=L.createPetLibrary({THREE,GLTFLoader:GL.GLTFLoader,clone:SU.clone});await lib.ready;
  const out={};
  for(const k of PETS){const r=out[k]={};
   try{
    const a=await lib.load(k,{height:HEIGHT[k]||0.5});const I=lib.instantiate(a);const ar=a.scene.userData.autorig||null;
    r.autorig=ar?{template:ar.template,bones:ar.bones,clips:ar.clips,standingBind:ar.standingBind}:null;
    r.dims=I.dims;r.clips=Object.assign({},a.src);r.restOnly=I.restOnly;r.morph=a.morphFrames;
    /* skin: weights sum to one, indices on real bones */
    let skinned=0,bad=0,n=0;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;skinned++;const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,nb=o.skeleton.bones.length;
     for(let i=0;i<si.count;i+=7){n++;let s=0;for(let c=0;c<4;c++){s+=sw.getComponent(i,c);if(si.getComponent(i,c)>=nb)bad++;}if(Math.abs(s-1)>0.01)bad++;}});
    r.skinned=skinned;r.skinBad=bad;r.skinN=n;
    /* the paws: each leg's end point, carried by its lowest bone */
    const J=ar.joints,B=nm=>I.model.getObjectByName('ar_'+nm),legs={fL:['wristL','toeL'],fR:['wristR','toeR'],hL:['hockL','toeHL'],hR:['hockR','toeHR']};
    const root=I.root;root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const paw=L2=>{const [b,t]=legs[L2],bone=B(b);const off=new THREE.Vector3().fromArray(J[t]).sub(new THREE.Vector3().fromArray(J[b]));return bone.localToWorld(off);};
    const W=s=>{const w={};w[s]=1;return w;};
    const pose=(s,ph)=>{for(let z=0;z<3;z++)I.update(0.001,{w:W(s),phase:ph,phased:[s],snap:true});root.updateMatrixWorld(true);};
    const body=()=>({head:B('head').getWorldPosition(new THREE.Vector3()),hips:B('hips').getWorldPosition(new THREE.Vector3())});
    /* the paw's own underside: the lowest skinned vertex carried mostly by one of that leg's bones */
    const chains={fL:['shoulderL','elbowL','wristL'],fR:['shoulderR','elbowR','wristR'],hL:['hipL','kneeL','hockL'],hR:['hipR','kneeR','hockR']};
    const pawMesh=()=>{const out={};I.model.traverse(o=>{if(!o.isSkinnedMesh)return;const bn=o.skeleton.bones.map(b=>b.name.replace(/^ar_/,'')),si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,v=new THREE.Vector3();
     for(let i=0;i<si.count;i+=2){let best=-1,bw=0;for(let c=0;c<4;c++)if(sw.getComponent(i,c)>bw){bw=sw.getComponent(i,c);best=si.getComponent(i,c);}const nm=bn[best];const L2=Object.keys(chains).find(k=>chains[k].includes(nm));if(!L2)continue;o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(out[L2]==null||v.y<out[L2])out[L2]=v.y;}});for(const k in out)out[k]=+out[k].toFixed(3);return out;};
    pose('idle',0);const pi=pawMesh();const bi=body();r.idle={paws:pi,hipsY:+bi.hips.y.toFixed(3),headY:+bi.head.y.toFixed(3),headZ:+bi.head.z.toFixed(3),hipsZ:+bi.hips.z.toFixed(3)};
    if(a.clips.sit){pose('sit',0.3);const b=body();r.sit={hipsY:+b.hips.y.toFixed(3)};}
    /* the raccoon: a low, long body with an arched back, the tail on its own chain of bones, and a sit with every paw on the grass */
    if(ar.template==='raccoon'){const P=nm=>B(nm).getWorldPosition(new THREE.Vector3());pose('idle',0);const hp=P('hips'),sp=P('spine'),ch=P('chest');
     const rc=r.raccoon={arch:+(sp.y-(hp.y+ch.y)/2).toFixed(4),lengthToHeight:+(I.dims.len/I.dims.h).toFixed(2),legShare:+(((P('shoulderL').y+P('hipL').y)/2)/I.dims.h).toFixed(2)};
     /* skin: every vertex held mostly by a tail bone lies behind the hips, and no vertex held mostly by a thigh or shank leans on the tail */
     let tailV=0,tailFront=0,legOnTail=0;const hz=hp.z;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;const bn=o.skeleton.bones.map(b=>b.name.replace(/^ar_/,'')),si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,v=new THREE.Vector3();
      for(let i=0;i<si.count;i++){let best=-1,bw=0,tw=0;for(let c=0;c<4;c++){const w=sw.getComponent(i,c),nm=bn[si.getComponent(i,c)];if(/^tail/.test(nm))tw+=w;if(w>bw){bw=w;best=nm;}}
       if(/^tail/.test(best)){tailV++;o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(v.z>hz)tailFront++;}else if(/^(hip[LR]|knee|hock)/.test(best)&&tw>0.1)legOnTail++;}});
     Object.assign(rc,{tailVerts:tailV,tailInFrontOfHips:tailFront,legVertsOnTail:legOnTail});
     if(a.clips.sit){pose('sit',0.3);const pm=pawMesh();let lo=Infinity;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;const v=new THREE.Vector3();for(let j=0;j<o.geometry.attributes.position.count;j+=3){o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld);lo=Math.min(lo,v.y);}});
      const b=body();rc.sit={paws:pm,skinMin:+lo.toFixed(4),headY:+b.head.y.toFixed(3),hipsY:+b.hips.y.toFixed(3)};}}
    r.gaits={};
    const hareT=ar.template==='hare';
    for(const s of (hareT?[]:['walk','trot','run'])){if(!a.clips[s])continue;const S=I.stride(s),N=48,tr={};for(const L2 in legs)tr[L2]=[];let headLead=0,minY=Infinity,maxLiftY=0;
     /* two cycles, the body carried forward one stride per cycle as the game carries it */
     for(let i=0;i<2*N;i++){const ph=i/N;pose(s,ph%1);for(const L2 in legs){const p=paw(L2);tr[L2].push([p.z+S*ph,p.y]);minY=Math.min(minY,p.y);maxLiftY=Math.max(maxLiftY,p.y);}const b=body();if(b.head.z>b.hips.z)headLead++;}
     /* skating: while a paw is down (within 1.5 cm of its lowest, or a fifth of its lift for a small pet), how far does it move over the ground? each
        stretch on the ground on its own, leaving out the stretches cut by the ends of the sampling */
     let skate=0;for(const L2 in legs){const T=tr[L2],lo=Math.min(...T.map(v=>v[1])),hi=Math.max(...T.map(v=>v[1])),thr=Math.min(0.015,0.2*(hi-lo));let run=[];const runs=[];T.forEach((v,i)=>{if(v[1]<lo+thr)run.push([i,v[0]]);else if(run.length){runs.push(run);run=[];}});if(run.length)runs.push(run);
      for(const R of runs){if(R.length<2||R[0][0]===0||R[R.length-1][0]===T.length-1)continue;const zs=R.map(v=>v[1]);skate=Math.max(skate,(Math.max(...zs)-Math.min(...zs))/Math.max(1e-6,S));}}
     r.gaits[s]={stride:+S.toFixed(3),skate:+skate.toFixed(3),minY:+minY.toFixed(3),lift:+maxLiftY.toFixed(3),headLead:headLead/(2*N)};}
    if(a.clips.run&&!a.clips.walk){const s='run',N=30;let minY=Infinity,moved=0,prev=null;for(let i=0;i<N;i++){pose(s,i/N);let lo=Infinity;for(const L2 in legs)lo=Math.min(lo,paw(L2).y);minY=Math.min(minY,lo);const hy=B('hockL').getWorldPosition(new THREE.Vector3());if(prev)moved+=prev.distanceTo(hy);prev=hy;}r.hop={minY:+minY.toFixed(3),legTravel:+moved.toFixed(3)};
     /* the hare's hop and bound: the skin never under the grass, and with the paws down (phase 0.96 to 0.02: the landing done, the
        push not yet begun) every paw's underside within 1.2 cm of it; the planted paws sweep back at the rate the clip publishes */
     for(const s2 of ['run','bound']){if(!a.clips[s2])continue;let skinMin=Infinity,downMax=0,sweep=[];
      for(let i=0;i<40;i++){const ph=i/40;pose(s2,ph+1e-4*(i%2));const pm=pawMesh();let lo=Infinity;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;const v=new THREE.Vector3();for(let j=0;j<o.geometry.attributes.position.count;j+=5){o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld);lo=Math.min(lo,v.y);}});skinMin=Math.min(skinMin,lo);
       if(ph>=0.96||ph<=0.02)downMax=Math.max(downMax,...Object.values(pm));}
      /* sweep: the hind paw's travel along the body between phase 0 and 0.1 (both hind feet planted), per unit of phase */
      const zAt=ph=>{pose(s2,ph);return (paw('hL').z+paw('hR').z)/2;};const z0=zAt(0),z1=zAt(0.1);
      r[s2==='run'?'hopClip':'boundClip']={skinMin:+skinMin.toFixed(4),downMax:+downMax.toFixed(4),sweep:+((z0-z1)/0.1).toFixed(4),published:+(((s2==='run'?ar.hopSweep:ar.boundSweep)||0)*a.scale).toFixed(4)};}}
    I.dispose();
   }catch(e){r.error=String(e&&e.message||e);}}
  return out;},[PETS,HEIGHT]);
 for(const k of PETS){const r=lib[k];
  if(r.error){check(k+': loads and is autorigged',false,r.error);continue;}
  const hare=r.autorig&&r.autorig.template==='hare';
  check(k+': loads and gets a skeleton (21 bones, skinned, weights sum to one on valid bones)',r.autorig&&r.autorig.bones===21&&r.skinned>0&&r.skinBad===0,{autorig:r.autorig,skinned:r.skinned,bad:r.skinBad,of:r.skinN});
  check(k+': no vertex-cache frames and not a resting-only body',!r.morph&&!r.restOnly,{morph:r.morph,restOnly:r.restOnly});
  check(k+': has the clips it needs',hare?!!(r.clips.idle&&r.clips.run):!!(r.clips.idle&&r.clips.walk&&r.clips.trot&&r.clips.run),r.clips);
  const H=HEIGHT[k]||0.5,e=entry(k),want=(e.fit&&e.fit.height)||H;check(k+': fitted to its size ('+want+' m)',Math.abs(r.dims.h-want)<0.02*want+0.005,r.dims);
  const pY=Object.values(r.idle.paws);check(k+': idle stands on four paws on the grass (each paw\'s underside within 3.5 cm of the grass, none under it)',pY.length===4&&pY.every(y=>y>-0.012&&y<0.035),r.idle);
  if(!hare)check(k+': idle stands up (hips well off the ground, head in front of the hips)',r.idle.hipsY>0.3*r.dims.h&&r.idle.headZ>r.idle.hipsZ,r.idle);
  if(r.sit)check(k+': its sit clip sits (hips lower than standing)',r.sit.hipsY<r.idle.hipsY-0.05*r.dims.h,{sit:r.sit,idleHips:r.idle.hipsY});
  if(r.raccoon){const rc=r.raccoon;
   check(k+': a raccoon\'s build: low and long (body over 1.5 times as long as tall), short legs (shoulders and hips under 60% of its height), the back arched up between hips and chest',rc.lengthToHeight>1.5&&rc.legShare<0.6&&rc.arch>0.004,rc);
   check(k+': its thick tail moves on its own chain (every tail-held vertex behind the hips, no leg vertex leaning on the tail)',rc.tailVerts>200&&rc.tailInFrontOfHips===0&&rc.legVertsOnTail===0,rc);
   if(rc.sit){const pY=Object.values(rc.sit.paws);check(k+': it sits with all four paws on the grass (each within 3.5 cm, none under it), no skin under the grass, the head held up',pY.length===4&&pY.every(y=>y>-0.012&&y<0.035)&&rc.sit.skinMin>-0.006&&rc.sit.headY>r.idle.hipsY,rc.sit);}
   else check(k+': has a sit clip',false,r.clips);}
  for(const s in r.gaits){const g=r.gaits[s];
   check(k+' '+s+': the paws on the ground stay put over a stride (skating under 15% of the stride)',g.skate<0.15&&g.stride>0,g);
   check(k+' '+s+': paws reach the ground, never under it, and lift in the swing',g.minY>-0.015&&g.minY<0.02&&g.lift>0.01,g);
   check(k+' '+s+': faces the way it walks (head ahead of the hips all the way through)',g.headLead===1,g);}
  if(r.hop){check(k+': the hop moves the legs and stays on or above the grass',r.hop.legTravel>0.02&&r.hop.minY>-0.015,r.hop);}
  for(const [nm,c] of [['hop',r.hopClip],['bound (its gallop)',r.boundClip]])if(c){
   check(k+' '+nm+': no skin under the grass, all four paws down together at the landing (each within 1.2 cm)',c.skinMin>-0.004&&c.downMax<0.012,c);
   check(k+' '+nm+': the planted hind paws sweep back at the rate the game moves it on the grass (within 25%)',c.published>0&&Math.abs(c.sweep-c.published)<0.25*c.published,c);}
 }
 /* ---- 3: in the game ---------------------------------------------------------------------------------- */
 await page.evaluate(()=>{const G=window.__features,p=G.horse.player;const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&G.wardrobe)G.wardrobe.closeChar();
  const key=(k,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:k,key:k,bubbles:true}));
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const info=()=>{const c=G.pets.comp(),r=G.petModels.real(c);return {key:c.key,real:r.state,clip:r.clip,err:r.err,drawn:c.parts.bodyPivot.visible,spd:+(c.st.spd||0).toFixed(2),restOnly:r.info&&r.info.restOnly,hop:c.st.hopAir};};
  window.__AR={G,p,key,reset,info};});
 for(const k of PETS){
  await page.evaluate(k=>{const A=window.__AR,G=A.G;G.hidePanels&&G.hidePanels();G.save.sync(s=>{s.petList=Array.from(new Set([...(s.petList||[]),k]));});A.reset(-100,400,Math.PI);if(G.pets.active()!==k)G.pets.setActive(k);else G.pets.rebuild();A.key('KeyW',true);window.advanceTime(600);A.key('KeyW',false);},k);
  let st=null;for(let i=0;i<80;i++){st=await page.evaluate(()=>{window.advanceTime(100);return window.__AR.info();});if(st.real==='ready'||st.real==='failed'||st.real==='none')break;await page.waitForTimeout(250);}
  check(k+' in game: the real body loads and replaces the drawn pet',st.real==='ready'&&!st.drawn&&!st.restOnly,st);
  if(st.real!=='ready')continue;
  const run=await page.evaluate(()=>{const A=window.__AR,out=[];A.reset(-100,400,Math.PI);window.advanceTime(1500);A.key('KeyW',true);for(let i=0;i<30;i++){window.advanceTime(100);out.push(A.info());}A.key('ShiftLeft',true);for(let i=0;i<40;i++){window.advanceTime(100);out.push(A.info());}A.key('ShiftLeft',false);A.key('KeyW',false);for(let i=0;i<60;i++){window.advanceTime(100);out.push(A.info());}return out;});
  const face=await page.evaluate(()=>{const A=window.__AR,G=A.G,T=G.THREE,out=[];A.reset(-100,400,Math.PI);window.advanceTime(1200);A.key('KeyW',true);A.key('ShiftLeft',true);let prev=null;
   for(let i=0;i<30;i++){window.advanceTime(100);const c=G.pets.comp(),I=c.parts.real&&c.parts.real.inst;if(!I)continue;const hd=I.model.getObjectByName('ar_head'),hp=I.model.getObjectByName('ar_hips');if(!hd||!hp)continue;const a=hd.getWorldPosition(new T.Vector3()),b=hp.getWorldPosition(new T.Vector3()),p=c.pos.clone();
    if(prev){const vx=p.x-prev.x,vz=p.z-prev.z,L=Math.hypot(vx,vz);if(L>0.2)out.push(((a.x-b.x)*vx+(a.z-b.z)*vz)/(L*Math.max(1e-6,Math.hypot(a.x-b.x,a.z-b.z))));}prev=p;}
   A.key('ShiftLeft',false);A.key('KeyW',false);for(let i=0;i<30;i++)window.advanceTime(100);return out;});
  check(k+' in game: faces the way it runs (head ahead of the hips along its path)',face.length>5&&face.filter(v=>v>0.7).length>=face.length*0.9,{n:face.length,min:Math.min(...face).toFixed(2),mean:(face.reduce((x,y)=>x+y,0)/Math.max(1,face.length)).toFixed(2)});
  /* a hare's paws on the grass: each contact tracked at 60 frames a second while it hops beside a walking, then a galloping
     horse; how far the paw moves over the ground while it is down (its tip under 8 mm up; the landing frame just above the grass is not a touch) */
  const hareK=lib[k]&&lib[k].autorig&&lib[k].autorig.template==='hare';
  if(hareK){const sl=await page.evaluate(()=>{const A=window.__AR,G=A.G,T=G.THREE;A.reset(-100,400,Math.PI);window.advanceTime(1500);
    const c0=G.pets.comp(),I=c0.parts.real&&c0.parts.real.inst;if(!I)return null;const J=I.asset.scene.userData.autorig.joints,legs={fL:['wristL','toeL'],fR:['wristR','toeR'],hL:['hockL','toeHL'],hR:['hockR','toeHR']},bone={},off={};
    for(const L in legs){bone[L]=I.model.getObjectByName('ar_'+legs[L][0]);off[L]=new T.Vector3().fromArray(J[legs[L][1]]).sub(new T.Vector3().fromArray(J[legs[L][0]]));}
    const tr=[];const step=n=>{for(let i=0;i<n;i++){window.advanceTime(1000/60);const c=G.pets.comp();const f={spd:c.st.spd||0,p:{}};for(const L in legs){const v=bone[L].localToWorld(off[L].clone());f.p[L]=[v.x,v.y-G.petModels.standY(v.x,v.z),v.z];}tr.push(f);}};
    A.key('KeyW',true);step(300);A.key('ShiftLeft',true);step(300);A.key('ShiftLeft',false);A.key('KeyW',false);step(60);
    const cont=[];for(const L in legs){let run=[];const flush=()=>{if(run.length>=2){const a=run[0].p[L];let mx=0;for(const f of run)mx=Math.max(mx,Math.hypot(f.p[L][0]-a[0],f.p[L][2]-a[2]));cont.push({L,spd:run.reduce((s,f)=>s+f.spd,0)/run.length,slide:mx});}run=[];};
     for(const f of tr){if(f.p[L][1]<0.008&&f.spd>0.3)run.push(f);else flush();}flush();}
    const bin=(a,b)=>{const s=cont.filter(x=>x.spd>=a&&x.spd<b).map(x=>x.slide).sort((x,y)=>x-y);return {n:s.length,median:+(s[Math.floor(s.length/2)]||0).toFixed(3),p90:+(s[Math.floor(s.length*0.9)]||0).toFixed(3),max:+(s[s.length-1]||0).toFixed(3)};};
    return {slow:bin(0.3,2),mid:bin(2,7),fast:bin(7,20)};});
   check(k+' in game: its paws hold the grass while it hops (at 2-7 m/s each paw slides under 3 cm per touch, 90% of touches)',sl&&sl.mid.n>=8&&sl.mid.p90<0.03,sl);}
  /* every other autorigged pet's paws on the grass, the same way, beside a walking and then a galloping horse (4-6 m/s, then
     10-16 m/s, far faster than the clips' own pace: the game steps a real body no faster than its gait's top cadence, so a
     stride too short for the legs skates here even when the clip itself plants its paws): on consecutive frames with a paw
     down (its tip under 12 mm up) how fast it moves over the ground as a share of the body's speed (0 planted, 1 skating),
     and how far each paw slides per touch */
  else{const sl=await page.evaluate(()=>{const A=window.__AR,G=A.G,T=G.THREE;A.reset(-100,400,Math.PI);window.advanceTime(1500);
    const c0=G.pets.comp(),I=c0.parts.real&&c0.parts.real.inst;if(!I)return null;const J=I.asset.scene.userData.autorig.joints,legs={fL:['wristL','toeL'],fR:['wristR','toeR'],hL:['hockL','toeHL'],hR:['hockR','toeHR']},bone={},off={};
    for(const L in legs){bone[L]=I.model.getObjectByName('ar_'+legs[L][0]);off[L]=new T.Vector3().fromArray(J[legs[L][1]]).sub(new T.Vector3().fromArray(J[legs[L][0]]));}
    const tr=[];const step=n=>{for(let i=0;i<n;i++){window.advanceTime(1000/60);const c=G.pets.comp(),g=c.parts.group.position,w=I.info().weights||{},top=Math.max(w.walk||0,w.trot||0,w.run||0);const f={spd:c.st.spd||0,b:[g.x,g.z],p:{},pure:top>=0.9?['walk','trot','run'].find(k=>(w[k]||0)===top):null};for(const L in legs){const v=bone[L].localToWorld(off[L].clone());f.p[L]=[v.x,v.y-G.petModels.standY(v.x,v.z),v.z];}tr.push(f);}};
    A.key('KeyW',true);step(90);const w0=tr.length;step(300);A.key('ShiftLeft',true);step(120);const s0=tr.length;step(300);A.key('ShiftLeft',false);A.key('KeyW',false);step(60);
    const down=(f,L)=>f.p[L][1]<0.012;
    const slip=(a,b,lo,hi)=>{const v=[];for(let j=Math.max(1,a);j<b;j++){const f0=tr[j-1],f1=tr[j],bd=Math.hypot(f1.b[0]-f0.b[0],f1.b[1]-f0.b[1]);if(bd<1e-4||f1.spd<(lo||0.3)||f1.spd>=(hi||99)||(lo&&!(f0.pure&&f0.pure===f1.pure)))continue;for(const L in legs)if(down(f0,L)&&down(f1,L))v.push(Math.hypot(f1.p[L][0]-f0.p[L][0],f1.p[L][2]-f0.p[L][2])/bd);}
     v.sort((x,y)=>x-y);const sp=tr.slice(a,b).map(f=>f.spd).sort((x,y)=>x-y);return {n:v.length,median:+(v[v.length>>1]||0).toFixed(2),p75:+(v[Math.floor(v.length*0.75)]||0).toFixed(2),spd:[+(sp[0]||0).toFixed(1),+(sp[sp.length-1]||0).toFixed(1)]};};
    const touch=(a,b,lo,hi)=>{const s=[];for(const L in legs){let run=[];const flush=()=>{const m=run.length?run.reduce((x,f)=>x+f.spd,0)/run.length:0;if(run.length>=2&&m>=(lo||0)&&m<(hi||99)){const p0=run[0].p[L];let mx=0;for(const f of run)mx=Math.max(mx,Math.hypot(f.p[L][0]-p0[0],f.p[L][2]-p0[2]));s.push(mx);}run=[];};
      for(let j=a;j<b;j++){const f=tr[j];if(down(f,L)&&f.spd>0.3&&(!lo||(f.pure&&(!run.length||run[0].pure===f.pure))))run.push(f);else flush();}flush();}
     s.sort((x,y)=>x-y);return {n:s.length,median:+(s[s.length>>1]||0).toFixed(3),p75:+(s[Math.floor(s.length*0.75)]||0).toFixed(3)};};
    return {all:{slip:slip(w0,tr.length,2,20),touch:touch(w0,tr.length,2,20)},walkHorse:{slip:slip(w0,w0+300),touch:touch(w0,w0+300)},gallopHorse:{slip:slip(s0,s0+300),touch:touch(s0,s0+300)}};});
   /* "all": every frame at 2-20 m/s while one gait clip shows on its own (weight 0.9 or more): a body whose strides are too short
      for the speed the game runs it at slides in every gait (the raccoon's first gaits: half its speed, 15-21 cm a touch); the
      frames where one gait blends into the next slide for every pet, a limit of the blend, and are reported, not judged */
   check(k+' in game: its paws hold the grass beside a walking and a galloping horse (at 2-20 m/s, in a gait on its own, a planted paw moves under 30% of the body\'s speed and slides under 6 cm per touch, medians)',
    sl&&sl.all.slip.n>=40&&sl.all.slip.median<0.3&&sl.all.touch.median<0.06,sl);}
  const flips=run.filter(o=>o.drawn||o.real!=='ready').length,clips=[...new Set(run.map(o=>o.clip))],fast=run.filter(o=>o.spd>7),last=run[run.length-1];
  check(k+' in game: stays the real body through walk, gallop and stop (never the drawn pet)',flips===0,{flips,clips});
  const hare=lib[k]&&lib[k].autorig&&lib[k].autorig.template==='hare';
  const fastOK=o=>o.clip==='run'||(hare&&o.clip==='bound');   // a hare hops with its hop (run) and, at speed, its gallop (bound)
  check(k+' in game: '+(hare?'hops with its hop clip while it moves (its gallop, bound, over 7 m/s when it has one)':'gallops with its run clip at speed (85% of the frames over 7 m/s; the rest blend from the trot)')+', and rests again after stopping',fast.length>0&&fast.filter(fastOK).length>=0.85*fast.length&&(last.clip==='idle'||last.clip==='sit'),{fastSamples:fast.length,runFrames:fast.filter(fastOK).length,clips:[...new Set(run.map(o=>o.clip))],other:[...new Set(fast.filter(o=>!fastOK(o)).map(o=>o.clip+'@'+o.spd))].slice(0,5),maxSpd:Math.max(...run.map(o=>o.spd)),last});
 }
 check('no page errors or pet-model warnings',errors.length===0,errors.slice(0,8));
 const fails=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-fails.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(0)+' s');
 await browser.close();process.exit(fails.length?1:0);
})().catch(async e=>{console.error(e.stack||e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
