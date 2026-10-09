import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {install} from '../assets/features/dialogue-focus.js';
const source=fs.readFileSync(new URL('../assets/features/dialogue-focus.js',import.meta.url),'utf8');
function fixture({width=390,height=844,top=460,heading=.4,scale=1}={}){
 const hooks={},classes=new Set(),listeners={},styles=[],observers=[];
 const doc={activeElement:null,addEventListener(type,fn){(listeners[type]??=[]).push(fn);}};
 function element(tag='div'){
  return {tagName:tag.toUpperCase(),style:{display:''},hidden:false,children:[],isConnected:true,attrs:{},
   append(...e){this.children.push(...e);},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
   focus(){doc.activeElement=this;},getClientRects(){return this.style.display==='none'?[]:[{}];},
   contains(e){return e===this||this.children.includes(e);},querySelectorAll(){return [];},querySelector(sel){return sel===':scope>b'?this.firstElementChild:null;}};
 }
 const dlg=element();dlg.style.display='none';dlg.getBoundingClientRect=()=>({top,left:12,width:width-24,height:height-top-12});
 const title=element('b'),next=element('b');dlg.firstElementChild=title;
 const body=element();body.classList={toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)};
 doc.body=body;doc.head={append:e=>styles.push(e)};doc.getElementById=id=>id==='dlg'?dlg:null;doc.createElement=element;doc.activeElement=body;
 globalThis.document=doc;globalThis.window={addEventListener(){}};globalThis.innerWidth=width;globalThis.innerHeight=height;
 globalThis.getComputedStyle=e=>({display:e.style.display});globalThis.MutationObserver=class{constructor(fn){observers.push(fn);}observe(){}};
 const camera=new THREE.PerspectiveCamera(52,width/height,.1,1000);camera.position.set(0,3,15);
 const scene=new THREE.Scene(),group=new THREE.Group();group.position.set(-20,2,-80);group.rotation.y=heading;group.scale.setScalar(scale);scene.add(group);
 // This is the relevant horse-body envelope, without any overhead label.
 const bodyMesh=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.5,3.8),new THREE.MeshBasicMaterial());bodyMesh.position.y=1.25;group.add(bodyMesh);
 const orbit={yaw:.25,pitch:.4,dist:7},resolutions=[];let blockedSide=false;
 const G={THREE,camera,world:{camOrbit:orbit,followCamera:{resolve(origin,desired,out){resolutions.push({origin:origin.clone(),desired:desired.clone()});out.copy(desired);if(blockedSide&&desired.x<origin.x)out.lerp(origin,.85);}}},riding:{releaseAll(){},lock(){}},on:(n,f)=>(hooks[n]??=[]).push(f)};
 install(G);
 const sync=()=>observers.forEach(fn=>fn());
 function open(){dlg.style.display='block';sync();return G.dialogue.frameHorse(group,heading);}
 function tick(dt=.016){let result=false;for(const fn of hooks.camera||[])result=fn({dt})||result;camera.updateMatrixWorld(true);return result;}
 function projectBody(){scene.updateMatrixWorld(true);return [-.65,.65].flatMap(x=>[0,2.5].flatMap(y=>[-1.9,1.9].map(z=>{
  const q=group.localToWorld(new THREE.Vector3(x,y,z)).project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};
 })));}
 return {G,group,scene,camera,dlg,title,next,styles,orbit,resolutions,open,tick,sync,projectBody,set blockedSide(v){blockedSide=v;},set top(v){top=v;}};
}

test('phone and landscape shots fit the actual horse above the measured choice panel',()=>{
 for(const [width,height,top]of [[390,844,460],[667,375,126],[1440,900,640]])for(const heading of [0,.7,Math.PI,4.8]){
  const f=fixture({width,height,top,heading});assert(f.open());assert(f.tick());
  for(const p of f.projectBody()){assert(p.z>-1&&p.z<1);assert(p.x>8&&p.x<width-8,JSON.stringify({width,height,heading,p}));assert(p.y>0&&p.y<top-8,JSON.stringify({width,height,heading,p}));}
  assert.equal(f.camera.fov,52);assert.deepEqual(f.orbit,{yaw:.25,pitch:.4,dist:7});assert(f.resolutions.length>=3);
 }
});

