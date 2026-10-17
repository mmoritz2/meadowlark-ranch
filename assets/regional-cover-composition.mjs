// Original, bounded presentation of existing grass. No planting or ground edits.
export const REGIONAL_COVER_PROFILE='regional-approach-cover-2';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const ZERO=Object.freeze({weight:0,cut:0,cap:Infinity,dry:0,seed:0});
const STEP=2;
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const pos=o=>o&&Number.isFinite(o.x+o.z)?[o.x,o.z]:null;
const offset=(p,x,z)=>[p[0]+x,p[1]+z];
function requirePoint(p,id){if(!point(p))throw Error('Actual regional cover anchor missing: '+id);return [...p];}

// Read full-precision, already placed owners only, after all original installers.
// Rounded map markers and nominal quarter sites are not used as building doors.
export function regionalCoverLayoutFromWorld(G){
 const W=G.world,Q=G.quartersPkg,V=G.vistas,tracks=G.worldPaths?.tracks;
 if(!W||!Q||!V||!Array.isArray(tracks))throw Error('Final world cover owners unavailable');
 const landmark=id=>requirePoint(pos(V.LAND?.find(l=>l.id===id)),id);
 const door=id=>requirePoint(pos(W.things?.find(t=>t.id===id)),id);
 const track=id=>{const t=tracks.find(t=>t.id===id);if(!t||!t.pts?.every(point))throw Error('Actual approach track missing: '+id);return t.pts.map(p=>[...p]);};
 const chalk=V.SCARP;
 if(!chalk||!['x','z','len','depth','h'].every(k=>Number.isFinite(chalk[k])))throw Error('Actual Chalk scarp unavailable');
 const willow=Q.willowSettlement;
 if(!willow||!willow.routes?.every(r=>Number.isFinite(r.width)&&r.width>0&&r.pts?.length>=2&&r.pts.every(point)))throw Error('Actual Willowmere routes unavailable');
 return{chalk:{x:chalk.x,z:chalk.z,len:chalk.len,depth:chalk.depth,h:chalk.h},keep:landmark('wrenfell'),sisters:landmark('ninesisters'),marshTrack:track('marsh'),ochreTrack:track('ochre'),riverWestTrack:track('riverwest'),willowDoor:door('q:willow:boathouse'),willowRoutes:willow.routes.map(r=>({width:r.width,pts:r.pts.map(p=>[...p])})),ochrePost:door('q:ochre:post'),ochreBarn:door('q:ochre:barn')};
}

function prepare(id,nodes,{half=12,left=11,right=17,cap=.32,bank=.92,dry=0,seedSide=1}={}){
 if(!Array.isArray(nodes)||nodes.length<2||!nodes.every(point))throw Error('Invalid regional cover run: '+id);
 let length=0;const segments=[];
 for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);if(span<1e-6)continue;segments.push({a,dx,dz,span,start:length});length+=span;}
 if(length<2)throw Error('Regional cover run has no length: '+id);
 const pad=half+Math.max(left,right)+3;
 return{id,nodes:nodes.map(p=>[...p]),segments,length,half,left,right,cap,bank,dry,seedSide,bounds:{minX:Math.min(...nodes.map(p=>p[0]))-pad,maxX:Math.max(...nodes.map(p=>p[0]))+pad,minZ:Math.min(...nodes.map(p=>p[1]))-pad,maxZ:Math.max(...nodes.map(p=>p[1]))+pad}};
}
const inside=(b,x,z)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
function frame(run,x,z){let best=Infinity,result=null;for(const s of run.segments){const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/(s.span*s.span)),dx=x-s.a[0]-s.dx*t,dz=z-s.a[1]-s.dz*t,d=Math.hypot(dx,dz);if(d<best){best=d;result={d,side:s.dx*dz-s.dz*dx>=0?1:-1,along:s.start+t*s.span};}}return result;}

