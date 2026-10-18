// Original Frostpine masonry, timber belfry and connected frozen shore.
// Materials/textures are borrowed or privately cloned; placement belongs to the world.
export const FROSTPINE_VILLAGE_PROFILE='frostpine-village-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const unit=a=>{const n=Math.hypot(...a);return a.map(x=>x/n);};
let resourceEpoch=0;
export function frostpinePrivateResources(make){const previous=Math.random;let seed=(0x4f524f53^Math.imul(++resourceEpoch,0x9e3779b9))>>>0;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{return make();}finally{Math.random=previous;}}
export function frostpineBakeBudget(root){let meshes=0;const materials=new Set();root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&o.geometry.index&&o.geometry.attributes.normal&&o.geometry.attributes.uv){meshes++;materials.add(o.material);}});return{meshes,materials:materials.size,randomDraws:meshes*4+materials.size*8};}
class Parts{
 constructor(){this.groups=new Map();this.parts=[];}
 group(role){if(!this.groups.has(role))this.groups.set(role,{position:[],uv:[],index:[]});return this.groups.get(role);}
 face(role,points,target,uvs=null){const g=this.group(role),normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));if(dot(normal,target)<0){points=[...points].reverse();if(uvs)uvs=[...uvs].reverse();}const start=g.position.length/3;for(let i=0;i<points.length;i++){g.position.push(...points[i]);const p=points[i];g.uv.push(...(uvs?uvs[i]:Math.abs(target[1])>Math.max(Math.abs(target[0]),Math.abs(target[2]))?[p[0]/1.4,p[2]/1.4]:Math.abs(target[0])>Math.abs(target[2])?[p[2]/1.4,p[1]/1.4]:[p[0]/1.4,p[1]/1.4]));}for(let j=1;j<points.length-1;j++)g.index.push(start,start+j,start+j+1);}
 box(role,w,h,d,x,y,z,bevel=.008,basis=null){
  const before=this.group(role).index.length,half=[w/2,h/2,d/2],b=Math.min(bevel,...half.map(v=>v*.20)),axes=basis||[[1,0,0],[0,1,0],[0,0,1]],origin=[x,y,z];
  const xf=p=>origin.map((q,j)=>q+p.reduce((s,v,i)=>s+axes[i][j]*v,0));
  const normal=n=>n.map((_,j)=>n.reduce((s,v,i)=>s+axes[i][j]*v,0));
  const face=(ps,n)=>{const along=h>w&&h>d?1:d>w?2:0,other=[0,1,2].filter(i=>i!==along),across=Math.abs(n[other[0]])>Math.abs(n[other[1]])?other[1]:other[0];const uv=role.startsWith('wood')?ps.map(p=>Math.abs(n[along])>.999&&Math.abs(n[other[0]])+Math.abs(n[other[1]])<1e-9?[p[other[0]]/1.8,p[other[1]]/1.8]:[(p[along]+origin[along])/1.8,.5+(p[across]/Math.max(.025,[w,h,d][across]))*.44]):null;this.face(role,ps.map(xf),normal(n),uv);};
  for(let a=0;a<3;a++)for(const s of[-1,1]){const q=[0,1,2].filter(i=>i!==a),ps=[];for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[0,0,0];p[a]=s*half[a];p[q[0]]=u*(half[q[0]]-b);p[q[1]]=v*(half[q[1]]-b);ps.push(p);}const n=[0,0,0];n[a]=s;face(ps,n);}
  for(let a=0;a<3;a++)for(let c=a+1;c<3;c++)for(const sa of[-1,1])for(const sc of[-1,1]){const r=3-a-c,ps=[];for(const[t,which]of[[-1,a],[-1,c],[1,c],[1,a]]){const p=half.map(v=>v-b);p[a]=sa*(half[a]-(which===a?0:b));p[c]=sc*(half[c]-(which===c?0:b));p[r]=t*(half[r]-b);ps.push(p);}const n=[0,0,0];n[a]=sa;n[c]=sc;face(ps,n);}
  for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){const signs=[sx,sy,sz],ps=[];for(let a=0;a<3;a++)ps.push(half.map((v,i)=>signs[i]*(v-(i===a?0:b))));face(ps,signs);}
  this.parts.push({role,indexStart:before,indexCount:this.group(role).index.length-before,kind:'closed-chamfered-block'});
 }
 beam(role,a,b,w,d=w){const y=unit(sub(b,a)),x=unit(cross(Math.abs(y[2])<.9?[0,0,1]:[1,0,0],y)),z=cross(x,y);this.box(role,w,Math.hypot(...sub(b,a)),d,...a.map((v,i)=>(v+b[i])/2),.006,[x,y,z]);}
 finish(){return{groups:[...this.groups].map(([role,g])=>({role,position:new Float32Array(g.position),uv:new Float32Array(g.uv),index:new Uint32Array(g.index)})),parts:this.parts};}
}
export function buildFrostpineTower(){
 const p=new Parts(),height=6.55,width=y=>4.22-.115*y;
 // Closed mortar wall segments and individual rubble face blocks stop at real apertures.
 const openings=[[{x:0,b:.02,t:2.6,w:1.08},{x:-.94,b:4.10,t:5.28,w:.32},{x:.94,b:4.10,t:5.28,w:.32}],[{x:0,b:4.16,t:5.38,w:.34}],[{x:0,b:4.08,t:5.32,w:.32}],[{x:0,b:4.16,t:5.38,w:.34}]];
 for(let side=0;side<4;side++){
  const angle=side*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),basis=[[c,0,-s],[0,1,0],[s,0,c]];
  const emit=(role,a,b,y0,y1,thick,proud=0)=>{if(b-a<.018||y1-y0<.012)return;const z=width((y0+y1)/2)/2-.16+proud,x=(a+b)/2;p.box(role,b-a,y1-y0,thick,x*c+z*s,(y0+y1)/2,-x*s+z*c,.016,basis);};
  const ys=[0,height,...openings[side].flatMap(o=>[o.b,o.t])].sort((a,b)=>a-b);
  for(let j=0;j<ys.length-1;j++){const y0=ys[j],y1=ys[j+1],mid=(y0+y1)/2,half=width(mid)/2-.16,holes=openings[side].filter(o=>mid>o.b&&mid<o.t).sort((a,b)=>a.x-b.x);let x=-half;for(const o of holes){emit('stoneDark',x,o.x-o.w/2,y0,y1,.26,-.055);x=o.x+o.w/2;}emit('stoneDark',x,half,y0,y1,.26,-.055);}
  for(let row=0;row<17;row++){
   const y0=row*height/17+.009,y1=(row+1)*height/17-.009,ym=(y0+y1)/2,half=width(ym)/2-.19,step=.51+(row%3)*.055,offset=row%2?step*.47:0;
   for(let a=-half-step+offset;a<half;a+=step){let spans=[[Math.max(-half,a+.008),Math.min(half,a+step-.008)]];
    for(const o of openings[side])if(y1>o.b&&y0<o.t){const next=[];for(const[a,b]of spans){if(a<o.x-o.w/2)next.push([a,Math.min(b,o.x-o.w/2)]);if(b>o.x+o.w/2)next.push([Math.max(a,o.x+o.w/2),b]);}spans=next;}
    for(const[a,b]of spans)emit((row+Math.round(a*13)+side)%4===0?'stoneLight':'stone',a,b,y0,y1,.36,.018*Math.sin(row*3.1+a*2.7+side));
   }
  }
 }
 // Quoins keep a restrained corner silhouette inside the original3.1m circle.
 for(let k=0;k<17;k++){const y=(k+.5)*height/17,edge=width(y)/2-.16;for(const sx of[-1,1])for(const sz of[-1,1])p.box('stoneLight',.41,height/17-.012,.41,sx*edge,y,sz*edge,.023);}
 p.box('stoneDark',4.17,3.6,4.17,0,-1.50,0,.035);p.box('stoneLight',3.72,.28,3.72,0,6.70,0,.026);
 // A timber door stands inside its stone opening, leaving visible jamb/reveal depth.
 for(let j=0;j<6;j++)p.box('wood',.154,2.43,.065,(j-2.5)*.167,1.26,1.70,.006);
 for(const y of[.48,2.04])p.box('woodPale',.98,.095,.07,0,y,1.748,.007);
 for(const y of[.50,2.02])p.box('iron',.32,.055,.05,-.33,y,1.795,.003);
 for(const x of[-.60,.60])p.box('stoneLight',.16,2.70,.53,x,1.37,1.86,.018);p.box('stoneLight',1.38,.20,.56,0,2.72,1.85,.02);
 // Purposely framed lower stage; louvered upper chamber gives the bell a building.
 const f=y=>1.58-(y-6.85)*.034;
 for(const sx of[-1,1])for(const sz of[-1,1])p.beam('wood',[sx*f(6.85),6.85,sz*f(6.85)],[sx*f(15.55),15.55,sz*f(15.55)],.24,.24);
 for(const y of[7.02,10.18,12.24,15.44])for(const[a,b]of[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]])p.beam('woodPale',[a[0]*f(y),y,a[1]*f(y)],[b[0]*f(y),y,b[1]*f(y)],.17,.18);
 for(const y0 of[7.24,12.45])for(let side=0;side<4;side++){const a=side*Math.PI/2,c=Math.cos(a),s=Math.sin(a),xz=(u,z)=>[u*c+z*s,0,-u*s+z*c],lo=xz(-f(y0),f(y0)),hi=xz(f(y0+2.56),f(y0+2.56));p.beam('wood',[lo[0],y0,lo[2]],[hi[0],y0+2.56,hi[2]],.105,.12);}
 for(let side=0;side<4;side++){const a=side*Math.PI/2,c=Math.cos(a),s=Math.sin(a),basis=[[c,0,-s],[0,1,0],[s,0,c]];
  // Five separated louver blades form each side panel; the centre is a real bell opening.
  for(const flank of[-1,1])for(let j=0;j<8;j++){const y=10.46+j*.60,z=f(y),x=flank*.94;p.box('wood',.57,.29,.14,x*c+z*s,y,-x*s+z*c,.008,basis);}
  for(const x of[-.57,.57]){const z=f(13.7);p.box('woodPale',.12,3.36,.19,x*c+z*s,13.68,-x*s+z*c,.007,basis);}
  for(const y of[10.45,15.11]){const z=f(y);p.box('woodPale',2.86,.16,.24,z*s,y,z*c,.007,basis);}
 }
 for(let j=0;j<11;j++)p.box('woodPale',2.94,.13,.255,0,12.14,(j-5)*.267,.006); // visible bell-chamber floor
 for(let j=0;j<11;j++)p.box('wood',3.25,.14,.29,0,15.68,(j-5)*.296,.006);
 // Four steep roof faces, substantial eaves and irregular shallow snow along the lee.
 const eave=15.86,ridge=17.66,R=2.12;
 for(let side=0;side<4;side++){const a=side*Math.PI/2,c=Math.cos(a),s=Math.sin(a),points=[[-R,eave,R],[R,eave,R],[0,ridge,0]].map(([x,y,z])=>[x*c+z*s,y,-x*s+z*c]);p.face('roof',points,[s,.7,c],[[0,0],[4.24/1.8,0],[2.12/1.8,2.78/1.8]]);const aa=points[0],bb=points[1];p.box('woodPale',4.24,.17,.21,(aa[0]+bb[0])/2,eave-.035,(aa[2]+bb[2])/2,.01,[[c,0,-s],[0,1,0],[s,0,c]]);}
 p.face('roof',[[-R,eave,-R],[-R,eave,R],[R,eave,R],[R,eave,-R]],[0,-1,0]);
 // Thin snow rests on the lee-facing slope; it is a closed tapered blanket.
 {const a=[[-1.91,1.91],[1.91,1.91],[.04,.04]].map(([x,z])=>[x,ridge-(ridge-eave)/R*z+.045,z]),b=a.map(q=>[q[0],q[1]-.050,q[2]]);p.face('snow',a,[0,1,1]);p.face('snow',b,[0,-1,-1]);for(let i=0;i<3;i++){const j=(i+1)%3,mid=a[i].map((v,k)=>(v+a[j][k])/2-a.reduce((sum,p)=>sum+p[k],0)/3);p.face('snow',[a[i],b[i],b[j],a[j]],[mid[0],0,mid[2]]);}}
 // The ringed post/finial retain the former landmark height and silhouette envelope.
 p.box('iron',.12,1.57,.12,0,18.31,0,.014);p.box('brass',.20,.59,.20,0,19.305,0,.025);
 const result=p.finish();result.profile=FROSTPINE_VILLAGE_PROFILE;result.height=19.60;result.bellPivot=14.6;result.circleRadius=3.1;return result;
}

