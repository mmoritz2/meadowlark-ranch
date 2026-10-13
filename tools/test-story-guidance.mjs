import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The web project uses ES modules without a root package.json.
const source=await readFile(new URL('../assets/features/story-guidance.js',import.meta.url),'utf8');
const {missionPersonId,nearestPickup,resolveTarget,nextAction,missingBuildPieces,trainingFood,practiceTarget,install}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const pickup=(x,z,item='lettuce',visible=true)=>({item,g:{visible,position:{x,y:0,z}}});
const here={x:0,z:0};

test('gathering chooses a visible matching pickup, not a closer wrong food',()=>{
 const far=pickup(8,0),near=pickup(3,0),wrong=pickup(1,0,'pumpkin'),hidden=pickup(0,0,'lettuce',false);
 assert.equal(nearestPickup([wrong,far,hidden,near],'lettuce',here),near.g);
 assert.equal(nearestPickup([hidden,wrong],'lettuce',here),null);
});
test('carrot quests use carrot pickups; forage quests use the requested crop',()=>{
 const carrot=pickup(4,0,'carrot'),lettuce=pickup(2,0),world={carrots:[carrot],forage:[lettuce]};
 assert.equal(resolveTarget({type:'carrots'},false,world,here).position,carrot.g.position);
 assert.equal(resolveTarget({type:'forage',item:'lettuce'},false,world,here).position,lettuce.g.position);
 carrot.g.visible=false;
 assert.equal(resolveTarget({type:'carrots'},false,world,here),null);
});
test('finished tasks keep the existing giver/turn-in resolver',()=>{
 for(const type of ['carrots','forage','gallop','event','build']){
  assert.equal(resolveTarget({type},true,{},here),undefined);
  assert.equal(nextAction({type},true),null);
 }
});
test('place and conversation targets remain with the established resolver',()=>{
 for(const type of ['visit','door','talk','clues','name','guess','future-type'])assert.equal(resolveTarget({type},false,{},here),undefined);
});
test('action tasks suppress premature giver markers and expose the real action',()=>{
 for(const type of ['gallop','train','event','ribbons','build','photo'])assert.equal(resolveTarget({type},false,{},here),null);
 assert.equal(nextAction({type:'gallop'},false).action,'gallop');
 assert.equal(nextAction({type:'event',ev:'h1'},false).action,'event');
 assert.equal(nextAction({type:'train'},false).action,'care');
 assert.equal(nextAction({type:'carrots'},false).action,'');
});


test('opening gallop routes inside riders through the actual south gate only',()=>{
 const m={type:'gallop',book:'Prologue'},world={groundH:()=>2};
 const a=resolveTarget(m,false,world,{x:19,z:16});
 assert.deepEqual(a.position,{x:0,z:16,y:2});
 assert.equal(a.arrivalDistance,1);
 assert.deepEqual(resolveTarget(m,false,world,{x:0,z:15}).position,{x:0,z:26,y:2});
 assert.equal(resolveTarget(m,false,world,{x:0,z:27}),null);
 assert.equal(resolveTarget(m,true,world,{x:0,z:15}),undefined);
 assert.match(nextAction(m,false,{x:-9,z:-14}).hint,/south gate/);
 assert.equal(nextAction(m,false,{x:0,z:27}).hint,'Tap here for Gallop, then ride forward.');
 assert.equal(resolveTarget({type:'gallop'},false,world,{x:0,z:15}),null);
});

const questSource=await readFile(new URL('../assets/features/story-quests.js',import.meta.url),'utf8');
const {buildPairProgress,storyFocusCard}=await import(new URL('../assets/features/story-quests.js',import.meta.url));

test('builder checklist counts distinct required pieces and reacts to real placement events',()=>{
 const save={decor:[{t:'lantern'},{t:'lantern'},{t:'fence'}]},mission={type:'build2'};
 assert.equal(buildPairProgress(save),1);
 assert.deepEqual(missingBuildPieces(mission,save),['trough']);
 const calls=[],hooks={};
 const hook=questSource.split('\n').find(l=>l.includes("G.on('decorPlaced',"));
 new Function('G','cur','Q',hook)({on:(name,fn)=>hooks[name]=fn},()=>mission,{questEvt:(type)=>calls.push([type,buildPairProgress(save)])});
 save.decor.push({t:'trough'});hooks.decorPlaced();
 assert.deepEqual(calls,[['build2',2]]);
 assert.deepEqual(missingBuildPieces(mission,save),[]);
 mission.type='event';hooks.decorPlaced();assert.equal(calls.length,1,'decor must not advance a different mission');
});

