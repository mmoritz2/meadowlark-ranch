// Shared fantasy horse artwork, extracted from the ranch renderer.
const FANTASY_CFG={
 fire:  {ramp:['#2a0c04','#d23a10','#ffd24a'], glow:0.85, rough:0.82},
 galaxy:{ramp:['#0a0818','#3a2a72','#caa8ff'], glow:0.8,  rough:0.78},
 shadow:{ramp:['#060409','#170f2a','#5a3aa0'], glow:0.55, rough:0.84},   // darker -> reads "shadow", not bright purple
 ice:   {ramp:['#2a6f92','#9fdcf2','#f2ffff'], glow:0.6,  rough:0.62},
 aurora:{ramp:['#0c2230','#1f9e78','#a8ffe0'], glow:0.7,  rough:0.70},
 /* An actual eclipse: the body goes almost black and all the light is in the corona that
    burns around the silhouette. Shadow is violet all over; this is only lit at its edge. */
 eclipse:{ramp:['#040308','#0f0b16','#c98a2a'], glow:0.75, rough:0.80},
};
const FANTASY_FX={
 fire:`float em=_hash(floor(vMapUv*vec2(44.0,30.0))+floor(uTime*4.0)*7.0);
   em=smoothstep(0.78,1.0,em)*smoothstep(0.35,1.0,_l);
   _ramp+=vec3(1.0,0.45,0.08)*em*0.8;
   _emis=_ramp*uGlow*(0.2+1.3*_l)+vec3(1.0,0.4,0.08)*em*1.6+vec3(0.9,0.25,0.05)*_fres*0.5;`,
 galaxy:`float st=step(0.991,_hash(floor(vMapUv*170.0)))*(0.5+0.5*sin(uTime*3.0+vMapUv.x*60.0));
   float neb=_hash(floor(vMapUv*7.0)+1.7);
   _ramp=mix(_ramp,_ramp*vec3(1.4,0.6,1.5),neb*0.45);
   _ramp+=vec3(1.0)*st*1.6;
   _emis=_ramp*uGlow*(0.28+0.7*_l)+vec3(1.0)*st*2.2+vec3(0.5,0.3,0.9)*_fres*0.4;`,
 ice:`float gl=step(0.99,_hash(floor(vMapUv*150.0)))*(0.5+0.5*sin(uTime*4.0+_l*30.0));
   _ramp+=vec3(0.7,0.9,1.0)*gl*0.9;
   _ramp=mix(_ramp,vec3(0.96,0.99,1.0),_fres*0.55);
   _emis=_ramp*uGlow*(0.16+0.7*_l)+vec3(0.8,0.95,1.0)*_fres*0.5+vec3(0.9,0.97,1.0)*gl;`,
 aurora:`float band=sin(vMapUv.y*12.0+uTime*1.6+vMapUv.x*4.0)*0.5+0.5;
   vec3 irid=mix(vec3(0.15,1.0,0.55),vec3(0.45,0.4,1.0),_fres);
   irid=mix(irid,vec3(1.0,0.45,0.9),band*0.45);
   _ramp=mix(_ramp,irid,0.45+0.25*_fres);
   _emis=_ramp*uGlow*(0.22+0.85*_l)+irid*_fres*0.6;`,
 shadow:`_ramp=mix(_ramp,vec3(0.02,0.01,0.05),0.35);
   _ramp+=vec3(0.5,0.3,0.95)*_fres*0.8;
   _emis=_ramp*uGlow*(0.1+0.6*_l)+vec3(0.5,0.3,0.95)*_fres*0.9;`,
 /* A much tighter rim than _fres gives, so the corona sits on the outline itself and the
    rest of the horse stays dark, with a slow flare crawling around it. */
 eclipse:`float _cor=pow(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),4.5);
   float _fl=0.62+0.38*sin(uTime*1.9+vMapUv.y*16.0+vMapUv.x*5.0);
   _ramp=mix(_ramp*0.30,vec3(1.0,0.72,0.30),clamp(_cor*_fl*1.15,0.0,1.0));
   _ramp+=vec3(1.0,0.86,0.55)*pow(_cor,2.2)*0.6;
   _emis=_ramp*uGlow*(0.06+0.35*_l)+vec3(1.0,0.66,0.24)*_cor*_fl*2.1;`,
};
export function createEquineFantasyCoat(THREE, baseMat, type, scaly=false){
 const cfg=FANTASY_CFG[type]||FANTASY_CFG.galaxy;
 const fx=FANTASY_FX[type]||FANTASY_FX.galaxy;
 const m=baseMat.clone(); m.color.set(0xffffff); m.roughness=cfg.rough; m.metalness=0;
 const C0=new THREE.Color(cfg.ramp[0]),C1=new THREE.Color(cfg.ramp[1]),C2=new THREE.Color(cfg.ramp[2]);
 const time={value:0};
 m.name='EquineFantasy_'+type+(scaly?'_scales':'');
 m.userData.update=t=>{time.value=t;};
 m.customProgramCacheKey=()=>m.name;
 m.onBeforeCompile=sh=>{
  sh.uniforms.uC0={value:C0};sh.uniforms.uC1={value:C1};sh.uniforms.uC2={value:C2};
  sh.uniforms.uGlow={value:cfg.glow};sh.uniforms.uTime=time;
  sh.fragmentShader='uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform float uGlow;uniform float uTime;\n'+
   'float _hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n'+
   sh.fragmentShader
   .replace('#include <map_fragment>',
    `#include <map_fragment>
     float _l=clamp(dot(diffuseColor.rgb,vec3(0.299,0.587,0.114))*1.15,0.0,1.0);
     vec3 _ramp = _l<0.5 ? mix(uC0,uC1,_l*2.0) : mix(uC1,uC2,(_l-0.5)*2.0);
     float _fres = pow(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.5);
     vec3 _emis = _ramp*uGlow*(0.14+_l);
     ${fx}
     diffuseColor.rgb=_ramp;
     ${scaly?`
     /* Overlapping plates, rows offset by half a scale, dark in the seams and catching a
        highlight along the top edge of each one. This is most of what separates a dragon
        from a horse painted an odd colour. */
     {vec2 _s=vMapUv*vec2(52.0,34.0); float _row=floor(_s.y); _s.x+=mod(_row,2.0)*0.5;
      vec2 _f=fract(_s)-0.5; float _d=length(vec2(_f.x,_f.y*1.28));
      float _seam=smoothstep(0.30,0.47,_d);
      float _lip=1.0-smoothstep(0.0,0.30,length(vec2(_f.x,(_f.y+0.20)*1.5)));
      diffuseColor.rgb*=mix(1.16,0.52,_seam);
      diffuseColor.rgb+=_lip*0.16*(0.4+_l);
      _emis*=mix(1.1,0.55,_seam);}`:''}`)
   .replace('#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     totalEmissiveRadiance=_emis;`);
 };
 m.needsUpdate=true; return m;
}

export function createEquineWingLibrary(THREE, {camera, sun}) {
 let seed=19088743;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const featherTex=(()=>{
 const cv=document.createElement('canvas'); cv.width=128; cv.height=256; const c=cv.getContext('2d');
 const hw=t=>60*(0.24+0.78*Math.sin(Math.PI*Math.pow(t,0.55)));   // narrow quill, full belly, fine tip
 const X=(t,sd)=>64+sd*hw(t), Y=t=>254-t*252;
 c.clearRect(0,0,128,256);
 c.beginPath(); c.moveTo(X(0,-1),Y(0));
 for(let i=1;i<=48;i++){const t=i/48; c.lineTo(X(t,-1),Y(t));}
 for(let i=48;i>=0;i--){const t=i/48; c.lineTo(X(t,1),Y(t));}
 c.closePath();
 const g=c.createLinearGradient(0,254,0,2);
 g.addColorStop(0,'#cbd6e6'); g.addColorStop(0.4,'#eef4fc'); g.addColorStop(1,'#ffffff');
 c.fillStyle=g; c.fill();
 c.lineWidth=1; c.lineCap='round';                                 // barbs, leaving the shaft toward the tip
 for(let i=0;i<170;i++){
  const t=0.02+random()*0.95, w=hw(t), sd=random()<0.5?-1:1;
  c.strokeStyle=random()<0.42?'rgba(146,161,184,0.45)':'rgba(255,255,255,0.7)';
  c.beginPath(); c.moveTo(64+sd*w*0.05,Y(t));
  c.lineTo(64+sd*w*(0.7+random()*0.34),Y(Math.min(1,t+0.05+random()*0.05))); c.stroke();
 }
 c.strokeStyle='rgba(255,255,255,0.92)'; c.lineWidth=3.0;          // the shaft
 c.beginPath(); c.moveTo(64,Y(0)); c.lineTo(64,Y(0.96)); c.stroke();
 c.strokeStyle='rgba(118,132,156,0.30)'; c.lineWidth=1.1;
 c.beginPath(); c.moveTo(65.4,Y(0)); c.lineTo(64.9,Y(0.94)); c.stroke();
 c.globalCompositeOperation='destination-out'; c.lineWidth=2.4; c.strokeStyle='#000';
 for(let i=0;i<6;i++){                                             // the splits a real vane opens
  const t=0.5+random()*0.45, sd=random()<0.5?-1:1, w=hw(t);
  c.beginPath(); c.moveTo(64+sd*w*0.42,Y(t)); c.lineTo(64+sd*w*1.04,Y(Math.min(1,t+0.04))); c.stroke();
 }
 c.globalCompositeOperation='source-over';
 const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=8; return tx;
})();
/* One feather: a card that runs 0->1 along +X, cambered along its length and cupped across
   it, so it catches the light from every angle instead of reading as a flat blade. */
const FEATHER_GEO=(()=>{
 const SEG=5, pos=[],uvs=[],idx=[];
 const hw=t=>0.5*(0.24+0.78*Math.sin(Math.PI*Math.pow(t,0.55)));
 for(let i=0;i<=SEG;i++){
  const t=i/SEG, w=hw(t), droop=-0.15*t*t, cup=0.22*w;
  pos.push(t,droop,-w,  t,droop+cup,0,  t,droop,w);
  uvs.push(0,t, 0.5,t, 1,t);
 }
 for(let i=0;i<SEG;i++){const q=i*3,r=q+3;
  idx.push(q,r,q+1, q+1,r,r+1, q+1,r+1,q+2, q+2,r+1,r+2);}
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 g.setIndex(idx); g.computeVertexNormals();
 return g;
})();
const WING={S:{arm:0.50,fore:0.55,hand:0.38},rows:[],nF:0,nC:0};
(()=>{
 const D=Math.PI/180;
 // name, segment, count, t along the segment, sweep back from its axis (deg), length, width,
 // lift off the wing plane, shift forward, how much the feather trails the beat, material
 const RAW=[
  ['prim','hand',13, 0.02,1.00,  78,30, 0.70,1.12, 0.235, 0.000, 0.000, 1.00, 0],
  ['sec' ,'fore',13, 0.04,1.00,  88,80, 0.92,0.70, 0.225, 0.010,-0.012, 0.62, 0],
  ['tert','arm' , 6, 0.16,1.00,  98,90, 0.44,0.80, 0.210, 0.018,-0.024, 0.40, 0],
  ['gcov','fore',13, 0.02,0.97,  84,76, 0.50,0.38, 0.180, 0.052, 0.024, 0.30, 1],
  ['mcov','fore',12, 0.02,0.93,  78,70, 0.34,0.26, 0.155, 0.095, 0.048, 0.18, 1],
  ['lcov','fore',10, 0.04,0.88,  72,62, 0.23,0.17, 0.128, 0.130, 0.070, 0.10, 1],
  ['scov','arm' ,10, 0.02,0.96, 104,92, 0.42,0.28, 0.190, 0.046, 0.000, 0.16, 1],
  ['alu' ,'hand', 4, 0.00,0.13,  34,20, 0.26,0.19, 0.145, 0.072, 0.034, 0.28, 1],
 ];
 let k=0;
 for(const R of RAW){
  const [name,seg,cnt,t0,t1,s0,s1,l0,l1,wid,lift,fwd,flex,mat]=R;
  for(let i=0;i<cnt;i++){
   const u=cnt===1?0:i/(cnt-1);
   const jit=((k*2654435761)%997)/997-0.5;                    // a little scatter, the same every load
   WING.rows.push({seg,t:t0+(t1-t0)*u,sweep:(s0+(s1-s0)*u)*D,len:l0+(l1-l0)*u,
    wid,lift,fwd,flex,mat,jit,
    slot:name==='prim'?Math.max(0,(u-0.35)/0.65):0,      // the outer primaries are the ones that open
    shade:name==='prim'||name==='sec'||name==='tert'?1:0.80-0.10*(name==='mcov')-0.16*(name==='lcov')});
   if(mat)WING.nC++; else WING.nF++;
   k++;
  }
 }
})();
const _wA=new THREE.Matrix4(),_wB=new THREE.Matrix4(),_wC=new THREE.Matrix4(),
      _wT=new THREE.Matrix4(),_wM=new THREE.Matrix4();
/* A feather held up to the sun lights up: the sun behind the wing shines through the vane,
   which is most of what makes real feathers look like feathers rather than white card. The
   term is a straight back-light — how much the surface faces away from the sun — fed the
   sun's direction in view space, which poseWings refreshes each frame. */
function featherGlow(m,strength){
 const u={uSunV:{value:new THREE.Vector3(0,0,1)},uGlow:{value:strength}};
 m.userData.u=u; m.userData.glowBase=strength;   // scaled by how strong the sun actually is
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);
  sh.fragmentShader='uniform vec3 uSunV;uniform float uGlow;\n'+sh.fragmentShader.replace(
   '#include <opaque_fragment>',
   `{ float bl=clamp(-dot(normalize(vNormal),uSunV),0.0,1.0);
      outgoingLight+=diffuseColor.rgb*pow(bl,2.2)*uGlow; }
    #include <opaque_fragment>`);
 };
 m.customProgramCacheKey=()=>'featherGlow'+strength;
}

