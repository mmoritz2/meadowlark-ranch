import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
// Sample the outside of the head: interior mouth surfaces are not the jaw envelope.
// Fit a continuous chin harness to the rendered jaw, in Head bind space.
// The historic minimum-y heuristic can select the upper neck after neck fusion.
export function buildHelmetHarness(T,h,headAsset,body,{onShell,rimY,cy,cz}){
 const V=(...a)=>new T.Vector3(...a),local=headAsset.mesh.geometry.clone().applyMatrix4(headAsset.inverse),surface=createTriangleSurface(T,local),clearance=.0052,radius=.0032;
 try{
 const chinId=body==='f'?849:792,chin=V().fromBufferAttribute(local.attributes.position,chinId);
 if(Math.abs(chin.x)>.002||chin.z<.06||chin.z>.16)throw Error('Helmet chin landmark incompatible with head');
 const bottom=(x,z)=>{const hit=surface.cast(V(x,-.18,z),V(0,1,0));if(!hit)throw Error('Helmet jaw underside missing');return hit.point.add(V(0,-clearance,0));};
 const under=bottom(0,chin.z-.012);under.x=0;
 const sides=[];
 for(const s of[-1,1]){
  const th=s*Math.PI*.60,e=V(...onShell(th,rimY(th),.002)),sideY=under.y+.028,sideZ=under.z-.036,hit=surface.cast(V(s*.3,sideY,sideZ),V(-s,0,0));
  if(!hit)throw Error('Helmet side jaw missing');
  const jaw=hit.point.add(V(s*clearance,0,0)),lower=bottom(s*.027,under.z-.008);
  const upperHit=surface.cast(V(s*.3,cy-.075,cz+.016),V(-s,0,0));
  if(!upperHit)throw Error('Helmet cheek support missing');
  const upper=upperHit.point.add(V(s*clearance,0,0));
  sides.push([e,upper,jaw,lower]);
 }
 const points=[...sides[0],under,...sides[1].slice().reverse()],guide=new T.CatmullRomCurve3(points,false,'centripetal'),center=V(0,cy-.02,cz+.015),samples=[];let projected=0;
 for(let i=0;i<=128;i++){const q=guide.getPoint(i/128),direction=q.clone().sub(center),distance=direction.length();direction.normalize();const hit=surface.cast(center.clone().addScaledVector(direction,.5),direction.clone().negate(),null,.5);if(hit&&i>0&&i<128){const padding=clearance/Math.max(.2,Math.abs(hit.normal.dot(direction)));if(distance<center.distanceTo(hit.point)+padding){q.copy(hit.point).addScaledVector(direction,padding);projected++;}}samples.push(q);}
 const curve=new T.CatmullRomCurve3(samples,false,'centripetal'),g=new T.TubeGeometry(curve,192,radius,8,false);
 g.userData.helmetHarness1={body,chinId,chin:chin.toArray(),oldChin:h.chin.toArray(),under:under.toArray(),points:points.map(p=>p.toArray()),radius,clearance,continuous:true,projected,samples:samples.map(p=>p.toArray())};
 return[g];
 }finally{surface.dispose();local.dispose();}
}
