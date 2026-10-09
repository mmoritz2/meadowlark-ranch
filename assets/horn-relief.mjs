// Original authored ridge chains, measured in the existing Horn's local metres.
// The long axis is u; v is depth from the centre of its 510m background patch.
// All evaluation is deterministic and has no global random-state dependency.
export const HORN_RIDGES = Object.freeze([
  Object.freeze([[-295,133,35,92],[-205,126,58,95],[-135,112,77,86],[-88,103,88,74],[-35,97,132,70],[15,83,82,72],[54,82,50,72],[103,95,85,82],[168,117,43,88],[216,127,20,94]].map(Object.freeze)),
  Object.freeze([[-395,-77,14,72],[-305,-66,48,78],[-247,-41,73,78],[-177,-20,91,82],[-99,-5,68,76],[-37,0,28,67]].map(Object.freeze)),
  Object.freeze([[-3,-82,17,67],[73,-66,43,76],[142,-36,77,85],[230,-5,91,90],[302,31,65,87],[390,61,24,78]].map(Object.freeze)),
]);

const clamp01 = x => Math.max(0, Math.min(1, x));
const quintic = x => { const t = clamp01(x); return t*t*t*(t*(t*6-15)+10); };

function chainHeight(u, v, chain) {
  let height = 0;
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i-1], b = chain[i], du = b[0]-a[0], dv = b[1]-a[1];
    const t = clamp01(((u-a[0])*du+(v-a[1])*dv)/(du*du+dv*dv));
    const x = a[0]+du*t, z = a[1]+dv*t;
    const width = a[3]+(b[3]-a[3])*t;
    const r2 = ((u-x)*(u-x)+(v-z)*(v-z))/(width*width);
    const profile = Math.max(0, 1-r2);
    height = Math.max(height, (a[2]+(b[2]-a[2])*t)*profile*profile);
  }
  return height;
}

// Return relief above SKY_BASE. The three unequal crest chains form connected
// spurs, a deep left saddle and a broad right pass rather than a continuous wall.
export function hornRelief(u, t) {
  const v = (t-.5)*510;
  const foot = 19*Math.max(0, 1-(u/475)**2)*Math.max(0, 1-((v-15)/270)**2);
  let height = foot;
  for (const ridge of HORN_RIDGES) height = Math.max(height, chainHeight(u, v, ridge));
  // Sink every boundary into the existing distant ground; do not leave the old
  // raised back edge standing behind the new crest as a second artificial wall.
  return height*quintic((470-Math.abs(u))/58)*quintic((t-.055)/.16)*quintic((1-t)/.16);
}
