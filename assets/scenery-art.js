/* Shared scenery with metre-scaled timber, built hulls and sewn balloon gores.
 * Materials reuse the ranch's locally hosted CC0 PBR photographs. Each object
 * batches its static joinery by material; moving vehicles keep their own root. */
import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
export function createSceneryArt({THREE:T,materials,groundH}){
 const containsWaterfall=(x,z,pad=0)=>(Math.abs(x-342)<5.5+pad&&z>63-pad&&z<79+pad)||(Math.abs(x+150)<8+pad&&z>-244-pad&&z<-223+pad);
 const {aged,oak,iron,steel,cloth,leather}=materials,UP=new T.Vector3(0,1,0);
 const rope=cloth.clone();rope.name='Scenery | braided hemp';rope.color.set('#ad9570');
 const paint=aged.clone();paint.name='Scenery | painted hull';paint.color.set('#657c79');
 const templates=new Map();
 class Build{
  constructor(name){this.g=new T.Group();this.g.name=name;this.parts=new Map();this.count=0;}
  mesh(geo,m,x=0,y=0,z=0,rot=null,metric=true){let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
   if(metric&&g.attributes.uv){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,k=m.userData.metres||.7;g.computeBoundingBox();const sz=g.boundingBox.getSize(new T.Vector3()),long=sz.y>sz.z&&sz.y>sz.x?'y':sz.z>sz.x?'z':'x';
    for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));const a=long==='y'?p.getY(i):long==='z'?p.getZ(i):p.getX(i),b=long==='y'?(nx>nz?p.getZ(i):p.getX(i)):long==='z'?(ny>nx?p.getX(i):p.getY(i)):(ny>nz?p.getZ(i):p.getY(i));u.setXY(i,a/k,b/k);}}
   const q=new T.Quaternion();if(rot)q.setFromEuler(new T.Euler(...rot));g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));
   if(!this.parts.has(m))this.parts.set(m,[]);this.parts.get(m).push(g);this.count++;}
  box(w,h,d,m,x=0,y=0,z=0,rot=null){this.mesh(new T.BoxGeometry(w,h,d),m,x,y,z,rot);}
  cy(r,h,m,x,y,z,rot=null){this.mesh(new T.CylinderGeometry(r,r*1.025,h,12),m,x,y,z,rot);}
  beam(a,b,w,d,m){const A=new T.Vector3(...a),B=new T.Vector3(...b),mid=A.clone().add(B).multiplyScalar(.5),e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(UP,B.clone().sub(A).normalize()));this.box(w,A.distanceTo(B),d,m,...mid.toArray(),[e.x,e.y,e.z]);}
  tube(pts,r,m){this.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),Math.max(12,pts.length*4),r,6,false),m);}
  finish(meta){for(const [m,parts]of this.parts){const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());geo.computeBoundingSphere();const o=new T.Mesh(geo,m);o.castShadow=true;o.receiveShadow=true;this.g.add(o);}this.g.userData.sceneryArt={version:1,parts:this.count,...meta};return this.g;}
 }
 function cleat(b,x,y,z){b.box(.12,.028,.22,iron,x,y,z);for(const s of[-1,1])b.cy(.018,.07,steel,x,y+.04,z+s*.07);b.box(.065,.028,.36,steel,x,y+.08,z);}
 function coil(b,x,y,z,r=.2){const pts=[];for(let i=0;i<=96;i++){const t=i/96,a=t*Math.PI*8,R=r*(.4+.6*t);pts.push([x+Math.cos(a)*R,y+.016,z+Math.sin(a)*R]);}b.tube(pts,.017,rope);}
 function dock({x,z,y,yaw=0,width=2.6,length=8.4,rail=true,name='Timber landing'}){
  const b=new Build('Scenery | '+name),c=Math.cos(yaw),s=Math.sin(yaw),world=(px,pz)=>[x+px*c+pz*s,z-px*s+pz*c],supports=[];
  for(const side of[-1,1])b.box(.18,.24,length,aged,side*(width/2-.25),-.18,0);
  const rows=Math.ceil(length/.23),spacing=length/rows;
  for(let i=0;i<rows;i++){const pz=-length/2+(i+.5)*spacing;b.box(width,.075,spacing-.008,i%5===1?oak:aged,0,-.0375,pz);
   for(const side of[-1,1])for(const dz of[-.055,.055])b.cy(.009,.004,iron,side*(width/2-.25),.003,pz+dz);}
  const n=Math.ceil(length/2.5);
  for(let i=0;i<=n;i++){const pz=-length/2+.17+(length-.34)*i/n;
   b.box(width+.25,.16,.18,aged,0,-.34,pz);
   for(const side of[-1,1]){const px=side*(width/2+.055),[wx,wz]=world(px,pz),base=groundH(wx,wz)-.36-y,top=rail?.91:.42;
    b.cy(.105,Math.max(.45,top-base),aged,px,(top+base)/2,pz);b.cy(.116,.045,iron,px,top-.1,pz);b.cy(.12,.035,oak,px,top+.017,pz);
    b.box(.028,.075,.28,iron,px+side*.109,-.2,pz);supports.push({x:wx,z:wz,bottom:y+base,ground:groundH(wx,wz)});
    if(i<n&&rail){const next=-length/2+.17+(length-.34)*(i+1)/n;b.beam([px,.82,pz],[px,.82,next],.065,.08,oak);b.tube([[px,.46,pz],[px,.34,(pz+next)/2],[px,.46,next]],.018,rope);}
   }
   if(i<n){const next=-length/2+.17+(length-.34)*(i+1)/n;for(const side of[-1,1]){const px=side*(width/2-.12),[wx,wz]=world(px,(pz+next)/2),low=Math.max(groundH(wx,wz)-y+.1,-1.8);b.beam([px,low,pz],[px,-.28,next],.095,.095,aged);}}
  }
  for(const side of[-1,1])cleat(b,side*(width/2-.2),.02,-length/2+.58);coil(b,width/2-.45,.025,-length/2+.95);
  const out=b.finish({kind:'dock',deckY:y,width,length,supports});out.position.set(x,y,z);out.rotation.y=yaw;return out;
 }
 function boat(ferry=false){const key=ferry?'ferry':'rowboat';if(templates.has(key))return templates.get(key).clone(true);
  const b=new Build('Scenery | '+(ferry?'clinker-built passenger ferry':'clinker-built rowing skiff'));
  const L=ferry?6.4:3.5,W=ferry?2.8:1.35,top=ferry?.87:.41,bottom=ferry?-.48:-.28;
  const beamWidth=u=>Math.pow(Math.max(0,Math.sin(Math.PI*(.11+.89*u))),.65)*W*.5;
  const hull=(u,v,side)=>{const end=Math.pow(Math.abs(u-.48)*1.9,4),r=beamWidth(u)*(.43+.57*v);return[side*r,bottom+(top-bottom)*v+end*(ferry?.27:.18),L*(u-.5)];};
  for(const side of[-1,1])for(let band=0;band<7;band++){
   const pos=[],uv=[],idx=[];for(let j=0;j<=48;j++)for(let k=0;k<=1;k++){const u=j/48,v=(band+k)/7,p=hull(u,v,side);p[0]+=side*(k===0?.014:0);pos.push(...p);uv.push(u*L/.74,v*(top-bottom)/.74);}
   for(let j=0;j<48;j++){const a=j*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const source=band<3?paint:aged,keyMat=key+':hull:'+String(band<3);
   if(!templates.has(keyMat)){const mat=source.clone();mat.side=T.DoubleSide;mat.name='Scenery | '+key+' hull';templates.set(keyMat,mat);}
   b.mesh(g,templates.get(keyMat),0,0,0,null,false);
  }
  for(const side of[-1,1]){const pts=[];for(let i=0;i<=32;i++)pts.push(hull(i/32,1,side));b.tube(pts,ferry?.055:.037,oak);const lower=[];for(let i=0;i<=32;i++)lower.push(hull(i/32,.13,side));b.tube(lower,.018,iron);}
  const sternW=beamWidth(0)*2;b.box(sternW,.64*(top-bottom),.065,aged,0,bottom+(top-bottom)*.62,-L/2);b.box(sternW+.08,.065,.085,oak,0,top+.18,-L/2);
  for(let j=1;j<10;j++){const u=j/10,pts=[];for(let k=0;k<=5;k++)pts.push(hull(u,1-k/5,-1));for(let k=0;k<=5;k++)pts.push(hull(u,k/5,1));b.tube(pts,.027,oak);}
  const deck=ferry?.60:-.02;
  for(let j=0;j<26;j++){const u=.09+j/29,w=beamWidth(u)*1.48;b.box(w,.055,L/29-.007,oak,0,deck-.028,L*(u-.5));}
  if(ferry){for(const side of[-1,1]){for(const zz of[-1.65,0,1.65])b.cy(.038,.47,iron,side*1.20,.98,zz);b.tube([[side*1.16,1.18,-1.85],[side*1.24,1.22,0],[side*1.14,1.22,1.85]],.035,oak);}b.box(1.5,.085,.40,aged,0,.91,-2.03);}
  else{for(const zz of[-.77,.48])b.box(beamWidth(zz/L+.5)*1.9,.065,.28,oak,0,.29,zz);
   for(const side of[-1,1]){b.tube([[side*.47,.49,-1.15],[side*.37,.45,.05],[side*.3,.42,1.35]],.022,oak);b.box(.14,.035,.48,aged,side*.3,.42,1.22,[0,-side*.06,0]);}}
  cleat(b,0,top+.18,L*.40);coil(b,0,deck+.04,-L*.25,ferry?.28:.16);
  const out=b.finish({kind:key,length:L,width:W,deckY:deck,waterline:0});templates.set(key,out);return out.clone(true);
 }
 function wicker(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#695238';ctx.fillRect(0,0,256,256);
  for(let row=0;row<32;row++)for(let col=0;col<16;col++){const x=col*16,y=row*8,shade=(row+col)%2;ctx.fillStyle=shade?'#ae8b58':'#c0a06b';ctx.fillRect(x+(row%2)*4,y,15,5);ctx.fillStyle='rgba(39,25,12,.3)';ctx.fillRect(x,y+5,16,2);ctx.fillStyle='rgba(235,214,163,.25)';ctx.fillRect(x,y,15,1);}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;const m=cloth.clone();m.map=t;m.color.set('#ffffff');m.name='Scenery | willow wicker';m.userData.metres=.6;return m;}
 const basketMat=wicker();
 function balloon(colors){const b=new Build('Scenery | sewn touring balloon');
  b.box(3.12,.16,3.12,aged,0,.12,0);for(const s of[-1,1]){b.box(3.12,1.22,.11,basketMat,0,.79,s*1.52);b.box(.11,1.22,3.0,basketMat,s*1.52,.79,0);
   b.box(3.3,.12,.17,leather,0,1.44,s*1.52);b.box(.17,.12,3.3,leather,s*1.52,1.44,0);
   b.box(3.2,.13,.16,oak,0,.25,s*1.54);b.box(.16,.13,3.2,oak,s*1.54,.25,0);
   for(let i=0;i<13;i++){const v=-1.44+i*.24;b.cy(.014,1.07,rope,v,.83,s*1.581);b.cy(.014,1.07,rope,s*1.581,.83,v);}}
  for(const x of[-1.35,1.35])for(const z of[-1.35,1.35]){b.beam([x,1.46,z],[x*.63,3.94,z*.63],.047,.047,iron);b.tube([[x*.63,3.94,z*.63],[x*.8,4.8,z*.8],[x*1.35,5.75,z*1.35]],.021,rope);}
  for(const z of[-.85,.85])b.beam([-.85,3.94,z],[.85,3.94,z],.045,.045,steel);for(const x of[-.85,.85])b.beam([x,3.94,-.85],[x,3.94,.85],.045,.045,steel);
  for(const x of[-.28,.28]){b.cy(.16,.22,steel,x,4.02,0);for(let i=0;i<6;i++){const a=i*Math.PI/3;b.cy(.014,.27,iron,x+Math.cos(a)*.19,4.0,Math.sin(a)*.19);}b.tube([[x,3.92,0],[.84,3.67,.4],[1.1,1.65,1.08]],.023,iron);}
  for(const x of[-1.12,1.12]){b.cy(.15,.75,steel,x,.59,1.12);b.cy(.06,.09,steel,x,1.0,1.12);}
  const profile=new T.CatmullRomCurve3([[.75,4.65,0],[1.24,5.3,0],[2.55,6.4,0],[3.53,7.7,0],[3.85,9.0,0],[3.42,10.5,0],[2.3,11.72,0],[.65,12.35,0],[0,12.43,0]].map(p=>new T.Vector3(...p)));
  const panelMats=colors.map((color,i)=>{const m=cloth.clone();m.color.set(color);m.side=T.DoubleSide;m.name='Scenery | ripstop gore '+i;m.normalScale.set(.15,.15);return m;});
  const R=64,gores=16;
  for(let gore=0;gore<gores;gore++){const p=[],uv=[],idx=[];for(let j=0;j<=R;j++){const pt=profile.getPoint(j/R);for(let k=0;k<=6;k++){const a=(gore+k/6)/gores*Math.PI*2,r=pt.x*(1+.019*Math.sin(k/6*Math.PI));p.push(Math.sin(a)*r,pt.y,Math.cos(a)*r);uv.push((gore+k/6)/gores*18,j/R*18);}}for(let j=0;j<R;j++)for(let k=0;k<6;k++){const a=j*7+k;idx.push(a,a+7,a+1,a+1,a+7,a+8);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();b.mesh(g,panelMats[gore%2],0,0,0,null,false);
   const seam=[];for(let j=0;j<=28;j++){const pt=profile.getPoint(j/28),a=gore/gores*Math.PI*2;seam.push([Math.sin(a)*(pt.x+.007),pt.y,Math.cos(a)*(pt.x+.007)]);}b.tube(seam,.009,rope);
  }
  return b.finish({kind:'balloon',deckY:.20,basketRim:1.5,burnerY:4.24,gores});
 }

 return {dock,boat,balloon,containsWaterfall};
}
