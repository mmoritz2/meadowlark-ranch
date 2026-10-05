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

// Use the actual catalogue/save so already-placed pieces never get requested again.
export function missingBuildPieces(m,save={}){
 if(m?.type==='build2')return ['lantern','trough'].filter(t=>!(save.decor||[]).some(d=>d.t===t));
 return m?.type==='build'&&m.item?[m.item]:[];
}

export function trainingFood(foods,items,horse,xp,gain=(f)=>f.sxp){
 if(!horse||!xp)return null;
 const choices=[];
 for(const [item,f] of Object.entries(foods||{})){
  if(!f.stat||!(f.sxp>0))continue;
  const value=horse.stats?.[f.stat]||0,cap=Math.min(xp.statCap(horse),xp.statCeil(horse,f.stat));
  if(value>=cap)continue;
  const amount=Math.max(0,Math.round(gain(f))),left=Math.max(1,xp.statNeed(value)-(horse.sxp?.[f.stat]||0));
  if(!amount)continue;
  const count=Math.ceil(left/amount),have=items?.[item]||0;
  choices.push({item,stat:f.stat,value,count,have,gain:amount,left,label:f.label||item,buyable:f.shop!==false});
 }
 choices.sort((a,b)=>(a.have<a.count)-(b.have<b.count)||(b.have>0)-(a.have>0)||(b.buyable?1:0)-(a.buyable?1:0)||Math.max(0,a.count-a.have)-Math.max(0,b.count-b.have)||a.count-b.count);
 return choices[0]||null;
}

export function practiceTarget(rows,position){
 const fences=(rows||[]).filter(j=>j.g?.visible!==false&&Number.isFinite(j.x)&&Number.isFinite(j.z));
 const j=fences.sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
 if(!j)return null;
 const sn=Math.sin(j.rotY||0),cs=Math.cos(j.rotY||0),dx=position.x-j.x,dz=position.z-j.z;
 const along=dx*cs-dz*sn,across=dx*sn+dz*cs,side=across>0?1:-1;
 // First line up eight metres out. Once on that line, point to the fence itself.
 const lined=Math.abs(along)<2&&Math.abs(across)<11;
 return {id:'practice:'+j.x+':'+j.z,position:{x:j.x+(lined?0:sn*side*8),z:j.z+(lined?0:cs*side*8),y:0},arrivalDistance:1};
}

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

// The opening gallop starts inside a fenced yard. Lead through its real south opening
// before dropping the marker for the free ride; a diagonal line straight outside cuts a rail.
export function firstGallopExit(m,position){
 if(m?.type!=='gallop'||m.book!=='Prologue'||!position)return null;
 const {x,z}=position;
 if(!(x>-25&&x<25&&z>-20&&z<24))return null;
 return Math.abs(x)>2||z<14?{x:0,z:16}:{x:0,z:26};
}

// undefined lets the established door/visit/person resolver handle the mission.
// null deliberately removes a misleading arrow to the giver before an action is done.
export function resolveTarget(m,done,world,position){
 if(!m||done)return undefined;
 const exit=firstGallopExit(m,position);
 if(exit)return {id:'prologue:south-gate',position:{...exit,y:world.groundH?.(exit.x,exit.z)||0},arrivalDistance:1};
 if(m.type==='carrots'||m.type==='forage'){
  const group=nearestPickup(m.type==='carrots'?world.carrots:world.forage,m.type==='forage'?m.item:null,position);
  return group?{id:'gather:'+m.type+':'+(m.item||'carrot'),position:group.position,arrivalDistance:1}:null;
 }
 if(m.type==='cleanjump')return practiceTarget(world.practiceJumps,position);
 if(ACTIONS[m.type])return null;
 return undefined;
}

export function nextAction(m,done,position,context={}){
 if(!m||done)return null;
 const item=missingBuildPieces(m,context.save)[0],catalog=context.catalog||{};
 if(item){const name=catalog[item]?.label||item;return {hint:'Choose '+name+' in Build. Place it on clear grass outside the fenced arena.',action:'build',label:'Choose '+name,item};}
 if(m.type==='cleanjump')return {hint:'Follow the marker to a practice fence. Canter, then Jump before the rails.',action:'practice',label:'Ride to a practice fence'};
 if(m.type==='train'&&context.training){
  const t=context.training,stat=context.statLabels?.[t.stat]||t.stat;
  return {hint:'Feed '+t.label+' to train '+stat+'. About '+t.count+' more to raise it ('+t.have+' in your bag).',action:t.have?'care':'food',label:t.have?'Feed '+t.label:'Find '+t.label,item:t.item};
 }
 if(m.type==='train'&&context.training===null)return {hint:'Your current stats are at their training caps. Ride an event to earn horse XP, then train again.',action:'events',label:'Earn horse XP'};
 if(firstGallopExit(m,position))return {hint:'Follow the south gate marker. Tap for Gallop.',action:'gallop'};
 if(m.type==='name'&&m.npc==='wren')return {hint:'Follow the marker and talk to Wren by the barn.',action:''};
 if(m.type==='carrots'||m.type==='forage')return {hint:'Follow the marker and ride over the food.',action:''};
 const row=ACTIONS[m.type];
 return row?{hint:row[0],action:row[1],label:({gallop:'Select Gallop',care:'Open Feeding',build:'Open Build',event:'View this event',events:'Choose an event',photo:'Take a photo',stable:'Open Stable'})[row[1]]}:null;
}