test('training recommends useful owned food with current XP and actual XP multipliers',()=>{
 const foods={carrot:{stat:'speed',sxp:6,label:'Carrot'},lettuce:{stat:'agility',sxp:12,label:'Lettuce'},hay:{label:'Hay'}};
 const h={stats:{speed:5,agility:3},sxp:{agility:30}},xp={statCap:()=>5,statCeil:()=>8,statNeed:v=>20+10*v};
 let t=trainingFood(foods,{carrot:20,lettuce:2},h,xp);
 assert.equal(t.item,'lettuce','never recommend food for a capped stat');assert.equal(t.count,2);assert.equal(t.have,2);
 t=trainingFood(foods,{lettuce:2},h,xp,f=>f.sxp*2);
 assert.equal(t.count,1,'the estimate includes the active multiplier');
 foods.rare={stat:'agility',sxp:48,label:'Rare herb',shop:false};
 assert.equal(trainingFood(foods,{},h,xp).item,'lettuce','empty bags point to food the shelf actually sells');
 h.stats.agility=5;assert.equal(trainingFood(foods,{lettuce:2},h,xp),null);
});

test('practice guidance uses visible real fences and lines up before targeting rails',()=>{
 const j={x:0,z:0,rotY:0,g:{visible:true}},hidden={x:7,z:0,g:{visible:false}};
 assert.deepEqual(practiceTarget([j,hidden],{x:7,z:-1}).position,{x:0,z:-8,y:0});
 assert.deepEqual(practiceTarget([j],{x:0,z:-7}).position,{x:0,z:0,y:0});
 assert.equal(practiceTarget([],{x:0,z:0}),null);
 assert.equal(resolveTarget({type:'cleanjump'},true,{practiceJumps:[j]},here),undefined);
});

test('current actions open Feeding and the visible required builder shelf without changing progression',()=>{
 const mission={type:'train',label:'Train a stat',goal:1,reward:{c:20}},save={story:{},items:{lettuce:2}},calls=[];
 const horse={stats:{agility:3},sxp:{agility:30}},G={
  quest:{STORY:[mission],storyIdx:()=>0,storyProg:()=>0,NPC_DEFS:[{id:'wren',name:'Grandpa Wren'}]},
  horse:{ridden:()=>horse,player:{pos:here}},world:{},save:{fresh:()=>save},money:{rewardLabel:()=> '20 coins'},
  tables:{FOODS3:{lettuce:{stat:'agility',sxp:12,label:'Lettuce'}},DECOR_CAT:{},STAT_LBL:{agility:'Agility'}},
  xp:{statCap:()=>5,statCeil:()=>8,statNeed:()=>50},mul:()=>1,ui:{action(){},openCare:()=>calls.push('legacy-care')},
  seCare:{open:tab=>calls.push(tab)},$:()=>null,on(){},hidePanels:()=>calls.push('world')};
 globalThis.requestAnimationFrame=fn=>fn();
 const before=JSON.stringify([save,horse]);install(G);
 const plan=G.storyGuidance.describe();assert.equal(plan.label,'Feed Lettuce');assert.match(plan.hint,/2 more/);
 G.storyGuidance.activateCurrent();assert.deepEqual(calls,['feeding']);
 assert.equal(JSON.stringify([save,horse]),before);
 const returned=G.storyGuidance.describe(mission,true);assert.equal(returned.label,'Return to Wren');assert.equal(returned.action,'return');
 mission.type='build2';save.decor=[{t:'lantern'}];G.tables.DECOR_CAT={lantern:{label:'Lantern post',cat:'yard'},trough:{label:'Water trough',cat:'stable'}};
 G.ui.openBuild=()=>calls.push('build');G.ui.dispatch=action=>calls.push(action);calls.length=0;
 const buildBefore=JSON.stringify([save,horse]);G.storyGuidance.activateCurrent();
 assert.deepEqual(calls,['world','build','ranch:cat:stable']);assert.equal(JSON.stringify([save,horse]),buildBefore);
 delete globalThis.requestAnimationFrame;
});

test('active story card exposes action and reward, escapes text, and preserves exact progress',()=>{
 const html=storyFocusCard({title:'Willow <script>',hint:'Place Water trough',progress:1,goal:2,reward:'200 coins & hay',label:'Choose Water trough',checklist:[{label:'Lantern post',done:true},{label:'Water trough',done:false}]},'Build It Back Up');
 assert.match(html,/Willow &lt;script>/);assert(!html.includes('<script>'));
 assert.match(html,/data-fx="story-guide"/);assert.match(html,/200 coins &amp; hay/);
 assert.match(html,/aria-valuenow="1"/);assert.match(html,/aria-valuemax="2"/);
 assert.match(html,/✓ Lantern post/);assert.match(html,/○ Water trough/);
});

