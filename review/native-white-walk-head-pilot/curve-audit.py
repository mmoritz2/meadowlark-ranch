from pathlib import Path
import hashlib,json,sys,numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;OUT=ROOT/'output/native-white-walk-head-pilot';sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
meta=json.loads((H/'build-summary.json').read_text());SOURCE=ROOT/'review/native-horse-kit/model.glb';assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==meta['sourceSha256'];source,sb=g.read_glb(SOURCE);d,b=g.read_glb(OUT/'model.glb');selected={r['node']:r['globalPitchFraction']for r in meta['changedTracks']};names={n.get('name'):i for i,n in enumerate(d['nodes'])};head=names['head_019'];a=next(a for a in d['animations']if a['name']==meta['clip']);old=next(a for a in source['animations']if a['name']==meta['clip']);worldRest,parent=g.node_worlds(source)
def rot(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
q={i:R.from_quat(n.get('rotation',[0,0,0,1]))for i,n in enumerate(source['nodes'])};t={i:np.array(n.get('translation',[0,0,0]),float)for i,n in enumerate(source['nodes'])};scale={i:np.array(n.get('scale',[1,1,1]),float)for i,n in enumerate(source['nodes'])}
for c in old['channels']:
 s=old['samplers'][c['sampler']];data=g.accessor(source,sb,s['output']).reshape(-1,3,4 if c['target']['path']=='rotation' else 3);v=data[-1,1];i=c['target']['node']
 if c['target']['path']=='rotation':q[i]=R.from_quat(v)
 elif c['target']['path']=='translation':t[i]=v
 elif c['target']['path']=='scale':scale[i]=v
def world(q):
 cache={}
 def w(i):
  if i in cache:return cache[i]
  if 'matrix'in source['nodes'][i]:m=g.local_matrix(source['nodes'][i])
  else:m=np.eye(4);m[:3,:3]=q[i].as_matrix()*scale[i][None,:];m[:3,3]=t[i]
  cache[i]=(w(parent[i])if i in parent else np.eye(4))@m;return cache[i]
 return w
solves=json.loads((OUT/'head-solves.json').read_text());mean=np.mean([r['headY']for r in solves['original']]);target=mean+.035*np.cos(4*np.pi+meta['trunkSecondHarmonicPhaseRadians']+np.pi)
def endpoint(angle):
 qq=q.copy()
 for i,f in selected.items():qq[i]=rot(world(qq)(parent[i])).inv()*R.from_rotvec([np.deg2rad(angle*f),0,0])*rot(worldRest[i])
 return qq,world(qq)(head)[1,3]
angle=brentq(lambda x:endpoint(x)[1]-target,-8,8,xtol=1e-10);closed,_=endpoint(angle)
def projected(q,t):
 norm=np.linalg.norm(q);v=q/norm;return v,(t-v*np.dot(v,t))/norm
rows=[]
for c in a['channels']:
 if c['target']['node']not in selected or c['target']['path']!='rotation':continue
 s=a['samplers'][c['sampler']];ts=g.accessor(d,b,s['input']).reshape(-1).astype(float);arr=g.accessor(d,b,s['output']).reshape(-1,3,4).astype(float);poses=arr[:,1];inc=arr[:,0];out=arr[:,2];q0,t0=projected(poses[0],out[0]);qn,tn=projected(poses[-1],inc[-1]);seam=2*np.rad2deg(np.linalg.norm(t0-tn));joins=max(2*np.rad2deg(np.linalg.norm(projected(poses[i],inc[i])[1]-projected(poses[i],out[i])[1]))for i in range(1,len(poses)-1));dense=[];time=[]
 for i in range(len(ts)-1):
  dt=ts[i+1]-ts[i]
  for u in np.arange(8)/8:
   v=(2*u**3-3*u*u+1)*poses[i]+(u**3-2*u*u+u)*dt*out[i]+(-2*u**3+3*u*u)*poses[i+1]+(u**3-u*u)*dt*inc[i+1];dense.append(v/np.linalg.norm(v));time.append(ts[i]+dt*u)
 dense.append(poses[-1]/np.linalg.norm(poses[-1]));time.append(ts[-1]);dense=np.array(dense);degrees=np.degrees(2*np.arccos(np.clip(abs(np.sum(dense[:-1]*dense[1:],axis=1)),0,1)));keyStep=np.degrees(2*np.arccos(np.clip(abs(np.sum(poses[:-1]*poses[1:],axis=1))/np.linalg.norm(poses[:-1],axis=1)/np.linalg.norm(poses[1:],axis=1),0,1)))
 rows.append({'name':d['nodes'][c['target']['node']]['name'],'uncopiedAnalyticEndVsFirstFloat32Degrees':float(np.degrees((R.from_quat(poses[0]).inv()*closed[c['target']['node']]).magnitude())),'loopNormalizedTangentDifferenceDegreesPerS':float(seam),'internalNormalizedTangentDifferenceDegreesPerS':float(joins),'maxAuthoredKeyStepDegrees':float(max(keyStep)),'maxDenseLocalDegreesPerS':float(max(degrees/np.diff(time)))})
report={'candidateSha256':meta['candidateSha256'],'method':'Recompute phase1 independently from original source Walk end-pose parents and desired analytic head Y, then compare with candidate phase0 float32 quaternions. Normalized cubic C1 and8 dense subintervals/key for only6 changed neck/head rotation tracks.','rows':rows,'maxUncopiedAnalyticEndVsFirstDegrees':max(r['uncopiedAnalyticEndVsFirstFloat32Degrees']for r in rows),'maxLoopNormalizedTangentDifferenceDegreesPerS':max(r['loopNormalizedTangentDifferenceDegreesPerS']for r in rows),'maxInternalNormalizedTangentDifferenceDegreesPerS':max(r['internalNormalizedTangentDifferenceDegreesPerS']for r in rows),'maxChangedTrackDenseDegreesPerS':max(r['maxDenseLocalDegreesPerS']for r in rows),'noMotionOrProductionApproval':True};(H/'curve-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
