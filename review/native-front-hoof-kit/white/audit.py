"""Portable source-prefix, protected-curve and original-distal companion audit."""
from pathlib import Path
import json,hashlib,sys
import numpy as np
H=Path(__file__).resolve().parent;ROOT=H.parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
S=ROOT/'review/native-white-head-kit/model.glb';C=H/'model.glb'
sd,sb=g.read_glb(S);cd,cb=g.read_glb(C)
assert hashlib.sha256(S.read_bytes()).hexdigest()=='488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f'
assert hashlib.sha256(C.read_bytes()).hexdigest()=='6aee1b94a4d5b1c8f7580569ba32ca6248c0a4c29b4b3e26d790fb4ac53d562e'
controls={'fingers_01_l_0187','fingers_02_l_0208','fingers_01_r_0273','fingers_02_r_0274'}
gaits={'Target Native Walk Rollover','Target Native Trot','Target Native Canter Left','Target Native Canter Right'}
checks={k:sd.get(k)==cd.get(k) for k in ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene']}
checks['binaryPrefix']=bytes(cb[:len(sb)])==bytes(sb)
checks['accessorPrefix']=cd['accessors'][:len(sd['accessors'])]==sd['accessors']
checks['bufferViewPrefix']=cd['bufferViews'][:len(sd['bufferViews'])]==sd['bufferViews']
protected=0
for sa,ca in zip(sd['animations'],cd['animations']):
 assert sa['name']==ca['name'] and ca['channels'][:len(sa['channels'])]==sa['channels']
 for ch in sa['channels']:
  ss=sa['samplers'][ch['sampler']];cs=ca['samplers'][ch['sampler']]
  if sa['name'] in gaits and sd['nodes'][ch['target']['node']]['name'] in controls and ch['target']['path']=='rotation':
   assert ss['input']==cs['input'] and ss['interpolation']==cs['interpolation']
  else:
   assert ss==cs and all(np.array_equal(g.accessor(sd,sb,ss[k]),g.accessor(cd,cb,cs[k])) for k in ['input','output']);protected+=1
companions=cd['animations'][len(sd['animations']):]
assert len(companions)==4
for ca in companions:
 assert ca['name'].startswith('Native Foreleg Baseline | ')
 sa=next(a for a in sd['animations'] if a['name']==ca['name'].removeprefix('Native Foreleg Baseline | '))
 assert len(ca['channels'])==len(ca['samplers'])==4
 assert {sd['nodes'][c['target']['node']]['name'] for c in ca['channels']}==controls
 for ch in ca['channels']:
  cs=ca['samplers'][ch['sampler']];source=next((c for c in sa['channels'] if c['target']==ch['target']),None)
  if source:
   ss=sa['samplers'][source['sampler']];assert ss==cs and all(np.array_equal(g.accessor(sd,sb,ss[k]),g.accessor(cd,cb,cs[k])) for k in ['input','output'])
  else:
   N=cd['accessors'][cs['input']]['count'];a=g.accessor(cd,cb,cs['output']).reshape(N,3,4);q=np.asarray(sd['nodes'][ch['target']['node']]['rotation'],dtype=np.float32)
   assert cs['interpolation']=='CUBICSPLINE' and np.array_equal(a[:,1],np.tile(q,(N,1))) and np.count_nonzero(a[:,[0,2]])==0
assert all(checks.values())
result={'sourceSha256':hashlib.sha256(S.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256(C.read_bytes()).hexdigest(),'preservation':checks,'protectedCurveCount':protected,'originalDistalCompanionsExact':4,'scope':'Portable offline array audit only; paired steady and gated transition geometry are separate evidence.'}
(H/'package-preservation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