// Exercise the actual HUD delegator as well as the guidance module. Its fallback
// still owns ordinary doors/places/turn-ins; witness text and marker share one rule.
const hudSource=await readFile(new URL('../assets/features/se-hud.js',import.meta.url),'utf8');
const wayTargetSource=hudSource.slice(hudSource.indexOf(' function wayTarget(){'),hudSource.indexOf(' const _wv='));
function witnessFixture(){
 const mission={type:'clues',npc:'wren',label:'Ask Mia and Theo about the grey mare',goal:3,reward:{c:200},clues:[{npc:'mia'},{npc:'theo'}]};
 const save={story:{idx:0,prog:0,name:'Silverleaf',clues:[]}},calls=[];
 const defs=[{id:'wren',name:'Grandpa Wren'},{id:'mia',name:'Mia'},{id:'theo',name:'Theo'}];
 const npcs=defs.map((def,i)=>({def,g:{visible:true,position:{x:i*8,y:0,z:3}}}));
 const G={quest:{STORY:[mission],storyIdx:()=>save.story.idx,storyProg:()=>save.story.prog,NPC_DEFS:defs},
  horse:{ridden:()=>({}),player:{pos:here}},world:{npcList:npcs},save:{fresh:()=>structuredClone(save)},
  money:{rewardLabel:()=> '200 coins'},tables:{DECOR_CAT:{}},ui:{action(){}},$:()=>null,on(){},hidePanels:()=>calls.push('world')};
 install(G);
 const wayTarget=new Function('G',"let wayKey='',wayNpc=null;const wayPlace={position:{set(){}}};"+wayTargetSource+'return wayTarget;')(G);
 return {G,save,mission,npcs,calls,wayTarget};
}

test('witness instructions, quest pill and actual HUD target advance together without a cache delay',()=>{
 const f=witnessFixture(),g=f.G.storyGuidance;
 for(const [clues,expected] of [[[],'mia'],[['mia'],'theo'],[['mia','theo'],'wren']]){
  f.save.story.clues=clues;f.save.story.prog=clues.length;
  const before=structuredClone(f.save),plan=g.describe(),target=f.wayTarget();
  const who=f.npcs.find(n=>n.def.id===expected);
  assert.equal(missionPersonId(f.mission,false,f.save),expected);
  assert.equal(target.position,who.g.position,'the marker uses the live actor, not fixed authored coordinates');
  assert.match(plan.label,new RegExp(who.def.name.replace('Grandpa ','')));
  assert.match(g.pill(f.mission,f.save,f.save.story.prog),new RegExp(who.def.name.replace('Grandpa ','')));
  assert.equal(plan.complete,false);
  g.activateCurrent();assert.deepEqual(f.save,before,'navigation never notes a clue or credits the story');
 }
 assert.match(g.describe().label,/Compare clues with Wren/);
 assert.match(g.describe().hint,/compare the clues/);
 assert.doesNotMatch(g.pill(f.mission,f.save,2),/reward ready/);
 f.save.story.prog=3;
 assert.equal(g.describe().label,'Return to Wren');assert.equal(g.describe().complete,true);
 assert.equal(f.wayTarget(),f.npcs[0].g,'completed mission uses the established giver fallback');
 assert.match(g.pill(f.mission,f.save,3),/reward ready/);
});

test('witness resolver tolerates old and malformed clue ledgers without inventing discovered clues',()=>{
 const m={npc:'wren',clues:[{npc:'mia'},{npc:'theo'}]};
 for(const story of [{},{clues:null},{clues:'mia'},{clues:4}])assert.equal(missionPersonId(m,false,{story}),'mia');
 assert.equal(missionPersonId(m,false,{story:{clues:['unknown','mia','mia']}}),'theo');
 assert.equal(missionPersonId(m,true,{story:{clues:[]}}),'wren');
 assert.equal(missionPersonId(null,false),null);
});

test('moving or unavailable witnesses never produce a stale marker to another person',()=>{
 const f=witnessFixture(),target=f.wayTarget();f.npcs[1].g.position.x=37;
 assert.equal(target.position.x,37);assert.equal(f.wayTarget().position.x,37);
 f.G.world.npcList=f.npcs.filter(n=>n.def.id!=='mia');
 assert.equal(f.wayTarget(),null,'do not fall through to a wrong giver while the witness is unavailable');
 assert.equal(f.G.storyGuidance.describe().label,'Find Mia');
});

test('talk tasks describe and target their named conversation partner before returning to the giver',()=>{
 const f=witnessFixture();Object.assign(f.mission,{type:'talk',talk:'theo',goal:1,label:'Ask Theo'});delete f.mission.clues;
 assert.equal(f.G.storyGuidance.describe().label,'Find Theo');assert.equal(f.wayTarget().position,f.npcs[2].g.position);
 f.save.story.prog=1;assert.equal(f.G.storyGuidance.describe().label,'Return to Wren');assert.equal(f.wayTarget(),f.npcs[0].g);
});
