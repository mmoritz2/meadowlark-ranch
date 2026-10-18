/* Original Ribbon Falls stone. The terrain is read only at construction;
   registered support later queries these same triangles, never live groundH. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const bell=(v,c,w)=>Math.exp(-Math.pow((v-c)/w,2));
const fresh=()=>({position:[],uv:[],color:[],index:[]});
const frozen=g=>({position:new Float32Array(g.position),uv:new Float32Array(g.uv),color:new Float32Array(g.color),index:new Uint32Array(g.index)});
function grid(g,cols,rows,point,reverse=false,top=false,depth=false){
 const base=g.position.length/3;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const p=point(i/cols,j/rows);g.position.push(...p);
  g.uv.push((depth?p[2]:p[0])/3.2,(top?p[2]:p[1])/3.2);
  const v=.88+.035*Math.sin(p[0]*.67+p[1]*1.1)+.018*Math.cos(p[2]*1.2-p[0]*.3);
  g.color.push(v*.98,v,v*.97);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=base+j*(cols+1)+i,b=a+cols+1;
  if(reverse)g.index.push(a,b,a+1,a+1,b,b+1);else g.index.push(a,a+1,b,a+1,b+1,b);
 }
}
function clipped(poly,a,b){
 const out=[],dx=b[0]-a[0],dz=b[1]-a[1];
 const side=p=>dx*(p[1]-a[1])-dz*(p[0]-a[0]);
 for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q),pin=dp>=-1e-10,qin=dq>=-1e-10;
  if(pin)out.push(p);
  if(pin!==qin){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
 }
 return out;
}
export function buildRibbonFallsLandform({heightAt,x=342,lipZ=65.5,shelfZ=67.9,toeZ=76,lipY,shelfY,width=17.5,terrainStep=1.953125,terrainOrigin=-500}={}){
 if(typeof heightAt!=='function'||![x,lipZ,shelfZ,toeZ,lipY,shelfY,width,terrainStep,terrainOrigin].every(Number.isFinite)||!(lipY>shelfY&&width>10&&terrainStep>0))throw new TypeError('Ribbon Falls requires finite dimensions and a captured terrain sampler');
 const cliff=fresh(),bank=fresh(),half=width/2;
 const shoulders=[];
 for(const side of[-1,1]){
  const crown=u=>lipY-.22+(side<0?.22:-.12)+.44*bell(u,side<0?.13:.20,.15)+.27*bell(u,side<0?.58:.51,.20)
   -(side<0?.73:.48)*bell(u,side<0?.36:.40,.10)-(side<0?.51:.77)*bell(u,side<0?.83:.77,.09)-.78*smooth(.88,1,u);
  const front=(u,t)=>{
   const inner=1.93+.72*(1-t)**2,outer=half*(1-.055*t*t);
   const xx=x+side*(inner+(outer-inner)*u+.085*Math.sin(u*12+side)*Math.sin(Math.PI*u));
   const cleftA=.29+.035*t*(side<0?1:-1),cleftB=.68-.045*t;
   const clefts=(1.48*bell(u,cleftA,.075)+2.03*bell(u,cleftB,.09))*(.30+.70*smooth(.03,.22,t));
   const buttress=.48*bell(u,.11,.17)+.58*bell(u,.48,.19)+.39*bell(u,.91,.11);
   const beds=(.43*smooth(.26,.31,t)+.34*smooth(.56,.61,t)+.20*smooth(.79,.83,t))
    *(1-.82*clamp(bell(u,cleftA,.12)+bell(u,cleftB,.13),0,1));
   const zz=lipZ+.12+4.42*u**1.38+buttress-.48*t-clefts-beds+.10*Math.sin(u*19+side*2+t*4)*Math.sin(Math.PI*u);
   const floor=heightAt(xx,zz)-.23,top=crown(u);
   return[xx,floor+(top-floor)*t,zz];
  };
  const back=(u,t)=>{
   const a=front(u,t),zz=lipZ-4.9-1.8*Math.sin(Math.PI*u)+.27*u;
   const floor=heightAt(a[0],zz)-.23,top=crown(u)-.40-.13*Math.sin(u*5+side);
   return[a[0],floor+(top-floor)*t,zz];
  };
  // One connected closed shoulder, with two deep coherent clefts and bed ledges
  // terminating inside them. There are no added fragment cubes or scatter rocks.
  const N=48,R=22,D=10;
  grid(cliff,N,R,front,side<0);grid(cliff,N,R,back,side>0);
  for(const end of[0,1])grid(cliff,D,R,(f,t)=>{const a=front(end,t),b=back(end,t);return a.map((v,i)=>v+(b[i]-v)*f);},end===0?side>0:side<0,false,true);
  grid(cliff,N,D,(u,f)=>{const a=front(u,1),b=back(u,1);return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f+.07*Math.sin(Math.PI*f)*Math.sin(Math.PI*u)*Math.sin(u*9+side),a[2]+(b[2]-a[2])*f];},side<0,true);
  grid(cliff,N,D,(u,f)=>{const a=front(u,0),b=back(u,0);return a.map((v,i)=>v+(b[i]-v)*f);},side>0,true);
  shoulders.push({side,crown:Array.from({length:N+1},(_,i)=>front(i/N,1)),front:Array.from({length:N+1},(_,i)=>front(i/N,.62))});
 }
 // Recessed, irregular source bed connects the shoulders behind the falling
 // water. Its entire front stays behind the original lip and animated veils.
 const bridge=(u,f,top)=>{
  const xx=x+(u*2-1)*2.70,zz=lipZ-4.95+4.48*f+.085*Math.sin(u*11)*Math.sin(Math.PI*f);
  const roof=lipY-.36-.14*Math.exp(-Math.pow((xx-x)/1.2,2))+.055*Math.sin(xx*2.3)*Math.sin(Math.PI*f);
  return[xx,top?roof:heightAt(xx,zz)-.24,zz];
 };
 grid(cliff,24,16,(u,f)=>bridge(u,f,true),true,true);
 grid(cliff,24,16,(u,f)=>bridge(u,f,false),false,true);
 for(const end of[0,1])grid(cliff,24,10,(u,t)=>{const a=bridge(u,end,false),b=bridge(u,end,true);return a.map((v,i)=>v+(b[i]-v)*t);},end===0);
 for(const end of[0,1])grid(cliff,16,10,(f,t)=>{const a=bridge(end,f,false),b=bridge(end,f,true);return a.map((v,i)=>v+(b[i]-v)*t);},end===1,false,true);

 // A connected bed extends down the real chute. Polygon clipping confines every
 // low face to one canonical terrain triangle; it cannot bridge through a crest.
 const stations=[[shelfZ-1.0,-6.0,5.4],[shelfZ,-7.2,6.6],[69.6,-6.3,5.4],[71.2,-5.6,6.4],[73.4,-5.1,5.7],[75.1,-5.8,5.0],[toeZ,-5.374,5.284],[toeZ+1.0,-4.9,5.6]];
 const outline=[...stations.map(p=>[x+p[1],p[0]]),...stations.slice().reverse().map(p=>[x+p[2],p[0]])];
 const domains=stations.slice(1).map((b,i)=>{const a=stations[i];return[[x+a[1],a[0]],[x+a[2],a[0]],[x+b[2],b[0]],[x+b[1],b[0]]];});
 const wetHalf=z=>1.35+clamp((z-shelfZ)/(toeZ-shelfZ),0,1)*2.5;
 const boundaryDistance=(xx,zz)=>Math.min(...outline.map((a,i)=>{const b=outline[(i+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((xx-a[0])*dx+(zz-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(xx-a[0]-dx*t,zz-a[1]-dz*t);}));
 const relief=(xx,zz)=>{
  const dx=xx-x,d=Math.abs(dx)-wetHalf(zz),edge=smooth(0,.95,boundaryDistance(xx,zz));
  const dry=smooth(.68,1.50,d);
  const shelfA=.19*(1-smooth(.35,1.15,Math.abs(zz-(69.50+.20*dx))));
  const shelfB=.15*(1-smooth(.44,1.38,Math.abs(zz-(73.3-.16*dx))));
  const shoulder=.10*bell(dx,-5.1,1.75)*bell(zz,70.6,2.4)+.08*bell(dx,5.8,1.6)*bell(zz,72.6,2.8);
  return .012+dry*edge*(shelfA+shelfB+shoulder);
 };
 const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0])),minZ=Math.min(...outline.map(p=>p[1])),maxZ=Math.max(...outline.map(p=>p[1]));
 const ix0=Math.floor((minX-terrainOrigin)/terrainStep),ix1=Math.floor((maxX-terrainOrigin)/terrainStep),iz0=Math.floor((minZ-terrainOrigin)/terrainStep),iz1=Math.floor((maxZ-terrainOrigin)/terrainStep);
 const sourceTriangles=[];
 function triangle(a,b,c,source){
  const base=bank.position.length/3;
  for(const p of[a,b,c]){
   const [xx,zz]=p,rr=relief(xx,zz),wet=1-smooth(.45,1.9,Math.abs(xx-x)-wetHalf(zz));
   bank.position.push(xx,heightAt(xx,zz)+rr,zz);bank.uv.push(xx/3.2,zz/3.2);
   const v=.87-.23*wet+.025*Math.sin(xx*.8+zz*.6);bank.color.push(v*.98,v,v*.97);
  }
  // Counterclockwise XZ means downward Y; reverse for the exposed top.
  bank.index.push(base,base+2,base+1);sourceTriangles.push(source);
 }
 function subdivide(a,b,c,source,depth){
  if(!depth){triangle(a,b,c,source);return;}
  const ab=a.map((v,i)=>(v+b[i])*.5),bc=b.map((v,i)=>(v+c[i])*.5),ca=c.map((v,i)=>(v+a[i])*.5);
  subdivide(a,ab,ca,source,depth-1);subdivide(ab,b,bc,source,depth-1);subdivide(ca,bc,c,source,depth-1);subdivide(ab,bc,ca,source,depth-1);
 }
 for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
  const xx=terrainOrigin+ix*terrainStep,zz=terrainOrigin+iz*terrainStep,a=[xx,zz],b=[xx+terrainStep,zz],c=[xx,zz+terrainStep],d=[xx+terrainStep,zz+terrainStep];
  for(const [source,tri]of[[[ix,iz,0],[a,b,c]],[[ix,iz,1],[d,c,b]]]){
   for(const domain of domains)for(const side of[-1,1]){
    let poly=tri;for(let i=0;i<domain.length&&poly.length;i++)poly=clipped(poly,domain[i],domain[(i+1)%domain.length]);
    // Keep the whole original chute, its foot and a generous lateral halo free
    // of new bank geometry/support. Existing water/terrain contact stays owned.
    const out=[],distance=p=>side*(p[0]-x)-wetHalf(p[1])-.75;
    for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=distance(p),b=distance(q);if(a>=-1e-10)out.push(p);if((a>=0)!==(b>=0)){const t=a/(a-b);out.push(p.map((v,j)=>v+(q[j]-v)*t));}}
    poly=out;
    for(let i=1;i+1<poly.length;i++){
     const p=poly[0],q=poly[i],r=poly[i+1],cross=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
     if(Math.abs(cross)>1e-9)subdivide(p,q,r,source,2);
    }
   }
  }
 }
 return{cliff:frozen(cliff),bank:frozen(bank),bankSourceTriangles:sourceTriangles,outline,shoulders,
  profile:'ribbon-falls-landform-1',wetHalf,stats:{cliffTriangles:cliff.index.length/3,bankTriangles:bank.index.length/3,bankMaxRelief:.36,terrainStep,terrainOrigin}};
}

export function remodelRibbonFallsCliff({THREE:T,cliff,heightAt,...options}){
 const data=buildRibbonFallsLandform({heightAt,...options}),mesh=cliff.children.find(o=>o.isMesh&&o.geometry);
 if(!mesh)throw new TypeError('Ribbon Falls needs the original single cliff mesh');
 const geometry=mesh.geometry,origin=cliff.position,upperCount=data.cliff.position.length/3;
 const position=new Float32Array(data.cliff.position.length+data.bank.position.length),uv=new Float32Array(data.cliff.uv.length+data.bank.uv.length),color=new Float32Array(data.cliff.color.length+data.bank.color.length),index=new Uint32Array(data.cliff.index.length+data.bank.index.length);
 position.set(data.cliff.position);position.set(data.bank.position,data.cliff.position.length);
 // Reuse the original group/mesh/geometry/material and its constructor budget.
 // Store world-authored points in its original local coordinate system.
 for(let i=0;i<position.length;i+=3){position[i]-=origin.x;position[i+1]-=origin.y;position[i+2]-=origin.z;}
 uv.set(data.cliff.uv);uv.set(data.bank.uv,data.cliff.uv.length);color.set(data.cliff.color);color.set(data.bank.color,data.cliff.color.length);
 index.set(data.cliff.index);for(let i=0;i<data.bank.index.length;i++)index[data.cliff.index.length+i]=upperCount+data.bank.index[i];
 for(const [name,array,size]of[['position',position,3],['uv',uv,2],['color',color,3]])geometry.setAttribute(name,new T.BufferAttribute(array,size));
 geometry.setIndex(new T.BufferAttribute(index,1));geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const cells=new Map(),cellSize=2,key=(x,z)=>x+','+z;
 for(let i=data.cliff.index.length;i<index.length;i+=3){
  const tri=[];for(let k=0;k<3;k++){const v=index[i+k]*3;tri.push([position[v]+origin.x,position[v+1]+origin.y,position[v+2]+origin.z]);}
  const minX=Math.floor(Math.min(...tri.map(p=>p[0]))/cellSize),maxX=Math.floor(Math.max(...tri.map(p=>p[0]))/cellSize),minZ=Math.floor(Math.min(...tri.map(p=>p[2]))/cellSize),maxZ=Math.floor(Math.max(...tri.map(p=>p[2]))/cellSize);
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const k=key(x,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(tri);}
 }
 // Bank-only support: cliff bodies block the rider but their crowns never raise
 // groundH beneath the whole footprint. This sampler reads frozen packed faces.
 const supportAt=(x,z)=>{
  let height=-Infinity;
  for(const [a,b,c]of cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))||[]){
   const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)>=-1e-10)height=Math.max(height,u*a[1]+v*b[1]+w*c[1]);
  }return height;
 };
 const bankRange={firstIndex:data.cliff.index.length,indexCount:data.bank.index.length};
 mesh.userData.ribbonFalls={profile:data.profile,triangles:index.length/3,bankRange};
 mesh.userData.geology={...mesh.userData.geology,kind:'Ribbon Falls eroded gorge',triangles:index.length/3,min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()};
 cliff.userData.geology={...cliff.userData.geology,...mesh.userData.geology};
 // Only closed cliff faces are body blockers. Low banks are supported by their
 // exact heightfield; treating a supported uphill plane as a body wall snags a
 // rider's uphill cylinder edge, unlike the surrounding terrain's behavior.
 const bodyGeometry={attributes:{position:geometry.attributes.position},index:new T.BufferAttribute(index.subarray(0,bankRange.firstIndex),1)};
 return{cliff,mesh,bodyGeometry,supportAt,bankRange,profile:data.profile,stats:data.stats};
}
