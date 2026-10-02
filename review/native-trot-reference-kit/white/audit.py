"""Layered source/phase/fold preservation audit, using a temporary intermediate."""
from pathlib import Path
import hashlib, json, subprocess, sys, tempfile
import numpy as np
H=Path(__file__).resolve().parent;ROOT=H.parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
S=ROOT/'review/native-white-head-kit/model.glb';C=H/'model.glb'
hashof=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert hashof(S)=='488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f'
assert hashof(C)=='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
with tempfile.TemporaryDirectory(prefix='white-reference-audit-') as temporary:
 P=Path(temporary)/'phase.glb'
 subprocess.run([sys.executable,str(H/'build-phase.py'),str(S),str(P)],check=True)
 assert hashof(P)=='f8d688b660fbb841bfc168e86a9fa1d7bb3a92de2ad8ea87f79062a2fe0fa81d'
 sd,sb=g.read_glb(S);pd,pb=g.read_glb(P);cd,cb=g.read_glb(C)
 fields=['nodes','meshes','skins','materials','images','textures','samplers','scenes','scene']
 checks={k:sd.get(k)==pd.get(k)==cd.get(k) for k in fields}
 checks['originalBinaryPrefix']=bytes(cb[:len(sb)])==bytes(sb)
 checks['phaseBinaryPrefix']=bytes(cb[:len(pb)])==bytes(pb)
 checks['originalAccessorPrefix']=cd['accessors'][:len(sd['accessors'])]==sd['accessors']
 checks['phaseAccessorPrefix']=cd['accessors'][:len(pd['accessors'])]==pd['accessors']
 checks['originalBufferViewPrefix']=cd['bufferViews'][:len(sd['bufferViews'])]==sd['bufferViews']
 checks['phaseBufferViewPrefix']=cd['bufferViews'][:len(pd['bufferViews'])]==pd['bufferViews']
 distal={'fingers_01_l_0187','fingers_02_l_0208','fingers_01_r_0273','fingers_02_r_0274'}
 fore={'clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187','clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273'}
 gaits={'Target Native Walk Rollover','Target Native Trot','Target Native Canter Left','Target Native Canter Right'}
 protected=0
 for sa,ca in zip(sd['animations'],cd['animations']):
  assert sa['name']==ca['name'] and ca['channels'][:len(sa['channels'])]==sa['channels']
  for ch in sa['channels']:
   name=sd['nodes'][ch['target']['node']]['name'];ss=sa['samplers'][ch['sampler']];cs=ca['samplers'][ch['sampler']]
   permitted=ch['target']['path']=='rotation' and ((sa['name']=='Target Native Trot' and name in fore) or (sa['name'] in gaits and name in distal))
   if permitted:assert ss['input']==cs['input'] and ss['interpolation']==cs['interpolation']
   else:
    assert ss==cs and all(np.array_equal(g.accessor(sd,sb,ss[k]),g.accessor(cd,cb,cs[k])) for k in ['input','output']);protected+=1
 companions=cd['animations'][len(pd['animations']):];assert len(companions)==4
 for ca in companions:
  assert ca['name'].startswith('Native Foreleg Baseline | ')
  pa=next(a for a in pd['animations'] if a['name']==ca['name'].removeprefix('Native Foreleg Baseline | '))
  assert len(ca['channels'])==len(ca['samplers'])==4
  assert {pd['nodes'][c['target']['node']]['name'] for c in ca['channels']}==distal
  for ch in ca['channels']:
   cs=ca['samplers'][ch['sampler']];pc=next((c for c in pa['channels'] if c['target']==ch['target']),None)
   if pc:
    ps=pa['samplers'][pc['sampler']];assert ps==cs and all(np.array_equal(g.accessor(pd,pb,ps[k]),g.accessor(cd,cb,cs[k])) for k in ['input','output'])
   else:
    n=cd['accessors'][cs['input']]['count'];a=g.accessor(cd,cb,cs['output']).reshape(n,3,4);q=np.asarray(pd['nodes'][ch['target']['node']]['rotation'],dtype=np.float32)
    assert cs['interpolation']=='CUBICSPLINE' and np.array_equal(a[:,1],np.tile(q,(n,1))) and np.count_nonzero(a[:,[0,2]])==0
 assert all(checks.values())
 result={'sourceSha256':hashof(S),'phaseSha256':hashof(P),'candidateSha256':hashof(C),'preservation':checks,'protectedOriginalCurveCount':protected,'exactPhaseDistalCompanions':4,'scope':'Layered offline preservation; actual clearance gate/contact/transition evidence is separate.'}
 (H/'package-preservation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
