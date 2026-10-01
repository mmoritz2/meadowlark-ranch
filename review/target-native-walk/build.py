"""Author one private, target-proportioned Walk without replacing the native skin."""
from pathlib import Path
import copy, importlib.util, json, hashlib, re
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import least_squares
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/target-native-walk';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('g',ROOT/'tools/asset-gen/rig_hero_horse.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
SOURCE=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'
d,db=g.read_glb(SOURCE);original_binary=bytes(db);original=copy.deepcopy(d);dw,dp=g.node_worlds(d);names={n['name']:i for i,n in enumerate(d['nodes']) if 'name'in n}
def rot(m):
 u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
dr={i:rot(w) for i,w in dw.items()};dt={i:np.asarray(n.get('translation',[0,0,0]),float) for i,n in enumerate(d['nodes'])};dq={i:R.from_quat(n.get('rotation',[0,0,0,1])) for i,n in enumerate(d['nodes'])};ds={i:np.asarray(n.get('scale',[1,1,1]),float) for i,n in enumerate(d['nodes'])}
body_node=next(i for i,n in enumerate(d['nodes']) if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==16159);prim=d['meshes'][d['nodes'][body_node]['mesh']]['primitives'][0]
pos=g.accessor(d,db,prim['attributes']['POSITION']);idx=g.accessor(d,db,prim['attributes']['JOINTS_0']).astype(int);wt=g.accessor(d,db,prim['attributes']['WEIGHTS_0']);skin=d['skins'][d['nodes'][body_node]['skin']];joints=np.asarray(skin['joints']);ibm=g.accessor(d,db,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);pv=np.c_[pos,np.ones(len(pos))]
restops=np.asarray([dw[i] for i in joints])@ibm;restpoints=np.sum(np.einsum('ncij,nj->nci',restops[idx],pv)*wt[:,:,None],axis=1)[:,:3];floor=float(restpoints[:,1].min())
feet={
 'HL':{'offset':0.,'marker':'toes_02_l_0409','chain':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407'],'terminal':'toes_01_l_0408'},
 'FL':{'offset':.25,'marker':'fingers_02_l_0208','chain':['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206'],'terminal':'fingers_01_l_0187'},
 'HR':{'offset':.5,'marker':'toes_02_r_0478','chain':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476'],'terminal':'toes_01_r_0477'},
 'FR':{'offset':.75,'marker':'fingers_02_r_0274','chain':['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272'],'terminal':'fingers_01_r_0273'}}
keys=list(feet);markers=np.asarray([dw[names[v['marker']]][:3,3] for v in feet.values()]);which=((restpoints[:,None,[0,2]]-markers[None,:,[0,2]])**2).sum(axis=2).argmin(axis=1)
for k,info in feet.items():
 group=np.where((which==keys.index(k))&(restpoints[:,1]<floor+.115))[0];minimum=float(restpoints[group,1].min());ids=group[restpoints[group,1]<minimum+.007];assert len(ids)>=12,(k,len(ids));info.update({'vertices':ids,'restCentroid':restpoints[ids].mean(axis=0),'restMinY':minimum,'restMaxY':float(restpoints[ids,1].max())});info['chain']=[names[n] for n in info['chain']];info['terminal']=names[info['terminal']]
DURATION=1.12;STANCE=.65;STRIDE=.20;LIFT=.09;ANGLE_BOUND=np.deg2rad(25)
def trajectory(p,k,standing=False):
 info=feet[k];q=(p-info['offset'])%1
 if standing:return info['restCentroid'][2],floor+.003,True
 if q<STANCE:z=STRIDE*(1-2*q/STANCE);y=0;stance=True
 else:
  u=(q-STANCE)/(1-STANCE);v=-2*STRIDE/STANCE*(1-STANCE);z=-STRIDE+v*u+(6*STRIDE-3*v)*u*u+(-4*STRIDE+2*v)*u*u*u;y=LIFT*np.sin(np.pi*u)**2;stance=False
 return info['restCentroid'][2]+z,floor+.003+y,stance

def solve(p,standing=False):
 localq=copy.copy(dq);localt=copy.copy(dt);cache={}
 def world(i):
  if i in cache:return cache[i]
  if 'matrix'in d['nodes'][i]:m=g.local_matrix(d['nodes'][i])
  else:m=np.eye(4);m[:3,:3]=localq[i].as_matrix()*ds[i][None,:];m[:3,3]=localt[i]
  cache[i]=(world(dp[i]) if i in dp else np.eye(4))@m;return cache[i]
 # Keep the standing body high. These are small world deltas about its own rig;
 # no source Walk crouch or mismatched retargeted stride enters this pose.
 if not standing:
  theta=2*np.pi*p;pi=names['pelvis_08'];localt[pi]=dt[pi]+np.linalg.inv(dw[dp[pi]][:3,:3])@np.array([0,.006*np.sin(4*theta),0])
  motions={'pelvis_08':(.35*np.sin(2*theta),.22*np.sin(theta)), 'spine_01_09':(.5*np.sin(2*theta+.4),.2*np.sin(theta+.2)), 'spine_02_010':(.45*np.sin(2*theta+.65),.16*np.sin(theta+.3)), 'spine_03_011':(.4*np.sin(2*theta+.8),.12*np.sin(theta+.4)), 'spine_04_012':(.4*np.sin(2*theta+1),.1*np.sin(theta+.5)), 'neck_01_014':(1.1*np.sin(2*theta-.3),.12*np.sin(theta)), 'neck_02_015':(1.4*np.sin(2*theta-.4),.12*np.sin(theta)), 'neck_03_016':(1.8*np.sin(2*theta-.55),.12*np.sin(theta)), 'neck_04_017':(2.1*np.sin(2*theta-.65),.12*np.sin(theta)), 'neck_05_018':(2.4*np.sin(2*theta-.7),.12*np.sin(theta)), 'head_019':(2.8*np.sin(2*theta-.8),.2*np.sin(theta))}
  for name,(pitch,roll) in motions.items():
   i=names[name];parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_euler('xz',[pitch,roll],degrees=True)*dr[i];cache.clear()
 report={}
 for k,info in feet.items():
  chain=info['chain'];terminal=info['terminal'];ids=info['vertices'];influences=np.unique(idx[ids]);lut={i:j for j,i in enumerate(influences)};choose=np.vectorize(lut.get)(idx[ids]);originalq={i:localq[i] for i in chain};terminal_world=dr[terminal];goalz,goaly,stance=trajectory(p,k,standing)
  def trial(angles):
   cache.clear()
   for i,angle in zip(chain,angles):
    parent=rot(world(dp[i]));localq[i]=parent.inv()*R.from_rotvec([angle,0,0])*parent*originalq[i];cache.clear()
   localq[terminal]=rot(world(dp[terminal])).inv()*terminal_world;cache.clear();ops=np.asarray([world(int(joints[i]))@ibm[i] for i in influences]);points=np.sum(np.einsum('ncij,nj->nci',ops[choose],pv[ids])*wt[ids,:,None],axis=1)[:,:3];return points
  def residual(angles):
   points=trial(angles);return np.r_[(points[:,1].mean()-goaly)*100,(points[:,2].mean()-goalz)*100,angles*.35]
  bounds=np.full(len(chain),ANGLE_BOUND)
  if k in ['FL','FR']:bounds[0]=np.deg2rad(10)
  solution=least_squares(residual,np.zeros(len(chain)),bounds=(-bounds,bounds),max_nfev=40,xtol=1e-7,ftol=1e-7,gtol=1e-7);points=trial(solution.x)
  report[k]={'stance':stance,'goal':[goaly,goalz],'minY':float(points[:,1].min()),'maxY':float(points[:,1].max()),'centroid':points.mean(axis=0).tolist(),'verticalMeanError':float(points[:,1].mean()-goaly),'strideMeanError':float(points[:,2].mean()-goalz),'correctionDegrees':np.rad2deg(solution.x).tolist(),'hitBound':bool(np.any(abs(solution.x)>bounds-.0001))}
 return localq,localt,report

standing_q,standing_t,standing_report=solve(0,True)
standing_pass=all(abs(row['minY']-floor)<.01 and abs(row['maxY']-floor)<.01 and abs(row['strideMeanError'])<.005 for row in standing_report.values())
report={'verdict':'pending browser and independent visual review','duration':DURATION,'stanceFraction':STANCE,'strideHalfM':STRIDE,'swingLiftM':LIFT,'phaseOrder':'LH, LF, RH, RF','floorY':floor,'correctionBoundDegrees':25,'scapularBoundDegrees':10,'standingProbe':{'pass':standing_pass,'feet':standing_report},'footMasks':{k:{'vertices':v['vertices'].tolist(),'restCentroid':v['restCentroid'].tolist(),'restMinY':v['restMinY'],'restMaxY':v['restMaxY'],'offset':v['offset'],'chain':[d['nodes'][i]['name'] for i in v['chain']],'terminal':d['nodes'][v['terminal']]['name']} for k,v in feet.items()},'frames':[]}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
if not standing_pass:raise RuntimeError('Standing contact probe failed; do not author gait')
# Only strongly weighted original groom detail controls receive a periodic layer.
hairmesh=next(n for n in d['nodes'] if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==23514);hp=d['meshes'][hairmesh['mesh']]['primitives'][0];hi=g.accessor(d,db,hp['attributes']['JOINTS_0']).astype(int);hw=g.accessor(d,db,hp['attributes']['WEIGHTS_0']);impact=np.bincount(hi.ravel(),weights=hw.ravel(),minlength=len(joints));hair=[]
for j,i in enumerate(joints):
 if impact[j]>5 and re.match(r'^dyn_(?:new_(?:head_)?neck|head_end|(?:bounce_)?tail)',d['nodes'][i]['name']):hair.append(int(i))
keyed=set(hair)|{names[n] for n in ['pelvis_08','spine_01_09','spine_02_010','spine_03_011','spine_04_012','neck_01_014','neck_02_015','neck_03_016','neck_04_017','neck_05_018','head_019']}
for info in feet.values():keyed.update(info['chain']);keyed.add(info['terminal'])
keyed=sorted(keyed);qvalues={i:[] for i in keyed};tvalues=[];times=np.linspace(0,DURATION,129)
for t in times[:-1]:
 p=float(t/DURATION);q,tr,feet_report=solve(p);report['frames'].append({'phase':p,'feet':feet_report})
 for i in hair:
  serial=int(re.search(r'_(\d+)$',d['nodes'][i]['name']).group(1));tail='tail'in d['nodes'][i]['name'];phase=2*np.pi*p;amplitude=.035 if tail else .022;q[i]=q[i]*R.from_euler('xyz',[amplitude*np.sin((1 if tail else 2)*phase-serial*.17),0,amplitude*.5*np.sin(phase+serial*.22)])
 for i in keyed:qvalues[i].append(q[i].as_quat())
 tvalues.append(tr[names['pelvis_08']])
for i in keyed:qvalues[i].append(qvalues[i][0])
tvalues.append(tvalues[0]);report['hairDetailJoints']=len(hair)
def append(values,kind):
 a=np.asarray(values,dtype='<f4');db.extend(b'\0'*((-len(db))%4));offset=len(db);db.extend(a.tobytes());view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});index=len(d['accessors']);acc={'bufferView':view,'componentType':5126,'count':len(a),'type':kind}
 if kind=='SCALAR':acc.update(min=[float(a.min())],max=[float(a.max())])
 d['accessors'].append(acc);return index
