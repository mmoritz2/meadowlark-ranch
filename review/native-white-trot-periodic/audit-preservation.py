"""Check both private White fast-gait candidates retain the exact original art and rig."""
from pathlib import Path
import hashlib,importlib.util,json,numpy as np
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
source=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='fd18d9b9b22e00dc30a6fa1cfe2e135bb20f7c871df0a976706aaea2f4dff655'
a,ab=g.read_glb(source);reports={}
for gait,expected in [('trot',['Target Native Trot'])]:
 target=HERE/f'{gait}.glb';b,bb=g.read_glb(target)
 keys=['nodes','meshes','skins','materials','images','textures','samplers','scenes','scene']
 immutable={k:a.get(k)==b.get(k) for k in keys}
 immutable['originalAnimations']=a.get('animations',[])==b.get('animations',[])[:len(a.get('animations',[]))]
 immutable['accessorsSourcePrefix']=a['accessors']==b['accessors'][:len(a['accessors'])]
 immutable['bufferViewsSourcePrefix']=a['bufferViews']==b['bufferViews'][:len(a['bufferViews'])]
 immutable['binarySourcePrefix']=bytes(bb[:len(ab)])==bytes(ab)
 assert all(immutable.values()),(gait,immutable)
 clips=b['animations'][len(a['animations']):];assert sorted(c['name'] for c in clips)==sorted(expected)
 rows=[]
 for c in clips:
  finite=all(np.isfinite(g.accessor(b,bb,sm['output'])).all() for sm in c['samplers'])
  assert finite
  rows.append({'clip':c['name'],'channels':len(c['channels']),'finite':finite,'uniqueNodePaths':len({(ch['target']['node'],ch['target']['path']) for ch in c['channels']})==len(c['channels'])})
 counts=sorted(b['accessors'][b['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count'] for n in b['nodes'] if 'mesh'in n)
 assert len(b['skins'][0]['joints'])==677 and counts==[2028,5092,13895,16159,23514]
 reports[gait]={'sourceSha256':sha(source),'candidateSha256':sha(target),'preservation':immutable,'jointCount':677,'skinnedMeshVertexCounts':counts,'appendedClips':rows}
(HERE/'preservation.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps({k:{'hash':v['candidateSha256'],'preserved':all(v['preservation'].values()),'clips':v['appendedClips']} for k,v in reports.items()},indent=2))