// Continuous bent openings, joined to the actual approach/door, with two unequal
// recovery margins. These are visual sward patterns, not newly rideable tracks.
export function regionalCoverRuns(layout){
 const s=layout.chalk;if(!s||!['x','z','depth'].every(k=>Number.isFinite(s[k])))throw Error('Actual Chalk cover frame missing');
 const face=Math.atan2(s.x,s.z),ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
 const chalk=(u,v)=>[s.x+ax*u+ox*v,s.z+az*u+oz*v];
 const keep=requirePoint(layout.keep,'wrenfell'),sisters=requirePoint(layout.sisters,'ninesisters');
 const marsh=layout.marshTrack,ochre=layout.ochreTrack,river=layout.riverWestTrack;
 for(const [id,p]of[['marsh',marsh],['ochre',ochre],['riverwest',river]])if(!Array.isArray(p)||p.length<2||!p.every(point))throw Error('Actual cover track missing: '+id);
 const willow=requirePoint(layout.willowDoor,'willowmere door'),post=requirePoint(layout.ochrePost,'ochre post'),barn=requirePoint(layout.ochreBarn,'ochre barn');
 const mp=marsh.at(-1),op=ochre.at(-1),bridge=river[0];
 const ochreMid=[(post[0]+barn[0])*.5,(post[1]+barn[1])*.5];
 const runs=[
  prepare('chalk-viewing-approach',[chalk(-3,-105),chalk(5,-87),chalk(-6,-65),chalk(0,-s.depth*.5-3)],{half:14,left:14,right:21,cap:.27,bank:.94,seedSide:-1}),
  prepare('riverside-south',[[4,72],[1,98],[0,112]],{half:12,left:15,right:8,cap:.28,bank:.87}),
  prepare('riverside-north',[bridge,[0,138],[18,150],[47,171]],{half:11,left:9,right:16,cap:.31,bank:.93,seedSide:-1}),
  prepare('keep-approach',[[-36,-55],[-24,-42],[-14,-26],[-12,-9],[-9,8],[0,14],[14,15],[30,24],[52,35]].map(p=>offset(keep,...p)),{half:12,left:12,right:18,cap:.32,bank:1.0,seedSide:-1}),
  prepare('sisters-approach',[[42,40],[25,25],[13,14],[2,12],[-12,8],[-22,-2]].map(p=>offset(sisters,...p)),{half:13,left:12,right:18,cap:.30,bank:.97}),
  prepare('willowmere-dry-arrival',[...marsh.slice(-9),[mp[0]+(willow[0]-mp[0])*.45,mp[1]+(willow[1]-mp[1])*.45],willow],{half:8,left:8,right:13,cap:.39,bank:1.0,seedSide:-1}),
  prepare('ochre-arrival',[...ochre.slice(-11),[op[0]+(ochreMid[0]-op[0])*.48,op[1]+(ochreMid[1]-op[1])*.48],ochreMid,post],{half:15,left:16,right:23,cap:.23,bank:.58,dry:1,seedSide:-1}),
  prepare('ochre-yard',[post,ochreMid,barn],{half:15,left:20,right:13,cap:.21,bank:.56,dry:1})
 ];
 for(const [i,r]of(layout.willowRoutes||[]).entries())runs.push(prepare('willowmere-dry-boardwalk-'+i,r.pts,{half:Math.max(2,r.width*.5+1.0),left:3.5,right:6,cap:.38,bank:.98}));
 return runs;
}

