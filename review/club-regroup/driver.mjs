import {flatRaceSegmentClear} from '../../assets/flat-race-guidance.mjs';

// Advisory fixture decisions only. No controller, trail, clock or save writes.
export function regroupDriverDecision({snapshot,trail,sessionId,player,blocked=false,elapsed=0,world={}}={}){
 const c=snapshot?.current,g=c?.regroup,p=player||{},keys={KeyW:false,KeyA:false,KeyD:false,KeyS:false};
 const response=(type,reason,extra={})=>({type,reason,keys,gait:'walk',...extra});
 if(!c||c.id!==sessionId||c.mode!=='regroup-v1'||c.status!=='riding'||c.finished)return response('stop','The owned regroup session ended or changed.');
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=180000)return response('stop','The three-minute normal-input driver bound was reached.');
 if(!trail||trail.clubRideId!==sessionId||trail.clubRegroup!=='regroup-v1'||!Number.isInteger(trail.idx)||trail.idx!==g?.stopIndex)return response('stop','The real local trail does not match this published meeting.');
 if(blocked||!snapshot.connected||!Array.isArray(g?.people)||g.people.filter(person=>!person.left).length<2||g.people.some(person=>!person.left&&person.online!==true))return response('pause','Waiting for active riding and fresh group observations.');
 if(!p.ready||p.loading||p.onFoot||p.flying||p.landing||!Number.isFinite(p.y)||p.y>.1)return response('pause','Waiting for a ready mounted ground horse.');
 if(![p.x,p.z,p.heading,p.speed].every(Number.isFinite))return response('stop','Missing physical rider coordinates or speed.');
 const at=g?.target,stop=trail.pts?.[trail.idx];
 if(!at||![at.x,at.z,at.radius].every(Number.isFinite)||at.radius!==8||!Array.isArray(stop)||stop[1]!==at.x||stop[2]!==at.z)return response('stop','No matching published8m meeting target.');
 const dx=at.x-p.x,dz=at.z-p.z,distance=Math.hypot(dx,dz),shore=6.5;
 const target={x:distance>shore?at.x-dx/distance*shore:p.x,z:distance>shore?at.z-dz/distance*shore:p.z,centre:{x:at.x,z:at.z},radius:at.radius,shoreDistance:shore,distance,stopIndex:trail.idx};
 if(g.arrived||g.ready||distance<shore+.4)return response('wait',g.reason||'Stop here. Use the actual Ready / Continue controls.',{target,keys:{...keys,KeyS:p.speed>.12}});
 if(flatRaceSegmentClear({x:p.x,z:p.z},target,{world})!==true)return response('stop','The direct ground approach is blocked. Release keys and steer the real gate manually.',{target});
 const angle=Math.atan2(target.x-p.x,target.z-p.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
 return response('drive','Driving the direct published meeting approach.',{target,gait:distance>24&&Math.abs(delta)<.2?'canter':distance>14?'trot':'walk',keys:{KeyA:delta>.04,KeyD:delta<-.04,KeyW:Math.abs(delta)<.65,KeyS:Math.abs(delta)>1&&p.speed>.12}});
}
