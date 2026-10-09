// Original far northern skyline: three unequal ranges, separated by broad low
// passes. Units are [north arc metres, radial offset metres, crest height above
// buried base, front width, rear width]. This pure helper consumes no RNG.
export const FAR_NORTHERN_RIDGES=Object.freeze([
  [[-1850,70,0,200,240],[-1600,75,72,260,300],[-1430,120,122,300,350],
   [-1230,180,188,350,430],[-1050,125,140,320,390],[-925,30,161,300,350],
   [-740,-35,90,290,300],[-540,-60,0,230,260]],
  [[-490,-80,0,210,240],[-310,-135,80,250,300],[-180,-185,138,250,330],
   [-50,-100,108,270,350],[90,-25,68,250,300],[190,60,0,220,260]],
  [[160,50,0,240,280],[390,130,80,280,340],[610,175,125,320,370],
   [790,225,163,350,420],[990,180,125,340,390],[1170,130,103,310,350],
   [1490,110,50,270,300],[1700,70,0,230,260]],
].map(r=>Object.freeze(r.map(Object.freeze))));
const clamp=x=>Math.max(0,Math.min(1,x));
const quintic=x=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
const northAngle=a=>Math.atan2(Math.sin(a+Math.PI*.5),Math.cos(a+Math.PI*.5));
export function farNorthernWeight(angle){return 1-quintic((Math.abs(northAngle(angle))-.94)/.23);}
function ridgeHeight(u,v,ridge){
  if(u<=ridge[0][0]||u>=ridge[ridge.length-1][0])return 0;
  for(let i=1;i<ridge.length;i++)if(u<=ridge[i][0]){
    const a=ridge[i-1],b=ridge[i],f=(u-a[0])/(b[0]-a[0]);
    const crest=a[1]+(b[1]-a[1])*f,height=a[2]+(b[2]-a[2])*f;
    const side=v<crest?3:4,width=a[side]+(b[side]-a[side])*f;
    return height*Math.max(0,1-Math.abs(v-crest)/width)**1.32;
  }
  return 0;
}
export function farNorthernRelief(angle,t){
  if(t<=0||t>=1)return 0;
  const u=northAngle(angle)*1700,v=(t-.5)*980;
  // A low connected floor supports open passes without replacing the old wall
  // with a new constant-height strip. Crests advance and recede independently.
  let height=(45+12*Math.sin(u*.0017+.4)+8*Math.sin(u*.0031))*Math.sin(Math.PI*t)**1.35;
  for(const ridge of FAR_NORTHERN_RIDGES)height=Math.max(height,ridgeHeight(u,v,ridge));
  return height*quintic(t/.09)*quintic((1-t)/.09);
}
