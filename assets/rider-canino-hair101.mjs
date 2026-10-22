import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

// Every cut retains Canino's authored card topology, UV atlas, alpha tips and
// fitted part. Only the lengths are restyled; no replacement scalp is generated.
export const CANINO_HAIR_STYLES=[
 {id:'long',label:'Long layers',body:['f']},
 {id:'waves',label:'Soft waves',body:['f']},
 {id:'bob',label:'Shoulder bob',body:['f']},
 {id:'ponytail',label:'Ponytail',body:['f']},
 {id:'highpony',label:'High ponytail',body:['f']},
 {id:'lowpony',label:'Low ponytail',body:['f']},
 {id:'braid',label:'Braided ponytail',body:['f']},
 {id:'bun',label:'Low woven bun',body:['f']},
 {id:'pigtails',label:'Twin ponytails',body:['f']}
];
const supported=new Set(CANINO_HAIR_STYLES.map(s=>s.id));
const aliases={loose:'long',mermaidwaves:'waves',curly:'waves',ringlets:'waves',lowbun:'bun',braidedpony:'braid',fishtail:'braid',twinbraids:'pigtails',buns:'pigtails',spacebuns:'pigtails',lob:'bob'};
export function caninoHairId(id){id=aliases[id]||id||'long';return supported.has(id)?id:'long';}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
let identityState=0x101c4a17;
export function withCaninoHair101Identity(fn){
 const saved=Math.random;
 Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{return fn();}finally{Math.random=saved;}
}

function cardLabels(g){
 const p=g.attributes.position,uv=g.attributes.uv,count=p.count,parent=Int32Array.from({length:count},(_,i)=>i),same=new Map();
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[find(a)]=find(b);};
 for(let i=0;i<count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].map(x=>Math.round(x*1e5)).join('|');
  if(same.has(key))join(i,same.get(key));else same.set(key,i);
 }
 const index=g.index;
 for(let i=0;i<(index?index.count:count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;join(a,b);join(a,c);}
 const groups=new Map(),labels=new Uint16Array(count),cards=[];
 for(let i=0;i<count;i++){
  const root=find(i);if(!groups.has(root)){groups.set(root,cards.length);cards.push({x:0,z:0,count:0});}
  const label=groups.get(root),card=cards[label];labels[i]=label;card.x+=p.getX(i);card.z+=p.getZ(i);card.count++;
 }
 for(const c of cards){c.x/=c.count;c.z/=c.count;c.side=c.x<0?-1:1;}
 return {labels,cards};
}

