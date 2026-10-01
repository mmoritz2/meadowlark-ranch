"""Independent immutable-source and finite-animation audit of the Bay Canter GLB."""
from pathlib import Path
import hashlib,importlib.util,json,numpy as np
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
source=ROOT/'review/native-bay-rollover/rest.glb';target=Path(__file__).with_name('model.glb')
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a,ab=g.read_glb(source);b,bb=g.read_glb(target)
assert hash(source)=='6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3'
keys=['nodes','meshes','skins','materials','images','textures','samplers','scenes','scene']
immutable={k:a.get(k)==b.get(k) for k in keys}
immutable['accessorsSourcePrefix']=a['accessors']==b['accessors'][:len(a['accessors'])]
immutable['bufferViewsSourcePrefix']=a['bufferViews']==b['bufferViews'][:len(a['bufferViews'])]
immutable['binarySourcePrefix']=bytes(bb[:len(ab)])==bytes(ab)
assert all(immutable.values()),immutable
clips=b.get('animations',[]);assert sorted(c['name'] for c in clips)==['Target Native Canter Left','Target Native Canter Right']
clip_summary=[]
for c in clips:
 values=[]
 for sm in c['samplers']:
  values.append(g.accessor(b,bb,sm['output']))
 finite=all(np.isfinite(v).all() for v in values)
 assert finite
 clip_summary.append({'name':c['name'],'channels':len(c['channels']),'samplers':len(c['samplers']),'allCurveValuesFinite':finite,'nodePathsUnique':len({(ch['target']['node'],ch['target']['path']) for ch in c['channels']})==len(c['channels'])})
counts=[]
for n in b['nodes']:
 if 'mesh' in n:
  pr=b['meshes'][n['mesh']]['primitives'][0]
  counts.append(b['accessors'][pr['attributes']['POSITION']]['count'])
# Selected motion curves differ from the white candidate: legs and translation
# were solved on the Bay target rather than copied from the white animation.
white=ROOT/'review/native-horse-kit/model.glb';wd,wb=g.read_glb(white)
def named_curves(doc,binary,lead):
 clip=next(c for c in doc['animations'] if c['name']=='Target Native Canter '+lead)
 return {(doc['nodes'][ch['target']['node']]['name'],ch['target']['path']):g.accessor(doc,binary,clip['samplers'][ch['sampler']]['output']) for ch in clip['channels']}
curve_diff={}
for lead in ['Left','Right']:
 bay=named_curves(b,bb,lead);ref=named_curves(wd,wb,lead)
 curve_diff[lead]={name:float(np.max(np.abs(bay[(name,path)]-ref[(name,path)]))) for name,path in [('pelvis_08','translation'),('clavicle_l_0203','rotation'),('hand_l_0206','rotation'),('foot_l_0407','rotation')]}
 assert all(value>1e-4 for value in curve_diff[lead].values())
report={'selectedBayVsWhiteCurveMaxAbsDifference':curve_diff,'sourceSha256':hash(source),'candidateSha256':hash(target),'originalBinaryBytes':len(ab),'candidateBinaryBytes':len(bb),'preservation':immutable,'jointCount':len(b['skins'][0]['joints']),'skinnedMeshVertexCounts':sorted(counts),'clips':clip_summary,'verdict':'original meshes, skin, binds, materials, node hierarchy, original binary and all original accessors retained; two finite Bay-native Canter clips appended'}
assert report['jointCount']==677 and sorted(counts)==[2028,5092,13895,16159,23514]
Path(__file__).with_name('preservation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
