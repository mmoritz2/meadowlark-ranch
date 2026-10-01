"""Author a target-specific Bay diagonal slow Trot from its immutable standing skin."""
from pathlib import Path
import copy, importlib.util, json, hashlib, re
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import least_squares
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/native-bay-trot-continuous';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
cs=importlib.util.spec_from_file_location('continuity',Path(__file__).with_name('continuity-tools.py'));continuity=importlib.util.module_from_spec(cs);cs.loader.exec_module(continuity)
SOURCE=ROOT/'review/native-bay-rollover/rest.glb'
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
assert abs(HEIGHT_RATIO-.8496868094412634)<1e-10
feet={
 'HL':{'offset':.5,'marker':'toes_02_l_0409','chain':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407'],'terminal':'toes_01_l_0408'},
 'FL':{'offset':0.,'marker':'fingers_02_l_0208','chain':['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206'],'terminal':'fingers_01_l_0187'},
 'HR':{'offset':0.,'marker':'toes_02_r_0478','chain':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476'],'terminal':'toes_01_r_0477'},
 'FR':{'offset':.5,'marker':'fingers_02_r_0274','chain':['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272'],'terminal':'fingers_01_r_0273'}}
keys=list(feet);markers=np.asarray([dw[names[v['marker']]][:3,3] for v in feet.values()]);which=((restpoints[:,None,[0,2]]-markers[None,:,[0,2]])**2).sum(axis=2).argmin(axis=1)
for k,info in feet.items():
 group=np.where((which==keys.index(k))&(restpoints[:,1]<floor+.19*HEIGHT_RATIO))[0];minimum=float(restpoints[group,1].min());ids=group[restpoints[group,1]<minimum+.007];assert len(ids)>=12,(k,len(ids));z=restpoints[ids,2];heel=ids[z<=np.quantile(z,.25)];toe=ids[z>=np.quantile(z,.75)];info.update({'vertices':ids,'wholeVertices':group,'toeVertices':toe,'heelVertices':heel,'restCentroid':restpoints[ids].mean(axis=0),'restToeCentroid':restpoints[toe].mean(axis=0),'restHeelCentroid':restpoints[heel].mean(axis=0),'restMinY':minimum,'restMaxY':float(restpoints[ids,1].max())});info['chain']=[names[n] for n in info['chain']];info['terminal']=names[info['terminal']]
DURATION=.72;STANCE=.44;STRIDE=.22*HEIGHT_RATIO;LIFT=.11*HEIGHT_RATIO;HIND_LIFT=.10*HEIGHT_RATIO
def smooth(u):
 u=float(np.clip(u,0,1));return u*u*(3-2*u)
def trajectory(p,k,standing=False):
 info=feet[k];q=(p-info['offset'])%1
 if standing:return {'z':info['restCentroid'][2],'y':floor+.001,'stance':True,'pitch':0.,'anchor':'sole','anchorWeights':{'sole':1.},'swing':0.,'phase':q}
 if q<STANCE:
  z=STRIDE*(1-2*q/STANCE);y=0;stance=True;u=q/STANCE;swing=0.
  if u<.15:pitch=-8*(1-smooth(u/.15));anchor='heel'
  elif u>.7:pitch=22*smooth((u-.7)/.3);anchor='toe'
  else:pitch=0.;anchor='sole'
 else:
  u=(q-STANCE)/(1-STANCE);v=-2*STRIDE/STANCE*(1-STANCE);z=-STRIDE+v*u+(6*STRIDE-3*v)*u*u+(-4*STRIDE+2*v)*u*u*u
  lift=LIFT if k in ['FL','FR'] else HIND_LIFT;y=lift*16*u*u*(1-u)*(1-u);stance=False;swing=u;anchor='swing blend'
  if u<.50:pitch=22+(42-22)*smooth(u/.50)
  else:pitch=42+(-8-42)*smooth((u-.50)/.50)
 if stance:weights={anchor:1.}
 elif u<.25:
  blend=smooth(u/.25);weights={'toe':1-blend,'sole':blend}
 elif u>.75:
  blend=smooth((u-.75)/.25);weights={'sole':1-blend,'heel':blend}
 else:weights={'sole':1.}
 restz=sum(w*(info['restCentroid'][2] if part=='sole' else info['rest'+part.title()+'Centroid'][2]) for part,w in weights.items())
 return {'z':restz+z,'y':floor+.001+y,'stance':stance,'pitch':pitch,'anchor':anchor,'anchorWeights':weights,'swing':swing,'phase':q}

previous_angles={}
previous_poses={}
prior_poses={}
CONTINUITY_WEIGHT=2.0
ACCELERATION_WEIGHT=4.0
def solve(p,standing=False):
 localq=copy.copy(dq);localt=copy.copy(dt);cache={}
 def world(i):
  if i in cache:return cache[i]
  if 'matrix'in d['nodes'][i]:m=g.local_matrix(d['nodes'][i])
  else:m=np.eye(4);m[:3,:3]=localq[i].as_matrix()*ds[i][None,:];m[:3,3]=localt[i]
  cache[i]=(world(dp[i]) if i in dp else np.eye(4))@m;return cache[i]
 # True diagonal Trot compresses at diagonal midstance and rises into the two
 # suspension windows. Standing posture remains high; no old Walk is retimed.
 if not standing:
  theta=2*np.pi*p;pi=names['pelvis_08'];localt[pi]=dt[pi]+np.linalg.inv(dw[dp[pi]][:3,:3])@np.array([0,HEIGHT_RATIO*(.010+.018*np.cos(2*theta+.12*np.pi)),0])
  motions={'pelvis_08':(.8*np.sin(2*theta+.2),.35*np.sin(theta)), 'spine_01_09':(1.15*np.sin(2*theta+.4),.3*np.sin(theta+.2)), 'spine_02_010':(1.1*np.sin(2*theta+.65),.25*np.sin(theta+.3)), 'spine_03_011':(1.*np.sin(2*theta+.8),.22*np.sin(theta+.4)), 'spine_04_012':(1.1*np.sin(2*theta+1),.2*np.sin(theta+.5)), 'neck_01_014':(2.3*np.sin(2*theta-.3),.25*np.sin(theta)), 'neck_02_015':(3.1*np.sin(2*theta-.4),.25*np.sin(theta)), 'neck_03_016':(4.1*np.sin(2*theta-.55),.25*np.sin(theta)), 'neck_04_017':(4.7*np.sin(2*theta-.65),.25*np.sin(theta)), 'neck_05_018':(5.*np.sin(2*theta-.7),.25*np.sin(theta)), 'head_019':(5.5*np.sin(2*theta-.8),.35*np.sin(theta))}
  for name,(pitch,roll) in motions.items():
   # This pass solves sagittal plants only. Keep global lateral roll zero so
   # planted feet retain their original X coordinates as the body bobs.
   roll=0.;i=names[name];parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_euler('xz',[pitch,roll],degrees=True)*dr[i];cache.clear()
 report={}
 for k,info in feet.items():
  chain=info['chain'];terminal=info['terminal'];ids=info['wholeVertices'];influences=np.unique(idx[ids]);lut={i:j for j,i in enumerate(influences)};choose=np.vectorize(lut.get)(idx[ids]);originalq={i:localq[i] for i in chain};previous=None if standing else previous_angles.get(k);previous_pose=None if standing else previous_poses.get(k);prior_pose=None if standing else prior_poses.get(k);goal=trajectory(p,k,standing);terminal_world=R.from_rotvec([np.deg2rad(goal['pitch']),0,0])*dr[terminal];goaly,goalz,stance=goal['y'],goal['z'],goal['stance'];anchor_lookup={part:np.array([np.where(ids==i)[0][0] for i in (info['vertices'] if part=='sole' else info[part+'Vertices'])]) for part in goal['anchorWeights']};bias=np.zeros(len(chain))
  def anchor_z(points):return sum(w*points[anchor_lookup[part],2].mean() for part,w in goal['anchorWeights'].items())
  if not stance:
   flex=np.sin(np.pi*goal['swing'])
   if k in ['FL','FR']:bias[-1]=np.deg2rad(32)*flex
   else:bias[-1]=np.deg2rad(-22)*flex;bias[1]=np.deg2rad(8)*flex
  def trial(angles):
   cache.clear()
   for i,angle in zip(chain,angles):
    parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_rotvec([angle,0,0])*parent*originalq[i];cache.clear()
   localq[terminal]=rot(world(dp[terminal])).inv()*terminal_world;cache.clear();ops=np.asarray([world(int(joints[i]))@ibm[i] for i in influences]);points=np.sum(np.einsum('ncij,nj->nci',ops[choose],pv[ids])*wt[ids,:,None],axis=1)[:,:3];return points
  def residual(angles):
   points=trial(angles);return np.r_[(points[:,1].min()-goaly)*100,(anchor_z(points)-goalz)*100,(angles-bias)*.9,([] if previous is None else (angles-previous)*CONTINUITY_WEIGHT),continuity.rotation_acceleration_residual(localq,previous_pose,prior_pose,chain+[terminal],ACCELERATION_WEIGHT),continuity.rotation_step_residual(localq,previous_pose,chain+[terminal])]
  if k in ['FL','FR']:lower=np.deg2rad([-14,-35,-45,-15]);upper=np.deg2rad([14,35,45,70])
  else:lower=np.deg2rad([-35,-50,-50]);upper=np.deg2rad([35,50,20])
  initial=np.clip(bias if previous is None else previous,lower+.001,upper-.001);solution=least_squares(residual,initial,bounds=(lower,upper),max_nfev=55,xtol=1e-7,ftol=1e-7,gtol=1e-7);points=trial(solution.x)
  if not standing:
   previous_angles[k]=solution.x.copy();prior_poses[k]=previous_pose;previous_poses[k]={i:localq[i] for i in chain+[terminal]}
  report[k]={'stance':stance,'limbPhase':goal['phase'],'swingPhase':goal['swing'],'footPitchDegrees':goal['pitch'],'anchor':goal['anchor'],'anchorWeights':goal['anchorWeights'],'goal':[goaly,goalz],'minY':float(points[:,1].min()),'maxY':float(points[:,1].max()),'centroid':points.mean(axis=0).tolist(),'contactVerticalError':float(points[:,1].min()-goaly),'strideAnchorError':float(anchor_z(points)-goalz),'correctionDegrees':np.rad2deg(solution.x).tolist(),'biasDegrees':np.rad2deg(bias).tolist(),'hitBound':bool(np.any(solution.x<lower+.0001)|np.any(solution.x>upper-.0001))}
 return localq,localt,report

standing_q,standing_t,standing_report=solve(0,True)
standing_pass=all(abs(row['minY']-floor)<.005 and abs(row['strideAnchorError'])<.005 for row in standing_report.values())
report={'verdict':'pending browser and independent visual review','duration':DURATION,'stanceFraction':STANCE,'strideHalfM':STRIDE,'foreSwingLiftM':LIFT,'hindSwingLiftM':HIND_LIFT,'sourcePath':str(SOURCE),'sourceSha256':SOURCE_SHA256,'whiteTrunkAboveFloorM':WHITE_TRUNK_ABOVE_FLOOR_M,'bayTrunkAboveFloorM':BAY_TRUNK_ABOVE_FLOOR_M,'bodyHeightRatio':HEIGHT_RATIO,'impliedSpeedMps':2*STRIDE/(STANCE*DURATION),'phaseOrder':'FL+HR, FR+HL','suspensionWindows':[[.44,.5],[.94,1.]],'floorY':floor,'boundsDegrees':{'fore':[[-14,14],[-35,35],[-45,45],[-15,70]],'hind':[[-35,35],[-50,50],[-50,20]]},'standingProbe':{'pass':standing_pass,'feet':standing_report},'footMasks':{k:{'vertices':v['vertices'].tolist(),'wholeVertices':v['wholeVertices'].tolist(),'toeVertices':v['toeVertices'].tolist(),'heelVertices':v['heelVertices'].tolist(),'restCentroid':v['restCentroid'].tolist(),'restMinY':v['restMinY'],'restMaxY':v['restMaxY'],'offset':v['offset'],'chain':[d['nodes'][i]['name'] for i in v['chain']],'terminal':d['nodes'][v['terminal']]['name']} for k,v in feet.items()},'frames':[],'nativeCurveReference':json.loads(Path(__file__).with_name('native-walk-joint-reference.json').read_text())}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
if not standing_pass:raise RuntimeError('Standing contact probe failed; do not author gait')
# Only strongly weighted original groom detail controls receive a periodic layer.
hairmesh=next(n for n in d['nodes'] if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==23514);hp=d['meshes'][hairmesh['mesh']]['primitives'][0];hi=g.accessor(d,db,hp['attributes']['JOINTS_0']).astype(int);hw=g.accessor(d,db,hp['attributes']['WEIGHTS_0']);impact=np.bincount(hi.ravel(),weights=hw.ravel(),minlength=len(joints));hair=[]
for j,i in enumerate(joints):
 if impact[j]>5 and re.match(r'^dyn_(?:new_(?:head_)?neck|head_end|(?:bounce_)?tail)',d['nodes'][i]['name']):hair.append(int(i))
keyed=set(hair)|{names[n] for n in ['pelvis_08','spine_01_09','spine_02_010','spine_03_011','spine_04_012','neck_01_014','neck_02_015','neck_03_016','neck_04_017','neck_05_018','head_019','tail_01_0367']}
for info in feet.values():keyed.update(info['chain']);keyed.add(info['terminal'])
keyed=sorted(keyed);qvalues={i:[] for i in keyed};tvalues=[];times=np.linspace(0,DURATION,129)
# Warm-up cycle seeds the recorded cycle from a previous complete lap.
for warm in range(2):
 for t in times[:-1]:solve(float(t/DURATION))
report['continuityMethod']={'warmupCycles':2,'recordedCycles':1,'temporalAnglePenaltyWeight':CONTINUITY_WEIGHT,'actualQuaternionSecondDifferenceWeight':ACCELERATION_WEIGHT,'actualQuaternionStepSoftLimitDegrees':4.5,'actualQuaternionStepPenaltyWeight':75,'interpolation':'periodic CUBICSPLINE with verified recurring solve','liftCurve':'symmetric quartic16u²(1-u)², zero endpoint velocity','swingHoofPeakDegrees':42,'swingHoofPeakPhase':.5,'foreSwingBiasDegrees':32,'hindSwingBiasDegrees':-22,'stifleSwingBiasDegrees':8,'contactResidualWeight':100,'biasResidualWeight':.9,'initialization':'previous bounded limb correction angles','closureProbe':'uncopied next phase-zero solution'}
first_base_q=None
for t in times[:-1]:
 p=float(t/DURATION);q,tr,feet_report=solve(p);
 if first_base_q is None:first_base_q=copy.copy(q)
 report['frames'].append({'phase':p,'feet':feet_report})
 # A native tail-base response carries its whole hanging chain and detail groom.
 pose_rot_cache={}
 def pose_rot(i):
  if i in pose_rot_cache:return pose_rot_cache[i]
  l=rot(g.local_matrix(d['nodes'][i])) if 'matrix'in d['nodes'][i] else q[i];pose_rot_cache[i]=(pose_rot(dp[i]) if i in dp else R.identity())*l;return pose_rot_cache[i]
 tail=names['tail_01_0367'];parent=pose_rot(dp[tail]);phase=2*np.pi*p;q[tail]=parent.inv()*R.from_euler('yx',[4.*np.sin(phase-.55),1.3*np.sin(2*phase-.8)],degrees=True)*parent*dq[tail]
 for i in hair:
  serial=int(re.search(r'_(\d+)$',d['nodes'][i]['name']).group(1));is_tail='tail'in d['nodes'][i]['name'];phase=2*np.pi*p;amplitude=.055 if is_tail else .038;q[i]=q[i]*R.from_euler('xyz',[amplitude*np.sin((2 if is_tail else 3)*phase-serial*.17),0,amplitude*.6*np.sin(2*phase+serial*.22)])
 for i in keyed:qvalues[i].append(q[i].as_quat())
 tvalues.append(tr[names['pelvis_08']])
closure_q,closure_t,closure_feet=solve(0)
closure_joints=sorted({i for info in feet.values() for i in info['chain']+[info['terminal']]})
closure_angles={d['nodes'][i]['name']:float((first_base_q[i].inv()*closure_q[i]).magnitude()*180/np.pi) for i in closure_joints}
report['uncopiedCycleClosure']={'jointAngleDifferenceDegrees':closure_angles,'maximumJointAngleDifferenceDegrees':max(closure_angles.values()),'feet':closure_feet}
assert report['uncopiedCycleClosure']['maximumJointAngleDifferenceDegrees']<.01, 'Recurring pose is not sufficiently periodic; do not hide with endpoint duplication'
for i in keyed:qvalues[i].append(qvalues[i][0])
tvalues.append(tvalues[0]);report['hairDetailJoints']=len(hair)
def append(values,kind):
 a=np.asarray(values,dtype='<f4');db.extend(b'\0'*((-len(db))%4));offset=len(db);db.extend(a.tobytes());view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});index=len(d['accessors']);acc={'bufferView':view,'componentType':5126,'count':len(a),'type':kind}
 if kind=='SCALAR':acc.update(min=[float(a.min())],max=[float(a.max())])
 d['accessors'].append(acc);return index
