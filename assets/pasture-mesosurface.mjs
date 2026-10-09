// One connected grass-growth field controls the low tussock surface, crowns
// and root hollows. This changes material response only, never riding height.
export const PASTURE_MESO_CACHE='pasture-mesosurface-2';
export const PASTURE_MESO=Object.freeze({
 localMetres:3.4,groupMetres:11.0,localWeight:.72,height:.18,managedHeight:.36,managedMaterial:.55,
 crownLow:.22,crownHigh:.79,normalLimit:.30,rootOcclusion:.14,
 localFilter:Object.freeze([.22,.80]),groupFilter:Object.freeze([1.2,3.8]),
 envelopeLow:.40,envelopeHigh:.72,calmHeight:.16,
});
const fract=x=>x-Math.floor(x),clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function hash(x,z){let a=fract(x*.1031),b=fract(z*.1031),c=a;const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;return fract((a+b)*c);}
function field(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),u=fract(x),v=fract(z),sx=u*u*(3-2*u),sz=v*v*(3-2*v),a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
 return [((1-sx)*a+sx*b)*(1-sz)+((1-sx)*c+sx*d)*sz,((b-a)*(1-sz)+(d-c)*sz)*6*u*(1-u),((c-a)*(1-sx)+(d-b)*sx)*6*v*(1-v)];
}
// Static QA evaluates the same physical field independently of a GPU. Its
// gradient is analytic; no texture reads or finite-difference shading samples.
export function pastureMesoAt(x,z,footprint=0,managed=0){
 const c=PASTURE_MESO,local=field((.8*x+.6*z)/c.localMetres+19.1,(-.6*x+.8*z)/c.localMetres-7.7),group=field((.6*x-.8*z)/c.groupMetres-37.3,(.8*x+.6*z)/c.groupMetres+11.9);
 const lf=1-smooth(...c.localFilter,footprint),gf=1-smooth(...c.groupFilter,footprint),v=.5+(local[0]-.5)*c.localWeight*lf+(group[0]-.5)*(1-c.localWeight)*gf;
 const gx=(.8*local[1]-.6*local[2])*c.localWeight*lf/c.localMetres+(.6*group[1]+.8*group[2])*(1-c.localWeight)*gf/c.groupMetres;
 const gz=(.6*local[1]+.8*local[2])*c.localWeight*lf/c.localMetres+(-.8*group[1]+.6*group[2])*(1-c.localWeight)*gf/c.groupMetres;
 const groupValue=.5+(group[0]-.5)*gf,gt=clamp((groupValue-c.envelopeLow)/(c.envelopeHigh-c.envelopeLow)),density=gt*gt*(3-2*gt),envelope=c.calmHeight+(1-c.calmHeight)*density;
 const envelopeDerivative=(1-c.calmHeight)*6*gt*(1-gt)/(c.envelopeHigh-c.envelopeLow),ex=(.6*group[1]+.8*group[2])*gf/c.groupMetres*envelopeDerivative,ez=(-.8*group[1]+.6*group[2])*gf/c.groupMetres*envelopeDerivative;
 const t=clamp((v-c.crownLow)/(c.crownHigh-c.crownLow)),crown=t*t*(3-2*t),derivative=6*t*(1-t)/(c.crownHigh-c.crownLow),height=c.height*(1+(c.managedHeight-1)*clamp(managed));
 return{crown,envelope,height:crown*envelope*height,dx:(gx*derivative*envelope+crown*ex)*height,dz:(gz*derivative*envelope+crown*ez)*height,filter:(lf*.72+gf*.28)*envelope*(1+(c.managedMaterial-1)*clamp(managed))};
}
const f=n=>Number.isInteger(n)?n+'.0':String(n),c=PASTURE_MESO;
const declarations=`
      // PASTURE_MESOSURFACE_V2: group growth leaves quiet patches between sward.
      vec3 pastureMesoNoise(vec2 q){
        vec2 cell=floor(q),v=fract(q),w=v*v*(3.0-2.0*v),dw=6.0*v*(1.0-v);
        float a=tHash(cell),b=tHash(cell+vec2(1.0,0.0)),c=tHash(cell+vec2(0.0,1.0)),d=tHash(cell+vec2(1.0));
        return vec3(mix(mix(a,b,w.x),mix(c,d,w.x),w.y),mix(b-a,d-c,w.y)*dw.x,mix(c-a,d-b,w.x)*dw.y);
      }
      vec4 pastureMesoGrowth(vec2 p,float footprint,float managed){
        mat2 localBasis=mat2(.8,-.6,.6,.8),groupBasis=mat2(.6,.8,-.8,.6);
        vec3 local=pastureMesoNoise(localBasis*p/${f(c.localMetres)}+vec2(19.1,-7.7));
        vec3 group=pastureMesoNoise(groupBasis*p/${f(c.groupMetres)}+vec2(-37.3,11.9));
        float lf=1.0-smoothstep(${c.localFilter.map(f).join(',')},footprint),gf=1.0-smoothstep(${c.groupFilter.map(f).join(',')},footprint);
        float value=.5+(local.x-.5)*${f(c.localWeight)}*lf+(group.x-.5)*${f(1-c.localWeight)}*gf;
        vec2 gradient=(local.yz*localBasis)*(${f(c.localWeight/c.localMetres)}*lf)+(group.yz*groupBasis)*(${f((1-c.localWeight)/c.groupMetres)}*gf);
        float t=clamp((value-${f(c.crownLow)})/${f(c.crownHigh-c.crownLow)},0.0,1.0),crown=t*t*(3.0-2.0*t);
        float groupValue=.5+(group.x-.5)*gf,gt=clamp((groupValue-${f(c.envelopeLow)})/${f(c.envelopeHigh-c.envelopeLow)},0.0,1.0);
        float envelope=mix(${f(c.calmHeight)},1.0,gt*gt*(3.0-2.0*gt));
        vec2 envelopeGradient=(group.yz*groupBasis)*(gf/${f(c.groupMetres)}*${f(1-c.calmHeight)}*6.0*gt*(1.0-gt)/${f(c.envelopeHigh-c.envelopeLow)});
        // Product rule: this is the gradient of crown * envelope, not an
        // arbitrary multiplier on a disconnected normal map.
        gradient=(gradient*(6.0*t*(1.0-t)/${f(c.crownHigh-c.crownLow)}*envelope)+crown*envelopeGradient)
          *${f(c.height)}*mix(1.0,${f(c.managedHeight)},managed);
        return vec4(crown,gradient,(lf*.72+gf*.28)*envelope*mix(1.0,${f(c.managedMaterial)},managed));
      }
`;
const fields=`
      // All original regional/material masks are final here, including the
      // outer material's grove mask and dry banks. Other substrates retain theirs.
      float pastureOther=max(max(snow,coldPowder),max(rocky,quarters));
      float pastureCover=(1.0-smoothstep(.04,.58,pastureOther))
        *(1.0-smoothstep(.02,.68,canopy))*(1.0-smoothstep(.02,.62,max(wear,bank)))
        *(1.0-smoothstep(.02,.65,canyon))*(1.0-clamp(soilWeight,0.0,1.0));
      float pastureManaged=fieldGrazing;
      #ifdef OUTER_LANDSCAPE
        // Match the riding edge exactly, then release the clamped mask outside.
        pastureManaged=fieldMask.b*(1.0-smoothstep(15.0,60.0,length(max(abs(p)-vec2(500.0),vec2(0.0)))));
      #endif
      float pastureFootprint=max(length(dFdx(p)),length(dFdy(p)));
      vec4 pastureGrowth=vec4(.5,0.0,0.0,0.0);
      if(pastureCover>.003)pastureGrowth=pastureMesoGrowth(p,pastureFootprint,pastureManaged);
      float pastureHollow=(1.0-pastureGrowth.x)*(1.0-pastureGrowth.x);
      // Small crown/root material differences follow the same relief; sunlight
      // and cavity shading provide depth rather than independent painted dots.
      float pastureMaterial=pastureCover*pastureGrowth.w;
      surface*=mix(vec3(1.0),mix(vec3(.96,.985,.91),vec3(1.035,1.035,1.00),pastureGrowth.x),pastureMaterial);
      surface=mix(surface,surface*vec3(1.12,.96,.79),pastureHollow*pastureMaterial*.09*(1.0-pastureManaged*.7));
`;
const normal=`
      // Compose after the existing photographed/snow/outer normals. The bound
      // keeps the subtraction away from zero even on steep pre-existing normals.
      vec3 pastureGradient=vec3(pastureGrowth.y,0.0,pastureGrowth.z);
      pastureGradient-=wn*dot(wn,pastureGradient);
      pastureGradient*=min(1.0,${f(c.normalLimit)}/max(length(pastureGradient),.00001));
      if(pastureCover>.003)normal=normalize(normal-mat3(viewMatrix)*pastureGradient*pastureCover);
`;
const powderEnd='          normal=normalize(mix(normal,normalize(mat3(viewMatrix)*powderNormal),coldPowder));\n        }\n      #endif';
export function patchPastureMesoSurface(shader){
 if(shader.fragmentShader.includes('PASTURE_MESOSURFACE_V2'))return false;
 const edits=[
  ['      // Right-angle UV rotations keep footprint area',declarations+'      // Right-angle UV rotations keep footprint area'],
  ['      soilWeight*=soilReady;','      soilWeight*=soilReady;'+fields],
  [powderEnd,powderEnd+normal],
  ['      roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));',`      roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));
      roughnessFactor=min(1.0,roughnessFactor+(.01+.028*pastureHollow)*pastureMaterial*(1.0-rainWet));`],
  ['#include <aomap_fragment>',`#include <aomap_fragment>
      // Shallow grass/root cavities occlude ambient light, not direct sun.
      reflectedLight.indirectDiffuse*=1.0-${f(c.rootOcclusion)}*pastureHollow*pastureMaterial;`],
 ];
 let fragment=shader.fragmentShader;
 for(const[anchor,replacement]of edits){if(fragment.split(anchor).length!==2)return false;fragment=fragment.replace(anchor,replacement);}
 shader.fragmentShader=fragment;return true;
}
