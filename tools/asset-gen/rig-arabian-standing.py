"""Rig the source-specific standing Arabian derivative, never a substitute horse."""
import hashlib, importlib.util, json, sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/arabian-sculpt'
spec=importlib.util.spec_from_file_location('arabian_helpers',Path(__file__).with_name('rig-arabian-sculpt.py'))
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
source_original, original_faces=h.obj(h.SOURCE,h.SOURCE_SHA)
h.obj(BASE/'source/BASE.obj',h.BASE_SHA)
receipt_bytes=(BASE/'source/receipt.json').read_bytes()
d=np.load(BASE/'work/standing-remesh.npz');source=d['source'];faces=d['faces']
remesh=json.loads((BASE/'work/standing-remesh-report.json').read_text())
if remesh['sourceSha256']!=h.SOURCE_SHA or not np.isfinite(source).all():raise ValueError('Standing derivative source evidence invalid')
ground=float(source[:,2].min());offset=np.array([.430,1.920,ground]);p=source-offset
roi=(abs(source[:,0]-.430)<.085)&(abs(source[:,1]-1.71)<.045)
wi=np.flatnonzero(roi)[p[roi,2].argmax()];scale=1.50/p[wi,2]
canonical=lambda v:np.c_[np.asarray(v)[:,0],np.asarray(v)[:,2],-np.asarray(v)[:,1]]*scale
heads={};parents={};ends={}
def joint(name,point,parent=None,end=None):
 heads[name]=np.array(point)-offset;parents[name]=parent
 if end is not None:ends[name]=np.array(end)-offset
joint('ROOT',[.430,1.920,ground]);joint('pelvis',[.43,2.72,1.91],'ROOT');joint('spine',[.43,2.06,1.89],'pelvis');joint('chest',[.43,1.41,1.95],'spine')
for name,point,parent in [('neck.lower',[.43,1.24,2.08],'chest'),('neck.upper',[.43,.97,2.61],'neck.lower'),('head',[.54,.69,2.83],'neck.upper'),('jaw',[.56,.58,2.46],'head'),('ear.L',[.35,.76,2.94],'head'),('ear.R',[.62,.76,2.94],'head')]:joint(name,point,parent)
tail=[[.43,2.97,2.04],[.48,3.22,2.10],[.52,3.37,1.83],[.56,3.32,1.43],[.59,3.40,1.10]]
for i in range(4):joint('tail.'+str(i+1),tail[i],'pelvis' if i==0 else 'tail.'+str(i),tail[i+1])
front=[[.24,1.25,2.04],[.24,1.06,1.57],[.24,1.12,1.23],[.235,1.11,.70],[.234,1.11,.22],[.233,1.03,.105],[.233,.92,-.020]]
hind=[[.62,2.91,1.84],[.63,2.71,1.20],[.63,3.24,.74],[.628,3.22,.22],[.627,3.15,.09],[.627,3.035,-.020]]
chains={}
for leg in ('FL','FR','HL','HR'):
 points=np.array(front if leg.startswith('F') else hind)
 if leg in ('FR','HL'):points[:,0]=.860-points[:,0]
 suffix=['scapula','upperarm','forearm','cannon','pastern','hoof'] if leg.startswith('F') else ['thigh','shin','cannon','pastern','hoof']
 chains[leg]=[leg+'.'+name for name in suffix]
 for j,name in enumerate(chains[leg]):joint(name,points[j],('chest' if leg.startswith('F') else 'pelvis') if j==0 else chains[leg][j-1],points[j+1])
for leg in chains:joint(leg+'.IK',heads[leg+'.pastern']+offset,'ROOT')
names=list(heads);index={n:i for i,n in enumerate(names)}
if len(names)!=40:raise ValueError('Complete canonical40 required')
x,y,z=p.T;w=np.zeros((len(p),40));rear=h.smooth(.15,.74,y);fore=1-h.smooth(-.82,-.25,y)
w[:,index['pelvis']]=rear;w[:,index['chest']]=fore;w[:,index['spine']]=np.maximum(0,1-fore-rear);w/=w.sum(1)[:,None]
neck=(1-h.smooth(-.66,-.27,y))*h.smooth(1.68-ground,2.05-ground,z);upper=1-h.smooth(-1.04,-.75,y);head=(1-h.smooth(-1.40,-1.08,y))*h.smooth(2.35-ground,2.65-ground,z)
nw=np.zeros_like(w);nw[:,index['neck.lower']]=1-upper;nw[:,index['neck.upper']]=upper;nw*=1-head[:,None];nw[:,index['head']]+=head;w=w*(1-neck[:,None])+nw*neck[:,None]
jaw=(1-h.smooth(-1.48,-1.22,y))*(1-h.smooth(2.39-ground,2.58-ground,z))*h.smooth(2.14-ground,2.23-ground,z);w*=1-jaw[:,None];w[:,index['jaw']]+=jaw
for side,label in [(-1,'L'),(1,'R')]:
 ear=h.smooth(2.93-ground,3.005-ground,z)*h.smooth(.045,.12,x*side);w*=1-ear[:,None];w[:,index['ear.'+label]]+=ear