inputacc=append(times.reshape(-1,1),'SCALAR');clip={'name':'Target Native Trot','samplers':[],'channels':[]}
for i in keyed:
 qs=np.asarray(qvalues[i]);
 for j in range(1,len(qs)):
  if np.dot(qs[j-1],qs[j])<0:qs[j]*=-1
 sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(continuity.periodic_cubic(qs,DURATION,True),'VEC4'),'interpolation':'CUBICSPLINE'});clip['channels'].append({'sampler':sampler,'target':{'node':i,'path':'rotation'}})
sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(continuity.periodic_cubic(tvalues,DURATION),'VEC3'),'interpolation':'CUBICSPLINE'});clip['channels'].append({'sampler':sampler,'target':{'node':names['pelvis_08'],'path':'translation'}});d.setdefault('animations',[]).append(clip);d['asset'].setdefault('extras',{})['privateAuthoredBayTrot']='Immutable Bay standing skin and actual native pivots/binds; separately solved diagonal slow Trot with blended swing anchors, actual angular acceleration control and periodic cubic interpolation, suspension and hoof rollover, private proof.'
candidate=OUT/'bay-native-trot-continuous.glb';g.write_glb(candidate,d,db)
report['candidateBytes']=candidate.stat().st_size;report['candidateSha256']=hashlib.sha256(candidate.read_bytes()).hexdigest();report['preservation']={k:original.get(k)==d.get(k) for k in ['nodes','meshes','skins','materials','images','textures','scenes']};report['preservation']['originalBinaryPrefix']=bytes(db[:len(original_binary)])==original_binary;assert all(report['preservation'].values())
report['authoredGridPass']=all(abs(row['contactVerticalError'])<.005 and abs(row['strideAnchorError'])<.005 and row['minY']>=floor-.005 and (not row['stance'] or abs(row['minY']-floor)<.01) for frame in report['frames'] for row in frame['feet'].values());report['worstVerticalErrorM']=max(abs(row['contactVerticalError']) for frame in report['frames'] for row in frame['feet'].values());report['worstStrideErrorM']=max(abs(row['strideAnchorError']) for frame in report['frames'] for row in frame['feet'].values());report['maxCorrectionDegrees']=max(abs(a) for frame in report['frames'] for row in frame['feet'].values() for a in row['correctionDegrees']);report['capHits']={k:sum(frame['feet'][k]['hitBound'] for frame in report['frames']) for k in feet};(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['standingProbe','authoredGridPass','worstVerticalErrorM','worstStrideErrorM','maxCorrectionDegrees','capHits','hairDetailJoints']},indent=2))