const _sunW=new THREE.Vector3(),_sunV=new THREE.Vector3();
/* Pose one horse's pair of wings. open: 0 folded along the barrel, 1 spread. beat: the
   phase of the wingbeat, 0..1. Both wings of a pair share one set of instance matrices —
   the pivots are mirrored, so a wing does the same thing in its own frame. */
function poseWings(pair,open,beat,t){
 if(!pair||!pair.length||!(pair[0].userData.inst||pair[0].userData.mem))return;
 const S=WING.S, o=Math.max(0,Math.min(1,open)), L=(a,b)=>a+(b-a)*o;
 const ph=(beat||0)*Math.PI*2;
 const f=Math.sin(ph+0.42*Math.sin(ph));      // +1 at the top of the beat, -1 at the bottom
 const fv=Math.cos(ph+0.42*Math.sin(ph));     // how fast it is moving, for the feathers' trail
 const A=o*o;                                 // only an opened wing beats
 /* Both ends of `open` were solved for rather than guessed, against what the feathers
    themselves end up doing: at rest every feather has to trail backward along the flank and
    miss the rider's leg, and the tips have to land near the croup; open, the wing reaches
    2.15 m from the withers with nothing dipping below the barrel. Everything between is the
    two interpolated, which stays smooth because no joint travels the long way round. */
 const up=Math.max(0,f)*A;                    // the recovery stroke half-folds the wing again
 /* A dragon stows its wings differently from a bird. The membrane hangs in the wing's own
    plane, so a shut wing has to be rolled a full quarter turn — anything less and the sheet
    stays half flat, which from the camera you actually ride behind reads as two paddles
    sticking out sideways. Rolled upright it presents its edge, and swept well back it lies
    down the ribs where it belongs. */
 const DR=pair[0].userData.kind==='dragon';
 const sx=L(DR?-1.52:-0.050,-0.375)-f*0.13*A;  // roll: a shut dragon wing stands on edge
 /* The tip traces an ellipse, not a line: the wing sweeps forward as it comes down and
    back as it lifts, a quarter of a cycle out of step with the flap. */
 const sy=L(DR?1.34:0.950,-0.350)+fv*0.22*A;   // shoulder sweep: back at rest, a shade forward when open
 const sz=L(DR?-0.26:-0.180, 0.420)+f*0.66*A;  // the beat itself, swung wide enough to read at a distance
 const ey=L(-0.550, 0.400)-up*0.46, ez=-0.277;
 const wy=L( 0.950, 0.465)+up*0.40, wz= 0.300;
 const trail=-fv*0.62*A;
 /* A folded wing is a much smaller shape than an open one, so it closes down as well as in;
    the feathers keep their own angles throughout, which is what stops the secondaries from
    swinging forward over the shoulder as the wing shuts. */
 const k=L(DR?0.92:0.72,1.0)-up*0.05;
 for(const pv of pair)pv.scale.set(pv.userData.sgn*k,k,k);
 _wA.makeRotationY(sy); _wT.makeRotationZ(sz); _wA.multiply(_wT); _wT.makeRotationX(sx); _wA.multiply(_wT);
 _wB.copy(_wA); _wT.makeTranslation(S.arm,0,0); _wB.multiply(_wT);
 _wT.makeRotationY(ey); _wB.multiply(_wT); _wT.makeRotationZ(ez); _wB.multiply(_wT);
 _wC.copy(_wB); _wT.makeTranslation(S.fore,0,0); _wC.multiply(_wT);
 _wT.makeRotationY(wy); _wC.multiply(_wT); _wT.makeRotationZ(wz); _wC.multiply(_wT);
 const segM={arm:_wA,fore:_wB,hand:_wC}, segL={arm:S.arm,fore:S.fore,hand:S.hand};
 {const mt=pair[0].userData.mats;                 // the sun, in the space the shader works in
  _sunW.copy(sun.position).normalize(); _sunV.copy(_sunW).transformDirection(camera.matrixWorldInverse);
  const lit=Math.max(0,Math.min(1,(sun.intensity-0.6)/4.0));   // nothing shines through a wing at midnight
  for(const m of mt) if(m.userData.u){ m.userData.u.uSunV.value.copy(_sunV); m.userData.u.uGlow.value=m.userData.glowBase*lit; }}
 if(pair[0].userData.kind==='dragon'){ dragonWingGeo(pair,_wA,_wB,_wC,f,up,t,o); return; }
 const inst=pair[0].userData.inst, aF=inst[0], aC=inst[1];
 let iF=0,iC=0;
 for(const r of WING.rows){
  _wM.copy(segM[r.seg]);
  _wT.makeTranslation(r.t*segL[r.seg], r.lift*(0.35+0.65*o), r.fwd*o);
  _wM.multiply(_wT);
  _wT.makeRotationY(r.sweep); _wM.multiply(_wT);
  const flut=Math.sin(t*19.0+r.jit*41.0)*0.028*Math.abs(fv)*A*r.flex;   // the tips shiver in the fast part of the beat
  _wT.makeRotationZ(-0.05+trail*r.flex+r.jit*0.06+flut); _wM.multiply(_wT);
  if(r.slot){ _wT.makeRotationX(up*r.slot*0.95); _wM.multiply(_wT); }    // the primaries open like fingers on the way up
  _wT.makeScale(r.len*(0.94+r.jit*0.10), r.len, r.wid);
  _wM.multiply(_wT);
  if(r.mat){_wM.toArray(aC.array,(iC++)*16);} else {_wM.toArray(aF.array,(iF++)*16);}
 }
 aF.needsUpdate=true; aC.needsUpdate=true;
}
/* ===== Dragon wing =====
   The same three folding segments as the pegasus, but skin instead of feathers: four long
   fingers fan from the wrist, a membrane is stretched between them and back to an anchor at
   the flank, and the whole sheet is rebuilt from the joints every frame — which is why it
   sags between the fingers at rest and billows on the downstroke. Two draw calls a wing: the
   membrane and the bones. */
