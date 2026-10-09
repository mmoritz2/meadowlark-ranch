// Original woodland composition: upright stands mixed with spreading fringe trees.
// Selection uses the existing tree sites and never consumes the world random stream.
export const PASTORAL_GROVES=Object.freeze([
 ['clover-east',111,-110,23,29,13],['village-west',-21,-57,42,54,11],
 ['clover-back',20,-203,53,43,10],['bridge-west',-65,134,45,30,7],
 ['clover-west',-35,-137,29,44,5],['west-meadow',-57,57,37,28,4],
 ['east-pasture',206,51,31,32,4],
].map(([id,x,z,rx,rz,cap])=>Object.freeze({id,x,z,rx,rz,cap})));
export const PASTORAL_UPRIGHT_LIMIT=54;
const forms=new Set(['broadleaf','mature-leaf-broadleaf','canopy-broadleaf','woodland-broadleaf']);
export function isOrdinaryTrunkCircle(c){
 return Number.isFinite(c.x+c.z+c.r)&&c.r>0&&c.r<=1.2
  &&Object.keys(c).every(k=>['x','z','r','height','trunk'].includes(k));
}
export function selectPastoralWoodland(trees,{coldAt=()=>0,canReplace=()=>true}={}){
 const eligible=trees.filter(t=>Number.isFinite(t.x+t.z+t.height)&&t.height>=9&&t.height<=14
  &&forms.has(typeof t.source==='string'?t.source:t.source?.key)
  &&!t.authoredOrchard&&!t.authoredVillage&&!t.authoredWoodlandEdge
  &&!['cold','snowpine','willow','orchard','village'].includes(t.kind)
  &&Math.hypot(t.x-47,t.z+50)>=34&&coldAt(t.x,t.z)<=.08);
 const selected=[],used=new Set();
 for(const grove of PASTORAL_GROVES){
  const score=t=>((t.x-grove.x)/grove.rx)**2+((t.z-grove.z)/grove.rz)**2;
  const candidates=eligible.filter(t=>!used.has(t)&&score(t)<1)
   .sort((a,b)=>score(a)-score(b)||a.x-b.x||a.z-b.z);
  let count=0;
  for(const tree of candidates){
   if(count===grove.cap||selected.length===PASTORAL_UPRIGHT_LIMIT)break;
   if(!canReplace(tree))continue;
   selected.push({tree,grove:grove.id});used.add(tree);count++;
  }
 }
 return selected;
}