# Portable records preserve the exact candidate and a compact authoring report.
SAVED=ROOT/'review/native-bay-trot-continuous';SAVED.mkdir(parents=True,exist_ok=True)
import shutil
shutil.copy2(candidate,SAVED/'model.glb')
compact=copy.deepcopy(report);compact.pop('frames');compact['archiveNote']='Only per-frame rows omitted; ignored output/native-bay-trot/build-report.json retains the complete authored grid.'
(SAVED/'build-report.json').write_text(json.dumps(compact,indent=2)+'\n')
mask={'sourceSha256':SOURCE_SHA256,'floorY':floor,'heightRatio':HEIGHT_RATIO,'definitions':{'anatomicalLeft':'_l is FL/HL, positive rest X','broadHeightM':.19*HEIGHT_RATIO,'strictSoleOwnMinimumPlusM':.007,'toeHeel':'upper/lower rest-Z quartiles, ties included','contactHeightM':.001,'stanceToleranceM':.01},'footMasks':report['footMasks']}
for folder in [OUT,SAVED]:(folder/'native-foot-masks.json').write_text(json.dumps(mask,indent=2)+'\n')
preservation={k:original.get(k)==d.get(k) for k in ['nodes','meshes','skins','materials','images','textures','samplers','scenes']};preservation.update({'originalBinaryPrefix':bytes(db[:len(original_binary)])==original_binary,'originalAnimations':original.get('animations',[])==d.get('animations',[])[:-1],'originalAccessors':original['accessors']==d['accessors'][:len(original['accessors'])],'originalBufferViews':original['bufferViews']==d['bufferViews'][:len(original['bufferViews'])],'sourceSha256':SOURCE_SHA256,'candidateSha256':report['candidateSha256']});assert all(v for v in preservation.values() if isinstance(v,bool))
for folder in [OUT,SAVED]:(folder/'preservation-checks.json').write_text(json.dumps(preservation,indent=2)+'\n')
def longest_cycle(values):
 values=list(values);best=run=0
 for flag in values+values:
  run=run+1 if flag else 0;best=max(best,run)
 return min(len(values),best)
