"""Combine separately reviewed native gait clips without copying or modifying skin."""
from pathlib import Path
import copy, hashlib, importlib.util, json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/native-horse-kit';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('glb',ROOT/'tools/asset-gen/rig_hero_horse.py')
glb=importlib.util.module_from_spec(spec);spec.loader.exec_module(glb)
source=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'
walk=ROOT/'output/target-native-walk-rollover/target-native-walk-rollover.glb'
trot=ROOT/'output/target-native-trot/target-native-trot.glb'
sd,sb=glb.read_glb(source);wd,wb=glb.read_glb(walk);td,tb=glb.read_glb(trot)
base_bytes=len(sb);base_views=len(sd['bufferViews']);base_accessors=len(sd['accessors'])
fields=['nodes','meshes','skins','materials','images','textures','samplers','scenes']
assert all(sd.get(k)==wd.get(k)==td.get(k) for k in fields), 'Native scene data differs'
assert bytes(wb[:base_bytes])==bytes(sb)==bytes(tb[:base_bytes]), 'Native binary differs'
assert wd['animations'][:len(sd['animations'])]==sd['animations']==td['animations'][:len(sd['animations'])]

new=copy.deepcopy(wd);binary=bytearray(wb)
assert len(binary)%4==0 and base_bytes%4==0
offset_delta=len(binary)-base_bytes
binary.extend(tb[base_bytes:])
view_map={i:i for i in range(base_views)}
for i in range(base_views,len(td['bufferViews'])):
    view=copy.deepcopy(td['bufferViews'][i]);assert view.get('buffer',0)==0
    assert view.get('byteOffset',0)>=base_bytes
    view['byteOffset']=view.get('byteOffset',0)+offset_delta
    view_map[i]=len(new['bufferViews']);new['bufferViews'].append(view)
accessor_map={i:i for i in range(base_accessors)}
for i in range(base_accessors,len(td['accessors'])):
    accessor=copy.deepcopy(td['accessors'][i]);assert 'sparse' not in accessor
    accessor['bufferView']=view_map[accessor['bufferView']]
    accessor_map[i]=len(new['accessors']);new['accessors'].append(accessor)
clip=copy.deepcopy(next(c for c in td['animations'] if c['name']=='Target Native Trot'))
for sampler in clip['samplers']:
    sampler['input']=accessor_map[sampler['input']];sampler['output']=accessor_map[sampler['output']]
assert clip['name'] not in [c['name'] for c in new['animations']]
new['animations'].append(clip)
new['asset'].setdefault('extras',{})['privateNativeKit']='Separate slow Walk and slow Trot proofs; transition, riding and full roster approval remain unfinished.'
target=OUT/'white-native-walk-trot.glb';glb.write_glb(target,new,binary)
# Check every target channel curve numerically against each independently baked file.
def curves(d,b,c):
    return {(ch['target']['node'],ch['target']['path']):
            (glb.accessor(d,b,c['samplers'][ch['sampler']]['input']),glb.accessor(d,b,c['samplers'][ch['sampler']]['output']))
            for ch in c['channels']}
checkd,checkb=glb.read_glb(target)
import numpy as np
curve_checks={}
for original_d,original_b,name in [(wd,wb,'Target Native Walk Rollover'),(td,tb,'Target Native Trot')]:
    original=curves(original_d,original_b,next(c for c in original_d['animations'] if c['name']==name))
    combined=curves(checkd,checkb,next(c for c in checkd['animations'] if c['name']==name))
    assert original.keys()==combined.keys()
    passed=all(np.array_equal(original[k][0],combined[k][0]) and np.array_equal(original[k][1],combined[k][1]) for k in original)
    assert passed, name+' curves changed'
    curve_checks[name]={'channels':len(original),'allInputAndOutputValuesIdentical':passed}
report={'status':'Private combined review kit; no production activation',
        'inputs':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source,walk,trot]},
        'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'targetBytes':target.stat().st_size,
        'sourceDataUnchanged':{k:checkd.get(k)==sd.get(k) for k in fields},
        'originalBinaryPrefixIdentical':bytes(checkb[:base_bytes])==bytes(sb),
        'originalClipsIdentical':checkd['animations'][:len(sd['animations'])]==sd['animations'],
        'curveChecks':curve_checks,'clipNames':[c['name'] for c in checkd['animations']],
        'gaits':{'walk':{'clip':'Target Native Walk Rollover','durationS':1.12,'stanceFraction':.65,'strokeM':.4,'nominalSpeedMps':.4/(.65*1.12)},
                 'trot':{'clip':'Target Native Trot','durationS':.72,'stanceFraction':.44,'strokeM':.44,'nominalSpeedMps':.44/(.44*.72)}}}
(OUT/'preservation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
