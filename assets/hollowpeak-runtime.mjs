// The canonical field is installed before derived world construction. Existing
// source layout decisions finish before this cohort replaces support and solids.
export {prepareHollowpeakRuntime} from './hollowpeak-field-runtime.mjs';
import {installHollowpeakHydrology} from './hollowpeak-hydrology.mjs';
import {installHollowpeakTerrainCollision} from './hollowpeak-terrain-collision.mjs';

export async function finishHollowpeakRuntime({G,FALLS,runtime}){
 const W=G.world,L=W.fallsLandscape;
 if(runtime.status!=='field-ready'||L.ownedQueries!==runtime.queries||W.hollowpeakDecisionHeightAt!==runtime.construction.heightAt)throw Error('Hollowpeak source phase lost its early query/reference owner');
 runtime.status='waiting-source-layout';
 // These remain the original layout/construction chains. New terrain solids
 // must not influence their source admission or refill capped outside slots.
 await Promise.all([W.hollowpeakShoreReady,G.photoscans?.hollowpeakCohortReady,G.photoscans?.countrysideVistaReady,G.photoscans?.mediumCanopyReady]);
 if(W.hollowpeakShoreError||W.hollowpeakShore?.status!=='ready')throw Error('Hollowpeak original source shore did not finish');
 const ecology=G.photoscans?.hollowpeakCohort;
 if(!ecology||ecology.status!=='applied')throw Error('Hollowpeak tree owner cohort did not finish');
 let hydrology,collision;
 try{
  hydrology=installHollowpeakHydrology({G,FALLS,heights:runtime.heights,...runtime.payload,queries:runtime.queries});
  collision=installHollowpeakTerrainCollision({THREE:G.THREE,W,landscape:L,heights:runtime.heights,segments:512,step:1000/512,originX:-500,originZ:-500,bounds:runtime.queries.design.design.bounds,sourceID:runtime.payload.finalFieldSHA256});
  collision.replaceLegacyBarriers();hydrology.activate();
 }catch(error){collision?.dispose();hydrology?.rollback();runtime.status='failed';throw error;}
 runtime.ecology=ecology;runtime.hydrology=hydrology;runtime.collision=collision;runtime.status='ready';
 W.hollowpeakRuntime=runtime;
 return runtime;
}
