// Original Frostpine snow deposits and scoured heath. Coordinates are world metres.
// This is a surface/ground-cover field: it never displaces physical terrain.
export const FROSTPINE_TRANSITION_PROFILE='frostpine-transition-1';
export const FROSTPINE_TRANSITION_BOUNDS=Object.freeze({x0:-468,x1:-212,z0:-478,z1:-190});
const OUTSIDE=Object.freeze({weight:0,deposit:0,pasture:1,scour:0});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function frostpineTransitionAt(x,z){
 const b=FROSTPINE_TRANSITION_BOUNDS;
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)return OUTSIDE;
 const dx=x+314,dz=z+334,q=Math.hypot(dx/150,dz/143);
 const weight=(1-smooth(.70,1,q))*(1-smooth(-236,-212,x));
 if(weight===0)return OUTSIDE;
 const u=dx*.8574929257125441+dz*.5144957554275265,v=-dx*.5144957554275265+dz*.8574929257125441;
 const main=(1-smooth(5,17,Math.abs(v-(8*Math.sin(u*.023)-5))))*smooth(-150,-114,u)*(1-smooth(102,134,u));
 const branch=(1-smooth(3,11,Math.abs(v-(-25-.24*(u+32)+3*Math.sin(u*.02)))))*smooth(-130,-104,u)*(1-smooth(8,31,u));
 const scour=Math.max(main,branch*.94);
 const lee=1-smooth(12,30,Math.abs(v-(36+6*Math.sin(u*.014))));
 const tongue=1-smooth(10,25,Math.abs(v-(-45+7*Math.sin(u*.017+1))));
 const latitude=1-smooth(-20,60,dz+dx*.20);
 const limit=1-smooth(.79,1.02,q+.06*Math.sin(u*.014)+.035*Math.sin(v*.021));
 const deposit=clamp((.35+.57*latitude+.14*lee+.08*tongue)*limit-.82*scour);
 // Dormant, fine cover colonises connected thawed ground. It remains shorter
 // and less dense than summer turf even where a winter scour is snow-free.
 const pasture=(1-smooth(.08,.66,deposit))*(1-.68*weight);
 return {weight,deposit,pasture,scour};
}
export const FROSTPINE_TRANSITION_GLSL=`
vec3 frostpineTransition(vec2 p){
 if(p.x<=-468.0||p.x>=-212.0||p.y<=-478.0||p.y>=-190.0)return vec3(0.0,1.0,0.0);
 vec2 d=p+vec2(314.0,334.0);
 float q=length(d/vec2(150.0,143.0));
 float influence=(1.0-smoothstep(.70,1.0,q))*(1.0-smoothstep(-236.0,-212.0,p.x));
 if(influence<=0.0)return vec3(0.0,1.0,0.0);
 float u=dot(d,vec2(.8574929257125441,.5144957554275265));
 float v=dot(d,vec2(-.5144957554275265,.8574929257125441));
 float mainScour=(1.0-smoothstep(5.0,17.0,abs(v-(8.0*sin(u*.023)-5.0))))*smoothstep(-150.0,-114.0,u)*(1.0-smoothstep(102.0,134.0,u));
 float branch=(1.0-smoothstep(3.0,11.0,abs(v-(-25.0-.24*(u+32.0)+3.0*sin(u*.02)))))*smoothstep(-130.0,-104.0,u)*(1.0-smoothstep(8.0,31.0,u));
 float scour=max(mainScour,branch*.94);
 float lee=1.0-smoothstep(12.0,30.0,abs(v-(36.0+6.0*sin(u*.014))));
 float tongue=1.0-smoothstep(10.0,25.0,abs(v-(-45.0+7.0*sin(u*.017+1.0))));
 float latitude=1.0-smoothstep(-20.0,60.0,d.y+d.x*.20);
 float limit=1.0-smoothstep(.79,1.02,q+.06*sin(u*.014)+.035*sin(v*.021));
 float deposit=clamp((.35+.57*latitude+.14*lee+.08*tongue)*limit-.82*scour,0.0,1.0);
 float pasture=(1.0-smoothstep(.08,.66,deposit))*(1.0-.68*influence);
 return vec3(deposit,pasture,influence);
}
`;
