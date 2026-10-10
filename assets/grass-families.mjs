import {createLushMeadowGeometry} from './lush-meadow-geometry.mjs?v=world-cohesion-1';
// Three ordinary pasture forms share the existing seventy-triangle budget.
export const GRASS_FAMILIES=Object.freeze([
 Object.freeze({id:0,name:'Long arching meadow',triangles:70,leaves:14,seedStems:0}),
 Object.freeze({id:1,name:'Low overlapping meadow',triangles:70,leaves:14,seedStems:0}),
 Object.freeze({id:2,name:'Long seeded meadow',triangles:70,leaves:14,seedStems:2})
]);
export function createGrassFamilyGeometry(T,family=0){
 if(!Number.isInteger(family)||!GRASS_FAMILIES[family])throw Error('Unknown grass family');
 const geometry=createLushMeadowGeometry(T,{leafCount:14,segments:family===2?2:3,profile:['meadow','low','seeded'][family],seeded:family===2});
 geometry.userData.grassFamily={...GRASS_FAMILIES[family],vertices:geometry.attributes.position.count,leafRanges:geometry.userData.lushMeadow.leafRanges,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
 return geometry;
}
