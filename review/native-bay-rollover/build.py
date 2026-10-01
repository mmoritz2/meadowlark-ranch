"""Author a private refined Bay Walk on actual native Bay pivots, skin and binds."""
from pathlib import Path
import copy, importlib.util, json, hashlib, re
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import least_squares
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/native-bay-rollover';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
SOURCE=ROOT/'output/native-bay-preparation/native-bay-rest.glb'
if not SOURCE.exists():SOURCE=Path(__file__).with_name('rest.glb')
SOURCE_SHA256=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert SOURCE_SHA256=='6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3'
d,db=g.read_glb(SOURCE);original_binary=bytes(db);original=copy.deepcopy(d);dw,dp=g.node_worlds(d);names={n['name']:i for i,n in enumerate(d['nodes']) if 'name'in n}
def rot(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
dr={i:rot(w) for i,w in dw.items()};dt={i:np.asarray(n.get('translation',[0,0,0]),float) for i,n in enumerate(d['nodes'])};dq={i:R.from_quat(n.get('rotation',[0,0,0,1])) for i,n in enumerate(d['nodes'])};ds={i:np.asarray(n.get('scale',[1,1,1]),float) for i,n in enumerate(d['nodes'])}
body_node=next(i for i,n in enumerate(d['nodes']) if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==16159);prim=d['meshes'][d['nodes'][body_node]['mesh']]['primitives'][0]
pos=g.accessor(d,db,prim['attributes']['POSITION']);idx=g.accessor(d,db,prim['attributes']['JOINTS_0']).astype(int);wt=g.accessor(d,db,prim['attributes']['WEIGHTS_0']);skin=d['skins'][d['nodes'][body_node]['skin']];joints=np.asarray(skin['joints']);ibm=g.accessor(d,db,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);pv=np.c_[pos,np.ones(len(pos))]
restops=np.asarray([dw[i] for i in joints])@ibm;restpoints=np.sum(np.einsum('ncij,nj->nci',restops[idx],pv)*wt[:,:,None],axis=1)[:,:3];floor=float(restpoints[:,1].min())
WHITE_TRUNK_ABOVE_FLOOR_M=1.7408730566500411
BAY_TRUNK_ABOVE_FLOOR_M=float(restpoints[1998,1]-floor)
HEIGHT_RATIO=BAY_TRUNK_ABOVE_FLOOR_M/WHITE_TRUNK_ABOVE_FLOOR_M
assert .8<HEIGHT_RATIO<.9
feet={
 'HL':{'offset':0.,'marker':'toes_02_l_0409','chain':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407'],'terminal':'toes_01_l_0408'},
 'FL':{'offset':.25,'marker':'fingers_02_l_0208','chain':['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206'],'terminal':'fingers_01_l_0187'},
 'HR':{'offset':.5,'marker':'toes_02_r_0478','chain':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476'],'terminal':'toes_01_r_0477'},
 'FR':{'offset':.75,'marker':'fingers_02_r_0274','chain':['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272'],'terminal':'fingers_01_r_0273'}}
keys=list(feet);markers=np.asarray([dw[names[v['marker']]][:3,3] for v in feet.values()]);which=((restpoints[:,None,[0,2]]-markers[None,:,[0,2]])**2).sum(axis=2).argmin(axis=1)
for k,info in feet.items():
 group=np.where((which==keys.index(k))&(restpoints[:,1]<floor+.19*HEIGHT_RATIO))[0];minimum=float(restpoints[group,1].min());ids=group[restpoints[group,1]<minimum+.007];assert len(ids)>=12,(k,len(ids));z=restpoints[ids,2];heel=ids[z<=np.quantile(z,.25)];toe=ids[z>=np.quantile(z,.75)];info.update({'vertices':ids,'wholeVertices':group,'toeVertices':toe,'heelVertices':heel,'restCentroid':restpoints[ids].mean(axis=0),'restToeCentroid':restpoints[toe].mean(axis=0),'restHeelCentroid':restpoints[heel].mean(axis=0),'restMinY':minimum,'restMaxY':float(restpoints[ids,1].max())});info['chain']=[names[n] for n in info['chain']];info['terminal']=names[info['terminal']]
DURATION=1.12;STANCE=.65;STRIDE=.20*HEIGHT_RATIO;LIFT=.09*HEIGHT_RATIO
def smooth(u):
 u=float(np.clip(u,0,1));return u*u*(3-2*u)
def trajectory(p,k,standing=False):
 info=feet[k];q=(p-info['offset'])%1
 if standing:return {'z':info['restCentroid'][2],'y':floor+.001,'stance':True,'pitch':0.,'anchor':'sole','swing':0.,'phase':q}
 if q<STANCE:
  z=STRIDE*(1-2*q/STANCE);y=0;stance=True;u=q/STANCE;swing=0.
  if u<.15:pitch=-5*(1-smooth(u/.15));anchor='heel'
  elif u>.7:pitch=13*smooth((u-.7)/.3);anchor='toe'
  else:pitch=0.;anchor='sole'
 else:
  u=(q-STANCE)/(1-STANCE);v=-2*STRIDE/STANCE*(1-STANCE);z=-STRIDE+v*u+(6*STRIDE-3*v)*u*u+(-4*STRIDE+2*v)*u*u*u
  lift=LIFT;y=lift*np.sin(np.pi*u**.65)*smooth(u/.035)*smooth((1-u)/.035);stance=False;swing=u;anchor='sole'
  if u<.38:pitch=13+(35-13)*smooth(u/.38)
  else:pitch=35+(-5-35)*smooth((u-.38)/.62)
 restz=info['restHeelCentroid'][2] if anchor=='heel' else info['restToeCentroid'][2] if anchor=='toe' else info['restCentroid'][2]
 return {'z':restz+z,'y':floor+.001+y,'stance':stance,'pitch':pitch,'anchor':anchor,'swing':swing,'phase':q}

def solve(p,standing=False):
 localq=copy.copy(dq);localt=copy.copy(dt);cache={}
 def world(i):
  if i in cache:return cache[i]
  if 'matrix'in d['nodes'][i]:m=g.local_matrix(d['nodes'][i])
  else:m=np.eye(4);m[:3,:3]=localq[i].as_matrix()*ds[i][None,:];m[:3,3]=localt[i]
  cache[i]=(world(dp[i]) if i in dp else np.eye(4))@m;return cache[i]
 # Keep the original high standing torso. Four-beat walking bob remains small.
 # This is a separately authored rollover proof; the frozen Walk is unchanged.
 if not standing:
  theta=2*np.pi*p;pi=names['pelvis_08'];localt[pi]=dt[pi]+np.linalg.inv(dw[dp[pi]][:3,:3])@np.array([0,.006*HEIGHT_RATIO*np.sin(4*theta),0])
  motions={'pelvis_08':(.35*np.sin(2*theta),.22*np.sin(theta)), 'spine_01_09':(.5*np.sin(2*theta+.4),.2*np.sin(theta+.2)), 'spine_02_010':(.45*np.sin(2*theta+.65),.16*np.sin(theta+.3)), 'spine_03_011':(.4*np.sin(2*theta+.8),.12*np.sin(theta+.4)), 'spine_04_012':(.4*np.sin(2*theta+1),.1*np.sin(theta+.5)), 'neck_01_014':(1.1*np.sin(2*theta-.3),.12*np.sin(theta)), 'neck_02_015':(1.4*np.sin(2*theta-.4),.12*np.sin(theta)), 'neck_03_016':(1.8*np.sin(2*theta-.55),.12*np.sin(theta)), 'neck_04_017':(2.1*np.sin(2*theta-.65),.12*np.sin(theta)), 'neck_05_018':(2.4*np.sin(2*theta-.7),.12*np.sin(theta)), 'head_019':(2.8*np.sin(2*theta-.8),.2*np.sin(theta))}
  for name,(pitch,roll) in motions.items():
   # This pass solves sagittal plants only. Keep global lateral roll zero so
   # planted feet retain their original X coordinates as the body bobs.
   roll=0.;i=names[name];parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_euler('xz',[pitch,roll],degrees=True)*dr[i];cache.clear()
 report={}
 for k,info in feet.items():
  chain=info['chain'];terminal=info['terminal'];ids=info['wholeVertices'];influences=np.unique(idx[ids]);lut={i:j for j,i in enumerate(influences)};choose=np.vectorize(lut.get)(idx[ids]);originalq={i:localq[i] for i in chain};goal=trajectory(p,k,standing);terminal_world=R.from_rotvec([np.deg2rad(goal['pitch']),0,0])*dr[terminal];goaly,goalz,stance=goal['y'],goal['z'],goal['stance'];anchorids=info['heelVertices'] if goal['anchor']=='heel' else info['toeVertices'] if goal['anchor']=='toe' else info['vertices'];anchor_lookup=np.array([np.where(ids==i)[0][0] for i in anchorids]);bias=np.zeros(len(chain))
  if not stance:
   flex=np.sin(np.pi*goal['swing'])
   if k in ['FL','FR']:bias[-1]=np.deg2rad(24)*flex
   else:bias[-1]=np.deg2rad(-18)*flex;bias[1]=np.deg2rad(6)*flex
  def trial(angles):
   cache.clear()
   for i,angle in zip(chain,angles):
    parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_rotvec([angle,0,0])*parent*originalq[i];cache.clear()
   localq[terminal]=rot(world(dp[terminal])).inv()*terminal_world;cache.clear();ops=np.asarray([world(int(joints[i]))@ibm[i] for i in influences]);points=np.sum(np.einsum('ncij,nj->nci',ops[choose],pv[ids])*wt[ids,:,None],axis=1)[:,:3];return points
  def residual(angles):
   points=trial(angles);return np.r_[(points[:,1].min()-goaly)*100,(points[anchor_lookup,2].mean()-goalz)*100,(angles-bias)*.9]
  if k in ['FL','FR']:lower=np.deg2rad([-10,-30,-38,-12]);upper=np.deg2rad([10,30,38,45])
  else:lower=np.deg2rad([-30,-40,-35]);upper=np.deg2rad([30,40,20])
  initial=np.clip(bias,lower+.001,upper-.001);solution=least_squares(residual,initial,bounds=(lower,upper),max_nfev=55,xtol=1e-7,ftol=1e-7,gtol=1e-7);points=trial(solution.x)
  report[k]={'stance':stance,'limbPhase':goal['phase'],'swingPhase':goal['swing'],'footPitchDegrees':goal['pitch'],'anchor':goal['anchor'],'goal':[goaly,goalz],'minY':float(points[:,1].min()),'maxY':float(points[:,1].max()),'centroid':points.mean(axis=0).tolist(),'contactVerticalError':float(points[:,1].min()-goaly),'strideAnchorError':float(points[anchor_lookup,2].mean()-goalz),'correctionDegrees':np.rad2deg(solution.x).tolist(),'biasDegrees':np.rad2deg(bias).tolist(),'hitBound':bool(np.any(solution.x<lower+.0001)|np.any(solution.x>upper-.0001))}
 return localq,localt,report

standing_q,standing_t,standing_report=solve(0,True)
standing_pass=all(abs(row['minY']-floor)<.005 and abs(row['strideAnchorError'])<.005 for row in standing_report.values())
report={'verdict':'pending browser and independent visual review','duration':DURATION,'stanceFraction':STANCE,'strideHalfM':STRIDE,'foreSwingLiftM':LIFT,'hindSwingLiftM':LIFT,'impliedSpeedMps':2*STRIDE/(STANCE*DURATION),'phaseOrder':'LH, LF, RH, RF','suspensionWindows':[],'sourcePath':str(SOURCE),'sourceSha256':SOURCE_SHA256,'whiteTrunkAboveFloorM':WHITE_TRUNK_ABOVE_FLOOR_M,'bayTrunkAboveFloorM':BAY_TRUNK_ABOVE_FLOOR_M,'bodyHeightRatio':HEIGHT_RATIO,'floorY':floor,'boundsDegrees':{'fore':[[-10,10],[-30,30],[-38,38],[-12,45]],'hind':[[-30,30],[-40,40],[-35,20]]},'standingProbe':{'pass':standing_pass,'feet':standing_report},'footMasks':{k:{'vertices':v['vertices'].tolist(),'wholeVertices':v['wholeVertices'].tolist(),'toeVertices':v['toeVertices'].tolist(),'heelVertices':v['heelVertices'].tolist(),'restCentroid':v['restCentroid'].tolist(),'restMinY':v['restMinY'],'restMaxY':v['restMaxY'],'offset':v['offset'],'chain':[d['nodes'][i]['name'] for i in v['chain']],'terminal':d['nodes'][v['terminal']]['name']} for k,v in feet.items()},'frames':[],'nativeCurveReference':json.loads(Path(__file__).with_name('native-walk-joint-reference.json').read_text())}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
if not standing_pass:raise RuntimeError('Standing contact probe failed; do not author gait')
# Only strongly weighted original groom detail controls receive a periodic layer.
hairmesh=next(n for n in d['nodes'] if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==23514);hp=d['meshes'][hairmesh['mesh']]['primitives'][0];hi=g.accessor(d,db,hp['attributes']['JOINTS_0']).astype(int);hw=g.accessor(d,db,hp['attributes']['WEIGHTS_0']);impact=np.bincount(hi.ravel(),weights=hw.ravel(),minlength=len(joints));hair=[]
for j,i in enumerate(joints):
 if impact[j]>5 and re.match(r'^dyn_(?:new_(?:head_)?neck|head_end|(?:bounce_)?tail)',d['nodes'][i]['name']):hair.append(int(i))
keyed=set(hair)|{names[n] for n in ['pelvis_08','spine_01_09','spine_02_010','spine_03_011','spine_04_012','neck_01_014','neck_02_015','neck_03_016','neck_04_017','neck_05_018','head_019','tail_01_0367']}
for info in feet.values():keyed.update(info['chain']);keyed.add(info['terminal'])
keyed=sorted(keyed);qvalues={i:[] for i in keyed};tvalues=[];times=np.linspace(0,DURATION,129)
for t in times[:-1]:
 p=float(t/DURATION);q,tr,feet_report=solve(p);report['frames'].append({'phase':p,'feet':feet_report})
 # A native tail-base response carries its whole hanging chain and detail groom.
 pose_rot_cache={}
 def pose_rot(i):
  if i in pose_rot_cache:return pose_rot_cache[i]
  l=rot(g.local_matrix(d['nodes'][i])) if 'matrix'in d['nodes'][i] else q[i];pose_rot_cache[i]=(pose_rot(dp[i]) if i in dp else R.identity())*l;return pose_rot_cache[i]
 tail=names['tail_01_0367'];parent=pose_rot(dp[tail]);phase=2*np.pi*p;q[tail]=parent.inv()*R.from_euler('yx',[2.6*np.sin(phase-.55),.8*np.sin(2*phase-.8)],degrees=True)*parent*dq[tail]
 for i in hair:
  serial=int(re.search(r'_(\d+)$',d['nodes'][i]['name']).group(1));is_tail='tail'in d['nodes'][i]['name'];phase=2*np.pi*p;amplitude=.035 if is_tail else .022;q[i]=q[i]*R.from_euler('xyz',[amplitude*np.sin((1 if is_tail else 2)*phase-serial*.17),0,amplitude*.5*np.sin(phase+serial*.22)])
 for i in keyed:qvalues[i].append(q[i].as_quat())
 tvalues.append(tr[names['pelvis_08']])
for i in keyed:qvalues[i].append(qvalues[i][0])
tvalues.append(tvalues[0]);report['hairDetailJoints']=len(hair)
def append(values,kind):
 a=np.asarray(values,dtype='<f4');db.extend(b'\0'*((-len(db))%4));offset=len(db);db.extend(a.tobytes());view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});index=len(d['accessors']);acc={'bufferView':view,'componentType':5126,'count':len(a),'type':kind}
 if kind=='SCALAR':acc.update(min=[float(a.min())],max=[float(a.max())])
 d['accessors'].append(acc);return index
inputacc=append(times.reshape(-1,1),'SCALAR');clip={'name':'Target Native Walk Rollover','samplers':[],'channels':[]}
for i in keyed:
 qs=np.asarray(qvalues[i]);
 for j in range(1,len(qs)):
  if np.dot(qs[j-1],qs[j])<0:qs[j]*=-1
 sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(qs,'VEC4'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':i,'path':'rotation'}})
sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(tvalues,'VEC3'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':names['pelvis_08'],'path':'translation'}});d.setdefault('animations',[]).append(clip);d['asset'].setdefault('extras',{})['privateAuthoredBayWalkRollover']='Native Bay standing target, original Bay skin and appearance; target-authored four-beat slow Walk with native hoof rollover, private proof.'
candidate=OUT/'bay-native-walk-rollover.glb';g.write_glb(candidate,d,db)
report['candidateBytes']=candidate.stat().st_size;report['candidateSha256']=hashlib.sha256(candidate.read_bytes()).hexdigest();report['preservation']={k:original.get(k)==d.get(k) for k in ['nodes','meshes','skins','materials','images','textures','scenes']};report['preservation']['originalBinaryPrefix']=bytes(db[:len(original_binary)])==original_binary;assert all(report['preservation'].values())
report['authoredGridPass']=all(abs(row['contactVerticalError'])<.005 and abs(row['strideAnchorError'])<.005 and row['minY']>=floor-.005 and (not row['stance'] or abs(row['minY']-floor)<.01) for frame in report['frames'] for row in frame['feet'].values());report['worstVerticalErrorM']=max(abs(row['contactVerticalError']) for frame in report['frames'] for row in frame['feet'].values());report['worstStrideErrorM']=max(abs(row['strideAnchorError']) for frame in report['frames'] for row in frame['feet'].values());report['maxCorrectionDegrees']=max(abs(a) for frame in report['frames'] for row in frame['feet'].values() for a in row['correctionDegrees']);report['capHits']={k:sum(frame['feet'][k]['hitBound'] for frame in report['frames']) for k in feet};(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['standingProbe','authoredGridPass','worstVerticalErrorM','worstStrideErrorM','maxCorrectionDegrees','capHits','hairDetailJoints']},indent=2))
