import {createHeadSurface} from './rider-head-surface.js?v=artist-riders-20261007';
/* New styles are fitted in the Head bone's space, using the same scalp, strand
   materials and helmet deformation as the original character. */
const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
export const EXTRA_HAIR=[
 {id:'bob',label:'Chin-length bob',mesh:'Hair_Long',shape:'bob'},
 {id:'lob',label:'Shoulder-length',mesh:'Hair_Long',shape:'lob'},
 {id:'waves',label:'Loose waves',mesh:'Hair_Long',shape:'waves'},
 {id:'halfup',label:'Half-up twist',mesh:'Hair_Long',shape:'waves',detail:'halfup'},
 {id:'lowpony',label:'Low ponytail',scalp:true,detail:'lowpony'},
 {id:'sidebraid',label:'Side braid',scalp:true,detail:'sidebraid'},
 {id:'twinbraids',label:'Twin braids',scalp:true,detail:'twinbraids'},
 {id:'crownbraid',label:'Braided crown',scalp:true,detail:'crownbraid'},
 {id:'lowbun',label:'Low chignon',scalp:true,detail:'lowbun'},
 {id:'messybun',label:'Loose bun',scalp:true,detail:'messybun'},
 {id:'coils',label:'Natural coils',scalp:true,detail:'coils'},
 {id:'pixie',label:'Swept pixie',scalp:true,mesh:'Hair_SimpleParted',shape:'pixie'},
 {id:'ribbonpony',label:'Ribbon ponytail',scalp:true,detail:'ribbonpony'},
 {id:'highpony',label:'High ponytail',scalp:true,detail:'highpony'},
 {id:'bubblepony',label:'Bubble ponytail',scalp:true,detail:'bubblepony'},
 {id:'braidedpony',label:'Braided ponytail',scalp:true,detail:'braidedpony'},
 {id:'twintails',label:'Low twin tails',scalp:true,detail:'twintails'},
 {id:'halfupbun',label:'Half-up bun',mesh:'Hair_Long',shape:'waves',detail:'halfupbun'},
 {id:'beachbob',label:'Wavy bob',mesh:'Hair_Long',shape:'beachbob'},
 {id:'mermaidwaves',label:'Long flowing waves',mesh:'Hair_Long',shape:'mermaidwaves'},
 {id:'croppedcoils',label:'Cropped coils',scalp:true,detail:'croppedcoils'},
 {id:'twists',label:'Shoulder twists',scalp:true,detail:'twists'},
 {id:'braidedbun',label:'Braided chignon',scalp:true,detail:'braidedbun'},
].map(h=>({...h,body:['f','m']}));

export function shapeHair(source,style,head,THREE,kit){
 if(THREE&&kit)return sculptedHairShape(THREE,kit,style);
 const geo=source.clone(),p=geo.attributes.position;geo.computeBoundingBox();const sourceEnd=geo.boundingBox.min.y;
 const end=style==='bob'?-.027:style==='beachbob'?-.073:style==='mermaidwaves'?-.46:style==='lob'?-.165:style==='long'?-.315:-.305;
 // A soft U-shaped perimeter and staggered lengths keep the ends from reading
 // as a single cut sheet. The upper locks retain their fitted scalp roots.
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(style==='pixie'){
   x*=1.025;z*=1.03;if(y>head.cy)y+=(y-head.cy)*.075;
  }else if(y<.095){
   const t=Math.min(1,Math.max(0,(.095-y)/Math.max(.02,.095-sourceEnd))),side=Math.sign(x)||1,angle=Math.atan2(x,z-head.cz);
   const layered=.020*Math.abs(Math.sin(angle))+.008*Math.sin(angle*5.0+1.4)+.004*Math.sin(angle*11.0-.8);
   y=.095+(end-.095)*t+layered*t*t*t;
   const volume=Math.sin(t*Math.PI)*(.010+(style==='bob'?.001:.005)),neck=Math.min(1,t*4);
   x+=side*volume;z-=Math.max(0,t-.22)*.069;
   const waved=['waves','beachbob','mermaidwaves'].includes(style),amplitude=waved?(style==='beachbob'?.010:.014):.0025,phase=angle*1.7;
   x+=side*amplitude*Math.sin(t*8.8+phase)*Math.sin(t*Math.PI*.92)*neck;
   z+=amplitude*.65*Math.sin(t*9.6+phase+.7)*Math.sin(t*Math.PI)*neck;
   if(style==='bob'||style==='beachbob')x*=1-.075*t*t;
   // Fine end variation is deliberately confined to the last few centimetres.
   y+=.004*Math.sin(x*73+z*49)*Math.max(0,(t-.78)/.22);
  }
  p.setXYZ(i,x,y,z);
 }
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}

