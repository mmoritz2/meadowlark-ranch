/* Optional Basin coordination. These values describe a meeting, never earned
   trail progress. Only the ordinary local trail loop may credit a stop. */
import {EXPEDITIONS} from './expeditions.mjs?v=offline-expeditions-1';
export const REGROUP_MODE='regroup-v1', REGROUP_ROUTE='basin-v1', REGROUP_FRESH_MS=2200;
export const REGROUP_RADIUS=8, REGROUP_SPEED=1.2;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
export const safeRegroupId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<1000&&Math.abs(p.z)<1000;
const basis=EXPEDITIONS.find(r=>r.id==='basin');
export function isRegroupRoute(r){return r?.id==='basin'&&Array.isArray(r.stops)&&r.stops.length===basis.stops.length&&r.stops.every((p,i)=>Array.isArray(p)&&p[1]===basis.stops[i][1]&&p[2]===basis.stops[i][2]);}
export function sameRegroupTrail(r,route){return isRegroupRoute(route)&&Array.isArray(r?.pts)&&r.pts.length===route.stops.length&&r.pts.every((p,i)=>Array.isArray(p)&&p[1]===route.stops[i][1]&&p[2]===route.stops[i][2]);}
export function regroupState(value,{status,hostId,previous}={}){
 if(!value||value.route!==REGROUP_ROUTE||!Array.isArray(value.crew)||!Array.isArray(value.departures)||value.crew.length>4||new Set(value.crew).size!==value.crew.length||!value.crew.every(safeRegroupId))return null;
 if(status==='waiting'&&(value.crew.length||value.departures.length))return null;
 if(status!=='waiting'&&!(status==='cancelled'&&!value.crew.length&&!value.departures.length)&&(value.crew.length<2||!value.crew.includes(hostId)))return null;
 if(value.departures.length>basis.stops.length)return null;
 const departures=[];
 for(let i=0;i<value.departures.length;i++){
  const d=value.departures[i];if(!d||d.index!==i||!safeRegroupId(d.token)||!Number.isFinite(d.at)||d.at<0||!d.ready||typeof d.ready!=='object'||Array.isArray(d.ready))return null;
  const entries=Object.entries(d.ready);if(entries.length<2||entries.length>4||entries.some(([id,nonce])=>!value.crew.includes(id)||!safeRegroupId(nonce)))return null;
  departures.push({index:i,token:d.token,at:d.at,ready:Object.fromEntries(entries)});
 }
 if(previous){
  if(previous.crew.length&&JSON.stringify(value.crew)!==JSON.stringify(previous.crew))return null;
  if(departures.length<previous.departures.length)return null;
  for(let i=0;i<previous.departures.length;i++){const a=previous.departures[i],b=departures[i];if(a.token!==b.token||a.at!==b.at||Object.keys(a.ready).some(id=>!own(b.ready,id)))return null;}
 }
 return {route:REGROUP_ROUTE,crew:[...value.crew],departures};
}
export function regroupInput(m,{sid,memberId,now,previous}={}){
 if(!m||m.sid!==sid||m.id!==memberId||m.mode!==REGROUP_MODE||m.route!==REGROUP_ROUTE||!safeRegroupId(m.id)||!Number.isInteger(m.rev)||m.rev<1||!Number.isFinite(m.at)||m.at<now-REGROUP_FRESH_MS||m.at>now+1500||!point(m)||!Number.isFinite(m.speed)||Math.abs(m.speed)>80||!Number.isInteger(m.index)||m.index<0||m.index>=basis.stops.length)return null;
 if(!['active','mounted','grounded'].every(k=>typeof m[k]==='boolean')||m.nonce!==null&&!safeRegroupId(m.nonce)||previous&&m.rev<=previous.rev)return null;
 // A packet stream that jumps farther than a ground horse can travel is not
 // arrival evidence. The next ordinary observations can recover, but readiness
 // needs a new explicit nonce after such a discontinuity.
 const jump=previous&&Math.hypot(m.x-previous.x,m.z-previous.z)>Math.max(4,45*Math.max(0,(now-previous.receivedAt)/1000));
 return {id:m.id,sid,route:REGROUP_ROUTE,mode:REGROUP_MODE,rev:m.rev,at:m.at,receivedAt:now,x:m.x,z:m.z,speed:m.speed,index:m.index,active:m.active,mounted:m.mounted,grounded:m.grounded,nonce:jump?null:m.nonce,jump:!!jump};
}
export function regroupAtStop(input,stop,index,now){return !!input&&point(input)&&Array.isArray(stop)&&input.index===index&&input.active===true&&input.mounted===true&&input.grounded===true&&Number.isFinite(input.speed)&&Math.abs(input.speed)<REGROUP_SPEED&&Number.isFinite(input.receivedAt)&&now>=input.receivedAt&&now-input.receivedAt<=REGROUP_FRESH_MS&&Number.isFinite(input.at)&&now-input.at<=REGROUP_FRESH_MS&&input.at<=now+1500&&Math.hypot(input.x-stop[1],input.z-stop[2])<REGROUP_RADIUS;}
