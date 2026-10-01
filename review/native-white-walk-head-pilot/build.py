"""One private neck/head-only Walk pilot; no limb solve or production mutation."""
from pathlib import Path
import copy,hashlib,json,sys
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent;OUT=ROOT/'output/native-white-walk-head-pilot';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
SHA='fa797ad07137af09b1824cabe8737a530206804fcee2ab3a526ac12be1f08fc1'
SOURCE=Path(sys.argv[1])if len(sys.argv)>1 else ROOT/'review/native-horse-kit/model.glb'
if not SOURCE.exists()or hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=SHA:SOURCE=OUT/'input-kit.glb'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
d,db=g.read_glb(SOURCE);original=copy.deepcopy(d);prefix=bytes(db);rw,parent=g.node_worlds(d);names={n.get('name'):i for i,n in enumerate(d['nodes'])}
def rotation(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
restRotation={i:rotation(w)for i,w in rw.items()};head=names['head_019'];trunk=names['spine_04_012']
selected={names[n]:f for n,f in [('neck_01_014',.45),('neck_02_015',.60),('neck_03_016',.75),('neck_04_017',.90),('neck_05_018',1.),('head_019',.85)]}
clip=next(a for a in d['animations']if a['name']=='Target Native Walk Rollover');channels={c['target']['node']:c for c in clip['channels']if c['target']['path']=='rotation'}
times=g.accessor(d,db,clip['samplers'][channels[head]['sampler']]['input']).reshape(-1);N=len(times)-1;D=float(times[-1]);assert N==128
trackArrays=[]
for c in clip['channels']:
 s=clip['samplers'][c['sampler']];t=g.accessor(d,db,s['input']).reshape(-1);assert np.array_equal(t,times) and s['interpolation']=='CUBICSPLINE'
 value=g.accessor(d,db,s['output']).reshape(len(times),3,-1)[:,1,:];trackArrays.append((c['target']['node'],c['target']['path'],value))
def localAt(key):
 q={i:R.from_quat(n.get('rotation',[0,0,0,1]))for i,n in enumerate(d['nodes'])};t={i:np.array(n.get('translation',[0,0,0]),float)for i,n in enumerate(d['nodes'])};s={i:np.array(n.get('scale',[1,1,1]),float)for i,n in enumerate(d['nodes'])}
 for i,path,a in trackArrays:
  if path=='rotation':q[i]=R.from_quat(a[key])
  elif path=='translation':t[i]=a[key].copy()
  elif path=='scale':s[i]=a[key].copy()
 return q,t,s
def worldAt(q,t,s):
 cache={}
 def world(i):
  if i in cache:return cache[i]
  if 'matrix'in d['nodes'][i]:m=g.local_matrix(d['nodes'][i])
  else:m=np.eye(4);m[:3,:3]=q[i].as_matrix()*s[i][None,:];m[:3,3]=t[i]
  cache[i]=(world(parent[i])if i in parent else np.eye(4))@m;return cache[i]
 return world
old=[]
for j in range(N):
 q,t,s=localAt(j);w=worldAt(q,t,s);old.append({'phase':float(times[j]/D),'headY':float(w(head)[1,3]),'trunkY':float(w(trunk)[1,3])})
def harmonic(y,n):
 y=np.asarray(y);angle=2*np.pi*n*np.arange(N)/N;c=2/N*np.sum((y-y.mean())*np.cos(angle));s=2/N*np.sum((y-y.mean())*np.sin(angle));return {'n':n,'amplitudeM':float(np.hypot(c,s)),'phaseRadians':float(np.arctan2(-s,c))}
trunkPhase=harmonic([r['trunkY']for r in old],2)['phaseRadians'];meanHead=float(np.mean([r['headY']for r in old]));targetAmplitude=.035
values={i:[]for i in selected};solves=[]
for j in range(N):
 phase=float(times[j]/D);q,t,s=localAt(j);baseQ=copy.copy(q);targetY=meanHead+targetAmplitude*np.cos(4*np.pi*phase+trunkPhase+np.pi)
 def trial(degrees):
  q=copy.copy(baseQ)
  for i,f in selected.items():
   w=worldAt(q,t,s);pr=rotation(w(parent[i]));q[i]=pr.inv()*R.from_rotvec([np.deg2rad(degrees*f),0,0])*restRotation[i]
  w=worldAt(q,t,s);return q,w(head)[1,3]
 angle=brentq(lambda a:trial(a)[1]-targetY,-8,8,xtol=1e-10);newQ,y=trial(angle)
 for i in selected:values[i].append(newQ[i].as_quat())
 solves.append({'phase':phase,'neckCommonPitchDegrees':angle,'targetHeadY':float(targetY),'actualHeadY':float(y)})
def append(a):
 a=np.asarray(a,dtype='<f4');db.extend(b'\0'*((-len(db))%4));view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(db),'byteLength':a.nbytes});db.extend(a.tobytes());acc=len(d['accessors']);d['accessors'].append({'bufferView':view,'componentType':5126,'count':len(a),'type':'VEC4'});return acc
