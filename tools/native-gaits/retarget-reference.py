"""Retarget approved native poses to existing breed skins without changing binds.

The motion-only GLBs contain target-specific rotations and root translation.
Actual fixed skinned hoof landmarks, rather than bone tips, constrain contact.
"""
from pathlib import Path
import sys,json,copy,hashlib,argparse
import numpy as np
from scipy.spatial.transform import Rotation as R,Slerp
from scipy.optimize import least_squares
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
OUT=ROOT/'review/native-complete-gaits/roster';OUT.mkdir(parents=True,exist_ok=True)
M={ 'pelvis':'pelvis_08','spine':'spine_02_010','chest':'spine_04_012','neck.lower':'neck_02_015','neck.upper':'neck_04_017','head':'head_019','tail.1':'tail_01_0367','tail.2':'tail_02_0368','tail.3':'tail_03_0369','tail.4':'tail_04_0370'}
CHAINS={}
SOURCE_SAMPLE_CACHE={}
def clip_filename(name):
 if name=='Horse|Horse_Idle':return 'idle'
 if name=='Target Native Walk Rollover':return 'walk'
 return name.lower().replace('target native ','').replace(' ','-')
for foot,side in [('FL','l'),('FR','r'),('HL','l'),('HR','r')]:
 front=foot[0]=='F'
 target=[foot+'.'+x for x in (['scapula','upperarm','forearm','cannon','pastern','hoof'] if front else ['thigh','shin','cannon','pastern','hoof'])]
 # Target artists use negative-X left; source uses positive-X left. Reflect the
 # reference sagittal motion spatially, preserving the named footfall sequence.
 source=(['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187','fingers_02_l_0208'] if side=='l' else ['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273','fingers_02_r_0274']) if front else (['upperleg_l_0405','lowerleg_l_0406','foot_l_0407','toes_01_l_0408','toes_02_l_0409'] if side=='l' else ['upperleg_r_0474','lowerleg_r_0475','foot_r_0476','toes_01_r_0477','toes_02_r_0478'])
 M.update(zip(target,source));CHAINS[foot]=target

