import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRidingInput} from '../assets/riding-input.js';

// Exercise the production listeners and core key handlers with DOM bubbling
// represented explicitly. No renderer, browser or saved ranch is required.
const hud=readFileSync(new URL('../assets/features/se-hud.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const engine=readFileSync(new URL('../assets/features/course-engine.js',import.meta.url),'utf8');
const paceStart=hud.indexOf(" pace.addEventListener('keydown'"),paceEnd=hud.indexOf(" pace.addEventListener('focusout'",paceStart);
const stopStart=hud.indexOf(" const stop=$('seStop');"),stopEnd=hud.indexOf(' // Less frequent actions',stopStart);
const coreStart=main.indexOf("addEventListener('keydown'",main.indexOf('window._k=keys;'));
const coreEnd=main.indexOf('// turnA/goA',coreStart);
assert(paceStart>0&&paceEnd>paceStart&&stopStart>0&&stopEnd>stopStart&&coreStart>0&&coreEnd>coreStart);
const sprintRelease=engine.split('\n').find(line=>line.includes("G.on('keyup'"));
assert(sprintRelease);

function fixture(){
 const keys={},input=createRidingInput('trot'),hooks={},R={sprintOn:false};
 const calls={world:0,chat:0,close:0,released:[]},document={activeElement:null,body:{classList:{contains:()=>false}}};
 function element(id){return {id,hidden:false,disabled:false,handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},focus(){document.activeElement=this;},blur(){document.activeElement=null;}};}
 const win=element('window'),pace=element('pace'),stop=element('stop'),label=element('label');
 const choices={children:['walk','trot','canter','gallop'].map(element),open:false,classList:{contains:()=>choices.open}};
 const G={riding:{brake:on=>input.brake(on)},on(name,fn){(hooks[name]??=[]).push(fn);},run(name,e){if(name==='key')calls.world++;if(name==='keyup')calls.released.push(e.code);for(const fn of hooks[name]||[])fn(e);}};
 const context={pace,choices,document,G,R,keys,freeCam:false,build:{},player:{onFoot:false},myHorses:[],rideIdx:0,
  closeGaits(restore){choices.open=false;if(restore)label.focus();},$:(id)=>id==='seStop'?stop:id==='load'?null:{style:{display:'none'}},
  addEventListener:win.addEventListener.bind(win),editingInput:()=>false,gameInputBlocked:()=>false,dragonElement:()=>false,
  shiftRidingGait:n=>input.shift(n),PANEL_HOTKEYS:{Enter:()=>calls.chat++},hidePanels:()=>calls.close++,sprintKey:()=> 'ShiftLeft'};
 vm.runInNewContext(hud.slice(paceStart,paceEnd)+hud.slice(stopStart,stopEnd)+main.slice(coreStart,coreEnd)+sprintRelease,context);
 function fire(target,type,code,key=code){
  const e={code,key,repeat:false,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};
  const route=target===win?[win]:target===stop?[stop,pace,win]:[pace,win];
  for(const node of route){for(const fn of node.handlers[type]||[])fn(e);if(e.stopped)break;}
  return e;
 }
 return {keys,input,R,calls,choices,document,win,pace,stop,label,fire};
}

test('releasing movement, jump or modifiers after focus moves to gait controls clears the real riding keys',()=>{
 for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','ControlLeft','AltLeft']){
  const f=fixture();f.fire(f.win,'keydown',code);assert.equal(f.keys[code],true);
  f.label.focus();f.R.sprintOn=true;f.fire(f.pace,'keyup',code);
  assert.equal(f.keys[code],false,code+' release must reach the window key handler');assert.deepEqual(f.calls.released,[code]);
  if(code.startsWith('Shift'))assert.equal(f.R.sprintOn,false,'the production course sprint-release hook runs too');
 }
});

test('gait-button focus does not swallow fresh WASD, closed-menu arrows, brackets or the Shift gait modifier',()=>{
 const f=fixture();f.label.focus();
 for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
  f.fire(f.pace,'keydown',code);assert.equal(f.keys[code],true);f.fire(f.pace,'keyup',code);
 }
 f.fire(f.pace,'keydown','KeyW');assert.equal(f.input.resolve({keys:f.keys}).forward,true);
 f.fire(f.pace,'keydown','ShiftLeft','Shift');assert.equal(f.input.resolve({keys:f.keys}).requested,'gallop');
 f.fire(f.pace,'keyup','ShiftLeft','Shift');assert.equal(f.input.resolve({keys:f.keys}).requested,'trot');
 f.fire(f.pace,'keydown','BracketRight',']');assert.equal(f.input.state().selected,'canter');
 f.fire(f.pace,'keyup','KeyW');assert.equal(f.input.resolve({keys:f.keys}).forward,false);
});

test('open gait choices retain arrow/Home/End navigation and Escape without riding or opening another screen',()=>{
 const f=fixture();f.choices.open=true;f.choices.children[1].hidden=true;f.choices.children[2].disabled=true;
 f.choices.children[0].focus();
 for(const [key,expected] of [['ArrowDown','gallop'],['ArrowRight','walk'],['End','gallop'],['Home','walk'],['ArrowUp','gallop'],['ArrowLeft','walk']]){
  const e=f.fire(f.pace,'keydown',key);assert.equal(f.document.activeElement.id,expected);assert(e.defaultPrevented&&e.stopped);assert.equal(f.keys[key],undefined);
 }
 assert.equal(f.calls.world,0);
 const escape=f.fire(f.pace,'keydown','Escape');assert(escape.stopped&&escape.defaultPrevented);assert.equal(f.choices.open,false);assert.equal(f.document.activeElement,f.label);assert.equal(f.calls.close,0);
 f.fire(f.pace,'keydown','Escape');assert.equal(f.calls.close,1,'Escape outside an open picker belongs to the game');
});

test('Enter and Space retain native button activation without triggering chat or jump, and their releases cannot stick',()=>{
 const f=fixture();
 for(const [code,key] of [['Enter','Enter'],['Space',' ']]){
  const e=f.fire(f.pace,'keydown',code,key);assert(e.stopped);assert.equal(e.defaultPrevented,false,'the browser can still activate the focused button');
  assert.equal(f.keys[code],undefined);f.keys[code]=true;f.fire(f.pace,'keyup',code,key);assert.equal(f.keys[code],false);
 }
 assert.equal(f.calls.world,0);assert.equal(f.calls.chat,0);
});

test('keyboard STOP still holds the brake while its release also clears a jump held before focus moved',()=>{
 for(const code of ['Space','Enter']){
  const f=fixture();f.keys.Space=true;const down=f.fire(f.stop,'keydown',code,code==='Space'?' ':code);
  assert(down.defaultPrevented&&down.stopped);assert.equal(f.input.resolve({keys:{KeyW:true}}).braking,true);
  const up=f.fire(f.stop,'keyup',code,code==='Space'?' ':code);assert(up.defaultPrevented);assert.equal(up.stopped,false);
  assert.equal(f.input.resolve({keys:{KeyW:true}}).forward,true);assert.equal(f.keys[code],false);
  if(code==='Space')assert.equal(f.keys.Space,false);
  assert.equal(f.calls.world,0);assert.equal(f.calls.chat,0);
 }
});
