import {getChalkGrazingField,getChalkGrazingRevision,refreshChalkSeedMesh,applyChalkGrassMesh,applyChalkFlowerMesh} from './chalk-grazing.mjs?v=chalk-grazing-1';

// Existing owner rows finish planting/capture/clearing before this one response.
// No new render resource, scene constructor, source decision or RNG draw.
export function refreshChalkCover(G){
 const W=G.world,down=G.vistas?.chalkDown,field=getChalkGrazingField(),revision=getChalkGrazingRevision();
 if(!down||!field)return null;
 if(W.chalkCoverResponse?.revision===revision)return W.chalkCoverResponse;
 const state={profile:field.profile,revision,site:field.site,seed:refreshChalkSeedMesh(W.seedGrass,down,W),static:[],nearRefreshed:false,mixedRefreshed:false,blueRefreshed:false};
 // Course clearing has finished before this call: its original gather/mow
 // sees the unchanged static plant radius, and the response preserves zeros.
 state.flora=G.floraPkg?.refreshChalkGrazing?.()||null;
 // These named legacy/scanned owners use translation-only cell transforms.
 // Dynamic near/middle/mixed cover responds in its own source-copy path.
 for(const [name,flower,reseat]of [['Seeded pasture flower clumps',true,true],['Trail edge | meadow tussocks',false,false],['Trail garden | gazania',true,false]]){
  G.scene.traverse(mesh=>{if(mesh.name!==name||!mesh.isInstancedMesh)return;mesh.updateWorldMatrix(true,false);const m=mesh.matrixWorld.elements;
   if([0,5,10,15].some(i=>Math.abs(m[i]-1)>1e-8)||[1,2,3,4,6,7,8,9,11].some(i=>Math.abs(m[i])>1e-8))throw Error('Unexpected Chalk static-cover parent transform: '+name);
   const options={flower,reseat,offsetX:m[12],offsetZ:m[14],offsetY:m[13]};state.static.push({name,...refreshChalkSeedMesh(mesh,down,W,options)});
  });
 }
 // Refill original cells without resampling their hash roots, then retire the
 // old mixed classification cache and force the same counted-root plan.
 const cover=W.nearGroundCover,p=G.horse.player.pos;
 cover?.invalidate?.();cover?.tick?.(0,p.x,p.z);state.nearRefreshed=!!cover;
 if(W.mixedSward){W.mixedSward.refreshEligibility();W.mixedSward.tick(0,p.x,p.z,true);state.mixedRefreshed=true;}
 const terrain=G.scene.getObjectByName('Pasture terrain');terrain?.material.userData.refreshGrazing?.();state.blueRefreshed=!!terrain?.material.userData.refreshGrazing;
 W.chalkCoverResponse=state;return state;
}
export function installChalkCoverRefresh(G){
 const W=G.world;
 // Capture after synchronous installation, including late details/undergrowth
 // and the original course-clear boot timer. Scans never await this response.
 W.chalkCoverReady=Promise.resolve().then(()=>Promise.allSettled([
  G.photoscans?.floraRetirementReady,G.worldDetails?.ready,G.undergrowth?.ready,
  G.courseClear?.ready,W.mixedSward?.ready,G.quartersPkg?.saplingsReady,G.worldPaths?.roadsideReady
 ])).then(()=>refreshChalkCover(G));
 return W.chalkCoverReady;
}
