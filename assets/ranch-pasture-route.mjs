/* Authored ranch/pasture connection. Coordinates are shared by the visible road,
 * its west-arena opening and the relocated pavilion. Stalls and the existing
 * pasture gate keep their original placement and gameplay ownership.
 *
 * The normal 5.8m road cannot fit between the summon stall and pasture fence or
 * through the pasture's 3m sign posts. This one route narrows before those
 * places; the FULL feathered ribbon is tested, not only its painted middle.
 */
export const RANCH_PASTURE_GATE=Object.freeze({x:-25,z1:-1,z2:7});
export const RANCH_GRANDSTAND=Object.freeze({x:-28.5,z:15,rotation:Math.PI/2,seatX:-31.5});
export const RANCH_PASTURE_TROUGH=Object.freeze({x:-38,z:-15,radius:1.1,scale:1.3});

// x, z, full ribbon HALF-width. Narrow pins retain real stall/fence clearance.
const pins=[[-7,3,1.5],[-15,4,1.7],[-22,3,2],[-25,3,2],[-28,3,2],
 [-30.8,1.1,1.15],[-31.65,-1.5,.85],[-31.65,-4.5,.85],[-31.65,-6,.85],
 [-32,-8.1,.75],[-33,-9,.85],[-36,-9,1.2],[-40,-10,2],[-48,-11,2.4],
 [-60,-10,2.7],[-71,-10,2.7]];
export const RANCH_PASTURE_ROUTE=Object.freeze(pins.map(([x,z])=>Object.freeze([x,z])));
const cr=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
// Same uniform Catmull–Rom basis as the other roads, with dense sampling only
// on this constrained connection. Width interpolates without spline overshoot.
export const RANCH_PASTURE_ROAD=Object.freeze((()=>{
 const out=[];
 for(let i=0;i<pins.length-1;i++){
  const a=pins[Math.max(0,i-1)],b=pins[i],c=pins[i+1],d=pins[Math.min(pins.length-1,i+2)];
  const steps=Math.max(3,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/.2));
  for(let k=0;k<steps;k++){
   const t=k/steps;out.push(Object.freeze([cr(a[0],b[0],c[0],d[0],t),cr(a[1],b[1],c[1],d[1],t),b[2]+(c[2]-b[2])*t]));
  }
 }
 out.push(Object.freeze([...pins.at(-1)]));return out;
})());

const segments=ROUTE_SEGMENTS();
function ROUTE_SEGMENTS(){return RANCH_PASTURE_ROUTE.slice(1).map((b,i)=>{const a=RANCH_PASTURE_ROUTE[i],dx=b[0]-a[0],dz=b[1]-a[1];return {x:a[0],z:a[1],dx,dz,len2:dx*dx+dz*dz};});}
// Only random planting/rocks use this reservation, after their placement draws.
// No fixed prop or collision is removed by this helper. The conservative shoulder
// contains the complete curved road (including its maximum spline deviation).
export function ranchPastureReserved(x,z,radius=0){
 if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 const pad=Number.isFinite(radius)?Math.max(0,radius):0;
 if(x>=RANCH_GRANDSTAND.x-4.4-pad&&x<=RANCH_GRANDSTAND.x+1.6+pad&&Math.abs(z-RANCH_GRANDSTAND.z)<=7.2+pad)return true;
 const limit=(3.6+pad)**2;
 for(const s of segments){const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(z-s.z)*s.dz)/s.len2)),dx=x-s.x-s.dx*t,dz=z-s.z-s.dz*t;if(dx*dx+dz*dz<limit)return true;}
 return false;
}
