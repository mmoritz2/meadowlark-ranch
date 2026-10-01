"""Local quaternion acceleration residual and glTF periodic cubic packing."""
import numpy as np

def rotation_acceleration_residual(current,previous,prior,bones,weight=4.0):
 if previous is None or prior is None:return np.empty(0)
 # Actual total local rotations, including terminal compensation; do not
 # regularize only the global hinge correction parameter.
 return weight*np.concatenate([(previous[i].inv()*current[i]).as_rotvec()-(prior[i].inv()*previous[i]).as_rotvec() for i in bones])

def periodic_cubic(values,duration,quaternions=False):
 """Pack [in tangent, value, out tangent] with tangents in units/second.

 Requires a verified recurring solve before callers duplicate endpoint0.
 The periodic central derivative is identical at both ends. Normalize
 quaternion tangents into the tangent plane of S3; glTF normalizes the
 interpolated quaternion during playback.
 """
 values=np.asarray(values,float).copy();n=len(values)-1;assert n>=3
 assert np.max(np.abs(values[0]-values[-1]))<1e-8
 v=values[:-1];t=(np.roll(v,-1,axis=0)-np.roll(v,1,axis=0))/(2*duration/n)
 if quaternions:
  assert np.all(np.sum(v*np.roll(v,-1,axis=0),axis=1)>0)
  t-=v*np.sum(v*t,axis=1)[:,None]/np.sum(v*v,axis=1)[:,None]
 tangent=np.vstack([t,t[0]])
 return np.stack([tangent,values,tangent],axis=1).reshape(-1,values.shape[1])


def rotation_step_residual(current,previous,bones,limit_degrees=4.5,weight=75.):
 if previous is None:return np.empty(0)
 step=np.array([(previous[i].inv()*current[i]).magnitude() for i in bones])
 return weight*np.maximum(step-np.deg2rad(limit_degrees),0)
