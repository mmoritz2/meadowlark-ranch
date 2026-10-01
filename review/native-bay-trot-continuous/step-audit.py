"""Audit exact float32 keys plus dense normalized glTF cubic playback."""
from pathlib import Path
import hashlib,importlib.util,json
import numpy as np
from scipy.spatial.transform import Rotation as R
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
s=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
report=json.loads((HERE/'build-report.json').read_text());model=HERE/'model.glb';assert hashlib.sha256(model.read_bytes()).hexdigest()==report['candidateSha256'];d,b=g.read_glb(model)
limbs={n for f in report['footMasks'].values() for n in f['chain']+[f['terminal']]}
def quaternion_velocity(q,t):
 norm=np.linalg.norm(q);unit=q/norm;derivative=t/norm-q*np.dot(q,t)/norm**3
 return 2*(unit[3]*derivative[:3]-derivative[3]*unit[:3]-np.cross(unit[:3],derivative[:3]))*180/np.pi
def sample(times,values,interpolation,rotation):
 dense=np.linspace(times[0],times[-1],(len(times)-1)*8+1);ix=np.clip(np.searchsorted(times,dense,side='right')-1,0,len(times)-2);dt=times[ix+1]-times[ix];u=(dense-times[ix])/dt
 if interpolation=='CUBICSPLINE':
  parts=values.reshape(len(times),3,-1);a=parts[ix,1];bb=parts[ix+1,1];ta=parts[ix,2]*dt[:,None];tb=parts[ix+1,0]*dt[:,None]
  curve=(2*u**3-3*u**2+1)[:,None]*a+(u**3-2*u**2+u)[:,None]*ta+(-2*u**3+3*u**2)[:,None]*bb+(u**3-u**2)[:,None]*tb
 else:curve=(1-u)[:,None]*values[ix]+u[:,None]*values[ix+1]
 assert np.isfinite(curve).all()
 if rotation:
  norm=np.linalg.norm(curve,axis=1);assert norm.min()>.001;curve/=norm[:,None]
 return dense,curve
rows=[]
for c in d['animations'][0]['channels']:
 sm=d['animations'][0]['samplers'][c['sampler']];t=g.accessor(d,b,sm['input']).ravel().astype(float);raw=g.accessor(d,b,sm['output']).astype(float);interpolation=sm.get('interpolation','LINEAR');value=raw.reshape(len(t),3,-1)[:,1] if interpolation=='CUBICSPLINE' else raw
 name=d['nodes'][c['target']['node']]['name'];group='limbs' if name in limbs else 'groom' if name.startswith('dyn_') or name.startswith('tail_') else 'torsoNeckHead';rotation=c['target']['path']=='rotation';dense,v=sample(t,raw,interpolation,rotation);row={'joint':name,'group':group,'path':c['target']['path'],'interpolation':interpolation,'firstLastComponentDifference':float(np.max(np.abs(value[0]-value[-1]))),'denseSamples':len(dense)}
 if rotation:
  r=R.from_quat(value);step=(r[:-1].inv()*r[1:]).as_rotvec()*180/np.pi;angles=np.linalg.norm(step,axis=1);i=int(angles.argmax());dr=R.from_quat(v);ds=np.diff(dense)[0];velocity=(dr[:-1].inv()*dr[1:]).as_rotvec()*180/np.pi/ds;acceleration=(np.roll(velocity,-1,axis=0)-velocity)/ds
  row.update({'maximumConsecutiveDegrees':float(angles[i]),'maximumStepPhase':float(t[i]/t[-1]),'maximumKeyIntervalSpeedDegreesPerSecond':float((angles/np.diff(t)).max()),'maximumDenseSpeedDegreesPerSecond':float(np.linalg.norm(velocity,axis=1).max()),'maximumDenseAccelerationDegreesPerSecondSquared':float(np.linalg.norm(acceleration,axis=1).max()),'firstIntervalDegrees':float(angles[0]),'lastIntervalDegrees':float(angles[-1])})
  if interpolation=='CUBICSPLINE':
   packed=raw.reshape(len(t),3,-1);first=quaternion_velocity(packed[0,1],packed[0,2]);last=quaternion_velocity(packed[-1,1],packed[-1,0]);joins=[np.linalg.norm(quaternion_velocity(p[1],p[0])-quaternion_velocity(p[1],p[2])) for p in packed]
   row.update({'analyticFirstVelocityDegreesPerSecond':first.tolist(),'analyticLastVelocityDegreesPerSecond':last.tolist(),'analyticLoopVelocityDifferenceDegreesPerSecond':float(np.linalg.norm(first-last)),'maximumAnalyticKeyVelocityJoinDifferenceDegreesPerSecond':float(max(joins))})
 else:
  delta=np.linalg.norm(np.diff(value,axis=0),axis=1);vel=np.diff(v,axis=0)/np.diff(dense)[:,None];acc=(np.roll(vel,-1,axis=0)-vel)/np.diff(dense)[0];row.update({'maximumConsecutiveLocalTranslationM':float(delta.max()),'maximumDenseLocalSpeedMps':float(np.linalg.norm(vel,axis=1).max()),'maximumDenseLocalAccelerationMps2':float(np.linalg.norm(acc,axis=1).max())})
  if interpolation=='CUBICSPLINE':p=raw.reshape(len(t),3,-1);row['analyticLoopLocalVelocityDifferenceMps']=float(np.linalg.norm(p[0,2]-p[-1,0]))
 rows.append(row)
