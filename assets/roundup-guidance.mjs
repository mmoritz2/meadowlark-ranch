import {chooseRoundupRoute,roundupRiderLegClear,roundupRepositionValid} from './roundup-approach.mjs?v=roundup-route-2';

const EMPTY=Object.freeze([]),finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=p=>finite(p)?Object.freeze({x:p.x,z:p.z}):null;
const validRoute=r=>r&&Array.isArray(r.waypoints)&&r.waypoints.length>0&&r.waypoints.length<=1200&&r.waypoints.every(finite)&&finite(r.pressurePoint);

// Cache only guidance, never riding or completion state. Every exposed next leg
// is checked against current geometry/horse position, even within the cache age.
// Planning timing comes only from an optional caller clock; simulation time is
// the explicit nowMs argument so tests and the real HUD use the same decisions.
export function updateRoundupGuidance(previous,options,nowMs){
 const o=options&&typeof options==='object'?options:{},key=o.key??null;
 const {horse,rider,pen,bounds,clearPoint}=o,colliders=o.colliders??EMPTY,walls=o.walls??EMPTY,pressureRadius=o.pressureRadius??12,avoidSide=o.avoidSide??0;
 const now=Number.isFinite(nowMs)?nowMs:0;
 const valid=(typeof key==='string'||Number.isFinite(key))&&finite(horse)&&finite(rider)&&finite(pen)&&
  [bounds?.x1,bounds?.x2,bounds?.z1,bounds?.z2,pressureRadius,nowMs].every(Number.isFinite)&&
  bounds.x1<bounds.x2&&bounds.z1<bounds.z2&&pressureRadius>=9&&Array.isArray(colliders)&&Array.isArray(walls)&&
  (!clearPoint||typeof clearPoint==='function');
 function cache(planMs=0){return Object.freeze({valid,key,plannedAt:now,planMs,
  horse:point(horse),rider:point(rider),pen:point(pen),bounds,limits:bounds?Object.freeze([bounds.x1,bounds.x2,bounds.z1,bounds.z2]):null,
  colliders,walls,colliderCount:colliders.length,wallCount:walls.length,clearPoint,pressureRadius,avoidSide});}
 function pressureAt(p){
  if(!finite(p)||!valid)return null;
  const hx=pen.x-horse.x,hz=pen.z-horse.z,len=Math.hypot(hx,hz),d=distance(p,horse);
  if(len<.001||d<.001)return null;
  return Object.freeze({x:p.x,z:p.z,distance:d,alignment:((horse.x-p.x)*hx+(horse.z-p.z)*hz)/(d*len),...(p.reposition?{reposition:true}:{})});
 }
 function state(c,route=null,cursor=0){
  const has=validRoute(route)&&Number.isInteger(cursor)&&cursor>=0&&cursor<route.waypoints.length;
  const value={key,route:has?route:null,target:has?route.waypoints[cursor]:null,pressurePoint:has?pressureAt(route.pressurePoint):null,
   phase:has&&cursor<route.waypoints.length-1?'detour':has&&route.pressurePoint.reposition?'reposition':'pressure',blocked:!has,plannedAt:c.plannedAt,planMs:c.planMs,cursor:has?cursor:0};
  // Geometry references are needed for invalidation, not for JSON HUD traces.
  Object.defineProperty(value,'_cache',{value:c,enumerable:false});return Object.freeze(value);
 }
 if(!valid)return state(cache());
 const leg=(from,to)=>roundupRiderLegClear({from,to,horse,bounds,colliders,walls,clearPoint});
 function pressureValid(p){const q=pressureAt(p);return q&&(p.reposition?roundupRepositionValid({...o,colliders,walls,pressureRadius,avoidSide},p):q.distance>=6&&q.distance<pressureRadius&&q.alignment>.5&&leg(p,p));}
 const old=previous?._cache;
 const same=old?.valid&&old.key===key&&old.bounds===bounds&&old.colliders===colliders&&old.walls===walls&&old.clearPoint===clearPoint&&
  old.colliderCount===colliders.length&&old.wallCount===walls.length&&old.pressureRadius===pressureRadius&&old.avoidSide===avoidSide&&
  old.limits.every((n,i)=>n===[bounds.x1,bounds.x2,bounds.z1,bounds.z2][i])&&old.pen.x===pen.x&&old.pen.z===pen.z;
 if(same&&now>=old.plannedAt){
  if(previous.blocked||!validRoute(previous.route)){
   // Failed searches are also cached; stationary riders cannot repeatedly scan
   // the whole pasture every frame. Real movement or scene changes retry sooner.
   if(now-old.plannedAt<250&&distance(rider,old.rider)<=1&&distance(horse,old.horse)<=.5)return state(old);
  }else if(Number.isInteger(previous.cursor)&&previous.cursor>=0&&previous.cursor<previous.route.waypoints.length){
   const route=previous.route;let cursor=previous.cursor;
   while(cursor<route.waypoints.length-1&&distance(rider,route.waypoints[cursor])<=1)cursor++;
   const phase=cursor<route.waypoints.length-1?'detour':'pressure';
   if(distance(horse,old.horse)<=2&&pressureValid(route.pressurePoint)&&leg(rider,route.waypoints[cursor])&&
      !(phase!=='detour'&&now-old.plannedAt>=180))return state(old,route,cursor);
  }
 }
 const readClock=()=>{if(typeof o.clock!=='function')return null;try{const t=o.clock();return Number.isFinite(t)?t:null;}catch{return null;}};
 const before=readClock(),route=chooseRoundupRoute({...o,colliders,walls,pressureRadius}),after=readClock();
 const elapsed=before!==null&&after!==null?after-before:0,planned=cache(Number.isFinite(elapsed)?Math.max(0,elapsed):0);
 // Fail closed if a live callback changed during the search, rather than
 // displaying an unchecked first marker or an invalid pressure destination.
 if(!validRoute(route)||!pressureValid(route.pressurePoint)||!leg(rider,route.waypoints[0]))return state(planned);
 return state(planned,route);
}
