/* The overview borrows the live world camera. Only nearby horse actors step out of its
   shot; their simulation continues and each group's original visibility is restored. */
export function overviewHorseGroups(G){
 const actors=[G.storyQuests?.foal?.(),G.wild?.get?.(),
  ...(G.horse?.herd?.()||[]),...(G.ranch?.standing?.()||[]),
  ...(G.ranchSys?.barnHorses?.()||[]),...Object.values(G.net?.remotes||{})];
 for(const herd of G.worldPkg?.herds||[])actors.push(...(herd.members||[]));
 return [...new Set(actors.map(a=>a?.parts?.group||a?.group).filter(Boolean))];
}

export function createOverviewVisibility(){
 const saved=new Map();
 const related=(a,b)=>{
  for(let g=a;g;g=g.parent)if(g===b)return true;
  for(let g=b;g;g=g.parent)if(g===a)return true;
  return false;
 };
 function restore(){for(const [group,visible] of saved)group.visible=visible;saved.clear();}
 function update(groups,{x,z,radius=12,protectedGroups=[]}={}){
  if(!Number.isFinite(x)||!Number.isFinite(z)){restore();return;}
  const hide=new Set();
  for(const group of groups){
   if(!group||protectedGroups.some(p=>p&&related(group,p)))continue;
   // These actor roots are all direct children of the world scene.
   const pos=group.position;
   if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.z))continue;
   if(Math.hypot(pos.x-x,pos.z-z)<=radius)hide.add(group);
  }
  for(const [group,visible] of saved)if(!hide.has(group)){group.visible=visible;saved.delete(group);}
  for(const group of hide){
   if(!saved.has(group))saved.set(group,group.visible);
   // Story and herd ticks may set visibility afresh before the camera hook.
   group.visible=false;
  }
 }
 return {update,restore};
}