groups={}
for group in ['limbs','torsoNeckHead','groom']:
 a=[r for r in rows if r['group']==group and r['path']=='rotation'];worst=max(a,key=lambda r:r['maximumConsecutiveDegrees']);groups[group]={'joint':worst['joint'],'maximumConsecutiveDegrees':worst['maximumConsecutiveDegrees'],'maximumStepPhase':worst['maximumStepPhase'],'maximumDenseSpeedDegreesPerSecond':max(r['maximumDenseSpeedDegreesPerSecond'] for r in a),'maximumDenseAccelerationDegreesPerSecondSquared':max(r['maximumDenseAccelerationDegreesPerSecondSquared'] for r in a),'maximumFinalLoopIntervalDegrees':max(r['lastIntervalDegrees'] for r in a),'maximumAnalyticLoopVelocityDifferenceDegreesPerSecond':max(r.get('analyticLoopVelocityDifferenceDegreesPerSecond',float('inf')) for r in a),'maximumAnalyticInternalKeyVelocityJoinDifferenceDegreesPerSecond':max(r.get('maximumAnalyticKeyVelocityJoinDifferenceDegreesPerSecond',float('inf')) for r in a)}
baseline=json.loads((HERE/'baseline-step-reference.json').read_text());old={r['joint']:r for r in baseline['tracks'] if r['path']=='rotation'};comparison=[{'joint':r['joint'],'group':r['group'],'oldMaximumDegrees':old[r['joint']]['maximumOneIntervalDegrees'],'newMaximumDegrees':r['maximumConsecutiveDegrees']} for r in rows if r['path']=='rotation'];old_max=max(r['oldMaximumDegrees'] for r in comparison if r['group']=='limbs')
summary={'candidateSha256':report['candidateSha256'],'note':'Float32 authored values retain128 intervals; cubic curves are normalized and densely sampled8× per interval. Speed/acceleration are local kinematic finite differences, not force measurements. Analytic normalized quaternion tangent joins establish C1 separately from copied values.','groups':groups,'authoredIntervalUnder5Degrees':groups['limbs']['maximumConsecutiveDegrees']<5,'analyticC1Pass':all(v['maximumAnalyticLoopVelocityDifferenceDegreesPerSecond']<1e-6 and v['maximumAnalyticInternalKeyVelocityJoinDifferenceDegreesPerSecond']<1e-6 for v in groups.values()),'uncopiedCycleClosure':report['uncopiedCycleClosure'],'oldMaximumLimbStepDegrees':old_max,'limbMaximumReductionPercent':100*(1-groups['limbs']['maximumConsecutiveDegrees']/old_max),'tracks':rows,'comparison':comparison}
(HERE/'step-audit.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:summary[k] for k in ['groups','authoredIntervalUnder5Degrees','analyticC1Pass','limbMaximumReductionPercent']},indent=2))