function mergeHairGeometry(THREE,list){
 const P=[],UV=[],I=[];let offset=0;
 for(const g of list){const p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));UV.push(u?u.getX(i):0,u?u.getY(i):0);}if(g.index)for(const i of g.index.array)I.push(i+offset);else for(let i=0;i<p.count;i++)I.push(i+offset);offset+=p.count;g.dispose();}
 const g=new THREE.BufferGeometry();g.setIndex(I);g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));smoothHairNormals(g);g.computeBoundingSphere();g.userData.proceduralHair=true;return g;
}
function hairFallPoint(THREE,kit,style,theta,t){
 const H=kit.head,ends={long:-.435,waves:-.375,mermaidwaves:-.515,lob:-.205,bob:-.060,beachbob:-.095,curlyFall:-.255},end=ends[style]??-.375,curly=style==='curlyFall',waved=['waves','mermaidwaves','beachbob','curlyFall'].includes(style),sine=Math.sin(theta),cosine=Math.cos(theta),yStart=H.cy+.055,yEnd=end+.023*Math.abs(sine)+.010*Math.sin(theta*5.1+.7)+.013*(.5+.5*Math.cos(theta*19)),y=yStart+(yEnd-yStart)*t,hang=Math.max(0,(t-.21)/.79),ridge=.004*Math.sin(theta*19+t*4)*Math.sin(Math.PI*t),wave=waved?(curly?.024:.022)*Math.sin(hang*(curly?16.5:10.8)+theta*2.7)*Math.sin(hang*Math.PI*.92):.0025*Math.sin(hang*4+theta*2),rx=H.rx+.014+(curly?.010:.025)*Math.sin(hang*Math.PI*.8),sideSweep=.130*smooth(.015,.38,hang)*Math.pow(Math.abs(sine),.75),backDrop=.055*hang*Math.abs(cosine)+.092*smooth(.10,.72,hang)*Math.pow(Math.max(0,-cosine),2),p=new THREE.Vector3(H.cx+sine*(rx+wave+ridge),y,H.cz+cosine*.106-sideSweep-backDrop+wave*.32*cosine);
 if(t<.35){const fitted=scalpPoint(THREE,kit,new THREE.Vector3(H.cx+sine*H.rx,y,H.cz+cosine*H.rz),.006);p.lerp(fitted,1-smooth(.13,.35,t));}return p;
}
function sculptedHairShape(THREE,kit,style){
 const H=kit.head,V=(x,y,z)=>new THREE.Vector3(x,y,z),pieces=[],P=[],U=[],I=[],N=96,M=26,short=style==='pixie',fallOnly=style==='curlyFall';
 const line=theta=>{const a=Math.abs(theta),part=.0035*Math.exp(-1*((theta+.13)/.11)**2);return a<.90?H.browTop+.032+.010*Math.sin(a/.90*Math.PI*.5)**2-part:a<1.55?H.browTop+.042-(a-.90)*.090:H.browTop-.0165-(a-1.55)*.045;};
 // The fitted crown is a single smooth shell with shallow directional clumps.
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
  const v=j/M,theta=(i/N-.5)*Math.PI*2,y=H.top-.003+(line(theta)-H.top+.003)*Math.pow(v,.72),section=Math.sqrt(Math.max(.00001,1-((y-H.cy)/Math.max(.01,H.ry))**2)),target=V(H.cx+Math.sin(theta)*H.rx*section,y,H.cz+Math.cos(theta)*H.rz*section),p=scalpPoint(THREE,kit,target,.0045),normal=p.clone().sub(V(H.cx,H.cy,H.cz)).normalize(),clump=.0017*Math.sin(theta*17+v*3)*Math.sin(v*Math.PI);
  p.addScaledVector(normal,.003+clump);P.push(...p.toArray());U.push(i/N*5,v*1.3);
  if(j<M&&i<N){const k=j*(N+1)+i;I.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
 }
 // Close the UV seam with the same lifted ray hit on both endpoints.
 for(let j=0;j<=M;j++){const first=j*(N+1)*3,last=(j*(N+1)+N)*3;for(let k=0;k<3;k++)P[last+k]=P[first+k];}
 const cap=new THREE.BufferGeometry();cap.setIndex(I);cap.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));cap.computeVertexNormals();pieces.push(cap);
 const lock=(pts,width,depth)=>{
  const path=new THREE.CatmullRomCurve3(pts),geo=new THREE.TubeGeometry(path,40,1,12,false),p=geo.attributes.position,u=geo.attributes.uv;
  for(let i=0;i<=40;i++){const t=i/40,center=path.getPointAt(t),tangent=path.getTangentAt(t),side=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),out=tangent.clone().cross(side).normalize(),r=width*(.35+.65*Math.sin(Math.PI*Math.min(.999,t*.96+.04)))*Math.max(.025,1-t*t*t);
   for(let j=0;j<=12;j++){const k=i*13+j,a=j/12*Math.PI*2,point=center.clone().addScaledVector(side,Math.cos(a)*r).addScaledVector(out,Math.sin(a)*r*depth);p.setXYZ(k,point.x,point.y,point.z);u.setXY(k,j/12*2,t*3);}
  }geo.computeVertexNormals();pieces.push(geo);
 };
 if(!short){
  const ends={long:-.435,waves:-.375,mermaidwaves:-.515,lob:-.205,bob:-.060,beachbob:-.095,curlyFall:-.255},end=ends[style]??-.375,waved=['waves','mermaidwaves','beachbob','curlyFall'].includes(style),A=112,B=48,positions=[],uvs=[],indices=[],theta0=1.43,span=Math.PI*2-2*theta0;
  // A closed draped fall provides a continuous silhouette. Low ridges separate
  // the clumps; the tips form an irregular soft U instead of a blunt curtain.
  for(let side=0;side<2;side++)for(let j=0;j<=B;j++)for(let i=0;i<=A;i++){
   const u=i/A,t=j/B,theta=theta0+span*u,sine=Math.sin(theta),cosine=Math.cos(theta),point=hairFallPoint(THREE,kit,style,theta,t);
   const normal=V(sine,0,cosine).normalize();point.addScaledVector(normal,side?-.005:.003);positions.push(...point.toArray());uvs.push(u*8,t*3);
   if(j<B&&i<A){const k=side*(A+1)*(B+1)+j*(A+1)+i,n=A+1;if(side)indices.push(k,k+1,k+n,k+1,k+n+1,k+n);else indices.push(k,k+n,k+1,k+1,k+n,k+n+1);}
  }
  const total=(A+1)*(B+1);for(let j=0;j<B;j++)for(const i of [0,A]){const k=j*(A+1)+i,n=k+A+1;indices.push(k,n,k+total,n,n+total,k+total);}for(let i=0;i<A;i++){const k=B*(A+1)+i;indices.push(k,k+total,k+1,k+1,k+total,k+1+total);}
  const fall=new THREE.BufferGeometry();fall.setIndex(indices);fall.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));fall.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));fall.computeVertexNormals();pieces.push(fall);
 }
 // Swept framing leaves blend the part into the temple and break the outline.
 if(!fallOnly)for(const sd of [-1,1])for(let j=0;j<(short?5:2);j++){
  const root=scalpPoint(THREE,kit,V(sd*(.018+j*.012),H.top-.007,H.cz+.032),.005),temple=scalpPoint(THREE,kit,V(sd*H.rx*.91,H.browTop+.031-j*.010,H.cz+.083),.006),tipEnd=style==='bob'?-.050:style==='beachbob'?-.078:style==='lob'?-.118:style==='mermaidwaves'?-.185:style==='waves'?-.132:-.152,tip=short?scalpPoint(THREE,kit,V(sd*H.rx,H.browTop-.010-j*.009,H.cz+.038),.004):V(sd*(H.rx*1.10+j*.007),tipEnd+j*.027,H.cz+.126+j*.004),mid=short?temple.clone().lerp(tip,.52):V(sd*(H.rx*.97+.007*Math.sin(j*1.7)),(temple.y+tip.y)*.45,H.cz+.142+.007*Math.cos(j*1.6));
  lock([root,scalpPoint(THREE,kit,root.clone().lerp(temple,.54),.008),temple,mid,tip],short?.011-j*.0012:.019-j*.0035,.26);
 }
 return mergeHairGeometry(THREE,pieces);
}

