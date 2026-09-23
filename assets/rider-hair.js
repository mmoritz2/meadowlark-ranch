/* Rider hair: real hairstyles for a bare head.

   The rider is one sculpt, modelled in a riding helmet, so under the helmet there is no head: take
   the helmet off and there is a hole. Hair used to be a brown hemisphere put over that hole and a
   ball or two behind — which read as a second helmet, with the dark band of the real helmet's brim
   still showing across her forehead. The riding game this one is modelled on puts its riders in
   big, soft, styled hair: curls to the shoulders, long hair down the back, a fringe swept across
   the brow.

   Everything here is built in the head bone's own frame, in the sculpt's own units (the head joint
   is the origin; x to her 'R' side, y up, z ahead), so it rides every nod and turn of the head for
   free. The measurements come off the sculpt: the helmet it was modelled in is 0.38 across and
   0.42 front to back at its widest, which is exactly the space a head of hair has to fill.

     cap     the hair over the skull: an ellipsoid the size of that helmet, cut away below a hairline
             that runs high over the brow, down past the temples and ears, and low at the nape.
     fringe  a side-swept fringe across the brow, parted over her left eye, that covers the line
             where the helmet was cut away.
     style   whatever falls from the cap: long hair down the back, curls, a bob, a ponytail, a bun,
             a braid, pigtails, a crop or a quiff.

   Pure module: THREE is injected, nothing runs at import time. buildHair returns a Group and a
   dispose(); hairStyles lists what it knows. */