// Freeze the existing canonical grid before any new ground callback is installed.
export function captureFrostpineTerrain(heightAt,center,step=1.953125,origin=-500){
 const ix=Math.floor((center[0]-18-origin)/step),iz=Math.floor((center[1]-18-origin)/step),nx=Math.ceil(36/step)+3,nz=nx,heights=[];
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)heights.push(heightAt(origin+(ix+x)*step,origin+(iz+z)*step));
 return{origin:[origin+ix*step,origin+iz*step],step,nx,nz,heights};
}
export function frostpineTerrainHeight(grid,x,z){
 const fx=(x-grid.origin[0])/grid.step,fz=(z-grid.origin[1])/grid.step,ix=Math.max(0,Math.min(grid.nx-2,Math.floor(fx))),iz=Math.max(0,Math.min(grid.nz-2,Math.floor(fz))),u=fx-ix,v=fz-iz,h=(a,b)=>grid.heights[(iz+b)*grid.nx+ix+a];
 return u+v<=1?h(0,0)+(h(1,0)-h(0,0))*u+(h(0,1)-h(0,0))*v:h(1,1)+(h(0,1)-h(1,1))*(1-u)+(h(1,0)-h(1,1))*(1-v);
}
const area2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function clipTriangle(subject,clip){let points=subject;const orientation=Math.sign(area2(...clip));for(let e=0;e<3;e++){const a=clip[e],b=clip[(e+1)%3],result=[];for(let k=0;k<points.length;k++){const p=points[k],q=points[(k+1)%points.length],dp=area2(a,b,p)*orientation,dq=area2(a,b,q)*orientation,inside=dp>=-1e-10,next=dq>=-1e-10;if(inside)result.push(p);if(inside!==next){const t=dp/(dp-dq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}points=result;if(points.length<3)return[];}return points;}
export function buildFrostpineTarn({center,level,terrain,approach}){
 const C=center,ground=(x,z)=>frostpineTerrainHeight(terrain,x,z),bearing=Math.atan2(approach[1]-C[1],approach[0]-C[0]),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 // One broad, unequal basin; the western cove leaves the bunkhouse approach on original ground.
 const radial=a=>{const d=wrap(a-bearing),cove=1-.47*Math.exp(-Math.pow(d/.68,2)),inner=(8.55+.38*Math.sin(a*3+.4)+.19*Math.cos(a*5-.5))*(1-.70*Math.exp(-Math.pow(d/.85,2))),outer=(12.4+1.05*Math.sin(a*2-.8)+.45*Math.cos(a*3+.2))*cove;return[inner,outer];};
 const elevation=(x,z)=>{const dx=x-C[0],dz=z-C[1],r=Math.hypot(dx,dz),a=Math.atan2(dz,dx),[inner,outer]=radial(a),s=clamp((r-inner)/(outer-inner)),g=ground(x,z);if(r<=inner+1e-7)return level;const shoulder=Math.sin(Math.PI*s)**2*(.14+.13*(.5+.5*Math.sin(a*2+.4)));return Math.max(g+.018,level*(1-ease(s))+ (g+.018)*ease(s)+shoulder);};
 const N=96,R=8,top=[],rings=[];for(let k=0;k<=R;k++){const ring=[];for(let j=0;j<N;j++){const a=j/N*Math.PI*2,[inner,outer]=radial(a),r=k===0?inner:inner+(outer-inner)*k/R;ring.push([C[0]+Math.cos(a)*r,C[1]+Math.sin(a)*r]);}rings.push(ring);}
 for(let j=0;j<N;j++){top.push({role:'ice',v:[C,rings[0][j],rings[0][(j+1)%N]]});for(let k=0;k<R;k++){const a=rings[k][j],b=rings[k][(j+1)%N],c=rings[k+1][j],d=rings[k+1][(j+1)%N];top.push({role:'snow',v:[a,c,b]},{role:'snow',v:[b,c,d]});}}
 const model=new Parts(),topFaces=[],iceFaces=[],segments=new Map(),vertices=new Map(),key=p=>p.map(x=>Math.round(x*1e6)).join(','),q=v=>v.map(Math.fround),step=terrain.step;
 const emit=(role,poly,heightAt)=>{const ps=poly.map(q).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-6);if(ps.length>2&&Math.hypot(ps[0][0]-ps.at(-1)[0],ps[0][1]-ps.at(-1)[1])<1e-6)ps.pop();if(ps.length<3)return;for(let j=1;j<ps.length-1;j++){const tri=[ps[0],ps[j],ps[j+1]];if(Math.abs(area2(...tri))<1e-9)continue;const world=tri.map(([x,z])=>{const k=key([x,z]);if(!vertices.has(k))vertices.set(k,[x,Math.fround(heightAt(x,z)),z]);return vertices.get(k);});model.face(role,world,[0,1,0],world.map(p=>[(p[0]*.8574929257+p[2]*.5144957554)/2.25,(-p[0]*.5144957554+p[2]*.8574929257)/2.25]));const packed=world.map(p=>p.map(Math.fround));topFaces.push(packed);if(role==='ice')iceFaces.push(packed);const bottom=world.map(p=>[p[0],ground(p[0],p[2])-.10,p[2]]);model.face('snow',bottom,[0,-1,0]);for(let e=0;e<3;e++){const a=world[e],b=world[(e+1)%3],ka=key([a[0],a[2]]),kb=key([b[0],b[2]]),id=ka<kb?ka+'|'+kb:kb+'|'+ka,old=segments.get(id);if(old)old.count++;else segments.set(id,{count:1,a,b});}}};
 for(const t of top){const xs=t.v.map(p=>p[0]),zs=t.v.map(p=>p[1]),minX=Math.max(0,Math.floor((Math.min(...xs)-terrain.origin[0])/step)),maxX=Math.min(terrain.nx-2,Math.floor((Math.max(...xs)-terrain.origin[0])/step)),minZ=Math.max(0,Math.floor((Math.min(...zs)-terrain.origin[1])/step)),maxZ=Math.min(terrain.nz-2,Math.floor((Math.max(...zs)-terrain.origin[1])/step));for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const a=[terrain.origin[0]+x*step,terrain.origin[1]+z*step],b=[a[0]+step,a[1]],c=[a[0],a[1]+step],d=[a[0]+step,a[1]+step];for(const cell of[[a,b,c],[b,d,c]]){const poly=clipTriangle(t.v,cell);if(poly.length<3)continue;const h=t.v.map(p=>elevation(...p)),den=area2(...t.v),plane=(x,z)=>{const u=area2([x,z],t.v[1],t.v[2])/den,v=area2(t.v[0],[x,z],t.v[2])/den;return u*h[0]+v*h[1]+(1-u-v)*h[2];};if(t.role==='ice'){emit(t.role,poly,()=>level);continue;}const clearance=p=>plane(...p)-ground(...p)-.018,half=sign=>{const result=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=clearance(p)*sign,dq=clearance(q)*sign;if(dp>=-1e-12)result.push(p);if((dp>=0)!==(dq>=0)){const u=dp/(dp-dq);result.push([p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u]);}}return result;};emit('snow',half(1),plane);emit('snow',half(-1),(x,z)=>ground(x,z)+.018);}}}
 for(const edge of segments.values())if(edge.count===1){const{a,b}=edge,aa=[a[0],ground(a[0],a[2])-.10,a[2]],bb=[b[0],ground(b[0],b[2])-.10,b[2]],mid=[(a[0]+b[0])/2-C[0],0,(a[2]+b[2])/2-C[1]];model.face('snow',[a,aa,bb,b],mid);}
 const result=model.finish();result.profile=FROSTPINE_VILLAGE_PROFILE;result.center=[...center];result.level=level;result.topFaces=topFaces;result.iceFaces=iceFaces;result.terrain=terrain;result.edgeCounts={};for(const e of segments.values())result.edgeCounts[e.count]=(result.edgeCounts[e.count]||0)+1;result.radii=Array.from({length:N},(_,j)=>radial(j/N*Math.PI*2));return result;
}
export function frostpinePackedSupport(topFaces){const flat=new Float32Array(topFaces.flat(2)),bounds=[Infinity,Infinity,-Infinity,-Infinity],cells=new Map(),step=2;for(let t=0;t<flat.length;t+=9){const xs=[flat[t],flat[t+3],flat[t+6]],zs=[flat[t+2],flat[t+5],flat[t+8]],loX=Math.min(...xs),hiX=Math.max(...xs),loZ=Math.min(...zs),hiZ=Math.max(...zs);bounds[0]=Math.min(bounds[0],loX);bounds[1]=Math.min(bounds[1],loZ);bounds[2]=Math.max(bounds[2],hiX);bounds[3]=Math.max(bounds[3],hiZ);for(let z=Math.floor(loZ/step);z<=Math.floor(hiZ/step);z++)for(let x=Math.floor(loX/step);x<=Math.floor(hiX/step);x++){const key=x+','+z,list=cells.get(key)||[];list.push(t);cells.set(key,list);}}
 const heightAt=(x,z)=>{if(x<bounds[0]||z<bounds[1]||x>bounds[2]||z>bounds[3])return-Infinity;let h=-Infinity;for(const t of cells.get(Math.floor(x/step)+','+Math.floor(z/step))||[]){const a=[flat[t],flat[t+2]],b=[flat[t+3],flat[t+5]],c=[flat[t+6],flat[t+8]],den=area2(a,b,c);if(Math.abs(den)<1e-12)continue;const u=area2([x,z],b,c)/den,v=area2(a,[x,z],c)/den,w=1-u-v;if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)h=Math.max(h,u*flat[t+1]+v*flat[t+4]+w*flat[t+7]);}return h;};return{heightAt,positions:flat,bounds,triangles:flat.length/9};}