/* The measured skull narrows sharply at the nape. A bounding-box radius leaves
   tails hanging in space there, so every root is projected onto the real head. */
export function scalpPoint(THREE,kit,target,lift=.002){
 if(!kit.hairSurface){
  const H=kit.head;
  let geometry=kit.headAsset?.local;
  if(!geometry){const source=kit.skin,hi=source.skeleton.bones.findIndex(b=>b.name==='Head');geometry=source.geometry.clone().applyMatrix4(source.skeleton.boneInverses[hi]);}
  kit.hairSurface=createHeadSurface(THREE,geometry,new THREE.Vector3(H.cx,H.cy,H.cz));
  if(!kit.headAsset)geometry.dispose();
 }
 return kit.hairSurface.sample(target,lift);
}

export function hairDetails({THREE,kit,style,helmet,tube,merge,tiePoint}){
 const H=kit.head,hair=[],ties=[],ribbon=[],V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const anchor=p=>scalpPoint(THREE,kit,p,-.003);
 const ring=(p,r=0.016,dir=V(0,-1,0))=>{const g=new THREE.TorusGeometry(r,0.0022,7,24);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),dir.clone().normalize()));g.translate(p.x,p.y,p.z);ties.push(g);};
 const curve=(points,radii,segs=30,rad=8)=>tube(points,radii,segs,rad);
 // Broad, shallow cross sections overlap into a continuous mass of hair.
 const lock=(points,radii,segs=36,width=1.25,depth=.72)=>{
  const geo=curve(points,radii,segs,12),axis=new THREE.CatmullRomCurve3(points),p=geo.attributes.position;
  for(let i=0;i<=segs;i++){const center=axis.getPointAt(i/segs),tangent=axis.getTangentAt(i/segs),n=Math.abs(tangent.x)<.9?V(1,0,0):V(0,0,1);n.addScaledVector(tangent,-n.dot(tangent)).normalize();const b=tangent.clone().cross(n);
   for(let j=0;j<=12;j++){const k=i*13+j,t=i/segs,ripple=1+.035*Math.sin(t*18.0+j*.91)*Math.sin(t*Math.PI),offset=V(p.getX(k),p.getY(k),p.getZ(k)).sub(center),point=center.clone().addScaledVector(n,offset.dot(n)*width*ripple).addScaledVector(b,offset.dot(b)*depth*ripple);p.setXYZ(k,point.x,point.y,point.z);}
  }
  geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
 };
 const gather=(at,end,r=.015)=>{const start=anchor(at),mid=start.clone().lerp(end,.5);hair.push(curve([start,mid,end],[r*1.2,r,r*.9],12));};
 const pony=(at,length=.30)=>{
  at=anchor(at);const pieces=[],splay=Math.sign(at.x)*Math.min(1,Math.abs(at.x)/.06);
  const axis=new THREE.CatmullRomCurve3([at,at.clone().add(V(0,-.014,-.024)),at.clone().add(V(.006+splay*.017,-length*.32,-.054)),at.clone().add(V(.012+splay*.023,-length*.68,-.061)),at.clone().add(V(.007+splay*.020,-length,-.047))]);
  // Overlapping inner leaves form a continuous tail, while the outer leaves
  // separate into different lengths with a soft bend and tapered ends.
  for(let j=0;j<18;j++){
   const angle=j*2.399963,outer=j>=4,spread=outer?.010+.004*Math.sin(j*1.9):.003,tip=outer?.83+.17*(.5+.5*Math.sin(j*2.7)):1,pts=[];
   for(let k=0;k<=12;k++){
    const t=k/12,along=t*tip,center=axis.getPoint(along),fan=Math.sin(t*Math.PI)*.006,grow=Math.min(1,t*7),wave=.0035*Math.sin(t*8+j*1.7)*Math.sin(t*Math.PI);
    center.x+=(Math.cos(angle)*(spread+fan)+wave)*grow;center.z+=Math.sin(angle)*spread*.62*grow;pts.push(center);
   }
   pieces.push(lock(pts,outer?[.003,.008,.009,.007,.004,.00035]:[.005,.010,.011,.009,.005,.0005],44,1.45,.66));
  }
  hair.push(merge(pieces));
  const band=axis.getPoint(.085),direction=axis.getTangent(.085);ring(band,.016,direction);ring(band.clone().addScaledVector(direction,.0032),.016,direction);
 };
 const braid=(points,radius=0.017,turns=7,rooted=true)=>{
  if(rooted)points[0]=anchor(points[0]);
  turns*=.62;radius*=.91;const axis=new THREE.CatmullRomCurve3(points),pieces=[],samples=Math.max(64,Math.ceil(turns*28));
  for(let strand=0;strand<3;strand++){
   const pts=[];
   for(let k=0;k<=samples;k++){
    const t=k/samples,along=rooted?t*.90:t,center=axis.getPoint(along),tangent=axis.getTangent(along).normalize();
    const side=Math.abs(tangent.x)>.85?V(0,0,1):V(1,0,0);side.addScaledVector(tangent,-side.dot(tangent)).normalize();const cross=tangent.clone().cross(side);
    const a=t*turns*Math.PI*2+strand*Math.PI*2/3,rr=radius*(1-0.48*t)*(rooted?Math.min(1,t*18):1);
    center.addScaledVector(side,Math.cos(a)*rr).addScaledVector(cross,Math.sin(a)*rr*.66);pts.push(center);
   }
   const scale=radius/.017;pieces.push(lock(pts,[0.0065,0.0074,0.0065,0.0045,0.0025].map(v=>v*scale),Math.max(96,Math.ceil(turns*32)),1.10,.83));
  }
  if(rooted){
   const end=axis.getPoint(.90),direction=axis.getTangent(.90);ring(end,radius*.57,direction);
   for(let j=0;j<5;j++){const a=j/5*Math.PI*2,spread=V(Math.cos(a),0,Math.sin(a));spread.addScaledVector(direction,-spread.dot(direction)).normalize();
    const start=end.clone().addScaledVector(spread,radius*.20),middle=axis.getPoint(.97).addScaledVector(spread,radius*.38),tip=axis.getPoint(1).addScaledVector(direction,.008+.003*Math.sin(j));
    pieces.push(lock([start,middle,tip],[radius*.26,radius*.23,.0004],18,1.2,.7));
   }
  }
  hair.push(merge(pieces));
 };
 const bun=(messy=false,anchor=null)=>{
  const root=anchor||tiePoint(kit,helmet||!messy?'nape':'crown'),at=root.clone();at.z-=0.014;
  if(!helmet&&(style==='classicbun'||style==='messybun')){at.y+=.018;at.z-=.008;}
  gather(root,at,.019);
  const core=new THREE.SphereGeometry(.035,24,16);core.scale(1.08,.82,.69);core.translate(at.x,at.y,at.z-.006);
  const pieces=[core];
  for(let j=0;j<10;j++){
   const pts=[],a0=j*.6283185;
   for(let k=0;k<=24;k++){
    const t=k/24,a=t*Math.PI*2.7+a0,r=(.032+.0025*Math.sin(j*2.3))*Math.sin(t*Math.PI);
    const x=Math.cos(a)*r*(messy?1.18:1.1),y=Math.sin(a)*r*.72,z=-.006-.029*Math.sqrt(Math.max(.04,1-(x/.043)**2-(y/.031)**2));
    pts.push(V(at.x+x,at.y+y,at.z+z));
   }
   pieces.push(lock(pts,[.005,.010,.010,.008,.002],36,1.15,.85));
  }
  if(messy&&!helmet)for(const sd of [-1,1])pieces.push(curve([V(sd*H.rx,H.browTop+.015,H.cz+.025),V(sd*(H.rx+.009),H.browTop-.025,H.cz+.045),V(sd*(H.rx+.005),H.browTop-.065,H.cz+.035)],[.004,.003,.0008],16));
  hair.push(merge(pieces));ring(at,.021);
 };
 if(style==='ponytail'||style==='lowpony'||style==='ribbonpony'||style==='halfup'){
  const at=tiePoint(kit,(style==='halfup'||style==='ponytail')&&!helmet?'back':'nape');
  pony(at,style==='halfup'?.20:.29);
  if(style==='ribbonpony'){
   for(const sd of [-1,1]){
    const g=new THREE.SphereGeometry(1,14,10);g.scale(.031,.013,.006);g.rotateZ(sd*.35);g.translate(at.x+sd*.026,at.y+.004,at.z-.019);ribbon.push(g);
    const tail=new THREE.PlaneGeometry(.019,.061,1,4);tail.rotateZ(sd*.20);tail.translate(at.x+sd*.013,at.y-.036,at.z-.020);ribbon.push(tail);
   }
  }
 }else if(style==='ringlets'){
  hair.push(sculptedHairShape(THREE,kit,'curlyFall'));
  const locks=[];
  // A closed softly waved fall carries the silhouette. A smaller set of varied
  // ribbon curls follows it; no repeated tube grid or shoulder-sized rope mass.
  for(let j=0;j<19;j++){
   const theta=1.45+j/18*(Math.PI*2-2.90),phase=j*2.399963,first=.16+.065*(.5+.5*Math.sin(j*2.17)),last=.92+.07*(.5+.5*Math.sin(j*2.31)),pts=[];
   for(let k=0;k<=52;k++){
    const t=k/52,along=first+(last-first)*t,center=hairFallPoint(THREE,kit,'curlyFall',theta,along),hang=Math.max(0,(t-.12)/.88),turn=hang*(18+2.7*Math.sin(j*1.71))+phase,wave=.009*smooth(0,.20,t)*Math.sin(Math.PI*t);
    center.x+=Math.sin(turn)*wave;center.z+=Math.cos(turn+.4)*wave*.66;center.addScaledVector(V(Math.sin(theta),0,Math.cos(theta)).normalize(),.0025);pts.push(center);
   }
   locks.push(lock(pts,[.0002,.0033,.0045,.0038,.0021,.0002],56,1.28,.53));
  }
  hair.push(merge(locks));
 }else if(style==='highpony'){
  pony(tiePoint(kit,helmet?'nape':'crown'),.37);
 }else if(style==='bubblepony'){
  const at=tiePoint(kit,helmet?'nape':'back'),pieces=[];
  gather(at,at.clone().add(V(0,-.010,-.024)),.013);
  for(let i=0;i<5;i++){
   const center=V(at.x+Math.sin(i*.7)*.012,at.y-.033-i*.057,at.z-.026-i*.008),r=.027-i*.003;
   for(let j=0;j<10;j++){
    const a=j/10*Math.PI*2,pts=[];for(let k=0;k<=12;k++){const t=k/12,rr=.008+Math.sin(t*Math.PI)*r;pts.push(V(center.x+Math.cos(a)*rr,center.y+.030-t*.060,center.z+Math.sin(a)*rr));}
    pieces.push(curve(pts,[.004,.006,.006,.004],16));
   }
   ring(V(center.x,center.y-.028,center.z),.010);
  }
  hair.push(merge(pieces));ring(at);
 }else if(style==='braidedpony'){
  const at=tiePoint(kit,helmet?'nape':'back');braid([at,V(at.x,at.y-.10,at.z-.055),V(at.x+.025,at.y-.24,at.z-.06),V(at.x+.04,at.y-.38,at.z-.04)],.0165,8.5);
 }else if(style==='twintails'||style==='pigtails'){
  for(const sd of [-1,1])pony(V(sd*H.rx*(style==='pigtails'?.98:.86),H.cy-(style==='pigtails'?.004:.055),H.cz-.072),style==='pigtails'?.27:.24);
 }else if(style==='halfupbun'){
  bun(false,tiePoint(kit,helmet?'nape':'back'));
 }else if(style==='braidedbun'){
  const at=tiePoint(kit,'nape'),pts=[];
  gather(at,at.clone().add(V(0,0,-.025)),.020);
  for(let i=0;i<=60;i++){const t=i/60,a=t*Math.PI*5,r=.012+.03*t;pts.push(V(at.x+Math.cos(a)*r,at.y+Math.sin(a)*r*.75,at.z-.024-t*.018));}
  braid(pts,.009,15,false);
 }else if(style==='twists'){
  const pieces=[];
  for(let j=0;j<17;j++){
   const a=1.20+j/16*(Math.PI*2-2.4),start=scalpPoint(THREE,kit,V(Math.sin(a)*H.rx,H.cy+.022,H.cz+Math.cos(a)*H.rz),.012);
   for(let strand=0;strand<2;strand++){
    const pts=[],crown=V(Math.sin(a)*.028,H.top-.008,H.cz+Math.cos(a)*.030);
    for(let k=0;k<=52;k++){
     const t=k/52,turn=t*Math.PI*23+strand*Math.PI,root=Math.min(1,t*20),hang=Math.max(0,(t-.28)/.72);
     const center=t<.28?scalpPoint(THREE,kit,crown.clone().lerp(start,t/.28),.008):V(start.x+Math.sin(a)*hang*.016,start.y-hang*(.30+.018*Math.cos(j*3)),start.z-.020*hang);
     pts.push(center.add(V(Math.cos(turn)*.005*root,0,Math.sin(turn)*.005*root)));
    }
    pieces.push(curve(pts,[.0045,.006,.006,.004,.001],58,6));
   }
  }
  hair.push(merge(pieces));
 }else if(style==='sidebraid'){
  const T=tiePoint(kit,'nape');
  braid([T,V(.064,.015,-.065),V(.080,-.075,.016),V(.092,-.16,.084),V(.095,-.28,.133)],.014,9);
 }else if(style==='twinbraids'){
  for(const sd of [-1,1])braid([V(sd*H.rx*.80,H.cy-.044,H.cz-.060),V(sd*.080,-.028,-.076),V(sd*.090,-.15,-.090),V(sd*.087,-.27,-.098)],.013,8);
 }else if(style==='crownbraid'){
  if(helmet)bun();else{
   const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push(scalpPoint(THREE,kit,V(Math.sin(a)*H.rx,H.cy+.046+.022*Math.cos(a),H.cz+Math.cos(a)*H.rz),.005));}
   braid(pts,.0065,18,false);
  }
 }else if(style==='classicbun')bun(false,tiePoint(kit,helmet?'nape':'crown'));
  else if(style==='lowbun'||style==='messybun')bun(style==='messybun');
 else if(style==='coils'||style==='croppedcoils'){
  const pieces=[],cropped=style==='croppedcoils';
  for(let j=0;j<420;j++){
   const th=j*2.39996322973,phi=Math.acos(1-(j+.5)/420*1.38);
   const target=V(Math.sin(th)*Math.sin(phi)*H.rx,H.cy+Math.cos(phi)*H.ry,H.cz+Math.cos(th)*Math.sin(phi)*H.rz);
   if(Math.cos(th)>.35&&target.y<H.browTop+.026)continue;
   const size=(cropped?.0085:.017)*(1+.18*Math.sin(j*7.3+Math.cos(j*2.8)));
   const root=scalpPoint(THREE,kit,target,.001),normal=root.clone().sub(V(H.cx,H.cy,H.cz)).normalize();
   const tangent=V(Math.cos(th),0,-Math.sin(th)).normalize(),cross=normal.clone().cross(tangent).normalize(),pts=[];
   for(let k=0;k<=20;k++){const t=k/20,a=t*Math.PI*2.7+j*.83,r=size*(.36+.35*Math.sin(Math.PI*t));pts.push(root.clone().addScaledVector(normal,size*(.16+.50*Math.sin(Math.PI*t))).addScaledVector(tangent,Math.cos(a)*r).addScaledVector(cross,Math.sin(a)*r));}
   pieces.push(curve(pts,[size*.28,size*.32,size*.29,size*.13],22,6));
  }
  hair.push(merge(pieces));
 }
 return {hair,ties,ribbon};
}

