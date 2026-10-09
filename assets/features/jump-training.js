import {JUMP_TRAINING as D,createJumpAttempt,observeJumpAttempt,getJumpObstacle,getJumpGuide,jumpTrainingCue} from './jump-training-rules.mjs?v=jump-clinic-1';
export const id='jump-training';
// The drill owns its clock and durable reward. This controller owns only the
// riding exercise: four forgiving low rails, two laps, and actual jump/landing proof.
export function install(G){
 const T=G.THREE,H=G.horse,P=H.player,W=G.world;let active=null,art=null;
 function canStart(){
  const rig=H.RIG?.(),p=rig?.profile,h=H.ridden?.();
  if(h?.wings||p?.nativeCanFly||rig?.nativeCanFly||rig?.nativeFantasy?.pair||rig?.fantasyAppearance?.wings)return false;
  if(p?.nativeBreed||p?.referenceMotion)return !!p.nativeJump;
  return !h?.dragon;
 }
 function label(text){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#244c3b';ctx.beginPath();ctx.arc(64,64,54,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f2d59b';ctx.lineWidth=5;ctx.stroke();ctx.font='600 66px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff7e3';ctx.fillText(text,64,68);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false}));sprite.scale.set(.72,.72,1);return sprite;
 }
 function makeArt(){
  const group=new T.Group();group.name='Meadowlark jumping clinic';
  const timber=new T.MeshStandardMaterial({color:0xe8ddc7,roughness:.92}),green=new T.MeshStandardMaterial({color:0x416750,roughness:.84}),white=new T.MeshStandardMaterial({color:0xf7eee0,roughness:.9}),red=new T.MeshStandardMaterial({color:0xac5540,roughness:.9});
  const fences=[];
  for(let i=0;i<4;i++){
   const d=getJumpObstacle(i),fence=new T.Group();fence.name='Clinic fence '+(i+1);fence.position.set(d.x,W.groundH(d.x,d.z),d.z);fence.rotation.y=d.heading;
   const box=(w,h,dep,mat,x,y,z,parent=fence)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,dep),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
   for(const side of [-1,1]){const x=side*(D.railWidth/2+.18);box(.14,.85,.14,timber,x,.425,0);box(.55,.09,.65,green,x,.045,0);box(.18,.055,.18,green,x,.81,0);box(.30,.19,.045,side<0?white:red,x,.98,0);}
   const rail=new T.Group();rail.position.y=D.railHeight;fence.add(rail);
   for(let n=0;n<12;n++)box(D.railWidth/12+.003,.11,.11,n%2?timber:green,-D.railWidth/2+(n+.5)*D.railWidth/12,0,0,rail);
   const number=label(String(i+1));number.position.set(-D.railWidth/2-.5,1.4,0);fence.add(number);group.add(fence);fences.push({fence,rail,number});
  }
  const markerMat=new T.MeshBasicMaterial({color:0xf1d48c,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false});
  const marker=new T.Mesh(new T.RingGeometry(.85,1.04,48),markerMat);marker.rotation.x=-Math.PI/2;group.add(marker);
  const bandMat=new T.MeshBasicMaterial({color:0xf1d48c,transparent:true,opacity:.30,side:T.DoubleSide,depthWrite:false});
  const band=new T.Mesh(new T.PlaneGeometry(D.railWidth,1.7),bandMat);band.rotation.x=-Math.PI/2;group.add(band);
  const lineGeometry=new T.BufferGeometry();lineGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(18),3));
  const line=new T.LineSegments(lineGeometry,new T.LineBasicMaterial({color:0xf0d49e,transparent:true,opacity:.65,depthWrite:false}));line.frustumCulled=false;group.add(line);
  G.scene.add(group);art={group,fences,marker,band,line};
 }
 function stop(){
  active=null;if(!art)return;G.scene.remove(art.group);const geometries=new Set(),materials=new Set(),textures=new Set();
  art.group.traverse(o=>{if(o.geometry&&o.isMesh)geometries.add(o.geometry);if(o===art.line)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);if(m.map)textures.add(m.map);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());art=null;
 }
 function start(){stop();const lift=H.RIG?.()?.profile?.nativeJump?.actorLiftM||[],peak=lift.reduce((best,p)=>p[1]>best[1]?p:best,[.65,0]);active={peakS:peak[0],cleared:0,misses:0,attempt:createJumpAttempt(0,{x:P.pos.x,z:P.pos.z}),lastFeedback:'',feedbackTime:0};makeArt();paint(snapshot());}
 function coach(){
  if(!active||active.cleared>=D.total)return {cue:'Eight jumps landed. Well ridden.',guide:null,obstacle:null};
  const a=active.attempt,d=getJumpObstacle(active.cleared),guide=getJumpGuide(active.cleared,a,P.pos),fx=Math.sin(d.heading),fz=Math.cos(d.heading),dx=d.x-P.pos.x,dz=d.z-P.pos.z;
  const distance=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx),speed=Math.abs(P.speed),takeoffDistance=Math.max(1.6,Math.min(8.5,speed*active.peakS));
  const angle=Math.cos(P.heading-d.heading),inWindow=distance>=Math.max(.9,takeoffDistance-.8)&&distance<=takeoffDistance+.8&&lateral<1.8&&angle>.8&&speed>1.2;
  const rig=H.RIG?.(),jumping=rig?.heroJumpAge!=null||P.y>.04;
  let cue=jumpTrainingCue(a);
  if(!jumping&&a.phase!=='retry'&&distance>0&&lateral<1.8&&angle>.8){
   cue=inWindow?'Jump now — Space or the Jump button.':distance>takeoffDistance+.8?'Stay straight at a trot. Ask for a jump in the gold band.':'Late approach — circle back and try again.';
  }
  if(active.feedbackTime>0)cue=active.lastFeedback+' '+cue;
  return {cue,guide,obstacle:{...d,number:active.cleared%4+1,lap:Math.floor(active.cleared/4)+1},takeoffDistance,inWindow};
 }
 function snapshot(){return active?{...coach(),cleared:active.cleared,misses:active.misses,phase:active.attempt?.phase,lastFeedback:active.lastFeedback}:null;}
 function paint(s){
  if(!art||!s)return;const d=s.obstacle,g=s.guide;
  art.marker.visible=!!g;art.band.visible=!!d;
  art.fences.forEach((f,i)=>{f.number.material.opacity=d&&i===active.cleared%4?1:.48;f.rail.position.y=i===active.cleared%4&&active.attempt.phase==='retry'?.10:D.railHeight;});
  if(g)art.marker.position.set(g.x,W.groundH(g.x,g.z)+.06,g.z);
  if(d){const fx=Math.sin(d.heading),fz=Math.cos(d.heading),bx=d.x-fx*s.takeoffDistance,bz=d.z-fz*s.takeoffDistance;art.band.position.set(bx,W.groundH(bx,bz)+.065,bz);art.band.rotation.set(-Math.PI/2,0,-d.heading);art.band.material.color.setHex(s.inWindow?0xb7de8d:0xf1d48c);}
  const values=art.line.geometry.attributes.position.array;let n=0;
  if(g){const targets=[{x:P.pos.x,z:P.pos.z},g];if(d&&Math.hypot(g.x-d.x,g.z-d.z)>.2)targets.push(d);
   for(let i=1;i<targets.length;i++)for(const v of [targets[i-1],targets[i]]){values[n++]=v.x;values[n++]=W.groundH(v.x,v.z)+.07;values[n++]=v.z;}}
  art.line.geometry.setDrawRange(0,n/3);art.line.geometry.attributes.position.needsUpdate=true;
 }
 function tick(dt,paused=false){
  if(!active)return null;if(!paused&&dt<=0){const s=snapshot();paint(s);return {...s,credited:false};}const rig=H.RIG?.(),jumpActive=rig?.heroJumpAge!=null||P.y>.04||Math.abs(P.vy||0)>.05;
  const result=observeJumpAttempt(active.attempt,{position:{x:P.pos.x,z:P.pos.z},dt,speed:P.speed,height:P.y||0,jumpActive,grounded:!jumpActive&&P.y<=.03,paused});
  if(!paused)active.feedbackTime=Math.max(0,active.feedbackTime-dt);
  if(result.missed){active.misses++;active.lastFeedback='No penalty. Circle back for another approach.';active.feedbackTime=2.2;}
  if(result.credited){active.cleared++;active.lastFeedback='Clean jump and landing!';active.feedbackTime=2.2;if(active.cleared<D.total)active.attempt=createJumpAttempt(active.cleared,{x:P.pos.x,z:P.pos.z});}
  const s=snapshot();paint(s);return {...s,credited:!!result.credited};
 }
 G.jumpTraining={definition:D,canStart,start,stop,tick,snapshot};
}