rigid={}
for leg,chain in chains.items():
 pts=np.vstack([heads[n] for n in chain]+[ends[chain[-1]]]);ds,ts=zip(*(h.capsule(p,pts[j],pts[j+1]) for j in range(len(chain))));ds,ts=np.array(ds).T,np.array(ts).T
 nearest=ds.argmin(1);lengths=np.linalg.norm(np.diff(pts,axis=0),axis=1);stations=np.r_[0,np.cumsum(lengths)];along=stations[nearest]+ts[np.arange(len(p)),nearest]*lengths[nearest]
 trans=np.minimum.accumulate(np.array([h.smooth(stations[j]-.075,stations[j]+.075,along) for j in range(1,len(chain))]),axis=0);lw=np.zeros_like(w);lw[:,index[chain[0]]]=1-trans[0]
 for j in range(1,len(chain)-1):lw[:,index[chain[j]]]=trans[j-1]-trans[j]
 lw[:,index[chain[-1]]]=trans[-1];side=-1 if leg.endswith('L') else 1;radii=np.array([.21,.18,.15,.10,.08,.15] if leg.startswith('F') else [.29,.19,.12,.08,.15])
 owner=(1-h.smooth(1.05,2.1,(ds/radii).min(1)))*h.smooth(.035,.12,x*side)*(1-h.smooth(pts[0,2]-.20,pts[0,2]+.05,z))
 owner=np.maximum(owner,(1-h.smooth(1.40-ground,1.67-ground,z))*h.smooth(.035,.12,x*side)*(1-h.smooth(.16,.30,ds.min(1))))
 w=w*(1-owner[:,None])+lw*owner[:,None]
 foot=heads[leg+'.hoof'];shell=(z<.175-ground)&(np.linalg.norm((p-foot)[:,:2],axis=1)<.27)&(x*side>.07)
 w[shell]=0;w[shell,index[leg+'.hoof']]=1;rigid[leg]=shell
tail_region=h.smooth(1.07,1.20,y)*h.smooth(1.01-ground,1.34-ground,z)*(1-h.smooth(.22,.34,abs(x)));tw=np.zeros_like(w)
for i in range(4):
 distance,_=h.capsule(p,heads['tail.'+str(i+1)],ends['tail.'+str(i+1)]);tw[:,index['tail.'+str(i+1)]]=np.exp(-distance*distance/.023)
tw/=np.maximum(tw.sum(1)[:,None],1e-12);w=w*(1-tail_region[:,None])+tw*tail_region[:,None];w/=w.sum(1)[:,None]
body=canonical(p);jp=canonical(np.array([heads[n] for n in names]));writer=h.helper.Writer();doc=writer.d;doc['asset']['generator']='Meadowlark source-specific standing Arabian retopology'
for name,point in zip(names,jp):
 parent=parents[name];doc['nodes'].append({'name':name,'translation':(point-(jp[index[parent]] if parent else 0)).tolist()})
 if parent:doc['nodes'][index[parent]].setdefault('children',[]).append(index[name])
 else:doc['scenes'][0]['nodes'].append(index[name])
ibm=np.repeat(np.eye(4)[None],40,axis=0);ibm[:,:3,3]=-jp;doc['skins']=[{'name':'Source-specific Arabian canonical40','skeleton':0,'joints':list(range(40)),'inverseBindMatrices':writer.acc(ibm.transpose(0,2,1).reshape(40,16),'MAT4')}]
colors=np.tile([.52,.175,.070,1.],(len(p),1));muzzle=(1-h.smooth(.40,.60,source[:,1]))*(1-h.smooth(2.33,2.48,source[:,2]));colors[:,:3]=colors[:,:3]*(1-muzzle[:,None])+np.array([.060,.046,.042])*muzzle[:,None]
tail_pigment=h.smooth(2.96,3.065,source[:,1])*h.smooth(1.03,1.20,source[:,2]);colors[:,:3]=colors[:,:3]*(1-tail_pigment[:,None])+np.array([.105,.038,.016])*tail_pigment[:,None]
for mask in rigid.values():colors[mask,:3]=[.095,.074,.052]
eye_points=[]
for target_eye in [[.395,.53,2.645],[.759,.53,2.645]]:
 eye=source[np.linalg.norm((source-target_eye)/[.06,.04,.035],axis=1).argmin()];eye_points.append(eye.tolist())
 distance=np.sqrt(np.sum(((source-eye)/[.05,.030,.022])**2,axis=1));mask=1-h.smooth(.55,1,distance);colors[:,:3]=colors[:,:3]*(1-mask[:,None])+np.array([.018,.013,.010])*mask[:,None]
