/* Modern equestrian garment construction. Every added vertex keeps the body's
   interpolated joint weights, including folded collars and raised pocket edges. */
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {trimGarment,surfaceSampler} from './rider-fit.js?v=tailored-coats69-20261010';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
// The visible body uses this same opening, with a small overlap under cloth.
export function garmentNeckY(x,zz,z,c,lining=false){
 const ax=Math.abs(x),height=c.collared&&!c.cardigan?z.neckY+.018+.016*(1-smooth(z.neckZ-.045,z.neckZ+.020,zz))+.018*Math.min(ax/.075,1)**2+.068*smooth(.080,.15,ax)-(c.polo?.042*(1-smooth(0,.048,ax))*smooth(z.neckZ+.010,z.neckZ+.040,zz):0):z.neckY+.036*(1-smooth(-.09,0,zz-z.neckZ))+.045*Math.min(ax/.085,1)**2+.075*smooth(.085,.15,ax);
 return height-(lining&&c.vest?.030*(1-smooth(.085,.145,ax)):0);
}
export const GARMENT_NECK_GLSL=`
float garmentNeckY(vec3 p,vec2 neck,float collared,float polo){
 float ax=abs(p.x);
 float roundNeck=neck.x+.036*(1.0-smoothstep(-.09,0.0,p.z-neck.y))+.045*pow(min(ax/.085,1.0),2.0)+.075*smoothstep(.085,.15,ax);
 float foldedNeck=neck.x+.018+.016*(1.0-smoothstep(neck.y-.045,neck.y+.020,p.z))+.018*pow(min(ax/.075,1.0),2.0)+.068*smoothstep(.080,.15,ax)-polo*.042*(1.0-smoothstep(0.0,.048,ax))*smoothstep(neck.y+.010,neck.y+.040,p.z);
 return mix(roundNeck,foldedNeck,collared);
}`;
export function garmentCut(o){
 const formal=['show','hunter','dressage','pinstripe','tweed'].includes(o.id),vest=['quilted','explorer','ranger'].includes(o.id),cardigan=o.id==='cardigan';
 const polo=['polo','sportpolo','rugby'].includes(o.id),sport=['eventer','team','chevron','raincoat','sweatshirt','summit'].includes(o.id);
 const knit=o.cut==='sweater',jacket=o.cut==='jacket'||o.cut==='coat',short=o.cut==='short',tee=['breton','daisytee'].includes(o.id);
 const collared=formal||vest||polo||sport||jacket||(!knit&&!tee);
 const family=formal?'competition':vest?'vest':cardigan?'cardigan':polo?'polo':sport?'technical':knit?'knit':jacket?'overshirt':tee?'tee':'blouse';
 const drape={competition:[.002,.003,.003,.0008],vest:[.008,.010,.008,.0012],cardigan:[.009,.014,.011,.0019],polo:[.002,.003,.001,.0011],technical:[.002,.005,.003,.0010],knit:[.007,.012,.010,.0020],overshirt:[.007,.011,.009,.0016],tee:[.003,.006,.003,.0013],blouse:[.005,.011,.007,.0018]}[family];
 return {formal,vest,cardigan,polo,sport,knit,jacket,short,tee,collared,family,drape,
  hem:formal?(o.cut==='coat'?-.115:-.072):cardigan?-.135:vest?-.045:jacket?-.060:knit?-.029:tee?-.018:.010,
  ease:vest?.014:formal?.008:knit?.012:jacket?.012:.005};
}
function normals(geo,preserve=false){
 if(!preserve)geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');let g=groups.get(key);if(!g){g={ids:[],x:0,y:0,z:0};groups.set(key,g);}g.ids.push(i);g.x+=n.getX(i);g.y+=n.getY(i);g.z+=n.getZ(i);}
 for(const g of groups.values()){const l=Math.hypot(g.x,g.y,g.z)||1;for(const i of g.ids)n.setXYZ(i,g.x/l,g.y/l,g.z/l);}
}
// Add resolution before draping so collars and curved fronts do not inherit the
// coarse body's planar triangles. The shared refined skin is never mutated.
function clothSkin(THREE,kit){
 if(kit.clothSkin)return kit.clothSkin.clone();
 const g=(kit.garmentSkin||kit.skin).geometry,idx=g.index,attrs=g.attributes,P=[],N=[],U=[],J=[],W=[];
 const read=i=>({p:[attrs.position.getX(i),attrs.position.getY(i),attrs.position.getZ(i)],n:[attrs.normal.getX(i),attrs.normal.getY(i),attrs.normal.getZ(i)],uv:[attrs.uv.getX(i),attrs.uv.getY(i)],weights:(()=>{const w=new Map();for(const get of ['getX','getY','getZ','getW']){const j=attrs.skinIndex[get](i);w.set(j,(w.get(j)||0)+attrs.skinWeight[get](i));}return w;})()});
 const mid=(a,b)=>{const w=new Map();for(const [j,v]of a.weights)w.set(j,v*.5);for(const [j,v]of b.weights)w.set(j,(w.get(j)||0)+v*.5);return {p:a.p.map((v,k)=>(v+b.p[k])*.5),n:a.n.map((v,k)=>(v+b.n[k])*.5),uv:a.uv.map((v,k)=>(v+b.uv[k])*.5),weights:w};};
 const push=v=>{P.push(...v.p);N.push(...v.n);U.push(...v.uv);const a=[...v.weights].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=a.reduce((s,v)=>s+v[1],0)||1;while(a.length<4)a.push([0,0]);J.push(...a.map(v=>v[0]));W.push(...a.map(v=>v[1]/sum));};
 for(let i=0;i<(idx?idx.count:attrs.position.count);i+=3){const [a,b,c]=[0,1,2].map(k=>read(idx?idx.getX(i+k):i+k)),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);for(const v of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])push(v);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));geo.setIndex(Array.from({length:P.length/3},(_,i)=>i));const pos=geo.attributes.position,groups=[],lookup=new Map(),ids=[];
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i),key=v.toArray().map(v=>Math.round(v*100000)).join(',');let id=lookup.get(key);if(id===undefined){id=groups.length;lookup.set(key,id);groups.push({p:v,vertices:[],near:new Set()});}groups[id].vertices.push(i);ids.push(id);}
 for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3];groups[a].near.add(b);groups[b].near.add(a);}
 for(let pass=0;pass<12;pass++){
  const next=groups.map(g=>{const {x,z}=g.p,y=g.p.y-(kit.proportionLift||0),weight=smooth(.76,.88,y)*(1-smooth(1.40,1.49,y))*(1-smooth(.215,.31,Math.abs(x)));if(!weight||!g.near.size)return g.p.clone();const mean=new THREE.Vector3();for(const i of g.near)mean.add(groups[i].p);mean.divideScalar(g.near.size);return g.p.clone().lerp(mean,.36*weight);});
  groups.forEach((g,i)=>g.p.copy(next[i]));
 }
 for(const g of groups)for(const i of g.vertices)pos.setXYZ(i,g.p.x,g.p.y,g.p.z);
 normals(geo);kit.clothSkin=geo;return geo.clone();
}
function refineNeckOpening(THREE,source,z){
 const attrs=source.attributes,idx=source.index,P=[],N=[],U=[],J=[],W=[],vertices=new Map(),geometricIds=new Map(),midpoints=new Map();
 let nextId=0;
 // Position IDs join coincident triangle corners without welding UV/normal seams.
 const geometricId=p=>{const key=p.join(',');let id=geometricIds.get(key);if(id===undefined){id=nextId++;geometricIds.set(key,id);}return id;};
 const read=i=>{
  if(vertices.has(i))return vertices.get(i);
  const p=[attrs.position.getX(i),attrs.position.getY(i),attrs.position.getZ(i)],weights=new Map();
  for(const get of ['getX','getY','getZ','getW']){const j=attrs.skinIndex[get](i);weights.set(j,(weights.get(j)||0)+attrs.skinWeight[get](i));}
  const v={id:geometricId(p),p,n:[attrs.normal.getX(i),attrs.normal.getY(i),attrs.normal.getZ(i)],uv:[attrs.uv.getX(i),attrs.uv.getY(i)],weights};vertices.set(i,v);return v;
 };
 const edge=(a,b)=>a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;
 const mid=(a,b)=>{
  const key=edge(a,b);let shared=midpoints.get(key);
  if(!shared){const p=a.p.map((v,k)=>(v+b.p[k])*.5);shared={id:geometricId(p),p};midpoints.set(key,shared);}
  // Canonical joint order makes either orientation of a shared edge choose the
  // same four influences if truncation encounters equal weights.
  const joints=[...new Set([...a.weights.keys(),...b.weights.keys()])].sort((a,b)=>a-b),weights=new Map(joints.map(j=>[j,((a.weights.get(j)||0)+(b.weights.get(j)||0))*.5]));
  return {id:shared.id,p:shared.p,n:a.n.map((v,k)=>(v+b.n[k])*.5),uv:a.uv.map((v,k)=>(v+b.uv[k])*.5),weights};
 };
 const push=v=>{P.push(...v.p);N.push(...v.n);U.push(...v.uv);const ranked=[...v.weights].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,v)=>n+v[1],0)||1;while(ranked.length<4)ranked.push([0,0]);J.push(...ranked.map(v=>v[0]));W.push(...ranked.map(v=>v[1]/sum));};
 let faces=[];for(let i=0;i<(idx?idx.count:attrs.position.count);i+=3)faces.push([0,1,2].map(k=>read(idx?idx.getX(i+k):i+k)));
 // Two global rounds retain the local refinement budget. Every incident face
 // observes an edge mark, including faces outside the selected neck band.
 for(let round=0;round<2;round++){
  const split=new Set();
  for(const face of faces){
   const near=face.some(v=>Math.abs(v.p[0])<.145&&v.p[1]>z.neckY-.025&&v.p[1]<z.neckY+.105),longest=Math.max(...[[0,1],[1,2],[2,0]].map(([a,b])=>Math.hypot(...face[a].p.map((x,k)=>x-face[b].p[k]))));
   if(near&&longest>.008)for(let k=0;k<3;k++)split.add(edge(face[k],face[(k+1)%3]));
  }
  if(!split.size)break;
  const next=[];
  for(const [a,b,c]of faces){
   const ab=split.has(edge(a,b))?mid(a,b):null,bc=split.has(edge(b,c))?mid(b,c):null,ca=split.has(edge(c,a))?mid(c,a):null,count=Number(!!ab)+Number(!!bc)+Number(!!ca);
   if(count===0)next.push([a,b,c]);
   else if(count===3)next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
   else if(count===1){
    if(ab)next.push([a,ab,c],[ab,b,c]);
    else if(bc)next.push([b,bc,a],[bc,c,a]);
    else next.push([c,ca,b],[ca,a,b]);
   }else{
    // Rotate the two-edge transition around their shared original corner.
    if(ab&&bc)next.push([b,bc,ab],[a,ab,c],[ab,bc,c]);
    else if(bc&&ca)next.push([c,ca,bc],[b,bc,a],[bc,ca,a]);
    else next.push([a,ab,ca],[c,ca,b],[ca,ab,b]);
   }
  }
  faces=next;
 }
 for(const face of faces)for(const v of face)push(v);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));geo.setIndex(Array.from({length:P.length/3},(_,i)=>i));return geo;
}
const mesh=(kit,geometry,name,clothPart='tailored')=>({geometry,material:kit.materials.body,name,clothPart,skeleton:kit.skin.skeleton,bindMatrix:kit.skin.bindMatrix});
export function tailoredTop(THREE,kit,outfit,layer='outer'){
 const c=garmentCut(outfit),z=kit.zones,lining=layer==='lining',key=JSON.stringify([c,layer]);
 kit.clothTops ||= new Map();const cached=kit.clothTops.get(key);if(cached)return {...mesh(kit,cached.geometry,lining?'Tailored_Undershirt':'Tailored_Body',lining?'lining':'tailored'),detailSurface:cached.full};
 let raw=clothSkin(THREE,kit);const p=raw.attributes.position,n=raw.attributes.normal;
 const ease=lining?.004:c.ease,hem=z.waistY+(lining?.005:c.hem),cuff=c.short?z.cuffX-.29:z.cuffX-.021;
 const armPoints={};for(const sd of ['l','r'])armPoints[sd]=['upperarm','lowerarm','hand'].map(name=>kit.bones[name+'_'+sd].getWorldPosition(new THREE.Vector3()));
 const armIndices=Object.fromEntries(['l','r'].map(sd=>[sd,['upperarm','lowerarm','hand'].map(name=>kit.skin.skeleton.bones.indexOf(kit.bones[name+'_'+sd]))])),armJoints=new Set(kit.skin.skeleton.bones.map((b,i)=>/^(upperarm|lowerarm|hand)_/.test(b.name)?i:-1)),skinIndices=raw.attributes.skinIndex,skinWeights=raw.attributes.skinWeight;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),zz=p.getZ(i),ax=Math.abs(x);
  const upper=smooth(hem-.03,hem+.015,y)*(1-smooth(z.neckY+.010,z.neckY+.047,y)),torso=(1-smooth(.205,.28,ax))*upper;
  const sleeve=smooth(.20,.30,ax)*smooth(z.armY-.17,z.armY-.075,y),sleeveEase=lining?0:c.drape[2]*sleeve;
  x+=n.getX(i)*(ease*upper+sleeveEase);y+=n.getY(i)*(ease*upper+sleeveEase);zz+=n.getZ(i)*(ease*upper+sleeveEase);
  const h=Math.max(0,Math.min(1,(y-z.waistY)/(z.neckY-z.waistY))),depth=(kit.body==='f'?.095:.113)+.025*Math.sin(h*Math.PI)+ease;
  const front=Math.sqrt(Math.max(0,1-(x/.225)**2))*depth,frontWeight=smooth(-.050,-.005,zz)*torso*(1-smooth(z.neckY-.040,z.neckY+.035,y));
  zz+=(front-zz)*frontWeight;
  const waist=1-smooth(z.waistY+.10,z.neckY-.16,y);x*=1+(c.knit?.10:c.formal?.025:.045)*torso*waist;
  const elbow=Math.exp(-1*((ax-(z.cuffX-.16))/.055)**2)*smooth(.25,.35,ax),wrinkle=Math.sin(ax*100+y*19)*elbow*(c.drape[3]);
  x+=n.getX(i)*wrinkle;zz+=n.getZ(i)*wrinkle;
  // The hem hangs as cloth, with only shallow folds near the waist and elbows.
  const fold=(Math.sin(x*62+zz*17)*c.drape[3]+Math.sin(x*107+1.3)*c.drape[3]*.37)*Math.exp(-1*((y-hem-.025)/.063)**2)*torso;
  zz+=n.getZ(i)*fold;x+=n.getX(i)*fold;
  x+=n.getX(i)*(lining?-.002:.002);y+=n.getY(i)*(lining?-.002:.002);zz+=n.getZ(i)*(lining?-.002:.002);
  // Sleeve sections are draped around the arm axis. Their elliptical profile
  // bridges biceps and elbows instead of reproducing the sculpt's muscles.
  let armOwnership=0;for(const getter of ['getX','getY','getZ','getW'])if(armJoints.has(skinIndices[getter](i)))armOwnership+=skinWeights[getter](i);
  const sleeveFit=smooth(.095,.195,ax)*smooth(.08,.43,armOwnership);
  if(sleeveFit){const [shoulder,elbow,hand]=armPoints[x>0?'l':'r'],sx=Math.abs(shoulder.x),ex=Math.abs(elbow.x),hx=Math.abs(hand.x),t=Math.max(0,Math.min(1,(ax-sx)/Math.max(.01,hx-sx))),center=ax<ex?shoulder.clone().lerp(elbow,Math.max(0,Math.min(1,(ax-sx)/Math.max(.01,ex-sx)))):elbow.clone().lerp(hand,Math.max(0,Math.min(1,(ax-ex)/Math.max(.01,hx-ex)))),upperT=Math.max(0,Math.min(1,(ax-sx)/Math.max(.01,ex-sx))),foreT=Math.max(0,Math.min(1,(ax-ex)/Math.max(.01,hx-ex))),upperRadius=.031+.013*Math.pow(1-upperT,.85),foreRadius=.026+.008*(1-smooth(0,1,foreT)),base=upperRadius+(foreRadius-upperRadius)*smooth(ex-.035,ex+.035,ax),radius=base*(kit.body==='m'?1.18:1)+ease*.40+(lining?0:c.drape[2]*.65),rootEase=1-smooth(.17,.32,ax),depthRatio=.92+.27*rootEase,dy=y-center.y,dz=zz-center.z,r=Math.hypot(dy,dz/depthRatio);
   if(r>.0001){const crease=c.drape[3]*.50*Math.sin((ax-ex)*112)*Math.exp(-1*((ax-ex)/.045)**2);y+=(center.y+dy/r*(radius+crease)-y)*sleeveFit;zz+=(center.z+dz/r*(radius+crease)-zz)*sleeveFit;}
  }
  // The set-in sleeve joins the chest with a shallow cloth bridge. It must
  // not preserve the sculpt's concave biceps/armpit groove on the front panel.
  const bridge=smooth(.090,.135,ax)*(1-smooth(.190,.245,ax))*smooth(z.armY-.180,z.armY-.125,y)*(1-smooth(z.armY-.025,z.armY+.035,y))*smooth(.05,.45,n.getZ(i));
  if(bridge){const target=Math.sqrt(Math.max(0,1-(ax/.224)**2))*((kit.body==='f'?.095:.112)+ease);zz+=Math.max(0,target-zz)*bridge;}
  // Fabric rolls through the bend instead of following individual muscle
  // twist joints. Retain torso influence at the shoulder and taper to the hand.
  if(ax>Math.abs(armPoints[x>0?'l':'r'][1].x)-.09&&armOwnership>.60){
   const [shoulder,elbow,hand]=armPoints[x>0?'l':'r'],ex=Math.abs(elbow.x),hx=Math.abs(hand.x),fore=smooth(ex-.060,ex+.060,ax),wrist=smooth(hx-.080,hx-.020,ax),weights=new Map();
   for(const getter of ['getX','getY','getZ','getW'])if(!armJoints.has(skinIndices[getter](i)))weights.set(skinIndices[getter](i),(weights.get(skinIndices[getter](i))||0)+skinWeights[getter](i));
   const joints=armIndices[x>0?'l':'r'];for(const [joint,weight]of [[joints[0],1-fore],[joints[1],fore*(1-wrist)],[joints[2],fore*wrist]])weights.set(joint,(weights.get(joint)||0)+weight*armOwnership);
   const ranked=[...weights].filter(q=>q[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,q)=>n+q[1],0)||1;while(ranked.length<4)ranked.push([0,0]);skinIndices.setXYZW(i,...ranked.map(q=>q[0]));skinWeights.setXYZW(i,...ranked.map(q=>q[1]/sum));
  }
  p.setXYZ(i,x,y,zz);
 }
 // Build the hanging torso as evenly spaced fabric rings. The source body has
 // folds beneath the chest that cannot be turned into cloth by moving vertices.
 const topY=Math.min(z.neckY-.115,z.armY-.140),shoulders=trimGarment(THREE,raw,[(x,y)=>Math.max(y-topY,Math.abs(x)-.24)]),boundary=new Map();
 const sp=shoulders.attributes.position,sj=shoulders.attributes.skinIndex,sw=shoulders.attributes.skinWeight;
 for(let i=0;i<sp.count;i++)if(Math.abs(sp.getY(i)-topY)<1e-6&&Math.abs(sp.getX(i))<.239){const p=new THREE.Vector3().fromBufferAttribute(sp,i),a=(Math.atan2(p.x,p.z+.025)+Math.PI*2)%(Math.PI*2),key=Math.round(a*1e5);if(!boundary.has(key))boundary.set(key,{a,p,joints:['getX','getY','getZ','getW'].map(f=>sj[f](i)),weights:['getX','getY','getZ','getW'].map(f=>sw[f](i))});}
 if(boundary.size<12)throw Error('Garment shoulder boundary is incomplete');
 const edge=[...boundary.values()].sort((a,b)=>a.a-b.a),columns=edge.length,rows=46,sampler=surfaceSampler(THREE,[{geometry:raw}]),bodySampler=surfaceSampler(THREE,[kit.garmentSkin||kit.skin]),vertices=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const yy=hem-.006+(topY-hem+.006)*j/rows,a=edge[i%columns].a,dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),origin=new THREE.Vector3(0,yy,-.025);
  const sampleY=Math.max(z.waistY-.10,yy),bodyHit=bodySampler.cast(new THREE.Vector3(0,sampleY,-.025),dir);
  if(!bodyHit)throw Error('Could not sample cloth joint weights');
  const rx=(kit.body==='f'?.128:.159)+(kit.body==='f'?.034:.040)*(1-smooth(z.waistY+.005,z.waistY+.110,yy))+(kit.body==='f'?.033:.038)*(1-smooth(z.waistY-.10,z.waistY+.01,yy))+(kit.body==='f'?.026:.022)*smooth(z.waistY+.18,topY,yy)+ease+c.drape[0]+c.drape[1]*(1-smooth(hem+.025,hem+.115,yy));
  const frontZ=(kit.body==='f'?.088:.108)+.030*smooth(z.waistY+.040,z.waistY+.16,yy)+ease+c.drape[0]*.6,backZ=(kit.body==='f'?-.164:-.172)+(kit.body==='f'?.058:.063)*smooth(z.waistY+.010,z.waistY+.19,yy)-ease-c.drape[0]*.7,cos=Math.cos(a);
  const pt=new THREE.Vector3(Math.sin(a)*rx,yy,(frontZ+backZ)*.5+Math.sign(cos)*Math.abs(cos)**.66*(frontZ-backZ)*.5),join=smooth(topY-.070,topY,yy),hit=join&&sampler.cast(origin,dir);
  if(hit)pt.lerp(hit.point,join);if(j===rows)pt.copy(edge[i%columns].p);
  const hemFold=(Math.sin(a*8+yy*9)*c.drape[3]+Math.sin(a*13-yy*12)*c.drape[3]*.45)*Math.exp(-1*((yy-hem-.027)/.073)**2);
  const waistFold=c.family==='competition'?0:Math.sin(a*7+yy*8)*c.drape[3]*.34*Math.exp(-1*((yy-z.waistY-.055)/.080)**2);pt.addScaledVector(dir,(hemFold+waistFold)*(1-join));
  const weights=new Map(),blend=hit?join:0;for(let k=0;k<4;k++){weights.set(bodyHit.joints[k],(weights.get(bodyHit.joints[k])||0)+bodyHit.weights[k]*(1-blend));if(hit)weights.set(hit.joints[k],(weights.get(hit.joints[k])||0)+hit.weights[k]*join);}const ranked=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((v,a)=>v+a[1],0);while(ranked.length<4)ranked.push([0,0]);
  vertices.push({p:pt,joints:j===rows?edge[i%columns].joints:ranked.map(a=>a[0]),weights:j===rows?edge[i%columns].weights:ranked.map(a=>a[1]/sum)});
  if(j<rows&&i<columns){const k=j*(columns+1)+i;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
 }
 const torsoGeo=weightedGeometry(THREE,vertices,indices);
 raw.dispose();sampler.dispose();bodySampler.dispose();raw=mergeGeometries([shoulders,torsoGeo]);shoulders.dispose();torsoGeo.dispose();
 normals(raw);
 const neck=(x,y,zz)=>garmentNeckY(x,zz,z,c,lining);
 const fields=[(x,y)=>y-hem,(x)=>cuff-Math.abs(x),(x,y,zz)=>neck(x,y,zz)-y,(x,y)=>Math.max(z.headY-y,Math.abs(x)-.17)];
 if(lining&&c.vest)fields.push((x,y)=>y-(z.waistY+.130));
 if(lining&&c.formal){const bottom=z.waistY+.195;fields.push((x,y,zz)=>Math.min(Math.max(0,(y-bottom)/(z.neckY-bottom))*.049+.008-Math.abs(x),y-bottom+.008,zz-z.neckZ));}
 if(lining&&c.cardigan)fields.push((x,y,zz)=>Math.min(.055-Math.abs(x),zz-z.neckZ));
 if(!lining&&c.vest)fields.push((x,y)=>Math.max(.130+.036*(1-smooth(z.armY-.180,z.armY+.005,y))-Math.abs(x),z.armY-.202-y));
 const neckRefined=refineNeckOpening(THREE,raw,z);raw.dispose();const full=trimGarment(THREE,neckRefined,fields);neckRefined.dispose();normals(full,true);
 let geo=full;
 if(!lining&&(c.formal||c.cardigan)){
  const bottom=z.waistY+(c.formal?.195:-.16);
  geo=trimGarment(THREE,full,[(x,y,zz)=>Math.max(Math.abs(x)-(c.cardigan?.047:Math.max(0,(y-bottom)/(z.neckY-bottom))*.049),bottom-y,z.neckZ-zz)]);normals(geo,true);
 }
 geo=mergeVertices(geo,1e-6);geo.userData={...geo.userData,garment:true,hem,cuff};geo.computeBoundingSphere();
 kit.clothTops.set(key,{geometry:geo,full});
 const top=mesh(kit,geo,lining?'Tailored_Undershirt':'Tailored_Body',lining?'lining':'tailored');top.detailSurface=full;return top;
}
export function tailoredLegs(THREE,kit,outfit){
 const key=outfit.category==='Ranch'?'denim':'breeches';kit.clothLegs ||= new Map();if(kit.clothLegs.has(key))return mesh(kit,kit.clothLegs.get(key),'Tailored_Legs','legs');
 const z=kit.zones,raw=clothSkin(THREE,kit);const p=raw.attributes.position,n=raw.attributes.normal;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),leg=1-smooth(z.waistY,z.waistY+.07,y),ease=(outfit.category==='Ranch'?.005:.0035)*leg;
  p.setXYZ(i,p.getX(i)+n.getX(i)*ease,y+n.getY(i)*ease,p.getZ(i)+n.getZ(i)*ease);
 }
 let geo=trimGarment(THREE,raw,[(x,y)=>z.waistY+.021-y,(x,y)=>y-(z.bootY+.012)]);raw.dispose();
 normals(geo);geo=mergeVertices(geo,1e-6);geo.computeBoundingSphere();kit.clothLegs.set(key,geo);return mesh(kit,geo,'Tailored_Legs','legs');
}
export function sewnDetails(THREE,top,outfit,kit){
 const c=garmentCut(outfit),z=kit.zones,full={...top,geometry:top.detailSurface||top.geometry};
 const sampler=surfaceSampler(THREE,[full]),bodySampler=surfaceSampler(THREE,[kit.garmentSkin||kit.skin]),neckSampler=surfaceSampler(THREE,[kit.skin,...(kit.headAsset?.mesh?[kit.headAsset.mesh]:[])]),cache=new Map(),groups=new Map();
 const front=(x,y,offset=.004)=>{
  const key=x.toFixed(5)+','+y.toFixed(5);let s=cache.get(key);
  if(s===undefined){s=sampler.cast(new THREE.Vector3(x,y,.6),new THREE.Vector3(0,0,-1))||bodySampler.cast(new THREE.Vector3(x,y,.6),new THREE.Vector3(0,0,-1));cache.set(key,s||null);}
  return s?{p:new THREE.Vector3(x,y,s.point.z+offset),j:s.joints,w:s.weights}:null;
 };
 const point=(p,s)=>({p,j:s.joints,w:s.weights});
 const tri=(role,a,b,d)=>{if(!a||!b||!d)return;if(!groups.has(role))groups.set(role,[]);groups.get(role).push(a,b,d);};
 const quad=(role,a,b,d,e)=>{tri(role,a,b,d);tri(role,b,e,d);};
 const panel=(role,corners,steps=6,across=steps)=>{
  const at=(u,v)=>{const q=corners[0].map((a,k)=>(1-u)*(1-v)*a+u*(1-v)*corners[1][k]+(1-u)*v*corners[2][k]+u*v*corners[3][k]);return front(...q);};
  for(let i=0;i<across;i++)for(let j=0;j<steps;j++)quad(role,at(i/across,j/steps),at((i+1)/across,j/steps),at(i/across,(j+1)/steps),at((i+1)/across,(j+1)/steps));
 };
 // Folded leaves follow a curved surface, with a rolled tip and a thin sewn
 // underside. Their skin weights come from the garment beneath the fold.
 const foldedPanel=(role,corners)=>{
  const folded=['contrast','shirtcollar','collar','lapel'].includes(role),round=folded?.0045:.0015,outline=[];
  for(let i=0;i<corners.length;i++){
   const prev=corners[(i+corners.length-1)%corners.length],cur=corners[i],next=corners[(i+1)%corners.length],before=Math.hypot(prev[0]-cur[0],prev[1]-cur[1]),after=Math.hypot(next[0]-cur[0],next[1]-cur[1]),r=Math.min(round,before*.22,after*.22),a=cur.map((v,k)=>v+(prev[k]-v)*r/Math.max(before,1e-6)),b=cur.map((v,k)=>v+(next[k]-v)*r/Math.max(after,1e-6));
   for(let j=0;j<=3;j++){const t=j/3,q=1-t;outline.push(a.map((v,k)=>v*q*q+2*cur[k]*q*t+b[k]*t*t));}
  }
  const anchors=corners.map(p=>front(...p)),anchorFaces=THREE.ShapeUtils.triangulateShape(corners.map(p=>new THREE.Vector2(p[0],p[1])),[]);
  const ys=corners.map(p=>p[1]),xs=corners.map(p=>Math.abs(p[0])),low=Math.min(...ys),high=Math.max(...ys),xmin=Math.min(...xs),xmax=Math.max(...xs),thickness=folded?.0016:.0010;
  const onSurface=(x,y,offset,back=false)=>{
   let sample=null;
   for(const face of anchorFaces){const [a,b,d]=face.map(i=>corners[i]),den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<1e-10)continue;const u=((b[1]-d[1])*(x-d[0])+(d[0]-b[0])*(y-d[1]))/den,v=((d[1]-a[1])*(x-d[0])+(a[0]-d[0])*(y-d[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-.0001)continue;
    const pp=new THREE.Vector3(),weights=new Map();let valid=true;for(let i=0;i<3;i++){const anchor=anchors[face[i]],t=[u,v,w][i];if(!anchor){valid=false;break;}pp.addScaledVector(anchor.p,t);for(let k=0;k<4;k++)weights.set(anchor.j[k],(weights.get(anchor.j[k])||0)+anchor.w[k]*t);}if(!valid)continue;const ranked=[...weights].filter(a=>a[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,a)=>n+a[1],0)||1;while(ranked.length<4)ranked.push([0,0]);sample={p:pp,j:ranked.map(a=>a[0]),w:ranked.map(a=>a[1]/sum)};break;
   }
   const beneath=front(x,y,offset);if(role==='lapel')sample=beneath||sample;
   if(!sample)return null;if(beneath&&folded)sample.p.z=Math.max(sample.p.z,beneath.p.z+.0020);
   if(folded){const t=Math.max(0,Math.min(1,(high-y)/Math.max(.01,high-low))),u=Math.max(0,Math.min(1,(Math.abs(x)-xmin)/Math.max(.01,xmax-xmin)));
    const roll=role==='lapel'?.002+.007*Math.sin(Math.PI*u)*(.45+.55*Math.sin(Math.PI*t)):.002+.006*Math.sin(Math.PI*t)-.0015*t*t;
    sample.p.z+=roll;sample.p.y+=.0018*Math.sin(Math.PI*u)*Math.sin(Math.PI*t);
   }
   if(back)sample.p.z-=thickness;return sample;
  };
  const faces=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(p[0],p[1])),[]),N=5;
  for(const ids of faces){const [a,b,c]=ids.map(i=>outline[i]),at=(u,v,back=false)=>{const p=a.map((x,k)=>x*(1-u-v)+b[k]*u+c[k]*v);return onSurface(...p,back);};
   for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){
    const a=at(i/N,j/N),b=at((i+1)/N,j/N),c=at(i/N,(j+1)/N);tri(role,a,b,c);
    if(folded)tri(role,at(i/N,j/N,true),at(i/N,(j+1)/N,true),at((i+1)/N,j/N,true));
    if(i+j<N-1){tri(role,b,at((i+1)/N,(j+1)/N),c);if(folded)tri(role,at((i+1)/N,j/N,true),at(i/N,(j+1)/N,true),at((i+1)/N,(j+1)/N,true));}
   }
  }
  if(folded)for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length],N=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.006));
   const at=(t,back)=>onSurface(...a.map((v,k)=>v+(b[k]-v)*t),back);
   for(let j=0;j<N;j++)quad(role,at(j/N,false),at((j+1)/N,false),at(j/N,true),at((j+1)/N,true));
  }
 };
 const strip=(role,a,b,width=.002,offset=.004)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length*width,ny=dx/length*width;
  panel(role,[[a[0]-nx,a[1]-ny,offset],[a[0]+nx,a[1]+ny,offset],[b[0]-nx,b[1]-ny,offset],[b[0]+nx,b[1]+ny,offset]],Math.max(2,Math.ceil(length/.012)),1);
 };
 const pocket=(role,corners,steps=10)=>{
  const at=(u,v,edge=false)=>{const p=corners[0].map((x,k)=>x*(1-u)*(1-v)+corners[1][k]*u*(1-v)+corners[2][k]*(1-u)*v+corners[3][k]*u*v),sample=front(p[0],p[1],edge?.0007:.0017+.0006*Math.sin(Math.PI*u)*Math.sin(Math.PI*v));return sample;};
  for(let i=0;i<steps;i++)for(let j=0;j<steps;j++)quad(role,at(i/steps,j/steps),at((i+1)/steps,j/steps),at(i/steps,(j+1)/steps),at((i+1)/steps,(j+1)/steps));
  for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps;quad(role,at(a,0),at(b,0),at(a,0,true),at(b,0,true));for(const u of [0,1])quad(role,at(u,a),at(u,b),at(u,a,true),at(u,b,true));}
 };
 const button=(x,y,r=.0036,role='metal')=>{for(let i=0;i<16;i++){const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2;tri(role,front(x,y,.008),front(x+Math.cos(a)*r,y+Math.sin(a)*r,.005),front(x+Math.cos(b)*r,y+Math.sin(b)*r,.005));}};
 // A collar grows continuously from its stand around the neck. The turn is
 // a curved annular strip, not isolated triangles pasted onto the chest.
 if(c.collared&&!c.cardigan){
  const role=c.formal?'shirtcollar':c.polo?'contrast':'collar',open=c.sport||c.vest?.055:.36,N=72,cz=z.neckZ;
  // Follow the cut edge of the actual garment. A level nominal neck ring
  // starts below the rising side/back opening and breaks through the fabric.
  const edgeCache=new Map(),ringCache=new Map(),opening=(angle)=>{
   const key=angle.toFixed(6);if(edgeCache.has(key))return edgeCache.get(key);
   const dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),accept=p=>Math.abs(p.x)<.17&&Math.hypot(p.x,p.z-cz)<.19,cast=y=>sampler.cast(new THREE.Vector3(0,y,cz),dir,accept);
   let lower=null,lo=z.neckY-.040,hi=z.neckY+.13;
   for(let y=lo;y<=z.neckY+.13;y+=.003){const hit=cast(y);if(hit){lower=hit;lo=y;}else if(lower){hi=y;break;}}
   if(!lower)throw Error('Garment opening missing: '+kit.body+' angle '+angle.toFixed(3));
   for(let k=0;k<12;k++){const y=(lo+hi)*.5,hit=cast(y);if(hit){lo=y;lower=hit;}else hi=y;}
   const sample=point(lower.point.clone(),lower);edgeCache.set(key,sample);return sample;
  },neckSample=(angle,t)=>{
   const key=angle.toFixed(6)+','+t.toFixed(6);if(ringCache.has(key)){const s=ringCache.get(key);return {p:s.p.clone(),j:[...s.j],w:[...s.w]};}
   const root=opening(angle),dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),back=1-smooth(-.10,.65,Math.cos(angle)),height=(c.sport||c.vest?.030:c.formal?.008:c.polo?.007:.010)+.002*back,y=root.p.y-.001+height*t;
   const hit=neckSampler.cast(new THREE.Vector3(dir.x*.35,y,cz+dir.z*.35),dir.clone().negate(),p=>Math.abs(p.x)<.17&&Math.hypot(p.x,p.z-cz)<.19);
   if(!hit)throw Error('Visible collar fit missing: '+kit.body+' angle '+angle.toFixed(3)+' y '+y.toFixed(4));
   const rootRadius=Math.hypot(root.p.x,root.p.z-cz)+.0015,neckRadius=Math.hypot(hit.point.x,hit.point.z-cz)+.0035,radius=rootRadius+(Math.max(neckRadius,rootRadius-.012)-rootRadius)*t+.0015*Math.sin(Math.PI*t),p=new THREE.Vector3(dir.x*radius,y,cz+dir.z*radius),weights=new Map();
   for(let k=0;k<4;k++){weights.set(root.j[k],(weights.get(root.j[k])||0)+root.w[k]*(1-t));weights.set(hit.joints[k],(weights.get(hit.joints[k])||0)+hit.weights[k]*t);}
   const ranked=[...weights].filter(q=>q[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,q)=>n+q[1],0)||1;while(ranked.length<4)ranked.push([0,0]);const sample={p,j:ranked.map(q=>q[0]),w:ranked.map(q=>q[1]/sum)};ringCache.set(key,sample);
   return {p:sample.p.clone(),j:[...sample.j],w:[...sample.w]};
  };
  for(let i=0;i<N;i++){const a=open+(Math.PI*2-open*2)*i/N,b=open+(Math.PI*2-open*2)*(i+1)/N;for(let j=0;j<6;j++)quad(role,neckSample(a,j/6),neckSample(b,j/6),neckSample(a,(j+1)/6),neckSample(b,(j+1)/6));}
  if(!c.sport&&!c.vest)for(const sd of [-1,1]){
   const A=30,B=10,leaf=(i,j,back=false)=>{
    const theta=open+(1.38-open)*i/A,t=j/B,root=neckSample(sd*theta,1);if(!root)return null;
    const width=c.formal?.024:c.polo?.027:.030,drop=(c.formal?.023:c.polo?.022:.025)*(1-.46*(theta-open)/(1.38-open)),dir=new THREE.Vector3(sd*Math.sin(theta),0,Math.cos(theta));
    const p=root.p.clone().addScaledVector(dir,width*t);p.x+=sd*.0045*(1-smooth(open,open+.52,theta))*t*t;p.y-=drop*smooth(.05,.95,t)-.0018*(Math.exp(-1*((theta-open)/.085)**2)+Math.exp(-1*((theta-1.38)/.085)**2))*t*t;p.z+=.0032*Math.sin(Math.PI*t);
    const rayOrigin=new THREE.Vector3(p.x,p.y,.6),rayDir=new THREE.Vector3(0,0,-1),contactHit=sampler.cast(rayOrigin,rayDir)||neckSampler.cast(rayOrigin,rayDir,pt=>Math.abs(pt.x)<.115&&Math.hypot(pt.x,pt.z-cz)<.13),contact=contactHit?point(contactHit.point.clone().addScaledVector(rayDir,-.004),contactHit):null;if(contact){p.z=Math.max(p.z,contact.p.z+.0020);const weights=new Map();for(let k=0;k<4;k++){weights.set(root.j[k],(weights.get(root.j[k])||0)+root.w[k]*(1-t));weights.set(contact.j[k],(weights.get(contact.j[k])||0)+contact.w[k]*t);}const ranked=[...weights].filter(q=>q[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,q)=>n+q[1],0)||1;while(ranked.length<4)ranked.push([0,0]);root.j=ranked.map(q=>q[0]);root.w=ranked.map(q=>q[1]/sum);}
    if(back)p.addScaledVector(dir,-.0013);return {p,j:root.j,w:root.w};
   };
   for(let i=0;i<A;i++)for(let j=0;j<B;j++){quad(role,leaf(i,j),leaf(i+1,j),leaf(i,j+1),leaf(i+1,j+1));quad(role,leaf(i,j,true),leaf(i,j+1,true),leaf(i+1,j,true),leaf(i+1,j+1,true));}
   for(let i=0;i<A;i++)quad(role,leaf(i,B),leaf(i+1,B),leaf(i,B,true),leaf(i+1,B,true));
   for(const i of [0,A])for(let j=0;j<B;j++)quad(role,leaf(i,j),leaf(i,j+1),leaf(i,j,true),leaf(i,j+1,true));
  }
 }

 if(c.formal){
  for(const sd of [-1,1]){
   // The jacket's turned edge is one continuous roll from the neck to the
   // top button; the outside edge blends into the main front panel.
   const A=42,B=8,lapel=(i,j,back=false)=>{
    const t=i/A,u=j/B,y=(z.neckY+.017)*(1-t)+(z.waistY+.195)*t,inner=.049*(1-t)+.008*t,width=.026*(1-t)+.011*t+.007*Math.sin(Math.PI*t),x=sd*(inner+width*u),sample=front(x,y,.002);
    if(!sample)return null;sample.p.z+=.002+.0065*Math.sin(Math.PI*u)+.0025*(1-u);if(back)sample.p.z-=.0014;return sample;
   };
   for(let i=0;i<A;i++)for(let j=0;j<B;j++){quad('lapel',lapel(i,j),lapel(i+1,j),lapel(i,j+1),lapel(i+1,j+1));quad('lapel',lapel(i,j,true),lapel(i,j+1,true),lapel(i+1,j,true),lapel(i+1,j+1,true));}
   for(const j of [0,B])for(let i=0;i<A;i++)quad('lapel',lapel(i,j),lapel(i+1,j),lapel(i,j,true),lapel(i+1,j,true));
   const curve=t=>{const q=1-t;return [sd*(q*q*.147+2*q*t*.081+t*t*.123),q*q*(z.neckY-.122)+2*q*t*(z.waistY+.17)+t*t*(z.waistY+c.hem+.018)];};
   for(let i=0;i<22;i++)strip('seam',curve(i/22),curve((i+1)/22),.00065,.0035);
   const yy=z.waistY+.071;pocket('pocket',[[sd*.052,yy-.001,.006],[sd*.126,yy+.008,.006],[sd*.052,yy-.019,.010],[sd*.126,yy-.010,.010]],5);
   strip('seam',[sd*.052,yy-.017],[sd*.126,yy-.008],.0005,.0027);
  }
  for(let y=z.waistY+.155;y>z.waistY+.022;y-=.054)button(.011,y,.0042);
  // A small horseshoe embroidered on the left chest.
  for(let i=0;i<16;i++){const a=(.12+i/16*.76)*Math.PI*2,b=(.12+(i+1)/16*.76)*Math.PI*2;strip('metal',[.103+Math.sin(a)*.007,z.neckY-.147+Math.cos(a)*.009],[.103+Math.sin(b)*.007,z.neckY-.147+Math.cos(b)*.009],.0010,.006);}
 }else if(c.vest||c.sport||outfit.id==='denim'||outfit.id==='canvas'||outfit.id==='railroad'||outfit.id==='woodland'||outfit.id==='trailchecks'){
  const bottom=c.sport&&outfit.id!=='raincoat'?z.neckY-.15:z.waistY+c.hem+.020;
  strip('lapel',[0,bottom],[0,z.neckY+.012],.005,.005);
  if(c.vest||c.sport){
   for(let y=bottom;y<z.neckY+.008;y+=.008)strip('metal',[-.002,y],[.002,y+.002],.0009,.006);
   panel('metal',[[-.003,z.neckY-.094,.010],[.003,z.neckY-.094,.010],[-.003,z.neckY-.108,.010],[.003,z.neckY-.108,.010]],2);
  }else for(let y=z.waistY+.035;y<z.neckY-.055;y+=.053)button(0,y,.0030);
  for(const sd of [-1,1]){
   if(c.vest||c.sport){strip('lapel',[sd*.079,z.waistY+.041],[sd*.112,z.waistY+.112],.004,.005);strip('metal',[sd*.080,z.waistY+.050],[sd*.105,z.waistY+.099],.0007,.006);}
   else{const x=sd*.082,y=z.neckY-.188;pocket('pocket',[[x-.031,y-.037,.003],[x+.031,y-.037,.003],[x-.031,y+.036,.007],[x+.031,y+.036,.007]],6);strip('seam',[x-.028,y-.033],[x-.028,y+.032],.0005,.0024);strip('seam',[x+.028,y-.033],[x+.028,y+.032],.0005,.0024);strip('seam',[x-.028,y+.024],[x+.028,y+.024],.0007,.0025);button(x,y+.016,.0026);}
  }
 }else if(c.cardigan){for(const sd of [-1,1])strip('rib',[sd*.050,z.waistY-.130],[sd*.050,z.neckY-.002],.010,.005);}
 else if(c.collared){
  const bottom=c.polo?z.neckY-.14:z.waistY+.019;strip('placket',[0,bottom],[0,z.neckY+.010],.008,.004);
  for(let y=bottom+.026;y<z.neckY-.018;y+=.049)button(0,y,c.polo?.0024:.0027);
 }
 if(c.polo){
  foldedPanel('crest',[[.080,z.neckY-.122,.004],[.106,z.neckY-.122,.004],[.106,z.neckY-.147,.004],[.093,z.neckY-.157,.004],[.080,z.neckY-.147,.004]]);
  for(const [a,b]of [[[.086,z.neckY-.145],[.086,z.neckY-.130]],[[.086,z.neckY-.130],[.093,z.neckY-.141]],[[.093,z.neckY-.141],[.100,z.neckY-.130]],[[.100,z.neckY-.130],[.100,z.neckY-.145]]])strip('contrast',a,b,.0008,.006);
 }
 // A narrow bound edge finishes each vest armhole and rounds the exposed
 // cut. It uses the exact garment boundary and its weights, including the back.
 if(c.vest){
  const g=top.geometry,p=g.attributes.position,n=g.attributes.normal,j=g.attributes.skinIndex,w=g.attributes.skinWeight,idx=g.index,edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  for(let k=0;k<(idx?idx.count:p.count);k+=3)for(let q=0;q<3;q++){const a=idx?idx.getX(k+q):k+q,b=idx?idx.getX(k+(q+1)%3):k+(q+1)%3,ka=key(a),kb=key(b),code=ka<kb?ka+'|'+kb:kb+'|'+ka;if(!edges.has(code))edges.set(code,{a,b,count:0});edges.get(code).count++;}
  const onHole=i=>{const x=Math.abs(p.getX(i)),y=p.getY(i),edge=.130+.036*(1-smooth(z.armY-.180,z.armY+.005,y));return y>z.armY-.205&&x>.105&&Math.abs(x-edge)<.0025;};
  const vertex=(i,inside=false)=>{const normal=new THREE.Vector3().fromBufferAttribute(n,i).normalize(),pt=new THREE.Vector3().fromBufferAttribute(p,i);if(inside){const sd=Math.sign(pt.x);pt.x-=sd*.0055;const origin=new THREE.Vector3(0,pt.y,-.025),dir=pt.clone().sub(origin).normalize(),hit=sampler.cast(origin,dir);if(hit)pt.copy(hit.point);}pt.addScaledVector(normal,.0012);return {p:pt,j:['getX','getY','getZ','getW'].map(k=>j[k](i)),w:['getX','getY','getZ','getW'].map(k=>w[k](i))};};
  for(const e of edges.values())if(e.count===1&&onHole(e.a)&&onHole(e.b))quad('collar',vertex(e.a),vertex(e.b),vertex(e.a,true),vertex(e.b,true));
 }
 // Waistband and sleeve cuffs have their own thickness and continuous surface.
 const band=(axis,at,width,role,origin,N=64)=>{
  const vertex=(i,t)=>{const a=i/N*Math.PI*2,dir=axis==='y'?new THREE.Vector3(Math.sin(a),0,Math.cos(a)):new THREE.Vector3(0,Math.sin(a),Math.cos(a));const from=origin.clone();from[axis]=at+t*width;
   const s=sampler.cast(from,dir);return s?point(s.point.clone().addScaledVector(dir,.0028),s):null;};
  for(let i=0;i<N;i++)quad(role,vertex(i,0),vertex(i+1,0),vertex(i,1),vertex(i+1,1));
 };
 if(c.knit||c.tee||c.polo){band('y',z.waistY+c.hem+.003,c.knit?.023:.009,'rib',new THREE.Vector3(0,0,-.018));}
 if(c.formal)for(const sd of [-1,1])for(let i=0;i<3;i++)button(sd*(z.cuffX-.040-i*.010),z.armY-.008,.0017);
 if(!c.vest)for(const sd of [-1,1]){
  const bone=kit.skin.skeleton.bones.find(b=>b.name===('hand_'+(sd>0?'l':'r'))),elbow=kit.skin.skeleton.bones.find(b=>b.name===('lowerarm_'+(sd>0?'l':'r')));
  const hand=bone.getWorldPosition(new THREE.Vector3()),low=elbow.getWorldPosition(new THREE.Vector3()),x=sd*(c.short?z.cuffX-.29:z.cuffX-.021),t=(x-low.x)/(hand.x-low.x),center=low.clone().lerp(hand,t);
  band('x',x-sd*(c.knit?.027:.020),sd*(c.knit?.023:.016),c.knit||c.polo||c.tee?'rib':'lapel',center,40);
 }
 sampler.dispose();bodySampler.dispose();neckSampler.dispose();
 const parts=[];
 for(const [role,vertices]of groups){if(!vertices.length)continue;const P=[],UV=[],J=[],W=[];
  for(const v of vertices){P.push(v.p.x,v.p.y,v.p.z);UV.push(v.p.x*3,v.p.y*3);J.push(...v.j);W.push(...v.w);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));normals(geo);geo.computeBoundingSphere();
  const part=mesh(kit,geo,'Tailored_'+role,role);
  if(role==='metal'){part.name='Sewn_Buttons';part.material=new THREE.MeshStandardMaterial({color:c.formal?0xb59b62:0xb7b8b4,roughness:.34,metalness:.7,side:THREE.DoubleSide});}
  parts.push(part);
 }

 return parts;
}

