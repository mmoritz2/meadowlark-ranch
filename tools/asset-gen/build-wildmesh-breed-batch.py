"""Distinct WildMesh-derived breed bodies; original source and UV art stay intact.

python3 tools/asset-gen/build-wildmesh-breed-batch.py [--only bay,chestnut]
Then run calibrate-wildmesh-coats.py and bake-wildmesh-breed-batch.cjs.
Numerical/browse
reviews are separate: creation of a GLB does not certify its visual conformation.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game'
OUT = BASE / 'breeds'
SOURCE_SHA = '743fd70ec937dde1aa550afde17eeb506ca538933e291eca41d2fa8d5ffb20ea'
COATS = {
 'bay': ((.39,.19,.085),'dark'), 'chestnut': ((.54,.24,.10),'flaxen'),
 'palomino': ((.83,.62,.30),'cream'), 'haflinger': ((.66,.31,.12),'cream'),
 'grey': ((.78,.81,.83),'silver'), 'black': ((.145,.132,.125),'dark'),
 'pinto': ((.45,.20,.09),'mixed'), 'appaloosa': ((.48,.23,.11),'dark'),
 'sunset': ((.65,.25,.10),'red'), 'iceland': ((.53,.42,.28),'dark'),
 'welsh': ((.80,.79,.75),'silver'), 'stock': ((.37,.13,.07),'dark'),
 'morgan': ((.38,.13,.06),'dark'), 'thoro': ((.32,.11,.06),'dark'),
 'knab': ((.92,.91,.88),'mixed'), 'marwari': ((.60,.36,.18),'dark'),
 'lipiz': ((1,1,1),'silver'), 'sport': ((.16,.13,.105),'dark'),
 'akhal': ((.86,.67,.35),'gold'), 'bay-sporthorse': ((.48,.29,.16),'dark'),
 'connemara': ((.82,.83,.81),'silver'), 'rockymtn': ((.40,.23,.14),'flaxen'),
 'hanover': ((.44,.22,.11),'dark'), 'camargue': ((.97,.98,.96),'silver'),
 'lusitano': ((.80,.79,.73),'silver')}
HAIR_COLORS = {'dark':(.05,.04,.032), 'flaxen':(.91,.76,.51), 'cream':(1,.92,.75),
 'silver':(.79,.81,.82), 'mixed':(.13,.11,.09), 'red':(.39,.16,.06), 'gold':(.51,.34,.16)}
GROOM = {'chestnut':(1.7,1.13,1), 'haflinger':(1.6,1.10,1), 'black':(2.05,1.18,1),
 'iceland':(1.75,1.10,1), 'grey':(1.4,1.08,1), 'lipiz':(1.3,1.08,1),
 'thoro':(.70,.90,.86), 'akhal':(.48,.82,.48), 'stock':(.84,.96,.94),
 'sport':(1.05,1.02,.88), 'connemara':(1.05,1.03,.92), 'rockymtn':(1.35,1.10,1),
 'hanover':(.82,1.03,.9), 'camargue':(1.5,1.11,1), 'lusitano':(1.5,1.13,1)}
FEATHER = {'black':.45, 'sport':.12, 'chestnut':.055, 'haflinger':.025}


def trusted(filename, name):
 previous=sys.dont_write_bytecode;sys.dont_write_bytecode=True
 try:
  spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
  m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 finally:sys.dont_write_bytecode=previous


def digest(data):return hashlib.sha256(data).hexdigest()
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def save_json(path,value):path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')


def spec_for(key,conf):
 if key in conf:return copy.deepcopy(conf[key])
 if key=='bay-sporthorse':
  spec=copy.deepcopy(conf['sport']);s={k:1 for k in spec['sculpt_targets']}
  s.update(face_profile_depth_per_withers=0,neck_arch_rise_per_withers=.022,body_length=1.015,limb_length=1.02)
  spec.update(canonical_breed='Bay Sporthorse',sculpt_targets=s)
  spec['height']['target_m']=1.64;spec['artDecision']='Existing build-artist-breeds.py distinct individual targets';return spec
 extras={
  'connemara':('iceland',1.43,'Compact athletic sport pony; cleaner/longer limbs than Icelandic',dict(body_length=1,barrel_width=1.075,body_depth=1.045,neck_length=.985,neck_thickness=1.035,head_length=.97,head_width=1.04,ear_length=.9,limb_length=.975,hoof_width=1.035,hindquarter_width=1.065,neck_arch_rise_per_withers=.035)),
  'rockymtn':('morgan',1.54,'Medium smooth-gait saddle individual with longer body and relaxed medium neck',dict(body_length=1.015,barrel_width=1.035,body_depth=1.035,neck_length=.98,neck_thickness=1.02,head_length=1.005,head_width=1.035,ear_length=.98,limb_length=1.015,hoof_width=1.04,hindquarter_width=1.045,face_profile_depth_per_withers=.002,neck_arch_rise_per_withers=.03)),
  'hanover':('thoro',1.7,'Tall substantial sport individual; greater barrel/quarters and crest than Thoroughbred',dict(body_length=1.055,barrel_width=1.055,body_depth=1.055,neck_length=1.08,neck_thickness=1.045,head_length=1.04,head_width=1.025,ear_length=1.025,limb_length=1.085,hoof_width=1.075,hindquarter_width=1.095,neck_arch_rise_per_withers=.043)),
  'camargue':('lipiz',1.42,'Compact hardy pale saddle individual with lower straighter neck and stout feet',dict(body_length=.985,barrel_width=1.105,body_depth=1.07,neck_length=.935,neck_thickness=1.07,head_length=1.035,head_width=1.055,ear_length=.96,limb_length=.94,hoof_width=1.10,hindquarter_width=1.075,face_profile_depth_per_withers=.006,neck_arch_rise_per_withers=.026)),
  'lusitano':('grey',1.58,'Compact baroque riding individual; stronger high crest and shorter limbs than PRE exemplar',dict(body_length=.965,barrel_width=1.095,body_depth=1.065,neck_length=1.025,neck_thickness=1.19,head_length=1.035,head_width=1.045,ear_length=.945,limb_length=.965,hoof_width=1.065,hindquarter_width=1.09,face_profile_depth_per_withers=.014,neck_arch_rise_per_withers=.066))}
 parent,height,note,changes=extras[key];spec=copy.deepcopy(conf[parent]);spec['sculpt_targets'].update(changes)
 spec['height']['target_m']=height;spec['canonical_breed']=key;spec['artDecision']=note;spec['morphology']['build']=note
 spec['source_ids']=[];spec['inheritedMorphologyRow']=parent;spec['height']['range_basis']='Selected game individual art target; no asserted breed registration requirement'
 return spec


def cage(points,s,key,withers,heads):
 p=np.asarray(points,float);one=p.ndim==1
 if one:p=p[None,:]
 p=p/withers;x,y,z=p.T;q=p.copy()
 head=smooth(.43,.58,z)*smooth(.72,.88,y)
 neck=smooth(.10,.29,z)*smooth(.73,.88,y)
 torso=(1-neck)*smooth(.42,.67,y)
 rump=smooth(-.13,-.45,z)*torso
 width=1+torso*(s['barrel_width']-1)+rump*(s['hindquarter_width']-s['barrel_width'])
 leg=1-smooth(.42,.67,y)
 # Lateral leg thickness and stance are independent of body barrel expansion.
 lateral=np.sign(x)*.105
 q[:,0]=x*width+leg*((x-lateral)*(.32*(s['barrel_width']-1))+lateral*(s['barrel_width']-1)*.65)
 q[:,2]=z*s['body_length'];q[:,1]=y+(s['limb_length']-1)*np.minimum(y,.61)
 q[:,1]+=(y-.80)*(s['body_depth']-1)*torso
 q[:,2]+=(z-.18)*(s['neck_length']-1)*neck;q[:,1]+=(y-.85)*(s['neck_length']-1)*neck
 center_y=.86+np.clip((z-.18)/.42,0,1)*.30
 q[:,0]+=x*(s['neck_thickness']-1)*neck*(1-head)
 q[:,1]+=(y-center_y)*(s['neck_thickness']-1)*neck*(1-head)
 arch=np.sin(np.clip((z-.12)/.54,0,1)*math.pi)*smooth(.85,1.05,y)
 q[:,1]+=s['neck_arch_rise_per_withers']*arch*(1-head*.65)
 q[:,0]+=x*(s['head_width']-1)*head
 q[:,2]+=(z-.58)*(s['head_length']-1)*head;q[:,1]+=(y-1.15)*(s['head_length']-1)*head
 nose=np.exp(-((z-.71)/.115)**2-((y-1.00)/.12)**2)*head
 q[:,2]+=s['face_profile_depth_per_withers']*nose
 ears=smooth(1.176,1.22,y);q[:,1]+=(y-1.176)*(s['ear_length']-1)*ears
 if key=='marwari':
  curl=smooth(1.20,1.25,y);distance=q[:,0]-heads[6,0]/withers
  # Curl each tip inward without crossing the head's centre line or flattening
  # its cross-section. The earlier constant offset let the tips intersect.
  q[:,0]-=.045*curl*distance/(np.abs(distance)+.060);q[:,2]+=.012*curl
 elif key=='black':q[:,0]-=np.sign(x-heads[6,0]/withers)*.010*smooth(1.21,1.25,y)
 hoof=1-smooth(.073,.125,y)
 feet=heads[[19,25,30,35]][:,[0,2]]/withers
 nearest=np.argmin(np.sum((p[:,None,[0,2]]-feet[None,:,:])**2,axis=2),axis=1)
 q[:,0]+=(x-feet[nearest,0])*(s['hoof_width']-1)*hoof
 q[:,2]+=(z-feet[nearest,1])*(s['hoof_width']-1)*hoof
 return (q*withers)[0] if one else q*withers


def components(indices,count):
 parent=np.arange(count)
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for tri in indices.reshape(-1,3):
  a=find(int(tri[0]))
  for j in tri[1:]:parent[find(int(j))]=a
 groups={}
 for i in range(count):groups.setdefault(find(i),[]).append(i)
 return [np.array(v) for v in groups.values()]


def uv_atlas(points,uv,indices,size=1024):
 atlas=np.zeros((size,size,3),np.float32);mask=np.zeros((size,size),bool)
 for ids in indices.reshape(-1,3):
  t=uv[ids]*(size-1);lo=np.maximum(0,np.floor(t.min(0)).astype(int));hi=np.minimum(size-1,np.ceil(t.max(0)).astype(int))
  if np.any(hi<lo):continue
  yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0=t[1]-t[0];v1=t[2]-t[0];den=v0[0]*v1[1]-v1[0]*v0[1]
  if abs(den)<1e-9:continue
  px=xx-t[0,0];py=yy-t[0,1];a=(px*v1[1]-v1[0]*py)/den;b=(v0[0]*py-px*v0[1])/den;inside=(a>=-.005)&(b>=-.005)&(a+b<=1.005)
  p=points[ids];mapped=p[0]+a[...,None]*(p[1]-p[0])+b[...,None]*(p[2]-p[0])
  atlas[lo[1]:hi[1]+1,lo[0]:hi[0]+1][inside]=mapped[inside];mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=inside
 for _ in range(5):
  for axis in (0,1):
   for step in (-1,1):
    neighbor=np.roll(mask,step,axis);take=~mask&neighbor;atlas[take]=np.roll(atlas,step,axis)[take];mask[take]=True
 return atlas,mask


def coat(key,original,atlas,mask,path):
 # All texture marks are painted in this source's original UVs. Multiplying its
 # actual RGB retains artist hair grain, muscle shading, face/hoof detail.
 h,w=original.shape[:2];coords=np.stack([np.asarray(Image.fromarray(atlas[:,:,j]).resize((w,h),Image.Resampling.BILINEAR)) for j in range(3)],axis=2)
 x,y,z=np.moveaxis(coords,-1,0);color=np.ones((h,w,3),np.float32)*COATS[key][0]
 lower=1-smooth(.18,.62,y)
 if key in ['bay','palomino','pinto','appaloosa','stock','morgan','thoro','marwari','bay-sporthorse','hanover','akhal','iceland']:
  color=color*(1-lower[...,None]*.78)+np.array((.08,.065,.05))*lower[...,None]*.78
 if key in ['grey','welsh','connemara']:
  dapple=np.sin(x*40+np.sin(z*13))*np.sin(z*35+np.sin(y*16))*np.sin(y*33+np.cos(x*19));amount=smooth(.05,.60,dapple)*smooth(.50,1.3,y)*.22;color*=1-amount[...,None]
 if key=='pinto':
  field=np.sin(z*5.9+y*3.3)+.55*np.sin(z*11.1-y*5.4)+.5*np.cos(x*8.7+y*7.1)
  white=smooth(.13,.28,field);color=color*(1-white[...,None])+np.array((1,.99,.95))*white[...,None]
 if key in ['knab','appaloosa']:
  field=np.sin(x*61+z*22+np.sin(y*13))*np.sin(z*53-y*12)*np.sin(y*49+x*9);spots=smooth(.55,.69,field)
  blanket=smooth(-.18,-.55,z)*smooth(.90,1.2,y) if key=='appaloosa' else np.ones_like(x)
  marked=np.array((1,.99,.95))*(1-spots[...,None])+np.array((.07,.055,.04))*spots[...,None];color=color*(1-blanket[...,None])+marked*blanket[...,None]
 if key=='iceland':color*=1-((1-smooth(.014,.035,abs(x)))*smooth(1.50,1.63,y)*.65)[...,None]
 if key in ['haflinger','chestnut','marwari']:
  width=.035 if key=='haflinger' else .019;blaze=(1-smooth(width,width+.012,abs(x+.03)))*smooth(.95,1.12,z)*smooth(1.54,1.74,y)*(1-smooth(2.04,2.10,y));color=color*(1-blaze[...,None])+np.array((1,.98,.93))*blaze[...,None]
 rgb=np.clip(original[:,:,:3].astype(np.float32)/255*color,0,1);rgba=original.copy();rgba[:,:,:3]=(rgb*255+.5).astype(np.uint8)
 Image.fromarray(rgba).save(path,optimize=True)
 return {'file':path.name,'sha256':digest(path.read_bytes()),'originalBodyPixelSha256':digest(original.tobytes()),'method':'Multiply original source RGBA detail with anatomical color/mark masks rasterized in unchanged original UVs; no b2 images','resolution':[w,h]}


class Writer:
 def __init__(self,doc):self.doc=doc;self.binary=bytearray();doc['accessors']=[];doc['bufferViews']=[]
 def add(self,values,kind,target=None,component=5126):
  dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component];a=np.asarray(values,dtype=dtype);self.binary.extend(b'\0'*(-len(self.binary)%4));v={'buffer':0,'byteOffset':len(self.binary),'byteLength':a.nbytes}
  if target:v['target']=target
  vi=len(self.doc['bufferViews']);self.doc['bufferViews'].append(v);self.binary.extend(a.tobytes());acc={'bufferView':vi,'componentType':component,'count':len(a),'type':kind}
  if kind=='VEC3':acc.update(min=a.min(0).astype(float).tolist(),max=a.max(0).astype(float).tolist())
  ai=len(self.doc['accessors']);self.doc['accessors'].append(acc);return ai


def build_shape(key,spec,doc,binary,arrays,heads,groups,base_profile,glb,texture_uris,coat_info):
 folder=OUT/key;folder.mkdir(parents=True,exist_ok=True);s=spec['sculpt_targets'];withers=base_profile['withersM'];body=arrays[0]['POSITION']
 wm=(np.abs(body[:,0])<.07)&(body[:,2]>.285)&(body[:,2]<.426)
 raw=cage(body,s,key,withers,heads);ground=float(raw[:,1].min());target=spec['height']['target_m'];factor=target/(float(raw[wm,1].max())-ground)
 def warp(p):
  q=cage(p,s,key,withers,heads);q[...,1]-=ground;return q*factor
 new_heads=warp(heads);new_heads[0]=0
 d={k:copy.deepcopy(doc[k]) for k in ['asset','materials','textures','samplers','images','extensionsUsed'] if k in doc};d['meshes']=[];d['nodes']=copy.deepcopy(doc['nodes']);d['skins']=copy.deepcopy(doc['skins']);d['scenes']=copy.deepcopy(doc['scenes']);d['scene']=0;d['buffers']=[{'byteLength':0}]
 for i,img in enumerate(d['images']):img.pop('bufferView',None);img.pop('mimeType',None);img['uri']=texture_uris[i]
 d['images'][0]['uri']='../textures/'+coat_info['file'];hair=d['materials'][2]['pbrMetallicRoughness'];hair['baseColorFactor']=[*HAIR_COLORS[COATS[key][1]],1]
 coat_finish=None
 if key in {'black','sport'}:
  # A newly authored dark coat needs a modest nonmetallic fur reflection so
  # muscle detail remains visible. All original UVs/maps/tack are retained; the
  # preferred white source material is untouched.
  d['materials'][0]['pbrMetallicRoughness']['roughnessFactor']=.70
  d['materials'][0].setdefault('extensions',{}).setdefault('KHR_materials_specular',{})['specularFactor']=.65
  if 'KHR_materials_specular' not in d.setdefault('extensionsUsed',[]):d['extensionsUsed'].append('KHR_materials_specular')
  coat_finish={'roughness':.70,'specularFactor':.65,'reason':'Authored dark fur sheen for visible body detail; original white/source materials unchanged'}
 writer=Writer(d);names=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
 parents={child:i for i,node in enumerate(doc['nodes'][:40]) for child in node.get('children',[])}
 for i in range(40):d['nodes'][i]['translation']=(new_heads[i]-(new_heads[parents[i]] if i in parents else 0)).tolist()
 inverse=np.tile(np.eye(4),(40,1,1));inverse[:,:3,3]=-new_heads;d['skins'][0]['inverseBindMatrices']=writer.add(inverse.transpose(0,2,1).reshape(40,16),'MAT4')
 mesh_reports=[];groom_components=[];groom_kept=0
 for mi,source in enumerate(arrays):
  p=source['POSITION'];q=warp(p);normal=source['NORMAL'];eps=1e-5;jac=np.stack([(warp(p+np.eye(3)[axis]*eps)-warp(p-np.eye(3)[axis]*eps))/(2*eps) for axis in range(3)],axis=2)
  determinant=np.linalg.det(jac)
  if not np.isfinite(determinant).all() or (determinant<.025).any():raise ValueError('Inverted deformation cage in '+key+'/'+doc['meshes'][mi]['name'])
  normals=np.linalg.solve(jac.transpose(0,2,1),normal[...,None])[...,0];normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-10)
  index=source['indices'];keep=np.arange(len(p))
  if mi==2:
   mane,tail,density=GROOM.get(key,(1,1,1));keep_list=[]
   for ci,ids in enumerate(groups):
    weight=source['WEIGHTS_0'][ids];joint=source['JOINTS_0'][ids];tail_owner=float(np.sum(weight*np.isin(joint,[10,11,12,13]))/len(ids));kind='tail' if tail_owner>.5 else 'mane'
    ratio=density if kind=='mane' else min(1,density+.16)
    if ((ci*2654435761)%997)/997>ratio:continue
    groom_kept+=1;keep_list.extend(ids);tip=q[ids];root=tip[np.argmax(p[ids,1])].copy();growth=tail if kind=='tail' else mane
    tip=root+(tip-root)*np.array([1+.13*(growth-1),growth,1+.05*(growth-1)])
    if growth>1.2:tip[:,0]+=.010*target*np.sin((root[1]-tip[:,1])*19+ci*.71)*np.clip((root[1]-tip[:,1])/.20,0,1)
    tip[:,1]=np.maximum(tip[:,1],.012*target);q[ids]=tip;groom_components.append({'kind':kind,'vertices':len(ids),'lengthFactor':growth})
   keep=np.array(sorted(set(keep_list)));remap=np.full(len(p),-1);remap[keep]=np.arange(len(keep));tri=index.reshape(-1,3);index=remap[tri[(remap[tri]>=0).all(1)]].reshape(-1)
  attrs={}
  for name,a in source.items():
   if name=='indices':continue
   a=q if name=='POSITION' else normals if name=='NORMAL' else a
   attrs[name]=writer.add(a[keep], 'VEC2' if name.startswith('TEXCOORD') else 'VEC4' if name in ['JOINTS_0','WEIGHTS_0'] else 'VEC3',34962,5123 if name=='JOINTS_0' else 5126)
  prim={'attributes':attrs,'indices':writer.add(index,'SCALAR',34963,5125),'material':doc['meshes'][mi]['primitives'][0]['material']}
  d['meshes'].append({'name':doc['meshes'][mi]['name'],'primitives':[prim]})
  mesh_reports.append({'name':doc['meshes'][mi]['name'],'vertices':len(keep),'triangles':len(index)//3,'cageJacobianMin':float(determinant.min()),'bounds':[q[keep].min(0).tolist(),q[keep].max(0).tolist()]})
 # Real source alpha-card samples create anatomy-weighted silky fetlock fringe;
 # no opaque boot surface and no change to the authoritative body sole skin.
 feather=FEATHER.get(key,0)
 if feather:
  template=next(ids for ids in groups if len(ids)>=4 and np.ptp(arrays[2]['POSITION'][ids,1])>.10)
  tp=arrays[2]['POSITION'][template];extent=np.ptp(tp,axis=0);vertical=(tp[:,1]-tp[:,1].min())/extent[1]
  horizontal=(tp[:,0]-tp[:,0].mean())/max(extent[0],.005)
  original_tri=arrays[2]['indices'].reshape(-1,3);original_tri=original_tri[np.isin(original_tri,template).all(1)];remap={int(v):i for i,v in enumerate(template)};local_tri=np.array([[remap[int(v)] for v in tri] for tri in original_tri])
  fp=[];fn=[];fu=[];fj=[];fw=[];fi=[]
  for leg,(cannon,pastern,hoof) in zip(['FL','FR','HL','HR'],[(17,18,19),(23,24,25),(28,29,30),(33,34,35)]):
   foot=new_heads[hoof];height=target*(.04+.16*feather);width=target*(.018+.034*feather)
   for card in range(12 if feather>.1 else 5):
    angle=math.pi*(.58+.84*card/max(1,(11 if feather>.1 else 4)));radius=target*.025;center=foot+np.array([math.cos(angle)*radius,0,math.sin(angle)*radius])
    points=np.c_[center[0]+horizontal*width*math.cos(angle),np.maximum(.006*target,foot[1]-.070*target)+vertical*height,center[2]+horizontal*width*math.sin(angle)]
    start=len(fp);fp.extend(points);fn.extend(np.tile([math.sin(angle),0,-math.cos(angle)],(len(points),1)));fu.extend(arrays[2]['TEXCOORD_0'][template]);fj.extend(np.tile([pastern,hoof,cannon,0],(len(points),1)));fw.extend(np.c_[np.ones(len(points))*.7,(1-vertical)*.3,vertical*.3,np.zeros(len(points))]);fi.extend((local_tri+start).reshape(-1))
  attrs={name:writer.add(value,kind,34962,component) for name,value,kind,component in [('POSITION',fp,'VEC3',5126),('NORMAL',fn,'VEC3',5126),('TEXCOORD_0',fu,'VEC2',5126),('JOINTS_0',fj,'VEC4',5123),('WEIGHTS_0',fw,'VEC4',5126)]}
  mesh_id=len(d['meshes']);d['meshes'].append({'name':'HorseFeather','primitives':[{'attributes':attrs,'indices':writer.add(fi,'SCALAR',34963,5125),'material':2}]});d['nodes'].append({'name':'HorseFeather','mesh':mesh_id,'skin':0});d['scenes'][0]['nodes'].append(len(d['nodes'])-1)
  mesh_reports.append({'name':'HorseFeather','vertices':len(fp),'triangles':len(fi)//3,'source':'Original alpha-card topology/UV sample with new fetlock placement and anatomical weights'})
 anchors={k:warp(np.array(v)).tolist() for k,v in base_profile['anchors'].items()}
 profile={**copy.deepcopy(base_profile),'id':key,'name':spec['canonical_breed'],'file':'rig.glb','withersM':target,'heightM':float(warp(body)[:,1].max()),'fitScale':1,'fitY':0,'physicalScale':True,'preferredWhiteWesternFile':'../../white-western-animated.glb','anchors':anchors,'conformation':spec['morphology']['build'],'morphology':spec['morphology'],'sculptTargets':s,'coat':COATS[key][0],'groom':{'maneLengthFactor':GROOM.get(key,(1,1,1))[0],'tailLengthFactor':GROOM.get(key,(1,1,1))[1],'sourceCardDensityFactor':GROOM.get(key,(1,1,1))[2],'feathering':feather},'clips':[],'motionStatus':'pending bake and QA','visualReview':'pending','textureProvenance':'../texture-provenance.json'}
 profile.pop('motionValidation',None);profile.pop('mountedRiderIntegrationReview',None)
 if base_profile.get('sourceTackAnchors'):profile['sourceTackAnchors']={key:warp(np.asarray(value)).tolist() for key,value in base_profile['sourceTackAnchors'].items()}
 d['asset'].setdefault('extras',{})['breedDerivative']={'id':key,'sourceSha256':SOURCE_SHA,'method':'Continuous anatomy cage, fitted skeleton/inverse binds/tack/anchors; original UV maps and source card groom varied regionally','conformationArtDecision':spec.get('artDecision')}
 glb.write_glb(folder/'rig.glb',d,writer.binary);profile['rigSha256']=profile['sha256']=digest((folder/'rig.glb').read_bytes());profile['bodyGeometrySha256']=digest(np.asarray(warp(body),'<f4').tobytes());profile['triangles']=sum(m['triangles'] for m in mesh_reports)
 save_json(folder/'profile.json',profile)
 report={'id':key,'status':'distinct regional body built; motion and visual review pending','sourceSha256':SOURCE_SHA,'rigSha256':profile['sha256'],'bodyGeometrySha256':profile['bodyGeometrySha256'],'targetWithersM':target,'measuredWithersM':float(warp(body)[wm,1].max()),'groundY':float(warp(body)[:,1].min()),'sculptTargets':s,'morphology':spec['morphology'],'artDecision':spec.get('artDecision'),'primaryConformationSourceIds':spec.get('source_ids',[]),'sourceMaterialUVsPreserved':True,'authoredDarkCoatFinish':coat_finish,'sourceCoreWeightsPreserved':True,'allTackAndAnchorsFitWithSameCage':True,'preferredUnmodifiedWhiteFoundationPreserved':'../../white-western-animated.glb','compactBINOnlyReferencedViews':True,'meshes':mesh_reports,'groom':{'originalComponents':len(groups),'keptComponents':groom_kept,'regionalLengthFactors':GROOM.get(key,(1,1,1)),'featherFactor':feather},'textureProvenance':coat_info,'jointPositions':new_heads.tolist(),'jointNames':names}
 save_json(folder/'shape-build-report.json',report);print(key,profile['sha256'],target,profile['triangles'],flush=True)
 return profile


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--only');args=parser.parse_args()
 glb=trusted('rig_hero_horse.py','wildmesh_batch_glb');paths=trusted('extract-horse-import.py','wildmesh_batch_paths');candidate,source,receipt=paths.registered_source('wildmesh-white-western')
 original=source.read_bytes();receipt_original=(source.parent/'receipt.json').read_bytes()
 if digest(original)!=SOURCE_SHA:raise ValueError('Approved original changed')
 doc,binary=glb.read_glb(BASE/'white-western.glb');base_profile=json.loads((BASE/'profile.json').read_text());build=json.loads((BASE/'build-report.json').read_text())
 if digest((BASE/'white-western.glb').read_bytes())!=build['gameSha256']:raise ValueError('Verified canonical base changed')
 mapping=[x for x in json.loads((ROOT/'assets/models/horse-imports/replacement-plan.json').read_text())['identityMapping'] if x['bodySource']=='wildmesh-white-western']
 shape_of={x['id']:(x['id'] if x['family']=='breed' else x['currentFoundation']) for x in mapping};keys=sorted(set(shape_of.values()));requested=set(args.only.split(',')) if args.only else set(keys)
 if not requested<=set(keys):raise ValueError('Unknown shape selection')
 conf=json.loads((ROOT/'tools/asset-gen/breed-conformation.json').read_text())['conformations'];OUT.mkdir(parents=True,exist_ok=True);textures=OUT/'textures';textures.mkdir(exist_ok=True)
 arrays=[]
 for mesh in doc['meshes']:
  primitive=mesh['primitives'][0];a={k:glb.accessor(doc,binary,i) for k,i in primitive['attributes'].items()};a['indices']=glb.accessor(doc,binary,primitive['indices']).reshape(-1);arrays.append(a)
 heads=np.array([row['position'] for row in build['canonicalJointSource']]);groups=components(arrays[2]['indices'],len(arrays[2]['POSITION']))
 texture_uris=[];provenance=[];body_image=None
 for i,image in enumerate(doc['images']):
  view=doc['bufferViews'][image['bufferView']];data=bytes(binary[view.get('byteOffset',0):][:view['byteLength']]);name='source-'+str(i)+'-'+digest(data)[:16]+'.png';target=textures/name
  if target.exists() and target.read_bytes()!=data:raise ValueError('Original shared texture mismatch')
  target.write_bytes(data);texture_uris.append('../textures/'+name);provenance.append({'imageIndex':i,'file':name,'sha256':digest(data),'originalPNGBytesUnchanged':True,'sourceSha256':SOURCE_SHA,'author':'WildMesh 3D','license':'CC BY-NC 4.0'})
  if i==0:body_image=np.asarray(Image.open(io.BytesIO(data)).convert('RGBA'))
 atlas,mask=uv_atlas(arrays[0]['POSITION'],arrays[0]['TEXCOORD_0'],arrays[0]['indices']);profiles={};variants=[]
 for key in keys:
  if key not in requested:
   path=OUT/key/'profile.json'
   if path.exists():profiles[key]=json.loads(path.read_text())
   continue
  coat_info=coat(key,body_image,atlas,mask,textures/('coat-'+key+'.png'));variants.append(coat_info);profiles[key]=build_shape(key,spec_for(key,conf),doc,binary,arrays,heads,groups,base_profile,glb,texture_uris,coat_info)
 if source.read_bytes()!=original or (source.parent/'receipt.json').read_bytes()!=receipt_original:raise RuntimeError('Original source/receipt changed')
 previous=json.loads((OUT/'texture-provenance.json').read_text()) if (OUT/'texture-provenance.json').exists() else {}
 previous_variants={x['file']:x for x in previous.get('coatVariants',[])};previous_variants.update({x['file']:x for x in variants})
 save_json(OUT/'texture-provenance.json',{'sourceSha256':SOURCE_SHA,'originalImages':provenance,'coatVariants':list(previous_variants.values()),'UVRasterSize':1024,'license':'CC BY-NC 4.0','creator':'WildMesh 3D','sourceUrl':base_profile['sourceUrl']})
 models={}
 for identity in mapping:
  key=shape_of[identity['id']]
  if key not in profiles:continue
  p=copy.deepcopy(profiles[key]);p.update(id=identity['id'],name=identity['name'],label=identity['name'],file=key+'/'+p['file'],foundation=key,currentFoundation=identity['currentFoundation'],family=identity['family'],bodySource='wildmesh-white-western',componentSources=identity['componentSources']);p['textureProvenance']='texture-provenance.json';models[identity['id']]=p
 save_json(OUT/'manifest.json',{'schemaVersion':1,'source':'WildMesh approved western horse regional breed batch','modelBase':'assets/models/horse-imports/wildmesh-white-western/game/breeds/','identityCount':len(mapping),'physicalModelCount':len(keys),'expectedShapeIds':keys,'mappedIdentities':shape_of,'preferredWhiteWesternFile':'../white-western-animated.glb','license':'CC BY-NC 4.0','models':models,'status':'shape generation only; bake/visual QA reports required'})
 print(json.dumps({'mappedIdentities':len(mapping),'distinctBodies':len(keys),'generated':len(requested),'sourceUnchanged':True}))

if __name__=='__main__':main()