test('a floating nameplate does not enlarge the horse framing and larger roots still fit',()=>{
 const f=fixture({scale:1.3});const label=new THREE.Sprite();label.position.y=100;label.scale.set(80,80,1);f.group.add(label);
 assert(f.open());f.tick();const distance=f.camera.position.distanceTo(f.group.position);assert(distance<30,'the nameplate must not control the shot');
 for(const p of f.projectBody())assert(p.y>0&&p.y<452&&p.x>0&&p.x<390);
});

test('ownership ends synchronously after close, replacement, saved receipt or detached horse',()=>{
 for(const kind of ['close','replacement','detached','hidden']){
  const f=fixture();assert(f.open());f.tick();
  if(kind==='close'||kind==='hidden')f.dlg.style.display='none';
  if(kind==='replacement')f.dlg.firstElementChild=f.next;
  if(kind==='detached')f.group.removeFromParent();
  const before=f.camera.position.clone();assert.equal(f.tick(),false,kind);assert(f.camera.position.equals(before));
  if(kind==='close'){f.dlg.style.display='block';assert.equal(f.tick(),false,'reopening without a new subject cannot resurrect a shot');}
 }
});

test('a new choice replaces ownership while replacing content for a normal NPC clears it',()=>{
 const f=fixture();f.open();f.tick();f.dlg.firstElementChild=f.next;
 assert(f.G.dialogue.frameHorse(f.group,1));f.sync();assert(f.tick());
 f.dlg.firstElementChild={tagName:'B'};f.sync();assert.equal(f.tick(),false);
});

test('camera smoothing owns its copy and cannot be dragged back by preceding riding hooks',()=>{
 const a=fixture();a.open();a.tick();a.group.position.x+=2;a.tick();const expected=a.camera.position.clone();
 const b=fixture();b.open();b.tick();b.group.position.x+=2;b.camera.position.set(800,200,-700);b.tick();
 assert(b.camera.position.distanceTo(expected)<1e-10);assert.deepEqual(b.orbit,{yaw:.25,pitch:.4,dist:7});
});

test('the clearer collision-safe side is selected and kept while the dialog remains open',()=>{
 const f=fixture({heading:0});f.blockedSide=true;f.open();f.tick();assert(f.camera.position.x>f.group.position.x);
 f.blockedSide=false;f.tick();assert(f.camera.position.x>f.group.position.x,'no side-flipping after the obstacle clears');
});

test('the camera responds to panel height changes without changing world or input state',()=>{
 const f=fixture();f.open();f.tick();const position=f.group.position.clone(),first=f.camera.quaternion.clone();f.top=350;
 for(let n=0;n<90;n++)f.tick();assert(f.camera.quaternion.angleTo(first)>.05);assert(f.group.position.equals(position));
 for(const p of f.projectBody())assert(p.y>=0&&p.y<342);
 assert.deepEqual(f.orbit,{yaw:.25,pitch:.4,dist:7});
});

test('invalid or unavailable frame requests never capture a later conversation',()=>{
 const f=fixture();assert.equal(f.G.dialogue.frameHorse(f.group,0),false);assert.equal(f.tick(),false);
 f.dlg.style.display='block';assert.equal(f.G.dialogue.frameHorse(f.group,NaN),false);assert.equal(f.tick(),false);
 delete f.G.THREE;assert.equal(f.G.dialogue.frameHorse(f.group,0),false);assert.equal(f.tick(),false);
 f.group.removeFromParent();assert.equal(f.G.dialogue.frameHorse(f.group,0),false);assert.equal(f.tick(),false);
});

test('dialogue CSS immediately hides independent Rush and waypoint overlays',()=>{
 const selector=source.match(/body\.dialogue-open :is\(([^)]*)\)\{visibility:hidden!important;pointer-events:none!important\}/)?.[1];
 assert(selector);for(const id of ['#rushQuick','#seWay'])assert(selector.split(',').includes(id));
 const f=fixture();f.open();assert.equal(document.body.classList.contains('dialogue-open'),true);
});
