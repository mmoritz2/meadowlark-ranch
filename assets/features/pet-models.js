/* Feature package 'pet-models' — the pets themselves: fifteen animals, how each one moves, where it
   walks so that you can actually see it, and how the winged ones fly with you.

   Every companion used to be the same four-legged blob in a different coat — the duckling, the chick
   and the owl had cat ears and four legs — and the one following you walked 2.2 m behind the horse,
   which is under the bottom edge of the picture, so most of the time it was not on screen at all. A
   pet saved by one of the market's eleven also came back as a puppy after a reload. Here:

     · each pet is its own animal, built from soft fused shapes (one seamless body and a head that can
       turn), with eyes that catch the light, readable from the saddle by its outline alone: the fox's
       white-tipped brush, the corgi's bat ears on stubby legs, the piglet's snout, the goat's horns and
       beard, the raccoon's mask and ringed tail, the fennec's huge ears, the owl's heart-shaped face;
     · a way of moving for each body plan — a walk, trot and gallop for the four-legged ones whose paws
       stay planted (the stride rate comes from the speed and the reach of the leg, and each leg is bent
       by two-bone IK to put its paw on the ground), hops for the bunny and the hare that travel in the
       air, a waddle, a scurry and two-footed hops for the birds — and idles when you stop (sitting,
       sniffing, a head tilt, grooming, pecking, the owl turning its head right round to look at you),
       a blink, ears and tail that swing; nothing ever dips below the ground (floorLift);
     · stopped, a pet turns three-quarters towards the camera and looks at you, so you see its face;
     · the follow: a spot beside the horse's shoulder on the side the camera is on (ahead of the horse
       on a phone held upright or when a tree or a wall has pulled the camera in, and where the lens sees
       over a pegasus's folded wings), scored three times a second against the picture: inside the frame,
       clear of the on-screen buttons and panels, and not hidden — by the horse and rider (boxes measured
       from the models themselves), by bushes, ferns, reeds and stones, by trunks, rocks and buildings,
       by fences, the lie of the ground and Willowmere's boardwalk — all worked out on the CPU from the
       scene's own data, no extra rendering and no pixels read back. It holds the spot's own speed (the
       horse's, plus the swing of a spot beside a turning horse) with no cap, goes to the inside of a held
       turn, crosses round the front of the horse (never between its legs), never picks a spot across a
       fence or inside a building, steers round trees on the side away from the horse, stands on the
       boardwalk's planks, swims across water with its head up, and if it is ever left far behind (fast
       travel, the start of a course, a long flight) it comes back from somewhere the camera is not
       looking and runs in, so it never pops into view;
     · flight: on a winged horse the owl, the duckling and the chick take off when you do, fly beside
       and a little behind you at your height (on a phone above and behind, the spot picked by the
       picture), flapping and gliding and banking with the horse through the turns, always clear of the
       horse's wings, and land beside the horse when you land; the others run along underneath and are
       back at your side a moment after you touch down;
     · a drawn portrait of every pet for the menus.

   Contract (names final):
     G.petModels.make(key,cfg) -> parts {group,legs,tail,head,body,spec,...}   makePet delegates here
     G.petModels.move(comp,dt,t) -> true when it drove the pet this frame        updatePet delegates here
     G.petModels.place(comp)      re-seats the model after something else moved comp.pos (world.js)
     G.petModels.SPECIES          the build sheets, by pet key
     G.petArt.svg(key,size=64) -> '<svg ...>'  an original portrait, size px square; an unknown key gets
                                  a paw print.  G.petArt.list() -> keys with a portrait of their own.
     G.pets.portrait(key,size)   the same, on the game's own pets handle.
     G.petModels.glow(amount,colour)  lights the pet's own rim (the market's pair glow), 0..1.
   A pet comp gains .airborne (a bird off the ground: world.js leaves it alone), .alt (metres above its
   own ground), .framed (it keeps itself in the picture, so no camera push-out), .place() and .st.
   Nothing runs at import time. */
