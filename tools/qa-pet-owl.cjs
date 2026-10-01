/* The realistic barn owl (assets/pet-bird-rig.js, reached through assets/pet-autorig.js "template": "bird").
   Proves, with the owl's entry in assets/models/pets/manifest.json:
     1. its file ships (owl.glb, under 4 MB, bytes and sha256 as listed) and is credited in ATTRIBUTION.md;
        the open wings are drawn by the rig (no second model to fetch);
     2. through assets/pet-library.js it gets a skeleton (20 bones, two skinned meshes: the scan and the
        wings, weights summing to one on valid bones) and the clips the game drives (idle, walk = the hop,
        takeoff, fly, glide, land), fitted to its size; the scan's body is closed (the stump's cut capped: no open
        edge anywhere on it, the scan being drawn from the front only); the wings are opaque (an alpha cutout, never blended),
        the two wings the same feathers in the same colours (golden buff above, white below, the upper and
        under surfaces two faces each facing its own way), and they open and fold over several frames (grown
        and dithered in and out, never a pop);
     3. the clips are sound: the idle stands on its feet on the grass (no float, nothing under it) with the
        wings folded away and the head facing forward; the hop keeps both feet planted through its stance
        (no skating), lands them on the grass and lifts them in the air; in fly and glide the wings are
        spread (a real wingspan), and the fly clip beats them up and down;
     4. in the real game, beside a pegasus: the real owl replaces the drawn one, stands with its idle (head turns
        under 140 degrees with the game's look on top); beside a walking horse (Ctrl+W), stopping and moving to its
        spot, its hop never skates (stance feet slide under 15% of the body's travel, at most 4.5 hops a second)
        and above its hop's speed it flies low; lifted it is always in a flying pose and on the grass never in one;
        it takes off in its takeoff pose at once (takeoff weight 0.8 within a tenth of a second), flies beside the
        horse through a cruise, a climb and a turn with its wings open; flying, nothing shows through its body (from
        behind and below, the body drawn double-sided covers under 0.2% more pixels than drawn front-only), and the body
        reads with its wings, not as a dark lump between them (seen from above and behind, its back is at least 75% as
        bright as the wings' tops; seen from below, its underparts at least 75% as bright as the underwings); lands with its land clip with the wings
        folded as it touches down, and never flips back to the drawn owl; paired with the pegasus, the pair glow
        never tints the owl's own body nor shows the background through it (its pixels with the glow on against
        the same frame with it off), the market's halo sits behind it;
     5. no page errors, and no console errors or warnings from the pet code (other lanes' world errors are theirs).
   The owl may still be parked ("available": false): the page's copy of the manifest is then switched on for
   this run only (QA_OWL_SHIPPED=1 tests the manifest exactly as shipped). SHOTS=<dir> saves screenshots.
   Usage:  QA_PORT=8432 QA_URL=http://127.0.0.1:8432 NODE_PATH=$(npm root -g) node tools/qa-pet-owl.cjs */
