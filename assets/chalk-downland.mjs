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
export function chalkDownlandReferenceLift(site,u,t){
 const U=u/site.len;if(Math.abs(U)>=.5||t<=0||t>=1)return 0;
 const crest=at(U,2),peak=at(U,1),front=smooth(t/.14)*(1-smooth((t-.27)/.27));
 // Unequal combes meet the toe and broaden downhill, never severing the ridge.
 const a=(U-(-.27+.16*t))/.090,b=(U-(.30-.19*t))/.075;
 const combe=(.13*Math.exp(-a*a)+.105*Math.exp(-b*b))*front;
 return site.h*Math.max(0,peak*cross(t,crest)-combe)*smooth((.5-Math.abs(U))/.06);
}
// Original dry down: the long western shoulder carries the mare while two
// unequal valleys drain its flanks. These metre-scale cuts, rather than surface
// noise, break up the former uniformly inflated front and rear slopes.
const downRidge=[[-.5,0,.62],[-.40,.18,.70],[-.245,1.075,.67],[-.10,.94,.615],[.09,.665,.55],[.295,.795,.565],[.425,.19,.65],[.5,0,.64]];
function ridgeValue(U,k){
 let i=0;while(i<downRidge.length-2&&U>downRidge[i+1][0])i++;
 const derivative=j=>{if(j===0||j===downRidge.length-1)return 0;const a=(downRidge[j][k]-downRidge[j-1][k])/(downRidge[j][0]-downRidge[j-1][0]),b=(downRidge[j+1][k]-downRidge[j][k])/(downRidge[j+1][0]-downRidge[j][0]);return a*b<=0?0:2*a*b/(a+b);};
 const a=downRidge[i],b=downRidge[i+1],span=b[0]-a[0],q=clamp((U-a[0])/span),q2=q*q,q3=q2*q;
 return(2*q3-3*q2+1)*a[k]+(q3-2*q2+q)*span*derivative(i)+(-2*q3+3*q2)*b[k]+(q3-q2)*span*derivative(i+1);
}
function frontSlope(q){
 const knots=[[0,0,0],[.20,.105,.97],[.55,.60,1.40],[.80,.90,.78],[1,1,0]];
 let i=0;while(i<knots.length-2&&q>knots[i+1][0])i++;
 const a=knots[i],b=knots[i+1],span=b[0]-a[0],t=clamp((q-a[0])/span),t2=t*t,t3=t2*t;
 return(2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*span*a[2]+(-2*t3+3*t2)*b[1]+(t3-t2)*span*b[2];
}
export function chalkDownlandLift(site,u,t){
 const U=u/site.len;if(Math.abs(U)>=.5||t<=0||t>=1)return 0;
 const crest=ridgeValue(U,2),peak=ridgeValue(U,1),q=t/crest;
 const body=peak*(q<=1?frontSlope(q):Math.pow(1-smooth((t-crest)/(1-crest)),1.16));
 const valleyGate=smooth(t/.075)*(1-smooth((t-.48)/.29));
 const west=Math.exp(-Math.pow((U-(-.355+.115*t))/(.052+.040*(1-t)),2));
 const east=Math.exp(-Math.pow((U-(.282-.100*t))/(.047+.033*(1-t)),2));
 const valleys=(.145*west+.183*east)*valleyGate;
 // Discontinuous low turf steps follow contour height and terminate at the
 // valleys. Their centimetre-scale relief stays subordinate to the shoulders.
 const terrace=.0055*Math.sin((body*site.h+U*.8)*Math.PI/1.45)*smooth(t/.10)*(1-smooth((t-.48)/.12))*(1-Math.max(west,east));
 return site.h*Math.max(0,body-valleys+terrace)*smooth((.5-Math.abs(U))/.06);
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
// Use the same authored path for physical incision and visible mineral faces;
// this collector has no THREE/UUID/resource allocation or random dependency.
export function chalkMareOutline(divisions=14){
 const points=[];let x=0,y=0;
 const path={moveTo(a,b){x=a;y=b;points.push([x,y]);},lineTo(a,b){if(a!==x||b!==y)points.push([a,b]);x=a;y=b;},bezierCurveTo(ax,ay,bx,by,cx,cy){const sx=x,sy=y;for(let i=1;i<=divisions;i++){const t=i/divisions,q=1-t;points.push([q*q*q*sx+3*q*q*t*ax+3*q*t*t*bx+t*t*t*cx,q*q*q*sy+3*q*q*t*ay+3*q*t*t*by+t*t*t*cy]);}x=cx;y=cy;}};
 drawChalkMare(path);if(points.length>1&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();return points;
}
export function chalkScourDepth(site,u,t,outline){
 const px=(u-CHALK_MARE_PANEL.xOffset)/CHALK_MARE_PANEL.xScale,py=(t-CHALK_MARE_PANEL.tBase)/CHALK_MARE_PANEL.tScale;
 if(px< -15.1||px>14.2||py< -3||py>12.3)return 0;
 const sx=CHALK_MARE_PANEL.xScale,sz=CHALK_MARE_PANEL.tScale*site.depth;let inside=false,d2=Infinity;
 for(let i=0,j=outline.length-1;i<outline.length;j=i++){
  const a=outline[i],b=outline[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  const dx=(b[0]-a[0])*sx,dz=(b[1]-a[1])*sz,qx=(px-a[0])*sx,qz=(py-a[1])*sz,l2=dx*dx+dz*dz,k=l2?clamp((qx*dx+qz*dz)/l2):0;
  d2=Math.min(d2,(qx-dx*k)**2+(qz-dz*k)**2);
 }
 if(!inside)return 0;
 return(.049+.006*Math.sin(u*.43+t*17)*Math.sin(u*.79-t*11))*smooth(Math.sqrt(d2)/.48);
}