// The frame is measured from the imported meshes in the actual canonical Head
// bind frame. Old portrait metadata and old procedural hair charts are unused.
export function createCaninoHair101Template(T,{head,hair,headInverse,eyes=[]}){
 if(!head?.geometry||!hair?.geometry||!headInverse)throw Error('Canino hair needs the imported head, hair and actual Head bind inverse');
 const toLocal=headInverse.clone().multiply(hair.bindMatrix||new T.Matrix4()),toBind=toLocal.clone().invert();
 const headLocal=withCaninoHair101Identity(()=>head.geometry.clone()).applyMatrix4(headInverse.clone().multiply(head.bindMatrix||new T.Matrix4()));
 headLocal.computeBoundingBox();
 const bounds=headLocal.boundingBox,positions=hair.geometry.attributes.position,normals=hair.geometry.attributes.normal,local=new Float32Array(positions.count*3),localNormals=new Float32Array(positions.count*3),V=(...a)=>new T.Vector3(...a),normalMatrix=new T.Matrix3().getNormalMatrix(toLocal);
 const box=new T.Box3();
 for(let i=0;i<positions.count;i++){const p=V().fromBufferAttribute(positions,i).applyMatrix4(toLocal);p.toArray(local,i*3);box.expandByPoint(p);V().fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix).toArray(localNormals,i*3);}
 const centers=eyes.filter(m=>m?.geometry).map(m=>{const b=new T.Box3().setFromBufferAttribute(m.geometry.attributes.position);return b.getCenter(V()).applyMatrix4(headInverse.clone().multiply(m.bindMatrix||new T.Matrix4()));});
 const eye=centers.length?centers.reduce((a,b)=>a.add(b),V()).multiplyScalar(1/centers.length):V((bounds.min.x+bounds.max.x)*.5,bounds.max.y-.111,bounds.max.z-.044);
 const center=V(eye.x,eye.y+.022,eye.z-.085),surface=createTriangleSurface(T,headLocal),cols=64,rows=32,minY=Math.max(bounds.min.y,eye.y-.085),maxY=Math.min(bounds.max.y-.001,eye.y+.078),radii=new Float32Array((cols+1)*rows);
 let misses=0;
 try{
  for(let j=0;j<rows;j++)for(let i=0;i<=cols;i++){
   const theta=-Math.PI+i/cols*Math.PI*2,y=lerp(minY,maxY,j/(rows-1)),direction=V(Math.sin(theta),0,Math.cos(theta)),hit=surface.cast(V(center.x,y,center.z),direction);
   if(hit)radii[j*(cols+1)+i]=Math.hypot(hit.point.x-center.x,hit.point.z-center.z);
   else{misses++;radii[j*(cols+1)+i]=Math.max(.035,Math.min(.095,Math.max(Math.abs(bounds.min.x),bounds.max.x)))*.9;}
  }
 }finally{surface.dispose();headLocal.dispose();}
 const radius=(theta,y)=>{
  theta=((theta+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  const u=(theta+Math.PI)/(Math.PI*2)*cols,v=Math.max(0,Math.min(rows-1,(y-minY)/(maxY-minY)*(rows-1))),i=Math.min(cols-1,Math.floor(u)),j=Math.min(rows-2,Math.floor(v)),x=u-i,t=v-j;
  return lerp(lerp(radii[j*(cols+1)+i],radii[j*(cols+1)+i+1],x),lerp(radii[(j+1)*(cols+1)+i],radii[(j+1)*(cols+1)+i+1],x),t);
 };
 const cards=cardLabels(hair.geometry);
 for(const card of cards.cards){card.localMinY=Infinity;card.localMaxY=-Infinity;card.localX=0;card.localZ=0;}
 for(let i=0;i<positions.count;i++){const card=cards.cards[cards.labels[i]],y=local[i*3+1];card.localMinY=Math.min(card.localMinY,y);card.localMaxY=Math.max(card.localMaxY,y);card.localX+=local[i*3];card.localZ+=local[i*3+2];}
 for(const card of cards.cards){card.localX/=card.count;card.localZ/=card.count;}
 return {source:hair.geometry,local,localNormals,toLocal,toBind,eye:eye.toArray(),center:center.toArray(),headBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},hairBounds:{min:box.min.toArray(),max:box.max.toArray()},radius,labels:cards.labels,cards:cards.cards,metrics:{sourceVertices:positions.count,sourceTriangles:(hair.geometry.index?.count||positions.count)/3,authoredCards:cards.cards.length,headSurfaceSamples:(cols+1)*rows,headSurfaceMisses:misses}};
}

