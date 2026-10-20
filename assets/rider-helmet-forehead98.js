import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
// The helmet is a shell around the actual final authored head, not the broad
// bounds-derived ellipsoid alone. Keep the crown/sides/harness shape; fit only
// the frontal radial surface where the forehead exceeds that envelope.
export function createHelmetForeheadFit98(T,asset,{cx,cy,cz,clearance=.0045}){
 const geometry=asset.mesh.geometry.clone().applyMatrix4(asset.inverse),surface=createTriangleSurface(T,geometry),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 const stats={method:'Actual final Head-local outer forehead radial fit',clearanceM:clearance,queries:0,hits:0,changedSamples:0,maxRadialShiftM:0,frontFullAngleRad:.80,frontEndAngleRad:1.20};
 const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 return {
  fit(th,point){
   const angle=Math.abs(th);if(angle>=1.20)return point;
   const y=point[1],direction=V(Math.sin(th),0,Math.cos(th)),center=V(cx,y,cz),origin=center.clone().addScaledVector(direction,.6);
   stats.queries++;const hit=surface.cast(origin,direction.clone().negate(),null,1.2);if(!hit)return point;stats.hits++;
   const radius=(point[0]-cx)*direction.x+(point[2]-cz)*direction.z,headRadius=hit.point.clone().sub(center).dot(direction);
   if(headRadius<=0)return point;
   const demand=Math.max(0,headRadius+clearance-radius),shift=demand*(1-smooth(.80,1.20,angle));
   if(shift>1e-9){stats.changedSamples++;stats.maxRadialShiftM=Math.max(stats.maxRadialShiftM,shift);return [point[0]+direction.x*shift,y,point[2]+direction.z*shift];}
   return point;
  },
  evidence:()=>({...stats}),
  dispose(){surface.dispose();geometry.dispose();}
 };
}
