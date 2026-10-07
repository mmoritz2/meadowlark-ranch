// Repair only blocked stretches of an existing road. Circles are conservative
// footprints; isAllowed must also test terrain, bank and any precise solids.
// Keep the returned polyline intact, or revalidate it after further smoothing.
const EPS=1e-8;
const clock=()=>globalThis.performance?.now?.()??Date.now();
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const isPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
function configuration(options={}){
 const {colliders=[],clearance=3.4,isAllowed=()=>true,gridStep=1,sampleStep=.25,maxDetour=32,maxExpanded=30000,maxSegmentLength=2.6}=options;
 if(![clearance,gridStep,sampleStep,maxDetour,maxExpanded,maxSegmentLength].every(Number.isFinite)||clearance<0||gridStep<=0||sampleStep<=0||maxDetour<0||maxExpanded<1||maxSegmentLength<=0||typeof isAllowed!=='function')throw new TypeError('Invalid route clearance options');
 const counters={segmentTests:0,sampledPoints:0};
 const circles=colliders.filter(c=>c&&!c.decor&&Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.r)&&c.r>0).map(c=>({x:c.x,z:c.z,r:c.r+clearance}));
 const siteAllowed=(x,z)=>{counters.sampledPoints++;return !!isAllowed(x,z)};
 const allowed=p=>circles.every(c=>Math.hypot(p[0]-c.x,p[1]-c.z)+EPS>=c.r)&&siteAllowed(p[0],p[1]);
 const segment=(a,b)=>{
  counters.segmentTests++;
  const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
  for(const c of circles){
   const t=length2?Math.max(0,Math.min(1,((c.x-a[0])*dx+(c.z-a[1])*dz)/length2)):0;
   if(Math.hypot(a[0]+t*dx-c.x,a[1]+t*dz-c.z)+EPS<c.r)return false;
  }
  // Check constraints across each segment, including both endpoints. The
  // caller should include a safety margin for features below sampleStep.
  const count=Math.max(1,Math.ceil(Math.sqrt(length2)/sampleStep));
  for(let i=0;i<=count;i++)if(!siteAllowed(a[0]+dx*i/count,a[1]+dz*i/count))return false;
  return true;
 };
 return{allowed,segment,gridStep,maxDetour,maxExpanded,maxSegmentLength,counters};
}
export function routeSegmentClear(a,b,options={}){if(!isPoint(a)||!isPoint(b))throw new TypeError('Segments need finite [x,z] endpoints');return configuration(options).segment(a,b)}
class Heap{
 constructor(){this.items=[];this.serial=0}
 before(a,b){return a.f<b.f||a.f===b.f&&(a.h<b.h||a.h===b.h&&(a.z<b.z||a.z===b.z&&(a.x<b.x||a.x===b.x&&a.serial<b.serial)))}
 push(value){const a=this.items;value.serial=this.serial++;let i=a.length;a.push(value);while(i){const parent=(i-1)>>1;if(!this.before(value,a[parent]))break;a[i]=a[parent];i=parent;}a[i]=value}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.before(a[child+1],a[child]))child++;if(!this.before(a[child],last))break;a[i]=a[child];i=child;}a[i]=last;}return first}
 get length(){return this.items.length}
}
function detour(a,b,span,cfg){
 const {gridStep:step,maxDetour:pad,maxExpanded,allowed,segment}=cfg;
 const minX=Math.floor((Math.min(...span.map(p=>p[0]))-pad)/step),maxX=Math.ceil((Math.max(...span.map(p=>p[0]))+pad)/step);
 const minZ=Math.floor((Math.min(...span.map(p=>p[1]))-pad)/step),maxZ=Math.ceil((Math.max(...span.map(p=>p[1]))+pad)/step);
 const key=(x,z)=>x+','+z,open=new Heap(),cost=new Map([['start',0]]),previous=new Map(),positions=new Map([['start',a],['goal',b]]),closed=new Set(),valid=new Map();
 const offer=(id,p,g,parent)=>{if(g+EPS>=(cost.get(id)??Infinity))return;cost.set(id,g);previous.set(id,parent);positions.set(id,p);const h=distance(p,b);open.push({id,p,g,h,f:g+h,x:p[0],z:p[1]})};
 const gridAllowed=(x,z)=>{if(x<minX||x>maxX||z<minZ||z>maxZ)return false;const id=key(x,z);if(!valid.has(id))valid.set(id,allowed([x*step,z*step]));return valid.get(id)};
 open.push({id:'start',p:a,g:0,h:distance(a,b),f:distance(a,b),x:a[0],z:a[1]});let expanded=0;
 while(open.length){
  const node=open.pop();if(closed.has(node.id)||node.g!==cost.get(node.id))continue;
  if(node.id==='goal'){
   const path=[b];let id='goal';while(id!=='start'){id=previous.get(id);path.push(positions.get(id));}path.reverse();
   const simple=[a];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!segment(path[i],path[j]))j--;simple.push(path[j]);i=j;}
   // Linear samples stay on the verified detour. Curve interpolation could
   // cut its corners back through the mesas, so it is deliberately not used.
   const sampled=[a];for(let k=1;k<simple.length;k++){const from=simple[k-1],to=simple[k],n=Math.max(1,Math.ceil(distance(from,to)/cfg.maxSegmentLength));for(let j=1;j<=n;j++)sampled.push(j===n?to:[from[0]+(to[0]-from[0])*j/n,from[1]+(to[1]-from[1])*j/n]);}
   if(sampled.slice(1).some((to,k)=>!segment(sampled[k],to)))return{reason:'constraint-sampling',expanded};
   return{points:sampled,expanded};
  }
  if(expanded>=maxExpanded)return{reason:'search-limit',expanded};expanded++;closed.add(node.id);
  if(distance(node.p,b)<=step*2.5&&segment(node.p,b))offer('goal',b,node.g+distance(node.p,b),node.id);
  const ix=Math.round(node.p[0]/step),iz=Math.round(node.p[1]/step);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   if(node.id!=='start'&&dx===0&&dz===0)continue;const x=ix+dx,z=iz+dz,id=key(x,z),p=[x*step,z*step];
   if(closed.has(id)||!gridAllowed(x,z)||!segment(node.p,p))continue;offer(id,p,node.g+distance(node.p,p),node.id);
  }
 }
 return{reason:'no-clear-detour',expanded};
}
export function repairRouteClearance(points,options={}){
 if(!Array.isArray(points)||points.length<2||points.some(p=>!isPoint(p)))throw new TypeError('A route needs at least two finite [x,z] points');
 const started=clock(),cfg=configuration(options),repairedSpans=[],failures=[];let expanded=0;
 const finish=(points,changed)=>({points,changed,repairedSpans,failures,stats:{expanded,...cfg.counters,elapsedMs:Math.max(0,clock()-started)}});
 for(const index of[0,points.length-1])if(!cfg.allowed(points[index]))failures.push({startIndex:index,endIndex:index,reason:'blocked-endpoint'});
 if(failures.length)return finish(null,false);
 const blocked=points.slice(1).map((b,i)=>!cfg.segment(points[i],b)),result=[points[0].slice()];
 for(let i=0;i<points.length-1;){
  if(!blocked[i]){result.push(points[++i].slice());continue;}
  let end=i+1;while(end<points.length-1&&(!cfg.allowed(points[end])||blocked[end]))end++;
  const repair=detour(points[i],points[end],points.slice(i,end+1),cfg);expanded+=repair.expanded;
  if(!repair.points){failures.push({startIndex:i,endIndex:end,reason:repair.reason,expanded:repair.expanded});return finish(null,false);}
  result.push(...repair.points.slice(1).map(p=>p.slice()));repairedSpans.push({startIndex:i,endIndex:end,expanded:repair.expanded,points:repair.points.map(p=>p.slice())});i=end;
 }
 return finish(result,repairedSpans.length>0);
}