export const hairStyles=[
 {id:'loose',label:'Long',body:null},{id:'curly',label:'Curls',body:null},{id:'bob',label:'Bob',body:null},
 {id:'ponytail',label:'Ponytail',body:null},{id:'bun',label:'Bun',body:null},{id:'braid',label:'Braid',body:['f']},
 {id:'pigtails',label:'Pigtails',body:['f']},{id:'crop',label:'Crop',body:['m']},{id:'quiff',label:'Quiff',body:['m']},
];
export function buildHair(THREE,style,color,opt){
 const helmet=!!(opt&&opt.helmet);   // under a helmet only what falls below it shows
 const g=new THREE.Group(); g.name='hair-'+style;
 const disp=[];
 const C=new THREE.Color(color||'#4a2e1c');
 /* A strand texture laid along the flow of the hair: fine light and dark streaks, and the root end
    a shade darker. Tinted by the hair colour, so one texture serves every shade. */
 const tex=strandTexture(THREE); disp.push(tex);
 const mat=new THREE.MeshStandardMaterial({color:C,map:tex,roughness:0.62,metalness:0,side:THREE.DoubleSide});
 const matCurl=new THREE.MeshStandardMaterial({color:C.clone().multiplyScalar(0.82),roughness:0.7,metalness:0});   // no strand map, so a shade darker to sit with the textured cap
 disp.push(mat,matCurl);
 const add=(geo,m)=>{const me=new THREE.Mesh(geo,m||mat);me.castShadow=true;me.receiveShadow=true;me.frustumCulled=false;g.add(me);disp.push(geo);return me;};
 /* the skull: centre and radii, head-joint frame */
 const CX=0,CY=0.165,CZ=0.02, RX=0.180,RY=0.212,RZ=0.200;
 const big=style==='curly'?1.08:style==='crop'||style==='quiff'?0.97:1.0;
 /* where the hair starts, going round the head: θ=0 straight ahead, ±π at the back */
 /* high over the brow (her eyes are at about 0.10, the brows 0.13), down past the temples and ears,
    low at the nape; the helmet was cut away at 0.145, so everywhere the fringe does not cover, the cap
    comes down below that */
 const hairline=th=>{const a=Math.abs(th);return a<0.45?0.165-0.02*(a/0.45):a<1.6?0.145-0.09*((a-0.45)/1.15):0.055-0.085*((a-1.6)/(Math.PI-1.6));};
 const onCap=(th,y,out)=>{ /* the point of the (scaled) skull ellipsoid at angle th and height y, pushed out by `out` */
  const k=Math.max(0,1-Math.pow((y-CY)/(RY*big),2)), r=Math.sqrt(k);
  return [CX+Math.sin(th)*RX*big*r*(1+out),y,CZ+Math.cos(th)*RZ*big*r*(1+out)];
 };
 /* ---- the cap ---- */
 if(!helmet){
  const NT=56,NY=22,P=[],UV=[],I=[];
  for(let j=0;j<=NY;j++){const v=j/NY;
   for(let i=0;i<=NT;i++){const u=i/NT, th=(u-0.5)*Math.PI*2;
    const yTop=CY+RY*big, yBot=hairline(th)-(style==='curly'?0.02:0);
    const y=yTop+(yBot-yTop)*Math.pow(v,0.85);
    const p=onCap(th,y,0.01*Math.sin(th*7+y*40)*(style==='curly'?2.5:1));
    P.push(p[0],p[1],p[2]); UV.push(u*6,v);
   }}
  for(let j=0;j<NY;j++)for(let i=0;i<NT;i++){const a=j*(NT+1)+i,b=a+NT+1;I.push(a,b,a+1,b,b+1,a+1);}
  add(meshGeo(THREE,P,UV,I)).name='haircap';
 }
 /* ---- the fringe: swept from a part over her left eye across the brow ---- */
 if(style!=='crop'&&!helmet){
  const NT=40,NY=6,P=[],UV=[],I=[];
  for(let j=0;j<=NY;j++){const v=j/NY;
   for(let i=0;i<=NT;i++){const u=i/NT, th=-0.95+u*1.30;          // from her right temple round to the part over her left eye
    /* it stops above her brows: the longest point, swept toward her right, is 0.035 below the hairline */
    /* strand tips rather than a blunt edge: every few strands a little longer or shorter */
    const tips=0.010*Math.abs(Math.sin(u*Math.PI*6.5))+0.005*Math.abs(Math.sin(u*Math.PI*17));
    const top=hairline(th)+0.055, low=hairline(th)-0.004-0.012*Math.max(0,1-Math.abs(th+0.25)/0.8)-tips*0.6*v;   // clears her eyes, still covers the cut at 0.145
    const y=top+(low-top)*v;
    const p=onCap(th,y,0.022+0.016*(1-v)+0.004*Math.sin(u*40));
    P.push(p[0],p[1],p[2]); UV.push(u*2,v);
   }}
  for(let j=0;j<NY;j++)for(let i=0;i<NT;i++){const a=j*(NT+1)+i,b=a+NT+1;I.push(a,b,a+1,b,b+1,a+1);}
  add(meshGeo(THREE,P,UV,I));
 }
 /* ---- what falls from it ---- */
 const back=(th0,th1,len,flare,out,rough)=>{  /* a curtain round the back of the head, from the hairline down `len` */
  const NT=30,NY=16,P=[],UV=[],I=[];
  for(let j=0;j<=NY;j++){const v=j/NY;
   for(let i=0;i<=NT;i++){const u=i/NT, th=th0+(th1-th0)*u;
    const y0=hairline(th)+0.02, y=y0-len*v;
    const top=onCap(th,Math.max(y0-0.02,CY-RY*big*0.55),out);
    /* hug the skull, then the neck, then fall away over the back and shoulders */
    const rr=Math.hypot(top[0]-CX,top[2]-CZ);
    const neck=0.13+0.05*v, r=Math.max(neck,rr*(1-0.35*Math.min(1,v*2.2)))+flare*v*v+(rough?0.012*Math.sin(u*37+v*9):0);
    const zOff=-0.05*v;                                              // the ends fall a little behind her
    P.push(CX+Math.sin(th)*r,y,CZ+Math.cos(th)*r*1.08+zOff); UV.push(u*5,0.2+v*0.8);
   }}
  for(let j=0;j<NY;j++)for(let i=0;i<NT;i++){const a=j*(NT+1)+i,b=a+NT+1;I.push(a,b,a+1,b,b+1,a+1);}
  return add(meshGeo(THREE,P,UV,I));
 };
 const ball=(r,x,y,z,m)=>{const me=add(new THREE.SphereGeometry(r,14,10),m||mat);me.position.set(x,y,z);return me;};
 if(style==='loose')back(1.25,Math.PI*2-1.25,0.62,0.10,0.03,true);
 else if(style==='bob')back(1.05,Math.PI*2-1.05,0.30,0.05,0.035,false);
 else if(style==='curly'){
  /* Curls: a soft mass to the shoulders under a skin of small ringlets. The mass keeps it one head of
     hair with no gaps through it; the ringlets, a few hundred of them in one instanced draw, give it
     the curly edge and the dappled light and shade that make it read as curls rather than a helmet. */
  const mass=back(1.0,Math.PI*2-1.0,0.36,0.09,0.06,false);
  let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const N=1300, geo=new THREE.IcosahedronGeometry(1,1), im=new THREE.InstancedMesh(geo,matCurl,N);
  im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; disp.push(geo);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3(),cl=new THREE.Color();
  for(let k=0;k<N;k++){
   let x,y,z;
   if(k<430){ /* over the crown and down the sides of the cap, but clear of her brow; none under a helmet */
    if(helmet){im.setMatrixAt(k,m4.makeScale(0,0,0));continue;}
    const th=(rnd()-0.5)*Math.PI*2, yy=CY+RY*big*(0.97-1.25*rnd());   // -π..π, so 'in front' is |th| small on both sides
    if(Math.abs(th)<0.75&&yy<hairline(th)+0.07){k--;continue;}
    const p=onCap(th,Math.max(yy,hairline(th)-0.01),0.045); x=p[0];y=p[1];z=p[2];
   }else{ /* over the fall: round the back and the sides, from the ears to the shoulders */
    const th=1.0+rnd()*(Math.PI*2-2.0), v=rnd();
    const y0=hairline(th)+0.02; y=y0-0.36*v;
    const top=onCap(th,Math.max(y0-0.02,CY-RY*big*0.55),0.06), rr=Math.hypot(top[0]-CX,top[2]-CZ);
    const r=Math.max(0.13+0.05*v,rr*(1-0.35*Math.min(1,v*2.2)))+0.09*v*v+0.018;
    x=CX+Math.sin(th)*r; z=CZ+Math.cos(th)*r*1.08-0.05*v;
   }
   const s=0.016+0.012*rnd(); sc.set(s,s*(0.75+0.35*rnd()),s);
   q.setFromAxisAngle(ps.set(rnd()-0.5,rnd()-0.5,rnd()-0.5).normalize(),rnd()*6.28);
   m4.compose(ps.set(x,y,z),q,sc); im.setMatrixAt(k,m4);
   cl.setRGB(1,1,1).multiplyScalar(0.88+0.18*rnd()); im.setColorAt(k,cl);
  }
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor)im.instanceColor.needsUpdate=true;
  g.add(im);
 }
 else if(style==='ponytail'){
  const pts=[[0,0.26,-0.19],[0,0.20,-0.27],[0,0.06,-0.31],[0,-0.10,-0.30],[0,-0.24,-0.27]];
  tube(THREE,add,mat,pts,[0.045,0.06,0.055,0.045,0.02]);
  ball(0.03,0,0.25,-0.19,mat);
 }
 else if(style==='bun'){ball(0.095,0,0.30,-0.19);ball(0.028,0,0.24,-0.12);}
 else if(style==='braid'){
  back(1.9,Math.PI*2-1.9,0.10,0.0,0.03,false);
  for(let k=0;k<9;k++)ball(0.048-0.002*k,0,0.10-k*0.075,-0.24-0.012*k);
  ball(0.03,0,0.10-9*0.075+0.02,-0.35);
 }
 else if(style==='pigtails'){for(const s of[-1,1]){const pts=[[s*0.16,0.14,-0.06],[s*0.21,0.06,-0.08],[s*0.23,-0.08,-0.09],[s*0.22,-0.20,-0.09]];tube(THREE,add,mat,pts,[0.05,0.05,0.042,0.018]);ball(0.028,s*0.17,0.14,-0.06);}}
 else if(style==='quiff'){const m=ball(0.085,0,0.34,0.10);m.scale.set(1.3,0.75,1.05);}
 return {group:g,dispose(){for(const d of disp)try{d.dispose();}catch(e){}}};
}
function meshGeo(THREE,P,UV,I){
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
 geo.setIndex(I); geo.computeVertexNormals(); geo.computeBoundingSphere();
 return geo;
}
/* a tapered tube through a few points: ponytails and pigtails */
function tube(THREE,add,mat,pts,radii){
 const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
 const segs=24, rad=10, geo=new THREE.TubeGeometry(curve,segs,1,rad,false), pa=geo.attributes.position;
 const cen=new THREE.Vector3(),v=new THREE.Vector3();
 for(let i=0;i<=segs;i++){ const t=i/segs, rr=radiusAt(radii,t); curve.getPointAt(t,cen);
  for(let j=0;j<=rad;j++){const k=i*(rad+1)+j; v.fromBufferAttribute(pa,k).sub(cen).multiplyScalar(rr).add(cen); pa.setXYZ(k,v.x,v.y,v.z);} }
 pa.needsUpdate=true; geo.computeVertexNormals(); geo.computeBoundingSphere();
 add(geo,mat);
}
function radiusAt(r,t){const f=t*(r.length-1),i=Math.min(r.length-2,Math.floor(f));return r[i]+(r[i+1]-r[i])*(f-i);}
let _strand=null;
function strandTexture(THREE){
 if(_strand&&_strand.image)return _strand.clone();
 const S=128,cv=document.createElement('canvas');cv.width=cv.height=S;const c=cv.getContext('2d');
 c.fillStyle='#d8d8d8';c.fillRect(0,0,S,S);
 for(let i=0;i<260;i++){const x=Math.random()*S,w=0.6+Math.random()*1.6,l=0.55+Math.random()*0.5;
  c.fillStyle='rgba('+(Math.random()<0.5?'255,255,255':'70,70,70')+','+(0.10+Math.random()*0.22)+')';c.fillRect(x,0,w,S);}
 const gr=c.createLinearGradient(0,0,0,S);gr.addColorStop(0,'rgba(0,0,0,0.25)');gr.addColorStop(0.35,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,0,S,S);
 _strand=new THREE.CanvasTexture(cv);_strand.wrapS=_strand.wrapT=THREE.RepeatWrapping;_strand.colorSpace=THREE.SRGBColorSpace;
 return _strand.clone();
}