doc['materials']=[{'name':'Newly authored copper Arabian coat','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.66}},{'name':'Newly authored fine red mane and tail','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[.095,.035,.014,1],'metallicFactor':0,'roughnessFactor':.75}}]
def mesh(name,points,triangles,weights,material,color=None):
 ids=np.argsort(weights,axis=1)[:,-4:][:,::-1];limited=np.take_along_axis(weights,ids,axis=1);limited/=limited.sum(1)[:,None]
 a={'POSITION':writer.acc(points,'VEC3'),'NORMAL':writer.acc(h.normals(points,triangles),'VEC3'),'JOINTS_0':writer.acc(ids,'VEC4',5123),'WEIGHTS_0':writer.acc(limited,'VEC4')}
 if color is not None:a['COLOR_0']=writer.acc(color,'VEC4')
 doc['meshes'].append({'name':name,'primitives':[{'attributes':a,'indices':writer.acc(triangles.ravel(),'SCALAR',5125),'material':material}]});doc['nodes'].append({'name':name,'mesh':len(doc['meshes'])-1,'skin':0});doc['scenes'][0]['nodes'].append(len(doc['nodes'])-1)
mesh('HorseBody',body,faces,w,0,colors)
rng=np.random.default_rng(20220930);verts=[];triangles=[];hair_w=[]
def strand(root,weights,direction,length,radius):
 for j in range(7):
  t=j/6;center=root+direction*(length*t);r=radius*(1-.9*t)
  for k in range(3):
   angle=k*np.pi*2/3;verts.append(center+[np.cos(angle)*r,np.sin(angle)*r,0]);hair_w.append(weights)
  if j:
   current=len(verts)-3
   for k in range(3):triangles.extend([[current-3+k,current-3+(k+1)%3,current+(k+1)%3],[current-3+k,current+(k+1)%3,current+k]])
for i in range(300):
 ry=rng.uniform(.95,1.70);mask=(abs(source[:,1]-ry)<.035)&(abs(source[:,0]-.43)<.075);ri=np.flatnonzero(mask)[source[mask,2].argmax()];strand(p[ri]+[0,0,.003],w[ri],np.array([-.68,.1,-1.]),rng.uniform(.12,.25),.0028)
tail_ids=np.flatnonzero((source[:,1]>3.08)&(source[:,2]>1.18)&(source[:,2]<2.03));normal=h.normals(p,faces)
for i in range(330):
 ri=int(rng.choice(tail_ids));strand(p[ri]+normal[ri]*.004,w[ri],np.array([0,.3,-1.]),rng.uniform(.09,.20),.0018)
mesh('HorseGroom',canonical(np.array(verts)),np.array(triangles),np.array(hair_w),1)
def vertical_ray(y_station):
 tri=p[faces];e1,e2=tri[:,1,:2]-tri[:,0,:2],tri[:,2,:2]-tri[:,0,:2];det=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0];t=np.array([0,y_station])-tri[:,0,:2];valid=abs(det)>1e-12
 u=np.divide(t[:,0]*e2[:,1]-t[:,1]*e2[:,0],det,out=np.zeros(len(faces)),where=valid);v=np.divide(e1[:,0]*t[:,1]-e1[:,1]*t[:,0],det,out=np.zeros(len(faces)),where=valid);valid&=(u>=0)&(v>=0)&(u+v<=1)
 values=tri[:,0,2]+u*(tri[:,1,2]-tri[:,0,2])+v*(tri[:,2,2]-tri[:,0,2]);return float(values[valid].max())
