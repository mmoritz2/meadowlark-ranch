/* Resolve the next playable action, without changing quest progress or rewards. */
export const id='story-guidance';

const ACTIONS={
 gallop:['Tap here for Gallop, then ride forward.','gallop'],
 cleanjump:['Approach a practice fence, then Jump.',''],
 train:['Tap here to feed training food in Care.','care'],
 feed:['Tap here to give a treat in Care.','care'],
 groom:['Tap here to groom your horse in Care.','care'],
 pet:['Tap here to pet your horse in Care.','care'],
 water:['Tap here to give water in Care.','care'],
 build:['Tap here to choose a piece in Build.','build'],
 build2:['Tap here to improve your ranch in Build.','build'],
 ranchlvl:['Tap here to see your ranch progress.','build'],
 event:['Tap here for this event and its entry rules.','event'],
 ribbons:['Tap here to choose a riding event.','events'],
 photo:['Tap here to frame your photo.','photo'],
 breed:['Tap here to choose a breeding pair.','stable'],
};

export function nearestPickup(rows,item,position){
 let best=null, distance=Infinity;
 for(const row of rows||[]){
  const group=row?.g;
  if(!group?.visible||!group.position||(item&&row.item!==item))continue;
  const d=Math.hypot(group.position.x-position.x,group.position.z-position.z);
  if(Number.isFinite(d)&&d<distance){best=group;distance=d;}
 }
 return best;
}

// undefined lets the established door/visit/person resolver handle the mission.
// null deliberately removes a misleading arrow to the giver before an action is done.
export function resolveTarget(m,done,world,position){
 if(!m||done)return undefined;
 if(m.type==='carrots'||m.type==='forage'){
  const group=nearestPickup(m.type==='carrots'?world.carrots:world.forage,m.type==='forage'?m.item:null,position);
  return group?{id:'gather:'+m.type+':'+(m.item||'carrot'),position:group.position,arrivalDistance:1}:null;
 }
 if(ACTIONS[m.type])return null;
 return undefined;
}

export function nextAction(m,done){
 if(!m||done)return null;
 if(m.type==='name'&&m.npc==='wren')return {hint:'Follow the marker and talk to Wren by the barn.',action:''};
 if(m.type==='carrots'||m.type==='forage')return {hint:'Follow the marker and ride over the food.',action:''};
 const row=ACTIONS[m.type];
 return row?{hint:row[0],action:row[1]}:null;
}

export function install(G){
 const Q=G.quest, H=G.horse, W=G.world;
 const current=()=>Q.STORY[Q.storyIdx()];
 const done=m=>Q.storyProg()>=(m?.goal||1);
 let cachedTarget, targetMission=null, targetTime=-Infinity;
 const target=(m,s,complete)=>{
  const now=performance.now();
  // A few dozen pickups do not need a full scan on every rendered frame.
  if(m!==targetMission||now-targetTime>200||complete){
   cachedTarget=resolveTarget(m,complete,W,H.player.pos);targetMission=m;targetTime=now;
  }
  return cachedTarget;
 };
 function pill(m,s,progress){
  const action=nextAction(m,progress>=(m?.goal||1));
  if(!action)return '';
  const label=String(m.label||'Current task').replace(/\{name\}/g,s?.story?.name||'the grey mare');
  const count=m.goal>1?' ('+Math.floor(Math.max(0,Math.min(progress,m.goal)))+'/'+m.goal+')':'';
  return label+count+'\n'+action.hint;
 }
 function activate(){
  const m=current(), step=nextAction(m,done(m));
  if(!step)return;
  if(step.action==='gallop'){G.riding?.selectGait('gallop');G.toast('Gallop selected — ride forward to cover the distance.');}
  else if(step.action==='event'&&m.ev&&G.seEvents?.openPage){G.ui.openEvents();G.seEvents.openPage(m.ev);}
  else if(step.action==='events'||step.action==='event')G.ui.openEvents();
  else if(step.action==='care')G.ui.openCare();
  else if(step.action==='build')G.ui.openBuild();
  else if(step.action==='stable')G.ui.openStable();
  else if(step.action==='photo')G.$('photoBtn')?.click();
 }
 G.storyGuidance={target,pill,activate,next:()=>nextAction(current(),done(current()))};
 const track=G.$('questTrack');
 if(track){
  const style=document.createElement('style');
  style.textContent='body.se-hud #questTrack[data-guided="true"]{white-space:pre-line!important}#questTrack[role="button"]{cursor:pointer}#questTrack[role="button"]:focus-visible{outline:2px solid #f3cf6a;outline-offset:3px}';
  document.head.appendChild(style);
  track.addEventListener('click',activate);
  track.addEventListener('keydown',e=>{if((e.code==='Enter'||e.code==='Space')&&track.getAttribute('role')==='button'){e.preventDefault();e.stopPropagation();activate();}});
  let elapsed=1;
  G.on('tick',dt=>{
   elapsed+=dt;if(elapsed<0.25)return;elapsed=0;
   const step=nextAction(current(),done(current()));
   track.dataset.guided=step?'true':'false';
   if(step?.action){track.setAttribute('role','button');track.tabIndex=0;track.setAttribute('aria-label',step.hint+' Activate to open this action.');}
   else {track.removeAttribute('role');track.removeAttribute('tabindex');track.removeAttribute('aria-label');}
  });
 }
 G.on('state',o=>{const m=current(), step=nextAction(m,done(m));o.guidance=step?{type:m.type,...step}:null;});
}
