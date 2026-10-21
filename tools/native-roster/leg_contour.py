"""Draft-only surface contours in the original native limb frames.

The source GLB is read-only. A continuous radius guide can refine its joint and
muscle silhouette without moving any joint or modifying skin influences.
"""
import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator
from scipy.sparse import coo_matrix

REVISION=8
CHAINS={
 'foreLeft':['fingers_01_l_0187','hand_l_0206','lowerarm_l_0205','upperarm_l_0204'],
 'foreRight':['fingers_01_r_0295','hand_r_0272','lowerarm_r_0271','upperarm_r_0270'],
 'hindLeft':['toes_01_l_0408','foot_l_0407','lowerleg_l_0406','upperleg_l_0405'],
 'hindRight':['toes_01_r_0477','foot_r_0476','lowerleg_r_0475','upperleg_r_0474'],
}
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*t*(t*(6*t-15)+10)
def unit(a):return a/np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-12)

def fore_source_restoration(source):
 """Shared body/collar field in immutable native standing coordinates."""
 return smooth(.77,.90,source[:,1])*(1-smooth(1.48,1.85,source[:,1]))*smooth(.02,.28,source[:,2])*(1-smooth(.65,.90,source[:,2]))

def transport_authored_normals(source, before, after, normals, indices):
 """Rotate authored smoothing with the surface; do not replace it with facets."""
 triangles=np.asarray(indices).reshape(-1,3)
 _,weld=np.unique(np.round(source,7),axis=0,return_inverse=True)
 def surface_normals(points):
  a,b,c=points[triangles].transpose(1,0,2);face=np.cross(b-a,c-a)
  acc=np.zeros((weld.max()+1,3))
  for corner in range(3):np.add.at(acc,weld[triangles[:,corner]],face)
  return unit(acc[weld])
 a=surface_normals(before);b=surface_normals(after)
 v=np.cross(a,b);cosine=np.clip((a*b).sum(1),-1,1)
 # The shortest-arc rotation carries the original artist-authored normal offset.
 # A stable half-turn branch also covers degenerate/opposed faces explicitly.
 out=normals+np.cross(v,normals)+np.cross(v,np.cross(v,normals))/np.maximum(1+cosine,1e-8)[:,None]
 opposite=cosine<-.999999
 if opposite.any():
  aa=a[opposite];basis=np.eye(3)[np.argmin(np.abs(aa),axis=1)]
  axis=unit(np.cross(aa,basis));nn=normals[opposite]
  out[opposite]=2*axis*(axis*nn).sum(1)[:,None]-nn
 degenerate=(np.linalg.norm(a,axis=1)<.5)|(np.linalg.norm(b,axis=1)<.5)
 out[degenerate]=normals[degenerate]
 return unit(out)

