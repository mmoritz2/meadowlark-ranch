// Post-generation repair: preserve the original seeded layouts, shape draws,
// model indices/resources and all matching collision/climbing object identities.
export const OUTCROP_TRACK_CLEARANCE=Object.freeze({id:'outcrop-track-clearance-1',maxMove:24,ringStep:.5,angularSteps:64,mountedMargin:.8,scanRadiusFactor:1.5,fallbackBurial:.06});
const pointSegment=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
export function outcropTrackClearance(tracks,x,z,radius){let min=Infinity,road=null,segment=-1;for(const t of tracks)for(let i=1;i<t.pts.length;i++){const clearance=pointSegment(x,z,t.pts[i-1],t.pts[i])-radius-t.w*1.06-OUTCROP_TRACK_CLEARANCE.mountedMargin;if(clearance<min){min=clearance;road=t.id;segment=i-1;}}return{clearance:min,road,segment};}
export function outcropFallbackShape(mesh){const p=mesh.geometry?.attributes?.position;if(!p||p.itemSize!==3||!p.count)throw Error('Complete original fallback geometry required');let radius=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(!Number.isFinite(x+y+z))throw Error('Nonfinite original fallback');radius=Math.max(radius,Math.hypot(x,z));minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return{radius,minY,maxY,count:p.count};}
export function planOutcropTrackMove({tracks,placement,shape,index=0,isAllowed,ignored}){
 const radius=Math.max(shape.radius,placement.r*OUTCROP_TRACK_CLEARANCE.scanRadiusFactor),before=outcropTrackClearance(tracks,placement.x,placement.z,radius);if(before.clearance>=0)return null;
 // Bounded rings, fixed angles and a stable per-index phase; no random stream.
 const phase=index*2.399963229728653;
 for(let ring=OUTCROP_TRACK_CLEARANCE.ringStep;ring<=OUTCROP_TRACK_CLEARANCE.maxMove;ring+=OUTCROP_TRACK_CLEARANCE.ringStep)for(let k=0;k<OUTCROP_TRACK_CLEARANCE.angularSteps;k++){
  const angle=phase+k/OUTCROP_TRACK_CLEARANCE.angularSteps*Math.PI*2,x=placement.x+Math.cos(angle)*ring,z=placement.z+Math.sin(angle)*ring,after=outcropTrackClearance(tracks,x,z,radius);if(after.clearance<0||!isAllowed(x,z,placement.r*1.5,ignored))continue;
  return{index,from:{x:placement.x,z:placement.z},to:{x,z},move:ring,radius,fallbackRadius:shape.radius,scanRadius:placement.r*1.5,before,after};
 }
 return{index,from:{x:placement.x,z:placement.z},radius,before,failed:true,reason:'No admitted nearby position within24m'};
}
export function relocateCompletedOutcrops({placements,meshes,colliders,climbables,tracks,heightAt,isAllowed}){
 if(!tracks.length)return[];const records=[];
 for(let index=0;index<placements.length;index++){
  const placement=placements[index],mesh=meshes[index];if(!mesh)throw Error('Original outcrop index lost');const shape=outcropFallbackShape(mesh),bound=outcropTrackClearance(tracks,placement.x,placement.z,Math.max(shape.radius,placement.r*1.5));if(bound.clearance>=0)continue;
  const matches=colliders.filter(c=>c.climb&&c.x===placement.x&&c.z===placement.z&&Math.abs(c.r-placement.r*1.05)<1e-9);if(matches.length!==1)throw Error('Ambiguous matched outcrop collider');const collider=matches[0],climbers=climbables.filter(c=>c.mesh===mesh),ignored={collider,placed:placement},plan=planOutcropTrackMove({tracks,placement,shape,index,isAllowed,ignored});if(!plan)continue;if(plan.failed){records.push(plan);continue;}
  const p=mesh.geometry.attributes.position,lowBand=shape.minY+(shape.maxY-shape.minY)*.08;let y=heightAt(plan.to.x,plan.to.z),lowVertices=0;
  for(let i=0;i<p.count;i++)if(p.getY(i)<=lowBand){y=Math.min(y,heightAt(plan.to.x+p.getX(i),plan.to.z+p.getZ(i))-p.getY(i)-OUTCROP_TRACK_CLEARANCE.fallbackBurial);lowVertices++;}
  if(!Number.isFinite(y)||!lowVertices)throw Error('No finite whole fallback footing');
  const oldY=mesh.position.y;mesh.position.set(plan.to.x,y,plan.to.z);placement.x=collider.x=plan.to.x;placement.z=collider.z=plan.to.z;for(const c of climbers){c.x=plan.to.x;c.z=plan.to.z;c.y=y;}mesh.updateMatrixWorld(true);
  records.push({...plan,oldY,y,lowVertices,climbableMatches:climbers.length,colliderRadius:collider.r,shapeVertices:shape.count,physics:'Same rendered mesh, source geometry, anchor circle, placed entry and climbing references; X/Z and rigid rootY changed together. Later scan replacements read the same updated placed index.'});
 }
 return records;
}