inputacc=append(times.reshape(-1,1),'SCALAR');clip={'name':'Target Native Walk','samplers':[],'channels':[]}
for i in keyed:
 qs=np.asarray(qvalues[i]);
 for j in range(1,len(qs)):
  if np.dot(qs[j-1],qs[j])<0:qs[j]*=-1
 sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(qs,'VEC4'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':i,'path':'rotation'}})
sampler=len(clip['samplers']);clip['samplers'].append({'input':inputacc,'output':append(tvalues,'VEC3'),'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':names['pelvis_08'],'path':'translation'}});d['animations'].append(clip);d['asset'].setdefault('extras',{})['privateAuthoredWalk']='Original target standing pose, native skin and appearance; four-beat short-stride Walk proof only.'
candidate=OUT/'target-native-walk.glb';g.write_glb(candidate,d,db)
report['candidateBytes']=candidate.stat().st_size;report['candidateSha256']=hashlib.sha256(candidate.read_bytes()).hexdigest();report['preservation']={k:original.get(k)==d.get(k) for k in ['nodes','meshes','skins','materials','images','textures','scenes']};report['preservation']['originalBinaryPrefix']=bytes(db[:len(original_binary)])==original_binary;assert all(report['preservation'].values())
report['authoredGridPass']=all(abs(row['verticalMeanError'])<.005 and abs(row['strideMeanError'])<.005 and (not row['stance'] or (abs(row['minY']-floor)<.01 and abs(row['maxY']-floor)<.01)) and not row['hitBound'] for frame in report['frames'] for row in frame['feet'].values());report['worstVerticalErrorM']=max(abs(row['verticalMeanError']) for frame in report['frames'] for row in frame['feet'].values());report['worstStrideErrorM']=max(abs(row['strideMeanError']) for frame in report['frames'] for row in frame['feet'].values());report['maxCorrectionDegrees']=max(abs(a) for frame in report['frames'] for row in frame['feet'].values() for a in row['correctionDegrees']);(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['standingProbe','authoredGridPass','worstVerticalErrorM','worstStrideErrorM','maxCorrectionDegrees','hairDetailJoints']},indent=2))
