import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {horseActionReadiness} from '../assets/features/bond-personality-emotes.js';

// Exercise the Ranch entry point, so new clips cannot appear in a menu yet fail
// silently because its gameplay action registry does not know their IDs.
const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('const EMOTES={'),html.indexOf('/* Legs off the ground.',html.indexOf('const EMOTES={')));
function fixture({native=true,support=true,onFoot=false}={}){
 const mesh={},events=[],toasts=[],started=[];
 const player={mesh,onFoot,speed:0,y:0,flying:false};
 const motion={mode:'stand',supportedActions:support?['paw','look']:[],state:{action:null},
  actionDescriptor(type){return this.supportedActions.includes(type)?{durationS:type==='paw'?4.6:5.4,label:type}:null;},
  startAction(type){started.push(type);this.state.action={type,timeS:0,durationS:this.actionDescriptor(type).durationS};return true;}};
 const RIG={ready:true,attachedTo:mesh,profile:{nativeBreed:native},heroMotion:motion};
 const parked={profile:{nativeBreed:true},heroMotion:motion};
 let pending;
 const G={run:()=>false,mastery:{isWild:()=>false},onFoot:{horseActionTarget:()=>parked,playHorseAction(type,options){pending={type,...options};return true;}}};
 const ctx=vm.createContext({RIG,player,G,myHorses:[{}],rideIdx:0,Date,toast:m=>toasts.push(m),dailyEvt:(...args)=>events.push(args),sNeigh(){},sHoof(){},syncSave(){}});
 vm.runInContext(source+'\nthis.actionRegistry=EMOTES;',ctx);
 return{ctx,G,RIG,player,motion,parked,events,toasts,started,pending:()=>pending};
}
for(const type of ['paw','look']){
 test(type+' is a native action that starts from the Ranch and uses the controller clock',()=>{
  const f=fixture();assert.equal(f.ctx.actionRegistry[type].nativeOnly,true);
  assert.equal(f.ctx.horseEmote(type),true);assert.deepEqual(f.started,[type]);
  assert.equal(f.RIG.emote.type,type);assert.equal(f.RIG.emote.native,true);assert.equal(f.RIG.emote.dur,f.motion.actionDescriptor(type).durationS);
  assert.equal(f.events.length,1);assert.equal(f.ctx.horseEmote(type),false,'An in-progress action does not restart');assert.equal(f.events.length,1);
 });
 test(type+' rejects unsupported mounts and movement without inventing a legacy pose',()=>{
  for(const options of [{native:false},{support:false}]){const f=fixture(options);assert.equal(f.ctx.horseEmote(type),false);assert.equal(f.started.length,0);assert.equal(f.events.length,0);assert.equal(f.RIG.emote,undefined);}
  for(const patch of [{speed:1},{y:.1},{flying:true}]){const f=fixture();Object.assign(f.player,patch);assert.equal(f.ctx.horseEmote(type),false);assert.equal(f.events.length,0);}
 });
 test(type+' on foot awards success only after the parked controller starts',()=>{
  const f=fixture({onFoot:true});assert.equal(f.ctx.horseEmote(type),true);assert.equal(f.pending().type,type);assert.equal(f.events.length,0);
  f.motion.startAction(type);f.pending().onStarted(f.parked);assert.equal(f.events.length,1);assert.equal(f.parked.emote.type,type);assert.equal(f.RIG.emote,undefined);
 });
}
test('legacy action menus exclude native-only clips while native horses expose their actual support',()=>{
 const f=fixture({native:false}),G={horse:{RIG:()=>f.RIG,player:f.player},tables:{EMOTES:f.ctx.actionRegistry}};
 assert(!horseActionReadiness(G).supported.includes('paw'));assert(!horseActionReadiness(G).supported.includes('look'));assert(horseActionReadiness(G).supported.includes('rear'));
 f.RIG.profile.nativeBreed=true;assert.deepEqual(horseActionReadiness(G).supported,['paw','look']);
});
test('Care retains native actions while its dismounted horse is loading',()=>{
 const f=fixture({onFoot:true}),start=html.indexOf('   const actionRig=',html.indexOf('function renderCare(){'));
 const careSource=html.slice(start,html.indexOf("   x+=",start));
 f.G.onFoot.horseActionTarget=()=>null;
 vm.runInContext(careSource+'\nthis.careChoices=careActions;',f.ctx);
 assert.deepEqual([...f.ctx.careChoices],['paw','look']);
});