/* Keep the sculpted part and face-framing locks of the loose style, drawing the
   lengths back around the ears into a compact crown for tied styles. */
export function gatheredCrown(THREE,source,kit){
 const geo=source.clone(),p=geo.attributes.position,index=geo.index;
 // The source has individual sculpted locks. Keep its five front locks; its
 // loose back curtain would turn into a blunt bob when gathered up.
 const parent=Array.from({length:p.count},(_,i)=>i),weld=new Map();
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[root(a)]=root(b);};
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);}
 for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
 const bounds=new Map();for(let i=0;i<p.count;i++){const id=root(i),b=bounds.get(id)||{z:Infinity,y:-Infinity};b.z=Math.min(b.z,p.getZ(i));b.y=Math.max(b.y,p.getY(i));bounds.set(id,b);}
 const kept=[];for(let i=0;i<index.count;i+=3){const b=bounds.get(root(index.getX(i)));if(b.z>.019&&b.y>.18)kept.push(index.getX(i),index.getX(i+1),index.getX(i+2));}
 geo.setIndex(kept);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const originalY=y;
  if(y<.145){
   const t=smooth((.145-y)/.18);
   y=.145+(y-.145)*.78;
   z-=.012*t;
   const point=new THREE.Vector3(x,y,z),fitted=scalpPoint(THREE,kit,point,.006);
   point.lerp(fitted,smooth((.15-originalY)/.20));
   x=point.x;y=point.y;z=point.z;
  }
  p.setXYZ(i,x,y,z);
 }
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}

