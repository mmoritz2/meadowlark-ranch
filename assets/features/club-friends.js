/* Friends and nearby club riders use the existing name-based social handshake.
 * Presence is local to the connected riding room; retained scores are not presence. */
export const id='club-friends';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const PRESENCE=Symbol.for('meadowlark.club-friend-presence');
export const validFriendName=name=>typeof name==='string'&&name===name.trim()&&name.length>0&&name.length<=14&&!/[\x00-\x1f\x7f]/.test(name)&&!['__proto__','constructor','prototype'].includes(name);
export const friendsConnected=G=>G.net?.SOCIAL!==false&&!!G.net?.net?.client?.connected&&!!G.net.net.club;
export function freshFriendRemotes(G,name){
 if(!friendsConnected(G))return [];
 const seen=G[PRESENCE]||(G[PRESENCE]=new WeakMap()),now=Date.now();
 return Object.entries(G.net.remotes||{}).filter(([id,r])=>{
  if(id===G.net.net.id||!r||!validFriendName(r.name)||(name&&r.name!==name)||!Number.isFinite(r.lastSeen)||r.lastSeen<0||r.lastSeen>=7||!Number.isFinite(r.x)||!Number.isFinite(r.z))return false;
  if(!seen.has(r))seen.set(r,{at:now-r.lastSeen*1000,room:G.net.net.club});
  const observation=seen.get(r);return observation.room===G.net.net.club&&now-observation.at>=0&&now-observation.at<7000;
 });
}
export function friendInteractionCheck(G,name){
 if(!validFriendName(name)||name===G.net.myName())return {ok:false,reason:'Choose another rider.'};
 const s=G.save.fresh()||{};
 if(own(s.blocked,name)&&s.blocked[name])return {ok:false,reason:'Unblock this rider before interacting.'};
 if(own(s.tempMute,name)&&s.tempMute[name]>Date.now())return {ok:false,reason:'This rider is muted.'};
 if(!friendsConnected(G))return {ok:false,reason:'Connect to your riding room first.'};
 const matches=freshFriendRemotes(G,name);
 if(matches.length>1)return {ok:false,reason:'Two riders here use this name. Ask them to choose different names first.'};
 if(!matches.length)return {ok:false,reason:'This rider is not currently in your riding room.'};
 return {ok:true,id:matches[0][0],remote:matches[0][1]};
}
function lockedRegion(G,x,z){
 const locks=G.worldPkg?.lockedRegionsAt?.(x,z);
 if(locks?.length)return locks[0];
 const region=G.world?.regionAt?.(x,z);
 return region&&G.worldPkg?.regionUnlocked?.(region)===false?region:null;
}
function pointClear(G,x,z){
 const W=G.world,P=G.horse.player;
 if(Math.hypot(x,z)>453||lockedRegion(G,x,z)||typeof W.groundH!=='function'||typeof G.onFoot?.waterAt!=='function')return false;
 const h=W.groundH(x,z);if(!Number.isFinite(h))return false;
 if(G.onFoot?.waterAt?.(x,z)?.depth>.1)return false;
 // Keep the full mount footprint off steep edges, water, trunks and fences.
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const y=W.groundH(x+dx,z+dz);if(!Number.isFinite(y)||Math.abs(y-h)>.6||G.onFoot?.waterAt?.(x+dx,z+dz)?.depth>.1)return false;
 }
 if(W.colliders?.some(c=>!c.precise&&Math.hypot(x-c.x,z-c.z)<c.r+1))return false;
 for(const w of W.walls||[]){const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-w.x1-t*dx,z-w.z1-t*dz)<1)return false;}
 if(W.solidWorld?.resolve){const probe={x,z};if(W.solidWorld.resolve(probe,{bottom:h+.2,top:h+(P.onFoot?1.8:2.7),radius:.8})>0||Math.hypot(probe.x-x,probe.z-z)>.001)return false;}
 return true;
}
export function socialActivityReason(G){
 if(G.course?.get?.())return 'Finish your current event first.';
 if(G.course?.drillActive?.())return 'Finish your drill first.';
 if(G.rescueRide?.snapshot?.().active)return 'Finish or end your rescue first.';
 if(G.roundup?.state?.().active)return 'Finish or end your roundup first.';
 if(G.trail?.ride)return 'Finish or stop your trail ride first.';
 return '';
}
export function friendJoinPlan(G,name,{landing=true}={}){
 const presence=friendInteractionCheck(G,name);if(!presence.ok)return presence;
 const P=G.horse.player,r=presence.remote;
 if(G.social?.spectate||G.social?.tour)return {ok:false,reason:'Leave spectating or the ranch tour first.'};
 const busy=socialActivityReason(G);if(busy)return {ok:false,reason:busy};
 if(G.worldPkg?.vehicle?.())return {ok:false,reason:'Finish your balloon or ferry ride first.'};
 if(P.flying||P.landing||(P.y||0)>.1)return {ok:false,reason:'Land before joining a rider.'};
 if(r.crs)return {ok:false,reason:'This rider is in an event. Join them after the round.'};
 if(r.fly||(r.y||0)>2)return {ok:false,reason:'This rider is airborne. Join them after they land.'};
 const locked=lockedRegion(G,r.x,r.z);
 if(locked)return {ok:false,reason:G.worldPkg?.lockText?.(locked)||'Unlock this region before joining.'};
 if(!landing)return {ok:true,id:presence.id};
 // Test, rather than mutate, candidate positions. Never move first and repair later.
 G.world.solidWorld?.updateDynamic?.();
 for(const radius of [3,5,8])for(let i=0;i<12;i++){
  const angle=(r.heading||0)+Math.PI*2*i/12,x=r.x+Math.sin(angle)*radius,z=r.z+Math.cos(angle)*radius;
  if(pointClear(G,x,z))return {ok:true,id:presence.id,x,z};
 }
 return {ok:false,reason:'There is no clear landing spot nearby. Ask this rider to move to open ground.'};
}

