/* New styles are fitted in the Head bone's space, using the same scalp, strand
   materials and helmet deformation as the original character. */
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

export function shapeHair(source,style,head){
 const geo=source.clone(),p=geo.attributes.position;geo.computeBoundingBox();const sourceEnd=geo.boundingBox.min.y;
 const end=style==='bob'?-0.012:style==='beachbob'?-.055:style==='mermaidwaves'?-.42:style==='lob'?-0.15:style==='long'?-0.29:-0.26;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(style==='pixie'){
   x*=1.06;z*=1.07;
   if(y>head.cy)y+=(y-head.cy)*0.10;
  }else if(y<0.085){
   const t=Math.min(1,Math.max(0,(0.085-y)/Math.max(.02,.085-sourceEnd)));
   y=0.085+(end-0.085)*t+.009*Math.sin(x*85+z*37)*Math.max(0,(t-.72)/.28);
   const side=Math.sign(x)||1;
   x+=side*(style==='bob'?0.006*Math.sin(t*Math.PI):0.014*t);
   if(z<0.015)z-=Math.max(0,t-0.30)*0.075;
   if(['waves','beachbob','mermaidwaves'].includes(style)){
    x+=side*0.011*Math.sin(t*10.5+z*18)*t;
    z+=0.009*Math.sin(t*12.0+x*20)*t;
   }
   if(style==='bob')x*=1-0.07*t*t;
  }
  p.setXYZ(i,x,y,z);
 }
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}

/* The measured skull narrows sharply at the nape. A bounding-box radius leaves
   tails hanging in space there, so every root is projected onto the real head. */
export function scalpPoint(THREE,kit,target,lift=.002){
 if(!kit.hairSurface){
  const hi=kit.skin.skeleton.bones.findIndex(b=>b.name==='Head'),geo=kit.skin.geometry.clone();geo.applyMatrix4(kit.skin.skeleton.boneInverses[hi]);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);kit.hairSurface={mesh,ray:new THREE.Raycaster()};
 }
 const H=kit.head,center=new THREE.Vector3(H.cx,H.cy,H.cz),direction=target.clone().sub(center).normalize(),{mesh,ray}=kit.hairSurface;
 ray.set(center,direction);const hit=ray.intersectObject(mesh,false)[0];
 return hit?hit.point.clone().addScaledVector(hit.face.normal,lift):target.clone();
}

