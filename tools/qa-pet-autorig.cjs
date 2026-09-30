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
        stops (no flip to the drawn pet), with the clip that fits its speed; the hares hop with their hop;
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
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/models/pets/manifest.json'),'utf8'));
const entry=k=>{const P=manifest.pets;let e=P[k],out={};const chain=[];while(e){chain.unshift(e);e=e.base?P[e.base]:null;}for(const c of chain)for(const x in c)out[x]=c[x]&&typeof c[x]==='object'&&!Array.isArray(c[x])&&out[x]&&typeof out[x]==='object'?Object.assign({},out[x],c[x]):c[x];return out;};
const ALL=Object.keys(manifest.pets).filter(k=>entry(k).autorig&&entry(k).available!==false);
const PARKED=Object.keys(manifest.pets).filter(k=>entry(k).autorig&&entry(k).available===false);
const PETS=(process.env.PETS?process.env.PETS.split(','):ALL).filter(k=>ALL.includes(k)||(process.env.QA_PARKED&&PARKED.includes(k)));
const HEIGHT={fox:.52,fennec:.40,glimmerfox:.562,lamb:.60,snowhare:.42,bunny:.38,owl:.50};
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
    if(a.clips.run&&!a.clips.walk){const s='run',N=30;let minY=Infinity,moved=0,prev=null;for(let i=0;i<N;i++){pose(s,i/N);let lo=Infinity;for(const L2 in legs)lo=Math.min(lo,paw(L2).y);minY=Math.min(minY,lo);const hy=B('hockL').getWorldPosition(new THREE.Vector3());if(prev)moved+=prev.distanceTo(hy);prev=hy;}r.hop={minY:+minY.toFixed(3),legTravel:+moved.toFixed(3)};}
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
  for(const s in r.gaits){const g=r.gaits[s];
   check(k+' '+s+': the paws on the ground stay put over a stride (skating under 15% of the stride)',g.skate<0.15&&g.stride>0,g);
   check(k+' '+s+': paws reach the ground, never under it, and lift in the swing',g.minY>-0.015&&g.minY<0.02&&g.lift>0.01,g);
   check(k+' '+s+': faces the way it walks (head ahead of the hips all the way through)',g.headLead===1,g);}
  if(r.hop){check(k+': the hop moves the legs and stays on or above the grass',r.hop.legTravel>0.02&&r.hop.minY>-0.015,r.hop);}
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
  const flips=run.filter(o=>o.drawn||o.real!=='ready').length,clips=[...new Set(run.map(o=>o.clip))],fast=run.filter(o=>o.spd>7),last=run[run.length-1];
  check(k+' in game: stays the real body through walk, gallop and stop (never the drawn pet)',flips===0,{flips,clips});
  const hare=lib[k]&&lib[k].autorig&&lib[k].autorig.template==='hare';
  check(k+' in game: '+(hare?'hops with its hop clip while it moves':'gallops with its run clip at speed (85% of the frames over 7 m/s; the rest blend from the trot)')+', and rests again after stopping',fast.length>0&&fast.filter(o=>o.clip==='run').length>=0.85*fast.length&&(last.clip==='idle'||last.clip==='sit'),{fastSamples:fast.length,runFrames:fast.filter(o=>o.clip==='run').length,other:[...new Set(fast.filter(o=>o.clip!=='run').map(o=>o.clip+'@'+o.spd))].slice(0,5),maxSpd:Math.max(...run.map(o=>o.spd)),last});
 }
 check('no page errors or pet-model warnings',errors.length===0,errors.slice(0,8));
 const fails=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-fails.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(0)+' s');
 await browser.close();process.exit(fails.length?1:0);
})().catch(async e=>{console.error(e.stack||e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
