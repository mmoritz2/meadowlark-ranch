import {HOLLOWPEAK_MACROSHAPE_BOUNDS,hollowpeakMacroshape} from './hollowpeak-macroshape.mjs?v=hollowpeak-macroshape-1';
export const HOLLOWPEAK_ROOT_SEATING_PROFILE='hollowpeak-root-seating-1';
// The extra 0.02 mm retains 2.5 cm cover after instance-matrix Float32 packing.
const BAND=.22,EXPOSED=.25,EMBED=.02502,MAX_SINK=1;
// Boot-only support fitting uses the actual resident wood geometry. A single
// shared matrix translation seats the full source, all LODs and wood contacts.
export function fitHollowpeakTreeRoots(tree,heightAt){
 const {x,z}=tree,b=HOLLOWPEAK_MACROSHAPE_BOUNDS;
 if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1||hollowpeakMacroshape(x,z,100)>=100-1e-6)return null;
 const e=tree.matrix.elements,parts=tree.source.parts.filter(p=>!/leaves|twig|fruit/i.test(p.mat?.name||p.name||''));
 if(e[1]!==0||e[4]!==0||e[6]!==0||e[9]!==0||!(e[5]>0)||!e.every(Number.isFinite))throw Error('Hollowpeak root seating requires the shared upright tree matrix');
 let low=Infinity;
 for(const part of parts){const p=part.geo.attributes.position;for(let i=0;i<p.count;i++)low=Math.min(low,p.getY(i)*e[5]+e[13]);}
 if(!Number.isFinite(low))return null;
 let maximum=-Infinity,minimum=Infinity,samples=0,worst=null;
 for(const part of parts){const p=part.geo.attributes.position;for(let i=0;i<p.count;i++){
  const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),y=py*e[5]+e[13];
  if(y>low+BAND+1e-7)continue;
  const wx=px*e[0]+pz*e[8]+e[12],wz=px*e[2]+pz*e[10]+e[14],ground=heightAt(wx,wz),gap=y-ground;
  if(!Number.isFinite(gap))throw Error('Finite actual Hollowpeak root support required');
  samples++;minimum=Math.min(minimum,gap);if(gap>maximum){maximum=gap;worst={part:part.name,index:i,point:[wx,y,wz],ground};}
 }}
 if(maximum<=EXPOSED)return null;
 const sinkM=maximum+EMBED;
 if(sinkM>MAX_SINK)throw Error('Actual Hollowpeak root foot exceeds one metre seating bound');
 return {profile:HOLLOWPEAK_ROOT_SEATING_PROFILE,reason:'exposed-source-wood-foot-in-Hollowpeak-macroshape',bandM:BAND,samples,sinkM,originalY:e[13],fittedY:e[13]-sinkM,maxBeforeM:maximum,minBeforeM:minimum,maxAfterM:-EMBED,minAfterM:minimum-sinkM,sourceWoodBottomY:low,worst};
}
