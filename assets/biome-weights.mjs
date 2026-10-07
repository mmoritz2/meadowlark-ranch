// One deterministic ecotone for visible ground and planted cover. Metres.
export const COYOTE_DRY_BAND={x:-220,z:130,inner:96,outer:172,warp:18};
export function smoothWeight(a,b,v){const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
export function coyoteDryWeight(x,z,relief=0){
 const radius=Math.hypot(x+220,z-130);if(radius>=190)return 0;
 const warp=Math.sin(x*.028+z*.021)*9+Math.sin(z*.073-x*.017+1.7)*5+Math.sin(x*.008-z*.014-.7)*4;
 const soil=1-smoothWeight(96,172,radius+warp);
 const river=Math.abs(z-(120+Math.sin(x*.012)*45));
 return soil*smoothWeight(9,20,river)*(1-smoothWeight(.12,1.7,relief));
}
// The raised down is installed after the seed layer. Travelling/native cover can
// then use its sampled relief; importing this module never changes world state.
export function coyoteCoverDryWeight(x,z){return coyoteDryWeight(x,z,globalThis.__chalkReliefAt?.(x,z)||0)}
export const COYOTE_DRY_GLSL=`
float coyoteDryWeight(vec2 p,float relief){
 float radius=length(p-vec2(-220.,130.));if(radius>=190.)return 0.;
 float warp=sin(p.x*.028+p.y*.021)*9.+sin(p.y*.073-p.x*.017+1.7)*5.+sin(p.x*.008-p.y*.014-.7)*4.;
 float soil=1.-smoothstep(96.,172.,radius+warp);
 float river=abs(p.y-(120.+sin(p.x*.012)*45.));
 return soil*smoothstep(9.,20.,river)*(1.-smoothstep(.12,1.7,relief));
}`;
