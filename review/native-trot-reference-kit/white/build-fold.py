"""Bounded front fetlock+coffin swing fold on an immutable full native horse kit.

Optional args: source.glb expected_sha256 output.glb. No IK/global gait solve.
"""
from pathlib import Path
import copy,hashlib,json,sys
import numpy as np
from scipy.spatial.transform import Rotation as R
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
SOURCE=Path(sys.argv[1]) if len(sys.argv)>1 else HERE/'phase-intermediate.glb'
SHA=sys.argv[2] if len(sys.argv)>2 else 'f8d688b660fbb841bfc168e86a9fa1d7bb3a92de2ad8ea87f79062a2fe0fa81d'
MODEL=Path(sys.argv[3]) if len(sys.argv)>3 else HERE/'model.glb';MODEL.parent.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
d,db=g.read_glb(SOURCE);original=copy.deepcopy(d);prefix=bytes(db);world,parent=g.node_worlds(d);names={n.get('name'):i for i,n in enumerate(d['nodes'])}
GAITS={'Target Native Walk Rollover':(.65,{'FL':.25,'FR':.75}),'Target Native Trot':(.44,{'FL':0.,'FR':.5}),'Target Native Canter Left':(.4,{'FL':.48,'FR':.24}),'Target Native Canter Right':(.4,{'FL':.24,'FR':.48})}
CONTROLS={'FL':[('fingers_01_l_0187',30.),('fingers_02_l_0208',12.)],'FR':[('fingers_01_r_0273',30.),('fingers_02_r_0274',12.)]};WINDOW=(.12,.46,.86)
def rotation(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
def product(a,b):return np.r_[a[3]*b[:3]+b[3]*a[:3]+np.cross(a[:3],b[:3]),a[3]*b[3]-np.dot(a[:3],b[:3])]
def lobe(u):
 a,p,z=WINDOW
 if u<=a or u>=z:return 0.,0.
 if u<=p:t=(u-a)/(p-a);sign=1.;width=p-a
 else:t=(z-u)/(z-p);sign=-1.;width=z-p
 return t**3*(10-15*t+6*t*t),sign*30*t*t*(1-t)**2/width
def append(a):
 a=np.asarray(a,dtype='<f4');db.extend(b'\0'*((-len(db))%4));vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(db),'byteLength':a.nbytes});db.extend(a.tobytes());ai=len(d['accessors']);d['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(a),'type':'VEC4'});return ai
changes=[];phase_rows={}
for clip in d['animations']:
 if clip['name'] not in GAITS:continue
 stance,offsets=GAITS[clip['name']];phase_rows[clip['name']]={}
 for foot,controls in CONTROLS.items():
  first=next(c for c in clip['channels'] if c['target']=={'node':names[controls[0][0]],'path':'rotation'});input_accessor=clip['samplers'][first['sampler']]['input'];times=g.accessor(d,db,input_accessor).reshape(-1);D=float(times[-1]);offset=offsets[foot]
  for name,amplitude in controls:
   ni=names[name];channel=next((c for c in clip['channels'] if c['target']=={'node':ni,'path':'rotation'}),None)
   if channel:
    sampler=clip['samplers'][channel['sampler']];assert sampler['interpolation'] in ('CUBICSPLINE','LINEAR');assert np.array_equal(g.accessor(d,db,sampler['input']).reshape(-1),times)
    old_output=sampler['output'];raw=g.accessor(d,db,old_output);old=np.zeros((len(times),3,4),dtype=float)
    if sampler['interpolation']=='CUBICSPLINE':old[:]=raw.reshape(len(times),3,4)
    else:old[:,1]=raw.reshape(len(times),4)
    kind='replace'
   else:
    old=np.zeros((len(times),3,4),dtype=float);old[:,1]=d['nodes'][ni].get('rotation',[0,0,0,1]);old_output=None;kind='new-default-binding';sampler={'input':input_accessor,'interpolation':'CUBICSPLINE'}
   new=old.copy();axis=rotation(world[parent[ni]]).inv().apply([1.,0.,0.]);axis/=np.linalg.norm(axis);rows=[]
   for i,t in enumerate(times):
    phase=float(t/D);q=(phase-offset)%1;u=(q-stance)/(1-stance);value,slope=lobe(u);angle=np.deg2rad(amplitude*value);rate=np.deg2rad(amplitude*slope)/((1-stance)*D)
    if angle!=0 or rate!=0:
     extra=np.r_[axis*np.sin(angle/2),np.cos(angle/2)];extra_dot=rate/2*np.r_[axis*np.cos(angle/2),-np.sin(angle/2)]
     new[i,1]=product(extra,old[i,1])
     for tangent in (0,2):new[i,tangent]=product(extra_dot,old[i,1])+product(extra,old[i,tangent])
    rows.append({'phase':phase,'limbPhase':q,'stance':q<stance,'swingU':u if q>=stance else None,'addedPitchDegrees':amplitude*value})
   stance_ids=[i for i,r in enumerate(rows) if r['stance']];assert np.array_equal(old[stance_ids],new[stance_ids]);assert np.max(np.abs((new[0]-new[-1])-(old[0]-old[-1])))<2e-7
   sampler['output']=append(new.reshape(-1,4) if sampler['interpolation']=='CUBICSPLINE' else new[:,1])
   if not channel:
    si=len(clip['samplers']);clip['samplers'].append(sampler);clip['channels'].append({'sampler':si,'target':{'node':ni,'path':'rotation'}})
   changes.append({'clip':clip['name'],'foot':foot,'name':name,'node':ni,'kind':kind,'interpolation':sampler['interpolation'],'amplitudeDegrees':amplitude,'localParentAxis':axis.tolist(),'durationS':D,'stanceFraction':stance,'footOffset':offset,'oldOutputAccessor':old_output,'newOutputAccessor':sampler['output'],'stanceKeyRowsExactBeforeFloat32':True,'changedKeyCount':int(np.count_nonzero(np.any(new!=old,axis=(1,2))))})
   phase_rows[clip['name']][name]=rows
companions=[];static_outputs={}
for source_clip in original['animations']:
 if source_clip['name'] not in GAITS:continue
 companion={'name':'Native Foreleg Baseline | '+source_clip['name'],'samplers':[],'channels':[]}
 fields=[]
 for foot,controls in CONTROLS.items():
  for name,_ in controls:
   ni=names[name];channel=next((c for c in source_clip['channels'] if c['target']=={'node':ni,'path':'rotation'}),None)
   if channel:
    sampler=copy.deepcopy(source_clip['samplers'][channel['sampler']]);field='exact-source-curve'
   else:
    # Original f02 has no track: carry its exact default binding as a static curve.
    first=next(c for c in source_clip['channels'] if c['target']=={'node':names[controls[0][0]],'path':'rotation'})
    input_accessor=source_clip['samplers'][first['sampler']]['input'];N=original['accessors'][input_accessor]['count'];key=(name,N)
    if key not in static_outputs:
     values=np.zeros((N,3,4),dtype=float);values[:,1]=original['nodes'][ni].get('rotation',[0,0,0,1]);static_outputs[key]=append(values.reshape(-1,4))
    sampler={'input':input_accessor,'output':static_outputs[key],'interpolation':'CUBICSPLINE'};field='static-source-default'
   si=len(companion['samplers']);companion['samplers'].append(sampler);companion['channels'].append({'sampler':si,'target':{'node':ni,'path':'rotation'}})
   fields.append({'name':name,'node':ni,'field':field,'input':sampler['input'],'output':sampler['output'],'interpolation':sampler['interpolation']})
 d['animations'].append(companion);companions.append({'clip':companion['name'],'sourceGait':source_clip['name'],'tracks':fields})
d['buffers'][0]['byteLength']=len(db);g.write_glb(MODEL,d,db)
checks={k:d.get(k)==original.get(k) for k in ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene']};checks['originalBinaryPrefix']=bytes(db[:len(prefix)])==prefix;checks['originalAccessorsPrefix']=d['accessors'][:len(original['accessors'])]==original['accessors'];checks['originalBufferViewsPrefix']=d['bufferViews'][:len(original['bufferViews'])]==original['bufferViews'];assert all(checks.values())
changed={(r['clip'],r['node']) for r in changes};unchanged=0
for before,after in zip(original['animations'],d['animations']):
 assert before['name']==after['name'];assert after['channels'][:len(before['channels'])]==before['channels']
 for c in before['channels']:
  a=before['samplers'][c['sampler']];b=after['samplers'][c['sampler']]
  if (before['name'],c['target']['node']) in changed and c['target']['path']=='rotation':assert a['input']==b['input'] and a['interpolation']==b['interpolation']
  else:assert a==b and np.array_equal(g.accessor(original,prefix,a['output']),g.accessor(d,db,b['output']));unchanged+=1
report={'sourceFile':str(SOURCE),'sourceSha256':SHA,'candidateFile':str(MODEL),'candidateSha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'candidateBytes':MODEL.stat().st_size,'changedTracks':changes,'unchangedTracksAllClips':unchanged,'originalDistalCompanions':companions,'gaits':{k:{'stanceFraction':v[0],'foreOffsets':v[1]} for k,v in GAITS.items()},'swingWindowU':list(WINDOW),'addedFetlockDegrees':30.,'addedCoffinDegrees':12.,'preservation':checks,'method':'Only four distal fore quaternion channels per checked gait. Parent-rest inverse+worldX hinge;30degree fetlock+12degree coffin, quintic delayed swing lobe, exact product-rule derivatives for cubic inputs; existing LINEAR interpolation remains LINEAR. Existing stance rows untouched; new coffin channels use source default values outside the swing lobe. No gait/global solve, body/root/translation/head/neck/groom/tack edits. Four Native Foreleg Baseline companion clips reuse exact original f01 curves and static source-default f02 values.','defaultBindingNote':'New f02 sampler values cast original JSON default quaternion to GLTF float32; actual stance geometry delta must be measured, not assumed byte-zero.','remainingLimits':['Preserved source LINEAR fetlock tracks are not total C1; new f02 and cubic source paths have analytic cubic tangents','Single stronger source-informed visual-authoring choice; not a physiological amplitude claim','Existing short stride/body timing/caps remain unchanged','Authored fold is reviewed through the current clearance gate; unrestricted direct blending is unapproved','Companion clips enable a separate root-owned runtime gate; their presence alone does not approve that gate'],'browserVerdict':'pending separate runtime gating'}
MODEL.with_name(MODEL.stem+'-report.json').write_text(json.dumps(report,indent=2)+'\n');MODEL.with_name(MODEL.stem+'-pitch-keys.json').write_text(json.dumps(phase_rows,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['candidateSha256','candidateFile','unchangedTracksAllClips','preservation']},indent=2));print('Changed/native-default channels',len(changes))
