import {configurePastoralCover,getPastoralCoverField,getPastoralCoverRevision,applyPastoralGrassMesh} from './pastoral-cover.mjs?v=pastoral-cover-1';

// Every original planting/capture/course and the accepted Chalk/ferry response
// finishes before grazing configuration. No constructor, RNG or admission read.
export function refreshPastoralCover(G){
 const W=G.world,field=getPastoralCoverField(),revision=getPastoralCoverRevision();if(!field)return null;
 if(W.pastoralCoverResponse?.revision===revision)return W.pastoralCoverResponse;
 const state={profile:field.profile,revision,fieldStats:field.stats,seed:applyPastoralGrassMesh(W.seedGrass,W.groundH,W.seedGrass?.instanceMatrix.count||0),static:[],flora:null,nearRefreshed:false,mixedRefreshed:false,blueRefreshed:false};
 state.flora=G.floraPkg?.refreshPastoralCover?.()||null;
 // Resident scanned tussocks are already grounded on the final live surface.
 // Keep their actual cell translation; no reseating or flower/fern/reed edits.
 G.scene.traverse(mesh=>{if(mesh.name!=='Trail edge | meadow tussocks'||!mesh.isInstancedMesh)return;mesh.updateWorldMatrix(true,false);const m=mesh.matrixWorld.elements;
  if([0,5,10,15].some(i=>Math.abs(m[i]-1)>1e-8)||[1,2,3,4,6,7,8,9,11].some(i=>Math.abs(m[i])>1e-8))throw Error('Unexpected pastoral static-cover parent transform');
  state.static.push({name:mesh.name,owner:mesh.uuid,changed:applyPastoralGrassMesh(mesh,W.groundH,mesh.count,m[12],m[14],m[13])});
 });
 const cover=W.nearGroundCover,p=G.horse.player.pos;cover?.invalidate?.();cover?.tick?.(0,p.x,p.z);state.nearRefreshed=!!cover;
 if(W.mixedSward){W.mixedSward.refreshEligibility();W.mixedSward.tick(0,p.x,p.z,true);state.mixedRefreshed=true;}
 const terrain=G.scene.getObjectByName('Pasture terrain');terrain?.material.userData.refreshGrazing?.();state.blueRefreshed=!!terrain?.material.userData.refreshGrazing;
 W.pastoralCoverResponse=state;return state;
}
export function installPastoralCoverRefresh(G){
 const W=G.world;if(W.pastoralCoverReady)return W.pastoralCoverReady;
 // Deferred promise capture matches actual synchronous installer order.
 W.pastoralCoverReady=Promise.resolve().then(()=>Promise.allSettled([
  G.photoscans?.floraRetirementReady,G.worldDetails?.ready,G.undergrowth?.ready,
  G.courseClear?.ready,W.mixedSward?.ready,W.chalkCoverReady,G.waterPkg?.ferryBankApproachReady,
  G.quartersPkg?.saplingsReady,G.worldPaths?.roadsideReady
 ])).then(()=>{
  const down=G.vistas?.chalkDown;
  // Exclude the whole physical sampled down, including uncut shoulders and its
  // exact finite boundary; this is broader than the grazing/glyph cut alone.
  const chalkAt=down?(x,z)=>Number.isFinite(down.heightAt(x,z)):()=>false;
  const marsh=G.quartersPkg?.willowmereArt?.landscape;
  const wetAt=(x,z)=>!!(G.quartersPkg?.pondContains(x,z)||(marsh&&marsh.shore(x,z)<3.1));
  configurePastoralCover({terrainH:W.terrainH,riverZ:W.riverZ,riverLevel:W.riverLevel,streamX:W.streamX,wetAt,chalkAt,forestPoints:W.forestPoints});
  return refreshPastoralCover(G);
 });return W.pastoralCoverReady;
}