export function createRegionalCoverField({layout,terrainH,wetAt,chalkAt,preserveAt=()=>false,forestPoints=[]}){
 if(![terrainH,wetAt,chalkAt,preserveAt].every(f=>typeof f==='function'))throw Error('Actual final cover samplers required');
 const runs=regionalCoverRuns(layout),trees=new Map(),key=(x,z)=>Math.floor(x/4)+','+Math.floor(z/4);
 for(const t of forestPoints){if(!Number.isFinite(t.x+t.z))throw Error('Invalid final forest point');const k=key(t.x,t.z);if(!trees.has(k))trees.set(k,[]);trees.get(k).push({x:t.x,z:t.z,outer:1.8+.2*Math.min(2,Math.max(0,t.s??1))});}
 const protectedAt=(x,z)=>wetAt(x,z)||chalkAt(x,z)||preserveAt(x,z);
 function sample(run,x,z){
  if(!inside(run.bounds,x,z)||protectedAt(x,z))return ZERO;
  const f=frame(run,x,z),ends=ease(0,7,f.along)*(1-ease(run.length-7,run.length,f.along));if(ends===0)return ZERO;
  const half=run.half+Math.sin(f.along*.071+run.half)*1.2+Math.sin(f.along*.15)*.5,shoulder=f.side>0?run.left:run.right;
  const outer=half+shoulder*(.92+.08*Math.sin(f.along*.049)),weight=(1-ease(outer-3,outer+1,f.d))*ends;
  if(weight===0)return ZERO;
  const slope=Math.hypot((terrainH(x+.75,z)-terrainH(x-.75,z))/1.5,(terrainH(x,z+.75)-terrainH(x,z-.75))/1.5),grade=1-ease(.40,.69,slope);if(!Number.isFinite(slope))throw Error('Nonfinite regional cover ground');if(grade===0)return ZERO;
  const core=1-ease(half-1.5,half+2,f.d),bank=ease(half+1,half+4,f.d)*(1-ease(outer-4,outer,f.d));
  const patch=.5+.5*Math.sin(f.along*.067+x*.019)*Math.sin(f.along*.031-z*.017);
  return{weight:weight*grade,cut:core*.99,cap:run.cap+.075*patch+bank*(run.bank-run.cap),dry:run.dry,seed:run.dry?0:bank*(f.side===run.seedSide?.44:.08)*ease(.35,.85,patch)};
 }
 // Only new bounded grids are sampled per rendered row. No terrain/tree walk
 // is added to travelling grass updates, and no source row is changed.
 let gridBytes=0,activeVertices=0;const grids=[];
 for(const run of runs){const b=run.bounds,minX=Math.floor(b.minX/STEP)*STEP,minZ=Math.floor(b.minZ/STEP)*STEP,nx=Math.ceil((b.maxX-minX)/STEP)+1,nz=Math.ceil((b.maxZ-minZ)/STEP)+1,data=new Float32Array(nx*nz*5);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const x=minX+ix*STEP,z=minZ+iz*STEP,q=sample(run,x,z),i=(iz*nx+ix)*5;data.set([q.weight,q.cut,Number.isFinite(q.cap)?q.cap:0,q.dry,q.seed],i);if(q.weight>0)activeVertices++;}
  gridBytes+=data.byteLength;grids.push({run,minX,minZ,nx,nz,data});
 }
 function at(x,z){let relevant=false;for(const g of grids)if(inside(g.run.bounds,x,z)){relevant=true;break;}if(!relevant||protectedAt(x,z))return ZERO;let chosen=ZERO;
  for(const g of grids){if(!inside(g.run.bounds,x,z))continue;const xx=(x-g.minX)/STEP,zz=(z-g.minZ)/STEP,ix=Math.floor(xx),iz=Math.floor(zz);if(ix<0||iz<0||ix>=g.nx-1||iz>=g.nz-1)continue;const fx=ease(0,1,xx-ix),fz=ease(0,1,zz-iz),i=iz*g.nx+ix,ids=[i,i+1,i+g.nx,i+g.nx+1],ws=[(1-fx)*(1-fz),fx*(1-fz),(1-fx)*fz,fx*fz],v=[0,0,0,0,0];for(let k=0;k<4;k++)for(let c=0;c<5;c++)v[c]+=g.data[ids[k]*5+c]*ws[k];if(v[0]>chosen.weight)chosen={weight:v[0],cut:v[1],cap:v[2],dry:v[3],seed:v[4]};}
  if(chosen.weight<1e-7)return ZERO;
  const tx=Math.floor(x/4),tz=Math.floor(z/4);let skirt=1;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const t of trees.get((tx+dx)+','+(tz+dz))||[])skirt*=ease(.45,t.outer,Math.hypot(x-t.x,z-t.z));
  if(skirt<1e-7)return ZERO;return{...chosen,weight:chosen.weight*skirt,cap:Math.max(.18,chosen.cap)};
 }
 function applyGrazingPixels(data,size){if(!ArrayBuffer.isView(data)||!Number.isInteger(size)||size<1||data.length!==size*size*4)throw Error('Existing landcover mask required');let changed=0;const visited=new Set(),step=1000/size;
  for(const run of runs){if(run.dry)continue;const b=run.bounds,ix0=Math.max(0,Math.floor((b.minX+500)/step)),ix1=Math.min(size-1,Math.ceil((b.maxX+500)/step)),iz0=Math.max(0,Math.floor((b.minZ+500)/step)),iz1=Math.min(size-1,Math.ceil((b.maxZ+500)/step));for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){const id=iz*size+ix;if(visited.has(id))continue;visited.add(id);const q=at(-500+(ix+.5)*step,-500+(iz+.5)*step);if(q.weight===0||q.dry>0)continue;const i=id*4+2,next=Math.max(data[i],Math.round(q.weight*q.cut*255));if(next!==data[i]){data[i]=next;changed++;}}}
  return changed;
 }
 return Object.freeze({profile:REGIONAL_COVER_PROFILE,runs:runs.map(r=>Object.freeze({id:r.id,nodes:r.nodes,bounds:r.bounds,halfWidth:r.half,leftBank:r.left,rightBank:r.right,dry:r.dry})),stats:Object.freeze({runs:runs.length,step:STEP,gridBytes,activeVertices}),at,applyGrazingPixels});
}

export function composeRegionalCover(original,q){
 if(!q||q.weight===0)return original;
 const w=q.weight;return{...original,cut:Math.max(original.cut,q.cut*w),cap:Math.min(original.cap,q.cap/(w*w)),compositionWeight:Math.max(original.compositionWeight||0,w),regionalWeight:w,regionalDry:q.dry};
}

export function tintRegionalCover(color,q,offset=0){
 if(!q||q.weight===0)return false;
 const dry=q.dry*q.weight*.88,seed=q.seed*q.weight;if(dry===0&&seed===0)return false;
 const array=ArrayBuffer.isView(color),r=array?color[offset]:color.r,g=array?color[offset+1]:color.g,b=array?color[offset+2]:color.b;
 const luminance=.2126*r+.7152*g+.0722*b;
 const nr=(r+(luminance*1.24-r)*dry)*(1+seed*.35),ng=(g+(luminance*1.03-g)*dry)*(1+seed*.08),nb=(b+(luminance*.65-b)*dry)*(1-seed*.16);
 if(array){color[offset]=nr;color[offset+1]=ng;color[offset+2]=nb;}else{color.r=nr;color.g=ng;color.b=nb;}return dry>0||seed>0;
}