seat=[0,vertical_ray(.08)*scale+.012,-.08*scale]
anchors={'saddle':[seat],'saddleSeat':[seat],'withers':[body[wi].tolist()],'head':[jp[index['head']].tolist()],'poll':[canonical(np.array([[.53,.71,2.91]-offset]))[0].tolist()],'muzzle':[canonical(np.array([[.625,.50,2.28]-offset]))[0].tolist()],'crest':[canonical(np.array([[.43,1.1,2.85]-offset]))[0].tolist()],'tail':[jp[index['tail.1']].tolist()],'eyes':canonical(np.array(eye_points)-offset).tolist(),'nostrils':canonical(np.array([[.53,.43,2.30],[.72,.43,2.30]])-offset).tolist()}
ty,tz=seat[1]-.512,seat[2]+.200;tri=body[faces];e1,e2=tri[:,1,1:]-tri[:,0,1:],tri[:,2,1:]-tri[:,0,1:];det=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0];t=np.array([ty,tz])-tri[:,0,1:];valid=abs(det)>1e-12
u=np.divide(t[:,0]*e2[:,1]-t[:,1]*e2[:,0],det,out=np.zeros(len(faces)),where=valid);v=np.divide(e1[:,0]*t[:,1]-e1[:,1]*t[:,0],det,out=np.zeros(len(faces)),where=valid);torso=w[:,[index[n] for n in ('pelvis','spine','chest')]].sum(1);valid&=(u>=0)&(v>=0)&(u+v<=1)&(torso[faces].min(1)>.55)
width=tri[:,0,0]+u*(tri[:,1,0]-tri[:,0,0])+v*(tri[:,2,0]-tri[:,0,0]);lo,hi=float(width[valid].min()),float(width[valid].max());anchors['stirrups']=[[lo-.035,ty,tz],[hi+.035,ty,tz]]
doc['asset']['extras']={'sourceSha256':h.SOURCE_SHA,'creator':'jesusrhino','license':'CC BY4.0','sourceUrl':'https://pinshape.com/items/114373-3d-printed-arabian-horse','adaptation':remesh['method'],'generativeToolsUsed':False}
game=BASE/'game';sha=writer.save(game/'arabian-rigged.glb')
profile={'id':'arabian-sculpt','name':'Source-derived Arabian','file':'arabian-rigged.glb','sha256':sha,'rigSha256':sha,'artistBreed':True,'bodyMesh':'HorseBody','hairMesh':'HorseGroom','withersM':1.50,'heightM':float(np.ptp(body[:,1])),'fitScale':1,'fitY':0,'physicalScale':True,'anchors':anchors,'preserveSaddleAnchor':True,'preserveAuthoredHair':True,'preserveSourceGroom':True,'authoredCoat':True,'sourceAuthor':'jesusrhino','creator':'jesusrhino','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','sourceUrl':'https://pinshape.com/items/114373-3d-printed-arabian-horse','sourceSha256':h.SOURCE_SHA,'jointCount':40,'clips':[],'contactEnvelope':{'radiusM':.20,'aboveTerminalM':.11,'bottomBandM':.009,'sampleAllCandidates':True,'skinnedCorrection':True},'generativeToolsUsed':False,'motionStatus':'source-specific standing rig; final dense motion and posed review pending','bodyTriangleCount':len(faces),'sourceAppearancePreserved':False,'sourceDetailedTopologyRetained':False}
report={**remesh,'rigSha256':sha,'displayBaseSha256':h.BASE_SHA,'displayBaseEntirelyExcluded':True,'physicalWithersM':1.50,'normalizationScale':scale,'sourceFrameCenter':offset.tolist(),'sourceWithersPoint':source[wi].tolist(),'neutralJointsCanonical':{n:jp[index[n]].tolist() for n in names},'sourceOriginalsBothPreserved':hashlib.sha256(h.SOURCE.read_bytes()).hexdigest()==h.SOURCE_SHA and hashlib.sha256((BASE/'source/BASE.obj').read_bytes()).hexdigest()==h.BASE_SHA,'receiptUnchanged':(BASE/'source/receipt.json').read_bytes()==receipt_bytes,'sourceTextures':False,'sourceUVs':False,'sourceSeparateGroom':False,'newlyAuthoredCoatAndFineManeTail':True,'newGroomStrands':630,'newGroomTriangles':len(triangles),'sourceSpecificLimbAdaptation':True,'motionCertification':'pending','generativeToolsUsed':False}
for file,data in [('profile.json',profile),('conversion-report.json',report),('stirrup-fit.json',{'plane':{'y':ty,'z':tz},'outerBarrelX':[lo,hi],'clearanceM':.035,'rawAnchors':anchors['stirrups'],'method':'Actual torso-owned ray at standard English plane; X clearance only.'})]:(game/file).write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
np.savez_compressed(BASE/'work/neutral-source.npz',source=source,neutral=p,faces=faces,weights=w,names=names)
print(json.dumps({'rigSha256':sha,'vertices':len(p),'triangles':len(faces),'withersM':1.50,'standingSourceSpecificRemesh':True}),flush=True)
