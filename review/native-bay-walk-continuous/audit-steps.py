"""Audit exported float32 native joint curves, independent of IK report values."""
from pathlib import Path
import importlib.util,json,numpy as np
from scipy.spatial.transform import Rotation as R
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
d,b=g.read_glb(HERE/'model.glb');reports={}
for clip in d['animations']:
 if not clip['name'].startswith('Target Native'):continue
 rows=[]
 for c in clip['channels']:
  if c['target']['path']!='rotation':continue
  s=clip['samplers'][c['sampler']];t=g.accessor(d,b,s['input']).ravel().astype(float);v=g.accessor(d,b,s['output']).astype(float)
  if s.get('interpolation')=='CUBICSPLINE':v=v.reshape(-1,3,4)[:,1]
  rot=R.from_quat(v);rv=(rot[:-1].inv()*rot[1:]).as_rotvec()*180/np.pi;angles=np.linalg.norm(rv,axis=1);vel=rv/np.diff(t)[:,None];i=int(angles.argmax())
  rows.append({'name':d['nodes'][c['target']['node']]['name'],'maximumStepDegrees':float(angles[i]),'maximumSpeedDegreesPerSecond':float(np.linalg.norm(vel,axis=1).max()),'phase':float(t[i]/t[-1]),'seamVelocityDifferenceDegreesPerSecond':float(np.linalg.norm(vel[0]-vel[-1]))})
 rows.sort(key=lambda r:r['maximumStepDegrees'],reverse=True);reports[clip['name']]=rows
(HERE/'step-audit.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps({k:v[:6] for k,v in reports.items()},indent=2))
