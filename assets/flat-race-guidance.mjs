// Advisory navigation only: the course engine still owns gates, timing and credit.
// The bounded corridor search queries registered solid parts as well as legacy
// circles/rails. A failed search publishes no route rather than an unsafe ray.
const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const copy=p=>Object.freeze({x:p.x,z:p.z});
const PAD=.75, SAMPLE=.4, REACH=.8, RECHECK=300;
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
function segmentsDistance(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
 return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));
}
export function flatRaceEligible(c){
 return !!(c&&!c.done&&c.race===true&&c.ev?.race===true&&typeof c.ev.id==='string'&&c.ev.id.length>0&&c.ce?.kind==='race'&&
  !c.ev.rush&&!c.rush&&!c.ev.xc&&!c.xc&&!c.dressage&&!c.ev.dressage&&!c.ev.gauntlet&&!c.ev.kind&&
  !c.ev.line&&!c.ce.line&&(!c.ev.disc||c.ev.disc==='race')&&Array.isArray(c.jumps)&&c.jumps.length&&
  Number.isInteger(c.idx)&&c.idx>=0&&c.idx<c.jumps.length&&Array.from(c.jumps).every(j=>j?.kind==='gate'&&point(j)));
}
function clearance(world={},limit=6000){
 let calls=0,exhausted=false;const samples=new Map();
 const circles=world.colliders??[],walls=world.walls??[];
 const valid=Array.isArray(circles)&&Array.isArray(walls)&&(!world.solidWorld||typeof world.solidWorld.resolve==='function');
 function sample(p){
  if(!valid||!point(p)||Math.hypot(p.x,p.z)>454||(world.loonLake?world.loonLake.containsWater(p.x,p.z,.5):Math.hypot(p.x-20,p.z-16)<5))return null;
  const key=p.x+','+p.z;if(samples.has(key))return samples.get(key);
  if(++calls>limit){exhausted=true;return null;}
  let height=null;
  try{
   const y=world.groundH?.(p.x,p.z)??0;
   if(!Number.isFinite(y))return null;
   if(world.terrainH&&world.riverZ&&world.riverLevel){
    const terrain=world.terrainH(p.x,p.z),river=world.riverZ(p.x),water=world.riverLevel(p.x);
    if(![terrain,river,water].every(Number.isFinite)||Math.abs(p.z-river)<9&&water-terrain>.3&&y<=terrain+.3)return null;
   }
   if(world.solidWorld){
    const resolved={x:p.x,z:p.z};
    const contacts=world.solidWorld.resolve(resolved,{bottom:y+.38,top:y+2.65,radius:PAD});
    if(contacts>0||!point(resolved)||distance(resolved,p)>.001){samples.set(key,null);return null;}
   }
   height=y;
  }catch{return null;}
  samples.set(key,height);return height;
 }
 function clear(a,b){
  if(!valid||!point(a)||!point(b)||distance(a,b)>320)return false;
  for(const c of circles){
   if(c?.precise&&world.solidWorld)continue;
   if(point(c)&&Number.isFinite(c.r)&&c.r>=0&&segmentDistance(c,a,b)<c.r+PAD)return false;
  }
  for(const w of walls)if([w?.x1,w?.z1,w?.x2,w?.z2].every(Number.isFinite)&&
   segmentsDistance(a,b,{x:w.x1,z:w.z1},{x:w.x2,z:w.z2})<.85)return false;
  const count=Math.max(1,Math.ceil(distance(a,b)/SAMPLE));let previous=null;
  for(let i=0;i<=count;i++){
   const t=i/count,height=sample({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
   if(height===null||previous!==null&&Math.abs(height-previous)>.5)return false;previous=height;
  }
  return true;
 }
 return {clear,get exhausted(){return exhausted;},get calls(){return calls;}};
}
export function flatRaceSegmentClear(a,b,{world={}}={}){return clearance(world).clear(a,b);}
export function planFlatRaceRoute({from,to,world={}}={}){
 if(!point(from)||!point(to))return null;
 const length=distance(from,to);if(length>320)return null;
 const checks=clearance(world);
 if(checks.clear(from,to))return Object.freeze([copy(to)]);
 if(checks.exhausted||length<.01||!checks.clear(from,from)||!checks.clear(to,to))return null;
 // A local, line-oriented corridor contains at most800 lazy grid nodes. It
 // never explores the whole map or repeatedly invokes navigation per frame.
 const STEP=3,SIDE=12,END=6,MAX_NODES=800,MAX_EXPANDED=350;
 const dx=(to.x-from.x)/length,dz=(to.z-from.z)/length,nx=Math.ceil((length+END*2)/STEP)+1,nz=SIDE*2/STEP+1;
 if(nx*nz>MAX_NODES)return null;
 const nodes=Array.from({length:nx*nz},(_,id)=>{const along=Math.floor(id/nz)*STEP-END,side=(id%nz)*STEP-SIDE;return {id,x:from.x+dx*along-dz*side,z:from.z+dz*along+dx*side,g:Infinity,parent:-1,closed:false};});
 const edges=new Map(),queue=[];
 function safe(a,b){const key=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);if(!edges.has(key))edges.set(key,checks.clear(a,b));return edges.get(key);}
 function push(n,g,parent){if(g>=n.g)return;n.g=g;n.parent=parent;const e={id:n.id,g,f:g+distance(n,to)};let i=queue.length;queue.push(e);while(i){const p=(i-1)>>1;if(queue[p].f<=e.f)break;queue[i]=queue[p];i=p;}queue[i]=e;}
 function pop(){const first=queue[0],last=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let c=i*2+1;if(c+1<queue.length&&queue[c+1].f<queue[c].f)c++;if(queue[c].f>=last.f)break;queue[i]=queue[c];i=c;}queue[i]=last;}return first;}
 for(const n of nodes){const d=distance(from,n);if(d<=STEP*1.5&&checks.clear(from,n))push(n,d,-1);if(checks.exhausted)return null;}
 let best=null,expanded=0;
 while(queue.length&&!checks.exhausted){
  const e=pop(),n=nodes[e.id];if(n.closed||n.g!==e.g)continue;
  if(best&&e.f>=best.cost)break;
  if(++expanded>MAX_EXPANDED)return null;n.closed=true;
  const remaining=distance(n,to);
  if(remaining<=STEP*2&&(!best||n.g+remaining<best.cost)&&checks.clear(n,to))best={id:n.id,cost:n.g+remaining};
  const ix=Math.floor(n.id/nz),iz=n.id%nz;
  for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
   if(!ox&&!oz)continue;const x=ix+ox,z=iz+oz;if(x<0||z<0||x>=nx||z>=nz)continue;
   const next=nodes[x*nz+z];if(!next.closed&&safe(n,next))push(next,n.g+distance(n,next),n.id);
  }
 }
 if(!best||checks.exhausted)return null;
 const path=[to];for(let id=best.id;id!==-1;id=nodes[id].parent)path.unshift(nodes[id]);
 // Shortcut only through independently clear segments. The returned route is
 // complete, ends at the real gate, and is never a partial budget-limited path.
 const smooth=[];let at=from,index=0;
 while(index<path.length){let far=index;for(let j=path.length-1;j>index;j--)if(checks.clear(at,path[j])){far=j;break;}
  if(checks.exhausted||!checks.clear(at,path[far]))return null;
  if(distance(at,path[far])>.001)smooth.push(copy(path[far]));at=path[far];index=far+1;
 }
 return checks.exhausted||!smooth.length?null:Object.freeze(smooth);
}
export function createFlatRaceGuidance({world={}}={}){
 let owner=null,gate=null,gateX=0,gateZ=0,index=-1,lap=0,refs=[],path=null,cursor=0,state=null,revision=0;
 let checked=-Infinity,planned=-Infinity,seen=null,seenAt=0;
 function reset(){owner=gate=null;path=state=null;cursor=0;checked=planned=-Infinity;seen=null;revision++;}
 function publish(){
  const remaining=path?path.slice(cursor):[],target=remaining[0]||null,phase=target?(remaining.length>1?'detour':'direct'):'blocked';
  if(state&&state.phase===phase&&state.target===target&&state.gateIndex===index&&state.waypoints.length===remaining.length)return state;
  state=Object.freeze({phase,target,gate:copy(gate),gateIndex:index,waypoints:Object.freeze(remaining),revision:++revision});return state;
 }
 function update(c,player,now=0){
  if(!flatRaceEligible(c)||!point(player?.pos)||!Number.isFinite(now)||player.flying||player.onFoot){if(owner)reset();return null;}
  const p=player.pos,j=c.jumps[c.idx],nextRefs=[world.colliders,world.walls,world.solidWorld,world.groundH];
  const changed=owner!==c||gate!==j||index!==c.idx||lap!==(c.ce.lap||1)||j.x!==gateX||j.z!==gateZ||nextRefs.some((r,i)=>r!==refs[i])||now<seenAt;
  const relocated=seen&&distance(p,seen)>Math.max(6,Math.abs(player.speed||0)*Math.max(0,now-seenAt)/1000+2);
  seen=copy(p);seenAt=now;
  if(changed||relocated){owner=c;gate=j;gateX=j.x;gateZ=j.z;index=c.idx;lap=c.ce.lap||1;refs=nextRefs;path=null;cursor=0;state=null;checked=planned=-Infinity;revision++;}
  let advanced=false;
  while(path&&cursor<path.length-1&&distance(p,path[cursor])<REACH){cursor++;advanced=true;}
  const due=changed||relocated||advanced||now-checked>=RECHECK;
  if(due){
   checked=now;
   if(path){const checks=clearance(world);let from=p;
    for(let i=cursor;i<path.length;i++){if(!checks.clear(from,path[i])){path=null;cursor=0;break;}from=path[i];}
   }
   if(!path&&(changed||relocated||advanced||now-planned>=RECHECK)){planned=now;path=planFlatRaceRoute({from:p,to:j,world});cursor=0;}
  }
  return publish();
 }
 return {update,reset,snapshot:()=>state};
}
