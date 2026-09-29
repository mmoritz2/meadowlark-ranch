/* Feature package 'course-clear' — a clear track to ride on every event course.

   The owner rode the events and said it plainly: you cannot see where you are going, and there is
   stuff in the way. Both were true. The race and cross-country routes were drawn as straight lines
   between gates across a world planted afterwards, so the River Run started in a birch thicket with
   a stump in front of the camera, knee-high grass hid the ground and the next gate, seventy solid
   things (trees, posts, props, runs of Barleyfold's stone wall, the corner of a building) stood on
   or beside the riding line, and two desert mesas sat across the Coyote Derby.

   So every course gets a track, the way a real one is kept:
     - its riding line is mown: grass, flowers, scrub, reeds and pebbles go from a strip either side
       of it, and the streamed grass never grows back there (ranch3d.html asks window.__onCourse);
     - anything with a trunk or a body (trees, bushes, stumps, boulders, posts, props) is cleared
       from a wider strip, its collider with it, so nothing stands in the way or in front of the
       camera;
     - where a wall crosses a route, a gap is opened in it;
     - where a mesa or a building sits across a route (too big to clear), the route bends round it:
       a gate that stood inside one is moved out, and a leg that ran through one is given a turn.
   Jump, dressage and show arenas get the same clearing inside and round the ring. Everything is
   done once, when the game starts, after every package has laid out its routes.

   Owned by this package: this file, and the two window.__onCourse checks in ranch3d.html's grass
   and clutter placement. Nothing runs at import time. */
