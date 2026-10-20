// Original Hollowpeak-only falling-water depth. Adjacent veils sample one
// continuous whole-width field; the incoming lip, landing and outer run stay put.
export const HOLLOWPEAK_CATARACT_PROFILE='hollowpeak-cataract-1';
const bump=t=>Math.abs(t)>=1?0:(1-t*t)**3;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function hollowpeakCataractPoint(flow,s,point){
 if(s===0||s===1)return point;
 if(!(Number.isFinite(s)&&s>0&&s<1&&flow.width>0&&flow.run>0&&point.length===3&&point.every(Number.isFinite)))throw Error('Finite interior flow point required');
 const landing=smooth((s-.78)/.22),spread=(1+.29*s+.02*Math.sin(Math.PI*s))*(1-landing)+(flow.footWidth?flow.footWidth/flow.width:1.29)*landing;
 const across=(point[0]-flow.x)/(flow.width*spread),fall=Math.sin(Math.PI*s)**2;
 // Two unequal, bending lobes separate a deep main current from a narrower
 // side current. No per-strip displacement can open a joined boundary.
 const lean=.055*Math.sin(Math.PI*s),depth=.15
  +.43*bump((across+.37-lean)/.52)
  +.27*bump((across-.46+lean*.6)/.34);
 const room=Math.max(0,flow.z+flow.run-point[2]);
 const advance=Math.min(room*.75,depth*fall);
 return [point[0],point[1],point[2]+advance];
}
