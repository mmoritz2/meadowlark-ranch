export const COMMONS_STANDARDS_PROFILE='commons-standard-trees-1';
export const COMMONS_STANDARDS_LIMIT=4;
// Real resident tree variants frame the low margin arcs, with unequal heights,
// a broad west crown and a narrower eastern pair. The centre [43,222] stays open.
// These are authored candidates; the existing full live admission guards decide.
export const COMMONS_STANDARD_SITES=Object.freeze([
 {id:'west-arc-end',x:32,z:252,height:11.5,yaw:.68,upright:true,margin:'north-west'},
 {id:'west-inner-crown',x:48,z:241,height:9.5,yaw:2.17,upright:false,margin:'north-west'},
 {id:'east-shoulder-standard',x:64,z:222,height:10.8,yaw:1.42,upright:true,margin:'north-east'},
 {id:'east-rear-crown',x:61,z:211,height:10,yaw:5.13,upright:false,margin:'north-east'},
].map(Object.freeze));
export const commonsTreeCell=(source,x,z)=>source+':'+Math.floor(x/65)+','+Math.floor(z/65);
export function commonsStandardCandidates(){return COMMONS_STANDARD_SITES.map(s=>({...s,allowMeadowMargin:true}));}

// New source/cell draw owners must not advance the ambient UUID stream. Existing
// cells keep the old construction path and owner UUIDs; only genuinely new cells
// use this synchronous private stream. Placement itself never uses randomness.
export function withCommonsStandardResources(key,make){
 if(typeof make!=='function'||make.constructor.name==='AsyncFunction')throw Error('Synchronous commons resource callback required');
 const previous=Math.random;let seed=2166136261;
 for(const c of 'commons-standard-trees-1|'+key)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{const result=make();if(result&&typeof result.then==='function')throw Error('Commons resources must not outlive the private stream');return result;}finally{Math.random=previous;}
}