const dragonWebTex=(()=>{
 const cv=document.createElement('canvas'); cv.width=256; cv.height=256; const c=cv.getContext('2d');
 c.fillStyle='#ffffff'; c.fillRect(0,0,256,256);
 const vein=(x0,y0,a,len,w,d)=>{                       // branching veins, thinning as they go
  if(w<0.35||d>4)return;
  const x1=x0+Math.cos(a)*len, y1=y0+Math.sin(a)*len;
  c.strokeStyle='rgba(120,110,130,'+(0.10+w*0.07)+')'; c.lineWidth=w; c.lineCap='round';
  c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke();
  vein(x1,y1,a+0.42+random()*0.3,len*0.72,w*0.62,d+1);
  vein(x1,y1,a-0.38-random()*0.3,len*0.68,w*0.58,d+1);
 };
 for(let i=0;i<7;i++)vein(6,20+i*36,0.05+random()*0.25,60+random()*30,3.4,0);
 const g=c.createLinearGradient(0,0,256,0);            // thinner, paler skin toward the trailing edge
 g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,0.55)');
 c.fillStyle=g; c.fillRect(0,0,256,256);
 const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=8; return tx;
})();
const DWING={
 fing:[[0.11,1.86],[0.42,1.76],[0.79,1.50],[1.18,1.16]],   // [sweep from the hand's axis, length]
 anchor:new THREE.Vector3(0.05,-0.16,-0.86),               // where the trailing edge meets the flank
 U:6, W:4,                                                 // samples along a finger, across a panel
};
function buildDragonWings(){
 const F=DWING.fing.length;
 const nQuad=(F-1+1)*DWING.W*DWING.U;                       // panels between fingers + finger->anchor
 const memN=((F-1+1)*(DWING.W+1)*(DWING.U+1))+((3+1)*(DWING.W+1));   // + the inner arm sheet
 const mem=new THREE.BufferGeometry();
 mem.setAttribute('position',new THREE.BufferAttribute(new Float32Array(memN*3),3));
 mem.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(memN*3),3));
 mem.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(memN*2),2));
 mem.setAttribute('color',new THREE.BufferAttribute(new Float32Array(memN*3),3));
 const idx=[]; let base=0;
 for(let pnl=0;pnl<F;pnl++){                                // membrane panels, wrist-rooted fans
  for(let w=0;w<DWING.W;w++)for(let t=0;t<DWING.U;t++){
   const a=base+w*(DWING.U+1)+t, b=a+DWING.U+1;
   idx.push(a,b,a+1, a+1,b,b+1);
  }
  base+=(DWING.W+1)*(DWING.U+1);
 }
 for(let j=0;j<3;j++)for(let w=0;w<DWING.W;w++){            // the inner sheet, shoulder to the anchor
  const a=base+j*(DWING.W+1)+w, b=a+DWING.W+1;
  idx.push(a,b,a+1, a+1,b,b+1);
 }
 mem.setIndex(idx);
 const bones=new THREE.BufferGeometry();                    // the finger bones and the arm, as ribbons
 const bN=(F+2)*(DWING.U+1)*2;
 bones.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bN*3),3));
 bones.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(bN*3),3));
 const bidx=[];
 for(let f=0;f<F+2;f++){ const o=f*(DWING.U+1)*2;
  for(let t=0;t<DWING.U;t++){ const a=o+t*2; bidx.push(a,a+1,a+2, a+1,a+3,a+2); } }
 bones.setIndex(bidx);
 const mMem=new THREE.MeshStandardMaterial({map:dragonWebTex,side:THREE.DoubleSide,roughness:0.54,
  metalness:0.05,color:0xffffff,vertexColors:true,emissive:0x000000});
 const mBone=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:0.62,metalness:0.15,
  color:0x2c3444,emissive:0x000000});
 mMem.envMapIntensity=0.9; featherGlow(mMem,1.35);          // a membrane is thin: the sun blazes through it
 featherGlow(mBone,0.18);
 /* Both wings of a pair SHARE these two geometries, the way the pegasus's two wings share
    one set of instance matrices: the pivot's negative x-scale mirrors the right into the
    left, so one rebuild a frame dresses both. Cloning them per wing left the second wing
    with the empty buffers it was born with — a dragon with one wing. */
 const mk=sgn=>{
  const piv=new THREE.Group(); piv.scale.set(sgn*0.72,0.72,0.72);
  const mm=new THREE.Mesh(mem,mMem), bm=new THREE.Mesh(bones,mBone);
  mm.frustumCulled=false; bm.frustumCulled=false; mm.castShadow=true; bm.castShadow=true;
  piv.add(mm,bm);
  piv.userData={sgn,kind:'dragon',mats:[mMem,mBone],mem,bone:bones,open:0.05,beat:0,
   wroot:new THREE.Color('#2b3546'),wweb:new THREE.Color('#9fb4d8')};
  return piv;
 };
 const pair=[mk(-1),mk(1)];
 poseWings(pair,0.05,0,0);
 return pair;
}
const _dv=new THREE.Vector3(),_dw=new THREE.Vector3(),_dn=new THREE.Vector3(),
      _delb=new THREE.Vector3(),_dwri=new THREE.Vector3(),_danc=new THREE.Vector3(),
      _dp=new THREE.Vector3(),_dq=new THREE.Vector3(),_dr=new THREE.Vector3(),_ds=new THREE.Vector3(),
      _dtip=[0,1,2,3].map(()=>new THREE.Vector3()),_ddir=[0,1,2,3].map(()=>new THREE.Vector3()),
      _dlead=[0,1,2].map(()=>new THREE.Vector3()),_dY=new THREE.Vector3(0,1,0);
