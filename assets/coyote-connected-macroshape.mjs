// Original connected sandstone erosion in the shared physical terrain field.
// World-space channels retain unequal piers; no mesh, texture, loader or RNG.
export const COYOTE_CONNECTED_PROFILE='coyote-connected-macroshape-1';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const bump=x=>Math.abs(x)>=1?0:(1-x*x)**3;
const window=(a,b,c,d,x)=>ease(a,b,x)*(1-ease(c,d,x));
const northChannels=Object.freeze([
 Object.freeze({x:-311,z:43,lean:.22,curve:.0017,width:8.1,depth:7.0,z0:16,z1:78}),
 Object.freeze({x:-275,z:43,lean:-.26,curve:-.0011,width:10.5,depth:8.7,z0:10,z1:84}),
 Object.freeze({x:-234,z:34,lean:.19,curve:.0019,width:7.2,depth:6.6,z0:8,z1:73}),
 Object.freeze({x:-201,z:29,lean:-.18,curve:.0013,width:6.3,depth:5.5,z0:8,z1:67})
]);
const oasisChannels=Object.freeze([
 Object.freeze({x:-169,z:169,lean:.26,curve:-.0017,width:6.4,depth:5.4,z0:155.5,z1:193}),
 Object.freeze({x:-145,z:169,lean:-.31,curve:.0014,width:7.0,depth:7.0,z0:155.5,z1:194}),
 Object.freeze({x:-124,z:169,lean:.13,curve:.0012,width:5.2,depth:4.6,z0:155.5,z1:190})
]);
export const COYOTE_CONNECTED_CONTROLS=Object.freeze({northChannels,oasisChannels,
 northBounds:Object.freeze([-333,-168,8,86]),oasisBounds:Object.freeze([-185,-110,155.5,196]),
 protectedRelief:10,scanSupportMaxZ:154.296875,
 contourFootSeats:Object.freeze([Object.freeze([-232,53.35167810803747]),Object.freeze([-287,65.79708785328951])])});
function channels(rows,x,z){
 let cut=0;
 for(const c of rows){const v=z-c.z,centre=c.x+c.lean*v+c.curve*v*v;
  const length=window(c.z0,c.z0+7,c.z1-9,c.z1,z);
  cut=Math.max(cut,c.depth*bump((x-centre)/c.width)*length);
 }
 return cut;
}
function northCut(x,z){
 const mask=window(-333,-323,-180,-168,x)*window(8,16,76,86,z);
 if(mask===0)return 0;
 // Two short oblique benches end against retained piers. Different lengths,
 // bearings and elevations prevent a continuous horizontal layer-cake rim.
 const upper=55+.11*(x+286),lower=38-.16*(x+227);
 const benchA=1.7*window(-317,-309,-286,-277,x)*window(1,4,11,15,upper-z);
 const benchB=2.0*window(-255,-248,-215,-206,x)*window(1,5,10,16,lower-z);
 return mask*(channels(northChannels,x,z)+Math.max(benchA,benchB));
}
function oasisCut(x,z){
 const mask=window(-185,-177,-118,-110,x)*window(155.5,161.5,186,196,z)
  *ease(31,38,Math.hypot(x+200,z-158));
 if(mask===0)return 0;
 const bench=1.45*window(-163,-157,-134,-127,x)*window(0,4,10,15,181+.14*(x+148)-z);
 return mask*(channels(oasisChannels,x,z)+bench);
}
export function connectedCoyoteRelief(x,z,relief){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(relief))throw new TypeError('Finite connected terrain sample required');
 if(relief<=10)return relief;
 let cut=0;
 if(x>-333&&x<-168&&z>8&&z<86)cut=northCut(x,z);
 else if(x>-185&&x<-110&&z>155.5&&z<196)cut=oasisCut(x,z);
 if(cut===0)return relief;
 // These two steep source cells straddle the original2.2m contour even
 // though an inner corner exceeds10m. Keep their complete canonical
 // contact neighbourhood, rather than moving its linearly sampled barrier.
 for(const [sx,sz] of COYOTE_CONNECTED_CONTROLS.contourFootSeats)cut*=ease(6.2,9,Math.hypot(x-sx,z-sz));
 if(cut===0)return relief;
 // The entire old low toe remains exact. Cuts cannot introduce a new2.2m
 // obstacle contour or raise a rock into the old exterior riding space.
 return relief-Math.min(relief-9,cut*ease(10,15,relief));
}
