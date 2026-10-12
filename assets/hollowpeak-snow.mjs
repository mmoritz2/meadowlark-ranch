// Visual late-winter deposits on the existing Hollowpeak terrain. These fields
// never participate in height, collision, climate, planting, or water decisions.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const HOLLOWPEAK_SNOW_PROFILE='hollowpeak-snow-deposits-1';
export const HOLLOWPEAK_SNOW_WIND=Object.freeze({x:.8574929257125441,z:.5144957554275265});
// Match the existing winter-core and alpine envelopes exactly. The shader keeps
// its existing ecological climate and outer thaw margin outside this support.
export function hollowpeakSnowWeight(x,z){
 return Math.max(1-smooth(66,112,Math.hypot(x+160,z+210)),
  1-smooth(.65,1.10,Math.hypot((x+150)/100,(z+333)/92)));
}
export const HOLLOWPEAK_SNOW_GLSL=/* glsl */`
float hollowpeakSnowWeight(vec2 p){
 return max(1.0-smoothstep(66.0,112.0,length(p-vec2(-160.0,-210.0))),
  1.0-smoothstep(.65,1.10,length((p-vec2(-150.0,-333.0))/vec2(100.0,92.0))));
}
`;
export function hollowpeakSnowAt(x,z,heightAt){
 if(hollowpeakSnowWeight(x,z)===0)return 0;
 const h=heightAt(x,z),dx=(heightAt(x+1,z)-heightAt(x-1,z))*.5,dz=(heightAt(x,z+1)-heightAt(x,z-1))*.5;
 const local=h-(heightAt(x+8,z)+heightAt(x-8,z)+heightAt(x,z+8)+heightAt(x,z-8))*.25;
 const broad=h-(heightAt(x+20,z)+heightAt(x-20,z)+heightAt(x,z+20)+heightAt(x,z-20))*.25;
 const prominence=local*.65+broad*.35,w=HOLLOWPEAK_SNOW_WIND;
 const lee=Math.max(0,heightAt(x-w.x*12,z-w.z*12)-h,(heightAt(x-w.x*24,z-w.z*24)-h)*.55);
 const sheltered=smooth(.8,5.5,lee),hollow=smooth(.1,2.3,-prominence),scoured=smooth(.20,1.5,prominence);
 const coldHeight=smooth(3,25,h),retention=.20+.42*coldHeight+.37*sheltered+.30*hollow-.65*scoured;
 return smooth(.30,.75,retention)*(1-smooth(.40,.92,Math.hypot(dx,dz)));
}
export function hollowpeakSnowAttribute(positions,heightAt){
 const values=new Float32Array(positions.count);
 for(let i=0;i<values.length;i++)values[i]=hollowpeakSnowAt(positions.getX(i),positions.getZ(i),heightAt);
 return values;
}
export function hollowpeakSnowRockCover({cover,relief,curvature,wet},snow,weight){
 // A dry convex crest exposes the same rock as its flank. Snow deposits recede
 // the skin so the underlying photographed snow remains the sole snow owner.
 // Wetted banks remain exact and cannot acquire a white rim from this field.
 if(wet||weight===0)return cover;
 const scoured=smooth(.08,.55,curvature)*smooth(.4,2,relief)*.96;
 const exposed=Math.max(cover,scoured)*(1-Math.max(0,Math.min(1,snow)));
 return cover+(exposed-cover)*weight;
}
