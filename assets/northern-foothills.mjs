// Original northern crest profiles: [arc metres, radial metres, height, front width, back width].
// Unequal facets and asymmetric flanks avoid circular endcaps and smooth capsules.
export const NORTHERN_FOOTHILL_RIDGES=Object.freeze([
  [[-840,50,0,100,130],[-690,14,38,125,150],[-530,-18,64,145,160],[-380,-45,45,138,170],[-200,-62,0,115,130]],
  [[-270,-156,0,85,120],[-90,-136,20,110,150],[75,-105,35,145,180],[180,-73,27,130,170],[305,-62,0,110,130]],
  [[150,120,0,115,150],[325,80,42,130,170],[465,26,60,135,160],[600,1,46,125,140],[785,20,0,110,135]],
].map(r=>Object.freeze(r.map(Object.freeze))));
export const NORTHERN_MIDDLE_RIDGES=Object.freeze([
  [[-1300,75,0,170,180],[-1120,15,50,210,190],[-940,-23,87,210,210],[-850,23,74,240,220],[-745,68,104,235,200],[-640,0,69,240,220],[-550,-23,82,220,180],[-420,-75,35,190,170],[-300,-60,0,170,150]],
  [[-280,188,0,150,160],[-160,135,35,180,170],[-45,105,54,200,180],[95,135,74,220,190],[180,90,60,230,190],[285,23,35,200,160],[360,-23,0,170,150]],
  [[150,-135,0,170,180],[310,-120,38,190,210],[445,-53,65,220,230],[525,-30,92,220,220],[655,15,81,220,210],[730,-23,94,210,210],[835,53,57,230,220],[980,120,30,190,180],[1140,135,0,170,160]],
].map(r=>Object.freeze(r.map(Object.freeze))));
const clamp01=x=>Math.max(0,Math.min(1,x));
const quintic=x=>{const t=clamp01(x);return t*t*t*(t*(t*6-15)+10);};
const northAngle=angle=>Math.atan2(Math.sin(angle+Math.PI*.5),Math.cos(angle+Math.PI*.5));
export function northernFoothillWeight(angle,layer=2){return layer===0?0:1-quintic((Math.abs(northAngle(angle))-.72)/.30);}
function ridgeHeight(u,v,ridge,power){
  if(u<=ridge[0][0]||u>=ridge[ridge.length-1][0])return 0;
  for(let i=1;i<ridge.length;i++)if(u<=ridge[i][0]){
    const a=ridge[i-1],b=ridge[i],f=(u-a[0])/(b[0]-a[0]);
    const crest=a[1]+(b[1]-a[1])*f,height=a[2]+(b[2]-a[2])*f;
    const side=v<crest?3:4,width=a[side]+(b[side]-a[side])*f;
    return height*Math.max(0,1-Math.abs(v-crest)/width)**power;
  }
  return 0;
}
export function northernFoothillRelief(angle,t,layer=2){
  if(t<=0||t>=1||layer===0)return 0;
  const middle=layer===1,u=northAngle(angle)*(middle?1230:910),v=(t-.5)*(middle?750:485);
  let height=(middle?13:10)*Math.sin(Math.PI*t)**1.5;
  for(const ridge of middle?NORTHERN_MIDDLE_RIDGES:NORTHERN_FOOTHILL_RIDGES)height=Math.max(height,ridgeHeight(u,v,ridge,middle?1.25:1.6));
  return height*quintic(t/.12)*quintic((1-t)/.12);
}
