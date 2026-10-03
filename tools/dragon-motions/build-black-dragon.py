"""Author motion-only clips against the unchanged 3DHaupt 232-joint dragon.
Run: python3 tools/dragon-motions/build-black-dragon.py (NumPy and SciPy).
Original body, skin weights, inverse binds, textures and creator Scene idle are
never rewritten. Detached source foot controls receive matching FK/IK tracks.
"""
from pathlib import Path
import copy, hashlib, json, sys
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
SRC=ROOT/'assets/models/horse-imports/black-dragon/game/black-dragon-native-2k-candidate.glb'
OUT=ROOT/'assets/models/dragon-motions/black-dragon-motion.glb'
d,b=g.read_glb(SRC);base=copy.deepcopy(d);bw,parents=g.node_worlds(base)
J=d['skins'][0]['joints']; names={n['name']:i for i,n in enumerate(d['nodes'])}
# Feet are not FK children in this Blender-exported skeleton.
LEGS=[{'name':'front-left','upper':90,'lower':91,'end':92,'foot':193,'phase':0},
{'name':'front-right','upper':93,'lower':94,'end':95,'foot':151,'phase':.5},
{'name':'back-left','upper':19,'lower':20,'end':None,'foot':130,'phase':.75},
{'name':'back-right','upper':25,'lower':26,'end':None,'foot':172,'phase':.25}]

def rot(m):return R.from_matrix(m[:3,:3]/np.linalg.norm(m[:3,:3],axis=0))
def world(doc):return g.node_worlds(doc)[0]
def set_world_pos(doc,w,i,p):doc['nodes'][i]['translation']=(np.linalg.inv(w[parents[i]])@np.r_[p,1])[:3].tolist()
def set_world_rot(doc,w,i,q):doc['nodes'][i]['rotation']=(rot(w[parents[i]]).inv()*q).as_quat().tolist()
def turn(doc,i,axis,angle):
 w=world(doc);set_world_rot(doc,w,i,R.from_rotvec(np.asarray(axis)*angle)*rot(w[i]))
def aim(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);norm=np.linalg.norm(v)
 return R.identity() if norm<1e-9 else R.from_rotvec(v/norm*np.arctan2(norm,np.dot(a,b)))
def solve(doc,leg,target,footpitch=0):
 u,l,f=leg['upper'],leg['lower'],leg['foot'];w=world(doc);hip=w[u][:3,3];knee=w[l][:3,3]
 # The hind ankle pivot is independently exported. Use its actual skinned
 # attachment location, retaining the source hock geometry.
 restfoot=bw[f][:3,3];resthip=bw[u][:3,3];restknee=bw[l][:3,3]
 L1=np.linalg.norm(restknee-resthip);L2=np.linalg.norm(restfoot-restknee)
 delta=target-hip;dist=np.linalg.norm(delta);direction=delta/dist;dist=np.clip(dist,abs(L1-L2)+.015,L1+L2-.006)
 reached=hip+direction*dist
 pole=restknee-(resthip+restfoot)*.5;pole-=direction*np.dot(pole,direction);pole/=np.linalg.norm(pole)
 along=(L1*L1-L2*L2+dist*dist)/(2*dist);bend=np.sqrt(max(0,L1*L1-along*along));newknee=hip+direction*along+pole*bend
 set_world_rot(doc,w,u,aim(knee-hip,newknee-hip)*rot(w[u]));w=world(doc)
 # Rest ankle as a point in the lower limb's local space.
 local=(np.linalg.inv(bw[l])@np.r_[restfoot,1])[:3];cur=(w[l]@np.r_[local,1])[:3]
 set_world_rot(doc,w,l,aim(cur-w[l][:3,3],reached-w[l][:3,3])*rot(w[l]));w=world(doc)
 set_world_pos(doc,w,f,reached);set_world_rot(doc,w,f,R.from_rotvec([footpitch,0,0])*rot(bw[f]))
 return float(np.linalg.norm(reached-target))