export function createFrostpineVillageArt({THREE:T,W,scene,center,level,approach}){
 return frostpinePrivateResources(()=>{
  const terrain=captureFrostpineTerrain(W.terrainH,center,W.terrainStep||1.953125),tower=buildFrostpineTower(),tarn=buildFrostpineTarn({center,level,terrain,approach}),snowTexture=scene.getObjectByName('Pasture terrain')?.material?.userData?.snowSurface?.color?.value;
  if(!snowTexture?.isTexture)throw new Error('Frostpine requires the resident terrain snow texture');
  const source=W.ranchBuilderArt.materials,localMaterials=[],geometries=[],clone=(base,name,color)=>{const m=base.clone();m.name=name;m.color.set(color);m.userData={...m.userData,frostpineVillage:FROSTPINE_VILLAGE_PROFILE};localMaterials.push(m);return m;},stone=clone(source.stone,'Frostpine | cold weathered masonry','#9b9f9e');stone.roughness=.98;stone.envMapIntensity=.45;stone.normalScale?.set(.32,.32);
  const materials={stone,stoneDark:clone(stone,'Frostpine | recessed grey mortar','#747d80'),stoneLight:clone(stone,'Frostpine | grey dressed quoins','#b6b9b4'),wood:clone(source.aged,'Frostpine | weathered vertical timber','#9a8c76'),woodPale:clone(source.oak,'Frostpine | sawn frame and deck','#a39680'),iron:clone(source.iron,'Frostpine | forged hardware','#4b5359'),brass:clone(source.iron,'Frostpine | aged finial','#a08c53'),roof:clone(W.ranchArchitecture.roofMaterial,'Frostpine | dark shingle cap','#a7aaa7')};
  materials.snow=new T.MeshStandardMaterial({name:'Frostpine | wind packed photographic snow',color:'#f5f7f7',map:snowTexture,roughness:.95,metalness:0,envMapIntensity:.55});materials.ice=new T.MeshStandardMaterial({name:'Frostpine | frozen blue tarn',color:'#adc9d3',roughness:.23,metalness:.16,envMapIntensity:.8});localMaterials.push(materials.snow,materials.ice);
  const make=(data,name)=>{const root=new T.Group();root.name=name;for(const group of data.groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(group.position,3));g.setAttribute('uv',new T.BufferAttribute(group.uv,2));g.setIndex(new T.BufferAttribute(group.index,1));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.workshopUV=true;const mesh=new T.Mesh(g,materials[group.role]);mesh.name=name+' | '+group.role;mesh.castShadow=group.role!=='ice';mesh.receiveShadow=true;root.add(mesh);geometries.push(g);}return root;};
  const towerRoot=make(tower,'Frostpine | masonry and timber bell tower'),tarnRoot=make(tarn,'Frostpine | connected snow and ice shore'),support=frostpinePackedSupport(tarn.topFaces),iceSupport=frostpinePackedSupport(tarn.iceFaces);
  const stats={profile:FROSTPINE_VILLAGE_PROFILE,tower:{height:tower.height,bellPivot:tower.bellPivot,circleRadius:tower.circleRadius,parts:tower.parts.length,triangles:tower.groups.reduce((s,g)=>s+g.index.length/3,0)},tarn:{center:[...center],level,triangles:tarn.groups.reduce((s,g)=>s+g.index.length/3,0),supportTriangles:support.triangles,bounds:support.bounds},snowTexture:{uuid:snowTexture.uuid,name:snowTexture.name,source:snowTexture.image?.currentSrc||snowTexture.image?.src||null,repeat:snowTexture.repeat.toArray(),offset:snowTexture.offset.toArray(),rotation:snowTexture.rotation,matrix:snowTexture.matrix.toArray()},localMaterials:localMaterials.length,sourceGeometryBytes:[...tower.groups,...tarn.groups].reduce((sum,g)=>sum+g.position.byteLength+g.uv.byteLength+(g.position.length/3)*12+g.index.byteLength,0),retainedSupportBytes:support.positions.byteLength,iceMask:{triangles:iceSupport.triangles,typedBytes:iceSupport.positions.byteLength,bounds:iceSupport.bounds}};
  return{towerRoot,tarnRoot,supportAt:support.heightAt,support,iceSupport,iceContains:(x,z)=>Number.isFinite(iceSupport.heightAt(x,z)),stats,releaseBuildGeometry(){for(const g of geometries)g.dispose();geometries.length=0;towerRoot.clear();tarnRoot.clear();},disposeMaterials(){for(const m of localMaterials)m.dispose();}};
 });
}
