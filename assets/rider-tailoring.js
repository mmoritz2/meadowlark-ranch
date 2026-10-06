/* Modern equestrian garment construction. Every added vertex keeps the body's
   interpolated joint weights, including folded collars and raised pocket edges. */
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {trimGarment,surfaceSampler} from './rider-fit.js?v=art-20261005';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function garmentCut(o){
 const formal=['show','hunter','dressage','pinstripe','tweed'].includes(o.id),vest=['quilted','explorer','ranger'].includes(o.id),cardigan=o.id==='cardigan';
 const polo=['polo','sportpolo','rugby'].includes(o.id),sport=['eventer','team','chevron','raincoat','sweatshirt','summit'].includes(o.id);
 const knit=o.cut==='sweater',jacket=o.cut==='jacket'||o.cut==='coat',short=o.cut==='short',tee=['breton','daisytee'].includes(o.id);
 const collared=formal||vest||polo||sport||jacket||(!knit&&!tee);
 return {formal,vest,cardigan,polo,sport,knit,jacket,short,tee,collared,
  hem:formal?(o.cut==='coat'?-.115:-.072):cardigan?-.135:vest?-.045:jacket?-.060:knit?-.029:tee?-.018:.010,
  ease:vest?.014:formal?.008:knit?.012:jacket?.012:.005};
}
function normals(geo){
 geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');let g=groups.get(key);if(!g){g={ids:[],x:0,y:0,z:0};groups.set(key,g);}g.ids.push(i);g.x+=n.getX(i);g.y+=n.getY(i);g.z+=n.getZ(i);}
 for(const g of groups.values()){const l=Math.hypot(g.x,g.y,g.z)||1;for(const i of g.ids)n.setXYZ(i,g.x/l,g.y/l,g.z/l);}
}
// Add resolution before draping so collars and curved fronts do not inherit the
// coarse body's planar triangles. The shared refined skin is never mutated.
function clothSkin(THREE,kit){
 if(kit.clothSkin)return kit.clothSkin.clone();
 const g=kit.skin.geometry,idx=g.index,attrs=g.attributes,P=[],N=[],U=[],J=[],W=[];
 const read=i=>({p:[attrs.position.getX(i),attrs.position.getY(i),attrs.position.getZ(i)],n:[attrs.normal.getX(i),attrs.normal.getY(i),attrs.normal.getZ(i)],uv:[attrs.uv.getX(i),attrs.uv.getY(i)],weights:(()=>{const w=new Map();for(const get of ['getX','getY','getZ','getW']){const j=attrs.skinIndex[get](i);w.set(j,(w.get(j)||0)+attrs.skinWeight[get](i));}return w;})()});
 const mid=(a,b)=>{const w=new Map();for(const [j,v]of a.weights)w.set(j,v*.5);for(const [j,v]of b.weights)w.set(j,(w.get(j)||0)+v*.5);return {p:a.p.map((v,k)=>(v+b.p[k])*.5),n:a.n.map((v,k)=>(v+b.n[k])*.5),uv:a.uv.map((v,k)=>(v+b.uv[k])*.5),weights:w};};
 const push=v=>{P.push(...v.p);N.push(...v.n);U.push(...v.uv);const a=[...v.weights].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=a.reduce((s,v)=>s+v[1],0)||1;while(a.length<4)a.push([0,0]);J.push(...a.map(v=>v[0]));W.push(...a.map(v=>v[1]/sum));};
 for(let i=0;i<(idx?idx.count:attrs.position.count);i+=3){const [a,b,c]=[0,1,2].map(k=>read(idx?idx.getX(i+k):i+k)),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);for(const v of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])push(v);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));geo.setIndex(Array.from({length:P.length/3},(_,i)=>i));const pos=geo.attributes.position,groups=[],lookup=new Map(),ids=[];
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i),key=v.toArray().map(v=>Math.round(v*100000)).join(',');let id=lookup.get(key);if(id===undefined){id=groups.length;lookup.set(key,id);groups.push({p:v,vertices:[],near:new Set()});}groups[id].vertices.push(i);ids.push(id);}
 for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3];groups[a].near.add(b);groups[b].near.add(a);}
 for(let pass=0;pass<10;pass++){
  const next=groups.map(g=>{const {x,y,z}=g.p,weight=smooth(.76,.88,y)*(1-smooth(1.36,1.46,y))*(1-smooth(.20,.27,Math.abs(x)));if(!weight||!g.near.size)return g.p.clone();const mean=new THREE.Vector3();for(const i of g.near)mean.add(groups[i].p);mean.divideScalar(g.near.size);return g.p.clone().lerp(mean,.52*weight);});
  groups.forEach((g,i)=>g.p.copy(next[i]));
 }
 for(const g of groups)for(const i of g.vertices)pos.setXYZ(i,g.p.x,g.p.y,g.p.z);
 normals(geo);kit.clothSkin=geo;return geo.clone();
}
const mesh=(kit,geometry,name,clothPart='tailored')=>({geometry,material:kit.materials.body,name,clothPart,skeleton:kit.skin.skeleton,bindMatrix:kit.skin.bindMatrix});
export function tailoredTop(THREE,kit,outfit,layer='outer'){
 const c=garmentCut(outfit),z=kit.zones,lining=layer==='lining',key=JSON.stringify([c,layer]);
 kit.clothTops ||= new Map();const cached=kit.clothTops.get(key);if(cached)return {...mesh(kit,cached.geometry,lining?'Tailored_Undershirt':'Tailored_Body',lining?'lining':'tailored'),detailSurface:cached.full};
 const raw=clothSkin(THREE,kit);const p=raw.attributes.position,n=raw.attributes.normal;
 const ease=lining?.004:c.ease,hem=z.waistY+(lining?.005:c.hem),cuff=c.short?z.cuffX-.29:z.cuffX-.021;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),zz=p.getZ(i),ax=Math.abs(x);
  const upper=smooth(hem-.03,hem+.015,y)*(1-smooth(z.neckY+.010,z.neckY+.047,y)),torso=(1-smooth(.205,.28,ax))*upper;
  x+=n.getX(i)*ease*upper;y+=n.getY(i)*ease*upper;zz+=n.getZ(i)*ease*upper;
  const h=Math.max(0,Math.min(1,(y-z.waistY)/(z.neckY-z.waistY))),depth=(kit.body==='f'?.095:.113)+.033*Math.sin(h*Math.PI)+ease;
  const front=Math.sqrt(Math.max(0,1-(x/.225)**2))*depth,frontWeight=smooth(-.050,-.005,zz)*torso*(1-smooth(z.neckY-.105,z.neckY-.015,y));
  zz+=(front-zz)*frontWeight;
  const waist=1-smooth(z.waistY+.10,z.neckY-.16,y);x*=1+(c.knit?.10:c.formal?.025:.045)*torso*waist;
  const elbow=Math.exp(-1*((ax-(z.cuffX-.16))/.055)**2)*smooth(.25,.35,ax),wrinkle=Math.sin(ax*100+y*19)*elbow*(c.knit?.0021:.0012);
  x+=n.getX(i)*wrinkle;zz+=n.getZ(i)*wrinkle;
  // The hem hangs as cloth, with only shallow folds near the waist and elbows.
  const fold=(Math.sin(x*78+zz*16)*.0014+Math.sin(x*139)*.0006)*Math.exp(-1*((y-hem-.035)/.055)**2)*torso;
  zz+=n.getZ(i)*fold;x+=n.getX(i)*fold;
  x+=n.getX(i)*(lining?-.002:.002);y+=n.getY(i)*(lining?-.002:.002);zz+=n.getZ(i)*(lining?-.002:.002);
  p.setXYZ(i,x,y,zz);
 }
 normals(raw);
 const neck=(x,y,zz)=>c.collared&&!c.cardigan?z.neckY+.042+.026*Math.min(Math.abs(x)/.080,1)**2+.07*smooth(.08,.15,Math.abs(x)):
  z.neckY+.036*(1-smooth(-.09,0,zz-z.neckZ))+.045*Math.min(Math.abs(x)/.085,1)**2+.075*smooth(.085,.15,Math.abs(x));
 const fields=[(x,y)=>y-hem,(x)=>cuff-Math.abs(x),(x,y,zz)=>neck(x,y,zz)-y,(x,y)=>Math.max(z.headY-y,Math.abs(x)-.17)];
 if(lining&&c.formal){const bottom=z.waistY+.145;fields.push((x,y,zz)=>Math.min(Math.max(0,(y-bottom)/(z.neckY-bottom))*.060+.008-Math.abs(x),y-bottom+.008,zz-z.neckZ));}
 if(lining&&c.cardigan)fields.push((x,y,zz)=>Math.min(.055-Math.abs(x),zz-z.neckZ));
 if(lining&&c.vest)fields.push((x,y)=>Math.max(Math.abs(x)-(.158+.024*smooth(z.armY-.12,z.armY+.01,y)),y-z.neckY-.030));
 if(!lining&&c.vest)fields.push((x,y)=>Math.max(.161+.024*smooth(z.armY-.12,z.armY+.01,y)-Math.abs(x),z.armY-.18-y));
 const full=trimGarment(THREE,raw,fields);raw.dispose();normals(full);
 let geo=full;
 if(!lining&&(c.formal||c.cardigan)){
  const bottom=z.waistY+(c.formal?.145:-.16);
  geo=trimGarment(THREE,full,[(x,y,zz)=>Math.max(Math.abs(x)-(c.cardigan?.047:Math.max(0,(y-bottom)/(z.neckY-bottom))*.060),bottom-y,z.neckZ-zz)]);normals(geo);
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
 const sampler=surfaceSampler(THREE,[full]),bodySampler=surfaceSampler(THREE,[kit.skin]),cache=new Map(),groups=new Map();
 const front=(x,y,offset=.004)=>{
  const key=x.toFixed(5)+','+y.toFixed(5);let s=cache.get(key);
  if(s===undefined){s=sampler.cast(new THREE.Vector3(x,y,.6),new THREE.Vector3(0,0,-1));cache.set(key,s||null);}
  return s?{p:new THREE.Vector3(x,y,s.point.z+offset),j:s.joints,w:s.weights}:null;
 };
 const point=(p,s)=>({p,j:s.joints,w:s.weights});
 const tri=(role,a,b,d)=>{if(!a||!b||!d)return;if(!groups.has(role))groups.set(role,[]);groups.get(role).push(a,b,d);};
 const quad=(role,a,b,d,e)=>{tri(role,a,b,d);tri(role,b,e,d);};
 const panel=(role,corners,steps=6,across=steps)=>{
  const at=(u,v)=>{const q=corners[0].map((a,k)=>(1-u)*(1-v)*a+u*(1-v)*corners[1][k]+(1-u)*v*corners[2][k]+u*v*corners[3][k]);return front(...q);};
  for(let i=0;i<across;i++)for(let j=0;j<steps;j++)quad(role,at(i/across,j/steps),at((i+1)/across,j/steps),at(i/across,(j+1)/steps),at((i+1)/across,(j+1)/steps));
 };
 const strip=(role,a,b,width=.002,offset=.004)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length*width,ny=dx/length*width;
  panel(role,[[a[0]-nx,a[1]-ny,offset],[a[0]+nx,a[1]+ny,offset],[b[0]-nx,b[1]-ny,offset],[b[0]+nx,b[1]+ny,offset]],Math.max(2,Math.ceil(length/.012)),1);
 };
 const button=(x,y,r=.0036,role='metal')=>{for(let i=0;i<16;i++){const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2;tri(role,front(x,y,.008),front(x+Math.cos(a)*r,y+Math.sin(a)*r,.005),front(x+Math.cos(b)*r,y+Math.sin(b)*r,.005));}};
 // A collar wraps the real neck. Its opening stays clear of the chin.
 if(c.collared&&!c.cardigan){
  const role=c.formal?'lining':'lapel',N=48,baseY=z.neckY+.034,topY=z.neckY+(c.sport||c.vest?.066:.055),cz=z.neckZ;
  const ring=(i,t)=>{const a=i/N*Math.PI*2,dir=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),y=baseY+(topY-baseY)*t,s=bodySampler.cast(new THREE.Vector3(0,Math.max(y,z.neckY+.060),cz),dir);if(!s)return null;const p=s.point.clone().addScaledVector(dir,.003+(1-t)*.008);p.y=y;return point(p,s);};
  for(let i=0;i<N;i++){if(!c.sport&&!c.vest)continue;if((c.polo||c.formal||c.sport||c.vest)&&(i<(c.polo||c.formal?7:2)||i>N-(c.polo||c.formal?8:3)))continue;quad(role,ring(i,0),ring(i+1,0),ring(i,1),ring(i+1,1));}
  if(!c.sport&&!c.vest){for(const sd of [-1,1]){
   const role=c.formal?'shirtcollar':'collar';panel(role,[[sd*.010,z.neckY+.030,.012],[sd*.055,z.neckY+.019,.010],[sd*.043,z.neckY-.038,.010],[sd*.080,z.neckY-.008,.005]],5);
  }}
 }
 if(c.formal){
  for(const sd of [-1,1]){
   // The lapel rolls away from a separate ivory shirt and closes above the waist.
   panel('lapel',[[sd*.058,z.neckY+.008,.006],[sd*.092,z.neckY-.035,.006],[sd*.005,z.waistY+.153,.008],[sd*.046,z.waistY+.192,.012]],9);
   strip('piping',[sd*.091,z.neckY-.036],[sd*.046,z.waistY+.192],.00075,.013);
   const yy=z.waistY+.071;panel('lapel',[[sd*.052,yy-.001,.006],[sd*.126,yy+.008,.006],[sd*.052,yy-.019,.010],[sd*.126,yy-.010,.010]],5);
   strip('piping',[sd*.052,yy-.019],[sd*.126,yy-.010],.00065,.011);
  }
  for(let y=z.waistY+.118;y>z.waistY-.013;y-=.051)button(.011,y,.0042);
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
   else{const x=sd*.082,y=z.neckY-.188;panel('pocket',[[x-.031,y-.037,.003],[x+.031,y-.037,.003],[x-.031,y+.036,.007],[x+.031,y+.036,.007]],6);strip('piping',[x-.030,y-.036],[x-.030,y+.033],.00065,.008);strip('piping',[x+.030,y-.036],[x+.030,y+.033],.00065,.008);strip('piping',[x-.030,y+.024],[x+.030,y+.024],.001,.008);button(x,y+.016,.0026);}
  }
 }else if(c.cardigan){for(const sd of [-1,1])strip('rib',[sd*.050,z.waistY-.130],[sd*.050,z.neckY-.002],.010,.005);}
 else if(c.collared){
  const bottom=c.polo?z.neckY-.14:z.waistY+.019;strip('placket',[0,bottom],[0,z.neckY+.010],.008,.004);
  for(let y=bottom+.026;y<z.neckY-.018;y+=.049)button(0,y,c.polo?.0024:.0027);
 }
 // Waistband and sleeve cuffs have their own thickness and continuous surface.
 const band=(axis,at,width,role,origin,N=64)=>{
  const vertex=(i,t)=>{const a=i/N*Math.PI*2,dir=axis==='y'?new THREE.Vector3(Math.sin(a),0,Math.cos(a)):new THREE.Vector3(0,Math.sin(a),Math.cos(a));const from=origin.clone();from[axis]=at+t*width;
   const s=sampler.cast(from,dir);return s?point(s.point.clone().addScaledVector(dir,.0028),s):null;};
  for(let i=0;i<N;i++)quad(role,vertex(i,0),vertex(i+1,0),vertex(i,1),vertex(i+1,1));
 };
 if(c.knit||c.tee||c.polo){band('y',z.waistY+c.hem+.003,c.knit?.023:.009,'rib',new THREE.Vector3(0,0,-.018));}
 if(!c.vest)for(const sd of [-1,1]){
  const bone=kit.skin.skeleton.bones.find(b=>b.name===('hand_'+(sd>0?'l':'r'))),elbow=kit.skin.skeleton.bones.find(b=>b.name===('lowerarm_'+(sd>0?'l':'r')));
  const hand=bone.getWorldPosition(new THREE.Vector3()),low=elbow.getWorldPosition(new THREE.Vector3()),x=sd*(c.short?z.cuffX-.29:z.cuffX-.021),t=(x-low.x)/(hand.x-low.x),center=low.clone().lerp(hand,t);
  band('x',x-sd*(c.knit?.027:.020),sd*(c.knit?.023:.016),c.knit||c.polo||c.tee?'rib':'lapel',center,40);
 }
 sampler.dispose();bodySampler.dispose();
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
 const sampler=surfaceSampler(THREE,[kit.skin]),fp=foot.attributes.position;
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
 const buckle=mesh(kit,weightedGeometry(THREE,buckleV,buckleI),'Sewn_Buttons','metal');buckle.material=new THREE.MeshStandardMaterial({color:0xae9564,roughness:.32,metalness:.7});sampler.dispose();kit.clothBelts.set(legs.geometry,[belt,buckle]);return [belt,buckle];
}
