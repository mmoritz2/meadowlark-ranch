// Original liquid geometry in the existing waterfall/ravine envelope. Travel s
// is elapsed fall time: forward travel is linear, vertical drop accelerates s².
// The stream/lip/foot endpoints stay fixed; no random placement or new texture.
export const CASCADE_FLOW_PROFILE='joining-gravity-veils-3';
export const CASCADE_VEIL_WEIGHTS=Object.freeze([.025,.155,.070,.250,.065,.110,.040,.200,.085]);
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export function cascadeRim(across){return .046+.022*Math.sin(across*3.7+1.2)+.019*Math.sin(across*8.3+.4);}
export function cascadeSpan(index){const sum=CASCADE_VEIL_WEIGHTS.reduce((a,b)=>a+b,0),before=CASCADE_VEIL_WEIGHTS.slice(0,index).reduce((a,b)=>a+b,0);return [-1+2*before/sum,-1+2*(before+CASCADE_VEIL_WEIGHTS[index])/sum];}
// A shared boundary meanders coherently on both adjacent flows. Small gap
// windows are staggered vertically and vanish over most of each boundary;
// there is no permanent narrowing or repeated full-height dark slit.
export function cascadeBoundary(index,s){
 const sum=CASCADE_VEIL_WEIGHTS.reduce((a,b)=>a+b,0),before=CASCADE_VEIL_WEIGHTS.slice(0,index).reduce((a,b)=>a+b,0),base=-1+2*before/sum;
 const drift=index===0||index===CASCADE_VEIL_WEIGHTS.length?0:.022*Math.sin(Math.PI*s)*Math.sin(s*12.1+index*1.37);
 return base+drift;
}
export function cascadeBoundaryGap(index,s){
 if(index===0||index===CASCADE_VEIL_WEIGHTS.length||s<=0||s>=1)return 0;
 const pulse=Math.max(0,(Math.sin(s*17.0+index*1.91)-.62)/.38);
 return .016*pulse*pulse*Math.sin(Math.PI*s)**2;
}
export function cascadeSpread({width,footWidth},s){const b=smooth((s-.78)/.22);return (1+.29*s+.02*Math.sin(Math.PI*s))*(1-b)+(footWidth?footWidth/width:1.29)*b;}
export function sampleCascadeVeil({x,z,top,bottom,width,run,footHeightAt,footWidth},index,s,u){
 const phase=index*1.731+.43,spread=cascadeSpread({width,footWidth},s);
 const left=cascadeBoundary(index,s)+cascadeBoundaryGap(index,s),right=cascadeBoundary(index+1,s)-cascadeBoundaryGap(index+1,s);
 const across=(left+(right-left)*u)*spread;
 const rim=cascadeRim(across/spread),fold=.015*Math.sin(Math.PI*u)*Math.sin(Math.PI*s)*Math.sin(s*19+phase);
 const drop=(top-bottom)*s*s+.012*s*s*(1-s)*Math.sin(s*37+across*8.3),px=x+width*across;
 const foot=footHeightAt?footHeightAt(px,z+run)+.075:bottom;
 return [px,top-drop+(foot-bottom)*smooth((s-.76)/.24),z+run*s+(rim*.7+fold)*Math.sin(Math.PI*s)];
}
export function cascadeMotionAmplitude(width,s){return width*.013*4*s*(1-s);}
// Whole-width coordinates keep touching boundaries synchronized. Only a gap
// window separates adjacent veils; animation cannot reopen a joined boundary.
export function cascadeMotionOffset(amplitude,across,v,phase,time){return amplitude*(.70*Math.sin(time*1.1+across*7.0+v*8)+.30*Math.sin(time*1.9+across*13.0+v*17));}
export function cascadeFlowRate(top,bottom){return Math.sqrt(4.9/Math.max(.1,top-bottom));}
// Local impact waves replace the pool's uniform crossing grid. Their height
// gradients are centimetres, fade into the still basin and distort the existing
// reflection sample; geometry, shoreline, source stream and contacts stay exact.
export function patchPlungePool(shader,{x,z}){
 shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`
  vec2 plungeDelta=waterWorld.xz-vec2(${Number(x).toFixed(6)},${Number(z).toFixed(6)});
  float plungeRadius=sqrt(dot(plungeDelta,plungeDelta)+.24);
  vec2 plungeDirection=plungeDelta/plungeRadius;
  float impactWeight=exp(-plungeRadius*.32);
  float brokenWave=cos(plungeRadius*4.3-waterTime*3.7+sin(plungeDelta.x*.83)*.63);
  float crossWave=sin(plungeDelta.x*1.31+plungeDelta.y*.78-waterTime*1.4);
  dx=.014*cos(wx*.41+wz*.57-wt*.45)+impactWeight*(.060*brokenWave*plungeDirection.x+.016*crossWave);
  dz=.011*cos(wx*.41+wz*.57-wt*.45)+impactWeight*(.060*brokenWave*plungeDirection.y+.010*crossWave);
  normal=normalize(mat3(viewMatrix)*vec3(-dx,1.0,-dz));
  #include <clearcoat_normal_fragment_maps>`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float plungeSurfaceDistance=length(waterWorld.xz-vec2(${Number(x).toFixed(6)},${Number(z).toFixed(6)}));
  roughnessFactor=mix(roughnessFactor,.31,exp(-plungeSurfaceDistance*.32));`);
}
