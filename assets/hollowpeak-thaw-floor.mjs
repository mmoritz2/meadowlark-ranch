import {hollowpeakFoothillThaw,hollowpeakSnowWeight} from './hollowpeak-snow.mjs?v=cold-landscape-1';

// Decorative cover only. Climate/species, terrain, water and placement are owned
// by their existing sources. East of Frostpine's exact support, join continuously.
export const HOLLOWPEAK_THAW_FLOOR_PROFILE='hollowpeak-thaw-floor-1';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const TINT=Object.freeze([linear(182/255),linear(179/255),linear(150/255)]);
export function hollowpeakThawFloorAt(x,z,heightAt){
 if(typeof heightAt!=='function'||!Number.isFinite(x+z)||x<=-212)return null;
 const climate=Math.max(1-smooth(88,158,Math.hypot(x+160,z+210)),
  1-smooth(.65,1.10,Math.hypot((x+150)/100,(z+333)/92)));
 const weight=hollowpeakSnowWeight(x,z)*smooth(.08,.30,climate)*smooth(-212,-192,x);
 if(weight===0)return null;
 const height=heightAt(x,z);if(!Number.isFinite(height))return null;
 const thaw=hollowpeakFoothillThaw(x,z,height),influence=weight*thaw;
 if(influence<=0)return null;
 const response=smooth(0,.06,influence);
 // Smooth patches vary the short straw-green floor, without an ambient draw.
 const patch=.5+.5*Math.sin(x*.071+z*.031)*Math.sin(z*.059-x*.023);
 const floorHeight=.14+.06*patch;
 return {profile:HOLLOWPEAK_THAW_FLOOR_PROFILE,weight,thaw,influence,
  snowFreeGuaranteed:thaw===1,density:influence*(.24+.34*thaw),
  height:floorHeight,heightCap:floorHeight/(response*response),
  tint:'#b6b396',tintAmount:.72*response};
}

// An absolute ceiling is idempotent across packing/LOD/late presentation passes.
// Measure actual vertices after the producer's matrix, retain every X/Z and the
// lowest world point, and squeeze only world Y. No geometry/resource is created.
export function respondHollowpeakThawMatrix(a,o,geometry,groundHeight,profile){
 if(!profile||!Number.isFinite(profile.heightCap)||profile.heightCap<=0)return 1;
 const p=geometry?.attributes?.position;if(!p||p.count===0)return 1;
 let min=Infinity,max=-Infinity;
 for(let i=0;i<p.count;i++){
  const y=a[o+1]*p.getX(i)+a[o+5]*p.getY(i)+a[o+9]*p.getZ(i)+a[o+13];
  min=Math.min(min,y);max=Math.max(max,y);
 }
 const ground=groundHeight(a[o+12],a[o+14]),target=ground+profile.heightCap;
 if(!Number.isFinite(min+max+target)||max<=target+1e-9||max-min<=1e-12||min>=target)return 1;
 const factor=Math.max(0,Math.min(1,(target-min)/(max-min)));
 a[o+1]*=factor;a[o+5]*=factor;a[o+9]*=factor;
 a[o+13]=min+(a[o+13]-min)*factor;
 return factor;
}
export function respondHollowpeakThawColor(color,profile,offset=0){
 if(!profile)return false;
 const w=profile.tintAmount;
 if(color.isColor){color.r+=(TINT[0]-color.r)*w;color.g+=(TINT[1]-color.g)*w;color.b+=(TINT[2]-color.b)*w;}
 else for(let i=0;i<3;i++)color[offset+i]+=(TINT[i]-color[offset+i])*w;
 return true;
}
