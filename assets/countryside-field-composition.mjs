// Original authored field management. Read only after all original planting.
// Metres, existing root positions and geometry; no terrain or riding surface.
export const COUNTRYSIDE_FIELDS_PROFILE='connected-countryside-fields-1';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const ZERO=Object.freeze({weight:0,cut:0,cap:Infinity,floor:0,seed:0});
const STEP=2;
const branches=Object.freeze([
 Object.freeze({id:'barleyfold-grove',destination:'Cottonwood–Barleyfold public road at [140,-84]',nodes:[[174,-193],[170,-175],[171,-166],[164,-155],[154,-145],[158,-129],[151,-111],[143,-94],[140,-84]],half:9.2,left:12,right:6.5,seedSide:-1}),
 Object.freeze({id:'north-bridge',destination:'Existing river-bridge–north-meadow path at [83,184]',nodes:[[74,262],[73,250],[68,237],[66,223],[69,208],[77,194],[83,184]],half:7.2,left:8.5,right:14,seedSide:1})
]);
function prepare({id,nodes,half,left,right,seedSide,destination}){
 if(nodes.length<2||nodes.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid authored field centreline');
 let length=0;const segments=[];
 for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);if(span<1e-6)continue;segments.push({a,dx,dz,span,start:length});length+=span;}
 const pad=half+Math.max(left,right)+3;
 return{id,destination,nodes,segments,length,half,left,right,seedSide,bounds:{minX:Math.min(...nodes.map(p=>p[0]))-pad,maxX:Math.max(...nodes.map(p=>p[0]))+pad,minZ:Math.min(...nodes.map(p=>p[1]))-pad,maxZ:Math.max(...nodes.map(p=>p[1]))+pad}};
}
function frame(run,x,z){let best=Infinity,result=null;for(const s of run.segments){const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/(s.span*s.span)),dx=x-s.a[0]-s.dx*t,dz=z-s.a[1]-s.dz*t,d=Math.hypot(dx,dz);if(d<best){best=d;result={d,side:(s.dx*dz-s.dz*dx)>=0?1:-1,along:s.start+t*s.span};}}return result;}
const within=(b,x,z)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
export function createCountrysideFieldComposition({tracks,forestPoints=[],protectedAt,terrainH}){
 if(!Array.isArray(tracks)||typeof protectedAt!=='function'||typeof terrainH!=='function')throw Error('Final actual routes/terrain/protections required');
 const clover=tracks.find(t=>t.id==='clover');if(!clover||Math.abs(clover.w-2.35)>1e-8)throw Error('Actual Clover route missing');
 // These are the real final contour-repaired samples, not a straight surrogate.
 const nodes=clover.pts.filter(p=>p[0]>35&&p[1]<-83&&p[1]>-163).map(p=>[p[0],p[1]]);
 if(nodes.length<30)throw Error('Actual Clover route scope drift');
 const runs=[prepare({id:'clover-cottonwood',destination:'Actual Clover bridleway into Cottonwood',nodes,half:7.6,left:12,right:6.5,seedSide:1}),...branches.map(prepare)];
 let bytes=0,activeVertices=0;const grids=[];
 const trees=new Map(),treeKey=(x,z)=>Math.floor(x/4)+','+Math.floor(z/4);
 for(const p of forestPoints){if(!Number.isFinite(p.x+p.z))throw Error('Invalid final forest point');const key=treeKey(p.x,p.z);if(!trees.has(key))trees.set(key,[]);trees.get(key).push({x:p.x,z:p.z,inner:.36,outer:1.65+.12*Math.min(2,p.s??1)});}
 function local(run,x,z){
  if(!within(run.bounds,x,z)||protectedAt(x,z))return ZERO;
  const f=frame(run,x,z),alongFade=ease(0,10,f.along)*(1-ease(run.length-10,run.length,f.along));if(alongFade===0)return ZERO;
  const waviness=.7*Math.sin(f.along*.097)+.35*Math.sin(f.along*.21+run.half),half=run.half+waviness;
  const shoulder=f.side>0?run.left:run.right,outer=half+shoulder*(.90+.1*Math.sin(f.along*.061));
  const weight=(1-ease(outer-3,outer+1,f.d))*alongFade;if(weight===0)return ZERO;
  const slope=Math.hypot((terrainH(x+.75,z)-terrainH(x-.75,z))/1.5,(terrainH(x,z+.75)-terrainH(x,z-.75))/1.5),grade=1-ease(.35,.62,slope);if(grade===0)return ZERO;
  const core=(1-ease(half-1.1,half+1.3,f.d)),bank=ease(half+.5,half+3.5,f.d)*(1-ease(outer-3.5,outer+.5,f.d));
  const patch=.5+.5*Math.sin(f.along*.071+x*.013)*Math.sin(f.along*.037-z*.019);
  return{weight:weight*grade,cut:core*.99,cap:.37+.08*patch+bank*.65,floor:bank*(.74+.24*patch),seed:bank*(f.side===run.seedSide?.65:.12)*ease(.15,.75,patch)};
 }
 for(const run of runs){
  const b=run.bounds,minX=Math.floor(b.minX/STEP)*STEP,minZ=Math.floor(b.minZ/STEP)*STEP,nx=Math.ceil((b.maxX-minX)/STEP)+1,nz=Math.ceil((b.maxZ-minZ)/STEP)+1,data=new Float32Array(nx*nz*5);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const q=local(run,minX+ix*STEP,minZ+iz*STEP),i=(iz*nx+ix)*5;data.set([q.weight,q.cut,Number.isFinite(q.cap)?q.cap:0,q.floor,q.seed],i);if(q.weight>0)activeVertices++;}
  bytes+=data.byteLength;grids.push({run,minX,minZ,nx,nz,data});
 }
 function at(x,z){let weight=0,cut=0,cap=0,floor=0,seed=0;
  for(const g of grids){if(!within(g.run.bounds,x,z))continue;const xx=(x-g.minX)/STEP,zz=(z-g.minZ)/STEP,ix=Math.floor(xx),iz=Math.floor(zz);if(ix<0||iz<0||ix>=g.nx-1||iz>=g.nz-1)continue;
   const fx=ease(0,1,xx-ix),fz=ease(0,1,zz-iz),idx=iz*g.nx+ix,ids=[idx,idx+1,idx+g.nx,idx+g.nx+1],ws=[(1-fx)*(1-fz),fx*(1-fz),(1-fx)*fz,fx*fz],v=[0,0,0,0,0];for(let k=0;k<4;k++)for(let c=0;c<5;c++)v[c]+=g.data[ids[k]*5+c]*ws[k];
   if(v[0]>weight){weight=v[0];cut=v[1];cap=v[2];floor=v[3];seed=v[4];}
  }
  if(weight<1e-7||protectedAt(x,z))return ZERO;
  let skirt=1;const tx=Math.floor(x/4),tz=Math.floor(z/4);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const p of trees.get((tx+dx)+','+(tz+dz))||[])skirt*=ease(p.inner,p.outer,Math.hypot(x-p.x,z-p.z));
  return{weight:clamp(weight)*skirt,cut,cap:Math.max(.25,cap),floor:Math.min(cap,floor),seed};
 }
 return Object.freeze({profile:COUNTRYSIDE_FIELDS_PROFILE,runs:runs.map(r=>({id:r.id,destination:r.destination,nodes:r.nodes,bounds:r.bounds,length:r.length,halfWidth:r.half,leftBank:r.left,rightBank:r.right})),stats:Object.freeze({runs:runs.length,step:STEP,gridBytes:bytes,activeVertices}),at});
}
