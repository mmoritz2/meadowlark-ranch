import {createCoatHemTransport} from './rider-coat-transport.js?v=tailored-coats69-20261010';
import {createOverallsUnderlapTransport} from './rider-overalls-underlap.js?v=character-polish-20261009';
// Shared posed-clothing endpoint. It runs before all beauty/shadow passes and
// never owns/disposes the rig's skeleton, garment materials, or cache geometry.
export function installClothingPose39(T,rig){
 if(rig.clothingPose)return rig;let driver=null,top=null,kind=null,dead=false,lastBones=null,lastInverse=null;const hooks=[],stats={creations:0,releases:0,applies:0,duplicateSkips:0,coldBuildMs:0,last:null};
 const oldHair=rig.updateHairMass,oldDispose=rig.dispose;
 function release(){if(driver){driver.dispose();for(const mesh of rig.outfit?.meshes||[])mesh.geometry.computeBoundingSphere();stats.releases++;}driver=null;top=null;kind=null;lastBones=null;lastInverse=null;for(const h of hooks){if(h.material.onBeforeCompile===h.hook){h.material.onBeforeCompile=h.previous;h.material.customProgramCacheKey=h.previousKey;h.material.needsUpdate=true;}}hooks.length=0;}
 function stableTextile(){const materials=new Map();for(const mesh of rig.outfit.meshes){const g=mesh.geometry;if(!g.attributes.qaClothingRest)g.setAttribute('qaClothingRest',new T.BufferAttribute(g.attributes.position.array.slice(),3));for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))materials.set(material,true);}for(const material of materials.keys()){const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey,hook=shader=>{previous.call(material,shader);let changed=false;for(const name of['vShowRest','vCottonRest','vBibRest','vWardrobeBind']){const re=new RegExp('\\b'+name+'\\s*=\\s*position\\s*;','g');if(re.test(shader.vertexShader)){shader.vertexShader=shader.vertexShader.replace(re,name+'=qaClothingRest;');changed=true;}}if(changed)shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 qaClothingRest;');};material.onBeforeCompile=hook;material.customProgramCacheKey=()=>previousKey.call(material)+'-immutable-clothing-rest39';material.needsUpdate=true;hooks.push({material,hook,previous,previousKey});}}
 function ensure(){const w=rig.connectedWardrobe,next=w?.family==='long-coat'?'coat':w?.family==='overalls'?'overalls':null;if(top===w?.top&&kind===next)return;if(driver||top)release();if(!next)return;const t0=performance.now();top=w.top;kind=next;driver=next==='coat'?createCoatHemTransport(T,rig,rig.kit):createOverallsUnderlapTransport(T,rig,rig.kit);stableTextile();stats.creations++;stats.coldBuildMs=performance.now()-t0;}
 function update(){if(dead)return null;ensure();if(!driver)return null;
  // updateMatrixWorld executes SkinnedMesh's Attached bind-inverse override.
  // Refresh ancestors first, then every bone/mesh, before updating boneMatrices.
  rig.root.updateWorldMatrix(true,false);rig.root.updateMatrixWorld(true);rig.body.skeleton.update();const bones=rig.body.skeleton.boneMatrices,inverse=rig.body.bindMatrixInverse.elements;
  if(lastBones&&lastBones.length===bones.length&&bones.every((v,i)=>v===lastBones[i])&&inverse.every((v,i)=>v===lastInverse[i])){stats.duplicateSkips++;return stats.last;}
  const q=driver.apply();stats.applies++;lastBones=bones.slice();lastInverse=inverse.slice();stats.last={kind,ms:q.ms,maxDeltaM:q.maxDeltaM,changed:q.changed??q.groups?.reduce((n,g)=>n+g.mapped,0),detailVertices:q.detailVertices??0};return stats.last;
 }
 rig.clothingPose={update,release,evidence:()=>({...stats,active:!!driver,kind,driverMetadata:driver?.metadata||null,disposed:dead}),get driver(){return driver;}};
 rig.updatePoseDetails=()=>{const q=update();oldHair?.call(rig);return q;};rig.updateHairMass=rig.updatePoseDetails;
 rig.dispose=()=>{if(dead)return;release();dead=true;oldDispose.call(rig);};update();return rig;
}
