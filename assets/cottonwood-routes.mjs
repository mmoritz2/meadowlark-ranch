// Authored riding corridors, shared by ground tracks and courier guidance.
// Keep scenery outside these paths so a fresh world cannot plant a tree in the route.
const freeze=points=>Object.freeze(points.map(p=>Object.freeze(p)));
export const COTTONWOOD_ROUTES=Object.freeze({
 out:freeze([[-8,-15.5],[-3,-16],[-3,-22],[1,-22],[2,-31],[-14,-41],[-30,-58]]),
 road:freeze([[-30,-58],[-14,-41],[2,-31],[27,-31],[39,-39]]),
 woodland:freeze([[-30,-58],[-28,-50],[-18,-50],[-12,-53],[-2,-53],[15,-48],[24,-33],[39,-39]]),
 home:freeze([[39,-39],[27,-31],[2,-31],[1,-22],[-3,-22],[-3,-16],[-8,-15.5]])
});
export const COTTONWOOD_TRACKS=Object.freeze([
 freeze([[-3,-20],[-3,-22],[1,-22],[2,-31],[-14,-41],[-30,-58]]),
 freeze([[2,-31],[27,-31],[39,-39]]),
 COTTONWOOD_ROUTES.woodland
]);
export function cottonwoodTrackDistance(x,z){
 let best=Infinity;
 for(const line of COTTONWOOD_TRACKS)for(let i=1;i<line.length;i++){
  const [ax,az]=line[i-1],[bx,bz]=line[i],dx=bx-ax,dz=bz-az;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
  best=Math.min(best,Math.hypot(x-ax-t*dx,z-az-t*dz));
 }
 return best;
}
