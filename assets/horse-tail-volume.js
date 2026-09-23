/* Fuller tails, from the authored strands themselves.

   Every approved breed carries the same groom: eight hundred tapered tail strands, each a thin
   three-sided tube of thirteen rings, skinned to four tail bones. As authored they hang in a
   bundle ten centimetres wide at the dock and fifteen at the tip, so from the saddle camera, which
   is where a player spends the whole game looking at it, the tail read as a narrow flat ribbon.
   The riding game this one is modelled on hangs a full, flowing tail off every horse: the hair
   fans out below the dock to two or three times that width and carries real depth.

   So the strands are spread, not replaced. Nothing is generated and nothing is added: each strand
   keeps its own taper, length and skinning. Ring by ring, a strand's offset from the tail's axis
   (the chain of tail bones, carried on to the tip) is scaled up by an amount that grows down the
   tail. That amount is not a fixed multiplier: it is whatever takes this breed's own authored width
   at that height to a target that is a multiple of its width at the dock, so a breed authored with
   a heavier tail is spread less, and a shire does not end up a metre across. Moving a ring as a
   unit, rather than every vertex on its own, is what keeps the hair looking like hair: a smooth
   stretch of the whole bundle would flatten every strand into a ribbon as wide as the tail had
   grown. Each ring is also swollen about its own centre, because a tail twice as wide made of the
   same three-millimetre strands was twice as much shimmer: from the saddle camera a strand that
   fine is a third of a pixel across, and it flickers instead of reading as hair.

   Work happens once per loaded model, in the geometry's bind pose, so the tail bones carry the
   spread through every swish and gallop with no per-frame cost. It has to happen before
   horse-style measures the strands' roots for the mane and tail length styles, which it does the
   first time a horse is styled, long after load. Several breed keys share one file (the Silver
   Kestrel is the Morgan body), and the loader prepares that file once per key, so a geometry
   that has been spread is marked and never spread twice. */
