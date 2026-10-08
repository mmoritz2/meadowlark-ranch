/* Actual se-frame snapshot queue, isolated canvas/renderer and real THREE camera.
   No browser, network, player's save, or WebGL context is used. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let checks=0;const check=(ok,label)=>{assert(ok,label);checks++;};
(async()=>{
 const THREE=await import('../assets/vendor/three/build/three.module.js');
 const source=fs.readFileSync(path.join(__dirname,'../assets/features/se-frame.js'),'utf8');
 const start=source.indexOf(' const SNAP=new Map(), SQ=[];'),end=source.indexOf(' /* ---------------------------------------------------------------- QA + the kit',start);
 assert(start>=0&&end>start,'actual snapshot implementation must be available');
 function fixture(){
  let now=1000,fault='',callbacks=0;const hooks={},images=[],calls={renders:0,draws:0,encodes:0,warnings:0},canvas={width:390,height:844};
  const document={hidden:false,querySelectorAll:()=>images,createElement(tag){assert.equal(tag,'canvas');return {getContext(){return fault==='context2d'?null:{drawImage(){calls.draws++;if(fault==='draw')throw Error('draw unavailable');}};},toDataURL(){calls.encodes++;if(fault==='encode')throw Error('encode unavailable');return fault==='empty'?'data:,':'data:image/jpeg;base64,cG9ydHJhaXQ=';}};}};
  const renderer={domElement:canvas,getContext:()=>({isContextLost:()=>fault==='lost'}),render(){calls.renders++;if(fault==='render')throw Error('render unavailable');}};
  const G={THREE,renderer,scene:new THREE.Scene(),world:{groundH(){if(fault==='marks')throw Error('terrain unavailable');return 0;}},on:(name,fn)=>hooks[name]=fn};
  const cache=vm.runInNewContext(source.slice(start,end)+'\n({snap,paintSnap,SNAP,SQ})',{G,document,Date:{now:()=>now},console:{warn(){calls.warnings++;}}});
  const view=key=>({key,pos:[0,15,15],look:[0,0,0],fov:50,w:640,h:400,marks:[[0,0],[3,2]]});
  const image=key=>{const el={tagName:'IMG',dataset:{snap:key},classList:{add(name){el.snapped=name;}},getAttribute:()=>el.src};images.push(el);return el;};
  return {cache,calls,canvas,renderer,document,view,image,setFault:v=>fault=v,tick:(advance=0)=>{now+=advance;hooks.tick();},listen:e=>e.fns.push(()=>callbacks++),callbacks:()=>callbacks};
 }
 for(const fault of ['canvas','width','height','lost','context2d','render','draw','encode','empty','marks']){
  const f=fixture(),entry=f.cache.snap(f.view(fault)),img=f.image(fault);f.listen(entry);f.setFault(fault);
  if(fault==='canvas')f.renderer.domElement=null;
  if(fault==='width')f.canvas.width=0;
  if(fault==='height')f.canvas.height=0;
  f.tick();
  check(entry.url===null&&entry.pts===null&&f.callbacks()===0&&!img.src,fault+': failed capture does not publish partial URL/marks or consume callbacks');
  const afterFailure={...f.calls};for(let i=0;i<500;i++){assert.equal(f.cache.snap(f.view(fault)),entry,fault+': same key retains entry identity');f.tick();}
  assert.deepEqual(f.calls,afterFailure,fault+': rendering is bounded while retry cools down');
  check(f.cache.SQ.length===1&&entry.fns.length===1,fault+': repeated requests keep one queued retry and preserve listeners');
  f.setFault('');f.renderer.domElement=f.canvas;f.canvas.width=390;f.canvas.height=844;f.tick(60000);
  check(entry.url?.startsWith('data:image/')&&entry.pts.length===2&&entry.pts.flat().every(Number.isFinite)&&f.callbacks()===1,fault+': recovered renderer completes the same entry once');
  check(img.src===entry.url&&img.snapped==='se-snapped'&&f.cache.SQ.length===0,fault+': recovery paints the existing image and removes its pending work');
  const rendered=f.calls.renders;for(let i=0;i<20;i++){f.cache.snap(f.view(fault));f.tick(60000);}check(f.calls.renders===rendered&&f.callbacks()===1,fault+': successful cache does not recapture or redeliver listeners');
 }
 const fair=fixture(),first=fair.cache.snap(fair.view('first'));fair.setFault('render');fair.tick();const second=fair.cache.snap(fair.view('second'));fair.setFault('');fair.tick();
 check(!first.url&&!!second.url,'a cooling-down failed venue cannot block another venue');fair.tick(60000);check(!!first.url,'failed first venue later recovers without a new request');
 const hidden=fixture(),waiting=hidden.cache.snap(hidden.view('hidden'));hidden.document.hidden=true;hidden.tick(60000);check(!waiting.url&&hidden.calls.renders===0&&hidden.cache.SQ.length===1,'background tab retains queued snapshots without work');hidden.document.hidden=false;hidden.tick();check(!!waiting.url,'returning to visible tab resumes the retained snapshot');
 const bounded=fixture();for(let i=0;i<5;i++)bounded.cache.snap(bounded.view('venue-'+i));bounded.tick();check(bounded.calls.renders===1&&bounded.cache.SQ.length===4,'one tick captures at most one venue');
 const repeated=fixture(),broken=repeated.cache.snap(repeated.view('broken'));repeated.setFault('render');for(let i=0;i<12;i++){repeated.tick(60000);const before=repeated.calls.renders;for(let j=0;j<100;j++)repeated.tick();assert.equal(repeated.calls.renders,before,'persistent failure must wait between attempts');}
 check(repeated.cache.SQ.length===1&&broken.fns.length===0&&repeated.calls.warnings===1,'persistent failures retain one recoverable entry and do not flood logs');repeated.setFault('');repeated.tick(60000);check(!!broken.url,'failure retry cap never becomes a permanent blank');
 console.log(`PASS event snapshot cache: ${checks} recovery, queue, callback and frame-budget checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
