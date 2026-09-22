/* Feature package 'world-outcrops' — rock in the meadows.

   Laid beside the riding game this is modelled on, its countryside is broken up by rock: warm
   grey-beige sandstone standing out of the grass in heaps and shoulders, big weathered blocks
   with smaller ones tumbled round their feet, right beside the tracks you ride. Ours had rock
   only where the geology was the point of the place — the mesas and spires out in Coyote Canyon,
   the cliff behind the falls — and the meadows round the ranch were grass to the horizon. A
   landscape with nothing standing in it has no near, middle and far; an outcrop at thirty metres
   is what makes the hills behind it read as distant.

   Each outcrop is one big anchor block with three to six smaller ones round it — some half sunk,
   one or two resting on its shoulder — built from the valley's own geology.makeBoulder, so it is
   the same stone as the canyon, and merged so that a whole outcrop is a single draw call. They
   are warmer and lighter than the canyon's rock, because a meadow outcrop is sun-bleached
   sandstone and not wet limestone.

   WHERE. Only in meadow, and never anywhere a rider needs to be: not on or near a road, a race
   route, the river, Sparrow Creek or the lake; not inside the ranch, a town or any of the four
   quarters, which have geology of their own; not near a building, a tree, a person or an event
   venue — the start line is placed and checked for clear ground at every venue, and an outcrop
   is a collider. Each outcrop claims a collider for its anchor, so a horse goes round it.
   Seeded, so the set is the same shape every load, apart from what the valley's own re-scattered
   trees happen to push aside.

   Nothing runs at import time. */
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const id='world-outcrops';
export function install(G){
 const THREE=G.THREE, W=G.world, T=G.tables||{};
 if(!THREE||!W||!W.geology||!G.scene)return;
 const geo=W.geology;

 /* ---------------------------------------------------------------- the stone ------------ */
 const mat=geo.material.clone();
 mat.name='Outcrop | sun-bleached sandstone';
 mat.color.setRGB(1.09,1.05,0.98);                // over the canyon's grey: a touch lighter and warmer — more and it reads as straw
 mat.envMapIntensity=0.55;

 /* ---------------------------------------------------------------- where ---------------- */
 let seed=20260922;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const rr=(a,b)=>a+rnd()*(b-a);
 const cols=W.colliders||[], trees=W.forestPoints||[], walls=W.walls||[];
 const npcs=(W.npcList||[]).map(q=>q.g&&q.g.position).filter(Boolean);
 /* Everything a rider can walk up to and press E on — chests, forage, collectibles, doors, signs —
    and everything on the map. Those were placed before this package and are not colliders, so
    nothing else would stop a boulder being set down on top of a shell or a chest and making it
    unreachable: the same two-packages-one-spot bug this game has had six times. */
 const spots=[];
 try{ for(const t of (W.things||[])) if(t&&t.x!=null) spots.push({x:t.x,z:t.z,r:(t.reach||2)+3}); }catch(e){}
 try{ for(const m of (W.mapMarkers||[])) if(m&&m.x!=null) spots.push({x:m.x,z:m.z,r:6}); }catch(e){}
 try{ for(const k in (T.COLL_SETS||{})) for(const q of (T.COLL_SETS[k].pts||[])) spots.push({x:q[0],z:q[1],r:6}); }catch(e){}
 try{ for(const f of (W.FORAGE_SPOTS||[])) if(f&&f.x!=null) spots.push({x:f.x,z:f.z,r:4}); }catch(e){}
 const venues=[];
 try{ for(const e of (T.EVENTS3||[])) if(e.at) venues.push({x:e.at[0],z:e.at[1]}); }catch(e){}
 try{ for(const r of (T.REGIONS||[])) if(r.venue) venues.push({x:r.venue.x,z:r.venue.z}); }catch(e){}
 const routes=[];
 try{ for(const k in (T.RACE_ROUTES||{})){ const R=T.RACE_ROUTES[k]; for(let i=0;i<R.length;i++)routes.push([R[i],R[(i+1)%R.length]]); } }catch(e){}
 const segD=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1;let t=((x-a[0])*dx+(z-a[1])*dz)/l2;t=t<0?0:t>1?1:t;return Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t));};
 const wallD=(x,z)=>{let m=1e9;for(const w of walls){const d=segD(x,z,[w.x1,w.z1],[w.x2,w.z2]);if(d<m)m=d;}return m;};
 const OTHER=[[-220,130,175],[-160,-210,165],[300,-300,150],[310,300,145],[-300,-320,150],[-330,300,150]];   // canyon, peaks, the four quarters
 const placed=[];
 function ok(x,z,R){
  const r0=Math.hypot(x,z);
  if(r0<60||r0>330)return false;                                   // clear of the ranch, inside the basin
  for(const [ox,oz,orad] of OTHER)if(Math.hypot(x-ox,z-oz)<orad)return false;
  try{ if(Math.abs(z-W.riverZ(x))<R+15)return false; }catch(e){}
  try{ if(z<163&&Math.abs(x-W.streamX(z))<R+12)return false; }catch(e){}
  if(Math.hypot(x-20,z-16)<R+22)return false;                      // Loon Lake
  try{ if(W.pathDist(x,z)<R+8)return false; }catch(e){}
  for(const s of routes)if(segD(x,z,s[0],s[1])<R+14)return false;
  for(const v of venues)if(Math.hypot(x-v.x,z-v.z)<R+60)return false;
  for(const p of npcs)if(Math.hypot(x-p.x,z-p.z)<R+16)return false;
  for(const q of spots)if(Math.hypot(x-q.x,z-q.z)<R+q.r)return false;
  for(const c of cols)if(Math.hypot(x-c.x,z-c.z)<R+(c.r||0)+4)return false;
  for(const t of trees)if(Math.hypot(x-t.x,z-t.z)<R+3.5)return false;
  if(wallD(x,z)<R+6)return false;
  for(const q of placed)if(Math.hypot(x-q.x,z-q.z)<48)return false;
  return true;
 }

 /* ---------------------------------------------------------------- building one --------- */
 const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
 function outcrop(x,z,R,sd){
  const parts=[], gy=W.groundH(x,z);
  const put=(r,px,pz,dy,yaw,tilt,flat)=>{
   const b=geo.makeBoulder(r,sd+parts.length*97,{flatness:flat});
   const g=b.geometry.clone(); b.geometry.dispose();
   _e.set(tilt*0.6,yaw,tilt); _q.setFromEuler(_e);
   _p.set(px-x, W.groundH(px,pz)-gy+dy, pz-z); _s.set(1,1,1);
   _m.compose(_p,_q,_s); g.applyMatrix4(_m); parts.push(g);
  };
  const yaw0=rnd()*Math.PI*2;
  /* The anchor is a heap, not a block. One big bevelled cube read as a hay bale from thirty metres
     — a smooth, evenly lit box with strata that look like straw at that size. Two or three large
     blocks overlapping at different heights and yaws break the silhouette into crags. */
  put(R*0.78,x,z,-R*0.16,yaw0,rr(-0.10,0.10),rr(0.66,0.82));
  const nb=1+Math.floor(rnd()*2);
  for(let i=0;i<nb;i++){ const a=yaw0+rr(0.6,2.6)*(i?-1:1), d=R*rr(0.35,0.62);
   put(R*rr(0.52,0.70),x+Math.cos(a)*d,z+Math.sin(a)*d,-R*rr(0.02,0.24),rnd()*6.28,rr(-0.18,0.18),rr(0.60,0.86)); }
  const n=3+Math.floor(rnd()*4);
  for(let i=0;i<n;i++){
   const a=yaw0+i/n*Math.PI*2+rr(-0.5,0.5), d=R*rr(0.9,1.45), r=R*rr(0.22,0.46);
   put(r,x+Math.cos(a)*d,z+Math.sin(a)*d,-r*rr(0.15,0.55),rnd()*6.28,rr(-0.25,0.25),rr(0.55,0.85));
  }
  if(rnd()<0.7){                                                  // one resting on the anchor's shoulder
   const a=rnd()*Math.PI*2, r=R*rr(0.28,0.42);
   put(r,x+Math.cos(a)*R*0.45,z+Math.sin(a)*R*0.45,R*rr(0.55,0.75),rnd()*6.28,rr(-0.3,0.3),rr(0.6,0.8));
  }
  const merged=mergeGeometries(parts,false); parts.forEach(p=>p.dispose());
  if(!merged)return null;
  /* Cheap ambient occlusion baked into the vertex colours: stone darkens toward its feet and in the
     low ground between blocks, and keeps its light on the tops. It is what grounds a heap in the
     turf and puts the dark in the cracks that makes the reference's rock read as rock. */
  { const pa=merged.attributes.position, ca=merged.attributes.color;
   if(ca){ let top=0; for(let i=0;i<pa.count;i++)top=Math.max(top,pa.getY(i));
    for(let i=0;i<pa.count;i++){ const t=Math.max(0,Math.min(1,pa.getY(i)/Math.max(0.5,top*0.72)));
     const k=0.56+0.44*t*t*(3-2*t); ca.setXYZ(i,ca.getX(i)*k,ca.getY(i)*k,ca.getZ(i)*k); }
    ca.needsUpdate=true; } }
  merged.computeBoundingSphere();
  const mesh=new THREE.Mesh(merged,mat);
  mesh.name='Outcrop | meadow rock'; mesh.position.set(x,gy,z);
  mesh.castShadow=true; mesh.receiveShadow=true;
  return mesh;
 }

 /* ---------------------------------------------------------------- the valley ----------- */
 const group=new THREE.Group(); group.name='Meadow outcrops';
 const WANT=30;
 for(let i=0;i<2400&&placed.length<WANT;i++){
  const a=rnd()*Math.PI*2, r=60+Math.sqrt(rnd())*270, x=Math.cos(a)*r, z=Math.sin(a)*r;
  const R=rr(2.6,5.6);
  if(!ok(x,z,R*1.5))continue;
  const m=outcrop(x,z,R,7001+i*13);
  if(!m)continue;
  group.add(m);
  placed.push({x,z,r:R});
  cols.push({x,z,r:R*1.05});                                        // the anchor is solid; the satellites are small enough to ride round
 }
 G.scene.add(group);

 G.worldOutcrops={group,placed,material:mat};
 G.on('state',o=>{o.outcrops={count:placed.length,avoided:spots.length};});
}
