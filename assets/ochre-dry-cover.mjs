// Bounded presentation of existing near/middle grass. No placement RNG or physical state.
export const OCHRE_COVER_PROFILE='ochre-short-dry-cover-2';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const fract=v=>v-Math.floor(v);
// Same hash/noise equations and ecoA/ecoB inputs as terrain-realism.js.
// CPU doubles sample the existing soil envelope; this is not a GPU-bit-equality claim.
function soilHash(x,z){let a=fract(x*.1031),b=fract(z*.1031),c=a;const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;return fract((a+b)*c);}
function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz),a=soilHash(ix,iz),b=soilHash(ix+1,iz),c=soilHash(ix,iz+1),d=soilHash(ix+1,iz+1);return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;}
export function ochreSoilWeight(x,z){
 const r=Math.hypot(x+330,z-300);
 // The actual shader warp is bounded by49.75m. Retain its exact80/128 feather.
 if(r>=177.75)return 0;if(r<=30.25)return 1;
 const lo=noise(x*.0165+71,z*.0165+71)-.5,hi=noise(x*.074+13,z*.074+13)-.5;
 const ecoA=lo*62+hi*19,ecoB=hi*52+lo*24;
 return 1-smooth(80,128,r+ecoA*.90+ecoB*.35);
}
let archFrame=null;
// Read the already installed actual arch frame once. No scene/actor/camera write.
export function configureOchreCoverFrame(m){
 if(!m||m.length!==16||!Array.from(m).every(Number.isFinite)){archFrame=null;return false;}
 const det=m[0]*m[10]-m[8]*m[2];
 if(Math.abs(Math.abs(det)-1)>1e-8||Math.abs(m[0]*m[0]+m[2]*m[2]-1)>1e-8||Math.abs(m[8]*m[8]+m[10]*m[10]-1)>1e-8||Math.abs(m[5]-1)>1e-8||Math.abs(m[0]*m[8]+m[2]*m[10])>1e-8||Math.abs(m[1])+Math.abs(m[3])+Math.abs(m[4])+Math.abs(m[6])+Math.abs(m[7])+Math.abs(m[9])+Math.abs(m[11])+Math.abs(m[15]-1)>1e-8){archFrame=null;return false;}
 archFrame=Object.freeze({a:m[10]/det,b:-m[8]/det,c:-m[2]/det,d:m[0]/det,x:m[12],z:m[14]});return true;
}
export function ochreOpeningWeight(x,z){
 if(!archFrame)return 0;const f=archFrame,dx=x-f.x,dz=z-f.z,u=f.a*dx+f.b*dz,v=f.c*dx+f.d*dz;
 if(v<=-20||v>=16)return 0;
 const side=1-smooth(1.4,2.9,Math.abs(u-.15*Math.sin(v*.28)));
 return side*smooth(-20,-16,v)*(1-smooth(12,16,v));
}
// Acceptance is independent of the existing yaw/color variation. Salted integer
// avalanche reads that same variation without consuming any placement RNG.
function acceptanceSample(x,z,variation){
 let h=(Math.imul(Math.round(x*4096),374761393)^Math.imul(Math.round(z*4096),668265263)^Math.imul(Math.floor(clamp(variation)*4294967295),1442695041)^0x6a09e667)|0;
 h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;
}
export function ochreCoverAt(x,z,variation=.5){
 const weight=ochreSoilWeight(x,z);if(weight===0)return null;
 const patch=smooth(.40,.70,noise(x*.36+19,z*.36-7));
 const density=.06+.20*patch,opening=ochreOpeningWeight(x,z);
 const retention=(1-weight*(1-density))*(1-opening*weight);
 return {weight,keep:acceptanceSample(x,z,variation)<retention,cap:.18+.10*noise(x*.29-4,z*.29+23),reach:1-weight*.25,sage:noise(x*.19+47,z*.19-18),shade:.94+clamp(variation)*.12};
}
export function shortenOchreTuft(a,o,geometry,cover){
 if(!cover||!cover.keep||!(Math.abs(a[o])+Math.abs(a[o+5])+Math.abs(a[o+10])>0))return false;
 if(!geometry.boundingBox)geometry.computeBoundingBox();const b=geometry.boundingBox;
 const height=Math.abs(a[o+1])*(b.max.x-b.min.x)+Math.abs(a[o+5])*(b.max.y-b.min.y)+Math.abs(a[o+9])*(b.max.z-b.min.z);
 if(!(height>0))return false;
 const target=height+(Math.min(height,cover.cap)-height)*cover.weight,sy=target/height;
 // Keep the original world root and yaw. Only the visual leaf extents change.
 for(const c of[0,4,8]){a[o+c]*=cover.reach;a[o+c+1]*=sy;a[o+c+2]*=cover.reach;}return true;
}
export function tintOchreTuft(color,cover){
 if(!cover)return false;const w=cover.weight,s=cover.sage,k=cover.shade;
 color.r+=((.28-.07*s)*k-color.r)*w;color.g+=((.255-.015*s)*k-color.g)*w;color.b+=((.17+.025*s)*k-color.b)*w;return true;
}
