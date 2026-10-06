/* A replay of this rider's real fastest completed Rush. It never enters the course,
   collision world, horse roster, networking, or reward path. Install after the course marshal. */
export const id='rush-ghost';
export const GHOST_IDS=Object.freeze(['rush-pasture','rush-river','rush-trail']);
export const GHOST_LIMIT=2048;
const VERSION=1,BASE_STEP=.2,MAX_TIME=3600,MAX_SPEED=90;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const obj=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
const round=n=>Math.round(n*1000)/1000;
const yaw=n=>Math.atan2(Math.sin(n),Math.cos(n));
const layoutOK=s=>typeof s==='string'&&s.length>0&&s.length<=600;
const pointOK=p=>Array.isArray(p)&&p.length===5&&p.every(finite)&&p[0]>=0&&p[0]<=MAX_TIME&&Math.abs(p[1])<=5000&&Math.abs(p[2])<=5000&&p[3]>=-.1&&p[3]<=20&&Math.abs(p[4])<=Math.PI+.001;
const travels=(a,b)=>Math.hypot(b[1]-a[1],b[2]-a[2])<=MAX_SPEED*(b[0]-a[0])+3;
export function sanitizeGhostRecord(value){
 const r=obj(value);
 if(!GHOST_IDS.includes(r.id)||!layoutOK(r.layout)||!finite(r.time)||r.time<=0||r.time>MAX_TIME||typeof r.runId!=='string'||!r.runId||r.runId.length>80||!finite(r.step)||r.step<BASE_STEP||r.step>6.4||!Array.isArray(r.samples)||r.samples.length<2||r.samples.length>GHOST_LIMIT)return null;
 let previous=null;
 for(const p of r.samples){
  if(!pointOK(p)||previous&&(p[0]<=previous[0]||p[0]-previous[0]>r.step*2.2+.1||!travels(previous,p)))return null;
  previous=p;
 }
 if(r.samples[0][0]!==0||Math.abs(r.samples.at(-1)[0]-r.time)>.011)return null;
 return {id:r.id,layout:r.layout,time:r.time,runId:r.runId,step:r.step,samples:r.samples.map(p=>p.slice())};
}
export function sanitizeGhostSave(value){
 const s=obj(value),records={};
 if(s.version===VERSION)for(const id of GHOST_IDS){const r=sanitizeGhostRecord(obj(s.records)[id]);if(r?.id===id)records[id]=r;}
 return {version:VERSION,enabled:typeof s.enabled==='boolean'?s.enabled:null,records};
}
export function createGhostRecording(id,layout){return {id,layout,step:BASE_STEP,samples:[],lastSeen:null,invalid:false};}
export function appendGhostSample(recording,point,force=false){
 const r=recording;if(!r||r.invalid)return false;
 if(!pointOK(point)){r.invalid=true;return false;}
 const last=r.lastSeen;
 if(last){
  if(point[0]<last[0]||!travels(last,point)){r.invalid=true;return false;}
  if(point[0]===last[0]&&(!force||r.samples.at(-1)?.[0]===point[0]))return false;
 }
 r.lastSeen=point.slice();
 if(!force&&r.samples.length&&point[0]-r.samples.at(-1)[0]<r.step-.006)return false;
 if(r.samples.length>=GHOST_LIMIT-1){r.samples=r.samples.filter((_,i)=>i%2===0);r.step*=2;}
 r.samples.push(point.map(round));return true;
}
export function ghostMatches(record,best,layout){return !!record&&!!best&&record.layout===layout&&best.layout===layout&&finite(best.bestTime)&&Math.abs(record.time-best.bestTime)<.011;}
export function acceptGhostFinish(recording,result,{lastResult,course,current,best,existing}={}){
 if(!recording||recording.invalid||!result||result!==lastResult||!course||course!==current||!course.started||!course.ev?.rush||course.ev.id!==recording.id||!Array.isArray(course.jumps)||course.idx!==course.jumps.length||!course.jumps.length||result.id!==recording.id||result.layout!==recording.layout||!ghostMatches({layout:recording.layout,time:result.time},best,recording.layout))return null;
 if(!result.newBestTime&&existing&&ghostMatches(existing,best,recording.layout))return null;
 return sanitizeGhostRecord({...recording,time:result.time,runId:result.runId});
}
export function interpolateGhost(record,time){
 if(!record?.samples?.length||!finite(time)||time<0||time>record.time+.05)return null;
 const samples=record.samples;if(time<=samples[0][0])return samples[0].slice();
 if(time>=samples.at(-1)[0])return samples.at(-1).slice();
 let lo=0,hi=samples.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid][0]<=time)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],f=(time-a[0])/(b[0]-a[0]);
 return [time,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f,a[3]+(b[3]-a[3])*f,yaw(a[4]+yaw(b[4]-a[4])*f)];
}
export function captureGhostPoint(time,player,rig){
 // Native jumps lift the rendered mount through heroJumpExtra; the general player
 // altitude is not the visual root height for every rig family.
 const height=rig?.heroMotion&&!player.flying?rig.heroJumpExtra:player.y;
 return [round(time),player.pos.x,player.pos.z,Math.max(0,finite(height)?height:0),yaw(player.heading)];
}
export function install(G){
 if(!G.ranchRush||!G.THREE)return;
 const P=G.horse.player,THREE=G.THREE,media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 let saved=sanitizeGhostSave(G.save.fresh()?.rushGhost),current=null,recording=null,replay=null,actor=null,pose=null,elapsed=0,lastSaved=null;
 // Save ensures run throughout the game: bounds-check the large tapes only at load/start/write.
 G.save.ensure(s=>{if(!s.rushGhost||s.rushGhost.version!==VERSION)s.rushGhost={version:VERSION,enabled:null,records:{}};});
 const reduced=()=>!!media?.matches||document.body.classList.contains('reduce-motion');
 let reducedSetting=!!G.save.fresh()?.a11y?.motion;
 const enabled=()=>saved.enabled===null?!reduced()&&!reducedSetting:saved.enabled;
 const layout=c=>(c.jumps||[]).map(j=>`${j.kind}:${j.x.toFixed(1)},${j.z.toFixed(1)}`).join('|');
 const point=t=>captureGhostPoint(t,P,G.horse.RIG?.());
 function clearActor(){
  if(!actor)return;G.scene.remove(actor.group);
  for(const g of actor.geometries)g.dispose();for(const m of actor.materials){m.map?.dispose();m.dispose();}
  actor=null;pose=null;
 }
 function makeActor(){
  if(actor)return actor;
  const group=new THREE.Group();group.name='Ranch Rush | your personal best';
  const body=new THREE.MeshBasicMaterial({color:0x92e1d7,transparent:true,opacity:.32,depthWrite:false});
  const rider=new THREE.MeshBasicMaterial({color:0xedf9dc,transparent:true,opacity:.4,depthWrite:false});
  const ball=new THREE.SphereGeometry(1,10,7),cylinder=new THREE.CylinderGeometry(1,1,1,7),geometries=new Set([ball,cylinder]),materials=new Set([body,rider]);
  const shape=(geo,scale,pos,mat=body,parent=group)=>{const m=new THREE.Mesh(geo,mat);m.scale.set(...scale);m.position.set(...pos);parent.add(m);return m;};
  shape(ball,[.3,.38,.72],[0,1.3,0]);shape(ball,[.23,.35,.3],[0,1.38,-.57]);
  const neck=shape(ball,[.19,.54,.21],[0,1.74,.57]);neck.rotation.x=-.37;
  shape(ball,[.16,.19,.31],[0,2.12,.79]);
  for(const x of [-.085,.085])shape(ball,[.04,.14,.04],[x,2.34,.67]);
  const tail=shape(cylinder,[.055,.7,.055],[0,1.17,-1]);tail.rotation.x=-.42;
  const legs=[];
  for(const [x,z] of [[-.21,.46],[.21,.46],[-.23,-.52],[.23,-.52]]){const pivot=new THREE.Group();pivot.position.set(x,1.13,z);group.add(pivot);shape(cylinder,[.052,1.02,.052],[0,-.51,0],body,pivot);shape(ball,[.08,.07,.12],[0,-1.04,.035],body,pivot);legs.push(pivot);}
  shape(ball,[.19,.32,.12],[0,1.97,-.08],rider);shape(ball,[.135,.15,.135],[0,2.43,-.08],rider);
  for(const x of [-.31,.31]){const boot=shape(cylinder,[.065,.58,.065],[x,1.22,-.02],rider);boot.rotation.x=-.15;}
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#193f37';ctx.beginPath();ctx.roundRect(4,5,248,54,20);ctx.fill();ctx.fillStyle='#e4fff4';ctx.font='700 28px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Your best',128,32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
  const labelMaterial=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});materials.add(labelMaterial);
  const label=new THREE.Sprite(labelMaterial);label.position.set(0,3.04,0);label.scale.set(1.85,.46,1);group.add(label);
  group.visible=false;G.scene.add(group);actor={group,legs,materials,geometries};return actor;
 }
 function clearRun(){current=null;recording=null;replay=null;elapsed=0;clearActor();}
 function refresh(){saved=sanitizeGhostSave(G.save.fresh()?.rushGhost);reducedSetting=!!G.save.fresh()?.a11y?.motion;}
 G.on('courseStart',c=>{
  clearRun();if(!c?.ev?.rush||!GHOST_IDS.includes(c.ev.id))return;
  refresh();current=c;const key=layout(c);recording=createGhostRecording(c.ev.id,key);
  const best=G.ranchRush.snapshot().records[c.ev.id],candidate=saved.records[c.ev.id];
  replay=ghostMatches(candidate,best,key)?candidate:null;if(replay&&enabled())makeActor();
 });
 function recordAt(time,force=false){
  if(!recording||recording.invalid)return;
  if(P.flying||P.onFoot){recording.invalid=true;return;}
  if(!recording.samples.length)appendGhostSample(recording,point(0),true);
  if(time>0)appendGhostSample(recording,point(time),force);
 }
 G.on('rushFinish',result=>{
  // rushFinish occurs inside courseFinish, after the core has persisted its accepted PB,
  // before cancelCourse removes the course. A synthetic hook cannot satisfy identity.
  if(!current||!recording||result!==G.ranchRush.lastResult)return;
  recordAt(result.time,true);
  const best=G.ranchRush.snapshot().records[result.id];
  const tape=acceptGhostFinish(recording,result,{lastResult:G.ranchRush.lastResult,course:current,current:G.course.get(),best,existing:saved.records[result.id]});
  if(tape){
   G.save.sync(s=>{const next=sanitizeGhostSave(s.rushGhost);next.records[tape.id]=tape;s.rushGhost=next;});
   refresh();lastSaved=saved.records[tape.id]?.runId===tape.runId?{id:tape.id,time:tape.time,samples:tape.samples.length}:null;
  }
  clearRun();
 });
 G.on('tick',()=>{
  if(!current)return;
  if(G.course.get()!==current){clearRun();return;}
  const live=G.ranchRush.snapshot().active;if(!live||live.id!==current.ev.id){clearRun();return;}
  elapsed=live.elapsed;
  if(current.started)recordAt(elapsed);
  if(!replay||!enabled()){clearActor();return;}
  const p=interpolateGhost(replay,current.started?elapsed:0);
  if(!p){if(actor)actor.group.visible=false;pose=null;return;}
  const a=makeActor(),y=G.world.groundH(p[1],p[2])+p[3];
  a.group.position.set(p[1],y,p[2]);a.group.rotation.y=p[4];
  // When both rides occupy the same place, avoid covering the player's actual mount.
  a.group.visible=Math.hypot(P.pos.x-p[1],P.pos.z-p[2])>1.8;
  if(!reduced()&&!reducedSetting)for(let i=0;i<a.legs.length;i++)a.legs[i].rotation.x=Math.sin(elapsed*8+(i===0||i===3?0:Math.PI))*.22;
  pose={x:p[1],y,z:p[2],heading:p[4]};
 });
 function setEnabled(value){
  const preference=!!value;G.save.sync(s=>{const next=sanitizeGhostSave(s.rushGhost);next.enabled=preference;s.rushGhost=next;});refresh();
  if(!enabled())clearActor();return enabled();
 }
 function snapshot(){const records={},bests=G.ranchRush.snapshot().records;for(const [id,tape] of Object.entries(saved.records))records[id]={time:tape.time,samples:tape.samples.length,layout:tape.layout};
  return {enabled:enabled(),preference:saved.enabled,reducedMotion:reduced()||reducedSetting,recording:!!recording&&!recording.invalid,recordedSamples:recording?.samples.length||0,
   available:Object.entries(records).filter(([id,r])=>ghostMatches(saved.records[id],bests[id],r.layout)).map(([id,r])=>({id,time:r.time,points:r.samples})),active:replay&&current?{id:current.ev.id,time:replay.time,visible:!!actor?.group.visible,elapsed}:null,
   visible:!!actor?.group.visible,courseId:current?.ev?.id||null,playbackTime:elapsed,position:pose?{...pose}:null,records,lastSaved};}
 G.rushGhost={snapshot,setEnabled,toggle:()=>setEnabled(!enabled())};G.on('state',o=>{o.rushGhost=snapshot();});
}