function smoothHairNormals(geo){
 // Reshaping changes the lighting frame, even when the shared source already has tangents.
 geo.deleteAttribute('tangent');
 geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 for(const ids of groups.values()){let x=0,y=0,z=0;for(const i of ids){x+=n.getX(i);y+=n.getY(i);z+=n.getZ(i);}const length=Math.hypot(x,y,z)||1;for(const i of ids)n.setXYZ(i,x/length,y/length,z/length);}
}

/* Subdivide the source locks once, sharing positional adjacency across UV seams.
   UVs stay on their own charts; scalp projection keeps the crown above the head. */
export function polishHairSurface(THREE,source,kit,name='Hair_Long'){
 const pos=source.attributes.position,uv=source.attributes.uv,weld=new Map(),vertices=[],ids=[];
 for(let i=0;i<pos.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(pos,i),key=[p.x,p.y,p.z].map(v=>Math.round(v*1e5)).join(',');
  if(!weld.has(key)){weld.set(key,vertices.length);vertices.push({p,near:new Set(),boundary:new Set()});}ids.push(weld.get(key));
 }
 const indices=source.index?Array.from(source.index.array):Array.from({length:pos.count},(_,i)=>i),edges=new Map();
 const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
 for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(n=>ids[n]);for(let j=0;j<3;j++){
  const a=tri[j],b=tri[(j+1)%3],opposite=tri[(j+2)%3];if(a===b)continue;
  vertices[a].near.add(b);vertices[b].near.add(a);const key=edgeKey(a,b);
  if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(opposite);
 }}
 for(const e of edges.values())if(e.opposite.length===1){vertices[e.a].boundary.add(e.b);vertices[e.b].boundary.add(e.a);}
 const constrain=p=>{
  if(p.y>.09){const scalp=scalpPoint(THREE,kit,p,.0025),center=new THREE.Vector3(kit.head.cx,kit.head.cy,kit.head.cz),distance=p.distanceTo(center),skinDistance=scalp.distanceTo(center);
   if(distance<skinDistance)p.copy(scalp);
   else if(['Hair_Long','Hair_SimpleParted','Hair_Ponytail','Hair_Bun'].includes(name)&&p.y>kit.head.cy+.048){const crown=Math.min(1,(p.y-kit.head.cy-.048)/.055),excess=Math.max(0,distance-skinDistance-.009);if(excess)p.addScaledVector(p.clone().sub(center).normalize(),-excess*crown*.68);}}
  return p;
 };
 const smooth=vertices.map(v=>{
  const ns=[...v.near],bs=[...v.boundary],p=v.p.clone();
  if(bs.length===2){p.multiplyScalar(.75);for(const n of bs)p.addScaledVector(vertices[n].p,.125);}
  else if(bs.length===0&&ns.length>2){const beta=ns.length===3?3/16:3/(8*ns.length);p.multiplyScalar(1-ns.length*beta);for(const n of ns)p.addScaledVector(vertices[n].p,beta);}
  return constrain(p);
 });
 for(const e of edges.values()){
  e.p=vertices[e.a].p.clone().add(vertices[e.b].p).multiplyScalar(e.opposite.length===2?.375:.5);
  if(e.opposite.length===2)for(const n of e.opposite)e.p.addScaledVector(vertices[n].p,.125);constrain(e.p);
 }
 const positions=[],uvs=[],faces=[],seams=new Map();
 for(let i=0;i<indices.length;i+=3){
  const original=indices.slice(i,i+3),v=original.map(n=>ids[n]);if(new Set(v).size<3)continue;
  const points=v.map(n=>smooth[n]),tex=original.map(n=>new THREE.Vector2(uv.getX(n),uv.getY(n)));
  for(let j=0;j<3;j++){points.push(edges.get(edgeKey(v[j],v[(j+1)%3])).p);tex.push(tex[j].clone().lerp(tex[(j+1)%3],.5));}
  for(const tri of [[0,3,5],[3,1,4],[5,4,2],[3,4,5]])for(const n of tri){const values=[...points[n].toArray(),...tex[n].toArray()],key=values.map(v=>Math.round(v*1e6)).join(',');if(!seams.has(key)){seams.set(key,positions.length/3);positions.push(...values.slice(0,3));uvs.push(...values.slice(3));}faces.push(seams.get(key));}
 }
 const geo=new THREE.BufferGeometry();geo.setIndex(faces);geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}
