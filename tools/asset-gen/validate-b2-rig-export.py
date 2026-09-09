"""Read the exported GLB directly: finite samples, times and loop closure."""
import json,struct,math,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
folder=ROOT/'assets/models/horse-candidates/b2przemo/rig-study'
data=(folder/'horse-rig-study.glb').read_bytes()
length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);offset=20+length
binary=data[offset+8:offset+8+struct.unpack_from('<I',data,offset)[0]]
def values(index):
    a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
    base=view.get('byteOffset',0)+a.get('byteOffset',0)
    cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt={5126:'f',5123:'H',5121:'B',5125:'I'}[a['componentType']]
    stride=view.get('byteStride',cols*struct.calcsize(fmt))
    return [struct.unpack_from('<'+fmt*cols,binary,base+i*stride) for i in range(a['count'])]
report={'sha256':hashlib.sha256(data).hexdigest(),'file_bytes':len(data),'skin_joint_counts':[len(s['joints']) for s in doc.get('skins',[])],'animations':[],'all_animation_values_finite':True}
for animation in doc.get('animations',[]):
    mismatches=[];maximum=0;duration=0;start=1e9
    for channel in animation['channels']:
        sample=animation['samplers'][channel['sampler']];v=values(sample['output']);times=values(sample['input'])
        duration=max(duration,times[-1][0]);start=min(start,times[0][0])
        node=doc['nodes'][channel['target']['node']].get('name','');kind=channel['target']['path']
        delta=max(abs(a-b) for a,b in zip(v[0],v[-1]))
        if kind=='rotation':delta=min(delta,max(abs(a+b) for a,b in zip(v[0],v[-1])))
        maximum=max(maximum,delta)
        if delta>1e-4:mismatches.append({'node':node,'path':kind,'delta':delta})
        if not all(math.isfinite(x) for row in v for x in row):report['all_animation_values_finite']=False
    report['animations'].append({'name':animation['name'],'start':start,'duration':duration,'channels':len(animation['channels']),'max_endpoint_component_delta':maximum,'endpoint_mismatches':mismatches})
assert report['all_animation_values_finite']
for item in report['animations']:
    assert item['start']==0,item
    if item['name']!='Walk_Forward':assert not item['endpoint_mismatches'],item
    else:assert all(m['node']=='ROOT' and m['path']=='translation' for m in item['endpoint_mismatches']),item
(folder/'export-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
