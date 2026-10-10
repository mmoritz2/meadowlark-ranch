// Original connected chalk down: a diagonal rear ridge and two dry combes.
// Normalized local coordinates retain the surveyed rectangle and its zero hem.
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const ridge=[[-.5,0,.52],[-.38,.29,.58],[-.245,1.10,.66],[-.075,.99,.63],[.105,.74,.535],[.285,.91,.59],[.41,.32,.65],[.5,0,.62]];
function tangent(i,k){
 if(i===0||i===ridge.length-1)return 0;
 const a=(ridge[i][k]-ridge[i-1][k])/(ridge[i][0]-ridge[i-1][0]),b=(ridge[i+1][k]-ridge[i][k])/(ridge[i+1][0]-ridge[i][0]);
 return a*b<=0?0:2*a*b/(a+b);
}
function at(u,k){
 let i=0;while(i<ridge.length-2&&u>ridge[i+1][0])i++;
 const a=ridge[i],b=ridge[i+1],span=b[0]-a[0],t=clamp((u-a[0])/span),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*span*tangent(i,k)+(-2*t3+3*t2)*b[k]+(t3-t2)*span*tangent(i+1,k);
}
function cross(t,crest){
 // The unbroken front scarp carries the cutting; the back is a longer dip slope.
 const q=t/crest;
 if(q<=1)return smooth(q);
 return 1-smooth((t-crest)/(1-crest));
}
export function chalkDownlandLift(site,u,t){
 const U=u/site.len;if(Math.abs(U)>=.5||t<=0||t>=1)return 0;
 const crest=at(U,2),peak=at(U,1),front=smooth(t/.14)*(1-smooth((t-.27)/.27));
 // Unequal combes meet the toe and broaden downhill, never severing the ridge.
 const a=(U-(-.27+.16*t))/.090,b=(U-(.30-.19*t))/.075;
 const combe=(.13*Math.exp(-a*a)+.105*Math.exp(-b*b))*front;
 return site.h*Math.max(0,peak*cross(t,crest)-combe)*smooth((.5-Math.abs(U))/.06);
}
export const CHALK_MARE_PANEL=Object.freeze({xScale:.80,xOffset:-5,tBase:.185,tScale:.0265});
export function chalkMareCoordinates(site,fx,fy){return [fx*CHALK_MARE_PANEL.xScale+CHALK_MARE_PANEL.xOffset,CHALK_MARE_PANEL.tBase+fy*CHALK_MARE_PANEL.tScale];}
export function drawChalkMare(s){
 // Original broadside gallop: open leg spaces, a full barrel, raised neck and ears.
 s.moveTo(-7.4,6.3);
 s.bezierCurveTo(-10.1,6.9,-12.2,9.2,-15,8.0);s.bezierCurveTo(-12.4,7.4,-11.9,4.5,-8.1,4.0);
 s.bezierCurveTo(-9.0,2.8,-11.3,.6,-13.8,-.9);s.lineTo(-15,-2.1);s.lineTo(-13.1,-2.3);s.lineTo(-11.7,-1.1);s.lineTo(-6.5,2.5);
 s.lineTo(-6.1,1.4);s.lineTo(-8.0,-.6);s.lineTo(-6.0,-2.9);s.lineTo(-3.8,-2.7);s.lineTo(-3.9,-1.9);s.lineTo(-5.4,-1.8);s.lineTo(-5.8,-.8);s.lineTo(-3.7,2.2);
 s.bezierCurveTo(-1.5,1.4,1.3,1.8,3.3,3.0);
 s.lineTo(7.6,-.3);s.lineTo(12.1,-1.9);s.lineTo(13.7,-1.5);s.lineTo(13.5,-.6);s.lineTo(8.5,.8);s.lineTo(5.1,4.2);
 s.lineTo(8.1,3.0);s.lineTo(10.5,4.0);s.lineTo(10.1,5.0);s.lineTo(9.3,5.0);s.lineTo(7.9,4.1);s.lineTo(6.0,5.5);
 s.bezierCurveTo(7.2,6.6,8.2,8.1,9.4,8.8);s.lineTo(11.8,8.1);s.lineTo(13.8,8.7);s.lineTo(14.1,9.6);s.lineTo(13.3,10.2);s.lineTo(11.8,10.6);
 s.lineTo(11.4,12.2);s.lineTo(10.8,12.1);s.lineTo(10.5,10.8);s.lineTo(9.9,12.0);s.lineTo(9.4,11.8);s.lineTo(9.6,10.2);
 s.bezierCurveTo(8.1,9.8,7.0,8.6,5.3,7.0);s.bezierCurveTo(2.6,6.0,.1,6.5,-2.5,6.3);s.bezierCurveTo(-4.5,7.0,-6.1,7.0,-7.4,6.3);
}