function morph(T,template,style,helmet){
 const E=template.eye,C=template.center,loose=style==='bob'||style==='waves',bottom=template.hairBounds.min[1];
 const high=style==='highpony',low=style==='lowpony',twins=style==='pigtails',braid=style==='braid',bun=style==='bun';
 let tieY=E[1]+(high?(helmet?-.035:.045):low?-.102:braid?-.073:bun?-.053:twins?-.043:-.060);
 const tieTheta=twins?2.17:Math.PI,tieRadius=template.radius(tieTheta,tieY)+.014,tieZ=twins?C[2]+Math.cos(tieTheta)*tieRadius:Math.min(C[2]+Math.cos(tieTheta)*tieRadius,template.headBounds.min[2]-.013);
 return (p,card,out)=>{
  const info=template.cards[card],phase=card*2.399963,variation=.006*Math.sin(phase),start=E[1]+(loose?.075:.060)+(!loose?variation:0),end=E[1]-.085+variation,span=start-bottom,join=(start-end)/span;
  out.copy(p);if(p.y>=start||style==='long')return out;
  const s=Math.max(0,(start-p.y)/span),descend=smooth(0,.34,s),side=info.side;
  if(style==='waves'){
   out.x+=.021*Math.sin(s*8.6+phase*.19)*descend;
   out.z+=.015*Math.sin(s*8.6+phase*.19+1.3)*descend;
   return out;
  }
  if(style==='bob'){
   out.y=start-(start-p.y)*.61+.005*Math.sin(phase)*smooth(.48,1,s);
   // Retain the authored outside radii. Pulling the shortened front cards in
   // toward the face turns their tips into horizontal cheek/mouth spikes.
   out.x=p.x+.004*side*smooth(.6,1,s);
   out.z=p.z-.004*smooth(.66,1,s);
   // Short underlayers begin beside the cheek rather than at the part. Keep
   // those roots at their own authored height instead of lifting them across
   // the mouth with the long card's compression interval.
   if(info.localMaxY<E[1]-.020){out.y=info.localMaxY-(info.localMaxY-p.y)*.36;}
   const clear=(1-smooth(E[1]-.035,E[1]+.012,out.y))*smooth(E[2]+.004,E[2]+.035,out.z);
   out.x=lerp(out.x,side*Math.max(Math.abs(out.x),Math.max(Math.abs(template.headBounds.min[0]),template.headBounds.max[0])*.98),clear);
   out.z=lerp(out.z,Math.min(out.z,E[2]-.005),clear);
   return out;
  }
  // The artist's short fringe/temple cards already terminate at the natural
  // hairline. Gathering these made the original abrupt top-only toupee.
  if(info.localMaxY-info.localMinY<.205)return out;
  // Preserve two low-rooted face frames as short loose wisps beside the jaw.
  if(info.localMaxY<E[1]-.020&&info.localZ>E[2]+.018&&Math.abs(info.localX)<.078){
   const t=smooth(info.localMaxY,info.localMinY,p.y);out.y=info.localMaxY-(info.localMaxY-p.y)*.34;out.x+=side*.022*t;out.z-=.024*t;return out;
  }
  const spreadX=twins?(p.x-side*.105)*.34:p.x*.285;
  const spreadZ=(p.z-C[2])*(twins?.27:.24),tieX=C[0]+(twins?side*(Math.sin(tieTheta)*tieRadius+.011):0);
  if(s<=join){
   const u=s/join,sweep=smooth(.60,.96,u),theta=Math.atan2(p.x-C[0],p.z-C[2]),goal=side*tieTheta,angle=lerp(theta,goal,sweep),y=lerp(p.y,tieY,smooth(.70,1,u)),r=template.radius(angle,y)+lerp(.012,.006,sweep);
   const x=C[0]+Math.sin(angle)*r,z=C[2]+Math.cos(angle)*r,finish=smooth(.86,1,u),pull=smooth(0,.25,u);
   out.set(lerp(p.x,lerp(x,tieX+spreadX,finish),pull),lerp(p.y,y,pull),lerp(p.z,lerp(z,tieZ+spreadZ,finish),pull));
   return out;
  }
  const t=(s-join)/(1-join),ease=smooth(0,.16,t),length=high?.34:low?.255:twins?.285:braid?.31:.31;
  if(bun){
   const a=t*Math.PI*3.45,ring=.045*Math.sin(Math.min(1,t)*Math.PI*.88),tuck=1-smooth(.76,1,t),x=Math.sin(a)*ring,z=-.020-.030*Math.sin(Math.min(1,t)*Math.PI);
   out.set(tieX+x+spreadX*.72*tuck,tieY-.014+(Math.cos(a)-1)*.029+spreadZ*.25*tuck,tieZ+z*ease+spreadZ*.8*tuck);return out;
  }
  const wave=Math.sin(t*5.1+phase*.07)*.007*ease,back=.026*smooth(0,.65,t)+.010*t;
  out.set(tieX+spreadX+wave,tieY-length*t,tieZ+spreadZ-back);
  if(braid){const angle=(card%3)*Math.PI*2/3+t*Math.PI*6.2,amount=.021*smooth(0,.13,t)*(1-.35*smooth(.75,1,t));out.x=tieX+spreadX*.52+Math.cos(angle)*amount;out.z=tieZ+spreadZ*.58-back+Math.sin(angle)*amount*.82;}
  if(twins)out.x+=side*.018*Math.sin(Math.min(1,t)*Math.PI*.85);
  return out;
 };
}

