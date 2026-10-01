"""Audit immutable Bay rest data and finite appended continuous Walk curves."""
from pathlib import Path
import hashlib,importlib.util,json,numpy as np
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
source=ROOT/'review/native-breed-targets/bay-sporthorse/rest.glb';target=HERE/'model.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='8f7f83e9669dc063dcb38455f8658369774ec0ce9b9eb81c2e7742e7d013d6a8'
a,ab=g.read_glb(source);b,bb=g.read_glb(target)
keys=['nodes','meshes','skins','materials','images','textures','samplers','scenes','scene']
immutable={k:a.get(k)==b.get(k) for k in keys}
immutable['accessorsSourcePrefix']=a['accessors']==b['accessors'][:len(a['accessors'])]
immutable['bufferViewsSourcePrefix']=a['bufferViews']==b['bufferViews'][:len(a['bufferViews'])]
immutable['binarySourcePrefix']=bytes(bb[:len(ab)])==bytes(ab)
assert all(immutable.values()),immutable
assert sorted(c['name'] for c in b.get('animations',[]))==['Target Native Canter Left','Target Native Canter Right']
clips=b['animations'];assert all(len(c['channels'])==82 and all(np.isfinite(g.accessor(b,bb,sm['output'])).all() for sm in c['samplers']) for c in clips)
counts=sorted(b['accessors'][b['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count'] for n in b['nodes'] if 'mesh'in n)
assert len(b['skins'][0]['joints'])==677 and counts==[2028,5092,13895,16159,23514]
report={'sourceSha256':sha(source),'candidateSha256':sha(target),'preservation':immutable,'jointCount':677,'skinnedMeshVertexCounts':counts,'appendedClips':[c['name'] for c in clips],'channelsEach':[len(c['channels']) for c in clips],'finite':True}
(HERE/'preservation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
