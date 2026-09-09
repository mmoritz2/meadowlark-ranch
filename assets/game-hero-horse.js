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
export function tickGameHero(rig,speed,dt,turn=0){
  const motion=rig.heroMotion;if(!motion)return null;
  rig.artistClock=(rig.artistClock||0)+dt;rig.skin.material.userData.update?.(rig.artistClock);
  let rate=1;
  if(rig.heroJumpAge!==null){
    rig.heroJumpAge+=dt;
    if(rig.heroJumpAge>=1.72)rig.heroJumpAge=null;
  }
  if(rig.heroJumpAge===null){
    const gait=speed<.15?'stand':speed<2.1?'walk':speed<4.15?'trot':speed<6?'canter':'gallop';
    motion.set(gait,{lead:turn<-.15?'right':'left'});
    if(gait!=='stand'){const scale=rig.profile.artistBreed?Math.max(.1,rig.scene.getWorldScale(rig.artistWorldScale).x):1;rate=Math.max(.3,Math.min(rig.profile.artistBreed?3:1.75,speed/((motion.gaits||HERO_GAITS)[gait].speed*scale)));}
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
