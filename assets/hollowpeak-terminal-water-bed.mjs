// Original finite rock bed at the terminal Hollowpeak stream and falling lip.
// Applied to the complete established absolute terrain result, before the
// canonical field, visible rock, fitted shore and ground contact are built.
export const HOLLOWPEAK_TERMINAL_BED_PROFILE='terminal-water-bed-1';
export const HOLLOWPEAK_TERMINAL_BED_BOUNDS=Object.freeze({x0:-160.5,x1:-139.5,z0:-246,z1:-240.35});
export const HOLLOWPEAK_TERMINAL_BED_COURSE=Object.freeze([[-150,-249,14.55],[-150,-242.2,14.2]].map(Object.freeze));
export const HOLLOWPEAK_TERMINAL_BED_LIMITS=Object.freeze({upstreamDepth:1.15,lipDepth:.12,minimumMovingWaterClearance:.075,maximumRise:12});
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
function hinge(x,w){if(x<=-w)return 0;if(x>=w)return x;return(x+w)*(x+w)/(4*w);}

export function terminalWaterLevel(z){
 if(!Number.isFinite(z))throw new TypeError('Finite terminal water coordinate required');
 const[a,b]=HOLLOWPEAK_TERMINAL_BED_COURSE,t=clamp((z-a[1])/(b[1]-a[1]));
 return a[2]+(b[2]-a[2])*t;
}
export function terminalBedSupport(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Finite terminal bed coordinates required');
 const b=HOLLOWPEAK_TERMINAL_BED_BOUNDS;
 if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)return 0;
 const across=Math.abs(x+150),lateral=1-ease(7.5,10.5,across);
 // Keep the next forward canonical row low: that row also supports the pool.
 // The full last source-cell support is restored before the lip rolls down.
 const along=ease(-246,-244.35,z)*(1-ease(-242.1,-240.35,z));
 return lateral*along;
}
export function seatHollowpeakTerminalWaterBed(x,z,establishedHeight){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(establishedHeight))throw new TypeError('Finite absolute terminal bed sample required');
 const support=terminalBedSupport(x,z);if(support===0)return establishedHeight;
 const level=terminalWaterLevel(z),across=Math.abs(x+150),limits=HOLLOWPEAK_TERMINAL_BED_LIMITS;
 const depth=limits.upstreamDepth-(limits.upstreamDepth-limits.lipDepth)*ease(-246,-242.2,z);
 const wetBed=level-depth;
 // Low, broad side shoulders tie the stream-bearing face into the existing
 // mass. Their level does not rise with the shallower central water depth.
 const flank=level-limits.upstreamDepth+1.25*ease(4.5,6.2,across)*(1-ease(7.5,10.5,across));
 const target=wetBed+hinge(flank-wetBed,.16);
 const rise=Math.min(limits.maximumRise,Math.max(0,target-establishedHeight));
 return establishedHeight+rise*support;
}
