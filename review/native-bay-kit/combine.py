"""Combine separately reviewed native gait clips without copying or modifying skin."""
from pathlib import Path
import copy, hashlib, importlib.util, json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/native-bay-kit';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('glb',ROOT/'tools/asset-gen/rig_hero_horse.py')
glb=importlib.util.module_from_spec(spec);spec.loader.exec_module(glb)
source=ROOT/'review/native-bay-rollover/rest.glb'
walk=ROOT/'review/native-bay-walk-continuous/model.glb'
trot=ROOT/'review/native-bay-trot-continuous/model.glb'
canter=ROOT/'review/native-bay-canter-smooth/model.glb'
pinned={walk:'a9e308bdf63986405c8a93cc097dcb55c92bfc0c9075dfc4150c8c9dea729311',trot:'39a19a52bc45bb3dabb15e37b1f08c9deb35c3ee17cbe2834d1f9200a23cc4c4',canter:'ce92a044fbc6e193dd7c3d830ebba555c29ea7695830f7b78495a242f73702b4'}
for path,expected in pinned.items():assert hashlib.sha256(path.read_bytes()).hexdigest()==expected,str(path)+' changed'
sd,sb=glb.read_glb(source);wd,wb=glb.read_glb(walk)
assert hashlib.sha256(source.read_bytes()).hexdigest()=='6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3'
assert not sd.get('animations')
candidates=[(walk,wd,wb)]
for path in [trot,canter]:
    d,b=glb.read_glb(path);candidates.append((path,d,b))
base_bytes=len(sb);base_views=len(sd['bufferViews']);base_accessors=len(sd['accessors'])
fields=['nodes','meshes','skins','materials','images','textures','samplers','scenes']
for path,d,b in candidates:
    assert all(sd.get(k)==d.get(k) for k in fields), str(path)+' native scene differs'
    assert bytes(b[:base_bytes])==bytes(sb), str(path)+' native binary differs'
    assert d['animations'][:len(sd.get('animations',[]))]==sd.get('animations',[])

new=copy.deepcopy(wd);binary=bytearray(wb)
assert len(binary)%4==0 and base_bytes%4==0
for path,d,b in candidates[1:]:
    offset_delta=len(binary)-base_bytes
    binary.extend(b[base_bytes:])
    view_map={i:i for i in range(base_views)}
    for i in range(base_views,len(d['bufferViews'])):
        view=copy.deepcopy(d['bufferViews'][i]);assert view.get('buffer',0)==0
        assert view.get('byteOffset',0)>=base_bytes
        view['byteOffset']=view.get('byteOffset',0)+offset_delta
        view_map[i]=len(new['bufferViews']);new['bufferViews'].append(view)
    accessor_map={i:i for i in range(base_accessors)}
    for i in range(base_accessors,len(d['accessors'])):
        accessor=copy.deepcopy(d['accessors'][i]);assert 'sparse' not in accessor
        accessor['bufferView']=view_map[accessor['bufferView']]
        accessor_map[i]=len(new['accessors']);new['accessors'].append(accessor)
    for original in d['animations'][len(sd.get('animations',[])):]:
        clip=copy.deepcopy(original)
        for sampler in clip['samplers']:
            sampler['input']=accessor_map[sampler['input']];sampler['output']=accessor_map[sampler['output']]
        assert clip['name'] not in [c['name'] for c in new['animations']]
        new['animations'].append(clip)
new['asset'].setdefault('extras',{})['privateNativeKit']='Slow Walk, Trot and both Canter leads; transitions, faster riding and full roster approval remain unfinished.'
target=OUT/'bay-native-gaits.glb';glb.write_glb(target,new,binary)
# Check every target channel curve numerically against each independently baked file.
def curves(d,b,c):
    return {(ch['target']['node'],ch['target']['path']):
            (glb.accessor(d,b,c['samplers'][ch['sampler']]['input']),glb.accessor(d,b,c['samplers'][ch['sampler']]['output']))
            for ch in c['channels']}
checkd,checkb=glb.read_glb(target)
import numpy as np
curve_checks={}
for path,original_d,original_b in candidates:
    for original_clip in original_d['animations'][len(sd.get('animations',[])):]:
        name=original_clip['name'];original=curves(original_d,original_b,original_clip)
        combined=curves(checkd,checkb,next(c for c in checkd['animations'] if c['name']==name))
        assert original.keys()==combined.keys()
        passed=all(np.array_equal(original[k][0],combined[k][0]) and np.array_equal(original[k][1],combined[k][1]) for k in original)
        assert passed, name+' curves changed'
        curve_checks[name]={'channels':len(original),'allInputAndOutputValuesIdentical':passed}
report={'status':'Private combined review kit; no production activation',
        'inputs':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source,walk,trot,canter]},
        'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'targetBytes':target.stat().st_size,
        'sourceDataUnchanged':{k:checkd.get(k)==sd.get(k) for k in fields},
        'originalBinaryPrefixIdentical':bytes(checkb[:base_bytes])==bytes(sb),
        'originalClipsIdentical':checkd['animations'][:len(sd.get('animations',[]))]==sd.get('animations',[]),
        'curveChecks':curve_checks,'clipNames':[c['name'] for c in checkd['animations']],
        'gaits':{}}
report_files={'walk':ROOT/'review/native-bay-walk-continuous/build-report.json',
              'trot':ROOT/'review/native-bay-trot-continuous/build-report.json',
              'canter':ROOT/'review/native-bay-canter-smooth/build-summary.json'}
for mode,file in report_files.items():
    authored=json.loads(file.read_text())
    duration=authored['duration'];duty=authored['stanceFraction'];stroke=2*authored['strideHalfM']
    names={'walk':'Target Native Walk Rollover','trot':'Target Native Trot','canter':'Target Native Canter'}
    keys=['canterLeft','canterRight'] if mode=='canter' else [mode]
    for key in keys:
        suffix=' '+('Left' if key.endswith('Left') else 'Right') if mode=='canter' else ''
        record={'clip':names[mode]+suffix,'durationS':duration,'stanceFraction':duty,
                'strokeM':stroke,'nominalSpeedMps':stroke/(duty*duration)}
        if mode=='canter':record['offsets']=authored['footOffsets']['Left' if key.endswith('Left') else 'Right']
        report['gaits'][key]=record
(OUT/'preservation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
