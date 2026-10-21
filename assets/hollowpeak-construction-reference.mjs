// Planning only: preserves published59 construction decisions while the single
// physical/rendered canonical surface is the new connected Hollowpeak field.
import {decodeHollowpeakCanonicalField,HOLLOWPEAK_CANONICAL_FIELD as C} from './hollowpeak-canonical-field.mjs';
export const HOLLOWPEAK_CONSTRUCTION_REFERENCE_PROFILE='hollowpeak-current59-construction-reference-1';
export function createHollowpeakConstructionReference({heights,historicalPatch,outsideHeightAt}={}){
 const stride=C.segments+1;
 if(!(heights instanceof Float32Array)||heights.length!==stride*stride||!(historicalPatch instanceof Float32Array)||historicalPatch.length!==C.nodes)throw new TypeError('Complete actual field and authenticated historical rectangle required');
 if(outsideHeightAt!==undefined&&typeof outsideHeightAt!=='function')throw new TypeError('Optional outside-grid terrain fallback must be a function');
 const reference=historicalPatch.slice();for(const y of reference)if(!Number.isFinite(y))throw Error('Finite construction-reference nodes required');
 const ownsNode=(x,z)=>x>=C.ix0&&x<C.ix0+C.nx&&z>=C.iz0&&z<C.iz0+C.nz;
 const node=(x,z)=>ownsNode(x,z)?reference[(z-C.iz0)*C.nx+x-C.ix0]:heights[z*stride+x];
 function affectsCell(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Finite planning point required');
  const ix=Math.floor((x-C.originX)/C.step),iz=Math.floor((z-C.originZ)/C.step);
  return ownsNode(ix,iz)||ownsNode(ix+1,iz)||ownsNode(ix,iz+1)||ownsNode(ix+1,iz+1);
 }
 function heightAt(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Finite planning point required');
  const gx=(x-C.originX)/C.step,gz=(z-C.originZ)/C.step;
  if(gx<=0||gz<=0||gx>=C.segments||gz>=C.segments){if(outsideHeightAt)return outsideHeightAt(x,z);throw Error('Outside-grid construction query needs the established terrain fallback');}
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,a=node(ix,iz),b=node(ix,iz+1),c=node(ix+1,iz+1),d=node(ix+1,iz);
  return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
 }
 return Object.freeze({profile:HOLLOWPEAK_CONSTRUCTION_REFERENCE_PROFILE,heightAt,affectsCell,sourceCanonicalSHA256:'59b9537a0846282f73b5baa5f2fec0b1f6eed2af3fcd865f6a826effdb35ca8d',nodes:C.nodes,physicalOrRegisteredFloor:false,groundComposition:'This is canonical construction height only. The caller must retain established non-Hollowpeak floors and the original shore phase in its planning-only ground adapter; never register this sampler as physical ground.'});
}
export async function loadHollowpeakConstructionPatch({fetchImpl=globalThis.fetch,signal}={}){
 const response=await fetchImpl(new URL('./hollowpeak-construction-reference-1.bin',import.meta.url),{signal});
 if(!response.ok)throw Error('Hollowpeak construction reference could not load');
 return decodeHollowpeakCanonicalField(await response.arrayBuffer());
}