const QA=require('./qa-platform.cjs');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=QA;
const ROOT=path.resolve(__dirname,'..');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now(),stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(0)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const MF=path.join(ROOT,'assets/models/pets/manifest.json'),manifest=JSON.parse(fs.readFileSync(MF,'utf8')),E=manifest.pets.owl||{};
const SHOTS=process.env.SHOTS||'';if(SHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const errors=[];
const HOME={x:-100,z:400,h:Math.PI};
(async()=>{
 /* ---- 1. files and credit ---------------------------------------------------------------------------------- */
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const f1=path.join(ROOT,'assets/models/pets',E.file||'@');
 const ok1=fs.existsSync(f1);
 check('owl: the manifest lists it with a bird autorig, a fly clip and licence, creator and source',E.autorig&&E.autorig.template==='bird'&&E.clips&&E.clips.fly&&E.license&&E.creator&&E.sourceUrl,{available:E.available});
 check('owl: owl.glb ships under 4 MB and matches the manifest (bytes, sha256)',ok1&&fs.statSync(f1).size<4*1048576&&fs.statSync(f1).size===E.bytes&&sha(f1)===E.sha256,{bytes:ok1?fs.statSync(f1).size:0});
 check('owl: the open wings are drawn by the rig (the manifest names no wing model to fetch)',E.autorig&&E.autorig.wing&&!E.autorig.wing.file&&!(E.parts&&E.parts.wing),E.autorig&&E.autorig.wing);
 const att=fs.readFileSync(path.join(ROOT,'assets/models/pets/ATTRIBUTION.md'),'utf8');
 check('owl: the scan is credited in ATTRIBUTION.md and in the manifest\'s credit',att.includes('Common Barn Owl')&&/Common Barn Owl/.test(E.credit||''),{});
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error'&&/pet|autorig|bird|owl/i.test(m.text()))errors.push(m.text().slice(0,300));if(/pet models|autorig|bird rig/.test(m.text())&&m.type()==='warning')errors.push('WARN '+m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 if(!process.env.QA_OWL_SHIPPED)await page.route(/\/assets\/models\/pets\/manifest\.json(\?.*)?$/,r=>{const m=JSON.parse(fs.readFileSync(MF,'utf8'));if(m.pets.owl)m.pets.owl.available=true;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(m)});});
 stage('boot');
 await page.goto(QA.BASE+'/ranch3d.html?qa=owl&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:240000,polling:250});
 await page.waitForTimeout(1000);
 stage('booted');
 /* ---- 2 and 3: the library on its own ------------------------------------------------------------------------ */
 const lib=await page.evaluate(async()=>{
  const G=window.__features,THREE=G.THREE,r={};
  try{
   const [L,GL,SU]=await Promise.all([import('./assets/pet-library.js?qa='+Date.now()),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/SkeletonUtils.js')]);
   const m=await (await fetch('./assets/models/pets/manifest.json?'+Date.now())).json();
   const lib=L.createPetLibrary({THREE,GLTFLoader:GL.GLTFLoader,clone:SU.clone,manifest:m,manifestURL:new URL('./assets/models/pets/manifest.json',location.href)});await lib.ready;
   const a=await lib.load('owl',{height:0.5,mustFly:true});const I=lib.instantiate(a);const br=a.scene.userData.birdRig||{};
   r.rig={bones:br.bones,clips:br.clips};r.src=Object.assign({},a.src);r.dims=I.dims;
   let skinned=0,bad=0,n=0;I.model.traverse(o=>{if(!o.isSkinnedMesh)return;skinned++;const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,nb=o.skeleton.bones.length;
    for(let i=0;i<si.count;i+=5){n++;let s=0;for(let c=0;c<4;c++){s+=sw.getComponent(i,c);if(si.getComponent(i,c)>=nb)bad++;}if(Math.abs(s-1)>0.01)bad++;}});
   r.skinned=skinned;r.skinBad=bad;
   /* the body closed: half-edges with no twin on the welded surface */
   {let bm=null;I.model.traverse(o=>{if(o.isSkinnedMesh&&o.name==='owl-body')bm=o;});const g=bm.geometry,P=g.attributes.position,ix=g.index.array,wd=new Int32Array(P.count),mp=new Map();
    for(let i=0;i<P.count;i++){const k=Math.round(P.getX(i)*2e4)+','+Math.round(P.getY(i)*2e4)+','+Math.round(P.getZ(i)*2e4);const w=mp.get(k);if(w==null){mp.set(k,i);wd[i]=i;}else wd[i]=w;}
    const he=new Set();for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++)he.add(wd[ix[t+k]]*4194304+wd[ix[t+(k+1)%3]]);let open=0;for(const h of he){const a=Math.floor(h/4194304),b=h%4194304;if(!he.has(b*4194304+a))open++;}
    r.bodyOpen=open;r.bodyTris=ix.length/3;}
   const root=I.root;root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
   const mesh=nm=>{let m=null;I.model.traverse(o=>{if(o.isSkinnedMesh&&o.name===nm)m=o;});return m;};
   const body=mesh('owl-body'),wing=mesh('owl-wings'),v=new THREE.Vector3();
   const box=(m,step)=>{const b=new THREE.Box3(),idx=m.geometry.index?m.geometry.index.array:null,cnt=idx?idx.length:m.geometry.attributes.position.count;for(let k=0;k<cnt;k+=step){const i=idx?idx[k]:k;m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);b.expandByPoint(v);}return b;};
   const pose=(s,ph)=>{const w={};w[s]=1;for(let z=0;z<3;z++)I.update(0.001,{w,phase:ph,phased:[s],snap:true});root.updateMatrixWorld(true);};
   const B=nm=>I.model.getObjectByName('ab_'+nm);
   const fwd=nm=>{const q=B(nm).getWorldQuaternion(new THREE.Quaternion());return new THREE.Vector3(0,0,1).applyQuaternion(q);};
   /* idle over its whole cycle: feet on the grass, wings folded away */
   let lo=1e9,hi=-1e9,wingMax=0;for(let i=0;i<12;i++){pose('idle',i/12);const b=box(body,7);lo=Math.min(lo,b.min.y);hi=Math.max(hi,b.min.y);const w=box(wing,5);b.expandByScalar(0.01);wingMax=Math.max(wingMax,b.containsBox(w)?0:1);}
   pose('idle',0);const hf=fwd('head');r.idle={lowMin:+lo.toFixed(4),lowMax:+hi.toFixed(4),wingExtent:+wingMax.toFixed(3),headFwd:+hf.z.toFixed(2),bodyW:+(box(body,7).max.x-box(body,7).min.x).toFixed(3)};
   /* the hop: two cycles, the body carried forward one stride per cycle; the feet in the stance stay put */
   const S=I.stride('walk'),N=40,tr={L:[],R:[]};let footLo=1e9,footHi=-1e9,wingHop=0;
   for(let i=0;i<2*N;i++){const ph=i/N;pose('walk',ph%1);for(const s of ['L','R']){const p=B('foot'+s).getWorldPosition(new THREE.Vector3());tr[s].push([ph%1,p.z+S*ph,p.y]);footLo=Math.min(footLo,p.y);footHi=Math.max(footHi,p.y);}if(i%4===0){const w=box(wing,5);wingHop=Math.max(wingHop,w.max.x-w.min.x);}}
   let skate=0;for(const s in tr){const st=tr[s].filter(q=>q[0]>0.03&&q[0]<0.42),c0=st.filter(q=>q[1]<S*1.0),c1=st.filter(q=>q[1]>=S*1.0);for(const c of [c0,c1])if(c.length>2){const zs=c.map(q=>q[1]);skate=Math.max(skate,(Math.max(...zs)-Math.min(...zs))/Math.max(1e-6,S));}}
   let hopLo=1e9;for(let i=0;i<20;i++){pose('walk',i/20);hopLo=Math.min(hopLo,box(body,9).min.y);}
   r.hop={stride:+S.toFixed(3),skate:+skate.toFixed(3),footLift:+(footHi-footLo).toFixed(3),lowest:+hopLo.toFixed(4),wing:+wingHop.toFixed(3)};
   /* flight: the span, and the beat */
   const span=()=>{const w=box(wing,3);return w.max.x-w.min.x;};
   let tipLo=1e9,tipHi=-1e9,spanMax=0;for(let i=0;i<16;i++){pose('fly',i/16);const t=B('wing3L').getWorldPosition(new THREE.Vector3()),w=box(wing,3);tipLo=Math.min(tipLo,w.max.y);tipHi=Math.max(tipHi,w.max.y);spanMax=Math.max(spanMax,span());}
   pose('glide',0.25);const gspan=span();
   r.fly={spanMax:+spanMax.toFixed(3),beat:+(tipHi-tipLo).toFixed(3),glideSpan:+gspan.toFixed(3)};
   /* the takeoff has its wings out at once, the land clip ends with them folded away; the idle's head turns */
   pose('takeoff',0.12);const toSpan=span();pose('land',0.999);const ldSpan=span();let ldLow=box(body,7).min.y;
   const yaw=nm=>{const f=fwd(nm);return Math.atan2(f.x,f.z);};let neck=0;for(let i=0;i<48;i++){pose('idle',i/48);neck=Math.max(neck,Math.abs(Math.atan2(Math.sin(yaw('head')-yaw('body')),Math.cos(yaw('head')-yaw('body')))));}
   r.ends={takeoffSpan:+toSpan.toFixed(3),landEndSpan:+ldSpan.toFixed(3),landEndLow:+ldLow.toFixed(4),idleNeckDeg:+(neck*180/Math.PI).toFixed(0)};
   /* the wings' material and colours: sampled from the atlas over every triangle (three points in each), split by
      side (bind x) and by the face's own way (its normal up: the upper surface, down: the under) */
   const wm=wing.material,img=wm.map&&wm.map.image;
   r.wingMat={transparent:!!wm.transparent,opacity:wm.opacity,alphaTest:wm.alphaTest,depthWrite:wm.depthWrite,blending:wm.blending,map:!!wm.map,alphaHash:!!wm.alphaHash};
   if(img){const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const cx=cv.getContext('2d');cx.drawImage(img,0,0);const D=cx.getImageData(0,0,cv.width,cv.height).data;
    const g=wing.geometry,P=g.attributes.position,Nn=g.attributes.normal,U=g.attributes.uv,ix=g.index.array,acc={},tris={L:0,R:0};let agree=0,faces=0;const e1=new THREE.Vector3(),e2=new THREE.Vector3(),fn=new THREE.Vector3();
    for(let t=0;t<ix.length;t+=3){const a=ix[t],b=ix[t+1],c=ix[t+2];const side=P.getX(a)>0?'L':'R';tris[side]++;
     e1.set(P.getX(b)-P.getX(a),P.getY(b)-P.getY(a),P.getZ(b)-P.getZ(a));e2.set(P.getX(c)-P.getX(a),P.getY(c)-P.getY(a),P.getZ(c)-P.getZ(a));fn.crossVectors(e1,e2);
     const ny=Nn.getY(a)+Nn.getY(b)+Nn.getY(c);faces++;if(fn.y*ny>0)agree++;
     const key=side+(ny>0?'top':'under');
     for(const [wa,wb,wc] of [[0.6,0.2,0.2],[0.2,0.6,0.2],[0.2,0.2,0.6]]){const u=wa*U.getX(a)+wb*U.getX(b)+wc*U.getX(c),v=wa*U.getY(a)+wb*U.getY(b)+wc*U.getY(c);
      const x=Math.min(cv.width-1,Math.floor(u*cv.width)),y=Math.min(cv.height-1,Math.floor((1-v)*cv.height)),k=4*(y*cv.width+x);if(D[k+3]<128)continue;
      const q=acc[key]||(acc[key]=[0,0,0,0]);q[0]+=D[k]/255;q[1]+=D[k+1]/255;q[2]+=D[k+2]/255;q[3]++;}}
    const mean=k=>acc[k]?acc[k].slice(0,3).map(x=>+(x/acc[k][3]).toFixed(3)):null;
    r.wingCol={Ltop:mean('Ltop'),Rtop:mean('Rtop'),Lunder:mean('Lunder'),Runder:mean('Runder'),tris,normalsAgree:+(agree/faces).toFixed(4)};}
   /* the open and the fold: how long the wing takes to grow from a third of its size to whole, and back */
   const trk=(s,n)=>{const c=a.clips[s];const t=c&&c.tracks.find(x=>x.name==='ab_wingL.scale');return t?{times:Array.from(t.times),v:Array.from(t.values).filter((_,i)=>i%3===0)}:null;};
   /* grow: from the first frame at a third of its size to the first frame whole; shrink: the same backwards, after the widest */
   const grow=(tk,lo,hi)=>{if(!tk)return 0;let t0=null;for(let i=0;i<tk.v.length;i++){if(t0==null&&tk.v[i]>=lo)t0=tk.times[i];if(t0!=null&&tk.v[i]>=hi)return tk.times[i]-t0;}return 0;};
   const shrink=(tk,lo,hi)=>{if(!tk)return 0;let top=0;for(let i=0;i<tk.v.length;i++)if(tk.v[i]>=tk.v[top])top=i;let t0=null;for(let i=top;i<tk.v.length;i++){if(t0==null&&tk.v[i]<=hi)t0=tk.times[i];if(t0!=null&&tk.v[i]<=lo)return tk.times[i]-t0;}return 0;};
   const to=trk('takeoff'),ld=trk('land');let jump=0;for(const tk of [to,ld])if(tk)for(let i=1;i<tk.v.length;i++){const dt=tk.times[i]-tk.times[i-1];jump=Math.max(jump,Math.abs(tk.v[i]-tk.v[i-1])/Math.max(1e-6,dt)/60);}
   r.open={takeoffGrow:+grow(to,0.33,0.97).toFixed(3),landShrink:+shrink(ld,0.33,0.97).toFixed(3),maxStepPerFrame:+jump.toFixed(3)};
   I.dispose();
  }catch(e){r.error=String(e&&e.stack||e);}
  return r;});
 if(lib.error)check('owl: loads and is rigged by the bird rig',false,lib.error);
 else{
  check('owl: loads and gets a skeleton (20 bones, the scan and the wings skinned, weights sum to one on valid bones)',lib.rig.bones===20&&lib.skinned===2&&lib.skinBad===0,{rig:lib.rig,skinned:lib.skinned,bad:lib.skinBad});
  check('owl: the scan\'s body is closed (the stump\'s cut capped: no open edge on the welded surface, so nothing shows through a body drawn front-only)',lib.bodyOpen===0,{openEdges:lib.bodyOpen,triangles:lib.bodyTris});
  check('owl: has the clips the game drives (idle, walk as the hop, takeoff, fly, glide, land)',['idle','walk','takeoff','fly','glide','land'].every(s=>lib.src[s]&&!/@/.test(lib.src[s])),lib.src);
  const want=(E.fit&&E.fit.height)||0.5;check('owl: fitted to its size ('+want+' m)',Math.abs(lib.dims.h-want)<0.02*want+0.005,lib.dims);
  check('owl idle: on its feet on the grass through the whole idle (lowest point within 1.5 cm of the grass, never under it)',lib.idle.lowMin>-0.006&&lib.idle.lowMax<0.015,lib.idle);
  check('owl idle: the grafted wings are folded away inside the body (under the scan\'s own folded wings) and the head faces forward',lib.idle.wingExtent===0&&lib.idle.headFwd>0.8,lib.idle);
  check('owl hop: both feet stay planted through the stance (skating under 15% of the stride), lift in the air and the body never goes under the grass',lib.hop.skate<0.15&&lib.hop.stride>0.03&&lib.hop.footLift>0.01&&lib.hop.lowest>-0.012,lib.hop);
  check('owl takeoff and land: the wings are out a tenth of the way into the takeoff and folded away at the end of the land clip, which stands on the grass; the idle turns the head at most 100 degrees',lib.ends.takeoffSpan>1.5*lib.dims.h&&lib.ends.landEndSpan<0.3&&Math.abs(lib.ends.landEndLow)<0.012&&lib.ends.idleNeckDeg<=100,lib.ends);
  check('owl fly and glide: the wings spread (wingspan over 2.4 times its height) and the fly clip beats them (the wing edge rises and falls over 15 cm)',lib.fly.spanMax>2.4*lib.dims.h&&lib.fly.glideSpan>2.4*lib.dims.h&&lib.fly.beat>0.15,lib.fly);
  const M=lib.wingMat||{},C=lib.wingCol||{},d3=(a,b)=>a&&b?Math.max(...a.map((x,i)=>Math.abs(x-b[i]))):9;
  check('owl wings: opaque (an alpha cutout of the painted feathers, never blended: opacity 1, not transparent, depth written, no alpha hash)',M.map&&!M.transparent&&M.opacity===1&&M.alphaTest>0&&M.depthWrite&&!M.alphaHash&&M.blending===1,M);
  const top=C.Ltop||[0,0,0],und=C.Lunder||[0,0,0];
  check('owl wings: both wings the same feathers in the same colours (upper surfaces within 0.02, under surfaces within 0.02, the same triangles each side)',C.tris&&C.tris.L===C.tris.R&&d3(C.Ltop,C.Rtop)<0.02&&d3(C.Lunder,C.Runder)<0.02,C);
  check('owl wings: golden buff above (red over green over blue, warm) and white below (every channel over 0.8), each surface its own face facing its own way (normals agree with the faces)',top[0]>top[1]&&top[1]>top[2]&&top[0]-top[2]>0.15&&Math.min(...und)>0.8&&C.normalsAgree>0.99,{top:C.Ltop,under:C.Lunder,normalsAgree:C.normalsAgree});
  check('owl wings: open and fold over several frames, grown and dithered in and out (a third to whole over at least 0.05 s each way, never more than 0.25 of its size in a frame)',lib.open.takeoffGrow>=0.05&&lib.open.landShrink>=0.05&&lib.open.maxStepPerFrame<=0.25,lib.open);
 }
 /* ---- 4: in the game ----------------------------------------------------------------------------------------- */
 await page.evaluate(()=>{const G=window.__features,p=G.horse.player;const c=document.getElementById('seChar');if(c&&c.classList.contains('on')&&G.wardrobe)G.wardrobe.closeChar();
  const key=(k,d)=>window.dispatchEvent(new KeyboardEvent(d?'keydown':'keyup',{code:k,key:k,bubbles:true}));
  const reset=(x,z,h)=>{if(p.onFoot&&G.onFoot)try{G.onFoot.mount();}catch(e){}p.pos.set(x,0,z);p.heading=h||0;p.speed=0;p.y=0;p.vy=0;if(p.flying)p.flying=false;window.advanceTime(50);};
  const ride=b=>{G.save.sync(s=>{let h=s.horses.find(x=>x.breed===b);if(!h){h=G.horse.grantHorse(s,b,{name:'QA '+b,bond:60});}s.horses.splice(s.horses.indexOf(h),1);s.horses.unshift(h);});G.horse.reloadHorses();const sel=document.getElementById('horseSel');sel.value='0';sel.onchange();};
  const comp=()=>G.pets.comp(),real=()=>G.petModels.real(comp()),RR=()=>{const c=comp();return c&&c.parts&&c.parts.real;};
  const T=G.THREE,_v=new T.Vector3(),_q=new T.Quaternion();
  const mesh=nm=>{const r=RR();if(!r||!r.inst)return null;let m=null;r.inst.model.traverse(o=>{if(o.isSkinnedMesh&&o.name===nm)m=o;});return m;};
  const bone=nm=>{const r=RR();return r&&r.inst?r.inst.model.getObjectByName('ab_'+nm):null;};
  const wingSpan=()=>{const m=mesh('owl-wings');if(!m)return 0;const b=new T.Box3(),pa=m.geometry.attributes.position;for(let i=0;i<pa.count;i+=9){m.getVertexPosition(i,_v).applyMatrix4(m.matrixWorld);b.expandByPoint(_v);}const s=b.getSize(new T.Vector3());return Math.max(s.x,s.z);};
  const wp=nm=>{const b=bone(nm);if(!b)return null;b.getWorldPosition(_v);return [_v.x,_v.y,_v.z];};
  const yawOf=nm=>{const b=bone(nm);if(!b)return 0;b.getWorldQuaternion(_q);const f=new T.Vector3(0,0,1).applyQuaternion(_q);return Math.atan2(f.x,f.z);};
  const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const info=()=>{const c=comp(),r=real();return {real:r.state,clip:r.clip,err:r.err,drawn:c.parts.bodyPivot.visible,air:c.st.air,alt:+(c.alt||0).toFixed(2),spd:+(c.st.spd||0).toFixed(2),flying:!!p.flying,span:+wingSpan().toFixed(2),d:+Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z).toFixed(2)};};
  /* one frame's measurements, for the in-game checks (feet in the world, clip weights, the hop phase, the head's turn) */
  let simT=0;
  const sample=()=>{const c=comp(),R=RR(),g=c.parts.group.position,W=R&&R.inst?R.inst.weights:{};const w={};for(const k in W)w[k]=+W[k].toFixed(3);
   return {t:+simT.toFixed(3),real:R?R.state:'none',drawn:c.parts.bodyPivot.visible,air:c.st.air,alt:+(c.alt||0),spd:+(c.st.spd||0),skim:+(c.st.skim||0),sk:R?R.sk||null:null,ph:R?R.phase:0,pc:R?R.popC||0:0,w,
    g:[g.x,g.y,g.z],fL:wp('footL'),fR:wp('footR'),span:wingSpan(),neck:wrapA(yawOf('head')-yawOf('body')),d:Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z),flying:!!p.flying};};
  const step=ms=>{window.advanceTime(ms);simT+=ms/1000;};
  const run=(keys,n,ms,tag,every)=>{const S=[];for(const k of keys)key(k,true);for(let i=0;i<n;i++){step(ms);if(!every||i%every===0)S.push(Object.assign(sample(),{tag}));}for(const k of keys)key(k,false);return S;};
  /* a picture from a camera of our own, taken in the same frame it is drawn */
  const snap=(eye,at)=>{const cam=G.camera,o={p:cam.position.clone(),q:cam.quaternion.clone()};if(eye){cam.position.set(eye[0],eye[1],eye[2]);cam.lookAt(at[0],at[1],at[2]);cam.updateMatrixWorld();}G.renderer.render(G.scene,cam);const u=G.renderer.domElement.toDataURL('image/png');cam.position.copy(o.p);cam.quaternion.copy(o.q);return u;};
  window.__OWL={G,p,key,reset,ride,comp,real,info,snap,sample,run,step,RR};});
 const shot=async(name,eyeFn)=>{if(!SHOTS)return;const u=await page.evaluate(([f])=>{const Q=window.__OWL,c=Q.comp(),g=c.parts.group.position,h=c.heading;const e=(new Function('g','h','return ('+f+')(g,h)'))(g,h);return Q.snap(e?e[0]:null,e?e[1]:null);},[eyeFn?eyeFn.toString():'()=>null']);fs.writeFileSync(path.join(SHOTS,name+'.png'),Buffer.from(u.split(',')[1],'base64'));};
 const settle=async()=>{let s=null;for(let i=0;i<120;i++){s=await page.evaluate(()=>{window.advanceTime(100);return window.__OWL.info();});if(s.real==='ready'||s.real==='failed'||s.real==='none')break;await page.waitForTimeout(100);}return s;};
 await page.evaluate(()=>{const Q=window.__OWL;Q.G.hidePanels&&Q.G.hidePanels();if(!Q.G.horse.ridden().wings)Q.ride('pegasus');});
 await page.waitForFunction(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}},null,{timeout:120000,polling:250});
 await page.evaluate(([H])=>{const Q=window.__OWL,G=Q.G;G.save.sync(s=>{s.petList=Array.from(new Set([...(s.petList||[]),'owl']));});Q.reset(H.x,H.z,H.h);if(G.pets.active()!=='owl')G.pets.setActive('owl');else G.pets.rebuild();Q.key('KeyW',true);window.advanceTime(600);Q.key('KeyW',false);},[HOME]);
 const s0=await settle();
 check('owl in game: the real owl loads and replaces the drawn one',s0.real==='ready'&&!s0.drawn,s0);
 const ground=w=>(w.idle||0)+(w.walk||0),lifted=w=>(w.takeoff||0)+(w.fly||0)+(w.glide||0);
 if(s0.real==='ready'){
  /* standing: 14 s of the idle (with the game's look at you on top of the owl's own head turns) */
  /* (settled first: on the grass and wholly in its idle, however long the hop, skim or landing before it takes to end, up to 10 s) */
  const ID=await page.evaluate(([H])=>{const Q=window.__OWL;Q.reset(H.x,H.z,H.h);let n=0;for(;n<300;n++){Q.step(33);const R=Q.RR(),c=Q.comp();if(R&&R.inst&&(R.inst.weights.idle||0)>0.99&&c.st.air==='ground'&&(c.alt||0)<0.01)break;}
   if(n>=300)return {unsettled:Object.assign(Q.sample(),{tag:'settle'})};return {settledIn:+(n*0.033).toFixed(2),S:Q.run([],420,33,'idle',3)};},[HOME]);
  if(!ID.S)check('owl in game: settles into its idle on the grass before the idle is measured (within 10 s)',false,ID.unsettled);
  else{const IS=ID.S,neckMax=Math.max(...IS.map(o=>Math.abs(o.neck)));
   check('owl in game: stands with its idle, the real body, and its head turns stay within a barn owl\'s reach (under 140 degrees either way, idle plus the look at you)',IS.every(o=>o.real==='ready'&&!o.drawn&&o.alt<0.02&&ground(o.w)>0.9)&&neckMax<2.45,{settledIn:ID.settledIn,neckMaxDeg:+(neckMax*180/Math.PI).toFixed(0),altMax:+Math.max(...IS.map(o=>o.alt)).toFixed(3),groundMin:+Math.min(...IS.map(o=>ground(o.w))).toFixed(3)});}
  await shot('owl-stand-close',(g,h)=>[[g.x+Math.sin(h+0.6)*1.0,g.y+0.55,g.z+Math.cos(h+0.6)*1.0],[g.x,g.y+0.22,g.z]]);
  await shot('owl-stand-close-side',(g,h)=>[[g.x+Math.sin(h+1.6)*0.9,g.y+0.35,g.z+Math.cos(h+1.6)*0.9],[g.x,g.y+0.2,g.z]]);
  await shot('owl-stand-riding',null);
  /* the pair glow (the owl beside the pegasus it matches): the owl's own pixels with the glow as the game has it
     against the same frame with the glow off (the rim uniform at zero, the halo hidden), and the halo behind it */
  const GL=await page.evaluate(()=>{const Q=window.__OWL,G=Q.G,T=G.THREE,c=Q.comp(),R=Q.RR();if(!R||!R.inst)return null;
   for(let i=0;i<40&&!(c.combo>0.85);i++)Q.step(100);
   const g=c.parts.group.position,h=c.heading,cam=G.camera,o={p:cam.position.clone(),q:cam.quaternion.clone()};
   const W=320,H=200,cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true});
   const halo=[];c.parts.group.traverse(x=>{if(x.isSprite&&x.material&&x.material.blending===T.AdditiveBlending&&x.visible)halo.push(x);});
   const sp=halo[0];
   const out={combo:+(c.combo||0).toFixed(2),halo:halo.length,pairs:[]};
   for(const a of [0.9,2.6,-1.2]){Q.step(17);cam.position.set(g.x+Math.sin(h+a)*0.95,g.y+0.32,g.z+Math.cos(h+a)*0.95);cam.lookAt(g.x,g.y+0.2,g.z);cam.updateMatrixWorld();
    const grab=()=>{G.renderer.render(G.scene,cam);cx.drawImage(G.renderer.domElement,0,0,W,H);return cx.getImageData(0,0,W,H).data;};
    const on=grab();
    const keep=halo.map(x=>x.visible);G.petModels.glow(0);halo.forEach(x=>x.visible=false);
    const off=grab();R.inst.root.visible=false;const bg=grab();R.inst.root.visible=true;halo.forEach((x,i)=>x.visible=keep[i]);
    /* the owl's pixels: where it differs from the empty frame */
    let n=0,d=[0,0,0],da=0,ringN=0,ring=0;
    for(let i=0;i<on.length;i+=4){const m=Math.abs(off[i]-bg[i])+Math.abs(off[i+1]-bg[i+1])+Math.abs(off[i+2]-bg[i+2]);
     if(m>30){n++;for(let k=0;k<3;k++){d[k]+=(on[i+k]-off[i+k])/255;da+=Math.abs(on[i+k]-off[i+k])/255/3;}}
     else if(m<4){const q=(on[i]+on[i+1]+on[i+2]-off[i]-off[i+1]-off[i+2])/765;if(q>0.01){ringN++;ring+=q;}}}
    out.pairs.push({px:n,shift:d.map(x=>+(x/Math.max(1,n)).toFixed(3)),abs:+(da/Math.max(1,n)).toFixed(3),haloPx:ringN});}
   /* the halo is behind the owl from the camera the game drew with */
   cam.position.copy(o.p);cam.quaternion.copy(o.q);cam.updateMatrixWorld();Q.step(17);G.renderer.render(G.scene,cam);
   if(sp){const pw=sp.getWorldPosition(new T.Vector3()),ow=new T.Vector3(g.x,g.y+0.2,g.z);out.haloBehind=+(pw.distanceTo(cam.position)-ow.distanceTo(cam.position)).toFixed(3);}
   Q.step(17);return out;});
  if(GL){const worst=Math.max(...GL.pairs.map(q=>Math.max(q.abs,Math.abs(q.shift[2]-q.shift[0])))),seen=GL.pairs.filter(q=>q.px>400).length;
   check('owl in game: paired with the pegasus, the glow never tints the owl nor shows through it (its own pixels change under 0.04 with the glow on, no blue shift over 0.03, from three sides) and the halo sits behind it',GL.combo>0.8&&seen===3&&worst<0.04&&GL.pairs.every(q=>q.shift[2]-q.shift[0]<0.03)&&GL.halo>=1&&GL.haloBehind>0.05,GL);}
  else check('owl in game: the pair glow measured',false,null);
  await shot('owl-stand-paired-close',(g,h)=>[[g.x+Math.sin(h+0.9)*0.95,g.y+0.32,g.z+Math.cos(h+0.9)*0.95],[g.x,g.y+0.2,g.z]]);
  /* walking with the horse (Ctrl+W, 2.2 m/s), stopping, and short moves to its spot (nudged off it): it hops only as
     fast as its hop can carry it and flies low above that; measured every frame */
  const WK=await page.evaluate(()=>{const Q=window.__OWL;let S=Q.run(['KeyW','ControlLeft'],240,17,'walk');S=S.concat(Q.run([],240,17,'stop'));
   const c=Q.comp(),p=Q.p;for(let n=0;n<10;n++){const a=n*1.7;c.pos.x+=Math.sin(a)*0.235;c.pos.z+=Math.cos(a)*0.235;S=S.concat(Q.run([],60,17,'nudge'));}
   /* and the horse drifting forward slowly (0.2 to 0.5 m/s, held there by hand), where the owl hops along */
   for(const v of [0.2,0.35,0.5])for(let i=0;i<150;i++){p.speed=v;Q.step(17);S.push(Object.assign(Q.sample(),{tag:'slow'+v}));}
   return S;});
  /* the hop: stance frames (phase 0.03..0.42 of the cycle), on the grass, hop clip in charge */
  let slide=0,travel=0,hz=0,hopFrames=0;
  for(let i=1;i<WK.length;i++){const a=WK[i-1],b=WK[i];const hop=(b.w.walk||0)>0.7&&b.alt<0.03&&b.air==='ground'&&!b.sk;if(!hop)continue;hopFrames++;
   const dph=((b.ph-a.ph)%1+1)%1,dt=b.t-a.t;if(dt>0&&dph<0.5)hz=Math.max(hz,dph/dt);
   const inSt=q=>q.ph>0.03&&q.ph<0.42;if(!inSt(a)||!inSt(b)||b.ph<a.ph)continue;
   const bt=Math.hypot(b.g[0]-a.g[0],b.g[2]-a.g[2]);travel+=bt;for(const f of ['fL','fR'])slide+=Math.hypot(b[f][0]-a[f][0],b[f][2]-a[f][2])/2;}
  const slideK=travel>0.01?slide/travel:0;
  const slowSpd=WK.filter(o=>/^slow/.test(o.tag)&&o.air==='ground').map(o=>o.spd);
  const hopTop=Math.max(0,...WK.filter(o=>(o.w.walk||0)>0.7&&o.alt<0.03&&o.air==='ground'&&!o.sk).map(o=>o.spd));
  check('owl in game: hops beside a walking horse and to its spot without skating (stance feet slide under 15% of the body\'s travel) and at a believable cadence (at most 4.5 hops a second)',hopFrames>=4&&slideK<0.15&&hz<=4.5,{hopFrames,slideK:+slideK.toFixed(3),travel:+travel.toFixed(3),hz:+hz.toFixed(2),hopTopSpeed:+hopTop.toFixed(2),slowOwlSpeed:slowSpd.length?[+Math.min(...slowSpd).toFixed(2),+Math.max(...slowSpd).toFixed(2)]:null,skimFrames:WK.filter(o=>o.sk).length});
  /* lifted by the game (a skim), it is in a flying pose; on the grass, never in one */
  let upT=-1,bad=[],badG=[];for(const o of WK){if(o.sk==='up'&&upT<0)upT=o.t;if(!o.sk)upT=-1;
   if(o.air==='ground'&&o.alt>0.08&&!(upT>=0&&o.t-upT<0.1)&&ground(o.w)>0.2)bad.push({t:o.t,alt:+o.alt.toFixed(2),w:o.w,sk:o.sk});
   if(o.air==='ground'&&o.alt<0.01&&!o.sk&&lifted(o.w)>0.5)badG.push({t:o.t,alt:+o.alt.toFixed(3),w:o.w});}
  check('owl in game: never shows a standing or hopping pose lifted off the grass, nor a flying pose standing on it (skims take off and land with their clips)',bad.length===0&&badG.length===0&&WK.every(o=>o.real==='ready'&&!o.drawn),{lifted:bad.length,grounded:badG.length,first:bad[0]||badG[0]||null});
  await shot('owl-skim-riding',null);
  /* a true hop frame for the pictures */
  const HF=await page.evaluate(()=>{const Q=window.__OWL,p=Q.p;for(let i=0;i<900;i++){p.speed=0.4;Q.step(17);const s=Q.sample();if(i>120&&(s.w.walk||0)>0.9&&!s.sk&&s.ph>0.55&&s.ph<0.75)return s;}return null;});
  if(HF){await shot('owl-hop-close',(g,h)=>[[g.x+Math.sin(h+1.4)*0.95,g.y+0.35,g.z+Math.cos(h+1.4)*0.95],[g.x,g.y+0.16,g.z]]);await shot('owl-hop-riding',null);}
  const SK=await page.evaluate(()=>{const Q=window.__OWL;Q.key('KeyW',true);Q.key('ControlLeft',true);for(let i=0;i<120;i++)Q.step(17);const s=Q.sample();Q.key('KeyW',false);Q.key('ControlLeft',false);return s;});
  if(SK&&SK.sk)await shot('owl-skim-close',(g,h)=>[[g.x+Math.sin(h+1.9)*1.3,g.y+0.5,g.z+Math.cos(h+1.9)*1.3],[g.x,g.y+0.1,g.z]]);
  await page.evaluate(()=>{const Q=window.__OWL;for(let i=0;i<60;i++)Q.step(100);});
  /* the flight: the takeoff, frame by frame, then a cruise, a climb and a turn */
  const TO=await page.evaluate(()=>{const Q=window.__OWL;const S=Q.run([],10,17,'stand');return S.concat(Q.run(['KeyW','Space'],30,17,'takeoff'));});
  const t0=(TO.find(o=>o.air==='takeoff')||{}).t;const toW=TO.filter(o=>o.air==='takeoff'&&o.t-t0>=0.1&&o.t-t0<0.2);
  const toEarly=TO.filter(o=>o.air==='takeoff'&&o.t-t0<0.1&&o.alt-o.pc>0.05);
  check('owl in game: takes off in its takeoff pose at once (takeoff clip weight at least 0.8 a tenth of a second after the horse lifts, no standing pose rising off the grass)',t0!=null&&toW.length>0&&toW.every(o=>(o.w.takeoff||0)>=0.8)&&toEarly.every(o=>ground(o.w)<0.35),{t0,w:toW.map(o=>o.w.takeoff||0),early:toEarly.map(o=>+ground(o.w).toFixed(2))});
  await shot('owl-takeoff-close',(g,h)=>[[g.x+Math.sin(h+1.2)*1.6,g.y+0.7,g.z+Math.cos(h+1.2)*1.6],[g.x,g.y+0.2,g.z]]);
  await shot('owl-takeoff-riding',null);
  const FL=await page.evaluate(()=>{const Q=window.__OWL;const S=[];const add=(k,n,t)=>{for(const o of Q.run(k,n,100,t))S.push(Object.assign(o,Q.info()));};add(['KeyW','Space'],5,'takeoff');add(['KeyW'],25,'cruise');add(['KeyW','Space'],3,'climb');add(['KeyW','KeyA'],20,'turn');add(['KeyW'],15,'cruise2');return S;});
  const air=FL.filter(o=>o.flying&&o.air==='fly');const clips=[...new Set(FL.map(o=>o.clip))];
  check('owl in game: flies with its fly and glide clips beside the horse',clips.includes('fly')&&air.length>10&&air.every(o=>['fly','glide','takeoff'].includes(o.clip)),{clips,air:air.length});
  check('owl in game: its wings are open all through the flight (wingspan over 0.6 m even at the top of the upstroke) and it stays the real body',air.length>0&&air.every(o=>o.span>0.6)&&FL.every(o=>o.real==='ready'&&!o.drawn),{spans:[+Math.min(...air.map(o=>o.span)).toFixed(2),+Math.max(...air.map(o=>o.span)).toFixed(2)]});
  const byTag=t=>+Math.max(0,...air.filter(o=>o.tag===t).map(o=>o.d)).toFixed(2);
  check('owl in game: keeps close to the horse through the cruise, climb and turn (within 8 m)',air.every(o=>o.d<8),{maxD:{cruise:byTag('cruise'),climb:byTag('climb'),turn:byTag('turn'),cruise2:byTag('cruise2')}});
  /* the flying body, looked at from our own cameras round it (the body bone at the middle): nothing shows through it, and
     it is as light as its wings (the body and the wings told apart by drawing them flat red and flat blue) */
  const FB=await page.evaluate(()=>{const Q=window.__OWL,G=Q.G,T=G.THREE,R=Q.RR();if(!R||!R.inst)return null;Q.run(['KeyW'],8,100,'look');
   let body=null,wing=null;R.inst.model.traverse(o=>{if(o.isSkinnedMesh&&o.name==='owl-body')body=o;if(o.isSkinnedMesh&&o.name==='owl-wings')wing=o;});
   const W=640,H=400,cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true}),cam=G.camera,o={p:cam.position.clone(),q:cam.quaternion.clone()};
   const grab=()=>{G.renderer.render(G.scene,cam);cx.drawImage(G.renderer.domElement,0,0,W,H);return cx.getImageData(0,0,W,H).data;};
   const ce=new T.Vector3();R.inst.model.getObjectByName('ab_body').getWorldPosition(ce);const h=Q.comp().heading||0;
   const look=(yaw,el,d)=>{const a=h+yaw;cam.position.set(ce.x+Math.sin(a)*Math.cos(el)*d,ce.y+Math.sin(el)*d,ce.z+Math.cos(a)*Math.cos(el)*d);cam.lookAt(ce);cam.updateMatrixWorld();};
   const flat={toneMapped:false,fog:false},red=new T.MeshBasicMaterial({color:0xff0000,side:T.FrontSide,...flat}),red2=new T.MeshBasicMaterial({color:0xff0000,side:T.DoubleSide,...flat}),blue=new T.MeshBasicMaterial({side:T.FrontSide,alphaTest:0.5,map:wing.material.map,...flat});
   blue.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.rgb=vec3(0.0,0.0,1.0);');};   // (the wing's own cutout, flat blue)
   const mb=body.material,mw=wing.material,isR=(D,i)=>D[i]>200&&D[i+1]<40&&D[i+2]<40,isB=(D,i)=>D[i+2]>200&&D[i]<40&&D[i+1]<40,lum=(D,i)=>(0.299*D[i]+0.587*D[i+1]+0.114*D[i+2])/255;
   const out={see:[],light:{}};
   try{
    for(const v of [[3.14,0.1],[3.14,-0.3],[2.6,-0.2],[2.0,-0.5]]){look(v[0],v[1],1.2);body.material=red;const A=grab();body.material=red2;const B=grab();body.material=mb;let a=0,b=0;for(let i=0;i<A.length;i+=4){if(isR(A,i))a++;if(isR(B,i))b++;}
     out.see.push({view:v,front:a,double:b,share:+((b-a)/Math.max(1,b)).toFixed(4)});}
    /* (over a whole wingbeat: six moments a sixth of a beat apart, the wings catching the light differently at each) */
    const acc={above:[0,0,0,0],below:[0,0,0,0]};
    for(let k=0;k<6;k++){if(k){Q.key('KeyW',true);Q.step(52);R.inst.model.getObjectByName('ab_body').getWorldPosition(ce);}
     for(const [nm,v] of [['above',[2.8,0.9]],['below',[2.6,-0.6]]]){look(v[0],v[1],1.1);const C=grab();body.material=red;wing.material=blue;const M=grab();body.material=mb;wing.material=mw;
      const a=acc[nm];for(let i=0;i<C.length;i+=4){if(isR(M,i)){a[0]+=lum(C,i);a[1]++;}else if(isB(M,i)){a[2]+=lum(C,i);a[3]++;}}}}
    for(const nm in acc){const a=acc[nm],b=a[0]/Math.max(1,a[1]),w=a[2]/Math.max(1,a[3]);out.light[nm]={body:+b.toFixed(3),wings:+w.toFixed(3),bodyPx:Math.round(a[1]/6),wingPx:Math.round(a[3]/6),ratio:+(b/Math.max(1e-3,w)).toFixed(3)};}
   }finally{Q.key('KeyW',false);body.material=mb;wing.material=mw;cam.position.copy(o.p);cam.quaternion.copy(o.q);cam.updateMatrixWorld();}
   out.air=Q.comp().st.air;out.clip=R.clip;return out;});
  if(FB){check('owl in game: flying, nothing shows through its body (drawn double-sided it covers under 0.2% more pixels than drawn front-only, from behind and below, 1.2 m)',FB.air==='fly'&&FB.see.every(q=>q.double>500&&q.share<0.002),{air:FB.air,see:FB.see.map(q=>[q.front,q.double,q.share])});
   check('owl in game: flying, the body reads with its wings, not dark between them (over a wingbeat, its back at least 75% as bright as the wing tops from above and behind, its underparts at least 75% as bright as the underwings from below)',FB.light.above&&FB.light.below&&FB.light.above.bodyPx>400&&FB.light.below.bodyPx>400&&FB.light.above.ratio>=0.75&&FB.light.below.ratio>=0.75,FB.light);}
  else check('owl in game: the flying body measured',false,null);
  await shot('owl-fly-riding',null);
  /* (for the pictures: a banked turn beside the horse) */
  if(SHOTS){await page.evaluate(()=>{const Q=window.__OWL;Q.run(['KeyW','KeyD'],14,100,'bank');Q.key('KeyW',true);Q.key('KeyD',true);Q.step(17);});
   await shot('owl-bank-riding',null);await shot('owl-bank-close',(g,h)=>[[g.x+Math.sin(h+3.0)*1.5,g.y+0.35,g.z+Math.cos(h+3.0)*1.5],[g.x,g.y,g.z]]);
   await page.evaluate(()=>{const Q=window.__OWL;Q.key('KeyW',false);Q.key('KeyD',false);Q.run(['KeyW'],10,100,'cruise3');});}
  await shot('owl-fly-close',(g,h)=>[[g.x+Math.sin(h+2.3)*1.6,g.y+0.9,g.z+Math.cos(h+2.3)*1.6],[g.x,g.y,g.z]]);
  await page.evaluate(()=>{window.__OWL.step(150);});
  await shot('owl-fly-close2',(g,h)=>[[g.x+Math.sin(h-1.9)*1.5,g.y+0.3,g.z+Math.cos(h-1.9)*1.5],[g.x,g.y,g.z]]);
  /* the landing, frame by frame */
  let flareShot=false;
  const LD=await page.evaluate(()=>{const Q=window.__OWL,S=[];const fb=document.getElementById('flyBtn');if(fb&&Q.p.flying)fb.click();
   for(let i=0;i<400;i++){Q.step(17);const s=Q.sample();S.push(s);if(!Q.p.flying&&S.filter(o=>o.air==='ground').length>150)break;}return S;});
  const td=LD.findIndex(o=>o.air==='ground'),tdT=td>=0?LD[td].t:null,after=td>=0?LD.filter(o=>o.t-tdT>=0.15&&o.t-tdT<1.5&&!o.sk&&o.alt<0.02):[],bounce=td>=0?LD.filter(o=>o.t-tdT>0&&o.t-tdT<1&&(o.w.takeoff||0)>0.5).length:0;   // settled on the grass (not carried on by the last of its speed)
  if(SHOTS)fs.writeFileSync(path.join(SHOTS,'frames.json'),JSON.stringify({walk:WK,takeoff:TO,land:LD}));
  const last=LD[LD.length-1],landSeen=LD.some(o=>(o.w.land||0)>0.5);
  /* it stands: half a second on end (30 frames) within 3 s of touching down, on the grass, beside the horse, in its idle (a
     standing pet may later skim off to a new spot of its own accord: that is the game's, not the landing's) */
  const okStand=o=>o.air==='ground'&&!o.sk&&o.alt<0.03&&o.d<6&&ground(o.w)>0.9;let run=0,stood=null;
  if(td>=0)for(const o of LD){if(o.t<tdT||o.t-tdT>3)continue;run=okStand(o)?run+1:0;if(run>=30&&stood==null)stood=+(o.t-tdT).toFixed(2);}
  check('owl in game: lands beside the horse with its land clip, the wings folded once it is down on the grass (span under 0.3 m), no bounce into a new takeoff, and stands with its idle',landSeen&&td>=0&&after.length>0&&after.every(o=>o.span<0.3)&&bounce===0&&stood!=null&&LD.every(o=>o.real==='ready'&&!o.drawn),{touchdownAt:tdT,bounce,settledAfter:after.length?+(after[0].t-tdT).toFixed(2):null,spanAfter:after.length?+Math.max(...after.map(o=>o.span)).toFixed(2):null,stoodBy:stood,last:{alt:+last.alt.toFixed(3),d:+last.d.toFixed(2),w:last.w,sk:last.sk}});
  await shot('owl-landed-riding',null);
  await shot('owl-landed-close',(g,h)=>[[g.x+Math.sin(h-0.6)*1.0,g.y+0.55,g.z+Math.cos(h-0.6)*1.0],[g.x,g.y+0.22,g.z]]);
  /* the landing flare, for the pictures: up again, then down, stopped while it is still low in the air */
  if(SHOTS){await page.evaluate(()=>{const Q=window.__OWL;Q.run(['KeyW','Space'],12,100,'up');Q.run(['KeyW'],30,100,'cruise');const fb=document.getElementById('flyBtn');if(fb&&Q.p.flying)fb.click();for(let i=0;i<300;i++){Q.step(17);const s=Q.sample();if(s.air==='landing'&&s.alt<0.5&&(s.w.land||0)>0.8)break;}});
   await shot('owl-land-flare-close',(g,h)=>[[g.x+Math.sin(h+1.5)*1.4,g.y+0.4,g.z+Math.cos(h+1.5)*1.4],[g.x,g.y+0.1,g.z]]);}
 }
 check('no page errors, and no console errors or warnings from the pet models (the owl, the bird rig, the autorig)',errors.length===0,errors.slice(0,8));
 const fails=checks.filter(c=>!c.ok);
 console.log('\n'+(checks.length-fails.length)+'/'+checks.length+' checks passed in '+((Date.now()-t0)/1000).toFixed(0)+' s');
 await browser.close();process.exit(fails.length?1:0);
})().catch(async e=>{console.error(e.stack||e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