function weightedGeometry(THREE,vertices,indices){
 const P=[],U=[],J=[],W=[];for(const v of vertices){P.push(...v.p.toArray());U.push(v.p.x*3,v.p.y*3);J.push(...v.joints);W.push(...v.weights);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));g.setIndex(indices);normals(g);g.computeBoundingSphere();return g;
}
export function ridingBoots(THREE,kit,source){
 if(kit.tailoredBoots)return kit.tailoredBoots;
 const foot=trimGarment(THREE,source.geometry,[(x,y)=>.125-y]);
 const sampler=surfaceSampler(THREE,[kit.garmentSkin||kit.skin]),fp=foot.attributes.position;
 for(let i=0;i<fp.count;i++){
  const y=fp.getY(i),t=smooth(.075,.124,y);if(!t)continue;
  const ankle=kit.bones['foot_'+(fp.getX(i)>0?'l':'r')].getWorldPosition(new THREE.Vector3()),origin=new THREE.Vector3(ankle.x,y,ankle.z),v=new THREE.Vector3().fromBufferAttribute(fp,i),dir=v.clone().sub(origin).normalize(),s=sampler.cast(origin,dir);
  if(s){v.lerp(s.point.addScaledVector(dir,.011),t);fp.setXYZ(i,v.x,v.y,v.z);}
 }
 sampler.dispose();normals(foot);foot.computeBoundingSphere();
 const feet={...source,geometry:foot,name:'Riding_Feet_Lower'};
 // Derive the shaft from the same bind-space leg as the breeches. Keeping the
 // interpolated knee/ankle weights identical lets both layers bend together.
 const raw=clothSkin(THREE,kit),p=raw.attributes.position,n=raw.attributes.normal,z=kit.zones;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),ease=.011;
  p.setXYZ(i,p.getX(i)+n.getX(i)*ease,y,p.getZ(i)+n.getZ(i)*ease);
 }
 let shaftGeo=trimGarment(THREE,raw,[(x,y)=>y-.113,(x,y)=>z.bootY+.039-y]);raw.dispose();
 normals(shaftGeo);shaftGeo=mergeVertices(shaftGeo,1e-6);
 const shaft=mesh(kit,shaftGeo,'Riding_Feet_Shaft','boot');
 kit.tailoredBoots=[feet,shaft];return kit.tailoredBoots;
}
export function waistband(THREE,kit,legs){
 kit.clothBelts ||= new Map();if(kit.clothBelts.has(legs.geometry))return kit.clothBelts.get(legs.geometry);
 const sampler=surfaceSampler(THREE,[legs]),z=kit.zones,vertices=[],indices=[],N=64;
 const sample=(x,y,zz,dir)=>sampler.cast(new THREE.Vector3(x,y,zz),dir);
 for(let j=0;j<2;j++)for(let i=0;i<=N;i++){
  const a=i/N*Math.PI*2,y=z.waistY-.016+j*.024,dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),s=sample(0,y,-.02,dir);
  if(!s)throw Error('Belt could not fit the breeches');vertices.push({...s,p:s.point.clone().addScaledVector(dir,.004)});
  if(!j&&i<N){const k=i;indices.push(k,k+1,k+N+1,k+1,k+N+2,k+N+1);}
 }
 const belt=mesh(kit,weightedGeometry(THREE,vertices,indices),'Tailored_Belt','leather'),buckleV=[],buckleI=[];
 const piece=(x0,y0,x1,y1)=>{const start=buckleV.length;for(const [x,y]of [[x0,y0],[x1,y0],[x0,y1],[x1,y1]]){const s=sample(x,y,.5,new THREE.Vector3(0,0,-1));if(!s)return;const p=s.point.clone();p.z+=.008;buckleV.push({...s,p});}buckleI.push(start,start+1,start+2,start+1,start+3,start+2);};
 const cy=z.waistY-.004;piece(-.015,cy-.011,.015,cy-.008);piece(-.015,cy+.008,.015,cy+.011);piece(-.015,cy-.008,-.012,cy+.008);piece(.012,cy-.008,.015,cy+.008);piece(-.001,cy-.009,.001,cy+.009);
 const buckle=mesh(kit,weightedGeometry(THREE,buckleV,buckleI),'Sewn_Buttons','metal');buckle.material=new THREE.MeshStandardMaterial({color:0xae9564,roughness:.32,metalness:.7});const loopV=[],loopI=[];
 for(const angle of [-2.25,-.62,.62,2.25,Math.PI]){const start=loopV.length;
  for(let j=0;j<=6;j++)for(let side=0;side<2;side++){const a=angle+(side-.5)*.075,y=z.waistY-.026+j/6*.044,dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),hit=sample(0,y,-.02,dir);if(!hit)throw Error('Belt loop missed the breeches');loopV.push({...hit,p:hit.point.clone().addScaledVector(dir,.008+Math.sin(j/6*Math.PI)*.002)});if(j<6&&!side){const k=start+j*2;loopI.push(k,k+1,k+2,k+1,k+3,k+2);}}
 }
 const loops=mesh(kit,weightedGeometry(THREE,loopV,loopI),'Tailored_Belt_Loops','legs');
 sampler.dispose();kit.clothBelts.set(legs.geometry,[belt,buckle,loops]);return [belt,buckle,loops];
}
