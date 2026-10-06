import assert from 'node:assert/strict';
import {createFollowCameraInput} from '../assets/features/course-guide.js';

const emit=(target,type,properties={})=>{
 const event=new Event(type);Object.assign(event,properties);target.dispatchEvent(event);
};
function fixture(){
 const state={drag:null,yaw:0,pitch:0,zoom:1};
 const canvas=new EventTarget(),win=new EventTarget(),doc=new EventTarget();
 doc.hidden=false;
 let blocked=false;
 const input=createFollowCameraInput({state,blocked:()=>blocked});
 const detach=input.attach(canvas,win,doc);
 return {state,canvas,win,doc,input,detach,setBlocked:value=>{blocked=value;emit(doc,'game-input-change');}};
}
const pointer=(id=1,x=100,y=100)=>({pointerId:id,clientX:x,clientY:y});
function orbit(f){
 emit(f.canvas,'pointerdown',pointer());
 emit(f.win,'pointermove',pointer(1,200,130));
 assert.equal(f.state.yaw,-.6);assert.equal(f.state.pitch,.12);
}

{
 const f=fixture();
 emit(f.canvas,'wheel',{deltaY:100});assert.equal(f.state.zoom,1.14);
 emit(f.win,'wheel',{deltaY:100});assert.equal(f.state.zoom,1.14,'scroll outside the renderer does not zoom');
 f.setBlocked(true);
 emit(f.canvas,'wheel',{deltaY:100});assert.equal(f.state.zoom,1.14,'menu scroll cannot change saved zoom');
 emit(f.canvas,'pointerdown',pointer());assert.equal(f.state.drag,null,'menu owns pointer input');
 f.setBlocked(false);
 emit(f.canvas,'wheel',{deltaY:-100});assert(Math.abs(f.state.zoom-1)<1e-12);
 emit(f.canvas,'wheel',{deltaY:Infinity});assert(Math.abs(f.state.zoom-1)<1e-12);
 emit(f.canvas,'wheel',{deltaY:1e6});assert.equal(f.state.zoom,1.75);
 emit(f.canvas,'wheel',{deltaY:-1e6});assert.equal(f.state.zoom,.62);
 f.detach();
}
{
 const f=fixture();orbit(f);
 emit(f.canvas,'pointerdown',pointer(2,300,300));
 emit(f.win,'pointermove',pointer(2,600,600));
 emit(f.win,'pointerup',pointer(2));
 assert.equal(f.state.drag.id,1,'second thumb cannot replace or end the camera pointer');
 assert.equal(f.state.yaw,-.6);
 emit(f.win,'pointerup',pointer());assert.equal(f.state.drag,null);
 f.input.update(1,true);f.input.update(.39,true);
 assert.equal(f.state.yaw,-.6,'drag release holds the selected orbit for 1.4 seconds');
 f.input.update(.02,true);assert(f.state.yaw>-.6&&f.state.yaw<-.59,'only time beyond the grace period recenters');
 f.detach();
}
{
 const f=fixture();orbit(f);
 f.setBlocked(true);assert.equal(f.state.drag,null,'a new menu releases the held pointer');
 emit(f.win,'pointermove',pointer(1,700,600));f.input.update(10,true);
 assert.equal(f.state.yaw,-.6,'other screen ownership cannot wind up or recenter the view');
 f.setBlocked(false);
 emit(f.win,'pointermove',pointer(1,900,600));
 f.input.update(1,true);assert.equal(f.state.yaw,-.6,'resuming riding keeps a fresh orbit grace period');
 assert.equal(f.state.drag,null,'closing a menu cannot resume a stale drag');
 f.input.update(.5,true);assert(f.state.yaw>-.6);
 f.detach();
}
{
 const f=fixture();orbit(f);
 emit(f.win,'blur');assert.equal(f.state.drag,null,'window blur releases an active drag');
 emit(f.win,'pointermove',pointer(1,500,500));
 emit(f.canvas,'wheel',{deltaY:100});f.input.update(10,true);
 assert.equal(f.state.yaw,-.6);assert.equal(f.state.zoom,1);
 emit(f.win,'focus');f.input.update(1,true);assert.equal(f.state.yaw,-.6);
 emit(f.win,'pointermove',pointer(1,900,900));assert.equal(f.state.drag,null);
 emit(f.canvas,'pointerdown',pointer());
 f.doc.hidden=true;emit(f.doc,'visibilitychange');assert.equal(f.state.drag,null,'hidden document releases an active drag');
 f.input.update(10,true);assert.equal(f.state.yaw,-.6);
 f.doc.hidden=false;emit(f.doc,'visibilitychange');
 f.input.update(1,true);assert.equal(f.state.yaw,-.6);
 f.detach();
 emit(f.canvas,'wheel',{deltaY:100});assert.equal(f.state.zoom,1,'detached listeners no longer handle input');
}
{
 const f=fixture();orbit(f);
 emit(f.win,'pointercancel',pointer());assert.equal(f.state.drag,null);
 f.input.update(2,false);assert.equal(f.state.yaw,-.6,'stationary rider retains orbit after grace');
 f.input.update(NaN,true);f.input.update(Infinity,true);assert.equal(f.state.yaw,-.6);
 f.input.update(.5,true);assert(f.state.yaw>-.6);
 f.detach();
}
const atRate=hz=>{
 const f=fixture();orbit(f);emit(f.win,'pointerup',pointer());
 for(let frame=0;frame<3*hz;frame++)f.input.update(1/hz,true);
 const yaw=f.state.yaw;f.detach();return yaw;
};
assert(Math.abs(atRate(30)-atRate(120))<1e-12,'camera resume is independent of frame rate');
console.log('Follow-camera input: menu/surface zoom, pointer ownership, 1.4s release grace, ownership resume, blur/visibility release and frame-rate parity passed.');