changed=[]
for i,x in values.items():
 x=np.asarray(x);x/=np.linalg.norm(x,axis=1)[:,None]
 for j in range(1,N):
  if x[j-1]@x[j]<0:x[j]*=-1
 tangent=(np.roll(x,-1,axis=0)-np.roll(x,1,axis=0))/(2*D/N);tangent-=x*np.sum(x*tangent,axis=1)[:,None]
 v=np.vstack([x,x[0]]);tt=np.vstack([tangent,tangent[0]]);output=append(np.stack([tt,v,tt],axis=1).reshape(-1,4));sam=clip['samplers'][channels[i]['sampler']];oldOutput=sam['output'];sam['output']=output;changed.append({'node':i,'name':d['nodes'][i]['name'],'path':'rotation','oldOutputAccessor':oldOutput,'newOutputAccessor':output,'globalPitchFraction':selected[i]})
d['buffers'][0]['byteLength']=len(db);MODEL=OUT/'model.glb';g.write_glb(MODEL,d,db)
checks={k:d.get(k)==original.get(k)for k in ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene']};checks['originalBinaryPrefix']=bytes(db[:len(prefix)])==prefix;checks['originalAccessorPrefix']=d['accessors'][:len(original['accessors'])]==original['accessors'];checks['originalBufferViewPrefix']=d['bufferViews'][:len(original['bufferViews'])]==original['bufferViews'];assert all(checks.values())
unchanged=0
for before,after in zip(original['animations'],d['animations']):
 assert before['name']==after['name'] and before['channels']==after['channels']
 for c in before['channels']:
  bs=before['samplers'][c['sampler']];cs=after['samplers'][c['sampler']]
  if before['name']=='Target Native Walk Rollover'and c['target']['node']in selected and c['target']['path']=='rotation':assert bs['input']==cs['input'] and bs['interpolation']==cs['interpolation'];continue
  assert bs==cs and np.array_equal(g.accessor(original,prefix,bs['output']),g.accessor(d,db,cs['output']));unchanged+=1
meta={'sourceSha256':SHA,'candidateSha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'candidateBytes':MODEL.stat().st_size,'clip':'Target Native Walk Rollover','durationS':D,'nominalSpeedMps':.5494505494505494,'changedTracks':changed,'unchangedTracksAllClips':unchanged,'preservation':checks,'originalHeadYSpanM':float(np.ptp([r['headY']for r in old])),'originalTrunkYSpanM':float(np.ptp([r['trunkY']for r in old])),'trunkSecondHarmonicPhaseRadians':trunkPhase,'targetHeadSpanM':targetAmplitude*2,'neckCommonPitchRangeDegrees':[min(r['neckCommonPitchDegrees']for r in solves),max(r['neckCommonPitchDegrees']for r in solves)],'method':'Reconstruct every original Walk key pose, retain static native world-rest orientations, solve one bounded sagittal neck common-pitch variable against desired head-origin Y; recompute only native neck1..5/head local quaternion rotations with exact current parent transforms; periodic normalized cubic tangents. No limb/body/hair/tack track edits.','bodyLimitation':'Original unchanged pelvis translation has four cycles per stride. Head proxy two-cycle target does not fix trunk gait dynamics. Proxies are not the paper optical markers.','noMotionOrProductionApproval':True}
(HERE/'build-summary.json').write_text(json.dumps(meta,indent=2)+'\n');(OUT/'head-solves.json').write_text(json.dumps({'original':old,'solves':solves},indent=2)+'\n');print(json.dumps(meta,indent=2))
