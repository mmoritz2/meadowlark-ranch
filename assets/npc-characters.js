/* Nearby townspeople reuse the game's CC0 Quaternius rider bodies, clothes and native clips.
   This helper never changes the interactable root, quest data, labels or collision geometry. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const npcAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const NAMED={
 wren:{body:'m',outfit:'canvas',hairStyle:'beard',hair:'#bdb7ad',skin:'#c99774',eyes:'grey',shirt:'#8a6745',pants:'#46515f',scale:1.01},
 june:{body:'f',outfit:'cardigan',hairStyle:'bun',hair:'#6c5348',skin:'#c48e6d',eyes:'hazel',shirt:'#b0685c',pants:'#534e55',scale:.97},
 ada:{body:'f',outfit:'gingham',hairStyle:'braid',hair:'#392923',skin:'#aa7151',eyes:'brown',shirt:'#6887a3',pants:'#485e6c',scale:1},
 otto:{body:'m',outfit:'overalls',hairStyle:'crop',hair:'#684a35',skin:'#cd9a72',eyes:'green',shirt:'#d0b88a',pants:'#506b7e',scale:1.04},
 bea:{body:'f',outfit:'western',hairStyle:'ponytail',hair:'#352b24',skin:'#a57155',eyes:'amber',shirt:'#b06a3a',pants:'#3f4145',scale:1.02},
 ilse:{body:'f',outfit:'alpine',hairStyle:'long',hair:'#d5c4a0',skin:'#e5b695',eyes:'blue',shirt:'#746489',pants:'#50566c',scale:1},
 bram:{body:'m',outfit:'denim',hairStyle:'short',hair:'#342721',skin:'#9b6549',eyes:'darkbrown',shirt:'#5c688a',pants:'#615246',scale:1.03},
 saddler:{body:'m',outfit:'canvas',hairStyle:'beard',hair:'#614331',skin:'#c28c64',eyes:'hazel',shirt:'#927451',pants:'#514a3f',scale:1.01},
 hesper:{body:'f',outfit:'flannel',hairStyle:'ponytail',hair:'#7d472a',skin:'#deb18d',eyes:'green',shirt:'#628269',pants:'#4b5564',scale:1.02},
 rook:{body:'m',outfit:'cable',hairStyle:'beard',hair:'#a9a6a0',skin:'#b78260',eyes:'grey',shirt:'#80735e',pants:'#4c5260',scale:.99},
 tamsin:{body:'f',outfit:'safari',hairStyle:'bun',hair:'#31251f',skin:'#976446',eyes:'brown',shirt:'#bd7047',pants:'#536148',scale:1.01},
 marta:{body:'f',outfit:'canvas',hairStyle:'bun',hair:'#69574c',skin:'#ce9a78',eyes:'hazel',shirt:'#b49b60',pants:'#5e6957',scale:.99},
 stallkeep:{body:'m',outfit:'tweed',hairStyle:'short',hair:'#453628',skin:'#c39272',eyes:'olive',shirt:'#746785',pants:'#4d4559',scale:1.02},
};
export function npcAppearance(def={}){
 const n=hash(def.id||def.name||'npc'),body=(n&1)?'f':'m';
 const fallback={body,outfit:['flannel','canvas','denim','cable','western','gingham'][n%6],
  hairStyle:body==='m'?['short','crop','beard'][n%3]:['ponytail','bun','braid','long'][n%4],
  hair:['#382a22','#71513a','#b49c72','#8a4b30','#aaa398'][n%5],
  skin:['#d9a780','#ae7958','#956347','#e1b496','#bd8966'][n%5],
  eyes:['brown','hazel','green','grey'][n%4],shirt:def.shirt||'#718472',pants:['#4b5b6b','#625548','#49484e'][n%3],scale:.98+(n%6)*.01};
 return {...fallback,...NAMED[def.id],helmet:'none',boots:'#49382b',eyewear:'none',earrings:'none',neckwear:'none'};
}
export function npcUpdateInterval(distance,talking=false){return talking?1/30:distance<18?1/30:distance<38?1/15:1/6;}

export function createNPCCharacters({THREE,riderLibrary,limit=12,buildRadius=55,keepRadius=85,onError=console.warn}){
 const records=new Map();let pending=null,disposed=false,clock=0;
 const axis=new THREE.Vector3(),q=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
 const sole=new THREE.Vector3(),parentInverse=new THREE.Matrix4();
 // A small support polygon from the existing boot soles keeps both body types grounded.
 function soleSamples(rig){
  const samples=[];
  for(const mesh of rig.outfit?.meshes||[]){if(!/Feet/.test(mesh.name))continue;const p=mesh.geometry.attributes.position,chosen=new Set();
   for(const side of [-1,1]){let low=Infinity;for(let i=0;i<p.count;i++)if(p.getX(i)*side>=0)low=Math.min(low,p.getY(i));
    for(let k=0;k<8;k++){const a=k*Math.PI/4;let best=-Infinity,index=-1;
     for(let i=0;i<p.count;i++){if(p.getX(i)*side<0||p.getY(i)>low+.025)continue;const score=p.getX(i)*Math.cos(a)+p.getZ(i)*Math.sin(a)-p.getY(i)*.5;if(score>best){best=score;index=i;}}
     if(index>=0)chosen.add(index);}}
   if(chosen.size)samples.push({mesh,indices:[...chosen]});
  }return samples;
 }
 function groundSoles(r){
  if(!r.soles?.length)return;parentInverse.copy(r.entry.g.matrixWorld).invert();let low=Infinity;
  for(const {mesh,indices} of r.soles){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,sole).applyMatrix4(mesh.matrixWorld).applyMatrix4(parentInverse);low=Math.min(low,sole.y);}}
  if(Number.isFinite(low)){r.rig.root.position.y+=.003-low;r.rig.root.updateMatrixWorld(true);}
 }
 const turnWorld=(bone,angle)=>{
  if(!bone||Math.abs(angle)<1e-5)return;
  q.setFromAxisAngle(axis,angle);bone.getWorldQuaternion(worldQ).premultiply(q);
  bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(worldQ));bone.updateMatrixWorld(true);
 };
 function register(entry){
  if(!entry?.g||entry.def?.rider||records.has(entry))return;
  records.set(entry,{entry,fit:npcAppearance(entry.def),fallback:entry.g.children.filter(c=>!c.isSprite),rig:null,
   failed:false,phase:(hash(entry.def.id)%1000)/1000,elapsed:0,talk:0,turn:0,distance:Infinity,
   lastX:entry.g.position.x,lastZ:entry.g.position.z,speed:0,lastSeen:clock});
 }
 function updateShadows(r){
  const near=r.distance<=28;if(r.shadowed===near)return;r.shadowed=near;
  for(const {mesh,castShadow} of r.shadowMeshes||[])mesh.castShadow=near&&castShadow;
 }
 function release(r){
  if(!r.rig)return;
  const skeletons=new Set();r.rig.root.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)skeletons.add(o.skeleton);});
  r.rig.root.removeFromParent();r.rig.dispose();for(const s of skeletons)s.dispose();r.rig=null;r.soles=null;r.shadowMeshes=null;r.shadowed=undefined;
  for(const child of r.fallback)child.visible=true;
 }
 function pose(r,dt,talking,player){
  const rig=r.rig;if(!rig)return;
  r.talk+=(Number(talking)-r.talk)*(1-Math.exp(-dt*5));
  const movement=clamp(r.speed/.65,0,1),tw=r.talk*(1-movement);
  rig.action('idle').setEffectiveWeight((1-movement)-tw);
  rig.action('talk')?.setEffectiveWeight(tw);
  const walk=rig.action('walk');if(walk){walk.setEffectiveWeight(movement);walk.timeScale=clamp(r.speed/1.3,.55,1.5);}
  rig.mixer.update(dt);
  const g=r.entry.g,desired=player?npcAngle(Math.atan2(player.x-g.position.x,player.z-g.position.z)-g.rotation.y):0;
  // Walking folk retain their path heading. Only a stationary speaker turns their whole body.
  const want=talking&&!r.entry.def.folk?desired:0;
  r.turn+=clamp(npcAngle(want-r.turn),-dt*1.25,dt*1.25);rig.root.rotation.y=r.turn;
  rig.root.updateMatrixWorld(true);
  const idleWeight=(1-movement)*(1-r.talk);
  if(idleWeight>.001){
   rig.root.getWorldQuaternion(worldQ);axis.set(0,0,1).applyQuaternion(worldQ);
   for(const [name,side,a] of [['upperarm_l',1,.20],['upperarm_r',-1,.20],['thigh_l',1,.055],['thigh_r',-1,.055],['foot_l',1,-.055],['foot_r',-1,-.055]])turnWorld(rig.bones[name],-side*a*idleWeight);
  }
  for(const [name,rest] of rig.kit.seat.relax){const b=rig.bones[name];if(b)b.quaternion.slerp(rest,.85);}
  if(r.distance<7&&player){
   const look=clamp(npcAngle(desired-r.turn),-.7,.7);
   axis.set(0,1,0);turnWorld(rig.bones.neck_01,look*.25);turnWorld(rig.bones.Head,look*.5);
  }
  rig.root.updateMatrixWorld(true);groundSoles(r);
 }
 async function build(r){
  pending=r;
  try{
   const kit=await riderLibrary.kit(r.fit.body);
   await riderLibrary.outfitFor(kit,r.fit.outfit);
   if(disposed||r.distance>keepRadius)return;
   const rig=riderLibrary.build(kit,r.fit);r.rig=rig;
   rig.root.name='npc-character-'+r.entry.def.id;rig.root.scale.setScalar(r.fit.scale);
   const idle=rig.action('idle'),talk=rig.action('talk'),walk=rig.action('walk');
   if(!idle||!talk||!walk)throw new Error('NPC requires the existing idle, talk and walk clips');
   for(const a of [idle,talk,walk])a.time=r.phase*a.getClip().duration;
   // Cached clothing promises attach in the next microtask; never reveal a bare intermediary.
   await Promise.resolve();
   if(disposed){release(r);return;}
   r.entry.g.add(rig.root);pose(r,.001,false,null);
   r.soles=soleSamples(rig);groundSoles(r);
   r.shadowMeshes=[];rig.root.traverse(mesh=>{if(mesh.isMesh)r.shadowMeshes.push({mesh,castShadow:mesh.castShadow});});updateShadows(r);
   for(const child of r.fallback)child.visible=false;
  }catch(error){release(r);r.failed=true;onError('NPC character unavailable; keeping original '+r.entry.def.id,error);}
  finally{pending=null;}
 }
 function update(dt,{entries=[],player,ready=false,talkingId=null}={}){
  if(disposed||!player)return;
  dt=clamp(Number.isFinite(dt)?dt:0,0,.25);clock+=dt;
  for(const entry of entries)register(entry);
  let active=0,best=null,furthest=null;
  for(const r of records.values()){
   const p=r.entry.g.position;r.distance=Math.hypot(player.x-p.x,player.z-p.z);
   const moved=Math.hypot(p.x-r.lastX,p.z-r.lastZ);r.lastX=p.x;r.lastZ=p.z;
   // A warp or an external root reset is not a sprint animation.
   const speed=dt>0&&moved<2?moved/dt:0;r.speed+=(speed-r.speed)*(1-Math.exp(-dt*10));
   if(r.distance<keepRadius)r.lastSeen=clock;
   if(r.rig){
    if(r.distance>keepRadius&&clock-r.lastSeen>3){release(r);continue;}
    updateShadows(r);active++;if(!furthest||r.distance>furthest.distance)furthest=r;
    r.rig.root.visible=r.entry.g.visible&&r.distance<keepRadius;
    r.elapsed+=dt;const talking=talkingId===r.entry.def.id;
    if(r.distance<keepRadius&&r.elapsed>=npcUpdateInterval(r.distance,talking)){
     pose(r,Math.min(r.elapsed,.25),talking,player);r.elapsed=0;
    }
   }else if(ready&&!r.failed&&r!==pending&&r.distance<buildRadius&&(!best||r.distance<best.distance))best=r;
  }
  if(ready&&!pending&&best){
   if(active>=limit&&furthest&&furthest.distance>best.distance+12){release(furthest);active--;}
   if(active<limit)void build(best);
  }
 }
 return {update,get:id=>[...records.values()].find(r=>r.entry.def.id===id)?.rig||null,
  stats:()=>({registered:records.size,active:[...records.values()].filter(r=>r.rig).length,pending:pending?.entry.def.id||null,
   failed:[...records.values()].filter(r=>r.failed).map(r=>r.entry.def.id)}),
  dispose(){disposed=true;for(const r of records.values())release(r);records.clear();}};
}
