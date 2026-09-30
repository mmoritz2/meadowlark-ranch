"""Add frozen 2.6-degree native tail-base sway to the private Bay Walk.

Adapted only output paths from output/target-native-walk/add-tail.py at
d5f8f82670be671ec1bd9143211c318451726ca80375a905e179f577e218dce0.
"""
from pathlib import Path
import importlib.util,json,hashlib,numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/native-bay-preparation'
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
path=OUT/'bay-target-native-walk.glb';d,b=g.read_glb(path);before_clip=json.loads(json.dumps(d['animations'][-1]));w,p=g.node_worlds(d);names={n['name']:i for i,n in enumerate(d['nodes']) if 'name'in n};tail=names['tail_01_0367'];clip=next(a for a in d['animations'] if a['name']=='Target Native Walk');channel_values={}
for c in clip['channels']:
 if c['target']['path']=='rotation':channel_values[c['target']['node']]=g.accessor(d,b,clip['samplers'][c['sampler']]['output'])
times=g.accessor(d,b,clip['samplers'][0]['input']).ravel();values=[]
def rot(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
for frame,t in enumerate(times):
 cache={}
 def world_rotation(i):
  if i in cache:return cache[i]
  local=R.from_quat(channel_values[i][frame]) if i in channel_values else rot(g.local_matrix(d['nodes'][i]))
  cache[i]=(world_rotation(p[i]) if i in p else R.identity())*local;return cache[i]
 theta=2*np.pi*float(t/times[-1]);parent=world_rotation(p[tail]);sway=R.from_euler('yx',[2.6*np.sin(theta-.4),.8*np.sin(2*theta-.7)],degrees=True);q=parent.inv()*sway*parent*R.from_quat(d['nodes'][tail].get('rotation',[0,0,0,1]));values.append(q.as_quat())
values[-1]=values[0];a=np.asarray(values,dtype='<f4')
for j in range(1,len(a)):
 if np.dot(a[j-1],a[j])<0:a[j]*=-1
b.extend(b'\0'*((-len(b))%4));view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':a.nbytes});b.extend(a.tobytes());acc=len(d['accessors']);d['accessors'].append({'bufferView':view,'componentType':5126,'count':len(a),'type':'VEC4'})
existing=next((c for c in clip['channels'] if c['target']=={'node':tail,'path':'rotation'}),None)
if existing:clip['samplers'][existing['sampler']]['output']=acc
else:
 sampler=len(clip['samplers']);clip['samplers'].append({'input':clip['samplers'][0]['input'],'output':acc,'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':tail,'path':'rotation'}})
# Every frozen non-tail channel still points at the exact same arrays/accessors.
assert clip['channels'][:len(before_clip['channels'])]==before_clip['channels']
assert clip['samplers'][:len(before_clip['samplers'])]==before_clip['samplers']
g.write_glb(path,d,b);report=json.loads((OUT/'bay-build-report.json').read_text());report['tailBaseLayer']={'bone':'tail_01_0367','yawAmplitudeDegrees':2.6,'pitchAmplitudeDegrees':.8,'phaseLagRadians':.4,'originalDownstreamLocalsRetained':True,'legAndBodyTracksUnchanged':True};report['candidateSha256']=hashlib.sha256(path.read_bytes()).hexdigest();report['candidateBytes']=path.stat().st_size;(OUT/'bay-build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(report['candidateSha256'])