def rotation(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return u@v

def setup(path,bodycount):
 d,b=g.read_glb(path);w,parents=g.node_worlds(d);names={n.get('name'):i for i,n in enumerate(d['nodes'])}
 node=next(n for n in d['nodes'] if 'mesh'in n and (n.get('name')=='HorseBody' if bodycount!=16159 else d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==bodycount))
 a=d['meshes'][node['mesh']]['primitives'][0]['attributes'];skin=d['skins'][node['skin']];j=np.array(skin['joints']);ib=g.accessor(d,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 p=g.accessor(d,b,a['POSITION']);pv=np.c_[p,np.ones(len(p))];ji=g.accessor(d,b,a['JOINTS_0']).astype(int);wt=g.accessor(d,b,a['WEIGHTS_0'])
 def surface(world,ids):
  ops=np.array([world[i] for i in j])@ib
  return np.sum(np.einsum('nvij,nj->nvi',ops[ji[ids]],pv[ids])*wt[ids,:,None],axis=1)[:,:3]
 rest=surface(w,np.arange(len(p)));floor=float(rest[:,1].min());masks={}
 for f,chain in CHAINS.items():
  marker=names[M[chain[-1]]] if bodycount==16159 else names[chain[-1]]
  x,z=w[marker][[0,2],3];rad=.23 if bodycount==16159 else .18
  mask=np.where((np.abs(rest[:,0]-x)<rad*.72)&(np.abs(rest[:,2]-z)<rad)&(rest[:,1]<floor+.2))[0]
  low=rest[mask,1].min();sole=mask[rest[mask,1]<low+.01];assert len(sole)>4,(path,f,len(sole))
  zvals=rest[sole,2];toe=sole[zvals>=np.quantile(zvals,.7)];heel=sole[zvals<=np.quantile(zvals,.3)]
  masks[f]={'whole':mask,'sole':sole,'toe':toe,'heel':heel,'center':rest[sole].mean(0)}
 return d,b,w,parents,names,j,surface,rest,floor,masks

def sample_clip(d,b,clip,times):
 tracks=[]
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];tt=g.accessor(d,b,s['input']).ravel().astype(float);v=g.accessor(d,b,s['output']).astype(float);field=c['target']['path'];kind=s.get('interpolation','LINEAR')
  if len(tt)==1:values=np.repeat(v,len(times),axis=0)
  elif kind=='CUBICSPLINE':
   vv=v.reshape(len(tt),3,-1);ix=np.clip(np.searchsorted(tt,times,side='right')-1,0,len(tt)-2);h=tt[ix+1]-tt[ix];u=np.clip((times-tt[ix])/h,0,1)[:,None];h=h[:,None]
   values=(2*u**3-3*u*u+1)*vv[ix,1]+(u**3-2*u*u+u)*h*vv[ix,2]+(-2*u**3+3*u*u)*vv[ix+1,1]+(u**3-u*u)*h*vv[ix+1,0]
   if field=='rotation':values/=np.linalg.norm(values,axis=1)[:,None]
  elif field=='rotation':values=Slerp(tt,R.from_quat(v))(np.clip(times,tt[0],tt[-1])).as_quat()
  else:values=np.array([np.interp(times,tt,v[:,k]) for k in range(v.shape[1])]).T
  tracks.append((c['target']['node'],field,values))
 for frame in range(len(times)):
  nodes=copy.deepcopy(d['nodes'])
  for node,field,v in tracks:nodes[node][field]=v[frame].tolist()
  dd={**d,'nodes':nodes};yield g.node_worlds(dd)[0]

def source_samples(path,clipname,frames):
 cachekey=(str(path.resolve()),path.stat().st_mtime_ns,clipname,frames)
 if cachekey in SOURCE_SAMPLE_CACHE:return SOURCE_SAMPLE_CACHE[cachekey]
 d,b,w,parents,names,j,surface,rest,floor,masks=setup(path,16159)
 clip=next(c for c in d['animations'] if c['name']==clipname);duration=max(float(g.accessor(d,b,s['input']).max()) for s in clip['samplers']);times=np.linspace(0,duration,frames+1)
 mirror=np.diag([-1,1,1]);data=[];source_height=float(rest[1998,1]-floor)
 for world in sample_clip(d,b,clip,times):
  deltas={target:mirror@(rotation(world[names[source]])@rotation(w[names[source]]).T)@mirror for target,source in M.items()}
  points={f:surface(world,v['whole']) for f,v in masks.items()}
  # Compare exact fixed sole sample, not the changing lowest vertex.
  feet={f:{'height':float(points[f][:,1].min()-floor),'z':float(surface(world,v['sole'])[:,2].mean()-v['center'][2])} for f,v in masks.items()}
  lift=world[names['pelvis_08']][:3,3]-w[names['pelvis_08']][:3,3]
  data.append((deltas,feet,lift))
 SOURCE_SAMPLE_CACHE[cachekey]=(times,data,source_height)
 return SOURCE_SAMPLE_CACHE[cachekey]

def append(d,b,a,kind):
 a=np.asarray(a,dtype='<f4');b.extend(b'\0'*(-len(b)%4));vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':a.nbytes});b.extend(a.tobytes());ai=len(d['accessors']);acc={'bufferView':vi,'componentType':5126,'count':len(a),'type':kind}
 if kind=='SCALAR':acc.update(min=[float(a.min())],max=[float(a.max())])
 d['accessors'].append(acc);return ai

def build(key,source,clipname,frames=128):
 target=ROOT/'assets/models/artist-breeds'/f'{key}.glb';d,b,w,parents,names,j,surface,rest,floor,masks=setup(target,20392)
 times,data,source_height=source_samples(source,clipname,frames)
 bodyheight=float(rest[:,1].max()-floor);ratio=(w[names['FL.scapula']][1,3]-floor)/1.604 # target shoulder height against native standing shoulder
 jump_time_scale=float(np.sqrt(ratio)) if 'Jump' in clipname else 1.
 source_duration=float(times[-1]);times=times*jump_time_scale
 rrest={i:rotation(w[i]) for i in range(len(d['nodes']))};localR={i:rotation(g.local_matrix(n)) for i,n in enumerate(d['nodes'])};localT={i:np.array(n.get('translation',[0,0,0]),float) for i,n in enumerate(d['nodes'])};localS={i:np.array(n.get('scale',[1,1,1]),float) for i,n in enumerate(d['nodes'])}
 mapped={names[k]:k for k in M};rootid=names['ROOT'];order=[]
 def visit(i):
  if i in order:return
  if i in parents:visit(parents[i])
  order.append(i)
 for i in range(len(d['nodes'])):visit(i)
 qvals={i:[] for i in j};tvals=[];errors=[];previous={f:np.zeros(len(chain)-2) for f,chain in CHAINS.items()}
 for pass_index in range(3 if 'Jump' not in clipname else 1):
  recording=pass_index==2 if 'Jump' not in clipname else True
  frameset=data if recording else data[:-1]
  for frame,(delta,goals,lift) in enumerate(frameset):
   lr=localR.copy();lt=localT.copy();lt[rootid]=localT[rootid]+np.array([-lift[0],lift[1],lift[2]])*ratio;world={}
   for i in order:
    parent=parents.get(i);pw=world.get(parent,np.eye(4));desired=delta[mapped[i]]@rrest[i] if i in mapped else None
    if desired is not None:lr[i]=rotation(pw).T@desired
    mat=np.eye(4);mat[:3,:3]=lr[i]*localS[i][None,:];mat[:3,3]=lt[i];world[i]=pw@mat
   # Freeze body pose and use actual skin landmarks to adjust each limb only.
   for f,chain in CHAINS.items():
    ids=[names[n] for n in chain];solveids=ids[:-2];base={i:lr[i].copy() for i in ids};desired={i:rotation(world[i]) for i in ids[-2:]};mask=masks[f];goal=goals[f];targety=floor+max(.001,goal['height']*ratio);targetz=mask['center'][2]+goal['z']*ratio
    affected=set(ids)
    for i in order:
     if parents.get(i) in affected:affected.add(i)
    def trial(a):
     for i in order:
      if i not in affected:continue
      parent=parents.get(i);pw=world.get(parent,np.eye(4));pr=rotation(pw)
      if i in solveids:lr[i]=pr.T@R.from_rotvec([a[solveids.index(i)],0,0]).as_matrix()@pr@base[i]
      elif i in desired:lr[i]=pr.T@desired[i]
      mat=np.eye(4);mat[:3,:3]=lr[i]*localS[i][None,:];mat[:3,3]=lt[i];world[i]=pw@mat
     return surface(world,mask['whole'])
    sole_indices=np.array([np.where(mask['whole']==i)[0][0] for i in mask['sole']])
    def resid(a):
     pts=trial(a);return np.r_[(pts[:,1].min()-targety)*180,(pts[sole_indices,2].mean()-targetz)*140,a*.28]
    sol=least_squares(resid,previous[f],bounds=(-.55,.55),max_nfev=30,ftol=1e-6,xtol=1e-6,gtol=1e-6);previous[f]=sol.x;pts=trial(sol.x)
    if recording:errors.append({'frame':frame,'foot':f,'sourceHeight':goal['height'],'minY':float(pts[:,1].min()-floor),'heightError':float(pts[:,1].min()-targety),'zError':float(pts[sole_indices,2].mean()-targetz),'maxCorrectionDeg':float(np.abs(sol.x).max()*180/np.pi)})
   if recording:
    for i in j:qvals[i].append(R.from_matrix(lr[i]).as_quat())
    tvals.append(lt[rootid])
    if frame%32==0:print(key,clipname,frame,flush=True)
 # Two complete warm cycles establish a periodic IK branch. Preserve the
 # independently solved final endpoint; never conceal its drift by copying.
 closure={d['nodes'][i]['name']:float(np.degrees((R.from_quat(qvals[i][-1])*R.from_quat(qvals[i][0]).inv()).magnitude())) for i in j}
 root_closure=float(np.linalg.norm(tvals[-1]-tvals[0]))
 out={'asset':{'version':'2.0','generator':'Meadowlark native reference retarget'},'scene':0,'scenes':[{'nodes':list(range(len(j)))}],'nodes':[{'name':d['nodes'][i]['name']} for i in j],'animations':[],'bufferViews':[],'accessors':[],'buffers':[{'byteLength':0}]};binary=bytearray();inputacc=append(out,binary,times.reshape(-1,1),'SCALAR');clip={'name':clipname,'channels':[],'samplers':[]}
 for i in j:
  qs=np.array(qvals[i]);
  for k in range(1,len(qs)):
   if np.dot(qs[k-1],qs[k])<0:qs[k]*=-1
  s=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(out,binary,qs,'VEC4'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':s,'target':{'node':list(j).index(i),'path':'rotation'}})
 s=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(out,binary,tvals,'VEC3'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':s,'target':{'node':list(j).index(rootid),'path':'translation'}});out['animations']=[clip];out['buffers'][0]['byteLength']=len(binary)
 dest=OUT/key;dest.mkdir(exist_ok=True);filename=clip_filename(clipname);g.write_glb(dest/(filename+'.glb'),out,binary)
 report={'body':key,'clip':clipname,'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'durationS':float(times[-1]),'ratio':ratio,'frames':frames+1,'warmCycles':2 if 'Jump' not in clipname else 0,'uncopiedEndpointMaxDegrees':max(closure.values()),'uncopiedRootClosureM':root_closure,'boneLengthsPreserved':True,'meshBindsUnmodified':True,'minHoofY':min(e['minY'] for e in errors),'maxHeightError':max(abs(e['heightError']) for e in errors),'maxZError':max(abs(e['zError']) for e in errors),'maxStanceError':max([abs(e['heightError']) for e in errors if e['sourceHeight']<.006] or [0]),'floorY':floor,'jointCount':len(j),'footMasks':{f:{'wholeVertices':v['whole'].tolist(),'vertices':v['sole'].tolist(),'toeVertices':v['toe'].tolist(),'heelVertices':v['heel'].tolist()} for f,v in masks.items()},'errors':errors}
 if 'Jump' in clipname:
  jump_path=source.parent/'jump-metadata.json'
  if not jump_path.exists():raise RuntimeError('Jump source requires sibling jump-metadata.json for external actor lift')
  jump=json.loads(jump_path.read_text());jump['actorLiftM']=[[t*jump_time_scale,h*ratio] for t,h in jump['actorLiftM']];jump['maxActorLiftM']*=ratio
  for field in ['durationS','flightStartS','flightEndS','foreTouchdownS','hindTouchdownS']:
   if field in jump:jump[field]*=jump_time_scale
  jump['sourceJumpModelSha256']=jump.pop('modelSha256',None);jump['targetBodyScale']=ratio;jump['jumpTimeScale']=jump_time_scale;jump['canonicalTranslation']=[0.,0.,0.];report['nativeJump']=jump;report['jumpTimeScale']=jump_time_scale;report['sourceDurationS']=source_duration
 (dest/(filename+'.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['errors','footMasks','nativeJump']}),flush=True)
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--body',default='bay');p.add_argument('--source',type=Path,default=ROOT/'review/native-trot-polish-pilot/model.glb');p.add_argument('--clip',default='Target Native Trot');p.add_argument('--frames',type=int,default=128);p.add_argument('--all',action='store_true');p.add_argument('--jobs',type=int,default=2);args=p.parse_args()
 if args.all:
  from concurrent.futures import ProcessPoolExecutor
  manifest=json.loads((ROOT/'assets/models/artist-breeds/manifest.json').read_text());keys=sorted({v['file'].removesuffix('.glb') for v in manifest['breeds'].values()})
  with ProcessPoolExecutor(max_workers=min(2,max(1,args.jobs))) as pool:
   futures=[pool.submit(build,key,args.source,args.clip,args.frames) for key in keys]
   reports=[f.result() for f in futures]
  summary=[{k:v for k,v in row.items() if k not in ['errors','footMasks']} for row in reports];filename=clip_filename(args.clip);(OUT/(filename+'-batch-summary.json')).write_text(json.dumps(summary,indent=2)+'\n')
 else:build(args.body,args.source,args.clip,args.frames)