export function install(G){
 const Q=G.quest, H=G.horse, W=G.world;
 const current=()=>Q.STORY[Q.storyIdx()];
 const done=m=>m===current()&&Q.storyProg()>=(m?.goal||1);
 function describe(m=current(),complete=done(m)){
  if(!m)return null;
  const save=G.save.fresh()||{},horse=H.ridden(),giver=Q.NPC_DEFS.find(d=>d.id===(m.npc||'wren'));
  const name=giver?.name||'the giver',short=name.replace(/^(Grandpa|Auntie|Farmer|Sheriff) /,'');
  const title=String(m.label||'Current task').replace(/\{name\}/g,save.story?.name||'the grey mare');
  const progress=m===current()?Q.storyProg():0,goal=m.goal||1;
  const reward=G.money.rewardLabel(m.reward)||'';
  let step;
  if(complete)step={hint:'Follow the marker back to '+short+' to collect your reward.',action:'return',label:'Return to '+short};
  else{
   const training=m.type==='train'?trainingFood(G.tables.FOODS3,save.items,horse,G.xp,f=>f.sxp*G.mul('sxp',save,horse,f.stat)):undefined;
   step=nextAction(m,false,H.player.pos,{save,catalog:G.tables.DECOR_CAT,training,statLabels:G.tables.STAT_LBL});
   if(!step)step={hint:m.type==='visit'?'Follow the marker to '+title.replace(/^Visit |^Ride to /,'')+'.':'Follow the marker and talk to '+short+'.',action:'guide',label:m.type==='visit'?'Ride there':'Find '+short};
  }
  const checklist=m.type==='build2'?['lantern','trough'].map(item=>({label:G.tables.DECOR_CAT[item]?.label||item,done:(save.decor||[]).some(d=>d.t===item)})):[];
  return {...step,label:step.label||'Follow the marker',title,progress,goal,reward,complete,checklist};
 }
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
  const step=describe(m,progress>=(m?.goal||1));
  if(!step)return '';
  const count=m.goal>1?' ('+Math.floor(Math.max(0,Math.min(progress,m.goal)))+'/'+m.goal+')':'';
  return step.title+count+'\n'+(step.complete?step.label+' · reward ready':step.hint);
 }
 function activateCurrent(){
  const step=describe();
  if(!step)return;
  if(step.action==='gallop'||step.action==='practice'){
   G.hidePanels();G.riding?.selectGait(step.action==='practice'?'canter':'gallop');
  }else if(step.action==='event'&&current().ev&&G.seEvents?.openPage){G.ui.openEvents();G.seEvents.openPage(current().ev);}
  else if(step.action==='events'||step.action==='event')G.ui.openEvents();
  else if(step.action==='care'){
   if(G.seCare?.open)G.seCare.open('feeding');else G.ui.openCare();
   if(step.item)requestAnimationFrame(()=>G.$('seOv')?.querySelector('[data-se="care:'+step.item+'"]')?.scrollIntoView({block:'center'}));
  }else if(step.action==='food')G.ui.openShop('food');
  else if(step.action==='build'){
   G.hidePanels();G.ui.openBuild();
   const tab=G.$('buildPanel')?.querySelector('[data-buildtab="pieces"]');if(tab&&!tab.classList.contains('on'))tab.click();
   G.ui.dispatch?.('ranch:cat:'+(G.tables.DECOR_CAT[step.item]?.cat||'all'));
   if(step.item)requestAnimationFrame(()=>{
    const row=G.$('buildPanel')?.querySelector('[data-fx="ranch:place:'+step.item+'"]')?.closest('.evrow');
    if(row){row.classList.add('sg-focus');row.scrollIntoView({block:'center'});}
   });
  }else if(step.action==='stable')G.ui.openStable();
  else if(step.action==='photo')G.$('photoBtn')?.click();
  else G.hidePanels();
 }
 G.storyGuidance={target,pill,describe,activate:activateCurrent,activateCurrent,next:()=>describe()};
 G.ui.action('story-guide',()=>activateCurrent());
 const track=G.$('questTrack');
 if(track){
  const style=document.createElement('style');
  style.textContent='body.se-hud #questTrack[data-guided="true"]{white-space:pre-line!important}#questTrack[role="button"]{cursor:pointer}#questTrack[role="button"]:focus-visible{outline:2px solid #f3cf6a;outline-offset:3px}.sg-focus{outline:2px solid #e7be64;outline-offset:2px}';
  document.head.appendChild(style);
  track.addEventListener('click',activateCurrent);
  track.addEventListener('keydown',e=>{if((e.code==='Enter'||e.code==='Space')&&track.getAttribute('role')==='button'){e.preventDefault();e.stopPropagation();activateCurrent();}});
  let elapsed=1;
  G.on('tick',dt=>{
   elapsed+=dt;if(elapsed<0.25)return;elapsed=0;
   const step=describe();
   track.dataset.guided=step?'true':'false';
   if(step?.action){track.setAttribute('role','button');track.tabIndex=0;track.setAttribute('aria-label',step.hint+' Activate to open this action.');}
   else {track.removeAttribute('role');track.removeAttribute('tabindex');track.removeAttribute('aria-label');}
  });
 }
 G.on('state',o=>{const m=current(), step=describe();o.guidance=step?{type:m.type,...step}:null;});
}