export function buildCaninoHair101Geometry(T,template,style,helmet=false){
 style=caninoHairId(style);if(style==='long')return {geometry:template.source,owned:false,metrics:{...template.metrics,style,helmet,originalShape:true}};
 return withCaninoHair101Identity(()=>{
  const g=template.source.clone(),p=g.attributes.position,n=g.attributes.normal,fn=morph(T,template,style,helmet),source=new T.Vector3(),out=new T.Vector3(),plus=new T.Vector3(),minus=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),J=new T.Matrix3(),N=new T.Matrix3(),bindNormal=new T.Matrix3().getNormalMatrix(template.toBind),eps=.00002;
  let finite=true,maxCrownDisplacement=0;
  for(let i=0;i<p.count;i++){
   source.fromArray(template.local,i*3);const label=template.labels[i];fn(source,label,out);
   if(source.y>=template.eye[1]+.075)maxCrownDisplacement=Math.max(maxCrownDisplacement,out.distanceTo(source));
   out.applyMatrix4(template.toBind);p.setXYZ(i,out.x,out.y,out.z);finite&&=Number.isFinite(out.x+out.y+out.z);
   // Carry the artist's smooth normals through the local deformation Jacobian;
   // recomputing disconnected card triangles would introduce visible facets.
   for(let axis=0;axis<3;axis++){
    plus.copy(source);minus.copy(source);plus.setComponent(axis,plus.getComponent(axis)+eps);minus.setComponent(axis,minus.getComponent(axis)-eps);
    fn(plus,label,plus);fn(minus,label,minus);[a,b,c][axis].subVectors(plus,minus).multiplyScalar(.5/eps);
   }
   J.set(a.x,b.x,c.x,a.y,b.y,c.y,a.z,b.z,c.z);
   normal.fromArray(template.localNormals,i*3);if(Math.abs(J.determinant())>.000001)normal.applyMatrix3(N.copy(J).invert().transpose()).normalize();
   normal.applyNormalMatrix(bindNormal);n.setXYZ(i,normal.x,normal.y,normal.z);finite&&=Number.isFinite(normal.x+normal.y+normal.z);
  }
  if(!finite){g.dispose();throw Error('Canino hair produced a non-finite vertex');}
  p.needsUpdate=true;n.needsUpdate=true;
  // An imported tangent field describes the old lengths; the physical hair
  // material does not use anisotropy, so removing it is preferable to stale axes.
  g.deleteAttribute('tangent');g.computeBoundingBox();g.computeBoundingSphere();
  const metrics={...template.metrics,style,helmet,originalShape:false,maxCrownDisplacementM:maxCrownDisplacement,bounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}};
  g.userData.caninoHair101=metrics;return {geometry:g,owned:true,metrics};
 });
}

export function installCaninoHair101(T,rig,{head,hair,lifecycle,initialLook={}}={}){
 if(!head||!hair||rig.caninoHair101)return rig;
 const skeleton=rig.body.skeleton,headID=skeleton.bones.indexOf(rig.bones.Head);
 if(headID<0)throw Error('Canino hairstyles require the actual shared Head bone');
 const eyes=(rig.canino100?.imported||[]).filter(m=>m.userData.caninoKind==='eye');
 const template=createCaninoHair101Template(T,{head,hair,headInverse:skeleton.boneInverses[headID],eyes}),originalGeometry=hair.geometry;
 const oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldRefresh=rig.refreshAccessories,oldDispose=rig.dispose,sourceMaterial=hair.material;
 const inferredStyle=typeof rig.look==='string'?rig.look.split('|')[0]:rig.look?.hairStyle;
 let savedLook={hairStyle:inferredStyle,...initialLook},dead=false,style=caninoHairId(savedLook.hairStyle),helmet=rig.u.uHelmet.value>.5,key='',owned=null,last=null,builds=0,nesting=0;
 const ensure=()=>{
  if(dead||nesting)return;
  const next=style+'|'+(helmet?1:0);hair.visible=true;if(next===key)return;
  const packet=buildCaninoHair101Geometry(T,template,style,helmet),previous=owned;
  hair.geometry=packet.geometry;owned=packet.owned?packet.geometry:null;key=next;last={...packet.metrics,builds:++builds};
  previous?.dispose();lifecycle?.changed?.(rig,'canino-hair101');
 };
 rig.setHair=function(id,color,on){
  style=caninoHairId(id);if(color)rig.u.uHair.value.set(color);if(typeof on==='boolean')helmet=on;
  if(!nesting){
   savedLook={...savedLook,hairStyle:style};if(color)savedLook.hair=color;
   if(typeof on==='boolean')savedLook.helmet=on?(savedLook.helmet&&savedLook.helmet!=='none'?savedLook.helmet:'#2e2e38'):'none';
  }
  // The old setter constructs the previous character's scalp and must never
  // run for this imported character. The existing shader owns selected color.
  ensure();
 };
 rig.setLook=function(look={}){
  savedLook={...savedLook,...look};
  nesting++;try{return oldLook.call(this,savedLook);}finally{nesting--;style=caninoHairId(savedLook.hairStyle);helmet=rig.u.uHelmet.value>.5;if(!nesting)ensure();}
 };
 rig.setOutfit=function(id,callback){return oldOutfit.call(this,id,()=>{savedLook={...savedLook,outfit:rig.outfitId};ensure();callback?.();});};
 if(oldRefresh)rig.refreshAccessories=function(...args){const value=oldRefresh.apply(this,args);ensure();return value;};
 rig.caninoHair101={styles:CANINO_HAIR_STYLES,evidence:()=>last?{...last,style,helmet,look:{...savedLook},sourceMaterialPreserved:hair.material===sourceMaterial,liveOwnedGeometries:owned?1:0,sourceGeometryRetained:originalGeometry===template.source}:null};
 rig.dispose=function(...args){if(dead)return;dead=true;owned?.dispose();owned=null;hair.geometry=originalGeometry;return oldDispose.apply(this,args);};
 ensure();return rig;
}
