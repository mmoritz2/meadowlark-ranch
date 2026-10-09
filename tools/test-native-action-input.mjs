import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {createRidingInput} from '../assets/riding-input.js';

// Execute the actual Ranch gates with isolated input/actors; no DOM, saves,
// rendering or network. The controller lifecycle is tested with real THREE.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function functionSource(name){
 const start=source.indexOf('function '+name+'(');assert(start>=0,name+' exists');
 let depth=0,end=source.indexOf('{',start);
 for(;end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}'&&!--depth)return source.slice(start,end+1);}
 throw Error('Unclosed '+name);
}
function fixture(){
 const toasts=[],ridingInput=createRidingInput(),player={onFoot:false,speed:.2,turnSm:1,flying:false,y:0},mesh={};player.mesh=mesh;
 const RIG={heroMotion:{blocksTravel:true},profile:{nativeRoster:true},attachedTo:mesh};
 const ctx=vm.createContext({ridingInput,player,RIG,myHorses:[{wings:true}],rideIdx:0,
  G:{run:()=>false},getNativeHorseCapabilities:()=>({native:true,canFly:true}),toast:m=>toasts.push(m),
  $:()=>null,window:{_flyTut:1},sJump(){}});
 vm.runInContext(functionSource('syncHorseActionInput')+'\n'+functionSource('setFlying'),ctx);
 return{ctx,player,RIG,ridingInput,toasts};
}

test('Ranch action guard stops keyboard, touch and steering, keeping other input locks independent',()=>{
 const {ctx,player,RIG,ridingInput}=fixture();
 assert.equal(ctx.syncHorseActionInput(),true);assert.equal(player.speed,0);assert.equal(player.turnSm,0);
 for(const input of [{keys:{KeyW:true,KeyA:true,Space:true}},{keys:{KeyS:true,KeyD:true}},{touch:{go:true,goA:1,turnA:1,jump:true}}]){
  const intent=ridingInput.resolve({...input,dt:.3});assert(intent.locked&&intent.braking);assert(!intent.forward&&!intent.back&&!intent.reversing);
 }
 ridingInput.lock('screen',true);RIG.heroMotion.blocksTravel=false;assert.equal(ctx.syncHorseActionInput(),false);
 assert(ridingInput.resolve({keys:{KeyW:true}}).locked,'Recovery cannot release a menu lock');
 ridingInput.lock('screen',false);assert(ridingInput.resolve({keys:{KeyW:true}}).forward,'Held movement resumes only after recovery');
});

test('a parked horse never locks its walking rider; replacing/resetting a rig releases only its own lock',()=>{
 const {ctx,player,RIG,ridingInput}=fixture();ctx.syncHorseActionInput();player.onFoot=true;
 assert.equal(ctx.syncHorseActionInput(),false);assert(ridingInput.resolve({keys:{KeyW:true},onFoot:true}).forward);
 player.onFoot=false;RIG.heroMotion=null;assert.equal(ctx.syncHorseActionInput(),false);assert(!ridingInput.state().locked);
});

test('flight launch is rejected through recovery with feedback, then works normally',()=>{
 const {ctx,player,RIG,toasts}=fixture();ctx.setFlying(true);assert.equal(player.flying,false);assert.match(toasts.at(-1),/finish resting/);
 RIG.heroMotion.blocksTravel=false;ctx.setFlying(true);assert.equal(player.flying,true);assert.equal(player.flyAlt,6);
 ctx.setFlying(false);assert.equal(player.flying,false);
});

test('production tick consumes the action lock before movement and applies it to turning and jumping',()=>{
 const start=source.indexOf('function tick(stepSeconds)'),tick=source.slice(start,source.indexOf('const winged=',start));
 assert(tick.indexOf('syncHorseActionInput();')<tick.indexOf('ridingInput.resolve('));
 assert.match(tick,/const left=!ridingIntent\.locked/);assert.match(tick,/const right=!ridingIntent\.locked/);
 assert.match(tick,/if\(freeCam\|\|ridingIntent\.locked\)\{turn=0;player\.turnSm=0;\}/);
 assert.match(tick,/if\(ridingIntent\.locked\)\{RIDE\.target=0;RIDE\.noJump=true;\}/);
});