export const id='course-clear';
export function install(G){
 const THREE=G.THREE, T=G.tables, W=G.world;
 if(!THREE||!T||!W||!G.scene)return;
 const LOW=3.4, TALL=6.2, WALL=3.5, BIG=3.5;       // mown strip, cleared strip, a collider this small is cleared, bigger ones are routed round
 const stats={segments:0,instancesHidden:0,collidersCleared:0,objectsHidden:0,rerouted:[],arenas:0};

 /* ---------------------------------------------------------------- where the courses are ---- */
 let SEG=[], ARENA=[], grid=new Map();
 const CELL=24, key=(i,j)=>i*100003+j;
 function build(){
  SEG=[]; ARENA=[]; grid=new Map();
  for(const k in (T.RACE_ROUTES||{})){const pl=T.RACE_ROUTES[k];if(!Array.isArray(pl))continue;
   for(let i=0;i<pl.length-1;i++){const a=pl[i],b=pl[i+1];if(!a||!b)continue;SEG.push({ax:a[0],az:a[1],bx:b[0],bz:b[1],route:k});}
   /* the start box: the riders line up a few lengths back from the first gate and the camera sits behind them, so the
      track is mown back through there too */
   if(pl.length>1&&pl[0]&&pl[1]){const a=pl[0],b=pl[1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;SEG.push({ax:a[0]-dx/L*14,az:a[1]-dz/L*14,bx:a[0],bz:a[1],route:k,runIn:true});}}
  const seen=new Set();
  for(const ev of (T.EVENTS3||[])){if(!ev||ev.race||ev.xc||ev.gauntlet)continue;const at=ev.at||[2,1],k=Math.round(at[0])+','+Math.round(at[1]);if(seen.has(k))continue;seen.add(k);ARENA.push({x:at[0],z:at[1],A:21,B:16.5});}
  for(const s of SEG){const pad=TALL+2;const i0=Math.floor((Math.min(s.ax,s.bx)-pad)/CELL),i1=Math.floor((Math.max(s.ax,s.bx)+pad)/CELL),j0=Math.floor((Math.min(s.az,s.bz)-pad)/CELL),j1=Math.floor((Math.max(s.az,s.bz)+pad)/CELL);
   for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const q=key(i,j);let a=grid.get(q);if(!a)grid.set(q,a=[]);a.push(s);}}
  stats.segments=SEG.length; stats.arenas=ARENA.length;
 }
 function segDist(s,x,z){const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1e-6;let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;return Math.hypot(s.ax+dx*t-x,s.az+dz*t-z);}
 /* distance from a point to the nearest course: a riding line, or the inside of an arena ring */
 function courseDist(x,z){
  let best=1e9; const a=grid.get(key(Math.floor(x/CELL),Math.floor(z/CELL)));
  if(a)for(const s of a){const d=segDist(s,x,z);if(d<best)best=d;}
  for(const r of ARENA){const u=(x-r.x)/r.A,v=(z-r.z)/r.B,e=Math.hypot(u,v);if(e<1)return 0;const d=(e-1)*Math.min(r.A,r.B);if(d<best)best=d;}
  return best;
 }
 build();
 window.__onCourse=(x,z,w)=>courseDist(x,z)<w;

 /* ---------------------------------------------------------------- what stands on a course ----
    A collider on a riding line is cleared only when what stands there can be named: a tree or bush
    (an instanced plant with a trunk, or a mesh called pine, birch, stump, boulder...), a run of wall,
    or a rock that carries no treasure. Anything else there (a barn, a fence, a house, a stand) keeps
    its collider, and the route is bent round it instead. */
 const VEG=/pine|tree|birch|oak|willow|stump|log|bush|shrub|hedge|boulder|geology|rock|stone|scrub|juniper|cactus|palm|reed|flora|copse|trunk|canopy|foliage|leaf/i;
 const KEEP_NAME=/course|guide|chevron|marker|gate|jump|fence|rail|arena|stand|sign|horse|rider|bridle|saddle|npc|folk|house|barn|cottage|stable|build|bridge|treasure|shoe|glint|door|shop|store|inn|lodge|cabin|farm|mill|well|tent/i;
 const nameChain=o=>{let s='';for(let e=o;e&&e!==G.scene;e=e.parent)s+=(e.name||'')+'|';return s;};
 const onCharacter=o=>{for(let e=o;e&&e!==G.scene;e=e.parent){if(e.isBone||e.isSkinnedMesh)return true;if(/rider|hair|horse|mane|tail|pet|foal/i.test(e.name||''))return true;}return false;};
 const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(), _z=new THREE.Matrix4().makeScale(0,0,0);
 const instances=[];   // [{o,i,x,z,R}] for everything instanced, gathered once
 function gatherInstances(){
  instances.length=0; G.scene.updateMatrixWorld(true);
  G.scene.traverse(o=>{
   if(!o.isInstancedMesh||!o.count||!o.geometry||!o.visible)return;
   const nm=nameChain(o); if(/course|guide|chevron|marker|rain|firefl|mist|mote|drop|shoe|glint|cloud|bird|lil/i.test(nm)||onCharacter(o))return;
   if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
   const gr=(o.geometry.boundingSphere&&o.geometry.boundingSphere.radius)||0.5, ws=o.matrixWorld.getMaxScaleOnAxis()||1;
   for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,_m); _m.decompose(_p,_q,_s); const sc=Math.max(_s.x,_s.y,_s.z); if(sc<1e-4)continue;
    _p.applyMatrix4(o.matrixWorld); instances.push({o,i,x:_p.x,z:_p.z,R:gr*sc*ws});
   }
  });
 }
 const dirty=new Set();
 const hideInst=it=>{it.o.setMatrixAt(it.i,_z);dirty.add(it.o);it.R=-1;stats.instancesHidden++;};
 const lineDist=(x,z)=>{let best=1e9;const a=grid.get(key(Math.floor(x/CELL),Math.floor(z/CELL)));if(a)for(const sg of a){const d=segDist(sg,x,z);if(d<best)best=d;}return best;};
 let treasureSpots=[]; try{treasureSpots=(G.treasures&&G.treasures.spots&&G.treasures.spots())||[];}catch(e){}
 const box=new THREE.Box3(), ctr=new THREE.Vector3(), size=new THREE.Vector3(), wp=new THREE.Vector3();
 function objectsNear(x,z,rad){
  const out=[];
  const visit=(o,depth)=>{
   if(depth>4||!o.visible||o.isInstancedMesh||o.isSprite||o.isLight||o.isCamera||o.isSkinnedMesh||o.isBone)return;
   if(depth>0&&(o.isMesh||o.isGroup)){
    o.getWorldPosition(wp);
    if(Math.hypot(wp.x-x,wp.z-z)<rad+14){
     box.setFromObject(o); if(!box.isEmpty()){box.getCenter(ctr);box.getSize(size);
      if(Math.hypot(ctr.x-x,ctr.z-z)<Math.max(0.9,rad)&&size.y>0.3&&Math.max(size.x,size.z)<Math.max(9,rad*5))out.push({o,w:Math.max(size.x,size.z),h:size.y,nm:nameChain(o)});}
    }
   }
   if(o.children)for(const ch of o.children)visit(ch,depth+1);
  };
  visit(G.scene,0);
  return out;
 }
 const blockers=[];   // what stays and is ridden round
 function clearColliders(){
  for(let i=W.colliders.length-1;i>=0;i--){
   const c=W.colliders[i]; if(!c||c.keep||c.r>=40)continue;
   const d=lineDist(c.x,c.z); if(d>=c.r+2.4)continue;
   if(c.r>=BIG){continue;}
   /* a plant with a trunk, instanced */
   const plants=instances.filter(it=>it.R>=0&&Math.hypot(it.x-c.x,it.z-c.z)<Math.max(0.9,c.r+0.4));
   if(plants.length){plants.forEach(hideInst);W.colliders.splice(i,1);stats.collidersCleared++;continue;}
   /* a rock: cleared unless a golden horseshoe sits on it (then it is ridden round) */
   if(c.climb){
    if(treasureSpots.some(t=>Math.hypot(t.x-c.x,t.z-c.z)<c.r+1)){if(d<c.r+0.8)blockers.push(c);continue;}
    const objs=objectsNear(c.x,c.z,c.r); const rock=objs.filter(k=>!KEEP_NAME.test(k.nm));
    rock.forEach(k=>{k.o.visible=false;stats.objectsHidden++;});
    if(W.climbables){for(let j=W.climbables.length-1;j>=0;j--){const cl=W.climbables[j];if(cl&&Math.hypot(cl.x-c.x,cl.z-c.z)<0.5)W.climbables.splice(j,1);}}
    W.colliders.splice(i,1); stats.collidersCleared++; continue;
   }
   /* a named plant or a run of wall, as a plain mesh */
   const objs=objectsNear(c.x,c.z,c.r);
   const veg=objs.filter(k=>VEG.test(k.nm)&&!KEEP_NAME.test(k.nm));
   const wall=Math.abs(c.r-3)<0.15?objs.filter(k=>!KEEP_NAME.test(k.nm)&&k.w>3&&k.w<8&&k.h<3.2):[];
   if(veg.length||wall.length){for(const k of veg.concat(wall)){k.o.visible=false;stats.objectsHidden++;}W.colliders.splice(i,1);stats.collidersCleared++;continue;}
   /* something small and nameless (a tree, a post, a prop: none of the game's buildings is this small) is cleared too;
      only something built is left standing. This keeps the routes the same on every load: the small things are
      planted at random, the buildings are not, and only the buildings bend a route. */
   if(c.r<1.7&&!objs.some(k=>KEEP_NAME.test(k.nm))){for(const k of objs){k.o.visible=false;stats.objectsHidden++;}W.colliders.splice(i,1);stats.collidersCleared++;continue;}
   /* something built: it stays, and the line goes round it if it is actually in the way */
   if(d<c.r+0.9){blockers.push(c);(stats.blockers=stats.blockers||[]).push({x:+c.x.toFixed(1),z:+c.z.toFixed(1),r:+c.r.toFixed(2),names:objs.map(k=>k.nm.slice(0,60)).slice(0,4)});}
  }
 }

 /* ---------------------------------------------------------------- routes round what stays ---- */
 /* Only the great fixed landforms (the canyon's mesas, seeded and tagged landform where they are placed) bend a route.
    Buildings are placed by a search for clear ground that depends on what happened to be planted nearby, so a building can stand a metre or two differently from one load to the next; a
    route bent round one would differ between players, and so would every time on its leaderboard. A building beside a
    line stays a thing to ride round. */
 function reroute(){
  const big=W.colliders.filter(c=>c&&c.landform);
  for(const k in T.RACE_ROUTES){
   const pl=T.RACE_ROUTES[k]; if(!Array.isArray(pl)||pl.length<2)continue;
   let changed=false;
   /* a gate standing inside something is moved out to clear ground */
   for(const p of pl){for(const c of big){const dd=Math.hypot(p[0]-c.x,p[1]-c.z),need=c.r+(c.r>=BIG?5:2.5);if(dd<need){const ux=dd>0.01?(p[0]-c.x)/dd:1,uz=dd>0.01?(p[1]-c.z)/dd:0;p[0]=+(c.x+ux*need).toFixed(1);p[1]=+(c.z+uz*need).toFixed(1);changed=true;}}}
   /* a leg that runs through something gets a turn beside it */
   for(let i=0;i<pl.length-1&&pl.length<40;i++){
    const a=pl[i],b=pl[i+1];
    for(const c of big){
     const sg={ax:a[0],az:a[1],bx:b[0],bz:b[1]}, dd=segDist(sg,c.x,c.z), clr=c.r>=BIG?2.5:0.9;
     if(dd>=c.r+clr)continue;
     const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L;
     const tt=((c.x-a[0])*dx+(c.z-a[1])*dz)/(L*L); if(tt<=0.02||tt>=0.98)continue;
     const px=a[0]+dx*tt,pz=a[1]+dz*tt, side=((c.x-px)*nx+(c.z-pz)*nz)>0?-1:1, off=c.r+(c.r>=BIG?6.5:3);
     const q=[+(c.x+nx*side*off).toFixed(1),+(c.z+nz*side*off).toFixed(1)];
     if(Math.hypot(q[0]-a[0],q[1]-a[1])<2||Math.hypot(q[0]-b[0],q[1]-b[1])<2)continue;
     if(big.some(o=>o!==c&&Math.hypot(q[0]-o.x,q[1]-o.z)<o.r+2))continue;   // no clear side: leave it rather than make it worse
     pl.splice(i+1,0,q); changed=true; break;
    }
   }
   if(changed&&!stats.rerouted.includes(k))stats.rerouted.push(k);
  }
 }

 /* ---------------------------------------------------------------- the mown strip -------------- */
 function mow(){
  for(const it of instances){
   if(it.R<0)continue;
   const d=courseDist(it.x,it.z);
   if(d<(it.R>=0.9?TALL+Math.min(it.R,4)*0.5:LOW))hideInst(it);
  }
  for(const o of dirty)o.instanceMatrix.needsUpdate=true; dirty.clear();
 }
 function clear(routes){
  const t0=performance.now();
  try{gatherInstances();}catch(e){console.error('course-clear gather',e);}
  try{clearColliders();}catch(e){console.error('course-clear colliders',e);}
  /* routes are only bent at install: by boot other packages have measured them (events2-ladder sets each race's time allowed
     from its length), and a route that changed after that would advertise the wrong clock */
  try{if(routes&&W.colliders.some(c=>c&&c.landform)){reroute();build();}}catch(e){console.error('course-clear reroute',e);}
  try{mow();}catch(e){console.error('course-clear mow',e);}
  stats.ms=Math.round(performance.now()-t0);
 }
 clear(true);
 /* routes added late, and anything planted after install, get the same treatment when the game boots */
 let routesKey=JSON.stringify(Object.keys(T.RACE_ROUTES||{}));
 G.on('boot',()=>setTimeout(()=>{const k=JSON.stringify(Object.keys(T.RACE_ROUTES||{}));if(k!==routesKey){routesKey=k;build();}blockers.length=0;clear(false);},400));

 G.on('state',o=>{o.courseClear={segments:stats.segments,arenas:stats.arenas,instancesHidden:stats.instancesHidden,collidersCleared:stats.collidersCleared,objectsHidden:stats.objectsHidden,rerouted:stats.rerouted.slice(),ms:stats.ms,blockers:stats.blockers||[]};});
 G.courseClear={courseDist,stats,rebuild:()=>{build();clear();}};
}
