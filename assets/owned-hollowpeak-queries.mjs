// Artifact-only binding for one shared final field, finite water and shore.
// This module does not load, render, register, dispose or mutate world owners.
import {createHollowpeakDesign} from './hollowpeak-design.mjs';
import {createShoreContact} from './canonical-water-fit.mjs';

export function createOwnedHollowpeakQueries(options){
 const {shoreGeometry}=options;
 if(!(shoreGeometry?.position instanceof Float32Array)||!(shoreGeometry.index instanceof Uint32Array)||!(shoreGeometry.owners instanceof Uint16Array))
  throw new TypeError('Bind the same final typed shore geometry used by its single renderer');
 if(shoreGeometry.position.length%3||shoreGeometry.index.length%3||shoreGeometry.owners.length!==shoreGeometry.index.length)
  throw new RangeError('Shore triangle and canonical-owner arrays must correspond');
 if(!Array.isArray(options.waterTriangles))throw new TypeError('Actual fitted finite water triangles are required');
 const design=createHollowpeakDesign(options),shoreContact=createShoreContact(shoreGeometry);
 // Two-argument height callback for ONE groundSurfaces entry. It reports only
 // the emitted shore; outside its finite mesh it returns -Infinity.
 const surfaceHeightAt=(x,z,established=-Infinity)=>Math.max(established,shoreContact(x,z));
 // CPU/support helper only. At runtime groundH remains authoritative because
 // it also includes existing bridges and other registered finite owners.
 const ownedSupportHeightAt=(x,z)=>Math.max(design.heightAt(x,z),shoreContact(x,z));
 const waterAt=(x,z,settings={},out={})=>design.waterAt(x,z,{groundAt:ownedSupportHeightAt,...settings},out);
 return Object.freeze({
  profile:'hollowpeak-owned-query-binding-2',design,shoreGeometry,shoreContact,
  surfaceHeightAt,ownedSupportHeightAt,waterAt,
  waterFootprintAt:design.waterFootprintAt,
  containsFallEnvelope:design.containsFallEnvelope,
  excludesPlants:design.excludesPlants,
  ecologyAt:design.ecologyAt,
  affectsFootprint:design.affectsFootprint,
  ownership:Object.freeze({
   shore:'One supplied typed mesh is shared by its renderer and this sole contact callback; replace the old Hollowpeak shore owner together.',
   support:'Pass the actual runtime groundH to waterAt({groundAt}) for actors. ownedSupportHeightAt includes only this canonical field and owned shore.',
   wet:'Only bound actual fitted finite water triangles define water surface and swimming candidates; padding is exclusion only.',
   fall:'Declared design envelope is a preliminary exclusion, not the moving waterfall mesh or collision clearance.',
   field:'Caller owns the complete final Float32 field and must install it before derived terrain/model construction.',
   lifecycle:'No callbacks or meshes are installed here; the runtime owner must register once and remove that same entry on disposal.',
  }),
  registered:false,bodyAdmission:false,treeFootCohortAccepted:false,fallMotionAccepted:false,
 });
}