export const id='pet-models';
export function install(G){
 const THREE=G.THREE, W=G.world, H=G.horse;
 if(!THREE||!W||!H||!H.player)return;
 const player=H.player;
 const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt)), cl1=(v,m)=>v>m?m:v<-m?-m:v;
 const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const TAU=Math.PI*2, gH=(x,z)=>W.groundH(x,z);

 /* ================================================================ the kit ====================
    One body material for every fused pet body (its colours live in the vertices), accent materials
    cached by colour, and a few unit shapes every species scales. All of them get a warm rim light so
    a pet's outline lifts off the grass, and a little of the fur colour added back on the shadow side
    so a white pet never turns blue-grey in the shade. */
 /* PETGLOW is one uniform shared by every pet material: the market's pair glow (a pet beside the horse it
    matches) pulses the pet's own rim through it, instead of wrapping the animal in a bubble. Only one pet
    is ever in the scene, so a shared value is exactly right. 'lift' adds a little of the fur colour back
    as light (the chick and the duckling, whose yellows otherwise grade down to mustard). */
 const PETGLOW={value:new THREE.Color(0,0,0)};
 const rimify=(m,k,lift)=>{const L=(lift||0).toFixed(3);m.onBeforeCompile=sh=>{sh.uniforms.uPetGlow=PETGLOW;
   sh.fragmentShader='uniform vec3 uPetGlow;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',
  '{vec3 pV=normalize(vViewPosition);float pF=pow(1.0-clamp(dot(normal,pV),0.0,1.0),2.4);outgoingLight+=mix(diffuseColor.rgb,vec3(1.0,0.97,0.90),0.5)*pF*0.30+diffuseColor.rgb*(0.07+'+L+')+uPetGlow*(0.25+pF*1.6);}\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>'petRim'+(k||'')+L;return m;};
 const BODY=rimify(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.88,metalness:0}),'v');BODY.envMapIntensity=0.45;
 const WINGM=rimify(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9,metalness:0,side:THREE.DoubleSide}),'w');WINGM.envMapIntensity=0.4;
 const ACC=rimify(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.8,metalness:0}),'a');ACC.envMapIntensity=0.5;   // the merged small parts (ears, blush, horns, snout), their colours in the vertices
 const EYEM=rimify(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.2,metalness:0}),'e');EYEM.envMapIntensity=1.0;   // an eye's ring, iris and pupil in one mesh
 const MAT={}, mat=(c,r)=>{const k=c+'|'+(r||0.88);if(!MAT[k]){MAT[k]=rimify(new THREE.MeshStandardMaterial({color:c,roughness:r||0.88,metalness:0}));MAT[k].envMapIntensity=0.5;}return MAT[k];};
 const MAT2={}, mat2=(c)=>{if(!MAT2[c]){MAT2[c]=rimify(new THREE.MeshStandardMaterial({color:c,roughness:0.85,metalness:0,side:THREE.DoubleSide}),'d');}return MAT2[c];};
 const EYE=new THREE.MeshStandardMaterial({color:'#1a120d',roughness:0.16,metalness:0});EYE.envMapIntensity=1.0;
 const GLINT=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
 const GEO={}, geo=(k,mk)=>GEO[k]||(GEO[k]=mk());
 /* Merging: a pet's small fixed parts (an ear and its lining, an eye's ring, iris and pupil, the blush, the
    horns and beard) are drawn as one mesh each instead of one per shape, their colours baked into the
    vertices. The merged geometry is built once per species and part and shared. */
 const _mM=new THREE.Matrix4(),_mN=new THREE.Matrix3(),_mv=new THREE.Vector3(),_mc=new THREE.Color();
 function mergeParts(parts){   // parts: [{g, m:Matrix4 relative to the holder, c:Color|null (null: white)}]
  let nv=0,ni=0;for(const p of parts){nv+=p.g.attributes.position.count;ni+=p.g.index?p.g.index.count:p.g.attributes.position.count;}
  const pos=new Float32Array(nv*3),nrm=new Float32Array(nv*3),col=new Float32Array(nv*3),idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);
  let ov=0,oi=0;
  for(const p of parts){const pa=p.g.attributes.position,na=p.g.attributes.normal,ca=p.g.attributes.color,n=pa.count;_mN.getNormalMatrix(p.m);
   for(let i=0;i<n;i++){_mv.fromBufferAttribute(pa,i).applyMatrix4(p.m);pos[(ov+i)*3]=_mv.x;pos[(ov+i)*3+1]=_mv.y;pos[(ov+i)*3+2]=_mv.z;
    if(na){_mv.fromBufferAttribute(na,i).applyMatrix3(_mN).normalize();nrm[(ov+i)*3]=_mv.x;nrm[(ov+i)*3+1]=_mv.y;nrm[(ov+i)*3+2]=_mv.z;}
    if(ca&&p.vc){_mc.setRGB(ca.getX(i),ca.getY(i),ca.getZ(i));}else _mc.copy(p.c||_mc.setRGB(1,1,1));
    col[(ov+i)*3]=_mc.r;col[(ov+i)*3+1]=_mc.g;col[(ov+i)*3+2]=_mc.b;}
   if(p.g.index){const ix=p.g.index;for(let i=0;i<ix.count;i++)idx[oi+i]=ix.getX(i)+ov;oi+=ix.count;}else{for(let i=0;i<n;i++)idx[oi+i]=i+ov;oi+=n;}
   ov+=n;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();g.computeBoundingBox();return g;}
 /* collapse the meshes under 'holder' (at any depth, all fixed relative to it) into one mesh of material m */
 function bake(key,holder,list,m,shadow){
  if(!list.length)return null;
  holder.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const g=geo('bake-'+key,()=>mergeParts(list.map(o=>({g:o.geometry,m:new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),vc:!!(o.material&&o.material.vertexColors),c:o.material&&o.material.color?o.material.color:null}))));
  for(const o of list)if(o.parent)o.parent.remove(o);
  const mm=new THREE.Mesh(g,m);mm.castShadow=!!shadow;holder.add(mm);return mm;}
 const SPH=geo('sph',()=>new THREE.SphereGeometry(1,18,14)), SPL=geo('spl',()=>new THREE.SphereGeometry(1,10,8));
 const capG=(r,l)=>geo('cap'+r+'|'+l,()=>{const g=new THREE.CapsuleGeometry(r,Math.max(0.001,l),3,8);g.translate(0,-l/2,0);return g;});   // top cap centre at 0, bottom cap centre at -l
 const CONE=geo('cone',()=>{const g=new THREE.ConeGeometry(1,1,12);g.translate(0,0.5,0);return g;});                                        // base on 0, tip at +1
 const DISC=geo('disc',()=>{const g=new THREE.CylinderGeometry(1,1,1,16);g.rotateX(Math.PI/2);return g;});                                   // along z, centred
 const mesh=(g,m,parent,x,y,z,sx,sy,sz,shadow)=>{const o=new THREE.Mesh(g,m);o.position.set(x||0,y||0,z||0);if(sx!=null)o.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);o.castShadow=false;if(parent)parent.add(o);return o;};   // only the body, the head and a fused tail cast a shadow (set where they are made)
 const ell=(parent,c,x,y,z,sx,sy,sz,shadow)=>mesh(SPH,typeof c==='string'?mat(c):c,parent,x,y,z,sx,sy,sz,shadow);
 const grp=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x||0,y||0,z||0);if(parent)parent.add(g);return g;};
 const dirYP=(yaw,pitch)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];

 /* Fused shapes: an icosphere shrink-wrapped onto a smooth union of ellipsoids, the way the valley's
    critters are made, with a tighter blend so pet-sized features (a muzzle, a cheek) keep their shape.
    A prim flagged as paint (index 8) only colours the surface inside it: masks, blazes, bellies, socks.
    The top of every body is baked a little lighter than its belly, the way the horses are painted. */
 function fuse(prims,K,detail){
  const P=[],PT=[];
  for(const p of prims){const o={x:p[0],y:p[1],z:p[2],r:p[3],sx:p[4]||1,sy:p[5]||1,sz:p[6]||1,c:new THREE.Color(p[7]||'#ffffff')};o.m=Math.min(o.sx,o.sy,o.sz);(p[8]?PT:P).push(o);}
  const sd=(x,y,z)=>{let d=1e9;for(const p of P){const qx=(x-p.x)/p.sx,qy=(y-p.y)/p.sy,qz=(z-p.z)/p.sz;const di=(Math.sqrt(qx*qx+qy*qy+qz*qz)-p.r)*p.m;const h=clamp(0.5+0.5*(d-di)/K,0,1);d=d*(1-h)+di*h-K*h*(1-h);}return d;};
  let cx=0,cy=0,cz=0,ws=0;for(const p of P){cx+=p.x*p.r;cy+=p.y*p.r;cz+=p.z*p.r;ws+=p.r;}cx/=ws;cy/=ws;cz/=ws;
  let tMax=0.1;for(const p of P)tMax=Math.max(tMax,Math.hypot(p.x-cx,p.y-cy,p.z-cz)+p.r*Math.max(p.sx,p.sy,p.sz)+K+0.03);
  /* three.js builds an icosphere unindexed and, at detail n, with (n+1)^2 triangles per face: detail 14 is
     2252 distinct points. They are welded first, so each is worked out once and the mesh is indexed. */
  const ico=new THREE.IcosahedronGeometry(1,detail||3),ip=ico.attributes.position,wmap=new Map(),uq=[],index=new Uint32Array(ip.count);
  for(let i=0;i<ip.count;i++){const x=ip.getX(i),y=ip.getY(i),z=ip.getZ(i),k=Math.round(x*1e4)+'|'+Math.round(y*1e4)+'|'+Math.round(z*1e4);let j=wmap.get(k);if(j==null){j=uq.length/3;wmap.set(k,j);uq.push(x,y,z);}index[i]=j;}
  ico.dispose();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(uq,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(uq.length),3));g.setIndex(new THREE.BufferAttribute(index,1));
  const pos=g.attributes.position, nrm=g.attributes.normal, n=pos.count, col=new Float32Array(n*3), e=0.004;
  for(let i=0;i<n;i++){
   let dx=pos.getX(i),dy=pos.getY(i),dz=pos.getZ(i);const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
   let a=0,b=tMax;for(let s=1;s<=32;s++){const tt=tMax*s/32;if(sd(cx+dx*tt,cy+dy*tt,cz+dz*tt)>=0){b=tt;a=tMax*(s-1)/32;break;}}
   for(let s=0;s<8;s++){const m=(a+b)/2;if(sd(cx+dx*m,cy+dy*m,cz+dz*m)<0)a=m;else b=m;}
   const t=(a+b)/2,x=cx+dx*t,y=cy+dy*t,z=cz+dz*t;pos.setXYZ(i,x,y,z);
   let nx=sd(x+e,y,z)-sd(x-e,y,z),ny=sd(x,y+e,z)-sd(x,y-e,z),nz=sd(x,y,z+e)-sd(x,y,z-e);const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;nrm.setXYZ(i,nx,ny,nz);
   let r=0,gg=0,bb=0,w=0;
   for(const p of P){const qx=(x-p.x)/p.sx,qy=(y-p.y)/p.sy,qz=(z-p.z)/p.sz;const wi=1/Math.pow(Math.max(0.004,(Math.sqrt(qx*qx+qy*qy+qz*qz)-p.r)*p.m+K*0.6),3);r+=p.c.r*wi;gg+=p.c.g*wi;bb+=p.c.b*wi;w+=wi;}
   r/=w;gg/=w;bb/=w;
   for(const p of PT){const qx=(x-p.x)/p.sx,qy=(y-p.y)/p.sy,qz=(z-p.z)/p.sz;const k=1-sstep(0.8,1.0,Math.sqrt(qx*qx+qy*qy+qz*qz)/p.r);if(k>0){r=lerp(r,p.c.r,k);gg=lerp(gg,p.c.g,k);bb=lerp(bb,p.c.b,k);}}
   const lit=0.84+0.26*clamp(0.5+0.5*ny,0,1);col[i*3]=r*lit;col[i*3+1]=gg*lit;col[i*3+2]=bb*lit;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();g.computeBoundingBox();
  return {geo:g,sd};
 }
 const FUSED={}, fused=(k,prims,K,detail)=>FUSED[k]||(FUSED[k]=fuse(prims,K,detail));
 /* the point where a ray from (o) along (d) leaves a fused shape, pulled back in by 'inset' */
 function onSurf(F,o,d,inset){const l=Math.hypot(d[0],d[1],d[2])||1,dx=d[0]/l,dy=d[1]/l,dz=d[2]/l;let a=0,b=0.6;
  for(let s=1;s<=48;s++){const t=0.6*s/48;if(F.sd(o[0]+dx*t,o[1]+dy*t,o[2]+dz*t)>=0){b=t;a=0.6*(s-1)/48;break;}}
  for(let s=0;s<10;s++){const m=(a+b)/2;if(F.sd(o[0]+dx*m,o[1]+dy*m,o[2]+dz*m)<0)a=m;else b=m;}
  const t=(a+b)/2-(inset||0);return [o[0]+dx*t,o[1]+dy*t,o[2]+dz*t];}

 /* the soft contact shadow under a pet: one shared disc, sized to the pet (about 1.3x its footprint) */
 let SHADOW=null;
 function contact(parent,w,l){
  if(!SHADOW){const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,64,64);
   const gr=c.createRadialGradient(32,32,2,32,32,31);gr.addColorStop(0,'#8e8a80');gr.addColorStop(0.45,'#bcb8ad');gr.addColorStop(0.78,'#ebe9e2');gr.addColorStop(1,'#ffffff');c.fillStyle=gr;c.fillRect(0,0,64,64);
   const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
   SHADOW={g:new THREE.CircleGeometry(1,20),m:new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,blending:THREE.MultiplyBlending,toneMapped:false})};}
  const m=new THREE.Mesh(SHADOW.g,SHADOW.m);m.rotation.x=-Math.PI/2;m.scale.set(w,l,1);m.position.y=0.015;m.renderOrder=1;parent.add(m);return m;
 }
 let GLOWTEX=null;
 const glowTex=()=>GLOWTEX||(GLOWTEX=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');const gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.35,'rgba(255,255,255,0.55)');gr.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gr;c.fillRect(0,0,64,64);const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;})());

 /* flat shapes, extruded a hair thick: wings (buff on top, pale underneath), webbed and three-toed
    feet, the owl's heart-shaped face */
 function extrude(pts,depth,bev,bsz,segs){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:!!bev,bevelThickness:bev||0,bevelSize:bsz!=null?bsz:(bev||0),bevelSegments:segs||1,curveSegments:3});g.rotateX(Math.PI/2);g.computeVertexNormals();return g;}   // shape x,y -> world x,z; thickness hangs below y=0
 function paintWing(g,top,under,tip,span){const n=g.attributes.normal,p=g.attributes.position,c=new Float32Array(p.count*3),T=new THREE.Color(top),U=new THREE.Color(under),P=new THREE.Color(tip||top);
  for(let i=0;i<p.count;i++){const up=n.getY(i)>-0.3;const k=span?sstep(0.55,0.95,p.getX(i)/span):0;const col=up?T.clone().lerp(P,k):U;c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;}
  g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;}
 function wingGeos(key,Wg){return geo('wing-'+key,()=>{
  /* a wing with some body to it: the arm is a thick, bevelled paddle (seen edge-on it is a rounded
     spar, not a stick), the hand a thinner bevelled fan with five primaries */
  const c=Wg.chord,a=Wg.arm,h=Wg.hand;
  const arm=extrude([[0,c*0.46],[a*0.5,c*0.52],[a,c*0.44],[a,-c*0.46],[a*0.5,-c*0.54],[0,-c*0.46]],0.012,0.015,0.012,2);
  const pts=[[0,c*0.42],[h*0.45,c*0.4],[h*0.85,c*0.22],[h,c*0.0]];
  for(let k=0;k<5;k++){const x=h*(0.94-k*0.16),y=-c*(0.07+k*0.08);pts.push([x,y],[x-h*0.07,y+c*0.07]);}   // five primaries along the trailing edge
  pts.push([0,-c*0.42]);
  const hand=extrude(pts,0.006,0.008,0.006,2);
  return {arm:paintWing(arm,Wg.top,Wg.under),hand:paintWing(hand,Wg.top,Wg.under,Wg.tip,h)};});}
 const webFoot=()=>geo('webfoot',()=>{const g=new THREE.ShapeGeometry((()=>{const s=new THREE.Shape();s.moveTo(0,-0.008);s.lineTo(-0.036,0.052);s.lineTo(-0.018,0.046);s.lineTo(-0.012,0.062);s.lineTo(0,0.052);s.lineTo(0.012,0.062);s.lineTo(0.018,0.046);s.lineTo(0.036,0.052);s.closePath();return s;})());g.rotateX(Math.PI/2);return g;});
 const toeFoot=(L)=>geo('toes'+L,()=>{const pts=[];const w=L*0.2;for(const a of [-0.62,0,0.62]){const sx=Math.sin(a),cz=Math.cos(a),px=Math.cos(a),pz=-Math.sin(a);pts.push([px*w,pz*w],[sx*L,cz*L],[-px*w,-pz*w]);}pts.push([0,-L*0.35]);return extrude(pts,0.008,0);});
 const heart=(w,h,d,b)=>geo('heart'+w+h,()=>{const s=new THREE.Shape();s.moveTo(0,-h/2);s.bezierCurveTo(w*0.55,-h*0.12,w*0.62,h*0.42,w*0.3,h*0.5);s.bezierCurveTo(w*0.12,h*0.54,0.01,h*0.42,0,h*0.3);s.bezierCurveTo(-0.01,h*0.42,-w*0.12,h*0.54,-w*0.3,h*0.5);s.bezierCurveTo(-w*0.62,h*0.42,-w*0.55,-h*0.12,0,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:8});g.translate(0,0,-d);return g;});   // faces +z, front at z=0
 const curlTail=()=>geo('curl',()=>{const pts=[];for(let i=0;i<=24;i++){const t=i/24,a=t*TAU*1.5;pts.push(new THREE.Vector3(Math.sin(a)*0.025,Math.cos(a)*0.025*0.9+t*0.01,-t*0.07));}return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),28,0.011,6,false);});

 const KIT={THREE,mat,mat2,SPH,SPL,CONE,DISC,capG,mesh,ell,grp,geo,glowTex:()=>glowTex(),fused:(k,p,K,d)=>fused(k,p,K,d),GLINT,rimify};   // the drawing set, for a package's own parts (G.petModels.kit)
 /* ================================================================ the build sheets ===========
    Metres, pet frame: origin on the ground under the body, +z towards the nose, y up. Prims are
    [x,y,z, r, sx,sy,sz, colour, paint]. Every size here is chosen so that the smallest pet (the
    chick, 0.38 m) is still more than 40 pixels tall at riding distance, and the mid-size ones 56. */
 const mirror=list=>{const out=[];for(const p of list){if(p[0]&&p[9]!=='one'){out.push(p.slice(0,9));const q=p.slice(0,9);q[0]=-q[0];out.push(q);}else out.push(p.slice(0,9));}return out;};
 function foxSheet(C,sc){const k=sc||1,m=v=>v*k;return {kind:'quad',h:m(.52),len:m(.48),w:m(.26),piv:m(.30),K:.042,scale:k,
  body:mirror([[0,m(.30),m(.10),m(.12),.9,1,1.15,C.fur],[0,m(.31),m(-.12),m(.12),.9,1,1,C.fur],[0,m(.38),m(.17),m(.075),1,1,1,C.fur],
   [0,m(.26),m(.17),m(.085),1,1.1,.9,C.white,1],[0,m(.21),0,m(.10),.9,.55,1.8,C.white,1]]),
  head:{at:[0,m(.44),m(.25)],prims:mirror([[0,0,0,m(.12),1,.95,1,C.fur],[m(.085),m(-.03),m(.02),m(.06),1.2,.8,1,C.white],[0,m(-.03),m(.12),m(.045),.9,.8,1.7,C.fur],
   [0,m(-.055),m(.10),m(.055),1,.7,1.8,C.white,1],[0,m(.03),m(.11),m(.018),1,1,1.2,C.fur2||C.fur,1]])},
  eyes:{r:m(.027),yaw:.42,pitch:.14,o:[0,m(.01),0],iris:C.iris,pupil:C.pupil||'round'},
  nose:{o:[0,m(-.03),m(.1)],d:[0,.05,1],s:[m(.02),m(.016),m(.017)],c:C.nose,rough:.42},
  ears:{type:'cone',yaw:.55,pitch:.95,w:m(.052),len:m(.135),d:m(.026),c:C.fur,inner:C.inner,tip:C.tip,rz:.18},
  legs:{hipY:m(.24),x:m(.07),zF:m(.11),zH:m(-.13),ru:m(.03),rl:m(.026),cu:C.fur,cl:C.sock,paw:{sx:m(.034),sy:m(.024),sz:m(.05),c:C.sock}},
  tail:{at:[0,m(.34),m(-.2)],rest:.12,K:.04,fused:[[0,0,m(-.05),m(.045),1,1,1.4,C.fur],[0,m(-.01),m(-.16),m(.074),1,.95,1.5,C.fur],[0,m(-.02),m(-.29),m(.074),1,.95,1.35,C.fur],[0,m(-.025),m(-.4),m(.052),1,.95,1.2,C.white],
   [0,m(-.025),m(-.4),m(.078),1.1,1.1,1.05,C.white,1]],wagHz:1.4,wag:.22,sway:.2},
  shadow:[m(.2),m(.42)],idles:[['pounce',2],['sit',2],['look',2],['tilt',1],['sniff',1],['spin',1]]};}
 const SPECIES={
  dog:{kind:'quad',h:.63,len:.52,w:.32,piv:.34,K:.045,
   body:mirror([[0,.33,.12,.15,1,.95,1.1,'#d9a45e'],[0,.28,.05,.12,1,.8,1.3,'#d9a45e'],[0,.34,-.13,.14,1,.95,1,'#d9a45e'],[0,.43,.20,.085,1,1,1,'#d9a45e'],
    [0,.28,.21,.10,1,1.1,.9,'#f3e3c4',1],[0,.20,0,.12,1,.6,1.8,'#f3e3c4',1]]),
   head:{at:[0,.50,.26],prims:mirror([[0,0,0,.14,1.05,.95,1,'#d9a45e'],[.07,-.04,.05,.08,1,1,1,'#d9a45e'],[0,-.05,.12,.065,1.1,.8,1.2,'#f3e3c4'],
    [0,-.065,.10,.085,1.15,.75,1.15,'#f3e3c4',1],[0,.088,.09,.036,1,.6,1.6,'#ecc890',1]])},   // a pale blaze up the forehead
   eyes:{r:.031,yaw:.43,pitch:.13,o:[0,.01,0]},
   nose:{o:[0,-.04,.1],d:[0,.12,1],s:[.032,.024,.026],c:'#2a1d16',rough:.42},
   tongue:{at:[0,-.085,.17],s:[.026,.006,.038],c:'#e87a8a'},
   ears:{type:'flop',yaw:1.0,pitch:.55,w:.058,len:.115,d:.024,c:'#b57a3c',rz:-.25},
   legs:{hipY:.26,x:.085,zF:.13,zH:-.14,ru:.045,rl:.038,cu:'#d9a45e',cl:'#d9a45e',paw:{sx:.05,sy:.032,sz:.062,c:'#f3e3c4'}},
   tail:{at:[0,.40,-.25],rest:.85,segs:[[.13,.034,'#d9a45e',1,1,.25],[.12,.032,'#e2b27a',1,1,.4]],wagHz:3,wag:.45},
   shadow:[.22,.4],idles:[['sit',3],['pant',2],['tilt',2],['sniff',2],['scratch',1],['spin',1],['look',1]]},
  fox:foxSheet({fur:'#e2711d',white:'#fdf6ea',sock:'#3a2418',inner:'#f7e3cc',tip:'#3a2418',iris:'#d18a1c',nose:'#1f1510',fur2:'#ec8a3a'}),
  /* a warm grey tabby: a darker saddle and three bands across the back (what you see of it from behind the
     horse), an M of stripes on the forehead, white muzzle, bib and socks, a ringed tail */
  cat:{kind:'quad',h:.46,len:.42,w:.24,piv:.27,K:.04,
   body:mirror([[0,.26,.09,.11,1,1,1,'#8b857e'],[0,.27,-.11,.115,1,1,1,'#8b857e'],[0,.33,.15,.07,1,1,1,'#8b857e'],
    [0,.37,-.03,.115,1,.45,1.7,'#5f5953',1],[0,.36,.08,.13,1.1,.7,.3,'#4d4640',1],[0,.375,-.05,.135,1.1,.7,.3,'#4d4640',1],[0,.365,-.17,.13,1.1,.7,.3,'#4d4640',1],
    [0,.23,.15,.075,1,1.1,.9,'#f4f1ec',1],[0,.19,0,.09,.9,.5,1.8,'#e6e1d9',1]]),
   head:{at:[0,.37,.22],prims:mirror([[0,0,0,.12,1.12,.98,.95,'#8b857e'],[.03,-.042,.09,.032,1,1,1,'#f4f1ec'],[0,-.07,.08,.026,1,1,1,'#f4f1ec'],
    [0,.112,.035,.03,.42,1,1.8,'#57514b',1],[.045,.106,.028,.027,.4,1,1.5,'#57514b',1]])},
   eyes:{r:.031,yaw:.46,pitch:.12,o:[0,.01,0],iris:'#8fc24f',pupil:'slit'},
   nose:{o:[0,-.02,.08],d:[0,.2,1],s:[.016,.012,.012],c:'#e98a9c',rough:.5},
   whiskers:{at:[0,-.045,.1],c:'#ffffff'},
   ears:{type:'cone',yaw:.72,pitch:.88,w:.047,len:.09,d:.024,c:'#8b857e',inner:'#e98a9c',tip:'#5f5953',rz:.16},
   legs:{hipY:.21,x:.065,zF:.10,zH:-.12,ru:.029,rl:.025,cu:'#8b857e',cl:'#8b857e',paw:{sx:.032,sy:.022,sz:.045,c:'#f4f1ec'}},
   tail:{at:[0,.33,-.21],rest:1.25,segs:[[.09,.021,'#8b857e',1,1,.12],[.09,.02,'#5f5953',1,1,.14],[.09,.02,'#8b857e',1,1,.5],[.08,.019,'#57514b',1,1,.6]],wagHz:.9,wag:.18},
   shadow:[.17,.34],idles:[['sit',3],['groom',2],['bow',1],['look',1],['tilt',1],['lie',1]]},
  bunny:{kind:'bunny',h:.38,len:.40,w:.3,piv:.18,K:.045,
   body:mirror([[0,.17,-.06,.16,1,.95,1.05,'#f4ecdd'],[.08,.13,-.06,.10,1,1,1,'#f4ecdd'],[0,.20,.09,.11,1,1,1,'#f4ecdd'],[0,.16,.15,.09,1,1,.8,'#fffaf2',1]]),
   head:{at:[0,.30,.15],pivot:[0,-.04,-.03],prims:mirror([[0,0,0,.11,1,1,1,'#f4ecdd'],[.06,-.03,.05,.06,1,1,1,'#f8f1e6'],[0,-.01,.10,.022,1,1,1,'#f4ecdd']])},
   eyes:{r:.028,yaw:.72,pitch:.16,o:[0,.01,0]},
   nose:{o:[0,-.01,.09],d:[0,.1,1],s:[.014,.011,.01],c:'#e8899b',rough:.5},
   blush:{c:'#f29aa8',yaw:.9,pitch:-.15,s:.02},
   ears:{type:'long',yaw:.3,pitch:1.25,w:.045,len:.13,d:.022,c:'#f1e8d8',inner:'#f3b3bf',rz:.14},
   legs:{hipY:.1,x:.07,zF:.11,zH:-.05,foot:{sx:.042,sy:.03,sz:.092},front:{r:.02,len:.07,paw:[.026,.019,.034]},c:'#f4ecdd'},
   tail:{puff:{at:[0,.23,-.21],r:.055,c:'#ffffff'}},
   shadow:[.2,.3],idles:[['periscope',3],['nose',3],['groom',2],['look',1],['binky',1]]},
  corgi:{kind:'quad',h:.47,len:.60,w:.3,piv:.23,K:.045,cadence:1.55,
   body:mirror([[0,.22,.16,.12,1,1,1,'#d98a33'],[0,.23,0,.12,1,.95,1.3,'#d98a33'],[0,.23,-.17,.12,1,1,1,'#d98a33'],[.045,.24,-.27,.06,1,1,1,'#fbf1e0'],[0,.30,.24,.075,1,1,1,'#d98a33'],
    [0,.19,.21,.10,1,1.1,.9,'#fbf1e0',1],[0,.13,0,.10,1,.5,2.2,'#fbf1e0',1]]),
   head:{at:[0,.385,.31],prims:mirror([[0,0,0,.12,1.05,.95,1,'#d98a33'],[0,-.045,.1,.055,1.05,.8,1.2,'#d98a33'],
    [0,.035,.095,.026,1,2.6,.7,'#fbf1e0',1],[0,-.06,.1,.072,1.1,.75,1.2,'#fbf1e0',1]])},
   eyes:{r:.028,yaw:.44,pitch:.14,o:[0,.01,0]},
   nose:{o:[0,-.04,.1],d:[0,.12,1],s:[.024,.018,.02],c:'#1f1510',rough:.42},
   tongue:{at:[0,-.085,.14],s:[.02,.005,.03],c:'#ee7f8f',always:true},
   ears:{type:'cone',yaw:.55,pitch:.85,w:.08,len:.16,d:.03,c:'#d98a33',inner:'#f3cdb4',tip:'#c07528',rz:.28,round:true},   // the big rounded bat ears that make a corgi
   legs:{hipY:.15,x:.075,zF:.15,zH:-.16,fu:.48,ru:.036,rl:.032,cu:'#d98a33',cl:'#fbf1e0',paw:{sx:.04,sy:.025,sz:.05,c:'#fbf1e0'}},
   shadow:[.2,.5],idles:[['bow',2],['lie',2],['spin',2],['sit',1],['tilt',1]]},
  /* a mallard duckling: bright yellow, with an olive cap and back and a dark stripe through the eye — the
     paint prims reach well outside the surface so the markings actually cover the top of the bird */
  duck:{kind:'bird',walk:'waddle',h:.45,len:.36,w:.28,piv:.21,K:.04,grow:1.1,lift:.8,   // grow: a touch larger, so the duckling reads from the saddle as well as the chick does
   body:[[0,.20,0,.15,.95,.9,1.2,'#ffb82e'],[0,.24,-.17,.05,1,.6,1.2,'#5e4f1e'],[0,.31,.08,.07,1,1,1,'#ffb82e'],[0,.305,-.045,.13,.95,.5,1.35,'#5e4f1e',1],[0,.1,.04,.13,1,.6,1.2,'#ffe487',1]],
   head:{at:[0,.37,.11],pivot:[0,-.05,-.03],prims:[[0,0,0,.10,1,1,1,'#ffb82e'],[0,.07,-.015,.10,1.1,.6,1.12,'#5e4f1e',1],[0,.014,.03,.106,1.3,.2,.72,'#3a3012',1]]},
   eyes:{r:.025,yaw:.62,pitch:.12,o:[0,.01,0]},
   bill:{c:'#f19a3a'},
   legs:{hipY:.09,x:.05,z:.01,r:.016,foot:'web',c:'#f19a3a'},
   wings:{round:true,arm:.15,hand:.17,chord:.12,top:'#8f7b3a',under:'#ffcc3a',tip:'#6d5c24',folded:[.03,.058,.085],foldAt:[.118,.25,-.04],foldC:'#8f7b3a',at:[.12,.25,.0],hz:6.5,climbHz:8,amp:.8,glide:'descend',pitchFly:.12,omega:3.8,stagger:.14,boxX:3.4,skim:7},
   shadow:[.2,.3],swim:{sink:.08},idles:[['preen',2],['flap',2],['peep',2],['settle',1],['look',1]]},
  chick:{kind:'bird',walk:'scurry',h:.43,len:.34,w:.34,piv:.21,K:.05,grow:1.13,lift:.65,
   body:[[0,.21,0,.15,1,1,1,'#ffb414'],[0,.27,.03,.115,1,1,1,'#ffb414'],[0,.15,.07,.13,1,.9,.9,'#ffe06a',1]],
   head:{at:[0,.27,.03],prims:null},
   eyes:{r:.029,yaw:.4,pitch:.2,o:[0,.0,0]},
   beak:{c:'#f08a24'},tuft:{c:'#ffb400'},
   blush:{c:'#ff9a7a',yaw:.72,pitch:-.05,s:.022},
   legs:{hipY:.08,x:.045,z:.02,r:.011,foot:'toes',c:'#f08a24'},
   wings:{round:true,arm:.11,hand:.12,chord:.1,top:'#ffb400',under:'#ffe06a',tip:'#f5a800',folded:[.035,.065,.085],foldAt:[.138,.215,-.01],foldC:'#ffb400',at:[.13,.22,0],hz:10,climbHz:12,amp:1.1,glide:'never',pitchFly:.25,omega:4.5,stagger:.2,boxX:3.2,skim:7},
   shadow:[.2,.22],swim:{sink:.1},idles:[['peck',3],['flap',1],['fluff',1],['tilt',1],['look',1]]},
  piglet:{kind:'quad',h:.44,len:.48,w:.3,piv:.25,K:.045,
   body:mirror([[0,.25,0,.16,.95,.9,1.45,'#f4aab4'],[0,.24,-.17,.12,1,1,1,'#f4aab4'],[0,.17,.02,.13,1,.6,1.6,'#f9c9cf',1]]),
   head:{at:[0,.30,.24],pivot:[0,-.02,-.06],prims:mirror([[0,0,0,.13,1,.95,.95,'#f4aab4'],[.07,-.05,.04,.06,1,1,1,'#f4aab4']])},
   eyes:{r:.025,yaw:.42,pitch:.3,o:[0,.01,0]},
   snout:{c:'#ec8e9c',holes:'#9c4a57'},
   blush:{c:'#ef7f92',yaw:.78,pitch:-.12,s:.024},
   ears:{type:'cone',yaw:.62,pitch:.78,w:.055,len:.085,d:.02,c:'#f0a1ab',inner:'#e7919c',rx:.7,rz:.3},
   legs:{hipY:.15,x:.075,zF:.13,zH:-.14,ru:.036,rl:.031,cu:'#f4aab4',cl:'#f4aab4',paw:{sx:.03,sy:.022,sz:.04,c:'#9c6b6b'}},
   tail:{curl:{at:[0,.31,-.285],c:'#f0a1ab'}},
   shadow:[.22,.42],idles:[['snuffle',3],['tailspin',2],['sit',1],['lie',1],['look',1]]},
  goat:{kind:'quad',h:.68,len:.52,w:.27,piv:.42,K:.042,
   body:mirror([[0,.42,.12,.125,1,1,1,'#c49f76'],[0,.43,-.12,.12,1,1,1,'#c49f76'],[0,.42,0,.115,1,.95,1.2,'#c49f76'],[0,.52,.19,.07,1,1.2,1,'#c49f76'],
    [0,.45,-.215,.078,1,1,.6,'#f4ede0',1],[0,.31,0,.1,1,.5,1.8,'#efe4d0',1]]),
   /* a playful kid: round bright eyes, cream stripes from above each eye down to the muzzle, small
      drooping ears, a soft tuft of beard and pale horns tall enough to see from the saddle */
   head:{at:[0,.6,.28],prims:mirror([[0,0,0,.108,.95,1,1,'#c49f76'],[0,-.055,.115,.054,.85,.75,1.6,'#c49f76'],
    [.034,.05,.075,.028,1,1.3,2,'#f4ede0',1],[.028,-.01,.112,.026,1,1.3,2,'#f4ede0',1],[0,-.075,.14,.056,1,.7,1.4,'#f4ede0',1]])},
   eyes:{r:.03,yaw:.5,pitch:.16,o:[0,.01,0]},
   nose:{o:[0,-.05,.1],d:[0,.1,1],s:[.016,.012,.012],c:'#7a5d4a',rough:.5},
   horns:{c:'#e0cfae',h:.14,tilt:.4},beard:{c:'#ebe0cc',tuft:[.018,.034,.018]},
   ears:{type:'side',yaw:1.3,pitch:.35,w:.032,len:.06,d:.018,c:'#b89168',inner:'#e8c9b0',rz:.5},
   legs:{hipY:.37,x:.072,zF:.12,zH:-.12,ru:.037,rl:.03,cu:'#c49f76',cl:'#f4ede0',knee:{r:.034,c:'#c49f76'},paw:{sx:.03,sy:.022,sz:.04,c:'#4a3b30'}},
   tail:{at:[0,.5,-.23],rest:1.1,segs:[[.07,.028,'#c49f76',1,1,0]],wagHz:6,wag:.35},
   shadow:[.2,.42],idles:[['pronk',2],['graze',2],['butt',1],['bleat',1],['look',1]]},
  raccoon:{kind:'quad',h:.44,len:.48,w:.28,piv:.29,K:.045,
   body:mirror([[0,.27,.12,.11,1,1,1,'#8e8a86'],[0,.33,-.08,.14,1,1,1,'#8e8a86'],[0,.30,-.18,.11,1,1,1,'#8e8a86'],[0,.33,.19,.07,1,1,1,'#8e8a86'],[0,.22,.02,.12,1,.55,1.8,'#b8b3ab',1]]),
   head:{at:[0,.33,.25],prims:mirror([[0,0,0,.11,1.1,.95,1,'#8e8a86'],[0,-.03,.10,.04,1,.8,1.5,'#eeeeea'],
    [0,.012,.06,.105,1.2,.5,.65,'#2c2b2e',1],[0,.07,.07,.075,1.1,.25,.6,'#eeeeea',1],[0,-.045,.09,.06,1,.6,1.2,'#eeeeea',1],[.075,-.04,.05,.045,1,1,1,'#eeeeea',1]])},
   eyes:{r:.027,yaw:.46,pitch:.14,o:[0,.012,0],ring:'#efe2d2'},
   nose:{o:[0,-.03,.1],d:[0,.1,1],s:[.02,.015,.016],c:'#1f2126',rough:.42},
   ears:{type:'round',yaw:.62,pitch:1.0,w:.04,d:.02,c:'#6f6b68',inner:'#3a383b',rim:'#eeeeea'},   // grey ears with a white rim, not cotton balls
   legs:{hipY:.21,hipYH:.26,x:.075,zF:.12,zH:-.12,ru:.031,rl:.027,cu:'#8e8a86',cl:'#2e2c2e',paw:{sx:.034,sy:.022,sz:.045,c:'#2e2c2e'}},
   tail:{at:[0,.33,-.26],rest:-.18,K:.035,fused:[[0,0,-.05,.042,1,1,1.4,'#8e8a86'],[0,-.004,-.15,.056,1,1,1.5,'#8e8a86'],[0,-.008,-.26,.054,1,1,1.4,'#8e8a86'],[0,-.01,-.35,.042,1,1,1.1,'#8e8a86'],
    [0,0,-.085,.09,1,1,.35,'#34323a',1],[0,-.003,-.165,.09,1,1,.35,'#34323a',1],[0,-.006,-.245,.09,1,1,.35,'#34323a',1],[0,-.009,-.325,.085,1,1,.35,'#34323a',1],[0,-.01,-.395,.07,1,1,.5,'#2c2b2e',1]],wagHz:.8,wag:.25},
   shadow:[.21,.42],idles:[['wash',3],['look',2],['sniff',2],['sit',1]]},
  fennec:{kind:'quad',h:.40,len:.38,w:.22,piv:.22,K:.038,cadence:1.25,
   body:mirror([[0,.22,.08,.09,1,1,1,'#eac68e'],[0,.23,-.09,.095,1,1,1,'#eac68e'],[0,.29,.13,.06,1,1,1,'#eac68e'],[0,.18,.03,.08,1,.6,1.6,'#fbf3e2',1]]),
   head:{at:[0,.33,.19],prims:mirror([[0,0,0,.09,1.05,.95,1,'#eac68e'],[0,-.025,.08,.035,.9,.8,1.5,'#fbf3e2'],[0,-.035,.06,.05,1.1,.7,1.3,'#fbf3e2',1]])},
   eyes:{r:.033,yaw:.44,pitch:.14,o:[0,.005,0]},
   nose:{o:[0,-.025,.08],d:[0,.05,1],s:[.014,.011,.011],c:'#2b1d16',rough:.42},
   ears:{type:'cone',yaw:.5,pitch:.72,w:.072,len:.2,d:.03,c:'#e3bd82',inner:'#f6d7c0',tip:'#c89a5e',rz:.38},
   legs:{hipY:.17,x:.055,zF:.08,zH:-.10,ru:.023,rl:.02,cu:'#eac68e',cl:'#eac68e',paw:{sx:.026,sy:.018,sz:.036,c:'#e3bd82'}},
   tail:{at:[0,.26,-.16],rest:.05,K:.035,fused:[[0,0,-.04,.032,1,1,1.4,'#eac68e'],[0,-.006,-.13,.05,1,.95,1.45,'#eac68e'],[0,-.012,-.23,.048,1,.95,1.3,'#eac68e'],[0,-.015,-.31,.034,1,.95,1.1,'#3a2a1e'],
    [0,-.015,-.31,.055,1.1,1.1,1.0,'#3a2a1e',1]],wagHz:1.2,wag:.25},
   shadow:[.16,.32],idles:[['listen',3],['pounce',2],['spin',2],['sit',1]]},
  snowhare:{kind:'bunny',h:.42,len:.50,w:.3,piv:.2,K:.045,
   body:mirror([[0,.18,-.07,.16,1,1,1.12,'#f6f9ff'],[.08,.16,-.08,.09,.8,1.2,1.2,'#f6f9ff'],[0,.22,.10,.105,1,1.05,1.05,'#f6f9ff'],[0,.14,.05,.12,1,.55,1.6,'#d8e0ee',1]]),
   head:{at:[0,.33,.18],pivot:[0,-.04,-.03],prims:mirror([[0,0,0,.105,1,1,1.08,'#f6f9ff'],[.055,-.03,.05,.055,1,1,1,'#f6f9ff'],[0,-.012,.105,.022,1,1,1,'#f6f9ff']])},
   eyes:{r:.027,yaw:.74,pitch:.16,o:[0,.01,0],iris:'#a8743e'},
   nose:{o:[0,-.012,.1],d:[0,.1,1],s:[.013,.01,.01],c:'#c99aa6',rough:.5},
   ears:{type:'long',yaw:.28,pitch:1.25,w:.038,len:.155,d:.02,c:'#eef2fb',inner:'#dfe5f5',tip:'#2d3140',rz:.1},
   legs:{hipY:.11,x:.075,zF:.13,zH:-.07,foot:{sx:.045,sy:.03,sz:.11},front:{r:.021,len:.085,paw:[.027,.019,.036]},c:'#f6f9ff'},
   tail:{puff:{at:[0,.24,-.25],r:.05,c:'#ffffff'}},
   sparkle:{n:5,c:'#dff0ff',size:.045},
   shadow:[.2,.36],idles:[['periscope',3],['freeze',2],['groom',1],['binky',1],['look',1]]},
  owl:{kind:'bird',walk:'hop',h:.50,len:.26,w:.3,piv:.23,K:.05,
   body:[[0,.22,0,.12,1,1.3,.95,'#d6a86a'],[0,.12,-.01,.1,1,.8,1,'#d6a86a'],[0,.2,.055,.1,1,1.35,.8,'#fbf5ea',1]],
   head:{at:[0,.39,.02],pivot:[0,0,0],prims:[[0,0,0,.12,1.05,.95,.95,'#d6a86a']]},
   face:{rim:'#c89a5e',disc:'#fbf5ea'},
   eyes:{r:.036,at:[.042,.008,.106],glints:2},
   beak:{c:'#e9c8a8',owl:true},
   legs:{hipY:.075,x:.05,z:.03,r:.024,foot:'toes',c:'#fbf5ea',talon:'#6b6b6b'},
   /* folded, each wing is one soft buff shape along the flank (the flat open-wing shapes are only shown
      once they open); the tail is a short rounded fan tucked under the body line */
   wings:{arm:.24,hand:.31,chord:.2,top:'#d6a86a',under:'#fbf5ea',tip:'#b98a52',folded:[.05,.14,.16],foldAt:[.105,.24,-.03],foldC:'#d0a064',foldRx:-.25,at:[.11,.3,-.01],hz:3.2,climbHz:4.2,amp:.9,glide:'bursts',pitchFly:1.2,omega:3.2,stagger:.08,boxX:3.4,skim:3},
   tail:{fan:{at:[0,.15,-.085],c:'#c89a5e'}},
   shadow:[.2,.24],idles:[['swivel',3],['tilt',2],['fluff',1],['flap',1],['look',1]]},
  lamb:{kind:'quad',h:.6,len:.52,w:.32,piv:.34,K:.028,
   body:mirror([[0,.34,0,.135,1,.95,1.35,'#f7f2e6'],[0,.45,.14,.092,1,1,1,'#f7f2e6'],[0,.47,0,.098,1,1,1,'#f7f2e6'],[0,.45,-.14,.092,1,1,1,'#f7f2e6'],
    [.105,.39,.10,.088,1,1,1,'#f7f2e6'],[.105,.40,-.08,.092,1,1,1,'#f7f2e6'],[.095,.3,0,.09,1,1,1,'#f7f2e6'],[0,.38,-.22,.085,1,1,1,'#f7f2e6'],[0,.41,.21,.082,1,1,1,'#f7f2e6']]),
   head:{at:[0,.5,.28],prims:mirror([[0,0,0,.088,.95,1,1.05,'#7a6252'],[0,-.035,.088,.047,1,.8,1.3,'#7a6252'],[0,.078,-.01,.047,1,1,1,'#f7f2e6'],[.042,.066,0,.038,1,1,1,'#f7f2e6']]),K:.03},
   eyes:{r:.026,yaw:.6,pitch:.14,o:[0,.005,0],ring:'#efe2d2'},
   nose:{o:[0,-.04,.1],d:[0,.12,1],s:[.016,.011,.012],c:'#3a2a22',rough:.5},
   ears:{type:'side',yaw:1.35,pitch:.25,w:.034,len:.09,d:.02,c:'#7a6252',inner:'#e6a9a2',rz:.35},
   legs:{hipY:.26,x:.08,zF:.13,zH:-.13,ru:.032,rl:.028,cu:'#7a6252',cl:'#7a6252',knee:{r:.034,c:'#7a6252'},paw:{sx:.032,sy:.022,sz:.04,c:'#3a2a22'}},
   tail:{puff:{at:[0,.41,-.31],r:.058,c:'#f7f2e6',wig:true}},
   shadow:[.23,.42],idles:[['boing',2],['graze',2],['bleat',1],['lie',1],['look',1]]},
  glimmerfox:(()=>{const s=Object.assign(foxSheet({fur:'#bfe9ff',white:'#ffffff',sock:'#7b7ff0',inner:'#ffffff',tip:'#7b7ff0',iris:'#4b63d8',nose:'#35477e',fur2:'#d8f4ff'},1.08),
   {glow:{c:'#8fe8ff',emissive:'#6fd8ff',ei:.32},sparkle:{n:12,c:'#aef4ff',size:.06,tail:true}});
   /* the brush ends in a bright white tip, lit from inside, so it separates from the pale blue coat */
   const m=v=>v*1.08;s.tail.fused[4]=[0,m(-.025),m(-.4),m(.095),1.1,1.1,1.15,'#ffffff',1];s.tail.tipGlow={at:[0,m(-.025),m(-.448)],s:[m(.05),m(.048),m(.058)],c:'#ffffff',ei:.9};return s;})(),
 };
 /* anything else a package adds to PETS3 later still gets an animal: a four-legged one in its colours */
 function genericSheet(cfg){const b=(cfg&&cfg.body)||'#caa06a',w=(cfg&&cfg.belly)||'#ede0c8';const s=JSON.parse(JSON.stringify(SPECIES.dog));
  s.body=s.body.map(p=>{if(p[7]==='#d9a45e')p[7]=b;else if(p[7]==='#f3e3c4')p[7]=w;return p;});s.head.prims=s.head.prims.map(p=>{if(p[7]==='#d9a45e')p[7]=b;else if(p[7]==='#f3e3c4')p[7]=w;return p;});
  s.ears.c=b;s.legs.cu=s.legs.cl=b;s.legs.paw.c=w;s.tail.segs.forEach(q=>q[2]=b);s.generic=true;return s;}

 /* ================================================================ building one pet ===========
    root (on the ground, yaw) -> bodyPivot (bob, pitch, roll, squash) -> body; a neck (head yaw and
    pitch) holding the head and its eyes, ears, nose; a tail chain; legs of hip, upper, knee, lower and
    paw; and for the birds two wings of shoulder, arm, wrist and hand that fold along the body. */
 function eye(hg,F,E,side,key){
  let p;
  if(E.at)p=[side*E.at[0],E.at[1],E.at[2]];
  else p=onSurf(F,E.o||[0,0,0],dirYP(side*E.yaw,E.pitch),E.r*0.35);
  const g=grp(hg,p[0],p[1],p[2]);g.rotation.order='YXZ';g.rotation.y=E.at?0:side*E.yaw*0.7;g.rotation.x=E.at?0:-E.pitch*0.6;
  const r=E.r,parts=[],gl=[];
  if(E.ring)parts.push(mesh(SPL,mat(E.ring),g,0,0,-r*0.2,r*1.34,r*1.42,r*0.42));
  parts.push(mesh(SPL,E.iris?mat(E.iris,0.22):EYE,g,0,0,0,r,r*1.1,r*0.55));
  if(E.iris){const pw=E.pupil==='slit'?[r*0.26,r*0.92]:E.pupil==='bar'?[r*0.7,r*0.3]:[r*0.52,r*0.56];parts.push(mesh(SPL,EYE,g,0,0,r*0.36,pw[0],pw[1],r*0.2));}
  gl.push(mesh(SPL,GLINT,g,-r*0.34,r*0.36,r*0.46,r*0.3,r*0.32,r*0.12));
  if(E.glints!==1)gl.push(mesh(SPL,GLINT,g,r*0.3,-r*0.32,r*0.47,r*0.13,r*0.14,r*0.08));
  bake(key+'-eye',g,parts,EYEM);bake(key+'-glint',g,gl,GLINT);   // the same in both eyes: the group itself is mirrored
  return g;
 }
 function ear(hg,F,E,side,key){
  const p=onSurf(F,E.o||[0,0,0],dirYP(side*E.yaw,E.pitch),0.012);
  const h=grp(hg,p[0],p[1],p[2]);h.rotation.order='ZXY';h.rotation.set(E.rx||0,side*(E.ry||0),-side*(E.rz||0));
  h.userData.rest=[h.rotation.x,h.rotation.y,h.rotation.z];h.userData.side=side;h.userData.hang=E.type==='flop';
  const c=mat(E.c),parts=[];
  if(E.type==='cone'){
   parts.push(mesh(CONE,c,h,0,0,0,E.w,E.len,E.d));
   if(E.inner)parts.push(mesh(CONE,mat(E.inner),h,0,E.len*0.04,E.d*0.42,E.w*0.62,E.len*0.76,E.d*0.4));
   if(E.tip)parts.push(mesh(CONE,mat(E.tip),h,0,E.len*0.6,0,E.w*0.42,E.len*0.41,E.d*1.06));
   if(E.round)parts.push(mesh(SPL,c,h,0,E.len*0.7,0,E.w*0.32,E.w*0.3,E.d*0.8));   // rounds the tip off (a corgi's ear is a rounded triangle)
  }else if(E.type==='flop'){
   parts.push(mesh(SPH,c,h,side*E.w*0.35,-E.len*0.72,0,E.w,E.len,E.d));
  }else if(E.type==='long'){
   parts.push(mesh(SPH,c,h,0,E.len*0.92,0,E.w,E.len,E.d));
   if(E.inner)parts.push(mesh(SPH,mat(E.inner),h,0,E.len*0.92,E.d*0.5,E.w*0.55,E.len*0.8,E.d*0.5));
   if(E.tip)parts.push(mesh(SPH,mat(E.tip),h,0,E.len*1.62,0,E.w*1.03,E.len*0.3,E.d*1.08));
  }else if(E.type==='side'){
   parts.push(mesh(SPH,c,h,side*E.len*0.85,0,0,E.len,E.w,E.d));
   if(E.inner)parts.push(mesh(SPH,mat(E.inner),h,side*E.len*0.9,0,E.d*0.5,E.len*0.72,E.w*0.6,E.d*0.5));
  }else if(E.type==='round'){
   if(E.rim){parts.push(mesh(SPH,c,h,0,E.w*0.65,-E.d*0.25,E.w,E.w*1.05,E.d));parts.push(mesh(SPH,mat(E.rim),h,0,E.w*0.68,0,E.w*1.12,E.w*1.16,E.d*0.5));parts.push(mesh(SPH,c,h,0,E.w*0.62,E.d*0.2,E.w*0.92,E.w*0.96,E.d*0.72));}   // grey back, a white rim round the edge, grey front
   else parts.push(mesh(SPH,c,h,0,E.w*0.65,0,E.w,E.w*1.05,E.d));
   if(E.inner)parts.push(mesh(SPL,mat(E.inner),h,0,E.w*0.62,E.d*0.55,E.w*0.6,E.w*0.62,E.d*0.5));
  }
  bake(key+'-ear'+(E.type==='flop'||E.type==='side'?side:''),h,parts,ACC);
  return h;
 }
 function quadLeg(bp,S,L,i,key){
  const front=i<2, side=i%2?-1:1, hipY=front?L.hipY:(L.hipYH||L.hipY);
  const hip=grp(bp,side*L.x,hipY-S.piv,front?L.zF:L.zH);
  const Lt=hipY-L.paw.sy*1.3, Lu=Lt*(L.fu||0.52), Lr=Lt-Lu;
  mesh(capG(L.ru,Lu),mat(L.cu),hip,0,0,0);
  const knee=grp(hip,0,-Lu,0);
  const kp=[];
  if(L.knee)kp.push(mesh(SPL,mat(L.knee.c),knee,0,0,0,L.knee.r*0.95,L.knee.r,L.knee.r));
  kp.push(mesh(capG(L.rl,Lr),mat(L.cl),knee,0,0,0));
  if(kp.length>1)bake(key+'-shin'+(front?'f':'h'),knee,kp,ACC);
  const paw=grp(knee,0,-Lr,0);mesh(SPL,mat(L.paw.c),paw,0,-L.paw.sy*0.3,L.paw.sz*0.3,L.paw.sx,L.paw.sy,L.paw.sz);
  return {hip,knee,paw,front,side,Lu,Lr,Lt,hipY,z:front?L.zF:L.zH,foot:false,bottom:L.paw.sy*1.3};
 }
 function bunnyLegs(bp,S,L){
  const out=[];
  for(const i of [0,1]){const side=i?-1:1;const hip=grp(bp,side*L.x*0.7,L.front.len+L.front.paw[1]-S.piv,L.zF);
   mesh(capG(L.front.r,L.front.len),mat(L.c),hip,0,0,0);
   const knee=grp(hip,0,-L.front.len,0),paw=grp(knee,0,0,0);mesh(SPL,mat(L.c),paw,0,-0.004,L.front.paw[2]*0.4,L.front.paw[0],L.front.paw[1],L.front.paw[2]);
   out.push({hip,knee,paw,front:true,side,Lu:L.front.len,Lr:0,bottom:L.front.paw[1]+0.004});}
  for(const i of [0,1]){const side=i?-1:1;const hip=grp(bp,side*L.x,L.hipY-S.piv,L.zH);
   const knee=grp(hip,0,-(L.hipY-L.foot.sy),0),paw=grp(knee,0,0,0);
   mesh(SPH,mat(L.c),paw,0,0,L.foot.sz*0.35,L.foot.sx,L.foot.sy,L.foot.sz);
   out.push({hip,knee,paw,front:false,side,Lu:L.hipY,Lr:0,foot:true,bottom:L.foot.sy});}
  return out;
 }
 function birdLegs(bp,S,L){
  const out=[];
  for(const i of [0,1]){const side=i?-1:1;const hip=grp(bp,side*L.x,L.hipY-S.piv,L.z);
   const len=L.hipY-0.012;mesh(capG(L.r,len),mat(L.c),hip,0,0,0);
   const knee=grp(hip,0,-len,0),paw=grp(knee,0,0,0);
   if(L.foot==='web')mesh(webFoot(),mat2(L.c),paw,0,-0.004,0);
   else mesh(toeFoot(L.r*3.4),mat(L.talon||L.c),paw,0,0.002,0.004);
   out.push({hip,knee,paw,front:i===0,side,Lu:len,Lr:0,bottom:0.006});}
  return out;
 }
 /* A wing: shoulder (flap) -> fold -> roll -> the arm, and a wrist holding the hand. The owl's are thick
    bevelled feather shapes with a rounded leading edge; the duckling's and the chick's are two soft rounded
    shapes, the stubby wings of a baby bird. Folded, each bird shows instead one soft shape lying along its
    flank (the 'nub'), which the open wing grows out of as it takes off. */
 function wing(bp,S,key,side){
  const Wg=S.wings;
  const flap=grp(bp,side*Wg.at[0],Wg.at[1]-S.piv,Wg.at[2]);flap.rotation.order='XYZ';
  const fold=grp(flap),roll=grp(fold);
  let arm,hand,wrist;
  if(Wg.round){
   arm=mesh(SPH,mat(Wg.top),roll,side*Wg.arm*0.5,0,0,Wg.arm*0.56,0.024,Wg.chord*0.5);
   wrist=grp(roll,side*Wg.arm*0.94,0,0);wrist.rotation.order='YXZ';
   hand=mesh(SPH,mat(Wg.tip||Wg.top),wrist,side*Wg.hand*0.46,0,-Wg.chord*0.1,Wg.hand*0.56,0.018,Wg.chord*0.42);
  }else{
   const G2=wingGeos(key,Wg);
   arm=mesh(G2.arm,WINGM,roll,0,0,0,side,1,1);
   mesh(geo('spar-'+key,()=>{const g=new THREE.CapsuleGeometry(0.017,Wg.arm*0.86,3,8);g.rotateZ(Math.PI/2);g.translate(Wg.arm*0.47,-0.008,0);return g;}),mat(Wg.top),roll,0,0,Wg.chord*0.43,side,1,1);   // the rounded leading edge
   wrist=grp(roll,side*Wg.arm*0.97,0,0);wrist.rotation.order='YXZ';
   hand=mesh(G2.hand,WINGM,wrist,0,0,0,side,1,1);
  }
  let nub=null;
  if(Wg.folded){const F=Wg.folded,A=Wg.foldAt;nub=grp(bp,side*A[0],A[1]+F[1]*0.75-S.piv,A[2]);nub.rotation.order='XYZ';   // pivots at its top, so it can flutter like a little wing
   const m=mesh(SPH,mat(Wg.foldC||Wg.top),nub,0,-F[1]*0.75,0,F[0],F[1],F[2]);m.rotation.x=Wg.foldRx||-0.15;}
  return {flap,fold,roll,wrist,side,arm,hand,nub};
 }
 /* the handful of points that must stay above the ground whatever the pose: the paws, the underside of
    the body and of the head, the tail's tip */
 function lowPoints(P,S){
  const out=[],pts=(g,o,bins,axis)=>{const pa=g.attributes.position;g.computeBoundingBox();const bb=g.boundingBox,n=bins||4,best=new Array(n).fill(null);
   for(let i=0;i<pa.count;i++){const z=pa.getZ(i),y=pa.getY(i),b=Math.min(n-1,Math.floor((z-bb.min.z)/Math.max(1e-6,bb.max.z-bb.min.z)*n));if(!best[b]||y<best[b].y)best[b]=new THREE.Vector3(pa.getX(i),y,z);}
   for(const v of best)if(v)out.push({o,p:v,tail:!!axis});};
  pts(P.body.geometry,P.body,9);
  const hm=P.headGroup.children.find(o=>o.isMesh&&o.geometry.attributes.position.count>500);if(hm)pts(hm.geometry,hm,3);
  for(const L of P.legRig){const b=L.bottom||0,pz=S.legs.paw?S.legs.paw.sz:(S.legs.foot?S.legs.foot.sz:0.03);out.push({o:L.paw,p:new THREE.Vector3(0,-b,0),paw:true},{o:L.paw,p:new THREE.Vector3(0,-b*0.8,pz*1.1),paw:true},{o:L.paw,p:new THREE.Vector3(0,-b*0.8,-pz*0.5),paw:true});}   // the pad, the toes and the heel
  const T=S.tail;
  if(T&&T.fused){const tm=P.tail.children.find(o=>o.isMesh&&o.geometry.attributes.position.count>200);if(tm){const pa=tm.geometry.attributes.position;let tip=null,low=null;for(let i=0;i<pa.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pa,i);if(!tip||v.z<tip.z)tip=v;if(!low||v.y<low.y)low=v;}out.push({o:tm,p:tip,tail:true},{o:tm,p:low,tail:true});}}
  else if(T&&T.segs){const ch=P.tailChain;for(let i=0;i<ch.length;i++){const s=T.segs[i];if(s)out.push({o:ch[i],p:new THREE.Vector3(0,-s[1],-s[0]),tail:true});}}
  else if(P.tail&&P.tail.children.length){out.push({o:P.tail,p:new THREE.Vector3(0,-(T&&T.puff?T.puff.r*0.95:0.02),T&&T.fan?-0.11:0),tail:true});}
  return out;
 }
 function make(key,cfg){
  const S=SPECIES[key]||genericSheet(cfg);
  const tag=key+(S.generic?':'+(cfg&&cfg.body):'');
  const root=new THREE.Group();root.name='pet-'+key;root.rotation.order='YXZ';
  const bp=grp(root,0,S.piv,0);bp.name='pet-body';
  const F=fused('b:'+tag,S.body,S.K,14);   // a fine mesh for the body (2252 points): its outline is what you see from the saddle
  let bodyMat=BODY;
  if(S.glow){const gk='glowmat'+key;bodyMat=GEO[gk]||(GEO[gk]=(()=>{const m=BODY.clone();m.emissive=new THREE.Color(S.glow.emissive);m.emissiveIntensity=S.glow.ei;return rimify(m,'g');})());}
  else if(S.lift){const gk='liftmat'+key;bodyMat=GEO[gk]||(GEO[gk]=rimify(BODY.clone(),'l',S.lift));}
  const body=mesh(F.geo,bodyMat,bp,0,-S.piv,0);body.castShadow=true;body.receiveShadow=true;body.name='pet-body-mesh';
  const hc=S.head.at, pv=S.head.pivot||[0,-0.03,-0.05];
  const neck=grp(bp,hc[0]+pv[0],hc[1]+pv[1]-S.piv,hc[2]+pv[2]);neck.rotation.order='YXZ';neck.name='pet-neck';
  const hg=grp(neck,-pv[0],-pv[1],-pv[2]);
  let HF;
  if(S.head.prims){HF=fused('h:'+tag,S.head.prims,S.head.K||S.K,10);const hm=mesh(HF.geo,bodyMat,hg,0,0,0);hm.castShadow=true;hm.receiveShadow=true;}
  else HF={sd:(x,y,z)=>F.sd(x+hc[0],y+hc[1],z+hc[2])};
  const P={group:root,bodyPivot:bp,body,head:neck,headGroup:hg,spec:S,key,eyes:[],ears:[],legs:[],legRig:[],tail:null,tailChain:[],wings:[],extra:{}};
  const acc=[];   // the head's small fixed parts, merged into one mesh at the end
  /* face */
  if(S.face){acc.push(mesh(heart(.215,.205,.008,.01),mat(S.face.rim),hg,0,-.004,.083,1,1,1),mesh(heart(.19,.18,.01,.012),mat(S.face.disc,.8),hg,0,-.002,.095),mesh(SPL,mat('#efe2cc'),hg,0,.02,.105,.008,.05,.006));}
  for(const side of [1,-1])P.eyes.push(eye(hg,HF,S.eyes,side,tag));
  if(S.nose){const p=onSurf(HF,S.nose.o,S.nose.d,S.nose.s[2]*0.45);P.extra.nose=mesh(SPL,mat(S.nose.c,S.nose.rough),hg,p[0],p[1],p[2],S.nose.s[0],S.nose.s[1],S.nose.s[2]);}
  if(S.tongue){const T=S.tongue;const tg=grp(hg,T.at[0],T.at[1],T.at[2]);mesh(SPL,mat(T.c,.5),tg,0,-T.s[1],T.s[2]*0.3,T.s[0],T.s[1],T.s[2]);tg.scale.y=T.always?1:0.001;tg.visible=!!T.always;P.extra.tongue=tg;}
  if(S.blush)for(const side of [1,-1]){const p=onSurf(HF,[0,0,0],dirYP(side*S.blush.yaw,S.blush.pitch),0.002);const b=mesh(SPL,mat(S.blush.c,.9),hg,p[0],p[1],p[2],S.blush.s,S.blush.s*0.62,S.blush.s*0.3);b.rotation.y=side*S.blush.yaw;acc.push(b);}
  if(S.ears)for(const side of [1,-1])P.ears.push(ear(hg,HF,S.ears,side,tag));
  if(S.whiskers){const w=S.whiskers;const g=geo('whisk-'+key,()=>{const pts=[];for(const side of [1,-1])for(const [dy,ang] of [[.006,.12],[-.004,0],[-.014,-.14]]){pts.push(side*.03,w.at[1]+dy,w.at[2],side*.15,w.at[1]+dy+Math.sin(ang)*.07,w.at[2]-.035);}
    const b=new THREE.BufferGeometry();b.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));return b;});
   hg.add(new THREE.LineSegments(g,geo('whiskM',()=>new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.85,toneMapped:false}))));}
  if(S.snout){const p=onSurf(HF,[0,-.02,0],[0,-.1,1],0.012);const sn=grp(hg,p[0],p[1],p[2]);acc.push(mesh(DISC,mat(S.snout.c),sn,0,0,0.012,.056,.05,.034));
   for(const side of [1,-1])acc.push(mesh(SPL,mat(S.snout.holes),sn,side*.018,0,.03,.009,.013,.005));}
  if(S.bill){const b=grp(hg,0,-.022,.085);mesh(SPH,mat(S.bill.c,.6),b,0,0,.035,.046,.014,.062);const lo=grp(b,0,-.01,0);mesh(SPH,mat('#e8892e',.6),lo,0,-.004,.03,.04,.01,.055);P.extra.jaw=lo;}
  if(S.beak){if(S.beak.owl){const b=mesh(CONE,mat(S.beak.c,.5),hg,0,-.012,.105,.016,.042,.012);b.rotation.x=Math.PI*0.92;acc.push(b);}
   else{const b=mesh(CONE,mat(S.beak.c,.5),hg,0,-.005,HF.sd?onSurf(HF,[0,0,0],[0,-.05,1],.01)[2]:.11,.026,.052,.02);b.rotation.x=Math.PI/2;acc.push(b);}}
  if(S.tuft)for(const [a,l] of [[-0.35,.04],[0,.052],[0.35,.04]]){const p=onSurf(HF,[0,0,0],[Math.sin(a)*0.25,1,-.1],.006);const tf=mesh(CONE,mat(S.tuft.c),hg,p[0],p[1],p[2],.012,l,.012);tf.rotation.z=-a;tf.rotation.x=-0.25;acc.push(tf);}
  if(S.horns)for(const side of [1,-1]){const p=onSurf(HF,[0,0,0],dirYP(side*.33,1.05),.008);const h=mesh(CONE,mat(S.horns.c,.6),hg,p[0],p[1],p[2],.024,S.horns.h||.1,.022);h.rotation.set(-(S.horns.tilt!=null?S.horns.tilt:0.75),0,-side*0.15);acc.push(h);}
  if(S.beard){const p=onSurf(HF,[0,-.04,.08],[0,-1,.25],.004);const T=S.beard.tuft;
   acc.push(T?mesh(SPH,mat(S.beard.c),hg,p[0],p[1]-T[1]*0.8,p[2]-0.005,T[0],T[1],T[2]):(()=>{const b=mesh(CONE,mat(S.beard.c),hg,p[0],p[1],p[2],.02,.085,.016);b.rotation.x=Math.PI*0.94;return b;})());}
  bake(tag+'-acc',hg,acc,ACC);
  /* legs */
  const L=S.legs;
  if(S.kind==='quad')for(let i=0;i<4;i++)P.legRig.push(quadLeg(bp,S,L,i,tag));
  else if(S.kind==='bunny')P.legRig=bunnyLegs(bp,S,L);
  else P.legRig=birdLegs(bp,S,L);
  P.legs=P.legRig.map(l=>l.hip);
  for(const l of P.legRig)l.hip.userData.y0=l.hip.position.y;
  /* tail */
  const T=S.tail;
  if(T&&T.fused){const t=grp(bp,T.at[0],T.at[1]-S.piv,T.at[2]);t.rotation.order='YXZ';t.rotation.x=T.rest;
   const TF=fused('t:'+key,T.fused,T.K||0.035,11);const tm=mesh(TF.geo,bodyMat,t,0,0,0);tm.castShadow=true;tm.receiveShadow=true;P.tail=t;P.tailChain.push(t);
   if(T.tipGlow){const g=T.tipGlow;mesh(SPH,geo('tipglow-'+key,()=>{const m=new THREE.MeshStandardMaterial({color:g.c,emissive:g.c,emissiveIntensity:g.ei,roughness:0.7});return m;}),t,g.at[0],g.at[1],g.at[2],g.s[0],g.s[1],g.s[2]);}}
  else if(T&&T.segs){let parent=grp(bp,T.at[0],T.at[1]-S.piv,T.at[2]);parent.rotation.order='YXZ';parent.rotation.x=T.rest;P.tail=parent;P.tailChain.push(parent);
   T.segs.forEach((s,i)=>{mesh(SPH,mat(s[2]),parent,0,0,-s[0]/2,s[1]*(s[3]||1),s[1]*(s[4]||1),s[0]*0.55);
    if(i<T.segs.length-1){const nx=grp(parent,0,0,-s[0]*0.8);nx.rotation.order='YXZ';nx.rotation.x=s[5]||0;nx.userData.bend=s[5]||0;P.tailChain.push(nx);parent=nx;}});}
  else if(T&&T.puff){const t=grp(bp,T.puff.at[0],T.puff.at[1]-S.piv,T.puff.at[2]);ell(t,T.puff.c,0,0,0,T.puff.r,T.puff.r*0.95,T.puff.r*0.85);P.tail=t;P.tailChain.push(t);}
  else if(T&&T.curl){const t=grp(bp,T.curl.at[0],T.curl.at[1]-S.piv,T.curl.at[2]);t.rotation.order='YXZ';mesh(curlTail(),mat(T.curl.c),t,0,0,0);P.tail=t;P.tailChain.push(t);}
  else if(T&&T.fan){const t=grp(bp,T.fan.at[0],T.fan.at[1]-S.piv,T.fan.at[2]);t.rotation.order='YXZ';t.rotation.x=-0.8;ell(t,T.fan.c,0,0,-.03,.052,.022,.055);P.tail=t;P.tailChain.push(t);}   // a short rounded fan, tucked under the body line
  else{const t=grp(bp,0,S.piv*0.9-S.piv,-S.len*0.45);P.tail=t;P.tailChain.push(t);}
  /* wings */
  if(S.wings){for(const side of [1,-1])P.wings.push(wing(bp,S,key,side));}
  /* glow and sparkles: the glimmer fox is lit from inside, paired or not */
  if(S.glow){const sp=new THREE.Sprite(geo('halo-'+key,()=>new THREE.SpriteMaterial({map:glowTex(),color:S.glow.c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:0.32})));
   sp.scale.set(1.15,0.95,1);sp.position.set(0,S.piv+0.04,0);root.add(sp);P.extra.halo=sp;}
  if(S.sparkle){const n=S.sparkle.n,g=geo('spark-'+key,()=>{const b=new THREE.BufferGeometry();b.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));return b;});
   const pm=geo('sparkm-'+key,()=>new THREE.PointsMaterial({map:glowTex(),color:S.sparkle.c,size:S.sparkle.size,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,sizeAttenuation:true,opacity:0.95}));
   const pts=new THREE.Points(g,pm);pts.frustumCulled=false;root.add(pts);P.extra.sparks={pts,life:new Float32Array(n).map(()=>Math.random()),n};}
  if(S.build)try{S.build(P,root,KIT);}catch(e){console.warn('pet models: '+key+' extras ('+e.message+')');}   // a package's own parts and effects (pet-fantasy.js): on bodyPivot they hide with the drawn body, on root they stay with a real one
  P.shadow=contact(root,S.shadow[0]*(S.grow||1),S.shadow[1]*(S.grow||1));
  P.tailChain.forEach(t=>{t.userData.rest=[t.rotation.x,t.rotation.y,t.rotation.z];});
  P.auraY=S.piv;P.size=S.h;
  root.traverse(o=>{if(o.isMesh&&o!==P.shadow&&!o.name)o.name='pet-part';});
  P.low=lowPoints(P,S);
  const q=newPose();resetPose(q,S);apply(P,q,0);
  return P;
 }

 /* ================================================================ poses and gaits ===========
    Every frame a pose is worked out from scratch — the gait for the pet's kind and speed, then an idle
    laid over it — and applied to the rig. Each pet keeps one pose object and resets it in place. */
 function newPose(){return {by:0,bp:0,br:0,bsy:1,bsz:1,sc:1,hy:0,hp:0,hr:0,legs:[[0,0],[0,0],[0,0],[0,0]],lift:[0,0,0,0],flat:0,tailX:0,tailY:0,tailW:0,tailSpin:0,spin:0,
  earX:0,earZ:0,earY:[0,0],wOpen:0,wFlap:0,wHand:0,wHandFold:0,wBack:0,nubFlap:0,jaw:0,tongue:0,blink:1,nose:1,hopY:0,tip:0};}
 function resetPose(q){q.by=q.bp=q.br=0;q.bsy=q.bsz=q.sc=1;q.hy=q.hp=q.hr=0;for(let i=0;i<4;i++){q.legs[i][0]=0;q.legs[i][1]=0;q.lift[i]=0;}q.flat=0;
  q.tailX=q.tailY=q.tailW=q.tailSpin=q.spin=0;q.earX=q.earZ=0;q.earY[0]=q.earY[1]=0;q.wOpen=q.wFlap=q.wHand=q.wHandFold=q.wBack=q.nubFlap=0;q.jaw=q.tongue=0;q.blink=1;q.nose=1;q.hopY=0;q.tip=0;return q;}
 const setL=(q,i,a,b)=>{q.legs[i][0]=a;q.legs[i][1]=b;};
 const lerpL=(q,i,a,b,k)=>{q.legs[i][0]=lerp(q.legs[i][0],a,k);q.legs[i][1]=lerp(q.legs[i][1],b,k);};
 function apply(P,q,t){
  const S=P.spec,bp=P.bodyPivot;
  const gw=S.grow||1;   // grow: a slightly larger build of the same shapes (the chick, so the smallest pet still reads over the grass)
  bp.position.y=S.piv*gw+q.by;bp.rotation.set(q.bp,0,q.br);bp.scale.set(gw*q.sc,gw*q.sc*q.bsy,gw*q.sc*q.bsz);
  P.head.rotation.set(-q.hp,q.hy,q.hr);
  for(let i=0;i<P.legRig.length;i++){const L=P.legRig[i],v=q.legs[i];L.hip.rotation.x=v[0];L.knee.rotation.x=v[1];L.paw.rotation.x=-(v[0]+v[1])*(L.foot?0.9:q.flat?1:0.85);L.hip.position.y=L.hip.userData.y0+(q.lift[i]||0);}
  const ch=P.tailChain;
  for(let i=0;i<ch.length;i++){const tj=ch[i],r=tj.userData.rest||[0,0,0];
   if(S.tail&&S.tail.fused){tj.rotation.x=r[0]+q.tailX;tj.rotation.y=q.tailY;}
   else if(S.tail&&S.tail.segs){tj.rotation.x=r[0]+(i===0?q.tailX:q.tailX*0.25);tj.rotation.y=q.tailY*(i===0?1:0.7)+Math.sin(t*6-i*0.9)*q.tailW*(i?0.6:0);}
   else if(S.tail&&S.tail.curl){tj.rotation.z=q.tailSpin;}
   else if(S.tail&&S.tail.puff){tj.rotation.y=q.tailY*0.5;tj.position.y=(tj.userData.y0!=null?tj.userData.y0:(tj.userData.y0=tj.position.y))+Math.abs(q.tailY)*0.01;}
   else{tj.rotation.x=r[0]+q.tailX*0.4;tj.rotation.y=q.tailY*0.4;}}
  /* a hanging ear swings the other way from a pricked one: at speed a pricked ear lies back, and a floppy
     one streams back too instead of flipping forward over the face */
  for(let i=0;i<P.ears.length;i++){const e=P.ears[i],r=e.userData.rest,s=e.userData.side,ex=e.userData.hang?-q.earX*0.8:q.earX;e.rotation.set(r[0]+ex,r[1]+s*(q.earY[i]||0),r[2]-s*q.earZ);}
  for(const e of P.eyes)e.scale.y=q.blink;
  if(P.extra.nose)P.extra.nose.scale.y=S.nose.s[1]*q.nose;
  if(P.extra.jaw)P.extra.jaw.rotation.x=q.jaw;
  if(P.extra.tongue&&!S.tongue.always){P.extra.tongue.visible=q.tongue>0.02;P.extra.tongue.scale.y=Math.max(0.001,q.tongue);}
  for(const w of P.wings){
   const Wg=S.wings,s=w.side,o=q.wOpen,k=w.nub?sstep(0.02,0.3,o):1;
   /* folded: the arm swept back along the flank and stood on edge, the hand tucked back beside it; the
      soft folded shape (the nub) stands in for both until the wing opens; open: straight out, flapping */
   w.flap.rotation.set(-q.bp*o,0,s*(q.wFlap*o+(1-o)*(w.nub?-0.06:0.12)));
   w.fold.rotation.y=s*(1-o)*(w.nub?1.52:1.3)+s*q.wBack;
   w.roll.rotation.x=(1-o)*(w.nub?1.45:1.15);
   w.wrist.position.set(s*Wg.arm*(Wg.round?0.94:0.97)*lerp(0.06,1,o),0.012*(1-o),0);
   w.wrist.rotation.set(0,s*q.wHandFold*o,s*q.wHand*o);
   if(w.nub){w.flap.scale.setScalar(Math.max(0.001,k));w.flap.visible=k>0.01;const n=1-k;w.nub.scale.setScalar(Math.max(0.001,n));w.nub.visible=n>0.01;w.nub.rotation.z=s*q.nubFlap;}
   else w.flap.scale.setScalar(lerp(Wg.nub||0.4,1,o));
  }
 }
 /* The four-legged gaits. Each leg spends part of its stride on the ground (the duty: most of it at a
    walk, under a third of it at a gallop) and the rest swinging forward. A paw on the ground moves back at
    exactly the pet's speed — the stride rate is worked out from the speed and how far a leg can reach, so
    the paws do not skate — and the leg is bent to put it there (two-bone IK from hip to paw), so the
    paws stay on the ground instead of sinking into it as the body bobs. When a short-legged pet has to
    keep up with a galloping horse the rate tops out and it bounds instead: more of each stride in the air. */
 const GAIT_OFF={walk:[0.25,0.75,0,0.5],trot:[0,0.5,0.5,0],gallop:[0,0.06,0.5,0.56]};   // where each leg is in its stride: front left, front right, hind left, hind right
 function ik2(q,i,L,hy,hz,ty,tz){
  const dz=tz-hz,dy=ty-hy,Lu=L.Lu,Lr=L.Lr;let d=Math.hypot(dz,dy);const mx=Lu+Lr-1e-4,mn=Math.abs(Lu-Lr)+1e-3;if(d>mx)d=mx;else if(d<mn)d=mn;
  const t2=Math.acos(clamp((d*d-Lu*Lu-Lr*Lr)/(2*Lu*Lr),-1,1)),phi=Math.atan2(-dz,-dy),beta=Math.atan2(Lr*Math.sin(t2),Lu+Lr*Math.cos(t2));
  q.legs[i][0]=phi-beta;q.legs[i][1]=t2;}
 function quadGait(q,st,S,P,spd,dt){
  const legs=P.legRig,gw=S.grow||1;
  const gT=sstep(1.3,2.2,spd),gG=sstep(4.6,6.4,spd),k=clamp(spd/0.6,0,1);
  const amp=lerp(lerp(0.5,0.55,gT),0.8,gG);let duty=lerp(lerp(0.62,0.46,gT),0.3,gG);
  let Lt=0;for(const L of legs)Lt+=L.Lt;Lt/=legs.length;
  const reach=Lt*Math.sin(amp),s0=reach*k;
  let freq=spd>0.03?spd*duty/(2*Math.max(s0,reach*0.25)):0;
  const cap=6.5*Math.sqrt(S.cadence||1);
  if(freq>cap){freq=cap;duty=Math.max(0.12,2*s0*cap/spd);}
  st.ph+=TAU*freq*dt;if(st.ph>TAU*4096)st.ph-=TAU*4096;
  const cyc=st.ph/TAU,flight=gG*clamp((0.34-duty)/0.2,0,1);
  /* the body only ever lifts off its standing height: a little at a trot, a real bound at a gallop */
  const bob=0.5-0.5*Math.cos(4*Math.PI*(cyc-duty/2-0.03*gG));
  q.by=bob*(k*(0.004+0.012*gT)*(1-gG)+gG*(0.012+0.05*flight)*(Lt/0.2));
  q.bp=Math.sin(TAU*cyc)*0.08*gG;q.bsz=1+0.04*Math.sin(TAU*cyc)*gG;
  q.hp=Math.sin(2*TAU*cyc)*0.03*gT-0.08*gG;
  q.earX=-clamp(spd*0.07,0,0.55);
  q.tailX=-0.55*gG*(S.tail&&S.tail.rest>0.5?1:0.3);
  st.moveW=k;
  const s=gw*q.sc,cb=Math.cos(q.bp),sb=Math.sin(q.bp),bpy=S.piv*gw+q.by,hl=lerp(0.2,0.34,gG)*Lt*Math.max(k,0.25);
  for(let i=0;i<legs.length;i++){
   const L=legs[i],off=lerp(lerp(GAIT_OFF.walk[i],GAIT_OFF.trot[i],gT),GAIT_OFF.gallop[i],gG);
   let u=cyc+off;u-=Math.floor(u);
   let zf,lift=0;
   if(u<duty){zf=s0*(1-2*u/duty);}
   else{const w=(u-duty)/(1-duty);zf=-s0+2*s0*w*w*(3-2*w);lift=hl*Math.sin(Math.PI*w);}
   const hyl=L.hipY-S.piv,hzl=L.z,sy=s*q.bsy,sz=s*q.bsz;
   const hzr=sy*hyl*sb+sz*hzl*cb;
   const dy=L.bottom*s+lift-bpy,dz=hzr+zf;
   ik2(q,i,L,hyl,hzl,(dy*cb+dz*sb)/sy,(-dy*sb+dz*cb)/sz);
  }
  q.flat=1;
 }
 /* the bunny and the hare hop: the body travels mostly while it is in the air (groundStep scales the
    step by the hop's phase), and at landing it barely pitches, so the belly never meets the ground */
 function bunnyGait(q,st,S,spd,dt){
  if(spd>0.18){const Lh=clamp(0.3+spd*0.2,0.3,3.4);st.ph+=spd/Lh*dt;}else st.ph=Math.ceil(st.ph-0.02);   // finish the hop, then sit
  const u=((st.ph%1)+1)%1,run=spd>0.18?1:0,Lh=clamp(0.3+spd*0.2,0.3,3.4);
  const air=u>0.16&&u<0.86,a=air?(u-0.16)/0.7:0;
  st.hopAir=run?(air?1:0):-1;
  q.hopY=run*(air?Math.sin(Math.PI*a)*(0.05+Lh*0.085):0);
  const push=run*(u<0.16?u/0.16:air?1-a:0),land=run*(u>=0.86?(u-0.86)/0.14:0);
  q.bsy=1+run*(air?0.07*Math.sin(Math.PI*a):u<0.16?-0.06:-0.1*Math.sin(Math.PI*land));
  q.bp=run*(air?lerp(-0.22,0.18,a):u<0.16?0.06:0.06*(1-land));
  if(run&&!air&&q.bp>0)q.by+=Math.max(0,Math.sin(q.bp)*S.len*0.5);
  setL(q,2,run*(air?0.55+0.4*push:0.2*push),0);setL(q,3,q.legs[2][0],0);
  setL(q,0,run*(air?lerp(-0.7,-0.2,a):0.1),0);setL(q,1,q.legs[0][0],0);
  q.earX=run*(air?-0.45:0.25*Math.sin(Math.PI*land));
  st.moveW=run;
 }
 /* the birds on foot: the owl hops; the duckling waddles and the chick scurries, and at riding speed
    both break into little skipping hops with their stubby wings fluttering */
 function birdGait(q,st,S,spd,dt,t){
  const walk=S.walk,run=spd>0.12?1:0;
  if(walk==='hop'){
   if(spd>0.12)st.ph+=dt/0.3;const u=((st.ph%1)+1)%1;
   q.hopY=run*(u>0.2&&u<0.8?Math.sin(Math.PI*(u-0.2)/0.6)*0.06:0);const lg=run*(u>0.2&&u<0.8?0.35:-0.1);setL(q,0,lg,0);setL(q,1,lg,0);q.bp=run*0.18;q.wOpen=run*0.15;
  }else{
   const f=Math.min(walk==='waddle'?1.6+spd*1.6:2.8+spd*2.3,walk==='waddle'?10:14);
   if(spd>0.12)st.ph+=TAU*f*0.5*dt;
   const a=clamp(spd/0.8,0,1),fast=sstep(2.2,4.5,spd);
   for(let i=0;i<2;i++){const ph=st.ph+i*Math.PI;setL(q,i,-Math.sin(ph)*(0.6+0.25*fast)*a,0);q.lift[i]=Math.max(0,Math.cos(ph))*(0.022+0.018*fast)*a;}
   if(walk==='waddle'){q.br=Math.sin(st.ph)*(0.17-0.06*fast)*a;q.hp=Math.sin(2*st.ph)*0.07*a;q.hy=Math.sin(st.ph)*0.08*a*(1-fast);q.bp=0.12*fast;}
   else{q.bp=0.24*clamp(spd/3,0,1);q.by=Math.abs(Math.sin(st.ph))*0.02*a;}
   if(fast>0){q.hopY=Math.max(0,Math.sin(st.ph*2))*0.035*fast;q.nubFlap=fast*(0.3+0.5*Math.max(0,Math.sin(t*TAU*(walk==='waddle'?7:11))));}
  }
  st.moveW=run;
 }
 /* the flap: a fast downstroke and a slower upstroke; the hand trails the arm by a quarter of a beat
    and half-folds on the way up */
 function flapPose(q,st,S,dt,hz,amp,glide){
  st.fph+=TAU*hz*dt;const f=Math.sin(st.fph+0.42*Math.sin(st.fph));
  st.flapW=damp(st.flapW,glide?0:1,glide?3:8,dt);
  const k=st.flapW;
  q.wFlap=lerp(0.14,f*amp+0.12,k);
  q.wHand=lerp(0.04,Math.sin(st.fph+0.42*Math.sin(st.fph)-Math.PI/2)*amp*0.55,k);
  q.wHandFold=k*0.32*Math.max(0,Math.cos(st.fph));
 }

 /* ---------------------------------------------------------------- idles ---------------------
    When you stop, a pet does what its kind does: each idle is a pose laid over the standing one with
    a soft start and finish. A tail lies level on the grass behind a sitting pet; the floor check after
    the pose (floorLift) lifts anything that would still dip into the ground. */
 const IDLE_T={sit:5,lie:5,tilt:1.5,look:2.6,sniff:2,scratch:1.8,spin:1.3,pant:3,pounce:1.4,groom:3,bow:1.7,pronk:1.6,boing:1.5,binky:1,
  periscope:2.6,freeze:2.2,listen:2.6,nose:1.4,peck:1.3,preen:2.3,swivel:2.8,flap:1.4,fluff:1.6,peep:0.9,settle:3,snuffle:2,tailspin:1.6,
  wash:2.3,graze:3,butt:1.1,bleat:1.3};
 function idlePose(q,st,S,name,u,e,t,side){
  const quad=S.kind==='quad',L=S.legs;
  const level=k=>{if(S.tail&&(S.tail.fused||S.tail.segs))q.tailX=lerp(q.tailX,0.05-(S.tail.rest||0)-q.bp,k);};
  const sitQ=(k)=>{lerpL(q,2,-1.25,2.15,k);lerpL(q,3,-1.25,2.15,k);lerpL(q,0,0.42,0,k);lerpL(q,1,0.42,0,k);
   q.bp=lerp(q.bp,-0.42,k);q.by=lerp(q.by,-(L.hipYH||L.hipY)*0.36,k);q.hp=lerp(q.hp,0.3,k);level(k);q.flat=0;};
  switch(name){
   case 'sit':if(quad)sitQ(e);break;
   case 'lie':if(quad){for(let i=0;i<4;i++)lerpL(q,i,i<2?-1.45:-1.3,i<2?0.25:2.3,e);q.by=lerp(q.by,-L.hipY*0.72,e);q.hp=lerp(q.hp,0.1,e);level(e);q.flat=0;}break;
   case 'tilt':q.hr=lerp(q.hr,0.34*side,e);q.hp=lerp(q.hp,0.12,e);break;
   case 'look':q.hy=lerp(q.hy,Math.sin(u*TAU)*0.85,e);break;
   case 'sniff':q.hp=lerp(q.hp,-0.55+Math.sin(t*19)*0.05,e);q.by=lerp(q.by,-0.02,e);q.nose=1+Math.sin(t*40)*0.25*e;break;
   case 'scratch':if(quad){sitQ(e);lerpL(q,3,-1.8+Math.sin(t*24)*0.28,1.3,e);q.hr=lerp(q.hr,0.28,e);q.hy=lerp(q.hy,-0.3,e);}break;
   case 'pant':q.tongue=Math.max(q.tongue,e*(0.8+0.25*Math.sin(t*19)));q.by+=Math.sin(t*19)*0.004*e;break;
   case 'spin':q.spin=u*TAU*side;break;
   case 'pounce':{if(u<0.4){const k=sstep(0,0.15,u);q.by=lerp(q.by,-0.05,k);q.bp=lerp(q.bp,0.12,k);q.br=Math.sin(t*34)*0.06*k;q.hp=lerp(q.hp,-0.2,k);if(quad){lerpL(q,0,-0.3,0.6,k);lerpL(q,1,-0.3,0.6,k);}}
    else{const a=clamp((u-0.4)/0.4,0,1);q.hopY=Math.sin(Math.PI*a)*0.3*e;q.bp=lerp(-0.35,0.6,a)*e;for(let i=0;i<4;i++)setL(q,i,i<2?-0.8*e:0.7*e,0.3*e);}q.flat=0;break;}
   case 'groom':if(quad){sitQ(e);q.hy=lerp(q.hy,0.5*side,e);q.hp=lerp(q.hp,-0.2+Math.sin(t*9)*0.06,e);setL(q,side>0?0:1,lerp(0.42,-1.1,e),lerp(0,1.5+Math.sin(t*9)*0.2,e));}
    else{q.hp=lerp(q.hp,-0.3,e);const g=lerp(q.legs[0][0],-0.9+Math.sin(t*10)*0.2,e);setL(q,0,g,0);setL(q,1,g,0);q.bp=lerp(q.bp,-0.45,e);}break;
   case 'bow':if(quad){lerpL(q,0,-0.95,1.1,e);lerpL(q,1,-0.95,1.1,e);lerpL(q,2,0.12,0,e);lerpL(q,3,0.12,0,e);q.bp=lerp(q.bp,0.36,e);q.by=lerp(q.by,-0.03,e);q.tailX=lerp(q.tailX,0.3,e);q.tailW=Math.max(q.tailW,0.5*e);q.flat=0;}break;
   case 'pronk':case 'boing':case 'binky':{const n=name==='binky'?1:2,a=(u*n)%1,air=a>0.15&&a<0.85;q.hopY=air?Math.sin(Math.PI*(a-0.15)/0.7)*(name==='binky'?0.26:0.32)*e:0;
    if(quad)for(let i=0;i<4;i++)setL(q,i,0,0);if(name==='binky'){q.hr=air?Math.sin(Math.PI*(a-0.15)/0.7)*0.5:0;q.spin=air?Math.sin(Math.PI*(a-0.15)/0.7)*0.8:0;}break;}
   /* up on the haunches, the head held level to look round, the ears standing up */
   case 'periscope':q.bp=lerp(q.bp,-0.95,e);q.by=lerp(q.by,0.05,e);q.hp=lerp(q.hp,-0.8,e);q.hy=lerp(q.hy,Math.sin(u*TAU)*0.7,e);lerpL(q,0,0.9,1.2,e);lerpL(q,1,0.9,1.2,e);q.earX=lerp(q.earX,-0.1,e);break;
   case 'freeze':q.earX=lerp(q.earX,-1.25,e);q.by=lerp(q.by,-0.03,e);q.hp=lerp(q.hp,-0.1,e);break;
   case 'listen':q.earY[0]=Math.sin(t*3.2)*0.55*e;q.earY[1]=-Math.sin(t*3.2)*0.55*e;q.hy=lerp(q.hy,Math.sin(t*1.1)*0.3,e);break;
   case 'nose':q.nose=1+Math.sin(t*50)*0.3*e;q.hp=lerp(q.hp,0.12,e);break;
   case 'peck':{const d=Math.abs(Math.sin(u*TAU*1.5));q.bp=lerp(q.bp,0.62*d,e);q.hp=lerp(q.hp,-0.2*d,e);break;}
   case 'preen':q.hy=lerp(q.hy,1.9*side,e);q.hp=lerp(q.hp,-0.35+Math.sin(t*12)*0.06,e);q.wOpen=Math.max(q.wOpen,0.12*e);break;
   case 'swivel':{const ang=st.lookYaw||0;q.hy=lerp(q.hy,clamp(ang,-2.5,2.5),e);q.hr=lerp(q.hr,Math.sin(u*Math.PI)*0.35*side,e);break;}
   case 'flap':q.wOpen=Math.max(q.wOpen,0.95*e);q.wFlap=Math.sin(t*TAU*4)*0.8+0.2;q.wHand=Math.sin(t*TAU*4-1.5)*0.4;q.hp=lerp(q.hp,0.2,e);q.hopY=Math.max(q.hopY,Math.abs(Math.sin(t*TAU*2))*0.03*e);break;
   case 'fluff':q.sc=lerp(q.sc,1.09,e*Math.sin(Math.PI*u));break;
   case 'peep':q.jaw=Math.abs(Math.sin(u*Math.PI*3))*0.35*e;q.hp=lerp(q.hp,0.25,e);break;
   case 'settle':{q.by=lerp(q.by,-0.045,e);const g=lerp(q.legs[0][0],-0.6,e);setL(q,0,g,0);setL(q,1,g,0);break;}
   case 'snuffle':q.hp=lerp(q.hp,-0.5+Math.sin(t*25)*0.08,e);q.by=lerp(q.by,-0.02,e);break;
   case 'tailspin':q.tailSpin=t*TAU*4*e;break;
   case 'wash':if(quad){sitQ(e);q.bp=lerp(q.bp,-0.75,e);level(e);setL(q,0,lerp(0.42,-1.2+Math.sin(t*14)*0.25,e),lerp(0,1.2,e));setL(q,1,lerp(0.42,-1.2-Math.sin(t*14)*0.25,e),lerp(0,1.2,e));q.hp=lerp(q.hp,0.1,e);}break;
   case 'graze':q.hp=lerp(q.hp,-0.8,e);q.by=lerp(q.by,-0.01,e);q.hr=Math.sin(t*6)*0.04*e;break;
   case 'butt':{const k=Math.sin(Math.PI*u);q.bp=lerp(q.bp,0.25*k,e);q.hp=lerp(q.hp,-0.4*k,e);break;}
   case 'bleat':q.hp=lerp(q.hp,0.55,e);q.jaw=0.3*e;break;
  }
 }
 /* how far the pet must be lifted so that no paw, no part of the body or head and no tail tip is below
    its own ground (the root's plane); the tail is left out while it runs, when the legs carry the body */
 const _fi=new THREE.Matrix4(),_fv=new THREE.Vector3();
 function floorLift(P,moving){
  const root=P.group;root.updateMatrixWorld(true);_fi.copy(root.matrixWorld).invert();let mn=0;
  for(const s of P.low){if(moving&&(s.tail||s.paw))continue;_fv.copy(s.p).applyMatrix4(s.o.matrixWorld).applyMatrix4(_fi);if(_fv.y<mn)mn=_fv.y;}
  return Math.min(0.25,-mn);
 }

 /* ================================================================ where the pet walks ========
    The riding camera sits behind the horse and a little to one side, and the bottom of the picture
    meets the ground about a metre and a half behind the horse's middle — so a pet that follows behind
    is never in the shot. A pet goes beside the horse's shoulder instead, on the side the camera is on
    (never behind the horse from where you are looking), or just ahead of the horse on a narrow phone
    screen, or well ahead of it when a tree or a wall has pulled the camera in close. Every candidate spot
    is scored three times a second against the picture itself: inside the frame, clear of the on-screen
    buttons and panels, and not hidden — by the horse, the rider and a pegasus's folded wings, by bushes,
    ferns, reeds and lupins, by tree trunks, rocks and buildings, by fences and Willowmere's boardwalk.
    All of that is worked out on the CPU from the scene's own data (no extra rendering, no reading
    pixels back), so it costs a fraction of a millisecond. A spot on the far side of a fence or inside
    a building is never chosen. The best spot wins and the pet moves smoothly to it. */
 const SLOTS={wide:[[1.5,0.5],[2.2,-0.4],[1.1,2.0],[1.9,1.3]],narrow:[[0.95,1.75],[0.85,2.35],[1.3,0.9],[1.0,-0.95]],foot:[[0.95,0.45],[0.75,1.3],[1.35,-0.1]],
  near:[[0.8,2.6],[0.8,3.4],[1.6,2.4]],close:[[0.6,3.0],[0.6,3.8],[0.05,3.4]],deck:[[0.55,2.5],[0.5,3.3]],wingNarrow:[[1.3,3.1],[1.5,2.4],[0.9,3.5]]};   // on a phone beside a pegasus: ahead, where the lens sees over its folded wings
 const _v=new THREE.Vector3(), _c=new THREE.Vector3();
 const HUD_IDS=['stickZone','seJump','seEmote','seMount','seWhistle','jumpBtn','galBtn','flyBtn','ctx','questTrack','sjyTrack'];
 let hudRects=[],hudT=-1,hudSig='';
 function hud(t){
  const fb=document.getElementById('flyBtn'),sig=innerWidth+'x'+innerHeight+'|'+(fb?fb.style.display:'');   // the fly button appearing (a pegasus) refreshes it at once
  if(t-hudT<1&&hudT>=0&&sig===hudSig)return hudRects;hudT=t;hudSig=sig;hudRects=[];
  for(const id of HUD_IDS){const e=document.getElementById(id);if(!e)continue;const r=e.getBoundingClientRect();if(r.width<4||r.height<4)continue;
   let vis=true;for(let el=e;el&&el!==document.body;el=el.parentElement){const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0'){vis=false;break;}}
   if(vis)hudRects.push(id==='stickZone'?[r.left,r.top+r.height*0.35,r.right-r.width*0.2,r.bottom]:[r.left,r.top,r.right,r.bottom]);}
  return hudRects;}
 function projBox(pts){const cam=G.camera,Wd=innerWidth,Hd=innerHeight;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){_v.set(p[0],p[1],p[2]);_c.copy(_v).applyMatrix4(cam.matrixWorldInverse);if(_c.z>-0.2)return null;_v.project(cam);const sx=(_v.x+1)/2*Wd,sy=(1-_v.y)/2*Hd;
   if(sx<x0)x0=sx;if(sx>x1)x1=sx;if(sy<y0)y0=sy;if(sy>y1)y1=sy;}
  return [x0,y0,x1,y1];}
 const ovl=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 function inView(x,y,z,m){const cam=G.camera;_c.set(x,y,z).applyMatrix4(cam.matrixWorldInverse);if(_c.z>-0.1)return false;_v.set(x,y,z).project(cam);const k=1+(m||0.1);return Math.abs(_v.x)<k&&Math.abs(_v.y)<k;}
 /* the pet's box as the lens will see it: its length along the way it will face (the horse's heading while
    it runs; stopped, three-quarters towards the camera, which reaches lower in the picture), its width
    across, from its feet to its ears */
 const PB=[];for(let i=0;i<8;i++)PB.push([0,0,0]);
 function petBox(x,z,y,S,hd){if(hd==null){const e=G.camera.matrixWorld.elements;hd=Math.atan2(-e[8],-e[10])+Math.PI/2;}
  const fx=Math.sin(hd),fz=Math.cos(hd),rx=-fz,rz=fx,d=S.len*0.55,w=S.w*0.55;
  for(let i=0;i<8;i++){const a=(i&1?w:-w),b=(i&2?d:-d),P=PB[i];P[0]=x+rx*a+fx*b;P[1]=y+(i&4?S.h+0.04:0.01);P[2]=z+rz*a+fz*b;}return PB;}

 /* ---------------------------------------------------------------- what is in the way ---------- */
 /* Willowmere's boardwalk. world-quarters.js lays it out a hand's breadth over the marsh; its spans are
    rebuilt here from the same plan (or read from W.decks, if the world ever publishes them), so a pet
    there walks on the planks instead of wading underneath them, and the planks count as being in the way. */
 let DECKS=null,DECKBOX=null;
 function decks(){
  if(DECKS)return DECKS;DECKS=[];
  try{
   if(Array.isArray(W.decks)&&W.decks.length){for(const d of W.decks)if(d&&d.x0!=null)DECKS.push(Object.assign({len:Math.hypot(d.x1-d.x0,d.z1-d.z0),n:1,ys:[d.y!=null?d.y:gH((d.x0+d.x1)/2,(d.z0+d.z1)/2)+0.67]},d));}
   else{const cx=310,cz=300,r=Math.hypot(cx,cz),ux=-cx/r,uz=-cz/r,vx=-uz,vz=ux,at=(a,b)=>[cx+ux*a+vx*b,cz+uz*a+vz*b];   // world-quarters.js frame(310,300)
    const span=(pts,w)=>{for(let i=1;i<pts.length;i++){const [x0,z0]=pts[i-1],[x1,z1]=pts[i],len=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(len/1.6)),ys=[];
      for(let k=0;k<n;k++){const f=(k+0.5)/n;ys.push(gH(x0+(x1-x0)*f,z0+(z1-z0)*f)+0.62+0.05);}DECKS.push({x0,z0,x1,z1,w,len,n,ys});}};
    span([[12,-24],[6,-16],[2,-6],[-2,2],[-6,10],[-11,18],[-15,25]].map(p=>at(p[0],p[1])),2.2);
    for(const sp of [[[-3,1],[-10,4]],[[3,-8],[9,-12]],[[-5,7],[2,14]]])span(sp.map(p=>at(p[0],p[1])),1.6);}
   let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const s of DECKS){a=Math.min(a,s.x0,s.x1);b=Math.min(b,s.z0,s.z1);c=Math.max(c,s.x0,s.x1);d=Math.max(d,s.z0,s.z1);}DECKBOX=[a-4,b-4,c+4,d+4];
  }catch(e){DECKS=[];}
  return DECKS;}
 const nearDecks=(x,z)=>{const D=decks();return D.length&&DECKBOX&&x>DECKBOX[0]&&x<DECKBOX[2]&&z>DECKBOX[1]&&z<DECKBOX[3];};
 function deckAt(x,z,m){
  if(!nearDecks(x,z))return null;let top=null;
  for(const d of DECKS){const dx=d.x1-d.x0,dz=d.z1-d.z0,l2=d.len*d.len||1,u=((x-d.x0)*dx+(z-d.z0)*dz)/l2;if(u<-0.03||u>1.03)continue;
   if(Math.hypot(x-(d.x0+dx*u),z-(d.z0+dz*u))>d.w/2+(m||0))continue;const y=d.ys[clamp(Math.floor(u*d.n),0,d.n-1)];if(top==null||y>top)top=y;}
  return top;}
 function standY(x,z){const g=gH(x,z),d=deckAt(x,z,0);return d!=null&&d>g?d:g;}

 /* Low plants and stones: every instanced scatter in the scene (the near meadow's ferns, reeds, lupins,
    flowers and stones, and the world's bushes, tufts and tree trunks), each instance reduced to an upright
    cylinder and filed in an 8 m grid, one mesh per frame so it never holds up a frame. A cross-quad plant
    only half hides what is behind it; a stone or a trunk hides it all. The near meadow is laid out again
    as you ride, so its meshes are re-filed when their instances change. The dense grass itself is left
    out: it is the same everywhere, so no spot is better than another. */
 const FOL={list:null,next:0,cell:8,q:[]};
 function folInit(){const old=FOL.list||[];FOL.list=[];for(const F of old)if(F.im.parent===G.scene)FOL.list.push(F);const have=new Set(FOL.list.map(F=>F.im));   // re-run now and then: a scatter added later is picked up, one taken away is dropped
  for(const o of G.scene.children){if(have.has(o)||!o.isInstancedMesh||!o.geometry||o.count<1||o.count>30000)continue;
   const nm=o.name||'';if(/smoke|spray|mist|drops|lilies|puddles|worldPaths:box/.test(nm))continue;
   const m=o.material||{};if(m.transparent&&!m.alphaTest&&!m.alphaToCoverage)continue;
   o.geometry.computeBoundingBox();const bb=o.geometry.boundingBox;if(bb.max.y-bb.min.y<0.05)continue;
   const w=(m.map&&(m.alphaTest>0||m.alphaToCoverage))?(/oak|birch|pine|cold|willow|blossom/.test(nm)?0.6:0.5):1;
   FOL.list.push({im:o,bb,w,ver:-1,grid:null});}}
 function folIndex(F){const o=F.im,bb=F.bb,e=new THREE.Matrix4(),grid=new Map(),C=FOL.cell,rr=Math.max(Math.abs(bb.min.x),Math.abs(bb.max.x),Math.abs(bb.min.z),Math.abs(bb.max.z))*0.75;
  o.updateMatrixWorld();const pw=o.matrixWorld,ident=pw.equals(new THREE.Matrix4());
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,e);if(!ident)e.premultiply(pw);const el=e.elements,sx=Math.hypot(el[0],el[1],el[2]),sy=Math.hypot(el[4],el[5],el[6]);if(sx<1e-3||sy<1e-3)continue;
   const x=el[12],z=el[14],y=el[13];if(y<-5)continue;const top=y+bb.max.y*sy,bot=y+bb.min.y*sy,r=rr*sx;if(r>6||top-bot<0.12)continue;
   const k=Math.floor(x/C)*73856093^Math.floor(z/C)*19349663;let a=grid.get(k);if(!a){a=[];grid.set(k,a);}
   if(top-bot>2.2){const hc=bot+(top-bot)*0.4;a.push(x,z,Math.min(0.3,r*0.12),bot,hc,1,x,z,r*0.85,hc,top,Math.min(F.w,0.55));}   // something tall (a tree drawn as one card): a trunk under a crown
   else a.push(x,z,r,bot,top,F.w);}
  F.grid=grid;F.ver=o.instanceMatrix.version;}
 function folTick(t){if(!FOL.list||!(t-FOL.t0<20)){FOL.t0=t;folInit();}const L=FOL.list;if(!L.length)return;
  for(let n=0;n<L.length;n++){FOL.next=(FOL.next+1)%L.length;const F=L[FOL.next];if((!F.grid||F.ver!==F.im.instanceMatrix.version)&&!(F.t>t-0.5)){F.t=t;if(F.im.parent)folIndex(F);return;}}}   // a scatter re-filed at most twice a second (anything animated every frame is not worth chasing)
 function folGather(x,z,rad){const out=FOL.q;out.length=0;if(!FOL.list)return out;const C=FOL.cell;
  for(const F of FOL.list){if(!F.grid)continue;for(let i=Math.floor((x-rad)/C);i<=Math.floor((x+rad)/C);i++)for(let j=Math.floor((z-rad)/C);j<=Math.floor((z+rad)/C);j++){const a=F.grid.get(i*73856093^j*19349663);if(!a)continue;
   for(let k=0;k<a.length;k+=6){const dx=a[k]-x,dz=a[k+1]-z;if(dx*dx+dz*dz<(rad+a[k+2])*(rad+a[k+2]))out.push(a[k],a[k+1],a[k+2],a[k+3],a[k+4],a[k+5]);}}}
  return out;}
 /* colliders (tree trunks, rocks, buildings) in a 16 m grid, built once */
 let CGRID=null;
 function cGrid(){if(CGRID&&CGRID.n===(W.colliders||[]).length)return CGRID;const g=new Map(),C=16;for(const c of W.colliders||[]){if(c.climb)continue;const k=Math.floor(c.x/C)*73856093^Math.floor(c.z/C)*19349663;let a=g.get(k);if(!a){a=[];g.set(k,a);}a.push(c);}CGRID={g,C,n:(W.colliders||[]).length};return CGRID;}
 const CQ=[];
 function cGather(x0,z0,x1,z1){CQ.length=0;const G2=cGrid(),C=G2.C;for(let i=Math.floor((Math.min(x0,x1)-8)/C);i<=Math.floor((Math.max(x0,x1)+8)/C);i++)for(let j=Math.floor((Math.min(z0,z1)-8)/C);j<=Math.floor((Math.max(z0,z1)+8)/C);j++){const a=G2.g.get(i*73856093^j*19349663);if(a)for(const c of a)CQ.push(c);}return CQ;}
 function segCross(ax,az,bx,bz,cx,cz,dx,dz){const r1=(bx-ax)*(cz-az)-(bz-az)*(cx-ax),r2=(bx-ax)*(dz-az)-(bz-az)*(dx-ax),r3=(dx-cx)*(az-cz)-(dz-cz)*(ax-cx),r4=(dx-cx)*(bz-cz)-(dz-cz)*(bx-cx);return r1*r2<0&&r3*r4<0;}
 function crossesWall(ax,az,bx,bz){for(const w of W.walls||[])if(segCross(ax,az,bx,bz,w.x1,w.z1,w.x2,w.z2))return true;return false;}
 /* How much of the pet standing at (x,z) with its feet at y is hidden from the lens: rays to its feet,
    middle and ears, against the horse and rider (boxes in the horse's own frame) and then the scene. */
 const HB=[];
 function horseBoxes(R){HB.length=0;
  if(R.onFoot){HB.push([-0.28,0.28,0,1.75,-0.24,0.24,1]);return HB;}
  /* measured from the horse and rider themselves (skinned vertices, in slices along the horse): barrel
     with the rider's legs, rump and tail, neck and head, the rider, and the legs (which only hide part of
     what is behind them) — scaled with the horse */
  const k=(R.hs||HS0)/HS0;
  for(const b of HORSE)HB.push([b[0]*k,b[1]*k,b[2]*k,b[3]*k,b[4]*k,b[5]*k,b[6]]);
  if(R.wingX&&!R.flying)for(const s of [1,-1])HB.push(s>0?[0.22,0.76,1.12,1.68,-1.72,-0.1,0.7]:[-0.76,-0.22,1.12,1.68,-1.72,-0.1,0.7],s>0?[0.76,1.1,1.12,1.52,-1.72,-0.43,0.55]:[-1.1,-0.76,1.12,1.52,-1.72,-0.43,0.55]);   /* measured on the pegasus itself, at its own size */   // a pegasus at rest: each wing folded back along the flank, from the withers to past the croup, thinner towards its edge (measured from the feathers themselves)
  return HB;}
 const HORSE=[[-0.42,0.42,0.75,1.6,-0.5,0.45,1],[-0.3,0.3,0.75,1.55,-1.25,-0.5,1],[-0.2,0.2,0.5,1.25,-1.55,-1.25,0.6],[-0.18,0.18,1.0,2.12,0.3,1.08,1],[-0.36,0.36,1.5,2.47,-0.64,0.08,1],[-0.3,0.3,0,0.75,-1.3,0.8,0.4]],HS0=1.065;   // (the starting horse, whose scale is HS0)
 function horseBlock(R,cam,x,ty,z){let blk=0;
  for(let k=1;k<16;k++){const u=k/16,px=cam.x+(x-cam.x)*u,py=cam.y+(ty-cam.y)*u,pz=cam.z+(z-cam.z)*u;
   const lx=(px-R.x)*R.rx+(pz-R.z)*R.rz,lz=(px-R.x)*R.fx+(pz-R.z)*R.fz,ly=py-R.y;
   for(const b of HB)if(lx>b[0]&&lx<b[1]&&ly>b[2]&&ly<b[3]&&lz>b[4]&&lz<b[5]){if(b[6]>blk)blk=b[6];}
   if(blk>=1)break;}
  return blk;}
 function sceneBlock(cam,x,ty,z,fol,useCol){
  let vis=1;const sx=x-cam.x,sy=ty-cam.y,sz=z-cam.z,L2=sx*sx+sz*sz,L=Math.sqrt(L2)||1;
  /* trunks, rocks and buildings */
  if(useCol){const cs=cGather(cam.x,cam.z,x,z);for(const c of cs){if((cam.x-c.x)*(cam.x-c.x)+(cam.z-c.z)*(cam.z-c.z)<c.r*c.r)continue;   /* a collider's circle round the lens itself: the circle is bigger than the building it stands for (a camera pushed up against a wall is inside it), so it says nothing */
   const t=clamp(((c.x-cam.x)*sx+(c.z-cam.z)*sz)/(L2||1),0,1);if(t<0.03||t>0.97)continue;const qx=cam.x+sx*t-c.x,qz=cam.z+sz*t-c.z;if(qx*qx+qz*qz>c.r*c.r)continue;
    const hy=cam.y+sy*t-gH(c.x,c.z),top=c.plant?9:c.landform?2.6:7;if(hy<top){vis*=c.plant?0.3:0;if(vis<0.02)return 1;}}}
  /* the ground itself: a rise between the lens and the pet */
  for(let k=1;k<6;k++){const t=0.55+k*0.075,px=cam.x+sx*t,pz=cam.z+sz*t;if(gH(px,pz)>cam.y+sy*t+0.02){vis=0;return 1;}}
  /* fences: a rail hides some of what is behind it */
  for(const w of W.walls||[]){if(!segCross(cam.x,cam.z,x,z,w.x1,w.z1,w.x2,w.z2))continue;const wx=w.x2-w.x1,wz=w.z2-w.z1,den=sx*wz-sz*wx;if(Math.abs(den)<1e-9)continue;const t=((w.x1-cam.x)*wz-(w.z1-cam.z)*wx)/den;const hy=cam.y+sy*t-gH(cam.x+sx*t,cam.z+sz*t);if(hy<1.3)vis*=0.72;}
  /* the boardwalk's planks */
  if(nearDecks(x,z))for(const d of DECKS){const top=d.ys[0];if(Math.abs(sy)<1e-4)continue;const t=(top-cam.y)/sy;if(t<0.02||t>0.985)continue;const px=cam.x+sx*t,pz=cam.z+sz*t,dy2=deckAt(px,pz,0);if(dy2!=null&&Math.abs(cam.y+sy*t-dy2)<0.25){vis*=0.1;break;}}
  /* bushes, ferns, reeds, lupins, stones: only the last few metres before the pet matter */
  if(fol&&fol.length){const t0=Math.max(0,1-4/L);
   for(let k=0;k<fol.length;k+=6){const ix=fol[k],iz=fol[k+1],r=fol[k+2];let t=((ix-cam.x)*sx+(iz-cam.z)*sz)/(L2||1);if(t<t0||t>1.05)continue;t=Math.min(t,1);
    const qx=cam.x+sx*t-ix,qz=cam.z+sz*t-iz,d2=qx*qx+qz*qz;if(d2>r*r)continue;const hy=cam.y+sy*t;if(hy<fol[k+3]||hy>fol[k+4])continue;
    vis*=1-fol[k+5]*(1-d2/(r*r));if(vis<0.02)return 1;}}
  return 1-vis;}
 const FY=[0.14,0.5,0.86];
 function hiddenAt(R,x,z,y,S,fol,useCol){const cam=G.camera.position;let hid=0;
  for(const fy of FY){const ty=y+S.h*fy;let blk=horseBlock(R,cam,x,ty,z);if(blk<1)blk=1-(1-blk)*(1-sceneBlock(cam,x,ty,z,fol,useCol));hid+=blk/3;}
  return hid;}

 const CAND=[];for(let i=0;i<40;i++)CAND.push([0,0,0,0,0]);
 const TUNE={};
 function chooseSlot(st,S,R,t){
  /* which side the camera is on — only believed once it has stayed there a while, so the swing of the
     camera through a turn does not send the pet running round the horse and back */
  const cam=G.camera,cp=cam.position,lat=(cp.x-R.x)*R.rx+(cp.z-R.z)*R.rz,camD=Math.hypot(cp.x-R.x,cp.z-R.z);
  if(st.side==null)st.side=(lat<-1.2&&camD<10)?-1:1;   // the riding camera rests over the right shoulder (a camera still catching up after a jump does not count)
  if(Math.sign(lat)!==st.side&&Math.abs(lat)>1.2){st.sideT+=0.3;if(st.sideT>=(R.spd<0.5?2.4:1.2)){st.side=-st.side;st.sideT=0;}}else st.sideT=Math.max(0,st.sideT-0.3);   // standing, the camera is given longer to settle before the pet crosses over
  /* and a slow drift back to wherever the camera has settled, even just over one shoulder, while riding straight */
  if(Math.sign(lat)!==st.side&&Math.abs(lat)>0.3&&Math.abs(R.yawRate)<0.3){st.driftT=(st.driftT||0)+0.3;if(st.driftT>=2.4){st.side=-st.side;st.driftT=0;}}else st.driftT=0;
  /* in a held turn the chase camera lags on the inside of the turn (behind where the horse was heading),
     so the pet goes to the inside at once — the outside is the far side of the horse from the lens */
  if(Math.abs(R.yawRate)>0.6&&R.spd>2){st.turnT=(st.turnT||0)+0.3;const ins=-Math.sign(R.yawRate);if(st.turnT>=0.5&&ins!==st.side){   /* held for over half a second: a quick swerve is not worth crossing for */st.side=ins;st.sideT=0;st.driftT=0;}}else st.turnT=0;
  const narrow=cam.aspect<1,riding=!R.onFoot,list=R.onFoot?SLOTS.foot:narrow?SLOTS.narrow:SLOTS.wide,grow=Math.max(0,S.w*0.5-0.12),fwd=Math.min(0.7,R.spd*0.045);
  const camNear=riding&&camD<4,camClose=riding&&camD<2.5;   // a tree or a wall behind has pulled the camera in: beside the horse is out of the picture, ahead of it is not
  const Wd=innerWidth,Hd=innerHeight,frame=[Wd*0.05,Hd*0.12,Wd*0.95,Hd*0.89],HR=hud(t);
  const onDeck=deckAt(R.x,R.z,0)!=null;
  let n=0;const add=(lx,lz,id,s,pen)=>{if(n>=CAND.length)return;const c=CAND[n++];c[0]=lx;c[1]=lz;c[2]=id;c[3]=s;c[4]=pen;};
  for(const s of [st.side,-st.side]){const o=s>0?0:100;
   if(camClose)SLOTS.close.forEach((sl,i)=>add(s*sl[0],sl[1],o+40+i,s,0));
   list.forEach((sl,i)=>{let lx=sl[0]+grow,lz=sl[1]+fwd;if(narrow&&R.wingX&&riding&&lz>1.2&&lx<1.3)lx=1.6;if(camNear&&!camClose&&lz<1.6)lz+=0.9;add(s*lx,lz,o+i,s,camClose?0.5:0);});   // on a phone, a pegasus's folded wings hide the spots just ahead of its shoulder
   if(camNear&&!camClose)SLOTS.near.forEach((sl,i)=>add(s*sl[0],sl[1]+fwd,o+20+i,s,0.05));
   if(narrow&&R.wingX&&riding)SLOTS.wingNarrow.forEach((sl,i)=>add(s*sl[0],sl[1],o+30+i,s,0));
   if(onDeck)SLOTS.deck.forEach((sl,i)=>add(s*sl[0],sl[1]+fwd,o+50+i,s,0));}   // on the boardwalk: the planks ahead, rather than the water beside it
  const slow=R.spd<5,fol=slow?folGather(R.x,R.z,7):null;horseBoxes(R);
  /* crossing to the other side of the horse costs something (it is out of the picture for a moment on the
     way), more at speed: a spot over there has to be clearly better than the best one on this side */
  const pc=st.pc,plat=pc?(pc.x-R.x)*R.rx+(pc.z-R.z)*R.rz:0,pSide=Math.abs(plat)>0.4?Math.sign(plat):0,crossCost=0.35+0.5*clamp(R.spd/6,0,1);
  const dbg=G.petModels&&G.petModels.debug;if(dbg)st.cands=[];
  let best=null,bestS=-1e9,bestH=0;
  for(let k=0;k<n;k++){const c=CAND[k];
   const x=R.x+R.rx*c[0]+R.fx*c[1],z=R.z+R.rz*c[0]+R.fz*c[1];
   let sc,ho=1;
   if(blockedAt(x,z,S.rad)||wallAt(x,z,S.rad)||crossesWall(R.x,R.z,x,z))sc=-9;   // inside a building, against a fence, or on the far side of one
   else{const y=standY(x,z),hd=R.spd<0.5&&!R.flying?Math.atan2(cp.x-x,cp.z-z)-Math.sign(c[0]||1)*0.85:R.h,b=projBox(petBox(x,z,y,S,hd));
    if(!b)sc=-5;
    else{const area=Math.max(1,(b[2]-b[0])*(b[3]-b[1])),inF=ovl(b,frame)/area;let hu=0;for(const r of HR)hu=Math.max(hu,ovl(b,r)/area);
     ho=hiddenAt(R,x,z,y,S,fol,true);
     const cur=st.slotI===c[2],pass=cur?(inF>0.9&&hu<0.08&&ho<0.35):(inF>0.97&&hu<0.03&&ho<0.2);   // the spot it is already in keeps it a little longer
     const bad=st.bad&&st.bad[c[2]]>t,wa=y>gH(x,z)+0.05?null:waterAt(x,z),deep=wa&&wa.depth>(S.wade||0.3)?(S.swim?0.3:0.8):0;   // a swimming pet shows only its head
     sc=inF*2-hu*1.6-ho*1.6-(c[2]%10)*0.25-(c[3]!==st.side?0.6:0)-(pSide&&Math.sign(c[0])!==pSide&&!(!TUNE.noInside&&st.turnT>=0.5&&c[3]===st.side)?crossCost:0)+(pass?1:0)+(cur?0.15:0)-c[4]-(bad?2.5:0)-deep;}}
   if(dbg)st.cands.push([c[2],+sc.toFixed(2),+ho.toFixed(2)]);
   if(sc>bestS){bestS=sc;best=c;bestH=ho;}}
  if(best){if(!st.slot)st.slot=[0,0];st.slot[0]=best[0];st.slot[1]=best[1];st.slotI=best[2];st.slotHid=bestH;}
 }
 /* water: the river's channel and Loon Lake, as the horse and the rider on foot both read them */
 function waterAt(x,z){let depth=0,surface=0;const dl=Math.hypot(x-20,z-16);if(dl<4.5){const d=0.35+0.9*(1-dl/4.5);if(d>depth){depth=d;surface=gH(20,16)+0.02;}}
  try{const rz=W.riverZ(x);if(Math.abs(z-rz)<9){const th=W.terrainH(x,z);if(gH(x,z)<=th+0.3){const lv=W.riverLevel(x);if(lv-th>depth){depth=lv-th;surface=lv;}}}}catch(e){}
  return depth>0.02?{depth,surface}:null;}
 function wallAt(x,z,pad){for(const w of W.walls||[]){const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz;let u=l2>0?((x-w.x1)*dx+(z-w.z1)*dz)/l2:0;u=u<0?0:u>1?1:u;if(Math.hypot(x-(w.x1+dx*u),z-(w.z1+dz*u))<pad)return true;}return false;}
 function blockedAt(x,z,pad){const cs=cGather(x,z,x,z);for(const c of cs){const dx=x-c.x,dz=z-c.z,r=c.r+pad;if(dx*dx+dz*dz<r*r)return true;}return false;}
 const CS=[0,0];
 function clearSpot(x,z,pad){const cs=cGather(x,z,x,z);for(let k=0;k<3;k++){let moved=false;for(const c of cs){const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz),r=c.r+pad;if(d<r){if(d<0.02){x=c.x+r;}else{x=c.x+dx/d*r;z=c.z+dz/d*r;}moved=true;}}if(!moved)break;}CS[0]=x;CS[1]=z;return CS;}
 function pushOutPet(c,S,skipWalls){if(W.pushOut&&!skipWalls){W.pushOut(c,S.rad);return;}for(const k of cGather(c.pos.x,c.pos.z,c.pos.x,c.pos.z)){const ox=c.pos.x-k.x,oz=c.pos.z-k.z,d=Math.hypot(ox,oz),r=k.r+S.rad;if(d<r){if(d<0.02)c.pos.x=k.x+r;else{c.pos.x=k.x+ox/d*r;c.pos.z=k.z+oz/d*r;}}}}

 /* ---------------------------------------------------------------- the rider, as the pet sees it */
 function rider(st,dt){
  const p=player,gy=gH(p.pos.x,p.pos.z),y=gy+(p.y||0),R=st.R||(st.R={vx:0,vz:0,svx:0,svz:0,vy:0,yawRate:0,x:0,z:0,gy:0,y:0,h:0,fx:0,fz:1,rx:-1,rz:0,flying:false,onFoot:false,spd:0,wingX:0});
  if(st.lp){const jx=p.pos.x-st.lp.x,jz=p.pos.z-st.lp.z,j=Math.hypot(jx,jz);
   if(j>8){st.teleT=0.35;R.vx=R.vz=R.svx=R.svz=R.vy=0;st.side=null;st.slot=null;st.bad=null;}
   else{const k=1-Math.exp(-10*dt);R.svx+=(jx/dt-R.svx)*k;R.svz+=(jz/dt-R.svz)*k;R.vy+=(clamp((y-st.lp.y)/dt,-30,30)-R.vy)*k;}
   R.yawRate=damp(R.yawRate,wrap(p.heading-st.lp.h)/dt,8,dt);
   /* the smoothing above runs a tenth of a second behind; in a turn that points the velocity outward of
      where the horse is really going, so it is turned on by what the horse turns in that time */
   const a=R.yawRate*0.1,ca=Math.cos(a),sa=Math.sin(a);R.vx=R.svx*ca+R.svz*sa;R.vz=R.svz*ca-R.svx*sa;}
  else st.lp={x:0,z:0,y:0,h:0};
  st.lp.x=p.pos.x;st.lp.z=p.pos.z;st.lp.y=y;st.lp.h=p.heading;
  const h=p.heading;
  let wide=0;try{const hr=H.ridden();if(hr&&(hr.wings||hr.dragon)&&!p.onFoot)wide=0.8;}catch(e){}   // a pegasus: its folded wings, and its open ones in the air
  R.hs=(p.mesh&&p.mesh.scale&&p.mesh.scale.y)||1;R.x=p.pos.x;R.z=p.pos.z;R.gy=gy;R.y=y;R.h=h;R.fx=Math.sin(h);R.fz=Math.cos(h);R.rx=-Math.cos(h);R.rz=Math.sin(h);R.flying=!!p.flying;R.onFoot=!!p.onFoot;R.spd=Math.hypot(R.vx,R.vz);R.wingX=wide;
  if(st.badAt&&Math.hypot(R.x-st.badAt[0],R.z-st.badAt[1])>2)st.bad=null;   // a spot given up is only given up here
  return R;
 }
 /* Somewhere to come back from that the camera is not looking at: behind the rider first (behind the
    camera, in the riding view), then out to the sides, then further back. Never inside a building, against
    or across a fence from the rider, never in deep water unless the pet can swim it. Returns false when
    every spot is in view, and the pet keeps running instead. */
 const RELOC=[[0,-6.5],[-2.5,-6.5],[2.5,-6.5],[0,-9],[-5,-8.5],[5,-8.5],[0,-13],[-9,-4],[9,-4],[0,-18],[-14,0],[14,0],[-12,-12],[12,-12],[0,-26]];   // just behind the camera first: the shorter the run in, the sooner it is at your side
 function relocate(c,st,S,R,force){
  for(const [lx,lz] of RELOC){const x=R.x+R.rx*lx+R.fx*lz,z=R.z+R.rz*lx+R.fz*lz;if(blockedAt(x,z,S.rad+0.3)||wallAt(x,z,S.rad+0.2)||crossesWall(x,z,R.x,R.z))continue;const wa=waterAt(x,z);if(wa&&wa.depth>0.6&&!S.swim&&deckAt(x,z,0)==null)continue;
   const y=standY(x,z);if(inView(x,y+0.1,z,0.15)||inView(x,y+S.h,z,0.15))continue;
   c.pos.set(x,0,z);c.heading=Math.atan2(R.x-x,R.z-z);st.vx=R.vx;st.vz=R.vz;st.stuckT=0;st.bestD=1e9;st.needReloc=false;st.baseY=null;return true;}
  return false;
 }

 /* ================================================================ one frame ==================
    move(): the rider's speed and turn; which spot to go to; the ground or the air; then the pose. */
 function initState(c,S){
  const st={ph:Math.random()*TAU,fph:0,flapW:0,vx:0,vz:0,spd:0,air:'ground',airT:0,still:0,idle:null,idleWait:2+Math.random()*2,lastIdle:'',
   blinkT:1+Math.random()*3,blink:0,side:null,sideT:0,slot:null,slotI:-1,frameT:0,stuckT:0,bestD:1e9,teleT:0,needReloc:!!c.fresh,
   pitch:0,roll:0,lean:0,bank:0,flyPitch:0,yawRate:0,hopY:0,skim:0,earS:0,earV:0,tailS:0,lookYaw:0,lookPitch:0,p3:new THREE.Vector3(),v3:new THREE.Vector3(),
   wOpen:0,shakeT:0,tumbleT:0,foldT:0,wasFlying:false,landT:99,sagT:3+Math.random()*2,sag:0,burstT:0,pantT:0,lastSpd:0,hopAir:-1,baseY:null,q:newPose(),flySlot:null,flyT:0};
  if(!S.rad)S.rad=Math.max(0.42,clamp(S.w*0.6,0.18,0.3));   // at least world.js's own 0.4 push-out, so the two never pull against each other by a centimetre
  return st;
 }
 function move(c,dt,t){
  const P=c.parts;if(!P||!P.spec)return false;
  const S=P.spec,st=c.st||(c.st=initState(c,S));
  c.framed=true;if(!c.place)c.place=()=>place(c);
  if(!(dt>0)){place(c);return true;}
  dt=Math.min(dt,0.1);
  folTick(t);
  const R=rider(st,dt);
  st.pc=c.pos;st.frameT-=dt;if(st.frameT<=0||!st.slot){st.frameT=0.3;chooseSlot(st,S,R,t);}
  /* the birds' part in a flight */
  if(S.wings){
   if(st.air==='ground'&&R.flying){st.air='wait';st.airT=0;}
   if(st.air==='wait'){st.airT+=dt;if(!R.flying)st.air='ground';else if(st.airT>=S.wings.stagger){st.air='takeoff';st.airT=0;st.p3.set(c.pos.x,(st.baseY!=null?st.baseY:gH(c.pos.x,c.pos.z))+st.skim,c.pos.z);st.v3.set(st.vx,0,st.vz);st.idle=null;}}
   if((st.air==='takeoff'||st.air==='fly')&&!R.flying){st.air='landing';st.airT=0;}
   if(st.air==='landing'&&R.flying){st.air='fly';st.airT=0;}
  }
  if(!R.flying&&st.wasFlying){st.landT=0;st.landCheck=st.air==='ground'||st.air==='wait';}   // a ground pet left below: bring it back if it is far or out of sight (a bird lands on its own)
  st.wasFlying=R.flying;st.landT+=dt;
  if(st.air==='ground'||st.air==='wait')groundStep(c,st,S,R,dt,t);else flyStep(c,st,S,R,dt,t);
  c.airborne=!(st.air==='ground'||st.air==='wait');
  animate(c,st,S,R,dt,t);
  realTick(c,st,dt);   // the real animal's body, when this pet has one
  return true;
 }
 function freeDir(h,px,pz,look,rad){const x=px+Math.sin(h)*look,z=pz+Math.cos(h)*look;return !blockedAt(x,z,rad+0.15)&&!wallAt(x,z,rad+0.1);}
 function groundStep(c,st,S,R,dt,t){
  const sl=st.slot||[1.5,0.5];
  let tx=R.x+R.rx*sl[0]+R.fx*sl[1],tz=R.z+R.rz*sl[0]+R.fz*sl[1];
  {const q=clearSpot(tx,tz,S.rad+0.2);tx=q[0];tz=q[1];}
  /* crossing to the other side goes round the horse, never through it: round the front — behind the horse
     is below the bottom edge of the riding picture, so going round the tail took it out of sight for a
     second or more — unless it is already behind the horse */
  if(!R.flying&&!R.onFoot&&(R.y-R.gy)<0.6){
   const lx=(c.pos.x-R.x)*R.rx+(c.pos.z-R.z)*R.rz,lz=(c.pos.x-R.x)*R.fx+(c.pos.z-R.z)*R.fz,sx=(tx-R.x)*R.rx+(tz-R.z)*R.rz,sz=(tx-R.x)*R.fx+(tz-R.z)*R.fz,hw=0.5+S.w*0.5;
   let hit=false;for(let k=1;k<8&&!hit;k++){const u=k/8,px=lerp(lx,sx,u),pz=lerp(lz,sz,u);if(Math.abs(px)<hw&&pz>-1.3&&pz<1.05)hit=true;}   // the straight line would go through the horse's legs
   if(hit){const front=lz>-1.0,wx=(Math.sign(lx)||1)*(hw+0.35),wz=front?2.2+Math.min(TUNE.wzMax!=null?TUNE.wzMax:0.6,R.spd*0.055):-1.9;   /* at speed a little further ahead, where the lens sees over the horse's chest */tx=R.x+R.rx*wx+R.fx*wz;tz=R.z+R.rz*wx+R.fz*wz;   // the near corner (a fixed point: chasing its own distance out, it drifted wide in a turn)
    if(front?(lz>wz-0.9||Math.hypot(lx-wx,lz-wz)<0.6):lz<-1.45){const ox=Math.sign(sx)*(hw+0.35);tx=R.x+R.rx*ox+R.fx*wz;tz=R.z+R.rz*ox+R.fz*wz;}}}   // round the front (or the back, if it is already behind), never between the legs
  /* left far behind — a fast travel, a course start, a long flight, a stuck corner: come back unseen */
  if(st.teleT>0){st.teleT-=dt;if(st.teleT<=0)st.needReloc=true;}
  let ex=tx-c.pos.x,ez=tz-c.pos.z,d=Math.hypot(ex,ez);
  if(d>(R.flying?50:30))st.needReloc=true;
  if(st.landCheck&&!R.flying){st.landCheck=false;if(d>12||!inView(c.pos.x,standY(c.pos.x,c.pos.z)+0.2,c.pos.z,0.05))st.needReloc=true;}   // just landed from a flight
  if(st.needReloc&&st.teleT<=0){if(relocate(c,st,S,R))st.needReloc=false;else if(d<14)st.needReloc=false;ex=tx-c.pos.x;ez=tz-c.pos.z;d=Math.hypot(ex,ez);}
  if(d>120&&!inView(tx-R.fx*9,gH(tx-R.fx*9,tz-R.fz*9)+0.2,tz-R.fz*9,0.1)){c.pos.set(tx-R.fx*9,0,tz-R.fz*9);st.baseY=null;ex=tx-c.pos.x;ez=tz-c.pos.z;d=Math.hypot(ex,ez);}   // last resort
  /* the speed: the spot's own — the horse's, plus the swing of a spot beside a turning horse — and a
     catch-up along the gap, with no cap, so a gallop never leaves it behind; harder in a held turn */
  let vx=R.vx+R.yawRate*(tz-R.z),vz=R.vz-R.yawRate*(tx-R.x);
  const turning=Math.abs(R.yawRate)>0.6&&R.spd>2;
  const gain=d>0.05?clamp((turning?3.4:2.2)*d,0,turning?12:8)+(d>10?(d-10)*0.9:0):0;
  if(d>0.05){vx+=ex/d*gain;vz+=ez/d*gain;}
  if(R.spd<0.25&&d<0.18){vx=0;vz=0;}
  const onDeck=deckAt(c.pos.x,c.pos.z,0)!=null,wa=onDeck?null:waterAt(c.pos.x,c.pos.z),swim=wa&&wa.depth>(S.wade||0.3);
  if(swim&&!S.swim){const k=R.flying?0.5:0.75;vx*=k;vz*=k;}
  let spd=Math.hypot(vx,vz);
  /* a whisker ahead: round a tree or a rock on the side away from the horse, so it never swerves across the horse's nose */
  if(spd>0.3&&!st.hop){const h0=Math.atan2(vx,vz),look=Math.min(2.4,0.6+spd*0.18);
   if(!freeDir(h0,c.pos.x,c.pos.z,look,S.rad)){const out=((c.pos.x-R.x)*R.rx+(c.pos.z-R.z)*R.rz)>=0?1:-1;let pick=null;
    for(const a of [0.5,0.9,1.3]){const hA=h0+a,hB=h0-a,oA=(Math.sin(hA)*R.rx+Math.cos(hA)*R.rz)*out,oB=(Math.sin(hB)*R.rx+Math.cos(hB)*R.rz)*out,h1=oA>=oB?hA:hB,h2=oA>=oB?hB:hA;
     if(freeDir(h1,c.pos.x,c.pos.z,look,S.rad)){pick=h1;break;}if(freeDir(h2,c.pos.x,c.pos.z,look,S.rad)){pick=h2;break;}}
    if(pick!=null){vx=Math.sin(pick)*spd;vz=Math.cos(pick)*spd;}}}
  /* the grip it has: enough to hold a spot beside a horse galloping round a tight circle, where following
     the spot means turning its own speed as fast as the horse turns */
  const acc=(S.accel||32)*(d>6?1.6:1)+Math.abs(R.yawRate)*Math.hypot(vx,vz)*1.3,dvx=vx-st.vx,dvz=vz-st.vz,dv=Math.hypot(dvx,dvz),mx=acc*dt;
  if(dv>mx){st.vx+=dvx/dv*mx;st.vz+=dvz/dv*mx;}else{st.vx=vx;st.vz=vz;}
  /* a hop over what it is stuck behind */
  if(st.hop){st.hop.t+=dt;const k=Math.min(1,st.hop.t/0.5);st.hopY=Math.sin(Math.PI*k)*0.45;c.pos.x+=st.hop.dx*2.6*dt;c.pos.z+=st.hop.dz*2.6*dt;if(k>=1){st.hop=null;st.hopY=0;}}
  /* the bunny and the hare cover their ground in the air, and barely creep while their feet are down */
  const hk=S.kind==='bunny'&&!swim&&!st.hop&&st.hopAir>=0?(st.hopAir?1.3:0.3):1;
  c.pos.x+=st.vx*dt*hk;c.pos.z+=st.vz*dt*hk;
  pushOutPet(c,S,!!st.hop);
  /* keep out of the horse itself */
  if(!R.flying&&!R.onFoot&&(R.y-R.gy)<0.6){const px=(c.pos.x-R.x)*R.rx+(c.pos.z-R.z)*R.rz,pz=(c.pos.x-R.x)*R.fx+(c.pos.z-R.z)*R.fz,hw=0.46+S.w*0.5+(R.wingX||0)*0.25;
   if(Math.abs(px)<hw&&pz>-1.55&&pz<1.15){   /* the horse from tail to nose (measured), no further: in front of its chest is the way across */const push=(Math.sign(px)||1)*hw-px;c.pos.x+=R.rx*push*Math.min(1,dt*12);c.pos.z+=R.rz*push*Math.min(1,dt*12);}}
  if(R.onFoot){try{const hs=G.onFoot&&G.onFoot.horse&&G.onFoot.horse();if(hs){const dx=c.pos.x-hs.x,dz=c.pos.z-hs.z,dd=Math.hypot(dx,dz),r=1.1+S.rad;if(dd<r&&dd>0.01){c.pos.x=hs.x+dx/dd*r;c.pos.z=hs.z+dz/dd*r;}}}catch(e){}}
  /* stuck against a fence or a bank: a little hop, then come back unseen */
  if(d>4){if(d<st.bestD-0.3){st.bestD=d;st.stuckT=0;}else st.stuckT+=dt;}else{st.bestD=d;st.stuckT=0;}
  if(st.stuckT>1.5&&!st.hop&&!swim){st.hop={t:0,dx:ex/d,dz:ez/d};}
  if(st.stuckT>3){st.needReloc=true;st.stuckT=0;st.bestD=1e9;}
  /* close to its spot but not getting there (a tree trunk between them): give that spot up while the rider stays here */
  if(d>0.35&&d<4&&R.spd<1.5&&!st.hop&&st.slotI>=0){if(st.progS!==st.slotI||d<(st.progD||1e9)-0.3){st.progS=st.slotI;st.progD=d;st.blockT=0;}else{st.blockT=(st.blockT||0)+dt;if(st.blockT>1.6){st.bad=st.bad||{};st.bad[st.slotI]=t+8;st.badAt=[R.x,R.z];st.frameT=0;st.blockT=0;st.progD=1e9;}}}else{st.blockT=0;st.progD=1e9;}
  st.spd=Math.hypot(st.vx,st.vz);
  const spinning=st.idle&&st.idle.name==='spin';
  if(st.spd>0.35){const want=Math.atan2(st.vx,st.vz),dh=wrap(want-c.heading),turn=cl1(dh,(st.spd>3?7:9)*dt);c.heading+=turn;st.yawRate=damp(st.yawRate,turn/dt,8,dt);}
  else{
   /* standing still: after a moment it turns three-quarters towards the camera, angled towards the rider,
      so from the saddle you see its face and not its back */
   if(!spinning){let want=R.h;if((st.still||0)>1.0){const cp=G.camera.position,sd=((c.pos.x-R.x)*R.rx+(c.pos.z-R.z)*R.rz)>=0?1:-1;want=Math.atan2(cp.x-c.pos.x,cp.z-c.pos.z)-sd*0.85;}
    c.heading+=cl1(wrap(want-c.heading),1.6*dt);}
   st.yawRate=damp(st.yawRate,0,6,dt);}
  st.swim=!!swim;
  /* the birds skim-fly to keep up: the owl glides a hand's breadth over the grass above a trot; the duckling
     and the chick waddle and scurry up to a canter and only then flap along in short bursts */
  const skimOn=S.wings&&!swim&&st.spd>(S.wings.skim||4.2);
  st.skim=damp(st.skim,skimOn?(S.wings.skimH||(S.walk==='hop'?0.55:0.22)):0,skimOn?4:6,dt);   // skimH: a flyer whose legs hang low in flight skims higher (the wyvern)
 }
 /* on a phone held upright the flying birds keep above and behind the rider, and the exact spot is
    picked the way the ground spot is: a few candidates projected into the picture, the best kept */
 const FLYC=[];for(const lx of [0.45,0.7,0.95])for(const lz of [-2.0,-2.3,-2.6])for(const ly of [2.3,2.9])FLYC.push([lx,lz,ly]);   // not further back: in a turn the lens swings round towards a bird trailing far behind
 function flySlotNarrow(st,S,R,t){
  const cam=G.camera,Wd=innerWidth,Hd=innerHeight,frame=[Wd*0.06,Hd*0.1,Wd*0.94,Hd*0.86],HR=hud(t),p3=st.p3;
  let best=null,bs=-1e9;
  for(const s of [st.flySide,-st.flySide])for(const c of FLYC){const lx=c[0]*s,x=R.x+R.rx*lx+R.fx*c[1],z=R.z+R.rz*lx+R.fz*c[1],y=R.y+c[2];
   const b=projBox([[x-0.28,y-0.25,z-0.28],[x+0.28,y-0.25,z+0.28],[x-0.28,y+0.3,z+0.28],[x+0.28,y+0.3,z-0.28]]);if(!b)continue;
   const area=Math.max(1,(b[2]-b[0])*(b[3]-b[1])),inF=ovl(b,frame)/area;let hu=0;for(const r of HR)hu=Math.max(hu,ovl(b,r)/area);
   const sc=inF*2-hu*1.2-(s!==st.flySide?0.8:0)-Math.hypot(x-p3.x,y-p3.y,z-p3.z)*0.05;   // crossing over behind the rider takes it past the lens: only when this side is out of the picture
   if(sc>bs){bs=sc;best=[lx,c[1],c[2],s];}}
  if(best&&st.flySlot&&best!==st.flySlot){/* hysteresis: keep the current one unless the new one is clearly better */
   const c=st.flySlot,x=R.x+R.rx*c[0]+R.fx*c[1],z=R.z+R.rz*c[0]+R.fz*c[1],y=R.y+c[2],b=projBox([[x-0.28,y-0.25,z-0.28],[x+0.28,y-0.25,z+0.28],[x-0.28,y+0.3,z+0.28],[x+0.28,y+0.3,z-0.28]]);
   if(b){const area=Math.max(1,(b[2]-b[0])*(b[3]-b[1]));if(ovl(b,frame)/area>0.97&&bs<2.1)return st.flySlot;}}
  if(best&&best[3]!==st.flySide)st.flySide=best[3];
  return best||st.flySlot||[0.7*st.flySide,-2.65,2.9];
 }
 function flyStep(c,st,S,R,dt,t){
  const Wg=S.wings,narrow=G.camera.aspect<1;st.airT+=dt;
  let tx,ty,tz,om=Wg.omega;
  const p3=st.p3,v3=st.v3;
  if(st.air==='landing'){
   const sl=st.slot||[1.5,0.5];tx=R.x+R.rx*sl[0]+R.fx*sl[1];tz=R.z+R.rz*sl[0]+R.fz*sl[1];{const q=clearSpot(tx,tz,S.rad+0.2);tx=q[0];tz=q[1];}ty=standY(tx,tz)-0.25;om=3.1;
  }else{
   /* the side is kept for most of the flight: a turn swings the camera wide, but a bird three metres out and
      two up is not hidden by the horse, and crossing over would take it out of the picture */
   if(st.flySide==null)st.flySide=st.side||1;
   if(narrow){}   /* on a phone the bird flies close above the rider: the spot picker below keeps it in the picture */
   else if(st.side!==st.flySide){st.flySideT=(st.flySideT||0)+dt;if(st.flySideT>3){st.flySide=st.side;st.flySideT=0;}}else st.flySideT=0;
   let ox,oz,oy;
   if(narrow){st.flyT-=dt;if(st.flyT<=0||!st.flySlot){st.flyT=0.3;st.flySlot=flySlotNarrow(st,S,R,t);}ox=st.flySlot[0];oz=st.flySlot[1];oy=st.flySlot[2];}
   else{ox=(Wg.boxX+0.25)*st.flySide;oz=-0.9;oy=1.9;
    const lx=(p3.x-R.x)*R.rx+(p3.z-R.z)*R.rz,lz=(p3.x-R.x)*R.fx+(p3.z-R.z)*R.fz;
    if(lx*ox<0&&lz>-2.4){ox=Math.sign(lx)*Math.max(Math.abs(lx),1);oz=-3.0;}}   // changing sides: round behind the wings
   tx=R.x+R.rx*ox+R.fx*oz;tz=R.z+R.rz*ox+R.fz*oz;
   const bob=S.walk==='hop'?Math.sin(t*TAU*0.5)*0.2:S.walk==='waddle'?Math.sin(t*TAU)*0.15:Math.sin(t*TAU*2.5)*0.12;
   if(S.walk==='scurry'){st.sagT-=dt;if(st.sagT<=0){st.sag=0.6;st.sagT=3+Math.random()*2;}st.sag=Math.max(0,st.sag-dt);}
   ty=R.y+oy+bob-(st.sag>0?Math.sin(Math.PI*st.sag/0.6)*0.3:0);
   if(st.air==='takeoff'){ty=Math.min(ty,gH(p3.x,p3.z)+0.4+st.airT*26);om=Math.max(om,5.2);if(st.airT<0.1){tx=p3.x;tz=p3.z;ty=p3.y;}if(st.airT>0.7)st.air='fly';}
  }
  const rvy=st.air==='landing'?0:clamp(R.vy,-12,12);
  /* the spot's own velocity: the horse's, plus its swing round a turning horse (without it the bird lagged
     a couple of metres outward of its spot all through a turn, off the side of a phone's picture) */
  const svx=R.vx+R.yawRate*(tz-R.z),svz=R.vz-R.yawRate*(tx-R.x);
  const ax=om*om*(tx-p3.x)-2*om*(v3.x-svx)+R.yawRate*svz,ay=om*om*(ty-p3.y)-2*om*(v3.y-rvy),az=om*om*(tz-p3.z)-2*om*(v3.z-svz)-R.yawRate*svx;   // and its turning (a pegasus turns hard: without this the bird trailed metres behind its spot)
  if(st.air==='takeoff'&&st.airT>=0.1&&st.airT<0.16)v3.y=Math.max(v3.y,3.5);
  v3.x+=ax*dt;v3.y+=ay*dt;v3.z+=az*dt;
  if(st.air!=='landing'&&p3.y>ty+0.25&&v3.y>rvy)v3.y=rvy+(v3.y-rvy)*Math.exp(-9*dt);   // no sailing up past its height after the take-off climb
  const vmax=st.air==='landing'?26:48,vl=v3.length();if(vl>vmax)v3.multiplyScalar(vmax/vl);
  p3.addScaledVector(v3,dt);
  /* never inside the horse's open wings */
  if(R.flying){const lx=(p3.x-R.x)*R.rx+(p3.z-R.z)*R.rz,lz=(p3.x-R.x)*R.fx+(p3.z-R.z)*R.fz,ly=p3.y-R.y,X=Wg.boxX;
   if(Math.abs(lx)<X&&lz>-1.9&&lz<1.2&&ly>-0.3&&ly<3.7){
    /* out by the nearest face: sideways past the wing tips, or back behind them, or forward past them */
    const px=X-Math.abs(lx),pb=lz+1.9,pf=1.2-lz,k=Math.min(1,dt*14);
    if(px<=pb&&px<=pf){const s=Math.sign(lx)||st.side||1,dl=(s*X-lx)*k;p3.x+=R.rx*dl;p3.z+=R.rz*dl;const vr=v3.x*R.rx+v3.z*R.rz;if(vr*s<0){v3.x-=R.rx*vr;v3.z-=R.rz*vr;}}
    else{const s=pb<pf?-1:1,dl=(s<0?-1.9-lz:1.2-lz)*k;p3.x+=R.fx*dl;p3.z+=R.fz*dl;const vf=(v3.x-R.vx)*R.fx+(v3.z-R.vz)*R.fz;if(vf*s<0){v3.x-=R.fx*vf;v3.z-=R.fz*vf;}}}}
  const g=standY(p3.x,p3.z);
  if(st.air!=='landing'){if(p3.y<g+0.35){p3.y=g+0.35;if(v3.y<0)v3.y=0;}}
  else if(p3.y<g){p3.y=g;if(v3.y<0)v3.y=0;}
  /* a hard failsafe: if the bird is ever far from its spot and out of sight, it is simply there */
  if(st.air==='fly'){const dT=Math.hypot(tx-p3.x,ty-p3.y,tz-p3.z);if(dT>25&&(!inView(p3.x,p3.y,p3.z,0.1)||dT>45)){p3.set(tx,ty,tz);v3.set(R.vx,rvy,R.vz);}}
  if(st.air==='landing'){
   const h=p3.y-g,dH=Math.hypot(tx-p3.x,tz-p3.z);
   if(st.airT>3.5){const k=Math.min(1,dt/0.4);p3.x+=(tx-p3.x)*k;p3.z+=(tz-p3.z)*k;p3.y+=(g-p3.y)*k;}
   if(h<0.06&&(dH<0.9||st.airT>2.2)||st.airT>3.9)touchdown(c,st,S);
  }
  c.pos.x=p3.x;c.pos.z=p3.z;c.alt=p3.y-g;
  /* face along the flight, bank with the horse through the turns (a little more than it does), nose up in a climb */
  const vh=Math.hypot(v3.x,v3.z),yawT=vh>2?Math.atan2(v3.x,v3.z):R.h,dh=wrap(yawT-c.heading),turn=cl1(dh,6*dt);
  c.heading+=turn;st.yawRate=damp(st.yawRate,turn/dt,6,dt);
  const aLat=ax*(-Math.cos(c.heading))+az*Math.sin(c.heading);let roll=0;try{roll=player.mesh?player.mesh.rotation.z:0;}catch(e){}
  st.bank=damp(st.bank,clamp(-st.yawRate*0.2+clamp(aLat,-20,20)*0.01,-0.6,0.6)*0.6+roll*0.4,4,dt);
  st.flyPitch=damp(st.flyPitch,clamp(-v3.y*0.05,-0.45,0.45),5,dt);
  st.spd=vh;st.vx=v3.x;st.vz=v3.z;
  place(c);
 }
 function touchdown(c,st,S){
  st.air='ground';st.airT=0;st.flySide=null;st.flySlot=null;st.landCheck=false;st.vx=st.v3.x;st.vz=st.v3.z;st.bank=0;st.flyPitch=0;st.skim=0;st.foldT=0.35;st.baseY=null;
  if(S.walk==='scurry')st.tumbleT=0.45;else st.shakeT=0.32;
  st.hopY=0;st.idle=null;st.idleWait=1.5;
  try{if(W.puffDust)W.puffDust(c.pos.x,gH(c.pos.x,c.pos.z),c.pos.z);}catch(e){}
 }
 function place(c){
  const P=c.parts,S=P.spec,st=c.st,root=P.group;if(!st){root.position.set(c.pos.x,standY(c.pos.x,c.pos.z),c.pos.z);root.rotation.set(0,c.heading,0);return;}
  const x=c.pos.x,z=c.pos.z,gy=gH(x,z);
  if(!(st.air==='ground'||st.air==='wait')){
   root.position.set(x,st.p3.y,z);root.rotation.set(st.flyPitch,c.heading,st.bank);
   const g2=standY(x,z);if(P.shadow){P.shadow.visible=c.alt<1.5;P.shadow.position.y=g2-st.p3.y+0.02;}
   c.alt=st.p3.y-g2;return;
  }
  /* the planks of a boardwalk, or the ground; stepping up onto the planks is quick but not a jump cut */
  const base0=standY(x,z),onDeck=base0>gy+0.02;
  const jump=st.baseY==null?0:Math.abs(st.baseY-base0);
  st.baseY=(jump>0.15&&jump<1.5)?damp(st.baseY,base0,16,0.016):base0;   // only a step up onto the planks (or down off them) is eased; the ground itself is followed exactly
  let y=st.baseY;const wa=onDeck?null:waterAt(x,z);
  if(wa&&wa.depth>(S.wade||0.3))y=Math.max(gy,wa.surface-(S.swim?S.swim.sink:S.h*0.42));
  const hl=S.len*0.5,fx=Math.sin(c.heading)*hl,fz=Math.cos(c.heading)*hl,lw=S.w*0.5,lx=Math.cos(c.heading)*lw,lz=-Math.sin(c.heading)*lw;
  const flat=y>gy+0.01;
  const pt=flat?0:clamp(-Math.atan2(gH(x+fx,z+fz)-gH(x-fx,z-fz),S.len),-0.45,0.45),rl=flat?0:clamp(Math.atan2(gH(x+lx,z+lz)-gH(x-lx,z-lz),S.w),-0.35,0.35);
  st.pitch=damp(st.pitch,pt,12,0.016);st.roll=damp(st.roll,rl,12,0.016);
  /* a real body does its own hops and spins in its clips: only the bunny without a hop clip keeps the drawn hop's arc */
  const real=realShown(P),hq=st.q?st.q.hopY:0;
  const air=st.hopY+st.skim+(real?(S.kind==='bunny'&&st.hopAir>=0&&!P.real.inst.has('hop')?hq:0):hq);
  root.position.set(x,y+air,z);
  root.rotation.set(st.pitch,c.heading+(st.q&&!real?st.q.spin:0),st.roll+st.lean);
  if(P.shadow){P.shadow.visible=true;P.shadow.position.y=0.015-air;}
  c.alt=y+air-gy;
 }

 /* ---------------------------------------------------------------- the pose for this frame ------ */
 function animate(c,st,S,R,dt,t){
  const P=c.parts,q=resetPose(st.q),kind=S.kind,flying=!(st.air==='ground'||st.air==='wait');
  const spd=flying?0:st.spd;
  if(!flying){
   if(st.skim>0.08&&S.wings){birdGait(q,st,S,0,dt,t);q.wOpen=clamp(st.skim/(S.walk==='hop'?0.45:0.18),0,1);setL(q,0,0.9,0);setL(q,1,0.9,0);
    flapPose(q,st,S,dt,S.walk==='hop'?3:S.wings.hz,S.wings.amp*0.8,S.walk==='hop'&&Math.sin(t*1.7)>0.2);q.bp=S.walk==='hop'?0.5:0.2;q.hp=q.bp*0.9;}
   else if(kind==='quad')quadGait(q,st,S,P,spd,dt);
   else if(kind==='bunny')bunnyGait(q,st,S,spd,dt);
   else birdGait(q,st,S,spd,dt,t);
   if(st.swim){for(let i=0;i<q.legs.length;i++)setL(q,i,Math.sin(t*9+i*1.7)*0.6,0.5);q.bp=-0.12;q.hp=0.25;q.flat=0;}
   q.br+=-st.yawRate*(kind==='bird'?0.12:0.06)*clamp(spd/3,0,1);
  }else{
   /* in the air */
   const Wg=S.wings,climbing=R.vy>1.2||(player.climbInput||0)>0,desc=st.v3.y<-1.6;
   let hz=climbing?Wg.climbHz:Wg.hz,glide=false;
   if(Wg.glide==='bursts'){st.burstT=(st.burstT+dt)%2.3;glide=!climbing&&(st.burstT>1.4||desc);}
   else if(Wg.glide==='descend')glide=desc&&!climbing;
   if(st.air==='takeoff'){hz*=1.5;glide=false;}
   let amp=Wg.amp;
   if(st.air==='landing'){const h=c.alt;if(h<1.2){hz=Wg.hz*0.9;amp=Wg.amp*1.1;glide=false;}else glide=S.walk!=='scurry';}
   if(S.walk==='scurry'&&st.sag>0){hz*=1.25;}
   q.wOpen=st.air==='takeoff'?clamp(st.airT/0.25,0,1):1;
   flapPose(q,st,S,dt,hz,amp,glide);st.glideNow=glide;st.flapHz=hz;
   if(glide&&desc&&st.air!=='landing')q.wBack=0.45;
   const flare=st.air==='landing'&&c.alt<1.2;
   q.bp=flare?Wg.pitchFly*0.35:Wg.pitchFly;q.hp=q.bp*0.95;
   if(S.walk==='scurry'){const g=Math.sin(t*9)*0.35;setL(q,0,g,0);setL(q,1,g,0);}else{const g=flare?-0.3-Wg.pitchFly*0.3:clamp(1.35-Wg.pitchFly,0,1.35);setL(q,0,g,0);setL(q,1,g,0);}
   if(S.walk==='waddle'&&!flare)q.hp=q.bp+0.2;
   if(st.air==='takeoff'&&st.airT<0.12){q.by=-0.04;q.bp=0.2;}
  }
  /* folding the wings away after landing; the shake; the chick's tumble */
  if(st.foldT>0){st.foldT-=dt;q.wOpen=Math.max(q.wOpen,st.foldT/0.35);q.wFlap=0.15;}
  if(st.shakeT>0){st.shakeT-=dt;q.br+=Math.sin(t*TAU*8)*0.2;}
  if(st.tumbleT>0){st.tumbleT-=dt;q.br+=(1-st.tumbleT/0.45)*TAU;}
  /* where it looks: at the rider while it moves; stopped, into the camera — at you */
  const still=!flying&&spd<0.3;
  st.still=still?st.still+dt:0;
  const cp=G.camera.position,atCam=still&&st.still>1.0,lx0=atCam?cp.x:R.x,lz0=atCam?cp.z:R.z,ly0=atCam?cp.y:R.y+(R.onFoot?1.5:2.2);
  const hx=lx0-c.pos.x,hz=lz0-c.pos.z,dd=Math.hypot(hx,hz)||1,hyTo=wrap(Math.atan2(hx,hz)-c.heading),hpTo=Math.atan2(ly0-((st.baseY!=null?st.baseY:gH(c.pos.x,c.pos.z))+S.h),dd);
  st.lookYaw=hyTo;
  const lookK=still&&st.still>0.6?1:0,yawLim=S.walk==='hop'?2.2:0.9;
  st.lookY=damp(st.lookY||0,lookK*clamp(hyTo,-yawLim,yawLim),4,dt);st.lookP=damp(st.lookP||0,lookK*clamp(hpTo,-0.3,0.6),4,dt);
  q.hy+=st.lookY;q.hp+=st.lookP;
  /* idles */
  if(still&&!st.swim&&S.idles){
   if(!st.idle){st.idleWait-=dt;if(st.idleWait<=0&&st.still>1.5){
    let tot=0;for(const i of S.idles)if(i[0]!==st.lastIdle)tot+=i[1];let r=Math.random()*tot,pick=null;for(const i of S.idles){if(i[0]===st.lastIdle)continue;if(!pick)pick=i[0];r-=i[1];if(r<=0){pick=i[0];break;}}
    st.idle={name:pick,T:(IDLE_T[pick]||2)*(0.85+Math.random()*0.3),u:0,side:Math.random()<0.5?-1:1};st.lastIdle=pick;}}
  }else if(st.idle){st.idle.out=true;}
  if(st.idle){const I=st.idle;I.u+=dt/I.T;if(I.out)I.fade=(I.fade||1)-dt*5;
   const long=I.name==='sit'||I.name==='lie'||I.name==='periscope'||I.name==='wash'||I.name==='groom';
   const e=(long?sstep(0,0.15,I.u)*(1-sstep(0.85,1,I.u)):sstep(0,0.1,I.u)*(1-sstep(0.9,1,I.u)))*(I.fade!=null?clamp(I.fade,0,1):1);
   idlePose(q,st,S,I.name,clamp(I.u,0,1),e,t,I.side);
   if(I.name==='swivel'||I.name==='look'||I.name==='preen')q.hy-=st.lookY*e;
   if(I.u>=1||(I.fade!=null&&I.fade<=0)){st.idle=null;st.idleWait=3+Math.random()*4;}}
  /* the dog pants after a run */
  if(st.lastSpd>6&&spd<1)st.pantT=4;st.lastSpd=spd;
  if(st.pantT>0){st.pantT-=dt;q.tongue=Math.max(q.tongue,Math.min(1,st.pantT)*(0.8+0.25*Math.sin(t*19)));}
  /* ears and tail: a spring that lags the body; the tail wags harder when you stop beside it or the pair glows */
  const accF=(spd-(st.spPrev||0))/dt;st.spPrev=spd;
  const earT=q.earX-clamp(accF*0.015,-0.3,0.3);st.earV+=((earT-st.earS)*55-st.earV*9)*dt;st.earS+=st.earV*dt;q.earX=st.earS;
  if(S.ears&&S.ears.type==='flop')q.earZ=-clamp(spd*0.05,0,0.5)-0.35*sstep(4.6,6.4,spd)+Math.sin(t*8)*0.04*st.moveW;   // floppy ears stream back and out at a gallop
  const T=S.tail;
  if(T&&(T.segs||T.fused)){const happy=(c.combo||0)>0.5||(still&&st.still<2.5&&st.idle==null)?1:0;const hz2=T.wagHz*(happy?2.2:1);q.tailY+=Math.sin(t*TAU*hz2)*T.wag*(still?1:0.45)+(T.sway?Math.sin(st.ph)*T.sway*st.moveW:0);q.tailW=Math.max(q.tailW,0.12);}
  else if(T&&T.puff&&T.puff.wig){q.tailY=Math.sin(t*TAU*8)*0.5*st.moveW;}
  else if(T&&T.puff){q.tailY=Math.sin(t*TAU*6)*0.2*st.moveW;}
  /* blink every few seconds */
  st.blinkT-=dt;if(st.blinkT<=0){st.blink=0.13;st.blinkT=2.5+Math.random()*3.5;}
  if(st.blink>0){st.blink-=dt;q.blink=0.12;}
  /* the glimmer fox's light and sparkles */
  if(P.extra.halo){P.extra.halo.material.opacity=0.26+0.1*Math.sin(t*TAU*0.6);P.extra.halo.position.y=S.piv+q.by+0.04;}
  if(P.extra.sparks){const sp=P.extra.sparks,a=sp.pts.geometry.attributes.position,tl=S.sparkle.tail;
   for(let i=0;i<sp.n;i++){sp.life[i]+=dt*(tl?0.7:0.45);if(sp.life[i]>1){sp.life[i]=0;}const l=sp.life[i],sd=i*12.9898;
    const bx=tl?Math.sin(sd)*0.08:Math.sin(sd)*0.3,bz=tl?-0.6*(S.scale||1)+Math.cos(sd)*0.08:Math.cos(sd*1.3)*0.3,by=tl?S.piv+0.02:0.1+Math.abs(Math.sin(sd*0.7))*0.2;
    a.setXYZ(i,bx+Math.sin(t*2+sd)*0.03,by+l*(tl?0.45:0.25),bz);}
   a.needsUpdate=true;sp.pts.material.opacity=0.55+0.4*Math.sin(t*5);}
  if(S.fx)try{S.fx(P,c,st,dt,t,{flying,spd,real:realShown(P)});}catch(e){}   // a package's own per-frame effects (pet-fantasy.js)
  if(!flying){st.lean=damp(st.lean,0,6,dt);place(c);}
  if(realShown(P))return;   // the drawn rig is hidden behind a real body: no need to pose it
  apply(P,q,t);
  /* nothing below the ground: a sitting tail, a bowing chest, a landing bunny's belly */
  if(!flying&&!st.swim){const lift=floorLift(P,st.moveW>0.5&&kind!=='bunny');if(lift>0.0005)P.bodyPivot.position.y+=lift;}
 }

 /* ================================================================ portraits ==================
    One drawn portrait per pet, 64 units square with a transparent background (the menu row gives
    the paper and the rarity ring): flat fills, one lighter highlight, an outline in a darker shade of
    the fill, eyes with a white catchlight — the same family as the icons no-emoji.js draws. */
 let PORTRAITS=null;
 function portraits(){
  if(PORTRAITS)return PORTRAITS;
  const EYEp=(cx,cy,r,iris,ring)=>{let s='';if(ring)s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(r+0.9)+'" fill="'+ring+'"/>';
   if(iris)s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+r+'" ry="'+(r*1.08).toFixed(2)+'" fill="'+iris+'"/><ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(r*0.52).toFixed(2)+'" ry="'+(r*0.62).toFixed(2)+'" fill="#1c130e"/>';
   else s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+r+'" ry="'+(r*1.08).toFixed(2)+'" fill="#24180f"/>';
   return s+'<circle cx="'+(cx-r*0.34).toFixed(2)+'" cy="'+(cy-r*0.4).toFixed(2)+'" r="'+(r*0.4).toFixed(2)+'" fill="#fff"/><circle cx="'+(cx+r*0.34).toFixed(2)+'" cy="'+(cy+r*0.38).toFixed(2)+'" r="'+(r*0.16).toFixed(2)+'" fill="#fff" opacity=".85"/>';};
  const MIR=d=>d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g,(m,x,y)=>(64-parseFloat(x)).toFixed(2).replace(/\.?0+$/,'')+' '+y);
  const Pp=(d,fill,stroke,w)=>'<path d="'+d+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+(w||1.7)+'" stroke-linejoin="round" stroke-linecap="round"':'')+'/>';
  const PAIR=(d,fill,stroke,w)=>Pp(d,fill,stroke,w)+Pp(MIR(d),fill,stroke,w);
  const E=(cx,cy,rx,ry,fill,stroke,w,op)=>'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+(w||1.7)+'"':'')+(op!=null?' opacity="'+op+'"':'')+'/>';
  const Ln=(d,stroke,w,op)=>'<path d="'+d+'" fill="none" stroke="'+stroke+'" stroke-width="'+(w||1.3)+'" stroke-linecap="round" stroke-linejoin="round"'+(op!=null?' opacity="'+op+'"':'')+'/>';
  const SPARK=(x,y,r,fill,stroke)=>'<path d="M'+x+' '+(y-r)+'Q'+(x+r*0.18)+' '+(y-r*0.18)+' '+(x+r)+' '+y+'Q'+(x+r*0.18)+' '+(y+r*0.18)+' '+x+' '+(y+r)+'Q'+(x-r*0.18)+' '+(y+r*0.18)+' '+(x-r)+' '+y+'Q'+(x-r*0.18)+' '+(y-r*0.18)+' '+x+' '+(y-r)+'Z" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width=".8"':'')+'/>';
  const BLUSH=(y,col,dx)=>E(32-(dx||11),y,3.2,2,col||'#f08c8c',null,null,0.42)+E(32+(dx||11),y,3.2,2,col||'#f08c8c',null,null,0.42);
  const CHEST=(fill,stroke)=>Pp('M14 64C16 52 24 47.5 32 47.5C40 47.5 48 52 50 64Z',fill,stroke);
  const foxFace=c=>PAIR('M14 27L16.5 5.5L29 18Z',c.fur,c.line)+PAIR('M17.3 22L18.4 10.8L25.4 18.3Z',c.inner)+PAIR('M15.9 12.2L16.5 5.5L20.6 9.8Z',c.tip)
   +Pp('M32 14C43 14 50 22 51 30C52 35 54 38 56.5 40.5C50.5 41.5 45 44.5 40 47.5L32 53L24 47.5C19 44.5 13.5 41.5 7.5 40.5C10 38 12 35 13 30C14 22 21 14 32 14Z',c.fur,c.line)
   +Pp('M7.5 40.5C13.5 38.5 20 37.5 25 39.5C28 41 30 43 32 44.5C34 43 36 41 39 39.5C44 37.5 50.5 38.5 56.5 40.5C50.5 42 45 45 40 47.5L32 53L24 47.5C19 45 13.5 42 7.5 40.5Z',c.white)
   +E(32,21.5,6.5,3.2,c.hi,null,null,0.8)+EYEp(24.5,31,2.8,c.iris)+EYEp(39.5,31,2.8,c.iris)
   +Ln('M21 30.2L18.2 28.8',c.line,1.3)+Ln('M43 30.2L45.8 28.8',c.line,1.3)+Pp('M29.4 48.4Q32 47.3 34.6 48.4Q33.6 51.4 32 51.9Q30.4 51.4 29.4 48.4Z',c.nose);
  const fleece=['12,64,7','20,57,6.5','28,55,6.5','36,55,6.5','44,57,6.5','52,64,7','17,31,6.5','20,22.5,6.5','26,16.5,6.5','33,14.5,6.8','40,16.5,6.5','46,22.5,6.5','48,31,6.5'];
  const circ=(list,attr)=>list.map(t=>{const [x,y,r]=t.split(',');return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'"'+(attr||'')+'/>';}).join('');
  PORTRAITS={
   dog:CHEST('#efe2c9','#9c7442')+E(32,30,17,15.5,'#caa06a','#8a6236')+E(32,22.5,7.5,3.8,'#dcb682',null,null,0.9)
    +PAIR('M17.5 19.5C9.5 20.5 6.2 31.5 8.8 40.8C10.8 45.2 16 44.3 17.2 39.2C18.3 33.2 19.3 26.2 21.3 22.2Z','#a87b48','#7a5530')
    +E(32,38,10,7.5,'#f3e7d0')+BLUSH(36.5,'#e8907e',12.5)+EYEp(25,29,2.9)+EYEp(39,29,2.9)
    +Pp('M28.5 34.3Q32 32.4 35.5 34.3Q34.5 37.9 32 38.4Q29.5 37.9 28.5 34.3Z','#2b1d16')+E(31,34.3,1.3,.6,'#fff',null,null,0.55)
    +Pp('M30 41.6Q32 46.6 34 41.6Z','#e8788a')+Ln('M32 38.4V40.6M32 40.6Q29.5 43 27 41.4M32 40.6Q34.5 43 37 41.4','#5a3d27',1.4),
   fox:CHEST('#fdf6ea','#c9b79c').replace('M14 64','M18 64').replace('50 64Z','46 64Z')
    +foxFace({fur:'#dd7424',line:'#8f4410',inner:'#f7e3cc',tip:'#3a2418',white:'#fdf6ea',hi:'#ef9446',iris:null,nose:'#2b1d16'}),
   cat:CHEST('#f4f1ec','#9f978d')+PAIR('M13 30L14.2 8.5L28.5 19Z','#8b857e','#5a544e')+PAIR('M16 25L16.9 13.5L24.6 19.6Z','#f1b3be')+PAIR('M13.6 19L14.2 8.5L19.4 12.4Z','#5f5953')
    +E(32,33,19,16,'#8b857e','#5a544e')+Ln('M32 18.5V24.5M27.3 19.3L28.8 24.4M36.7 19.3L35.2 24.4','#57514b',2.1)
    +Ln('M13.8 32.5L19.2 33.6M14 36.6L19.2 36.8M50.2 32.5L44.8 33.6M50 36.6L44.8 36.8','#5f5953',1.7)
    +E(28.4,40.2,5,4,'#f4f1ec')+E(35.6,40.2,5,4,'#f4f1ec')+E(32,44,3.6,2.6,'#f4f1ec')
    +EYEp(24.5,31,4,'#9cc65a')+EYEp(39.5,31,4,'#9cc65a')
    +'<ellipse cx="24.5" cy="31" rx="1.4" ry="3.3" fill="#1c130e"/><ellipse cx="39.5" cy="31" rx="1.4" ry="3.3" fill="#1c130e"/><circle cx="23.2" cy="29.4" r="1.2" fill="#fff"/><circle cx="38.2" cy="29.4" r="1.2" fill="#fff"/>'
    +Pp('M29.8 36.4L34.2 36.4L32 39Z','#e98a9c','#b8606f',0.8)+Ln('M32 39V40.5M32 40.5Q30 42.3 28.3 41M32 40.5Q34 42.3 35.7 41','#5a544e',1.2)
    +Ln('M24.5 40L9 37.6M24.5 41.8L9.5 43.6M39.5 40L55 37.6M39.5 41.8L54.5 43.6','#4a4a52',1.05,0.85),
   bunny:Pp('M17 64C19 55 25 51 32 51C39 51 45 55 47 64Z','#fbf8f3','#a79d8e')
    +'<g transform="rotate(-9 25 26)">'+Pp('M21.5 27C17 19 16 6.5 20.5 3.5C25 2 27.8 12 27.8 25Z','#ebe6de','#a79d8e')+Pp('M22.6 23C20 15.5 19.8 8.2 21.5 6.6C23.8 5.9 25.1 13.2 25.4 22Z','#f3bcc6')+'</g>'
    +'<g transform="rotate(9 39 26)">'+Pp('M42.5 27C47 19 48 6.5 43.5 3.5C39 2 36.2 12 36.2 25Z','#ebe6de','#a79d8e')+Pp('M41.4 23C44 15.5 44.2 8.2 42.5 6.6C40.2 5.9 38.9 13.2 38.6 22Z','#f3bcc6')+'</g>'
    +E(32,38,16,14.5,'#efebe3','#a79d8e')+E(22.5,44,6,4.5,'#faf8f4')+E(41.5,44,6,4.5,'#faf8f4')+BLUSH(42.5,'#f29aa8',12)
    +EYEp(25,35,2.9)+EYEp(39,35,2.9)+Pp('M30 39.5Q32 38.5 34 39.5Q33 41.8 32 42Q31 41.8 30 39.5Z','#e8899b')
    +'<rect x="30.5" y="44.1" width="3" height="2.8" rx=".7" fill="#fff" stroke="#b9ae9f" stroke-width=".7"/>'+Ln('M32 44.2V46.8','#b9ae9f',0.6)
    +Ln('M32 42V43.6Q30.5 45 29 44M32 43.6Q33.5 45 35 44','#8a7f72',1.1),
   corgi:CHEST('#fbf1e0','#c7ad86')+PAIR('M12 31C9.8 21 10.8 10.5 15 5.5C19.5 8.8 25 14.8 28.2 20.2Z','#dc8c36','#8c5319')+PAIR('M15.2 26C14.2 19 14.6 12.6 16.2 10.2C19 12.6 22.5 16.2 24.6 19.6Z','#f6d6b0')
    +E(32,33,18,15.5,'#dc8c36','#8c5319')+Pp('M32 17.5C34 17.5 35 22 35.5 27C37 32 44 36 45.5 42C43.5 48 37.5 50.5 32 50.5C26.5 50.5 20.5 48 18.5 42C20 36 27 32 28.5 27C29 22 30 17.5 32 17.5Z','#fbf1e0')
    +EYEp(24.5,30,2.8)+EYEp(39.5,30,2.8)+BLUSH(39,'#f0907a',13)+Pp('M28.8 36.2Q32 34.5 35.2 36.2Q34.3 39.5 32 40Q29.7 39.5 28.8 36.2Z','#2b1d16')
    +Pp('M25.8 42Q32 49 38.2 42Q32 44.6 25.8 42Z','#4a2a1e')+Pp('M29.4 44.1Q32 49.3 34.6 44.1Q32 45.5 29.4 44.1Z','#ee7f8f'),
   duck:Pp('M24 60.5L19.5 64L23.5 63.2L25.5 64.6L27.5 63.2L31 64Z','#f09a3e','#b0621d',1)+Pp('M38 60.5L33.5 64L37.5 63.2L39.5 64.6L41.5 63.2L45 64Z','#f09a3e','#b0621d',1)
    +E(36,49.5,19.5,12.5,'#ffcf45','#b08a1c')+Pp('M36 38C46 37.5 54 41 55.5 48C51 46.5 45 46.5 40 48.5C38 45 36.5 41 36 38Z','#8f7b3a')
    +Pp('M41 46C48 44.5 53.5 49 51.5 55C46.5 55.2 42.5 52 41 46Z','#a8923f','#6d5c24',1.2)+'<circle cx="29" cy="27" r="14.5" fill="#ffcf45" stroke="#b08a1c" stroke-width="1.7"/>'
    +Pp('M15 24C16 14 24.5 11.5 31 12.6C38.5 13.8 43.5 19 43.5 25.5C37.5 22.5 30.5 21.5 24.5 23.2C21 24.3 18 25 15 24Z','#8f7b3a')+Ln('M16.8 28.6C20.5 27.4 24 27.6 27.5 29.2','#6b5a28',1.7)
    +E(33.5,31.5,7,5,'#ffe487',null,null,0.9)+EYEp(23.5,26.8,2.7)
    +Pp('M17.5 30.3C11.5 29.2 5.2 30.2 4.6 33.6C4.4 36.8 10.4 38.6 17.6 37C20 36.2 20.8 31.4 17.5 30.3Z','#f09a3e','#b0621d',1.5)+Ln('M6.4 34.1C10.5 34.7 14.5 34.7 18.2 33.8','#c9742a',1)+E(9.2,32,0.9,0.5,'#b0621d'),
   chick:Ln('M24.5 53.5V58.5M39.5 53.5V58.5','#e8892c',2.4)+Ln('M24.5 58.5L20.5 63.2M24.5 58.5L24.5 64M24.5 58.5L28.5 63.2M39.5 58.5L35.5 63.2M39.5 58.5L39.5 64M39.5 58.5L43.5 63.2','#e8892c',2.2)
    +PAIR('M12.8 37.5C8.2 35.5 6.6 41.8 10.8 46.4C13 45.4 14.2 42 13.8 37.5Z','#ffb81a','#b98a0f',1.5)+Pp('M29.6 18.6C27.6 12 29.6 9.6 31.3 12.8C32 8.6 35.3 8.8 34.2 13.8C37.2 11 39.4 13 35.2 18.6Z','#ffc92e','#b98a0f',1.5)
    +E(32,36.5,20,19,'#ffc92e','#b98a0f')+E(32,45.5,11,7.5,'#ffe27a',null,null,0.85)+E(28,24.5,5,2.6,'#ffe89a',null,null,0.8)+BLUSH(38.5,'#f59070',10.5)
    +EYEp(25,31,3.1)+EYEp(39,31,3.1)+Pp('M28.4 36L32 33.3L35.6 36L32 40.2Z','#f39a2b','#b8621a',1)+Ln('M28.6 36H35.4','#b8621a',0.8),
   piglet:CHEST('#f5b8bd','#b96a76')+PAIR('M13 25.5C12 16.5 15 10.5 18 9.2C22.2 12.2 26.2 17.2 27.2 22.2C22 22.2 17 23.4 13 25.5Z','#f0a1ab','#b96a76')
    +Ln('M14.6 23.2C16.2 20 19.2 17.2 23.2 17','#b96a76',1)+Ln('M49.4 23.2C47.8 20 44.8 17.2 40.8 17','#b96a76',1)+E(32,35,19,16.5,'#f5b8bd','#b96a76')+E(32,24.5,8,3.6,'#f9cfd2',null,null,0.9)
    +BLUSH(40.5,'#ef7f92',12.5)+EYEp(24.5,32,2.7)+EYEp(39.5,32,2.7)+E(32,42,8.2,6,'#ec94a0','#b96a76',1.4)+E(29.2,42,1.5,2.2,'#9c4a57')+E(34.8,42,1.5,2.2,'#9c4a57')+Ln('M28.3 49.4Q32 51.6 35.7 49.4','#b96a76',1.2),
   goat:Pp('M17 64C19 56 25 53 29 53L35 53C39 53 45 56 47 64Z','#d8ccb8','#8d7f68')+PAIR('M25.2 17.5C24.2 9 21.2 4 17.6 3C19.3 7.5 20.9 12.5 21.5 19.4Z','#e0cfae','#8d7b5c',1.5)
    +PAIR('M18.6 27C14.8 26 11 28 8.6 32C11.6 33.6 15.4 33.1 18.6 31Z','#b49673','#7d6a4c',1.5)+PAIR('M17.2 28.3C14.5 27.9 12.2 29.1 10.9 31.1C12.9 31.8 15.2 31.5 17.2 30.3Z','#eab9b0')
    +Pp('M32 15C42.35 15 46.95 21 46.95 29C46.95 37 42.35 44 38.9 49C36.6 52 34.3 53 32 53C29.7 53 27.4 52 25.1 49C21.65 44 17.05 37 17.05 29C17.05 21 21.65 15 32 15Z','#c3a47c','#7d6a4c')
    +PAIR('M26.3 23.5C25.8 31.5 26.8 39.5 28.8 46.5L31 46.5C29.6 39.5 28.6 31.5 28.7 23.5Z','#f4ede0')+E(32,47.8,6.2,4.6,'#f4ede0')
    +EYEp(24.4,29.2,3.1)+EYEp(39.6,29.2,3.1)+Pp('M29.6 46.6Q32 45.6 34.4 46.6L32 48.8Z','#7a5d4a')
    +E(32,56.2,2.8,4.4,'#f4ede0','#8d7f68',1.2),
   raccoon:'<path d="M40 58.5C54 58.5 60.5 48 57 35.5" fill="none" stroke="#4a4e56" stroke-width="11.5" stroke-linecap="round"/><path d="M40 58.5C54 58.5 60.5 48 57 35.5" fill="none" stroke="#9aa0a9" stroke-width="8.5" stroke-linecap="round"/><path d="M40 58.5C54 58.5 60.5 48 57 35.5" fill="none" stroke="#33363d" stroke-width="8.6" stroke-dasharray="3.6 4.4" stroke-dashoffset="1"/>'
    +CHEST('#9aa0a9','#4a4e56').replace('M14 64','M16 64').replace('50 64Z','46 64Z')
    +PAIR('M14.5 25C11.5 17 14.5 11 20 11C24.2 11.8 26.4 16 26.4 20.4Z','#eef0f3','#4a4e56')+PAIR('M16.8 22.6C15.2 17.6 17 14 20.2 14C22.8 14.6 24 17.4 24 20.4Z','#5a5e66')
    +Pp('M32 16C43 16 50 23 51 31C52 36 51 40 47 43C43 46 38 49 32 50C26 49 21 46 17 43C13 40 12 36 13 31C14 23 21 16 32 16Z','#9aa0a9','#4a4e56')
    +Pp('M15.5 29C21.5 23 28 24 32 26C36 24 42.5 23 48.5 29C42.5 27 37 28 32 30C27 28 21.5 27 15.5 29Z','#f2f4f7')
    +Pp('M13.8 33C17.8 28 25 28 29 31L32 33L35 31C39 28 46.2 28 50.2 33C47.2 37.2 42 38.2 38 36.2C35 35 34 36 32 37C30 36 29 35 26 36.2C22 38.2 16.8 37.2 13.8 33Z','#2f3238')
    +Pp('M23.6 38C27 36 30 36.6 32 38.2C34 36.6 37 36 40.4 38C41.4 42.4 37 47.2 32 48C27 47.2 22.6 42.4 23.6 38Z','#f2f4f7')
    +EYEp(24.5,32.6,2.8,null,'#6b5a4a')+EYEp(39.5,32.6,2.8,null,'#6b5a4a')+Pp('M29.2 39.6Q32 38.2 34.8 39.6Q33.8 42.6 32 43Q30.2 42.6 29.2 39.6Z','#1f2126')
    +Ln('M32 43V44.6M32 44.6Q30.3 46 28.8 45.2M32 44.6Q33.7 46 35.2 45.2','#4a4e56',1.1),
   fennec:CHEST('#fbf3e2','#b99a6a').replace('M14 64','M18 64').replace('50 64Z','46 64Z')
    +PAIR('M24.5 27C16 23 5.5 12.5 2.6 1.8C12.2 2.8 22.4 10.2 28.6 20.2Z','#e8c690','#a47a43')+PAIR('M23.2 23C17.2 19.5 10.2 12.2 7.6 6C14.3 7.6 20.8 12.2 25.4 18.8Z','#f7dcc6')
    +Pp('M32 20C40 20 45 25 46 31C47 36 44 40.5 40 43.5L32 49.5L24 43.5C20 40.5 17 36 18 31C19 25 24 20 32 20Z','#e8c690','#a47a43')
    +Pp('M19.8 38C24 37 28 38.2 32 41.2C36 38.2 40 37 44.2 38C42.2 42 38 45.4 32 49.5C26 45.4 21.8 42 19.8 38Z','#fdf7ea')+E(32,25.5,5,2.4,'#f2d7a8',null,null,0.9)
    +EYEp(25.5,32.4,3.3)+EYEp(38.5,32.4,3.3)+Ln('M23 35.4C22.5 37 22.6 38.2 23.5 39.6M41 35.4C41.5 37 41.4 38.2 40.5 39.6','#b98a52',1)+Pp('M30.2 45.6Q32 44.8 33.8 45.6Q33.1 47.8 32 48.1Q30.9 47.8 30.2 45.6Z','#2b1d16'),
   snowhare:Pp('M18 64C20 55 26 51 32 51C38 51 44 55 46 64Z','#f4f7ff','#7d8aa6')
    +'<g transform="rotate(-12 26 24)">'+Pp('M23.4 25C19.4 16.5 16.6 5.6 18.4 1.6C22.2 0.8 26.2 10 28.6 23Z','#eef2fb','#7d8aa6')+Pp('M24.2 21C21.6 14.6 19.9 8.2 20.4 5.2C22.3 6.6 24.4 12.2 26.2 19.6Z','#d3dbee')+Pp('M18.2 1.2C20.2 0.2 22.6 2.4 23.8 6C21.6 6.9 19.2 6.3 17.7 4.8Z','#23262f')+'</g>'
    +'<g transform="rotate(12 38 24)">'+Pp('M40.6 25C44.6 16.5 47.4 5.6 45.6 1.6C41.8 0.8 37.8 10 35.4 23Z','#eef2fb','#7d8aa6')+Pp('M39.8 21C42.4 14.6 44.1 8.2 43.6 5.2C41.7 6.6 39.6 12.2 37.8 19.6Z','#d3dbee')+Pp('M45.8 1.2C43.8 0.2 41.4 2.4 40.2 6C42.4 6.9 44.8 6.3 46.3 4.8Z','#23262f')+'</g>'
    +E(32,38.5,14.5,14,'#eef2fb','#7d8aa6')+E(32,45.5,12,7.5,'#d8e0ef',null,null,0.95)+E(21.5,39,4,6,'#dfe6f3',null,null,0.8)+E(42.5,39,4,6,'#dfe6f3',null,null,0.8)+E(26,29,4,2,'#ffffff',null,null,0.9)
    +EYEp(25.4,35,3.5,'#c98a3a')+EYEp(38.6,35,3.5,'#c98a3a')+Pp('M30.2 40.2Q32 39.3 33.8 40.2Q33 42.2 32 42.4Q31 42.2 30.2 40.2Z','#c99aa6')
    +Ln('M32 42.4V43.8Q30.6 45.2 29.2 44.4M32 43.8Q33.4 45.2 34.8 44.4','#7d8aa6',1.1)+SPARK(53,13,3.4,'#cfe2ff','#7f9cc9')+SPARK(9.5,47,2.6,'#cfe2ff','#7f9cc9')+SPARK(56,40,1.8,'#e8f1ff'),
   owl:Pp('M7.5 64C8.5 48 18 40.5 32 40.5C46 40.5 55.5 48 56.5 64Z','#d4a86a','#8a6232')+Ln('M10.5 64C11.5 53 16 47 22.5 44.5M53.5 64C52.5 53 48 47 41.5 44.5','#8a6232',1.2)
    +Pp('M26 64C26 55 28.5 50 32 50C35.5 50 38 55 38 64Z','#f7efe2')
    +'<g fill="#8a6232" opacity=".55"><circle cx="15" cy="54" r=".9"/><circle cx="19" cy="50" r=".9"/><circle cx="49" cy="54" r=".9"/><circle cx="45" cy="50" r=".9"/><circle cx="30" cy="57" r=".7"/><circle cx="34" cy="60" r=".7"/></g>'
    +Pp('M32 7.5C46 7.5 54.5 17.5 54.5 30C54.5 42 44.5 50.5 32 50.5C19.5 50.5 9.5 42 9.5 30C9.5 17.5 18 7.5 32 7.5Z','#d4a86a','#8a6232')
    +'<g fill="#fbf3e4"><circle cx="24" cy="12.5" r=".9"/><circle cx="31" cy="10.5" r=".9"/><circle cx="38.5" cy="12" r=".9"/><circle cx="45" cy="16" r=".8"/><circle cx="18.5" cy="16.5" r=".8"/></g>'
    +Pp('M32 16C36 11 46 11 49 18C52 26 49 37 42 43C38 46 35 47 32 49C29 47 26 46 22 43C15 37 12 26 15 18C18 11 28 11 32 16Z','#fcf7ee','#c28e55',2)
    +E(24.5,28.5,7,7.5,'#f3e6d4')+E(39.5,28.5,7,7.5,'#f3e6d4')+Ln('M32 17V31','#e6d2b8',1.5)+EYEp(24.5,28.8,4.3)+EYEp(39.5,28.8,4.3)+Pp('M30.4 33Q32 31.4 33.6 33L32 39.2Z','#ecd0b4','#b08a6a',0.9),
   lamb:'<g stroke="#b9ae98" stroke-width="3.4">'+circ(fleece,' fill="#b9ae98"')+'</g><g fill="#f7f3ea">'+circ(fleece.concat(['32,24,9','32,58,8']))+'</g>'
    +'<g fill="#ffffff" opacity=".8"><circle cx="24.5" cy="15" r="2.3"/><circle cx="31.5" cy="12.8" r="2.3"/><circle cx="18.5" cy="21" r="2"/></g>'
    +PAIR('M20.5 32.2C14.4 31.2 9.4 33.2 7.2 36.2C10.2 38.2 15.2 38.2 20.5 36.2Z','#7a6252','#4d3b2f',1.4)+PAIR('M18.8 33.7C14.8 33.4 11.8 34.4 10.2 35.7C12.8 36.5 15.8 36.4 18.8 35.5Z','#e6a9a2')
    +Pp('M32 24.5C39 24.5 43 29.5 43 36.5C43 44.5 38 50.5 32 50.5C26 50.5 21 44.5 21 36.5C21 29.5 25 24.5 32 24.5Z','#7a6252','#4d3b2f')
    +'<g fill="#f7f3ea" stroke="#b9ae98" stroke-width="1.2"><circle cx="27.5" cy="25.2" r="4.2"/><circle cx="36.5" cy="25.2" r="4.2"/><circle cx="32" cy="23.4" r="4.6"/></g>'
    +E(32,44.2,6.6,5,'#937767')+EYEp(27,35.8,2.4,null,'#efe2d2')+EYEp(37,35.8,2.4,null,'#efe2d2')+Pp('M29.8 42.6Q32 41.6 34.2 42.6L32 44.6Z','#3a2a22')
    +Ln('M32 44.6V46M32 46Q30.3 47.4 29 46.6M32 46Q33.7 47.4 35 46.6','#3a2a22',1),
   glimmerfox:'<defs><radialGradient id="pp-glim" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="#8fe8ff" stop-opacity=".75"/><stop offset=".6" stop-color="#8fe8ff" stop-opacity=".28"/><stop offset="1" stop-color="#8fe8ff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="32" fill="url(#pp-glim)"/>'
    +CHEST('#ffffff','#7fb3d6').replace('M14 64','M18 64').replace('50 64Z','46 64Z')
    +foxFace({fur:'#c4ecff',line:'#4f86b3',inner:'#ffffff',tip:'#7b7ff0',white:'#ffffff',hi:'#e6f8ff',iris:'#4b63d8',nose:'#35477e'})
    +SPARK(9,12,3.6,'#ffffff','#5fc8ee')+SPARK(55,52,3,'#ffffff','#5fc8ee')+SPARK(53,9,2,'#ffffff')+SPARK(8,52,1.8,'#ffffff'),
  };
  PORTRAITS._paw='<g fill="#b08a5a" stroke="#7a5a34" stroke-width="1.6"><ellipse cx="32" cy="41" rx="12" ry="10.5"/><ellipse cx="18" cy="27" rx="5" ry="6.5"/><ellipse cx="27" cy="19.5" rx="5" ry="6.5"/><ellipse cx="37" cy="19.5" rx="5" ry="6.5"/><ellipse cx="46" cy="27" rx="5" ry="6.5"/></g>';
  return PORTRAITS;
 }
 const EXTRA_ART={};   // portraits a package adds (G.petArt.add, pet-fantasy.js)
 function svg(key,size){const P=portraits(),s=Math.max(8,Math.round(size||64)),body=P[key]||EXTRA_ART[key]||P._paw;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="'+s+'" height="'+s+'" role="img" aria-label="'+String(key||'pet').replace(/[^a-z0-9 _-]/gi,'')+'" class="pet-svg">'+body+'</svg>';}
 G.petArt={svg,list:()=>Object.keys(portraits()).filter(k=>k[0]!=='_').concat(Object.keys(EXTRA_ART)),has:k=>!!(portraits()[k]||EXTRA_ART[k]),add:(k,body)=>{EXTRA_ART[k]=String(body);}};
 /* the frame a portrait sits in, in the menus */
 try{if(!document.getElementById('petArtCss')){const st=document.createElement('style');st.id='petArtCss';
  st.textContent='.pet-port{display:inline-flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 50% 38%,#fffdf8,#efe3cc);box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.22);overflow:hidden;vertical-align:middle;margin-right:6px}'
   +'.pet-port svg,.pet-thumb svg{width:92%;height:92%;display:block}.pet-thumb{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,#fffdf8,#efe3cc)}'
   +'.pet-thumb.s2-glyph,.pet-thumb.mk-thumb{font-size:0!important}'
   +'.evrow .pet-port{flex:0 0 34px!important;width:34px!important;height:34px!important;min-width:34px!important;padding:0!important}';
  document.head.appendChild(st);}}catch(e){}

 /* ================================================================ realistic bodies ===========
    A pet listed in assets/models/pets/manifest.json with a model file gets a real animal's body: a
    rigged, animated model (assets/pet-library.js), fitted to the pet's size, feet on the grass, head
    towards +Z. The drawn pet above stays exactly as it is — it is what you see while the model
    downloads, and for good if the model is missing or broken — and everything that moves the pet
    (the follow, the flight, the idles, the camera logic) is unchanged: the real body is swapped into
    the same group, and its clips are driven from the same speed, gait phase and flight state.
    Nothing is fetched until a pet first moves, and nothing at all for a pet the manifest does not
    list, so a pet without a model costs one small JSON read per session. A failed load only warns. */
 const REAL={url:null,manifest:null,mf:null,lib:null,fail:null};
 function realURL(){if(REAL.url)return REAL.url;let u=new URL('../models/pets/manifest.json',import.meta.url);
  try{const q=new URLSearchParams(location.search).get('petManifest');if(q){const v=new URL(q,location.href);if(v.origin===location.origin)u=v;}}catch(e){}   // a same-origin test manifest, for QA and for looking at a model before it ships
  return REAL.url=u;}
 function realManifest(){if(!REAL.mf)REAL.mf=fetch(realURL(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .catch(e=>{console.warn('pet models: no model list ('+e.message+'), the drawn pets stay');return {pets:{}};}).then(m=>REAL.manifest=m&&m.pets?m:{pets:{}});return REAL.mf;}
 function realWanted(k){const P=REAL.manifest&&REAL.manifest.pets||{};let e=P[k],n=0;while(e&&e.base&&n++<4){const b=P[e.base];if(!b)return false;e=Object.assign({},b,e,{base:b.base});}return !!(e&&e.available!==false&&e.file);}
 /* the pet rim and the market's pair glow on a real material too, laid over whatever it already does */
 function rimReal(m,e){if(!(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial))return m;const L=(+(e&&e.lift)||0).toFixed(3),prev=m.onBeforeCompile,k0=Object.prototype.hasOwnProperty.call(m,'customProgramCacheKey')?m.customProgramCacheKey.bind(m):()=>'';
  m.onBeforeCompile=(sh,r)=>{if(prev)prev.call(m,sh,r);sh.uniforms.uPetGlow=PETGLOW;sh.fragmentShader='uniform vec3 uPetGlow;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',
   '{vec3 pV=normalize(vViewPosition);float pF=pow(1.0-clamp(dot(normal,pV),0.0,1.0),2.4);outgoingLight+=mix(diffuseColor.rgb,vec3(1.0,0.97,0.90),0.5)*pF*0.22+diffuseColor.rgb*'+L+'+uPetGlow*(0.25+pF*1.6);}\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>k0()+'|petRealRim'+L;m.userData.petGlow=true;return m;}
 function realLib(){if(!REAL.lib){REAL.lib=Promise.all([import('../pet-library.js?v=pl3'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/SkeletonUtils.js')])
   .then(([L,GL,SU])=>L.createPetLibrary({THREE,GLTFLoader:GL.GLTFLoader,clone:SU.clone,manifest:REAL.manifest,manifestURL:realURL(),patch:rimReal}));REAL.lib.catch(e=>console.warn('pet models: the model loader did not start ('+e.message+')'));}
  return REAL.lib;}
 function realLoad(key){const S=SPECIES[key];return realManifest().then(()=>{if(!realWanted(key))return null;if(REAL.fail===key)throw new Error('debugFail');
  return realLib().then(lib=>lib.load(key,{height:S?S.h*(S.grow||1):0.5,mustFly:!!(S&&S.wings)}));});}
 /* The state of the real body on a pet's parts: none (not listed), check, loading, swap (ready, waiting
    for a moment the camera is not on the pet, at most two seconds), ready, failed. */
 function realTick(c,st,dt){
  const P=c.parts;let R=P.real;
  if(R===undefined||R===null){R=P.real={state:'check',t:0};
   if(!P.group.userData.realHook){P.group.userData.realHook=true;P.group.addEventListener('removed',()=>{const r=P.real;P.real=null;if(r){r.dead=true;if(r.inst)r.inst.dispose();if(r.spec0)P.spec=r.spec0;}P.bodyPivot.visible=true;});}}   // the host never disposes a pet: this frees its skeleton and materials; shared geometry and textures stay cached
  if(R.state==='check'){if(!REAL.manifest){realManifest();return;}if(!realWanted(P.key)){R.state='none';return;}
   R.state='loading';realLoad(P.key).then(asset=>{if(R.dead)return;if(!asset){R.state='none';return;}realLib().then(lib=>{if(R.dead)return;try{R.inst=lib.instantiate(asset);R.state='swap';R.t=0;}catch(e){R.state='failed';R.err=e.message;console.warn('pet models: '+P.key+' model could not be set up ('+e.message+'), the drawn pet stays');}});})
    .catch(e=>{if(R.dead)return;R.state='failed';R.err=String(e&&e.message||e);console.warn('pet models: '+P.key+' model did not load ('+R.err+'), the drawn pet stays');});return;}
  if(R.state==='swap'){R.t+=dt;const S=P.spec,g=P.group.position;
   if(R.inst.restOnly||R.t>2||!(inView(g.x,g.y+S.h*0.5,g.z,0.1)))realSwap(P,R);else return;}   // a resting-only body comes in unseen anyway: it dissolves in when the pet next settles
  if(R.state==='ready')driveReal(c,st,P,R,dt);
 }
 /* is the real body what you see (the drawn one hidden)? always, once ready, unless it only rests */
 function realShown(P){const R=P.real;return !!(R&&R.state==='ready'&&(!R.inst.restOnly||R.hide));}
 function realSwap(P,R){const inst=R.inst,S=P.spec,gw=S.grow||1,d=inst.dims;
  if(inst.restOnly){P.group.add(inst.root);inst.fade(0);R.state='ready';R.first=true;R.phase=0;R.w={};R.speed={};R.air='';R.rest=0;R.hide=false;R.lockH=null;R.calm=0;R.hPrev=null;return;}   // the drawn pet keeps moving the pet; the real one sits in when it settles
  P.group.add(inst.root);P.bodyPivot.visible=false;R.spec0=S;
  P.spec=Object.assign({},S,{len:+(d.len/gw).toFixed(3),w:+(d.w/gw).toFixed(3),real:true});   // the follow's boxes and the slope tilt use the real animal's length and width
  R.state='ready';R.first=true;R.phase=0;R.w={};R.speed={};R.air='';}
 /* the clips, from what the drawn pet would be doing this frame */
 const IDLE_CLIP={sit:'sit',scratch:'sit',wash:'sit',groom:'sit',periscope:'sit',settle:'sit',lie:'lie',sniff:'eat',graze:'eat',peck:'eat',snuffle:'eat',pounce:'jump',pronk:'jump',boing:'jump',binky:'jump'};
 /* A body that can only rest (the Animated Fox is a sitting fox with a vertex-cache idle and no skeleton,
    so nothing can walk it): once the pet has stopped and finished turning to face you it dissolves in,
    sitting where the drawn pet stood, and plays its artist's idle (breathing, looking round, the tail);
    the moment the pet moves off it dissolves out and the drawn pet runs on, so it never slides or skates.
    While it sits it keeps its own heading: if the camera swings far round, it gets up and the drawn pet
    turns, then it sits again. */
 const _seat=new THREE.Vector3();
 function driveRest(c,st,P,R,dt){
  const I=R.inst,flying=!(st.air==='ground'||st.air==='wait');
  const turn=R.hPrev==null?0:Math.abs(wrap(c.heading-R.hPrev))/Math.max(1e-3,dt);R.hPrev=c.heading;
  const still=!flying&&!st.swim&&!st.hop&&st.spd<0.12&&(st.still||0)>0.35&&!(st.hopY>0.01)&&!(st.skim>0.01);
  R.calm=still&&turn<0.25&&(st.still||0)>1.1?R.calm+dt:0;   // after the turn it makes to face you, a second after stopping
  let want=R.rest>0.02?(still?1:0):(R.calm>0.3?1:0);
  if(want&&R.lockH==null){R.lockH=c.heading;R.seat=(R.seat||new THREE.Vector3()).copy(P.group.position);}
  const off=R.lockH==null?0:wrap(R.lockH-c.heading);
  if(Math.abs(off)>0.7)want=0;   // swung too far round: up it gets
  R.rest=clamp(R.rest+(want?dt/0.35:-dt/0.15),0,1);
  if(R.lockH!=null&&Math.hypot(P.group.position.x-R.seat.x,P.group.position.z-R.seat.z)>1)R.rest=0;   // carried off at once (a fast travel, a course start): it goes with the pet, not left sitting behind
  if(R.rest<=0)R.lockH=null;
  /* it stays exactly where it sat, facing the way it sat, while the drawn pet runs on out of it */
  I.root.rotation.y=R.lockH==null?0:off;
  if(R.lockH==null)I.root.position.set(0,0,0);else{P.group.updateMatrixWorld();I.root.position.copy(P.group.worldToLocal(_seat.copy(R.seat)));}
  R.hide=R.rest>0.55;P.bodyPivot.visible=!R.hide;
  I.fade(R.rest);
  if(R.rest>0){for(const k in R.w)R.w[k]=0;const k=I.pick('sit');if(k)R.w[k]=1;I.update(dt,{w:R.w,snap:R.first});R.first=false;}
  R.clip=R.rest>0?I.state:null;
 }
 function driveReal(c,st,P,R,dt){
  if(R.inst.restOnly){driveRest(c,st,P,R,dt);return;}
  const I=R.inst,S=P.spec,w=R.w,sp=R.speed,flying=!(st.air==='ground'||st.air==='wait');let restart=null,phase=null,phased=null,air='';
  for(const k in w)w[k]=0;
  const add=(s,v)=>{const k=I.pick(s);if(k)w[k]=(w[k]||0)+v;return k;};
  if(flying){const Wg=S.wings||{};
   if(st.air==='takeoff'&&I.has('takeoff')){air='takeoff';if(R.air!=='takeoff')restart='takeoff';w.takeoff=1;sp.takeoff=clamp(I.dur('takeoff')/0.7,0.4,3);}
   else if(st.air==='landing'&&(c.alt||0)<1.2&&I.has('land')){air='land';if(R.air!=='land')restart='land';w.land=1;sp.land=clamp(I.dur('land')/0.6,0.4,3);}
   else if(st.glideNow){air='glide';add('glide',1);}
   else{air='fly';const k=add('fly',1);if(k)sp[k]=clamp((st.flapHz||Wg.hz||3)/I.hz(k),0.5,2.5);}
  }else if(st.swim){const k=add('swim',1);if(k!=='swim'&&k!=='idle'){phased=[k];R.phase+=dt*clamp(st.spd/Math.max(0.1,I.stride(k)||S.len*1.2),0.3,1.5)*0.6;phase=R.phase;}}
  else if(S.kind==='bunny'&&st.hopAir>=0){const k=add('hop',1);phased=[k];phase=((st.ph%1)+1)%1;}   // the clip's crouch and push in step with the game's own hop
  else{
   /* turning on the spot takes steps too (a bone-walked body would otherwise pivot on planted feet) */
   const spin=R.hPrev==null?0:Math.abs(wrap(c.heading-R.hPrev))/Math.max(1e-3,dt),turnStep=I.gait?clamp((spin-0.5)/1.0,0,1):0;
   const spd=Math.max(st.spd,turnStep*0.5),m=Math.max(sstep(0.12,0.55,spd),turnStep*0.8),trot=I.has('trot');
   const GT=S.realGait||{};   // a species' own gait speeds and top cadence (pet-fantasy.js: the fawn bounds early, its walk is slow)
   let wW=1,wT=0,wR=0;if(trot){const a=sstep(GT.trot?GT.trot[0]:1.3,GT.trot?GT.trot[1]:2.2,spd),b=sstep(GT.run?GT.run[0]:4.6,GT.run?GT.run[1]:6.4,spd);wW=1-a;wT=a*(1-b);wR=a*b;}else{const a=sstep(GT.run?GT.run[0]:1.8,GT.run?GT.run[1]:3.4,spd);wW=1-a;wR=a;}
   phased=[...new Set([I.pick('walk'),trot?I.pick('trot'):null,I.pick('run')].filter(Boolean))];   // every gait clip stays on the one stride phase, even while it fades out
   if(m>0){const kW=add('walk',m*wW),kT=wT?add('trot',m*wT):null,kR=wR?add('run',m*wR):null;
    /* one stride phase for every gait clip, advanced at the pet's speed over the blended stride */
    const sW=I.stride(kW)||S.len*1.3,sT=kT?(I.stride(kT)||S.len*1.9):0,sR=kR?(I.stride(kR)||S.len*2.8):0,str=(sW*wW+sT*wT+sR*wR)/Math.max(1e-3,wW+wT+wR);
    const dom=wR>0.5?kR:wT>0.5?kT:kW,nat=1/Math.max(0.1,I.dur(dom));R.phase+=dt*clamp(spd/Math.max(0.05,str),nat*0.5,nat*(GT.rateHi||2.6));}
   phase=R.phase;   // held while it stands, so a gait clip fading out keeps its step
   const id=st.idle&&!st.idle.out?IDLE_CLIP[st.idle.name]:null;
   add(id&&I.has(id)?id:'idle',1-m);
   if(id==='jump'&&I.has('jump')&&R.idleName!==st.idle.name)restart='jump';R.idleName=st.idle?st.idle.name:null;
   if(S.wings&&st.skim>0.08&&I.has('fly')){const k=clamp(st.skim/(S.walk==='hop'?0.45:0.18),0,1);for(const s in w)w[s]*=1-k;w.fly=(w.fly||0)+k;sp.fly=clamp((S.wings.hz||3)/I.hz('fly'),0.5,2.5);}
  }
  if(phase!=null)R.phase=((phase%1)+1)%1;
  const turnRate=R.hPrev==null?0:wrap(c.heading-R.hPrev)/Math.max(1e-3,dt);R.hPrev=c.heading;
  /* a bone-walked body steps at the speed the pet really covers the ground (not the speed it wants), so a
     planted foot stays put; a jump of the pet (a fast travel) is not a speed */
  let mps=st.spd||0;
  if(I.gait){const gp=P.group.position;if(R.pPrev&&dt>0){const d=Math.hypot(gp.x-R.pPrev.x,gp.z-R.pPrev.z)/dt;if(d<25)R.mv=R.mv==null?d:R.mv+(d-R.mv)*Math.min(1,dt/0.035);}R.pPrev=(R.pPrev||new THREE.Vector3()).copy(gp);
   mps=Math.max(R.mv!=null?R.mv:mps,Math.min(0.5,Math.abs(turnRate)*0.25));}
  I.update(dt,{w,phase,phased,speed:sp,restart,snap:R.first,mps,turn:turnRate});R.first=false;R.air=air;
  I.look(st.lookY||0,st.lookP||0);
  R.clip=I.state;
 }

 /* ================================================================ the handles ================ */
 /* glow(amount,colour): the pair glow (market-summon-keys-pets.js) lights the pet's own rim, 0..1.
    glowTex(): a soft round glow for sprites. debug: true keeps the last slot scores in comp.st.cands.
    standY/deckAt/hidden: what the follow reads, for QA. */
 const _gc=new THREE.Color();
 G.petModels={make,move,place:c=>{if(c&&c.parts&&c.parts.spec)place(c);},SPECIES,version:2,debug:false,
  kinds:()=>Object.fromEntries(Object.keys(SPECIES).map(k=>[k,SPECIES[k].kind])),
  flying:k=>!!(SPECIES[k]&&SPECIES[k].wings),
  glow:(amount,colour)=>{const a=clamp(+amount||0,0,1);if(a<0.002){PETGLOW.value.setRGB(0,0,0);return;}_gc.set(colour||'#8fe8ff');PETGLOW.value.copy(_gc).multiplyScalar(a*0.55);},
  glowTex,standY,deckAt:(x,z)=>deckAt(x,z,0),tune:TUNE,boxes:c=>{const st=c&&c.st;if(!st||!st.R)return null;horseBoxes(st.R);return {hs:st.R.hs,boxes:HB.map(b=>b.map(v=>+v.toFixed(2)))};},
  hidden:(c,x,z)=>{const st=c&&c.st;if(!st||!st.R)return null;horseBoxes(st.R);const y=standY(x,z);return hiddenAt(st.R,x,z,y,c.parts.spec,folGather(x,z,5),true);},
  lowPoints:c=>c&&c.parts?c.parts.low:null,
  hbDebug:(c,x,z)=>{const st=c.st,R=st.R;horseBoxes(R);const cam=G.camera.position,y=standY(x,z),S=c.parts.spec,out={cam:[+((cam.x-R.x)*R.rx+(cam.z-R.z)*R.rz).toFixed(2),+(cam.y-R.y).toFixed(2),+((cam.x-R.x)*R.fx+(cam.z-R.z)*R.fz).toFixed(2)],rays:[]};
   for(const fy of FY){const ty=y+S.h*fy;const hits=[];for(let k=1;k<16;k++){const u=k/16,px=cam.x+(x-cam.x)*u,py=cam.y+(ty-cam.y)*u,pz=cam.z+(z-cam.z)*u;const lx=(px-R.x)*R.rx+(pz-R.z)*R.rz,lz=(px-R.x)*R.fx+(pz-R.z)*R.fz,ly=py-R.y;HB.forEach((b,i)=>{if(lx>b[0]&&lx<b[1]&&ly>b[2]&&ly<b[3]&&lz>b[4]&&lz<b[5])hits.push([i,+lx.toFixed(2),+ly.toFixed(2),+lz.toFixed(2)]);});}out.rays.push({fy,hits:hits.slice(0,3)});}
   return out;},
  folDebug:(x,z,y,h)=>{const cam=G.camera.position,out=[];if(!FOL.list)return out;for(const F of FOL.list){if(!F.grid)continue;const C=FOL.cell;for(let i=Math.floor((x-5)/C);i<=Math.floor((x+5)/C);i++)for(let j=Math.floor((z-5)/C);j<=Math.floor((z+5)/C);j++){const a=F.grid.get(i*73856093^j*19349663);if(!a)continue;
   for(let k=0;k<a.length;k+=6){for(const fy of FY){const ty=y+h*fy,sx=x-cam.x,sy=ty-cam.y,sz=z-cam.z,L2=sx*sx+sz*sz,L=Math.sqrt(L2);let t=((a[k]-cam.x)*sx+(a[k+1]-cam.z)*sz)/L2;if(t<Math.max(0,1-4/L)||t>1.05)continue;t=Math.min(t,1);const qx=cam.x+sx*t-a[k],qz=cam.z+sz*t-a[k+1];if(qx*qx+qz*qz>a[k+2]*a[k+2])continue;const hy=cam.y+sy*t;if(hy<a[k+3]||hy>a[k+4])continue;
     out.push({mesh:F.im.name||('#'+F.im.count+':'+F.im.geometry.type),w:a[k+5],fy,r:+a[k+2].toFixed(2),bot:+(a[k+3]-y).toFixed(2),top:+(a[k+4]-y).toFixed(2),d:+Math.hypot(a[k]-x,a[k+1]-z).toFixed(2)});}}}}return out;}};
 /* the real bodies: real(comp) -> {state, clip, info} for QA and debugging; loadReal(key) loads a model
    without showing it; useManifest(url) points at another model list (QA's test fixtures) and forgets
    what was loaded; debugFail=key makes that pet's model fail, to see the drawn pet stay */
 Object.defineProperty(G.petModels,'debugFail',{get:()=>REAL.fail,set:v=>{REAL.fail=v||null;},enumerable:true});
 G.petModels.real=c=>{const R=c&&c.parts&&c.parts.real;return R?{state:R.state,clip:R.clip||null,err:R.err||null,info:R.inst&&R.state==='ready'?R.inst.info():null}:{state:c&&c.parts?'none':null,clip:null};};
 G.petModels.loadReal=k=>realLoad(k).then(a=>a?{key:a.key,dims:a.dims,clips:a.src,stats:a.stats}:null);
 G.petModels.useManifest=u=>{REAL.url=u?new URL(u,location.href):new URL('../models/pets/manifest.json',import.meta.url);REAL.manifest=null;REAL.mf=null;REAL.lib=null;return realManifest().then(m=>Object.keys(m.pets||{}));};
 G.petModels.realList=()=>realManifest().then(m=>Object.keys(m.pets||{}).filter(realWanted));
 /* a package's own species (pet-fantasy.js): addSpecies(key, sheet) with the same fields as SPECIES, plus
    build(P,root,kit) for extra parts and fx(P,comp,st,dt,t,o) for per-frame effects; kit is the drawing set */
 G.petModels.addSpecies=(k,spec)=>{SPECIES[k]=spec;try{tagRows();}catch(e){}return spec;};
 G.petModels.kit=KIT;
 try{if(G.pets){G.pets.portrait=(k,s)=>svg(k,s);}}catch(e){}
 /* the rows of PETS3 learn their kind and wings, for anything that lists them */
 const tagRows=()=>{try{for(const r of (G.tables&&G.tables.PETS3)||[]){const s=SPECIES[r.key];if(s){if(!r.kind)r.kind=s.kind;if(s.wings)r.wings=true;}}}catch(e){}};
 tagRows();G.on('boot',tagRows);
 G.on('state',o=>{let c=null;try{c=G.pets&&G.pets.comp();}catch(e){}
  o.pet=c&&c.parts?{key:c.key,model:c.parts.key||null,kind:c.parts.spec?c.parts.spec.kind:null,air:c.st?c.st.air:'ground',alt:+(c.alt||0).toFixed(2),
   x:+c.pos.x.toFixed(2),z:+c.pos.z.toFixed(2),slot:c.st&&c.st.slot?c.st.slot.map(v=>+v.toFixed(2)):null,idle:c.st&&c.st.idle?c.st.idle.name:null,real:c.parts.real?c.parts.real.state:'none',clip:c.parts.real&&c.parts.real.clip||null}:null;});
}
