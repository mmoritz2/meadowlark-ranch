// Original open-ended field margins, in world metres. These ribbons describe
// uncut, seed-bearing sward beside the short grazing lanes; never plant roots,
// terrain, flower colonies, collision, or the vegetation eligibility mask.
// Each knot is [x,z,halfWidth,seedRipeness]. Unequal widths and long connected
// ripeness transitions avoid isolated golden dots and complete field rings.
const authored=[
  ['clover',[[35,-135,4,.40],[43,-153,7,.65],[59,-172,8,.96],[78,-181,8.5,.94],[99,-178,6,.85],[110,-165,3,.45]]],
  // Two unequal foreground shoulders leave the rider's short central lane open.
  ['clover-near-left',[[69,-146,2,.35],[74,-154,3.5,.70],[78,-162,4,.95],[81,-174,2,.40]]],
  ['clover-near-right',[[105,-145,2,.35],[100,-154,3,.70],[97,-164,3.5,.95],[101,-174,2.5,.40]]],
  ['east-pasture',[[147,12,4,.40],[157,4,7,.82],[178,6,9,.98],[195,18,7,.88],[205,32,4,.45]]],
  ['north-meadow',[[11,214,4,.35],[24,207,7,.72],[46,207,8,.97],[66,215,7,.90],[80,233,4,.42]]],
  ['riverside',[[217,116,4,.40],[232,108,7,.90],[251,113,8,.96],[266,128,4,.45]]],
  ['north-ranch',[[0,-264,4,.35],[20,-275,8,.88],[43,-271,9,.98],[63,-253,7,.78],[75,-243,3,.35]]],
];
export const FIELD_SWARD_RECOVERY=.92;
export const FIELD_SWARD_HEIGHT_BOOST=.22;
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
export const FIELD_SWARD_BANDS=Object.freeze(authored.map(([id,input])=>{
  const nodes=Object.freeze(input.map(n=>Object.freeze(n)));
  const padding=Math.max(...nodes.map(n=>n[2]))*1.10;
  const bounds=Object.freeze({minX:Math.min(...nodes.map(n=>n[0]))-padding,maxX:Math.max(...nodes.map(n=>n[0]))+padding,minZ:Math.min(...nodes.map(n=>n[1]))-padding,maxZ:Math.max(...nodes.map(n=>n[1]))+padding});
  let length=0;
  const segments=Object.freeze(nodes.slice(1).map((b,i)=>{
    const a=nodes[i],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz),start=length;
    length+=span;return Object.freeze({a,b,dx,dz,span,start});
  }));
  return Object.freeze({id,nodes,bounds,segments,length});
}));
const ZERO=Object.freeze({cover:0,seed:0});
export function fieldSwardAt(x,z){
  let cover=0,weightedSeed=0,totalWeight=0;
  for(const band of FIELD_SWARD_BANDS){
    const b=band.bounds;
    if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)continue;
    // One world-space boundary displacement is shared by adjoining segments.
    // Its bounded .09 radius perturbation cannot escape the recorded support.
    const edge=Math.sin(x*.117+z*.053)*.065+Math.sin(z*.151-x*.041)*.025;
    for(const s of band.segments){
      const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/(s.span*s.span)));
      const width=s.a[2]+(s.b[2]-s.a[2])*t,along=s.start+t*s.span;
      const distance=Math.hypot(x-s.a[0]-s.dx*t,z-s.a[1]-s.dz*t)/width;
      const w=(1-smooth(.30,1,distance+edge))*smooth(0,9,along)*(1-smooth(band.length-9,band.length,along));
      if(w===0)continue;
      cover=Math.max(cover,w);totalWeight+=w;
      weightedSeed+=w*(s.a[3]+(s.b[3]-s.a[3])*t);
    }
  }
  return cover===0?ZERO:{cover,seed:cover*weightedSeed/totalWeight};
}
