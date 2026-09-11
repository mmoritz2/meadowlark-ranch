import {createArtistMotion,ARTIST_GAITS} from './artist-horse-motion.js?v=artist-breeds-1';
import {finishHeroCoat} from './hero-horse-coat.js?v=hero-ranch-1';
import {createHeroHorseGroom} from './hero-horse-groom.js?v=hero-ranch-1';
import {createHeroMotion,HERO_GAITS} from './hero-horse-motion.js?v=hero-motion-20260908-4';

// Adapts the approved raw-space hero to the ranch's +Z-forward mount space.
// Existing horse models continue using their own renderer and animation path.
export function initGameHero(THREE,rig){
  if(rig.profile?.artistBreed){rig.heroMotion=createArtistMotion({THREE,root:rig.scene,skin:rig.skin,heightM:rig.profile.heightM});rig.heroJumpAge=null;rig.heroJumpExtra=0;rig.heroSeat=new THREE.Vector3();rig.artistClock=0;rig.artistWorldScale=new THREE.Vector3();return;}
  if(!rig.profile?.hero)return;
  rig.heroMaterial=finishHeroCoat({THREE,scene:rig.scene});
  rig.heroMotion=createHeroMotion({THREE,root:rig.scene,skin:rig.skin,heightM:rig.profile.heightM});
  rig.heroJumpAge=null;rig.heroJumpExtra=0;
  rig.heroSeat=new THREE.Vector3();
}
export function disposeMountedRig(rig){
  (rig.groom||rig.hair)?.dispose?.();
  const skeletons=new Set();rig.scene?.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)skeletons.add(o.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
  rig.heroMaterial?.dispose();
  for(const material of rig.materials||[])material.dispose();
  rig.fantasyMaterial?.dispose();
  rig.scene?.traverse(o=>{if(o.name==='ArtistDragonCrest'){o.geometry.dispose();o.material.dispose();}});
}
export function heroGroomFacade({THREE,skin,bones,mount,profile}){
  let groom=null,disposed=false;
  const facade={mane:null,tail:null,stats:null,
    setColors(){}, // Keep the approved bay's natural black hair.
    update(dt,state){groom?.update(dt,state);},reset(){groom?.reset();},
    dispose(){disposed=true;groom?.dispose();}};
  facade.ready=createHeroHorseGroom({THREE,skin,bones,mount,profile,anchors:profile.anchors,
    maneColor:'#221b16',tailColor:'#221b16',seed:'hero-bay'}).then(g=>{
      if(disposed){g.dispose();return;}groom=g;facade.mane=g.mane;facade.tail=g.tail;facade.stats=g.stats;
    }).catch(e=>console.warn('Bay sporthorse groom unavailable',e));
  return facade;
}
export function startGameHeroJump(rig){
  if(!rig.heroMotion||rig.heroJumpAge!==null)return false;
  rig.heroJumpAge=0;rig.heroMotion.set('jump');return true;
}
/* The authored jump gathers for 0.38 s before it leaves the ground and plays out to 1.72 s,
   the last half second of which is the horse standing on its own feet again. Measured from
   the button: 0.40 s before anything visibly rose, and 1.73 s before the game would take
   another press. That is what "it takes a very long time to respond" is.
   The clip's timing is authored and stays. What changes is the clock it runs on: the gather
   runs quick, the landing runs quick, and the game lets go of the jump at 1.20 s — on its
   feet, straight back into the live gait — rather than idling to the end of the clip and
   then crossfading through 'stand'. */