def _shape_bone_frame_legs(source, shaped, normals, joints, weights, indices, joint_names, joint_points, breed, *, guide_revision):
 source=np.asarray(source,float);result=shaped.copy();total=np.zeros(len(source));deltas=np.zeros_like(source);reports=[];fore_delta=np.zeros_like(source);fore_fidelity=np.zeros(len(source))
 triangles=np.asarray(indices).reshape(-1,3)
 _,weld=np.unique(np.round(source,7),axis=0,return_inverse=True);n=weld.max()+1
 edges=np.concatenate([weld[triangles[:,[0,1]]],weld[triangles[:,[1,2]]],weld[triangles[:,[2,0]]]])
 edges=np.concatenate([edges,edges[:,::-1]]);edges=np.unique(edges[edges[:,0]!=edges[:,1]],axis=0)
 graph=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(n,n)).tocsr();degree=np.asarray(graph.sum(axis=1)).ravel()
 count=np.bincount(weld,minlength=n)
 def diffuse(values,steps=10):
  a=np.bincount(weld,weights=values,minlength=n)/count
  for _ in range(steps):a=.55*a+.45*(graph@a)/np.maximum(degree,1)
  return a[weld]
 # These are surface radii, in source metres. Hooves and source pivots are fixed.
 breed_gain={'percheron':1.,'shire':1.055,'clyde':1.025}[breed]
 for name,chain in CHAINS.items():
  front=name.startswith('fore');left=name.endswith('Left');side='l' if left else 'r';sign=1 if left else -1
  # Match exact chain roles, allowing only the native numeric suffix to vary.
  roles=['fingers_01','hand','lowerarm','upperarm'] if front else ['toes_01','foot','lowerleg','upperleg']
  chain=[next(n for n in joint_names if n.startswith(role+'_'+side+'_')) for role in roles]
  anchors=np.array([joint_points[n] for n in chain]);h=anchors[:,1];assert np.all(np.diff(h)>0)
  curve=CubicSpline(h,anchors[:,[0,2]],bc_type='natural',extrapolate=True)
  y=source[:,1].copy()
  # Monotone stations cannot jump across a curved hock/stifle. Preserve the
  # source axial residual so only the transverse surface is recontoured.
  c=curve(y);center=np.column_stack([c[:,0],y,c[:,1]])
  d=curve(y,1);axis=unit(np.column_stack([d[:,0],np.ones(len(y)),d[:,1]]))
  lateral=np.tile([1.,0.,0.],(len(y),1));lateral=unit(lateral-axis*axis[:,0,None]);depth=unit(np.cross(axis,lateral))
  radial=source-center;u=(radial*lateral).sum(1);v=(radial*depth).sum(1)
  if front:
   knots=np.array([h[0],.35,h[1],.70,.85,h[2],h[3],h[3]+.20])
   # A draft foreleg narrows gradually from the muscular forearm into the
   # cannon. The old guide peaked at the knee then dipped immediately above
   # it, producing a rounded bead between two skinny rings. Keep a subtle
   # anatomical knee, with a continuous taper and a sturdier distal cannon.
   rx=np.array([.045,.043,.049,.059,.071,.095,.145,.180] if guide_revision>=8 else [.041,.039,.059,.052,.068,.095,.145,.180])*breed_gain
   rz=np.array([.055,.058,.071,.090,.113,.159,.218,.255] if guide_revision>=8 else [.052,.054,.075,.087,.113,.159,.218,.255])*breed_gain
   support=smooth(.18,.30,source[:,1])*(1-smooth(1.08,1.38,source[:,1]))
   prefixes=('fingers_','hand_','wrist_','elbow_','lowerarm_','upperarm_')
  else:
   knots=np.array([h[0],.39,h[1],.80,h[2],1.12,h[3],h[3]+.22])
   rx=np.array([.042,.044,.065,.077,.098,.126,.220,.250])*breed_gain
   rz=np.array([.054,.061,.089,.116,.146,.190,.286,.310])*breed_gain
   support=smooth(.18,.31,source[:,1])*(1-smooth(1.23,1.60,source[:,1]))
   prefixes=('toes_','foot_','ankle_','knee_','lowerleg_','upperleg_')
  assert np.all(np.diff(knots)>0),(name,knots)
  width=PchipInterpolator(knots,rx)(np.clip(y,knots[0],knots[-1]));thickness=PchipInterpolator(knots,rz)(np.clip(y,knots[0],knots[-1]))
  # Smooth monotone radial remap retains substantial source anatomy. Unlike
  # snapping onto an ellipse it preserves the ordering of neighboring rings.
  rho=np.sqrt((u/width)**2+(v/thickness)**2)
  gain=np.maximum(rho,.25)**(-.52)
  strength=smooth(.15,.50,rho)
  gain=1+(gain-1)*strength
  desired=source+lateral*(u*(gain-1))[:,None]+depth*(v*(gain-1))[:,None]
  owned=np.array([n.startswith(prefixes) and ('_'+side+'_') in n for n in joint_names])
  influence=diffuse((owned[joints]*weights).sum(1),14)
  # Skin shared with the torso crosses independently rotating limbs/spine.
  # Its established placement is retained; guide the limb-owned surface into
  # it smoothly instead of pulling a chest/hip crease onto the limb cylinder.
  torso_roles=('spine_','hips_','hip_middleslider_','neckOff_','neck_')
  torso_owned=np.array([n.startswith(torso_roles) for n in joint_names])
  torso_influence=diffuse((torso_owned[joints]*weights).sum(1),7)
  torso_keep=1-smooth(.035,.22,torso_influence)
  mask=smooth(.10,.72,influence)*support*smooth(.005,.055,sign*source[:,0])
  if not front:mask*=torso_keep
  # The entire foot/sole remains the accepted released shape, not this guide.
  mask[source[:,1]<=.18]=0
  if front:
   fore_delta+=(desired-shaped)*mask[:,None]
   fore_fidelity+=smooth(.65,.95,influence)*(1-smooth(.82,1.03,source[:,1]))*support
  else:
   deltas+=(desired-shaped)*mask[:,None];total+=mask
  selected=mask>.01
  reports.append({'id':name,'jointNames':chain,'jointPointsM':anchors.tolist(),'vertices':int(selected.sum()),'maxBlend':float(mask.max()),'maxSurfaceMoveM':float(np.linalg.norm((desired-shaped)*mask[:,None],axis=1).max()),'radiusGuideY':knots.tolist(),'lateralRadiiM':rx.tolist(),'depthRadiiM':rz.tolist()})
 # Regularize the entire forelimb displacement, not a skin-weight-shaped mask.
 # High fidelity keeps the approved shaft taper; the elbow/chest blend receives
 # a smooth spatial solution. Fixed boundaries retain hoof and upper-body fit.
 wanted=np.column_stack([np.bincount(weld,weights=fore_delta[:,i],minlength=n)/count for i in range(3)])
 fidelity=.025+3*np.bincount(weld,weights=fore_fidelity,minlength=n)/count
 eligible=(source[:,1]>.18)&(source[:,1]<1.50)&(source[:,2]>.10)
 active=np.bincount(weld,weights=eligible,minlength=n)==count
 current=wanted.copy();current[~active]=0
 for _ in range(180):
  neighbors=(graph@current)/np.maximum(degree,1)[:,None]
  current=(wanted*fidelity[:,None]+2*neighbors)/(fidelity[:,None]+2)
  current[~active]=0
 result+=current[weld]+deltas/np.maximum(total,1)[:,None]
 # The native upper forearm/elbow already has the desired tapered form and
 # deformation. Restore its source surface instead of pulling shared chest skin
 # toward a new radial guide. A broad spatial transition removes legacy cage
 # drift and blends into the styled shoulder without a skin-weight-shaped ring.
 fore_source=fore_source_restoration(source)
 result+=(source-result)*fore_source[:,None]
 # Preserve authored smoothing and shading detail through the changed surface.
 transported=transport_authored_normals(source,shaped,result,normals,indices)
 moved=np.linalg.norm(result-shaped,axis=1);changed=moved>1e-10
 normal_blend=smooth(.00002,.003,diffuse(moved,5));normal_blend[source[:,1]<=.18]=0
 normal_result=unit(normals*(1-normal_blend[:,None])+transported*normal_blend[:,None])
 assert np.isfinite(result).all() and np.isfinite(normal_result).all()
 assert np.array_equal(result[source[:,1]<=.18],shaped[source[:,1]<=.18])
 return result,normal_result,{'version':REVISION,'space':'native standing joint frames','bodyOnly':True,'sourceShoulderRestoration':{'heightM':[.77,.90,1.48,1.85],'forwardM':[.02,.28,.65,.90]},'sourceSurfaceMayShrink':True,'sourceWeightsAndJointsUnchanged':True,'protectedSourceYAtOrBelowM':.18,'normalMethod':'authored normals transported by welded surface shortest-arc rotation','limbs':reports,'changedVertices':int(changed.sum()),'maximumSurfaceMoveM':float(np.linalg.norm(result-shaped,axis=1).max())}