export function hairDetails({THREE,kit,style,helmet,tube,merge,tiePoint}){
 const H=kit.head,hair=[],ties=[],ribbon=[],V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const anchor=p=>scalpPoint(THREE,kit,p,-.003);
 const ring=(p,r=0.016,dir=V(0,-1,0))=>{const g=new THREE.TorusGeometry(r,0.0022,7,24);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),dir.clone().normalize()));g.translate(p.x,p.y,p.z);ties.push(g);};
 const curve=(points,radii,segs=30,rad=8)=>tube(points,radii,segs,rad);
 const gather=(at,end,r=.015)=>{const start=anchor(at),mid=start.clone().lerp(end,.5);hair.push(curve([start,mid,end],[r*1.2,r,r*.9],12));};
 const pony=(at,length=0.28)=>{
  at=anchor(at);
  const pieces=[];
  for(let j=0;j<9;j++){
   const a=j/9*Math.PI*2,r=j?0.013:0,pts=[];
   for(let k=0;k<7;k++){
    const t=k/6,fan=Math.sin(t*Math.PI)*0.010;
    const root=Math.min(1,t*5);
    pts.push(V(at.x+Math.cos(a)*(r+fan)*root+0.006*Math.sin(t*5.5+j)*t,
     at.y-t*length,at.z-0.016*root-0.018*Math.sin(t*Math.PI*.9)+Math.sin(a)*r*root));
   }
   pieces.push(curve(pts,[0.007,0.010,0.010,0.008,0.005,0.001],32));
  }
  hair.push(merge(pieces));ring(at.clone().add(V(0,-.008,-.004)),.012,V(0,-1,-.5));
 };
 const braid=(points,radius=0.017,turns=7,rooted=true)=>{
  if(rooted)points[0]=anchor(points[0]);
  const axis=new THREE.CatmullRomCurve3(points),pieces=[];
  for(let strand=0;strand<3;strand++){
   const pts=[];
   for(let k=0;k<=64;k++){
    const t=k/64,center=axis.getPoint(t),tangent=axis.getTangent(t).normalize();
    const side=Math.abs(tangent.x)>.85?V(0,0,1):V(1,0,0);side.addScaledVector(tangent,-side.dot(tangent)).normalize();const cross=tangent.clone().cross(side);
    const a=t*turns*Math.PI*2+strand*Math.PI*2/3,rr=radius*(1-0.48*t)*(rooted?Math.min(1,t*18):1);
    center.addScaledVector(side,Math.cos(a)*rr).addScaledVector(cross,Math.sin(a*2)*rr*0.5);pts.push(center);
   }
   const scale=radius/.017;pieces.push(curve(pts,[0.009,0.009,0.007,0.005,0.003].map(v=>v*scale),72));
  }
  hair.push(merge(pieces));if(rooted)ring(axis.getPoint(.96),radius*.55,axis.getTangent(.96));
 };
 const bun=(messy=false,anchor=null)=>{
  const root=anchor||tiePoint(kit,helmet||!messy?'nape':'crown'),at=root.clone();at.z-=0.014;
  gather(root,at,.019);
  const core=new THREE.SphereGeometry(.027,24,16);core.scale(1.08,.76,.68);core.translate(at.x,at.y,at.z-.008);
  const pieces=[core];
  for(let j=0;j<7;j++){
   const pts=[],a0=j*0.9;
   for(let k=0;k<=24;k++){
    const t=k/24,a=t*Math.PI*2.7+a0,r=0.012+0.026*Math.sin(t*Math.PI);
    pts.push(V(at.x+Math.cos(a)*r*(messy?1.18:1.1),at.y+Math.sin(a)*r*.72,at.z-0.018*Math.sin(t*Math.PI)-j*0.001));
   }
   pieces.push(curve(pts,[.008,.011,.010,.007,.002],32));
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
  const locks=[];
  for(let j=0;j<38;j++){
   const angle=1.05+j/37*(Math.PI*2-2.10),front=Math.cos(angle),side=Math.sin(angle);
   const start=scalpPoint(THREE,kit,V(side*H.rx,H.cy+.068,H.cz+front*H.rz),.018),fall=scalpPoint(THREE,kit,V(side*H.rx,H.cy+.006,H.cz+front*H.rz),.018);
   const length=.26+.025*Math.sin(j*2.3),pts=[];
   for(let k=0;k<=40;k++){
    const t=k/40,turn=t*Math.PI*(7.5+.6*Math.sin(j))+j*2.399963,hang=Math.max(0,(t-.26)/.74),wave=.013*Math.min(1,t*5)+.003*hang;
    const center=t<.26?scalpPoint(THREE,kit,start.clone().lerp(fall,t/.26),.018):V(fall.x+side*.012*hang,fall.y-length*hang,fall.z-.025*hang);
    pts.push(center.add(V(Math.cos(turn)*wave,0,Math.sin(turn)*wave)));
   }
   locks.push(curve(pts,[.006,.010,.010,.008,.006,.0007],44,8));
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
  const at=tiePoint(kit,helmet?'nape':'back');braid([at,V(at.x,at.y-.10,at.z-.055),V(at.x+.025,at.y-.24,at.z-.06),V(at.x+.04,at.y-.38,at.z-.04)],.021,11);
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
 geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 for(const ids of groups.values()){let x=0,y=0,z=0;for(const i of ids){x+=n.getX(i);y+=n.getY(i);z+=n.getZ(i);}const length=Math.hypot(x,y,z)||1;for(const i of ids)n.setXYZ(i,x/length,y/length,z/length);}
}