def footcurve(phase,duty,stride,lift):
 p=phase%1
 if p<duty:return stride*(.5-p/duty),0,0
 s=(p-duty)/(1-duty);ease=s*s*(3-2*s)
 return stride*(-.5+ease),lift*np.sin(np.pi*s)**1.45,-.32*np.sin(np.pi*s)

def wings(doc,phase,flight):
 for side,root,chain in [(1,97,[98,99,100,101]),(-1,112,[113,114,115,116])]:
  if flight:
   # Broad, symmetric shoulder stroke with elbow and outer finger lag.
   turn(doc,root,[0,0,1],side*(.28+.42*np.cos(2*np.pi*phase)))
   turn(doc,root,[0,1,0],side*(.07+.11*np.sin(2*np.pi*phase)))
   turn(doc,chain[1],[0,0,1],side*.05*np.cos(2*np.pi*phase-.55))
   turn(doc,chain[2],[0,0,1],side*.04*np.cos(2*np.pi*phase-.95))
  else:
   # Fold the long finger fan rearward, retaining the source membrane skin.
   turn(doc,root,[0,1,0],side*1.12)
   turn(doc,root,[0,0,1],side*.30)
   for ni in [chain[1]]:turn(doc,ni,[0,1,0],-side*1.55)
   turn(doc,chain[2],[0,1,0],side*1.68)
   turn(doc,chain[3],[0,1,0],side*.45)
   # Inner membrane fingers gather along the folded forewing.
   for ni in ([104,107] if side==1 else [119,122]):turn(doc,ni,[0,1,0],side*.40)

def pose(kind,p):
 doc=copy.deepcopy(base);flight=kind=='DragonFly';run=kind=='DragonRun';stand=kind=='DragonStand';errors=[]
 bob=(.10*np.cos(2*np.pi*p) if flight else (.08*np.cos(4*np.pi*p)-.045 if run else .024*np.cos(4*np.pi*p)))
 w=world(doc);pelvis=w[13][:3,3].copy();pelvis[1]+=bob;set_world_pos(doc,w,13,pelvis)
 turn(doc,31,[1,0,0],(.025 if run else .009)*np.sin(2*np.pi*p))
 turn(doc,36,[1,0,0],(.045 if flight else .018)*np.sin(2*np.pi*p+.5))
 turn(doc,40,[1,0,0],-.015*np.sin(2*np.pi*p+.5))
 for k,i in enumerate([14,15,16,17]):turn(doc,i,[0,1,0],(.055 if flight else .026)*np.sin(2*np.pi*p-k*.5))
 for li,leg in enumerate(LEGS):
  target=bw[leg['foot']][:3,3].copy();pitch=0
  if flight:
   target[1]+=1.08 if li<2 else .64;target[2]-=.50 if li<2 else .18;pitch=-.28 if li<2 else .18
  elif not stand:
   phase=(p+([0,.5,.5,0][li] if run else leg['phase']))%1
   stride=1.55 if run else 1.35;dx,dy,pitch=footcurve(phase,.52 if run else .73,stride,.62 if run else .32)
   target[2]+=dx-((.38 if run else .25) if li<2 else 0);target[1]+=dy
  errors.append(solve(doc,leg,target,pitch))
 wings(doc,p,flight)
 return doc,errors

out={'asset':{'version':'2.0','generator':'Meadowlark native Black Dragon motion'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'animations':[],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]};binary=bytearray();nodeMap={}
def acc(values,kind):
 values=np.array(values,dtype='<f4');binary.extend(b'\0'*(-len(binary)%4));vi=len(out['bufferViews']);out['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':values.nbytes});binary.extend(values.tobytes());a={'bufferView':vi,'componentType':5126,'count':len(values),'type':kind};
 if kind=='SCALAR':a['min']=[float(values.min())];a['max']=[float(values.max())]
 out['accessors'].append(a);return len(out['accessors'])-1