def shape_bone_frame_legs(source, shaped, normals, joints, weights, indices, joint_names, joint_points, breed):
 """Revise the knee/cannon while exactly retaining the fitted upper surface.

 The existing mesh regularizer can propagate a tiny lower-leg edit to the
 shoulder. Evaluate the reviewed v7 guide explicitly and use it as the fixed
 upper boundary, so the fitted collar never needs an unrelated refit.
 """
 args=(source,shaped,normals,joints,weights,indices,joint_names,joint_points,breed)
 legacy,legacy_normals,_=_shape_bone_frame_legs(*args,guide_revision=7)
 candidate,_,report=_shape_bone_frame_legs(*args,guide_revision=8)
 blend=1-smooth(.82,.90,np.asarray(source)[:,1])
 result=legacy+(candidate-legacy)*blend[:,None]
 result[blend==0]=legacy[blend==0]
 carried=transport_authored_normals(source,legacy,result,legacy_normals,indices)
 # Original upper normals and the protected foot remain bit-for-bit stable.
 changed=np.linalg.norm(result-legacy,axis=1)>1e-12
 carried[~changed]=legacy_normals[~changed]
 carried[blend==0]=legacy_normals[blend==0]
 report.update(version=REVISION,
  forelegTaper={'method':'Continuous cannon-to-forearm radial taper without the former knee peak/above-knee dip',
   'sourceHeightFadeM':[.82,.90], 'reviewedUpperSurfaceAndNormalsExactlyPreservedFromM':.90,
   'reviewedFootSurfaceAndNormalsExactlyPreservedThroughM':.18,
   'maximumMoveFromReviewedV7M':float(np.linalg.norm(result-legacy,axis=1).max())})
 assert np.array_equal(result[blend==0],legacy[blend==0])
 assert np.array_equal(carried[blend==0],legacy_normals[blend==0])
 return result,carried,report
