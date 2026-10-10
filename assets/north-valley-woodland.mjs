// Original unequal woodland shoulders framing an open northern riding meadow.
// Authored lobe centres provide composition; local hashes vary candidates only.
// Runtime clearance, actual terrain grounding and full wood collision remain
// owned by the established world-photoscans woodland pipeline.
export const NORTH_VALLEY_WOODLAND_PROFILE='north-valley-woodland-1';
export const NORTH_VALLEY_WOODLAND_MAX=44;
export const NORTH_VALLEY_WOODLAND_GROUPS=Object.freeze([
 {id:'western-shoulder',seed:31,cap:22,lobes:[[-44,-361,9,12,12.5],[-51,-381,12,13,14],[-61,-407,15,15,15],[-76,-426,14,12,14]]},
 {id:'eastern-copse',seed:67,cap:14,lobes:[[42,-395,10,12,11.5],[55,-419,13,14,14],[58,-440,11,12,12.5]]},
 {id:'rear-meadow-shoulder',seed:103,cap:8,lobes:[[-46,-450,11,12,12],[-57,-469,13,12,13.5]]},
].map(g=>Object.freeze({...g,lobes:Object.freeze(g.lobes.map(l=>Object.freeze(l)))})));
const hash=(a,b,c)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,1442695041);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
export function northValleyWoodlandCandidates(){
 const rows=[];
 for(const g of NORTH_VALLEY_WOODLAND_GROUPS)for(let l=0;l<g.lobes.length;l++){
  const [x,z,rx,rz,height]=g.lobes[l];
  for(let i=0;i<15;i++){
   const a=i*2.399963229728653+hash(g.seed,l,11)*Math.PI*2;
   const radius=Math.sqrt((i+.4)/15)*(.86+hash(g.seed,l*17+i,17)*.14);
   rows.push({grove:g.id,lobe:l,priority:i,x:x+Math.cos(a)*rx*radius,z:z+Math.sin(a)*rz*radius,
    height:height*(.84+hash(g.seed,l*17+i,23)*.20),yaw:hash(g.seed,l*17+i,29)*Math.PI*2,
    upright:hash(g.seed,l*17+i,37)>.43});
  }
 }
 // Fill all overlapping lobes from their inner crowns before loose margins.
 return rows.sort((a,b)=>a.priority-b.priority||a.lobe-b.lobe||a.grove.localeCompare(b.grove));
}
export function northValleyWoodlandPlants(trees){
 const plants=[];
 for(let i=0;i<trees.length;i++)for(let j=0;j<5;j++){
  const t=trees[i],angle=j*2.399963229728653+t.yaw,radius=3.0+hash(i,j,131)*2.7;
  const fern=j===0;
  plants.push([fern?'fern_02':j%2?'shrub_03':'shrub_04',t.x+Math.cos(angle)*radius,t.z+Math.sin(angle)*radius,
   fern?.70+hash(i,j,137)*.23:1.25+hash(i,j,139)*.58,angle+.7]);
 }
 return plants;
}
