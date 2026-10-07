// Pure layout/budget rules shared by runtime and acceptance checks.
export const UNDERGROWTH_TIERS={low:{budget:100000,near:10,far:85},medium:{budget:240000,near:15,far:110},high:{budget:480000,near:21,far:135}};
export function coverHash(x,z){let h=Math.imul(Math.round(x*97),374761393)^Math.imul(Math.round(z*89),668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
export function coverBiome(x,z,snow=0){
 if(snow>.35||Math.hypot(x+160,z+210)<140)return 'cold';
 if(Math.hypot(x+220,z-130)<150||Math.hypot(x+330,z-300)<125)return 'dry';
 if(Math.hypot(x+300,z+320)<125)return 'cold';
 return Math.hypot(x-300,z+300)<130?'autumn':'green';
}
export function coverShape(kind,height,variation,templates){
 const woody=kind==='woody',fern=kind==='brack'||kind==='fern'||kind==='yard-fern'||(kind==='local'&&variation<.70),index=woody?6+Math.floor(variation*2)%2:fern?Math.min(3,Math.floor(variation*4)):4+Math.floor(variation*2)%2;
 let h=woody?Math.max(.35,Math.min(1.30,height*1.05)):fern?Math.max(.18,Math.min(.60,height*(kind==='local'?.52:kind==='yard-fern'?.40:.46))):Math.max(.40,Math.min(1.25,height*(kind==='local'?.68:kind==='yard-shrub'?.36:.76)));
 // Actual radial bounds keep wide fronds within the old clear planting margins.
 h=Math.min(h,(fern?1.30:1.15)/templates[index].width);
 return{index,height:h};
}
export function selectCover(records,x,z,tier,templates){
 const limits=UNDERGROWTH_TIERS[tier]||UNDERGROWTH_TIERS.high,nearby=[];
 for(const r of records){const d=Math.hypot(r.x-x,r.z-z);if(d<limits.far)nearby.push({r,d});}
 nearby.sort((a,b)=>a.d-b.d||a.r.order-b.r.order);
 let triangles=0,radius=limits.near;
 for(const c of nearby){if(c.d>=radius)break;const cost=templates[c.r.index].triangles;if(triangles+cost>limits.budget){radius=c.d;break;}triangles+=cost;}
 // The uniform radius and CPU selection agree exactly, including tied distances.
 const detail=nearby.filter(c=>c.d<radius),far=nearby.filter(c=>c.d>=radius-3);
 return {detail,far,radius,range:limits.far,budget:limits.budget,triangles:detail.reduce((sum,c)=>sum+templates[c.r.index].triangles,0)};
}
