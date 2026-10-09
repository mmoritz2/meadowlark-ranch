// Original unequal crag profiles: local u, radial v, height, front width, back width.
// Longitudinal profiles taper along ridges, without circular caps or capsule spurs.
export const HORN_RIDGES=Object.freeze([
  [[-440,80,0,150,100],[-340,115,28,150,120],[-265,122,51,155,120],[-205,110,79,150,120],[-158,115,65,145,125],[-113,101,111,145,125],[-77,111,92,150,130],[-35,97,132,145,140],[4,80,106,160,145],[39,92,79,175,140],[79,84,92,170,125],[122,110,58,160,125],[195,122,41,160,115],[290,117,13,150,110],[400,120,0,150,110]],
  [[-430,-70,0,80,100],[-350,-45,31,100,100],[-285,-55,61,105,115],[-220,-35,76,105,115],[-166,-28,65,110,120],[-125,-3,87,100,115],[-75,12,46,115,120],[-18,32,25,120,100],[80,55,0,120,100]],
  [[-90,-135,0,100,105],[15,-82,32,100,110],[67,-60,51,100,115],[129,-47,72,110,120],[177,-35,60,115,125],[222,-9,85,125,125],[267,5,70,120,130],[319,43,43,120,110],[370,68,19,100,105],[440,76,0,100,100]],
].map(r=>Object.freeze(r.map(Object.freeze))));
const clamp01=x=>Math.max(0,Math.min(1,x));
const quintic=x=>{const t=clamp01(x);return t*t*t*(t*(t*6-15)+10);};
function ridgeHeight(u,v,ridge){
  if(u<=ridge[0][0]||u>=ridge[ridge.length-1][0])return 0;
  for(let i=1;i<ridge.length;i++)if(u<=ridge[i][0]){
    const a=ridge[i-1],b=ridge[i],f=(u-a[0])/(b[0]-a[0]);
    const crest=a[1]+(b[1]-a[1])*f,height=a[2]+(b[2]-a[2])*f;
    const side=v<crest?3:4,width=a[side]+(b[side]-a[side])*f;
    return height*Math.max(0,1-Math.abs(v-crest)/width)**1.3;
  }
  return 0;
}
export function hornRelief(u,t){
  const v=(t-.5)*510;
  let height=19*Math.max(0,1-(u/475)**2)*Math.max(0,1-((v-15)/270)**2);
  for(const ridge of HORN_RIDGES)height=Math.max(height,ridgeHeight(u,v,ridge));
  return height*quintic((470-Math.abs(u))/58)*quintic((t-.055)/.16)*quintic((1-t)/.16);
}