const JUMP_GATHER_RATE=1.9,JUMP_LAND_RATE=1.35,JUMP_RELEASE=1.20,JUMP_GRACE=0.35;
function jumpClockRate(age){return age<.38?JUMP_GATHER_RATE:age<1.16?1:JUMP_LAND_RATE;}
export function tickGameHero(rig,speed,dt,turn=0){
  const motion=rig.heroMotion;if(!motion)return null;
  rig.artistClock=(rig.artistClock||0)+dt;rig.skin.material.userData.update?.(rig.artistClock);
  let rate=1;
  if(rig.heroJumpGrace>0)rig.heroJumpGrace=Math.max(0,rig.heroJumpGrace-dt);
  if(rig.heroJumpAge!==null){
    /* the jump age and the clip advance on the same clock, so the lift the game applies
       stays in step with the lift the skeleton shows */
    const jr=jumpClockRate(rig.heroJumpAge);rig.heroJumpAge+=dt*jr;rate=jr;rig.heroRate=jr;
    /* and a rail stays open for a moment after she is back on her feet, so the quicker
       gather does not make the fences any less forgiving than they were */
    if(rig.heroJumpAge>=JUMP_RELEASE){rig.heroJumpAge=null;rig.heroJumpGrace=JUMP_GRACE;}
  }
  if(rig.heroJumpAge===null){
    /* Gait with hysteresis: a horse that has just broken into a trot does not fall back
       to a walk because its speed dipped a hair under the line it crossed. */
    const up=speed<.15?0:speed<2.1?1:speed<4.15?2:speed<6?3:4, down=speed<.08?0:speed<1.7?1:speed<3.6?2:speed<5.4?3:4;
    const prev=rig.heroGaitIdx??up;const idx=up>prev?up:down<prev?down:prev;rig.heroGaitIdx=idx;
    const gait=['stand','walk','trot','canter','gallop'][idx];
    /* Lead with hysteresis too. Every steer past a quarter-turn used to swap the lead, and
       a swap re-phases all four legs through a fresh crossfade — so wiggling the reins at
       a canter made the horse stumble every time. It now takes a committed turn to change,
       and the lead is kept until the turn is well and truly over. */
    const lead=rig.heroLead||'left';
    rig.heroLead=turn<-.32?'right':turn>-.08?'left':lead;
    motion.set(gait,{lead:rig.heroLead});
    if(gait!=='stand'){const scale=rig.profile.artistBreed?Math.max(.1,rig.scene.getWorldScale(rig.artistWorldScale).x):1;rate=Math.max(.3,Math.min(rig.profile.artistBreed?3:1.75,speed/((motion.gaits||HERO_GAITS)[gait].speed*scale)));}
    /* The animation clock is the actual speed over the gait's nominal speed, and it used to
       jump at every gait change — walk to trot at 2.1 m/s took it from 1.76x to 0.68x in one
       frame, so the outgoing legs stalled mid-swing while the blend had barely begun. The
       clock now eases between rates over a few frames; the crossfade covers the rest. */
    rig.heroRate=rig.heroRate===undefined?rate:rig.heroRate+(rate-rig.heroRate)*Math.min(1,dt*7);
    rate=rig.heroRate;
  }
  motion.setTurn(turn);motion.update(dt*rate);
  const state=motion.state;rig.phase=state.phase01;
  // Physics and the render skeleton share the approved jump timing. Only the
  // extra fence-clearance lift belongs on the mount; skeletal lift stays in bones.
  const u=rig.heroJumpAge===null?0:Math.max(0,Math.min(1,(rig.heroJumpAge-.38)/.78));
  rig.heroJumpExtra=rig.heroJumpAge!==null?Math.sin(Math.PI*u)**2*.36:0;
  (rig.groom||rig.hair)?.update?.(dt,{...state,speedMps:speed});
  return state;
}
export function gameHeroSeat(rig,mount){
  if(!rig.heroMotion||!mount)return null;
  const v=rig.heroSeat,skin=rig.skin,bone=rig.profile.artistBreed?rig.bones.find(b=>b.name==='spine'):rig.bones[2],index=rig.bones.indexOf(bone),a=rig.profile.anchors.saddle[0];
  rig.scene.updateWorldMatrix(true,true);
  v.fromArray(a).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]).applyMatrix4(bone.matrixWorld);
  return mount.worldToLocal(v);
}

// The approved groom is already skinned into each GLB; never overlay the old
// generated hair cards or recolour the natural breed's authored groom.
export function artistGroomFacade({THREE,skin,mount}){
  let scene=skin;while(scene.parent&&scene.parent!==mount)scene=scene.parent;
  const meshes=[];scene.traverse(o=>{if(o.isMesh&&(/HorseGroom|Groom|Feather/i.test(o.name)||/HorseGroom|Groom/.test(o.parent?.name||'')))meshes.push(o);});
  const group={get visible(){return meshes.some(m=>m.visible);},set visible(v){for(const m of meshes)m.visible=v;}};
  function setColors({maneColor,tailColor,maneOverride=false,tailOverride=false}={}){
    for(const mesh of meshes){
      const geo=mesh.geometry,indices=geo.attributes.skinIndex,weights=geo.attributes.skinWeight;
      if(!geo.attributes.artistTail){const mask=new Float32Array(indices.count);for(let i=0;i<mask.length;i++)for(let j=0;j<4;j++)if(/^tail/.test(mesh.skeleton.bones[indices.getComponent(i,j)]?.name||''))mask[i]+=weights.getComponent(i,j);geo.setAttribute('artistTail',new THREE.BufferAttribute(mask,1));}
      for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        let dye=mat.userData.artistGroomDye;
        if(!dye){
          dye=mat.userData.artistGroomDye={mane:new THREE.Color(),tail:new THREE.Color(),maneOverride:0,tailOverride:0,uniforms:null};
          const previous=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{previous.call(mat,shader);const u=shader.uniforms;u.artistManeDye={value:dye.mane};u.artistTailDye={value:dye.tail};u.artistManeOn={value:dye.maneOverride};u.artistTailOn={value:dye.tailOverride};dye.uniforms=u;
            shader.vertexShader='attribute float artistTail;varying float artistTailMask;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nartistTailMask=artistTail;');
            shader.fragmentShader='uniform vec3 artistManeDye;uniform vec3 artistTailDye;uniform float artistManeOn;uniform float artistTailOn;varying float artistTailMask;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat dyeMask=smoothstep(0.15,0.7,artistTailMask);diffuseColor.rgb=mix(diffuseColor.rgb,mix(artistManeDye,artistTailDye,dyeMask),mix(artistManeOn,artistTailOn,dyeMask));');
          };mat.customProgramCacheKey=()=> 'artist-groom-dye-v1';mat.needsUpdate=true;
        }
        dye.mane.set(maneColor||'#332214');dye.tail.set(tailColor||maneColor||'#332214');dye.maneOverride=maneOverride?1:0;dye.tailOverride=tailOverride?1:0;
        if(dye.uniforms){dye.uniforms.artistManeOn.value=dye.maneOverride;dye.uniforms.artistTailOn.value=dye.tailOverride;}
      }
    }
  }
  return {mane:group,tail:group,setColors,update(){},reset(){},dispose(){},stats:{authored:true,meshes:meshes.length}};
}
