// A rounded front cutaway joins the longer side and back panels smoothly.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function coatHemDisplacement(x,z){
 const front=smooth(-.065,.050,z),center=1-smooth(.018,.135,Math.abs(x));
 return -.060+front*(.038+.050*center);
}