ib=g.accessor(d,b,d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
body=d['meshes'][d['nodes'][246]['mesh']]['primitives'][0]['attributes'];vp=g.accessor(d,b,body['POSITION']);vp=np.c_[vp,np.ones(len(vp))];vj=g.accessor(d,b,body['JOINTS_0']);vw=g.accessor(d,b,body['WEIGHTS_0'])
footnodes=set()
for leg in LEGS:
 stack=[leg['foot']]
 while stack:
  fi=stack.pop();footnodes.add(fi);stack.extend(d['nodes'][fi].get('children',[]))
footids=[k for k,n in enumerate(J) if n in footnodes];footmask=np.sum(vw*np.isin(vj,footids),axis=1)>.7
reports=[]
for kind,duration,speed in [('DragonStand',3.,0),('DragonWalk',1.35,1.35/(1.35*.73)),('DragonRun',.78,1.55/(.78*.52)),('DragonFly',1.65,12.)]:
 N=81;poses=[];errs=[]
 for p in np.linspace(0,1,N):
  doc,err=pose(kind,p if p<1 else 0);poses.append(doc);errs+=err
 floor=[];wing=[]
 for pi in range(0,N,4):
  posed=world(poses[pi]);mats=np.array([posed[k]@ib[z] for z,k in enumerate(J)]);points=np.einsum('nvij,nj,nv->ni',mats[vj],vp,vw)[:,:3]
  assert np.isfinite(points).all()
  floor.append(float(points[footmask,1].min()));wing.append(float(points[:,1].min()))
 clip={'name':kind,'samplers':[],'channels':[]};time=acc(np.linspace(0,duration,N),'SCALAR');staticTime=acc([0,duration],'SCALAR');changed=[]
 for i in J:
  for path,default,ktyp in [('translation',[0,0,0],'VEC3'),('rotation',[0,0,0,1],'VEC4'),('scale',[1,1,1],'VEC3')]:
   vals=np.array([p['nodes'][i].get(path,default) for p in poses]);src=np.array(base['nodes'][i].get(path,default))
   if path=='rotation':
    for x in range(1,N):
     if np.dot(vals[x-1],vals[x])<0:vals[x]*=-1
   if i not in nodeMap:nodeMap[i]=len(out['nodes']);out['nodes'].append({'name':d['nodes'][i]['name']});out['scenes'][0]['nodes'].append(nodeMap[i])
   # Include constant source transforms so creator-idle transition releases all
   # original animated bones predictably, never leaving the previous pose.
   constant=np.max(np.abs(vals-vals[0]))<1e-7;sampler=len(clip['samplers']);clip['samplers'].append({'input':staticTime if constant else time,'output':acc(vals[[0,-1]] if constant else vals,ktyp),'interpolation':'LINEAR'});clip['channels'].append({'sampler':sampler,'target':{'node':nodeMap[i],'path':path}})
   if np.max(np.abs(vals-src))>1e-4:changed.append(d['nodes'][i]['name']+'.'+path)
 out['animations'].append(clip);reports.append({'clip':kind,'duration':duration,'sourceSpeedMps':speed,'samples':N,'joints':232,'changedTracks':changed,'maximumIkReachErrorSourceM':max(errs),'loopEndpointError':0,'feetMinimumYSourceM':min(floor),'bodyMinimumYSourceM':min(wing),'sourceGroundY':-.01812823,'ikErrorByLeg':[max(errs[k::4]) for k in range(4)]})
 print(kind,'done',max(errs),flush=True)
g.write_glb(OUT,out,binary)
report={'source':str(SRC.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'motion':str(OUT.relative_to(ROOT)),'motionSha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'sourceUnchanged':True,'clips':reports,'anchors':{'seat':'paunch_017','head':'head_022','frontLeft':'Hand_L_0133','frontRight':'Hand_R_099','hindLeft':'back_food_L_082','hindRight':'back_food_R_0116','wingLeft':'w_C_L_057','wingRight':'w_C_R_069'}}
(OUT.with_suffix('.json')).write_text(json.dumps(report,indent=2)+'\n');print(OUT,OUT.stat().st_size)