caps={}
for foot,info in feet.items():
 bounds=report['boundsDegrees']['fore' if foot in ['FL','FR'] else 'hind'];angles=np.array([frame['feet'][foot]['correctionDegrees'] for frame in report['frames']]);caps[foot]=[]
 for j,i in enumerate(info['chain']):
  lo,hi=bounds[j];low=int(np.count_nonzero(angles[:,j]<lo+.006));high=int(np.count_nonzero(angles[:,j]>hi-.006));caps[foot].append({'joint':d['nodes'][i]['name'],'boundsDegrees':[lo,hi],'rangeDegrees':[float(angles[:,j].min()),float(angles[:,j].max())],'lowerHitCount128':low,'upperHitCount128':high,'lowerSampledDurationMs':low*DURATION/128*1000,'upperSampledDurationMs':high*DURATION/128*1000,'longestLowerPlateauMs':longest_cycle(angles[:,j]<lo+.006)*DURATION/128*1000,'longestUpperPlateauMs':longest_cycle(angles[:,j]>hi-.006)*DURATION/128*1000})
for folder in [OUT,SAVED]:(folder/'per-joint-caps.json').write_text(json.dumps(caps,indent=2)+'\n')
print(json.dumps({'sourceSha256':SOURCE_SHA256,'candidateSha256':report['candidateSha256'],'heightRatio':HEIGHT_RATIO,'speedMps':report['impliedSpeedMps'],'saved':str(SAVED)},indent=2))
