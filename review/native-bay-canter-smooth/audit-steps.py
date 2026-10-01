"""Audit the actual float32 quaternion key steps, including uncopied loop closure."""
from pathlib import Path
import hashlib,importlib.util,json,numpy as np
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
limb_prefix=('clavicle_','upperarm_','lowerarm_','hand_','fingers_01_','upperleg_','lowerleg_','foot_','toes_01_')
def audit(path):
 d,b=g.read_glb(path);clips={}
 for c in d['animations']:
  if not c['name'].startswith('Target Native Canter '):continue
  rows=[]
  for ch in c['channels']:
   if ch['target']['path']!='rotation':continue
   name=d['nodes'][ch['target']['node']]['name'];sampler=c['samplers'][ch['sampler']]
   times=np.asarray(g.accessor(d,b,sampler['input']),float).ravel();q=np.asarray(g.accessor(d,b,sampler['output']),float)
   n=np.linalg.norm(q,axis=1);dot=np.clip(np.abs(np.sum(q[:-1]*q[1:],axis=1)/(n[:-1]*n[1:])),0,1)
   step=np.rad2deg(2*np.arccos(dot));dt=np.diff(times);speed=step/dt
   endpoint=np.rad2deg(2*np.arccos(np.clip(abs(np.dot(q[0],q[-1])/(n[0]*n[-1])),0,1)))
   j=int(np.argmax(step));rows.append({'joint':name,'limb':name.startswith(limb_prefix),'maxStepDegrees':float(step[j]),'maxStepIndex':j,'maxStepPhase':float(times[j]/times[-1]),'stepDurationMs':float(dt[j]*1000),'peakSpeedDegreesPerSecond':float(speed.max()),'above5DegreeSteps':int((step>5).sum()),'lastStepDegrees':float(step[-1]),'uncopiedEndpointClosureDegrees':float(endpoint)})
  rows.sort(key=lambda x:x['maxStepDegrees'],reverse=True);limbs=[r for r in rows if r['limb']]
  clips[c['name']]={'keyedRotationJoints':len(rows),'keyedLimbJoints':len(limbs),'maxLimbStepDegrees':max(r['maxStepDegrees'] for r in limbs),'maxLimbAngularSpeedDegPerSec':max(r['peakSpeedDegreesPerSecond'] for r in limbs),'above5DegreeLimbSteps':sum(r['above5DegreeSteps'] for r in limbs),'maxUncopiedEndpointClosureDegrees':max(r['uncopiedEndpointClosureDegrees'] for r in rows),'rows':rows,'pass5DegreeStepGate':all(r['maxStepDegrees']<=5 for r in limbs)}
 return {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'clips':clips}
baseline=ROOT/'review/native-bay-canter/model.glb'
old=audit(baseline) if baseline.exists() else json.loads((HERE/'old-candidate-step-audit.json').read_text())
if baseline.exists():(HERE/'old-candidate-step-audit.json').write_text(json.dumps(old,indent=2)+'\n')
print('old',json.dumps({k:{x:v[x] for x in ['maxLimbStepDegrees','above5DegreeLimbSteps','pass5DegreeStepGate']} for k,v in old['clips'].items()}))
new=HERE/'model.glb'
if new.exists():
 candidate=audit(new);(HERE/'joint-step-audit.json').write_text(json.dumps(candidate,indent=2)+'\n')
 print('smooth',json.dumps({k:{x:v[x] for x in ['maxLimbStepDegrees','above5DegreeLimbSteps','maxUncopiedEndpointClosureDegrees','pass5DegreeStepGate']} for k,v in candidate['clips'].items()}))