export function install(G){
 const S=G.save,N=G.net,social=()=>G.social;
 const presence=G[PRESENCE]||(G[PRESENCE]=new WeakMap());
 G.on('remote',(_packet,r)=>{if(r&&typeof r==='object')presence.set(r,{at:Date.now(),room:N.net.club});});
 const names=map=>Object.keys(map||{}).filter(n=>validFriendName(n)&&map[n]);
 function snapshot(){
  const s=S.fresh()||{},connected=friendsConnected(G),remotes=freshFriendRemotes(G),friendNames=names(s.friends),requests=names(s.friendReq?.in),outgoing=names(s.friendReq?.out);
  const matches=name=>remotes.filter(([,r])=>r.name===name);
  function row(name,member){
   const found=matches(name),hit=found.length===1&&(!member?.id||member.id===found[0][0])?found[0]:null,r=hit?.[1],blocked=!!(own(s.blocked,name)&&s.blocked[name]);
   const check=friendJoinPlan(G,name,{landing:false});
   const online=!!hit&&!blocked;
   return {name,id:hit?.[0]||member?.id,online,region:online?(G.world.regionAt?.(r.x,r.z)?.name||'The valley'):'',activity:online?(r.crs?.[0]||r.trail?.[0]||'Free riding'):'',friend:friendNames.includes(name),requested:outgoing.includes(name),blocked,canJoin:online&&check.ok,reason:!online?(blocked?'This rider is blocked.':found.length>1?'Two riders here use this name.':'Not in your current riding room.'):(check.reason||'')};
  }
  const sort=(a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name);
  const friends=friendNames.map(n=>row(n)).sort(sort),clubmates=(G.clubs?.memberRows?.(s)||[]).filter(r=>!r.me&&validFriendName(r.name)).map(r=>row(r.name,r)).sort(sort);
  const nearby=[...new Set(remotes.map(([,r])=>r.name))].map(n=>row(n)).sort(sort);
  return {connected,friends,requests:requests.filter(n=>!s.blocked?.[n]).map(name=>({name})),outgoing:outgoing.map(name=>({name})),clubmates,nearby};
 }
 function invoke(action,name){
  if(!validFriendName(name)||name===N.myName())return {ok:false,reason:'Choose another rider.'};
  const s=S.fresh()||{};
  if(action==='request'||action==='accept'){
   const check=friendInteractionCheck(G,name);if(!check.ok)return check;
   if(names(s.friends).length>=(social()?.FRIEND_MAX||50)&&!own(s.friends,name))return {ok:false,reason:'Your friends list is full.'};
   if(action==='request'&&(own(s.friends,name)||own(s.friendReq?.out,name)))return {ok:false,reason:own(s.friends,name)?'You are already friends.':'A request is already waiting for this rider.'};
   if(action==='accept'&&!own(s.friendReq?.in,name))return {ok:false,reason:'This friend request is no longer available.'};
  }
  if(action==='join'){const check=friendJoinPlan(G,name,{landing:false});if(!check.ok)return check;}
  if(action==='decline'&&!own(s.friendReq?.in,name))return {ok:false,reason:'This friend request is no longer available.'};
  if(action==='remove'&&!own(s.friends,name)&&!own(s.friendReq?.out,name))return {ok:false,reason:'This rider is not on your friends list.'};
  const api=social();if(!api)return {ok:false,reason:'Friends are not available yet.'};
  const result=action==='join'?api.gotoFriend(name):action==='decline'?api.declineFriend(name):api.sendFriend(name,{request:'req',accept:'acc',remove:'rm'}[action]);
  if(result?.ok){G.run('clubFriendsChanged');return {ok:true,...result};}
  return result?.ok===false?result:{ok:false,reason:'The action could not be completed. Please try again.'};
 }
 G.clubFriends={snapshot,...Object.fromEntries(['request','accept','decline','remove','join'].map(action=>[action,name=>invoke(action,name)]))};
 // Poll only a small presence signature, not geometry or DOM. Expiry/disconnects
 // also update an open friends view even when no incoming packet arrives.
 let elapsed=0,last='';
 function changed(){const s=S.fresh()||{},key=JSON.stringify([friendsConnected(G),N.net.club,names(s.friends),s.friendReq,s.blocked,names(s.tempMute).filter(n=>s.tempMute[n]>Date.now()),freshFriendRemotes(G).map(([id,r])=>[id,r.name,G.world.regionAt?.(r.x,r.z)?.id,r.crs?.[0],r.trail?.[0],!!r.fly,(r.y||0)>2]),!!G.social?.spectate,!!G.social?.tour,socialActivityReason(G),!!G.worldPkg?.vehicle?.(),!!G.horse.player.flying,(G.horse.player.y||0)>.1]);if(key!==last){last=key;G.run('clubFriendsChanged');}}
 G.on('tick',dt=>{elapsed+=dt||0;if(elapsed<1)return;elapsed=0;changed();});
 for(const event of ['connect','clubChanged','clubRoom','boot'])G.on(event,changed);
 G.on('state',o=>{o.clubFriends=snapshot();});
}