export function fillOutTail(THREE,mesh,{width=2.9,depth=1.55,thick=2.6}={}){
  const g=mesh&&mesh.geometry;
  if(!g||g.userData.tailFilled||!g.index||!g.attributes.skinIndex||!mesh.skeleton)return null;
  const pa=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,sk=mesh.skeleton,n=pa.count;
  const tailB=sk.bones.map((b,i)=>/^tail/i.test(b.name)?i:-1).filter(i=>i>=0);
  if(tailB.length<2)return null;
  const depthOf=b=>{let d=0;while(b.parent&&b.parent.isBone){d++;b=b.parent;}return d;};
  tailB.sort((a,b)=>depthOf(sk.bones[a])-depthOf(sk.bones[b]));
  const bindInv=new THREE.Matrix4().copy(mesh.bindMatrix).invert(),m4=new THREE.Matrix4();
  const chain=tailB.map(i=>new THREE.Vector3().setFromMatrixPosition(m4.copy(sk.boneInverses[i]).invert()).applyMatrix4(bindInv));
  const isT=new Uint8Array(sk.bones.length);for(const i of tailB)isT[i]=1;
  const mask=new Float32Array(n);let lowY=Infinity;
  for(let i=0;i<n;i++){let w=0;for(let j=0;j<4;j++)if(isT[si.getComponent(i,j)])w+=sw.getComponent(i,j);mask[i]=w;if(w>0.5&&pa.getY(i)<lowY)lowY=pa.getY(i);}
  if(!isFinite(lowY))return null;
  /* Carry the axis on past the last bone to where the longest hair ends. */
  const last=chain[chain.length-1],dir=last.clone().sub(chain[chain.length-2]).normalize();
  if(dir.y<-0.2&&last.y>lowY)chain.push(last.clone().addScaledVector(dir,(last.y-lowY)/-dir.y));
  const segLen=[],cum=[0];for(let k=0;k<chain.length-1;k++){segLen.push(chain[k].distanceTo(chain[k+1]));cum.push(cum[k]+segLen[k]);}
  const total=cum[cum.length-1];if(!(total>0))return null;
  const X=new THREE.Vector3(1,0,0);   // the breed models face +z with +y up, so x is left and right
  /* A point on the axis at arc length s, and the axis direction there taken across a short span, so
     the depth direction turns smoothly through each bone joint instead of stepping, which would put a
     kink in every strand that crosses one. */
  const pointAt=(s,out)=>{s=Math.max(0,Math.min(total,s));let k=0;while(k<segLen.length-1&&cum[k+1]<s)k++;
    return out.copy(chain[k]).lerp(chain[k+1],segLen[k]>0?(s-cum[k])/segLen[k]:0);};
  const _p=new THREE.Vector3(),_q=new THREE.Vector3();
  /* Strands, as the index draws them: every connected piece of the groom. */
  const par=new Int32Array(n);for(let i=0;i<n;i++)par[i]=i;
  const find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};
  const idx=g.index.array;
  for(let t=0;t<idx.length;t+=3){const a=find(idx[t]),b=find(idx[t+1]);if(a!==b)par[a]=b;const c=find(idx[t+2]),r=find(b);if(c!==r)par[c]=r;}
  const comps=new Map();for(let i=0;i<n;i++){const r=find(i);let c=comps.get(r);if(!c)comps.set(r,c=[]);c.push(i);}
  /* Rings: a strand stored as consecutive triples of tightly-spaced vertices is moved triple by
     triple. Anything laid out otherwise is moved vertex by vertex, which is still smooth. */
  const rings=[];const _c=new THREE.Vector3(),_d=new THREE.Vector3();
  for(const vs of comps.values()){
    let tm=0;for(const v of vs)tm+=mask[v];if(tm/vs.length<0.5)continue;
    let triples=vs.length%3===0&&vs[vs.length-1]-vs[0]===vs.length-1;
    if(triples){let spread=0;for(let k=0;k<vs.length;k+=3){const a=vs[k],b=vs[k+1],c=vs[k+2];
      spread=Math.max(spread,Math.hypot(pa.getX(a)-pa.getX(b),pa.getY(a)-pa.getY(b),pa.getZ(a)-pa.getZ(b)),Math.hypot(pa.getX(a)-pa.getX(c),pa.getY(a)-pa.getY(c),pa.getZ(a)-pa.getZ(c)));}
      if(spread>0.02)triples=false;}
    const step=triples?3:1;
    for(let k=0;k<vs.length;k+=step){
      _c.set(0,0,0);let w=0;for(let j=0;j<step;j++){const v=vs[k+j];_c.x+=pa.getX(v);_c.y+=pa.getY(v);_c.z+=pa.getZ(v);w+=mask[v];}
      _c.multiplyScalar(1/step);w/=step;
      let best=Infinity,bs=0,bk=0;
      for(let q=0;q<segLen.length;q++){const A=chain[q];_d.copy(chain[q+1]).sub(A);const L2=_d.lengthSq()||1;
        const t=Math.max(0,Math.min(1,(_c.x-A.x)*_d.x/L2+(_c.y-A.y)*_d.y/L2+(_c.z-A.z)*_d.z/L2));
        const px=A.x+_d.x*t,py=A.y+_d.y*t,pz=A.z+_d.z*t,dd=(_c.x-px)**2+(_c.y-py)**2+(_c.z-pz)**2;
        if(dd<best){best=dd;bk=q;bs=t;}}
      const sAx=cum[bk]+bs*segLen[bk];
      const tan=pointAt(sAx+0.06,_p).sub(pointAt(sAx-0.06,_q)).normalize(),D=new THREE.Vector3().crossVectors(X,tan).normalize();
      const off=_c.clone().sub(pointAt(sAx,_q));
      rings.push({v:vs.slice(k,k+step),c:[_c.x,_c.y,_c.z],u:sAx/total,ox:off.dot(X),od:off.dot(D),D,w});
    }
  }
  if(!rings.length)return null;
  /* The authored half-width and half-depth down the tail, in ten bands. */
  const NB=10,hx=Array.from({length:NB},()=>[]),hd=Array.from({length:NB},()=>[]);
  for(const r of rings){const b=Math.min(NB-1,Math.floor(r.u*NB));hx[b].push(Math.abs(r.ox));hd[b].push(Math.abs(r.od));}
  const p95=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(0.95*(s.length-1))];};
  const HX=hx.map(p95),HD=hd.map(p95);
  for(let b=1;b<NB;b++){if(!HX[b])HX[b]=HX[b-1];if(!HD[b])HD[b]=HD[b-1];}
  const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  /* The target: the dock's own width, fanning out to `width` times it by just past halfway down,
     and a little over half as much again in depth. */
  const SX=[],SD=[];
  for(let b=0;b<NB;b++){const u=(b+0.5)/NB;
    SX.push(HX[b]>1e-5?Math.max(1,Math.min(width,HX[0]*(1+(width-1)*sstep(0.03,0.55,u))/HX[b])):1);
    SD.push(HD[b]>1e-5?Math.max(1,Math.min(depth,HD[0]*(1+(depth-1)*sstep(0.05,0.60,u))/HD[b])):1);}
  /* The last few bands hold only the longest strands, so the measured widths there are noisy; a
     light blur keeps the scale from wandering band to band and putting a wave in the hair. */
  const blur=S=>S.map((v,b)=>b===0?v:0.25*S[b-1]+0.5*v+0.25*S[Math.min(NB-1,b+1)]);
  const BX=blur(SX),BD=blur(SD);
  const at=(S,u)=>{const f=Math.max(0,Math.min(NB-1,u*NB-0.5)),b=Math.floor(f),t=f-b;return S[b]+(S[Math.min(NB-1,b+1)]-S[b])*t;};
  let moved=0,maxShift=0;
  for(const r of rings){
    const k=Math.min(1,r.w),ex=r.ox*(at(BX,r.u)-1)*k,ed=r.od*(at(BD,r.u)-1)*k;
    const dx=ex+r.D.x*ed,dy=r.D.y*ed,dz=r.D.z*ed;
    /* And each ring swollen about its own centre, so the taper is kept but a strand is no longer
       a third of a pixel across from the saddle camera, where hair that fine only shimmers. */
    const th=r.v.length>1?1+(thick-1)*k:1,[cx,cy,cz]=r.c;
    for(const v of r.v){pa.setXYZ(v,cx+(pa.getX(v)-cx)*th+dx,cy+(pa.getY(v)-cy)*th+dy,cz+(pa.getZ(v)-cz)*th+dz);moved++;}
    maxShift=Math.max(maxShift,Math.hypot(dx,dy,dz));
  }
  pa.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
  g.userData.tailFilled={rings:rings.length,moved,maxShift:+maxShift.toFixed(3),widthScale:BX.map(s=>+s.toFixed(2)),depthScale:BD.map(s=>+s.toFixed(2))};
  return g.userData.tailFilled;
}
