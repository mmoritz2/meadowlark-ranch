// Artifact-only two-sided moving sphere / finite triangle kernel.
// No XZ projection, buried-origin rule, renderer, registry, Three or RNG.
export const SPHERE_TRIANGLE_TOI_PROFILE='sphere-finite-triangle-toi-study-2';
const E=Number.EPSILON;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vector=v=>{if(!v)return null;if((Array.isArray(v)||ArrayBuffer.isView(v))&&v.length!==3)return null;const a=Array.isArray(v)||ArrayBuffer.isView(v)?[v[0],v[1],v[2]]:[v.x,v.y,v.z];return a.every(Number.isFinite)?a:null;};
export function sweepSphereTriangle(origin,end,radius,triangle,out={}){
 let facePlanes=0,edgeQuadratics=0,vertexQuadratics=0,rootCandidates=0;
 const answer=(status,reason,fraction,extra={})=>{for(const k of ['status','reason','complete','fraction','backoffFractionEstimate','work','initialDistance','initialFeature','motionRelative','escapePermitted','degenerate','degenerateOrThin','tentativeFraction','confirmedLaterHit','feature','timeErrorEstimate','uncertainTimeInterval','nominalFraction','endpointDistance'])delete out[k];return Object.assign(out,{status,reason,complete:status==='clear'||status==='hit'||status==='initial-overlap',fraction,backoffFractionEstimate:status==='clear'?1:0,work:{facePlanes,edgeQuadratics,vertexQuadratics,rootCandidates},...extra});};
 let O,P,A,B,C;try{O=vector(origin);P=vector(end);if(!Array.isArray(triangle)||triangle.length!==3)return answer('invalid','three finite source vertices required',0);[A,B,C]=triangle.map(vector);}catch{return answer('invalid','unreadable numeric input',0);}
 if(!O||!P||!A||!B||!C||!Number.isFinite(radius)||!(radius>0))return answer('invalid','finite centers/source and strictly positive finite radius required',0);
 const rawV=sub(P,O),rawU=sub(B,A),rawW=sub(C,A),rawO=sub(O,A);if(![...rawV,...rawU,...rawW,...rawO].every(Number.isFinite))return answer('invalid','coordinate subtraction overflow',0);
 const maxAbs=Math.max(radius,...O.map(Math.abs),...P.map(Math.abs),...A.map(Math.abs),...B.map(Math.abs),...C.map(Math.abs));
 const worldError=64*E*maxAbs;
 for(let k=0;k<3;k++){const lo=Math.min(A[k],B[k],C[k]),hi=Math.max(A[k],B[k],C[k]);if(Math.max(O[k],P[k])+radius+worldError<lo||Math.min(O[k],P[k])-radius-worldError>hi)return answer('clear','strict expanded segment/triangle AABB separation',1);}
 const scale=Math.max(radius,...rawV.map(Math.abs),...rawU.map(Math.abs),...rawW.map(Math.abs),...rawO.map(Math.abs));if(!(scale>0&&Number.isFinite(scale)))return answer('invalid','finite nonzero normalization scale required',0);
 const inv=1/scale;if(!Number.isFinite(inv))return answer('uncertain','subnormal normalization is unresolved',0,{complete:false});
 const v=mul(rawV,inv),u=mul(rawU,inv),w=mul(rawW,inv),o=mul(rawO,inv),r=radius*inv,rr=r*r,tau=64*E*(1+maxAbs/scale);if(!(r>0&&rr>0&&Number.isFinite(tau)))return answer('uncertain','radius/conditioning underflow or overflow',0,{complete:false});
 const verts=[[0,0,0],u,w],edges=[[0,1],[1,2],[2,0]],speed2=dot(v,v),nRaw=cross(u,w),nLength=Math.hypot(...nRaw),uLength=Math.hypot(...u),wLength=Math.hypot(...w);
 // Sphere enclosing the entire convex triangle: conservative broad phase only.
 const center=mul([u[0]+w[0],u[1]+w[1],u[2]+w[2]],1/3),boundRadius=Math.max(...verts.map(a=>Math.hypot(...sub(a,center)))),toCenter=sub(center,o),ct=speed2?Math.max(0,Math.min(1,dot(toCenter,v)/speed2)):0,closestCenter=sub(sub(o,center),mul(v,-ct)),boundDistance=Math.hypot(...closestCenter);
 if(boundDistance>boundRadius+r+tau*64)return answer('clear','strict enclosing-sphere broad-phase separation',1);
 const n=nLength?mul(nRaw,1/nLength):null,thin=nLength<=tau*8*(uLength+wLength)+64*E*uLength*wLength;
 const duplicates=A.every((x,k)=>x===B[k])||B.every((x,k)=>x===C[k])||C.every((x,k)=>x===A[k]);
 // A nonzero but ill-conditioned face is not silently collapsed to an edge.
 // Exact duplicate-vertex triangles are finite segment/point sets and supported.
 if(thin&&!duplicates)return answer('uncertain','collinear or near-degenerate face needs stronger predicate',0,{complete:false,degenerateOrThin:true});
 const dominant=n?Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2:0,axes=[0,1,2].filter(k=>k!==dominant),orient=n?u[axes[0]]*w[axes[1]]-u[axes[1]]*w[axes[0]]:0;
 function inside(q){const signs=[];for(let i=0;i<3;i++){const a=sub(verts[i],q),b=sub(verts[(i+1)%3],q),d=a[axes[0]]*b[axes[1]]-a[axes[1]]*b[axes[0]],err=32*E*(Math.abs(a[axes[0]]*b[axes[1]])+Math.abs(a[axes[1]]*b[axes[0]]))+tau*16*(Math.hypot(...a)+Math.hypot(...b)+tau);signs.push([d*Math.sign(orient),err]);}if(signs.some(([s,e])=>s< -e))return'outside';return signs.every(([s,e])=>s>e)?'inside':'boundary-uncertain';}
 let initial2=Infinity,initialClosest=null,initialFeature=null,initialFaceAmbiguous=false;
 const distanceCandidate=(point,feature)=>{const d=sub(o,point),d2=dot(d,d);if(d2<initial2){initial2=d2;initialClosest=d;initialFeature=feature;}};
 for(let i=0;i<3;i++)distanceCandidate(verts[i],'vertex'+i);
 for(let i=0;i<3;i++){const[a,b]=edges[i].map(j=>verts[j]),e=sub(b,a),l=dot(e,e);if(l===0)continue;const t=Math.max(0,Math.min(1,dot(sub(o,a),e)/l));distanceCandidate([a[0]+e[0]*t,a[1]+e[1]*t,a[2]+e[2]*t],'edge'+i);}
 if(!thin){const side=dot(o,n),q=sub(o,mul(n,side)),location=inside(q);if(location!=='outside'){if(side*side<initial2){initial2=side*side;initialClosest=mul(n,side);initialFeature='face';initialFaceAmbiguous=location!=='inside';}}}
 const distanceError=tau*64*(1+Math.sqrt(initial2)+r)+64*E*(initial2+rr);
 if(initial2<=rr+distanceError){const motion=dot(initialClosest,v),motionError=tau*64*(1+Math.hypot(...initialClosest)+Math.sqrt(speed2));return answer('initial-overlap',initial2<rr-distanceError&&!initialFaceAmbiguous?'definite initial radius overlap':'initial touch or distance/predicate roundoff band',0,{complete:initial2<rr-distanceError&&!initialFaceAmbiguous,initialDistance:Math.sqrt(Math.max(0,initial2))*scale,initialFeature,motionRelative:motion>motionError?'away':motion< -motionError?'inward':'tangent-or-undefined',escapePermitted:false,degenerate:thin});}
 if(speed2===0)return answer('clear','stationary sphere strictly separated',1,{degenerate:thin});
 let best=Infinity,bestError=0,bestFeature=null,unknown=Infinity,unknownReason=null,unknownInterval=null,unknownNominal=null;
 // Time uncertainty is a closed interval, not a test of the nominal root.
 // If arithmetic cannot bound it, the entire supplied sweep stays unresolved.
 const closedTimeInterval=(t,error)=>{if(!Number.isFinite(t)||!Number.isFinite(error)||error<0)return[0,1];const lo=Math.max(0,t-error),hi=Math.min(1,t+error);return lo>hi?null:[lo,hi];};
 const maybe=(t,error,reason)=>{const interval=closedTimeInterval(t,error);if(interval&&interval[0]<unknown){unknown=interval[0];unknownReason=reason;unknownInterval=interval;unknownNominal=Number.isFinite(t)?t:null;}};
 const candidate=(t,error,feature,filter)=>{if(!Number.isFinite(t)||!Number.isFinite(error)||error<0){maybe(t,error,'nonfinite candidate arithmetic');return;}const interval=closedTimeInterval(t,error);if(!interval)return;const bounded=Math.max(0,Math.min(1,t));if(interval[0]===0||interval[1]===1){maybe(t,error,'finite time boundary uncertainty '+feature);return;}const location=filter?.(bounded,error)||'inside';if(location==='outside')return;if(location!=='inside'){maybe(t,error,'finite feature boundary uncertainty '+feature);return;}if(bounded<best){best=bounded;bestError=error;bestFeature=feature;}};
 function quadratic(q,d,feature,filter){const aa=dot(d,d),bb=dot(q,d),cc=dot(q,q)-rr,coefficientError=tau*64*(1+Math.hypot(...q)+Math.hypot(...d)+r)+64*E*(Math.abs(aa)+Math.abs(bb)+Math.abs(cc));if(aa===0){if(Math.abs(cc)<=coefficientError)maybe(0,1,'parallel feature-radius ambiguity '+feature);return;}const star=-bb/aa,clamped=Math.max(0,Math.min(1,star)),minimum=(aa*clamped+2*bb)*clamped+cc;if(minimum>coefficientError*8)return;const disc=bb*bb-aa*cc,discError=64*E*(bb*bb+Math.abs(aa*cc))+coefficientError*(2*Math.abs(bb)+Math.abs(aa)+Math.abs(cc)+coefficientError);if(disc< -discError)return;if(Math.abs(disc)<=discError){maybe(0,1,'tangent or discriminant roundoff '+feature);return;}const root=Math.sqrt(disc),stable=-bb-(bb>=0?root:-root),roots=stable===0?[-bb/aa]:[stable/aa,cc/stable];for(const t of roots){rootCandidates++;const derivative=Math.abs(2*(aa*t+bb)),error=coefficientError*(t*t+2*Math.abs(t)+1)/Math.max(derivative,tau)+tau*64;if(!(error<.01)){maybe(t,error,'ill-conditioned quadratic root '+feature);continue;}candidate(t,error,feature,filter);}}
 if(!thin){const side=dot(o,n),normalSpeed=dot(v,n);for(const sign of[-1,1]){facePlanes++;if(normalSpeed===0)continue;const t=(sign*r-side)/normalSpeed,error=tau*64*(1+Math.abs(t)+Math.abs(side)+r)/Math.abs(normalSpeed);if(!(error<.01)){maybe(t,error,'near-parallel face contact');continue;}candidate(t,error,'face'+(sign>0?'+':'-'),time=>inside(sub([o[0]+v[0]*time,o[1]+v[1]*time,o[2]+v[2]*time],mul(n,sign*r))));}}
 for(let i=0;i<3;i++){edgeQuadratics++;const[a,b]=edges[i].map(j=>verts[j]),e=sub(b,a),len2=dot(e,e);if(len2===0)continue;const offset=sub(o,a),along=dot(offset,e)/len2,alongSpeed=dot(v,e)/len2,perp=sub(offset,mul(e,along)),perpSpeed=sub(v,mul(e,alongSpeed));quadratic(perp,perpSpeed,'edge'+i,(t,error)=>{const k=along+t*alongSpeed,band=tau*64*(1+Math.abs(along)+Math.abs(alongSpeed))+Math.abs(alongSpeed)*error;if(k< -band||k>1+band)return'outside';return k>band&&k<1-band?'inside':'boundary-uncertain';});}
 for(let i=0;i<3;i++){vertexQuadratics++;quadratic(sub(o,verts[i]),v,'vertex'+i);}
 if(Number.isFinite(unknown)&&unknown<=best+bestError)return answer('uncertain',unknownReason,0,{complete:false,tentativeFraction:unknown,uncertainTimeInterval:unknownInterval,nominalFraction:unknownNominal,confirmedLaterHit:Number.isFinite(best)?best:null,degenerate:thin});
 if(Number.isFinite(best))return answer('hit','earliest finite-feature contact from completed analytic candidates',best,{feature:bestFeature,timeErrorEstimate:bestError,backoffFractionEstimate:Math.max(0,best-bestError),degenerate:thin});
 // Backstop only a would-be-clear result at the CLOSED endpoint. This does not
 // claim endpoint contact was the first contact, or override a known earlier hit.
 const p=[o[0]+v[0],o[1]+v[1],o[2]+v[2]];let end2=Infinity;
 const endDistance=point=>{const d=sub(p,point),d2=dot(d,d);if(d2<end2)end2=d2;};
 for(let i=0;i<3;i++)endDistance(verts[i]);
 for(let i=0;i<3;i++){const[a,b]=edges[i].map(j=>verts[j]),e=sub(b,a),l=dot(e,e);if(l===0)continue;const t=Math.max(0,Math.min(1,dot(sub(p,a),e)/l));endDistance([a[0]+e[0]*t,a[1]+e[1]*t,a[2]+e[2]*t]);}
 if(!thin){const side=dot(p,n),q=sub(p,mul(n,side));if(inside(q)!=='outside'&&side*side<end2)end2=side*side;}
 const endError=tau*64*(1+Math.sqrt(end2)+r)+64*E*(end2+rr);
 if(!Number.isFinite(end2)||!Number.isFinite(endError)||end2<=rr+endError)return answer('uncertain','closed endpoint radius contact or distance roundoff remains unresolved',0,{complete:false,uncertainTimeInterval:[0,1],endpointDistance:Math.sqrt(Math.max(0,end2))*scale,degenerate:thin});
 return answer('clear','all two-sided face/finite-edge/vertex candidates and closed endpoint separated',1,{degenerate:thin});
}
