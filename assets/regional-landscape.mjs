// Original directional relief for the distant skyline and outer foothills.
// Compass is atan2(z,x): east=0, south=PI/2, west=PI, north=-PI/2.
// Only consumers outside the riding terrain should apply these envelopes.
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const quintic=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const finite=(value,label)=>{if(!Number.isFinite(value))throw new TypeError(label+' must be finite');return value;};
export const REGIONAL_SECTORS=Object.freeze({
 north:Object.freeze({center:-1.575,core:.775,edge:1.05}),
 western:Object.freeze({center:2.8,core:.25,edge:.47}),
 ochre:Object.freeze({center:2.49,core:.09,edge:.2}),
 southwest:Object.freeze({center:2.175,core:.175,edge:.225}),
 east:Object.freeze({center:.38,core:.12,edge:.46}),
 southeast:Object.freeze({center:1.07,core:.14,edge:.4}),
});
export function regionalAngle(x,z){return Math.atan2(finite(z,'z'),finite(x,'x'));}
function window(angle,{center,core,edge}){
 const d=Math.abs(Math.atan2(Math.sin(angle-center),Math.cos(angle-center)));
 return 1-quintic((d-core)/(edge-core));
}
// Region weights sum to one. valley is a separate relief/woodland envelope:
// an open saddle can retain warm dry or green pastoral material underneath.
export function regionWeights(angle){
 finite(angle,'angle');
 const north=window(angle,REGIONAL_SECTORS.north);
 const western=window(angle,REGIONAL_SECTORS.western),ochre=.62*window(angle,REGIONAL_SECTORS.ochre);
 const arid=1-(1-western)*(1-ochre),dry=(1-north)*arid,pastoral=(1-north)*(1-arid);
 const sw=window(angle,REGIONAL_SECTORS.southwest),east=.72*window(angle,REGIONAL_SECTORS.east),se=.55*window(angle,REGIONAL_SECTORS.southeast);
 return{north,dry,pastoral,valley:1-(1-sw)*(1-east)*(1-se)};
}
export function regionWeightsAt(x,z){return regionWeights(regionalAngle(x,z));}

/**
 * All scales are dimensionless except crestShift (radial-band fraction) and
 * radialWarp (metres). heightScale REPLACES the former generic ridgeProfile,
 * rather than multiplying it; multiply cfg.height by this value. massifScale
 * multiplies existing named-massif relief above its buried base per vertex.
 * layer=0/1/2 means far/middle/near ring. All layers keep the same valley axes.
 * Foothill and woodland values are shared with the outer-landscape consumer.
 */
export function regionalProfile(angle,{phase=0,layer=0}={}){
 finite(angle,'angle');finite(phase,'phase');finite(layer,'layer');
 const a=Math.atan2(Math.sin(angle),Math.cos(angle)),w=regionWeights(a),{north:n,dry:d,pastoral:p,valley:v}=w;
 const l=clamp(layer,0,2),openness=1-.82*v;
 // Alpine peaks have broken teeth; western shelves break into shoulders;
 // pastoral relief uses broad two/three-wave rolls with no sharp peak train.
 const alpine=.99+.13*Math.sin(a*3+phase*.31)+.075*Math.sin(a*7-phase*.23)+.07*Math.max(0,Math.cos(a*13+phase*.19))**6;
 const dryShoulders=.47+.085*Math.sin(a*4+phase*.27)+.07*Math.max(0,Math.cos(a*11-phase*.21))**3;
 const greenRolls=.235+.05*Math.sin(a*2+phase*.25)+.025*Math.sin(a*3-phase*.17);
 const heightScale=clamp((n*alpine+d*dryShoulders+p*greenRolls)*openness*(1-l*.045),.025,1.3);
 return{...w,
  heightScale,
  massifScale:(n*1.04+d*.68+p*.46)*(1-v*.50),
  crestShift:(n*.035*Math.sin(a*3+phase*.2)+d*.025*Math.sin(a*5-phase*.31)+p*.025*Math.sin(a*2+phase*.4))*(1-v*.4),
  shoulderPower:n*1.15+d*1.35+p*1.85+v*.25,
  plateau:d*.58*(1-v*.65),
  erosionScale:(n*.16+d*.19+p*.045)*(1-v*.8),
  foldScale:(n*.065+d*.027+p*.008)*(1-v*.8),
  radialWarp:(n*48*Math.sin(a*2+phase*.4)+d*32*Math.sin(a*5-phase*.3)+p*34*Math.sin(a*3+phase*.2))*(1-v*.65),
  foothillScale:(n*1.24+d*.82+p*.57)*(1-v*.68),
  foothillRoughness:(n*.90+d*1.40+p*.45)*(1-v*.82),
  woodlandDensity:(n*.58+d*.09+p*.84)*(1-v*.60),
 };
}
export function regionalProfileAt(x,z,options){return regionalProfile(regionalAngle(x,z),options);}
// A shelf-shaped dry cross-section, rounded green shoulder, or alpine flank.
// shoulder is 0 at a buried hem and 1 at the crest, on either side of a ring.
export function regionalShoulder(shoulder,profile){
 finite(shoulder,'shoulder');
 const s=clamp(shoulder),rounded=Math.sin(s*Math.PI*.5)**profile.shoulderPower;
 const shelf=quintic(s/.68);
 return rounded+(shelf-rounded)*profile.plateau;
}

// Shader weights use these exact authored constants. GLSL consumers call
// regionalWeights(atan(worldZ,worldX)): [north,dry,pastoral,valley].
const glslWindow=(name,sector)=>`float ${name}=regionalWindow(angle,${sector.center.toFixed(6)},${sector.core.toFixed(6)},${sector.edge.toFixed(6)});`;
export const REGIONAL_WEIGHTS_GLSL=`
float regionalQuintic(float t){t=clamp(t,0.0,1.0);return t*t*t*(t*(t*6.0-15.0)+10.0);}
float regionalWindow(float angle,float centre,float core,float edge){
 float delta=abs(angle-centre);
 delta=min(delta,6.283185307179586-delta);
 return 1.0-regionalQuintic((delta-core)/(edge-core));
}
vec4 regionalWeights(float angle){
 // Consumers pass atan-bounded angles, requiring no normalization. Retain a
 // periodic fallback for other callers, then use six cheap circle distances.
 if(angle < -3.141592653589793 || angle > 3.141592653589793)
  angle=mod(angle+3.141592653589793,6.283185307179586)-3.141592653589793;
 ${glslWindow('north',REGIONAL_SECTORS.north)}
 ${glslWindow('western',REGIONAL_SECTORS.western)}
 ${glslWindow('ochreWindow',REGIONAL_SECTORS.ochre)}
 float arid=1.0-(1.0-western)*(1.0-.62*ochreWindow);
 ${glslWindow('southwest',REGIONAL_SECTORS.southwest)}
 ${glslWindow('eastWindow',REGIONAL_SECTORS.east)}
 ${glslWindow('southeast',REGIONAL_SECTORS.southeast)}
 float valley=1.0-(1.0-southwest)*(1.0-.72*eastWindow)*(1.0-.55*southeast);
 return vec4(north,(1.0-north)*arid,(1.0-north)*(1.0-arid),valley);
}
`;