function dragonWingGeo(pair,mA,mB,mC,f,up,t,open){
 const F=DWING.fing.length, U=DWING.U, W=DWING.W;
 _delb.set(WING.S.arm,0,0).applyMatrix4(mA);
 _dwri.set(WING.S.fore,0,0).applyMatrix4(mB);
 _dn.set(0,1,0).transformDirection(mC);
 /* Closing the wing is not just folding the arm: the fingers have to come together and
    draw in, the way a fan shuts, or the skin between them stays a flat sheet standing out
    from the horse's side. */
 const o0=Math.max(0,Math.min(1,open===undefined?1:open));
 const o=o0*o0*(3-2*o0);                                     // shut stays shut until it means it
 _danc.copy(DWING.anchor).multiplyScalar(0.52+0.48*o);
 for(let i=0;i<F;i++){
  const sw=DWING.fing[i][0]*(0.22+0.78*o), ln=DWING.fing[i][1]*(0.58+0.42*o);
  _ddir[i].set(1,0,0).applyAxisAngle(_dY,sw).transformDirection(mC);
  _dtip[i].copy(_dwri).addScaledVector(_ddir[i],ln);
 }
 const geo=pair[0].userData.mem, pos=geo.attributes.position, uv=geo.attributes.uv, vcol=geo.attributes.color;
 const wr=pair[0].userData.wroot, wb=pair[0].userData.wweb;
 const billow=(-0.14-f*0.30)*(0.55+0.45*o);                  // the sheet bellies out on the downstroke
 let k=0;
 const _wc=new THREE.Color();
 const outw=(1-o)*0.055;                     // a shut wing lies on the flank, not inside it
 const put=(p,u0,v0,mix)=>{ pos.setXYZ(k,p.x+outw,p.y,p.z); uv.setXY(k,u0,v0);
  _wc.copy(wr).lerp(wb,Math.min(1,mix===undefined?1:mix)); vcol.setXYZ(k,_wc.r,_wc.g,_wc.b); k++; };
 for(let pnl=0;pnl<F;pnl++){
  const e0=_dtip[pnl], e1=(pnl<F-1)?_dtip[pnl+1]:_danc;
  for(let w=0;w<=W;w++){ const fw=w/W;
   _dq.copy(e0).lerp(e1,fw).lerp(_dwri,Math.sin(Math.PI*fw)*0.13);   // the trailing edge scallops in
   for(let u=0;u<=U;u++){ const fu=u/U;
    _dv.copy(_dwri).lerp(_dq,fu);
    _dv.addScaledVector(_dn,Math.sin(Math.PI*fw)*fu*billow*(pnl===F-1?1.35:1.0));
    put(_dv,fu*2.4,((pnl+fw)/F)*1.7,0.16+fu*0.95);
   }
  }
 }
 _dlead[0].set(0,0,0); _dlead[1].copy(_delb); _dlead[2].copy(_dwri);
 for(let j=0;j<=3;j++){
  const fj=j/3, seg=fj<0.5?0:1, ft=fj<0.5?fj*2:(fj-0.5)*2;
  _dp.copy(_dlead[seg]).lerp(_dlead[seg+1],ft);
  for(let w=0;w<=W;w++){ const fw=w/W;
   _dv.copy(_dp).lerp(_danc,fw).addScaledVector(_dn,Math.sin(Math.PI*fw)*billow*0.5);
   put(_dv,fw*1.7,fj*2.4,0.10+fw*0.75);
  }
 }
 pos.needsUpdate=true; uv.needsUpdate=true; vcol.needsUpdate=true; geo.computeVertexNormals();
 /* The bones: the arm, the forearm and the four fingers, as ribbons that taper to a claw.
    Each one gets its own vectors — sharing scratch with the joints quietly ate the elbow. */
 const bg=pair[0].userData.bone, bp=bg.attributes.position; let m=0;
 const rib=(p0,p1,w0,w1)=>{
  _ds.copy(p1).sub(p0); if(_ds.lengthSq()<1e-9)_ds.set(1,0,0); _ds.normalize();
  _dr.crossVectors(_ds,_dn); if(_dr.lengthSq()<1e-9)_dr.set(0,0,1); _dr.normalize();
  for(let u=0;u<=U;u++){ const fu=u/U, ww=w0+(w1-w0)*fu;
   _dv.copy(p0).lerp(p1,fu).addScaledVector(_dn,0.016);
   bp.setXYZ(m++,_dv.x+_dr.x*ww+outw,_dv.y+_dr.y*ww,_dv.z+_dr.z*ww);
   bp.setXYZ(m++,_dv.x-_dr.x*ww+outw,_dv.y-_dr.y*ww,_dv.z-_dr.z*ww);
  }
 };
 _dp.set(0,0,0);
 rib(_dp,_delb,0.048,0.034);
 rib(_delb,_dwri,0.034,0.024);
 for(let i=0;i<F;i++)rib(_dwri,_dtip[i],0.024,0.005);
 bp.needsUpdate=true; bg.computeVertexNormals();
}
function buildPegasusWings(){
 const aF=new THREE.InstancedBufferAttribute(new Float32Array(WING.nF*16),16).setUsage(THREE.DynamicDrawUsage);
 const aC=new THREE.InstancedBufferAttribute(new Float32Array(WING.nC*16),16).setUsage(THREE.DynamicDrawUsage);
 const mF=new THREE.MeshStandardMaterial({map:featherTex,alphaTest:0.34,side:THREE.DoubleSide,
  roughness:0.50,metalness:0,color:0xffffff,emissive:0x000000});
 const mC=new THREE.MeshStandardMaterial({map:featherTex,alphaTest:0.34,side:THREE.DoubleSide,
  roughness:0.62,metalness:0,color:0xdae3f0,emissive:0x000000});
 mF.envMapIntensity=0.8; mC.envMapIntensity=0.7;
 [mF,mC].forEach((m,k)=>featherGlow(m,k?0.5:0.85));
 const cF=new THREE.InstancedBufferAttribute(new Float32Array(WING.nF*3),3);
 const cC=new THREE.InstancedBufferAttribute(new Float32Array(WING.nC*3),3);
 {let iF=0,iC=0; const col=new THREE.Color();
  for(const r of WING.rows){
   const v=(0.90+Math.abs(r.jit)*0.20)*r.shade;             // no two alike, and the under-rows sit in shade
   col.setRGB(v,v*0.995,v*0.985+0.012);
   if(r.mat)col.toArray(cC.array,(iC++)*3); else col.toArray(cF.array,(iF++)*3);
  }}
 const mk=sgn=>{
  const piv=new THREE.Group();
  piv.scale.set(sgn*0.72,0.72,0.72);                         // the left wing is the right one mirrored
  const iF=new THREE.InstancedMesh(FEATHER_GEO,mF,WING.nF);
  const iC=new THREE.InstancedMesh(FEATHER_GEO,mC,WING.nC);
  iF.instanceMatrix=aF; iC.instanceMatrix=aC;
  iF.instanceColor=cF; iC.instanceColor=cC;
  iF.frustumCulled=false; iC.frustumCulled=false;
  iF.castShadow=true; iC.castShadow=true;
  piv.add(iF,iC);
  piv.userData={sgn,mats:[mF,mC],inst:[aF,aC],open:0.05,beat:0};
  return piv;
 };
 const pair=[mk(-1),mk(1)];
 poseWings(pair,0.03,0,0);
 return pair;
}
const DRAGON_TINT={
 ice:   {web:'#8fe4ff',root:'#1d4f6e',bone:'#183848',glow:'#bff0ff',head:'#3f86ad',ridge:'#cdeeff'},
 fire:  {web:'#ff8a3a',root:'#5e1a06',bone:'#2a0e05',glow:'#ffb04a',head:'#8e2a08',ridge:'#ffd24a'},
 galaxy:{web:'#a678ff',root:'#241a52',bone:'#1a1230',glow:'#c6a8ff',head:'#3a2a72',ridge:'#c6a8ff'},
 shadow:{web:'#6a4ad0',root:'#140e26',bone:'#0e0a18',glow:'#8a5ae0',head:'#241a3e',ridge:'#8a5ae0'},
 aurora:{web:'#4fd8b0',root:'#0e3a2e',bone:'#0c2a22',glow:'#9cffd8',head:'#1f7a62',ridge:'#9cffd8'},
 _:     {web:'#9fb4d8',root:'#2b3546',bone:'#222836',glow:'#cfe0ff',head:'#5a6478',ridge:'#cfe0ff'},
};
function tintDragonWing(piv,type){
 const th=DRAGON_TINT[type]||DRAGON_TINT._, mt=piv.userData.mats; if(!mt)return;
 piv.userData.wroot.set(th.root||th.bone); piv.userData.wweb.set(th.web);
 mt[0].color.set('#ffffff'); mt[0].emissive.set(th.glow); mt[0].emissiveIntensity=0.10;
 mt[1].color.set(th.bone); mt[1].emissive.set(th.glow); mt[1].emissiveIntensity=0.06;
}
const WING_TINT={
 fire:  {a:'#ffc24a',b:'#c2330c',e:'#ff5a1e',ei:0.42},
 galaxy:{a:'#c4a6ff',b:'#3a2780',e:'#7a4ad8',ei:0.40},
 shadow:{a:'#5a4488',b:'#140c26',e:'#6a3ad0',ei:0.30},   // darker/smokier so wings don't outshine the shadow body
 ice:   {a:'#cdeeff',b:'#4fb0dc',e:'#7fd8f5',ei:0.45},
 aurora:{a:'#7dffc0',b:'#2a8fc8',e:'#3ce0a0',ei:0.48},
};
function tintWingMats(piv,type){   // tint one wing's two feather materials to a mythic theme
 if(piv&&piv.userData.kind==='dragon'){ tintDragonWing(piv,type); return; }
 const t=WING_TINT[type]; if(!t||!piv) return; const mt=piv.userData.mats; if(!mt) return;
 const ca=new THREE.Color(t.a),cb=new THREE.Color(t.b),ce=new THREE.Color(t.e);
 mt[0].color.copy(ca); mt[0].emissive.copy(ce); mt[0].emissiveIntensity=t.ei;     mt[0].roughness=0.62; mt[0].needsUpdate=true;
 mt[1].color.copy(cb); mt[1].emissive.copy(ce); mt[1].emissiveIntensity=t.ei*0.5; mt[1].roughness=0.72; mt[1].needsUpdate=true;
}

 function disposePair(pair) {
  const geos=new Set(), mats=new Set();
  for(const wing of pair||[]) {
   wing.removeFromParent();
   wing.traverse(o=>{if(o.isMesh){if(o.geometry!==FEATHER_GEO)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
  }
  for(const g of geos)g.dispose();for(const m of mats)m.dispose();
 }
 return {buildPegasusWings,buildDragonWings,poseWings,tintWingMats,disposePair,
   dispose(){FEATHER_GEO.dispose();featherTex.dispose();dragonWebTex.dispose();}};
}

// The roster's fantasy colours are applied after cloning a physical breed.
// Shared by the ranch and Studio so a horse has the same coat in both places.
export const EQUINE_FANTASY_APPEARANCE={
 aether:{theme:'galaxy',mane:'#b79dff'},sunspear:{theme:'fire',mane:'#ffb04a'},meadowlight:{theme:'aurora',mane:'#7df0c4'},tempest:{theme:'shadow',mane:'#a07ce0'},eclipse:{theme:'eclipse',mane:'#ffb44a'},glacier:{theme:'ice',mane:'#8fd0ec'},
 unicorn:{body:'#f6f3ff',mane:'#cdb4f9',horn:true},pegasus:{body:'#f2f5fb',mane:'#dfe7f4',wings:true},celestial:{theme:'galaxy',mane:'#b79dff',horn:true},ember:{theme:'fire',mane:'#ff8a3a'},frost:{theme:'ice',mane:'#8fd0ec'},aurora:{theme:'aurora',mane:'#7df0c4',wings:true},phoenix:{theme:'fire',mane:'#ff9a4a',wings:true},shadowmare:{theme:'shadow',mane:'#a07ce0'},kestrel:{body:'#c9ced6',mane:'#eef2f7'},
 frostdrake:{theme:'ice',mane:'#8fd0ec',dragon:true,wings:true},emberdrake:{theme:'fire',mane:'#ff8a3a',dragon:true,wings:true},amethyst:{theme:'galaxy',mane:'#b79dff',dragon:true,wings:true},stormdrake:{theme:'shadow',mane:'#a07ce0',dragon:true,wings:true},verdant:{theme:'aurora',mane:'#7df0c4',dragon:true,wings:true},
};
export function applyEquineFantasyAppearance(THREE,inst,key){
 const appearance=EQUINE_FANTASY_APPEARANCE[key];if(!appearance||!inst?.skin)return null;
 const original=inst.skin.material;
 let body=appearance.theme?createEquineFantasyCoat(THREE,original,appearance.theme,!!appearance.dragon):original.clone();
 if(appearance.body){
  body.name='PearlCoat_'+key;body.color.set(0xffffff);body.roughness=.52;body.metalness=.035;
  const tint=new THREE.Color(appearance.body),hoofTop=(inst.profile?.withersM||1.55)*.054;
  body.customProgramCacheKey=()=>body.name;
  body.onBeforeCompile=shader=>{
   shader.uniforms.equinePearl={value:tint};shader.uniforms.equineHoofTop={value:hoofTop};
   shader.vertexShader='varying float equineCoatHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nequineCoatHeight=position.y;');
   shader.fragmentShader='uniform vec3 equinePearl;uniform float equineHoofTop;varying float equineCoatHeight;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float coatValue=dot(diffuseColor.rgb,vec3(.299,.587,.114));
    vec3 pearl=equinePearl*clamp(.70+.38*pow(max(coatValue,.00001),.22),.70,1.08);
    float aboveHoof=smoothstep(equineHoofTop*.85,equineHoofTop,equineCoatHeight);
    diffuseColor.rgb=mix(vec3(.035,.030,.026),pearl,aboveHoof);`);
  };body.needsUpdate=true;
 }
 inst.skin.material=body;inst.materials?.push(body);
 const hair=new Set();inst.scene.traverse(object=>{if(/groom|mane|forelock|tailhair|feather/i.test(object.name))object.traverse(child=>{if(child.isMesh)hair.add(child);});});
 const tinted=new Set();for(const mesh of hair)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!tinted.has(material)){tinted.add(material);material.color.set(appearance.mane);material.roughness=Math.max(.38,material.roughness||.5);material.needsUpdate=true;}
 return{...appearance,material:body,update(time){body.userData.update?.(time);}};
}
